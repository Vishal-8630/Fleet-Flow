/**
 * ============================================================================
 * FF-ISSUE-045 & DEC-007 OPTION B — CUSTOMER CREDIT EXPOSURE & OVERRIDE TESTS
 * ============================================================================
 * Tests:
 * 1. Unconfigured limit (enforce_credit_limit: false): Unrestricted credit.
 * 2. Explicit zero limit (enforce_credit_limit: true, credit_limit: 0): Zero credit permitted.
 * 3. Soft warning (HTTP 409 CREDIT_LIMIT_EXCEEDED) with arithmetic breakdown.
 * 4. Role gate: Non-admin override rejected (HTTP 403).
 * 5. Justification length validation: < 10 characters rejected (HTTP 400).
 * 6. Authorized Company Admin override: Succeeds and creates immutable AuditLog.
 * 7. Server-side enforcement across both dispatch Journey and create LR Entry.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { BillingParty } from '../../models/BillingParty.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { AuditLog } from '../../models/AuditLog.js';
import { User } from '../../models/User.js';
import { CompanyMember } from '../../models/CompanyMember.js';
import jwt from 'jsonwebtoken';

describe('FF-ISSUE-045 & DEC-007 Option B: Customer Credit Exposure & Admin Override', () => {
  let tenant: TestTenantContext;
  let dispatcherToken: string;
  let truck: any;
  let driver: any;
  let balanceParty: any;

  beforeEach(async () => {
    tenant = await createTestTenant({ name: 'Apex Logistics' });

    // Non-admin user (dispatcher)
    const dispatcherUser = await User.create({
      name: 'Dispatcher Sarah',
      email: `dispatcher-${Date.now()}-${Math.random()}@apex.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      is_verified: true,
      token_version: 0,
    });
    await CompanyMember.create({
      company_id: tenant.company._id,
      user_id: dispatcherUser._id,
      email: dispatcherUser.email,
      role: 'dispatcher',
      status: 'active',
    });
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
    dispatcherToken = jwt.sign(
      {
        userId: dispatcherUser._id.toString(),
        companyId: tenant.company._id.toString(),
        token_version: 0,
      },
      secret,
      { expiresIn: '1d' }
    );

    truck = await Truck.create({
      company_id: tenant.company._id,
      truck_no: `GJ01XY${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Signa 2823',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
    });

    driver = await Driver.create({
      company_id: tenant.company._id,
      name: 'Mohan Lal',
      phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'active',
    });

    balanceParty = await BalanceParty.create({
      company_id: tenant.company._id,
      party_name: 'Supplier Alpha',
      party_type: 'supplier',
      phone: '+919876543230',
      opening_balance: 0,
      current_balance: 0,
      status: 'active',
    });
  });

  it('permits unrestricted credit when enforce_credit_limit is false', async () => {
    // Customer with limit 10,000, current outstanding 50,000, but enforce_credit_limit = false
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Unrestricted Industrial Corp',
      credit_limit: 10000,
      enforce_credit_limit: false,
      outstanding_receivables: 50000,
      status: 'active',
    });

    // Create entry with freight amount 20000
    const res = await request(app)
      .post('/api/operations/vehicle-entries')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        vehicle_number: truck.truck_no,
        driver_name: driver.name,
        from_location: 'Surat',
        to_location: 'Mumbai',
        balance_party_id: balanceParty._id,
        billing_party_id: customer._id,
        freight_amount: 20000,
      });

    expect(res.status).toBe(201);
  });

  it('blocks credit when explicitly configured with zero limit (enforce_credit_limit: true, credit_limit: 0)', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Strict Cash-Only Customer',
      credit_limit: 0,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      status: 'active',
    });

    const res = await request(app)
      .post('/api/operations/vehicle-entries')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        vehicle_number: truck.truck_no,
        driver_name: driver.name,
        from_location: 'Surat',
        to_location: 'Delhi',
        balance_party_id: balanceParty._id,
        billing_party_id: customer._id,
        freight_amount: 5000,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(res.body.exposure.credit_limit).toBe(0);
    expect(res.body.exposure.projected_exposure).toBe(5000);
    expect(res.body.exposure.excess_amount).toBe(5000);
  });

  it('rejects non-admin attempt to override credit limit breach with 403 FORBIDDEN', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Over-Limit Merchant',
      credit_limit: 20000,
      enforce_credit_limit: true,
      outstanding_receivables: 25000,
      status: 'active',
    });

    // Dispatcher attempts override on order of 25,000 against 20,000 limit
    const res = await request(app)
      .post('/api/operations/vehicle-entries')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        vehicle_number: truck.truck_no,
        driver_name: driver.name,
        from_location: 'Surat',
        to_location: 'Delhi',
        balance_party_id: balanceParty._id,
        billing_party_id: customer._id,
        freight_amount: 25000,
        credit_override: true,
        override_reason: 'I am the dispatcher and approve this movement.',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Company Administrator authorization required/i);
  });

  it('rejects Company Admin override with justification under 10 characters with 400 BAD REQUEST', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Textiles Limited',
      credit_limit: 50000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      status: 'active',
    });

    // Admin attempts override on 60,000 order against 50,000 limit with "ok boss" (< 10 chars)
    const res = await request(app)
      .post('/api/operations/vehicle-entries')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        vehicle_number: truck.truck_no,
        driver_name: driver.name,
        from_location: 'Surat',
        to_location: 'Delhi',
        balance_party_id: balanceParty._id,
        billing_party_id: customer._id,
        freight_amount: 60000,
        credit_override: true,
        override_reason: 'ok boss',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum 10 characters/i);
  });

  it('authorizes Company Admin override with valid justification and writes immutable AuditLog', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Premier Polymers Ltd',
      credit_limit: 100000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      status: 'active',
    });

    const justification = 'Authorized by Chief Commercial Officer: Client sent RTGS payment receipt #TXN-98402';

    // 120,000 order against 100,000 limit => 20,000 excess
    const res = await request(app)
      .post('/api/operations/vehicle-entries')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        vehicle_number: truck.truck_no,
        driver_name: driver.name,
        from_location: 'Surat',
        to_location: 'Delhi',
        balance_party_id: balanceParty._id,
        billing_party_id: customer._id,
        freight_amount: 120000,
        credit_override: true,
        override_reason: justification,
      });

    expect(res.status).toBe(201);

    // Verify AuditLog contains immutable record
    const auditLogs = await AuditLog.find(
      {
        company_id: tenant.company._id,
        action: 'OVERRIDE',
      },
      null,
      { skipTenantCheck: true }
    );

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const log = auditLogs.find((l) => l.after_snapshot?.policy === 'DEC-007_OPTION_B');
    expect(log).toBeDefined();
    expect(log?.after_snapshot?.justification).toBe(justification);
    expect(log?.after_snapshot?.credit_limit).toBe(100000);
    expect(log?.after_snapshot?.order_amount).toBe(120000);
    expect(log?.after_snapshot?.excess_amount).toBe(20000);
  });

  it('enforces credit limit and DEC-007 Option B override on journey dispatch', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Highway Logistics Shippers',
      credit_limit: 50000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      status: 'active',
    });

    // Create a draft journey for this customer: freight_rate 60,000 against 50,000 limit
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-DISP-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Surat', state: 'Gujarat' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 100000,
      freight_rate: 60000,
      total_freight_amount: 60000,
      customer_id: customer._id,
      billing_party_id: customer._id,
    });

    // 1. Dispatch without override -> 409
    const breachRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/dispatch`)
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({});

    expect(breachRes.status).toBe(409);
    expect(breachRes.body.code).toBe('CREDIT_LIMIT_EXCEEDED');

    // 2. Dispatch with Admin override -> 200
    const overrideRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/dispatch`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        credit_override: true,
        override_reason: 'Approved per Director approval email ref #DIR-88392',
      });

    expect(overrideRes.status).toBe(200);

    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.status).toBe('active');
  });

  it('enforces credit limit on LR creation and permits Company Admin override with immutable audit entry', async () => {
    const customer = await BillingParty.create({
      company_id: tenant.company._id,
      name: 'Steel Industries Corp',
      credit_limit: 30000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      status: 'active',
    });

    // 1. Dispatcher attempts LR creation with 50,000 freight (exceeding 30,000 limit) -> 409
    const breachRes = await request(app)
      .post('/api/commercial/entries')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        billing_party_id: customer._id,
        truck_id: truck._id,
        driver_id: driver._id,
        vehicle_number: truck.truck_no,
        consignor: { name: 'Tata Steel Ltd' },
        consignee: { name: 'L&T Heavy Engineering' },
        from_location: 'Surat',
        to_location: 'Mumbai',
        freight_amount: 50000,
      });

    expect(breachRes.status).toBe(409);
    expect(breachRes.body.code).toBe('CREDIT_LIMIT_EXCEEDED');

    // 2. Company Admin overrides with valid justification -> 201
    const justification = 'Admin override authorized: Pre-approved revolving credit expansion for seasonal harvest';
    const overrideRes = await request(app)
      .post('/api/commercial/entries')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        billing_party_id: customer._id,
        truck_id: truck._id,
        driver_id: driver._id,
        vehicle_number: truck.truck_no,
        consignor: { name: 'Tata Steel Ltd' },
        consignee: { name: 'L&T Heavy Engineering' },
        from_location: 'Surat',
        to_location: 'Mumbai',
        freight_amount: 50000,
        credit_override: true,
        override_reason: justification,
      });

    expect(overrideRes.status).toBe(201);
    expect(overrideRes.body.entry).toBeDefined();

    // Verify Audit Log
    const auditLogs = await AuditLog.find(
      {
        company_id: tenant.company._id,
        entity_id: customer._id,
        action: 'OVERRIDE',
      },
      null,
      { skipTenantCheck: true }
    );

    const log = auditLogs.find((l) => l.description?.includes('new LR'));
    expect(log).toBeDefined();
    expect(log?.after_snapshot?.override_reason).toBe(justification);
  });
});
