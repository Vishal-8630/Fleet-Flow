/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN CONTROL PLANE CONTROLLER (superAdminController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Powers the central SaaS platform administration control plane:
 * - Macro health metrics (MRR, ARR, active fleet under management, tenant count).
 * - Multi-tenant directory with quota overrides and trial extensions.
 * - Audited 1-hour support impersonation sessions.
 * - Dynamic Plan & Add-On catalog management.
 * ============================================================================
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Company, ICompany } from '../models/Company.js';
import { Subscription, ISubscription } from '../models/Subscription.js';
import { Plan, IPlan } from '../models/Plan.js';
import { AddOn } from '../models/AddOn.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { PlatformAuditLog } from '../models/PlatformAuditLog.js';
import { PlatformSetting } from '../models/PlatformSetting.js';
import { PromoCode } from '../models/PromoCode.js';
import { seedBillingCatalog } from '../utils/billingSeedService.js';

/**
 * GET /api/super-admin/kpis
 * Global platform health telemetry.
 */
export async function getPlatformKPIs(req: Request, res: Response): Promise<void> {
  try {
    await seedBillingCatalog();

    const [
      totalTenants,
      activeTenants,
      trialingTenants,
      suspendedTenants,
      totalTrucks,
      totalDrivers,
      subscriptions,
    ] = await Promise.all([
      Company.countDocuments({ is_deleted: false }),
      Company.countDocuments({ subscription_status: 'active', is_deleted: false }),
      Company.countDocuments({ subscription_status: 'trialing', is_deleted: false }),
      Company.countDocuments({ subscription_status: { $in: ['suspended', 'expired'] }, is_deleted: false }),
      Truck.countDocuments({ is_deleted: false }),
      Driver.countDocuments({ is_deleted: false }),
      Subscription.find({ status: 'active' }).populate<{ plan_id: IPlan }>('plan_id'),
    ]);

    // Calculate MRR from active subscriptions in integer Paise
    let mrrPaise = 0;
    for (const sub of subscriptions) {
      if (sub.plan_id) {
        if (sub.billing_cycle === 'annual') {
          mrrPaise += Math.round(sub.plan_id.annual_price_paise / 12);
        } else {
          mrrPaise += sub.plan_id.monthly_price_paise;
        }
      }
    }

    const mrrRupees = mrrPaise / 100;
    const arrRupees = mrrRupees * 12;

    res.json({
      metrics: {
        total_tenants: totalTenants,
        active_tenants: activeTenants,
        trialing_tenants: trialingTenants,
        suspended_tenants: suspendedTenants,
        fleet_trucks_managed: totalTrucks,
        commercial_drivers_managed: totalDrivers,
        mrr_rupees: Math.round(mrrRupees),
        arr_rupees: Math.round(arrRupees),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate platform KPIs.' });
  }
}

/**
 * GET /api/super-admin/tenants
 * Paginated tenant directory with resource usage and subscription status.
 */
export async function listAllTenants(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '15', search, status } = req.query;
    const queryPage = Math.max(1, parseInt(page as string, 10));
    const queryLimit = Math.max(1, parseInt(limit as string, 10));

    const filter: any = { is_deleted: false };
    if (status) filter.subscription_status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Company.countDocuments(filter);
    const companies = await Company.find(filter)
      .sort({ created_at: -1 })
      .skip((queryPage - 1) * queryLimit)
      .limit(queryLimit);

    // Populate usage for each company
    const tenantProfiles = await Promise.all(
      companies.map(async (company) => {
        const [subscription, truckCount, driverCount, userCount] = await Promise.all([
          Subscription.findOne({ company_id: company._id }).populate<{ plan_id: IPlan }>('plan_id'),
          Truck.countDocuments({ company_id: company._id, is_deleted: false }),
          Driver.countDocuments({ company_id: company._id, is_deleted: false }),
          CompanyMember.countDocuments({ company_id: company._id, status: 'active' }),
        ]);

        return {
          id: company._id,
          name: company.name,
          slug: company.slug,
          email: company.email,
          phone: company.phone,
          status: company.subscription_status,
          trial_ends_at: company.trial_ends_at,
          created_at: company.created_at,
          plan: subscription?.plan_id ? { name: subscription.plan_id.name, code: subscription.plan_id.code } : null,
          usage: {
            trucks: truckCount,
            drivers: driverCount,
            users: userCount,
          },
          quota_overrides: subscription?.quota_overrides,
        };
      })
    );

    res.json({
      tenants: tenantProfiles,
      pagination: {
        page: queryPage,
        limit: queryLimit,
        total,
        totalPages: Math.ceil(total / queryLimit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list tenants.' });
  }
}

/**
 * PATCH /api/super-admin/tenants/:id/override
 * Overrides resource quotas or feature flags for a company.
 */
export async function overrideTenantQuota(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { max_trucks, max_drivers, max_users, custom_feature_grants, custom_feature_revocations } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    const subscription = await Subscription.findOneAndUpdate(
      { company_id: company._id },
      {
        $set: {
          'quota_overrides.max_trucks': max_trucks,
          'quota_overrides.max_drivers': max_drivers,
          'quota_overrides.max_users': max_users,
          'quota_overrides.custom_feature_grants': custom_feature_grants,
          'quota_overrides.custom_feature_revocations': custom_feature_revocations,
        },
      },
      { new: true, upsert: true }
    );

    // Audit log
    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'quota_override',
      target_company_id: company._id,
      target_company_name: company.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { max_trucks, max_drivers, max_users, custom_feature_grants, custom_feature_revocations },
    });

    res.json({
      success: true,
      message: `Quota overrides updated for ${company.name}.`,
      subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to override quotas.' });
  }
}

/**
 * PATCH /api/super-admin/tenants/:id/extend-trial
 * Extends the company's trial period by +7, +14, or +30 days.
 */
export async function extendTenantTrial(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { additional_days = 14 } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    const currentExpiry = company.trial_ends_at && new Date(company.trial_ends_at).getTime() > Date.now()
      ? new Date(company.trial_ends_at)
      : new Date();

    const newExpiry = new Date(currentExpiry.getTime() + additional_days * 24 * 60 * 60 * 1000);

    company.trial_ends_at = newExpiry;
    company.subscription_status = 'trialing';
    await company.save();

    await Subscription.findOneAndUpdate(
      { company_id: company._id },
      {
        status: 'trialing',
        trial_ends_at: newExpiry,
        current_period_end: newExpiry,
      }
    );

    // Audit log
    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'trial_extension',
      target_company_id: company._id,
      target_company_name: company.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { additional_days, new_expiry: newExpiry },
    });

    res.json({
      success: true,
      message: `Trial extended by ${additional_days} days for ${company.name} until ${newExpiry.toLocaleDateString()}.`,
      trial_ends_at: newExpiry,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to extend trial.' });
  }
}

/**
 * PATCH /api/super-admin/tenants/:id/status
 * Manually changes subscription status ('active', 'suspended', 'trialing').
 */
export async function toggleTenantStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['trialing', 'active', 'past_due', 'suspended', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid subscription status.' });
      return;
    }

    const company = await Company.findByIdAndUpdate(id, { subscription_status: status }, { new: true });
    if (!company) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    await Subscription.findOneAndUpdate({ company_id: company._id }, { status });

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'subscription_status_override',
      target_company_id: company._id,
      target_company_name: company.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { new_status: status },
    });

    res.json({
      success: true,
      message: `${company.name} status updated to ${status}.`,
      company,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update tenant status.' });
  }
}

/**
 * POST /api/super-admin/tenants/:id/impersonate
 * Issues a 1-hour secure audited support session into the tenant workspace.
 */
export async function impersonateTenant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    // Generate 1-hour support JWT
    const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
    const supportToken = jwt.sign(
      {
        userId: req.user!._id.toString(),
        impersonatedCompanyId: company._id.toString(),
        isImpersonation: true,
      },
      secret,
      { expiresIn: '1h' }
    );

    // Audit log
    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'impersonate_tenant',
      target_company_id: company._id,
      target_company_name: company.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { token_expires_in: '1h' },
    });

    res.json({
      success: true,
      message: `Support impersonation session granted for ${company.name} (Valid 1 hour).`,
      impersonation_token: supportToken,
      target_company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to initiate impersonation.' });
  }
}

