/**
 * ============================================================================
 * FLEET FLOW — BILLING SEED SERVICE (billingSeedService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Automatically ensures canonical SaaS pricing plans and default add-ons
 * exist in the database upon startup.
 * ============================================================================
 */

import { Plan } from '../models/Plan.js';
import { AddOn } from '../models/AddOn.js';

export const CANONICAL_PLANS = [
  {
    name: 'Starter Plan',
    code: 'starter',
    description: 'Essential fleet tracking, 3-part LR creation, and basic GST invoicing for small fleet operators (up to 15 trucks).',
    monthly_price_paise: 199900, // ₹1,999 (GST-inclusive)
    annual_price_paise: 1999000, // ₹19,990 (GST-inclusive, 10x multiplier)
    max_trucks: 15,
    max_drivers: 15,
    max_users: 2,
    max_branches: 1,
    included_features: [
      'MOD_FLEET',
      'MOD_DRIVERS',
      'MOD_TRIPS',
      'MOD_MARKET_VEHICLES',
      'MOD_PARTIES',
      'MOD_DOCUMENT_VAULT',
      'MOD_LR_ENGINE',
      'MOD_BILLING_INVOICE',
    ],
    is_active: true,
    is_public: true,
  },
  {
    name: 'Standard Commercial',
    code: 'standard',
    description: 'Complete transport operations, settlements, double-entry ledger, WhatsApp updates, and up to 3 regional branch hub profiles (up to 30 trucks).',
    monthly_price_paise: 399900, // ₹3,999 (GST-inclusive)
    annual_price_paise: 3999000, // ₹39,990 (GST-inclusive, 10x multiplier)
    max_trucks: 30,
    max_drivers: 35,
    max_users: 5,
    max_branches: 3,
    included_features: [
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
      'MOD_WHATSAPP',
    ],
    is_active: true,
    is_public: true,
  },
  {
    name: 'Pro Enterprise',
    code: 'pro',
    description: 'Full transport automation with custom fields, multi-step approvals, Tally export, and preventative maintenance (Unlimited trucks subject to Fair-Use Policy).',
    monthly_price_paise: 899900, // ₹8,999 (GST-inclusive)
    annual_price_paise: 8999000, // ₹89,990 (GST-inclusive, 10x multiplier)
    max_trucks: -1, // Unlimited trucks subject to documented Fair-Use Policy
    max_drivers: -1,
    max_users: -1, // Undecided / unconstrained per DEC-001
    max_branches: -1, // Undecided / unconstrained per DEC-001
    included_features: [
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
      'MOD_WHATSAPP',
      'MOD_CUSTOM_FIELDS',
      'MOD_WORKFLOW_APPROVALS',
      'MOD_FLEET_IQ',
      'MOD_MAINTENANCE',
      'MOD_TALLY_SYNC',
      'MOD_AUDIT_LOGS',
    ],
    is_active: true,
    is_public: true,
  },
  {
    name: 'Custom Enterprise',
    code: 'enterprise',
    description: 'Dedicated multi-branch hub management, live telematics GPS sync, custom SLAs, and custom integrations.',
    monthly_price_paise: 1999900, // ₹19,999
    annual_price_paise: 19999000, // ₹199,990
    max_trucks: -1,
    max_drivers: -1,
    max_users: -1,
    max_branches: -1,
    included_features: [
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
      'MOD_WHATSAPP',
      'MOD_CUSTOM_FIELDS',
      'MOD_WORKFLOW_APPROVALS',
      'MOD_FLEET_IQ',
      'MOD_MAINTENANCE',
      'MOD_TALLY_SYNC',
      'MOD_AUDIT_LOGS',
      'MOD_GPS_SYNC',
      'MOD_MULTI_BRANCH',
    ],
    is_active: true,
    is_public: true,
  },
];

export const CANONICAL_ADDONS = [
  {
    name: 'WhatsApp Automation Suite',
    code: 'addon_whatsapp',
    description: 'Instant consignee notifications, PDF dispatch cards, and payment receipts via WhatsApp API.',
    type: 'module',
    feature_key: 'MOD_WHATSAPP',
    monthly_price_paise: 99900,
    annual_price_paise: 999000,
    is_active: true,
  },
  {
    name: 'Fleet IQ Predictive Telematics',
    code: 'addon_fleet_iq',
    description: 'AI-assisted diesel variance auditing, optimal routing, and driver risk scoring.',
    type: 'module',
    feature_key: 'MOD_FLEET_IQ',
    monthly_price_paise: 199900,
    annual_price_paise: 1999000,
    is_active: true,
  },
  {
    name: 'Fleet Capacity Booster (+10 Trucks)',
    code: 'addon_quota_10',
    description: 'Expand your plan capacity by 10 additional fleet assets and 10 drivers without upgrading tier.',
    type: 'quota_booster',
    quota_boost: { trucks: 10, drivers: 10, users: 2 },
    monthly_price_paise: 129900,
    annual_price_paise: 1299000,
    is_active: true,
  },
];

export async function seedBillingCatalog(): Promise<void> {
  // Idempotent upsert by stable code identifier: preserves existing plan _ids and customer subscriptions
  for (const planDef of CANONICAL_PLANS) {
    await Plan.findOneAndUpdate(
      { code: planDef.code },
      { $set: planDef },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // Idempotent upsert for add-ons
  for (const addonDef of CANONICAL_ADDONS) {
    await AddOn.findOneAndUpdate(
      { code: addonDef.code },
      { $set: addonDef },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}
