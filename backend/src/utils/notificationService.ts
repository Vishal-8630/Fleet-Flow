/**
 * ============================================================================
 * FLEET FLOW — MULTI-CHANNEL NOTIFICATION ENGINE (notificationService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Dispatches automated WhatsApp and Email notifications across operational lifecycle
 * events (LR creation, trip dispatch, delivery POD, driver settlements).
 * 
 * FEATURES:
 * ---------
 * - Checks tenant entitlements (`MOD_WHATSAPP`) before attempting delivery.
 * - Formats official Meta WhatsApp Business Cloud API compliant payloads.
 * - Resolves dynamic public tracking URLs from `APP_BASE_URL` (no localhost hardcoding).
 * - Enforces recipient DND opt-out preferences (`OptOutRegistry`).
 * - Enqueues persistent asynchronous jobs (`NotificationJob`) with exponential retry backoff.
 * - Records persistent delivery audit logs in `NotificationLog`.
 * ============================================================================
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { NotificationLog, NotificationChannel, NotificationEvent } from '../models/NotificationLog.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { Company, ICompany } from '../models/Company.js';
import { getTenantEntitlements } from './entitlementService.js';
import { OptOutRegistry, isRecipientOptedOut } from '../models/OptOutRegistry.js';
import { processPendingNotificationJobs } from '../workers/notificationWorker.js';

export interface NotificationParams {
  company: ICompany;
  channel: NotificationChannel;
  event_type: NotificationEvent;
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  message_preview: string;
  template_name?: string;
  template_variables?: Record<string, any>;
}

/**
 * Returns dynamic public application domain
 */
export function getAppBaseUrl(): string {
  const url = process.env.APP_BASE_URL || process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'https://fleetflow.io';
  return url.replace(/\/+$/, '');
}

/**
 * Core asynchronous notification dispatcher
 * Persists log and enqueues job for background delivery with retries
 */
export async function dispatchNotification(params: NotificationParams): Promise<void> {
  const {
    company,
    channel,
    event_type,
    recipient_name,
    recipient_phone,
    recipient_email,
    message_preview,
    template_name,
    template_variables,
  } = params;

  try {
    // 1. Entitlement check for paid channels (e.g. WhatsApp)
    if (channel === 'whatsapp') {
      const entitlements = await getTenantEntitlements(company);
      const isWhatsAppEnabled = entitlements.enabled_features.includes('MOD_WHATSAPP');
      if (!isWhatsAppEnabled) {
        console.log(`[Notification Engine]: Skipping WhatsApp notification for company ${company.name} - MOD_WHATSAPP not in active entitlements.`);
        return;
      }
    }

    // 2. Recipient Opt-Out (DND) check
    const recipientKey = recipient_phone || recipient_email;
    const isOptedOut = await isRecipientOptedOut(recipientKey, channel);

    if (isOptedOut) {
      console.log(`[Notification Engine]: Recipient ${recipientKey} is opted out (DND). Skipping ${event_type}.`);
      await NotificationLog.create({
        company_id: company._id,
        channel,
        event_type,
        recipient_phone,
        recipient_email,
        recipient_name,
        message_preview,
        template_name,
        template_variables,
        status: 'skipped',
        error_message: 'Recipient has opted out of automated notifications (DND)',
        retry_count: 0,
      });
      return;
    }

    // 3. Persist audit log entry
    const log = await NotificationLog.create({
      company_id: company._id,
      channel,
      event_type,
      recipient_phone,
      recipient_email,
      recipient_name,
      message_preview,
      template_name,
      template_variables,
      status: 'queued',
      retry_count: 0,
    });

    // 4. Create persistent background job in queue
    const jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    await NotificationJob.create({
      company_id: company._id,
      job_id: jobId,
      channel,
      event_type,
      recipient_name,
      recipient_phone,
      recipient_email,
      message_preview,
      template_name,
      template_variables,
      attempts: 0,
      max_attempts: 5,
      next_run_at: new Date(),
      status: 'pending',
      notification_log_id: log._id,
    });

    console.log(`[Notification Engine]: Enqueued ${channel.toUpperCase()} job ${jobId} for ${recipient_name} (${recipientKey}) [${event_type}]`);

    // 5. Trigger queue processing asynchronously (non-blocking)
    setImmediate(() => {
      processPendingNotificationJobs(5).catch((err) => {
        console.error('[Notification Engine Async Worker Trigger Error]:', err.message);
      });
    });
  } catch (err: any) {
    console.error('[Notification Engine Error]:', err.message);
  }
}

