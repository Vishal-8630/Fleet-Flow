import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Plan } from '../../models/Plan.js';
import { Truck } from '../../models/Truck.js';
import { Subscription } from '../../models/Subscription.js';
import { Company } from '../../models/Company.js';
import { User } from '../../models/User.js';
import { CompanyMember } from '../../models/CompanyMember.js';
import { PaymentTransaction } from '../../models/PaymentTransaction.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { getTenantEntitlements } from '../../utils/entitlementService.js';

describe('Phase E1: Trial Duration Provisioning & Free Pro-Upgrade Security Safeguards (DEC-001 & FF-ISSUE-023)', () => {
  beforeEach(async () => {
    await seedBillingCatalog();
  });

  // ==========================================================================
  // SUITE 1: 7-Day Trial Provisioning & Starter Tier Consistency (DEC-001)
  // ==========================================================================
  describe('1. 7-Day Trial Provisioning & Starter Tier Consistency', () => {
    it('provisions newly registered company with exactly a 7-day trial and Starter plan', async () => {
      const email = `trial-user-${Date.now()}@fleetflow.io`;

      const startTime = Date.now();
      const res = await request(app)
        .post('/api/auth/register-company')
        .send({
          companyName: 'Seven Day Freightways',
          name: 'Praveen Sharma',
          email,
          password: 'SecurePassword123!',
          phone: '+919876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.company).toBeDefined();

      const company = await Company.findOne({ email });
      expect(company).not.toBeNull();
      expect(company?.subscription_status).toBe('trialing');

      // Verify trial duration is exactly 7 days (604,800,000 ms +/- 5000ms)
      const trialEndsAtMs = new Date(company!.trial_ends_at).getTime();
      const expectedEndMs = startTime + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(trialEndsAtMs - expectedEndMs)).toBeLessThan(5000);

      // Verify subscription document is linked to Starter plan
      const subscription = await Subscription.findOne({ company_id: company!._id }).populate<{ plan_id: any }>('plan_id');
      expect(subscription).not.toBeNull();
      expect(subscription?.status).toBe('trialing');
      expect(subscription?.plan_id.code).toBe('starter');

      // Verify subscription current_period_end matches trial_ends_at
      expect(new Date(subscription!.current_period_end).getTime()).toBe(trialEndsAtMs);
      expect(new Date(subscription!.trial_ends_at!).getTime()).toBe(trialEndsAtMs);

      // Verify entitlement service reports Starter tier limits (5 trucks during trial per DEC-001, 1 branch, 2 users)
      const entitlements = await getTenantEntitlements(company!);
      expect(entitlements.status).toBe('trialing');
      expect(entitlements.plan.code).toBe('starter');
      expect(entitlements.limits.max_trucks).toBe(5);
      expect(entitlements.limits.max_branches).toBe(1);
      expect(entitlements.limits.max_users).toBe(2);
      expect(entitlements.days_remaining_in_trial).toBe(7);
      expect(entitlements.is_read_only).toBe(false);
    });

    it('provisions newly created workspace with exactly a 7-day trial and Starter plan', async () => {
      const tenant = await createTestTenant({ name: 'Primary Carrier' });

      const startTime = Date.now();
      const res = await request(app)
        .post('/api/auth/create-workspace')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          companyName: 'Secondary Logistics Hub',
          phone: '+919876543211',
        });

      expect(res.status).toBe(201);
      const newCompanyId = res.body.company.id || res.body.company._id;

      const newCompany = await Company.findById(newCompanyId);
      expect(newCompany?.subscription_status).toBe('trialing');

      const trialEndsAtMs = new Date(newCompany!.trial_ends_at).getTime();
      const expectedEndMs = startTime + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(trialEndsAtMs - expectedEndMs)).toBeLessThan(5000);

      const sub = await Subscription.findOne({ company_id: newCompanyId }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.status).toBe('trialing');
      expect(sub?.plan_id.code).toBe('starter');
      expect(new Date(sub!.current_period_end).getTime()).toBe(trialEndsAtMs);
    });

    it('preserves existing company trial expiry dates and does not overwrite or downgrade them', async () => {
      // Create a grandfathered/pilot company with a custom 14-day expiry
      const pilotCompany = await Company.create({
        name: 'Grandfathered Pilot Express',
        slug: `pilot-${Date.now()}`,
        email: `pilot-${Date.now()}@fleetflow.io`,
        phone: '+919800000014',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day grandfathered trial
      });

      const originalExpiryMs = new Date(pilotCompany.trial_ends_at).getTime();

      const user = await User.create({
        name: 'Pilot Admin',
        email: pilotCompany.email,
        password_hash: 'hash',
        is_verified: true,
      });

      await CompanyMember.create({
        company_id: pilotCompany._id,
        user_id: user._id,
        email: user.email,
        role: 'admin',
        status: 'active',
      });

      const token = jwtSignUser(user._id, pilotCompany._id);

      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify database record retained its original 14-day expiry
      const refreshedCompany = await Company.findById(pilotCompany._id);
      expect(new Date(refreshedCompany!.trial_ends_at).getTime()).toBe(originalExpiryMs);
      expect(res.body.entitlements.days_remaining_in_trial).toBeGreaterThanOrEqual(13);
    });

    it('locks down expired trials to read-only mode and blocks write operations', async () => {
      // Company whose trial expired 1 hour ago
      const expiredCompany = await Company.create({
        name: 'Expired Transit Co',
        slug: `expired-${Date.now()}`,
        email: `expired-${Date.now()}@fleetflow.io`,
        phone: '+919800000099',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 3600 * 1000), // 1 hour in the past
      });

      const starterPlan = await Plan.findOne({ code: 'starter' });
      await Subscription.create({
        company_id: expiredCompany._id,
        plan_id: starterPlan?._id,
        status: 'trialing',
        trial_ends_at: expiredCompany.trial_ends_at,
        current_period_end: expiredCompany.trial_ends_at,
      });

      const user = await User.create({
        name: 'Expired Admin',
        email: expiredCompany.email,
        password_hash: 'hash',
        is_verified: true,
      });

      await CompanyMember.create({
        company_id: expiredCompany._id,
        user_id: user._id,
        email: user.email,
        role: 'admin',
        status: 'active',
      });

      const token = jwtSignUser(user._id, expiredCompany._id);

      // Write action (creating truck) should be rejected with 403 SUBSCRIPTION_EXPIRED
      const writeRes = await request(app)
        .post('/api/fleet/trucks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          truck_no: 'MH-12-EX-0001',
          truck_type: 'Owned',
          ownership_type: 'Owned',
          body_type: 'Container',
          tonnage_capacity: 10,
        });

      expect(writeRes.status).toBe(403);
      expect(writeRes.body.code).toBe('SUBSCRIPTION_EXPIRED');
      expect(writeRes.body.error).toContain('7-day free trial has expired');

      // Read action (listing trucks) should succeed even when expired (read-only grace)
      const readRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${token}`);

      expect(readRes.status).toBe(200);

      // Entitlements should report expired and 0 days remaining
      const refreshedCompany = await Company.findById(expiredCompany._id);
      expect(refreshedCompany?.subscription_status).toBe('expired');

      const entitlements = await getTenantEntitlements(refreshedCompany!);
      expect(entitlements.status).toBe('expired');
      expect(entitlements.is_read_only).toBe(true);
      expect(entitlements.days_remaining_in_trial).toBe(0);
    });
  });

  // ==========================================================================
  // SUITE 2: Pro-Upgrade Security & Plan Change Authorization Safeguards
  // ==========================================================================
  describe('2. Pro-Upgrade Security & Plan Change Authorization Safeguards', () => {
    it('blocks a trial user from switching to Pro tier via POST /api/billing/change-plan without payment', async () => {
      const tenant = await createTestTenant({ name: 'Sneaky Trialer', subscription_status: 'trialing', plan_code: 'starter' });
      const proPlan = await Plan.findOne({ code: 'pro' });
      expect(proPlan).not.toBeNull();

      // Attempt to immediately change plan to Pro for free
      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: proPlan!._id,
          billing_cycle: 'monthly',
          immediate: true,
        });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PAYMENT_REQUIRED');
      expect(res.body.error).toContain('requires payment');

      // Verify the subscription in database remained on Starter
      const sub = await Subscription.findOne({ company_id: tenant.company._id }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.status).toBe('trialing');
      expect(sub?.plan_id.code).toBe('starter');

      // Verify company status did not become active
      const company = await Company.findById(tenant.company._id);
      expect(company?.subscription_status).toBe('trialing');

      // Verify entitlements did not grant Pro features
      const entitlements = await getTenantEntitlements(company!);
      expect(entitlements.enabled_features).not.toContain('MOD_MAINTENANCE');
      expect(entitlements.enabled_features).not.toContain('MOD_TALLY_SYNC');
    });

    it('blocks a trial user from switching to Standard tier via POST /api/billing/change-plan without payment', async () => {
      const tenant = await createTestTenant({ name: 'Trial Switcher', subscription_status: 'trialing', plan_code: 'starter' });
      const standardPlan = await Plan.findOne({ code: 'standard' });

      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: standardPlan!._id,
          billing_cycle: 'monthly',
          immediate: true,
        });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PAYMENT_REQUIRED');
    });

    it('blocks an expired tenant from obtaining any plan via POST /api/billing/change-plan without payment', async () => {
      const tenant = await createTestTenant({ name: 'Expired Switcher', subscription_status: 'expired', plan_code: 'starter' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: proPlan!._id,
          billing_cycle: 'monthly',
          immediate: true,
        });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('PAYMENT_REQUIRED');
    });

    it('blocks non-admin users from calling plan change endpoint with HTTP 403', async () => {
      const tenant = await createTestTenant({ name: 'NonAdmin Carrier', role: 'dispatcher' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: proPlan!._id,
          billing_cycle: 'monthly',
        });

      expect(res.status).toBe(403);
    });

    it('activates Pro tier legitimately when payment is cryptographically verified', async () => {
      const tenant = await createTestTenant({ name: 'Legitimate Buyer Co', subscription_status: 'trialing', plan_code: 'starter' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const orderId = `order_legit_${Date.now()}`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: `INV-LEGIT-${Date.now()}`,
        tax_breakup: {
          subtotal_paise: 762627,
          cgst_paise: 68636,
          sgst_paise: 68636,
          total_paise: 899900,
          gst_rate_percent: 18,
        },
      });

      // Submit verified payment
      const res = await request(app)
        .post('/api/billing/verify-payment')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem_${Date.now()}_legit`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_legit_123',
          razorpay_signature: 'simulated_test_signature_valid',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify subscription upgraded to active Pro
      const sub = await Subscription.findOne({ company_id: tenant.company._id }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.status).toBe('active');
      expect(sub?.plan_id.code).toBe('pro');

      // Verify company status upgraded to active
      const company = await Company.findById(tenant.company._id);
      expect(company?.subscription_status).toBe('active');

      // Verify Pro features unlocked
      const entitlements = await getTenantEntitlements(company!);
      expect(entitlements.status).toBe('active');
      expect(entitlements.enabled_features).toContain('MOD_MAINTENANCE');
      expect(entitlements.enabled_features).toContain('MOD_TALLY_SYNC');
    });

    it('rejects tampered or failed payment signature without activating Pro tier', async () => {
      const tenant = await createTestTenant({ name: 'Tampered Attacker', subscription_status: 'trialing', plan_code: 'starter' });
      const proPlan = await Plan.findOne({ code: 'pro' });

      const orderId = `order_tamper_${Date.now()}`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        order_id: orderId,
        plan_id: proPlan?._id,
        amount_paise: 899900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: `INV-TAMPER-${Date.now()}`,
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
        .set('x-idempotency-key', `idem_${Date.now()}_tamper`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_fraud_123',
          razorpay_signature: 'tampered_invalid_signature_hex',
        });

      expect(res.status).toBe(400);

      // Verify subscription did not activate Pro
      const sub = await Subscription.findOne({ company_id: tenant.company._id }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.status).toBe('trialing');
      expect(sub?.plan_id.code).toBe('starter');

      const company = await Company.findById(tenant.company._id);
      expect(company?.subscription_status).toBe('trialing');
    });

    it('permits legitimate paid subscriber to downgrade from Pro to Standard immediately', async () => {
      const tenant = await createTestTenant({ name: 'Active Pro Fleet', subscription_status: 'active', plan_code: 'pro' });
      const standardPlan = await Plan.findOne({ code: 'standard' });
      expect(standardPlan).not.toBeNull();

      // Pro ($8999) to Standard ($3999) is a downgrade (targetPrice <= currentPrice)
      const res = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          target_plan_id: standardPlan!._id,
          billing_cycle: 'monthly',
          immediate: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe('immediate_change');

      const sub = await Subscription.findOne({ company_id: tenant.company._id }).populate<{ plan_id: any }>('plan_id');
      expect(sub?.plan_id.code).toBe('standard');
      expect(sub?.status).toBe('active');
    });
  });
});

function jwtSignUser(userId: any, companyId: any): string {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign({ userId, companyId, token_version: 0 }, secret, { expiresIn: '1h' });
}
