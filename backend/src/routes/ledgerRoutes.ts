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
import { requireStrictIdempotency, requireIdempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

// Protect all ledger routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_LEDGERS'));

// General Ledger endpoints
router.get('/summary', getLedgerSummary);
router.get('/reconciliation', getLedgerReconciliation);
router.get('/', getLedgerEntries);
router.post('/', requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry);
router.post('/manual', requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry);
router.post('/journals', requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry);
router.post('/:id/reverse', requireRole(['admin', 'accountant']), requireStrictIdempotency, reverseLedgerEntry);

// Party Balance Reconciliation endpoints (with frontend compatibility aliases)
router.get('/party-balances', getPartyBalances);
router.get('/party-balances/:partyId/statement', getPartyStatement);
router.get('/party-statements/:partyId', getPartyStatement);
router.post('/party-balances/:partyId/payout', requireRole(['admin', 'accountant']), requireStrictIdempotency, recordPartyPayout);
router.post('/parties/:partyId/payout', requireRole(['admin', 'accountant']), requireStrictIdempotency, recordPartyPayout);

export default router;
