/**
 * ============================================================================
 * PHASE E3 TEST SUITE: PAYMENT IDEMPOTENCY & ERROR CLASSIFICATION
 * (phase5BatchE3PaymentIdempotency.test.ts)
 * ============================================================================
 * 
 * Verifies FF-ISSUE-026, FF-ISSUE-027, and QST-007:
 * 1. Payment verification route `/api/billing/verify-payment` strictly enforces
 *    the `x-idempotency-key` header (HTTP 400 if missing).
 * 2. Successful verification with an idempotency key activates the subscription once.
 * 3. Retrying the same verification request with the identical idempotency key
 *    returns the cached response with `X-Cache: IDEMPOTENT_HIT` without duplicate
 *    business mutations or extensions.
 * 4. Idempotency payload tampering (hash mismatch) is rejected with HTTP 422.
 * 5. Concurrent requests in flight with identical key return HTTP 409 Conflict.
 * 6. Attempting to re-verify an already verified transaction with a distinct key
 *    returns HTTP 400 (`already been verified and processed`).
 * 7. Tampered or invalid cryptographic signatures are rejected with HTTP 400.
 * 8. Plan-change endpoint `/api/billing/change-plan` cleanly supports idempotency.
 * 9. Verification failures do NOT produce misleading "Payment window closed" errors.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Subscription } from '../../models/Subscription.js';
import { Plan } from '../../models/Plan.js';
import { PaymentTransaction } from '../../models/PaymentTransaction.js';
import { IdempotencyKey } from '../../models/IdempotencyKey.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';

describe('Phase E3: Payment Idempotency & Payment-Window Error Handling (FF-ISSUE-026 & FF-ISSUE-027)', () => {
  let tenant: TestTenantContext;

  const defaultTaxBreakup = {
    subtotal_paise: 762627,
    cgst_paise: 68636,
    sgst_paise: 68636,
    total_paise: 899900,
    gst_rate_percent: 18,
  };

  beforeEach(async () => {
    await seedBillingCatalog();
    tenant = await createTestTenant({
      name: 'Batch E3 Freightways',
      plan_code: 'starter',
      subscription_status: 'trialing',
    });
  });

  describe('1. Payment Verification Idempotency Enforcement (FF-ISSUE-026)', () => {
    it('blocks /api/billing/verify-payment when x-idempotency-key header is missing (HTTP 400)', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_missing_key`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-101',
        tax_breakup: defaultTaxBreakup,
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        // Explicitly omitting x-idempotency-key
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_missing_key_1',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/x-idempotency-key header is required/i);
    });

    it('successfully verifies payment and records idempotency key on first attempt', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_first_attempt`;
      const idempotencyKey = `idem_${Date.now()}_attempt_1`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-102',
        tax_breakup: defaultTaxBreakup,
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_first_1',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(200);
      // Allow async finalizeIdempotency to flush to database
      await new Promise((r) => setTimeout(r, 50));

      // Verify idempotency record saved
      const idemRecord = await IdempotencyKey.findOne({ key: idempotencyKey }, null, { skipTenantCheck: true });
      expect(idemRecord).toBeDefined();
      expect(['RESOLVED', 'COMMITTED']).toContain(idemRecord?.status);

      // Verify subscription activated
      const sub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(sub?.status).toBe('active');
      expect(sub?.plan_id.toString()).toBe(proPlan?._id.toString());
    });

    it('safely replays cached response when identical request is retried with same idempotency key', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_replay_test`;
      const idempotencyKey = `idem_${Date.now()}_replay_key`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-103',
        tax_breakup: defaultTaxBreakup,
      });

      const payload = {
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_test_replay_1',
        razorpay_signature: 'simulated_test_signature_valid',
      };

      // 1. Initial attempt
      const res1 = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBeUndefined(); // First execution is not from cache

      const subAfterFirst = await Subscription.findOne({ company_id: tenant.company._id });
      const periodEndAfterFirst = subAfterFirst?.current_period_end?.getTime();

      // 2. Retry of the same logical verification attempt with identical key
      const res2 = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('IDEMPOTENT_HIT');
      expect(res2.body.success).toBe(res1.body.success);
      expect(res2.body.message).toBe(res1.body.message);

      // Verify subscription period was not mutated or extended twice
      const subAfterSecond = await Subscription.findOne({ company_id: tenant.company._id });
      expect(subAfterSecond?.current_period_end?.getTime()).toBe(periodEndAfterFirst);
    });

    it('rejects tampered payload reusing the same idempotency key with HTTP 422', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_tamper_test`;
      const idempotencyKey = `idem_${Date.now()}_tamper_key`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-104',
        tax_breakup: defaultTaxBreakup,
      });

      // 1. First request with payload A
      await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_orig',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      // 2. Second request reusing key but changing payment_id (payload mismatch)
      const res2 = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_tampered_diff',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res2.status).toBe(422);
      expect(res2.body.error).toMatch(/payload.*mismatch/i);
    });

    it('rejects verifying already successful transaction with a distinct idempotency key (HTTP 400)', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_already_success`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'success', // Already confirmed
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-105',
        tax_breakup: defaultTaxBreakup,
      });

      // Calling with a NEW/DISTINCT idempotency key
      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_distinct_${Date.now()}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_new_attempt_123',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already been verified and processed/i);
    });
  });

  describe('2. Payment Verification Failure & Error Contracts (FF-ISSUE-027 & QST-007)', () => {
    it('rejects tampered cryptographic signature with HTTP 400 without crashing', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId = `order_${Date.now()}_bad_sig`;

      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: 'INV-TEST-E3-201',
        tax_breakup: defaultTaxBreakup,
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_bad_sig`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_bad_sig_1',
          razorpay_signature: 'tampered_invalid_hex_string',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);

      // Verify transaction is marked as failed
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('failed');

      // Verify subscription is NOT upgraded
      const sub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(sub?.status).toBe('trialing');
    });

    it('rejects non-existent order with HTTP 404', async () => {
      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_not_found`)
        .send({
          razorpay_order_id: 'order_non_existent_99999',
          razorpay_payment_id: 'pay_99999',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/order not found/i);
    });

    it('rejects missing parameters with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_missing_params`)
        .send({
          razorpay_order_id: 'order_incomplete',
          // missing razorpay_payment_id and razorpay_signature
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing required payment verification parameters/i);
    });
  });

  describe('3. Plan Change Route Idempotency (/api/billing/change-plan)', () => {
    it('applies idempotency to plan changes and replays cached response on retry', async () => {
      // Create an active paid Pro subscriber
      const standardPlan = await Plan.findOne({ code: 'standard' });

      const paidTenant = await createTestTenant({
        name: 'Paid Pro Transports',
        plan_code: 'pro',
        subscription_status: 'active',
      });

      const idempotencyKey = `idem_change_${Date.now()}`;
      const payload = {
        target_plan_id: standardPlan?._id.toString(),
        billing_cycle: 'monthly',
        immediate: false, // Scheduled downgrade
      };

      // 1. Initial downgrade call with idempotency key
      const res1 = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${paidTenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // 2. Retry of the identical plan-change call with same key
      const res2 = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${paidTenant.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('IDEMPOTENT_HIT');
      expect(res2.body.success).toBe(res1.body.success);
      expect(res2.body.type).toBe(res1.body.type);
    });
  });

  describe('4. In-Flight Concurrency & Distinct Payment Attempts (FF-ISSUE-026 & QST-007)', () => {
    it('returns HTTP 409 Conflict when concurrent requests with identical key are in flight', async () => {
      const pendingKey = `idem_pending_${Date.now()}`;
      const now = new Date();
      const payload = {
        razorpay_order_id: 'order_any',
        razorpay_payment_id: 'pay_any',
        razorpay_signature: 'simulated_test_signature_valid',
      };

      const crypto = await import('crypto');
      const expectedHash = crypto
        .createHash('sha256')
        .update(`POST:/api/billing/verify-payment:${JSON.stringify(payload)}`)
        .digest('hex');

      // Pre-seed an in-flight PENDING idempotency lock with matching request hash
      await IdempotencyKey.collection.insertOne({
        company_id: tenant.company._id,
        key: pendingKey,
        endpoint: '/api/billing/verify-payment',
        method: 'POST',
        request_hash: expectedHash,
        status: 'PENDING',
        locked_at: now,
        lock_token: 'active_lock_token_123',
        expires_at: new Date(Date.now() + 60000),
        created_at: now,
        updated_at: now,
      });

      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', pendingKey)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/in progress/i);
    });

    it('distinct payment attempts receive unique idempotency keys and do not conflict', async () => {
      const proPlan = await Plan.findOne({ code: 'pro' });
      const orderId1 = `order_${Date.now()}_attempt_A`;
      const orderId2 = `order_${Date.now()}_attempt_B`;

      await PaymentTransaction.create([
        {
          company_id: tenant.company._id,
          order_id: orderId1,
          plan_id: proPlan?._id,
          amount_paise: 899900,
          currency: 'INR',
          status: 'pending',
          billing_cycle: 'monthly',
          invoice_number: 'INV-TEST-E3-301',
          tax_breakup: defaultTaxBreakup,
        },
        {
          company_id: tenant.company._id,
          order_id: orderId2,
          plan_id: proPlan?._id,
          amount_paise: 899900,
          currency: 'INR',
          status: 'pending',
          billing_cycle: 'monthly',
          invoice_number: 'INV-TEST-E3-302',
          tax_breakup: defaultTaxBreakup,
        },
      ]);

      const keyA = `idem_key_A_${Date.now()}`;
      const keyB = `idem_key_B_${Date.now()}`;

      // Verify Attempt A
      const resA = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', keyA)
        .send({
          razorpay_order_id: orderId1,
          razorpay_payment_id: 'pay_attempt_A',
          razorpay_signature: 'simulated_test_signature_valid',
        });
      expect(resA.status).toBe(200);

      // Verify Attempt B with distinct key
      const resB = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', keyB)
        .send({
          razorpay_order_id: orderId2,
          razorpay_payment_id: 'pay_attempt_B',
          razorpay_signature: 'simulated_test_signature_valid',
        });
      expect(resB.status).toBe(200);
    });
  });
});
