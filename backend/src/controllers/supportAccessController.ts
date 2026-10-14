/**
 * ============================================================================
 * FLEET FLOW — SUPPORT ACCESS CONTROLLER (supportAccessController.ts)
 * ============================================================================
 * 
 * Implements Batch A (DEC-012 Approved Architecture):
 * 1. Dual-Super-Admin Emergency Break-Glass Access (Max 30m, Read-Only, No Renewal)
 * 2. Synchronous Durable MongoDB Majority-Write Notification Queueing before Token Issuance
 * 3. Fail-Closed Denials if Queue Persistence Fails (HTTP 503 EMERGENCY_NOTIFICATION_FAILED)
 * 4. Atomic Session Activation & Audit Trail Persistence in MongoDB ACID Transactions
 * 5. Out-of-band Verified Customer Lockout Support Ticket Intake
 * 6. Standard Tenant-Admin Support Approval Lifecycle & Immediate Revocation
 * ============================================================================
 */

import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { SupportAccessRequest, ISupportAccessRequest } from '../models/SupportAccessRequest.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { PlatformAuditLog } from '../models/PlatformAuditLog.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { getCookieOptions } from './authController.js';

/**
 * 1. POST /api/super-admin/support-access/request
 * Initiates a standard support access request pending tenant-admin approval.
 */
export async function requestSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { company_id, ticket_id, scope = 'diagnostics_readonly', duration_minutes = 30, justification } = req.body;

    if (!company_id || !ticket_id || !justification?.trim()) {
      res.status(400).json({ error: 'company_id, ticket_id, and justification are required.' });
      return;
    }

    if (!['diagnostics_readonly', 'config_write'].includes(scope)) {
      res.status(400).json({ error: 'scope must be either diagnostics_readonly or config_write.' });
      return;
    }

    const duration = Math.min(Math.max(Number(duration_minutes) || 30, 5), 60);

    const company = await Company.findById(company_id);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
      return;
    }

    const ticket = await SupportTicket.findOne({ _id: ticket_id, company_id });
    if (!ticket) {
      res.status(404).json({ error: 'Support ticket not found or does not belong to the target workspace.' });
      return;
    }

    if (['resolved', 'closed'].includes(ticket.status)) {
      res.status(400).json({ error: 'Cannot request support access against a resolved or closed ticket.' });
      return;
    }

    const accessRequest = await SupportAccessRequest.create({
      company_id: company._id,
      ticket_id: ticket._id,
      requested_by: req.user!._id,
      scope,
      status: 'pending',
      duration_minutes: duration,
      justification: justification.trim(),
      is_emergency: false,
    });

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'support_access_requested',
      target_company_id: company._id,
      target_company_name: company.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        access_request_id: accessRequest._id.toString(),
        ticket_id: ticket._id.toString(),
        ticket_no: ticket.ticket_no,
        scope,
        duration_minutes: duration,
        justification: justification.trim(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Support access request submitted. Awaiting tenant-admin approval.',
      request: accessRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to request support access.' });
  }
}

/**
 * 2. POST /api/support/sessions/:id/approve
 * Tenant workspace administrator approves a pending support access request.
 */
export async function approveSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const companyId = req.tenant?.id;

    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    const accessRequest = await SupportAccessRequest.findOne({ _id: id, company_id: companyId });
    if (!accessRequest) {
      res.status(404).json({ error: 'Support access request not found for this workspace.' });
      return;
    }

    if (accessRequest.status !== 'pending') {
      res.status(400).json({ error: `Cannot approve request with status '${accessRequest.status}'.` });
      return;
    }

    accessRequest.status = 'approved';
    accessRequest.approved_by = req.user!._id;
    accessRequest.approved_at = new Date();
    await accessRequest.save();

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'support_access_approved',
      target_company_id: accessRequest.company_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        access_request_id: accessRequest._id.toString(),
        scope: accessRequest.scope,
        duration_minutes: accessRequest.duration_minutes,
      },
    });

    res.json({
      success: true,
      message: 'Support access request approved.',
      request: accessRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve support access request.' });
  }
}

