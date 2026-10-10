/**
 * ============================================================================
 * FLEET FLOW — BILLING & SUBSCRIPTION CONTROLLER (billingController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Manages SaaS subscriptions, plan catalogs, Razorpay checkout sessions,
 * second-precision mathematical proration calculus, add-on allocations,
 * and cryptographic HMAC-SHA256 webhook ingestion with idempotency guarantees.
 * ============================================================================
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { Plan, IPlan } from '../models/Plan.js';
import { AddOn, IAddOn } from '../models/AddOn.js';
import { Subscription, ISubscription } from '../models/Subscription.js';
import { ProcessedWebhook } from '../models/ProcessedWebhook.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { Company } from '../models/Company.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { calculateProration } from '../utils/prorationService.js';
import { getTenantEntitlements } from '../utils/entitlementService.js';
import { seedBillingCatalog } from '../utils/billingSeedService.js';
import {
  createPaymentOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../utils/paymentGateway.js';

/**
 * GET /api/billing/plans
 * Returns all public active subscription plans and available add-ons.
 */
export async function getBillingPlans(req: Request, res: Response): Promise<void> {
  try {
    await seedBillingCatalog();
    const plans = await Plan.find({ is_active: true, is_public: true }).sort({ monthly_price_paise: 1 });
    const addons = await AddOn.find({ is_active: true });
    res.json({ plans, addons });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch billing catalog.' });
  }
}

/**
 * GET /api/billing/subscription
 * Returns the current company's active subscription, resource usage vs quotas,
 * and enabled feature list.
 */
