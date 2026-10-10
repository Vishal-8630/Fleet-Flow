/**
 * ============================================================================
 * FLEET FLOW — PLATFORM AUDIT LOG SCHEMA (PlatformAuditLog.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores immutable compliance audit events performed by platform super-administrators
 * across tenants (e.g. support impersonation sessions, quota overrides, plan tier
 * edits, and manual subscription status modifications).
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPlatformAuditLog extends Document {
  actor_user_id: Types.ObjectId;
  actor_email: string;
  action:
    | 'impersonate_tenant'
    | 'exit_impersonation'
    | 'quota_override'
    | 'trial_extension'
    | 'subscription_status_override'
    | 'plan_modified'
    | 'addon_modified';
  target_company_id?: Types.ObjectId;
  target_company_name?: string;
  ip_address?: string;
  user_agent?: string;
  details: Record<string, any>;
  created_at: Date;
}

const PlatformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    actor_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor_email: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'impersonate_tenant',
        'exit_impersonation',
        'quota_override',
        'trial_extension',
        'subscription_status_override',
        'plan_modified',
        'addon_modified',
      ],
      index: true,
    },
    target_company_id: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    target_company_name: { type: String },
    ip_address: { type: String },
    user_agent: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const PlatformAuditLog = mongoose.model<IPlatformAuditLog>('PlatformAuditLog', PlatformAuditLogSchema);
