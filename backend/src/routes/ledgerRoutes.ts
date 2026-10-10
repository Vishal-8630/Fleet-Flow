/**
 * ============================================================================
 * FLEET FLOW — GENERAL FINANCIAL LEDGER ROUTES (ledgerRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getLedgerEntries,
  getLedgerSummary,
  getLedgerReconciliation,
  createManualLedgerEntry,
  reverseLedgerEntry,
  getPartyBalances,
  getPartyStatement,
  recordPartyPayout,
} from '../controllers/ledgerController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { requireIdempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

// Protect all ledger routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_LEDGERS'));

// General Ledger endpoints
router.get('/summary', getLedgerSummary);
router.get('/reconciliation', getLedgerReconciliation);
router.get('/', getLedgerEntries);
router.post('/', requireRole(['admin', 'accountant']), requireIdempotency, createManualLedgerEntry);
router.post('/manual', requireRole(['admin', 'accountant']), requireIdempotency, createManualLedgerEntry);
router.post('/:id/reverse', requireRole(['admin', 'accountant']), requireIdempotency, reverseLedgerEntry);

// Party Balance Reconciliation endpoints (with frontend compatibility aliases)
router.get('/party-balances', getPartyBalances);
router.get('/party-balances/:partyId/statement', getPartyStatement);
router.get('/party-statements/:partyId', getPartyStatement);
router.post('/party-balances/:partyId/payout', requireRole(['admin', 'accountant']), requireIdempotency, recordPartyPayout);
router.post('/parties/:partyId/payout', requireRole(['admin', 'accountant']), requireIdempotency, recordPartyPayout);

export default router;
