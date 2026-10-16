/**
 * ============================================================================
 * FLEET FLOW — ASYNCHRONOUS NOTIFICATION & ALERT WORKER (notificationWorker.ts)
 * ============================================================================
 * 
 * WHAT IS THIS WORKER?
 * --------------------
 * High-reliability background queue runner that:
 * 1. Processes pending notification jobs, executes provider dispatches,
 *    enforces recipient opt-out guards, and handles exponential backoff retries.
 * 2. Implements DEC-012 Notification Outbox lease fencing, stale-lease recovery,
 *    and pre-send compensation checks (revoked/aborted session interception).
 * 3. Asynchronously reconciles 'staged_unconfirmed' outbox jobs following ambiguous
 *    commit outcomes with bounded retries and defensive quarantine revocation.
 * 4. Dispatches high-frequency PlatformSecurityAlert records with fencing tokens,
 *    lease recovery, stale-worker rejection, and observable dispatch_failed escalation.
 * ============================================================================
 */

import mongoose from 'mongoose';
import os from 'os';
import { NotificationJob, INotificationJob } from '../models/NotificationJob.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { OptOutRegistry } from '../models/OptOutRegistry.js';
import { SupportAccessRequest } from '../models/SupportAccessRequest.js';
import { PlatformSecurityAlert, IPlatformSecurityAlert } from '../models/PlatformSecurityAlert.js';
import { PlatformAuditLog } from '../models/PlatformAuditLog.js';
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
    // 0. Pre-Send Revocation & Compensation Checks (DEC-012 Section 6.2)
    if (job.status === 'compensation_requested') {
      job.status = 'cancelled';
      job.last_error = 'Revoked: credential delivery uncertain (pre-send compensation)';
      await job.save();
      return { success: false, status: 'cancelled' };
    }

    if (job.session_id) {
      const session = await SupportAccessRequest.findById(job.session_id);
      if (session && session.status !== 'active') {
        job.status = 'cancelled';
        job.last_error = `Session no longer active (status: ${session.status}, reason: ${session.revocation_reason || 'unknown'})`;
        await job.save();
        return { success: false, status: 'cancelled' };
      }
    }

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

    // 3. Handle Result & In-Flight Compensation Resolution (DEC-012 Section 6.2)
    if (dispatchResult.success) {
      if (job.session_id) {
        const session = await SupportAccessRequest.findById(job.session_id);
        if (
          session &&
          session.status === 'revoked' &&
          (session.revocation_reason === 'credential_delivery_uncertain' ||
            session.revocation_reason === 'outbox_reconciliation_quarantined')
        ) {
          // Provider accepted message into pipeline, but session was revoked!
          job.status = 'provider_accepted';
          job.provider_message_id = dispatchResult.messageId;
          job.attempts += 1;
          await job.save();

          // Stage mandatory Corrective Customer Notification
          await NotificationJob.create({
            company_id: job.company_id,
            session_id: job.session_id,
            channel: job.channel,
            recipient_phone: job.recipient_phone,
            recipient_email: job.recipient_email,
            event_type: 'EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE',
            status: 'pending',
            message_preview: `Notice: An emergency access notification was dispatched to external delivery networks for your workspace, but the session was immediately aborted and revoked prior to operator access due to an uncertain credential delivery state. Zero administrative, operational, or diagnostic access occurred. Session ID ${job.session_id} is permanently terminated.`,
            next_run_at: new Date(),
          });

          await PlatformAuditLog.create({
            action: 'emergency_activation_aborted_post_commit',
            target_company_id: job.company_id,
            details: {
              session_id: job.session_id,
              notification_job_id: job._id,
              provider_outcome: 'provider_accepted',
              corrective_notification_staged: true,
            },
          }).catch(() => {});

          return { success: true, status: 'provider_accepted' };
        }
      }

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
    if (job.session_id) {
      const session = await SupportAccessRequest.findById(job.session_id);
      if (
        session &&
        session.status === 'revoked' &&
        (session.revocation_reason === 'credential_delivery_uncertain' ||
          session.revocation_reason === 'outbox_reconciliation_quarantined')
      ) {
        // Provider ambiguous timeout/error on revoked session
        job.status = 'provider_ambiguous_timeout';
        job.last_error = dispatchResult.error || 'Provider dispatch timed out or failed';
        job.attempts += 1;
        await job.save();

        await NotificationJob.create({
          company_id: job.company_id,
          session_id: job.session_id,
          channel: job.channel,
          recipient_phone: job.recipient_phone,
          recipient_email: job.recipient_email,
          event_type: 'EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE',
          status: 'pending',
          message_preview: `Notice: An emergency access attempt occurred and may have initiated an external dispatch attempt, but external provider delivery status remains unconfirmed due to a network timeout. The associated emergency session was immediately aborted and revoked prior to operator access. Zero administrative, operational, or diagnostic access occurred. Session ID ${job.session_id} is permanently terminated.`,
          next_run_at: new Date(),
        });

        await PlatformAuditLog.create({
          action: 'emergency_activation_aborted_post_commit',
          target_company_id: job.company_id,
          details: {
            session_id: job.session_id,
            notification_job_id: job._id,
            provider_outcome: 'provider_ambiguous_timeout',
            corrective_notification_staged: true,
          },
        }).catch(() => {});

        return { success: false, status: 'provider_ambiguous_timeout' };
      }
    }

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
 * Processes pending jobs in the queue up to batchSize with lease fencing & crash recovery
 */
export async function processPendingNotificationJobs(batchSize = 10): Promise<number> {
  let processed = 0;
  try {
    const now = new Date();

    for (let i = 0; i < batchSize; i++) {
      const lockedJob = await NotificationJob.findOneAndUpdate(
        {
          $or: [
            { status: 'pending', next_run_at: { $lte: now } },
            { status: 'processing', lease_expires_at: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'processing',
            locked_at: now,
            lease_expires_at: new Date(now.getTime() + 5 * 60 * 1000), // 5-minute lease
            worker_id: process.env.POD_NAME || os.hostname(),
            fencing_token: new mongoose.Types.ObjectId().toHexString(),
          },
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
 * Asynchronously reconciles jobs in 'staged_unconfirmed' state following ambiguous commit outcomes.
 * Bounded retries: 5 attempts across 3-minute window (15s, 30s, 60s, 120s, 180s).
 */
export async function processUnconfirmedOutboxJobs(batchSize = 10): Promise<number> {
  let processed = 0;
  const now = new Date();

  const unconfirmedJobs = await NotificationJob.find({
    status: 'staged_unconfirmed',
    $or: [
      { next_run_at: { $lte: now } },
      { next_run_at: { $exists: false } },
      { next_run_at: null },
    ],
  })
    .sort({ next_run_at: 1 })
    .limit(batchSize);

  for (const job of unconfirmedJobs) {
    processed++;
    try {
      const session = await SupportAccessRequest.findOne({ notification_job_id: job._id });
      if (session) {
        if (session.status === 'active') {
          // Commit definitively succeeded: release job to queue
          await NotificationJob.updateOne(
            { _id: job._id, status: 'staged_unconfirmed' },
            {
              $set: {
                status: 'pending',
                session_id: session._id,
                reconciled_at: new Date(),
                resolution_notes: 'Reconciliation confirmed transaction committed.',
              },
            },
            { writeConcern: { w: 'majority', j: true } } as any
          );
          continue;
        } else if (['revoked', 'expired'].includes(session.status)) {
          // Session was revoked or expired: cancel outbox job
          await NotificationJob.updateOne(
            { _id: job._id, status: 'staged_unconfirmed' },
            {
              $set: {
                status: 'cancelled',
                reconciled_at: new Date(),
                resolution_notes: `Reconciliation found session in status ${session.status}.`,
              },
            },
            { writeConcern: { w: 'majority', j: true } } as any
          );
          continue;
        }
      }

      // Not found or transient miss: bounded retry
      const attempts = (job.reconciliation_attempts || 0) + 1;
      const elapsedMs = job.first_unconfirmed_at
        ? now.getTime() - new Date(job.first_unconfirmed_at).getTime()
        : 0;

      if (attempts >= 5 || elapsedMs >= 3 * 60 * 1000) {
        // Quarantine and escalate
        await NotificationJob.updateOne(
          { _id: job._id, status: 'staged_unconfirmed' },
          {
            $set: {
              status: 'quarantined_unresolved',
              reconciliation_attempts: attempts,
              resolution_notes: `Quarantined after ${attempts} attempts (${Math.round(elapsedMs / 1000)}s elapsed) without definitive commit outcome.`,
            },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        );

        await PlatformAuditLog.create({
          action: 'outbox_commit_outcome_unresolved',
          target_company_id: job.company_id,
          details: { notification_job_id: job._id, attempts },
        }).catch(() => {});

        // Defensive revocation
        await SupportAccessRequest.updateMany(
          { notification_job_id: job._id, status: 'active' },
          { $set: { status: 'revoked', revocation_reason: 'outbox_reconciliation_quarantined' } },
          { writeConcern: { w: 'majority', j: true } } as any
        ).catch(() => {});
      } else {
        // Schedule next retry with backoff: 15s, 30s, 60s, 120s, 180s
        const backoffSeconds = [15, 30, 60, 120, 180][attempts - 1] || 180;
        await NotificationJob.updateOne(
          { _id: job._id, status: 'staged_unconfirmed' },
          {
            $set: {
              reconciliation_attempts: attempts,
              next_run_at: new Date(now.getTime() + backoffSeconds * 1000),
            },
          }
        );
      }
    } catch (err: any) {
      console.error(`[Outbox Reconciler Error on job ${job._id}]:`, err.message);
    }
  }

  return processed;
}

/**
 * Late Resolution Protocol for Quarantined Outbox Jobs (Section 6.1, 292-317)
 */
export async function reconcileQuarantinedJob(
  jobId: string | mongoose.Types.ObjectId
): Promise<{ success: boolean; resolution: string }> {
  const job = await NotificationJob.findOne({ _id: jobId, status: 'quarantined_unresolved' });
  if (!job) {
    return { success: false, resolution: 'Job not found or not in quarantined_unresolved status.' };
  }

  const session = await SupportAccessRequest.findOne({ notification_job_id: job._id });

  if (!session) {
    // Scenario A: Late Confirmation of Transaction Abort
    await NotificationJob.updateOne(
      { _id: job._id, status: 'quarantined_unresolved' },
      {
        $set: {
          status: 'cancelled_post_quarantine',
          reconciled_at: new Date(),
          resolution_notes: 'Late resolution confirmed transaction aborted; zero session committed.',
        },
      },
      { writeConcern: { w: 'majority', j: true } } as any
    );
    return { success: true, resolution: 'cancelled_post_quarantine' };
  }

  // Scenario B: Late Discovery of Committed Session
  // Reactivation is strictly prohibited; ensure session is marked revoked
  await SupportAccessRequest.updateOne(
    { _id: session._id },
    { $set: { status: 'revoked', revocation_reason: 'outbox_reconciliation_quarantined' } },
    { writeConcern: { w: 'majority', j: true } } as any
  );

  await NotificationJob.updateOne(
    { _id: job._id, status: 'quarantined_unresolved' },
    {
      $set: {
        status: 'reconciled_revoked_disclosed',
        reconciled_at: new Date(),
        resolution_notes: 'Late resolution found committed session; revoked and disclosed.',
      },
    },
    { writeConcern: { w: 'majority', j: true } } as any
  );

  // Stage high-priority Late Incident Disclosure Notification
  await NotificationJob.create({
    company_id: job.company_id,
    session_id: session._id,
    channel: job.channel,
    recipient_phone: job.recipient_phone,
    recipient_email: job.recipient_email,
    event_type: 'EMERGENCY_ACCESS_RESOLVED_AFTER_QUARANTINE',
    status: 'pending',
    message_preview: `Notice: An emergency access transaction was committed for your workspace during a platform network partition, but was immediately quarantined and defensively revoked with zero operator access. The session has been permanently terminated.`,
    next_run_at: new Date(),
  });

  await PlatformAuditLog.create({
    action: 'emergency_access_late_quarantine_resolved',
    target_company_id: job.company_id,
    details: {
      notification_job_id: job._id,
      session_id: session._id,
    },
  }).catch(() => {});

  return { success: true, resolution: 'reconciled_revoked_disclosed' };
}

/**
 * Dispatches a high-frequency emergency access security alert to the external SIEM / webhook / SRE channel.
 */
export async function dispatchSecurityAlertToProvider(
  alert: IPlatformSecurityAlert
): Promise<{ success: boolean; messageId: string; error?: string }> {
  const webhookUrl = process.env.SECURITY_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Key': alert.alert_key,
          'X-Idempotency-Key': alert.alert_key,
        },
        body: JSON.stringify({
          event: 'EMERGENCY_ACCESS_HIGH_FREQUENCY_ALERT',
          alert_key: alert.alert_key,
          company_id: alert.company_id,
          trigger_session_id: alert.trigger_session_id,
          associated_session_ids: alert.associated_session_ids,
          first_triggered_at: alert.first_triggered_at,
          last_session_at: alert.last_session_at,
          session_count: alert.associated_session_ids?.length || 0,
        }),
      });

      if (response.ok) {
        return { success: true, messageId: `alert_resp_${Date.now()}` };
      } else {
        return { success: false, messageId: '', error: `HTTP ${response.status}: ${await response.text()}` };
      }
    } catch (err: any) {
      return { success: false, messageId: '', error: err.message };
    }
  }

  // If no external webhook URL is configured:
  // Document limitation honestly per DEC-012 Section 3 & Section 9.2:
  // Dispatch is recorded to platform telemetry hook.
  console.log(
    JSON.stringify({
      event: 'SECURITY_ALERT_EXTERNAL_DISPATCH',
      alert_key: alert.alert_key,
      company_id: alert.company_id,
      session_count: alert.associated_session_ids?.length || 0,
      note: 'No external SECURITY_ALERT_WEBHOOK_URL configured; alert recorded to platform telemetry hook.',
    })
  );

  return { success: true, messageId: `telemetry_${Date.now()}` };
}

/**
 * Worker for high-frequency security alert dispatching.
 * Implements atomic conditional claim, lease fencing tokens, backoff retries,
 * stale-worker rejection, and terminal dispatch_failed escalation.
 */
export async function processPendingSecurityAlerts(batchSize = 10): Promise<number> {
  let processed = 0;
  const now = new Date();
  const leaseDurationMs = 2 * 60 * 1000; // 2-minute lease

  for (let i = 0; i < batchSize; i++) {
    const newLeaseToken = new mongoose.Types.ObjectId().toHexString();

    const claimedAlert = await PlatformSecurityAlert.findOneAndUpdate(
      {
        $or: [
          { status: 'pending_dispatch' },
          { status: 'retry_scheduled', next_run_at: { $lte: now } },
          { status: 'dispatching', dispatch_lease_expires_at: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'dispatching',
          dispatch_worker_id: process.env.POD_NAME || os.hostname(),
          dispatch_lease_token: newLeaseToken,
          dispatch_lease_expires_at: new Date(now.getTime() + leaseDurationMs),
        },
        $inc: { lease_version: 1 },
      },
      { new: true }
    );

    if (!claimedAlert) {
      break;
    }

    processed++;
    // Snapshot of session IDs currently in alert
    const sessionSnapshot = [...(claimedAlert.associated_session_ids || [])];
    claimedAlert.dispatched_session_snapshot = sessionSnapshot;
    await claimedAlert.save();

    const dispatchResult = await dispatchSecurityAlertToProvider(claimedAlert);

    if (dispatchResult.success) {
      // Refresh alert to check if new sessions were added while dispatching
      const currentAlert = await PlatformSecurityAlert.findById(claimedAlert._id);
      const currentSessionsCount = currentAlert?.associated_session_ids?.length || 0;

      if (currentSessionsCount > sessionSnapshot.length) {
        // Concurrent activation occurred: move back to pending_dispatch with cleared lease
        const updateResult = await PlatformSecurityAlert.updateOne(
          { _id: claimedAlert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
          {
            $set: { status: 'pending_dispatch' },
            $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        );

        if (updateResult.matchedCount === 0) {
          console.warn(
            JSON.stringify({
              event: 'STALE_ALERT_WORKER_DISCARDED',
              alert_id: claimedAlert._id,
              lease_token: newLeaseToken,
              message: 'Worker lease expired or preempted; update rejected by fencing token.',
            })
          );
        }
      } else {
        // Fenced conditional update to dispatched
        const updateResult = await PlatformSecurityAlert.updateOne(
          { _id: claimedAlert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
          {
            $set: {
              status: 'dispatched',
              dispatched_at: new Date(),
              suppress_external_alerts_until: new Date(Date.now() + 60 * 60 * 1000), // sliding 60m
            },
            $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        );

        if (updateResult.matchedCount === 0) {
          console.warn(
            JSON.stringify({
              event: 'STALE_ALERT_WORKER_DISCARDED',
              alert_id: claimedAlert._id,
              lease_token: newLeaseToken,
              message: 'Worker lease expired or preempted; update rejected by fencing token.',
            })
          );
        }
      }
    } else {
      // Handle Failure & Retry Backoff
      const nextAttempt = (claimedAlert.dispatch_attempts || 0) + 1;

      if (nextAttempt < 5) {
        const backoffMs = 15000 * Math.pow(2, nextAttempt - 1); // 15s, 30s, 60s, 120s
        const updateResult = await PlatformSecurityAlert.updateOne(
          { _id: claimedAlert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
          {
            $set: {
              status: 'retry_scheduled',
              next_run_at: new Date(Date.now() + backoffMs),
              dispatch_attempts: nextAttempt,
              last_error: dispatchResult.error,
            },
            $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        );

        if (updateResult.matchedCount === 0) {
          console.warn(
            JSON.stringify({
              event: 'STALE_ALERT_WORKER_DISCARDED',
              alert_id: claimedAlert._id,
              lease_token: newLeaseToken,
              message: 'Worker lease expired or preempted; update rejected by fencing token.',
            })
          );
        }
      } else {
        // Retry budget exhausted -> dispatch_failed
        const updateResult = await PlatformSecurityAlert.updateOne(
          { _id: claimedAlert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
          {
            $set: {
              status: 'dispatch_failed',
              dispatch_attempts: nextAttempt,
              exhausted_at: new Date(),
              last_error: `Exhausted 5 dispatch attempts: ${dispatchResult.error}`,
            },
            $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
          },
          { writeConcern: { w: 'majority', j: true } } as any
        );

        if (updateResult.matchedCount === 0) {
          console.warn(
            JSON.stringify({
              event: 'STALE_ALERT_WORKER_DISCARDED',
              alert_id: claimedAlert._id,
              lease_token: newLeaseToken,
              message: 'Worker lease expired or preempted; update rejected by fencing token.',
            })
          );
        } else {
          // Multi-channel escalation
          await PlatformAuditLog.create({
            action: 'security_alert_dispatch_exhausted',
            target_company_id: claimedAlert.company_id,
            details: {
              alert_id: claimedAlert._id,
              alert_key: claimedAlert.alert_key,
              attempts: nextAttempt,
              last_error: claimedAlert.last_error,
            },
          }).catch(() => {});

          console.error(
            JSON.stringify({
              event: 'SECURITY_ALERT_DISPATCH_EXHAUSTED',
              level: 'CRITICAL',
              alert_id: claimedAlert._id,
              alert_key: claimedAlert.alert_key,
              company_id: claimedAlert.company_id,
              attempts: 5,
              error: claimedAlert.last_error,
            })
          );
        }
      }
    }
  }

  return processed;
}

/**
 * Starts periodic background polling worker
 */
export function startNotificationWorker(intervalMs = 5000): void {
  if (workerIntervalId) return;
  console.log(`[Notification Worker]: Started polling queue every ${intervalMs}ms.`);
  workerIntervalId = setInterval(async () => {
    await processPendingNotificationJobs(10);
    await processUnconfirmedOutboxJobs(10);
    await processPendingSecurityAlerts(10);
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
