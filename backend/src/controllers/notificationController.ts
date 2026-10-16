/**
 * ============================================================================
 * FLEET FLOW — NOTIFICATION MANAGEMENT CONTROLLER (notificationController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Exposes administrative APIs for:
 * - Querying paginated notification delivery audit logs.
 * - Inspecting real-time channel delivery ratios and KPI metrics.
 * - Triggering manual notification resends on failed or stalled dispatches.
 * - Managing recipient DND opt-outs and channel subscriptions.
 * ============================================================================
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { NotificationLog } from '../models/NotificationLog.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { OptOutRegistry } from '../models/OptOutRegistry.js';
import { normalizeWhatsAppPhone } from '../utils/whatsappClient.js';
import { processPendingNotificationJobs } from '../workers/notificationWorker.js';
import { logAuditEvent } from '../utils/auditService.js';

/**
 * GET /api/notifications/logs
 * Fetches paginated notification delivery audit trail for tenant
 */
export async function getNotificationLogs(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.company?._id;
    if (!companyId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;

    const query: any = { company_id: companyId };

    if (req.query.channel) {
      query.channel = req.query.channel;
    }
    if (req.query.event_type) {
      query.event_type = req.query.event_type;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search).trim(), 'i');
      query.$or = [
        { recipient_name: searchRegex },
        { recipient_phone: searchRegex },
        { recipient_email: searchRegex },
        { message_preview: searchRegex },
        { provider_message_id: searchRegex },
      ];
    }
    if (req.query.from_date || req.query.to_date) {
      query.created_at = {};
      if (req.query.from_date) query.created_at.$gte = new Date(req.query.from_date as string);
      if (req.query.to_date) query.created_at.$lte = new Date(req.query.to_date as string);
    }

    const [logs, total, statusAgg] = await Promise.all([
      NotificationLog.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationLog.countDocuments(query),
      NotificationLog.aggregate([
        { $match: { company_id: new Types.ObjectId(companyId.toString()) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = {
      total: 0,
      delivered: 0,
      sent: 0,
      queued: 0,
      failed: 0,
      skipped: 0,
    };

    for (const item of statusAgg) {
      stats.total += item.count;
      if (item._id === 'delivered' || item._id === 'read') stats.delivered += item.count;
      else if (item._id === 'sent') stats.sent += item.count;
      else if (item._id === 'queued') stats.queued += item.count;
      else if (item._id === 'failed') stats.failed += item.count;
      else if (item._id === 'skipped') stats.skipped += item.count;
    }

    const eligibleCount = stats.total - stats.skipped;
    const deliveredRatio = eligibleCount > 0 ? Math.round((stats.delivered / eligibleCount) * 100) : 0;

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        ...stats,
        pending: stats.sent, // Dispatched to provider gateway awaiting delivery receipt callback
        eligible: eligibleCount,
        delivered_ratio: deliveredRatio,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve notification logs' });
  }
}

/**
 * POST /api/notifications/logs/:id/resend
 * Re-queues a failed or un-delivered notification for delivery
 */
export async function resendNotification(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.company?._id;
    const { id } = req.params;

    const log = await NotificationLog.findOne({ _id: id, company_id: companyId });
    if (!log) {
      res.status(404).json({ error: 'Notification record not found' });
      return;
    }

    // ELIGIBILITY CHECK: Reject resending notifications already confirmed as delivered or read
    if (log.status === 'delivered' || log.status === 'read') {
      res.status(400).json({
        error: `Cannot resend notification already confirmed as ${log.status}. Only failed, queued, or pending notifications can be retried.`,
        code: 'ALREADY_DELIVERED',
      });
      return;
    }

    // CONCURRENCY CHECK: If notification is currently queued/in-flight, prevent duplicate queueing
    if (log.status === 'queued') {
      const activeJob = await NotificationJob.findOne({
        notification_log_id: log._id,
        status: { $in: ['pending', 'processing'] },
      });
      if (activeJob) {
        res.status(409).json({
          error: 'A retry job is already active or in-flight for this notification.',
          code: 'CONCURRENT_RESEND_IN_PROGRESS',
          job_id: activeJob.job_id,
        });
        return;
      }
    }

    const priorStatus = log.status;
    const priorRetryCount = log.retry_count || 0;

    // ATOMIC CLAIM: Compare-and-swap on NotificationLog to prevent race conditions on concurrent resends
    const claimedLog = await NotificationLog.findOneAndUpdate(
      {
        _id: id,
        company_id: companyId,
        status: priorStatus,
      },
      {
        $set: { status: 'queued', error_message: undefined },
        $inc: { retry_count: 1 },
      },
      { new: true }
    );

    if (!claimedLog) {
      res.status(409).json({
        error: 'Concurrent resend in progress. The notification state was modified by another request.',
        code: 'CONCURRENT_RESEND_CONFLICT',
      });
      return;
    }

    // Create fresh queue job
    const newJobId = `resend_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await NotificationJob.create({
      company_id: companyId,
      job_id: newJobId,
      channel: claimedLog.channel,
      event_type: claimedLog.event_type,
      recipient_name: claimedLog.recipient_name,
      recipient_phone: claimedLog.recipient_phone,
      recipient_email: claimedLog.recipient_email,
      message_preview: claimedLog.message_preview,
      template_name: claimedLog.template_name,
      template_variables: claimedLog.template_variables,
      attempts: 0,
      max_attempts: 5,
      next_run_at: new Date(),
      status: 'pending',
      notification_log_id: claimedLog._id,
    });

    // Trigger worker immediately
    setImmediate(() => {
      processPendingNotificationJobs(5).catch((err) => {
        console.error('[Resend Async Trigger Error]:', err.message);
      });
    });

    // Write audited operational log
    await logAuditEvent({
      company_id: companyId,
      entity_type: 'notification',
      entity_id: claimedLog._id,
      entity_identifier: claimedLog.provider_message_id || String(claimedLog._id),
      action: 'UPDATE',
      description: `Manual retry triggered for notification ${claimedLog._id} (${claimedLog.channel} / ${claimedLog.event_type}) to ${claimedLog.recipient_name}`,
      req,
      before_snapshot: { status: priorStatus, retry_count: priorRetryCount },
      after_snapshot: { status: 'queued', retry_count: claimedLog.retry_count, new_job_id: newJobId },
    }).catch((err) => {
      console.warn('[Notification Audit Warning]: Failed to write audit entry for resend:', err.message);
    });

    res.json({
      message: 'Notification re-queued for delivery',
      job_id: newJobId,
      log: claimedLog,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to re-queue notification' });
  }
}

/**
 * GET /api/notifications/opt-outs
 * Fetches DND opt-outs
 */
export async function getOptOuts(req: Request, res: Response): Promise<void> {
  try {
    const optOuts = await OptOutRegistry.find().sort({ created_at: -1 }).limit(100).lean();
    res.json({ optOuts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve opt-out records' });
  }
}

/**
 * POST /api/notifications/opt-outs
 * Manually register or toggle recipient opt-out
 */
export async function toggleOptOut(req: Request, res: Response): Promise<void> {
  try {
    const { phone, email, channel = 'whatsapp', optOut } = req.body;
    const normalizedPhone = phone ? normalizeWhatsAppPhone(phone) : undefined;

    if (!normalizedPhone && !email) {
      res.status(400).json({ error: 'Phone number or email required' });
      return;
    }

    if (optOut === false) {
      // Re-enable messaging
      await OptOutRegistry.findOneAndDelete({
        $or: [
          normalizedPhone ? { phone: normalizedPhone, channel } : {},
          email ? { email: email.toLowerCase(), channel } : {},
        ].filter((c) => Object.keys(c).length > 0),
      });
      res.json({ message: 'Recipient re-subscribed successfully' });
      return;
    }

    // Register opt-out
    await OptOutRegistry.findOneAndUpdate(
      {
        $or: [
          normalizedPhone ? { phone: normalizedPhone, channel } : {},
          email ? { email: email.toLowerCase(), channel } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
      {
        company_id: req.company?._id,
        phone: normalizedPhone,
        email: email ? email.toLowerCase() : undefined,
        channel,
        reason: 'ADMIN_PREFERENCE',
        notes: 'Manually toggled from management portal',
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Recipient opted out (DND active)' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle opt-out state' });
  }
}
