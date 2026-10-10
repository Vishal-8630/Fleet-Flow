/**
 * ============================================================================
 * FLEET FLOW — IDEMPOTENCY MIDDLEWARE (idempotencyMiddleware.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Intercepts requests to financial and commercial write endpoints (e.g., driver
 * settlements, invoice payments, manual journals) to prevent duplicate execution
 * from rapid double-clicks, browser back-forward submissions, or automated retries.
 * 
 * HOW THE FLOW WORKS:
 * -------------------
 * 1. Checks for an `x-idempotency-key` HTTP header or `req.body.idempotency_key`.
 * 2. If present, queries the `IdempotencyKey` collection for the requesting tenant.
 * 3. If a cached record exists, replays the exact status code and JSON payload
 *    immediately with `X-Cache: IDEMPOTENT_HIT`.
 * 4. If absent, wraps `res.json` to store the resulting response on completion.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { IdempotencyKey } from '../models/IdempotencyKey.js';

export const requireIdempotency = async (req: Request, res: Response, next: NextFunction) => {
  // Only apply to write operations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const rawKey = req.headers['x-idempotency-key'] || req.body?.idempotency_key;
  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }

  const key = rawKey.trim();
  if (!key) {
    return next();
  }

  const companyId = req.tenant?.id;
  if (!companyId) {
    return next();
  }

  try {
    const existing = await IdempotencyKey.findOne({
      company_id: companyId,
      key,
    });

    if (existing) {
      res.setHeader('X-Cache', 'IDEMPOTENT_HIT');
      return res.status(existing.status_code).json(existing.response_body);
    }

    // Capture response to persist upon completion
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful or client-handled responses (status < 500)
      if (res.statusCode < 500) {
        IdempotencyKey.create({
          company_id: companyId,
          key,
          endpoint: req.originalUrl || req.path,
          method: req.method,
          status_code: res.statusCode,
          response_body: body,
        }).catch((err) => {
          // If a duplicate key race condition happened concurrently, ignore
          if (err?.code !== 11000) {
            console.error('[Idempotency Key Save Error]:', err);
          }
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error('[Idempotency Middleware Error]:', err);
    next();
  }
};
