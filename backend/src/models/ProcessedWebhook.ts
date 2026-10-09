/**
 * ============================================================================
 * FLEET FLOW — PROCESSED WEBHOOK IDEMPOTENCY LEDGER (ProcessedWebhook.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores records of ingested payment gateway webhook events (e.g., Razorpay
 * payment.captured, subscription.charged, etc.).
 * 
 * WHY IS THIS CRITICAL?
 * ---------------------
 * Payment webhooks are delivered with "at-least-once" semantics and network
 * retries. By storing unique `event_id` keys with a unique index, duplicate
 * webhooks are safely swallowed without executing duplicate ledger entries,
 * duplicate subscription renewals, or double-charging.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedWebhook extends Document {
  event_id: string;
  source: 'razorpay' | 'stripe' | 'manual';
  event_type: string;
  payload: Record<string, any>;
  processed_at: Date;
  status: 'success' | 'failed' | 'ignored';
  error_message?: string;
  created_at: Date;
}

const ProcessedWebhookSchema = new Schema<IProcessedWebhook>(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, enum: ['razorpay', 'stripe', 'manual'], default: 'razorpay' },
    event_type: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    processed_at: { type: Date, default: () => new Date() },
    status: { type: String, enum: ['success', 'failed', 'ignored'], default: 'success' },
    error_message: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const ProcessedWebhook = mongoose.model<IProcessedWebhook>('ProcessedWebhook', ProcessedWebhookSchema);
