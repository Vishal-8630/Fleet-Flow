/**
 * ============================================================================
 * FLEET FLOW — DASHBOARD ROUTES (dashboardRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getDashboardSummary,
  getDashboardWatchlists,
  getEntityAuditTrail,
} from '../controllers/dashboardController.js';
import { requireAuth, resolveTenantContext } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth, resolveTenantContext);

// Aggregated executive summary
router.get('/summary', getDashboardSummary);

// 5 Dedicated operational watchlists
router.get('/watchlists', getDashboardWatchlists);

// Entity-level audit timeline for HistoryDrawer
router.get('/audit/:entityType/:entityId', getEntityAuditTrail);

export default router;
