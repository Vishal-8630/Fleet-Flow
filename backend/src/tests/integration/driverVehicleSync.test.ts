/**
 * ============================================================================
 * FF-ISSUE-028 & FF-ISSUE-029 — DRIVER VEHICLE SYNC INTEGRATION TESTS
 * ============================================================================
 * 
 * Tests:
 * 1. Reassigning a truck clears the previous driver's pointer using MongoDB $unset.
 * 2. Unassignment clears both sides of the relationship (Truck and Driver).
 * 3. Assigning a driver who already has another truck reconciles both vehicles correctly.
 * 4. Concurrent conflicting assignments cannot leave inconsistent or dual pointers.
 * 5. Cross-tenant assignments and unassignments are rejected without modifying foreign records.
 * 6. Transaction failures leave no partially applied assignment changes (ACID rollback).
 * 7. Existing assignment-history semantics and timestamps are preserved.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { runInTransaction } from '../../utils/transactionHelper.js';

describe('FF-ISSUE-028 & FF-ISSUE-029: Driver-Vehicle Dual Pointer Sync & $unset Verification', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });
  });

  it('1. Reassigning a truck clears the previous driver pointer using explicit $unset in MongoDB', async () => {
    // Create 1 truck and 2 drivers for Tenant A
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1001',
      make: 'Tata',
      model: 'Signa 4825.TK',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
    });

    const driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Sameer Khan',
      phone: '+919876543210',
      license_number: 'DL1234567890101',
      status: 'active',
    });

    const driverB = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Rahul Singh',
      phone: '+919876543211',
      license_number: 'DL1234567890102',
      status: 'active',
    });

    // Step 1: Assign driverA to truck
    const res1 = await request(app)
      .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driverA._id.toString(), notes: 'Initial assignment to Sameer' });

    expect(res1.status).toBe(200);

    // Verify initial assignment in DB
    const truckAfter1 = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const driverAAfter1 = await Driver.findById(driverA._id, null, { skipTenantCheck: true });
    expect(truckAfter1?.current_driver_id?.toString()).toBe(driverA._id.toString());
    expect(driverAAfter1?.current_truck_id?.toString()).toBe(truck._id.toString());

    // Step 2: Reassign the truck to driverB (Rahul Singh)
    const res2 = await request(app)
      .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driverB._id.toString(), notes: 'Reassigned to Rahul' });

    expect(res2.status).toBe(200);

    // Verify truck now references driverB
    const truckAfter2 = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(truckAfter2?.current_driver_id?.toString()).toBe(driverB._id.toString());

    // Verify driverB references truck
    const driverBAfter2 = await Driver.findById(driverB._id, null, { skipTenantCheck: true });
    expect(driverBAfter2?.current_truck_id?.toString()).toBe(truck._id.toString());

    // CRITICAL CHECK FOR FF-ISSUE-028 & FF-ISSUE-029:
    // Verify driverA's current_truck_id is completely unset in MongoDB
    const driverAAfter2 = await Driver.findById(driverA._id, null, { skipTenantCheck: true });
    expect(driverAAfter2?.current_truck_id).toBeUndefined();

    // Raw MongoDB inspection to ensure field was actually removed via $unset
    const rawDriverA = await mongoose.connection.collection('drivers').findOne({ _id: driverA._id });
    expect(rawDriverA?.current_truck_id).toBeUndefined();

    // Verify assignment history on driverA shows ended assignment with unassigned_at timestamp
    expect(driverAAfter2?.assignment_history.length).toBe(1);
    expect(driverAAfter2?.assignment_history[0].truck_id.toString()).toBe(truck._id.toString());
    expect(driverAAfter2?.assignment_history[0].unassigned_at).toBeDefined();

    // Verify assignment history on truck shows previous driver unassigned and current driver active
    expect(truckAfter2?.driver_assignments.length).toBe(2);
    expect(truckAfter2?.driver_assignments[0].driver_id.toString()).toBe(driverA._id.toString());
    expect(truckAfter2?.driver_assignments[0].unassigned_at).toBeDefined();
    expect(truckAfter2?.driver_assignments[1].driver_id.toString()).toBe(driverB._id.toString());
    expect(truckAfter2?.driver_assignments[1].unassigned_at).toBeUndefined();

    // Verify driver status was NOT mutated (remains employment status: 'active')
    expect(driverAAfter2?.status).toBe('active');
    expect(driverBAfter2?.status).toBe('active');
  });

  it('2. Unassignment clears both sides of the relationship atomically', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1002',
      make: 'Ashok Leyland',
      model: 'Captain 40i',
      body_type: 'Container',
      tonnage_capacity: 40,
      status: 'available',
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Vikram Patel',
      phone: '+919876543220',
      license_number: 'DL1234567890201',
      status: 'active',
    });

    // Assign
    await request(app)
      .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driver._id.toString() });

    // Unassign
    const unassignRes = await request(app)
      .post(`/api/fleet/trucks/${truck._id}/unassign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send();

    expect(unassignRes.status).toBe(200);

    // Verify Truck side
    const updatedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(updatedTruck?.current_driver_id).toBeUndefined();
    const rawTruck = await mongoose.connection.collection('trucks').findOne({ _id: truck._id });
    expect(rawTruck?.current_driver_id).toBeUndefined();
    expect(updatedTruck?.driver_assignments[0].unassigned_at).toBeDefined();

    // Verify Driver side
    const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(updatedDriver?.current_truck_id).toBeUndefined();
    const rawDriver = await mongoose.connection.collection('drivers').findOne({ _id: driver._id });
    expect(rawDriver?.current_truck_id).toBeUndefined();
    expect(updatedDriver?.assignment_history[0].unassigned_at).toBeDefined();

    // Calling unassign again returns 400
    const secondUnassign = await request(app)
      .post(`/api/fleet/trucks/${truck._id}/unassign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send();

    expect(secondUnassign.status).toBe(400);
    expect(secondUnassign.body.error).toMatch(/no driver is currently assigned/i);
  });

  it('3. Assigning a driver who already has another truck reconciles both vehicles correctly', async () => {
    const truck1 = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1003',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
    });

    const truck2 = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1004',
      make: 'BharatBenz',
      model: '3528C',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Devendra Sharma',
      phone: '+919876543230',
      license_number: 'DL1234567890301',
      status: 'active',
    });

    // 1. Assign driver to truck1
    await request(app)
      .post(`/api/fleet/trucks/${truck1._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driver._id.toString() });

    // 2. Now assign driver to truck2
    const res = await request(app)
      .post(`/api/fleet/trucks/${truck2._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driver._id.toString() });

    expect(res.status).toBe(200);

    // Verify truck2 has driver
    const updatedTruck2 = await Truck.findById(truck2._id, null, { skipTenantCheck: true });
    expect(updatedTruck2?.current_driver_id?.toString()).toBe(driver._id.toString());

    // Verify driver references truck2
    const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(updatedDriver?.current_truck_id?.toString()).toBe(truck2._id.toString());

    // Verify truck1 was atomically detached and unset
    const updatedTruck1 = await Truck.findById(truck1._id, null, { skipTenantCheck: true });
    expect(updatedTruck1?.current_driver_id).toBeUndefined();
    const rawTruck1 = await mongoose.connection.collection('trucks').findOne({ _id: truck1._id });
    expect(rawTruck1?.current_driver_id).toBeUndefined();
    expect(updatedTruck1?.driver_assignments[0].unassigned_at).toBeDefined();

    // Verify driver's assignment history has both entries
    expect(updatedDriver?.assignment_history.length).toBe(2);
    expect(updatedDriver?.assignment_history[0].truck_id.toString()).toBe(truck1._id.toString());
    expect(updatedDriver?.assignment_history[0].unassigned_at).toBeDefined();
    expect(updatedDriver?.assignment_history[1].truck_id.toString()).toBe(truck2._id.toString());
    expect(updatedDriver?.assignment_history[1].unassigned_at).toBeUndefined();
  });

  it('4. Concurrent conflicting assignments cannot leave inconsistent pointers', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1005',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 28,
      status: 'available',
    });

    const driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Concurrent Driver A',
      phone: '+919876543241',
      license_number: 'DL1234567890401',
      status: 'active',
    });

    const driverB = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Concurrent Driver B',
      phone: '+919876543242',
      license_number: 'DL1234567890402',
      status: 'active',
    });

    // Fire two conflicting assignment requests simultaneously
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ driverId: driverA._id.toString() }),
      request(app)
        .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ driverId: driverB._id.toString() }),
    ]);

    // Both requests must complete cleanly with HTTP 200 (serial or retry)
    expect([200]).toContain(resA.status);
    expect([200]).toContain(resB.status);

    // Verify MongoDB state: exactly one driver is assigned
    const finalTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const finalDriverA = await Driver.findById(driverA._id, null, { skipTenantCheck: true });
    const finalDriverB = await Driver.findById(driverB._id, null, { skipTenantCheck: true });

    const activeDriverId = finalTruck?.current_driver_id?.toString();
    expect([driverA._id.toString(), driverB._id.toString()]).toContain(activeDriverId);

    if (activeDriverId === driverA._id.toString()) {
      expect(finalDriverA?.current_truck_id?.toString()).toBe(truck._id.toString());
      expect(finalDriverB?.current_truck_id).toBeUndefined();
    } else {
      expect(finalDriverB?.current_truck_id?.toString()).toBe(truck._id.toString());
      expect(finalDriverA?.current_truck_id).toBeUndefined();
    }
  });

  it('5. Cross-tenant assignments and unassignments are rejected without modifying foreign records', async () => {
    const truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1006',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Open',
      tonnage_capacity: 10,
      status: 'available',
    });

    const driverB = await Driver.create({
      company_id: tenantB.company._id,
      name: 'Beta Driver',
      phone: '+919876543250',
      license_number: 'DL1234567890501',
      status: 'active',
    });

    const truckB = await Truck.create({
      company_id: tenantB.company._id,
      truck_no: 'WB01CD2001',
      make: 'Ashok Leyland',
      model: 'Boss',
      body_type: 'Open',
      tonnage_capacity: 12,
      status: 'available',
    });

    // 1. Tenant A tries to assign Tenant B's driver to Tenant A's truck
    const crossAssignRes1 = await request(app)
      .post(`/api/fleet/trucks/${truckA._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driverB._id.toString() });

    expect(crossAssignRes1.status).toBe(403);
    expect(crossAssignRes1.body.error).toMatch(/workspace/i);

    // Verify no modification occurred
    const checkTruckA = await Truck.findById(truckA._id, null, { skipTenantCheck: true });
    const checkDriverB = await Driver.findById(driverB._id, null, { skipTenantCheck: true });
    expect(checkTruckA?.current_driver_id).toBeUndefined();
    expect(checkDriverB?.current_truck_id).toBeUndefined();

    // 2. Tenant A tries to assign to Tenant B's truck
    const crossAssignRes2 = await request(app)
      .post(`/api/fleet/trucks/${truckB._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driverB._id.toString() });

    expect(crossAssignRes2.status).toBe(403);
    expect(crossAssignRes2.body.error).toMatch(/workspace/i);

    // 3. Tenant A tries to unassign Tenant B's truck
    const crossUnassignRes = await request(app)
      .post(`/api/fleet/trucks/${truckB._id}/unassign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send();

    expect(crossUnassignRes.status).toBe(403);
    expect(crossUnassignRes.body.error).toMatch(/workspace/i);
  });

  it('6. Transaction failures leave no partially applied assignment changes', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1007',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 15,
      status: 'available',
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Rollback Driver',
      phone: '+919876543260',
      license_number: 'DL1234567890601',
      status: 'active',
    });

    // Attempt a transaction that modifies truck and then deliberately throws an error
    let errorCaught = false;
    try {
      await runInTransaction(async (session) => {
        // Step A: Modify truck inside transaction
        await Truck.updateOne(
          { _id: truck._id, company_id: tenantA.company._id },
          { current_driver_id: driver._id },
          { session }
        );

        // Step B: Deliberately abort
        throw new Error('Simulated atomic transaction failure');
      });
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toBe('Simulated atomic transaction failure');
    }

    expect(errorCaught).toBe(true);

    // Assert that truck.current_driver_id was rolled back in MongoDB
    const postRollbackTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(postRollbackTruck?.current_driver_id).toBeUndefined();

    const postRollbackDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(postRollbackDriver?.current_truck_id).toBeUndefined();
  });

  it('7. Existing assignment-history semantics and timestamps are preserved', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1008',
      make: 'Eicher',
      model: 'Pro 3019',
      body_type: 'Container',
      tonnage_capacity: 19,
      status: 'available',
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Historical Driver',
      phone: '+919876543270',
      license_number: 'DL1234567890701',
      status: 'active',
    });

    // Assign with custom note
    const assignRes = await request(app)
      .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driver._id.toString(), notes: 'Assigned for Delhi-Mumbai corridor' });

    expect(assignRes.status).toBe(200);

    const savedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    const savedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });

    expect(savedTruck?.driver_assignments.length).toBe(1);
    expect(savedTruck?.driver_assignments[0].notes).toBe('Assigned for Delhi-Mumbai corridor');
    expect(savedTruck?.driver_assignments[0].assigned_at).toBeInstanceOf(Date);
    expect(savedTruck?.driver_assignments[0].unassigned_at).toBeUndefined();

    expect(savedDriver?.assignment_history.length).toBe(1);
    expect(savedDriver?.assignment_history[0].notes).toBe('Assigned for Delhi-Mumbai corridor');
    expect(savedDriver?.assignment_history[0].assigned_at).toBeInstanceOf(Date);
    expect(savedDriver?.assignment_history[0].unassigned_at).toBeUndefined();
  });

  it('8. Deleting a truck closes open driver and truck assignment history and unsets current_truck_id', async () => {
    const truck = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH12AB1009',
      make: 'Tata',
      model: 'Signa',
      body_type: 'Container',
      tonnage_capacity: 16,
      status: 'available',
    });

    const driver = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Decommissioned Driver',
      phone: '+919876543280',
      license_number: 'DL1234567890801',
      status: 'active',
    });

    // Assign driver to truck
    await request(app)
      .post(`/api/fleet/trucks/${truck._id}/assign-driver`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ driverId: driver._id.toString() });

    // Soft-delete truck
    const deleteRes = await request(app)
      .delete(`/api/fleet/trucks/${truck._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send();

    expect(deleteRes.status).toBe(200);

    // Verify truck state
    const deletedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
    expect(deletedTruck?.is_deleted).toBe(true);
    expect(deletedTruck?.status).toBe('decommissioned');
    expect(deletedTruck?.current_driver_id).toBeUndefined();
    expect(deletedTruck?.driver_assignments[0].unassigned_at).toBeInstanceOf(Date);

    // Verify driver state
    const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
    expect(updatedDriver?.current_truck_id).toBeUndefined();
    const rawDriver = await mongoose.connection.collection('drivers').findOne({ _id: driver._id });
    expect(rawDriver?.current_truck_id).toBeUndefined();
    expect(updatedDriver?.assignment_history[0].unassigned_at).toBeInstanceOf(Date);
  });
});
