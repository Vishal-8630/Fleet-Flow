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
  getPlatformPlansCatalog,
  updatePlan,
  createPlan,
  updateAddOn,
  createAddOn,
  updatePlatformSettings,
  createPromoCode,
  togglePromoCode,
} from '../controllers/superAdminController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

// Health Telemetry & Directory
router.get('/kpis', getPlatformKPIs);
router.get('/tenants', listAllTenants);
router.patch('/tenants/:id/override', overrideTenantQuota);
router.patch('/tenants/:id/extend-trial', extendTenantTrial);
router.patch('/tenants/:id/status', toggleTenantStatus);
router.post('/tenants/:id/impersonate', impersonateTenant);
router.get('/audit-logs', getAuditLogs);

// Catalog, Tier Entitlements & Commercial Settings
router.get('/plans-catalog', getPlatformPlansCatalog);
router.put('/plans/:id', updatePlan);
router.post('/plans', createPlan);
router.put('/addons/:id', updateAddOn);
router.post('/addons', createAddOn);
router.put('/settings', updatePlatformSettings);
router.post('/promo-codes', createPromoCode);
router.patch('/promo-codes/:id/toggle', togglePromoCode);

export default router;
