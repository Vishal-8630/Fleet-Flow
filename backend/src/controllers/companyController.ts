/**
 * ============================================================================
 * FLEET FLOW — COMPANY & TEAM CONTROLLER (companyController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Manages the workspace profile, operational formatting settings, and the
 * employee team directory (inviting members, updating roles, deactivating,
 * removing members, and the public invitation onboarding workflow).
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Strict RBAC Enforcement: Only users with the `admin` role can edit company
 *   settings, invite employees, change roles, or deactivate members.
 * - Anti-Lockout Safeguard: The system checks that a company always has at least
 *   one active administrator before allowing role demotions or account deletions.
 * - Idempotent Re-invitations: If an admin invites an email that was previously
 *   invited, the system re-issues a fresh 7-day token instead of throwing a
 *   duplicate key error.
 * ============================================================================
 */

import 'dotenv/config';
import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { validateGSTIN } from '../utils/gstinValidator.js';
import { getTenantEntitlements } from '../utils/entitlementService.js';
import { MOD_CATALOG, ModuleKey, validateModuleDependencies } from '../utils/featureCatalog.js';

/**
 * Returns the JWT signing secret dynamically from process.env to guarantee
 * consistent secret resolution across ES Module evaluation and runtime execution.
 */
const getJwtSecret = (): string => process.env.JWT_SECRET || 'dev_secret_fallback_key';

/**
 * Returns the secure session cookie configuration dynamically.
 */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

/**
 * 1. getCompanyProfile
 * ----------------------------------------------------------------------------
 * Retrieves the current company's legal profile, contact info, and settings.
 * Accessible to any authenticated member of the workspace.
 */
export const getCompanyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    if (!companyId) {
      res.status(400).json({ error: 'Tenant context missing.' });
      return;
    }

    const company = await Company.findById(companyId);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Company workspace not found.' });
      return;
    }

    res.json({ company });
  } catch (error: any) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ error: 'Failed to retrieve company profile.' });
  }
};

/**
 * 2. updateCompanyProfile
 * ----------------------------------------------------------------------------
 * Updates business details, GSTIN, registered office address, and operational
 * numbering formats (LR prefix, Invoice prefix, currency, timezone).
 * Restricted strictly to company administrators.
 */
export const updateCompanyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    const { name, phone, email, gstin, address, settings } = req.body;

    const company = await Company.findById(companyId);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    if (name && name.trim()) company.name = name.trim();
    if (phone && phone.trim()) company.phone = phone.trim();
    if (email && email.trim()) company.email = email.toLowerCase().trim();
    if (gstin !== undefined) {
      if (gstin && gstin.trim()) {
        const cleanGstin = gstin.toUpperCase().trim();
        const gstinVal = validateGSTIN(cleanGstin);
        if (!gstinVal.isValid) {
          res.status(400).json({ error: gstinVal.error });
          return;
        }
        company.gstin = cleanGstin;
      } else {
        company.gstin = undefined;
      }
    }

    if (address) {
      company.address = {
        street: address.street || company.address?.street || '',
        city: address.city || company.address?.city || '',
        state: address.state || company.address?.state || '',
        postal_code: address.postal_code || company.address?.postal_code || '',
        country: address.country || company.address?.country || 'India',
      };
    }

    if (settings) {
      company.settings = {
        currency: settings.currency || company.settings?.currency || 'INR',
        timezone: settings.timezone || company.settings?.timezone || 'Asia/Kolkata',
        lr_prefix: settings.lr_prefix || company.settings?.lr_prefix || 'LR-',
        lr_zero_pad: settings.lr_zero_pad ?? company.settings?.lr_zero_pad ?? 5,
        invoice_prefix: settings.invoice_prefix || company.settings?.invoice_prefix || 'INV-',
        invoice_zero_pad: settings.invoice_zero_pad ?? company.settings?.invoice_zero_pad ?? 5,
        settlement_prefix: settings.settlement_prefix || company.settings?.settlement_prefix || 'SET-',
        settlement_zero_pad: settings.settlement_zero_pad ?? company.settings?.settlement_zero_pad ?? 5,
        date_format: settings.date_format || company.settings?.date_format || 'DD/MM/YYYY',
        number_system: settings.number_system || company.settings?.number_system || 'indian_lakhs',
        expense_categories: settings.expense_categories || company.settings?.expense_categories || [],
        logo_url: settings.logo_url || company.settings?.logo_url,
      };
    }

    await company.save();

    res.json({
      message: 'Company settings updated successfully.',
      company,
    });
  } catch (error: any) {
    console.error('Error updating company profile:', error);
    res.status(500).json({ error: 'Failed to update company settings.' });
  }
};

/**
 * 3. listCompanyMembers
 * ----------------------------------------------------------------------------
 * Lists all active, invited, and deactivated members belonging to the current
 * company workspace, populating their global User accounts.
 */
