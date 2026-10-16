/**
 * ============================================================================
 * FLEET FLOW — META WHATSAPP WEBHOOK CONTROLLER (webhookController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Ingests Meta WhatsApp Business Platform webhooks for:
 * 1. GET: Hub challenge verification handshake.
 * 2. POST: Asynchronous delivery receipts (sent -> delivered -> read -> failed)
 *    with cryptographic HMAC-SHA256 signature verification and idempotency.
 * 3. POST: Inbound user opt-out commands ("STOP", "UNSUBSCRIBE") to enforce DND.
 * ============================================================================
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { NotificationLog } from '../models/NotificationLog.js';
import { ProcessedWebhook } from '../models/ProcessedWebhook.js';
import { OptOutRegistry } from '../models/OptOutRegistry.js';
import { normalizeWhatsAppPhone } from '../utils/whatsappClient.js';

/**
 * Status precedence hierarchy to prevent out-of-order webhook delivery from
 * downgrading notification state (e.g., delivered arriving after read).
 */
const STATUS_RANK: Record<string, number> = {
  queued: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

/**
 * Safely records processed webhook entry with concurrency race resilience.
 * If a duplicate key error (E11000) occurs because another concurrent request
 * is processing or has processed the same event_id, verifies the committed outcome
 * and returns { recorded: false, duplicate: true } rather than throwing an unhandled 500.
 */
async function recordProcessedWebhookSafe(params: {
  event_id: string;
  source: 'whatsapp';
  event_type: string;
  payload: any;
  status: 'success' | 'ignored';
}): Promise<{ recorded: boolean; duplicate: boolean }> {
  try {
    await ProcessedWebhook.create(params);
    return { recorded: true, duplicate: false };
  } catch (err: any) {
    const isDup =
      err?.code === 11000 ||
      (err?.name === 'MongoServerError' && err?.code === 11000) ||
      (typeof err?.message === 'string' && err.message.includes('E11000'));

    if (isDup) {
      // Poll briefly (up to 5 attempts, 50ms) to ensure concurrent processing committed successfully
      for (let attempt = 0; attempt < 5; attempt++) {
        const verified = await ProcessedWebhook.findOne({
          event_id: params.event_id,
          status: { $in: ['success', 'ignored'] },
        });
        if (verified) {
          console.log(`[Meta Webhook]: Verified concurrent processing of ${params.event_id}; duplicate safely acknowledged.`);
          return { recorded: false, duplicate: true };
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Concurrent webhook processing conflict for event ${params.event_id}; outcome unverified.`);
    }
    throw err;
  }
}

/**
 * Validates Meta WhatsApp Cloud API X-Hub-Signature-256 HMAC-SHA256 signature.
 * Enforces strict fail-closed policy in production.
 */
export function verifyWhatsAppSignature(rawPayload: Buffer | string, signatureHeader?: string): boolean {
  const isProd = process.env.NODE_ENV === 'production';
  const secret = process.env.WHATSAPP_APP_SECRET || (!isProd ? 'dev_whatsapp_webhook_secret' : undefined);

  if (!secret || !signatureHeader) {
    return false;
  }

  const payloadBuffer = typeof rawPayload === 'string' ? Buffer.from(rawPayload, 'utf8') : rawPayload;
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');

  try {
    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook Verification Handshake
 */
export async function verifyWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'fleet_flow_webhook_verify_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook]: Verification handshake successful.');
    res.status(200).send(challenge);
    return;
  }

  console.warn('[Meta Webhook Verification Failed]: Token mismatch or invalid mode.');
  res.status(403).json({ error: 'Webhook verification token mismatch' });
}

/**
 * POST /api/webhooks/whatsapp
 * Ingests Meta Status Callbacks & Incoming Messages with cryptographic
 * signature validation, ProcessedWebhook idempotency, and monotonic transitions.
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawPayload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    // FAIL-CLOSED: In production, WHATSAPP_APP_SECRET must be configured
    if (isProd && !process.env.WHATSAPP_APP_SECRET) {
      console.error('[Meta Webhook Security Error]: WHATSAPP_APP_SECRET missing in production environment');
      res.status(500).json({ error: 'WHATSAPP_APP_SECRET is not configured on this server.' });
      return;
    }

    // SIGNATURE CHECK: Validate HMAC-SHA256 signature
    if (!verifyWhatsAppSignature(rawPayload, signature)) {
      console.warn('[Meta Webhook Security Warning]: Invalid or missing X-Hub-Signature-256');
      res.status(401).json({ error: 'Invalid or missing webhook signature' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (body.object !== 'whatsapp_business_account' && !body.entry) {
      res.status(200).json({ status: 'ignored' });
      return;
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Process Status Receipts (sent, delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            const messageId = statusObj.id;
            const newStatus = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

            const eventId = `whatsapp_status_${messageId}_${newStatus}`;

            // IDEMPOTENCY CHECK: deduplicate repeated webhook callbacks
            const existingEvent = await ProcessedWebhook.findOne({ event_id: eventId });
            if (existingEvent) {
              console.log(`[Meta Webhook]: Duplicate status event ${eventId} safely ignored.`);
              continue;
            }

            // Find matching NotificationLog by provider_message_id (tenant-safe single document)
            const log = await NotificationLog.findOne({ provider_message_id: messageId });
            if (!log) {
              console.warn(`[Meta Webhook]: No notification log found for provider message ID ${messageId}`);
              // Record in processed webhooks to prevent repeated unresolvable processing
              await recordProcessedWebhookSafe({
                event_id: eventId,
                source: 'whatsapp',
                event_type: `message.${newStatus}`,
                payload: statusObj,
                status: 'ignored',
              });
              continue;
            }

            // MONOTONIC STATE TRANSITION GUARD:
            // Prevent out-of-order webhooks from downgrading status (e.g. read -> delivered)
            const currentRank = STATUS_RANK[log.status] || 0;
            const newRank = STATUS_RANK[newStatus] || 0;

            if (newStatus === 'failed') {
              // Only fail if not already confirmed delivered or read
              if (log.status !== 'delivered' && log.status !== 'read') {
                log.status = 'failed';
                const errorDetail = statusObj.errors?.[0]?.message || statusObj.errors?.[0]?.title || 'Meta delivery error';
                log.error_message = errorDetail;
                await log.save();
              }
            } else if (newRank > currentRank) {
              log.status = newStatus as any;
              if (newStatus === 'delivered' && !log.delivered_at) {
                log.delivered_at = timestamp;
              } else if (newStatus === 'read') {
                if (!log.delivered_at) log.delivered_at = timestamp;
              }
              await log.save();
              console.log(`[Meta Webhook Status]: Updated message ${messageId} -> ${newStatus.toUpperCase()}`);
            } else {
              console.log(
                `[Meta Webhook Out-of-Order]: Ignored transition ${log.status} -> ${newStatus} for message ${messageId}`
              );
            }

            // Record idempotency ledger safely
            await recordProcessedWebhookSafe({
              event_id: eventId,
              source: 'whatsapp',
              event_type: `message.${newStatus}`,
              payload: statusObj,
              status: 'success',
            });
          }
        }

        // 2. Process Inbound Messages (Opt-out / Opt-in commands)
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            const msgEventId = `whatsapp_msg_${message.id}`;
            const existingMsg = await ProcessedWebhook.findOne({ event_id: msgEventId });
            if (existingMsg) {
              continue;
            }

            const from = normalizeWhatsAppPhone(message.from);
            const textBody = (message.text?.body || '').trim().toUpperCase();

            if (textBody === 'STOP' || textBody === 'UNSUBSCRIBE' || textBody === 'DND') {
              await OptOutRegistry.findOneAndUpdate(
                { phone: from, channel: 'whatsapp' },
                {
                  phone: from,
                  channel: 'whatsapp',
                  reason: 'INBOUND_STOP',
                  notes: `Customer sent inbound command: "${textBody}"`,
                },
                { upsert: true, new: true }
              );
              console.log(`[Meta Webhook DND]: Recipient +${from} opted out via "${textBody}". Registered in DND.`);
            } else if (textBody === 'START' || textBody === 'UNSTOP' || textBody === 'SUBSCRIBE') {
              await OptOutRegistry.findOneAndDelete({ phone: from, channel: 'whatsapp' });
              console.log(`[Meta Webhook DND]: Recipient +${from} re-subscribed via "${textBody}". Removed from DND.`);
            }

            await recordProcessedWebhookSafe({
              event_id: msgEventId,
              source: 'whatsapp',
              event_type: 'inbound_message',
              payload: message,
              status: 'success',
            });
          }
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error('[Meta Webhook Processing Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
}
