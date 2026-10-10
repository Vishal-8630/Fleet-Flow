/**
 * ============================================================================
 * APPROVAL ROUTES (approvalRoutes.ts)
 * ============================================================================
 * Approval workflow rules management and pending approvals inbox.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
  listApprovalRules,
  createApprovalRule,
  listPendingApprovals,
  processApproval,
} from '../controllers/approvalController.js';

const router = Router();

router.use(requireAuth);

router.get('/rules', listApprovalRules);
router.post('/rules', requireRole(['admin']), createApprovalRule);
router.get('/pending', listPendingApprovals);
router.post('/:id/process', requireRole(['admin']), processApproval);

export default router;
