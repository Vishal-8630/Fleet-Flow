/**
 * ============================================================================
 * FLEET FLOW — CUSTOM FIELDS ROUTES (customFieldRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Declares REST routes for the Custom Fields Studio.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  toggleArchiveCustomField,
  deleteCustomField,
} from '../controllers/customFieldController.js';

const router = Router();

router.use(requireAuth);
router.use(resolveTenantContext);

// Listing custom fields is permitted across all members
router.get('/', listCustomFields);

// Modifying custom fields requires admin role and MOD_CUSTOM_FIELDS feature
router.post('/', requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), createCustomField);
router.put('/:id', requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), updateCustomField);
router.patch('/:id/archive', requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), toggleArchiveCustomField);
router.delete('/:id', requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), deleteCustomField);

export default router;
