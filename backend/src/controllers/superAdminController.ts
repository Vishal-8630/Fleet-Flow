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
