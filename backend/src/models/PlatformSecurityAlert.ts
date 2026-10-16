/**
 * ============================================================================
 * FLEET FLOW — PLATFORM SECURITY ALERT SCHEMA (PlatformSecurityAlert.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores high-frequency emergency access security alerts triggered when a tenant
 * workspace accumulates >= 2 emergency access sessions within a rolling 24-hour window.
 * 
 * Supports:
 * - Atomic conditional dispatch-claim queries with unique fencing tokens (dispatch_lease_token)
 * - Crash recovery via time-bounded leases
 * - Sliding 60-minute external alert deduplication window
 * - Idempotent session tracking via associated_session_ids set
 * - Bounded retry backoff with next_run_at and observable dispatch_failed escalation
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type AlertDispatchStatus =
  | 'pending_dispatch'
  | 'dispatching'
  | 'retry_scheduled'
  | 'dispatched'
  | 'dispatch_failed';

export interface IPlatformSecurityAlert extends Document {
  alert_key: string;
  alert_type: string;
  company_id: Types.ObjectId;
  trigger_session_id: Types.ObjectId;
  associated_session_ids: Types.ObjectId[];
  first_triggered_at: Date;
  last_session_at: Date;
  suppress_external_alerts_until?: Date;
  status: AlertDispatchStatus;
  dispatch_worker_id?: string;
  dispatch_lease_token?: string;
  dispatch_lease_expires_at?: Date;
  lease_version: number;
  dispatched_session_snapshot?: Types.ObjectId[];
  next_run_at: Date;
  dispatch_attempts: number;
  last_error?: string;
  dispatched_at?: Date;
  exhausted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const PlatformSecurityAlertSchema = new Schema<IPlatformSecurityAlert>(
  {
    alert_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    alert_type: {
      type: String,
      required: true,
      default: 'emergency_access_high_frequency_alert',
      index: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    trigger_session_id: {
      type: Schema.Types.ObjectId,
      ref: 'SupportAccessRequest',
      required: true,
    },
    associated_session_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SupportAccessRequest',
      },
    ],
    first_triggered_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    last_session_at: {
      type: Date,
      default: Date.now,
    },
    suppress_external_alerts_until: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending_dispatch', 'dispatching', 'retry_scheduled', 'dispatched', 'dispatch_failed'],
      default: 'pending_dispatch',
      index: true,
    },
    dispatch_worker_id: { type: String, trim: true },
    dispatch_lease_token: { type: String, trim: true },
    dispatch_lease_expires_at: { type: Date, index: true },
    lease_version: { type: Number, default: 0 },
    dispatched_session_snapshot: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SupportAccessRequest',
      },
    ],
    next_run_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dispatch_attempts: {
      type: Number,
      default: 0,
    },
    last_error: { type: String },
    dispatched_at: { type: Date },
    exhausted_at: { type: Date },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    writeConcern: { w: 'majority', j: true },
  }
);

// Worker polling & lease claim index
PlatformSecurityAlertSchema.index({ status: 1, next_run_at: 1 });
PlatformSecurityAlertSchema.index({ company_id: 1, first_triggered_at: -1 });

export const PlatformSecurityAlert = mongoose.model<IPlatformSecurityAlert>(
  'PlatformSecurityAlert',
  PlatformSecurityAlertSchema
);
