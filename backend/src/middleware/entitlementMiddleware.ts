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
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { CompanyMember } from '../models/CompanyMember.js';

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

/**
 * Ensures the tenant has not exceeded their plan quota for resources (trucks, drivers, user seats).
 */
export function requireQuota(resource: 'trucks' | 'drivers' | 'users') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.company) {
        res.status(401).json({ error: 'Company context required for quota check.' });
        return;
      }

      const companyId = req.company._id;
      const entitlements = await getTenantEntitlements(req.company);
      const limits = entitlements.limits;

      if (resource === 'trucks') {
        const limit = limits.max_trucks;
        if (limit !== -1) {
          const currentCount = await Truck.countDocuments({ company_id: companyId, is_deleted: false });
          if (currentCount >= limit) {
            res.status(403).json({
              code: 'QUOTA_EXCEEDED',
              resource: 'trucks',
              limit,
              current: currentCount,
              error: `Truck quota exceeded (${currentCount}/${limit}). Upgrade your plan or purchase a fleet booster to register more vehicles.`,
            });
            return;
          }
        }
      } else if (resource === 'drivers') {
        const limit = limits.max_drivers;
        if (limit !== -1) {
          const currentCount = await Driver.countDocuments({ company_id: companyId, is_deleted: false });
          if (currentCount >= limit) {
            res.status(403).json({
              code: 'QUOTA_EXCEEDED',
              resource: 'drivers',
              limit,
              current: currentCount,
              error: `Driver quota exceeded (${currentCount}/${limit}). Upgrade your plan or add driver capacity to onboard more drivers.`,
            });
            return;
          }
        }
      } else if (resource === 'users') {
        const limit = limits.max_users;
        if (limit !== -1) {
          const currentCount = await CompanyMember.countDocuments({ company_id: companyId, status: 'active' });
          if (currentCount >= limit) {
            res.status(403).json({
              code: 'QUOTA_EXCEEDED',
              resource: 'users',
              limit,
              current: currentCount,
              error: `User seat quota exceeded (${currentCount}/${limit}). Upgrade your plan to invite more team members.`,
            });
            return;
          }
        }
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to verify resource quota.' });
    }
  };
}
