/**
 * ============================================================================
 * FLEET FLOW — LORRY RECEIPT (LR) ROUTES (entryRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getEntries,
  getEntryMetrics,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  getPrintableLR,
} from '../controllers/entryController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';

const router = Router();

// Protect all LR routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_LR_ENGINE'));

// Metrics summary
router.get('/metrics', getEntryMetrics);

// Print payload (support both /print and /printable)
router.get('/:id/print', getPrintableLR);
router.get('/:id/printable', getPrintableLR);

// Main CRUD
router.get('/', getEntries);
router.get('/:id', getEntryById);
router.post('/', requireRole(['admin', 'dispatcher', 'accountant']), createEntry);
router.put('/:id', requireRole(['admin', 'dispatcher', 'accountant']), updateEntry);
router.delete('/:id', requireRole(['admin', 'dispatcher', 'accountant']), deleteEntry);

export default router;