export async function getCompanySubscription(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    await seedBillingCatalog();
    const companyId = req.company._id;

    // Fetch or create initial trial subscription record
    let subscription: any = await Subscription.findOne({ company_id: companyId })
      .populate<{ plan_id: IPlan }>('plan_id')
      .populate<{ 'active_addons.addon_id': IAddOn }>('active_addons.addon_id');

    if (!subscription) {
      const standardPlan = await Plan.findOne({ code: 'standard' }) || await Plan.findOne();
      subscription = await Subscription.create({
        company_id: companyId,
        plan_id: standardPlan?._id,
        billing_cycle: 'monthly',
        status: req.company.subscription_status || 'trialing',
        current_period_start: req.company.created_at || new Date(),
        current_period_end: req.company.trial_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        trial_ends_at: req.company.trial_ends_at,
        active_addons: [],
      });
      if (subscription) {
        await subscription.populate('plan_id');
      }
    }

    // Measure live usage
    const [truckCount, driverCount, userCount] = await Promise.all([
      Truck.countDocuments({ company_id: companyId, is_deleted: false }),
      Driver.countDocuments({ company_id: companyId, is_deleted: false }),
      CompanyMember.countDocuments({ company_id: companyId, status: 'active' }),
    ]);

    // Entitlement summary
    const entitlements = await getTenantEntitlements(req.company);

    res.json({
      subscription,
      usage: {
        trucks: truckCount,
        drivers: driverCount,
        users: userCount,
      },
      entitlements,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch subscription profile.' });
  }
}

/**
 * POST /api/billing/calculate-change
 * Calculates mid-cycle proration preview before the customer confirms upgrade.
 */
export async function calculatePlanChangePreview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { target_plan_id, billing_cycle = 'monthly' } = req.body;
    if (!target_plan_id) {
      res.status(400).json({ error: 'Target plan ID is required.' });
      return;
    }

    const targetPlan = await Plan.findById(target_plan_id);
    if (!targetPlan) {
      res.status(404).json({ error: 'Target plan not found.' });
      return;
    }

    const subscription = await Subscription.findOne({ company_id: req.company._id }).populate<{ plan_id: IPlan }>('plan_id');
    if (!subscription || !subscription.plan_id) {
      res.status(400).json({ error: 'No active subscription found to modify.' });
      return;
    }

    const currentPlan = subscription.plan_id;
    const currentPricePaise = subscription.billing_cycle === 'annual'
      ? currentPlan.annual_price_paise
      : currentPlan.monthly_price_paise;

    const targetPricePaise = billing_cycle === 'annual'
      ? targetPlan.annual_price_paise
      : targetPlan.monthly_price_paise;

    const proration = calculateProration(
      currentPricePaise,
      targetPricePaise,
      subscription.current_period_start,
      subscription.current_period_end,
      new Date()
    );

    res.json({
      current_plan: {
        id: currentPlan._id,
        name: currentPlan.name,
        code: currentPlan.code,
        price_paise: currentPricePaise,
      },
      target_plan: {
        id: targetPlan._id,
        name: targetPlan.name,
        code: targetPlan.code,
        price_paise: targetPricePaise,
      },
      billing_cycle,
      proration,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate proration.' });
  }
}

async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await PaymentTransaction.countDocuments({
    invoice_number: { $regex: `^INV-${currentYear}-` },
  });
  return `INV-${currentYear}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * POST /api/billing/checkout
 * Initializes a Razorpay order with server-calculated amounts, GST tax breakup,
 * and records an initial pending transaction in the audit ledger.
 */
export async function initializeCheckout(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { plan_id, billing_cycle = 'monthly', promo_code } = req.body;
    const targetPlan = await Plan.findById(plan_id);
    if (!targetPlan) {
      res.status(404).json({ error: 'Selected plan not found.' });
      return;
    }

    let basePricePaise = billing_cycle === 'annual'
      ? targetPlan.annual_price_paise
      : targetPlan.monthly_price_paise;

    let discountPaise = 0;
    if (promo_code) {
      if (promo_code.toUpperCase() === 'LAUNCH50') {
        discountPaise = Math.round(basePricePaise * 0.5);
      }
    }

    const subtotalPaise = Math.max(0, basePricePaise - discountPaise);
    // GST 18% (9% CGST + 9% SGST) for Indian SaaS compliance
    const cgstPaise = Math.round(subtotalPaise * 0.09);
    const sgstPaise = Math.round(subtotalPaise * 0.09);
    const totalPaise = subtotalPaise + cgstPaise + sgstPaise;

    const invoiceNumber = await generateNextInvoiceNumber();

    const order = await createPaymentOrder({
      amount_paise: totalPaise,
      currency: 'INR',
      receipt: invoiceNumber,
      notes: {
        company_id: req.company._id.toString(),
        company_name: req.company.name,
        plan_id: targetPlan._id.toString(),
        billing_cycle,
        promo_code,
      },
    });

    const existingSub = await Subscription.findOne({ company_id: req.company._id });

    // Record pending transaction in audit ledger
    const transaction = await PaymentTransaction.create({
      company_id: req.company._id,
      subscription_id: existingSub?._id,
      plan_id: targetPlan._id,
      order_id: order.id,
      amount_paise: totalPaise,
      currency: order.currency,
      status: 'pending',
      billing_cycle,
      promo_code,
      discount_paise: discountPaise,
      tax_breakup: {
        subtotal_paise: subtotalPaise,
        cgst_paise: cgstPaise,
        sgst_paise: sgstPaise,
        total_paise: totalPaise,
        gst_rate_percent: 18,
      },
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
    });

    res.json({
      order_id: order.id,
      amount_paise: totalPaise,
      subtotal_paise: subtotalPaise,
      cgst_paise: cgstPaise,
      sgst_paise: sgstPaise,
      currency: order.currency,
      invoice_number: invoiceNumber,
      transaction_id: transaction._id,
      plan: {
        id: targetPlan._id,
        name: targetPlan.name,
        code: targetPlan.code,
      },
      billing_cycle,
      razorpay_key: order.key_id,
      is_live: order.is_live,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to initialize checkout.' });
  }
}

/**
 * POST /api/billing/verify-payment
 * Cryptographically verifies Razorpay payment signature (fail-closed),
 * activates the subscription, and records the completed transaction.
 */
export async function verifyPayment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
      billing_cycle = 'monthly',
      payment_method = 'card',
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        error: 'Missing required payment verification parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
      });
      return;
    }

    const targetPlan = await Plan.findById(plan_id);
    if (!targetPlan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    // Fail-closed HMAC signature verification
    const verification = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!verification.valid) {
      // Record failed transaction attempt
      await PaymentTransaction.findOneAndUpdate(
        { order_id: razorpay_order_id },
        {
          payment_id: razorpay_payment_id,
          status: 'failed',
          failure_reason: verification.reason || 'Cryptographic signature mismatch',
        }
      );

      res.status(400).json({
        error: verification.reason || 'Invalid payment signature. Verification failed.',
      });
      return;
    }

    const companyId = req.company._id;
    const now = new Date();
    const periodDurationDays = billing_cycle === 'annual' ? 365 : 30;
    const periodEnd = new Date(now.getTime() + periodDurationDays * 24 * 60 * 60 * 1000);

    // Update Subscription and Company
    const subscription = await Subscription.findOneAndUpdate(
      { company_id: companyId },
      {
        plan_id: targetPlan._id,
        billing_cycle,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
        'dunning.attempt_count': 0,
        scheduled_change: undefined,
      },
      { new: true, upsert: true }
    ).populate('plan_id');

    await Company.findByIdAndUpdate(companyId, {
      subscription_status: 'active',
    });

    // Mark transaction as successful
    const transaction = await PaymentTransaction.findOneAndUpdate(
      { order_id: razorpay_order_id },
      {
        payment_id: razorpay_payment_id,
        payment_method,
        status: 'success',
        subscription_id: subscription._id,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: `Payment verified successfully! Your workspace has been upgraded to ${targetPlan.name}.`,
      subscription,
      transaction,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Payment verification failed.' });
  }
}

/**
 * POST /api/billing/change-plan
 * Immediate upgrade (with proration) or scheduled downgrade at period end.
 */
export async function changePlan(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { target_plan_id, billing_cycle = 'monthly', immediate = true } = req.body;
    const targetPlan = await Plan.findById(target_plan_id);
    if (!targetPlan) {
      res.status(404).json({ error: 'Target plan not found.' });
      return;
    }

    const subscription = await Subscription.findOne({ company_id: req.company._id }).populate<{ plan_id: IPlan }>('plan_id');
    if (!subscription || !subscription.plan_id) {
      res.status(400).json({ error: 'No active subscription found.' });
      return;
    }

    const currentPlan = subscription.plan_id;
    const currentPricePaise = subscription.billing_cycle === 'annual'
      ? currentPlan.annual_price_paise
      : currentPlan.monthly_price_paise;
    const targetPricePaise = billing_cycle === 'annual'
      ? targetPlan.annual_price_paise
      : targetPlan.monthly_price_paise;

    // Check downgrade headroom quota if switching to a tier with quota caps
    const [truckCount, driverCount, userCount] = await Promise.all([
      Truck.countDocuments({ company_id: req.company._id, is_deleted: false }),
      Driver.countDocuments({ company_id: req.company._id, is_deleted: false }),
      CompanyMember.countDocuments({ company_id: req.company._id, status: 'active' }),
    ]);

    if (targetPlan.max_trucks !== -1 && truckCount > targetPlan.max_trucks) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${truckCount} active trucks, but ${targetPlan.name} allows a maximum of ${targetPlan.max_trucks}. Please decommission ${truckCount - targetPlan.max_trucks} trucks before switching.`,
      });
      return;
    }

    if (targetPlan.max_drivers !== -1 && driverCount > targetPlan.max_drivers) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${driverCount} active drivers, but ${targetPlan.name} allows a maximum of ${targetPlan.max_drivers}. Please remove ${driverCount - targetPlan.max_drivers} drivers first.`,
      });
      return;
    }

    if (targetPlan.max_users !== -1 && userCount > targetPlan.max_users) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${userCount} active users, but ${targetPlan.name} allows a maximum of ${targetPlan.max_users}.`,
      });
      return;
    }

    // Disallow free upgrades when on an active paid subscription
    if (subscription.status !== 'trialing' && targetPricePaise > currentPricePaise) {
      res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        error: `Upgrading to ${targetPlan.name} requires payment. Please complete checkout to activate this tier.`,
      });
      return;
    }

    // In trial mode or if immediate change requested (for downgrades or lateral changes):
    if (subscription.status === 'trialing' || immediate) {
      subscription.plan_id = targetPlan._id as any;
      subscription.billing_cycle = billing_cycle;
      if (subscription.status !== 'trialing') {
        subscription.status = 'active';
      }
      subscription.scheduled_change = undefined;
      await subscription.save();

      if (subscription.status !== 'trialing') {
        await Company.findByIdAndUpdate(req.company._id, { subscription_status: 'active' });
      }

      res.json({
        success: true,
        type: 'immediate_change',
        message: `Subscription successfully switched to ${targetPlan.name}!`,
        subscription,
      });
      return;
    }

    // Otherwise scheduled downgrade at end of paid period
    subscription.scheduled_change = {
      action: 'downgrade',
      target_plan_id: targetPlan._id as any,
      effective_at: subscription.current_period_end,
    };
    await subscription.save();

    res.json({
      success: true,
      type: 'scheduled_downgrade',
      message: `Downgrade to ${targetPlan.name} scheduled for ${subscription.current_period_end.toLocaleDateString()}.`,
      subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to change plan.' });
  }
}

