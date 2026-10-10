/**
 * ============================================================================
 * FLEET FLOW — NOTIFICATION AUDIT LOG MODEL (NotificationLog.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores an immutable audit trail of automated business notifications dispatched
 * via WhatsApp, Transactional Email, and SMS.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationChannel = 'whatsapp' | 'email' | 'sms';
export type NotificationEvent =
  | 'LR_GENERATED'
  | 'TRIP_DISPATCHED'
  | 'DELIVERY_COMPLETED'
  | 'SETTLEMENT_PAYOUT'
  | 'INVITATION'
  | 'INVOICE_ISSUED';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';

export interface INotificationLog extends Document {
  company_id: Types.ObjectId;
  channel: NotificationChannel;
  event_type: NotificationEvent;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name: string;
  message_preview: string;
  template_name?: string;
  template_variables?: Record<string, any>;
  provider_message_id?: string;
  status: NotificationStatus;
  retry_count: number;
  error_message?: string;
  delivered_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'sms'],
      required: true,
      index: true,
    },
    event_type: {
      type: String,
      enum: [
        'LR_GENERATED',
        'TRIP_DISPATCHED',
        'DELIVERY_COMPLETED',
        'SETTLEMENT_PAYOUT',
        'INVITATION',
        'INVOICE_ISSUED',
      ],
      required: true,
      index: true,
    },
    recipient_phone: { type: String, trim: true },
    recipient_email: { type: String, trim: true, lowercase: true },
    recipient_name: { type: String, required: true, trim: true },
    message_preview: { type: String, required: true },
    template_name: { type: String, trim: true },
    template_variables: { type: Schema.Types.Mixed, default: {} },
    provider_message_id: { type: String, trim: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    retry_count: { type: Number, default: 0 },
    error_message: { type: String },
    delivered_at: { type: Date },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound index for querying recent notifications per company
NotificationLogSchema.index({ company_id: 1, created_at: -1 });

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);
