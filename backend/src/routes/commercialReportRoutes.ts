/**
 * ============================================================================
 * COMMERCIAL REPORT ROUTES (commercialReportRoutes.ts)
 * ============================================================================
 * AR aging, trip profitability, Tally XML export, and credit note management.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getArAgingReport,
  getTripProfitabilityReport,
  exportToTallyXml,
  createCreditNote,
  listCreditNotes,
} from '../controllers/commercialReportController.js';

const router = Router();

// All commercial report routes require authentication
router.use(requireAuth);

router.get('/aging', getArAgingReport);
router.get('/profitability', getTripProfitabilityReport);
router.get('/export/tally', exportToTallyXml);
router.get('/credit-notes', listCreditNotes);
router.post('/credit-notes', createCreditNote);

export default router;
