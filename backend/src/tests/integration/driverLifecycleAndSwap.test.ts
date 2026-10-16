/**
 * ============================================================================
 * FF-ISSUE-030 & FF-ISSUE-031 — DRIVER LIFECYCLE & MID-TRIP SWAP TESTS
 * ============================================================================
 * 
 * Verifies:
 * 1. Dispatch synchronizes allocation references and history without duplicates.
 * 2. Completion closes the correct assignment history and releases resources atomically.
 * 3. Cancellation synchronizes allocation state safely.
 * 4. A successful driver swap records the complete handover audit trail.
 * 5. Unauthorized users cannot perform a swap.
 * 6. Invalid odometer values, short reasons, invalid journey states, and cross-tenant references are rejected.
 * 7. Concurrent swaps or conflicting assignments cannot produce inconsistent pointers or duplicate active assignments.
 * 8. Transaction failures leave no partial changes.
 * 9. Existing Batch A security and Batch B financial invariants remain intact.
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
import { AuditLog } from '../../models/AuditLog.js';
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

describe('FF-ISSUE-030 & FF-ISSUE-031: Driver Lifecycle & Controlled Driver Swap', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });
  });

  it('1. Dispatch synchronizes allocation references and history without duplicate active entries', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0001',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
      current_odometer_kms: 50000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Ramesh Patel',
      phone: '+919876500001',
      license_number: 'DL-MH-0001',
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-1`,
      status: 'draft',
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Pune', state: 'Maharashtra' },
      start_date: new Date(),
      start_odometer_kms: 50000,
      starting_cash_advance: 5000,
    });

    // Dispatch journey
    const res = await request(app)
      .put(`/api/operations/journeys/${journey._id}/dispatch`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ note: 'Driver departing from depot' });

    expect(res.status).toBe(200);
    expect(res.body.journey.status).toBe('active');

    // Verify DB persistence
    const updatedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });

    expect(updatedJourney?.status).toBe('active');
    expect(updatedTruck?.status).toBe('on_trip');
    expect(updatedTruck?.current_driver_id?.toString()).toBe(driver._id.toString());
    expect(updatedDriver?.current_truck_id?.toString()).toBe(truck._id.toString());

    // Verify exactly one active assignment in history
    const activeTruckAssignments = updatedTruck?.driver_assignments.filter((a) => !a.unassigned_at);
    const activeDriverAssignments = updatedDriver?.assignment_history.filter((a) => !a.unassigned_at);
    expect(activeTruckAssignments?.length).toBe(1);
    expect(activeDriverAssignments?.length).toBe(1);
    expect(activeTruckAssignments?.[0].driver_id.toString()).toBe(driver._id.toString());
    expect(activeDriverAssignments?.[0].truck_id.toString()).toBe(truck._id.toString());

    // Verify Driver schema invariant: status must remain 'active', NOT 'available' or 'on_trip'
    expect(updatedDriver?.status).toBe('active');

    // Verify inactive/on-leave driver cannot be dispatched
    const leaveDriver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Kiran Leave',
      phone: '+919876500002',
      license_number: 'DL-MH-0002',
      status: 'on_leave',
    });

    const leaveTruck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0002',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 10000,
    });

    const leaveJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: leaveTruck._id,
      driver_id: leaveDriver._id,
      journey_number: `JRN-${Date.now()}-2`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Goa' },
      start_date: new Date(),
      start_odometer_kms: 10000,
      starting_cash_advance: 2000,
    });

    const badDispatchRes = await request(app)
      .put(`/api/operations/journeys/${leaveJourney._id}/dispatch`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send();

    expect(badDispatchRes.status).toBe(400);
    expect(badDispatchRes.body.error).toMatch(/on_leave/i);
  });

  it('2. Completion closes the correct assignment history and releases the correct resources', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0003',
      make: 'Eicher',
      model: 'Pro 6000',
      body_type: 'Open',
      tonnage_capacity: 20,
      status: 'on_trip',
      current_odometer_kms: 60000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Mohan Lal',
      phone: '+919876500003',
      license_number: 'DL-MH-0003',
      status: 'active',
      current_truck_id: truck._id,
      assignment_history: [
        {
          truck_id: truck._id,
          assigned_at: new Date(Date.now() - 3600000),
          notes: 'Dispatched',
        },
      ],
    });

    truck.current_driver_id = driver._id;
    truck.driver_assignments = [
      {
        driver_id: driver._id,
        assigned_at: new Date(Date.now() - 3600000),
        notes: 'Dispatched',
      },
    ];
    await truck.save();

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-3`,
      status: 'active',
      from_location: { city: 'Nagpur' },
      to_location: { city: 'Nashik' },
      start_date: new Date(Date.now() - 3600000),
      start_odometer_kms: 60000,
      starting_cash_advance: 3000,
    });

    // Complete POD
    const podRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Receiver Warehouse Head',
        end_odometer_kms: 60450,
        pod_slip_url: 'https://storage.test/pod-003.jpg',
        notes: 'Delivered in good condition',
      });

    expect(podRes.status).toBe(200);
    expect(podRes.body.journey.status).toBe('completed');

    // Inspect DB state
    const completedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    const releasedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const releasedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });

    expect(completedJourney?.status).toBe('completed');
    expect(completedJourney?.end_odometer_kms).toBe(60450);

    // Truck released to available and odometer updated
    expect(releasedTruck?.status).toBe('available');
    expect(releasedTruck?.current_odometer_kms).toBe(60450);
    expect(releasedTruck?.current_driver_id).toBeUndefined();

    // Driver pointer cleared
    expect(releasedDriver?.current_truck_id).toBeUndefined();
    expect(releasedDriver?.status).toBe('active'); // Still active employee!

    // Verify historical closeout
    const lastTruckAssignment = releasedTruck?.driver_assignments[releasedTruck.driver_assignments.length - 1];
    const lastDriverAssignment = releasedDriver?.assignment_history[releasedDriver.assignment_history.length - 1];
    expect(lastTruckAssignment?.unassigned_at).toBeDefined();
    expect(lastDriverAssignment?.unassigned_at).toBeDefined();

    // Raw MongoDB check for $unset
    const rawDriver = await mongoose.connection.collection('drivers').findOne({ _id: driver._id });
    const rawTruck = await mongoose.connection.collection('trucks').findOne({ _id: truck._id });
    expect(rawDriver?.current_truck_id).toBeUndefined();
    expect(rawTruck?.current_driver_id).toBeUndefined();
  });

  it('3. Cancellation synchronizes allocation state safely', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0004',
      make: 'BharatBenz',
      model: '1617R',
      body_type: 'Container',
      tonnage_capacity: 16,
      status: 'on_trip',
      current_odometer_kms: 30000,
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Vijay Kumar',
      phone: '+919876500004',
      license_number: 'DL-MH-0004',
      status: 'active',
      current_truck_id: truck._id,
      assignment_history: [
        {
          truck_id: truck._id,
          assigned_at: new Date(),
          notes: 'Dispatched',
        },
      ],
    });

    truck.current_driver_id = driver._id;
    truck.driver_assignments = [
      {
        driver_id: driver._id,
        assigned_at: new Date(),
        notes: 'Dispatched',
      },
    ];
    await truck.save();

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver._id,
      journey_number: `JRN-${Date.now()}-4`,
      status: 'active',
      from_location: { city: 'Surat' },
      to_location: { city: 'Ahmedabad' },
      start_date: new Date(),
      start_odometer_kms: 30000,
      starting_cash_advance: 2500,
    });

    // Cancel journey
    const cancelRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip cancelled by customer due to shipment delay' });

    expect(cancelRes.status).toBe(200);

    const cancelledJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    const releasedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const releasedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });

    expect(cancelledJourney?.status).toBe('cancelled');
    expect(releasedTruck?.status).toBe('available');
    expect(releasedTruck?.current_driver_id).toBeUndefined();
    expect(releasedDriver?.current_truck_id).toBeUndefined();

    // Verify cancellation notes in assignment history
    const lastTruckAssignment = releasedTruck?.driver_assignments[releasedTruck.driver_assignments.length - 1];
    const lastDriverAssignment = releasedDriver?.assignment_history[releasedDriver.assignment_history.length - 1];
    expect(lastTruckAssignment?.unassigned_at).toBeDefined();
    expect(lastTruckAssignment?.notes).toMatch(/Cancelled/i);
    expect(lastDriverAssignment?.unassigned_at).toBeDefined();
    expect(lastDriverAssignment?.notes).toMatch(/Cancelled/i);
  });

  it('4. A successful driver swap records the complete handover audit trail', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0005',
      make: 'Tata',
      model: 'Signa 4825',
      body_type: 'Container',
      tonnage_capacity: 40,
      status: 'on_trip',
      current_odometer_kms: 80000,
    });

    const outgoingDriver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Sunil Gavaskar',
      phone: '+919876500005',
      license_number: 'DL-MH-0005',
      status: 'active',
      current_truck_id: truck._id,
      assignment_history: [
        {
          truck_id: truck._id,
          assigned_at: new Date(Date.now() - 7200000),
          notes: 'Dispatched initial driver',
        },
      ],
    });

    const incomingDriver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Kapil Dev',
      phone: '+919876500006',
      license_number: 'DL-MH-0006',
      status: 'active',
    });

    truck.current_driver_id = outgoingDriver._id;
    truck.driver_assignments = [
      {
        driver_id: outgoingDriver._id,
        assigned_at: new Date(Date.now() - 7200000),
        notes: 'Dispatched initial driver',
      },
    ];
    await truck.save();

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: outgoingDriver._id,
      journey_number: `JRN-${Date.now()}-5`,
      status: 'active',
      from_location: { city: 'Delhi' },
      to_location: { city: 'Kolkata' },
      start_date: new Date(Date.now() - 7200000),
      start_odometer_kms: 80000,
      starting_cash_advance: 15000,
    });

    // Execute swap as Company Admin
    const swapRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: incomingDriver._id.toString(),
        handover_odometer: 80650,
        reason: 'Outgoing driver Sunil reported acute fever at Kanpur checkpoint',
        notes: 'Medical certificate inspected by terminal dispatcher',
      });

    expect(swapRes.status).toBe(200);
    expect(swapRes.body.journey.driver_id.toString()).toBe(incomingDriver._id.toString());

    // Inspect DB records
    const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    const updatedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const updatedOutgoing = await Driver.findById(outgoingDriver._id, null, { skipTenantCheck: true });
    const updatedIncoming = await Driver.findById(incomingDriver._id, null, { skipTenantCheck: true });

    // Journey verification
    expect(updatedJourney?.driver_id.toString()).toBe(incomingDriver._id.toString());
    expect(updatedJourney?.driver_handover_history?.length).toBe(1);
    const handover = updatedJourney?.driver_handover_history?.[0];
    expect(handover?.outgoing_driver_id.toString()).toBe(outgoingDriver._id.toString());
    expect(handover?.incoming_driver_id.toString()).toBe(incomingDriver._id.toString());
    expect(handover?.handover_odometer).toBe(80650);
    expect(handover?.reason).toMatch(/acute fever/i);

    // Truck verification
    expect(updatedTruck?.current_driver_id?.toString()).toBe(incomingDriver._id.toString());
    expect(updatedTruck?.current_odometer_kms).toBe(80650);

    // Outgoing driver pointer cleared, incoming driver attached
    expect(updatedOutgoing?.current_truck_id).toBeUndefined();
    expect(updatedIncoming?.current_truck_id?.toString()).toBe(truck._id.toString());

    // Outgoing history closed, incoming history opened
    const outgoingLast = updatedOutgoing?.assignment_history[updatedOutgoing.assignment_history.length - 1];
    expect(outgoingLast?.unassigned_at).toBeDefined();
    expect(outgoingLast?.notes).toMatch(/Handover at 80650 km/);

    const incomingLast = updatedIncoming?.assignment_history[updatedIncoming.assignment_history.length - 1];
    expect(incomingLast?.truck_id.toString()).toBe(truck._id.toString());
    expect(incomingLast?.unassigned_at).toBeUndefined();

    // Audit log check
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
    const swapLog = auditLogs.find((l) => l.description.includes('Driver swap executed'));
    expect(swapLog).toBeDefined();
    expect(swapLog?.after_snapshot?.handover_odometer).toBe(80650);
  });

  it('5. Unauthorized users cannot perform a swap', async () => {
    const dispatcher = await createMemberInCompany(tenantA.company, 'dispatcher');

    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0006',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'on_trip',
      current_odometer_kms: 10000,
    });

    const driver1 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver One',
      phone: '+919876500007',
      license_number: 'DL-MH-0007',
      status: 'active',
      current_truck_id: truck._id,
    });

    const driver2 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Two',
      phone: '+919876500008',
      license_number: 'DL-MH-0008',
      status: 'active',
    });

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driver1._id,
      journey_number: `JRN-${Date.now()}-6`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_date: new Date(),
      start_odometer_kms: 10000,
      starting_cash_advance: 4000,
    });

    // Try swap with dispatcher token (not Company Admin)
    const swapRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/swap-driver`)
      .set('Authorization', `Bearer ${dispatcher.token}`)
      .send({
        incoming_driver_id: driver2._id.toString(),
        handover_odometer: 10050,
        reason: 'Attempted swap without admin permission',
      });

    expect(swapRes.status).toBe(403);

    // Verify DB untouched
    const journeyAfter = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    expect(journeyAfter?.driver_id.toString()).toBe(driver1._id.toString());
  });

  it('6. Invalid odometer values, missing justification, invalid journey states, and cross-tenant references are rejected', async () => {
    const truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0007',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'on_trip',
      current_odometer_kms: 40000,
    });

    const driverA1 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver A1',
      phone: '+919876500009',
      license_number: 'DL-MH-0009',
      status: 'active',
      current_truck_id: truckA._id,
    });

    const driverA2 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver A2',
      phone: '+919876500010',
      license_number: 'DL-MH-0010',
      status: 'active',
    });

    const activeJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA1._id,
      journey_number: `JRN-${Date.now()}-7`,
      status: 'active',
      from_location: { city: 'Indore' },
      to_location: { city: 'Bhopal' },
      start_date: new Date(),
      start_odometer_kms: 40000,
      starting_cash_advance: 3000,
    });

    // 6a: Handover odometer less than start odometer
    const resOdo = await request(app)
      .put(`/api/operations/journeys/${activeJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverA2._id.toString(),
        handover_odometer: 39500, // < 40000
        reason: 'Valid justification with at least 15 chars',
      });
    expect(resOdo.status).toBe(400);
    expect(resOdo.body.error).toMatch(/odometer/i);

    // 6b: Reason too short (< 15 chars)
    const resShortReason = await request(app)
      .put(`/api/operations/journeys/${activeJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverA2._id.toString(),
        handover_odometer: 40100,
        reason: 'Too short',
      });
    expect(resShortReason.status).toBe(400);
    expect(resShortReason.body.error).toMatch(/minimum 15 characters/i);

    // 6c: Swap on a completed journey
    const completedJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA1._id,
      journey_number: `JRN-${Date.now()}-7-comp`,
      status: 'completed',
      from_location: { city: 'Indore' },
      to_location: { city: 'Bhopal' },
      start_date: new Date(),
      start_odometer_kms: 40000,
      starting_cash_advance: 3000,
    });

    const resCompleted = await request(app)
      .put(`/api/operations/journeys/${completedJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverA2._id.toString(),
        handover_odometer: 40200,
        reason: 'Valid justification with at least 15 chars',
      });
    expect(resCompleted.status).toBe(400);
    expect(resCompleted.body.error).toMatch(/completed/i);

    // 6d: Cross-tenant incoming driver reference (Driver from Tenant B)
    const driverTenantB = await Driver.create({
      company_id: tenantB.company._id,
      name: 'Driver B Secret',
      phone: '+919876500011',
      license_number: 'DL-MH-0011',
      status: 'active',
    });

    const resCrossTenant = await request(app)
      .put(`/api/operations/journeys/${activeJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverTenantB._id.toString(),
        handover_odometer: 40200,
        reason: 'Valid justification with at least 15 chars',
      });
    expect(resCrossTenant.status).toBe(403);
    expect(resCrossTenant.body.error).toMatch(/Access denied/i);

    // 6e: Incoming driver who is on leave
    const driverOnLeave = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Leave',
      phone: '+919876500012',
      license_number: 'DL-MH-0012',
      status: 'on_leave',
    });

    const resOnLeave = await request(app)
      .put(`/api/operations/journeys/${activeJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverOnLeave._id.toString(),
        handover_odometer: 40200,
        reason: 'Valid justification with at least 15 chars',
      });
    expect(resOnLeave.status).toBe(400);
    expect(resOnLeave.body.error).toMatch(/on_leave/i);
  });

  it('7. Concurrent swaps or conflicting assignments cannot produce inconsistent pointers or duplicate active assignments', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0008',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'on_trip',
      current_odometer_kms: 70000,
    });

    const driverInitial = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver Initial',
      phone: '+919876500013',
      license_number: 'DL-MH-0013',
      status: 'active',
      current_truck_id: truck._id,
    });

    const driverCandidate1 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Candidate One',
      phone: '+919876500014',
      license_number: 'DL-MH-0014',
      status: 'active',
    });

    const driverCandidate2 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Candidate Two',
      phone: '+919876500015',
      license_number: 'DL-MH-0015',
      status: 'active',
    });

    truck.current_driver_id = driverInitial._id;
    truck.driver_assignments = [
      {
        driver_id: driverInitial._id,
        assigned_at: new Date(),
        notes: 'Initial assignment',
      },
    ];
    await truck.save();

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driverInitial._id,
      journey_number: `JRN-${Date.now()}-8`,
      status: 'active',
      from_location: { city: 'Chennai' },
      to_location: { city: 'Bengaluru' },
      start_date: new Date(),
      start_odometer_kms: 70000,
      starting_cash_advance: 6000,
    });

    // Fire 2 concurrent swap requests
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/api/operations/journeys/${journey._id}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverCandidate1._id.toString(),
          handover_odometer: 70150,
          reason: 'Concurrent swap request for candidate 1',
        }),
      request(app)
        .put(`/api/operations/journeys/${journey._id}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverCandidate2._id.toString(),
          handover_odometer: 70150,
          reason: 'Concurrent swap request for candidate 2',
        }),
    ]);

    // Inspect persisted database state
    const finalJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
    const finalTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const finalCandidate1 = await Driver.findById(driverCandidate1._id, null, { skipTenantCheck: true });
    const finalCandidate2 = await Driver.findById(driverCandidate2._id, null, { skipTenantCheck: true });

    // Invariant: Truck's current driver MUST match the journey's current driver
    expect(finalTruck?.current_driver_id?.toString()).toBe(finalJourney?.driver_id.toString());

    // Invariant: Truck has at most ONE active driver assignment
    const activeAssignments = finalTruck?.driver_assignments.filter((a) => !a.unassigned_at);
    expect(activeAssignments?.length).toBe(1);
    expect(activeAssignments?.[0].driver_id.toString()).toBe(finalTruck?.current_driver_id?.toString());

    // Exactly one driver points to the truck
    const c1Attached = finalCandidate1?.current_truck_id?.toString() === truck._id.toString();
    const c2Attached = finalCandidate2?.current_truck_id?.toString() === truck._id.toString();
    expect(c1Attached || c2Attached).toBe(true);
    // Cannot both be attached to the same truck simultaneously!
    expect(c1Attached && c2Attached).toBe(false);
  });

  it('8. Transaction failures leave no partial changes', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0009',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'on_trip',
      current_odometer_kms: 55000,
    });

    const driverOriginal = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Original Driver',
      phone: '+919876500016',
      license_number: 'DL-MH-0016',
      status: 'active',
      current_truck_id: truck._id,
      assignment_history: [
        {
          truck_id: truck._id,
          assigned_at: new Date(),
          notes: 'Dispatched',
        },
      ],
    });

    truck.current_driver_id = driverOriginal._id;
    truck.driver_assignments = [
      {
        driver_id: driverOriginal._id,
        assigned_at: new Date(),
        notes: 'Dispatched',
      },
    ];
    await truck.save();

    const journey = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truck._id,
      driver_id: driverOriginal._id,
      journey_number: `JRN-${Date.now()}-9`,
      status: 'active',
      from_location: { city: 'Jaipur' },
      to_location: { city: 'Agra' },
      start_date: new Date(),
      start_odometer_kms: 55000,
      starting_cash_advance: 2000,
    });

    // Provide a non-existent incoming driver ID that passes syntax validation
    const nonExistentId = new mongoose.Types.ObjectId().toString();

    const failedRes = await request(app)
      .put(`/api/operations/journeys/${journey._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: nonExistentId,
        handover_odometer: 55200,
        reason: 'Attempting swap with non-existent incoming driver ID',
      });

    expect(failedRes.status).toBe(404);

    // Verify DB integrity: everything remains intact as before the call
    const truckAfter = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const driverAfter = await Driver.findById(driverOriginal._id, null, { skipTenantCheck: true });
    const journeyAfter = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });

    expect(journeyAfter?.driver_id.toString()).toBe(driverOriginal._id.toString());
    expect(journeyAfter?.driver_handover_history?.length || 0).toBe(0);
    expect(truckAfter?.current_driver_id?.toString()).toBe(driverOriginal._id.toString());
    expect(driverAfter?.current_truck_id?.toString()).toBe(truck._id.toString());

    // Original driver assignment is still open
    const openDriverAssignment = driverAfter?.assignment_history.find((a) => !a.unassigned_at);
    expect(openDriverAssignment).toBeDefined();
  });

  it('9. Existing Batch A security and Batch B financial invariants remain intact', async () => {
    // Cross-tenant: Tenant B cannot swap driver on Tenant A's journey
    const truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12LC0010',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'on_trip',
      current_odometer_kms: 90000,
    });

    const driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver A Guarded',
      phone: '+919876500017',
      license_number: 'DL-MH-0017',
      status: 'active',
      current_truck_id: truckA._id,
    });

    const driverB = await Driver.create({
      company_id: tenantB.company._id,
      name: 'Driver B Invader',
      phone: '+919876500018',
      license_number: 'DL-MH-0018',
      status: 'active',
    });

    const journeyA = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-${Date.now()}-10`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Hyderabad' },
      start_date: new Date(),
      start_odometer_kms: 90000,
      starting_cash_advance: 8000,
    });

    // Tenant B calls swap on Journey A
    const tenantBSwapRes = await request(app)
      .put(`/api/operations/journeys/${journeyA._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({
        incoming_driver_id: driverB._id.toString(),
        handover_odometer: 90500,
        reason: 'Cross-tenant illegal takeover attempt',
      });

    expect(tenantBSwapRes.status).toBe(403);

    // Verify settled journey financial invariant: settled journey cannot be swapped
    const settledJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-${Date.now()}-10-settled`,
      status: 'active',
      is_settled: true,
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Hyderabad' },
      start_date: new Date(),
      start_odometer_kms: 90000,
      starting_cash_advance: 8000,
    });

    const driverA_Replacement = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Driver A Replacement',
      phone: '+919876500019',
      license_number: 'DL-MH-0019',
      status: 'active',
    });

    const settledSwapRes = await request(app)
      .put(`/api/operations/journeys/${settledJourney._id}/swap-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        incoming_driver_id: driverA_Replacement._id.toString(),
        handover_odometer: 90500,
        reason: 'Attempted swap on settled journey balance',
      });

    expect(settledSwapRes.status).toBe(400);
    expect(settledSwapRes.body.error).toMatch(/settled/i);
  });
});
