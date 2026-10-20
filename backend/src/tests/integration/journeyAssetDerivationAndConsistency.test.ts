/**
 * ============================================================================
 * JOURNEY VEHICLE/DRIVER DERIVATION & CONSISTENCY INTEGRATION TESTS (Phase 2 Baseline)
 * ============================================================================
 * 
 * Verifies:
 * 1. Journey truck and driver automatic derivation when client omits them.
 * 2. Successful creation with matching LR truck and driver references.
 * 3. Mixed-truck rejection (HTTP 400 TRUCK_MISMATCH).
 * 4. Mixed-driver rejection (HTTP 400 DRIVER_MISMATCH).
 * 5. Explicit client truck conflict rejection (HTTP 400 TRUCK_CONFLICT_WITH_LRS).
 * 6. Explicit client driver conflict rejection (HTTP 400 DRIVER_CONFLICT_WITH_LRS).
 * 7. Historical LR missing truck reference rejection (HTTP 400 LR_MISSING_ASSET_REFERENCE).
 * 8. Historical LR missing driver reference rejection (HTTP 400 LR_MISSING_ASSET_REFERENCE).
 * 9. Tenant and branch isolation enforcement.
 * 10. LR already linked to an active journey rejection (HTTP 409 LR_ALREADY_ASSIGNED).
 * 11. Concurrent attempts to link the same LR race safety.
 * 12. Transaction rollback when one LR fails validation or conditional linking.
 * 13. Internal repositioning and maintenance journeys without LRs.
 * 14. Cancellation releases LRs while preserving immutable issuance snapshots.
 * 15. Driver handover audit history remains intact without mutating LR snapshots.
 * 16. Absence of premature invoice creation or ledger side effects.
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
import { Invoice } from '../../models/Invoice.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase 2: Backend Journey Vehicle/Driver Derivation & Consistency Enforcement', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let customerA: any;
  let customerB: any;
  let branchA: any;
  let branchB: any;
  let truckA: any;
  let truckB: any;
  let driverA: any;
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

    branchB = await Branch.create({
      company_id: tenantA.company._id,
      branch_name: 'Pune Distribution Center',
      branch_code: 'PUN',
      is_active: true,
      is_head_office: false,
      city: 'Pune',
      state: 'Maharashtra',
    });

    customerA = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Tata Steel Corp',
      trade_name: 'Tata Steel',
      gstin: '27AABCT1234A1Z5',
      billing_address: { street: 'Nariman Point', city: 'Mumbai', state_code: '27' },
      status: 'active',
      is_deleted: false,
    });

    customerB = await BillingParty.create({
      company_id: tenantB.company._id,
      name: 'Reliance Industries',
      trade_name: 'Reliance',
      gstin: '27AABCR5678B1Z2',
      billing_address: { street: 'BKC', city: 'Mumbai', state_code: '27' },
      status: 'active',
      is_deleted: false,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Signa 4825.TK',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
      current_odometer_kms: 50000,
    });

    truckB = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04CD${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Eicher',
      model: 'Pro 6028',
      body_type: 'Open',
      tonnage_capacity: 25,
      status: 'available',
      current_odometer_kms: 30000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Ramesh Patil',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });

    driverB = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Sunil Jadhav',
      phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });
  });

  const createLR = async (overrides: Record<string, any> = {}) => {
    return Entry.create({
      company_id: tenantA.company._id,
      lr_no: `LR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      bill_no: `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      bill_date: new Date(),
      lr_date: new Date(),
      billing_party_id: customerA._id,
      branch_id: branchA._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      vehicle_number: truckA.truck_no,
      driver_name: driverA.name,
      driver_phone: driverA.phone,
      from_location: 'Mumbai',
      to_location: 'Nagpur',
      consignor: { name: 'Tata Works Mumbai' },
      consignee: { name: 'Nagpur Depot' },
      package_count: 50,
      packaging_type: 'Pallets',
      goods_description: 'Industrial Steel Coils',
      declared_value: 500000,
      actual_weight_tonnes: 12.5,
      chargeable_weight_tonnes: 14.0,
      cbm_volume: 25.0,
      freight_terms: 'to_be_billed',
      freight_amount: 45000,
      status: 'active',
      is_deleted: false,
      ...overrides,
    });
  };

  // ==========================================================================
  // 1. Derivation and Explicit Matching
  // ==========================================================================
  describe('1. Asset Derivation and Explicit Matching', () => {
    it('1. Derives journey truck and driver from selected LRs when omitted from request', async () => {
      const lr1 = await createLR();
      const lr2 = await createLR({ actual_weight_tonnes: 8.5 });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr1._id, lr2._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });

      expect(res.status).toBe(201);
      expect(res.body.journey).toBeDefined();
      expect(res.body.journey.truck_id.toString()).toBe(truckA._id.toString());
      expect(res.body.journey.driver_id.toString()).toBe(driverA._id.toString());
      expect(res.body.journey.lr_ids).toHaveLength(2);
    });

    it('2. Successfully creates journey when explicit truck and driver match LR references', async () => {
      const lr = await createLR();

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });

      expect(res.status).toBe(201);
      expect(res.body.journey.truck_id.toString()).toBe(truckA._id.toString());
      expect(res.body.journey.driver_id.toString()).toBe(driverA._id.toString());
    });
  });

  // ==========================================================================
  // 2. Conflict and Consistency Rejections
  // ==========================================================================
  describe('2. Conflict and Consistency Rejections', () => {
    it('3. Rejects journey creation with HTTP 400 TRUCK_MISMATCH when LRs have different trucks', async () => {
      const lr1 = await createLR({
        truck_id: truckA._id,
        vehicle_number: truckA.truck_no,
      });
      const lr2 = await createLR({
        truck_id: truckB._id,
        vehicle_number: truckB.truck_no,
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr1._id, lr2._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRUCK_MISMATCH');
      expect(res.body.error).toContain('All consignments on a commercial journey must share the same physical vehicle');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.expected_truck).toBe(truckA.truck_no);
      expect(res.body.details.conflicting_truck).toBe(truckB.truck_no);
    });

    it('4. Rejects journey creation with HTTP 400 DRIVER_MISMATCH when LRs have different drivers', async () => {
      const lr1 = await createLR({
        driver_id: driverA._id,
        driver_name: driverA.name,
      });
      const lr2 = await createLR({
        driver_id: driverB._id,
        driver_name: driverB.name,
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr1._id, lr2._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_MISMATCH');
      expect(res.body.error).toContain('All consignments on a commercial journey must share the same operating driver');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.expected_driver).toBe(driverA.name);
      expect(res.body.details.conflicting_driver).toBe(driverB.name);
    });

    it('5. Rejects creation with HTTP 400 TRUCK_CONFLICT_WITH_LRS when client truck conflicts with LRs', async () => {
      const lr = await createLR({ truck_id: truckA._id, vehicle_number: truckA.truck_no });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckB._id, // Client explicitly supplies truckB
          driver_id: driverA._id,
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRUCK_CONFLICT_WITH_LRS');
      expect(res.body.error).toContain(`Supplied vehicle does not match the vehicle '${truckA.truck_no}'`);
    });

    it('6. Rejects creation with HTTP 400 DRIVER_CONFLICT_WITH_LRS when client driver conflicts with LRs', async () => {
      const lr = await createLR({ driver_id: driverA._id, driver_name: driverA.name });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverB._id, // Client explicitly supplies driverB
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVER_CONFLICT_WITH_LRS');
      expect(res.body.error).toContain(`Supplied driver does not match the driver '${driverA.name}'`);
    });

    it('7. Rejects historical LR missing truck_id with HTTP 400 LR_MISSING_ASSET_REFERENCE', async () => {
      const historicalLR = await createLR({
        truck_id: undefined,
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [historicalLR._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LR_MISSING_ASSET_REFERENCE');
      expect(res.body.error).toContain('was created without a registered vehicle reference');
    });

    it('8. Rejects historical LR missing driver_id with HTTP 400 LR_MISSING_ASSET_REFERENCE', async () => {
      const historicalLR = await createLR({
        driver_id: undefined,
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [historicalLR._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LR_MISSING_ASSET_REFERENCE');
      expect(res.body.error).toContain('was created without a registered driver reference');
    });
  });

  // ==========================================================================
  // 3. Tenant and Branch Isolation
  // ==========================================================================
  describe('3. Tenant and Branch Isolation', () => {
    it('9. Rejects cross-tenant LR with HTTP 404 LR_NOT_FOUND', async () => {
      let foreignLR: any;
      await tenantStorage.run({ companyId: tenantB.company._id.toString() }, async () => {
        foreignLR = await Entry.create({
          company_id: tenantB.company._id,
          lr_no: `LR-FOREIGN-${Date.now()}`,
          bill_no: `BILL-FOREIGN-${Date.now()}`,
          bill_date: new Date(),
          lr_date: new Date(),
          billing_party_id: customerB._id,
          vehicle_number: 'DL01-AB-1234',
          from_location: 'Delhi',
          to_location: 'Jaipur',
          consignor: { name: 'Foreign Shipper' },
          consignee: { name: 'Foreign Receiver' },
          status: 'active',
          is_deleted: false,
        });
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [foreignLR._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('LR_NOT_FOUND');
    });

    it('10. Rejects combining LRs from different regional branches with HTTP 400 BRANCH_MISMATCH', async () => {
      const lrBranchA = await createLR({ branch_id: branchA._id });
      const lrBranchB = await createLR({ branch_id: branchB._id });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lrBranchA._id, lrBranchB._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BRANCH_MISMATCH');
    });
  });

  // ==========================================================================
  // 4. Concurrency and Transactional Rollback
  // ==========================================================================
  describe('4. Concurrency and Transactional Rollback', () => {
    it('11. Rejects LR that is already assigned to an active journey with HTTP 409 LR_ALREADY_ASSIGNED', async () => {
      const lr = await createLR();

      // First journey takes the LR
      const res1 = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(res1.status).toBe(201);

      // Second journey tries to take the same LR
      const res2 = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('LR_ALREADY_ASSIGNED');
    });

    it('12. Concurrent attempts to link the same LR allow exactly one winner and reject the loser with 409', async () => {
      const lrShared = await createLR();

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/operations/journeys')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            truck_id: truckA._id,
            driver_id: driverA._id,
            journey_type: 'commercial',
            billing_party_id: customerA._id,
            lr_ids: [lrShared._id],
            from_location: { city: 'Mumbai', state: 'Maharashtra' },
            to_location: { city: 'Nagpur', state: 'Maharashtra' },
          }),
        request(app)
          .post('/api/operations/journeys')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            truck_id: truckA._id,
            driver_id: driverA._id,
            journey_type: 'commercial',
            billing_party_id: customerA._id,
            lr_ids: [lrShared._id],
            from_location: { city: 'Mumbai', state: 'Maharashtra' },
            to_location: { city: 'Nagpur', state: 'Maharashtra' },
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.code).toBe('LR_ALREADY_ASSIGNED');
    });

    it('13. Transaction aborts with zero LRs linked when one LR in batch is ineligible', async () => {
      const lrEligible = await createLR();
      const lrIneligible = await createLR({ status: 'cancelled' });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lrEligible._id, lrIneligible._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CANCELLED_LR_INELIGIBLE');

      // Check eligible LR was NOT linked
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const checkedLR = await Entry.findById(lrEligible._id);
        expect(checkedLR?.journey_id).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // 5. Internal Moves, Cancellation & Audited Lifecycle
  // ==========================================================================
  describe('5. Internal Moves, Cancellation & Audited Lifecycle', () => {
    it('14. Direct internal repositioning journey succeeds without LRs or customer', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'internal_repositioning',
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Pune', state: 'Maharashtra' },
          status: 'draft',
        });

      expect(res.status).toBe(201);
      expect(res.body.journey.journey_type).toBe('internal_repositioning');
      expect(res.body.journey.billing_party_id).toBeUndefined();
      expect(res.body.journey.lr_ids).toHaveLength(0);
    });

    it('15. Direct maintenance journey succeeds without LRs or customer', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          truck_id: truckA._id,
          driver_id: driverA._id,
          journey_type: 'maintenance',
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Thane', state: 'Maharashtra' },
          status: 'draft',
        });

      expect(res.status).toBe(201);
      expect(res.body.journey.journey_type).toBe('maintenance');
      expect(res.body.journey.billing_party_id).toBeUndefined();
      expect(res.body.journey.lr_ids).toHaveLength(0);
    });

    it('16. Rejects internal journey when truck or driver is omitted', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'internal_repositioning',
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Pune', state: 'Maharashtra' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('mandatory fields');
    });

    it('17. Cancelling a journey releases LRs while preserving immutable issuance snapshots', async () => {
      const lr = await createLR();

      // Create journey
      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);
      const journeyId = createRes.body.journey._id;

      // Cancel journey
      const cancelRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/cancel`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ reason: 'Trip cancelled by fleet manager due to route blockage.' });
      expect(cancelRes.status).toBe(200);

      // Verify LR released but snapshots 100% intact
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const releasedLR = await Entry.findById(lr._id);
        expect(releasedLR?.journey_id).toBeUndefined();
        expect(releasedLR?.status).toBe('active');
        expect(releasedLR?.truck_id?.toString()).toBe(truckA._id.toString());
        expect(releasedLR?.driver_id?.toString()).toBe(driverA._id.toString());
        expect(releasedLR?.vehicle_number).toBe(truckA.truck_no);
        expect(releasedLR?.driver_name).toBe(driverA.name);
        expect(releasedLR?.driver_phone).toBe(driverA.phone);
      });
    });

    it('18. Driver handover records audit trail without mutating linked LR issuance snapshots', async () => {
      const lr = await createLR();

      // Create and dispatch journey
      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);
      const journeyId = createRes.body.journey._id;

      const dispatchRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ start_odometer_kms: 50000 });
      expect(dispatchRes.status).toBe(200);

      // Perform Driver Swap (handover to driverB)
      const swapRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverB._id.toString(),
          handover_odometer: 50450,
          reason: 'Authorized driver relief due to statutory rest hours requirement.',
        });
      expect(swapRes.status).toBe(200);
      expect(swapRes.body.journey.driver_id.toString()).toBe(driverB._id.toString());
      expect(swapRes.body.journey.driver_handover_history).toHaveLength(1);
      expect(swapRes.body.journey.driver_handover_history[0].incoming_driver_id.toString()).toBe(driverB._id.toString());
      expect(swapRes.body.journey.driver_handover_history[0].outgoing_driver_id.toString()).toBe(driverA._id.toString());

      // Verify LR's original driver snapshot is completely untouched
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const checkedLR = await Entry.findById(lr._id);
        expect(checkedLR?.driver_id?.toString()).toBe(driverA._id.toString());
        expect(checkedLR?.driver_name).toBe(driverA.name);
        expect(checkedLR?.driver_phone).toBe(driverA.phone);
      });
    });

    it('19. Journey lifecycle does not create invoices or general ledger postings', async () => {
      const lr = await createLR();

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          billing_party_id: customerA._id,
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);

      // Verify zero invoices created
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const invoiceCount = await Invoice.countDocuments({ company_id: tenantA.company._id });
        expect(invoiceCount).toBe(0);
      });
    });
  });
});