/**
 * POST /api/billing/apply-scheduled
 * Immediately activates any pending scheduled plan downgrade or change.
 */
export async function applyScheduledChange(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const subscription = await Subscription.findOne({ company_id: req.company._id });
    if (!subscription || !subscription.scheduled_change?.target_plan_id) {
      res.status(400).json({ error: 'No scheduled plan change found.' });
      return;
    }

    const targetPlan = await Plan.findById(subscription.scheduled_change.target_plan_id);
    if (!targetPlan) {
      res.status(404).json({ error: 'Scheduled target plan not found.' });
      return;
    }

    // Check downgrade headroom quota
    const [truckCount, driverCount, userCount] = await Promise.all([
      Truck.countDocuments({ company_id: req.company._id, is_deleted: false }),
      Driver.countDocuments({ company_id: req.company._id, is_deleted: false }),
      CompanyMember.countDocuments({ company_id: req.company._id, status: 'active' }),
    ]);

    if (targetPlan.max_trucks !== -1 && truckCount > targetPlan.max_trucks) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${truckCount} active trucks, but ${targetPlan.name} allows a maximum of ${targetPlan.max_trucks}. Please decommission ${truckCount - targetPlan.max_trucks} trucks before switching.`,
      });
      return;
    }

    if (targetPlan.max_drivers !== -1 && driverCount > targetPlan.max_drivers) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${driverCount} active drivers, but ${targetPlan.name} allows a maximum of ${targetPlan.max_drivers}. Please remove ${driverCount - targetPlan.max_drivers} drivers first.`,
      });
      return;
    }

    if (targetPlan.max_users !== -1 && userCount > targetPlan.max_users) {
      res.status(422).json({
        code: 'DOWNGRADE_QUOTA_EXCEEDED',
        error: `Cannot switch to ${targetPlan.name}. You currently have ${userCount} active users, but ${targetPlan.name} allows a maximum of ${targetPlan.max_users}.`,
      });
      return;
    }

    subscription.plan_id = targetPlan._id as any;
    subscription.scheduled_change = undefined;
    await subscription.save();

    res.json({
      success: true,
      message: `Plan successfully switched to ${targetPlan.name} immediately!`,
      subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to apply scheduled plan.' });
  }
}

