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

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
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

    // Reset log state
    log.status = 'queued';
    log.error_message = undefined;
    log.retry_count = (log.retry_count || 0) + 1;
    await log.save();

    // Create fresh queue job
    const newJobId = `resend_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await NotificationJob.create({
      company_id: companyId,
      job_id: newJobId,
      channel: log.channel,
      event_type: log.event_type,
      recipient_name: log.recipient_name,
      recipient_phone: log.recipient_phone,
      recipient_email: log.recipient_email,
      message_preview: log.message_preview,
      template_name: log.template_name,
      template_variables: log.template_variables,
      attempts: 0,
      max_attempts: 5,
      next_run_at: new Date(),
      status: 'pending',
      notification_log_id: log._id,
    });

    // Trigger worker immediately
    setImmediate(() => {
      processPendingNotificationJobs(5).catch((err) => {
        console.error('[Resend Async Trigger Error]:', err.message);
      });
    });

    res.json({
      message: 'Notification re-queued for delivery',
      job_id: newJobId,
      log,
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
