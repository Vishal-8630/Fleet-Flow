/**
 * ============================================================================
 * FLEET FLOW — NOTIFICATION ROUTES (notificationRoutes.ts)
 * ============================================================================
 * Provides protected APIs for inspecting multi-channel notification logs,
 * re-sending failed alerts, and administering recipient opt-out preferences.
 * ============================================================================
 */

import { Router } from 'express';
import {
  requireAuth,
  resolveTenantContext,
  requireActiveSubscription,
  requireRole,
} from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import {
  getNotificationLogs,
  resendNotification,
  getOptOuts,
  toggleOptOut,
} from '../controllers/notificationController.js';

const router = Router();

// Gated behind authentication, tenant context, active subscription, and MOD_WHATSAPP entitlement
router.use(requireAuth);
router.use(resolveTenantContext);
router.use(requireActiveSubscription);
router.use(requireFeature('MOD_WHATSAPP'));

router.get('/logs', getNotificationLogs);
router.post('/logs/:id/resend', requireRole(['admin', 'dispatcher', 'accountant']), resendNotification);
router.get('/opt-outs', getOptOuts);
router.post('/opt-outs', requireRole(['admin', 'dispatcher']), toggleOptOut);

export default router;
