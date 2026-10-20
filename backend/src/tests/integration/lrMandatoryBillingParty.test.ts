/**
 * ============================================================================
 * MANDATORY BILLING PARTY ON COMMERCIAL LRS INTEGRATION TESTS (Phase 1 Baseline)
 * ============================================================================
 * 
 * Verifies:
 * 1. Creating a commercial LR without billing_party_id returns HTTP 400 BILLING_PARTY_REQUIRED.
 * 2. An empty Billing Party value is rejected with HTTP 400 BILLING_PARTY_REQUIRED.
 * 3. A malformed Billing Party ID is rejected with HTTP 400 INVALID_BILLING_PARTY_ID.
 * 4. A nonexistent Billing Party is rejected (Anti-IDOR / HTTP 403).
 * 5. A cross-tenant Billing Party cannot be assigned (Anti-IDOR / HTTP 403).
 * 6. A valid registered Billing Party allows LR creation (HTTP 201).
 * 7. Existing credit-limit enforcement remains effective.
 * 8. Truck and driver references remain mandatory.
 * 9. Historical LRs without Billing Parties still hydrate and can undergo permitted unrelated edits.
 * 10. An LR linked to an active journey cannot have its Billing Party changed or removed (HTTP 409 LINKED_LR_BILLING_PARTY_LOCKED).
 * 11. An LR linked to a completed journey cannot have its Billing Party changed or removed (HTTP 409 LINKED_LR_BILLING_PARTY_LOCKED).
 * 12. An unlinked LR's Billing Party can be updated only under valid ownership and existing lifecycle rules.
 * 13. The frontend marks Billing Party as required and blocks submission when it is missing.
 * 14. Existing LR creation, journey linking, cancellation, and snapshot behavior remain intact.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
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

describe('Phase 1: Mandatory Billing Party on Commercial LRs', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let customerA1: any;
  let customerA2: any;
  let customerB: any;
  let inactiveCustomerA: any;
  let branchA: any;
  let truckA: any;
  let driverA: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });

    branchA = await Branch.create({
      company_id: tenantA.company._id,
      branch_name: 'Mumbai Central Hub',
      branch_code: 'BOM',
      lr_prefix: 'BOM-LR-',
      is_active: true,
      is_head_office: true,
      city: 'Mumbai',
      state: 'Maharashtra',
    });

    customerA1 = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Reliance Industries Ltd',
      trade_name: 'RIL Petrochem',
      gstin: '27AAACR1234A1Z5',
      address: 'Nariman Point, Mumbai',
      credit_limit: 500000,
      enforce_credit_limit: true,
      status: 'active',
      is_deleted: false,
    });

    customerA2 = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Tata Steel Processing Ltd',
      trade_name: 'Tata Steel',
      gstin: '27AAACT5678B1Z2',
      address: 'Worli, Mumbai',
      credit_limit: 250000,
      enforce_credit_limit: true,
      status: 'active',
      is_deleted: false,
    });

    inactiveCustomerA = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Defunct Industrial Works',
      trade_name: 'Defunct Co',
      gstin: '27AAACD9999C1Z3',
      address: 'Thane, Maharashtra',
      credit_limit: 100000,
      enforce_credit_limit: true,
      status: 'inactive',
      is_deleted: false,
    });

    customerB = await BillingParty.create({
      company_id: tenantB.company._id,
      name: 'Adani Logistics Overseas',
      trade_name: 'Adani Ports',
      gstin: '24AAACA1111D1Z4',
      address: 'Mundra, Gujarat',
      credit_limit: 1000000,
      enforce_credit_limit: true,
      status: 'active',
      is_deleted: false,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata Motors',
      model: 'Signa 4825.TK',
      tonnage_capacity: 25,
      status: 'available',
      fitness_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      insurance_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      puc_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      national_permit_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Suresh Kumar Yadav',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `MH04${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'active',
    });
  });

  function makeValidPayload(overrides: Record<string, any> = {}) {
    return {
      billing_party_id: customerA1._id.toString(),
      branch_id: branchA._id.toString(),
      truck_id: truckA._id.toString(),
      driver_id: driverA._id.toString(),
      from_location: 'Mumbai, Maharashtra',
      to_location: 'Ahmedabad, Gujarat',
      goods_description: 'Industrial Bearings & Gears',
      package_count: 50,
      packaging_type: 'Wooden Crates',
      actual_weight_tonnes: 12.5,
      chargeable_weight_tonnes: 12.5,
      freight_amount: 35000,
      freight_terms: 'to_be_billed',
      consignor: { name: 'Reliance Industries Hazira', phone: '+919876543210' },
      consignee: { name: 'Tata Motors Sanand Plant', phone: '+919876543211' },
      ...overrides,
    };
  }

  // ==========================================================================
  // Requirement 1 & 2: Mandatory Presence & Non-Empty Validation
  // ==========================================================================
  describe('1 & 2: Mandatory Presence and Empty Value Rejections', () => {
    it('1. rejects commercial LR creation when billing_party_id is omitted with HTTP 400 BILLING_PARTY_REQUIRED', async () => {
      const payload = makeValidPayload();
      delete payload.billing_party_id;

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
      expect(res.body.error).toMatch(/registered billing party is mandatory/i);
    });

    it('2. rejects commercial LR creation when billing_party_id is empty string with HTTP 400 BILLING_PARTY_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: '' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
      expect(res.body.error).toMatch(/registered billing party is mandatory/i);
    });

    it('2b. rejects commercial LR creation when billing_party_id is whitespace only with HTTP 400 BILLING_PARTY_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: '    ' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
    });

    it('2c. rejects commercial LR creation when billing_party_id is null with HTTP 400 BILLING_PARTY_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: null }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
    });
  });

  // ==========================================================================
  // Requirement 3: Malformed ID Validation
  // ==========================================================================
  describe('3: Malformed Billing Party ID Validation', () => {
    it('3. rejects commercial LR creation when billing_party_id is malformed with HTTP 400 INVALID_BILLING_PARTY_ID', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: 'not-a-valid-object-id' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_BILLING_PARTY_ID');
      expect(res.body.error).toMatch(/invalid billing_party_id format/i);
    });
  });

  // ==========================================================================
  // Requirement 4 & 5: Existence and Cross-Tenant Ownership (Anti-IDOR)
  // ==========================================================================
  describe('4 & 5: Existence and Multi-Tenant Ownership Verification (Anti-IDOR)', () => {
    it('4. rejects commercial LR creation with HTTP 403 when billing_party_id does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: nonExistentId.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/party does not exist or does not belong to your workspace/i);
      expect(res.body.entityType).toBe('BillingParty');
    });

    it('5. rejects commercial LR creation with HTTP 403 when assigning a cross-tenant Billing Party', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerB._id.toString() }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/party does not exist or does not belong to your workspace/i);
      expect(res.body.entityType).toBe('BillingParty');
    });

    it('5b. rejects commercial LR creation with HTTP 400 when Billing Party is marked inactive', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: inactiveCustomerA._id.toString() }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BILLING_PARTY_INACTIVE');
      expect(res.body.error).toContain('is inactive and cannot be assigned');
    });
  });

  // ==========================================================================
  // Requirement 6: Valid Registered Billing Party Success Flow
  // ==========================================================================
  describe('6: Successful Commercial LR Creation with Valid Billing Party', () => {
    it('6. creates commercial LR successfully with HTTP 201 and populates Billing Party reference', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload());

      expect(res.status).toBe(201);
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.billing_party_id).toBeDefined();
      expect(String(res.body.entry.billing_party_id._id || res.body.entry.billing_party_id)).toBe(
        customerA1._id.toString()
      );
      expect(res.body.entry.status).toBe('active');
      expect(res.body.entry.lr_no).toMatch(/BOM-LR-\d{4}/);
    });
  });

  // ==========================================================================
  // Requirement 7 & 8: Credit-Limit Enforcement & Master Truck/Driver Mandatory
  // ==========================================================================
  describe('7 & 8: Credit Limit Enforcement and Truck/Driver Preservations', () => {
    it('7. preserves credit-limit enforcement on LR creation when exposure limit is exceeded', async () => {
      // Set lower credit limit for customerA2
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await BillingParty.updateOne({ _id: customerA2._id }, { $set: { credit_limit: 20000 } });
      });

      // Attempt creating LR with freight 50000 (breaching 20000)
      const breachRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(
          makeValidPayload({
            billing_party_id: customerA2._id.toString(),
            freight_amount: 50000,
          })
        );

      expect(breachRes.status).toBe(409);
      expect(breachRes.body.code).toBe('CREDIT_LIMIT_EXCEEDED');

      // Admin override with valid justification succeeds
      const overrideRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(
          makeValidPayload({
            billing_party_id: customerA2._id.toString(),
            freight_amount: 50000,
            credit_override: true,
            override_reason: 'Admin pre-approval for quarter-end bulk steel consignment',
          })
        );

      expect(overrideRes.status).toBe(201);
      expect(overrideRes.body.entry).toBeDefined();
    });

    it('8. preserves mandatory truck and driver checks for new LRs', async () => {
      // Missing truck
      const missingTruckPayload = makeValidPayload();
      delete missingTruckPayload.truck_id;
      const resTruck = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(missingTruckPayload);

      expect(resTruck.status).toBe(400);
      expect(resTruck.body.code).toBe('TRUCK_REQUIRED');

      // Missing driver
      const missingDriverPayload = makeValidPayload();
      delete missingDriverPayload.driver_id;
      const resDriver = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(missingDriverPayload);

      expect(resDriver.status).toBe(400);
      expect(resDriver.body.code).toBe('DRIVER_REQUIRED');
    });
  });

  // ==========================================================================
  // Requirement 9: Historical Record Compatibility
  // ==========================================================================
  describe('9: Backward Compatibility for Historical LRs Without Billing Party', () => {
    it('9. historical LRs without billing_party_id hydrate cleanly and allow permitted unrelated edits', async () => {
      // Direct insertion simulating legacy LR created prior to Phase 1 rule
      let historicalEntry: any;
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        historicalEntry = await Entry.create({
          company_id: tenantA.company._id,
          branch_id: branchA._id,
          bill_no: 'BILL-HIST-001',
          lr_no: 'LR-HIST-001',
          vehicle_number: truckA.truck_no,
          driver_name: driverA.name,
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: 'Old Port',
          to_location: 'Central Depot',
          package_count: 20,
          packaging_type: 'Cartons',
          goods_description: 'Legacy Hardware Components',
          declared_value: 50000,
          risk_type: 'carrier_risk',
          actual_weight_tonnes: 5.0,
          chargeable_weight_tonnes: 5.0,
          freight_amount: 15000,
          freight_terms: 'to_be_billed',
          consignor: { name: 'Old Consignor Ltd' },
          consignee: { name: 'Old Consignee Ltd' },
          status: 'active',
          is_deleted: false,
          // billing_party_id deliberately omitted
        });
      });

      expect(historicalEntry.billing_party_id).toBeUndefined();

      // Retrieve via GET /api/commercial/entries/:id
      const getRes = await request(app)
        .get(`/api/commercial/entries/${historicalEntry._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.entry.lr_no).toBe('LR-HIST-001');
      expect(getRes.body.entry.billing_party_id).toBeFalsy();

      // Perform unrelated operational edit (package_count and goods_description) without sending billing_party_id
      const putRes = await request(app)
        .put(`/api/commercial/entries/${historicalEntry._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          package_count: 25,
          goods_description: 'Updated Legacy Hardware Components',
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.entry.package_count).toBe(25);
      expect(putRes.body.entry.goods_description).toBe('Updated Legacy Hardware Components');
      expect(putRes.body.entry.billing_party_id).toBeFalsy();
    });
  });

  // ==========================================================================
  // Requirements 10 & 11: Protecting Billing Party on Linked LRs
  // ==========================================================================
  describe('10 & 11: Billing Party Immutability on Linked LRs', () => {
    it('10. prevents changing or removing Billing Party for an LR linked to an active journey (HTTP 409)', async () => {
      // 1. Create LR with customerA1
      const lrRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerA1._id.toString() }));
      expect(lrRes.status).toBe(201);
      const lrId = lrRes.body.entry._id;

      // 2. Create and dispatch journey linking this LR
      let activeJourney: any;
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        activeJourney = await TruckJourney.create({
          company_id: tenantA.company._id,
          journey_number: 'TRIP-ACT-001',
          journey_type: 'commercial',
          truck_id: truckA._id,
          driver_id: driverA._id,
          branch_id: branchA._id,
          billing_party_id: customerA1._id,
          from_location: { city: 'Mumbai' },
          to_location: { city: 'Ahmedabad' },
          start_odometer_kms: 50000,
          status: 'active',
          is_deleted: false,
        });

        await Entry.updateOne({ _id: lrId }, { $set: { journey_id: activeJourney._id } });
      });

      // 3. Attempt to change Billing Party to customerA2 -> 409 LINKED_LR_BILLING_PARTY_LOCKED
      const changeRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: customerA2._id.toString() });

      expect(changeRes.status).toBe(409);
      expect(changeRes.body.code).toBe('LINKED_LR_BILLING_PARTY_LOCKED');
      expect(changeRes.body.error).toContain('linked to an active journey');

      // 4. Attempt to remove Billing Party -> 409 LINKED_LR_BILLING_PARTY_LOCKED
      const removeRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: '' });

      expect(removeRes.status).toBe(409);
      expect(removeRes.body.code).toBe('LINKED_LR_BILLING_PARTY_LOCKED');

      // 5. Unrelated edit (e.g. package count) on linked LR succeeds
      const updateUnrelatedRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ package_count: 55, goods_description: 'Updated Bearings on Active Trip' });

      expect(updateUnrelatedRes.status).toBe(200);
      expect(updateUnrelatedRes.body.entry.package_count).toBe(55);
      expect(String(updateUnrelatedRes.body.entry.billing_party_id._id || updateUnrelatedRes.body.entry.billing_party_id)).toBe(
        customerA1._id.toString()
      );
    });

    it('11. prevents changing or removing Billing Party for an LR linked to a completed journey (HTTP 409)', async () => {
      // 1. Create LR with customerA1
      const lrRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerA1._id.toString() }));
      expect(lrRes.status).toBe(201);
      const lrId = lrRes.body.entry._id;

      // 2. Create completed journey linking this LR
      let completedJourney: any;
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        completedJourney = await TruckJourney.create({
          company_id: tenantA.company._id,
          journey_number: 'TRIP-CMP-001',
          journey_type: 'commercial',
          truck_id: truckA._id,
          driver_id: driverA._id,
          branch_id: branchA._id,
          billing_party_id: customerA1._id,
          from_location: { city: 'Mumbai' },
          to_location: { city: 'Ahmedabad' },
          start_odometer_kms: 50000,
          status: 'completed',
          is_deleted: false,
        });

        await Entry.updateOne({ _id: lrId }, { $set: { journey_id: completedJourney._id } });
      });

      // 3. Attempt to change Billing Party to customerA2 -> 409 LINKED_LR_BILLING_PARTY_LOCKED
      const changeRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: customerA2._id.toString() });

      expect(changeRes.status).toBe(409);
      expect(changeRes.body.code).toBe('LINKED_LR_BILLING_PARTY_LOCKED');
      expect(changeRes.body.error).toContain('linked to an completed journey');

      // 4. Attempt to remove Billing Party -> 409 LINKED_LR_BILLING_PARTY_LOCKED
      const removeRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: null });

      expect(removeRes.status).toBe(409);
      expect(removeRes.body.code).toBe('LINKED_LR_BILLING_PARTY_LOCKED');
    });
  });

  // ==========================================================================
  // Requirement 12: Unlinked LR Billing Party Updates
  // ==========================================================================
  describe('12: Unlinked LR Billing Party Updates Under Valid Ownership', () => {
    it('12a. allows updating unlinked LR Billing Party to another valid customer in the tenant workspace', async () => {
      const lrRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerA1._id.toString() }));
      expect(lrRes.status).toBe(201);
      const lrId = lrRes.body.entry._id;

      // Update to customerA2
      const updateRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: customerA2._id.toString() });

      expect(updateRes.status).toBe(200);
      expect(String(updateRes.body.entry.billing_party_id._id || updateRes.body.entry.billing_party_id)).toBe(
        customerA2._id.toString()
      );
    });

    it('12b. rejects updating unlinked LR Billing Party to cross-tenant customer with HTTP 403', async () => {
      const lrRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerA1._id.toString() }));
      const lrId = lrRes.body.entry._id;

      const updateCrossRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: customerB._id.toString() });

      expect(updateCrossRes.status).toBe(403);
      expect(updateCrossRes.body.error).toMatch(/party does not exist or does not belong to your workspace/i);
    });

    it('12c. rejects clearing Billing Party on unlinked LR with HTTP 400 BILLING_PARTY_REQUIRED', async () => {
      const lrRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload({ billing_party_id: customerA1._id.toString() }));
      const lrId = lrRes.body.entry._id;

      const updateEmptyRes = await request(app)
        .put(`/api/commercial/entries/${lrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ billing_party_id: '' });

      expect(updateEmptyRes.status).toBe(400);
      expect(updateEmptyRes.body.code).toBe('BILLING_PARTY_REQUIRED');
    });
  });

  // ==========================================================================
  // Requirement 13: Frontend Form Validation Inspection
  // ==========================================================================
  describe('13: Frontend Form Requirement Verification', () => {
    it('13. verifies LRListPage.tsx renders required label, required select attribute, and client-side validation guard', () => {
      const lrListPagePath = path.resolve(__dirname, '../../../../frontend/src/pages/commercial/LRListPage.tsx');
      expect(fs.existsSync(lrListPagePath)).toBe(true);

      const fileContent = fs.readFileSync(lrListPagePath, 'utf-8');

      // 1. Required label present and optional label removed
      expect(fileContent).toContain('Billing Party / Customer *');
      expect(fileContent).not.toContain('Optional for Invoicing');

      // 2. Select element marked as HTML required
      expect(fileContent).toMatch(/<select[\s\S]*?value=\{formData\.billing_party_id\}[\s\S]*?required/);

      // 3. Client-side submit guard blocking submission if billing_party_id is missing
      expect(fileContent).toContain('if (!formData.billing_party_id)');
      expect(fileContent).toContain('A registered Billing Party is mandatory to issue a Lorry Receipt.');

      // 4. Payload includes billing_party_id
      expect(fileContent).toContain('billing_party_id: formData.billing_party_id,');
    });
  });

  // ==========================================================================
  // Requirement 14: Existing LR Creation, Journey Linking & Cancellation Invariants
  // ==========================================================================
  describe('14: End-to-End LR Lifecycle and Invariants Integrity', () => {
    it('14. verifies full lifecycle: creation with snapshots, commercial journey creation with customer consistency, and cancellation', async () => {
      // 1. Create commercial LR
      const createRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload());

      expect(createRes.status).toBe(201);
      const lr = createRes.body.entry;
      expect(lr.vehicle_number).toBe(truckA.truck_no);
      expect(lr.driver_name).toBe(driverA.name);

      // 2. Create Commercial Journey referencing this LR
      const journeyRes = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          journey_type: 'commercial',
          truck_id: truckA._id.toString(),
          driver_id: driverA._id.toString(),
          branch_id: branchA._id.toString(),
          billing_party_id: customerA1._id.toString(),
          lr_ids: [lr._id],
          from_location: { city: 'Mumbai' },
          to_location: { city: 'Ahmedabad' },
          start_odometer_kms: 50000,
        });

      expect(journeyRes.status).toBe(201);
      expect(['draft', 'active']).toContain(journeyRes.body.journey.status);
      expect(journeyRes.body.journey.billing_party_id.toString()).toBe(customerA1._id.toString());

      // 3. Verify LR is linked to journey
      const linkedLr = await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        return Entry.findById(lr._id);
      });
      expect(linkedLr?.journey_id?.toString()).toBe(journeyRes.body.journey._id.toString());

      // 4. Create an unlinked LR and cancel it successfully
      const unlinkedRes = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(makeValidPayload());
      expect(unlinkedRes.status).toBe(201);
      const unlinkedLrId = unlinkedRes.body.entry._id;

      const deleteRes = await request(app)
        .delete(`/api/commercial/entries/${unlinkedLrId}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toMatch(/cancelled successfully/i);

      const cancelledLr = await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        return Entry.findById(unlinkedLrId);
      });
      expect(cancelledLr?.status).toBe('cancelled');
      expect(cancelledLr?.is_deleted).toBe(true);
    });
  });
});
