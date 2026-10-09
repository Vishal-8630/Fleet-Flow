/**
 * ============================================================================
 * FLEET FLOW — DRIVER TRIP SETTLEMENT ROUTES (settlementRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getSettlements,
  getSettlementMetrics,
  getPendingJourneysForDriver,
  previewSettlement,
  confirmSettlement,
  markSettlementPaid,
} from '../controllers/settlementController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all settlement routes with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

router.get('/metrics', getSettlementMetrics);
router.get('/pending-journeys/:driverId', getPendingJourneysForDriver);
router.get('/driver/:driverId/pending-trips', getPendingJourneysForDriver);
router.post('/preview', previewSettlement);
router.post('/confirm', requireRole(['admin', 'accountant']), confirmSettlement);
router.put('/:id/pay', requireRole(['admin', 'accountant']), markSettlementPaid);
router.post('/:id/mark-paid', requireRole(['admin', 'accountant']), markSettlementPaid);
router.put('/:id/mark-paid', requireRole(['admin', 'accountant']), markSettlementPaid);
router.get('/', getSettlements);

export default router;
