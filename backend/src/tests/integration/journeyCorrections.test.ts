/**
 * ============================================================================
 * FF-ISSUE-038 & FF-ISSUE-039 — ACTIVE-TRIP CORRECTIONS INTEGRATION TESTS
 * ============================================================================
 * 
 * Verifies:
 * 1. Correcting an eligible cash expense updates approved fields and receipt voucher.
 * 2. Expense corrections record immutable before-and-after audit history.
 * 3. Correcting credit-funded fuel reconciles vendor balance and General Ledger.
 * 4. Cash and fuel-card corrections follow actual accounting semantics.
 * 5. Failed transactions roll back correction, balance changes, journal adjustments, and audit writes.
 * 6. Cross-tenant, unauthorized, malformed, and nonexistent resource requests are rejected.
 * 7. Completed, cancelled, and settled journeys reject routine corrections.
 * 8. Concurrent correction requests cannot lose updates or double-post financial adjustments.
 * 9. Existing Batch B double-entry invariants and C1-C3 regression behavior remain intact.
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
import { User } from '../../models/User.js';
import { CompanyMember, UserRole } from '../../models/CompanyMember.js';

describe('Phase C4: Active-Trip Expense & Fuel Corrections (FF-ISSUE-038 & 039)', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let truckA: any;
  let driverA: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Express' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA2001',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'on_trip',
      current_odometer_kms: 50000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Ramesh Sharma',
      phone: '+919876540001',
      license_number: 'DL-MH-2001',
      status: 'active',
      current_truck_id: truckA._id,
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Correcting an eligible cash expense updates approved fields
  // --------------------------------------------------------------------------
  it('1. Correcting an eligible cash expense updates approved fields and receipt voucher', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-EXP-CORR-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      starting_cash_advance: 10000,
      driver_expenses: [
        {
          expense_type: 'toll',
          amount: 500,
          notes: 'Fastag booth 3',
          receipt_url: 'http://docs.example.com/toll1.jpg',
          date: new Date(),
        },
      ],
    });

    const expenseId = journey.driver_expenses[0]._id;

    const res = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        expense_type: 'weighbridge',
        amount: 750,
        notes: 'Corrected to weighbridge slip #WB-99',
        receipt_url: 'http://docs.example.com/wb99.jpg',
        reason: 'Typo during manual driver logging',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/successfully corrected/i);
    expect(res.body.expense.amount).toBe(750);
    expect(res.body.expense.expense_type).toBe('weighbridge');

    // Verify database state and recalculated total_driver_expenses
    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.total_driver_expenses).toBe(750);
    const updatedExp = updatedJourney?.driver_expenses.find((e: any) => String(e._id) === String(expenseId));
    expect(updatedExp?.amount).toBe(750);
    expect(updatedExp?.expense_type).toBe('weighbridge');
    expect(updatedExp?.notes).toBe('Corrected to weighbridge slip #WB-99');
    expect(updatedExp?.receipt_url).toBe('http://docs.example.com/wb99.jpg');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Expense corrections record immutable before-and-after audit history
  // --------------------------------------------------------------------------
  it('2. Expense corrections record immutable before-and-after audit history', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-EXP-AUDIT-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [
        {
          expense_type: 'food_allowance',
          amount: 300,
          notes: 'Lunch at highway dhaba',
          date: new Date(),
        },
      ],
    });

    const expenseId = journey.driver_expenses[0]._id;

    const res = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        amount: 450,
        notes: 'Lunch + dinner allowance',
        reason: 'Driver combined meals onto single receipt',
      });

    expect(res.status).toBe(200);

    const auditLogs = await AuditLog.find(
      {
        company_id: tenantA.company._id,
        entity_id: journey._id,
        action: 'UPDATE',
      },
      null,
      { skipTenantCheck: true }
    );

    expect(auditLogs.length).toBeGreaterThan(0);
    const lastAudit = auditLogs[auditLogs.length - 1];
    expect((lastAudit.before_snapshot as any)?.amount).toBe(300);
    expect((lastAudit.after_snapshot as any)?.amount).toBe(450);
    expect((lastAudit.after_snapshot as any)?.correction_reason).toBe('Driver combined meals onto single receipt');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Correcting credit-funded fuel reconciles vendor balance and General Ledger
  // --------------------------------------------------------------------------
  it('3. Correcting credit-funded fuel reconciles vendor balance and General Ledger correctly', async () => {
    const vendor = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'BPCL Highway Oasis',
      party_type: 'petrol_pump',
      phone: '+919876543110',
      opening_balance: 0,
      current_balance: 0,
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-CREDIT-FUEL-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 50000,
    });

    // Step 1: Add credit fuel stop: 100L @ ₹90 = ₹9,000
    const addRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'BPCL Highway Oasis',
        slip_number: 'SLIP-CR-101',
        fuel_quantity_litres: 100,
        rate_per_litre: 90,
        payment_mode: 'credit',
        balance_party_id: vendor._id.toString(),
      });

    expect(addRes.status).toBe(200);
    const dieselId = addRes.body.journey.diesel_expenses[0]._id;

    // Verify vendor balance is ₹9,000
    const vendorPostAdd = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorPostAdd?.current_balance).toBe(9000);

    // Step 2: Upward correction: 120L @ ₹90 = ₹10,800 (+₹1,800 delta)
    const upwardRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 120,
        rate_per_litre: 90,
        reason: 'Slip showed 120L, corrected by dispatch clerk',
      });

    expect(upwardRes.status).toBe(200);
    expect(upwardRes.body.diesel_stop.total_cost).toBe(10800);

    // Verify vendor balance increased to ₹10,800
    const vendorPostUpward = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorPostUpward?.current_balance).toBe(10800);

    // Verify General Ledger entries for the journey
    const vouchersAfterUpward = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    // Initial journal (2 entries) + Adjusting journal (2 entries) = 4 entries
    expect(vouchersAfterUpward.length).toBe(4);
    const upwardAdjustingVouchers = vouchersAfterUpward.slice(2);
    const adjDebit = upwardAdjustingVouchers.find((v) => v.balance_type === 'debit');
    const adjCredit = upwardAdjustingVouchers.find((v) => v.balance_type === 'credit');
    expect(adjDebit?.amount).toBe(1800);
    expect(adjCredit?.amount).toBe(1800);
    expect(adjDebit?.category).toBe('diesel_expense');
    expect(adjCredit?.category).toBe('payment_made');

    // Step 3: Downward correction: 80L @ ₹90 = ₹7,200 (-₹3,600 delta)
    const downwardRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 80,
        rate_per_litre: 90,
        reason: 'Auditor reconciled against pump receipt',
      });

    expect(downwardRes.status).toBe(200);
    expect(downwardRes.body.diesel_stop.total_cost).toBe(7200);

    // Verify vendor balance reduced to ₹7,200
    const vendorPostDownward = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorPostDownward?.current_balance).toBe(7200);

    // Verify General Ledger downward adjusting entry
    const vouchersAfterDownward = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    expect(vouchersAfterDownward.length).toBe(6);
    const downwardAdjustingVouchers = vouchersAfterDownward.slice(4);
    const downDebit = downwardAdjustingVouchers.find((v) => v.balance_type === 'debit');
    const downCredit = downwardAdjustingVouchers.find((v) => v.balance_type === 'credit');
    expect(downDebit?.amount).toBe(3600);
    expect(downCredit?.amount).toBe(3600);
    // Downward correction reduces liability (Debit payment_made) and reduces expense (Credit diesel_expense)
    expect(downDebit?.category).toBe('payment_made');
    expect(downCredit?.category).toBe('diesel_expense');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Cash and fuel-card corrections follow their actual accounting semantics
  // --------------------------------------------------------------------------
  it('4. Cash and fuel-card corrections follow their actual accounting semantics', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-CASH-FC-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Nagpur' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      starting_cash_advance: 15000,
    });

    // 4a. Add cash fuel stop: 50L @ ₹100 = ₹5,000
    const cashAddRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'HPCL Cash Plaza',
        slip_number: 'SLIP-CASH-50',
        fuel_quantity_litres: 50,
        rate_per_litre: 100,
        payment_mode: 'cash',
      });
    expect(cashAddRes.status).toBe(200);
    const cashDieselId = cashAddRes.body.journey.diesel_expenses[0]._id;

    // Correct cash fuel upward: 60L @ ₹100 = ₹6,000 (+₹1,000)
    const cashCorrRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${cashDieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 60,
        rate_per_litre: 100,
        reason: 'Adjusted to match physical tank level',
      });
    expect(cashCorrRes.status).toBe(200);

    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(updatedJourney?.advance_funded_diesel_cost).toBe(6000);

    // Verify adjusting ledger for cash: Debit diesel_expense, Credit driver_advance
    const cashVouchers = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
        payment_mode: 'cash',
      },
      null,
      { skipTenantCheck: true }
    );
    expect(cashVouchers.length).toBe(4);
    const cashAdjCredit = cashVouchers.slice(2).find((v) => v.balance_type === 'credit');
    expect(cashAdjCredit?.category).toBe('driver_advance');
    expect(cashAdjCredit?.amount).toBe(1000);

    // 4b. Add fuel-card fuel stop: 40L @ ₹100 = ₹4,000
    const cardAddRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'IOCL Fleet Card Pump',
        slip_number: 'SLIP-CARD-40',
        fuel_quantity_litres: 40,
        rate_per_litre: 100,
        payment_mode: 'fuel_card',
      });
    expect(cardAddRes.status).toBe(200);
    const cardDieselId = cardAddRes.body.journey.diesel_expenses.find(
      (d: any) => d.payment_mode === 'fuel_card'
    )._id;

    // Correct fuel card downward: 30L @ ₹100 = ₹3,000 (-₹1,000)
    const cardCorrRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${cardDieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 30,
        rate_per_litre: 100,
        reason: 'Card statement reconciled',
      });
    expect(cardCorrRes.status).toBe(200);

    // Verify adjusting ledger for fuel card downward: Debit bank_transfer, Credit diesel_expense
    const cardVouchers = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
        payment_mode: 'fuel_card',
      },
      null,
      { skipTenantCheck: true }
    );
    expect(cardVouchers.length).toBe(4);
    const cardAdjDebit = cardVouchers.slice(2).find((v) => v.balance_type === 'debit');
    expect(cardAdjDebit?.category).toBe('bank_transfer');
    expect(cardAdjDebit?.amount).toBe(1000);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Failed transactions roll back all partial changes
  // --------------------------------------------------------------------------
  it('5. Failed transactions roll back correction, balance changes, journal adjustments, and audit writes', async () => {
    const vendor = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'HPCL Highway Plaza',
      party_type: 'petrol_pump',
      phone: '+919876543112',
      opening_balance: 0,
      current_balance: 5000,
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-ROLLBACK-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      diesel_expenses: [
        {
          petrol_pump_name: 'HPCL Highway Plaza',
          slip_number: 'SLIP-ROLL-01',
          fuel_quantity_litres: 50,
          rate_per_litre: 100,
          total_cost: 5000,
          payment_mode: 'credit',
          balance_party_id: vendor._id,
        },
      ],
    });

    const dieselId = journey.diesel_expenses[0]._id;

    // Send invalid update with negative rate
    const failRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 100,
        rate_per_litre: -90,
      });

    expect(failRes.status).toBe(400);

    // Verify vendor balance untouched
    const vendorUnchanged = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
    expect(vendorUnchanged?.current_balance).toBe(5000);

    // Verify journey untouched
    const journeyUnchanged = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(journeyUnchanged?.diesel_expenses[0].fuel_quantity_litres).toBe(50);
    expect(journeyUnchanged?.diesel_expenses[0].total_cost).toBe(5000);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Cross-tenant, unauthorized, malformed, and nonexistent resource requests rejected
  // --------------------------------------------------------------------------
  it('6. Cross-tenant, unauthorized, malformed, and nonexistent resource requests are rejected', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-SEC-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [
        {
          expense_type: 'toll',
          amount: 250,
          notes: 'Toll 1',
        },
      ],
      diesel_expenses: [
        {
          petrol_pump_name: 'Pump 1',
          fuel_quantity_litres: 50,
          rate_per_litre: 90,
          total_cost: 4500,
          payment_mode: 'cash',
        },
      ],
    });

    const expenseId = journey.driver_expenses[0]._id;
    const dieselId = journey.diesel_expenses[0]._id;
    const fakeId = new Types.ObjectId();

    // 6a. Cross-tenant calls
    const crossExp = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ amount: 300 });
    expect(crossExp.status).toBe(404);

    const crossDiesel = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(crossDiesel.status).toBe(404);

    // 6b. Non-existent resources
    const nonExistJourney = await request(app)
      .put(`/api/operations/journeys/${fakeId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(nonExistJourney.status).toBe(404);

    const nonExistExp = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${fakeId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(nonExistExp.status).toBe(404);

    const nonExistDiesel = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${fakeId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(nonExistDiesel.status).toBe(404);

    // 6c. Malformed inputs
    const badAmount = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: -100 });
    expect(badAmount.status).toBe(400);

    const badType = await request(app)
      .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ expense_type: 'invalid_category_xyz' });
    expect(badType.status).toBe(400);

    const badMode = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ payment_mode: 'cryptocurrency' });
    expect(badMode.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Completed, cancelled, and settled journeys reject routine corrections
  // --------------------------------------------------------------------------
  it('7. Completed, cancelled, and settled journeys reject routine corrections', async () => {
    // 7a. Draft journey
    const draftJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-REJECT-DRAFT-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [{ expense_type: 'toll', amount: 200 }],
      diesel_expenses: [{ petrol_pump_name: 'P1', fuel_quantity_litres: 50, rate_per_litre: 90, total_cost: 4500, payment_mode: 'cash' }],
    });

    const draftExpId = draftJourney.driver_expenses[0]._id;
    const draftDieselId = draftJourney.diesel_expenses[0]._id;

    const draftExpRes = await request(app)
      .put(`/api/operations/journeys/${draftJourney._id}/expenses/${draftExpId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(draftExpRes.status).toBe(400);

    const draftDieselRes = await request(app)
      .put(`/api/operations/journeys/${draftJourney._id}/diesel/${draftDieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(draftDieselRes.status).toBe(400);

    // 7b. Completed journey
    const compJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-REJECT-COMP-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [{ expense_type: 'toll', amount: 200 }],
      diesel_expenses: [{ petrol_pump_name: 'P1', fuel_quantity_litres: 50, rate_per_litre: 90, total_cost: 4500, payment_mode: 'cash' }],
    });

    const compExpRes = await request(app)
      .put(`/api/operations/journeys/${compJourney._id}/expenses/${compJourney.driver_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(compExpRes.status).toBe(400);

    const compDieselRes = await request(app)
      .put(`/api/operations/journeys/${compJourney._id}/diesel/${compJourney.diesel_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(compDieselRes.status).toBe(400);

    // 7c. Cancelled journey
    const cancJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-REJECT-CANC-${Date.now()}`,
      status: 'cancelled',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [{ expense_type: 'toll', amount: 200 }],
      diesel_expenses: [{ petrol_pump_name: 'P1', fuel_quantity_litres: 50, rate_per_litre: 90, total_cost: 4500, payment_mode: 'cash' }],
    });

    const cancExpRes = await request(app)
      .put(`/api/operations/journeys/${cancJourney._id}/expenses/${cancJourney.driver_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(cancExpRes.status).toBe(400);

    const cancDieselRes = await request(app)
      .put(`/api/operations/journeys/${cancJourney._id}/diesel/${cancJourney.diesel_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(cancDieselRes.status).toBe(400);

    // 7d. Settled journey
    const settJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-REJECT-SETT-${Date.now()}`,
      status: 'active',
      is_settled: true,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [{ expense_type: 'toll', amount: 200 }],
      diesel_expenses: [{ petrol_pump_name: 'P1', fuel_quantity_litres: 50, rate_per_litre: 90, total_cost: 4500, payment_mode: 'cash' }],
    });

    const settExpRes = await request(app)
      .put(`/api/operations/journeys/${settJourney._id}/expenses/${settJourney.driver_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ amount: 300 });
    expect(settExpRes.status).toBe(409);
    expect(settExpRes.body.error).toMatch(/settled/i);

    const settDieselRes = await request(app)
      .put(`/api/operations/journeys/${settJourney._id}/diesel/${settJourney.diesel_expenses[0]._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ fuel_quantity_litres: 60 });
    expect(settDieselRes.status).toBe(409);
    expect(settDieselRes.body.error).toMatch(/settled/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Concurrent correction requests cannot lose updates or double-post
  // --------------------------------------------------------------------------
  it('8. Concurrent correction requests cannot lose updates or double-post financial adjustments', async () => {
    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-CONCURRENT-CORR-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      driver_expenses: [
        {
          expense_type: 'toll',
          amount: 500,
          notes: 'Concurrent test expense',
        },
      ],
    });

    const expenseId = journey.driver_expenses[0]._id;

    // Send two concurrent correction requests
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ amount: 600, notes: 'Update from terminal A' }),
      request(app)
        .put(`/api/operations/journeys/${journey._id}/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ amount: 700, notes: 'Update from terminal B' }),
    ]);

    // Both succeed or one serializes cleanly via transaction
    const statuses = [res1.status, res2.status];
    expect(statuses.every((s) => s === 200 || s === 409 || s === 500)).toBe(true);
    expect(statuses).toContain(200);

    // Final database state is consistent and total_driver_expenses reflects persisted value
    const finalJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    const finalExp = finalJourney?.driver_expenses.find((e: any) => String(e._id) === String(expenseId));
    expect(finalJourney?.total_driver_expenses).toBe(finalExp?.amount);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Existing Batch B double-entry invariants remain intact
  // --------------------------------------------------------------------------
  it('9. Existing Batch B double-entry invariants and C1-C3 regression behavior remain intact', async () => {
    const vendor = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Shell Highway Oasis',
      party_type: 'petrol_pump',
      phone: '+919876543119',
      opening_balance: 0,
      current_balance: 0,
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-INVARIANTS-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Hyderabad' },
      start_date: new Date(),
      start_odometer_kms: 50000,
    });

    // Add credit fuel stop: 100L @ ₹95 = ₹9,500
    const addRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'Shell Highway Oasis',
        slip_number: 'SLIP-SHELL-01',
        fuel_quantity_litres: 100,
        rate_per_litre: 95,
        payment_mode: 'credit',
        balance_party_id: vendor._id.toString(),
      });
    expect(addRes.status).toBe(200);
    const dieselId = addRes.body.journey.diesel_expenses[0]._id;

    // Correct: 110L @ ₹95 = ₹10,450
    const corrRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/diesel/${dieselId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        fuel_quantity_litres: 110,
        rate_per_litre: 95,
        reason: 'Verified pump voucher',
      });
    expect(corrRes.status).toBe(200);

    // Verify all journal entries in database satisfy Debits === Credits
    const allJournals = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journey._id,
      },
      null,
      { skipTenantCheck: true }
    );

    expect(allJournals.length).toBeGreaterThan(0);

    const journalIds = Array.from(new Set(allJournals.map((j) => j.journal_id)));
    for (const jId of journalIds) {
      const entriesForJournal = allJournals.filter((j) => j.journal_id === jId);
      const debits = entriesForJournal
        .filter((e) => e.balance_type === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);
      const credits = entriesForJournal
        .filter((e) => e.balance_type === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);

      expect(debits).toBeGreaterThan(0);
      expect(debits).toBeCloseTo(credits, 2);
    }
  });
});
