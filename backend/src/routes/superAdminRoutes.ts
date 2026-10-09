/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN ROUTES (superAdminRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Declares REST routes for platform super-administrators.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireSuperAdmin } from '../middleware/superAdminMiddleware.js';
import {
  getPlatformKPIs,
  listAllTenants,
  overrideTenantQuota,
  extendTenantTrial,
  toggleTenantStatus,
  impersonateTenant,
  getAuditLogs,
} from '../controllers/superAdminController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get('/kpis', getPlatformKPIs);
router.get('/tenants', listAllTenants);
router.patch('/tenants/:id/override', overrideTenantQuota);
router.patch('/tenants/:id/extend-trial', extendTenantTrial);
router.patch('/tenants/:id/status', toggleTenantStatus);
router.post('/tenants/:id/impersonate', impersonateTenant);
router.get('/audit-logs', getAuditLogs);

export default router;
