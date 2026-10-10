/**
 * ============================================================================
 * PAGINATION MIDDLEWARE (paginationMiddleware.ts)
 * ============================================================================
 * Enforces safe pagination limits on all listing endpoints.
 * Max 100 results per page to prevent DoS memory exhaustion attacks.
 * Augments req with typed `pagination` object for downstream controllers.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      pagination: {
        page: number;
        limit: number;
        skip: number;
      };
    }
  }
}

/**
 * Attaches safe, bounded pagination parameters to every request.
 * - Minimum page: 1
 * - Minimum limit: 1
 * - Maximum limit: 100
 * - Default limit: 20
 */
export function paginationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
}
