/**
 * ============================================================================
 * FLEET FLOW — SUPPORT ACCESS REQUEST & AUDITED SESSION MODEL (SupportAccessRequest.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Manages the lifecycle of tenant workspace support access requests by platform
 * operators under DEC-012. Enforces customer-admin prior approval, ticket linkage,
 * permission scopes ('diagnostics_readonly' vs 'config_write'), strict duration
 * limits (max 2h standard, 30m emergency), and instant revocation.
 * 
 * Also records Dual-Super-Admin Emergency Break-Glass access requests (Policy A)
 * with emergency approval metadata and notification tracking.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type SupportSessionScope = 'diagnostics_readonly' | 'config_write';
export type SupportSessionStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'revoked' | 'expired';

export interface ISupportAccessRequest extends Document {
  company_id: Types.ObjectId;
  requested_by: Types.ObjectId;
  ticket_id: Types.ObjectId;
  scope: SupportSessionScope;
  reason?: string;
  justification?: string;
  duration_minutes: number;
  status: SupportSessionStatus;
  
  // Normal Workspace-Admin Approval
  approved_by?: Types.ObjectId;
  approved_at?: Date;
  activated_at?: Date;
  started_at?: Date;
  expires_at?: Date;
  
  // Revocation
  revoked_by?: Types.ObjectId;
  revoked_at?: Date;
  revocation_reason?: string;
  
  // Emergency Break-Glass (Policy A)
  is_emergency: boolean;
  is_single_admin_emergency?: boolean;
  emergency_approver_two?: Types.ObjectId;
  emergency_approved_at?: Date;
  notification_job_id?: Types.ObjectId;
  notification_dispatched_at?: Date;
  auto_expired_by_sweep?: boolean;
  expired_at?: Date;

  created_at: Date;
  updated_at: Date;
}

const SupportAccessRequestSchema = new Schema<ISupportAccessRequest>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticket_id: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
    scope: {
      type: String,
      enum: ['diagnostics_readonly', 'config_write'],
      required: true,
      default: 'diagnostics_readonly',
    },
    reason: { type: String, trim: true },
    justification: { type: String, trim: true },
    duration_minutes: { type: Number, required: true, default: 60, max: 120 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'rejected', 'revoked', 'expired'],
      default: 'pending',
      index: true,
    },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    activated_at: { type: Date },
    started_at: { type: Date },
    expires_at: { type: Date, index: true },
    expired_at: { type: Date },
    auto_expired_by_sweep: { type: Boolean, default: false },
    revoked_by: { type: Schema.Types.ObjectId, ref: 'User' },
    revoked_at: { type: Date },
    revocation_reason: { type: String, trim: true },

    is_emergency: { type: Boolean, default: false, index: true },
    is_single_admin_emergency: { type: Boolean, default: false },
    emergency_approver_two: { type: Schema.Types.ObjectId, ref: 'User' },
    emergency_approved_at: { type: Date },
    notification_job_id: { type: Schema.Types.ObjectId, ref: 'NotificationJob' },
    notification_dispatched_at: { type: Date },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

SupportAccessRequestSchema.pre('validate', function (next) {
  if (!this.reason && this.justification) {
    this.reason = this.justification;
  }
  if (!this.justification && this.reason) {
    this.justification = this.reason;
  }
  if (!this.reason) {
    return next(new Error('reason or justification is required for support access requests.'));
  }
  next();
});

// Partial unique index: at most ONE active emergency session per tenant
SupportAccessRequestSchema.index(
  { company_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active',
      is_emergency: true,
    },
    name: 'unique_active_emergency_session_per_tenant',
  }
);

// Compound index for instant verification in middleware (< 2ms lookup target)
SupportAccessRequestSchema.index({ _id: 1, company_id: 1, status: 1 });
SupportAccessRequestSchema.index({ company_id: 1, status: 1 });

export const SupportAccessRequest = mongoose.model<ISupportAccessRequest>(
  'SupportAccessRequest',
  SupportAccessRequestSchema
);