export const listCompanyMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;

    const members = await CompanyMember.find({ company_id: companyId })
      .populate('user_id', 'name email phone avatar_url is_verified created_at')
      .populate('invited_by', 'name email')
      .sort({ created_at: -1 });

    res.json({ members });
  } catch (error: any) {
    console.error('Error listing members:', error);
    res.status(500).json({ error: 'Failed to list company members.' });
  }
};

/**
 * 4. inviteCompanyMember
 * ----------------------------------------------------------------------------
 * Invites a new team member to the workspace.
 * 
 * Flow:
 * 1. Checks if member already exists. If active, rejects duplicate invitation.
 *    If previously invited, regenerates token and extends expiration.
 * 2. Checks if the invited email already has a User account on Fleet Flow.
 * 3. Creates a new CompanyMember record with status: 'invited' and a secure 32-byte token.
 * 4. Generates an invitation URL for the frontend.
 */
export const inviteCompanyMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    const inviterId = req.user?._id;
    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if membership already exists in this company
    const existingMember = await CompanyMember.findOne({
      company_id: companyId,
      email: normalizedEmail,
    });

    if (existingMember) {
      if (existingMember.status === 'active') {
        res.status(400).json({ error: 'A member with this email is already active in your company.' });
        return;
      }
      // Re-issue invitation
      const inviteToken = crypto.randomBytes(32).toString('hex');
      existingMember.invitation_token = inviteToken;
      existingMember.token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      existingMember.role = role;
      existingMember.status = 'invited';
      existingMember.invited_by = inviterId as any;
      await existingMember.save();

      res.json({
        message: 'Invitation re-issued successfully.',
        member: existingMember,
        invitation_link: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`,
      });
      return;
    }

    // Check if a registered User already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    const inviteToken = crypto.randomBytes(32).toString('hex');

    const newMember = await CompanyMember.create({
      company_id: companyId,
      user_id: existingUser ? existingUser._id : undefined,
      email: normalizedEmail,
      role,
      status: 'invited',
      invitation_token: inviteToken,
      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invited_by: inviterId,
    });

    res.status(201).json({
      message: 'Invitation generated successfully.',
      member: newMember,
      invitation_link: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`,
    });
  } catch (error: any) {
    console.error('Error inviting member:', error);
    res.status(500).json({ error: 'Failed to invite team member.' });
  }
};

/**
 * 5. updateMemberRole
 * ----------------------------------------------------------------------------
 * Updates a member's role (admin, dispatcher, accountant, viewer).
 * 
 * Safety Check:
 * Prevents demoting the last remaining active admin in the company, which would
 * permanently lock out the organization from administration.
 */
export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'dispatcher', 'accountant', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Invalid role provided.' });
      return;
    }

    const member = await CompanyMember.findOne({ _id: id, company_id: companyId });
    if (!member) {
      res.status(404).json({ error: 'Member not found in your company.' });
      return;
    }

    // Safety: ensure at least one admin remains in the company
    if (member.role === 'admin' && role !== 'admin') {
      const adminCount = await CompanyMember.countDocuments({
        company_id: companyId,
        role: 'admin',
        status: 'active',
      });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'Cannot demote the sole company administrator.' });
        return;
      }
    }

    member.role = role;
    await member.save();

    res.json({ message: 'Member role updated successfully.', member });
  } catch (error: any) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
};

/**
 * 6. updateMemberStatus
 * ----------------------------------------------------------------------------
 * Toggles a member between 'active' and 'deactivated'.
 * 
 * Safety Check:
 * Prevents an administrator from deactivating their own account.
 */
export const updateMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    const currentUserId = req.user?._id?.toString();
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'deactivated'].includes(status)) {
      res.status(400).json({ error: 'Invalid status provided.' });
      return;
    }

    const member = await CompanyMember.findOne({ _id: id, company_id: companyId });
    if (!member) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }

    // Safety: prevent deactivating yourself
    if (member.user_id && member.user_id.toString() === currentUserId) {
      res.status(400).json({ error: 'You cannot deactivate your own account.' });
      return;
    }

    member.status = status;
    await member.save();

    res.json({ message: `Member ${status === 'active' ? 'activated' : 'deactivated'} successfully.`, member });
  } catch (error: any) {
    console.error('Error changing member status:', error);
    res.status(500).json({ error: 'Failed to update member status.' });
  }
};

