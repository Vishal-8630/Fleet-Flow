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

import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_fallback_key';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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

    if (name) company.name = name.trim();
    if (phone) company.phone = phone.trim();
    if (email) company.email = email.toLowerCase().trim();
    if (gstin !== undefined) company.gstin = gstin ? gstin.toUpperCase().trim() : undefined;

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
        invoice_prefix: settings.invoice_prefix || company.settings?.invoice_prefix || 'INV-',
        date_format: settings.date_format || company.settings?.date_format || 'DD/MM/YYYY',
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
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', authToken, COOKIE_OPTIONS);

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