/**
 * Event Trigger 1: LR Generated
 * Sends public tracking link to consignor and consignee using dynamic domain
 */
export async function notifyLRGenerated(entry: any, company: ICompany): Promise<void> {
  const baseUrl = getAppBaseUrl();
  const trackingUrl = `${baseUrl}/track/${entry.lr_no}`;

  // Notify Consignor (Shipper)
  if (entry.consignor?.phone) {
    await dispatchNotification({
      company,
      channel: 'whatsapp',
      event_type: 'LR_GENERATED',
      recipient_name: entry.consignor.name,
      recipient_phone: entry.consignor.phone,
      message_preview: `Namaste ${entry.consignor.name}, your consignment ${entry.lr_no} from ${entry.from_location} to ${entry.to_location} has been registered with ${company.name}. Track live: ${trackingUrl}`,
      template_name: 'lr_booking_confirmation',
      template_variables: {
        lr_no: entry.lr_no,
        origin: entry.from_location,
        destination: entry.to_location,
        tracking_url: trackingUrl,
      },
    });
  }

  // Notify Consignee (Receiver)
  if (entry.consignee?.phone) {
    await dispatchNotification({
      company,
      channel: 'whatsapp',
      event_type: 'LR_GENERATED',
      recipient_name: entry.consignee.name,
      recipient_phone: entry.consignee.phone,
      message_preview: `Hello ${entry.consignee.name}, a consignment ${entry.lr_no} with ${entry.package_count} ${entry.packaging_type} is in transit to you from ${entry.from_location}. Track status: ${trackingUrl}`,
      template_name: 'consignee_dispatch_notice',
      template_variables: {
        lr_no: entry.lr_no,
        packages: `${entry.package_count} ${entry.packaging_type}`,
        tracking_url: trackingUrl,
      },
    });
  }
}

/**
 * Event Trigger 2: Trip Dispatched
 * Sends assignment notification to driver
 */
export async function notifyTripDispatched(journey: any, driver: any, company: ICompany): Promise<void> {
  if (!driver?.phone) return;

  await dispatchNotification({
    company,
    channel: 'whatsapp',
    event_type: 'TRIP_DISPATCHED',
    recipient_name: driver.name,
    recipient_phone: driver.phone,
    message_preview: `Jai Hind ${driver.name}, you have been assigned to trip ${journey.journey_number || 'TRIP'}. Route: ${journey.origin_city} to ${journey.destination_city}. Advance: ₹${journey.advance_amount || 0}. Safe driving!`,
    template_name: 'driver_trip_dispatch',
    template_variables: {
      driver_name: driver.name,
      origin: journey.origin_city,
      destination: journey.destination_city,
      advance: journey.advance_amount,
    },
  });
}

/**
 * Event Trigger 3: Delivery Completed
 * Sends delivery confirmation and POD acknowledgement to consignee
 */
export async function notifyDeliveryCompleted(journey: any, consigneePhone: string, consigneeName: string, company: ICompany): Promise<void> {
  if (!consigneePhone) return;

  await dispatchNotification({
    company,
    channel: 'whatsapp',
    event_type: 'DELIVERY_COMPLETED',
    recipient_name: consigneeName,
    recipient_phone: consigneePhone,
    message_preview: `Hello ${consigneeName}, your consignment has been delivered at ${journey.destination_city}. Thank you for choosing ${company.name}.`,
    template_name: 'delivery_completion_notice',
    template_variables: {
      destination: journey.destination_city,
      carrier: company.name,
    },
  });
}

/**
 * Event Trigger 4: Driver Settlement Payout
 * Sends settlement summary to driver
 */
export async function notifyDriverSettlement(settlement: any, driver: any, company: ICompany): Promise<void> {
  if (!driver?.phone) return;

  const netAmount = settlement.net_amount !== undefined ? settlement.net_amount : (settlement.net_payable_amount || 0);
  const direction = netAmount >= 0 ? 'paid to you' : 'recoverable from you';
  const amount = Math.abs(netAmount);

  await dispatchNotification({
    company,
    channel: 'whatsapp',
    event_type: 'SETTLEMENT_PAYOUT',
    recipient_name: driver.name,
    recipient_phone: driver.phone,
    message_preview: `Namaste ${driver.name}, your settlement ${settlement.settlement_number} has been processed. Net amount ${direction}: ₹${amount.toLocaleString('en-IN')}. Current advance balance: ₹${settlement.closing_advance_balance || 0}.`,
    template_name: 'driver_settlement_slip',
    template_variables: {
      settlement_no: settlement.settlement_number,
      amount,
      balance: settlement.closing_advance_balance,
    },
  });
}