/**
 * POST /api/billing/cancel-scheduled
 * Cancels a pending scheduled plan downgrade.
 */
export async function cancelScheduledChange(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const subscription = await Subscription.findOne({ company_id: req.company._id });
    if (!subscription || !subscription.scheduled_change) {
      res.status(400).json({ error: 'No scheduled plan change found.' });
      return;
    }

    subscription.scheduled_change = undefined;
    await subscription.save();

    res.json({
      success: true,
      message: 'Scheduled plan change has been cancelled.',
      subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel scheduled plan change.' });
  }
}

/**
 * POST /api/billing/toggle-addon
 * Subscribes or unsubscribes from a standalone add-on.
 */
export async function toggleAddon(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { addon_code, enabled } = req.body;
    const addon = await AddOn.findOne({ code: addon_code, is_active: true });
    if (!addon) {
      res.status(404).json({ error: 'Add-on not found.' });
      return;
    }

    const subscription = await Subscription.findOne({ company_id: req.company._id });
    if (!subscription) {
      res.status(400).json({ error: 'No subscription record found.' });
      return;
    }

    const index = subscription.active_addons.findIndex((a) => a.code === addon_code);
    if (enabled && index === -1) {
      subscription.active_addons.push({
        addon_id: addon._id as any,
        code: addon.code,
        subscribed_at: new Date(),
      });
    } else if (!enabled && index !== -1) {
      subscription.active_addons.splice(index, 1);
    }

    await subscription.save();

    res.json({
      success: true,
      message: `${addon.name} ${enabled ? 'activated' : 'removed'}.`,
      active_addons: subscription.active_addons,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update add-on.' });
  }
}

/**
 * POST /api/webhooks/billing
 * Ingests Razorpay webhooks with cryptographic HMAC-SHA256 signature verification
 * on raw request body and strict idempotency checking via ProcessedWebhook.
 */
export async function handleBillingWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawPayload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    // FAIL-CLOSED: Reject missing or mismatched webhook signatures
    if (!signature || !verifyWebhookSignature(rawPayload, signature)) {
      res.status(400).json({ error: 'Invalid or missing webhook signature. Verification failed.' });
      return;
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventId = event.event_id || event.id || `evt_${Date.now()}`;

    // IDEMPOTENCY CHECK: Ensure event has not already been processed
    const alreadyProcessed = await ProcessedWebhook.findOne({ event_id: eventId });
    if (alreadyProcessed) {
      // Acknowledge duplicate delivery safely with 200 OK without re-processing
      res.status(200).json({ status: 'idempotent_duplicate_ignored', event_id: eventId });
      return;
    }

    // Record webhook processing start
    await ProcessedWebhook.create({
      event_id: eventId,
      source: 'razorpay',
      event_type: event.event || 'payment.captured',
      payload: event,
      status: 'success',
    });

    const eventType = event.event;
    const entity = event.payload?.payment?.entity || event.payload?.subscription?.entity || {};
    const orderId = entity.order_id;
    const paymentId = entity.id;
    const notes = entity.notes || {};
    const companyId = notes.company_id;

    // Update persistent PaymentTransaction ledger if order_id exists
    if (orderId) {
      if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
        await PaymentTransaction.findOneAndUpdate(
          { order_id: orderId },
          {
            payment_id: paymentId,
            status: 'success',
            payment_method: entity.method || 'card',
          }
        );
      } else if (eventType === 'payment.failed') {
        await PaymentTransaction.findOneAndUpdate(
          { order_id: orderId },
          {
            payment_id: paymentId,
            status: 'failed',
            failure_reason: entity.error_description || 'Payment failed via webhook',
          }
        );
      } else if (eventType === 'refund.processed') {
        await PaymentTransaction.findOneAndUpdate(
          { order_id: orderId },
          {
            status: 'refunded',
          }
        );
      }
    }

    if (companyId) {
      if (eventType === 'payment.captured' || eventType === 'subscription.charged') {
        // Renewal / payment succeeded: clear dunning and extend period
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await Subscription.findOneAndUpdate(
          { company_id: companyId },
          {
            status: 'active',
            current_period_end: periodEnd,
            'dunning.attempt_count': 0,
            'dunning.last_attempt_at': new Date(),
          }
        );
        await Company.findByIdAndUpdate(companyId, { subscription_status: 'active' });
      } else if (eventType === 'payment.failed') {
        // Renewal failed: advance 7-day dunning lifecycle
        const sub = await Subscription.findOne({ company_id: companyId });
        if (sub) {
          const attempt = (sub.dunning.attempt_count || 0) + 1;
          const graceEnd = sub.dunning.grace_period_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          if (attempt >= 3 && Date.now() > graceEnd.getTime()) {
            // Day 7+: Transition to read-only SUSPENDED mode
            sub.status = 'suspended';
            await Company.findByIdAndUpdate(companyId, { subscription_status: 'suspended' });
          } else {
            // In grace period: set to past_due
            sub.status = 'past_due';
            await Company.findByIdAndUpdate(companyId, { subscription_status: 'past_due' });
          }

          sub.dunning.attempt_count = attempt;
          sub.dunning.last_attempt_at = new Date();
          sub.dunning.grace_period_ends_at = graceEnd;
          await sub.save();
        }
      } else if (eventType === 'subscription.halted' || eventType === 'subscription.cancelled') {
        await Subscription.findOneAndUpdate(
          { company_id: companyId },
          { status: 'suspended' }
        );
        await Company.findByIdAndUpdate(companyId, { subscription_status: 'suspended' });
      }
    }

    res.status(200).json({ status: 'success', event_id: eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Webhook processing failed.' });
  }
}

/**
 * GET /api/billing/history
 * Returns the tenant's persistent audit ledger of payment transactions and invoices.
 */
export async function getBillingHistory(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const transactions = await PaymentTransaction.find({ company_id: req.company._id })
      .populate('plan_id', 'name code')
      .sort({ created_at: -1 })
      .lean();

    res.json({
      success: true,
      transactions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch billing history.' });
  }
}

/**
 * GET /api/billing/invoices/:id/receipt
 * Returns a structured B2B GST tax invoice receipt for a specific payment transaction.
 */
export async function getBillingInvoiceReceipt(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { id } = req.params;
    const transaction = await PaymentTransaction.findOne({
      _id: id,
      company_id: req.company._id,
    }).populate('plan_id');

    if (!transaction) {
      res.status(404).json({ error: 'Invoice or payment transaction not found.' });
      return;
    }

    const plan = transaction.plan_id as any;

    const receipt = {
      invoice_number: transaction.invoice_number,
      invoice_date: transaction.invoice_date,
      payment_date: transaction.updated_at,
      status: transaction.status,
      payment_method: transaction.payment_method || 'Razorpay Online',
      order_id: transaction.order_id,
      payment_id: transaction.payment_id || 'N/A',
      currency: transaction.currency || 'INR',

      // Platform / Supplier Details (FleetFlow B2B SaaS)
      supplier: {
        legal_name: 'Fleet Flow Logistics Technologies Pvt. Ltd.',
        trade_name: 'FleetFlow SaaS',
        gstin: '27AABCF1234F1Z8', // Registered Maharashtra GSTIN
        sac_code: '998313', // IT Software as a Service SAC Code
        address: 'Tower 4, FinTech Park, Hinjewadi Phase 2, Pune, Maharashtra 411057',
        support_email: 'billing@fleetflow.io',
      },

      // Customer / Recipient Details
      customer: {
        company_name: req.company.name,
        company_id: req.company._id,
        email: (req.user as any)?.email || 'admin@company.com',
        phone: req.company.phone || 'N/A',
        gstin: req.company.gstin || 'Unregistered B2B Tenant',
        address: req.company.address || 'N/A',
      },

      // Line items & GST breakdown
      line_items: [
        {
          description: `FleetFlow Subscription — ${plan?.name || 'Transport Management SaaS'} (${transaction.billing_cycle === 'annual' ? 'Annual Plan' : 'Monthly Plan'})`,
          sac_code: '998313',
          unit_price_paise: transaction.tax_breakup.subtotal_paise,
          quantity: 1,
          discount_paise: transaction.discount_paise || 0,
          net_taxable_paise: transaction.tax_breakup.subtotal_paise,
        },
      ],
      tax_summary: {
        subtotal_paise: transaction.tax_breakup.subtotal_paise,
        cgst_rate_percent: 9,
        cgst_paise: transaction.tax_breakup.cgst_paise,
        sgst_rate_percent: 9,
        sgst_paise: transaction.tax_breakup.sgst_paise,
        total_tax_paise: transaction.tax_breakup.cgst_paise + transaction.tax_breakup.sgst_paise,
        total_amount_paise: transaction.tax_breakup.total_paise,
        total_amount_inr: (transaction.tax_breakup.total_paise / 100).toFixed(2),
      },
    };

    res.json({
      success: true,
      receipt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate tax invoice receipt.' });
  }
}

