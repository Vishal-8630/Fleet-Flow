/**
 * ============================================================================
 * FLEET FLOW — DISTRIBUTED IDEMPOTENCY MIDDLEWARE (idempotencyMiddleware.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Intercepts requests to financial and commercial write endpoints (driver
 * settlements, invoice payments, manual journals, billing checkout/activation).
 * 
 * SAFEGUARDS IMPLEMENTED (ISS-019):
 * ---------------------------------
 * 1. Durable atomic in-flight reservation via collection.insertOne (prevents concurrent double-execution).
 * 2. Deterministic SHA-256 payload-hash validation (rejects payload tampering with HTTP 422).
 * 3. Strict tenant isolation (scoped by company_id; tenant keys never cross-contaminate).
 * 4. Response replay for resolved requests with `X-Cache: IDEMPOTENT_HIT`.
 * 5. Concurrency handling: in-flight collision returns HTTP 409 Conflict.
 * 6. Crash recovery: stale PENDING lock leases (>60s) safely recoverable without orphan corruption.
 * 7. FAILED state retry: failed requests allow clean retry with identical key.
 * 8. `requireStrictIdempotency`: rejects missing key with HTTP 400 on financial mutations.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { Types } from 'mongoose';
import { IdempotencyKey } from '../models/IdempotencyKey.js';

export const LOCK_LEASE_MS = 120 * 1000; // 120 seconds lock lease for crash recovery

export interface IdempotencyContext {
  key: string;
  companyId: Types.ObjectId;
  lockToken: string;
}

export const idempotencyStorage = new AsyncLocalStorage<IdempotencyContext>();

/**
 * Returns the active idempotency context for the current request execution chain.
 */
export function getIdempotencyContext(): IdempotencyContext | undefined {
  return idempotencyStorage.getStore();
}

/**
 * Computes deterministic SHA-256 payload hash of request method, canonical path, and body.
 */
export function computePayloadHash(req: Request): string {
  const bodyStr = req.body ? JSON.stringify(req.body) : '';
  const url = req.originalUrl || (req.baseUrl || '') + (req.path || '');
  return crypto
    .createHash('sha256')
    .update(`${req.method.toUpperCase()}:${url}:${bodyStr}`)
    .digest('hex');
}

/**
 * Core idempotency handler supporting atomic reservation, replay, and conflict management.
 */
