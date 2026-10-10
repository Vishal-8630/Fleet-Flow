/**
 * ============================================================================
 * FLEET FLOW — AUTHENTICATION CONTROLLER (authController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Handles user onboarding, company workspace creation, credential verification,
 * session cookies, and active session profile retrieval (`/me`).
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Atomic Onboarding: When a new company registers, we atomically create the
 *   `User`, the `Company` (with a 14-day free trial), and the `CompanyMember`
 *   (granting the creator the `admin` role) all in one seamless flow.
 * - HttpOnly Cookies: JWTs are stored in `HttpOnly`, `SameSite: strict` cookies
 *   so they cannot be intercepted by malicious third-party client JavaScript (XSS defense).
 * - Password Security: Passwords are salted and hashed using bcrypt with cost factor 12.
 * ============================================================================
 */

import 'dotenv/config';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { getTenantEntitlements } from '../utils/entitlementService.js';
import {
  sendPasswordResetEmail,
  sendPasswordChangedAlert,
  sendTeamInvitationEmail,
} from '../utils/emailService.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

/**
 * Returns the JWT signing secret dynamically from process.env to guarantee
 * consistent secret resolution across ES Module evaluation and runtime execution.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be configured in production environment.');
    }
    return 'dev_secret_fallback_key';
  }
  return secret;
};

/**
 * Returns the secure session cookie configuration dynamically.
 */
export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days session lifetime
});

/**
 * 1. registerCompany
 * ----------------------------------------------------------------------------
 * Handles company signup and administrator account initialization.
 * 
 * Flow:
 * 1. Validates mandatory inputs (Company Name, User Name, Email, Password, Phone).
 * 2. Checks for email uniqueness across the platform.
 * 3. Generates a clean URL slug for the company workspace.
 * 4. Hashes the password using bcrypt.
 * 5. Creates the User record.
 * 6. Creates the Company record with `subscription_status: 'trialing'` and a 14-day expiry.
 * 7. Creates the CompanyMember join record assigning `role: 'admin'`.
 * 8. Issues an HttpOnly JWT cookie and returns the user & company metadata.
 */
export async function registerCompany(req: Request, res: Response): Promise<void> {
  let session: mongoose.ClientSession | null = null;
  try {
    const { companyName, slug, name, email, password, phone, gstin } = req.body;

    if (!companyName || !name || !email || !password || !phone) {
      res.status(400).json({ error: 'All mandatory fields (Company Name, Your Name, Email, Password, Phone) are required.' });
      return;
    }

    const userEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: userEmail });
    let user: any;

    if (existingUser) {
      // Check if this request is already authenticated as this user via cookies or authorization header
      let isAuthenticatedAsUser = false;
      const rawToken = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
      if (rawToken) {
        try {
          const decoded = jwt.verify(rawToken, getJwtSecret()) as any;
          if (decoded && decoded.userId && decoded.userId.toString() === existingUser._id.toString()) {
            isAuthenticatedAsUser = true;
          }
        } catch {}
      }

      if (!isAuthenticatedAsUser) {
        // User account exists. Verify password to securely link this new workspace.
        const isMatch = await bcrypt.compare(password, existingUser.password_hash);
        if (!isMatch) {
          res.status(401).json({
            error: 'An account with this email already exists. Please enter your existing account password to create and link this new workspace.',
          });
          return;
        }
      }
      user = existingUser;
    }

    // Auto-generate slug if not provided, resolve collision gracefully
    let cleanSlug = (slug || companyName).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
    if (!cleanSlug) {
      cleanSlug = `company-${Date.now().toString(36)}`;
    }
    const existingCompany = await Company.findOne({ slug: cleanSlug });
    if (existingCompany) {
      cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Multi-document transaction attempt (gracefully falls back if standalone MongoDB)
    let useSession = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useSession = true;
    } catch {
      session = null;
      useSession = false;
    }

    const sessionOption = useSession && session ? { session } : undefined;

    // 2. Create User account if brand new
    if (!user) {
      const password_hash = await bcrypt.hash(password, 12);
      const users = await User.create(
        [
          {
            name: name.trim(),
            email: userEmail,
            password_hash,
            phone: phone.trim(),
            token_version: 0,
          },
        ],
        sessionOption
      );
      user = users[0];
    }

    // 3. Create Company Workspace with 14-day free trial
    const companies = await Company.create(
      [
        {
          name: companyName.trim(),
          slug: cleanSlug,
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          gstin: gstin ? gstin.toUpperCase().trim() : undefined,
          subscription_status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      ],
      sessionOption
    );
    const company = companies[0];

    // 4. Create Company Member (Admin Role)
    await CompanyMember.create(
      [
        {
          company_id: company._id,
          user_id: user._id,
          email: user.email,
          role: 'admin',
          status: 'active',
        },
      ],
      sessionOption
    );

    // 5. Initialize Trial Subscription if standard plan exists
    const standardPlan = await Plan.findOne({ code: 'standard' });
    if (standardPlan) {
      await Subscription.create(
        [
          {
            company_id: company._id,
            plan_id: standardPlan._id,
            billing_cycle: 'monthly',
            status: 'trialing',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        ],
        sessionOption
      );
    }

    if (useSession && session) {
      await session.commitTransaction();
    }

    // 6. Issue JWT session cookie with token_version
    const token = jwt.sign(
      { userId: user._id, companyId: company._id, token_version: user.token_version || 0 },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      message: 'Company workspace successfully registered!',
      user: { id: user._id, name: user.name, email: user.email, isSuperAdmin: false },
      company: { id: company._id, name: company.name, slug: company.slug, status: company.subscription_status },
    });
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {}
    }
    res.status(500).json({ error: error.message || 'Registration failed.' });
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * 2. login
 * ----------------------------------------------------------------------------
 * Authenticates user credentials and establishes an active workspace session.
 * 
 * Flow:
 * 1. Validates presence of email and password.
 * 2. Retrieves User by lowercase email.
 * 3. Compares candidate password against bcrypt password_hash.
 * 4. Resolves the user's active company membership.
 * 5. Issues an HttpOnly JWT cookie and returns authenticated user and company info.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Get active workspace membership
    const membership = await CompanyMember.findOne({ user_id: user._id, status: 'active' }).populate('company_id');
    if (!membership) {
      res.status(403).json({ error: 'No active transport company workspace linked to this account.' });
      return;
    }

    const company = membership.company_id as any;
    const token = jwt.sign(
      { userId: user._id, companyId: company._id, token_version: user.token_version || 0 },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions());

    const entitlements = await getTenantEntitlements(company);

    res.json({
      message: 'Login successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.is_platform_super_admin,
      },
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
        status: company.subscription_status,
        plan: entitlements.plan,
        trialEndsAt: company.trial_ends_at,
      },
      role: membership.role,
      enabledFeatures: entitlements.enabled_features,
      limits: entitlements.limits,
      isReadOnly: entitlements.is_read_only,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Login failed.' });
  }
}

