/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN MIDDLEWARE (superAdminMiddleware.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Enforces platform-level super-administrator authorization.
 * Only users with `is_platform_super_admin: true` on their global User document
 * are permitted to access SaaS control plane APIs.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.is_platform_super_admin) {
    res.status(403).json({
      code: 'SUPER_ADMIN_REQUIRED',
      error: 'Access denied. This endpoint is restricted to platform super-administrators.',
    });
    return;
  }
  next();
}
