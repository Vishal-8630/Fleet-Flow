import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Entry } from '../../models/Entry.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { BillingParty } from '../../models/BillingParty.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { VehicleEntry } from '../../models/VehicleEntry.js';
import { Invoice } from '../../models/Invoice.js';
import { PortalSession } from '../../models/PortalSession.js';
import { telephonyService } from '../../controllers/portalController.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

let ipCounter = 100;
function nextIp() {
  ipCounter++;
  return `10.42.0.${ipCounter}`;
}

function makeEntryData(companyId: any, overrides: any = {}) {
  const num = Math.floor(Math.random() * 90000) + 10000;
  return {
    company_id: companyId,
    bill_no: `BILL-${num}`,
    lr_no: `LR-${num}`,
    consignor: { name: 'Shipper Co', phone: '+919876543210' },
    consignee: { name: 'Receiver Co', phone: '+919876543211' },
    vehicle_number: 'MH12-AB-1234',
    from_location: 'Mumbai',
    to_location: 'Delhi',
    goods_description: 'Industrial Equipment',
    package_count: 10,
    packaging_type: 'Boxes',
    actual_weight_tonnes: 5,
    freight_amount: 25000,
    status: 'active',
    ...overrides,
  };
}

describe('Batch 4: Portals, Tracking, Live Map & Abuse Defense (TEST-004)', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let truckA: any;
  let driverA: any;
  let partyA: any;

  beforeEach(async () => {
    await Entry.init();
    await PortalSession.init();

    tenantA = await createTestTenant({ name: 'Apex Logistics' });
    tenantB = await createTestTenant({ name: 'Beacon Freight' });
  });

  // ==========================================================================
  // 1. ISS-005: Public Tracking Privacy, Cryptographic Tokens & IDOR Defenses
  // ==========================================================================
  describe('1. ISS-005: Public Consignment Tracking & IDOR Elimination', () => {
    beforeEach(async () => {
      truckA = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'GJ05-AA-1111',
        make: 'Tata Motors',
        model: 'Prima',
        tonnage_capacity: 15,
        status: 'available',
      });
      driverA = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Ramesh Patel',
        phone: '+919876543210',
        license_number: 'GJ0520200001',
        status: 'active',
      });
      partyA = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Apex Consignments Ltd',
        phone: '+919876543299',
        status: 'active',
        billing_address: { city: 'Surat', state: 'Gujarat' },
      });
    });

    it('rejects unverified raw sequential LR lookup with HTTP 400', async () => {
      const clientIp = nextIp();
      await Entry.create(makeEntryData(tenantA.company._id, { lr_no: 'LR-1001', bill_no: 'BILL-1001' }));

      // 1. Direct path lookup with raw LR number
      const resPath = await request(app)
        .get('/api/public/track/LR-1001')
        .set('X-Forwarded-For', clientIp);
      expect(resPath.status).toBe(400);
      expect(resPath.body.error).toMatch(/Valid tracking token or verified query credentials.*required/i);

      // 2. Query param lookup with raw LR number only
      const resQuery = await request(app)
        .get('/api/public/track?lr_no=LR-1001')
        .set('X-Forwarded-For', clientIp);
      expect(resQuery.status).toBe(400);
      expect(resQuery.body.error).toMatch(/Valid tracking token or verified query credentials.*required/i);
    });

    it('successfully retrieves tracking DTO via cryptographically unguessable token (HTTP 200)', async () => {
      const clientIp = nextIp();
      const entry = await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-2001',
          bill_no: 'BILL-2001',
          from_location: 'Pune',
          to_location: 'Bangalore',
          vehicle_number: 'MH12-AB-9876',
          consignor: { name: 'Tata Motors', phone: '+919811111111' },
          consignee: { name: 'Apex Hub', phone: '+919822222222' },
          goods_description: 'Auto Components',
          package_count: 50,
          packaging_type: 'Crates',
          actual_weight_tonnes: 8.5,
          freight_amount: 45000,
        })
      );

      expect(entry.tracking_token).toBeDefined();
      expect(entry.tracking_token).toMatch(/^trk_[a-f0-9]{32}$/);

      // Query via path param /:token
      const res = await request(app)
        .get(`/api/public/track/${entry.tracking_token}`)
        .set('X-Forwarded-For', clientIp);
      expect(res.status).toBe(200);

      // Verify contract matches PublicTrackingPage frontend expectation
      expect(res.body.carrier.company_name).toBe(tenantA.company.name);
      expect(res.body.transit.origin).toBe('Pune');
      expect(res.body.transit.destination).toBe('Bangalore');
      expect(res.body.transit.current_status).toBe('BOOKED');
      expect(res.body.consignment.consignor_name).toBe('Tata Motors');
      expect(res.body.consignment.consignee_name).toBe('Apex Hub');
      expect(res.body.milestones).toHaveLength(5);

      // Query via query param ?token=...
      const resQuery = await request(app)
        .get(`/api/public/track?token=${entry.tracking_token}`)
        .set('X-Forwarded-For', clientIp);
      expect(resQuery.status).toBe(200);
      expect(resQuery.body.tracking_reference).toBe(entry.tracking_token);
    });

    it('strictly redacts commercial financials and sensitive driver PII from tracking payload', async () => {
      const clientIp = nextIp();
      const entry = await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-REDACT-01',
          bill_no: 'BILL-REDACT-01',
          from_location: 'Ahmedabad',
          to_location: 'Surat',
          vehicle_number: 'GJ01-XX-1234',
          consignor: { name: 'Chemical Corp', phone: '+919876543210' },
          consignee: { name: 'Pharma Ltd', phone: '+919123456789' },
          freight_amount: 88000,
          rate_per_tonne: 4400,
        })
      );

      const res = await request(app)
        .get(`/api/public/track/${entry.tracking_token}`)
        .set('X-Forwarded-For', clientIp);
      expect(res.status).toBe(200);

      // Financial redaction checks
      expect(res.body.freight_amount).toBeUndefined();
      expect(res.body.rate_per_tonne).toBeUndefined();
      expect(res.body.advance).toBeUndefined();
      expect(res.body.balance_amount).toBeUndefined();
      expect(res.body.commercial).toBeUndefined();

      // PII redaction checks: full phones are not exposed
      expect(res.body.consignment.consignor_phone).toBeUndefined();
      expect(res.body.consignment.consignee_phone).toBeUndefined();

      // Vehicle number is masked
      expect(res.body.transit.vehicle_number).toBe('GJ01****34');
    });

    it('supports verified 3-factor fallback lookup for historical entries without tokens', async () => {
      const clientIp = nextIp();
      const historicalEntry = await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-HIST-100',
          bill_no: 'BILL-HIST-100',
          from_location: 'Nagpur',
          to_location: 'Hyderabad',
          consignor: { name: 'Nagpur Oranges', phone: '+919988776655' },
          consignee: { name: 'Hyderabad Supermarket', phone: '+919911223344' },
          tracking_token: null,
        })
      );

      // 1. Raw lookup without 3 factors is rejected
      const rawRes = await request(app)
        .get('/api/public/track/LR-HIST-100')
        .set('X-Forwarded-For', clientIp);
      expect(rawRes.status).toBe(400);

      // 2. 3-factor lookup with correct company_code, lr_no, and consignor phone succeeds
      const validRes = await request(app)
        .get(
          `/api/public/track?company_code=${tenantA.company.slug}&lr_no=LR-HIST-100&phone=%2B919988776655`
        )
        .set('X-Forwarded-For', clientIp);
      expect(validRes.status).toBe(200);
      expect(validRes.body.bill_reference).toBe('BILL-HIST-100');
      expect(validRes.body.carrier.company_name).toBe(tenantA.company.name);

      // 3. 3-factor lookup with consignee phone also succeeds
      const consigneeRes = await request(app)
        .get(
          `/api/public/track?company_code=${tenantA.company.slug}&lr_no=LR-HIST-100&phone=%2B919911223344`
        )
        .set('X-Forwarded-For', clientIp);
      expect(consigneeRes.status).toBe(200);

      // 4. 3-factor lookup with mismatched phone returns HTTP 404 (does not leak record)
      const invalidPhoneRes = await request(app)
        .get(
          `/api/public/track?company_code=${tenantA.company.slug}&lr_no=LR-HIST-100&phone=%2B919000000000`
        )
        .set('X-Forwarded-For', clientIp);
      expect(invalidPhoneRes.status).toBe(404);
    });

    it('prevents cross-tenant lookup: Tenant A consignment cannot be tracked with Tenant B credentials', async () => {
      const clientIp = nextIp();
      await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-SECRET-99',
          bill_no: 'BILL-SECRET-99',
          from_location: 'Delhi',
          to_location: 'Chandigarh',
          consignor: { name: 'Confidential Client', phone: '+919876540000' },
        })
      );

      // Attempt lookup using Tenant B's company slug
      const res = await request(app)
        .get(
          `/api/public/track?company_code=${tenantB.company.slug}&lr_no=LR-SECRET-99&phone=%2B919876540000`
        )
        .set('X-Forwarded-For', clientIp);
      expect(res.status).toBe(404);
    });

    it('enforces 128-bit cryptographic uniqueness on tracking tokens across entries', async () => {
      const entry1 = await Entry.create(makeEntryData(tenantA.company._id, { lr_no: 'LR-ENT-1', bill_no: 'BILL-ENT-1' }));
      const entry2 = await Entry.create(makeEntryData(tenantA.company._id, { lr_no: 'LR-ENT-2', bill_no: 'BILL-ENT-2' }));

      expect(entry1.tracking_token).not.toBe(entry2.tracking_token);
      expect(entry1.tracking_token?.length).toBe(36); // 'trk_' (4) + 32 hex chars = 36
    });

    it('recovers safely via duplicate key retry logic in createEntry', async () => {
      const fixedToken = `trk_test_collision_${Date.now()}`;

      // Create first entry with fixedToken
      await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-COL-01',
          bill_no: 'BILL-COL-01',
          tracking_token: fixedToken,
        })
      );

      // Mock randomBytes once to simulate collision on fixedToken, then return fresh token
      let callCount = 0;
      const originalRandomBytes = crypto.randomBytes;
      vi.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
        callCount++;
        if (callCount === 1) {
          return Buffer.from(fixedToken.replace('trk_', '').padEnd(32, '0').slice(0, 32), 'hex');
        }
        return originalRandomBytes(size);
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          lr_no: 'LR-COL-02',
          billing_party_id: partyA._id,
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: 'Surat',
          to_location: 'Delhi',
          vehicle_number: 'GJ05-AA-1111',
          consignor: { name: 'Shipper 1' },
          consignee: { name: 'Receiver 1' },
          freight_amount: 15000,
        });

      expect(res.status).toBe(201);
      expect(res.body.entry.tracking_token).toBeDefined();
      expect(res.body.entry.tracking_token).not.toBe(fixedToken);

      vi.restoreAllMocks();
    });

    it('does not retry on collision for unrelated unique indexes (e.g. duplicate lr_no) and preserves error', async () => {
      // 1. Existing LR check returns 409 Conflict without entering save loop
      await Entry.create(makeEntryData(tenantA.company._id, { lr_no: 'LR-EXISTING-01' }));
      const resExisting = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          lr_no: 'LR-EXISTING-01',
          billing_party_id: partyA._id,
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: 'Surat',
          to_location: 'Delhi',
          vehicle_number: 'GJ05-AA-1111',
          consignor: { name: 'Shipper 1' },
          consignee: { name: 'Receiver 1' },
          freight_amount: 15000,
        });
      expect(resExisting.status).toBe(409);
      expect(resExisting.body.error).toContain('already exists');

      // 2. Direct E11000 collision on an unrelated index during save() throws immediately without retrying
      let saveAttempts = 0;
      const saveSpy = vi.spyOn(Entry.prototype, 'save').mockImplementation(async function () {
        saveAttempts++;
        const err: any = new Error('E11000 duplicate key error dup key: { company_id: 1, lr_no: "LR-CONCURRENT-01" }');
        err.code = 11000;
        err.keyPattern = { company_id: 1, lr_no: 1 };
        throw err;
      });

      const resCollision = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          lr_no: 'LR-CONCURRENT-01',
          billing_party_id: partyA._id,
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: 'Mumbai',
          to_location: 'Kolkata',
          vehicle_number: 'MH12-AB-2222',
          consignor: { name: 'Shipper 2' },
          consignee: { name: 'Receiver 2' },
          freight_amount: 25000,
        });

      // Must be rejected with HTTP 400
      expect(resCollision.status).toBe(400);
      expect(resCollision.body.error).toMatch(/duplicate key|E11000/i);
      // Crucial: Must NOT have retried (attempted exactly 1 time, not 3 times)
      expect(saveAttempts).toBe(1);

      saveSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 2. ISS-006: Stakeholder Portal Authentication & Real Data Connectivity
  // ==========================================================================
  describe('2. ISS-006: Stakeholder Portals Authentication & Real Data Connectivity', () => {
    it('customer portal: sends OTP to registered BillingParty, verifies, and accesses scoped dashboard', async () => {
      const clientIp = nextIp();
      const customerPhone = '+919876500001';

      // 1. Seed customer in Tenant A
      const billingParty = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Acme Industries',
        phone: customerPhone,
        email: 'acme@example.com',
      });

      // 2. Seed consignments and invoice for customer
      await Entry.create(
        makeEntryData(tenantA.company._id, {
          lr_no: 'LR-ACME-01',
          bill_no: 'BILL-ACME-01',
          consignor: { name: 'Acme Industries', phone: customerPhone },
        })
      );

      await Invoice.create({
        company_id: tenantA.company._id,
        party_id: billingParty._id,
        billing_party_id: billingParty._id,
        billing_party_snapshot: { name: billingParty.name },
        place_of_supply: 'MH',
        due_date: new Date(),
        invoice_number: 'INV-ACME-01',
        invoice_date: new Date(),
        total_amount: 25000,
        paid_amount: 10000,
        balance_amount: 15000,
        status: 'partially_paid',
        items: [],
      });

      // 3. Request OTP
      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone: customerPhone,
          company_id: tenantA.company._id.toString(),
        });
      expect(otpRes.status).toBe(200);
      expect(otpRes.body.dev_otp).toBeDefined();

      const receivedOtp = otpRes.body.dev_otp;

      // 4. Verify OTP
      const verifyRes = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone: customerPhone,
          company_id: tenantA.company._id.toString(),
          otp: receivedOtp,
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeDefined();
      expect(verifyRes.body.portal_type).toBe('customer');

      const portalToken = verifyRes.body.token;

      // 5. Access Customer Dashboard
      const dashRes = await request(app)
        .get('/api/portal/customer/dashboard')
        .set('Authorization', `Bearer ${portalToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.customer.name).toBe('Acme Industries');
      expect(dashRes.body.consignments).toHaveLength(1);
      expect(dashRes.body.consignments[0].lr_no).toBe('LR-ACME-01');
      expect(dashRes.body.invoices).toHaveLength(1);
      expect(dashRes.body.invoices[0].invoice_number).toBe('INV-ACME-01');
      expect(dashRes.body.invoices[0].balance_amount).toBe(15000);
    });

    it('rejects customer OTP request for unregistered phone with HTTP 404', async () => {
      const clientIp = nextIp();
      const res = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone: '+919999999999',
          company_id: tenantA.company._id.toString(),
        });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No customer account found/i);
    });

    it('driver portal: authenticates driver and fetches active trip status', async () => {
      const clientIp = nextIp();
      const driverPhone = '+919876500002';

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Rajesh Driver',
        phone: driverPhone,
        license_number: 'DL-MH-12345',
        running_advance_balance: 0,
      });

      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12-TRUCK-01',
        make: 'BharatBenz',
        model: '2823R',
        body_type: 'Container',
        tonnage_capacity: 18,
        status: 'active',
      });

      await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: 'JRN-001',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Mumbai' },
        to_location: { city: 'Nagpur' },
        start_odometer_kms: 50000,
        status: 'active',
        start_date: new Date(),
      });

      // Request OTP
      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'driver',
          phone: driverPhone,
          company_id: tenantA.company._id.toString(),
        });
      expect(otpRes.status).toBe(200);

      // Verify OTP
      const verifyRes = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'driver',
          phone: driverPhone,
          company_id: tenantA.company._id.toString(),
          otp: otpRes.body.dev_otp,
        });
      expect(verifyRes.status).toBe(200);
      const portalToken = verifyRes.body.token;

      // Fetch driver active trip
      const tripRes = await request(app)
        .get('/api/portal/driver/trip')
        .set('Authorization', `Bearer ${portalToken}`);

      expect(tripRes.status).toBe(200);
      expect(tripRes.body.trip).toBeDefined();
      expect(tripRes.body.trip.journey_number).toBe('JRN-001');
      expect(tripRes.body.trip.truck_id.truck_no).toBe('MH12-TRUCK-01');
    });

    it('vendor portal: authenticates BalanceParty and retrieves scoped movements & payables', async () => {
      const clientIp = nextIp();
      const vendorPhone = '+919876500003';

      // 1. Seed Vendor for Tenant A
      const vendor = await BalanceParty.create({
        company_id: tenantA.company._id,
        party_name: 'Balaji Fleet Suppliers',
        party_type: 'supplier',
        phone: vendorPhone,
        email: 'balaji@example.com',
        current_balance: 75000,
        bank_details: {
          account_number: '1234567890',
          ifsc_code: 'HDFC0001234',
          bank_name: 'HDFC Bank',
        },
      });

      // Seed Vendor movements for Tenant A
      await VehicleEntry.create({
        company_id: tenantA.company._id,
        balance_party_id: vendor._id,
        entry_number: 'VE-001',
        entry_date: new Date(),
        vehicle_number: 'MH14-VE-9999',
        from_location: 'Nagpur',
        to_location: 'Mumbai',
        freight_amount: 50000,
        driver_cash_advance: 8000,
        net_balance_due: 42000,
        status: 'pending',
      });

      // Seed movement for another vendor (must NOT appear in Balaji dashboard)
      const otherVendor = await BalanceParty.create({
        company_id: tenantA.company._id,
        party_name: 'Other Transporter',
        party_type: 'transporter',
        phone: '+919876500004',
      });

      await VehicleEntry.create({
        company_id: tenantA.company._id,
        balance_party_id: otherVendor._id,
        entry_number: 'VE-OTHER-01',
        entry_date: new Date(),
        vehicle_number: 'KA01-ZZ-0001',
        from_location: 'Bangalore',
        to_location: 'Chennai',
        freight_amount: 30000,
        net_balance_due: 25000,
        status: 'pending',
      });

      // 2. Request Vendor OTP
      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'vendor',
          phone: vendorPhone,
          company_id: tenantA.company._id.toString(),
        });
      expect(otpRes.status).toBe(200);

      // 3. Verify OTP
      const verifyRes = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'vendor',
          phone: vendorPhone,
          company_id: tenantA.company._id.toString(),
          otp: otpRes.body.dev_otp,
        });
      expect(verifyRes.status).toBe(200);
      const vendorToken = verifyRes.body.token;

      // 4. Access Vendor Dashboard
      const dashRes = await request(app)
        .get('/api/portal/vendor/dashboard')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.vendor.name).toBe('Balaji Fleet Suppliers');
      expect(dashRes.body.summary.total_payables).toBe(42000);
      expect(dashRes.body.movements).toHaveLength(1);
      expect(dashRes.body.movements[0].entry_number).toBe('VE-001');
      expect(dashRes.body.movements[0].vehicle_number).toBe('MH14-VE-9999');
    });

    it('enforces cross-tenant and cross-vendor isolation on vendor dashboard', async () => {
      const clientIp = nextIp();
      const vendorB = await BalanceParty.create({
        company_id: tenantB.company._id,
        party_name: 'Beacon Vendor B',
        party_type: 'supplier',
        phone: '+919876500005',
      });

      // Get Vendor B token
      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'vendor',
          phone: '+919876500005',
          company_id: tenantB.company._id.toString(),
        });
      const verifyRes = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'vendor',
          phone: '+919876500005',
          company_id: tenantB.company._id.toString(),
          otp: otpRes.body.dev_otp,
        });
      const tokenB = verifyRes.body.token;

      // Vendor B queries dashboard — should see 0 movements from Tenant A
      const dashRes = await request(app)
        .get('/api/portal/vendor/dashboard')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.movements).toHaveLength(0);
      expect(dashRes.body.summary.total_trips).toBe(0);
    });
  });

  // ==========================================================================
  // 3. ISS-007: Live Fleet Map Schema & Projection Fixes
  // ==========================================================================
  describe('3. ISS-007: Live Fleet Map Schema & Projection Alignment', () => {
    it('returns active trucks matching status active with truck_no and body_type populated', async () => {
      // Seed 2 active trucks, 1 in maintenance, 1 decommissioned
      await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12-LIVE-01',
        make: 'Tata',
        model: 'Signa 4825',
        body_type: 'Container',
        tonnage_capacity: 25,
        status: 'active',
      });

      await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12-LIVE-02',
        make: 'Ashok Leyland',
        model: 'Captain',
        body_type: 'Trailer',
        tonnage_capacity: 35,
        status: 'available',
      });

      await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12-MAINT-01',
        make: 'Eicher',
        model: 'Pro 6028',
        body_type: 'Open',
        tonnage_capacity: 16,
        status: 'in_maintenance',
      });

      // Tenant B truck (must not appear)
      await Truck.create({
        company_id: tenantB.company._id,
        truck_no: 'DL01-BETA-01',
        make: 'Volvo',
        model: 'FM420',
        body_type: 'Tanker',
        tonnage_capacity: 40,
        status: 'active',
      });

      const res = await request(app)
        .get('/api/telematics/live/fleet')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.trucks).toHaveLength(2);

      const truckNos = res.body.trucks.map((t: any) => t.truck_no);
      expect(truckNos).toContain('MH12-LIVE-01');
      expect(truckNos).toContain('MH12-LIVE-02');
      expect(truckNos).not.toContain('MH12-MAINT-01');
      expect(truckNos).not.toContain('DL01-BETA-01');

      // Verify fields required by LiveFleetMapPage Leaflet markers
      const sample = res.body.trucks[0];
      expect(sample.truck_no).toBeDefined();
      expect(sample.body_type).toBeDefined();
      expect(sample.registration_number).toBe(sample.truck_no);
    });
  });

  // ==========================================================================
  // 4. ISS-020: OTP & Tracking Abuse Defense, Cooldown & Lockout Safeguards
  // ==========================================================================
  describe('4. ISS-020: OTP & Tracking Abuse Defense & Concurrency Safeguards', () => {
    it('concurrency burst: exactly 1 request wins lease and 2 are blocked with HTTP 429 when no session exists yet', async () => {
      const clientIp = nextIp();
      const phone = '+919876599001';
      await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Concurrent Shipper',
        phone,
      });

      const sendSmsSpy = vi.spyOn(telephonyService, 'sendSms');

      // Execute 3 concurrent requests at the exact same millisecond
      const responses = await Promise.all([
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
      ]);

      const successResponses = responses.filter((r) => r.status === 200);
      const cooldownResponses = responses.filter((r) => r.status === 429);
      const error500Responses = responses.filter((r) => r.status === 500);

      expect(successResponses.length).toBe(1);
      expect(cooldownResponses.length).toBe(2);
      expect(error500Responses.length).toBe(0);
      expect(cooldownResponses[0].body.error).toMatch(/wait.*seconds/i);

      // Exactly 1 SMS was dispatched
      expect(sendSmsSpy).toHaveBeenCalledTimes(1);

      // Winning dev_otp matches the stored bcrypt hash in MongoDB
      const winningOtp = successResponses[0].body.dev_otp;
      expect(winningOtp).toBeDefined();

      const session = await PortalSession.findOne({
        phone,
        portal_type: 'customer',
        company_id: tenantA.company._id,
      });
      expect(session).toBeDefined();
      expect(session?.otp_hash).toBeDefined();

      const isMatch = await bcrypt.compare(winningOtp, session!.otp_hash!);
      expect(isMatch).toBe(true);

      sendSmsSpy.mockRestore();
    });

    it('concurrency burst: exactly 1 request wins lease, 2 are blocked with HTTP 429 when session already exists', async () => {
      const clientIp = nextIp();
      const phone = '+919876599008';
      const customer = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'PreExisting Session Shipper',
        phone,
      });

      // Pre-seed an existing session where previous cooldown has already elapsed (90 seconds ago)
      const pastDate = new Date(Date.now() - 90000);
      await PortalSession.create({
        entity_id: customer._id,
        portal_type: 'customer',
        company_id: tenantA.company._id,
        phone,
        otp_attempts: 1, // historical attempt count preserved
        last_otp_sent_at: pastDate,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000),
      });

      const sendSmsSpy = vi.spyOn(telephonyService, 'sendSms');

      const responses = await Promise.all([
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
        request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
          }),
      ]);

      const successResponses = responses.filter((r) => r.status === 200);
      const cooldownResponses = responses.filter((r) => r.status === 429);
      const error500Responses = responses.filter((r) => r.status === 500);

      expect(successResponses.length).toBe(1);
      expect(cooldownResponses.length).toBe(2);
      expect(error500Responses.length).toBe(0);
      expect(sendSmsSpy).toHaveBeenCalledTimes(1);

      const updatedSession = await PortalSession.findOne({
        entity_id: customer._id,
        portal_type: 'customer',
        company_id: tenantA.company._id,
      });
      // Verification attempt count must remain preserved across new OTP issuance
      expect(updatedSession?.otp_attempts).toBe(1);

      const winningOtp = successResponses[0].body.dev_otp;
      const isMatch = await bcrypt.compare(winningOtp, updatedSession!.otp_hash!);
      expect(isMatch).toBe(true);

      sendSmsSpy.mockRestore();
    });

    it('enforces 60-second cooldown on subsequent sequential OTP request', async () => {
      const clientIp = nextIp();
      const phone = '+919876599002';
      await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Cooldown Shipper',
        phone,
      });

      // First request succeeds
      const res1 = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(res1.status).toBe(200);

      // Second request immediately after returns HTTP 429 Cooldown
      const res2 = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(res2.status).toBe(429);
      expect(res2.body.error).toMatch(/wait.*seconds/i);
    });

    it('enforces 15-minute brute-force lockout after 5 failed verification attempts and preserves lockout across resend attempts', async () => {
      const clientIp = nextIp();
      const phone = '+919876599003';
      await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Brute Force Shipper',
        phone,
      });

      // Request OTP
      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(otpRes.status).toBe(200);

      // 1. Submit 3 incorrect OTPs
      for (let i = 1; i <= 3; i++) {
        const failRes = await request(app)
          .post('/api/portal/verify-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
            otp: '000000',
          });
        expect(failRes.status).toBe(401);
        expect(failRes.body.error).toContain(`${5 - i} attempt(s) remaining`);
      }

      // 2. Cooldown expires and user requests a fresh OTP
      await PortalSession.updateOne(
        { phone, portal_type: 'customer', company_id: tenantA.company._id },
        { $set: { last_otp_sent_at: new Date(Date.now() - 70000) } }
      );

      const resendFreshRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(resendFreshRes.status).toBe(200);

      // Verify that failed verification attempts (3) were strictly preserved across resend
      const sessionAfterResend = await PortalSession.findOne({
        phone,
        portal_type: 'customer',
        company_id: tenantA.company._id,
      });
      expect(sessionAfterResend?.otp_attempts).toBe(3);

      // 3. 4th failed attempt on new OTP
      const fail4 = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
          otp: '000000',
        });
      expect(fail4.status).toBe(401);
      expect(fail4.body.error).toContain('1 attempt(s) remaining');

      // 4. 5th failed attempt triggers 15-minute brute-force lockout (HTTP 429)
      const lockRes = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
          otp: '000000',
        });
      expect(lockRes.status).toBe(429);
      expect(lockRes.body.error).toMatch(/locked for 15 minutes/i);

      // 5. Verify that requesting another OTP during lockout is rejected (HTTP 429) and cannot reset lockout
      const resendRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(resendRes.status).toBe(429);
      expect(resendRes.body.error).toMatch(/Account locked/i);

      // Verify that verify-otp remains locked out at database session level
      const verifyStillLocked = await request(app)
        .post('/api/portal/verify-otp')
        .set('X-Forwarded-For', nextIp())
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
          otp: '000000',
        });
      expect(verifyStillLocked.status).toBe(429);
      expect(verifyStillLocked.body.error).toMatch(/locked for.*minutes|Account locked/i);
    });

    it('telephony failure policy: preserves 60s cooldown, retains OTP state, does not increment attempts, and returns HTTP 502', async () => {
      const clientIp = nextIp();
      const phone = '+919876599004';
      const customer = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Telephony Fail Shipper',
        phone,
      });

      // Mock telephony gateway failure
      const sendSmsSpy = vi.spyOn(telephonyService, 'sendSms').mockRejectedValueOnce(new Error('Carrier network timeout'));

      const res = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/Failed to dispatch SMS via gateway.*Cooldown active/i);

      // 1. Cooldown is active in MongoDB (immediate retry returns HTTP 429)
      const retryRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(retryRes.status).toBe(429);
      expect(retryRes.body.error).toMatch(/wait.*seconds/i);

      // 2. OTP session exists and attempts was NOT incremented
      const session = await PortalSession.findOne({
        entity_id: customer._id,
        portal_type: 'customer',
        company_id: tenantA.company._id,
      });
      expect(session).toBeDefined();
      expect(session?.otp_attempts).toBe(0);
      expect(session?.last_otp_sent_at).toBeDefined();

      sendSmsSpy.mockRestore();
    });

    it('concurrent OTP verification attempts atomically increment counter and enforce 5-attempt limit', async () => {
      const clientIp = nextIp();
      const phone = '+919876599005';
      await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Concurrent Verify Shipper',
        phone,
      });

      const otpRes = await request(app)
        .post('/api/portal/send-otp')
        .set('X-Forwarded-For', clientIp)
        .send({
          portal_type: 'customer',
          phone,
          company_id: tenantA.company._id.toString(),
        });
      expect(otpRes.status).toBe(200);

      // Submit 6 concurrent invalid OTP requests
      const verifyPromises = Array.from({ length: 6 }).map(() =>
        request(app)
          .post('/api/portal/verify-otp')
          .set('X-Forwarded-For', clientIp)
          .send({
            portal_type: 'customer',
            phone,
            company_id: tenantA.company._id.toString(),
            otp: '999999',
          })
      );

      const verifyResponses = await Promise.all(verifyPromises);

      // At least one response must be HTTP 429 (lockout reached)
      const lockouts = verifyResponses.filter((r) => r.status === 429);
      expect(lockouts.length).toBeGreaterThanOrEqual(1);

      // Session in DB must have attempts >= 5 and lockout_until set
      const session = await PortalSession.findOne({
        phone,
        portal_type: 'customer',
        company_id: tenantA.company._id,
      });
      expect(session?.otp_attempts).toBeGreaterThanOrEqual(5);
      expect(session?.lockout_until).toBeDefined();
    });

    it('enforces IP rate limiting: rapid requests exceeding max limit receive HTTP 429 with rate limit message', async () => {
      const rapidIp = nextIp();
      const phone = '+919876599006';
      await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Rapid Shipper',
        phone,
      });

      // Rapidly fire 6 requests to /send-otp with the same IP
      // Even if different phone numbers were used, the IP rate limiter must block request 6
      const responses: any[] = [];
      for (let i = 1; i <= 6; i++) {
        const dummyPhone = `+9198765990${10 + i}`;
        await BillingParty.create({
          company_id: tenantA.company._id,
          name: `Shipper ${i}`,
          phone: dummyPhone,
        });

        const res = await request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', rapidIp)
          .send({
            portal_type: 'customer',
            phone: dummyPhone,
            company_id: tenantA.company._id.toString(),
          });
        responses.push(res);
      }

      // First 5 requests should pass the IP rate limiter (status 200)
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(200);
      }

      // 6th request must be blocked by the IP rate limiter with HTTP 429
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toMatch(/Too many OTP requests from this network/i);
    });

    it('spoofed client-supplied X-Forwarded-For headers cannot bypass rate limit by rotating addresses behind trusted proxy', async () => {
      const trustedClientIp = '198.51.100.99';
      // Fire 6 requests where client header spoofs different source addresses in X-Forwarded-For:
      // "10.0.0.1, 198.51.100.99", "10.0.0.2, 198.51.100.99", etc.
      // Express trust proxy: 1 inspects the immediate upstream client (198.51.100.99).
      const responses: any[] = [];
      for (let i = 1; i <= 6; i++) {
        const dummyPhone = `+9198765990${30 + i}`;
        await BillingParty.create({
          company_id: tenantA.company._id,
          name: `Spoof Shipper ${i}`,
          phone: dummyPhone,
        });

        const res = await request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', `10.0.0.${i}, ${trustedClientIp}`)
          .send({
            portal_type: 'customer',
            phone: dummyPhone,
            company_id: tenantA.company._id.toString(),
          });
        responses.push(res);
      }

      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(200);
      }
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toMatch(/Too many OTP requests from this network/i);
    });

    it('validates and rate-limits IPv6 client addresses behind trusted proxy', async () => {
      const ipv6Client = '2001:db8:abcd:0012::cafe';
      const responses: any[] = [];
      for (let i = 1; i <= 6; i++) {
        const dummyPhone = `+9198765990${50 + i}`;
        await BillingParty.create({
          company_id: tenantA.company._id,
          name: `IPv6 Shipper ${i}`,
          phone: dummyPhone,
        });

        const res = await request(app)
          .post('/api/portal/send-otp')
          .set('X-Forwarded-For', `fe80::${i}, ${ipv6Client}`)
          .send({
            portal_type: 'customer',
            phone: dummyPhone,
            company_id: tenantA.company._id.toString(),
          });
        responses.push(res);
      }

      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(200);
      }
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toMatch(/Too many OTP requests from this network/i);
    });
  });
});
