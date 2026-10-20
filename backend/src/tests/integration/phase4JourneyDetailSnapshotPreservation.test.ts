/**
 * ============================================================================
 * FLEET FLOW — PHASE 4: JOURNEY DETAIL & LR SNAPSHOT PRESERVATION
 * (phase4JourneyDetailSnapshotPreservation.test.ts)
 * ============================================================================
 * 
 * Verifies all Phase 4 invariants specified in the approved design:
 * 1. GET /api/operations/journeys/:id populates LR master references (truck_id, driver_id, billing_party_id)
 *    alongside immutable legal issuance snapshots (vehicle_number, driver_name, driver_phone).
 * 2. Mid-trip driver handover (PUT /api/operations/journeys/:id/swap-driver) updates journey operational driver
 *    and appends an audited handover entry without mutating linked LR issuance snapshots or master references.
 * 3. GET /api/operations/journeys/:id populates outgoing_driver_id, incoming_driver_id, and authorized_by
 *    on driver_handover_history.
 * 4. Multi-handover sequence accurately records sequential pilot transitions while keeping LR snapshots immutable.
 * 5. Strict multi-tenant isolation prevents cross-tenant journey inspection or unauthorized handover execution.
 * 6. Journey cancellation unlinks consignments (journey_id = null) without wiping or mutating LR snapshots.
 * 7. Multi-Billing-Party manifest and customer attributions remain intact across operational handovers.
 * 8. Frontend contract checks verify query invalidation, handover audit trail UI, and relay pilot indicator.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { BillingParty } from '../../models/BillingParty.js';
import { Branch } from '../../models/Branch.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase 4: Journey Detail and LR Snapshot Preservation', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let customerA: any;
  let customerB: any;
  let truckA: any;
  let driverA: any;
  let driverB: any;
  let driverC: any;
  let branchA: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'phase4_corp', role: 'admin' });
    tenantB = await createTestTenant({ name: 'phase4_rival', role: 'admin' });

    branchA = await Branch.create({
      company_id: tenantA.company._id,
      branch_code: 'P4MUM',
      branch_name: 'Phase 4 Mumbai Hub',
      city: 'Mumbai',
      state: 'Maharashtra',
      is_active: true,
      is_head_office: true,
    });

    customerA = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Customer Alpha Logistics',
      trade_name: 'Alpha Log',
      gstin: '27AAAAA0000A1Z5',
      billing_address: {
        street: 'Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_active: true,
    });

    customerB = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Customer Beta Cargo',
      trade_name: 'Beta Cargo',
      gstin: '27BBBBB0000B1Z6',
      billing_address: {
        street: 'Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_active: true,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: 'MH-04-P4-1001',
      make: 'Tata Prima',
      model: '4028.S',
      body_type: 'Container',
      tonnage_capacity: 28,
      status: 'available',
      current_odometer_kms: 50000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Rameshwar Kumar',
      phone: '+91 98765 43210',
      license_number: 'DL-MH04-2018-001',
      status: 'active',
    });

    driverB = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Suresh Singh',
      phone: '+91 98765 43211',
      license_number: 'DL-MH04-2019-002',
      status: 'active',
    });

    driverC = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Dinesh Sharma',
      phone: '+91 98765 43212',
      license_number: 'DL-MH04-2020-003',
      status: 'active',
    });
  });

  const createLR = async (billingParty: any, suffix: string = '1') => {
    const res = await request(app)
      .post('/api/commercial/entries')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        lr_no: `LR-P4-${Date.now()}-${suffix}`,
        lr_date: new Date().toISOString(),
        branch_id: branchA._id,
        billing_party_id: billingParty._id,
        truck_id: truckA._id,
        driver_id: driverA._id,
        from_location: 'Mumbai',
        to_location: 'Nagpur',
        consignor: { name: 'Alpha Shipper' },
        consignee: { name: 'Omega Receiver' },
        package_count: 50,
        packaging_type: 'Pallet',
        goods_description: 'Industrial Parts',
        actual_weight_tonnes: 12,
        freight_amount: 35000,
        freight_terms: 'to_pay',
      });
    expect(res.status).toBe(201);
    return res.body.entry;
  };

  // ==========================================================================
  // 1. GET /api/operations/journeys/:id Populates LR References & Snapshots
  // ==========================================================================
  describe('1. Journey Detail Asset Hydration', () => {
    it('populates LR master references and immutable legal snapshots', async () => {
      const lr = await createLR(customerA);

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);
      const journeyId = createRes.body.journey._id;

      const detailRes = await request(app)
        .get(`/api/operations/journeys/${journeyId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(detailRes.status).toBe(200);
      const fetchedJourney = detailRes.body.journey;

      // Journey operational assets
      expect(fetchedJourney.truck_id._id.toString()).toBe(truckA._id.toString());
      expect(fetchedJourney.truck_id.truck_no).toBe('MH-04-P4-1001');
      expect(fetchedJourney.driver_id._id.toString()).toBe(driverA._id.toString());
      expect(fetchedJourney.driver_id.name).toBe('Rameshwar Kumar');

      // Populated attached LR
      expect(fetchedJourney.lr_ids).toHaveLength(1);
      const populatedLr = fetchedJourney.lr_ids[0];
      expect(populatedLr.lr_no).toBe(lr.lr_no);

      // LR master relational references
      expect(populatedLr.truck_id._id.toString()).toBe(truckA._id.toString());
      expect(populatedLr.truck_id.truck_no).toBe('MH-04-P4-1001');
      expect(populatedLr.driver_id._id.toString()).toBe(driverA._id.toString());
      expect(populatedLr.driver_id.name).toBe('Rameshwar Kumar');
      expect(populatedLr.billing_party_id._id.toString()).toBe(customerA._id.toString());
      expect(populatedLr.billing_party_id.name).toBe('Customer Alpha Logistics');

      // LR immutable issuance snapshots
      expect(populatedLr.vehicle_number).toBe('MH-04-P4-1001');
      expect(populatedLr.driver_name).toBe('Rameshwar Kumar');
      expect(populatedLr.driver_phone).toBe('+91 98765 43210');
    });
  });

  // ==========================================================================
  // 2. Driver Handover Preserves LR Issuance Snapshots & Populates History
  // ==========================================================================
  describe('2. Driver Handover & Snapshot Preservation', () => {
    it('executes mid-trip driver handover, updates journey operating driver, and keeps LR snapshot intact', async () => {
      const lr = await createLR(customerA);

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);
      const journeyId = createRes.body.journey._id;

      // Dispatch journey
      const dispatchRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ start_odometer_kms: 50000 });
      expect(dispatchRes.status).toBe(200);

      // Execute driver handover to Suresh Singh (driverB)
      const swapRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverB._id.toString(),
          handover_odometer: 50450,
          reason: 'Authorized driver relief due to statutory rest hours requirement.',
          notes: 'Handover executed at Nashik Depot relay point.',
        });
      expect(swapRes.status).toBe(200);
      expect(swapRes.body.journey.driver_id.toString()).toBe(driverB._id.toString());

      // Fetch journey detail via GET endpoint
      const detailRes = await request(app)
        .get(`/api/operations/journeys/${journeyId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(detailRes.status).toBe(200);
      const detailJourney = detailRes.body.journey;

      // Journey operational driver is now Driver B
      expect(detailJourney.driver_id._id.toString()).toBe(driverB._id.toString());
      expect(detailJourney.driver_id.name).toBe('Suresh Singh');

      // Handover history is populated with outgoing and incoming driver details
      expect(detailJourney.driver_handover_history).toHaveLength(1);
      const handover = detailJourney.driver_handover_history[0];
      expect(handover.outgoing_driver_id._id.toString()).toBe(driverA._id.toString());
      expect(handover.outgoing_driver_id.name).toBe('Rameshwar Kumar');
      expect(handover.incoming_driver_id._id.toString()).toBe(driverB._id.toString());
      expect(handover.incoming_driver_id.name).toBe('Suresh Singh');
      expect(handover.handover_odometer).toBe(50450);
      expect(handover.reason).toBe('Authorized driver relief due to statutory rest hours requirement.');
      expect(handover.notes).toBe('Handover executed at Nashik Depot relay point.');
      expect(handover.authorized_by).toBeDefined();

      // Verify that LR in DB has NOT been altered: original issuance snapshots remain completely intact
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const checkedLR = await Entry.findById(lr._id);
        expect(checkedLR?.driver_id?.toString()).toBe(driverA._id.toString());
        expect(checkedLR?.driver_name).toBe('Rameshwar Kumar');
        expect(checkedLR?.driver_phone).toBe('+91 98765 43210');
        expect(checkedLR?.truck_id?.toString()).toBe(truckA._id.toString());
        expect(checkedLR?.vehicle_number).toBe('MH-04-P4-1001');
      });
    });

    it('preserves initial LR snapshots across multiple sequential driver handovers', async () => {
      const lr = await createLR(customerA);

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Kolkata', state: 'West Bengal' },
          status: 'draft',
        });
      const journeyId = createRes.body.journey._id;

      await request(app)
        .put(`/api/operations/journeys/${journeyId}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ start_odometer_kms: 50000 });

      // First handover: Driver A -> Driver B at 50,500 km
      await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverB._id.toString(),
          handover_odometer: 50500,
          reason: 'Stage 1 relay handover at Dhule interchange facility.',
        });

      // Second handover: Driver B -> Driver C at 51,200 km
      await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverC._id.toString(),
          handover_odometer: 51200,
          reason: 'Stage 2 relay handover at Raipur corridor checkpoint.',
        });

      const detailRes = await request(app)
        .get(`/api/operations/journeys/${journeyId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(detailRes.status).toBe(200);
      const journey = detailRes.body.journey;

      // Current operating driver is Driver C
      expect(journey.driver_id._id.toString()).toBe(driverC._id.toString());
      expect(journey.driver_id.name).toBe('Dinesh Sharma');

      // 2 handover audit entries in sequence
      expect(journey.driver_handover_history).toHaveLength(2);
      expect(journey.driver_handover_history[0].outgoing_driver_id.name).toBe('Rameshwar Kumar');
      expect(journey.driver_handover_history[0].incoming_driver_id.name).toBe('Suresh Singh');
      expect(journey.driver_handover_history[0].handover_odometer).toBe(50500);

      expect(journey.driver_handover_history[1].outgoing_driver_id.name).toBe('Suresh Singh');
      expect(journey.driver_handover_history[1].incoming_driver_id.name).toBe('Dinesh Sharma');
      expect(journey.driver_handover_history[1].handover_odometer).toBe(51200);

      // LR snapshot is still Driver A (Rameshwar Kumar)
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const checkedLR = await Entry.findById(lr._id);
        expect(checkedLR?.driver_name).toBe('Rameshwar Kumar');
        expect(checkedLR?.driver_id?.toString()).toBe(driverA._id.toString());
      });
    });
  });

  // ==========================================================================
  // 3. Multi-Tenant Isolation & Anti-IDOR Protections
  // ==========================================================================
  describe('3. Multi-Tenant Isolation on Journey Detail & Handover', () => {
    it('strictly isolates journey detail across tenants with HTTP 404', async () => {
      const lr = await createLR(customerA);
      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      const journeyId = createRes.body.journey._id;

      // Tenant B queries Tenant A's journey
      const res = await request(app)
        .get(`/api/operations/journeys/${journeyId}`)
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Journey not found.');
    });

    it('rejects cross-tenant driver swap with HTTP 403 or 404', async () => {
      const lr = await createLR(customerA);
      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      const journeyId = createRes.body.journey._id;

      await request(app)
        .put(`/api/operations/journeys/${journeyId}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ start_odometer_kms: 50000 });

      // Tenant B attempts to swap driver on Tenant A's journey
      const swapRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantB.token}`)
        .send({
          incoming_driver_id: driverB._id.toString(),
          handover_odometer: 50400,
          reason: 'Unauthorized cross-tenant intrusion attempt should fail.',
        });

      expect([403, 404]).toContain(swapRes.status);
    });
  });

  // ==========================================================================
  // 4. Cancellation Unlinks LRs Without Wiping Snapshots
  // ==========================================================================
  describe('4. Journey Cancellation & Consignment Unlinking', () => {
    it('cancels journey and unlinks LRs while keeping snapshots and references intact', async () => {
      const lr = await createLR(customerA);

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      const journeyId = createRes.body.journey._id;

      // Cancel journey
      const cancelRes = await request(app)
        .put(`/api/operations/journeys/${journeyId}/cancel`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ reason: 'Trip cancelled due to highway closure.' });
      expect(cancelRes.status).toBe(200);

      // Verify consignment is unlinked but retains all snapshots
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const releasedLR = await Entry.findById(lr._id);
        expect(releasedLR?.journey_id).toBeFalsy();
        expect(releasedLR?.truck_id?.toString()).toBe(truckA._id.toString());
        expect(releasedLR?.driver_id?.toString()).toBe(driverA._id.toString());
        expect(releasedLR?.vehicle_number).toBe('MH-04-P4-1001');
        expect(releasedLR?.driver_name).toBe('Rameshwar Kumar');
        expect(releasedLR?.driver_phone).toBe('+91 98765 43210');
      });
    });
  });

  // ==========================================================================
  // 5. Multi-Billing-Party Manifest Preservation across Handover
  // ==========================================================================
  describe('5. Multi-Billing-Party Manifest Preservation across Handover', () => {
    it('maintains distinct customer manifest across en-route driver swap without side effects', async () => {
      const lr1 = await createLR(customerA, '1');
      const lr2 = await createLR(customerB, '2');

      const createRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          lr_ids: [lr1._id, lr2._id],
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          status: 'draft',
        });
      expect(createRes.status).toBe(201);
      const journeyId = createRes.body.journey._id;

      await request(app)
        .put(`/api/operations/journeys/${journeyId}/dispatch`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ start_odometer_kms: 50000 });

      // Execute handover
      await request(app)
        .put(`/api/operations/journeys/${journeyId}/swap-driver`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          incoming_driver_id: driverB._id.toString(),
          handover_odometer: 50600,
          reason: 'Scheduled driver rotation at Aurangabad corridor terminal.',
        });

      // Verify journey detail retains both LRs and their separate billing parties
      const detailRes = await request(app)
        .get(`/api/operations/journeys/${journeyId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(detailRes.status).toBe(200);

      const journey = detailRes.body.journey;
      expect(journey.lr_ids).toHaveLength(2);
      const partyIds = journey.lr_ids.map((l: any) => l.billing_party_id._id.toString());
      expect(partyIds).toContain(customerA._id.toString());
      expect(partyIds).toContain(customerB._id.toString());

      // Operational driver is Driver B
      expect(journey.driver_id._id.toString()).toBe(driverB._id.toString());

      // Both LRs still preserve Driver A in database
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const checkedLR1 = await Entry.findById(lr1._id);
        const checkedLR2 = await Entry.findById(lr2._id);
        expect(checkedLR1?.driver_name).toBe('Rameshwar Kumar');
        expect(checkedLR2?.driver_name).toBe('Rameshwar Kumar');
      });
    });
  });

  // ==========================================================================
  // 6. Frontend Contract & Static Verifications
  // ==========================================================================
  describe('6. Frontend Contract Verifications (JourneyDetailPage.tsx)', () => {
    let journeyDetailSource: string;

    beforeEach(() => {
      const frontendPath = path.resolve(
        __dirname,
        '../../../../frontend/src/pages/operations/JourneyDetailPage.tsx'
      );
      journeyDetailSource = fs.readFileSync(frontendPath, 'utf8');
    });

    it('[Contract/Static] swapDriverMutation invalidates journey-detail and related queries', () => {
      expect(journeyDetailSource).toContain("queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });");
      expect(journeyDetailSource).toContain("queryClient.invalidateQueries({ queryKey: ['journeys'] });");
      expect(journeyDetailSource).toContain("queryClient.invalidateQueries({ queryKey: ['active-drivers'] });");
    });

    it('[Contract/Static] renders En-Route Driver Handover Audit Trail when handovers exist', () => {
      expect(journeyDetailSource).toContain('En-Route Driver Handover Audit Trail');
      expect(journeyDetailSource).toContain('Original LR issuance details are preserved for audit and historical reference.');
      expect(journeyDetailSource).toContain('handover.outgoing_driver_id');
      expect(journeyDetailSource).toContain('handover.incoming_driver_id');
      expect(journeyDetailSource).toContain('handover.handover_odometer');
    });

    it('[Contract/Static] Attached Consignments table renders Relay Pilot En-Route indicator when driver is swapped', () => {
      expect(journeyDetailSource).toContain('Relay Pilot En-Route: {journey.driver_id.name}');
      expect(journeyDetailSource).toContain('Issued: {lr.vehicle_number || \'Rig\'} • {lr.driver_name || \'Driver unassigned\'}');
      expect(journeyDetailSource).toContain('Original LR issuance details are preserved for audit and historical reference.');
    });
  });
});
