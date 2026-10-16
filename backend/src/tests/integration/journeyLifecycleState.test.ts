/**
 * ============================================================================
 * FF-ISSUE-032, FF-ISSUE-035, FF-ISSUE-036, QST-008, QST-011
 * TRIP LIFECYCLE STATE PRECONDITIONS & MUTATION SAFEGUARDS INTEGRATION TESTS
 * ============================================================================
 * 
 * Verifies:
 * 1. Draft journeys reject milestones and delays.
 * 2. Draft journeys reject fuel stops and cash expenses.
 * 3. Invalid completion and cancellation transitions are rejected.
 * 4. Completed, cancelled, and settled journeys reject prohibited operational mutations.
 * 5. Valid active/delayed transitions still work, including non-destructive draft cancellation.
 * 6. Repeated or concurrent lifecycle requests cannot produce invalid state or duplicate side effects.
 * 7. Existing driver assignment, swap, tenant-isolation, and financial invariants remain intact.
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
import { Ledger } from '../../models/Ledger.js';
import { User } from '../../models/User.js';
import { CompanyMember, UserRole } from '../../models/CompanyMember.js';

async function createMemberInCompany(company: any, role: UserRole) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const user = await User.create({
    name: `Member ${uniqueId}`,
    email: `member-${uniqueId}@test.com`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    is_verified: true,
    is_platform_super_admin: false,
    token_version: 0,
  });
  const member = await CompanyMember.create({
    company_id: company._id,
    user_id: user._id,
    email: user.email,
    role,
    status: 'active',
  });
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      companyId: company._id.toString(),
      token_version: user.token_version || 0,
    },
    secret,
    { expiresIn: '1d' }
  );
  return { user, member, token };
}

describe('Phase C3: Journey Lifecycle State Preconditions & Mutation Safeguards', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Transports' });
    tenantB = await createTestTenant({ name: 'Beta Logistics' });
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Draft journeys reject milestones and delays
  // --------------------------------------------------------------------------
  it('1. Draft journeys reject milestones and delays with HTTP 400', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1001',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 10000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Draft 1',
      phone: '+919876543001',
      license_number: 'DL-MH-1001',
      status: 'active',
    });

    const draftJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-DRAFT-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Delhi', state: 'Delhi' },
      start_date: new Date(),
      start_odometer_kms: 10000,
    });

    // Milestone on draft
    const milestoneRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        current_location: 'Vapi Toll Plaza',
        transit_notes: 'En route before dispatch',
      });

    expect(milestoneRes.status).toBe(400);
    expect(milestoneRes.body.error).toMatch(/draft/i);

    // Delay on draft
    const delayRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/delays`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        location: 'Vapi Toll Plaza',
        delay_hours: 2,
        reason: 'traffic',
        notes: 'Pre-dispatch jam',
      });

    expect(delayRes.status).toBe(400);
    expect(delayRes.body.error).toMatch(/draft/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Draft journeys reject fuel stops and cash expenses
  // --------------------------------------------------------------------------
  it('2. Draft journeys reject fuel stops and cash expenses with HTTP 400', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1002',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 10000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Draft 2',
      phone: '+919876543002',
      license_number: 'DL-MH-1002',
      status: 'active',
    });

    const draftJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-DRAFT-EXP-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Nagpur' },
      start_date: new Date(),
      start_odometer_kms: 10000,
    });

    // Diesel stop on draft
    const dieselRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'HPCL Station Highway 48',
        fuel_quantity_litres: 100,
        rate_per_litre: 92.5,
        payment_mode: 'cash',
      });

    expect(dieselRes.status).toBe(400);
    expect(dieselRes.body.error).toMatch(/draft/i);

    // Cash expense on draft
    const expenseRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/expenses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        expense_type: 'toll',
        amount: 550,
        notes: 'Fastag recharge before departure',
      });

    expect(expenseRes.status).toBe(400);
    expect(expenseRes.body.error).toMatch(/draft/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Invalid completion and cancellation transitions are rejected
  // --------------------------------------------------------------------------
  it('3. Invalid completion and cancellation transitions are rejected with proper HTTP status', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1003',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 20000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Transitions',
      phone: '+919876543003',
      license_number: 'DL-MH-1003',
      status: 'active',
    });

    // 3a. Cannot complete draft journey
    const draftJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-TRANS-DRAFT-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 20000,
    });

    const completeDraftRes = await request(app)
      .post(`/api/operations/journeys/${draftJourney._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Warehouse Incharge',
        end_odometer_kms: 20300,
      });

    expect(completeDraftRes.status).toBe(400);
    expect(completeDraftRes.body.error).toMatch(/draft/i);

    // 3b. Cannot complete or cancel an already completed journey
    const completedJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-TRANS-COMP-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 20000,
      end_odometer_kms: 20300,
    });

    const reCompleteRes = await request(app)
      .post(`/api/operations/journeys/${completedJourney._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Warehouse Incharge',
        end_odometer_kms: 20300,
      });
    expect(reCompleteRes.status).toBe(400);
    expect(reCompleteRes.body.error).toMatch(/already completed/i);

    const cancelCompletedRes = await request(app)
      .put(`/api/operations/journeys/${completedJourney._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip is done but cancelling' });
    expect(cancelCompletedRes.status).toBe(400);
    expect(cancelCompletedRes.body.error).toMatch(/completed journeys cannot be cancelled/i);

    // 3c. Cannot complete or re-cancel a cancelled journey
    const cancelledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-TRANS-CANC-${Date.now()}`,
      status: 'cancelled',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 20000,
    });

    const completeCancelledRes = await request(app)
      .post(`/api/operations/journeys/${cancelledJourney._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Warehouse Incharge',
        end_odometer_kms: 20300,
      });
    expect(completeCancelledRes.status).toBe(400);
    expect(completeCancelledRes.body.error).toMatch(/cannot complete a cancelled journey/i);

    const reCancelRes = await request(app)
      .put(`/api/operations/journeys/${cancelledJourney._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Already cancelled' });
    expect(reCancelRes.status).toBe(400);
    expect(reCancelRes.body.error).toMatch(/already cancelled/i);

    // 3d. Settled journeys cannot be completed or cancelled
    const settledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-TRANS-SETTLED-${Date.now()}`,
      status: 'active',
      is_settled: true,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Surat' },
      start_date: new Date(),
      start_odometer_kms: 20000,
    });

    const completeSettledRes = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Warehouse Incharge',
        end_odometer_kms: 20300,
      });
    expect(completeSettledRes.status).toBe(409);
    expect(completeSettledRes.body.error).toMatch(/settled/i);

    const cancelSettledRes = await request(app)
      .put(`/api/operations/journeys/${settledJourney._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip was settled but attempting cancel' });
    expect(cancelSettledRes.status).toBe(400);
    expect(cancelSettledRes.body.error).toMatch(/settled/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Completed, cancelled, and settled journeys reject prohibited operational mutations
  // --------------------------------------------------------------------------
  it('4. Completed, cancelled, and settled journeys reject prohibited operational mutations', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1004',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 30000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Guarded',
      phone: '+919876543004',
      license_number: 'DL-MH-1004',
      status: 'active',
    });

    // 4a. Completed Journey mutations
    const completedJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-PROHIB-COMP-${Date.now()}`,
      status: 'completed',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 30000,
      end_odometer_kms: 30150,
    });

    const compMilestone = await request(app)
      .post(`/api/operations/journeys/${completedJourney._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ current_location: 'Pune', transit_notes: 'Late note' });
    expect(compMilestone.status).toBe(400);

    const compDelay = await request(app)
      .post(`/api/operations/journeys/${completedJourney._id}/delays`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ location: 'Pune', delay_hours: 1, reason: 'traffic' });
    expect(compDelay.status).toBe(400);

    const compDiesel = await request(app)
      .post(`/api/operations/journeys/${completedJourney._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ petrol_pump_name: 'HPCL Pune', fuel_quantity_litres: 50, rate_per_litre: 92, payment_mode: 'cash' });
    expect(compDiesel.status).toBe(400);

    const compExpense = await request(app)
      .post(`/api/operations/journeys/${completedJourney._id}/expenses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ expense_type: 'toll', amount: 200 });
    expect(compExpense.status).toBe(400);

    const compDispatch = await request(app)
      .put(`/api/operations/journeys/${completedJourney._id}/dispatch`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ note: 'Re-dispatch completed' });
    expect(compDispatch.status).toBe(400);

    // 4b. Cancelled Journey mutations
    const cancelledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-PROHIB-CANC-${Date.now()}`,
      status: 'cancelled',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 30000,
    });

    const cancMilestone = await request(app)
      .post(`/api/operations/journeys/${cancelledJourney._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ current_location: 'Pune' });
    expect(cancMilestone.status).toBe(400);

    const cancDelay = await request(app)
      .post(`/api/operations/journeys/${cancelledJourney._id}/delays`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ location: 'Pune', delay_hours: 1, reason: 'traffic' });
    expect(cancDelay.status).toBe(400);

    const cancDiesel = await request(app)
      .post(`/api/operations/journeys/${cancelledJourney._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ petrol_pump_name: 'HPCL Pune', fuel_quantity_litres: 50, rate_per_litre: 92, payment_mode: 'cash' });
    expect(cancDiesel.status).toBe(400);

    const cancExpense = await request(app)
      .post(`/api/operations/journeys/${cancelledJourney._id}/expenses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ expense_type: 'toll', amount: 200 });
    expect(cancExpense.status).toBe(400);

    // 4c. Settled Journey mutations
    const settledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-PROHIB-SETT-${Date.now()}`,
      status: 'active',
      is_settled: true,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 30000,
    });

    const settMilestone = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ current_location: 'Pune' });
    expect(settMilestone.status).toBe(409);
    expect(settMilestone.body.error).toMatch(/settled/i);

    const settDelay = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/delays`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ location: 'Pune', delay_hours: 1, reason: 'traffic' });
    expect(settDelay.status).toBe(409);
    expect(settDelay.body.error).toMatch(/settled/i);

    const settDiesel = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ petrol_pump_name: 'HPCL Pune', fuel_quantity_litres: 50, rate_per_litre: 92, payment_mode: 'cash' });
    expect(settDiesel.status).toBe(409);
    expect(settDiesel.body.error).toMatch(/settled/i);

    const settExpense = await request(app)
      .post(`/api/operations/journeys/${settledJourney._id}/expenses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ expense_type: 'toll', amount: 200 });
    expect(settExpense.status).toBe(409);
    expect(settExpense.body.error).toMatch(/settled/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Valid active/delayed transitions still work
  // --------------------------------------------------------------------------
  it('5. Valid active/delayed transitions still work and draft cancellation is non-destructive', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1005',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 40000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Full Lifecycle',
      phone: '+919876543005',
      license_number: 'DL-MH-1005',
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-LIFECYCLE-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Goa', state: 'Goa' },
      start_date: new Date(),
      start_odometer_kms: 40000,
      starting_cash_advance: 5000,
    });

    // Step 1: Dispatch draft journey
    const dispatchRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/dispatch`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ note: 'Departing depot' });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.journey.status).toBe('active');

    // Verify truck and driver allocation
    const dispatchedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(dispatchedTruck?.status).toBe('on_trip');
    expect(String(dispatchedTruck?.current_driver_id)).toBe(String(driver._id));

    const dispatchedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(String(dispatchedDriver?.current_truck_id)).toBe(String(truck._id));

    // Step 2: Milestone on active journey
    const milestoneRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        current_location: 'Kolhapur Bypass',
        transit_notes: 'Smooth transit',
      });
    expect(milestoneRes.status).toBe(200);

    // Step 3: Transit delay on active journey transitions to 'delayed'
    const delayRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/delays`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        location: 'Amboli Ghat',
        delay_hours: 3,
        reason: 'weather',
        notes: 'Heavy landslide clearing',
      });
    expect(delayRes.status).toBe(200);
    expect(delayRes.body.journey.status).toBe('delayed');

    // Step 4: Milestone, diesel, and expense on delayed journey
    const delayedMilestoneRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/milestones`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        current_location: 'Sawantwadi',
        transit_notes: 'Resuming movement',
      });
    expect(delayedMilestoneRes.status).toBe(200);

    const dieselRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'IOCL Highway Hub',
        fuel_quantity_litres: 80,
        rate_per_litre: 91.5,
        payment_mode: 'cash',
        slip_number: 'SLIP-C3-001',
      });
    expect(dieselRes.status).toBe(200);

    const expenseRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/expenses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        expense_type: 'toll',
        amount: 350,
        notes: 'State border tax',
      });
    expect(expenseRes.status).toBe(200);

    // Step 5: Complete delivery on delayed journey
    const podRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Panaji Warehouse Manager',
        end_odometer_kms: 40550,
        notes: 'Delivered in good condition',
      });
    expect(podRes.status).toBe(200);
    expect(podRes.body.journey.status).toBe('completed');

    // Verify truck released and odometer updated
    const completedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(completedTruck?.status).toBe('available');
    expect(completedTruck?.current_driver_id).toBeUndefined();
    expect(completedTruck?.current_odometer_kms).toBe(40550);

    // Verify driver released
    const completedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(completedDriver?.current_truck_id).toBeUndefined();

    // Step 6: Draft cancellation does NOT release truck status or standing driver assignment
    const standingTruck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1006',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 15000,
    });

    const standingDriver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Standing Assignment',
      phone: '+919876543006',
      license_number: 'DL-MH-1006',
      status: 'active',
      current_truck_id: standingTruck._id,
    });

    standingTruck.current_driver_id = standingDriver._id as any;
    standingTruck.driver_assignments.push({
      driver_id: standingDriver._id as any,
      assigned_at: new Date(),
      notes: 'Standing assignment',
    });
    await standingTruck.save();

    const draftToCancel = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: standingTruck._id,
      driver_id: standingDriver._id,
      journey_number: `JRN-DRAFT-CANCEL-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Nashik' },
      start_date: new Date(),
      start_odometer_kms: 15000,
    });

    const cancelDraftRes = await request(app)
      .put(`/api/operations/journeys/${draftToCancel._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Load cancelled before departure' });

    expect(cancelDraftRes.status).toBe(200);
    expect(cancelDraftRes.body.journey.status).toBe('cancelled');

    // Verify standing truck still has standing driver assignment and is available
    const postCancelTruck = await Truck.findById(standingTruck._id, null, { skipTenantCheck: true });
    expect(postCancelTruck?.status).toBe('available');
    expect(String(postCancelTruck?.current_driver_id)).toBe(String(standingDriver._id));

    const postCancelDriver = await Driver.findById(standingDriver._id, null, { skipTenantCheck: true });
    expect(String(postCancelDriver?.current_truck_id)).toBe(String(standingTruck._id));
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Repeated or concurrent lifecycle requests cannot produce invalid state
  // --------------------------------------------------------------------------
  it('6. Repeated or concurrent lifecycle requests cannot produce invalid state or duplicate side effects', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1007',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 60000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Concurrent',
      phone: '+919876543007',
      license_number: 'DL-MH-1007',
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-CONCURRENT-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Bengaluru' },
      start_date: new Date(),
      start_odometer_kms: 60000,
    });

    // 6a. Concurrent dispatch
    const [dispatch1, dispatch2] = await Promise.all([
      request(app)
        .put(`/api/operations/journeys/${journey._id}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ note: 'Concurrent dispatch 1' }),
      request(app)
        .put(`/api/operations/journeys/${journey._id}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ note: 'Concurrent dispatch 2' }),
    ]);

    const dispatchStatuses = [dispatch1.status, dispatch2.status].sort();
    expect(dispatchStatuses).toEqual([200, 400]);

    // Verify database state: status is active and truck only has 1 active assignment
    const updatedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(updatedTruck?.status).toBe('on_trip');
    const openAssignments = updatedTruck?.driver_assignments.filter((a) => !a.unassigned_at) || [];
    expect(openAssignments.length).toBe(1);

    // 6b. Concurrent completion
    const [comp1, comp2] = await Promise.all([
      request(app)
        .post(`/api/operations/journeys/${journey._id}/pod`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ contact_name: 'Contact 1', end_odometer_kms: 60900 }),
      request(app)
        .post(`/api/operations/journeys/${journey._id}/pod`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ contact_name: 'Contact 2', end_odometer_kms: 60900 }),
    ]);

    const compStatuses = [comp1.status, comp2.status].sort();
    expect(compStatuses).toEqual([200, 400]);

    // Verify truck is available and released cleanly
    const postCompTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(postCompTruck?.status).toBe('available');
    expect(postCompTruck?.current_driver_id).toBeUndefined();
    expect(postCompTruck?.current_odometer_kms).toBe(60900);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Existing driver assignment, swap, tenant-isolation, and financial invariants
  // --------------------------------------------------------------------------
  it('7. Tenant isolation, driver swap authorization, and financial ledger invariants remain intact', async () => {
    const truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AA1008',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'on_trip',
      current_odometer_kms: 70000,
    });

    const driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Tenant A',
      phone: '+919876543008',
      license_number: 'DL-MH-1008',
      status: 'active',
      current_truck_id: truckA._id,
    });

    const journeyA = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-ISOLATION-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Chennai' },
      start_date: new Date(),
      start_odometer_kms: 70000,
    });

    // 7a. Cross-tenant mutation rejection
    const tenantBMilestone = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/milestones`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ current_location: 'Illegal Location' });
    expect(tenantBMilestone.status).toBe(404);

    const tenantBDiesel = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/diesel`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ petrol_pump_name: 'Illegal Pump', fuel_quantity_litres: 50, rate_per_litre: 90, payment_mode: 'cash' });
    expect(tenantBDiesel.status).toBe(404);

    const tenantBExpense = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/expenses`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ expense_type: 'toll', amount: 500 });
    expect(tenantBExpense.status).toBe(404);

    const tenantBPOD = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/pod`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ contact_name: 'Intruder', end_odometer_kms: 71000 });
    expect(tenantBPOD.status).toBe(404);

    const tenantBCancel = await request(app)
      .put(`/api/operations/journeys/${journeyA._id}/cancel`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ reason: 'Intruder cancel' });
    expect(tenantBCancel.status).toBe(404);

    // 7b. Driver swap RBAC: Dispatcher role cannot execute driver swap (Admin only)
    const dispatcher = await createMemberInCompany(tenantA.company, 'dispatcher');
    const replacementDriver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Replacement Driver A',
      phone: '+919876543009',
      license_number: 'DL-MH-1009',
      status: 'active',
    });

    const dispatcherSwapRes = await request(app)
      .put(`/api/operations/journeys/${journeyA._id}/swap-driver`)
      .set('Authorization', `Bearer ${dispatcher.token}`)
      .send({
        incoming_driver_id: replacementDriver._id.toString(),
        handover_odometer: 70300,
        reason: 'Authorized handover attempt by dispatcher role',
      });
    expect(dispatcherSwapRes.status).toBe(403);

    // Admin role CAN execute driver swap on active journey
    const adminSwapRes = await request(app)
      .put(`/api/operations/journeys/${journeyA._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: replacementDriver._id.toString(),
        handover_odometer: 70300,
        reason: 'Authorized handover performed by company admin',
      });
    expect(adminSwapRes.status).toBe(200);
    expect(adminSwapRes.body.journey.driver_id).toBe(replacementDriver._id.toString());

    // 7c. Financial Ledger Invariant: Recording diesel posts balanced double-entry vouchers
    const dieselRes = await request(app)
      .post(`/api/operations/journeys/${journeyA._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        petrol_pump_name: 'HPCL Ledger Verification Pump',
        fuel_quantity_litres: 100,
        rate_per_litre: 90,
        payment_mode: 'cash',
        slip_number: 'SLIP-LEDGER-001',
      });
    expect(dieselRes.status).toBe(200);

    const vouchers = await Ledger.find(
      {
        company_id: tenantA.company._id,
        journey_id: journeyA._id,
      },
      null,
      { skipTenantCheck: true }
    );
    expect(vouchers.length).toBe(2);
    expect(vouchers[0].journal_id).toBeDefined();
    expect(vouchers[0].journal_id).toBe(vouchers[1].journal_id);

    const debitLeg = vouchers.find((v) => v.balance_type === 'debit');
    const creditLeg = vouchers.find((v) => v.balance_type === 'credit');
    expect(debitLeg).toBeDefined();
    expect(creditLeg).toBeDefined();
    expect(debitLeg?.amount).toBe(9000);
    expect(creditLeg?.amount).toBe(9000);
    expect(debitLeg?.category).toBe('diesel_expense');
    expect(creditLeg?.category).toBe('driver_advance');
  });
});
