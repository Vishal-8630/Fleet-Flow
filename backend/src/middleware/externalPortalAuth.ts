/**
 * ============================================================================
 * EXTERNAL PORTAL AUTH MIDDLEWARE (externalPortalAuth.ts)
 * ============================================================================
 * Validates JWT tokens for external stakeholder portals (customers, drivers,
 * vendors). Enforces entity-level data boundary scoping so external tokens
 * can ONLY access records belonging to their own entityId and companyId.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PortalTokenPayload {
  portalType: 'customer' | 'driver' | 'vendor';
  entityId: string;
  companyId: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalTokenPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_fallback_key';

/**
 * Extracts and validates a portal JWT from Authorization header.
 * Attaches the decoded payload to req.portalUser.
 */
export function externalPortalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Portal authentication required.', code: 'PORTAL_AUTH_REQUIRED' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PortalTokenPayload;
    if (!payload.portalType || !payload.entityId || !payload.companyId) {
      res.status(401).json({ error: 'Invalid portal token structure.', code: 'INVALID_PORTAL_TOKEN' });
      return;
    }
    req.portalUser = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Portal session expired or invalid.', code: 'PORTAL_TOKEN_EXPIRED' });
  }
}

/**
 * Generates a portal JWT for an authenticated external user.
 */
export function generatePortalToken(payload: Omit<PortalTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Directly verifies and decodes a portal JWT.
 */
export function verifyPortalToken(token: string): PortalTokenPayload {
  return jwt.verify(token, JWT_SECRET) as PortalTokenPayload;
}