/**
 * GET /api/super-admin/audit-logs
 * Retrieves forensic platform audit history.
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const logs = await PlatformAuditLog.find().sort({ created_at: -1 }).limit(50);
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit logs.' });
  }
}

/**
 * GET /api/super-admin/plans-catalog
 * Retrieves all tiers, add-ons, platform billing settings, and promo codes.
 */
export async function getPlatformPlansCatalog(req: Request, res: Response): Promise<void> {
  try {
    await seedBillingCatalog();
    const [plans, addons, promoCodes] = await Promise.all([
      Plan.find().sort({ monthly_price_paise: 1 }),
      AddOn.find().sort({ monthly_price_paise: 1 }),
      PromoCode.find().sort({ created_at: -1 }),
    ]);

    let settings = await PlatformSetting.findOne({ key: 'platform_billing_config' });
    if (!settings) {
      settings = await PlatformSetting.create({
        key: 'platform_billing_config',
        trial_days: 14,
        grace_period_days: 7,
        gst_rate_percent: 18,
        currency: 'INR',
        gateway_provider: 'razorpay',
        gateway_mode: 'sandbox',
        razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_fleetflow_demo',
        support_email: 'billing@fleetflow.io',
        auto_suspend_overdue: true,
      });
    }

    res.json({
      plans,
      addons,
      settings,
      promoCodes,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load plans catalog.' });
  }
}

/**
 * PUT /api/super-admin/plans/:id
 * Updates pricing, resource quotas, and modular feature entitlements for a tier.
 */
export async function updatePlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      monthly_price_paise,
      annual_price_paise,
      max_trucks,
      max_drivers,
      max_users,
      included_features,
      is_active,
      is_public,
    } = req.body;

    const plan = await Plan.findById(id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (monthly_price_paise !== undefined) plan.monthly_price_paise = Number(monthly_price_paise);
    if (annual_price_paise !== undefined) plan.annual_price_paise = Number(annual_price_paise);
    if (max_trucks !== undefined) plan.max_trucks = Number(max_trucks);
    if (max_drivers !== undefined) plan.max_drivers = Number(max_drivers);
    if (max_users !== undefined) plan.max_users = Number(max_users);
    if (included_features !== undefined) plan.included_features = included_features;
    if (is_active !== undefined) plan.is_active = Boolean(is_active);
    if (is_public !== undefined) plan.is_public = Boolean(is_public);

    await plan.save();

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'update_plan_catalog',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        plan_id: plan._id,
        plan_code: plan.code,
        monthly_price_paise: plan.monthly_price_paise,
        annual_price_paise: plan.annual_price_paise,
      },
    });

    res.json({ success: true, message: `Plan '${plan.name}' updated successfully.`, plan });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update plan.' });
  }
}

