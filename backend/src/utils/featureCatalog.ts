/**
 * ============================================================================
 * FLEET FLOW — CENTRAL FEATURE & ENTITLEMENTS CATALOG (featureCatalog.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines the canonical 20-module catalog (`MOD_CATALOG`) of the Fleet Flow SaaS.
 * It specifies module keys, human-readable labels, descriptions, minimum tier,
 * and hard dependency relationships (e.g. Invoicing depends on Parties and LR Engine).
 * 
 * WHY IS IT IMPORTANT?
 * --------------------
 * Commercial multi-tenancy requires server-enforced modular gating. A tenant on
 * the "Starter" tier should not be able to execute LR Consignments or GPS telematics,
 * and turning on a module must automatically ensure all dependent modules are satisfied.
 * ============================================================================
 */

export type ModuleKey =
  | 'MOD_FLEET'
  | 'MOD_DRIVERS'
  | 'MOD_TRIPS'
  | 'MOD_MARKET_VEHICLES'
  | 'MOD_LR_ENGINE'
  | 'MOD_BILLING_INVOICE'
  | 'MOD_SETTLEMENTS'
  | 'MOD_LEDGERS'
  | 'MOD_PARTIES'
  | 'MOD_DOCUMENT_VAULT'
  | 'MOD_REPORTS'
  | 'MOD_CUSTOM_FIELDS'
  | 'MOD_WORKFLOW_APPROVALS'
  | 'MOD_GPS_SYNC'
  | 'MOD_FLEET_IQ'
  | 'MOD_WHATSAPP'
  | 'MOD_MAINTENANCE'
  | 'MOD_TALLY_SYNC'
  | 'MOD_MULTI_BRANCH'
  | 'MOD_AUDIT_LOGS';

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  category: 'core' | 'commercial' | 'intelligence' | 'integrations' | 'enterprise';
  description: string;
  defaultTier: 'starter' | 'standard' | 'pro' | 'enterprise';
  dependencies: ModuleKey[];
  isStandaloneAddon: boolean;
}

