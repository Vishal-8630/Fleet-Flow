import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Company } from '../../models/Company.js';
import { PaymentTransaction } from '../../models/PaymentTransaction.js';
import { ProcessedWebhook } from '../../models/ProcessedWebhook.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { getGatewayCredentials } from '../../utils/paymentGateway.js';

describe('Phase E4: GST-Inclusive Pricing & Trial-Conversion Security (DEC-001)', () => {
  let starterPlan: any;
  let standardPlan: any;
  let proPlan: any;

  beforeEach(async () => {
    await seedBillingCatalog();
    starterPlan = await Plan.findOne({ code: 'starter' });
    standardPlan = await Plan.findOne({ code: 'standard' });
    proPlan = await Plan.findOne({ code: 'pro' });
  });

  // ==========================================================================
  // SUITE 1: GST-Inclusive Pricing & Math Verification (DEC-001)
  // ==========================================================================
  describe('1. Approved DEC-001 GST-Inclusive Pricing Compliance', () => {
    it('Starter monthly checkout uses exactly ₹1,999 (199,900 paise) as the gross price with derived GST', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      expect(res.status).toBe(200);
      expect(res.body.amount_paise).toBe(199900); // Exactly ₹1,999 (NOT ₹2,358)
      expect(res.body.subtotal_paise).toBe(169407); // ₹1,694.07 taxable
      expect(res.body.cgst_paise).toBe(15247); // ₹152.47 CGST
      expect(res.body.sgst_paise).toBe(15246); // ₹152.46 SGST
      expect(res.body.subtotal_paise + res.body.cgst_paise + res.body.sgst_paise).toBe(res.body.amount_paise);

      // Verify transaction record in database matches
      const txn = await PaymentTransaction.findOne({ order_id: res.body.order_id });
      expect(txn).not.toBeNull();
      expect(txn?.amount_paise).toBe(199900);
      expect(txn?.tax_breakup.total_paise).toBe(199900);
      expect(txn?.tax_breakup.subtotal_paise).toBe(169407);
      expect(txn?.tax_breakup.cgst_paise).toBe(15247);
      expect(txn?.tax_breakup.sgst_paise).toBe(15246);
    });

    it('Standard monthly checkout uses exactly ₹3,999 (399,900 paise) as the gross price with derived GST', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: standardPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      expect(res.status).toBe(200);
      expect(res.body.amount_paise).toBe(399900); // Exactly ₹3,999 (NOT ₹4,718)
      expect(res.body.subtotal_paise).toBe(338898); // ₹3,388.98 taxable
      expect(res.body.cgst_paise).toBe(30501); // ₹305.01 CGST
      expect(res.body.sgst_paise).toBe(30501); // ₹305.01 SGST
      expect(res.body.subtotal_paise + res.body.cgst_paise + res.body.sgst_paise).toBe(399900);
    });

    it('Pro monthly checkout uses exactly ₹8,999 (899,900 paise) as the gross price with derived GST', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: proPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      expect(res.status).toBe(200);
      expect(res.body.amount_paise).toBe(899900); // Exactly ₹8,999 (NOT ₹10,618)
      expect(res.body.subtotal_paise).toBe(762627); // ₹7,626.27 taxable
      expect(res.body.cgst_paise).toBe(68637); // ₹686.37 CGST
      expect(res.body.sgst_paise).toBe(68636); // ₹686.36 SGST
      expect(res.body.subtotal_paise + res.body.cgst_paise + res.body.sgst_paise).toBe(899900);
    });

    it('Annual checkouts use exact approved annual gross prices', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      // Starter Annual: ₹19,990
      const resStarter = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'annual',
        });
      expect(resStarter.status).toBe(200);
      expect(resStarter.body.amount_paise).toBe(1999000);
      expect(resStarter.body.subtotal_paise).toBe(1694068);
      expect(resStarter.body.cgst_paise).toBe(152466);
      expect(resStarter.body.sgst_paise).toBe(152466);
      expect(resStarter.body.subtotal_paise + resStarter.body.cgst_paise + resStarter.body.sgst_paise).toBe(1999000);

      // Standard Annual: ₹39,990
      const resStandard = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: standardPlan._id.toString(),
          billing_cycle: 'annual',
        });
      expect(resStandard.status).toBe(200);
      expect(resStandard.body.amount_paise).toBe(3999000);
      expect(resStandard.body.subtotal_paise).toBe(3388983);
      expect(resStandard.body.cgst_paise).toBe(305009);
      expect(resStandard.body.sgst_paise).toBe(305008);
      expect(resStandard.body.subtotal_paise + resStandard.body.cgst_paise + resStandard.body.sgst_paise).toBe(3999000);

      // Pro Annual: ₹89,990
      const resPro = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: proPlan._id.toString(),
          billing_cycle: 'annual',
        });
      expect(resPro.status).toBe(200);
      expect(resPro.body.amount_paise).toBe(8999000);
      expect(resPro.body.subtotal_paise).toBe(7626271);
      expect(resPro.body.cgst_paise).toBe(686365);
      expect(resPro.body.sgst_paise).toBe(686364);
      expect(resPro.body.subtotal_paise + resPro.body.cgst_paise + resPro.body.sgst_paise).toBe(8999000);
    });

    it('correctly handles promo code discounts and maintains zero rounding drift', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      // Starter Monthly with 50% discount (LAUNCH50):
      // base = 199900 paise, discount = 99950 paise, gross = 99950 paise (₹999.50)
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
          promo_code: 'LAUNCH50',
        });

      expect(res.status).toBe(200);
      expect(res.body.amount_paise).toBe(99950);
      expect(res.body.subtotal_paise).toBe(84703);
      expect(res.body.cgst_paise).toBe(7624);
      expect(res.body.sgst_paise).toBe(7623);
      expect(res.body.subtotal_paise + res.body.cgst_paise + res.body.sgst_paise).toBe(99950);
    });

    it('server remains authoritative: rejects/ignores client-supplied prices or amounts', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: proPlan._id.toString(),
          billing_cycle: 'monthly',
          amount: 100, // Attacker sends ₹1
          amount_paise: 100,
          totalPaise: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.amount_paise).toBe(899900); // Authoritative ₹8,999 is charged
      expect(res.body.amount_paise).not.toBe(100);
    });

    it('generates compliant B2B tax invoice receipt with matching GST-inclusive breakdown', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: standardPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const receiptRes = await request(app)
        .get(`/api/billing/invoices/${checkoutRes.body.transaction_id}/receipt`)
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(receiptRes.status).toBe(200);
      expect(receiptRes.body.success).toBe(true);

      const summary = receiptRes.body.receipt.tax_summary;
      expect(summary.total_amount_paise).toBe(399900);
      expect(summary.subtotal_paise).toBe(338898);
      expect(summary.cgst_paise).toBe(30501);
      expect(summary.sgst_paise).toBe(30501);
      expect(summary.total_amount_inr).toBe('3999.00');
    });

    it('preserves existing historical payment records without bulk mutations', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'active' });

      const oldTxn = await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: `order_hist_${Date.now()}`,
        plan_id: starterPlan._id,
        amount_paise: 235882, // Old pre-DEC-001 calculation record
        currency: 'INR',
        status: 'success',
        billing_cycle: 'monthly',
        invoice_number: 'INV-2025-0001',
        tax_breakup: {
          subtotal_paise: 199900,
          cgst_paise: 17991,
          sgst_paise: 17991,
          total_paise: 235882,
          gst_rate_percent: 18,
        },
      });

      const fetchedTxn = await PaymentTransaction.findById(oldTxn._id);
      expect(fetchedTxn?.amount_paise).toBe(235882);
      expect(fetchedTxn?.tax_breakup.total_paise).toBe(235882);
    });
  });

  // ==========================================================================
  // SUITE 2: Trial-Conversion & Payment Security Verification
  // ==========================================================================
  describe('2. Trial-Conversion & Payment Security Safeguards', () => {
    it('trialing tenant cannot upgrade to a paid plan via change-plan without payment', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const sub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(sub?.status).toBe('trialing');

      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: proPlan._id.toString(),
          immediate: true,
        });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PAYMENT_REQUIRED');
      expect(res.body.error).toContain('requires payment');

      // Assert subscription was NOT mutated
      const refreshedSub = await Subscription.findOne({ company_id: tenant.company._id });
      expect(refreshedSub?.status).toBe('trialing');
      expect(refreshedSub?.plan_id.toString()).not.toBe(proPlan._id.toString());
    });

    it('expired tenant cannot switch plans via change-plan without payment', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'expired' });

      await Subscription.findOneAndUpdate(
        { company_id: tenant.company._id },
        { status: 'expired' }
      );

      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: standardPlan._id.toString(),
          immediate: true,
        });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PAYMENT_REQUIRED');
    });

    it('trialing tenant calculating plan change preview receives full payable amount with zero prior credit', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const res = await request(app)
        .post('/api/billing/calculate-change')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: proPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      expect(res.status).toBe(200);
      expect(res.body.proration.current_plan_credit_paise).toBe(0);
      expect(res.body.proration.net_payable_paise).toBe(899900); // Full Pro monthly price
      expect(res.body.proration.net_payable_rupees).toBe(8999);
      expect(res.body.proration.fraction_remaining).toBe(1);
    });

    it('valid payment for authoritative gross amount activates subscription and updates company status', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      // Step 1: Initialize checkout for Pro monthly (₹8,999)
      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: proPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      expect(checkoutRes.status).toBe(200);
      const orderId = checkoutRes.body.order_id;
      expect(checkoutRes.body.amount_paise).toBe(899900);

      // Step 2: Verify payment with valid signature and matching order
      const verifyRes = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_valid`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_${Date.now()}_success`,
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // Verify subscription activated with Pro plan
      const sub = await Subscription.findOne({ company_id: tenant.company._id }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.status).toBe('active');
      expect(sub?.plan_id.code).toBe('pro');

      // Verify Company status updated to active
      const company = await Company.findById(tenant.company._id);
      expect(company?.subscription_status).toBe('active');

      // Verify transaction marked success with correct authoritative amount
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('success');
      expect(txn?.amount_paise).toBe(899900);
    });

    it('rejects payment verification with invalid cryptographic signature', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const orderId = checkoutRes.body.order_id;

      const verifyRes = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_bad_sig`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_bad_sig_123',
          razorpay_signature: 'invalid_forged_cryptographic_signature',
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toContain('signature');

      // Transaction marked as failed in ledger
      const txn = await PaymentTransaction.findOne({ order_id: orderId });
      expect(txn?.status).toBe('failed');
    });

    it('rejects cross-tenant payment verification attempt (order belonging to Tenant B)', async () => {
      const tenantA = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });
      const tenantB = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      // Tenant A initializes checkout
      const checkoutResA = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          plan_id: proPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const orderIdA = checkoutResA.body.order_id;

      // Tenant B tries to verify using Tenant A's orderId
      const verifyResB = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenantB.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_cross_tenant`)
        .send({
          razorpay_order_id: orderIdA,
          razorpay_payment_id: `pay_${Date.now()}_hijack`,
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(verifyResB.status).toBe(404);
      expect(verifyResB.body.error).toContain('not found for this tenant');
    });

    it('duplicate verification attempt on already processed transaction is rejected idempotently', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const orderId = checkoutRes.body.order_id;

      // First verification succeeds
      const firstRes = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_first`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_${Date.now()}_1`,
          razorpay_signature: 'simulated_test_signature_valid',
        });
      expect(firstRes.status).toBe(200);

      // Second verification attempt is rejected
      const secondRes = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_second`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_${Date.now()}_2`,
          razorpay_signature: 'simulated_test_signature_valid',
        });
      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error).toContain('already been verified');
    });

    it('webhook rejects payment amount mismatch against server-side transaction', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const orderId = checkoutRes.body.order_id;
      const creds = getGatewayCredentials();

      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        event_id: `evt_mismatch_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_${Date.now()}`,
              order_id: orderId,
              amount: 50000, // Attacker forged 50,000 paise instead of 199,900
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const signature = crypto
        .createHmac('sha256', creds.webhookSecret)
        .update(webhookPayload)
        .digest('hex');

      const webhookRes = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(webhookRes.status).toBe(400);
      expect(webhookRes.body.error).toContain('amount mismatch');
    });

    it('webhook retries remain idempotent and do not duplicate processing', async () => {
      const tenant = await createTestTenant({ role: 'admin', subscription_status: 'trialing' });

      const checkoutRes = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          plan_id: starterPlan._id.toString(),
          billing_cycle: 'monthly',
        });

      const orderId = checkoutRes.body.order_id;
      const creds = getGatewayCredentials();
      const eventId = `evt_dedup_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_${Date.now()}`,
              order_id: orderId,
              amount: 199900,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const signature = crypto
        .createHmac('sha256', creds.webhookSecret)
        .update(webhookPayload)
        .digest('hex');

      // First webhook delivery
      const firstRes = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(firstRes.status).toBe(200);

      // Second webhook retry with exact same event_id
      const retryRes = await request(app)
        .post('/api/webhooks/billing')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe('idempotent_duplicate_ignored');

      // Confirm only 1 ProcessedWebhook record exists
      const processedCount = await ProcessedWebhook.countDocuments({ event_id: eventId });
      expect(processedCount).toBe(1);
    });
  });
});