/**
 * POST /api/super-admin/plans
 * Adds a new custom SaaS plan tier to the platform catalog.
 */
export async function createPlan(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      code,
      description,
      monthly_price_paise,
      annual_price_paise,
      max_trucks,
      max_drivers,
      max_users,
      included_features,
      is_active,
      is_public,
    } = req.body;

    const existing = await Plan.findOne({ code });
    if (existing) {
      res.status(400).json({ error: `Plan code '${code}' already exists.` });
      return;
    }

    const plan = await Plan.create({
      name,
      code,
      description,
      monthly_price_paise: Number(monthly_price_paise),
      annual_price_paise: Number(annual_price_paise),
      max_trucks: Number(max_trucks ?? 5),
      max_drivers: Number(max_drivers ?? 5),
      max_users: Number(max_users ?? 2),
      included_features: included_features || ['MOD_FLEET', 'MOD_DRIVERS'],
      is_active: is_active ?? true,
      is_public: is_public ?? true,
    });

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'create_plan_catalog',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { plan_id: plan._id, plan_code: plan.code },
    });

    res.status(201).json({ success: true, message: `Plan '${plan.name}' created.`, plan });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create plan.' });
  }
}

/**
 * PUT /api/super-admin/addons/:id
 * Updates an add-on module's pricing and configuration.
 */
export async function updateAddOn(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, monthly_price_paise, annual_price_paise, quota_boost, is_active } = req.body;

    const addon = await AddOn.findById(id);
    if (!addon) {
      res.status(404).json({ error: 'Add-on not found.' });
      return;
    }

    if (name !== undefined) addon.name = name;
    if (description !== undefined) addon.description = description;
    if (monthly_price_paise !== undefined) addon.monthly_price_paise = Number(monthly_price_paise);
    if (annual_price_paise !== undefined) addon.annual_price_paise = Number(annual_price_paise);
    if (quota_boost !== undefined) addon.quota_boost = quota_boost;
    if (is_active !== undefined) addon.is_active = Boolean(is_active);

    await addon.save();

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'update_addon_catalog',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { addon_id: addon._id, code: addon.code },
    });

    res.json({ success: true, message: `Add-on '${addon.name}' updated successfully.`, addon });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update add-on.' });
  }
}

/**
 * POST /api/super-admin/addons
 * Creates a new add-on item in the platform catalog.
 */
