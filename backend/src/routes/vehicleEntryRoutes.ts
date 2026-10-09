/**
 * ============================================================================
 * FLEET FLOW — MARKET VEHICLE ENTRY ROUTER (vehicleEntryRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS ROUTER?
 * --------------------
 * Express REST router for third-party brokerage vehicle movements, commercial
 * vendor ledger tracking, advances, deductions, and POD receipts.
 * ============================================================================
 */

import { Router } from 'express';
import {
  getVehicleEntries,
  getVehicleEntryMetrics,
  getVehicleEntryById,
  createVehicleEntry,
  updateVehicleEntry,
  updateVehicleEntryPOD,
  deleteVehicleEntry,
} from '../controllers/vehicleEntryController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all endpoints with tenant context
router.use(requireAuth, resolveTenantContext);

// Read listings and metrics
router.get('/', getVehicleEntries);
router.get('/metrics', getVehicleEntryMetrics);
router.get('/:id', getVehicleEntryById);

// Create and edit entries (admin, dispatcher, accountant)
router.post('/', requireRole(['admin', 'dispatcher', 'accountant']), createVehicleEntry);
router.put('/:id', requireRole(['admin', 'dispatcher', 'accountant']), updateVehicleEntry);

// POD acknowledgment
router.put('/:id/pod', requireRole(['admin', 'dispatcher', 'accountant']), updateVehicleEntryPOD);

// Deletion (admin only)
router.delete('/:id', requireRole(['admin']), deleteVehicleEntry);

export default router;
