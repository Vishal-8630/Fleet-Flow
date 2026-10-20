/**
 * ============================================================================
 * BILLING PARTY LR-TO-JOURNEY WORKFLOW INTEGRATION TESTS (Phase 1 Baseline)
 * ============================================================================
 * 
 * Verifies:
 * 1. Valid journey creation with single and multiple LRs.
 * 2. Automatic derivation of billing_party_id from LRs and customer consistency validation.
 * 3. Strict rejection of customer mismatches and unassigned consignment batches.
 * 4. Mandatory-LR rule for commercial journeys and anti-bypass invariants.
 * 5. Sensible inference for legacy API clients omitting journey_type.
 * 6. Legitimate direct dispatches for internal repositioning and maintenance.
 * 7. Ineligible (invoiced, cancelled), duplicate, branch-mismatched, and cross-tenant LR rejections.
 * 8. Atomic linking inside transactions and unlinking upon trip cancellation.
 * 9. Full backward compatibility for historical LR-free journeys (no schema default coercion).
 * 10. Entry listing unassigned filter (?unassigned=true).
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

describe('Phase 1: Billing Party LR-to-Journey Workflow & Linking Safeguards', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let customerA: any;
  let customerB: any;
  let truckA: any;
  let driverA: any;
  let branchA: any;
  let branchB: any;

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
      branch_name: 'Pune Depot',
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
      billing_address: {
        street: 'Nariman Point',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_deleted: false,
    });

    customerB = await BillingParty.create({
      company_id: tenantA.company._id,
      name: 'Reliance Industries',
      trade_name: 'Reliance',
      gstin: '27AABCR5678B1Z2',
      billing_address: {
        street: 'BKC',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
      },
      status: 'active',
      is_deleted: false,
    });

    truckA = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Tata',
      model: 'Signa 4825.TK',
      body_type: 'Container',
      tonnage_capacity: 35,
      status: 'available',
      current_odometer_kms: 50000,
    });

    driverA = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Ramesh Patil',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });
  });

  const createHelperLR = async (overrides: Partial<any> = {}) => {
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
      driver_name: driverA.name,
      driver_phone: driverA.phone,
      vehicle_number: truckA.truck_no,
      from_location: 'Mumbai',
      to_location: 'Nagpur',
      consignor: { name: 'Tata Works Mumbai' },
      consignee: { name: 'Nagpur Depot' },
      package_count: 50,
      packaging_type: 'Pallets',
      goods_description: 'Industrial Steel Coils',
      declared_value: 500000,
      risk_type: 'carrier_risk',
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

  // --------------------------------------------------------------------------
  // 1. Valid Creation with Single and Multiple LRs
  // --------------------------------------------------------------------------
  it('1. Valid creation with single LR atomically links LR and aggregates payload', async () => {
    const lr = await createHelperLR();

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
    expect(res.body.journey).toBeDefined();
    expect(res.body.journey.journey_type).toBe('commercial');
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
    expect(res.body.journey.lr_ids).toHaveLength(1);
    expect(res.body.journey.lr_ids[0].toString()).toBe(lr._id.toString());
    expect(res.body.journey.loaded_weight_tonnes).toBe(12.5);
    expect(res.body.journey.cbm_volume).toBe(25.0);
    expect(res.body.journey.cargo_description).toBe('Industrial Steel Coils');

    // Verify reverse linkage on Entry
    const updatedLR = await Entry.findById(lr._id, null, { skipTenantCheck: true });
    expect(updatedLR?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  it('2. Valid creation with multiple compatible LRs aggregates weights and links all LRs', async () => {
    const lr1 = await createHelperLR({
      actual_weight_tonnes: 10,
      cbm_volume: 15,
      goods_description: 'Coil A',
    });
    const lr2 = await createHelperLR({
      actual_weight_tonnes: 8.5,
      cbm_volume: 12,
      goods_description: 'Coil B',
    });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.lr_ids).toHaveLength(2);
    expect(res.body.journey.loaded_weight_tonnes).toBe(18.5);
    expect(res.body.journey.cbm_volume).toBe(27);
    expect(res.body.journey.cargo_description).toBe('Coil A, Coil B');

    const updatedLR1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const updatedLR2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(updatedLR1?.journey_id?.toString()).toBe(res.body.journey._id.toString());
    expect(updatedLR2?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  // --------------------------------------------------------------------------
  // 2. Customer Derivation & Consistency Validation
  // --------------------------------------------------------------------------
  it('3. Derives billing_party_id from LRs when omitted in request payload', async () => {
    const lr1 = await createHelperLR({ billing_party_id: customerA._id });
    const lr2 = await createHelperLR({ billing_party_id: customerA._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        // billing_party_id intentionally omitted
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
  });

  it('4. Allows multiple LRs belonging to different Billing Parties on the same journey', async () => {
    const lr1 = await createHelperLR({ billing_party_id: customerA._id });
    const lr2 = await createHelperLR({ billing_party_id: customerB._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey).toBeDefined();
    expect(res.body.journey.billing_party_id).toBeUndefined();
    expect(res.body.journey.lr_ids).toHaveLength(2);

    // Confirm both LRs were linked
    const check1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const check2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(check1?.journey_id?.toString()).toBe(res.body.journey._id.toString());
    expect(check2?.journey_id?.toString()).toBe(res.body.journey._id.toString());
  });

  it('5. Rejects journey creation when LRs contain unassigned customer consignments', async () => {
    const lrUnassigned = await createHelperLR({ billing_party_id: undefined });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [lrUnassigned._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BILLING_PARTY_REQUIRED');
  });

  it('6. Does not trust client-supplied customer ID when LRs define the commercial parties', async () => {
    const lrCustomerB = await createHelperLR({ billing_party_id: customerB._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id, // Client-supplied mismatched customer
        lr_ids: [lrCustomerB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey).toBeDefined();
    // Journey billing_party_id is authoritatively derived from LR (customerB), not client-supplied customerA
    expect(res.body.journey.billing_party_id.toString()).toBe(customerB._id.toString());
  });

  // --------------------------------------------------------------------------
  // 3. Mandatory-LR Invariant on Commercial Journeys
  // --------------------------------------------------------------------------
  it('7. Rejects commercial journey with customer when lr_ids is empty array', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LR_REQUIRED_FOR_BILLING_PARTY_JOURNEY');
  });

  it('8. Rejects commercial journey with customer when lr_ids is completely omitted', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        // lr_ids omitted
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LR_REQUIRED_FOR_BILLING_PARTY_JOURNEY');
  });

  it('9. Rejects commercial journey without customer when lr_ids is empty', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        lr_ids: [],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMMERCIAL_JOURNEY_REQUIRES_LRS');
  });

  // --------------------------------------------------------------------------
  // 4. Anti-Bypass Invariants (Internal & Maintenance classification)
  // --------------------------------------------------------------------------
  it('10. Rejects internal_repositioning journey when billing_party_id is supplied', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'internal_repositioning',
        billing_party_id: customerA._id,
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Pune', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERNAL_JOURNEY_CANNOT_HAVE_BILLING_PARTY');
  });

  it('11. Rejects internal_repositioning journey when lr_ids are supplied', async () => {
    const lr = await createHelperLR();

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'internal_repositioning',
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Pune', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERNAL_JOURNEY_CANNOT_HAVE_LRS');
  });

  it('12. Rejects maintenance journey when billing_party_id or lr_ids are supplied', async () => {
    const resCustomer = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'maintenance',
        billing_party_id: customerA._id,
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Thane Workshop', state: 'Maharashtra' },
      });

    expect(resCustomer.status).toBe(400);
    expect(resCustomer.body.code).toBe('INTERNAL_JOURNEY_CANNOT_HAVE_BILLING_PARTY');

    const lr = await createHelperLR();
    const resLR = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'maintenance',
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Thane Workshop', state: 'Maharashtra' },
      });

    expect(resLR.status).toBe(400);
    expect(resLR.body.code).toBe('INTERNAL_JOURNEY_CANNOT_HAVE_LRS');
  });

  it('13. Rejects invalid journey_type enum string', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'third_party_brokerage',
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JOURNEY_TYPE');
  });

  // --------------------------------------------------------------------------
  // 5. Legacy Client Inferences (Omitted journey_type)
  // --------------------------------------------------------------------------
  it('14. Legacy client with customer and LRs infers commercial and creates journey', async () => {
    const lr = await createHelperLR();

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        // journey_type omitted
        billing_party_id: customerA._id,
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.journey_type).toBe('commercial');
    expect(res.body.journey.lr_ids).toHaveLength(1);
  });

  it('15. Legacy client with customer but NO LRs infers commercial and is blocked with 400', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        // journey_type omitted
        billing_party_id: customerA._id,
        // lr_ids omitted
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LR_REQUIRED_FOR_BILLING_PARTY_JOURNEY');
  });

  it('16. Legacy client with LRs but NO customer infers commercial and derives customer', async () => {
    const lr = await createHelperLR({ billing_party_id: customerA._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        // journey_type omitted
        // billing_party_id omitted
        lr_ids: [lr._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.journey_type).toBe('commercial');
    expect(res.body.journey.billing_party_id.toString()).toBe(customerA._id.toString());
  });

  it('17. Legacy client with neither customer nor LRs infers internal_repositioning', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        // journey_type omitted
        // billing_party_id omitted
        // lr_ids omitted
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Pune', state: 'Maharashtra' },
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.journey_type).toBe('internal_repositioning');
    expect(res.body.journey.billing_party_id).toBeUndefined();
    expect(res.body.journey.lr_ids).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 6. Legitimate Direct Dispatches
  // --------------------------------------------------------------------------
  it('18. Direct internal repositioning dispatch succeeds with empty LRs and no customer', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'internal_repositioning',
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Surat', state: 'Gujarat' },
        cargo_description: 'Empty Container Repositioning',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.journey_type).toBe('internal_repositioning');
    expect(res.body.journey.lr_ids).toHaveLength(0);
  });

  it('19. Direct maintenance dispatch succeeds with empty LRs and no customer', async () => {
    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'maintenance',
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Thane Service Center', state: 'Maharashtra' },
        cargo_description: 'Chassis Alignment & Engine Overhaul',
      });

    expect(res.status).toBe(201);
    expect(res.body.journey.journey_type).toBe('maintenance');
    expect(res.body.journey.lr_ids).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 7. Ineligible, Duplicate, and Branch Mismatched LRs
  // --------------------------------------------------------------------------
  it('20. Rejects invoiced LR from assignment to a new journey', async () => {
    const invoicedLR = await createHelperLR({ status: 'invoiced' });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [invoicedLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVOICED_LR_INELIGIBLE');
  });

  it('21. Rejects cancelled LR from assignment to a new journey', async () => {
    const cancelledLR = await createHelperLR({ status: 'cancelled' });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [cancelledLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANCELLED_LR_INELIGIBLE');
  });

  it('22. Rejects LR that is already assigned to another journey (HTTP 409 Conflict)', async () => {
    const existingJourneyId = new mongoose.Types.ObjectId();
    const assignedLR = await createHelperLR({ journey_id: existingJourneyId });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [assignedLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LR_ALREADY_ASSIGNED');
  });

  it('23. Rejects cross-tenant LR (Anti-IDOR protection)', async () => {
    // LR created in Tenant B's workspace
    const foreignLR = await Entry.create({
      company_id: tenantB.company._id,
      lr_no: `LR-FOREIGN-${Date.now()}`,
      bill_no: `BILL-FOREIGN-${Date.now()}`,
      bill_date: new Date(),
      lr_date: new Date(),
      vehicle_number: 'DL-01-AB-1234',
      from_location: 'Delhi',
      to_location: 'Jaipur',
      consignor: { name: 'Foreign Shipper' },
      consignee: { name: 'Foreign Receiver' },
      status: 'active',
      is_deleted: false,
    });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [foreignLR._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LR_NOT_FOUND');
  });

  it('24. Rejects combining LRs from different regional branches', async () => {
    const lrBranchA = await createHelperLR({ branch_id: branchA._id });
    const lrBranchB = await createHelperLR({ branch_id: branchB._id });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [lrBranchA._id, lrBranchB._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BRANCH_MISMATCH');
  });

  // --------------------------------------------------------------------------
  // 8. Trip Cancellation Unlinking
  // --------------------------------------------------------------------------
  it('25. Cancelling an active journey releases attached LRs back to unassigned pool', async () => {
    const lr1 = await createHelperLR();
    const lr2 = await createHelperLR();

    const createRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });

    expect(createRes.status).toBe(201);
    const journeyId = createRes.body.journey._id;

    // Verify LRs are assigned
    const preCheck1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    expect(preCheck1?.journey_id?.toString()).toBe(journeyId.toString());

    // Cancel the journey
    const cancelRes = await request(app)
      .put(`/api/operations/journeys/${journeyId}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip cancelled by customer request' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.journey.status).toBe('cancelled');

    // Verify LRs have journey_id unset and returned to pool
    const postCheck1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const postCheck2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(postCheck1?.journey_id).toBeUndefined();
    expect(postCheck2?.journey_id).toBeUndefined();
    expect(postCheck1?.status).toBe('active');
  });

  it('26. Cancelling a historical journey with no LRs cleanly succeeds without error', async () => {
    // Create direct journey without LRs (e.g. historical simulation)
    const directJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      journey_number: `JRN-HIST-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Pune' },
      start_odometer_kms: 1000,
      total_distance_kms: 0,
      starting_cash_advance: 0,
      total_diesel_litres: 0,
      total_diesel_cost: 0,
      advance_funded_diesel_cost: 0,
      total_driver_expenses: 0,
      actual_mileage_km_per_litre: 0,
      is_settled: false,
      delivery_status: 'pending',
      is_deleted: false,
    });

    const cancelRes = await request(app)
      .put(`/api/operations/journeys/${directJourney._id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Cancel empty run' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.journey.status).toBe('cancelled');
  });

  // --------------------------------------------------------------------------
  // 9. Historical Record Backward Compatibility (No Schema Default Coercion)
  // --------------------------------------------------------------------------
  it('27. Historical journey record lacking journey_type hydrates with undefined (no coercion to commercial)', async () => {
    const historicalJourney = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      billing_party_id: customerA._id,
      journey_number: `JRN-LEGACY-${Date.now()}`,
      status: 'active',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Nagpur' },
      start_odometer_kms: 50000,
      total_distance_kms: 0,
      starting_cash_advance: 0,
      total_diesel_litres: 0,
      total_diesel_cost: 0,
      advance_funded_diesel_cost: 0,
      total_driver_expenses: 0,
      actual_mileage_km_per_litre: 0,
      is_settled: false,
      delivery_status: 'pending',
      is_deleted: false,
      // Strictly NO journey_type and NO lr_ids passed
    });

    // Fetch raw and hydrated
    const hydrated = await TruckJourney.findById(historicalJourney._id, null, { skipTenantCheck: true });
    expect(hydrated?.journey_type).toBeUndefined();

    // Adding en-route diesel stop to historical journey does NOT demand LRs or fail
    const dieselRes = await request(app)
      .post(`/api/operations/journeys/${historicalJourney._id}/diesel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        filling_date: new Date(),
        fuel_quantity_litres: 100,
        rate_per_litre: 90,
        petrol_pump_name: 'BPCL Highway Pump',
        payment_mode: 'cash',
      });

    expect(dieselRes.status).toBe(200);

    // Verify after saving diesel stop, journey_type remains undefined
    const rehydrated = await TruckJourney.findById(historicalJourney._id, null, { skipTenantCheck: true });
    expect(rehydrated?.journey_type).toBeUndefined();
  });

  it('28. Pre-existing draft journey lacking LRs can be dispatched to active without error', async () => {
    const historicalDraft = await TruckJourney.create({
      company_id: tenantA.company._id,
      truck_id: truckA._id,
      driver_id: driverA._id,
      billing_party_id: customerA._id,
      journey_number: `JRN-DRAFT-HIST-${Date.now()}`,
      status: 'draft',
      from_location: { city: 'Mumbai' },
      to_location: { city: 'Nagpur' },
      start_odometer_kms: 50000,
      total_distance_kms: 0,
      starting_cash_advance: 0,
      total_diesel_litres: 0,
      total_diesel_cost: 0,
      advance_funded_diesel_cost: 0,
      total_driver_expenses: 0,
      actual_mileage_km_per_litre: 0,
      is_settled: false,
      delivery_status: 'pending',
      is_deleted: false,
    });

    const dispatchRes = await request(app)
      .put(`/api/operations/journeys/${historicalDraft._id}/dispatch`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({});

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.journey.status).toBe('active');
  });

  // --------------------------------------------------------------------------
  // 10. Entry Listing Query Filter (?unassigned=true)
  // --------------------------------------------------------------------------
  it('29. GET /api/commercial/entries?unassigned=true filters only unassigned active LRs', async () => {
    const assignedLR = await createHelperLR({ journey_id: new mongoose.Types.ObjectId() });
    const invoicedLR = await createHelperLR({ status: 'invoiced' });
    const unassignedLR = await createHelperLR();

    const res = await request(app)
      .get('/api/commercial/entries?unassigned=true')
      .set('Authorization', `Bearer ${tenantA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toBeDefined();

    const ids = res.body.entries.map((e: any) => e._id.toString());
    expect(ids).toContain(unassignedLR._id.toString());
    expect(ids).not.toContain(assignedLR._id.toString());
    expect(ids).not.toContain(invoicedLR._id.toString());
  });

  // --------------------------------------------------------------------------
  // 11. Concurrency and Atomicity Safeguards
  // --------------------------------------------------------------------------
  it('30. Two concurrent journey creation requests cannot assign the same LR (one succeeds, one gets 409)', async () => {
    const lrShared = await createHelperLR();

    const truck2 = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04CD${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Ashok Leyland',
      model: '4825',
      body_type: 'Container',
      tonnage_capacity: 40,
      status: 'available',
      current_odometer_kms: 20000,
    });

    const driver2 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Sunil Shinde',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });

    // Launch two requests simultaneously targeting the exact same LR
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
    // Exactly one must succeed (201) and the other must be rejected (409 Conflict)
    expect(statuses).toEqual([201, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.code).toBe('LR_ALREADY_ASSIGNED');

    const winningRes = res1.status === 201 ? res1 : res2;
    const winningJourneyId = winningRes.body.journey._id;

    // Check LR only points to winning journey
    const refreshedLR = await Entry.findById(lrShared._id, null, { skipTenantCheck: true });
    expect(refreshedLR?.journey_id?.toString()).toBe(winningJourneyId.toString());

    // Verify only ONE journey exists referencing this LR
    const journeysWithLR = await TruckJourney.find(
      { lr_ids: lrShared._id },
      null,
      { skipTenantCheck: true }
    );
    expect(journeysWithLR).toHaveLength(1);
    expect(journeysWithLR[0]._id.toString()).toBe(winningJourneyId.toString());
  });

  it('31. Partial linking failure: if any LR in batch is ineligible, transaction rolls back with zero LRs linked', async () => {
    const lrGood = await createHelperLR();
    const lrAlreadyAssigned = await createHelperLR({ journey_id: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [lrGood._id, lrAlreadyAssigned._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LR_ALREADY_ASSIGNED');

    // lrGood must NOT have been linked (atomic rollback)
    const checkGood = await Entry.findById(lrGood._id, null, { skipTenantCheck: true });
    expect(checkGood?.journey_id).toBeUndefined();

    // No journey was created
    const createdJourneys = await TruckJourney.find(
      { lr_ids: lrGood._id },
      null,
      { skipTenantCheck: true }
    );
    expect(createdJourneys).toHaveLength(0);
  });

  it('32. Scoped cancellation unlinking: only unlinks LRs belonging to cancelled journey and active tenant', async () => {
    const lrTenantA = await createHelperLR();

    const truckB = await Truck.create({
      company_id: tenantB.company._id,
      truck_no: 'DL01XY9999',
      make: 'Tata',
      model: 'Prima',
      body_type: 'Container',
      tonnage_capacity: 25,
      status: 'available',
    });

    const driverB = await Driver.create({
      company_id: tenantB.company._id,
      name: 'Tenant B Driver',
      phone: '+919811223344',
      license_number: 'DL-01-TB',
      status: 'active',
    });

    const customerB = await BillingParty.create({
      company_id: tenantB.company._id,
      name: 'Tenant B Shipper',
      billing_address: { street: 'Connaught Place', city: 'Delhi', state_code: '07' },
      status: 'active',
    });

    const lrTenantB = await Entry.create({
      company_id: tenantB.company._id,
      lr_no: `LR-B-${Date.now()}`,
      bill_no: `BILL-B-${Date.now()}`,
      bill_date: new Date(),
      lr_date: new Date(),
      truck_id: truckB._id,
      driver_id: driverB._id,
      driver_name: driverB.name,
      driver_phone: driverB.phone,
      vehicle_number: truckB.truck_no,
      from_location: 'Delhi',
      to_location: 'Jaipur',
      consignor: { name: 'Shipper B' },
      consignee: { name: 'Receiver B' },
      billing_party_id: customerB._id,
      status: 'active',
      is_deleted: false,
    });

    // Create Journey A
    const resA = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        lr_ids: [lrTenantA._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'draft',
      });
    expect(resA.status).toBe(201);
    const journeyAId = resA.body.journey._id;

    // Create Journey B in Tenant B
    const resB = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({
        truck_id: truckB._id,
        driver_id: driverB._id,
        journey_type: 'commercial',
        billing_party_id: customerB._id,
        lr_ids: [lrTenantB._id],
        from_location: { city: 'Delhi', state: 'Delhi' },
        to_location: { city: 'Jaipur', state: 'Rajasthan' },
        status: 'draft',
      });
    expect(resB.status).toBe(201);
    const journeyBId = resB.body.journey._id;

    // Cancel Journey A in Tenant A
    const cancelRes = await request(app)
      .put(`/api/operations/journeys/${journeyAId}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Cancel journey A' });
    expect(cancelRes.status).toBe(200);

    // Verify LR in Tenant A has journey_id cleared
    const checkA = await Entry.findById(lrTenantA._id, null, { skipTenantCheck: true });
    expect(checkA?.journey_id).toBeUndefined();

    // Verify LR in Tenant B is completely unaffected and still points to Journey B
    const checkB = await Entry.findById(lrTenantB._id, null, { skipTenantCheck: true });
    expect(checkB?.journey_id?.toString()).toBe(journeyBId.toString());
  });

  // ==========================================================================
  // 9. Complete End-to-End Integration Flow
  // ==========================================================================
  it('33. Full end-to-end lifecycle verification: LR creation, selection, commercial journey linking, detail inspection, delivery POD decoupled from invoicing, and cancellation rollback', async () => {
    // 1. Create two LRs for Customer A under Branch A
    const lr1Res = await request(app)
      .post('/api/commercial/entries')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        billing_party_id: customerA._id,
        branch_id: branchA._id,
        vehicle_number: truckA.truck_no,
        from_location: 'Mumbai, Maharashtra',
        to_location: 'Delhi, Delhi',
        consignor: { name: 'Tata Motors Pune' },
        consignee: { name: 'Tata Motors Okhla' },
        package_count: 50,
        packaging_type: 'Pallets',
        goods_description: 'Auto Components',
        actual_weight_tonnes: 12.5,
        cbm_volume: 18.0,
        freight_amount: 35000,
        freight_terms: 'to_be_billed',
      });
    expect(lr1Res.status).toBe(201);
    const lr1 = lr1Res.body.entry;

    const lr2Res = await request(app)
      .post('/api/commercial/entries')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        truck_id: truckA._id,
        driver_id: driverA._id,
        billing_party_id: customerA._id,
        branch_id: branchA._id,
        vehicle_number: truckA.truck_no,
        from_location: 'Mumbai, Maharashtra',
        to_location: 'Delhi, Delhi',
        consignor: { name: 'Tata Steel' },
        consignee: { name: 'Tata Steel Delhi Depot' },
        package_count: 30,
        packaging_type: 'Bundles',
        goods_description: 'Steel Rods',
        actual_weight_tonnes: 15.5,
        cbm_volume: 12.0,
        freight_amount: 45000,
        freight_terms: 'to_be_billed',
      });
    expect(lr2Res.status).toBe(201);
    const lr2 = lr2Res.body.entry;

    // 2. Query unassigned LRs
    const unassignedRes = await request(app)
      .get('/api/commercial/entries?unassigned=true')
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(unassignedRes.status).toBe(200);
    const unassignedIds = unassignedRes.body.entries.map((e: any) => e._id);
    expect(unassignedIds).toContain(lr1._id);
    expect(unassignedIds).toContain(lr2._id);

    // 3. Create Commercial Journey bundling both LRs
    const createJourneyRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        branch_id: branchA._id,
        truck_id: truckA._id,
        driver_id: driverA._id,
        lr_ids: [lr1._id, lr2._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Delhi', state: 'Delhi' },
        start_odometer_kms: 50000,
        freight_rate: 80000,
        status: 'active',
      });
    expect(createJourneyRes.status).toBe(201);
    const journey = createJourneyRes.body.journey;
    expect(journey.lr_ids).toHaveLength(2);
    expect(journey.loaded_weight_tonnes).toBe(28.0); // 12.5 + 15.5
    expect(journey.cbm_volume).toBe(30.0); // 18 + 12
    expect(journey.cargo_description).toBe('Auto Components, Steel Rods');

    // 4. Verify persisted bidirectional links
    const savedLr1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const savedLr2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(savedLr1?.journey_id?.toString()).toBe(journey._id.toString());
    expect(savedLr2?.journey_id?.toString()).toBe(journey._id.toString());

    // 5. Inspect Journey Detail endpoint (GET /api/operations/journeys/:id)
    const detailRes = await request(app)
      .get(`/api/operations/journeys/${journey._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.journey.lr_ids).toHaveLength(2);
    expect(detailRes.body.journey.lr_ids[0].lr_no).toBe(lr1.lr_no);
    expect(detailRes.body.journey.lr_ids[0].status).toBe('active');
    expect(detailRes.body.journey.lr_ids[1].lr_no).toBe(lr2.lr_no);
    expect(detailRes.body.journey.lr_ids[1].status).toBe('active');

    // 6. Complete Delivery and Upload POD
    const completeRes = await request(app)
      .post(`/api/operations/journeys/${journey._id}/pod`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        contact_name: 'Warehouse Incharge Mr. Sharma',
        end_odometer_kms: 51450,
        pod_slip_url: 'https://storage.fleetflow.com/pod_sample.pdf',
        notes: 'Goods received in good condition.',
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.journey.delivery_status).toBe('delivered');
    expect(completeRes.body.journey.status).toBe('completed');

    // 7. Verify decoupled Invoicing status & NO automatic invoices or ledger postings
    const postDeliveryLr1 = await Entry.findById(lr1._id, null, { skipTenantCheck: true });
    const postDeliveryLr2 = await Entry.findById(lr2._id, null, { skipTenantCheck: true });
    expect(postDeliveryLr1?.status).toBe('active'); // Still unbilled!
    expect(postDeliveryLr2?.status).toBe('active'); // Still unbilled!
    expect(postDeliveryLr1?.invoice_id).toBeUndefined();
    expect(postDeliveryLr2?.invoice_id).toBeUndefined();

    const invoiceCount = await Invoice.countDocuments({ company_id: tenantA.company._id }, { skipTenantCheck: true });
    expect(invoiceCount).toBe(0); // Zero automatic invoices created!

    // Create another truck for trip 2
    const truck2 = await Truck.create({
      company_id: tenantA.company._id,
      truck_no: `MH04CD${Math.floor(1000 + Math.random() * 9000)}`,
      make: 'Eicher',
      model: 'Pro 6028',
      tonnage_capacity: 25,
      status: 'available',
    });
    const driver2 = await Driver.create({
      company_id: tenantA.company._id,
      name: 'Sunil Jadhav',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      license_number: `DL-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
    });

    // 8. Test Cancellation & LR Release on a second journey
    // Create LR3 and LR4 for truck2 & driver2
    const lr3 = await createHelperLR({
      company_id: tenantA.company._id,
      billing_party_id: customerA._id,
      branch_id: branchA._id,
      truck_id: truck2._id,
      driver_id: driver2._id,
      vehicle_number: truck2.truck_no,
      driver_name: driver2.name,
      driver_phone: driver2.phone,
      actual_weight_tonnes: 10,
    });
    const lr4 = await createHelperLR({
      company_id: tenantA.company._id,
      billing_party_id: customerA._id,
      branch_id: branchA._id,
      truck_id: truck2._id,
      driver_id: driver2._id,
      vehicle_number: truck2.truck_no,
      driver_name: driver2.name,
      driver_phone: driver2.phone,
      actual_weight_tonnes: 8,
    });

    const journey2Res = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        journey_type: 'commercial',
        billing_party_id: customerA._id,
        branch_id: branchA._id,
        truck_id: truck2._id,
        driver_id: driver2._id,
        lr_ids: [lr3._id, lr4._id],
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Nagpur', state: 'Maharashtra' },
        status: 'active',
      });
    expect(journey2Res.status).toBe(201);
    const journey2Id = journey2Res.body.journey._id;

    // Both LR3 and LR4 are linked
    const checkLr3Linked = await Entry.findById(lr3._id, null, { skipTenantCheck: true });
    expect(checkLr3Linked?.journey_id?.toString()).toBe(journey2Id.toString());

    // Cancel Journey 2
    const cancelJourney2 = await request(app)
      .put(`/api/operations/journeys/${journey2Id}/cancel`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ reason: 'Trip cancelled by customer request' });
    expect(cancelJourney2.status).toBe(200);
    expect(cancelJourney2.body.journey.status).toBe('cancelled');

    // Both LR3 and LR4 have journey_id unset and return to unassigned pool
    const releasedLr3 = await Entry.findById(lr3._id, null, { skipTenantCheck: true });
    const releasedLr4 = await Entry.findById(lr4._id, null, { skipTenantCheck: true });
    expect(releasedLr3?.journey_id).toBeUndefined();
    expect(releasedLr4?.journey_id).toBeUndefined();
    expect(releasedLr3?.status).toBe('active');
    expect(releasedLr4?.status).toBe('active');

    // 9. Verify Direct Internal Repositioning & Maintenance Journeys remain supported without LRs
    const repositioningRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        journey_type: 'internal_repositioning',
        branch_id: branchA._id,
        truck_id: truck2._id,
        driver_id: driver2._id,
        from_location: { city: 'Nagpur', state: 'Maharashtra' },
        to_location: { city: 'Mumbai', state: 'Maharashtra' },
        status: 'draft',
      });
    expect(repositioningRes.status).toBe(201);
    expect(repositioningRes.body.journey.journey_type).toBe('internal_repositioning');
    expect(repositioningRes.body.journey.lr_ids).toHaveLength(0);
    expect(repositioningRes.body.journey.billing_party_id).toBeUndefined();

    const maintenanceRes = await request(app)
      .post('/api/operations/journeys')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        journey_type: 'maintenance',
        branch_id: branchA._id,
        truck_id: truck2._id,
        driver_id: driver2._id,
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Thane Garage', state: 'Maharashtra' },
        status: 'draft',
      });
    expect(maintenanceRes.status).toBe(201);
    expect(maintenanceRes.body.journey.journey_type).toBe('maintenance');
    expect(maintenanceRes.body.journey.lr_ids).toHaveLength(0);
    expect(maintenanceRes.body.journey.billing_party_id).toBeUndefined();
  });
});
