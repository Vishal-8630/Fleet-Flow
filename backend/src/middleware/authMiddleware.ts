/**
 * ============================================================================
 * FLEET FLOW — AUTHENTICATION & RBAC MIDDLEWARE (authMiddleware.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * This file contains the security pipeline through which all protected API
 * requests pass. It handles user authentication (JWT verification), multi-tenant
 * workspace context resolution, Role-Based Access Control (RBAC), and subscription
 * lifecycle status gating (read-only enforcement when expired/suspended).
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * Security and multi-tenancy cannot be afterthoughts. By decoupling authentication,
 * tenant context resolution, and permission authorization into distinct, composable
 * middleware functions:
 * 1. Endpoints can easily declare required roles (e.g., `requireRole(['admin'])`).
 * 2. Every authenticated handler is guaranteed that `req.tenant.id` is verified
 *    and that all database calls run within the scoped `tenantStorage` context.
 * 3. Expired or suspended companies are gracefully locked down to read-only mode
 *    without crashing the user experience.
 * 
 * THE REQUEST PIPELINE:
 * ---------------------
 * [Client HTTP Request]
 *        ↓
 * 1. requireAuth               → Validates JWT in HttpOnly cookie or Bearer header.
 *        ↓
 * 2. resolveTenantContext      → Loads company membership, attaches `req.tenant`, wraps in AsyncLocalStorage.
 *        ↓
 * 3. requireRole (optional)    → Checks if user's role satisfies endpoint requirement.
 *        ↓
 * 4. requireActiveSubscription → Restricts suspended tenants to read-only GET requests.
 *        ↓
 * [Target Route Controller]
 * ============================================================================
 */

import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { Company, ICompany } from '../models/Company.js';
import { CompanyMember, ICompanyMember, UserRole } from '../models/CompanyMember.js';
import { tenantStorage } from '../plugins/tenantPlugin.js';

// ----------------------------------------------------------------------------
// TypeScript Global Request Augmentation
// Enables type-safe access to req.user, req.company, req.member, and req.tenant.
// ----------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      company?: ICompany;
      member?: ICompanyMember;
      tenant?: {
        id: string;
        role: UserRole;
        status: string;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  companyId?: string;
  token_version?: number;
}

/**
 * 1. requireAuth
 * ----------------------------------------------------------------------------
 * Ensures the incoming request originates from an authenticated user.
 * 
 * Flow:
 * - Checks HttpOnly cookie `token` (primary for web browsers) or `Bearer <token>` header.
 * - Decodes and verifies token signature using the server's `JWT_SECRET`.
 * - Looks up the User record in MongoDB.
 * - Validates `token_version` to enforce instant revocation on password change.
 * - Attaches the populated user document to `req.user`.
 * - If invalid, expired, or missing, immediately halts with 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
    const decoded = jwt.verify(token, secret) as JWTPayload;

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    // Token Version / Global Session Invalidation Check:
    const userTokenVersion = user.token_version ?? 0;
    const tokenVersion = decoded.token_version ?? 0;
    if (tokenVersion !== userTokenVersion) {
      res.status(401).json({ error: 'Session expired due to security updates. Please log in again.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * 2. resolveTenantContext
 * ----------------------------------------------------------------------------
 * Resolves the authenticated user's workspace membership and enters the
 * AsyncLocalStorage tenant context.
 * 
 * Flow:
 * - Queries `CompanyMember` for an `active` membership belonging to `req.user._id`.
 * - Validates that the associated company exists and is not soft-deleted.
 * - Attaches `req.company`, `req.member`, and `req.tenant` to the Express Request.
 * - Wraps execution of downstream handlers inside `tenantStorage.run({ companyId }, () => next())`
 *   so that all Mongoose queries automatically filter by `company_id`.
 */
export async function resolveTenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User context missing.' });
      return;
    }

    // Find the user's active membership
    const membership = await CompanyMember.findOne({
      user_id: req.user._id,
      status: 'active',
    }).populate('company_id');

    if (!membership) {
      res.status(403).json({ error: 'No active transport company workspace found for this user.' });
      return;
    }

    const company = membership.company_id as unknown as ICompany;
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Workspace not found or has been decommissioned.' });
      return;
    }

    req.company = company;
    req.member = membership;
    req.tenant = {
      id: company._id.toString(),
      role: membership.role,
      status: company.subscription_status,
    };

    // Run downstream request within AsyncLocalStorage tenant context
    tenantStorage.run({ companyId: company._id.toString() }, () => {
      next();
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve company workspace context.' });
  }
}

/**
 * 3. requireRole
 * ----------------------------------------------------------------------------
 * Higher-order middleware factory that enforces Role-Based Access Control (RBAC).
 * 
 * Supported Roles:
 * - `admin`: Full administrative control (team management, billing, settings).
 * - `dispatcher`: Daily operational tasks (trucks, drivers, trips, dispatches).
 * - `accountant`: Financial workflows (invoices, ledgers, driver settlements, GST).
 * - `viewer`: Read-only access across enabled modules.
 * 
 * @param allowedRoles - Array of roles permitted to invoke the downstream route.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.member || !allowedRoles.includes(req.member.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Your role: ${req.member?.role || 'none'}`,
      });
      return;
    }
    next();
  };
}

/**
 * 4. requireActiveSubscription
 * ----------------------------------------------------------------------------
 * Enforces SaaS subscription lifecycle status without lock-out disruptions.
 * 
 * Rules:
 * - HTTP GET, HEAD, and OPTIONS requests are ALWAYS permitted (operators can
 *   always view past invoices, trip history, and driver files even if expired).
 * - Write operations (POST, PUT, PATCH, DELETE) are blocked with code
 *   `SUBSCRIPTION_SUSPENDED` if the workspace status is `suspended`, `cancelled`,
 *   or `expired`.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const company = req.company;
  let status = req.tenant?.status || company?.subscription_status || 'trialing';

  // Read-only methods (GET, HEAD, OPTIONS) are always allowed even when suspended/expired
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Automatic Trial Expiry Detection
  if (status === 'trialing' && company?.trial_ends_at) {
    if (new Date(company.trial_ends_at).getTime() < Date.now()) {
      status = 'expired';
      if (req.tenant) req.tenant.status = 'expired';
      company.subscription_status = 'expired';
      await Company.findByIdAndUpdate(company._id, { subscription_status: 'expired' }).catch(() => {});
    }
  }

  if (status === 'expired') {
    res.status(403).json({
      code: 'SUBSCRIPTION_EXPIRED',
      status: 'expired',
      is_read_only: true,
      error: 'Your 14-day free trial has expired. Please upgrade to a paid plan to perform write actions.',
    });
    return;
  }

  if (['suspended', 'cancelled', 'past_due'].includes(status)) {
    res.status(403).json({
      code: 'SUBSCRIPTION_SUSPENDED',
      status,
      is_read_only: true,
      error: 'Your workspace is in read-only mode due to an inactive subscription. Please renew your plan to perform write actions.',
    });
    return;
  }

  next();
}
