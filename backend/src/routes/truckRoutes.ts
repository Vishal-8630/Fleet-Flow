/**
 * ============================================================================
 * FLEET FLOW — TRUCK ROUTER (truckRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines Express REST endpoints for managing fleet vehicles, driver bindings,
 * and compliance documentation. Protected by tenant authorization and RBAC.
 * ============================================================================
 */

import { Router } from 'express';
import {
  listTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
  assignDriver,
  unassignDriver,
} from '../controllers/truckController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature, requireQuota } from '../middleware/entitlementMiddleware.js';

const router = Router();

// Protect all fleet routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_FLEET'));

// Read fleet listings and details (Accessible to all authenticated tenant members)
router.get('/', listTrucks);
router.get('/:id', getTruckById);

// Create, edit, and soft-delete vehicles (Admin & Dispatcher roles)
router.post('/', requireRole(['admin', 'dispatcher']), requireQuota('trucks'), createTruck);
router.put('/:id', requireRole(['admin', 'dispatcher']), updateTruck);
router.delete('/:id', requireRole(['admin']), deleteTruck);

// Driver assignments
router.post('/:id/assign-driver', requireRole(['admin', 'dispatcher']), assignDriver);
router.post('/:id/unassign-driver', requireRole(['admin', 'dispatcher']), unassignDriver);

export default router;