/**
 * 3. POST /api/support/sessions/:id/reject
 * Tenant workspace administrator rejects a pending support access request.
 */
export async function rejectSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const companyId = req.tenant?.id;
    const { reason } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    const accessRequest = await SupportAccessRequest.findOne({ _id: id, company_id: companyId });
    if (!accessRequest) {
      res.status(404).json({ error: 'Support access request not found for this workspace.' });
      return;
    }

    if (accessRequest.status !== 'pending') {
      res.status(400).json({ error: `Cannot reject request with status '${accessRequest.status}'.` });
      return;
    }

    accessRequest.status = 'rejected';
    accessRequest.revocation_reason = reason || 'Rejected by tenant administrator';
    await accessRequest.save();

    res.json({
      success: true,
      message: 'Support access request rejected.',
      request: accessRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reject support access request.' });
  }
}

/**
 * 4. POST /api/super-admin/support-access/:id/activate
 * Super-Admin activates an approved support access request.
 * Persists session activation atomically with the audit log.
 */
export async function activateSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const accessRequest = await SupportAccessRequest.findById(id);
    if (!accessRequest) {
      res.status(404).json({ error: 'Support access request not found.' });
      return;
    }

    if (accessRequest.status !== 'approved') {
      res.status(400).json({ error: `Cannot activate request with status '${accessRequest.status}'. Must be 'approved'.` });
      return;
    }

    if (accessRequest.is_emergency) {
      res.status(400).json({ error: 'Emergency requests must be activated via the emergency-access endpoint.' });
      return;
    }

    const company = await Company.findById(accessRequest.company_id);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
      return;
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + accessRequest.duration_minutes * 60 * 1000);

    // Persist activation atomically with audit log
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        accessRequest.status = 'active';
        accessRequest.started_at = startedAt;
        accessRequest.expires_at = expiresAt;
        await accessRequest.save({ session: mongoSession });

        await PlatformAuditLog.create(
          [
            {
              actor_user_id: req.user!._id,
              actor_email: req.user!.email,
              action: 'support_access_activated',
              target_company_id: company._id,
              target_company_name: company.name,
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              details: {
                access_request_id: accessRequest._id.toString(),
                scope: accessRequest.scope,
                duration_minutes: accessRequest.duration_minutes,
                started_at: startedAt.toISOString(),
                expires_at: expiresAt.toISOString(),
              },
            },
          ],
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    // Issue constrained support JWT
    const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
    const supportToken = jwt.sign(
      {
        userId: req.user!._id.toString(),
        companyId: company._id.toString(),
        impersonatedCompanyId: company._id.toString(),
        isImpersonation: true,
        supportSessionId: accessRequest._id.toString(),
        supportScope: accessRequest.scope,
        isEmergency: false,
        actorEmail: req.user!.email,
      },
      secret,
      { expiresIn: `${accessRequest.duration_minutes}m` }
    );

    res.cookie('token', supportToken, getCookieOptions());

    res.json({
      success: true,
      message: `Support session activated for ${company.name} (${accessRequest.duration_minutes}m).`,
      token: supportToken,
      session: accessRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to activate support session.' });
  }
}

/**
 * 5. POST /api/super-admin/support-access/emergency-access
 * Dual-Super-Admin Break-Glass Emergency Support Access.
 * 
 * Rules:
 * - Two distinct Super-Admins required (req.user._id !== approver_two_id).
 * - Strictly read-only diagnostics ('diagnostics_readonly').
 * - Maximum 30 minutes, zero renewal.
 * - Synchronously persist NotificationJob with majority write concern BEFORE token issuance.
 * - Fail closed (HTTP 503 EMERGENCY_NOTIFICATION_FAILED) if durable queue persistence fails.
 * - Atomically persist session activation and audit log in MongoDB ACID transaction.
 */
export async function emergencySupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const {
      company_id,
      ticket_id,
      justification,
      approver_two_id,
      duration_minutes = 30,
    } = req.body;

    // 1. Mandatory input validation
    if (!company_id || !ticket_id || !justification?.trim() || !approver_two_id) {
      res.status(400).json({
        error: 'company_id, ticket_id, justification, and approver_two_id are all strictly mandatory for emergency break-glass access.',
      });
      return;
    }

    // 2. Dual-Super-Admin Distinctness Constraint
    if (req.user!._id.toString() === approver_two_id.toString()) {
      res.status(400).json({
        code: 'DUAL_ADMIN_IDENTICAL',
        error: 'Dual-Super-Admin emergency access requires two distinct Super-Administrators. Operator cannot self-approve.',
      });
      return;
    }

    // 3. Verify secondary approver is an active Super-Admin
    const approverTwo = await User.findById(approver_two_id);
    if (!approverTwo || !approverTwo.is_platform_super_admin) {
      res.status(403).json({
        code: 'SECONDARY_APPROVER_INVALID',
        error: 'Secondary approver must be an active Platform Super-Administrator.',
      });
      return;
    }

    // 4. Verify company exists
    const company = await Company.findById(company_id);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
      return;
    }

    // 5. Verify ticket exists and belongs to company
    const ticket = await SupportTicket.findOne({ _id: ticket_id, company_id });
    if (!ticket) {
      res.status(404).json({ error: 'Support ticket not found or does not belong to the target workspace.' });
      return;
    }

    // 6. Hard constraint: Maximum 30 minutes, zero renewal, strictly read-only
    const requestedMinutes = Number(duration_minutes) || 30;
    const finalDuration = Math.min(Math.max(requestedMinutes, 1), 30);
    const scope = 'diagnostics_readonly';

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + finalDuration * 60 * 1000);

    // 7. Policy A2: Synchronous Durable Notification Queueing with Majority Write Concern
    let notificationJob;
    try {
      const jobId = `emg-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      notificationJob = new NotificationJob({
        company_id: company._id,
        job_id: jobId,
        channel: 'email',
        event_type: 'EMERGENCY_ACCESS_GRANTED',
        recipient_name: company.name || 'Workspace Administrator',
        recipient_email: company.email || 'admin@tenant.fleetflow.io',
        message_preview: `CRITICAL ALERT: Emergency Break-Glass support access was activated for workspace ${company.name} by Super-Admins ${req.user!.email} and ${approverTwo.email}. Justification: ${justification.trim()}`,
        template_name: 'EMERGENCY_ACCESS_ALERT',
        template_variables: {
          company_name: company.name,
          super_admin_one: req.user!.email,
          super_admin_two: approverTwo.email,
          ticket_no: ticket.ticket_no,
          justification: justification.trim(),
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          duration_minutes: finalDuration,
        },
        attempts: 0,
        max_attempts: 5,
        next_run_at: new Date(),
        status: 'staged',
      });

      // Synchronously enforce majority write concern before token issuance
      await notificationJob.save({ w: 'majority', j: true });
    } catch (notifError: any) {
      // Policy A2: Fail closed. Deny emergency access if durable queue persistence fails.
      res.status(503).json({
        code: 'EMERGENCY_NOTIFICATION_FAILED',
        error: 'Emergency access denied: Failed to durably queue urgent notification job with majority write concern.',
      });
      return;
    }

    // 8. Atomic Session Activation & Audit Log Persistence in MongoDB Transaction
    const mongoSession = await mongoose.startSession();
    let accessRequest: any;
    try {
      await mongoSession.withTransaction(async () => {
        const [createdRequest] = await SupportAccessRequest.create(
          [
            {
              company_id: company._id,
              ticket_id: ticket._id,
              requested_by: req.user!._id,
              scope,
              status: 'active',
              duration_minutes: finalDuration,
              justification: justification.trim(),
              is_emergency: true,
              emergency_approver_two: approverTwo._id,
              notification_job_id: notificationJob._id,
              approved_by: approverTwo._id,
              approved_at: startedAt,
              started_at: startedAt,
              expires_at: expiresAt,
            },
          ],
          { session: mongoSession }
        );
        accessRequest = createdRequest;

        await PlatformAuditLog.create(
          [
            {
              actor_user_id: req.user!._id,
              actor_email: req.user!.email,
              action: 'emergency_support_activated',
              target_company_id: company._id,
              target_company_name: company.name,
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              details: {
                access_request_id: accessRequest._id.toString(),
                ticket_id: ticket._id.toString(),
                ticket_no: ticket.ticket_no,
                scope,
                duration_minutes: finalDuration,
                justification: justification.trim(),
                approver_one: req.user!.email,
                approver_two: approverTwo.email,
                notification_job_id: notificationJob.job_id,
                started_at: startedAt.toISOString(),
                expires_at: expiresAt.toISOString(),
              },
            },
          ],
          { session: mongoSession }
        );

        // Transactional outbox transition: Release notification job from 'staged' to 'pending'
        // atomically when the activation and audit records commit together.
        await NotificationJob.updateOne(
          { _id: notificationJob._id },
          { $set: { status: 'pending' } },
          { session: mongoSession }
        );
      });
    } catch (txnError: any) {
      // Reliable lifecycle: If activation transaction rolls back, cancel the pre-persisted notification job
      // to avoid phantom notification dispatch claiming an active session was created.
      await NotificationJob.findByIdAndUpdate(
        notificationJob._id,
        {
          status: 'cancelled',
          last_error: `Activation transaction rolled back: ${txnError.message || txnError}`,
        },
        { w: 'majority', j: true }
      ).catch(() => {});

      throw txnError;
    } finally {
      await mongoSession.endSession();
    }

    // 9. Issue strictly constrained 30-minute JWT token
    const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
    const supportToken = jwt.sign(
      {
        userId: req.user!._id.toString(),
        companyId: company._id.toString(),
        impersonatedCompanyId: company._id.toString(),
        isImpersonation: true,
        supportSessionId: accessRequest._id.toString(),
        supportScope: 'diagnostics_readonly',
        isEmergency: true,
        actorEmail: req.user!.email,
      },
      secret,
      { expiresIn: `${finalDuration}m` }
    );

    res.cookie('token', supportToken, getCookieOptions());

    res.json({
      success: true,
      is_emergency: true,
      message: `Emergency break-glass access activated for ${company.name} (strictly read-only, max ${finalDuration}m).`,
      token: supportToken,
      session: accessRequest,
      notification_job_id: notificationJob.job_id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to activate emergency support access.' });
  }
}

/**
 * 6. POST /api/support/sessions/:id/revoke
 * Immediately revokes an active support access session.
 * Can be invoked by tenant admin or super admin.
 */
export async function revokeSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const accessRequest = await SupportAccessRequest.findById(id);
    if (!accessRequest) {
      res.status(404).json({ error: 'Support access request not found.' });
      return;
    }

    // Authorization: Must be either the target company admin OR a super admin
    const isCompanyAdmin =
      req.tenant && req.tenant.id === accessRequest.company_id.toString() && req.tenant.role === 'admin';
    const isSuperAdmin = req.user?.is_platform_super_admin === true;

    if (!isCompanyAdmin && !isSuperAdmin) {
      res.status(403).json({ error: 'Unauthorized to revoke this support access session.' });
      return;
    }

    accessRequest.status = 'revoked';
    accessRequest.revoked_by = req.user!._id;
    accessRequest.revoked_at = new Date();
    accessRequest.revocation_reason = reason?.trim() || 'Revoked by administrator';
    await accessRequest.save();

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'support_access_revoked',
      target_company_id: accessRequest.company_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        access_request_id: accessRequest._id.toString(),
        revoked_by_role: isSuperAdmin ? 'super_admin' : 'company_admin',
        reason: accessRequest.revocation_reason,
      },
    });

    res.json({
      success: true,
      message: 'Support access revoked immediately.',
      session: accessRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to revoke support access.' });
  }
}

/**
 * 7. POST /api/super-admin/support-tickets/lockout-intake
 * Policy D: Permits authenticated Super-Admin to create an internal ticket
 * on behalf of a locked-out customer after documented out-of-band verification.
 */
export async function createLockoutTicket(req: Request, res: Response): Promise<void> {
  try {
    const {
      company_id,
      subject,
      category = 'other',
      priority = 'critical',
      message,
      out_of_band_verification,
    } = req.body;

    if (!company_id || !subject || !message || !out_of_band_verification?.verification_method) {
      res.status(400).json({
        error: 'company_id, subject, message, and out_of_band_verification (verification_method) are required.',
      });
      return;
    }

    const company = await Company.findById(company_id);
    if (!company || company.is_deleted) {
      res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
      return;
    }

    const count = await SupportTicket.countDocuments({}, { skipTenantCheck: true });
    const year = new Date().getFullYear();
    const ticket_no = `TICK-${year}-LOCK-${String(count + 1).padStart(4, '0')}`;

    const mongoSession = await mongoose.startSession();
    let ticket: any;
    try {
      await mongoSession.withTransaction(async () => {
        const [createdTicket] = await SupportTicket.create(
          [
            {
              company_id: company._id,
              ticket_no,
              created_by: req.user!._id,
              subject: subject.trim(),
              category,
              priority,
              status: 'open',
              intake_channel: 'out_of_band_phone_verified',
              out_of_band_verification: {
                verification_method: out_of_band_verification.verification_method.trim(),
                operator_id: req.user!._id,
                verified_at: new Date(),
                contact_phone: out_of_band_verification.contact_phone?.trim(),
                notes: out_of_band_verification.notes?.trim(),
              },
              messages: [
                {
                  sender_id: req.user!._id,
                  sender_name: `Support Operator (${req.user!.email})`,
                  sender_role: 'support',
                  message: `[OUT-OF-BAND LOCKOUT INTAKE] Verified via: ${out_of_band_verification.verification_method}. Details: ${message.trim()}`,
                  sent_at: new Date(),
                },
              ],
            },
          ],
          { session: mongoSession }
        );
        ticket = createdTicket;

        await PlatformAuditLog.create(
          [
            {
              actor_user_id: req.user!._id,
              actor_email: req.user!.email,
              action: 'support_ticket_lockout_created',
              target_company_id: company._id,
              target_company_name: company.name,
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              details: {
                ticket_id: ticket._id.toString(),
                ticket_no: ticket.ticket_no,
                verification_method: out_of_band_verification.verification_method,
                contact_phone: out_of_band_verification.contact_phone,
                notes: out_of_band_verification.notes,
              },
            },
          ],
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    res.status(201).json({
      success: true,
      message: 'Out-of-band lockout support ticket created.',
      ticket,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create lockout ticket.' });
  }
}

/**
 * 8. GET /api/support/sessions
 * Lists support access requests for the authenticated tenant workspace.
 */
export async function listTenantSupportSessions(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.tenant?.id;
    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    const sessions = await SupportAccessRequest.find({ company_id: companyId })
      .sort({ created_at: -1 })
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('ticket_id', 'ticket_no subject')
      .lean();

    res.json({ sessions, total: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list support sessions.' });
  }
}

/**
 * 9. GET /api/super-admin/support-access
 * Lists platform support access requests across all workspaces for Super-Admins.
 */
export async function listPlatformSupportSessions(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await SupportAccessRequest.find({})
      .sort({ created_at: -1 })
      .populate('company_id', 'name slug')
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('ticket_id', 'ticket_no subject')
      .limit(100)
      .lean();

    res.json({ sessions, total: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list platform support sessions.' });
  }
}

/**
 * 10. GET /api/support/sessions/:id
 * Fetches details of a specific support access request.
 */
export async function getSupportSessionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const session = await SupportAccessRequest.findById(id)
      .populate('company_id', 'name slug')
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('ticket_id', 'ticket_no subject status')
      .lean();

    if (!session) {
      res.status(404).json({ error: 'Support session record not found.' });
      return;
    }

    // Tenant authorization check (if called from tenant context)
    if (req.tenant && req.tenant.id !== (session.company_id as any)?._id?.toString() && req.tenant.id !== session.company_id?.toString()) {
      res.status(403).json({ error: 'Unauthorized to view support session for another workspace.' });
      return;
    }

    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch support session.' });
  }
}
