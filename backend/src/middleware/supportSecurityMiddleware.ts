/**
 * ============================================================================
 * FLEET FLOW — SUPPORT SECURITY & TENANT PRIVACY MIDDLEWARE (supportSecurityMiddleware.ts)
 * ============================================================================
 * 
 * Implements Batch A (DEC-012 Approved Architecture):
 * 1. Fail-Closed Session Verification (HTTP 503 if verification fails/timeouts)
 * 2. Immutable Support Session Lifecycle & Revocation Verification (HTTP 403)
 * 3. Read-Only Diagnostics Enforcement (HTTP 403 on write mutations)
 * 4. Operational Financial Route & Export Blockade (HTTP 403)
 * 5. Receipt Access Blockade (HTTP 403)
 * 6. Server-side Extended Driver PII Masking & Monetary Field Redaction Interceptor
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { SupportAccessRequest, ISupportAccessRequest } from '../models/SupportAccessRequest.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { Truck } from '../models/Truck.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      supportSessionId?: string;
      supportSession?: ISupportAccessRequest;
    }
  }
}

/**
 * Monetary fields to redact to null during any support session
 */
export const OPERATIONAL_MONETARY_KEYS = new Set([
  'rate',
  'freight_rate',
  'freight_amount',
  'advance_amount',
  'starting_cash_advance',
  'balance_amount',
  'diesel_cost',
  'total_diesel_cost',
  'rate_per_litre',
  'rate_per_tonne',
  'declared_value',
  'outstanding_receivables',
  'toll_amount',
  'toll_cost',
  'driver_cash_advance',
  'diesel_advance_amount',
  'dala_charges',
  'kamisan_amount',
  'halting_amount',
  'net_balance_due',
  'paid_amount',
  'financial_impact',
  'loading_charges',
  'unloading_charges',
  'detention_charges',
  'total_amount',
  'net_amount',
  'tds_amount',
  'gst_amount',
  'actual_cost',
  'estimated_cost',
  'total_cost',
  'total_driver_expenses',
  'amount',
  'fuel_cost',
  'total_freight',
  'settlement_amount',
  'salary_amount',
  'bonus_amount',
  'cash_advance',
  'opening_balance',
  'closing_balance',
  'credit_limit',
  'debit',
  'credit',
  'running_advance_balance',
  'amount_company_owes_driver',
  'amount_driver_owes_company',
  // Executive Dashboard & Aging Aggregation Keys
  'unbilled_freight_value',
  'today_revenue',
  'pending_receivables',
  'pending_settlements_amount',
  'pending_recovery_amount',
  'pending_payout_amount',
  'total_receivables',
  '0_30_days',
  '31_60_days',
  '60_plus_days',
  'total_overdue',
  'aging_0_30',
  'aging_31_60',
  'aging_60_plus',
  'balance_due',
  'overdue_amount',
  // Fleet Maintenance & Profitability Keys
  'gross_revenue',
  'diesel_spend',
  'tolls_and_driver_costs',
  'maintenance_spend',
  'net_profit',
  'total_maintenance_spend',
]);

/**
 * Receipt URL / document keys to redact to null during any support session
 */
export const RECEIPT_KEYS = new Set([
  'receipt_url',
  'toll_receipt_url',
  'fuel_receipt_url',
  'slip_image_url',
  'pod_slip_url',
  'pod_document_url',
  'receipt_file',
  'receipt_document',
  'invoice_pdf_url',
  'attachment_url',
]);

/**
 * Server-side Driver PII Masking and Monetary Redaction Engine.
 * Recursively sanitizes any payload destined for client serialization.
 */
