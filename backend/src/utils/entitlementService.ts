/**
 * ============================================================================
 * FLEET FLOW — ENTITLEMENT EVALUATION SERVICE (entitlementService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Implements the Entitlement Evaluation Waterfall for multi-tenant SaaS features:
 * 1. Read-Only check (if suspended/expired, write ops blocked).
 * 2. Super-Admin Overrides (manual grants or revocations).
 * 3. Active Paid Add-Ons (standalone modules like WhatsApp, Fleet IQ, GPS).
 * 4. Active Subscription Plan (`included_features`).
 * 5. Active 14-Day Free Trial (grants standard commercial modules).
 * 6. Fallback / Default (denies access).
 * ============================================================================
 */

import { ICompany } from '../models/Company.js';
import { Subscription, ISubscription } from '../models/Subscription.js';
import { Plan, IPlan } from '../models/Plan.js';
import { AddOn } from '../models/AddOn.js';
import { MOD_CATALOG, ModuleKey } from './featureCatalog.js';

export interface TenantEntitlementSummary {
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  plan: {
    code: string;
    name: string;
  };
  plan_features: ModuleKey[];
  enabled_features: ModuleKey[];
  company_modules?: ModuleKey[];
  limits: {
    max_trucks: number;
    max_drivers: number;
    max_users: number;
    max_branches: number;
  };
  is_read_only: boolean;
  days_remaining_in_trial?: number;
}

/**
 * Evaluates the full entitlement profile for a given company.
 */
export async function getTenantEntitlements(company: ICompany): Promise<TenantEntitlementSummary> {
  const companyId = company._id;

  // 1. Find active subscription
  let subscription = await Subscription.findOne({ company_id: companyId }).populate<{ plan_id: IPlan }>('plan_id');

  // Fallback defaults for 7-day Trial (Starter-level feature access, 5 trucks, 1 branch, 2 users)
  let planCode = 'starter';
  let planName = 'Trial (Starter Features)';
  let includedFeatures: ModuleKey[] = [
    'MOD_FLEET',
    'MOD_DRIVERS',
    'MOD_TRIPS',
    'MOD_MARKET_VEHICLES',
    'MOD_PARTIES',
    'MOD_DOCUMENT_VAULT',
    'MOD_LR_ENGINE',
    'MOD_BILLING_INVOICE',
  ];
  let maxTrucks = 5;
  let maxDrivers = 5;
  let maxUsers = 2;
  let maxBranches = 1;

  if (subscription && subscription.plan_id) {
    const plan = subscription.plan_id;
    planCode = plan.code;
    planName = plan.name;
    includedFeatures = [...(plan.included_features || [])];
    const isTrial = (subscription.status === 'trialing' || company.subscription_status === 'trialing');
    maxTrucks = isTrial ? 5 : plan.max_trucks;
    maxDrivers = isTrial ? 5 : plan.max_drivers;
    maxUsers = plan.max_users;
    maxBranches = plan.max_branches ?? (plan.code === 'standard' ? 3 : plan.code === 'starter' ? 1 : -1);
  } else {
    // If during trial without explicit subscription doc, check if Starter plan exists in DB
    const starterPlan = await Plan.findOne({ code: 'starter' });
    if (starterPlan) {
      includedFeatures = [...starterPlan.included_features];
      maxTrucks = 5; // Trial truck limit is strictly 5 trucks
      maxDrivers = 5;
      maxUsers = 2;
      maxBranches = 1;
    }
  }

  const enabledSet = new Set<ModuleKey>(includedFeatures);

  // 2. Active Add-ons
  if (subscription && subscription.active_addons && subscription.active_addons.length > 0) {
    const addonCodes = subscription.active_addons.map((a) => a.code);
    const addons = await AddOn.find({ code: { $in: addonCodes }, is_active: true });
    for (const addon of addons) {
      if (addon.type === 'module' && addon.feature_key) {
        enabledSet.add(addon.feature_key);
      }
      if (addon.type === 'quota_booster' && addon.quota_boost) {
        if (addon.quota_boost.trucks && maxTrucks !== -1) maxTrucks += addon.quota_boost.trucks;
        if (addon.quota_boost.drivers && maxDrivers !== -1) maxDrivers += addon.quota_boost.drivers;
        if (addon.quota_boost.users && maxUsers !== -1) maxUsers += addon.quota_boost.users;
      }
    }
  }

  // 3. Super-Admin Overrides (Manual Grants & Revocations)
  if (subscription?.quota_overrides) {
    const overrides = subscription.quota_overrides;
    if (overrides.max_trucks !== undefined) maxTrucks = overrides.max_trucks;
    if (overrides.max_drivers !== undefined) maxDrivers = overrides.max_drivers;
    if (overrides.max_users !== undefined) maxUsers = overrides.max_users;
    if (overrides.max_branches !== undefined) maxBranches = overrides.max_branches;

    if (overrides.custom_feature_grants) {
      overrides.custom_feature_grants.forEach((f) => enabledSet.add(f));
    }
    if (overrides.custom_feature_revocations) {
      overrides.custom_feature_revocations.forEach((f) => enabledSet.delete(f));
    }
  }

  // 4. Plan Entitlements Ceiling
  const planFeatures = Array.from(enabledSet) as ModuleKey[];

  // 5. Company Preferences Filter:
  // EffectiveAccess = PlanEntitlements ∩ CompanyEnabledModules
  let effectiveFeatures: ModuleKey[];
  if (company.settings && Array.isArray(company.settings.enabled_modules)) {
    const preferenceSet = new Set<ModuleKey>(company.settings.enabled_modules as ModuleKey[]);
    effectiveFeatures = planFeatures.filter((f) => preferenceSet.has(f));
  } else {
    // When enabled_modules is undefined, inherit 100% of plan entitlements
    effectiveFeatures = [...planFeatures];
  }

  // 6. Status and Read-Only Evaluation
  let status = subscription?.status || company.subscription_status || 'trialing';
  if (status === 'trialing' && company.trial_ends_at && new Date(company.trial_ends_at).getTime() < Date.now()) {
    status = 'expired';
  }
  const isReadOnly = ['suspended', 'cancelled', 'expired'].includes(status);

  let daysRemainingInTrial: number | undefined;
  if (status === 'trialing' && company.trial_ends_at) {
    const diffMs = new Date(company.trial_ends_at).getTime() - Date.now();
    daysRemainingInTrial = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } else if (status === 'expired') {
    daysRemainingInTrial = 0;
  }

  return {
    status,
    plan: {
      code: planCode,
      name: planName,
    },
    plan_features: planFeatures,
    enabled_features: effectiveFeatures,
    company_modules: company.settings?.enabled_modules,
    limits: {
      max_trucks: maxTrucks,
      max_drivers: maxDrivers,
      max_users: maxUsers,
      max_branches: maxBranches,
    },
    is_read_only: isReadOnly,
    days_remaining_in_trial: daysRemainingInTrial,
  };
}

/**
 * Checks whether a company has a specific module key unlocked.
 */
export async function hasFeatureAccess(company: ICompany, moduleKey: ModuleKey): Promise<boolean> {
  const profile = await getTenantEntitlements(company);
  return profile.enabled_features.includes(moduleKey);
}
