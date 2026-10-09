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

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_fallback_key';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days session lifetime
};

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
  try {
    const { companyName, slug, name, email, password, phone, gstin } = req.body;

    if (!companyName || !name || !email || !password || !phone) {
      res.status(400).json({ error: 'All mandatory fields (Company Name, Your Name, Email, Password, Phone) are required.' });
      return;
    }

    // Check if user email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Auto-generate slug if not provided
    const cleanSlug = (slug || companyName).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
    const existingCompany = await Company.findOne({ slug: cleanSlug });
    if (existingCompany) {
      res.status(400).json({ error: 'This company workspace identifier (slug) is already taken. Please choose another.' });
      return;
    }

    // 1. Hash password with bcrypt cost factor 12
    const password_hash = await bcrypt.hash(password, 12);

    // 2. Create User account
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      phone: phone.trim(),
    });

    // 3. Create Company Workspace with 14-day free trial
    const company = await Company.create({
      name: companyName.trim(),
      slug: cleanSlug,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      gstin: gstin ? gstin.toUpperCase().trim() : undefined,
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    // 4. Create Company Member (Admin Role)
    await CompanyMember.create({
      company_id: company._id,
      user_id: user._id,
      email: user.email,
      role: 'admin',
      status: 'active',
    });

    // 5. Issue JWT session cookie
    const token = jwt.sign({ userId: user._id, companyId: company._id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Company workspace successfully registered!',
      user: { id: user._id, name: user.name, email: user.email },
      company: { id: company._id, name: company.name, slug: company.slug, status: company.subscription_status },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Registration failed.' });
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
    const token = jwt.sign({ userId: user._id, companyId: company._id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Login successful.',
      user: { id: user._id, name: user.name, email: user.email },
      company: { id: company._id, name: company.name, slug: company.slug, status: company.subscription_status },
      role: membership.role,
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
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out successfully.' });
}

/**
 * 4. getMe
 * ----------------------------------------------------------------------------
 * Session hydration endpoint invoked by the frontend upon page load or app boot.
 * Returns the current authenticated user's profile, active company settings,
 * subscription status, and role.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
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
    },
    role: req.member?.role,
  });
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

    res.status(201).json({
      message: 'Employee invitation created successfully.',
      member: { id: member._id, email: member.email, role: member.role, invitation_token: token },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Invitation failed.' });
  }
}