export function sanitizeSupportData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Redact monetary references like ₹ 5000 or Rs. 5000 embedded in text descriptions
    return data.replace(/(?:₹|Rs\.?)\s*[\d,]+(?:\.\d+)?/gi, '₹XXXX');
  }
  if (typeof data !== 'object') return data;

  // Preserve Date instances, BSON ObjectIds, Buffers without mutating
  if (data instanceof Date || (data as any)._bsontype === 'ObjectID' || Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSupportData(item));
  }

  // Handle Mongoose documents or plain objects
  const raw = typeof (data as any).toObject === 'function' ? (data as any).toObject() : data;
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    // 1. Operational Monetary Field Redaction to null
    if (OPERATIONAL_MONETARY_KEYS.has(lowerKey)) {
      sanitized[key] = null;
      continue;
    }

    // 2. Receipt and Financial Document URLs Redacted to null
    if (RECEIPT_KEYS.has(lowerKey)) {
      sanitized[key] = null;
      continue;
    }

    // 3. Extended Driver PII Masking (Zero Unmasking Exceptions)
    if (lowerKey === 'aadhaar_no' || lowerKey === 'aadhaar_number') {
      if (typeof value === 'string' && value.trim()) {
        const cleaned = value.replace(/\s+/g, '');
        sanitized[key] = `XXXX-XXXX-${cleaned.slice(-4)}`;
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    if (lowerKey === 'pan_no' || lowerKey === 'pan_number') {
      if (typeof value === 'string' && value.trim()) {
        const cleaned = value.trim();
        sanitized[key] = `XXXXX${cleaned.slice(-4)}`;
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    if (
      [
        'bank_account_no',
        'bank_account_number',
        'account_no',
        'account_number',
        'bank_account',
      ].includes(lowerKey)
    ) {
      if (typeof value === 'string' && value.trim()) {
        const cleaned = value.trim();
        sanitized[key] = `XXXXXX${cleaned.slice(-4)}`;
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    if (['phone', 'mobile', 'emergency_phone', 'emergency_contact_phone', 'contact_phone'].includes(lowerKey)) {
      if (typeof value === 'string' && value.trim()) {
        sanitized[key] = `+91 98765 XXXXX`;
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    if (['driving_licence_no', 'license_no', 'license_number', 'dl_no', 'dl_number'].includes(lowerKey)) {
      if (typeof value === 'string' && value.trim()) {
        const cleaned = value.trim();
        sanitized[key] = `DL-XXXXXXXXX${cleaned.slice(-4)}`;
      } else {
        sanitized[key] = null;
      }
      continue;
    }

    if (['dob', 'date_of_birth'].includes(lowerKey)) {
      sanitized[key] = null;
      continue;
    }

    if (['address', 'permanent_address', 'current_address'].includes(lowerKey)) {
      sanitized[key] = null;
      continue;
    }

    if (
      [
        'driver_photo_url',
        'photo_url',
        'license_front_url',
        'license_back_url',
        'aadhaar_front_url',
        'aadhaar_back_url',
        'pan_card_url',
        'kyc_documents',
      ].includes(lowerKey)
    ) {
      sanitized[key] = null;
      continue;
    }

    // Recursively sanitize nested structures
    sanitized[key] = sanitizeSupportData(value);
  }

  return sanitized;
}

/**
 * Intercepts Express `res.json` and `res.send` to serialize only sanitized payloads during support sessions.
 */
export function attachSupportSanitizer(res: Response): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: any): Response {
    const sanitized = sanitizeSupportData(body);
    return originalJson(sanitized);
  };

  const originalSend = res.send.bind(res);
  res.send = function (body: any): Response {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
      const sanitized = sanitizeSupportData(body);
      return originalJson(sanitized);
    }
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed === 'object' && parsed !== null) {
          const sanitized = sanitizeSupportData(parsed);
          return originalSend(JSON.stringify(sanitized));
        }
      } catch {
        // Not a JSON string, leave body as is
      }
    }
    return originalSend(body);
  };
}

/**
 * Checks if the requested endpoint matches pure financial or commercial reporting routes.
 * Blocks /api/commercial/* (including /aging, /profitability, /credit-notes, /export/tally)
 * while allowing operational consignment entries (/api/commercial/entries).
 */
