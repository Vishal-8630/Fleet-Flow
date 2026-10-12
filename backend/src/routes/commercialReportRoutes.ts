/**
 * ============================================================================
 * COMMERCIAL REPORT ROUTES (commercialReportRoutes.ts)
 * ============================================================================
 * AR aging, trip profitability, Tally XML export, and credit note management.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext } from '../middleware/authMiddleware.js';
import { requireStrictIdempotency } from '../middleware/idempotencyMiddleware.js';
import {
  getArAgingReport,
  getTripProfitabilityReport,
  exportToTallyXml,
  createCreditNote,
  listCreditNotes,
} from '../controllers/commercialReportController.js';

const router = Router();

// All commercial report routes require authentication and tenant context
router.use(requireAuth, resolveTenantContext);

router.get('/aging', getArAgingReport);
router.get('/profitability', getTripProfitabilityReport);
router.get('/export/tally', exportToTallyXml);
router.get('/credit-notes', listCreditNotes);
router.post('/credit-notes', requireStrictIdempotency, createCreditNote);

export default router;
