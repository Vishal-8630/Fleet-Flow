/**
 * ============================================================================
 * FLEET FLOW — META WHATSAPP WEBHOOK CONTROLLER (webhookController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Ingests Meta WhatsApp Business Platform webhooks for:
 * 1. GET: Hub challenge verification handshake.
 * 2. POST: Asynchronous delivery receipts (sent -> delivered -> read -> failed).
 * 3. POST: Inbound user opt-out commands ("STOP", "UNSUBSCRIBE") to enforce DND.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { NotificationLog } from '../models/NotificationLog.js';
import { OptOutRegistry } from '../models/OptOutRegistry.js';
import { normalizeWhatsAppPhone } from '../utils/whatsappClient.js';

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
 * Ingests Meta Status Callbacks & Incoming Messages
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;

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

        // 1. Process Status Receipts (delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            const messageId = statusObj.id;
            const newStatus = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

            const updateData: any = {
              status: newStatus,
            };

            if (newStatus === 'delivered') {
              updateData.delivered_at = timestamp;
            } else if (newStatus === 'failed') {
              const errorDetail = statusObj.errors?.[0]?.message || statusObj.errors?.[0]?.title || 'Meta delivery error';
              updateData.error_message = errorDetail;
            }

            const updatedLog = await NotificationLog.findOneAndUpdate(
              { provider_message_id: messageId },
              { $set: updateData },
              { new: true }
            );

            if (updatedLog) {
              console.log(`[Meta Webhook Status]: Updated message ${messageId} -> ${newStatus.toUpperCase()}`);
            }
          }
        }

        // 2. Process Inbound Messages (Opt-out / Opt-in commands)
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
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