export const MOD_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  MOD_FLEET: {
    key: 'MOD_FLEET',
    name: 'Fleet & Asset Registry',
    category: 'core',
    description: 'Vehicle profiles, mechanical specs, compliance alerts, and odometer tracking.',
    defaultTier: 'starter',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_DRIVERS: {
    key: 'MOD_DRIVERS',
    name: 'Driver Workforce Master',
    category: 'core',
    description: 'Driver profiles, commercial licenses, Aadhaar PII masking, and cash advance tracking.',
    defaultTier: 'starter',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_TRIPS: {
    key: 'MOD_TRIPS',
    name: 'Trip Dispatch & Journeys',
    category: 'core',
    description: 'End-to-end trip execution for owned/attached fleet with route checkpoints and diesel slips.',
    defaultTier: 'starter',
    dependencies: ['MOD_FLEET', 'MOD_DRIVERS'],
    isStandaloneAddon: false,
  },
  MOD_MARKET_VEHICLES: {
    key: 'MOD_MARKET_VEHICLES',
    name: 'Market Vehicle Movements',
    category: 'core',
    description: 'Market truck logistics with freight agreements, broker commission, and cash advances.',
    defaultTier: 'starter',
    dependencies: ['MOD_PARTIES'],
    isStandaloneAddon: false,
  },
  MOD_PARTIES: {
    key: 'MOD_PARTIES',
    name: 'Customer & Vendor Registries',
    category: 'core',
    description: 'Billing parties (GST shippers) and Balance parties (truck suppliers, fuel pumps).',
    defaultTier: 'starter',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_DOCUMENT_VAULT: {
    key: 'MOD_DOCUMENT_VAULT',
    name: 'Digital Compliance Vault',
    category: 'core',
    description: 'S3-backed statutory document archive (PUC, Fitness, Insurance, National Permit).',
    defaultTier: 'starter',
    dependencies: ['MOD_FLEET'],
    isStandaloneAddon: false,
  },
  MOD_LR_ENGINE: {
    key: 'MOD_LR_ENGINE',
    name: 'Lorry Receipt (LR) Engine',
    category: 'commercial',
    description: 'Consignment notes, 3-part printable stationery (Consignor, Consignee, POD), and goods rating.',
    defaultTier: 'standard',
    dependencies: ['MOD_PARTIES'],
    isStandaloneAddon: false,
  },
  MOD_BILLING_INVOICE: {
    key: 'MOD_BILLING_INVOICE',
    name: 'GST Tax Invoicing',
    category: 'commercial',
    description: 'Section 9(3) RCM vs Forward charge GST invoices with multi-LR itemization and TDS deduction.',
    defaultTier: 'standard',
    dependencies: ['MOD_PARTIES', 'MOD_LR_ENGINE'],
    isStandaloneAddon: false,
  },
  MOD_SETTLEMENTS: {
    key: 'MOD_SETTLEMENTS',
    name: 'Driver Trip Settlements',
    category: 'commercial',
    description: 'Trip settlement calculations, mileage variance penalties, payout vouchers, and driver balances.',
    defaultTier: 'standard',
    dependencies: ['MOD_TRIPS', 'MOD_DRIVERS'],
    isStandaloneAddon: false,
  },
  MOD_LEDGERS: {
    key: 'MOD_LEDGERS',
    name: 'Double-Entry General Ledger',
    category: 'commercial',
    description: '17 accounting categories, debit/credit journal vouchers, and market vendor statements.',
    defaultTier: 'standard',
    dependencies: ['MOD_PARTIES'],
    isStandaloneAddon: false,
  },
  MOD_REPORTS: {
    key: 'MOD_REPORTS',
    name: 'Financial & Operational Reports',
    category: 'commercial',
    description: 'Fleet profitability, party balance aging, diesel consumption analysis, and Excel exports.',
    defaultTier: 'standard',
    dependencies: ['MOD_LEDGERS'],
    isStandaloneAddon: false,
  },
  MOD_CUSTOM_FIELDS: {
    key: 'MOD_CUSTOM_FIELDS',
    name: 'Dynamic Custom Fields Studio',
    category: 'intelligence',
    description: 'User-defined metadata attributes across trucks, drivers, trips, parties, and LRs.',
    defaultTier: 'pro',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_WORKFLOW_APPROVALS: {
    key: 'MOD_WORKFLOW_APPROVALS',
    name: 'Multi-Step Approval Pipelines',
    category: 'intelligence',
    description: 'Threshold-based approval requirements for trip dispatches, expenses, and invoices.',
    defaultTier: 'pro',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_AUDIT_LOGS: {
    key: 'MOD_AUDIT_LOGS',
    name: 'Forensic System Audit Trails',
    category: 'enterprise',
    description: 'Immutable timeline tracking user logins, critical data mutations, and permission changes.',
    defaultTier: 'pro',
    dependencies: [],
    isStandaloneAddon: false,
  },
  MOD_GPS_SYNC: {
    key: 'MOD_GPS_SYNC',
    name: 'Telematics & GPS Live Sync',
    category: 'integrations',
    description: 'Real-time vehicle location tracking, geofence enter/exit alerts, and odometer sync.',
    defaultTier: 'enterprise',
    dependencies: ['MOD_FLEET'],
    isStandaloneAddon: true,
  },
  MOD_FLEET_IQ: {
    key: 'MOD_FLEET_IQ',
    name: 'Fleet IQ Predictive Analytics',
    category: 'intelligence',
    description: 'AI-assisted diesel theft detection, route efficiency scoring, and tyre wear modeling.',
    defaultTier: 'pro',
    dependencies: ['MOD_TRIPS'],
    isStandaloneAddon: true,
  },
  MOD_WHATSAPP: {
    key: 'MOD_WHATSAPP',
    name: 'Automated WhatsApp Notifications',
    category: 'integrations',
    description: 'Dispatch alerts, LR copies, delivery notifications, and payment receipts via WhatsApp.',
    defaultTier: 'standard',
    dependencies: [],
    isStandaloneAddon: true,
  },
  MOD_MAINTENANCE: {
    key: 'MOD_MAINTENANCE',
    name: 'Preventative Maintenance Scheduler',
    category: 'core',
    description: 'Service intervals, parts inventory, garage job cards, and cost per km monitoring.',
    defaultTier: 'pro',
    dependencies: ['MOD_FLEET'],
    isStandaloneAddon: true,
  },
  MOD_TALLY_SYNC: {
    key: 'MOD_TALLY_SYNC',
    name: 'Tally ERP & Accounting Export',
    category: 'integrations',
    description: 'XML/JSON automated export to Tally Prime for sales, purchase, and payment vouchers.',
    defaultTier: 'pro',
    dependencies: ['MOD_LEDGERS'],
    isStandaloneAddon: true,
  },
  MOD_MULTI_BRANCH: {
    key: 'MOD_MULTI_BRANCH',
    name: 'Multi-Branch & Regional Hubs',
    category: 'enterprise',
    description: 'Segregated branch ledger accounting, inter-hub movements, and local dispatchers.',
    defaultTier: 'enterprise',
    dependencies: ['MOD_LEDGERS'],
    isStandaloneAddon: false,
  },
};

/**
 * Validates whether all dependencies for a requested module set are satisfied.
 */
export function validateDependencies(enabledKeys: ModuleKey[]): { valid: boolean; missing: Record<ModuleKey, ModuleKey[]> } {
  const enabledSet = new Set(enabledKeys);
  const missing: Record<ModuleKey, ModuleKey[]> = {} as any;
  let valid = true;

  for (const key of enabledKeys) {
    const def = MOD_CATALOG[key];
    if (!def) continue;

    const unfulfilled = def.dependencies.filter((dep) => !enabledSet.has(dep));
    if (unfulfilled.length > 0) {
      missing[key] = unfulfilled;
      valid = false;
    }
  }

  return { valid, missing };
}
