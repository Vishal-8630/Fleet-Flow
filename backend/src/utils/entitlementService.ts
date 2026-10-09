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
  enabled_features: ModuleKey[];
  limits: {
    max_trucks: number;
    max_drivers: number;
    max_users: number;
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

  // Fallback defaults for Starter trial if no subscription document exists yet
  let planCode = 'standard';
  let planName = 'Standard Plan (Trial)';
  let includedFeatures: ModuleKey[] = [];
  let maxTrucks = 20;
  let maxDrivers = 25;
  let maxUsers = 5;

  if (subscription && subscription.plan_id) {
    const plan = subscription.plan_id;
    planCode = plan.code;
    planName = plan.name;
    includedFeatures = [...(plan.included_features || [])];
    maxTrucks = plan.max_trucks;
    maxDrivers = plan.max_drivers;
    maxUsers = plan.max_users;
  } else {
    // If during 14-day trial without explicit subscription doc, standard tier features are unlocked
    const standardPlan = await Plan.findOne({ code: 'standard' });
    if (standardPlan) {
      includedFeatures = [...standardPlan.included_features];
      maxTrucks = standardPlan.max_trucks;
      maxDrivers = standardPlan.max_drivers;
      maxUsers = standardPlan.max_users;
    } else {
      // Default baseline standard modules if DB not yet seeded
      includedFeatures = [
        'MOD_FLEET',
        'MOD_DRIVERS',
        'MOD_TRIPS',
        'MOD_MARKET_VEHICLES',
        'MOD_PARTIES',
        'MOD_DOCUMENT_VAULT',
        'MOD_LR_ENGINE',
        'MOD_BILLING_INVOICE',
        'MOD_SETTLEMENTS',
        'MOD_LEDGERS',
        'MOD_REPORTS',
      ];
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

    if (overrides.custom_feature_grants) {
      overrides.custom_feature_grants.forEach((f) => enabledSet.add(f));
    }
    if (overrides.custom_feature_revocations) {
      overrides.custom_feature_revocations.forEach((f) => enabledSet.delete(f));
    }
  }

  // 4. Status and Read-Only Evaluation
  const status = subscription?.status || company.subscription_status || 'trialing';
  const isReadOnly = ['suspended', 'cancelled', 'expired'].includes(status);

  let daysRemainingInTrial: number | undefined;
  if (status === 'trialing' && company.trial_ends_at) {
    const diffMs = new Date(company.trial_ends_at).getTime() - Date.now();
    daysRemainingInTrial = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return {
    status,
    plan: {
      code: planCode,
      name: planName,
    },
    enabled_features: Array.from(enabledSet),
    limits: {
      max_trucks: maxTrucks,
      max_drivers: maxDrivers,
      max_users: maxUsers,
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
