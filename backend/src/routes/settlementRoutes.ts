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
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { requireIdempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

// Protect all settlement routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_SETTLEMENTS'));

router.get('/metrics', getSettlementMetrics);
router.get('/pending-journeys/:driverId', getPendingJourneysForDriver);
router.get('/driver/:driverId/pending-trips', getPendingJourneysForDriver);
router.post('/preview', previewSettlement);
router.post('/confirm', requireRole(['admin', 'accountant']), requireIdempotency, confirmSettlement);
router.put('/:id/pay', requireRole(['admin', 'accountant']), requireIdempotency, markSettlementPaid);
router.post('/:id/mark-paid', requireRole(['admin', 'accountant']), requireIdempotency, markSettlementPaid);
router.put('/:id/mark-paid', requireRole(['admin', 'accountant']), requireIdempotency, markSettlementPaid);
router.get('/', getSettlements);

export default router;
