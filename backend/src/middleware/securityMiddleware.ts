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

import rateLimit from 'express-rate-limit';

/**
 * Brute-Force & Credential Stuffing Guard:
 * Max 5 failed login attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Relaxed in development
  skipSuccessfulRequests: true, // Do not count successful logins against limit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many failed login attempts. For security reasons, please wait 15 minutes before trying again or use Forgot Password.',
  },
});

/**
 * Anti-Spam Workspace Registration Guard:
 * Max 5 new company registrations per hour per IP (relaxed in dev).
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many workspace registration attempts from this IP address. Please try again after an hour.',
  },
});

/**
 * Account Recovery & Password Reset Guard:
 * Max 3 password reset requests per 15 minutes per IP (relaxed in dev).
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 3 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests. Please wait 15 minutes before trying again.',
  },
});

/**
 * Team Workspace Invitation Guard:
 * Max 10 invites per minute per IP.
 */
export const invitationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many team invitation requests. Please wait a moment before sending more invitations.',
  },
});