/**
 * 3. logout
 * ----------------------------------------------------------------------------
 * Terminates the active session by clearing the HttpOnly cookie.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token', getCookieOptions());
  res.json({ message: 'Logged out successfully.' });
}

/**
 * 4. getMe
 * ----------------------------------------------------------------------------
 * Session hydration endpoint invoked by the frontend upon page load or app boot.
 * Returns the current authenticated user's profile, active company settings,
 * subscription status, entitlements, limits, and role.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  let enabledFeatures: string[] = [];
  let limits = { max_trucks: 5, max_drivers: 5, max_users: 2 };
  let isReadOnly = false;
  let planInfo = { code: 'standard', name: 'Standard Plan' };

  if (req.company) {
    const entitlements = await getTenantEntitlements(req.company);
    enabledFeatures = entitlements.enabled_features;
    limits = entitlements.limits;
    isReadOnly = entitlements.is_read_only;
    planInfo = entitlements.plan;
  }

  res.json({
    user: {
      id: req.user?._id,
      name: req.user?.name,
      email: req.user?.email,
      phone: req.user?.phone,
      isSuperAdmin: req.user?.is_platform_super_admin,
    },
    company: {
      id: req.company?._id,
      name: req.company?.name,
      slug: req.company?.slug,
      settings: req.company?.settings,
      status: req.company?.subscription_status,
      trialEndsAt: req.company?.trial_ends_at,
      plan: planInfo,
    },
    role: req.member?.role,
    enabledFeatures,
    limits,
    isReadOnly,
    isImpersonation: req.isImpersonation || false,
    impersonationActorEmail: req.impersonationActorEmail || null,
  });
}

/**
 * 4a. listWorkspaces
 * ----------------------------------------------------------------------------
 * Returns all active company memberships linked to the authenticated user.
 */
export async function listWorkspaces(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const memberships = await CompanyMember.find({
      user_id: req.user._id,
      status: 'active',
    }).populate('company_id');

    const currentCompanyId = (req.headers['x-company-id'] as string) || req.requestedCompanyId;

    const workspaces = memberships
      .filter((m) => m.company_id && !(m.company_id as any).is_deleted)
      .map((m) => {
        const c = m.company_id as any;
        return {
          company_id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          role: m.role,
          status: c.subscription_status,
          is_current: currentCompanyId ? c._id.toString() === currentCompanyId : false,
        };
      });

    res.json({ workspaces });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list workspaces.' });
  }
}

