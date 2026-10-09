/**
 * ============================================================================
 * FLEET FLOW — DRIVER ROUTER (driverRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines Express REST endpoints for driver management, KYC validation,
 * and roster operations. Protected by tenant authorization and RBAC.
 * ============================================================================
 */

import { Router } from 'express';
import {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
} from '../controllers/driverController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all driver routes with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

// Read driver listings and profiles
router.get('/', listDrivers);
router.get('/:id', getDriverById);

// Create, update, and soft-delete drivers (Admin & Dispatcher roles)
router.post('/', requireRole(['admin', 'dispatcher']), createDriver);
router.put('/:id', requireRole(['admin', 'dispatcher']), updateDriver);
router.delete('/:id', requireRole(['admin']), deleteDriver);

export default router;
