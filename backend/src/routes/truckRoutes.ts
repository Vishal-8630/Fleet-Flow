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
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all fleet routes with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

// Read fleet listings and details (Accessible to all authenticated tenant members)
router.get('/', listTrucks);
router.get('/:id', getTruckById);

// Create, edit, and soft-delete vehicles (Admin & Dispatcher roles)
router.post('/', requireRole(['admin', 'dispatcher']), createTruck);
router.put('/:id', requireRole(['admin', 'dispatcher']), updateTruck);
router.delete('/:id', requireRole(['admin']), deleteTruck);

// Driver assignments
router.post('/:id/assign-driver', requireRole(['admin', 'dispatcher']), assignDriver);
router.post('/:id/unassign-driver', requireRole(['admin', 'dispatcher']), unassignDriver);

export default router;
