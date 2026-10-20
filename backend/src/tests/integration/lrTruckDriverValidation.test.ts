/**
 * ============================================================================
 * LR TRUCK & DRIVER MANDATORY VALIDATION INTEGRATION TESTS (Phase 1 Baseline)
 * ============================================================================
 * 
 * Verifies:
 * 1. Mandatory truck_id and driver_id on every new Lorry Receipt (LR / Bilty).
 * 2. Strict ObjectId format validation.
 * 3. Cross-tenant anti-IDOR validation for truck_id and driver_id.
 * 4. Master asset eligibility (rejection of decommissioned trucks, terminated or on-leave drivers).
 * 5. Two-stage compliance: advisory booking warning (COMPLIANCE_EXPIRED) without blocking booking.
 * 6. Authoritative master snapshot population (anti-tampering of vehicle_number, driver_name, driver_phone).
 * 7. Originating trip prefill and consistency validation (TRIP_TRUCK_MISMATCH, TRIP_DRIVER_MISMATCH).
 * 8. Populated asset details on LR list and single-item retrieval endpoints.
 * 9. Historical LR backward compatibility (clean hydration, operational updates, and upgrade workflow).
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { BillingParty } from '../../models/BillingParty.js';
import { Branch } from '../../models/Branch.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase 1: LR Truck & Driver References and Validation', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let customerA: any;
  let branchA: any;
  let truckA: any;
  let driverA: any;
  let truckB: any;
  let driverB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });

    branchA = await Branch.create({
      company_id: tenantA.company._id,
      branch_name: 'Mumbai Central Hub',
      branch_code: 'BOM',
      is_active: true,
      is_head_office: true,
      city: 'Mumbai',
      state: 'Maharashtra',
    });

    customerA = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Reliance Logistics Ltd',
      gstin: '27AAACR1234A1Z5',
      address: 'Nariman Point, Mumbai',
      status: 'active',
      credit_limit: 5000000,
      enforce_credit_limit: false,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Signa 4825.TK',
      body_type: 'Container',
      tonnage_capacity: 30,
      status: 'available',
      fitness_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      insurance_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      national_permit_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      puc_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Ramesh Patil',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `MH04${Math.floor(1000000 + Math.random() * 9000000)}`,
      license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'active',
    });

    // Cross-tenant assets for tenantB
    truckB = await Truck.create({
      company_id: tenantB.company._id,
      truck_no: `DL01AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Ashok Leyland',
      model: 'Captain 3118',
      body_type: 'Open',
      tonnage_capacity: 25,
      status: 'available',
    });

    driverB = await Driver.create({
      company_id: tenantB.company._id,
      name: 'Harpreet Singh',
      phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL01${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'active',
    });
  });

  function makeBaseEntryPayload(overrides: Record<string, any> = {}) {
    return {
      billing_party_id: customerA._id.toString(),
      branch_id: branchA._id.toString(),
      truck_id: truckA._id.toString(),
      driver_id: driverA._id.toString(),
      from_location: 'Mumbai',
      to_location: 'Pune',
      goods_description: 'Industrial Bearings',
      package_count: 50,
      packaging_type: 'Boxes',
      actual_weight_tonnes: 10,
      chargeable_weight_tonnes: 10,
      freight_amount: 30000,
      consignor: { name: 'Tata Steel Ltd', phone: '+919876543210' },
      consignee: { name: 'Bharat Forge Ltd', phone: '+919876543211' },
      ...overrides,
    };
  }

  // ==========================================================================
  // 1. Mandatory Reference Validation & ID Formatting
  // ==========================================================================
  describe('1. Mandatory Reference Validation & ID Formatting', () => {
    it('rejects LR creation when truck_id is omitted with HTTP 400 TRUCK_REQUIRED', async () => {
      const payload = makeBaseEntryPayload();
      delete payload.truck_id;

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRUCK_REQUIRED');
      expect(res.body.error).toMatch(/registered commercial vehicle is mandatory/i);
    });

    it('rejects LR creation when driver_id is omitted with HTTP 400 DRIVER_REQUIRED', async () => {
      const payload = makeBaseEntryPayload();
      delete payload.driver_id;

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_REQUIRED');
      expect(res.body.error).toMatch(/registered professional driver is mandatory/i);
    });

    it('rejects LR creation when truck_id is an invalid ObjectId format', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ truck_id: 'invalid-id-format' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRUCK_REQUIRED');
    });

    it('rejects LR creation when driver_id is an invalid ObjectId format', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ driver_id: 'invalid-id-format' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_REQUIRED');
    });
  });

  // ==========================================================================
  // 2. Tenant Isolation & Anti-IDOR Enforcement
  // ==========================================================================
  describe('2. Tenant Isolation & Anti-IDOR Enforcement', () => {
    it('rejects LR creation with HTTP 403 when truck_id belongs to another tenant', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ truck_id: truckB._id.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid vehicle reference/i);
      expect(res.body.entityType).toBe('Truck');
    });

    it('rejects LR creation with HTTP 403 when driver_id belongs to another tenant', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ driver_id: driverB._id.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid driver reference/i);
      expect(res.body.entityType).toBe('Driver');
    });

    it('rejects LR creation with HTTP 403 when truck does not exist (Anti-IDOR)', async () => {
      const nonExistentTruckId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ truck_id: nonExistentTruckId.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid vehicle reference/i);
    });

    it('rejects LR creation with HTTP 403 when driver does not exist (Anti-IDOR)', async () => {
      const nonExistentDriverId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload({ driver_id: nonExistentDriverId.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid driver reference/i);
    });
  });

  // ==========================================================================
  // 3. Asset Master Eligibility Rules
  // ==========================================================================
  describe('3. Asset Master Eligibility Rules', () => {
    it('rejects decommissioned vehicle with HTTP 400 TRUCK_INELIGIBLE', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await Truck.updateOne({ _id: truckA._id }, { $set: { status: 'decommissioned' } });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRUCK_INELIGIBLE');
      expect(res.body.error).toContain('is decommissioned and cannot be assigned');
    });

    it('rejects terminated driver with HTTP 400 DRIVER_INELIGIBLE', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await Driver.updateOne({ _id: driverA._id }, { $set: { status: 'terminated' } });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_INELIGIBLE');
      expect(res.body.error).toContain('is terminated and cannot be assigned');
    });

    it('rejects driver on leave with HTTP 400 DRIVER_ON_LEAVE', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await Driver.updateOne({ _id: driverA._id }, { $set: { status: 'on_leave' } });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_ON_LEAVE');
      expect(res.body.error).toContain('is currently on leave and cannot be assigned');
    });
  });

  // ==========================================================================
  // 4. Two-Stage Compliance Distinction (Booking Warning vs Dispatch Gate)
  // ==========================================================================
  describe('4. Two-Stage Compliance Distinction (Booking Warning vs Dispatch Gate)', () => {
    it('permits LR booking with advisory warning COMPLIANCE_EXPIRED when certificates are expired', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await Truck.updateOne(
          { _id: truckA._id },
          { $set: { fitness_doc: { expiry_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }
        );
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());

      // Booking must succeed (HTTP 201) with non-blocking advisory warning
      expect(res.status).toBe(201);
      expect(res.body.entry).toBeDefined();
      expect(res.body.warning).toBeDefined();
      expect(res.body.warning.code).toBe('COMPLIANCE_EXPIRED');
      expect(res.body.warning.message).toContain('expired statutory documents');
    });

    it('returns no compliance warning when all certificates are active and valid', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());

      expect(res.status).toBe(201);
      expect(res.body.entry).toBeDefined();
      expect(res.body.warning).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. Authoritative Snapshot Population & Anti-Tampering
  // ==========================================================================
  describe('5. Authoritative Snapshot Population & Anti-Tampering', () => {
    it('overwrites client-spoofed vehicle_number, driver_name, and driver_phone with master records', async () => {
      const spoofedPayload = makeBaseEntryPayload({
        vehicle_number: 'FAKE-VEHICLE-999',
        driver_name: 'Imposter Driver',
        driver_phone: '+919999999999',
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(spoofedPayload);

      expect(res.status).toBe(201);
      const createdEntry = res.body.entry;

      // Must strictly match master records, completely ignoring spoofed strings
      expect(createdEntry.vehicle_number).toBe(truckA.truck_no);
      expect(createdEntry.driver_name).toBe(driverA.name);
      expect(createdEntry.driver_phone).toBe(driverA.phone);

      // Verify directly from database
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const persisted = await Entry.findById(createdEntry._id);
        expect(persisted).toBeDefined();
        expect(persisted!.vehicle_number).toBe(truckA.truck_no);
        expect(persisted!.driver_name).toBe(driverA.name);
        expect(persisted!.driver_phone).toBe(driverA.phone);
        expect(persisted!.truck_id?.toString()).toBe(truckA._id.toString());
        expect(persisted!.driver_id?.toString()).toBe(driverA._id.toString());
      });
    });
  });

  // ==========================================================================
  // 6. Originating Trip Consistency & Prefill
  // ==========================================================================
  describe('6. Originating Trip Consistency & Prefill', () => {
    let tripA: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        tripA = await TruckJourney.create({
          company_id: tenantA.company._id,
          branch_id: branchA._id,
          journey_number: 'TRIP-ALPHA-01',
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'internal_repositioning',
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Pune', state: 'Maharashtra' },
          start_odometer_kms: 12000,
          status: 'draft',
        });
      });
    });

    it('auto-prefills truck_id and driver_id from originating trip when omitted from payload', async () => {
      const payload = makeBaseEntryPayload({
        journey_id: tripA._id.toString(),
      });
      delete payload.truck_id;
      delete payload.driver_id;

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.entry.journey_id).toBe(tripA._id.toString());
      expect(res.body.entry.truck_id._id).toBe(truckA._id.toString());
      expect(res.body.entry.driver_id._id).toBe(driverA._id.toString());
      expect(res.body.entry.vehicle_number).toBe(truckA.truck_no);
      expect(res.body.entry.driver_name).toBe(driverA.name);
    });

    it('rejects creation with HTTP 400 TRIP_TRUCK_MISMATCH when explicit truck differs from trip', async () => {
      let otherTruck: any;
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        otherTruck = await Truck.create({
          company_id: tenantA.company._id,
          truck_no: `MH04XY${Math.floor(1000 + Math.random() * 9000)}`,
          make: 'Eicher',
          model: 'Pro 6028',
          body_type: 'Open',
          tonnage_capacity: 20,
          status: 'available',
        });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(
          makeBaseEntryPayload({
            journey_id: tripA._id.toString(),
            truck_id: otherTruck._id.toString(),
          })
        );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRIP_TRUCK_MISMATCH');
      expect(res.body.error).toContain("does not match originating trip's assigned vehicle");
    });

    it('rejects creation with HTTP 400 TRIP_DRIVER_MISMATCH when explicit driver differs from trip', async () => {
      let otherDriver: any;
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        otherDriver = await Driver.create({
          company_id: tenantA.company._id,
          name: 'Sunil Jadhav',
          phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
          license_number: `MH04${Math.floor(1000000 + Math.random() * 9000000)}`,
          status: 'active',
        });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(
          makeBaseEntryPayload({
            journey_id: tripA._id.toString(),
            driver_id: otherDriver._id.toString(),
          })
        );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRIP_DRIVER_MISMATCH');
      expect(res.body.error).toContain("does not match originating trip's assigned driver");
    });

    it('rejects cross-tenant originating trip with HTTP 404 JOURNEY_NOT_FOUND', async () => {
      let tripB: any;
      await tenantStorage.run({ companyId: tenantB.company._id.toString() }, async () => {
        tripB = await TruckJourney.create({
          company_id: tenantB.company._id,
          journey_number: 'TRIP-BETA-01',
          truck_id: truckB._id,
          driver_id: driverB._id,
          journey_type: 'internal_repositioning',
          from_location: { city: 'Delhi', state: 'Delhi' },
          to_location: { city: 'Jaipur', state: 'Rajasthan' },
          start_odometer_kms: 25000,
          status: 'draft',
        });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(
          makeBaseEntryPayload({
            journey_id: tripB._id.toString(),
          })
        );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('JOURNEY_NOT_FOUND');
    });
  });

  // ==========================================================================
  // 7. LR Retrieval Details Population
  // ==========================================================================
  describe('7. LR Retrieval Details Population', () => {
    let createdEntryId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeBaseEntryPayload());
      expect(res.status).toBe(201);
      createdEntryId = res.body.entry._id;
    });

    it('populates truck_id and driver_id on GET /api/commercial/entries', async () => {
      const res = await request(app)
        .get('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeGreaterThan(0);
      const match = res.body.entries.find((e: any) => e._id === createdEntryId);
      expect(match).toBeDefined();

      expect(match.truck_id).toBeDefined();
      expect(match.truck_id.truck_no).toBe(truckA.truck_no);
      expect(match.truck_id.make).toBe(truckA.make);
      expect(match.truck_id.tonnage_capacity).toBe(truckA.tonnage_capacity);

      expect(match.driver_id).toBeDefined();
      expect(match.driver_id.name).toBe(driverA.name);
      expect(match.driver_id.phone).toBe(driverA.phone);
    });

    it('populates truck_id and driver_id on GET /api/commercial/entries/:id', async () => {
      const res = await request(app)
        .get(`/api/commercial/entries/${createdEntryId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.truck_id).toBeDefined();
      expect(res.body.entry.truck_id.truck_no).toBe(truckA.truck_no);
      expect(res.body.entry.driver_id).toBeDefined();
      expect(res.body.entry.driver_id.name).toBe(driverA.name);
    });

    it('returns populated vehicle and driver details on GET /api/commercial/entries/:id/print', async () => {
      const res = await request(app)
        .get(`/api/commercial/entries/${createdEntryId}/print`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.lr).toBeDefined();
      expect(res.body.lr.truck_id).toBeDefined();
      expect(res.body.lr.truck_id.truck_no).toBe(truckA.truck_no);
      expect(res.body.lr.driver_id).toBeDefined();
      expect(res.body.lr.driver_id.name).toBe(driverA.name);
    });
  });

  // ==========================================================================
  // 8. Historical LR Compatibility & Upgrade Workflow
  // ==========================================================================
  describe('8. Historical LR Compatibility & Upgrade Workflow', () => {
    let historicalEntry: any;

    beforeEach(async () => {
      // Simulate historical LR created directly in DB without truck_id, driver_id, driver_name, driver_phone
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        historicalEntry = await Entry.create({
          company_id: tenantA.company._id,
          branch_id: branchA._id,
          billing_party_id: customerA._id,
          bill_no: 'BILL-HIST-001',
          lr_no: 'HIST-LR-001',
          from_location: 'Mumbai',
          to_location: 'Goa',
          vehicle_number: 'MH01-OLD-9999',
          consignor: { name: 'Tata Steel Ltd', phone: '+919876543210' },
          consignee: { name: 'Goa Metal Corp', phone: '+919876543211' },
          goods_description: 'Historical Consignment Goods',
          package_count: 20,
          packaging_type: 'Bags',
          actual_weight_tonnes: 5,
          chargeable_weight_tonnes: 5,
          freight_amount: 15000,
          status: 'active',
        });
      });
    });

    it('hydrates historical LR cleanly without Mongoose schema errors', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const found = await Entry.findById(historicalEntry._id);
        expect(found).toBeDefined();
        expect(found!.truck_id).toBeUndefined();
        expect(found!.driver_id).toBeUndefined();
        expect(found!.vehicle_number).toBe('MH01-OLD-9999');
      });
    });

    it('retrieves historical LR via API without crashing', async () => {
      const res = await request(app)
        .get(`/api/commercial/entries/${historicalEntry._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.lr_no).toBe('HIST-LR-001');
      expect(res.body.entry.vehicle_number).toBe('MH01-OLD-9999');
      expect(res.body.entry.truck_id).toBeUndefined();
      expect(res.body.entry.driver_id).toBeUndefined();
    });

    it('allows routine operational updates to historical LR without schema validation failure', async () => {
      const res = await request(app)
        .put(`/api/commercial/entries/${historicalEntry._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          goods_description: 'Updated Historical Goods',
          package_count: 25,
        });

      expect(res.status).toBe(200);
      expect(res.body.entry.goods_description).toBe('Updated Historical Goods');
      expect(res.body.entry.package_count).toBe(25);
    });

    it('upgrades historical LR with registered truck and driver references and synchronizes snapshots', async () => {
      const res = await request(app)
        .put(`/api/commercial/entries/${historicalEntry._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id.toString(),
          driver_id: driverA._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.entry.truck_id._id).toBe(truckA._id.toString());
      expect(res.body.entry.driver_id._id).toBe(driverA._id.toString());
      expect(res.body.entry.vehicle_number).toBe(truckA.truck_no);
      expect(res.body.entry.driver_name).toBe(driverA.name);
      expect(res.body.entry.driver_phone).toBe(driverA.phone);

      // Verify in database
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const updatedInDb = await Entry.findById(historicalEntry._id);
        expect(updatedInDb!.truck_id?.toString()).toBe(truckA._id.toString());
        expect(updatedInDb!.driver_id?.toString()).toBe(driverA._id.toString());
        expect(updatedInDb!.vehicle_number).toBe(truckA.truck_no);
        expect(updatedInDb!.driver_name).toBe(driverA.name);
        expect(updatedInDb!.driver_phone).toBe(driverA.phone);
      });
    });
  });
});
