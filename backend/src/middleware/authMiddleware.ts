import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { Company, ICompany } from '../models/Company.js';
import { CompanyMember, ICompanyMember, UserRole } from '../models/CompanyMember.js';
import { tenantStorage } from '../plugins/tenantPlugin.js';

// Extend Express Request interface
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
}

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

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

export async function resolveTenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User context missing.' });
      return;
    }

    // Find the user's active membership (or use specified company context from cookie/header if multi-org)
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

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction): void {
  const status = req.tenant?.status;

  // Read-only methods (GET, HEAD, OPTIONS) are always allowed even when suspended
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  if (['suspended', 'cancelled', 'expired'].includes(status || '')) {
    res.status(403).json({
      code: 'SUBSCRIPTION_SUSPENDED',
      error: 'Your workspace is in read-only mode due to an inactive subscription. Please renew your plan to perform write actions.',
    });
    return;
  }

  next();
}
