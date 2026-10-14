/**
 * ============================================================================
 * FLEET FLOW — SUPPORT SESSION ROUTES (supportSessionRoutes.ts)
 * ============================================================================
 * 
 * Tenant workspace endpoints for viewing, approving, rejecting, and revoking
 * support access sessions. Protected by authenticated tenant context and RBAC.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';
import {
  listTenantSupportSessions,
  getSupportSessionById,
  approveSupportAccess,
  rejectSupportAccess,
  revokeSupportAccess,
} from '../controllers/supportAccessController.js';

const router = Router();

// Protect all tenant support session endpoints with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

// List workspace support access sessions (historical and active)
router.get('/', listTenantSupportSessions);

// View specific support access request details
router.get('/:id', getSupportSessionById);

// Workspace Administrator decisions
router.post('/:id/approve', requireRole(['admin']), approveSupportAccess);
router.post('/:id/reject', requireRole(['admin']), rejectSupportAccess);

// Immediate Revocation (callable by tenant admin or platform super-admin)
router.post('/:id/revoke', revokeSupportAccess);

export default router;
