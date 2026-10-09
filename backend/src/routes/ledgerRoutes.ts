/**
 * ============================================================================
 * FLEET FLOW — GENERAL FINANCIAL LEDGER ROUTES (ledgerRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getLedgerEntries,
  getLedgerSummary,
  createManualLedgerEntry,
  reverseLedgerEntry,
  getPartyBalances,
  getPartyStatement,
  recordPartyPayout,
} from '../controllers/ledgerController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all ledger routes with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

// General Ledger endpoints
router.get('/summary', getLedgerSummary);
router.get('/', getLedgerEntries);
router.post('/', requireRole(['admin', 'accountant']), createManualLedgerEntry);
router.post('/:id/reverse', requireRole(['admin', 'accountant']), reverseLedgerEntry);

// Party Balance Reconciliation endpoints
router.get('/party-balances', getPartyBalances);
router.get('/party-balances/:partyId/statement', getPartyStatement);
router.post('/party-balances/:partyId/payout', requireRole(['admin', 'accountant']), recordPartyPayout);

export default router;
