/**
 * ============================================================================
 * DEC-008 & QST-013 — COMPLETED-TRIP ADJUSTMENTS INTEGRATION TESTS
 * (completedTripAdjustments.test.ts)
 * ============================================================================
 * 
 * Verifies:
 * 1. An authorized Company Admin can submit a valid adjustment to an eligible completed trip.
 * 2. A dispatcher, accountant, or other unauthorized role is rejected (HTTP 403).
 * 3. Cross-tenant journeys and affected resources cannot be modified (HTTP 404).
 * 4. Missing or short justification is rejected (HTTP 400).
 * 5. Draft, active, delayed, cancelled, and settled trips are rejected by adjustment workflow.
 * 6. Original trip and sub-resource records remain preserved, with immutable before-and-after audit history.
 * 7. Financial adjustments create balanced journal entries and reconcile party balances correctly.
 * 8. Non-financial adjustments do not create unnecessary financial postings.
 * 9. Transaction failure rolls back all related writes.
 * 10. Duplicate requests and concurrent adjustments cannot double-post or overwrite one another.
 * 11. Ordinary C4 endpoints remain unable to modify completed trips.
 * 12. Batch B ledger invariants and C1-C4 regression behavior remain intact.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { Ledger } from '../../models/Ledger.js';
import { AuditLog } from '../../models/AuditLog.js';
import { Settlement } from '../../models/Settlement.js';
import { User } from '../../models/User.js';
import { CompanyMember, UserRole } from '../../models/CompanyMember.js';

describe('Phase C5: Audited Corrections to Completed Trips (DEC-008 & QST-013)', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let truckA: any;
  let driverA: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA5001',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
      current_odometer_kms: 60000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Vikram Singh',
      phone: '+919876550001',
      license_number: 'DL-MH-5001',
      status: 'active',
    });
  });

  // Helper to create member with specific role
  const createMemberWithRole = async (tenant: TestTenantContext, role: UserRole) => {
    const user = await User.create({
      name: `User-${role}-${Date.now()}`,
      email: `${role}-${Date.now()}@test.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      is_verified: true,
      token_version: 0,
    });
    const member = await CompanyMember.create({
      company_id: tenant.company._id,
      user_id: user._id,
      email: user.email,
      role,
      status: 'active',
    });
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        companyId: tenant.company._id.toString(),
        token_version: 0,
      },
      secret,
      { expiresIn: '1d' }
    );
    return { user, member, token };
  };

  // --------------------------------------------------------------------------
  // Scenario 1: Authorized Company Admin can submit a valid adjustment
  // --------------------------------------------------------------------------
  it('1. An authorized Company Admin can submit a valid adjustment to an eligible completed trip', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-COMP-ADJ-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(Date.now() - 86400000 * 2),
      actual_end_date: new Date(Date.now() - 86400000),
      start_odometer_kms: 60000,
      end_odometer_kms: 60160,
      driver_expenses: [
        {
          expense_type: 'toll',
          amount: 500,
          notes: 'Expressway toll',
          receipt_url: 'http://docs.example.com/toll1.jpg',
          date: new Date(Date.now() - 86400000),
        },
      ],
    });

    const expenseId = journey.driver_expenses[0]._id;

    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'driver_expense',
        action: 'update',
        target_id: expenseId,
        justification: 'Voucher slip arrived late from depot; amount corrected from Rs 500 to Rs 650 with supervisor approval.',
        data: {
          amount: 650,
          notes: 'Updated to reflect physical receipt #EXP-650',
          receipt_url: 'http://docs.example.com/receipt650.jpg',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.adjustment).toBeDefined();
    expect(res.body.adjustment.adjustment_id).toMatch(/^ADJ-/);
    expect(res.body.adjustment.actor_role).toBe('admin');
    expect(res.body.adjustment.financial_impact).toBe(150);

    // Verify trip status was preserved as completed
    const updated = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updated?.status).toBe('completed');
    expect(updated?.driver_expenses[0].amount).toBe(650);
    expect(updated?.total_driver_expenses).toBe(650);
    expect(updated?.adjustments?.length).toBe(1);
    expect(updated?.adjustments?.[0].justification).toContain('Voucher slip arrived late');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Dispatcher, accountant, or other unauthorized roles are rejected
  // --------------------------------------------------------------------------
  it('2. A dispatcher, accountant, or other unauthorized role is rejected with HTTP 403', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-REJECT-ROLE-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const dispatcherContext = await createMemberWithRole(tenantA, 'dispatcher');
    const accountantContext = await createMemberWithRole(tenantA, 'accountant');

    const dispRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${dispatcherContext.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting late note correction by dispatcher role.',
        data: { notes: 'Dispatcher note' },
      });
    expect(dispRes.status).toBe(403);

    const acctRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${accountantContext.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting late note correction by accountant role.',
        data: { notes: 'Accountant note' },
      });
    expect(acctRes.status).toBe(403);

    // Unauthenticated
    const noAuthRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting late note correction without token.',
        data: { notes: 'Anonymous note' },
      });
    expect(noAuthRes.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Cross-tenant journeys and resources cannot be modified
  // --------------------------------------------------------------------------
  it('3. Cross-tenant journeys and affected resources cannot be modified', async () => {
    const journeyA = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-TENANT-A-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const vendorB = await BalanceParty.create({
      company_id: tenantB.company._id,
      party_name: 'Beta HPCL Station',
      party_type: 'petrol_pump',
      phone: '+919876543299',
      current_balance: 0,
      opening_balance: 0,
    });

    // Tenant B admin cannot access Tenant A's completed journey
    const crossRes = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Cross-tenant breach attempt by Tenant B admin.',
        data: { notes: 'Breach' },
      });
    expect(crossRes.status).toBe(404);

    // Tenant A admin cannot link Tenant B's diesel vendor
    const crossVendorRes = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'fuel_stop',
        action: 'create',
        justification: 'Late credit fuel entry with foreign tenant vendor party.',
        data: {
          fuel_quantity_litres: 100,
          rate_per_litre: 90,
          total_cost: 9000,
          payment_mode: 'credit',
          balance_party_id: vendorB._id,
          petrol_pump_name: 'Beta Pump',
        },
      });
    expect(crossVendorRes.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Missing or short justification is rejected
  // --------------------------------------------------------------------------
  it('4. Missing or short justification is rejected with HTTP 400', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-JUST-TEST-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    // 4a. Omitted justification
    const noJustRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        data: { notes: 'No justification' },
      });
    expect(noJustRes.status).toBe(400);
    expect(noJustRes.body.error).toContain('mandatory and must be at least 15 characters');

    // 4b. Justification < 15 characters
    const shortJustRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Too short text',
        data: { notes: 'Short justification' },
      });
    expect(shortJustRes.status).toBe(400);
    expect(shortJustRes.body.error).toContain('at least 15 characters long');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Draft, active, delayed, cancelled, and settled trips are rejected
  // --------------------------------------------------------------------------
  it('5. Draft, active, delayed, cancelled, and settled trips are rejected by adjustment workflow', async () => {
    // 5a. Draft trip
    const draftJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-DRAFT-ADJ-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const draftRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting completed-trip adjustment on a draft journey.',
        data: { notes: 'Invalid' },
      });
    expect(draftRes.status).toBe(400);
    expect(draftRes.body.error).toContain("only be applied to journeys in 'completed' status");

    // 5b. Active trip
    const activeJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-ACTIVE-ADJ-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const activeRes = await request(app)
      .post(`/api/operations/journeys/${activeJourney._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting completed-trip adjustment on an active journey.',
        data: { notes: 'Invalid' },
      });
    expect(activeRes.status).toBe(400);

    // 5c. Delayed trip
    const delayedJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-DELAYED-ADJ-${Date.now()}`,
      status: 'delayed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const delayedRes = await request(app)
      .post(`/api/operations/journeys/${delayedJourney._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting completed-trip adjustment on a delayed journey.',
        data: { notes: 'Invalid' },
      });
    expect(delayedRes.status).toBe(400);

    // 5d. Cancelled trip
    const cancJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-CANC-ADJ-${Date.now()}`,
      status: 'cancelled',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const cancRes = await request(app)
      .post(`/api/operations/journeys/${cancJourney._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting completed-trip adjustment on a cancelled journey.',
        data: { notes: 'Invalid' },
      });
    expect(cancRes.status).toBe(400);

    // 5e. Settled trip (is_settled: true)
    const settledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-SETTLED-ADJ-${Date.now()}`,
      status: 'completed',
      is_settled: true,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const settledRes = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting adjustment on already settled completed journey.',
        data: { notes: 'Invalid' },
      });
    expect(settledRes.status).toBe(409);
    expect(settledRes.body.error).toContain('already been settled in a completed driver payout');

    // 5f. Journey linked to active Settlement record
    const compWithSettlement = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-LINKED-SETT-${Date.now()}`,
      status: 'completed',
      is_settled: false,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    await Settlement.create({
      company_id: tenantA.company._id,
      settlement_number: `SETT-${Date.now()}`,
      settlement_date: new Date(),
      driver_id: driverA._id,
      driver_snapshot: { name: driverA.name, phone: driverA.phone, license_number: driverA.license_number },
      journey_ids: [compWithSettlement._id],
      journey_breakdowns: [],
      total_kms: 100,
      rate_per_km: 10,
      base_earnings: 1000,
      total_reimbursements: 0,
      gross_earnings: 1000,
      total_advances: 0,
      benchmark_mileage: 4,
      fuel_variance_penalty: 0,
      other_deductions: 0,
      total_deductions: 0,
      net_amount: 1000,
      settlement_type: 'payable_to_driver',
      payment_status: 'paid',
      is_deleted: false,
    });

    const linkedRes = await request(app)
      .post(`/api/operations/journeys/${compWithSettlement._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'Attempting adjustment on journey linked to active Settlement.',
        data: { notes: 'Invalid' },
      });
    expect(linkedRes.status).toBe(409);
    expect(linkedRes.body.error).toContain('already been settled in driver settlement');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Original records preserved with immutable audit history
  // --------------------------------------------------------------------------
  it('6. Original trip and sub-resource records remain preserved, with immutable before-and-after audit history', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-AUDIT-SNAP-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
      driver_expenses: [
        {
          expense_type: 'food_allowance',
          amount: 300,
          notes: 'Driver meal voucher',
          date: new Date(),
        },
      ],
    });

    const targetExpenseId = journey.driver_expenses[0]._id;

    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'driver_expense',
        action: 'update',
        target_id: targetExpenseId,
        justification: 'Revised food allowance based on audited inter-state trip policy guidelines.',
        data: {
          amount: 450,
          notes: 'Adjusted to Rs 450 per verified logbook',
        },
      });

    expect(res.status).toBe(201);

    // Verify subdocument audit snapshot in journey.adjustments
    const refreshed = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(refreshed?.adjustments?.length).toBe(1);
    const adj = refreshed?.adjustments?.[0];
    expect(adj?.previous_snapshot?.amount).toBe(300);
    expect(adj?.new_snapshot?.amount).toBe(450);
    expect(adj?.justification).toContain('Revised food allowance');

    // Verify centralized AuditLog record
    const auditLogs = await AuditLog.find(
      {
        company_id: tenantA.company._id,
        entity_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    ).sort({ created_at: -1 });

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const latestLog = auditLogs[0];
    expect(latestLog.description).toContain('[DEC-008] Completed-trip adjustment');
    expect(latestLog.before_snapshot?.amount).toBe(300);
    expect(latestLog.after_snapshot?.amount).toBe(450);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Financial adjustments create balanced journal entries & reconcile vendor balance
  // --------------------------------------------------------------------------
  it('7. Financial adjustments create balanced journal entries and reconcile party balances correctly', async () => {
    const vendor = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Alpha Highway Petroleum',
      party_type: 'petrol_pump',
      phone: '+919876543111',
      current_balance: 10000,
      opening_balance: 10000,
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-FIN-RECON-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
      diesel_expenses: [
        {
          petrol_pump_name: 'Alpha Highway Petroleum',
          slip_number: 'SLIP-INITIAL-101',
          fuel_quantity_litres: 100,
          rate_per_litre: 90,
          total_cost: 9000,
          payment_mode: 'credit',
          balance_party_id: vendor._id,
          filling_date: new Date(),
        },
      ],
      total_diesel_litres: 100,
      total_diesel_cost: 9000,
    });

    const dieselId = journey.diesel_expenses[0]._id;

    // 7a. Upward adjustment (+₹1,800: from 9,000 to 10,800)
    const upRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'fuel_stop',
        action: 'update',
        target_id: dieselId,
        justification: 'Pump invoice reconciliation shows 120 litres instead of 100 litres on slip.',
        data: {
          fuel_quantity_litres: 120,
          rate_per_litre: 90,
          total_cost: 10800,
        },
      });

    expect(upRes.status).toBe(201);
    expect(upRes.body.adjustment.financial_impact).toBe(1800);

    // Verify vendor balance increased by 1,800
    const vendorAfterUp = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorAfterUp?.current_balance).toBe(11800);

    // Verify GL journals
    const upLedger = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
        reference_number: 'SLIP-INITIAL-101',
      },
      null,
      { skipTenantCheck: true }
    );
    expect(upLedger.length).toBe(2);
    const upDebit = upLedger.find((l) => l.balance_type === 'debit');
    const upCredit = upLedger.find((l) => l.balance_type === 'credit');
    expect(upDebit?.amount).toBe(1800);
    expect(upDebit?.category).toBe('diesel_expense');
    expect(upCredit?.amount).toBe(1800);
    expect(upCredit?.category).toBe('payment_made');

    // 7b. Downward adjustment (-₹2,700: from 10,800 to 8,100)
    const downRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'fuel_stop',
        action: 'update',
        target_id: dieselId,
        justification: 'Vendor credit note #CN-44 approved for fuel discount adjustment of Rs 2,700.',
        data: {
          fuel_quantity_litres: 90,
          rate_per_litre: 90,
          total_cost: 8100,
        },
      });

    expect(downRes.status).toBe(201);
    expect(downRes.body.adjustment.financial_impact).toBe(-2700);

    // Verify vendor balance decreased by 2,700 (11,800 - 2,700 = 9,100)
    const vendorAfterDown = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorAfterDown?.current_balance).toBe(9100);

    // Verify downward GL entries
    const downLedger = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
        description: { $regex: /downward adjustment/i },
      },
      null,
      { skipTenantCheck: true }
    );
    expect(downLedger.length).toBe(2);
    const downDebit = downLedger.find((l) => l.balance_type === 'debit');
    const downCredit = downLedger.find((l) => l.balance_type === 'credit');
    expect(downDebit?.amount).toBe(2700);
    expect(downDebit?.category).toBe('payment_made'); // Reverse payable
    expect(downCredit?.amount).toBe(2700);
    expect(downCredit?.category).toBe('diesel_expense'); // Credit expense
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Non-financial adjustments do not create unnecessary financial postings
  // --------------------------------------------------------------------------
  it('8. Non-financial adjustments do not create unnecessary financial postings', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-NON-FIN-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
      pod_slip_url: 'http://docs.example.com/initial-pod.jpg',
    });

    const initialLedgerCount = (
      await Ledger.find({ company_id: tenantA.company._id }, null, { skipTenantCheck: true })
    ).length;

    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'non_financial',
        justification: 'High-resolution scan of verified Proof of Delivery received from client depot.',
        data: {
          pod_slip_url: 'http://docs.example.com/hd-pod-verified.jpg',
          cargo_description: 'Industrial machinery components',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.adjustment.financial_impact).toBe(0);

    const refreshed = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(refreshed?.pod_slip_url).toBe('http://docs.example.com/hd-pod-verified.jpg');
    expect(refreshed?.cargo_description).toBe('Industrial machinery components');

    // Zero financial postings created
    const finalLedgerCount = (
      await Ledger.find({ company_id: tenantA.company._id }, null, { skipTenantCheck: true })
    ).length;
    expect(finalLedgerCount).toBe(initialLedgerCount);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Transaction failure rolls back all related writes
  // --------------------------------------------------------------------------
  it('9. Transaction failure rolls back all related writes', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-TX-FAIL-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const initialAdjustmentsCount =
      (await TruckJourney.findById(journey._id, null, { skipTenantCheck: true }))?.adjustments?.length || 0;
    const initialAuditCount = (
      await AuditLog.find({ entity_id: journey._id }, null, { skipTenantCheck: true })
    ).length;

    // Intentionally pass invalid target_id for driver_expense update to trigger 404 inside transaction
    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'driver_expense',
        action: 'update',
        target_id: new Types.ObjectId(),
        justification: 'Attempting update on a nonexistent expense record.',
        data: { amount: 999 },
      });

    expect(res.status).toBe(404);

    // Verify ZERO partial state committed
    const afterJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(afterJourney?.adjustments?.length || 0).toBe(initialAdjustmentsCount);

    const afterAuditCount = (
      await AuditLog.find({ entity_id: journey._id }, null, { skipTenantCheck: true })
    ).length;
    expect(afterAuditCount).toBe(initialAuditCount);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Duplicate requests and concurrent adjustments cannot double-post
  // --------------------------------------------------------------------------
  it('10. Duplicate requests and concurrent adjustments cannot double-post or overwrite one another', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-DUP-IDEM-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    const fixedAdjustmentId = `ADJ-FIXED-${Date.now()}`;

    // First adjustment request
    const firstRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_id: fixedAdjustmentId,
        adjustment_type: 'non_financial',
        justification: 'First legitimate adjustment request under unique idempotency key.',
        data: { notes: 'First submission' },
      });
    expect(firstRes.status).toBe(201);

    // Duplicate adjustment request with exact same adjustment_id
    const dupRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_id: fixedAdjustmentId,
        adjustment_type: 'non_financial',
        justification: 'Duplicate retry of the exact same adjustment identifier.',
        data: { notes: 'Duplicate submission' },
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error).toContain('Duplicate adjustment identifier');

    // Confirm only one adjustment was appended
    const updated = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updated?.adjustments?.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Ordinary C4 endpoints remain unable to modify completed trips
  // --------------------------------------------------------------------------
  it('11. Ordinary C4 endpoints remain unable to modify completed trips', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-LOCK-C4-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
      driver_expenses: [{ expense_type: 'toll', amount: 300 }],
      diesel_expenses: [
        {
          petrol_pump_name: 'P1',
          fuel_quantity_litres: 50,
          rate_per_litre: 90,
          total_cost: 4500,
          payment_mode: 'cash',
        },
      ],
    });

    // Routine C4 expense update endpoint
    const expRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${journey.driver_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 400 });
    expect(expRes.status).toBe(400);
    expect(expRes.body.error).toContain('already completed');

    // Routine C4 diesel update endpoint
    const dieselRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${journey.diesel_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(dieselRes.status).toBe(400);
    expect(dieselRes.body.error).toContain('already completed');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Batch B ledger invariants and C1–C4 regression behavior remain intact
  // --------------------------------------------------------------------------
  it('12. Existing Batch B double-entry invariants and C1-C4 regression behavior remain intact', async () => {
    const vendor = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Highway Shell Station',
      party_type: 'petrol_pump',
      phone: '+919876543999',
      current_balance: 5000,
      opening_balance: 5000,
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-INVAR-TEST-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    // Create a late credit fuel stop via completed trip adjustment
    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/adjustments`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        adjustment_type: 'fuel_stop',
        action: 'create',
        justification: 'Late credit slip arrived from depot after vehicle completed route.',
        data: {
          fuel_quantity_litres: 50,
          rate_per_litre: 90,
          total_cost: 4500,
          payment_mode: 'credit',
          balance_party_id: vendor._id,
          petrol_pump_name: 'Highway Shell Station',
          slip_number: 'LATE-SHELL-999',
        },
      });

    expect(res.status).toBe(201);

    // Verify all ledger entries for this tenant are perfectly balanced
    const tenantLedgers = await Ledger.find(
      { company_id: tenantA.company._id },
      null,
      { skipTenantCheck: true }
    );
    const totalDebits = tenantLedgers
      .filter((l) => l.balance_type === 'debit')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = tenantLedgers
      .filter((l) => l.balance_type === 'credit')
      .reduce((sum, l) => sum + l.amount, 0);

    expect(totalDebits).toBe(totalCredits);

    // Verify truck status remains available (not changed back to on_trip)
    const truck = await Truck.findById(truckA._id, null, { skipTenantCheck: true });
    expect(truck?.status).toBe('available');
  });
});