/**
 * 7. removeMember
 * ----------------------------------------------------------------------------
 * Permanently removes a member from the company workspace.
 * 
 * Safety Check:
 * Enforces that you cannot delete yourself or delete the last remaining admin.
 */
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.tenant?.id;
    const currentUserId = req.user?._id?.toString();
    const { id } = req.params;

    const member = await CompanyMember.findOne({ _id: id, company_id: companyId });
    if (!member) {
      res.status(404).json({ error: 'Member record not found.' });
      return;
    }

    if (member.user_id && member.user_id.toString() === currentUserId) {
      res.status(400).json({ error: 'You cannot remove yourself from the company.' });
      return;
    }

    if (member.role === 'admin' && member.status === 'active') {
      const adminCount = await CompanyMember.countDocuments({
        company_id: companyId,
        role: 'admin',
        status: 'active',
      });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'Cannot remove the sole company administrator.' });
        return;
      }
    }

    await CompanyMember.deleteOne({ _id: id, company_id: companyId });

    res.json({ message: 'Team member removed from workspace.' });
  } catch (error: any) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
};

/**
 * 8. verifyInvitationToken (Public)
 * ----------------------------------------------------------------------------
 * Verifies an invitation token before rendering the employee signup form.
 * Returns the company name, invited email, and assigned role if valid.
 */
export const verifyInvitationToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invitation token is required.' });
      return;
    }

    const member = await CompanyMember.findOne({
      invitation_token: token,
      token_expires_at: { $gt: new Date() },
      status: 'invited',
    }).populate('company_id', 'name slug');

    if (!member) {
      res.status(400).json({ error: 'Invalid or expired invitation token.' });
      return;
    }

    const company = member.company_id as any;

    res.json({
      valid: true,
      email: member.email,
      role: member.role,
      company_name: company?.name || 'Fleet Flow Workspace',
    });
  } catch (error: any) {
    console.error('Error verifying invite token:', error);
    res.status(500).json({ error: 'Failed to verify invitation.' });
  }
};

/**
 * 9. acceptInvitation (Public)
 * ----------------------------------------------------------------------------
 * Completes employee onboarding when an invited user submits their password.
 * 
 * Flow:
 * 1. Validates token existence and expiry.
 * 2. Finds or creates the global User account.
 * 3. Marks the CompanyMember status as 'active' and clears the single-use token.
 * 4. Signs an HttpOnly JWT cookie and logs the user in immediately.
 */
