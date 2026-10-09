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

export async function seedBillingCatalog(): Promise<void> {
  const existingPlansCount = await Plan.countDocuments();
  if (existingPlansCount === 0) {
    await Plan.create([
      {
        name: 'Starter Plan',
        code: 'starter',
        description: 'Essential fleet tracking & trip dispatches for small fleet operators (up to 5 trucks).',
        monthly_price_paise: 149900, // ₹1,499
        annual_price_paise: 1499000, // ₹14,990
        max_trucks: 5,
        max_drivers: 5,
        max_users: 2,
        included_features: [
          'MOD_FLEET',
          'MOD_DRIVERS',
          'MOD_TRIPS',
          'MOD_MARKET_VEHICLES',
          'MOD_PARTIES',
          'MOD_DOCUMENT_VAULT',
        ],
        is_active: true,
        is_public: true,
      },
      {
        name: 'Standard Commercial',
        code: 'standard',
        description: 'Complete transport operations, LRs, GST invoices, settlements, and double-entry accounting (up to 20 trucks).',
        monthly_price_paise: 399900, // ₹3,999
        annual_price_paise: 3999000, // ₹39,990
        max_trucks: 20,
        max_drivers: 25,
        max_users: 5,
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
        description: 'Full transport automation with custom fields, multi-step approvals, Tally export, and fleet IQ analytics.',
        monthly_price_paise: 899900, // ₹8,999
        annual_price_paise: 8999000, // ₹89,990
        max_trucks: -1, // Unlimited
        max_drivers: -1,
        max_users: 15,
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
    ]);
  }

  const existingAddOnsCount = await AddOn.countDocuments();
  if (existingAddOnsCount === 0) {
    await AddOn.create([
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
    ]);
  }
}
