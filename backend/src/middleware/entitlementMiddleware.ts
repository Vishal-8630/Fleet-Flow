/**
 * ============================================================================
 * FLEET FLOW — FEATURE ENTITLEMENT MIDDLEWARE (entitlementMiddleware.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Express middleware factory enforcing granular module-level gating on API routes.
 * 
 * USAGE:
 * ------
 * router.post('/lr-entry', requireFeature('MOD_LR_ENGINE'), createLREntry);
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ModuleKey, MOD_CATALOG } from '../utils/featureCatalog.js';
import { hasFeatureAccess, getTenantEntitlements } from '../utils/entitlementService.js';

/**
 * Ensures the tenant has access to a specific module before executing the route.
 */
export function requireFeature(moduleKey: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.company) {
        res.status(401).json({ error: 'Company context required for feature entitlement check.' });
        return;
      }

      // Check if feature is granted
      const hasAccess = await hasFeatureAccess(req.company, moduleKey);
      if (!hasAccess) {
        const moduleDef = MOD_CATALOG[moduleKey];
        res.status(403).json({
          code: 'FEATURE_LOCKED',
          module: moduleKey,
          module_name: moduleDef?.name || moduleKey,
          required_tier: moduleDef?.defaultTier || 'standard',
          error: `The feature "${moduleDef?.name || moduleKey}" is not included in your current subscription plan. Please upgrade to unlock this capability.`,
        });
        return;
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to verify feature entitlement.' });
    }
  };
}

/**
 * Ensures the tenant has access to ALL specified modules.
 */
export function requireAllFeatures(moduleKeys: ModuleKey[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.company) {
        res.status(401).json({ error: 'Company context required for feature entitlement check.' });
        return;
      }

      const profile = await getTenantEntitlements(req.company);
      const missing = moduleKeys.filter((k) => !profile.enabled_features.includes(k));

      if (missing.length > 0) {
        const missingDefs = missing.map((k) => MOD_CATALOG[k]?.name || k);
        res.status(403).json({
          code: 'FEATURE_LOCKED',
          missing_modules: missing,
          error: `This action requires features not available on your plan: ${missingDefs.join(', ')}.`,
        });
        return;
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to verify feature entitlements.' });
    }
  };
}