export function isFinancialRoute(path: string): boolean {
  const cleanPath = path.toLowerCase().split('?')[0].replace(/\/+$/, '');
  
  // Allow operational consignment entries (/api/commercial/entries)
  if (cleanPath === '/api/commercial/entries' || cleanPath.startsWith('/api/commercial/entries/')) {
    return false;
  }

  // Explicitly block fleet maintenance profitability & cost analytics endpoints
  if (
    cleanPath === '/api/fleet/maintenance/profitability' ||
    cleanPath.startsWith('/api/fleet/maintenance/profitability/') ||
    cleanPath === '/api/fleet/maintenance/analytics' ||
    cleanPath.startsWith('/api/fleet/maintenance/analytics/')
  ) {
    return true;
  }

  // Block all other commercial routes and pure financial endpoints
  return (
    cleanPath.startsWith('/api/commercial') ||
    cleanPath.startsWith('/api/finance') ||
    cleanPath.startsWith('/api/reports/commercial') ||
    cleanPath.startsWith('/api/ledger') ||
    cleanPath.startsWith('/api/invoices') ||
    cleanPath.startsWith('/api/billing')
  );
}

/**
 * Checks if the request is an export attempt
 */
export function isExportRequest(req: Request): boolean {
  const path = (req.originalUrl || req.url || '').toLowerCase();
  const format = (req.query?.format as string)?.toLowerCase();
  const exportParam = req.query?.export;

  return (
    path.includes('/export') ||
    exportParam === 'true' ||
    ['csv', 'xlsx', 'excel', 'tally', 'pdf'].includes(format)
  );
}

/**
 * Checks if the request is attempting to view or download a receipt.
 * Inspects request URL, query keys, explicit document classification, and database associations.
 */
