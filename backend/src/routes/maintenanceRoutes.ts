/**
 * ============================================================================
 * FLEET FLOW — FLEET MAINTENANCE & WORK ORDERS ROUTER (maintenanceRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS ROUTER?
 * --------------------
 * Express router exposing endpoints for maintenance work orders, garage job
 * cards, tyre wear tracking, preventative service alerts, and vehicle P&L.
 * 
 * SECURITY:
 * ---------
 * - Authenticated via `requireAuth`
 * - Scoped to tenant via `resolveTenantContext`
 * - Gated behind `requireFeature('MOD_MAINTENANCE')`
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import {
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  getTyres,
  createTyre,
  mountTyre,
  inspectTyre,
  retreadTyre,
  scrapTyre,
  getMaintenanceAnalytics,
  getVehicleProfitability,
} from '../controllers/maintenanceController.js';

const router = Router();

// Apply auth, tenant resolution & feature gating to all maintenance endpoints
router.use(requireAuth);
router.use(resolveTenantContext);
router.use(requireFeature('MOD_MAINTENANCE'));

// ----------------------------------------------------------------------------
// 1. Work Orders & Job Cards
// ----------------------------------------------------------------------------
router.get('/work-orders', getWorkOrders);
router.post('/work-orders', createWorkOrder);
router.get('/work-orders/:id', getWorkOrderById);
router.put('/work-orders/:id', updateWorkOrder);
router.post('/work-orders/:id/complete', completeWorkOrder);
router.post('/work-orders/:id/cancel', cancelWorkOrder);

// ----------------------------------------------------------------------------
// 2. Tyre Master & Axle Placement
// ----------------------------------------------------------------------------
router.get('/tyres', getTyres);
router.post('/tyres', createTyre);
router.post('/tyres/mount', mountTyre);
router.post('/tyres/:id/inspect', inspectTyre);
router.post('/tyres/:id/retread', retreadTyre);
router.post('/tyres/:id/scrap', scrapTyre);

// ----------------------------------------------------------------------------
// 3. Analytics, CPK & Vehicle Profitability
// ----------------------------------------------------------------------------
router.get('/analytics', getMaintenanceAnalytics);
router.get('/profitability', getVehicleProfitability);

export default router;
