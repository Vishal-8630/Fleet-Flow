/**
 * ============================================================================
 * BRANCH ROUTES (branchRoutes.ts)
 * ============================================================================
 * Regional branch hub management — CRUD with feature gating.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireQuota } from '../middleware/entitlementMiddleware.js';
import { listBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branchController.js';

const router = Router();

router.use(requireAuth, resolveTenantContext, requireActiveSubscription);

router.get('/', listBranches);
router.post('/', requireRole(['admin']), requireQuota('branches'), createBranch);
router.put('/:id', requireRole(['admin']), updateBranch);
router.delete('/:id', requireRole(['admin']), deleteBranch);

export default router;
