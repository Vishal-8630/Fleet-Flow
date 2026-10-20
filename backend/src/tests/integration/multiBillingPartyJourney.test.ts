/**
 * ============================================================================
 * FLEET FLOW — PHASE 2: MULTI-BILLING-PARTY JOURNEY ALIGNMENT INTEGRATION TESTS
 * (multiBillingPartyJourney.test.ts)
 * ============================================================================
 * 
 * Verifies all 18 required Phase 2 invariants:
 * 1. One LR creates a valid journey.
 * 2. Multiple LRs belonging to the same Billing Party remain supported.
 * 3. Multiple LRs belonging to different Billing Parties can form one journey when their truck and driver match.
 * 4. Mixed-party journeys do not arbitrarily assign the first customer's ID to journey.billing_party_id.
 * 5. Single-party journeys preserve backward-compatible journey-level Billing Party behavior.
 * 6. Historical LRs missing a Billing Party cannot enter a new commercial journey (BILLING_PARTY_REQUIRED).
 * 7. Mixed trucks are rejected (TRUCK_MISMATCH).
 * 8. Mixed drivers are rejected (DRIVER_MISMATCH).
 * 9. Cross-tenant LRs are rejected (LR_NOT_FOUND / 404).
 * 10. Cross-branch LRs are rejected (BRANCH_MISMATCH).
 * 11. Already-assigned LRs remain protected (LR_ALREADY_ASSIGNED / 409).
 * 12. Concurrent attempts to assign the same LR cannot both succeed (concurrency race test).
 * 13. Failed conditional linking rolls back the complete transaction (atomic rollback test).
 * 14. Credit exposure evaluates every distinct customer represented by the journey's LRs (DEC-007 Option B).
 * 15. Authorized credit overrides continue to work and retain their audit reason.
 * 16. Invoices remain customer-specific and LR-specific (an invoice for Customer A cannot include LRs for Customer B).
 * 17. Cancellation unlinks LRs without rewriting their issuance snapshots.
 * 18. Journey completion does not create invoice or ledger side effects.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { BillingParty } from '../../models/BillingParty.js';
import { Branch } from '../../models/Branch.js';
import { Invoice } from '../../models/Invoice.js';
import { Ledger } from '../../models/Ledger.js';
import { AuditLog } from '../../models/AuditLog.js';
import { User } from '../../models/User.js';
import { CompanyMember } from '../../models/CompanyMember.js';

describe('Phase 2: Multi-Billing-Party Journey Alignment & Financial Invariants', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let dispatcherTokenA: string;
  let customerA: any;
  let customerB: any;
  let truckA: any;
  let truckB: any;
  let driverA: any;
  let driverB: any;
  let branchA1: any;
  let branchA2: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Apex Multi-Shipper Logistics' });
    tenantB = await createTestTenant({ name: 'Unrelated Foreign Tenant' });

    // Non-admin dispatcher for tenant A
    const dispatcherUser = await User.create({
      name: 'Dispatcher Rohan',
      email: `dispatcher-${Date.now()}-${Math.random()}@apexlogistics.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      is_verified: true,
      token_version: 0,
    });
    await CompanyMember.create({
      company_id: tenantA.company._id,
      user_id: dispatcherUser._id,
      email: dispatcherUser.email,
      role: 'dispatcher',
      status: 'active',
    });
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
    dispatcherTokenA = jwt.sign(
      {
        userId: dispatcherUser._id.toString(),
        companyId: tenantA.company._id.toString(),
        token_version: 0,
      },
      secret,
      { expiresIn: '1d' }
    );

    branchA1 = await Branch.create({
      company_id: tenantA.company._id,
      branch_name: 'Bhiwandi Central Hub',
      branch_code: 'BHW',
      is_active: true,
      is_head_office: true,
      city: 'Bhiwandi',
      state: 'Maharashtra',
    });

    branchA2 = await Branch.create({
      company_id: tenantA.company._id,
      branch_name: 'Nagpur Logistics Hub',
      branch_code: 'NGP',
      is_active: true,
      is_head_office: false,
      city: 'Nagpur',
      state: 'Maharashtra',
    });

    customerA = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Tata Motors Commercial Division',
      trade_name: 'Tata Motors',
      gstin: '27AABCT1234A1Z5',
      credit_limit: 200000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      billing_address: {
        street: 'Pimpri Industrial Corridor',
        city: 'Pune',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_deleted: false,
    });

    customerB = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Mahindra Logistics Consignments',
      trade_name: 'Mahindra',
      gstin: '27AABCM9876C1Z3',
      credit_limit: 150000,
      enforce_credit_limit: true,
      outstanding_receivables: 0,
      billing_address: {
        street: 'Kandivali East',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_deleted: false,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04XY${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'BharatBenz',
      model: '3528C',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
      current_odometer_kms: 60000,
    });

    truckB = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04ZZ${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Signa 4825',
      body_type: 'Container',
      tonnage_capacity: 40,
      status: 'available',
      current_odometer_kms: 75000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Santosh Yadav',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });

    driverB = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Vikram Singh',
      phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });
  });

  const createHelperLR = async (overrides: Partial<any> = {}) => {
    return Entry.create({
      company_id: tenantA.company._id,
      lr_no: `LR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      bill_no: `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      bill_date: new Date(),
      lr_date: new Date(),
      billing_party_id: customerA._id,
      branch_id: branchA1._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      driver_name: driverA.name,
      driver_phone: driverA.phone,
      vehicle_number: truckA.truck_no,
      from_location: 'Mumbai',
      to_location: 'Nagpur',
      consignor: { name: 'Tata AutoComp Systems' },
      consignee: { name: 'Nagpur Assembly Plant' },
      package_count: 40,
      packaging_type: 'Crates',
      goods_description: 'Auto Components',
      declared_value: 400000,
      risk_type: 'carrier_risk',
      actual_weight_tonnes: 10.0,
      chargeable_weight_tonnes: 11.5,
      cbm_volume: 20.0,
      freight_terms: 'to_be_billed',
      freight_amount: 35000,
      status: 'active',
      is_deleted: false,
      ...overrides,
    });
  };

  // --------------------------------------------------------------------------
  // Invariant 1: One LR creates a valid journey
  // --------------------------------------------------------------------------
  it('1. One LR creates a valid commercial journey with derived truck, driver, and customer', async () => {
    const lr = await createHelperLR({
      billing_party_id: customerA._id,
      actual_weight_tonnes: 8.5,
      cbm_volume: 18.0,
    });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey).toBeDefined();
    expect(res.body.journey.journey_type).toBe('commercial');
    expect(res.body.journey.lr_ids).toHaveLength(1);
    expect(res.body.journey.lr_ids[0].toString()).toBe(lr._id.toString());
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
    expect(res.body.journey.loaded_weight_tonnes).toBe(8.5);

    const linkedLr = await Entry.findById(lr._id, null, { skipTenantCheck: true });
    expect(linkedLr?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  // --------------------------------------------------------------------------
  // Invariant 2: Multiple LRs belonging to the same Billing Party remain supported
  // --------------------------------------------------------------------------
  it('2. Multiple LRs belonging to the same Billing Party remain fully supported', async () => {
    const lr1 = await createHelperLR({ billing_party_id: customerA._id, actual_weight_tonnes: 5.0, cbm_volume: 10.0 });
    const lr2 = await createHelperLR({ billing_party_id: customerA._id, actual_weight_tonnes: 7.0, cbm_volume: 14.0 });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.lr_ids).toHaveLength(2);
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
    expect(res.body.journey.loaded_weight_tonnes).toBe(12.0);
    expect(res.body.journey.cbm_volume).toBe(24.0);

    const check1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const check2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(check1?.journey_id?.toString()).toBe(res.body.journey._id.toString());
    expect(check2?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  // --------------------------------------------------------------------------
  // Invariant 3: Multiple LRs belonging to different Billing Parties can form one journey
  // --------------------------------------------------------------------------
  it('3. Multiple LRs belonging to different Billing Parties can form one journey when truck and driver match', async () => {
    const lrCustomerA = await createHelperLR({
      billing_party_id: customerA._id,
      actual_weight_tonnes: 6.0,
      cbm_volume: 12.0,
      goods_description: 'Tata Gearboxes',
    });
    const lrCustomerB = await createHelperLR({
      billing_party_id: customerB._id,
      actual_weight_tonnes: 8.0,
      cbm_volume: 16.0,
      goods_description: 'Mahindra Axles',
    });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey).toBeDefined();
    expect(res.body.journey.lr_ids).toHaveLength(2);
    expect(res.body.journey.loaded_weight_tonnes).toBe(14.0);
    expect(res.body.journey.cbm_volume).toBe(28.0);
    expect(res.body.journey.cargo_description).toBe('Tata Gearboxes, Mahindra Axles');

    const checkA = await Entry.findById(lrCustomerA._id, null, { skipTenantCheck: true });
    const checkB = await Entry.findById(lrCustomerB._id, null, { skipTenantCheck: true });
    expect(checkA?.journey_id?.toString()).toBe(res.body.journey._id.toString());
    expect(checkB?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  // --------------------------------------------------------------------------
  // Invariant 4: Mixed-party journeys do not arbitrarily assign the first customer's ID
  // --------------------------------------------------------------------------
  it('4. Mixed-party journeys leave journey.billing_party_id unset (undefined), never arbitrarily picking the first LR customer', async () => {
    const lr1 = await createHelperLR({ billing_party_id: customerA._id });
    const lr2 = await createHelperLR({ billing_party_id: customerB._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    // Crucial check: billing_party_id must be undefined/null on mixed journeys
    expect(res.body.journey.billing_party_id).toBeUndefined();

    // Verify database document directly
    const storedJourney = await TruckJourney.findById(res.body.journey._id, null, { skipTenantCheck: true });
    expect(storedJourney?.billing_party_id).toBeFalsy();
  });

  // --------------------------------------------------------------------------
  // Invariant 5: Single-party journeys preserve backward-compatible journey-level Billing Party behavior
  // --------------------------------------------------------------------------
  it('5. Single-party journeys preserve backward-compatible journey-level Billing Party field and ignore client overrides', async () => {
    const lr = await createHelperLR({ billing_party_id: customerA._id });

    // Client passes customerB explicitly, but LR belongs to customerA
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerB._id, // Untrusted client override
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    // Journey billing_party_id must be customerA (derived from LR), not customerB
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
  });

  // --------------------------------------------------------------------------
  // Invariant 6: Historical LRs missing a Billing Party cannot enter a new commercial journey
  // --------------------------------------------------------------------------
  it('6. Rejects historical LRs missing a valid billing_party_id with BILLING_PARTY_REQUIRED', async () => {
    const historicalLR = await createHelperLR({ billing_party_id: undefined });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [historicalLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
    expect(res.body.error).toContain('does not have an assigned Billing Party');

    const check = await Entry.findById(historicalLR._id, null, { skipTenantCheck: true });
    expect(check?.journey_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Invariant 7: Mixed trucks are rejected
  // --------------------------------------------------------------------------
  it('7. Rejects mixed trucks across selected LRs with TRUCK_MISMATCH', async () => {
    const lr1 = await createHelperLR({ truck_id: truckA._id, vehicle_number: truckA.truck_no });
    const lr2 = await createHelperLR({ truck_id: truckB._id, vehicle_number: truckB.truck_no });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TRUCK_MISMATCH');

    const check1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const check2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(check1?.journey_id).toBeUndefined();
    expect(check2?.journey_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Invariant 8: Mixed drivers are rejected
  // --------------------------------------------------------------------------
  it('8. Rejects mixed drivers across selected LRs with DRIVER_MISMATCH', async () => {
    const lr1 = await createHelperLR({ driver_id: driverA._id, driver_name: driverA.name });
    const lr2 = await createHelperLR({ driver_id: driverB._id, driver_name: driverB.name });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DRIVER_MISMATCH');

    const check1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const check2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(check1?.journey_id).toBeUndefined();
    expect(check2?.journey_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Invariant 9: Cross-tenant LRs are rejected
  // --------------------------------------------------------------------------
  it('9. Rejects cross-tenant LRs with 404 LR_NOT_FOUND', async () => {
    // Create LR belonging to tenantB
    const foreignLR = await Entry.create({
      company_id: tenantB.company._id,
      lr_no: `LR-FOREIGN-${Date.now()}`,
      bill_no: `BILL-FOREIGN-${Date.now()}`,
      bill_date: new Date(),
      lr_date: new Date(),
      billing_party_id: new mongoose.Types.ObjectId(),
      vehicle_number: truckA.truck_no,
      driver_name: driverA.name,
      consignor: { name: 'Foreign Shipper Ltd' },
      consignee: { name: 'Foreign Receiver Ltd' },
      from_location: 'Mumbai',
      to_location: 'Nagpur',
      goods_description: 'Contraband Cross-Tenant Cargo',
      freight_amount: 50000,
      status: 'active',
      is_deleted: false,
    });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [foreignLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LR_NOT_FOUND');
  });

  // --------------------------------------------------------------------------
  // Invariant 10: Cross-branch LRs are rejected
  // --------------------------------------------------------------------------
  it('10. Rejects cross-branch LRs with BRANCH_MISMATCH', async () => {
    const lrBranch1 = await createHelperLR({ branch_id: branchA1._id });
    const lrBranch2 = await createHelperLR({ branch_id: branchA2._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        branch_id: branchA1._id,
        lr_ids: [lrBranch1._id, lrBranch2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BRANCH_MISMATCH');

    const check1 = await Entry.findById(lrBranch1._id, null, { skipTenantCheck: true });
    const check2 = await Entry.findById(lrBranch2._id, null, { skipTenantCheck: true });
    expect(check1?.journey_id).toBeUndefined();
    expect(check2?.journey_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Invariant 11: Already-assigned LRs remain protected
  // --------------------------------------------------------------------------
  it('11. Rejects attempt to assign an LR that is already attached to an active journey with 409 LR_ALREADY_ASSIGNED', async () => {
    const existingJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-EXISTING-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Nagpur', state: 'Maharashtra' },
      start_date: new Date(),
      start_odometer_kms: 50000,
    });

    const assignedLR = await createHelperLR({ journey_id: existingJourney._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [assignedLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LR_ALREADY_ASSIGNED');
  });

  // --------------------------------------------------------------------------
  // Invariant 12: Concurrent attempts to assign the same LR cannot both succeed
  // --------------------------------------------------------------------------
  it('12. Concurrent attempts to assign the same LR result in exactly one success and one conflict', async () => {
    const sharedLR = await createHelperLR();

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'commercial',
          lr_ids: [sharedLR._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        }),
      request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'commercial',
          lr_ids: [sharedLR._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failedRes = res1.status === 409 ? res1 : res2;
    expect(failedRes.body.code).toBe('LR_ALREADY_ASSIGNED');
  });

  // --------------------------------------------------------------------------
  // Invariant 13: Failed conditional linking rolls back the complete transaction
  // --------------------------------------------------------------------------
  it('13. Failed transaction rolls back journey creation and leaves zero LRs modified', async () => {
    const lrGood = await createHelperLR();
    const lrAlreadyAssigned = await createHelperLR({ journey_id: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrGood._id, lrAlreadyAssigned._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LR_ALREADY_ASSIGNED');

    // lrGood must NOT have been linked (atomic rollback)
    const checkGood = await Entry.findById(lrGood._id, null, { skipTenantCheck: true });
    expect(checkGood?.journey_id).toBeUndefined();

    // No journey was created
    const createdJourneys = await TruckJourney.find(
      { lr_ids: lrGood._id },
      null,
      { skipTenantCheck: true }
    );
    expect(createdJourneys).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Invariant 14: Credit exposure evaluates every distinct customer on the journey
  // --------------------------------------------------------------------------
  it('14. Evaluates credit exposure for each distinct Billing Party on mixed journeys and blocks breach', async () => {
    // Customer A has ₹200,000 limit, LR freight is ₹50,000 (within limit)
    const lrCustomerA = await createHelperLR({
      billing_party_id: customerA._id,
      freight_amount: 50000,
    });

    // Customer B has ₹150,000 limit, but already has ₹140,000 in receivables.
    // LR freight is ₹25,000 -> Total exposure ₹165,000 (breaches ₹150,000 limit)
    await BillingParty.findByIdAndUpdate(customerB._id, { outstanding_receivables: 140000 }, { skipTenantCheck: true });
    const lrCustomerB = await createHelperLR({
      billing_party_id: customerB._id,
      freight_amount: 25000,
    });

    // Non-admin dispatcher attempts immediate dispatch (status: active)
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${dispatcherTokenA}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'active', // Immediate dispatch
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(res.body.error).toContain(customerB.name);
    expect(res.body.details.customer_id).toBe(customerB._id.toString());
  });

  // --------------------------------------------------------------------------
  // Invariant 15: Authorized credit overrides continue to work and retain their audit reason
  // --------------------------------------------------------------------------
  it('15. Company Admin authorizes credit override on mixed journey and writes audit trail', async () => {
    const lrCustomerA = await createHelperLR({
      billing_party_id: customerA._id,
      freight_amount: 40000,
    });

    await BillingParty.findByIdAndUpdate(customerB._id, { outstanding_receivables: 145000 }, { skipTenantCheck: true });
    const lrCustomerB = await createHelperLR({
      billing_party_id: customerB._id,
      freight_amount: 30000,
    });

    const justification = 'Authorized by Director of Finance for quarterly key client volume commitment';

    // Company Admin overrides credit limit
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'active',
        credit_override: true,
        override_reason: justification,
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.status).toBe('active');

    // Verify AuditLog contains override record for customerB
    const auditLogs = await AuditLog.find({
      company_id: tenantA.company._id,
      entity_id: customerB._id,
      action: 'OVERRIDE',
    }, null, { skipTenantCheck: true });

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const log = auditLogs.find((l) => l.after_snapshot?.override_reason === justification);
    expect(log).toBeDefined();
    expect(log?.entity_identifier).toBe(customerB.name);
  });

  // --------------------------------------------------------------------------
  // Invariant 16: Invoices remain customer-specific and LR-specific
  // --------------------------------------------------------------------------
  it('16. Invoice creation strictly rejects combining LRs belonging to different Billing Parties', async () => {
    const lrCustomerA = await createHelperLR({ billing_party_id: customerA._id, freight_amount: 30000 });
    const lrCustomerB = await createHelperLR({ billing_party_id: customerB._id, freight_amount: 40000 });

    // Attempt to bill Customer A with Customer B's LR
    const breachRes = await request(app)
      .post('/api/commercial/invoices')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        billing_party_id: customerA._id,
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        branch_id: branchA1._id,
      });

    expect(breachRes.status).toBe(400);
    expect(breachRes.body.code).toBe('BILLING_PARTY_MISMATCH');

    // Create proper invoice for Customer A only
    const validRes = await request(app)
      .post('/api/commercial/invoices')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        billing_party_id: customerA._id,
        lr_ids: [lrCustomerA._id],
        branch_id: branchA1._id,
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.invoice.billing_party_id.toString()).toBe(customerA._id.toString());

    // Check LR statuses: lrCustomerA is invoiced, lrCustomerB remains active
    const checkA = await Entry.findById(lrCustomerA._id, null, { skipTenantCheck: true });
    const checkB = await Entry.findById(lrCustomerB._id, null, { skipTenantCheck: true });
    expect(checkA?.status).toBe('invoiced');
    expect(checkA?.invoice_id?.toString()).toBe(validRes.body.invoice._id.toString());
    expect(checkB?.status).toBe('active');
    expect(checkB?.invoice_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Invariant 17: Cancellation unlinks LRs without rewriting their issuance snapshots
  // --------------------------------------------------------------------------
  it('17. Journey cancellation unlinks LRs while preserving complete issuance snapshots intact', async () => {
    const lrCustomerA = await createHelperLR({
      billing_party_id: customerA._id,
      consignor: { name: 'Tata AutoComp Systems' },
      consignee: { name: 'Nagpur Assembly Plant' },
      goods_description: 'Precision Gearboxes',
      freight_amount: 45000,
    });
    const lrCustomerB = await createHelperLR({
      billing_party_id: customerB._id,
      consignor: { name: 'Mahindra Heavy Engines' },
      consignee: { name: 'Nagpur Engine Depot' },
      goods_description: 'Crankshaft Assemblies',
      freight_amount: 55000,
    });

    const journeyRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(journeyRes.status).toBe(201);
    const journeyId = journeyRes.body.journey._id;

    // Cancel journey via PUT /api/operations/journeys/:id/cancel
    const cancelRes = await request(app)
      .put(`/api/operations/journeys/${journeyId}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip cancelled by fleet manager due to severe highway floods' });

    expect(cancelRes.status).toBe(200);

    // Verify LRs are unlinked but all original issuance fields are intact
    const afterLR1 = await Entry.findById(lrCustomerA._id, null, { skipTenantCheck: true });
    const afterLR2 = await Entry.findById(lrCustomerB._id, null, { skipTenantCheck: true });

    expect(afterLR1?.journey_id).toBeUndefined();
    expect(afterLR2?.journey_id).toBeUndefined();

    // Snapshots preserved
    expect(afterLR1?.billing_party_id?.toString()).toBe(customerA._id.toString());
    expect(afterLR1?.consignor?.name).toBe('Tata AutoComp Systems');
    expect(afterLR1?.goods_description).toBe('Precision Gearboxes');
    expect(afterLR1?.freight_amount).toBe(45000);

    expect(afterLR2?.billing_party_id?.toString()).toBe(customerB._id.toString());
    expect(afterLR2?.consignor?.name).toBe('Mahindra Heavy Engines');
    expect(afterLR2?.goods_description).toBe('Crankshaft Assemblies');
    expect(afterLR2?.freight_amount).toBe(55000);
  });

  // --------------------------------------------------------------------------
  // Invariant 18: Journey completion does not create invoice or ledger side effects
  // --------------------------------------------------------------------------
  it('18. Journey completion does not create invoice or general ledger side effects', async () => {
    const lrCustomerA = await createHelperLR({ billing_party_id: customerA._id, freight_amount: 40000 });
    const lrCustomerB = await createHelperLR({ billing_party_id: customerB._id, freight_amount: 50000 });

    const journeyRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrCustomerA._id, lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'active',
      });

    expect(journeyRes.status).toBe(201);
    const journeyId = journeyRes.body.journey._id;

    const invoicesCountBefore = await Invoice.countDocuments({ company_id: tenantA.company._id });
    const ledgerCountBefore = await Ledger.countDocuments({ company_id: tenantA.company._id });

    // Complete journey with delivery details and POD slip via POST /api/operations/journeys/:id/pod
    const completeRes = await request(app)
      .post(`/api/operations/journeys/${journeyId}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        receiver_name: 'Harish Rawat (Receiving Officer)',
        closing_odometer_kms: 60950,
        pod_slip_url: 'https://storage.fleetflow.io/pod/pod_scan_29102.pdf',
        delivery_notes: 'Delivered in good order to both consignees',
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.journey.status).toBe('completed');
    expect(completeRes.body.journey.delivery_status).toBe('delivered');

    // Assert: Zero invoices created as a side effect
    const invoicesCountAfter = await Invoice.countDocuments({ company_id: tenantA.company._id });
    expect(invoicesCountAfter).toBe(invoicesCountBefore);

    // Assert: Zero ledger postings created as a side effect
    const ledgerCountAfter = await Ledger.countDocuments({ company_id: tenantA.company._id });
    expect(ledgerCountAfter).toBe(ledgerCountBefore);
  });
});
