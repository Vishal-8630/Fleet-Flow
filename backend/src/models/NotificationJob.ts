/**
 * ============================================================================
 * FLEET FLOW — PERSISTENT ASYNCHRONOUS NOTIFICATION JOB QUEUE (NotificationJob.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores queued notification dispatch tasks with persistent retry tracking,
 * exponential backoff scheduling, and dead-letter queue (DLQ) safeguards.
 * Guarantees zero lost messages across transient provider errors or rate limits.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { NotificationChannel, NotificationEvent } from './NotificationLog.js';

export type JobStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter' | 'skipped';

export interface INotificationJob extends Document {
  company_id: Types.ObjectId;
  job_id: string;
  channel: NotificationChannel;
  event_type: NotificationEvent;
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  message_preview: string;
  template_name?: string;
  template_variables?: Record<string, any>;
  attempts: number;
  max_attempts: number;
  next_run_at: Date;
  status: JobStatus;
  last_error?: string;
  provider_message_id?: string;
  notification_log_id?: Types.ObjectId;
  locked_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const NotificationJobSchema = new Schema<INotificationJob>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    job_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    recipient_name: { type: String, required: true, trim: true },
    recipient_phone: { type: String, trim: true },
    recipient_email: { type: String, trim: true, lowercase: true },
    message_preview: { type: String, required: true },
    template_name: { type: String, trim: true },
    template_variables: { type: Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    next_run_at: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed', 'dead_letter', 'skipped'],
      default: 'pending',
      index: true,
    },
    last_error: { type: String },
    provider_message_id: { type: String, trim: true },
    notification_log_id: {
      type: Schema.Types.ObjectId,
      ref: 'NotificationLog',
      index: true,
    },
    locked_at: { type: Date },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// High-speed queue poller index
NotificationJobSchema.index({ status: 1, next_run_at: 1 });
NotificationJobSchema.index({ company_id: 1, created_at: -1 });

export const NotificationJob = mongoose.model<INotificationJob>('NotificationJob', NotificationJobSchema);
