import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app, { assertProductionEnvironment } from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Plan } from '../../models/Plan.js';
import { Truck } from '../../models/Truck.js';
import { Subscription } from '../../models/Subscription.js';
import { Company } from '../../models/Company.js';
import { PaymentTransaction } from '../../models/PaymentTransaction.js';
import { ProcessedWebhook } from '../../models/ProcessedWebhook.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { getTenantEntitlements } from '../../utils/entitlementService.js';
import { createPaymentOrder, getGatewayCredentials } from '../../utils/paymentGateway.js';

describe('Phase 5: Subscription Feature Gating, Quotas & Payment Hardening (TEST-004 & DEC-001)', () => {
  beforeEach(async () => {
    await seedBillingCatalog();
  });

  // ==========================================================================
  // SUITE 1: Plan Catalog Retrieval & Repeatable Seed Idempotency
  // ==========================================================================
  describe('1. Plan Catalog Retrieval & Idempotent Upserts', () => {
    it('retrieves active public plans via GET /api/billing/plans with approved DEC-001 values', async () => {
      const res = await request(app).get('/api/billing/plans');

      expect(res.status).toBe(200);
      expect(res.body.plans).toBeDefined();
      expect(Array.isArray(res.body.plans)).toBe(true);

      const starter = res.body.plans.find((p: any) => p.code === 'starter');
      const standard = res.body.plans.find((p: any) => p.code === 'standard');
      const pro = res.body.plans.find((p: any) => p.code === 'pro');

      expect(starter).toBeDefined();
      expect(starter.monthly_price_paise).toBe(199900);
      expect(starter.annual_price_paise).toBe(1999000);
      expect(starter.max_trucks).toBe(15);
      expect(starter.max_branches).toBe(1);
      expect(starter.max_users).toBe(2);

      expect(standard).toBeDefined();
      expect(standard.monthly_price_paise).toBe(399900);
      expect(standard.annual_price_paise).toBe(3999000);
      expect(standard.max_trucks).toBe(30);
      expect(standard.max_branches).toBe(3);
      expect(standard.max_users).toBe(5);

      expect(pro).toBeDefined();
      expect(pro.monthly_price_paise).toBe(899900);
      expect(pro.annual_price_paise).toBe(8999000);
      expect(pro.max_trucks).toBe(-1); // Unlimited trucks subject to Fair-Use Policy
      expect(pro.max_branches).toBe(-1); // Undecided / unconstrained per DEC-001
    });

    it('executes repeatable catalog seed idempotently without creating duplicate records', async () => {
      const countBefore = await Plan.countDocuments();
      expect(countBefore).toBeGreaterThanOrEqual(4);

      // Run seed multiple times consecutively
      await seedBillingCatalog();
      await seedBillingCatalog();
      await seedBillingCatalog();

      const countAfter = await Plan.countDocuments();
      expect(countAfter).toBe(countBefore);

      const standardPlans = await Plan.find({ code: 'standard' });
      expect(standardPlans.length).toBe(1);
      expect(standardPlans[0].max_branches).toBe(3);
      expect(standardPlans[0].max_trucks).toBe(30);
    });
  });

  // ==========================================================================
  // SUITE 2: Starter Module Entitlements
  // ==========================================================================
  describe('2. Starter Module Entitlements (ISS-012)', () => {
    it('includes MOD_LR_ENGINE and MOD_BILLING_INVOICE in Starter entitlements', async () => {
      const starterTenant = await createTestTenant({ name: 'Starter Logistics', plan_code: 'starter' });
      const entitlements = await getTenantEntitlements(starterTenant.company);

      expect(entitlements.plan.code).toBe('starter');
      expect(entitlements.enabled_features).toContain('MOD_LR_ENGINE');
      expect(entitlements.enabled_features).toContain('MOD_BILLING_INVOICE');
      expect(entitlements.enabled_features).toContain('MOD_FLEET');
      expect(entitlements.limits.max_trucks).toBe(15);
      expect(entitlements.limits.max_branches).toBe(1);
      expect(entitlements.limits.max_users).toBe(2);
    });

    it('blocks Starter tenant from accessing workflow approvals with HTTP 403 FEATURE_LOCKED', async () => {
      const starterTenant = await createTestTenant({ name: 'Starter Fleet Co', plan_code: 'starter' });

      const res = await request(app)
        .get('/api/approvals/rules')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_WORKFLOW_APPROVALS');
    });

    it('blocks Starter tenant from accessing Tally XML export with HTTP 403 FEATURE_LOCKED', async () => {
      const starterTenant = await createTestTenant({ name: 'Starter Transport', plan_code: 'starter' });

      const res = await request(app)
        .get('/api/commercial/export/tally')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_TALLY_SYNC');
    });
  });

  // ==========================================================================
  // SUITE 3: Standard Branch Allowance & Enterprise Isolation
  // ==========================================================================
  describe('3. Standard Branch Quota & Module Isolation', () => {
    it('allows Standard tenant to create up to 3 branches, but blocks 4th with HTTP 403 QUOTA_EXCEEDED', async () => {
      const standardTenant = await createTestTenant({ name: 'Standard Carrier', plan_code: 'standard' });

      // Create branch 1
      const b1 = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${standardTenant.token}`)
        .send({
          branch_code: 'MUM01',
          branch_name: 'Mumbai Central Hub',
          city: 'Mumbai',
          state: 'Maharashtra',
        });
      expect(b1.status).toBe(201);

      // Create branch 2
      const b2 = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${standardTenant.token}`)
        .send({
          branch_code: 'PUN01',
          branch_name: 'Pune Industrial Yard',
          city: 'Pune',
          state: 'Maharashtra',
        });
      expect(b2.status).toBe(201);

      // Create branch 3
      const b3 = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${standardTenant.token}`)
        .send({
          branch_code: 'NGP01',
          branch_name: 'Nagpur Transshipment Hub',
          city: 'Nagpur',
          state: 'Maharashtra',
        });
      expect(b3.status).toBe(201);

      // Attempt branch 4 (Exceeds quota of 3)
      const b4 = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${standardTenant.token}`)
        .send({
          branch_code: 'NAS01',
          branch_name: 'Nashik Depot',
          city: 'Nashik',
          state: 'Maharashtra',
        });

      expect(b4.status).toBe(403);
      expect(b4.body.code).toBe('QUOTA_EXCEEDED');
      expect(b4.body.resource).toBe('branches');
      expect(b4.body.limit).toBe(3);
      expect(b4.body.current).toBe(3);
    });

    it('denies Standard tenant access to Enterprise-only modules (MOD_MULTI_BRANCH, MOD_GPS_SYNC)', async () => {
      const standardTenant = await createTestTenant({ name: 'Standard Express', plan_code: 'standard' });
      const entitlements = await getTenantEntitlements(standardTenant.company);

      // Standard must NOT gain Enterprise modules
      expect(entitlements.enabled_features).not.toContain('MOD_MULTI_BRANCH');
      expect(entitlements.enabled_features).not.toContain('MOD_GPS_SYNC');
    });
  });

  // ==========================================================================
  // SUITE 4: Truck Quota Enforcement & Pro Fair-Use Policy
  // ==========================================================================
  describe('4. Truck Quota Enforcement & Pro Fair-Use Policy', () => {
    it('enforces 15-truck quota on Starter plan and blocks 16th vehicle', async () => {
      const starterTenant = await createTestTenant({ name: 'Starter Fleet Ltd', plan_code: 'starter' });

      // Seed 15 trucks directly in database for this company
      const trucksData = Array.from({ length: 15 }, (_, i) => ({
        company_id: starterTenant.company._id,
        truck_no: `MH12AB${String(1000 + i)}`,
        make: 'Tata',
        model: 'Prima',
        body_type: 'Container',
        tonnage_capacity: 16,
        status: 'available',
        is_deleted: false,
      }));
      await Truck.insertMany(trucksData, { skipTenantCheck: true } as any);

      // Verify count is 15
      const count = await Truck.countDocuments({ company_id: starterTenant.company._id, is_deleted: false });
      expect(count).toBe(15);

      // Attempt 16th truck creation via REST endpoint
      const res = await request(app)
        .post('/api/fleet/trucks')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          truck_no: 'MH12AB9999',
          make: 'Ashok Leyland',
          model: 'Ecomet',
          tonnage_capacity: 12,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.resource).toBe('trucks');
      expect(res.body.limit).toBe(15);
      expect(res.body.current).toBe(15);
    });

    it('permits Pro tenant to create vehicles past standard limits without automated hard stops (FUP)', async () => {
      const proTenant = await createTestTenant({ name: 'Pro Transport Group', plan_code: 'pro' });

      // Seed 35 trucks for this tenant
      const proTrucks = Array.from({ length: 35 }, (_, i) => ({
        company_id: proTenant.company._id,
        truck_no: `MH04CD${String(2000 + i)}`,
        make: 'BharatBenz',
        model: '2823R',
        body_type: 'Trailer',
        tonnage_capacity: 28,
        status: 'available',
        is_deleted: false,
      }));
      await Truck.insertMany(proTrucks, { skipTenantCheck: true } as any);

      // Create 36th vehicle via API
      const res = await request(app)
        .post('/api/fleet/trucks')
        .set('Authorization', `Bearer ${proTenant.token}`)
        .send({
          truck_no: 'MH04CD9999',
          make: 'BharatBenz',
          model: '2823R',
          tonnage_capacity: 28,
        });

      expect(res.status).toBe(201);
      expect(res.body.truck).toBeDefined();
    });
  });

  // ==========================================================================
  // SUITE 5: Route Guards & Subscription Status Validation
  // ==========================================================================
  describe('5. Route Guards & Subscription Status Checks', () => {
    it('permits Pro subscriber to access workflow approval rules endpoint', async () => {
      const proTenant = await createTestTenant({ name: 'Pro Logistics Systems', plan_code: 'pro' });

      const res = await request(app)
        .get('/api/approvals/rules')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rules).toBeDefined();
    });

    it('blocks Standard subscriber from accessing Tally XML export (gated to Pro)', async () => {
      const standardTenant = await createTestTenant({ name: 'Standard Freight Inc', plan_code: 'standard' });

      const res = await request(app)
        .get('/api/commercial/export/tally')
        .set('Authorization', `Bearer ${standardTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_TALLY_SYNC');
    });

    it('permits Pro subscriber to access Tally XML export', async () => {
      const proTenant = await createTestTenant({ name: 'Pro Tally Freight', plan_code: 'pro' });

      const res = await request(app)
        .get('/api/commercial/export/tally')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(200);
    });

    it('blocks access to protected endpoints when subscription is suspended', async () => {
      const suspendedTenant = await createTestTenant({
        name: 'Suspended Fleet',
        plan_code: 'starter',
        subscription_status: 'suspended',
      });

      const res = await request(app)
        .post('/api/fleet/trucks')
        .set('Authorization', `Bearer ${suspendedTenant.token}`)
        .send({
          truck_no: 'MH14XY1000',
          make: 'Tata',
          model: 'Signa',
          tonnage_capacity: 20,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_SUSPENDED');
    });
  });

  // ==========================================================================
  // SUITE 6: Production Payment Configuration Verification
  // ==========================================================================
  describe('6. Production Payment Configuration (ISS-013)', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const originalKeyId = process.env.RAZORPAY_KEY_ID;
    const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }

      if (originalWebhookSecret !== undefined) {
        process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
      } else {
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
      }

      if (originalKeyId !== undefined) {
        process.env.RAZORPAY_KEY_ID = originalKeyId;
      } else {
        delete process.env.RAZORPAY_KEY_ID;
      }

      if (originalKeySecret !== undefined) {
        process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
      } else {
        delete process.env.RAZORPAY_KEY_SECRET;
      }
    });

    it('throws when RAZORPAY_WEBHOOK_SECRET is missing in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'prod_super_secure_jwt_secret_32_chars_long!';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/prod_db';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_real_key_id';
      process.env.RAZORPAY_KEY_SECRET = 'real_prod_key_secret';
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      expect(() => assertProductionEnvironment()).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
    });

    it('throws when RAZORPAY_WEBHOOK_SECRET uses the default dev fallback in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'prod_super_secure_jwt_secret_32_chars_long!';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/prod_db';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_real_key_id';
      process.env.RAZORPAY_KEY_SECRET = 'real_prod_key_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'dev_webhook_secret_fleetflow';

      expect(() => assertProductionEnvironment()).toThrow(/insecure default fallback/);
    });

    it('passes environment assertion when all production secrets are valid and non-fallback', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'prod_super_secure_jwt_secret_32_chars_long!';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/prod_db';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_real_key_id';
      process.env.RAZORPAY_KEY_SECRET = 'real_prod_key_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_prod_secure_random_hex_string_12345';

      expect(() => assertProductionEnvironment()).not.toThrow();
    });

    it('throws when createPaymentOrder is called in production without configured credentials', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RAZORPAY_KEY_ID = '';
      process.env.RAZORPAY_KEY_SECRET = '';

      await expect(
        createPaymentOrder({
          amount_paise: 199900,
          receipt: 'INV-TEST-001',
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // SUITE 7: Payment Verification & Tenant Isolation Defenses
  // ==========================================================================
  describe('7. Payment Verification & Tenant Isolation Defenses', () => {
    it('rejects tampered payment signature with HTTP 400 Bad Request', async () => {
      const tenant = await createTestTenant({ name: 'Verification Test Co' });
      const standardPlan = await Plan.findOne({ code: 'standard' });

      // Create pending transaction for tenant
      const orderId = `order_${Date.now()}_test1`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: standardPlan?._id,
        amount_paise: 399900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-100',
        tax_breakup: {
          subtotal_paise: 338898,
          cgst_paise: 30501,
          sgst_paise: 30501,
          total_paise: 399900,
          gst_rate_percent: 18,
        },
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('Idempotency-Key', `idem_${Date.now()}_1`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_payment_123',
          razorpay_signature: 'tampered_invalid_signature_hex_code',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);

      // Verify transaction marked failed
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('failed');
    });

    it('rejects cross-tenant payment verification attempt with HTTP 404', async () => {
      const tenantA = await createTestTenant({ name: 'Tenant A Freight' });
      const tenantB = await createTestTenant({ name: 'Tenant B Logistics' });
      const standardPlan = await Plan.findOne({ code: 'standard' });

      // Create order belonging strictly to Tenant B
      const orderIdB = `order_${Date.now()}_tenantB`;
      await PaymentTransaction.create({
        company_id: tenantB.company._id,
        order_id: orderIdB,
        plan_id: standardPlan?._id,
        amount_paise: 399900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-200',
        tax_breakup: {
          subtotal_paise: 338898,
          cgst_paise: 30501,
          sgst_paise: 30501,
          total_paise: 399900,
          gst_rate_percent: 18,
        },
      });

      // Tenant A attempts to verify Tenant B's order
      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('Idempotency-Key', `idem_${Date.now()}_2`)
        .send({
          razorpay_order_id: orderIdB,
          razorpay_payment_id: 'pay_test_cross_tenant_123',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found for this tenant/i);
    });

    it('prevents duplicate payment verification on already successful transactions', async () => {
      const tenant = await createTestTenant({ name: 'Idempotent Payment Co' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const orderId = `order_${Date.now()}_success`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'success', // Already verified
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-300',
        tax_breakup: {
          subtotal_paise: 762627,
          cgst_paise: 68636,
          sgst_paise: 68636,
          total_paise: 899900,
          gst_rate_percent: 18,
        },
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('Idempotency-Key', `idem_${Date.now()}_3`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_duplicate_123',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already been verified/i);
    });

    it('verifies valid payment signature and upgrades workspace to target plan', async () => {
      const tenant = await createTestTenant({ name: 'Successful Upgrade Co', plan_code: 'starter' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const orderId = `order_${Date.now()}_valid`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-400',
        tax_breakup: {
          subtotal_paise: 762627,
          cgst_paise: 68636,
          sgst_paise: 68636,
          total_paise: 899900,
          gst_rate_percent: 18,
        },
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('Idempotency-Key', `idem_${Date.now()}_4`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_valid_123',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedSub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(updatedSub?.status).toBe('active');
      expect(updatedSub?.plan_id.toString()).toBe(proPlan?._id.toString());

      const updatedCompany = await Company.findById(tenant.company._id);
      expect(updatedCompany?.subscription_status).toBe('active');
    });
  });

  // ==========================================================================
  // SUITE 8: Webhook Ingestion, Idempotency & State Transitions
  // ==========================================================================
  describe('8. Webhook Ingestion & Idempotency Guarantees', () => {
    function signPayload(payloadStr: string): string {
      const { webhookSecret } = getGatewayCredentials();
      return crypto
        .createHmac('sha256', webhookSecret)
        .update(Buffer.from(payloadStr, 'utf8'))
        .digest('hex');
    }

    it('rejects webhooks with missing or invalid signature with HTTP 400', async () => {
      const payload = JSON.stringify({ event: 'payment.captured' });

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', 'invalid_signature_hex')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
    });

    it('processes valid webhook and ingests event into ProcessedWebhook ledger', async () => {
      const eventId = `evt_test_${Date.now()}_1`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_1',
              amount: 199900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const recorded = await ProcessedWebhook.findOne({ event_id: eventId });
      expect(recorded).toBeDefined();
      expect(recorded?.status).toBe('success');
    });

    it('swallows duplicate webhook delivery idempotently without re-executing transitions', async () => {
      const eventId = `evt_dup_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_dup',
              amount: 399900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      // Delivery 1
      const res1 = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');

      // Delivery 2 (Duplicate replay)
      const res2 = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('idempotent_duplicate_ignored');
    });

    it('rejects webhook with payment amount mismatch against server-side transaction record', async () => {
      const tenant = await createTestTenant({ name: 'Amount Mismatch Co' });
      const starterPlan = await Plan.findOne({ code: 'starter' });
      const orderId = `order_wh_amount_${Date.now()}`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: starterPlan?._id,
        amount_paise: 199900, // Server-side price: ₹1,999
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-500',
        tax_breakup: {
          subtotal_paise: 169407,
          cgst_paise: 15247,
          sgst_paise: 15247,
          total_paise: 199900,
          gst_rate_percent: 18,
        },
      });

      const eventId = `evt_tamper_amt_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_tampered',
              order_id: orderId,
              amount: 9900, // Mismatched amount: ₹99
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/amount mismatch/i);
    });

    it('rolls back ProcessedWebhook and mutations on transient error, allowing retry to succeed', async () => {
      const tenant = await createTestTenant({ name: 'Rollback Co' });
      const starterPlan = await Plan.findOne({ code: 'starter' });
      const orderId = `order_wh_rollback_${Date.now()}`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: starterPlan?._id,
        amount_paise: 199900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-ROLLBACK',
        tax_breakup: {
          subtotal_paise: 169407,
          cgst_paise: 15247,
          sgst_paise: 15247,
          total_paise: 199900,
          gst_rate_percent: 18,
        },
      });

      const eventId = `evt_rollback_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rollback_1',
              order_id: orderId,
              amount: 199900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      // Force a transient failure on downstream Company update inside the transaction
      const companySpy = vi.spyOn(Company, 'findByIdAndUpdate').mockRejectedValueOnce(
        new Error('Simulated transient DB error during company update')
      );

      // Attempt 1: Should fail and rollback the entire transaction
      const res1 = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res1.status).toBe(500);

      // Verify atomic rollback: ProcessedWebhook must NOT be persisted
      const uncommittedEvent = await ProcessedWebhook.findOne({ event_id: eventId });
      expect(uncommittedEvent).toBeNull();

      // Verify business mutations were not partially committed
      const txnAfterFail = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txnAfterFail?.status).toBe('pending');

      companySpy.mockRestore();

      // Attempt 2: Provider retries the exact same event; should succeed completely
      const res2 = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('success');

      // Verify event is now committed and business effects applied
      const committedEvent = await ProcessedWebhook.findOne({ event_id: eventId });
      expect(committedEvent).toBeDefined();
      expect(committedEvent?.status).toBe('success');

      const txnAfterSuccess = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txnAfterSuccess?.status).toBe('success');
      expect(txnAfterSuccess?.payment_id).toBe('pay_rollback_1');

      const subAfterSuccess = await Subscription.findOne({ company_id: tenant.company._id });
      expect(subAfterSuccess?.status).toBe('active');
    });

    it('safely handles concurrent duplicate webhook deliveries without duplicate business effects', async () => {
      await ProcessedWebhook.syncIndexes();
      const tenant = await createTestTenant({ name: 'Concurrent Webhook Co' });
      const standardPlan = await Plan.findOne({ code: 'standard' });
      const orderId = `order_wh_concurrent_${Date.now()}`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: standardPlan?._id,
        amount_paise: 399900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-CONCUR',
        tax_breakup: {
          subtotal_paise: 338898,
          cgst_paise: 30501,
          sgst_paise: 30501,
          total_paise: 399900,
          gst_rate_percent: 18,
        },
      });

      const eventId = `evt_concur_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_concur_1',
              order_id: orderId,
              amount: 399900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      // Fire 2 concurrent deliveries of the exact same event
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/webhooks/billing')
          .set('x-razorpay-signature', signature)
          .set('Content-Type', 'application/json')
          .send(rawPayload),
        request(app)
          .post('/api/webhooks/billing')
          .set('x-razorpay-signature', signature)
          .set('Content-Type', 'application/json')
          .send(rawPayload),
      ]);

      // Both must complete with HTTP 200 without throwing 500 duplicate key error
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const statuses = [resA.body.status, resB.body.status];
      expect(statuses).toContain('success');
      expect(statuses).toContain('idempotent_duplicate_ignored');

      // Verify that exactly ONE ProcessedWebhook document was created
      const eventCount = await ProcessedWebhook.countDocuments({ event_id: eventId });
      expect(eventCount).toBe(1);

      // Verify PaymentTransaction was updated exactly once to success
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('success');
      expect(txn?.payment_id).toBe('pay_concur_1');

      // Verify Subscription was activated exactly once
      const sub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(sub?.status).toBe('active');
    });

    it('returns HTTP 500 when duplicate-key race outcome cannot be verified as successful', async () => {
      const eventId = `evt_unverified_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_unverified_1',
              amount: 199900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      // Simulate a concurrent duplicate key error on save, while ProcessedWebhook.findOne returns null
      const duplicateError: any = new Error('E11000 duplicate key error dup key: { event_id: "..." }');
      duplicateError.code = 11000;
      const saveSpy = vi.spyOn(ProcessedWebhook.prototype, 'save').mockRejectedValueOnce(duplicateError);
      const findSpy = vi.spyOn(ProcessedWebhook, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/outcome not verified/i);

      saveSpy.mockRestore();
      findSpy.mockRestore();
    });

    it('does not re-extend subscription or mutate ledger when already successful transaction receives webhook', async () => {
      const tenant = await createTestTenant({ name: 'No Double Extend Co' });
      const starterPlan = await Plan.findOne({ code: 'starter' });
      const orderId = `order_wh_no_double_${Date.now()}`;

      const initialPeriodEnd = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
      await Subscription.findOneAndUpdate(
        { company_id: tenant.company._id },
        {
          status: 'active',
          current_period_end: initialPeriodEnd,
        }
      );

      // Transaction was already marked 'success' by frontend verifyPayment
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: starterPlan?._id,
        amount_paise: 199900,
        currency: 'INR',
        status: 'success',
        payment_id: 'pay_initial_success',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-NODBL',
        tax_breakup: {
          subtotal_paise: 169407,
          cgst_paise: 15247,
          sgst_paise: 15247,
          total_paise: 199900,
          gst_rate_percent: 18,
        },
      });

      const eventId = `evt_nodouble_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_captured_late',
              order_id: orderId,
              amount: 199900,
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // Subscription period_end must NOT have been double-extended
      const subAfter = await Subscription.findOne({ company_id: tenant.company._id });
      expect(subAfter?.current_period_end?.getTime()).toBe(initialPeriodEnd.getTime());

      // PaymentTransaction payment_id was not overwritten
      const txnAfter = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txnAfter?.status).toBe('success');
      expect(txnAfter?.payment_id).toBe('pay_initial_success');
    });

    it('protects out-of-order state transitions: payment.failed does not downgrade successful transaction', async () => {
      const tenant = await createTestTenant({ name: 'OutOfOrder Co' });
      const starterPlan = await Plan.findOne({ code: 'starter' });
      const orderId = `order_wh_ooo_${Date.now()}`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: starterPlan?._id,
        amount_paise: 199900,
        currency: 'INR',
        status: 'success',
        payment_id: 'pay_already_succeeded',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-OOO',
        tax_breakup: {
          subtotal_paise: 169407,
          cgst_paise: 15247,
          sgst_paise: 15247,
          total_paise: 199900,
          gst_rate_percent: 18,
        },
      });

      const eventId = `evt_ooo_failed_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_already_succeeded',
              order_id: orderId,
              amount: 199900,
              error_description: 'Late arrival payment failure notification',
            },
          },
        },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const res = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(200);

      // PaymentTransaction status must remain 'success'
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('success');
    });
  });
});
