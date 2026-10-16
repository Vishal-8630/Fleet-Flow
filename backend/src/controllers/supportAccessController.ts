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
import { PlatformSecurityAlert } from '../models/PlatformSecurityAlert.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { getCookieOptions } from './authController.js';

/**
 * 1. POST /api/super-admin/support-access/request
 * Initiates a standard support access request pending tenant-admin approval.
 */
export async function requestSupportAccess(req: Request, res: Response): Promise<void> {
  try {
    const { company_id, ticket_id, scope = 'diagnostics_readonly', duration_minutes = 30, justification } = req.body;

    if (!company_id || !justification?.trim()) {
      res.status(400).json({ error: 'company_id and justification are required.' });
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

    let ticket: any;
    if (ticket_id) {
      ticket = await SupportTicket.findOne({ _id: ticket_id, company_id });
      if (!ticket) {
        res.status(404).json({ error: 'Support ticket not found or does not belong to the target workspace.' });
        return;
      }

      if (['resolved', 'closed'].includes(ticket.status)) {
        res.status(400).json({ error: 'Cannot request support access against a resolved or closed ticket.' });
        return;
      }
    } else {
      ticket = await SupportTicket.findOne({
        company_id,
        status: { $in: ['open', 'in_progress', 'pending_customer'] },
      }).sort({ created_at: -1 });

      if (!ticket) {
        const count = await SupportTicket.countDocuments({}, { skipTenantCheck: true } as any);
        const year = new Date().getFullYear();
        const ticket_no = `TICK-${year}-ADM-${String(count + 1).padStart(4, '0')}`;
        ticket = await SupportTicket.create({
          company_id: company._id,
          ticket_no,
          created_by: req.user!._id,
          subject: `Admin Support Request: ${justification.trim().substring(0, 60)}`,
          category: 'other',
          priority: 'high',
          status: 'open',
          intake_channel: 'platform_super_admin',
          messages: [
            {
              sender_id: req.user!._id,
              sender_name: req.user!.name || req.user!.email,
              sender_role: 'super_admin',
              message: justification.trim(),
              sent_at: new Date(),
            },
          ],
        });
      }
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

    // Dispatch notification to workspace administrator outbox
    const notifJobId = `supp-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await NotificationJob.create({
      company_id: company._id,
      job_id: notifJobId,
      channel: 'email',
      event_type: 'SUPPORT_ACCESS_REQUESTED',
      recipient_name: company.name || 'Workspace Administrator',
      recipient_email: company.email || 'admin@tenant.fleetflow.io',
      message_preview: `Support Access Requested: Super-Admin ${req.user!.email} has requested ${scope} access (${duration} mins) to workspace ${company.name}. Justification: ${justification.trim()}`,
      status: 'pending',
      next_run_at: new Date(),
    }).catch((notifErr) => {
      console.warn('[Support access notification outbox warning]:', notifErr.message);
    });

    res.status(201).json({
      success: true,
      message: `Support access request sent to ${company.name} administrator. Awaiting tenant-admin approval.`,
      request: accessRequest,
      ticket_no: ticket.ticket_no,
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

    const company = await Company.findById(companyId);

    PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'support_access_rejected',
      target_company_id: accessRequest.company_id,
      target_company_name: company?.name || 'Workspace',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details: {
        access_request_id: accessRequest._id.toString(),
        reason: accessRequest.revocation_reason,
        scope: accessRequest.scope,
        duration_minutes: accessRequest.duration_minutes,
        requested_by: accessRequest.requested_by,
      },
    }).catch((err) => console.warn('[PlatformAuditLog error]:', err.message));

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
 * Single Super-Admin Break-Glass Emergency Support Access (Approved DEC-012 Policy).
 * 
 * Rules:
 * - Single Platform Super-Admin break-glass activation (no second admin required).
 * - Meaningful incident justification of >= 20 characters strictly mandatory.
 * - Maximum 15 minutes session duration, zero renewal, strictly read-only diagnostics.
 * - Pre-activation stale/malformed session sweep with majority write concern.
 * - Synchronously persist NotificationJob ('staged') with majority write concern BEFORE token issuance.
 * - Fail closed (HTTP 503 EMERGENCY_NOTIFICATION_FAILED) if durable queue persistence fails.
 * - Atomic session activation, PlatformAuditLog, and rolling 24h PlatformSecurityAlert in MongoDB transaction.
 * - Traps E11000 duplicate-key conflicts, terminates aborted session, sweeps stale records on clean context,
 *   re-validates single-active invariant, and retries once on a valid fresh transaction.
 * - Compensatory revocation on post-commit token issuance or response transmission drop.
 */
export async function emergencySupportAccess(req: Request, res: Response): Promise<void> {
  // 1. Super-Admin Authorization Check
  if (req.user?.is_platform_super_admin !== true) {
    res.status(403).json({
      code: 'SUPER_ADMIN_REQUIRED',
      error: 'Only Platform Super-Administrators may activate emergency break-glass access.',
    });
    return;
  }

  const {
    company_id,
    ticket_id,
    justification,
    duration_minutes = 15,
  } = req.body;

  // 2. Mandatory Input Validation
  if (!company_id || !ticket_id || !justification) {
    res.status(400).json({
      code: 'INVALID_JUSTIFICATION',
      error: 'company_id, ticket_id, and justification are strictly mandatory for emergency break-glass access.',
    });
    return;
  }

  const trimmedJustification = String(justification).trim();
  if (!trimmedJustification) {
    res.status(400).json({
      code: 'INVALID_JUSTIFICATION',
      error: 'Emergency justification cannot be empty or whitespace only.',
    });
    return;
  }

  if (trimmedJustification.length < 20) {
    res.status(400).json({
      code: 'JUSTIFICATION_TOO_SHORT',
      error: 'Emergency justification must be at least 20 characters in length.',
    });
    return;
  }

  // 3. Verify Target Company Exists and is Active
  const company = await Company.findById(company_id);
  if (!company || company.is_deleted) {
    res.status(404).json({ error: 'Target workspace not found or decommissioned.' });
    return;
  }

  // 4. Verify Support Ticket Exists and Belongs to Company
  const ticket = await SupportTicket.findOne({ _id: ticket_id, company_id });
  if (!ticket) {
    res.status(404).json({
      code: 'TICKET_NOT_FOUND',
      error: 'Support ticket not found or does not belong to the target workspace.',
    });
    return;
  }

  if (['resolved', 'closed'].includes(ticket.status)) {
    res.status(400).json({
      code: 'TICKET_INACTIVE',
      error: 'Cannot activate emergency access against a resolved or closed ticket.',
    });
    return;
  }

  // 5. Hard Duration Constraint: Max 15 Minutes, Read-Only Diagnostics
  const requestedMinutes = Number(duration_minutes) || 15;
  const finalDuration = Math.min(Math.max(requestedMinutes, 1), 15);
  const scope = 'diagnostics_readonly';

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + finalDuration * 60 * 1000);

  // 6. Pre-Activation Stale Session Sweep (freeing partial unique index slot)
  try {
    await SupportAccessRequest.updateMany(
      {
        company_id: company._id,
        status: 'active',
        is_emergency: true,
        $or: [
          { expires_at: { $lte: new Date() } },
          { expires_at: { $exists: false } },
          { expires_at: null },
        ],
      },
      {
        $set: {
          status: 'expired',
          expired_at: new Date(),
          auto_expired_by_sweep: true,
        },
      },
      { writeConcern: { w: 'majority', j: true } } as any
    );
  } catch (sweepErr: any) {
    console.warn('[Pre-activation stale session sweep warning]:', sweepErr.message);
  }

  // 7. Phase 2: Synchronous Durable Notification Staging with Majority Write Concern
  let notificationJob: any;
  try {
    const jobId = `emg-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    notificationJob = new NotificationJob({
      company_id: company._id,
      job_id: jobId,
      channel: 'email',
      event_type: 'EMERGENCY_ACCESS_GRANTED',
      recipient_name: company.name || 'Workspace Administrator',
      recipient_email: company.email || 'admin@tenant.fleetflow.io',
      message_preview: `CRITICAL ALERT: Emergency Break-Glass support access was activated for workspace ${company.name} by Super-Admin ${req.user!.email}. Justification: ${trimmedJustification}`,
      template_name: 'EMERGENCY_ACCESS_ALERT',
      template_variables: {
        company_name: company.name,
        super_admin_one: req.user!.email,
        ticket_no: ticket.ticket_no,
        justification: trimmedJustification,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        duration_minutes: finalDuration,
      },
      attempts: 0,
      max_attempts: 5,
      next_run_at: new Date(),
      status: 'staged',
    });

    await notificationJob.save({ w: 'majority', j: true });
  } catch (notifError: any) {
    res.status(503).json({
      code: 'EMERGENCY_NOTIFICATION_FAILED',
      error: 'Emergency access denied: Failed to durably queue urgent notification job with majority write concern.',
    });
    return;
  }

  // Helper function to execute activation transaction sequence
  const executeActivationSequence = async (session: mongoose.ClientSession): Promise<any> => {
    // Re-verify single active session invariant inside transaction
    const existingActive = await SupportAccessRequest.findOne({
      company_id: company._id,
      status: 'active',
      is_emergency: true,
      expires_at: { $gt: new Date() },
    }).session(session);

    if (existingActive) {
      const err: any = new Error('An active emergency session already exists for this workspace.');
      err.code = 'EMERGENCY_SESSION_ALREADY_ACTIVE';
      err.statusCode = 409;
      throw err;
    }

    const [createdRequest] = await SupportAccessRequest.create(
      [
        {
          company_id: company._id,
          ticket_id: ticket._id,
          requested_by: req.user!._id,
          approved_by: req.user!._id,
          scope,
          status: 'active',
          duration_minutes: finalDuration,
          justification: trimmedJustification,
          is_emergency: true,
          is_single_admin_emergency: true,
          notification_job_id: notificationJob._id,
          approved_at: startedAt,
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      { session }
    );

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
            access_request_id: createdRequest._id.toString(),
            ticket_id: ticket._id.toString(),
            ticket_no: ticket.ticket_no,
            scope,
            duration_minutes: finalDuration,
            justification: trimmedJustification,
            approver_one: req.user!.email,
            is_single_admin_emergency: true,
            notification_job_id: notificationJob.job_id,
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          },
        },
      ],
      { session }
    );

    // Evaluate 24-hour rolling window for high-frequency alerts
    const rolling24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const emergencyCount = await SupportAccessRequest.countDocuments({
      company_id: company._id,
      is_emergency: true,
      started_at: { $gte: rolling24hAgo },
    }).session(session);

    if (emergencyCount >= 2) {
      await PlatformAuditLog.create(
        [
          {
            actor_user_id: req.user!._id,
            actor_email: req.user!.email,
            action: 'emergency_access_high_frequency_alert',
            target_company_id: company._id,
            target_company_name: company.name,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            details: {
              emergency_sessions_count_24h: emergencyCount,
              trigger_session_id: createdRequest._id.toString(),
              timestamp: new Date().toISOString(),
            },
          },
        ],
        { session }
      );

      // Upsert PlatformSecurityAlert idempotently using unique alert_key and $addToSet
      try {
        const alertKey = `emg-alert-${company._id}`;
        await PlatformSecurityAlert.findOneAndUpdate(
          { alert_key: alertKey },
          {
            $setOnInsert: {
              alert_type: 'emergency_access_high_frequency_alert',
              company_id: company._id,
              trigger_session_id: createdRequest._id,
              first_triggered_at: new Date(),
              suppress_external_alerts_until: new Date(Date.now() + 60 * 60 * 1000),
              status: 'pending_dispatch',
            },
            $addToSet: { associated_session_ids: createdRequest._id },
            $set: { last_session_at: new Date() },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, session }
        );
      } catch (alertErr: any) {
        // Fallback audit event if primary alert persistence degrades
        try {
          await PlatformAuditLog.create(
            [
              {
                actor_user_id: req.user!._id,
                actor_email: req.user!.email,
                action: 'security_alert_persistence_failed',
                target_company_id: company._id,
                target_company_name: company.name,
                details: { error: alertErr.message },
              },
            ],
            { session }
          );
        } catch (fallbackErr: any) {
          console.error(JSON.stringify({
            event: 'SECURITY_ALERT_PERSISTENCE_TOTAL_FAILURE',
            level: 'CRITICAL',
            company_id: company._id,
            session_id: createdRequest._id,
            error: alertErr.message,
          }));
        }
      }
    }

    // Release staged notification job to pending and link session ID
    await NotificationJob.updateOne(
      { _id: notificationJob._id },
      { $set: { status: 'pending', session_id: createdRequest._id } },
      { session }
    );

    return createdRequest;
  };

  // 8. Phase 3: Execute Activation Transaction with E11000 Conflict & Stale Sweep Retry Handling
  let accessRequest: any;
  let mongoSession = await mongoose.startSession();
  try {
    mongoSession.startTransaction();
    accessRequest = await executeActivationSequence(mongoSession);
    await mongoSession.commitTransaction();
  } catch (txnError: any) {
    await mongoSession.abortTransaction().catch(() => {});
    await mongoSession.endSession().catch(() => {});

    if (txnError.code === 'EMERGENCY_SESSION_ALREADY_ACTIVE' || txnError.statusCode === 409) {
      await NotificationJob.updateOne(
        { _id: notificationJob._id, status: 'staged' },
        { $set: { status: 'cancelled', last_error: 'Active emergency session already exists.' } },
        { writeConcern: { w: 'majority', j: true } } as any
      ).catch(() => {});

      res.status(409).json({
        code: 'EMERGENCY_SESSION_ALREADY_ACTIVE',
        error: 'An active emergency support session is already running for this workspace.',
      });
      return;
    }

    // Trapped Duplicate-Key Error (E11000) on partial unique index
    const isDuplicateKey = txnError.code === 11000 || String(txnError.message).includes('E11000');
    if (isDuplicateKey) {
      // Inspect conflicting record on clean connection outside the aborted transaction
      const conflicting = await SupportAccessRequest.findOne({
        company_id: company._id,
        status: 'active',
        is_emergency: true,
      });

      if (conflicting && conflicting.expires_at && conflicting.expires_at > new Date()) {
        // Genuine active unexpired session running
        await NotificationJob.updateOne(
          { _id: notificationJob._id, status: 'staged' },
          { $set: { status: 'cancelled', last_error: 'Conflicting active emergency session exists.' } },
          { writeConcern: { w: 'majority', j: true } } as any
        ).catch(() => {});

        res.status(409).json({
          code: 'EMERGENCY_SESSION_ALREADY_ACTIVE',
          error: 'An active emergency support session is already running for this workspace.',
        });
        return;
      }

      // Sweep stale / malformed record on fresh context with majority write concern
      await SupportAccessRequest.updateMany(
        {
          company_id: company._id,
          status: 'active',
          is_emergency: true,
          $or: [
            { expires_at: { $lte: new Date() } },
            { expires_at: { $exists: false } },
            { expires_at: null },
          ],
        },
        {
          $set: {
            status: 'expired',
            expired_at: new Date(),
            auto_expired_by_sweep: true,
          },
        },
        { writeConcern: { w: 'majority', j: true } } as any
      );

      // Start fresh transaction session for retry (bounded to 1 retry)
      const retrySession = await mongoose.startSession();
      try {
        retrySession.startTransaction();
        accessRequest = await executeActivationSequence(retrySession);
        await retrySession.commitTransaction();
      } catch (retryErr: any) {
        await retrySession.abortTransaction().catch(() => {});
        await retrySession.endSession().catch(() => {});

        await NotificationJob.updateOne(
          { _id: notificationJob._id, status: 'staged' },
          { $set: { status: 'cancelled', last_error: `Retry failed: ${retryErr.message}` } },
          { writeConcern: { w: 'majority', j: true } } as any
        ).catch(() => {});

        if (retryErr.code === 11000 || String(retryErr.message).includes('E11000') || retryErr.statusCode === 409) {
          res.status(409).json({
            code: 'EMERGENCY_SESSION_ALREADY_ACTIVE',
            error: 'An active emergency support session is already running for this workspace.',
          });
          return;
        }
        res.status(500).json({ error: retryErr.message || 'Failed to activate emergency support access on retry.' });
        return;
      } finally {
        await retrySession.endSession().catch(() => {});
      }
    } else {
      // Check for unknown commit outcome (socket drop / network error during commitTransaction)
      const isCommitError = txnError.name === 'MongoNetworkError' || String(txnError.message).includes('commit');
      if (isCommitError) {
        await NotificationJob.updateOne(
          { _id: notificationJob._id },
          {
            $set: {
              status: 'staged_unconfirmed',
              first_unconfirmed_at: new Date(),
              reconciliation_attempts: 0,
              last_error: txnError.message,
            },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        ).catch(() => {});

        res.status(503).json({
          code: 'ACTIVATION_COMMIT_UNKNOWN',
          error: 'Transaction commit outcome is unconfirmed. Emergency session status is under reconciliation.',
        });
        return;
      }

      // Confirmed Abort: Cancel pre-saved staged notification job
      await NotificationJob.updateOne(
        { _id: notificationJob._id, status: 'staged' },
        {
          $set: {
            status: 'cancelled',
            last_error: `Activation transaction rolled back: ${txnError.message || txnError}`,
          },
        },
        { writeConcern: { w: 'majority', j: true } } as any
      ).catch((cleanErr) => {
        console.error('[CRITICAL] Notification outbox cancellation failed:', cleanErr);
        PlatformAuditLog.create({
          actor_user_id: req.user!._id,
          actor_email: req.user!.email,
          action: 'notification_outbox_cleanup_failed',
          target_company_id: company._id,
          details: { notification_job_id: notificationJob._id, error: cleanErr.message },
        }).catch(() => {});
      });

      res.status(500).json({ error: txnError.message || 'Failed to activate emergency support access.' });
      return;
    }
  } finally {
    await mongoSession.endSession().catch(() => {});
  }

  // 9. Phase 4: Token Issuance & Post-Commit Compensation Recovery
  try {
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
  } catch (tokenErr: any) {
    // Treat as uncertain credential state (presumed inaccessible)
    await SupportAccessRequest.updateOne(
      { _id: accessRequest._id, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revocation_reason: 'credential_delivery_uncertain',
          revoked_at: new Date(),
          revoked_by: req.user!._id,
        },
      },
      { writeConcern: { w: 'majority', j: true } } as any
    ).catch((err) => {
      console.error('[CRITICAL] Post-commit compensatory revocation failed:', err);
      PlatformAuditLog.create({
        actor_user_id: req.user!._id,
        actor_email: req.user!.email,
        action: 'post_commit_compensation_failed',
        target_company_id: company._id,
        details: { session_id: accessRequest._id, error: err.message },
      }).catch(() => {});
    });

    // Conditional outbox state update
    const jobUpdate = await NotificationJob.findOneAndUpdate(
      { _id: notificationJob._id, status: 'pending' },
      { $set: { status: 'cancelled', last_error: 'Revoked: credential delivery uncertain' } }
    );

    if (!jobUpdate) {
      await NotificationJob.updateOne(
        { _id: notificationJob._id, status: 'processing' },
        { $set: { status: 'compensation_requested', compensation_requested_at: new Date() } }
      ).catch(() => {});
    }

    await PlatformAuditLog.create({
      actor_user_id: req.user!._id,
      actor_email: req.user!.email,
      action: 'emergency_activation_aborted_post_commit',
      target_company_id: company._id,
      details: { session_id: accessRequest._id, error: tokenErr.message },
    }).catch(() => {});

    res.status(500).json({
      code: 'CREDENTIAL_DELIVERY_FAILED',
      error: 'Emergency session activation failed during credential issuance. Session defensively revoked.',
    });
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
 * Sweeps all active support sessions whose expiration timestamp has passed,
 * atomically transitioning them to 'expired' and recording expired_at.
 */
export async function sweepExpiredSupportSessions(): Promise<number> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let expiredCount = 0;

    // 1. Stale Active Sessions (past expires_at)
    const staleActiveSessions = await SupportAccessRequest.find({
      status: 'active',
      $or: [
        { expires_at: { $lte: now } },
        { expires_at: { $exists: false } },
        { expires_at: null },
      ],
    });

    for (const session of staleActiveSessions) {
      session.status = 'expired';
      session.expired_at = now;
      session.auto_expired_by_sweep = true;
      await session.save();

      PlatformAuditLog.create({
        actor_user_id: session.requested_by,
        actor_email: 'system@platform.fleetflow.io',
        action: 'support_access_expired',
        target_company_id: session.company_id,
        details: {
          access_request_id: session._id.toString(),
          expires_at: session.expires_at,
          reason: 'Session duration expired',
          auto_expired_by_sweep: true,
        },
      }).catch(() => {});
      expiredCount++;
    }

    // 2. Stale Approved Sessions that were never activated within 24 hours
    const staleApprovedSessions = await SupportAccessRequest.find({
      status: 'approved',
      $or: [
        { approved_at: { $lte: twentyFourHoursAgo } },
        { created_at: { $lte: twentyFourHoursAgo } },
      ],
    });

    for (const session of staleApprovedSessions) {
      session.status = 'expired';
      session.expired_at = now;
      session.auto_expired_by_sweep = true;
      session.revocation_reason = 'Approval window expired (unactivated within 24h)';
      await session.save();

      PlatformAuditLog.create({
        actor_user_id: session.requested_by,
        actor_email: 'system@platform.fleetflow.io',
        action: 'support_access_expired',
        target_company_id: session.company_id,
        details: {
          access_request_id: session._id.toString(),
          reason: 'Approval window expired (unactivated within 24h)',
          auto_expired_by_sweep: true,
        },
      }).catch(() => {});
      expiredCount++;
    }

    // 3. Stale Pending Requests older than 48 hours
    const stalePendingSessions = await SupportAccessRequest.find({
      status: 'pending',
      created_at: { $lte: fortyEightHoursAgo },
    });

    for (const session of stalePendingSessions) {
      session.status = 'expired';
      session.expired_at = now;
      session.auto_expired_by_sweep = true;
      session.revocation_reason = 'Request expired without approval after 48h';
      await session.save();
      expiredCount++;
    }

    return expiredCount;
  } catch (err: any) {
    console.warn('[sweepExpiredSupportSessions error]:', err.message);
    return 0;
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

    // Automatically sweep expired active sessions before listing
    await sweepExpiredSupportSessions();

    const sessions = await SupportAccessRequest.find({ company_id: companyId })
      .sort({ created_at: -1 })
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate({
        path: 'ticket_id',
        select: 'ticket_no subject',
        options: { skipTenantCheck: true },
      })
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
    // Automatically sweep expired active sessions before listing
    await sweepExpiredSupportSessions();

    const filter: any = {};
    if (req.query.company_id) {
      filter.company_id = req.query.company_id;
    }
    const sessions = await SupportAccessRequest.find(filter)
      .sort({ created_at: -1 })
      .populate('company_id', 'name slug')
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate({
        path: 'ticket_id',
        select: 'ticket_no subject',
        options: { skipTenantCheck: true },
      })
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
    await sweepExpiredSupportSessions();
    const { id } = req.params;
    const session = await SupportAccessRequest.findById(id)
      .populate('company_id', 'name slug')
      .populate('requested_by', 'name email')
      .populate('approved_by', 'name email')
      .populate({
        path: 'ticket_id',
        select: 'ticket_no subject status',
        options: { skipTenantCheck: true },
      })
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
