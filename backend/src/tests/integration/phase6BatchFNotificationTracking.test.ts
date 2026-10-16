/**
 * ============================================================================
 * PHASE F TEST SUITE: NOTIFICATION TRACKING, WEBHOOK SECURITY & RELIABILITY
 * (phase6BatchFNotificationTracking.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch F:
 * - FF-ISSUE-054: Delivery metrics and delivered-rate accuracy.
 * - FF-ISSUE-055: Notification lifecycle, webhook security, idempotency, and retries.
 * - DEC-011: Approved notification delivery tracking and audit architecture.
 * - QST-006: Delivery receipt ingestion, status monotonicity, and rate calculations.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { NotificationLog } from '../../models/NotificationLog.js';
import { NotificationJob } from '../../models/NotificationJob.js';
import { ProcessedWebhook } from '../../models/ProcessedWebhook.js';
import { OptOutRegistry } from '../../models/OptOutRegistry.js';
import { AuditLog } from '../../models/AuditLog.js';
import {
  verifyWhatsAppSignature,
  handleWhatsAppWebhook,
} from '../../controllers/webhookController.js';
import {
  isPermanentError,
  calculateBackoffSeconds,
  processNotificationJob,
  simulateWebhookDeliveryReceipt,
} from '../../workers/notificationWorker.js';

describe('Phase F: Notification Delivery Tracking, Webhooks & Reliable Retries (FF-ISSUE-054, FF-ISSUE-055, DEC-011, QST-006)', () => {
  let tenant: TestTenantContext;
  const devSecret = 'dev_whatsapp_webhook_secret';

  beforeEach(async () => {
    tenant = await createTestTenant({ plan_code: 'enterprise' });
    process.env.WHATSAPP_APP_SECRET = devSecret;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  // Helper to compute valid Meta X-Hub-Signature-256 header
  function generateMetaSignature(payload: string | object, secret: string = devSecret): string {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return `sha256=${hash}`;
  }

  // ==========================================================================
  // SUITE 1: Webhook Cryptographic Verification (X-Hub-Signature-256)
  // ==========================================================================
  describe('1. Webhook Signature Verification & Security Handshake', () => {
    it('GET /api/webhooks/whatsapp verifies subscription challenge with valid token', async () => {
      const challenge = 'random_challenge_string_12345';
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'fleet_flow_webhook_verify_token';

      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge,
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challenge);
    });

    it('GET /api/webhooks/whatsapp rejects challenge with mismatched token (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_invalid_token',
          'hub.challenge': 'some_challenge',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('mismatch');
    });

    it('POST /api/webhooks/whatsapp rejects requests with missing signature header (HTTP 401)', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or missing webhook signature');
    });

    it('POST /api/webhooks/whatsapp rejects requests with invalid or forged signature (HTTP 401)', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', 'sha256=invalid_forged_hex_signature_deadbeef')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or missing webhook signature');
    });

    it('POST /api/webhooks/whatsapp accepts requests with valid HMAC-SHA256 signature (HTTP 200)', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('verifyWhatsAppSignature utility returns false if secret or signature is missing', () => {
      expect(verifyWhatsAppSignature('payload', undefined)).toBe(false);
      expect(verifyWhatsAppSignature('', 'sha256=abcdef')).toBe(false);
    });
  });

  // ==========================================================================
  // SUITE 2: Webhook Ingestion, Idempotency & Monotonic Transitions
  // ==========================================================================
  describe('2. Webhook Ingestion, Idempotency & Monotonic State Transitions', () => {
    it('ingests delivery receipt webhook and transitions NotificationLog to delivered', async () => {
      const messageId = `wamid.${crypto.randomBytes(16).toString('hex')}`;

      // Create pre-existing dispatched notification in 'sent' status
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Rajesh Driver',
        recipient_phone: '919876543210',
        message_preview: 'Trip JRN-001 has been dispatched.',
        provider_message_id: messageId,
        status: 'sent',
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_12345',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '1234567890', phone_number_id: 'PN_123' },
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1700000000',
                      recipient_id: '919876543210',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(200);

      // Verify NotificationLog transitioned to 'delivered' and stamped delivered_at
      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('delivered');
      expect(updatedLog?.delivered_at).toBeDefined();

      // Verify ProcessedWebhook entry was created for idempotency
      const eventId = `whatsapp_status_${messageId}_delivered`;
      const webhookRecord = await ProcessedWebhook.findOne({ event_id: eventId });
      expect(webhookRecord).toBeDefined();
      expect(webhookRecord?.source).toBe('whatsapp');
    });

    it('processes duplicate delivery webhooks idempotently without duplicate mutations', async () => {
      const messageId = `wamid.${crypto.randomBytes(16).toString('hex')}`;

      await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'LR_GENERATED',
        recipient_name: 'Customer A',
        recipient_phone: '919876543211',
        message_preview: 'LR-0001 created',
        provider_message_id: messageId,
        status: 'sent',
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1700000000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      // First webhook
      const res1 = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);
      expect(res1.status).toBe(200);

      // Second webhook (duplicate)
      const res2 = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);
      expect(res2.status).toBe(200);

      // Exactly 1 ProcessedWebhook record must exist
      const count = await ProcessedWebhook.countDocuments({ event_id: `whatsapp_status_${messageId}_delivered` });
      expect(count).toBe(1);
    });

    it('safely handles concurrent duplicate webhooks (Promise.all) without duplicate mutations or 500 error', async () => {
      const messageId = `wamid.${crypto.randomBytes(16).toString('hex')}`;

      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Concurrent Recipient',
        recipient_phone: '919876543212',
        message_preview: 'Trip dispatch alert',
        provider_message_id: messageId,
        status: 'sent',
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1700000000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      // Fire both webhooks simultaneously via Promise.all
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/webhooks/whatsapp')
          .set('x-hub-signature-256', signature)
          .set('Content-Type', 'application/json')
          .send(raw),
        request(app)
          .post('/api/webhooks/whatsapp')
          .set('x-hub-signature-256', signature)
          .set('Content-Type', 'application/json')
          .send(raw),
      ]);

      // Both requests must succeed (HTTP 200) without throwing 500
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Verify exactly ONE ProcessedWebhook ledger document exists
      const count = await ProcessedWebhook.countDocuments({ event_id: `whatsapp_status_${messageId}_delivered` });
      expect(count).toBe(1);

      // Verify NotificationLog transitioned to 'delivered' exactly once with delivered_at stamped
      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('delivered');
      expect(updatedLog?.delivered_at).toBeDefined();
    });

    it('enforces monotonic status progression: out-of-order delivered does NOT downgrade read status', async () => {
      const messageId = `wamid.${crypto.randomBytes(16).toString('hex')}`;

      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'SETTLEMENT_PAYOUT',
        recipient_name: 'Driver B',
        recipient_phone: '919876543212',
        message_preview: 'Settlement slip JRN-002',
        provider_message_id: messageId,
        status: 'read', // Already read by recipient
        delivered_at: new Date(Date.now() - 60000),
      });

      // Delayed 'delivered' status callback arrives
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1700000000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(200);

      // Status must remain 'read'
      const checkLog = await NotificationLog.findById(log._id);
      expect(checkLog?.status).toBe('read');
    });

    it('out-of-order sent does NOT downgrade delivered status', async () => {
      const messageId = `wamid.${crypto.randomBytes(16).toString('hex')}`;

      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'LR_GENERATED',
        recipient_name: 'Driver C',
        recipient_phone: '919876543213',
        message_preview: 'LR-0002 generated',
        provider_message_id: messageId,
        status: 'delivered',
        delivered_at: new Date(),
      });

      // Out-of-order 'sent' arrives
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: messageId, status: 'sent', timestamp: '1700000000' }],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      const checkLog = await NotificationLog.findById(log._id);
      expect(checkLog?.status).toBe('delivered');
    });
  });

  // ==========================================================================
  // SUITE 3: Error Categorization & Bounded Retries (DEC-011)
  // ==========================================================================
  describe('3. Error Categorization & Resilient Bounded Retries', () => {
    it('isPermanentError correctly identifies client/permanent vs transient errors', () => {
      // Permanent
      expect(isPermanentError('Invalid recipient phone number')).toBe(true);
      expect(isPermanentError('Recipient has opted out of automated notifications (DND)')).toBe(true);
      expect(isPermanentError('Not a WhatsApp user')).toBe(true);
      expect(isPermanentError('HTTP 400 Bad Request: Template does not exist')).toBe(true);
      expect(isPermanentError('HTTP 401 Unauthorized')).toBe(true);

      // Transient
      expect(isPermanentError('HTTP 500 Internal Server Error')).toBe(false);
      expect(isPermanentError('HTTP 503 Service Unavailable')).toBe(false);
      expect(isPermanentError('HTTP 429 Too Many Requests')).toBe(false);
      expect(isPermanentError('Network timeout ETIMEDOUT')).toBe(false);
      expect(isPermanentError('Socket hang up ECONNRESET')).toBe(false);
    });

    it('calculateBackoffSeconds returns exponential backoff capped per DEC-011', () => {
      expect(calculateBackoffSeconds(1)).toBe(60);
      expect(calculateBackoffSeconds(2)).toBe(300);
      expect(calculateBackoffSeconds(3)).toBe(900);
      expect(calculateBackoffSeconds(4)).toBe(3600);
    });

    it('processNotificationJob fails fast on permanent failure without retrying', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Invalid Driver',
        recipient_phone: '', // Empty phone
        message_preview: 'Trip alert',
        status: 'queued',
      });

      const job = await NotificationJob.create({
        company_id: tenant.company._id,
        job_id: `job_${Date.now()}_invalid`,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Invalid Driver',
        recipient_phone: '',
        message_preview: 'Trip alert',
        attempts: 0,
        max_attempts: 3,
        next_run_at: new Date(),
        status: 'pending',
        notification_log_id: log._id,
      });

      const result = await processNotificationJob(job);
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed_permanent');

      const updatedJob = await NotificationJob.findById(job._id);
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.attempts).toBe(1);

      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('failed');
      expect(updatedLog?.error_message).toContain('Invalid recipient');
    });

    it('processNotificationJob marks dead_letter after max retries on transient errors', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Valid Driver',
        recipient_phone: '919876543299',
        message_preview: 'Trip alert',
        status: 'queued',
      });

      const job = await NotificationJob.create({
        company_id: tenant.company._id,
        job_id: `job_${Date.now()}_transient`,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Valid Driver',
        recipient_phone: '919876543299',
        message_preview: 'Trip alert',
        attempts: 2, // Already attempted twice
        max_attempts: 3,
        next_run_at: new Date(),
        status: 'pending',
        notification_log_id: log._id,
      });

      // Mock whatsapp client to fail with a transient error
      const whatsappClient = await import('../../utils/whatsappClient.js');
      vi.spyOn(whatsappClient, 'sendWhatsAppTemplate').mockResolvedValueOnce({
        success: false,
        messageId: '',
        error: 'HTTP 503 Service Unavailable: Meta gateway timeout',
      });

      const result = await processNotificationJob(job);
      expect(result.success).toBe(false);
      expect(result.status).toBe('dead_letter');

      const updatedJob = await NotificationJob.findById(job._id);
      expect(updatedJob?.status).toBe('dead_letter');
      expect(updatedJob?.attempts).toBe(3);

      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('failed');
      expect(updatedLog?.error_message).toContain('HTTP 503');
    });
  });

  // ==========================================================================
  // SUITE 4: Accurate Delivery Metrics & Pending Distinction (FF-ISSUE-054, QST-006)
  // ==========================================================================
  describe('4. Accurate Delivery Metrics & Pending Distinction (FF-ISSUE-054, QST-006)', () => {
    it('GET /api/notifications/logs returns accurate delivered_ratio and pending counts', async () => {
      // Create 4 distinct notification records:
      // - 2 delivered
      // - 1 sent (pending confirmation)
      // - 1 skipped (DND opt-out)
      await NotificationLog.create([
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'TRIP_DISPATCHED',
          recipient_name: 'Recipient 1',
          recipient_phone: '919800000001',
          message_preview: 'Dispatched 1',
          status: 'delivered',
          delivered_at: new Date(),
        },
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'LR_GENERATED',
          recipient_name: 'Recipient 2',
          recipient_phone: '919800000002',
          message_preview: 'LR 2',
          status: 'read',
          delivered_at: new Date(),
        },
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'SETTLEMENT_PAYOUT',
          recipient_name: 'Recipient 3',
          recipient_phone: '919800000003',
          message_preview: 'Settlement 3',
          status: 'sent', // Dispatched, awaiting provider webhook
        },
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'INVITATION',
          recipient_name: 'Recipient 4',
          recipient_phone: '919800000004',
          message_preview: 'Invite 4',
          status: 'skipped', // Opt-out
        },
      ]);

      const res = await request(app)
        .get('/api/notifications/logs')
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(res.status).toBe(200);
      const { stats } = res.body;

      expect(stats.total).toBe(4);
      expect(stats.delivered).toBe(2); // 1 delivered + 1 read
      expect(stats.pending).toBe(1); // 1 sent
      expect(stats.sent).toBe(1);
      expect(stats.skipped).toBe(1);

      // Formula: delivered / (total - skipped) = 2 / (4 - 1) = 67%
      expect(stats.eligible).toBe(3);
      expect(stats.delivered_ratio).toBe(67);
    });

    it('correctly distinguishes pending confirmation when all messages are sent', async () => {
      await NotificationLog.create([
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'TRIP_DISPATCHED',
          recipient_name: 'Pending 1',
          recipient_phone: '919811111111',
          message_preview: 'Dispatched A',
          status: 'sent',
        },
        {
          company_id: tenant.company._id,
          channel: 'whatsapp',
          event_type: 'TRIP_DISPATCHED',
          recipient_name: 'Pending 2',
          recipient_phone: '919811111112',
          message_preview: 'Dispatched B',
          status: 'sent',
        },
      ]);

      const res = await request(app)
        .get('/api/notifications/logs')
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(res.status).toBe(200);
      const { stats } = res.body;

      expect(stats.total).toBe(2);
      expect(stats.delivered).toBe(0);
      expect(stats.pending).toBe(2);
      expect(stats.sent).toBe(2);
      expect(stats.delivered_ratio).toBe(0);
    });
  });

  // ==========================================================================
  // SUITE 5: Simulated Delivery Receipts in Non-Production
  // ==========================================================================
  describe('5. Simulated Delivery Receipts in Non-Production', () => {
    it('simulateWebhookDeliveryReceipt transitions sent log to delivered in test environment', async () => {
      const messageId = `sim_msg_${Date.now()}`;
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'LR_GENERATED',
        recipient_name: 'Sim Recipient',
        recipient_phone: '919999999999',
        message_preview: 'Simulated LR message',
        provider_message_id: messageId,
        status: 'sent',
      });

      const success = await simulateWebhookDeliveryReceipt(messageId);
      expect(success).toBe(true);

      const checkLog = await NotificationLog.findById(log._id);
      expect(checkLog?.status).toBe('delivered');
      expect(checkLog?.delivered_at).toBeDefined();

      const webhookEvent = await ProcessedWebhook.findOne({ event_id: `whatsapp_status_${messageId}_delivered` });
      expect(webhookEvent).toBeDefined();
    });

    it('simulateWebhookDeliveryReceipt throws immediately if executed in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(simulateWebhookDeliveryReceipt('some_id')).rejects.toThrow(
          /strictly prohibited in production/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // ==========================================================================
  // SUITE 6: Audited Manual Retry (resendNotification)
  // ==========================================================================
  describe('6. Audited Manual Retry (resendNotification)', () => {
    it('POST /api/notifications/logs/:id/resend re-queues failed alert and logs immutable AuditLog entry', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Stalled Driver',
        recipient_phone: '919876543200',
        message_preview: 'Manual resend target',
        status: 'failed',
        retry_count: 1,
        error_message: 'Temporary provider timeout',
      });

      const res = await request(app)
        .post(`/api/notifications/logs/${log._id}/resend`)
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('re-queued for delivery');

      // Verify log status reset to queued and retry_count incremented
      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('queued');
      expect(updatedLog?.retry_count).toBe(2);

      // Verify AuditLog entry was created
      const auditEntry = await AuditLog.findOne({
        company_id: tenant.company._id,
        entity_type: 'notification',
        entity_id: log._id,
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.action).toBe('UPDATE');
      expect(auditEntry?.description).toContain('Manual retry triggered');
      expect(auditEntry?.after_snapshot?.status).toBe('queued');
    });

    it('rejects resend attempts for notifications already confirmed as delivered (HTTP 400)', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Delivered Driver',
        recipient_phone: '919876543201',
        message_preview: 'Delivered message',
        status: 'delivered',
        delivered_at: new Date(),
        retry_count: 1,
      });

      const res = await request(app)
        .post(`/api/notifications/logs/${log._id}/resend`)
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALREADY_DELIVERED');
      expect(res.body.error).toContain('Cannot resend notification already confirmed as delivered');

      // Verify status was NOT altered
      const unmodifiedLog = await NotificationLog.findById(log._id);
      expect(unmodifiedLog?.status).toBe('delivered');
    });

    it('rejects resend attempts for notifications already confirmed as read (HTTP 400)', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Read Customer',
        recipient_phone: '919876543202',
        message_preview: 'Read message',
        status: 'read',
        delivered_at: new Date(),
        retry_count: 1,
      });

      const res = await request(app)
        .post(`/api/notifications/logs/${log._id}/resend`)
        .set('Authorization', `Bearer ${tenant.token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALREADY_DELIVERED');
      expect(res.body.error).toContain('Cannot resend notification already confirmed as read');

      const unmodifiedLog = await NotificationLog.findById(log._id);
      expect(unmodifiedLog?.status).toBe('read');
    });

    it('prevents duplicate job creation under concurrent resend requests (Promise.all)', async () => {
      const log = await NotificationLog.create({
        company_id: tenant.company._id,
        channel: 'whatsapp',
        event_type: 'TRIP_DISPATCHED',
        recipient_name: 'Stalled Driver Concurrent',
        recipient_phone: '919876543203',
        message_preview: 'Concurrent retry test',
        status: 'failed',
        retry_count: 1,
        error_message: 'Gateway 504 timeout',
      });

      // Fire two resend requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/notifications/logs/${log._id}/resend`)
          .set('Authorization', `Bearer ${tenant.token}`),
        request(app)
          .post(`/api/notifications/logs/${log._id}/resend`)
          .set('Authorization', `Bearer ${tenant.token}`),
      ]);

      // One request should succeed (200), and the other should be rejected (409 Conflict)
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Exactly ONE new NotificationJob should have been created for this notification_log_id
      const jobsCount = await NotificationJob.countDocuments({ notification_log_id: log._id });
      expect(jobsCount).toBe(1);

      // Verify retry count was incremented exactly once
      const updatedLog = await NotificationLog.findById(log._id);
      expect(updatedLog?.status).toBe('queued');
      expect(updatedLog?.retry_count).toBe(2);
    });
  });

  // ==========================================================================
  // SUITE 7: Inbound DND Opt-Out / Opt-In Command Processing
  // ==========================================================================
  describe('7. Inbound DND Opt-Out / Opt-In Processing', () => {
    it('ingests inbound STOP message, registers DND opt-out, and skips future notifications', async () => {
      const fromPhone = '9876543210';
      const normalized = '919876543210';
      const msgId = `wamid.msg_${Date.now()}`;

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: fromPhone,
                      id: msgId,
                      text: { body: 'STOP' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(200);

      // Verify OptOutRegistry has record
      const optOut = await OptOutRegistry.findOne({ phone: normalized, channel: 'whatsapp' });
      expect(optOut).toBeDefined();
      expect(optOut?.reason).toBe('INBOUND_STOP');

      // Process a job destined for this phone: must be skipped
      const job = await NotificationJob.create({
        company_id: tenant.company._id,
        job_id: `job_optout_${Date.now()}`,
        channel: 'whatsapp',
        event_type: 'LR_GENERATED',
        recipient_name: 'Opted Out Recipient',
        recipient_phone: normalized,
        message_preview: 'Test opt out skip',
        attempts: 0,
        max_attempts: 3,
        next_run_at: new Date(),
        status: 'pending',
      });

      const jobResult = await processNotificationJob(job);
      expect(jobResult.status).toBe('skipped');
    });

    it('ingests inbound START message and removes phone from DND', async () => {
      const normalized = '919876543210';
      await OptOutRegistry.create({
        phone: normalized,
        channel: 'whatsapp',
        reason: 'INBOUND_STOP',
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: normalized,
                      id: `wamid.start_${Date.now()}`,
                      text: { body: 'START' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const raw = JSON.stringify(payload);
      const signature = generateMetaSignature(raw);

      await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

      const optOut = await OptOutRegistry.findOne({ phone: normalized, channel: 'whatsapp' });
      expect(optOut).toBeNull();
    });
  });
});