/**
 * 4b. switchCompany
 * ----------------------------------------------------------------------------
 * Switches the authenticated user's active tenant context to a specified company.
 * Verifies active membership before re-issuing a new JWT token containing the selected companyId.
 */
export async function switchCompany(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({ error: 'Target company_id is required.' });
      return;
    }

    const membership = await CompanyMember.findOne({
      user_id: req.user._id,
      company_id,
      status: 'active',
    }).populate('company_id');

    if (!membership) {
      res.status(403).json({ error: 'You do not have active membership in this workspace.' });
      return;
    }

    const company = membership.company_id as any;
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
      return;
    }

    const token = jwt.sign(
      {
        userId: req.user._id,
        companyId: company._id,
        token_version: req.user.token_version || 0,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions());

    const entitlements = await getTenantEntitlements(company);

    res.json({
      message: `Successfully switched workspace to ${company.name}.`,
      token,
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
        status: company.subscription_status,
        plan: entitlements.plan,
        trialEndsAt: company.trial_ends_at,
      },
      role: membership.role,
      enabledFeatures: entitlements.enabled_features,
      limits: entitlements.limits,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to switch workspace.' });
  }
}

/**
 * 4c. createWorkspace
 * ----------------------------------------------------------------------------
 * Enables an authenticated user to provision a brand-new company workspace
 * without leaving their active session or re-authenticating.
 * 
 * Flow:
 * 1. Validates that req.user is populated.
 * 2. Validates companyName.
 * 3. Generates a unique URL slug with random collision resolution.
 * 4. Creates the Company record with 14-day free trial.
 * 5. Creates CompanyMember with role: 'admin' linking req.user._id.
 * 6. Creates default trial Subscription.
 * 7. Issues updated JWT session cookie pointing to the new companyId.
 * 8. Returns the new company metadata and entitlements.
 */
export async function createWorkspace(req: Request, res: Response): Promise<void> {
  let session: mongoose.ClientSession | null = null;
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const { companyName, slug, phone, gstin } = req.body;

    if (!companyName || !companyName.trim()) {
      res.status(400).json({ error: 'Company Name is required.' });
      return;
    }

    // Auto-generate slug if not provided, resolve collision gracefully
    let cleanSlug = (slug || companyName).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
    if (!cleanSlug) {
      cleanSlug = `company-${Date.now().toString(36)}`;
    }
    const existingCompany = await Company.findOne({ slug: cleanSlug });
    if (existingCompany) {
      cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Multi-document transaction attempt (gracefully falls back if standalone MongoDB)
    let useSession = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useSession = true;
    } catch {
      session = null;
      useSession = false;
    }

    const sessionOption = useSession && session ? { session } : undefined;

    // Create Company Workspace with 14-day free trial
    const companies = await Company.create(
      [
        {
          name: companyName.trim(),
          slug: cleanSlug,
          email: req.user.email,
          phone: (phone || req.user.phone || '').trim(),
          gstin: gstin ? gstin.toUpperCase().trim() : undefined,
          subscription_status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      ],
      sessionOption
    );
    const company = companies[0];

    // Create Company Member (Admin Role)
    await CompanyMember.create(
      [
        {
          company_id: company._id,
          user_id: req.user._id,
          email: req.user.email,
          role: 'admin',
          status: 'active',
        },
      ],
      sessionOption
    );

    // Initialize Trial Subscription if standard plan exists
    const standardPlan = await Plan.findOne({ code: 'standard' });
    if (standardPlan) {
      await Subscription.create(
        [
          {
            company_id: company._id,
            plan_id: standardPlan._id,
            billing_cycle: 'monthly',
            status: 'trialing',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        ],
        sessionOption
      );
    }

    if (useSession && session) {
      await session.commitTransaction();
    }

    // Issue updated JWT session cookie pointing to the new company
    const token = jwt.sign(
      {
        userId: req.user._id,
        companyId: company._id,
        token_version: req.user.token_version || 0,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions());

    const entitlements = await getTenantEntitlements(company);

    res.status(201).json({
      message: `Workspace "${company.name}" created successfully!`,
      token,
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
        status: company.subscription_status,
        plan: entitlements.plan,
        trialEndsAt: company.trial_ends_at,
      },
      role: 'admin',
      enabledFeatures: entitlements.enabled_features,
      limits: entitlements.limits,
    });
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {}
      await session.endSession();
    }
    console.error('Failed to create workspace:', error);
    res.status(500).json({ error: error.message || 'Failed to create workspace.' });
  }
}

