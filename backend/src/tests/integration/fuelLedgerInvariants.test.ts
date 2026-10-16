/**
 * ============================================================================
 * FF-ISSUE-043 & FF-ISSUE-044 — FUEL LEDGER INVARIANTS & ADVANCE DEDUCTIONS
 * ============================================================================
 * Tests:
 * 1. Double-entry ledger integration for all 3 payment modes:
 *    - 'cash': Dr diesel_expense, Cr driver_advance.
 *    - 'credit': Dr diesel_expense, Cr payment_made (credit pump liability).
 *    - 'fuel_card': Dr diesel_expense, Cr bank_transfer (fuel card clearing).
 * 2. Balanced journal invariant: sum(debits) === sum(credits) for every entry.
 * 3. Driver cash advance fuel deduction:
 *    - advance_funded_diesel_cost increases on cash fuel.
 *    - Driver settlement reconciles advance = total_advance - advance_funded_diesel_cost.
 * 4. Credit vendor balance update:
 *    - Petrol pump BalanceParty current_balance increments on credit fuel slip.
 * 5. Settlement immutability:
 *    - Historical settled records (is_settled: true) are immutable and never mutated.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { Ledger } from '../../models/Ledger.js';
import { Settlement } from '../../models/Settlement.js';

describe('FF-ISSUE-043 & 044: Fuel Payment Modes Ledger Invariants & Driver Settlements', () => {
  let tenant: TestTenantContext;
  let truck: any;
  let driver: any;
  let vendorParty: any;

  beforeEach(async () => {
    tenant = await createTestTenant({ name: 'FastTrack Express' });

    truck = await Truck.create({
      company_id: tenant.company._id,
      truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Prima 4928.S',
      body_type: 'Container',
      tonnage_capacity: 30,
      status: 'available',
    });

    driver = await Driver.create({
      company_id: tenant.company._id,
      name: 'Ramesh Singh',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'active',
    });

    vendorParty = await BalanceParty.create({
      company_id: tenant.company._id,
      party_name: 'BPCL Highway Oasis',
      party_type: 'petrol_pump',
      phone: '+919876543220',
      opening_balance: 0,
      current_balance: 0,
      status: 'active',
    });
  });

  it('posts Dr diesel_expense / Cr driver_advance and updates advance_funded_diesel_cost on cash fuel', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-1`,
      status: 'active',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 100000,
      starting_cash_advance: 10000,
    });

    // Add cash diesel stop: 100 litres @ ₹90 = ₹9,000
    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'HPCL Highway Plaza',
        slip_number: 'SLIP-CASH-001',
        fuel_quantity_litres: 100,
        rate_per_litre: 90,
        payment_mode: 'cash',
      });

    expect(res.status).toBe(200);

    // Verify journey advance_funded_diesel_cost updated
    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.advance_funded_diesel_cost).toBe(9000);
    expect(updatedJourney?.total_diesel_litres).toBe(100);

    // Verify double-entry ledger posting
    const vouchers = await Ledger.find(
      {
        company_id: tenant.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    expect(vouchers.length).toBe(2);
    expect(vouchers[0].journal_id).toBeDefined();
    expect(vouchers[0].journal_id).toBe(vouchers[1].journal_id);

    // Check balanced invariant: sum(debits) === sum(credits)
    const debitLeg = vouchers.find((v) => v.balance_type === 'debit');
    const creditLeg = vouchers.find((v) => v.balance_type === 'credit');
    expect(debitLeg).toBeDefined();
    expect(creditLeg).toBeDefined();
    expect(debitLeg?.amount).toBe(9000);
    expect(creditLeg?.amount).toBe(9000);
    expect(debitLeg?.category).toBe('diesel_expense');
    expect(creditLeg?.category).toBe('driver_advance');
  });

  it('posts Dr diesel_expense / Cr payment_made and updates vendor balance on credit slip', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-2`,
      status: 'active',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 105000,
      starting_cash_advance: 15000,
    });

    // Add credit diesel stop: 150 litres @ ₹92 = ₹13,800
    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'BPCL Highway Oasis',
        slip_number: 'SLIP-CREDIT-999',
        fuel_quantity_litres: 150,
        rate_per_litre: 92,
        payment_mode: 'credit',
        balance_party_id: vendorParty._id,
      });

    expect(res.status).toBe(200);

    // Verify driver cash advance is NOT deducted
    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.advance_funded_diesel_cost).toBe(0);

    // Verify vendor BalanceParty balance incremented
    const updatedVendor = await BalanceParty.findById(vendorParty._id, null, { skipTenantCheck: true });
    expect(updatedVendor?.current_balance).toBe(13800);

    // Verify double-entry ledger posting
    const vouchers = await Ledger.find(
      {
        company_id: tenant.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    expect(vouchers.length).toBe(2);
    expect(vouchers[0].journal_id).toBe(vouchers[1].journal_id);

    const debitLeg = vouchers.find((v) => v.balance_type === 'debit');
    const creditLeg = vouchers.find((v) => v.balance_type === 'credit');
    expect(debitLeg?.amount).toBe(13800);
    expect(creditLeg?.amount).toBe(13800);
    expect(debitLeg?.category).toBe('diesel_expense');
    expect(creditLeg?.category).toBe('payment_made');
    expect(creditLeg?.payment_mode).toBe('credit');
    expect(creditLeg?.balance_party_id?.toString()).toBe(vendorParty._id.toString());
  });

  it('posts Dr diesel_expense / Cr bank_transfer on fuel_card mode', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-3`,
      status: 'active',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 110000,
      starting_cash_advance: 8000,
    });

    // Add fuel card stop: 80 litres @ ₹91 = ₹7,280
    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'IOCL Fleet Center',
        slip_number: 'CARD-TXN-404',
        fuel_quantity_litres: 80,
        rate_per_litre: 91,
        payment_mode: 'fuel_card',
      });

    expect(res.status).toBe(200);

    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.advance_funded_diesel_cost).toBe(0);

    const vouchers = await Ledger.find(
      {
        company_id: tenant.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    expect(vouchers.length).toBe(2);
    expect(vouchers[0].journal_id).toBe(vouchers[1].journal_id);

    const debitLeg = vouchers.find((v) => v.balance_type === 'debit');
    const creditLeg = vouchers.find((v) => v.balance_type === 'credit');
    expect(debitLeg?.amount).toBe(7280);
    expect(creditLeg?.amount).toBe(7280);
    expect(debitLeg?.category).toBe('diesel_expense');
    expect(creditLeg?.category).toBe('bank_transfer');
    expect(creditLeg?.payment_mode).toBe('fuel_card');
  });

  it('reconciles driver settlement by deducting cash fuel and preserves completed settlement immutability', async () => {
    // 1. Create completed journey with starting advance 12,000, toll 1,000, and cash diesel 7,000
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-SETTLE`,
      status: 'completed',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 120000,
      total_distance_kms: 500,
      starting_cash_advance: 12000,
      total_driver_expenses: 1000,
      advance_funded_diesel_cost: 7000,
      diesel_expenses: [
        {
          petrol_pump_name: 'Highway HPCL',
          slip_number: 'CASH-999',
          fuel_quantity_litres: 70,
          rate_per_litre: 100,
          total_cost: 7000,
          payment_mode: 'cash',
        },
      ],
      driver_expenses: [
        {
          expense_type: 'toll',
          amount: 1000,
          notes: 'Toll plaza',
        },
      ],
    });

    // 2. Request settlement preview via API
    const previewRes = await request(app)
      .post('/api/commercial/settlements/preview')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        driver_id: driver._id,
        journey_ids: [journey._id],
      });

    expect(previewRes.status).toBe(200);
    const calculation = previewRes.body.calculation;

    // Total advance = 12000, Advance-funded diesel = 7000, Reconciled advances = 5000
    expect(calculation.total_advances).toBe(12000);
    expect(calculation.advance_funded_diesel_cost).toBe(7000);
    expect(calculation.reconciled_advances).toBe(5000);

    // 3. Finalize settlement
    const settleRes = await request(app)
      .post('/api/commercial/settlements/confirm')
      .set('Authorization', `Bearer ${tenant.token}`)
      .set('idempotency-key', `idem-${Date.now()}`)
      .send({
        driver_id: driver._id,
        journey_ids: [journey._id],
        payment_mode: 'cash',
        notes: 'Final settlement batch test',
      });

    expect(settleRes.status).toBe(201);
    const settlementId = settleRes.body.settlement._id;

    // Verify persisted settlement record has advance_funded_diesel_cost and reconciled_advances
    const savedSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
    expect(savedSettlement?.advance_funded_diesel_cost).toBe(7000);
    expect(savedSettlement?.reconciled_advances).toBe(5000);

    // 4. Historical settlement immutability check
    const originalFinalAmount = savedSettlement?.net_amount;
    const originalReconciledAdvances = savedSettlement?.reconciled_advances;

    // Verify that subsequent queries do not mutate the settled record
    const recheckedSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
    expect(recheckedSettlement?.net_amount).toBe(originalFinalAmount);
    expect(recheckedSettlement?.reconciled_advances).toBe(originalReconciledAdvances);
  });

  it('rejects duplicate fuel slip number on the same journey with HTTP 409 CONFLICT', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-DUP-SLIP`,
      status: 'active',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 130000,
      starting_cash_advance: 10000,
    });

    // 1. Post first diesel stop with slip SLIP-UNIQUE-101
    const res1 = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'Indian Oil Highway',
        slip_number: 'SLIP-UNIQUE-101',
        fuel_quantity_litres: 50,
        rate_per_litre: 90,
        payment_mode: 'cash',
      });

    expect(res1.status).toBe(200);

    // 2. Attempt to post second diesel stop with the EXACT SAME slip number (different case)
    const res2 = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'Indian Oil Highway',
        slip_number: 'slip-unique-101',
        fuel_quantity_litres: 50,
        rate_per_litre: 90,
        payment_mode: 'cash',
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toMatch(/has already been recorded for journey/i);
  });

  it('rejects adding a diesel fuel stop to an already settled journey with HTTP 409 CONFLICT', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-LOCKED-SETTLED`,
      status: 'completed',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 140000,
      total_distance_kms: 600,
      starting_cash_advance: 5000,
      is_settled: true, // Marked settled in historical payout
    });

    const res = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        petrol_pump_name: 'BPCL Bypass',
        slip_number: 'SLIP-LATE-001',
        fuel_quantity_litres: 40,
        rate_per_litre: 95,
        payment_mode: 'cash',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been settled/i);
  });

  it('rejects cancelling an already settled journey with HTTP 400 BAD REQUEST', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-CANNOT-CANCEL`,
      status: 'completed',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 150000,
      is_settled: true,
    });

    const res = await request(app)
      .put(`/api/operations/journeys/${journey._id}/cancel`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        reason: 'Attempting invalid retroactive cancellation of settled journey',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/settled journeys cannot be cancelled/i);
  });

  it('rejects settlement preview for already settled journeys with HTTP 409 CONFLICT', async () => {
    const journey = await TruckJourney.create({
      company_id: tenant.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-SETTLED-PREVIEW`,
      status: 'completed',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 160000,
      is_settled: true,
    });

    const res = await request(app)
      .post('/api/commercial/settlements/preview')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({
        driver_id: driver._id,
        journey_ids: [journey._id],
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been settled in a previous payout/i);
  });
});