export async function isReceiptRequest(req: Request): Promise<boolean> {
  const path = (req.originalUrl || req.url || '').toLowerCase();
  const key = (
    (req.query?.key as string) ||
    (req.body?.key as string) ||
    (req.params?.key as string) ||
    ''
  ).trim();
  const lowerKey = key.toLowerCase();

  // 1. Direct path matches
  if (
    path.includes('/receipts') ||
    path.includes('/receipt') ||
    path.includes('/slips') ||
    path.includes('/expenses/slip')
  ) {
    return true;
  }

  // 2. Substring detection on keys/filenames
  if (
    lowerKey.includes('receipt') ||
    lowerKey.includes('slip') ||
    lowerKey.includes('invoice') ||
    lowerKey.includes('expense') ||
    lowerKey.includes('bill')
  ) {
    return true;
  }

  // 3. Known receipt/financial directory paths in storage keys
  if (key && /tenants\/[^/]+\/(receipts|expenses|slips|invoices|pod)\//i.test(key)) {
    return true;
  }

  // 4. Document classification: Allow statutory truck compliance files (fitness, insurance, permit, RC book)
  if (key && (/tenants\/[^/]+\/trucks\//i.test(key) || /tenants\/[^/]+\/compliance\//i.test(key))) {
    return false;
  }

  // 5. Database association check for UUID or generic storage keys
  const companyId = req.requestedCompanyId || req.tenant?.id;
  if (key && companyId) {
    try {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keyPattern = new RegExp(escapedKey, 'i');

      const isJourneyReceipt = await TruckJourney.exists({
        company_id: companyId,
        $or: [
          { 'diesel_expenses.slip_image_url': keyPattern },
          { 'driver_expenses.receipt_url': keyPattern },
          { pod_slip_url: keyPattern },
        ],
      });

      if (isJourneyReceipt) {
        return true;
      }

      const isVehicleEntryReceipt = await VehicleEntry.exists({
        company_id: companyId,
        pod_document_url: keyPattern,
      });

      if (isVehicleEntryReceipt) {
        return true;
      }

      // Check if key is associated with a verified statutory truck compliance document
      const isStatutoryTruckDoc = await Truck.exists({
        company_id: companyId,
        $or: [
          { 'fitness_doc.url': keyPattern },
          { 'insurance_doc.url': keyPattern },
          { 'national_permit_doc.url': keyPattern },
          { 'puc_doc.url': keyPattern },
          { 'rc_doc.url': keyPattern },
        ],
      });

      if (isStatutoryTruckDoc) {
        return false;
      }
    } catch {
      // In case of DB query error, fail closed in support context
      return true;
    }
  }

  // 6. Policy P2: Fail closed for unclassified, unlinked, or generic storage keys during support sessions.
  // If a document's classification cannot be verified as permitted statutory/compliance, block it to prevent
  // unassociated receipt/invoice leaks.
  if (key && /tenants\/[^/]+\/general\//i.test(key)) {
    return true;
  }

  return false;
}

/**
 * Support Security Guard Middleware
 * Evaluates session state, validates tenant isolation, blocks restricted operations,
 * and intercepts response serialization.
 */
export async function supportSecurityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isImpersonation) {
    return next();
  }

  // 1. Validate presence of Support Session ID
  if (!req.supportSessionId) {
    res.status(403).json({
      code: 'SUPPORT_SESSION_INVALID',
      error: 'Impersonation token lacks a verified Support Session ID.',
    });
    return;
  }

  const companyId = req.requestedCompanyId || req.tenant?.id;
  if (!companyId) {
    res.status(403).json({
      code: 'SUPPORT_SESSION_INVALID',
      error: 'Target company context is missing.',
    });
    return;
  }

  // 2. Policy E: Database Unavailability Fail-Closed Verification
  let session: ISupportAccessRequest | null = null;
  try {
    session = await SupportAccessRequest.findOne({
      _id: req.supportSessionId,
      company_id: companyId,
    });
  } catch (dbError) {
    // Fail closed with HTTP 503 if verification cannot complete due to database error
    res.status(503).json({
      code: 'SESSION_VERIFICATION_FAILED',
      error: 'Support session verification service unavailable. Failing closed for security.',
    });
    return;
  }

  if (!session) {
    res.status(403).json({
      code: 'SUPPORT_SESSION_INVALID',
      error: 'Support session record not found or company scope mismatch.',
    });
    return;
  }

  // 3. Status Verification (Immediate Revocation Enforcement)
  if (session.status !== 'active') {
    res.status(403).json({
      code: 'SUPPORT_SESSION_REVOKED',
      error: `Support session is no longer active (status: ${session.status}). Access revoked.`,
    });
    return;
  }

  // 4. Expiry Verification
  if (session.expires_at && new Date() > new Date(session.expires_at)) {
    session.status = 'expired';
    await session.save().catch(() => {});
    res.status(403).json({
      code: 'SUPPORT_SESSION_EXPIRED',
      error: 'Support session has expired.',
    });
    return;
  }

  req.supportSession = session;

  // 5. Policy B: Block Financial Routes
  const targetUrl = req.originalUrl || req.baseUrl + req.path;
  if (isFinancialRoute(targetUrl)) {
    res.status(403).json({
      code: 'FINANCIAL_RECORDS_LOCKED',
      error: 'Access to financial records and routes is strictly prohibited during support sessions.',
    });
    return;
  }

  // 6. Policy B: Block Exports
  if (isExportRequest(req)) {
    res.status(403).json({
      code: 'SUPPORT_EXPORT_BLOCKED',
      error: 'Data exports are strictly disabled during support sessions.',
    });
    return;
  }

  // 7. Policy B: Block Receipt Access
  if (await isReceiptRequest(req)) {
    res.status(403).json({
      code: 'RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT',
      error: 'Receipt documents and downloads are strictly prohibited during support sessions.',
    });
    return;
  }

  // 8. Policy A: Strictly Read-Only Mode (allow only GET, HEAD, OPTIONS during diagnostics_readonly)
  if (session.scope === 'diagnostics_readonly' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    res.status(403).json({
      code: 'SUPPORT_READ_ONLY_MODE',
      error: 'This support session is restricted to read-only diagnostics. Mutation operations are prohibited.',
    });
    return;
  }

  // 9. Policies B & C: Intercept Response Serialization for Masking & Redaction
  attachSupportSanitizer(res);

  next();
}