/**
 * 5. inviteMember
 * ----------------------------------------------------------------------------
 * Dispatches an employee invitation to a given email with a specified role.
 * Generates a crypto-secure token expiring in 7 days.
 */
export async function inviteMember(req: Request, res: Response): Promise<void> {
  try {
    const { email, role } = req.body;

    if (!email || !['admin', 'dispatcher', 'accountant', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Valid email and role (admin, dispatcher, accountant, viewer) required.' });
      return;
    }

    const existingMember = await CompanyMember.findOne({
      company_id: req.company?._id,
      email: email.toLowerCase().trim(),
    });

    if (existingMember) {
      res.status(400).json({ error: 'This user is already a member or has a pending invitation in this company.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const member = await CompanyMember.create({
      company_id: req.company?._id,
      email: email.toLowerCase().trim(),
      role,
      status: 'invited',
      invitation_token: token,
      token_expires_at: tokenExpiresAt,
      invited_by: req.user?._id,
    });

    const clientUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/accept-invite?token=${token}`;
    await sendTeamInvitationEmail(
      member.email,
      req.company?.name || 'FleetFlow Workspace',
      inviteUrl,
      req.user?.name || 'Team Administrator',
      role
    );

    res.status(201).json({
      message: 'Employee invitation created successfully.',
      member: { id: member._id, email: member.email, role: member.role, invitation_token: token },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Invitation failed.' });
  }
}

/**
 * 6. forgotPassword
 * ----------------------------------------------------------------------------
 * Initiates the password recovery flow:
 * 1. Accepts email.
 * 2. To prevent user enumeration, always returns 200 with standard success message.
 * 3. If user exists, generates a 32-byte cryptographically secure random token.
 * 4. Stores SHA-256 hash of token on user record, expiring in strictly 15 minutes.
 * 5. Dispatches password reset email.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    let devResetUrl: string | undefined;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.reset_password_token = hashedToken;
      user.reset_password_expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();

      const clientUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(user.email, resetUrl, user.name);

      if (process.env.NODE_ENV !== 'production' && !hasSmtp) {
        devResetUrl = resetUrl;
      }
    }

    // Zero-enumeration security response (with dev_reset_url in non-production if no SMTP configured)
    res.status(200).json({
      message:
        'If an active workspace account exists with this email address, a password recovery link has been dispatched. Please check your inbox or spam folder.',
      ...(devResetUrl ? { dev_reset_url: devResetUrl } : {}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process password reset request.' });
  }
}

/**
 * 7. resetPassword
 * ----------------------------------------------------------------------------
 * Resets a user's password using a verified single-use token:
 * 1. Hashes candidate token with SHA-256 and matches against active unexpired tokens.
 * 2. Validates password strength (8+ chars, upper, lower, number, special char).
 * 3. Hashes new password with bcrypt (cost 12).
 * 4. Clears reset token & expiration.
 * 5. Increments token_version to immediately revoke all existing sessions across devices.
 * 6. Dispatches password changed security alert email.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required.' });
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      res.status(400).json({
        error:
          'Password must contain at least 8 characters, including uppercase, lowercase, numbers, and symbols.',
      });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      reset_password_token: hashedToken,
      reset_password_expires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        error: 'Invalid or expired password reset token. Please request a new recovery link.',
      });
      return;
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    user.reset_password_token = undefined;
    user.reset_password_expires = undefined;
    user.token_version = (user.token_version || 0) + 1;
    await user.save();

    await sendPasswordChangedAlert(user.email, user.name);

    res.json({
      message: 'Your password has been successfully reset! You can now log in with your new password.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
}

/**
 * 8. changePassword
 * ----------------------------------------------------------------------------
 * Authenticated in-app password update:
 * 1. Verifies current password against existing hash.
 * 2. Validates password strength for new password.
 * 3. Hashes new password and increments token_version to invalidate other devices.
 * 4. Issues fresh JWT cookie for the current session so active user is not logged out.
 * 5. Dispatches password changed security alert email.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect current password.' });
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      res.status(400).json({
        error:
          'Password must contain at least 8 characters, including uppercase, lowercase, numbers, and symbols.',
      });
      return;
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    user.token_version = (user.token_version || 0) + 1;
    await user.save();

    // Re-issue cookie for current session with incremented token_version
    const token = jwt.sign(
      { userId: user._id, companyId: req.company?._id, token_version: user.token_version },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    res.cookie('token', token, getCookieOptions());

    await sendPasswordChangedAlert(user.email, user.name);

    res.json({
      message: 'Password updated successfully. Other active device sessions have been revoked.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to change password.' });
  }
}

