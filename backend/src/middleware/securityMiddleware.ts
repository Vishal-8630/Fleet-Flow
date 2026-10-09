/**
 * ============================================================================
 * FLEET FLOW — NOSQL INJECTION & SECURITY SANITIZATION (securityMiddleware.ts)
 * ============================================================================
 * 
 * Recursively strips keys starting with '$' or containing '.' from request body,
 * params, and query objects to eliminate NoSQL injection attack vectors.
 * 
 * NOTE FOR EXPRESS 5:
 * -------------------
 * In Express 5, `req.query` and `req.params` are accessor properties (getters)
 * on IncomingMessage and cannot be reassigned with `req.query = ...`.
 * We therefore sanitize properties in-place using `delete target[key]`.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';

function sanitizeInPlace(target: any): void {
  if (!target || typeof target !== 'object') return;

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      if (typeof target[i] === 'object' && target[i] !== null) {
        sanitizeInPlace(target[i]);
      }
    }
    return;
  }

  for (const key of Object.keys(target)) {
    // Strip leading '$' or embedded '.' from keys (NoSQL operators)
    if (key.startsWith('$') || key.includes('.')) {
      console.warn(`[Security Alert]: Stripped suspicious NoSQL operator key '${key}'`);
      delete target[key];
    } else if (typeof target[key] === 'object' && target[key] !== null) {
      sanitizeInPlace(target[key]);
    }
  }
}

export function noSqlSanitizer(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      sanitizeInPlace(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeInPlace(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      sanitizeInPlace(req.params);
    }
  } catch (err: any) {
    console.warn('[NoSQL Sanitizer Error]:', err?.message);
  }
  next();
}