export async function handleIdempotency(
  key: string,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.company?._id || req.tenant?.id;
  if (!companyId) {
    return next();
  }

  const companyObjectId = new Types.ObjectId(String(companyId));
  const currentHash = computePayloadHash(req);
  const now = new Date();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const initialLockToken = crypto.randomUUID();
  let currentLockToken = initialLockToken;

  let acquired = false;
  let existingRecord: any = null;

  try {
    // 1. Attempt atomic in-flight reservation with unique fencing token
    await IdempotencyKey.collection.insertOne({
      company_id: companyObjectId,
      key,
      endpoint: req.originalUrl || req.path,
      method: req.method.toUpperCase(),
      request_hash: currentHash,
      status: 'PENDING',
      locked_at: now,
      lock_token: initialLockToken,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    });
    acquired = true;
  } catch (err: any) {
    if (err?.code === 11000) {
      // Record already exists for this tenant & key
      existingRecord = await IdempotencyKey.findOne({
        company_id: companyObjectId,
        key,
      });
    } else {
      console.error('[Idempotency Reservation Error]:', err);
      res.status(500).json({ error: 'Failed to establish idempotency lock' });
      return;
    }
  }

  if (!acquired && existingRecord) {
    // 2. Validate payload hash (tampering or key reuse with different payload)
    if (existingRecord.request_hash && existingRecord.request_hash !== currentHash) {
      res.status(422).json({
        error: 'Idempotency key payload mismatch',
        message: 'This idempotency key was previously used with a different request payload or endpoint.',
      });
      return;
    }

    // 3. Handle RESOLVED or COMMITTED state -> Replay cached response
    if (existingRecord.status === 'RESOLVED' || existingRecord.status === 'COMMITTED') {
      res.setHeader('X-Cache', 'IDEMPOTENT_HIT');
      const statusCode = existingRecord.status_code || 200;
      const responseBody = existingRecord.response_body || {
        message: 'Transaction previously committed successfully (Idempotent replay).',
      };
      res.status(statusCode).json(responseBody);
      return;
    }

    // 4. Handle PENDING state -> Check in-flight lock lease
    if (existingRecord.status === 'PENDING') {
      const lockedTime = existingRecord.locked_at ? new Date(existingRecord.locked_at).getTime() : 0;
      const isLeaseExpired = Date.now() - lockedTime > LOCK_LEASE_MS;

      if (!isLeaseExpired) {
        // Concurrency collision: another instance/request is currently executing
        res.status(409).json({
          error: 'Request currently in progress',
          message: 'A request with this idempotency key is currently processing. Please wait for completion before retrying.',
        });
        return;
      }

      // Lock lease expired (worker crashed mid-flight or timed out): Safe crash recovery with new fencing token
      const recoveryLockToken = crypto.randomUUID();
      const recovered = await IdempotencyKey.findOneAndUpdate(
        {
          _id: existingRecord._id,
          company_id: companyObjectId,
          status: 'PENDING',
          locked_at: existingRecord.locked_at,
        },
        {
          $set: {
            locked_at: new Date(),
            lock_token: recoveryLockToken,
            request_hash: currentHash,
            updated_at: new Date(),
          },
        },
        { new: true }
      );

      if (!recovered) {
        // Lost race to another concurrent recovery retry
        res.status(409).json({
          error: 'Request currently in progress',
          message: 'A concurrent retry claimed this idempotency lock.',
        });
        return;
      }
      currentLockToken = recoveryLockToken;
      acquired = true;
    }

    // 5. Handle FAILED state -> Allow clean retry
    if (existingRecord.status === 'FAILED') {
      const retryLockToken = crypto.randomUUID();
      const reset = await IdempotencyKey.findOneAndUpdate(
        {
          _id: existingRecord._id,
          company_id: companyObjectId,
          status: 'FAILED',
        },
        {
          $set: {
            status: 'PENDING',
            locked_at: new Date(),
            lock_token: retryLockToken,
            request_hash: currentHash,
            updated_at: new Date(),
          },
        },
        { new: true }
      );

      if (!reset) {
        res.status(409).json({
          error: 'Request currently in progress',
        });
        return;
      }
      currentLockToken = retryLockToken;
      acquired = true;
    }
  }

  if (!acquired) {
    res.status(409).json({ error: 'Request currently in progress' });
    return;
  }

  // Active heartbeat timer: renews lock lease every 30s while operation is actively processing
  // Stops renewing immediately if fencing token was superseded by a newer worker
  let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
    if (finalized) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      return;
    }
    try {
      const updateResult = await IdempotencyKey.collection.updateOne(
        { company_id: companyObjectId, key, status: 'PENDING', lock_token: currentLockToken },
        { $set: { locked_at: new Date(), updated_at: new Date() } }
      );
      if (updateResult.matchedCount === 0) {
        // Lost ownership to newer worker, or key was finalized
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      }
    } catch (_) {}
  }, 30000);

  // 6. Response interceptor: Finalize idempotency state on downstream completion
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let finalized = false;

  const finalizeIdempotency = async (statusCode: number, body: any) => {
    if (finalized) return;
    finalized = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    try {
      const isSuccess = statusCode >= 200 && statusCode < 400;
      const finalStatus = isSuccess ? 'RESOLVED' : 'FAILED';

      // Atomic fencing check: only finalize if we still own currentLockToken
      const updateResult = await IdempotencyKey.updateOne(
        { company_id: companyObjectId, key, lock_token: currentLockToken },
        {
          $set: {
            status: finalStatus,
            status_code: statusCode,
            response_body: body,
            updated_at: new Date(),
          },
        }
      );

      if (updateResult.matchedCount === 0) {
        console.warn(`[Idempotency Safeguard]: Dropping stale finalization for key ${key}; lock token was preempted by a newer worker.`);
      }
    } catch (saveErr) {
      console.error('[Idempotency Finalize Error]:', saveErr);
    }
  };

  // Clean up heartbeat timer if client connection closes before response completion
  res.on('close', () => {
    if (!finalized && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  res.json = (body: any) => {
    finalizeIdempotency(res.statusCode, body);
    return originalJson(body);
  };

  res.send = (body: any) => {
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch (_) {}
    }
    finalizeIdempotency(res.statusCode, parsedBody);
    return originalSend(body);
  };

  idempotencyStorage.run(
    {
      key,
      companyId: companyObjectId,
      lockToken: currentLockToken,
    },
    () => {
      next();
    }
  );
}

/**
 * Strict Idempotency Middleware for Financial Mutations.
 * Rejects missing x-idempotency-key with HTTP 400 Bad Request.
 */
export async function requireStrictIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const rawKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    res.status(400).json({
      error: 'x-idempotency-key header is required for this financial mutation',
    });
    return;
  }

  const key = rawKey.trim();
  await handleIdempotency(key, req, res, next);
}

/**
 * Optional Idempotency Middleware.
 * Applies idempotency if key is present; otherwise passes through.
 */
export async function requireIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const rawKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotency_key;
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    return next();
  }

  const key = rawKey.trim();
  await handleIdempotency(key, req, res, next);
}

export default requireIdempotency;