export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, name, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required.' });
      return;
    }

    const member = await CompanyMember.findOne({
      invitation_token: token,
      token_expires_at: { $gt: new Date() },
      status: 'invited',
    });

    if (!member) {
      res.status(400).json({ error: 'Invalid or expired invitation token.' });
      return;
    }

    const company = await Company.findById(member.company_id);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Company workspace no longer exists.' });
      return;
    }

    // Check or create User
    let user = await User.findOne({ email: member.email });
    if (!user) {
      if (!name) {
        res.status(400).json({ error: 'Full name is required to complete account registration.' });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      user = await User.create({
        name: name.trim(),
        email: member.email,
        password_hash,
        is_verified: true,
      });
    }

    // Activate membership
    member.user_id = user._id as any;
    member.status = 'active';
    member.invitation_token = undefined;
    member.token_expires_at = undefined;
    await member.save();

    // Issue JWT cookie and response
    const authToken = jwt.sign(
      { userId: user._id, companyId: company._id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.cookie('token', authToken, getCookieOptions());

    res.json({
      message: 'Invitation accepted! Welcome to ' + company.name,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug,
        role: member.role,
        subscription_status: company.subscription_status,
      },
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
};

/**
 * 8. getCompanyModules
 * ----------------------------------------------------------------------------
 * Returns the current company's module configuration:
 * - plan: Subscription plan code and name.
 * - plan_features: Full legal feature ceiling permitted by current plan + add-ons.
 * - enabled_modules: Explicit company preferences (or plan_features if inheriting defaults).
 * - effective_features: Effective access (PlanEntitlements ∩ CompanyEnabledModules).
 * - is_customized: Boolean indicating whether explicit preferences have been saved.
 * - modules: Complete catalog breakdown for frontend display.
 */
export const getCompanyModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const company = req.company || (req.tenant?.id ? await Company.findById(req.tenant.id) : null);
    if (!company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const entitlements = await getTenantEntitlements(company);
    const planFeatures = entitlements.plan_features;
    const effectiveFeatures = entitlements.enabled_features;
    const savedPreferences = company.settings?.enabled_modules;
    const isCustomized = Array.isArray(savedPreferences);

    const allModuleKeys = Object.keys(MOD_CATALOG) as ModuleKey[];
    const moduleList = allModuleKeys.map((key) => {
      const def = MOD_CATALOG[key];
      const isEntitled = planFeatures.includes(key);
      const isEnabled = effectiveFeatures.includes(key);

      return {
        key,
        name: def.name,
        description: def.description,
        category: def.category,
        default_tier: def.defaultTier,
        dependencies: def.dependencies,
        is_entitled: isEntitled,
        is_enabled: isEnabled,
        status: !isEntitled
          ? 'plan_locked'
          : isEnabled
          ? 'enabled'
          : 'disabled_by_company',
      };
    });

    res.json({
      success: true,
      plan: entitlements.plan,
      plan_features: planFeatures,
      enabled_modules: savedPreferences ?? planFeatures,
      effective_features: effectiveFeatures,
      is_customized: isCustomized,
      modules: moduleList,
    });
  } catch (error: any) {
    console.error('Error fetching company modules:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch company module configuration.' });
  }
};

/**
 * 9. updateCompanyModules
 * ----------------------------------------------------------------------------
 * Updates the company's active module preferences.
 * 
 * INVARIANTS & SECURITY:
 * 1. RBAC: Restricted to Company Admin via route middleware requireRole(['admin']).
 * 2. Tenant Scoping: Target company derived strictly from authenticated context.
 * 3. Commercial Ceiling: Rejects any module not included in the company's plan with HTTP 422 UNENTITLED_MODULE.
 * 4. Dependency Validation: Verifies that prerequisite modules are enabled; rejects with HTTP 422 DEPENDENCY_MISSING.
 * 5. Core Module Flexibility: Company Admins may enable or disable ANY entitled module.
 * 6. Audit Trail: Appends immutable AuditLog record before returning success.
 */
export const updateCompanyModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const company = req.company || (req.tenant?.id ? await Company.findById(req.tenant.id) : null);
    if (!company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { enabled_modules } = req.body;

    if (!Array.isArray(enabled_modules)) {
      res.status(400).json({
        code: 'INVALID_REQUEST_BODY',
        error: 'enabled_modules must be an array of module keys.',
      });
      return;
    }

    // Validate that each key exists in the authoritative feature catalog
    for (const key of enabled_modules) {
      if (!MOD_CATALOG[key as ModuleKey]) {
        res.status(400).json({
          code: 'INVALID_MODULE_KEY',
          error: `Invalid module key: "${key}".`,
        });
        return;
      }
    }

    const requestedKeys = enabled_modules as ModuleKey[];

    // Fetch plan entitlements ceiling
    const entitlements = await getTenantEntitlements(company);
    const planFeaturesSet = new Set<ModuleKey>(entitlements.plan_features);

    // Reject attempts to enable modules outside the current plan
    const unentitled = requestedKeys.filter((k) => !planFeaturesSet.has(k));
    if (unentitled.length > 0) {
      const unentitledNames = unentitled.map((k) => MOD_CATALOG[k]?.name || k);
      res.status(422).json({
        code: 'UNENTITLED_MODULE',
        error: `Cannot enable modules not included in your current subscription plan: ${unentitledNames.join(', ')}. Please upgrade your plan.`,
        unentitled_modules: unentitled,
      });
      return;
    }

    // Validate module dependencies
    const depCheck = validateModuleDependencies(requestedKeys);
    if (!depCheck.valid) {
      const missingDetails = depCheck.missing.map((m) => {
        const modName = MOD_CATALOG[m.module]?.name || m.module;
        const reqNames = m.requires.map((r) => MOD_CATALOG[r]?.name || r).join(', ');
        return `"${modName}" requires "${reqNames}" to be enabled.`;
      });

      res.status(422).json({
        code: 'DEPENDENCY_MISSING',
        error: `Module dependency validation failed: ${missingDetails.join(' ')}`,
        details: depCheck.missing,
      });
      return;
    }

    // Capture before snapshot
    const previousPreferences = company.settings?.enabled_modules ?? undefined;

    // Update Company settings
    if (!company.settings) {
      company.settings = {} as any;
    }
    company.settings.enabled_modules = requestedKeys;
    await company.save();

    // Persist immutable audit log with persistence failure rollback
    try {
      await AuditLog.create({
        company_id: company._id,
        entity_type: 'company_settings',
        entity_id: company._id,
        entity_identifier: company.slug || company.name,
        action: 'UPDATE',
        actor_id: req.user?._id,
        actor_name: req.user?.name || req.user?.email || 'Company Administrator',
        actor_role: (req as any).tenantRole || req.member?.role || 'admin',
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1',
        description: 'Updated operational module access preferences',
        before_snapshot: { enabled_modules: previousPreferences },
        after_snapshot: { enabled_modules: requestedKeys },
      });
    } catch (auditError: any) {
      company.settings.enabled_modules = previousPreferences;
      await company.save();
      throw new Error(`Audit log persistence failed: ${auditError.message}`);
    }

    // Re-evaluate effective access
    const updatedEntitlements = await getTenantEntitlements(company);

    res.json({
      success: true,
      message: 'Company module preferences updated successfully.',
      enabled_modules: requestedKeys,
      effective_features: updatedEntitlements.enabled_features,
    });
  } catch (error: any) {
    console.error('Error updating company modules:', error);
    res.status(500).json({ error: error.message || 'Failed to update company module preferences.' });
  }
};
