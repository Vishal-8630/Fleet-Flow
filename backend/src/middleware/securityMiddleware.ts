/**
 * ============================================================================
 * FLEET FLOW — NOSQL INJECTION & SECURITY SANITIZATION (securityMiddleware.ts)
 * ============================================================================
 * 
 * Recursively strips keys starting with '$' or containing '.' from request body,
 * params, and query objects to eliminate NoSQL injection attack vectors.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';

function sanitizeObject(target: any): any {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(target)) {
    // Strip leading '$' or embedded '.' from keys (NoSQL operators)
    if (key.startsWith('$') || key.includes('.')) {
      console.warn(`[Security Alert]: Stripped suspicious NoSQL operator key '${key}'`);
      continue;
    }
    clean[key] = sanitizeObject(target[key]);
  }
  return clean;
}

export function noSqlSanitizer(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}
