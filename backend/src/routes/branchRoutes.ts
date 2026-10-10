/**
 * ============================================================================
 * BRANCH ROUTES (branchRoutes.ts)
 * ============================================================================
 * Regional branch hub management — CRUD with feature gating.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { listBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branchController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBranches);
router.post('/', requireRole(['admin']), createBranch);
router.put('/:id', requireRole(['admin']), updateBranch);
router.delete('/:id', requireRole(['admin']), deleteBranch);

export default router;