export async function createAddOn(req: Request, res: Response): Promise<void> {
  try {
    const { name, code, description, type, feature_key, quota_boost, monthly_price_paise, annual_price_paise, is_active } = req.body;

    const existing = await AddOn.findOne({ code });
    if (existing) {
      res.status(400).json({ error: `Add-on code '${code}' already exists.` });
      return;
    }

    const addon = await AddOn.create({
      name,
      code,
      description,
      type: type || 'module',
      feature_key,
      quota_boost,
      monthly_price_paise: Number(monthly_price_paise || 0),
      annual_price_paise: Number(annual_price_paise || 0),
      is_active: is_active ?? true,
    });

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'create_addon_catalog',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: { addon_id: addon._id, code: addon.code },
    });

    res.status(201).json({ success: true, message: `Add-on '${addon.name}' created.`, addon });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create add-on.' });
  }
}

/**
 * PUT /api/super-admin/settings
 * Updates global platform billing rules, tax rates, trial periods, and payment gateway config.
 */
export async function updatePlatformSettings(req: Request, res: Response): Promise<void> {
  try {
    const {
      trial_days,
      grace_period_days,
      gst_rate_percent,
      currency,
      gateway_provider,
      gateway_mode,
      razorpay_key_id,
      support_email,
      auto_suspend_overdue,
    } = req.body;

    let settings = await PlatformSetting.findOne({ key: 'platform_billing_config' });
    if (!settings) {
      settings = new PlatformSetting({ key: 'platform_billing_config' });
    }

    if (trial_days !== undefined) settings.trial_days = Number(trial_days);
    if (grace_period_days !== undefined) settings.grace_period_days = Number(grace_period_days);
    if (gst_rate_percent !== undefined) settings.gst_rate_percent = Number(gst_rate_percent);
    if (currency !== undefined) settings.currency = currency;
    if (gateway_provider !== undefined) settings.gateway_provider = gateway_provider;
    if (gateway_mode !== undefined) settings.gateway_mode = gateway_mode;
    if (razorpay_key_id !== undefined) settings.razorpay_key_id = razorpay_key_id;
    if (support_email !== undefined) settings.support_email = support_email;
    if (auto_suspend_overdue !== undefined) settings.auto_suspend_overdue = Boolean(auto_suspend_overdue);

    await settings.save();

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'update_platform_billing_settings',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        trial_days: settings.trial_days,
        grace_period_days: settings.grace_period_days,
        gst_rate_percent: settings.gst_rate_percent,
        gateway_mode: settings.gateway_mode,
      },
    });

    res.json({ success: true, message: 'Platform commercial settings updated successfully.', settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update platform settings.' });
  }
}

/**
 * POST /api/super-admin/promo-codes
 * Issues a new promotional coupon code.
 */
export async function createPromoCode(req: Request, res: Response): Promise<void> {
  try {
    const {
      code,
      discount_type,
      discount_value,
      max_discount_paise,
      min_order_paise,
      valid_until,
      max_redemptions,
      applicable_plan_codes,
    } = req.body;

    if (!code || !discount_type || !discount_value || !valid_until) {
      res.status(400).json({ error: 'Missing required promo code attributes.' });
      return;
    }

    const existing = await PromoCode.findOne({ code: code?.toUpperCase() });
    if (existing) {
      res.status(400).json({ error: `Promo code '${code}' already exists.` });
      return;
    }

    const promo = await PromoCode.create({
      code: code?.toUpperCase(),
      discount_type,
      discount_value: Number(discount_value),
      max_discount_paise: max_discount_paise ? Number(max_discount_paise) : undefined,
      min_order_paise: min_order_paise ? Number(min_order_paise) : 0,
      valid_until: new Date(valid_until),
      max_redemptions: Number(max_redemptions || 100),
      applicable_plan_codes: applicable_plan_codes || [],
    });

    res.status(201).json({ success: true, message: `Promo code '${promo.code}' created.`, promo });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create promo code.' });
  }
}

/**
 * PATCH /api/super-admin/promo-codes/:id/toggle
 * Toggles active status of a coupon code.
 */
export async function togglePromoCode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const promo = await PromoCode.findById(id);
    if (!promo) {
      res.status(404).json({ error: 'Promo code not found.' });
      return;
    }

    promo.is_active = !promo.is_active;
    await promo.save();

    res.json({ success: true, message: `Promo code is now ${promo.is_active ? 'active' : 'inactive'}.`, promo });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to toggle promo code.' });
  }
}

