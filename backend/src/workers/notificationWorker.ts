/**
 * ============================================================================
 * FLEET FLOW — ASYNCHRONOUS NOTIFICATION WORKER (notificationWorker.ts)
 * ============================================================================
 * 
 * WHAT IS THIS WORKER?
 * --------------------
 * High-reliability background queue runner that processes pending notification
 * jobs, executes provider dispatches, enforces recipient opt-out guards,
 * and handles exponential backoff retries with Dead-Letter Queue (DLQ) support.
 * ============================================================================
 */

import { NotificationJob, INotificationJob } from '../models/NotificationJob.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { OptOutRegistry } from '../models/OptOutRegistry.js';
import { sendWhatsAppTemplate, normalizeWhatsAppPhone } from '../utils/whatsappClient.js';
import { sendEmail } from '../utils/emailService.js';

let workerIntervalId: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * Checks whether a phone or email has opted out of notifications on a specific channel
 */
export async function isRecipientOptedOut(phoneOrEmail?: string, channel = 'whatsapp'): Promise<boolean> {
  if (!phoneOrEmail) return false;

  const normalized = normalizeWhatsAppPhone(phoneOrEmail);
  const optOut = await OptOutRegistry.findOne({
    $or: [
      { phone: normalized, channel },
      { phone: phoneOrEmail, channel },
      { email: phoneOrEmail.toLowerCase(), channel },
    ],
  }).lean();

  return Boolean(optOut);
}

/**
 * Calculates exponential backoff delay in seconds based on attempt number
 * Attempt 1 -> 60s (1m)
 * Attempt 2 -> 300s (5m)
 * Attempt 3 -> 900s (15m)
 * Attempt 4 -> 3600s (1h)
 */
export function calculateBackoffSeconds(attempt: number): number {
  switch (attempt) {
    case 1:
      return 60; // 1 minute
    case 2:
      return 300; // 5 minutes
    case 3:
      return 900; // 15 minutes
    case 4:
      return 3600; // 1 hour
    default:
      return 7200; // 2 hours
  }
}

/**
 * Processes a single notification job from the queue
 */
export async function processNotificationJob(job: INotificationJob): Promise<{ success: boolean; status: string }> {
  try {
    // 1. Opt-out preference check
    const recipientKey = job.recipient_phone || job.recipient_email;
    const isOptedOut = await isRecipientOptedOut(recipientKey, job.channel);

    if (isOptedOut) {
      job.status = 'skipped';
      job.last_error = 'Recipient has opted out of automated notifications (DND)';
      await job.save();

      if (job.notification_log_id) {
        await NotificationLog.findByIdAndUpdate(job.notification_log_id, {
          status: 'skipped',
          error_message: job.last_error,
        });
      }
      return { success: true, status: 'skipped' };
    }

    // 2. Dispatch based on channel
    let dispatchResult: { success: boolean; messageId: string; error?: string };

    if (job.channel === 'whatsapp') {
      dispatchResult = await sendWhatsAppTemplate({
        to: job.recipient_phone || '',
        templateName: job.template_name || 'lr_booking_confirmation',
        parameters: job.template_variables,
      });
    } else if (job.channel === 'email') {
      try {
        await sendEmail({
          to: job.recipient_email || '',
          subject: job.message_preview.substring(0, 50),
          html: `<p>${job.message_preview}</p>`,
          text: job.message_preview,
        });
        dispatchResult = { success: true, messageId: `email_${Date.now()}` };
      } catch (err: any) {
        dispatchResult = { success: false, messageId: '', error: err.message };
      }
    } else {
      dispatchResult = { success: false, messageId: '', error: `Unsupported channel: ${job.channel}` };
    }

    // 3. Handle Result
    if (dispatchResult.success) {
      job.status = 'delivered';
      job.provider_message_id = dispatchResult.messageId;
      job.attempts += 1;
      await job.save();

      if (job.notification_log_id) {
        await NotificationLog.findByIdAndUpdate(job.notification_log_id, {
          status: 'sent',
          provider_message_id: dispatchResult.messageId,
          retry_count: job.attempts,
          delivered_at: new Date(),
        });
      }
      return { success: true, status: 'delivered' };
    }

    // 4. Handle Failure & Exponential Backoff
    job.attempts += 1;
    job.last_error = dispatchResult.error || 'Provider dispatch failed';

    if (job.attempts >= job.max_attempts) {
      job.status = 'dead_letter';
      await job.save();

      if (job.notification_log_id) {
        await NotificationLog.findByIdAndUpdate(job.notification_log_id, {
          status: 'failed',
          retry_count: job.attempts,
          error_message: job.last_error,
        });
      }
      return { success: false, status: 'dead_letter' };
    }

    const backoffSeconds = calculateBackoffSeconds(job.attempts);
    job.next_run_at = new Date(Date.now() + backoffSeconds * 1000);
    job.status = 'pending';
    await job.save();

    if (job.notification_log_id) {
      await NotificationLog.findByIdAndUpdate(job.notification_log_id, {
        retry_count: job.attempts,
        error_message: `Attempt ${job.attempts} failed: ${job.last_error}. Retrying in ${backoffSeconds}s`,
      });
    }

    return { success: false, status: 'retry_scheduled' };
  } catch (err: any) {
    job.attempts += 1;
    job.last_error = err.message;
    job.status = job.attempts >= job.max_attempts ? 'dead_letter' : 'pending';
    await job.save();
    return { success: false, status: job.status };
  }
}

/**
 * Processes pending jobs in the queue up to batchSize
 */
export async function processPendingNotificationJobs(batchSize = 10): Promise<number> {
  let processed = 0;
  try {
    const now = new Date();

    for (let i = 0; i < batchSize; i++) {
      const lockedJob = await NotificationJob.findOneAndUpdate(
        {
          status: 'pending',
          next_run_at: { $lte: now },
        },
        {
          $set: { status: 'processing', locked_at: now },
        },
        {
          sort: { next_run_at: 1 },
          new: true,
        }
      );

      if (!lockedJob) {
        break; // No more pending jobs currently due
      }

      await processNotificationJob(lockedJob);
      processed++;
    }

    return processed;
  } catch (err: any) {
    console.error('[Notification Worker Error]:', err.message);
    return processed;
  }
}

/**
 * Starts periodic background polling worker
 */
export function startNotificationWorker(intervalMs = 5000): void {
  if (workerIntervalId) return;
  console.log(`[Notification Worker]: Started polling queue every ${intervalMs}ms.`);
  workerIntervalId = setInterval(async () => {
    await processPendingNotificationJobs(10);
  }, intervalMs);
}

/**
 * Stops periodic background polling worker
 */
export function stopNotificationWorker(): void {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[Notification Worker]: Stopped queue poller.');
  }
}
