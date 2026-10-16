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
  assignTenantPlan,
  impersonateTenant,
  exitImpersonation,
  getAuditLogs,
  getPlatformPlansCatalog,
  updatePlan,
  createPlan,
  updateAddOn,
  createAddOn,
  updatePlatformSettings,
  createPromoCode,
  togglePromoCode,
  getCompanyModulesOverview,
} from '../controllers/superAdminController.js';
import {
  requestSupportAccess,
  activateSupportAccess,
  emergencySupportAccess,
  listPlatformSupportSessions,
  createLockoutTicket,
  revokeSupportAccess,
} from '../controllers/supportAccessController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

// Health Telemetry & Directory
router.get('/kpis', getPlatformKPIs);
router.get('/tenants', listAllTenants);
router.get('/tenants/modules-overview', getCompanyModulesOverview);
router.patch('/tenants/:id/override', overrideTenantQuota);
router.patch('/tenants/:id/extend-trial', extendTenantTrial);
router.patch('/tenants/:id/status', toggleTenantStatus);
router.patch('/tenants/:id/plan', assignTenantPlan);
router.post('/tenants/:id/impersonate', impersonateTenant);
router.post('/exit-impersonation', exitImpersonation);
router.get('/audit-logs', getAuditLogs);

// Batch A: Controlled Support Access Lifecycle & Out-of-Band Lockout Intake
router.post('/support-access/request', requestSupportAccess);
router.post('/support-access/:id/activate', activateSupportAccess);
router.post('/support-access/emergency-access', emergencySupportAccess);
router.get('/support-access', listPlatformSupportSessions);
router.post('/support-access/:id/revoke', revokeSupportAccess);
router.post('/support-tickets/lockout-intake', createLockoutTicket);

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
