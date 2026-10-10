/**
 * ============================================================================
 * APPROVAL RULE MODEL (ApprovalRule.ts)
 * ============================================================================
 * Configurable approval workflow rules. When a financial operation (driver
 * settlement, credit note, advance) exceeds the configured threshold, it is
 * paused and routed to designated approvers before execution.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type ApprovalEntityType =
  | 'settlement'
  | 'driver_advance'
  | 'credit_note'
  | 'invoice_void'
  | 'payment_receipt';

export interface IApprovalRule extends Document {
  company_id: Types.ObjectId;
  name: string;
  entity_type: ApprovalEntityType;
  threshold_amount_paise: number;
  required_approver_roles: string[];
  required_approver_user_ids?: Types.ObjectId[];
  escalation_timeout_hours: number;
  is_active: boolean;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

export interface IApprovalRequest extends Document {
  company_id: Types.ObjectId;
  rule_id: Types.ObjectId;
  entity_type: ApprovalEntityType;
  entity_id: Types.ObjectId;
  amount_paise: number;
  requester_id: Types.ObjectId;
  requester_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'auto_approved';
  approved_by?: Types.ObjectId;
  approved_at?: Date;
  rejection_reason?: string;
  approval_note?: string;
  escalated_at?: Date;
  notification_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

const ApprovalRuleSchema = new Schema<IApprovalRule>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    entity_type: {
      type: String,
      enum: ['settlement', 'driver_advance', 'credit_note', 'invoice_void', 'payment_receipt'],
      required: true,
    },
    threshold_amount_paise: { type: Number, required: true, min: 0 },
    required_approver_roles: [{ type: String }],
    required_approver_user_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    escalation_timeout_hours: { type: Number, default: 24 },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'approval_rules' }
);

ApprovalRuleSchema.plugin(tenantPlugin);

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    rule_id: { type: Schema.Types.ObjectId, ref: 'ApprovalRule', required: true },
    entity_type: {
      type: String,
      enum: ['settlement', 'driver_advance', 'credit_note', 'invoice_void', 'payment_receipt'],
      required: true,
    },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    amount_paise: { type: Number, required: true },
    requester_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requester_name: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'escalated', 'auto_approved'],
      default: 'pending',
    },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    rejection_reason: { type: String },
    approval_note: { type: String },
    escalated_at: { type: Date },
    notification_sent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'approval_requests' }
);

ApprovalRequestSchema.plugin(tenantPlugin);

export const ApprovalRule = mongoose.model<IApprovalRule>('ApprovalRule', ApprovalRuleSchema);
export const ApprovalRequest = mongoose.model<IApprovalRequest>('ApprovalRequest', ApprovalRequestSchema);
