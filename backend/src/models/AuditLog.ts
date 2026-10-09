/**
 * ============================================================================
 * FLEET FLOW — OPERATIONAL AUDIT LOG MODEL (AuditLog.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores an immutable, regulatory-compliant audit trail capturing every write,
 * update, delete, and financial state transition executed across tenant operations.
 * 
 * INVARIANTS:
 * -----------
 * - Strictly append-only (no updates or deletes permitted).
 * - Records actor identification, role, IP address, and state snapshots.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
export type AuditEntityType =
  | 'journey'
  | 'entry'
  | 'invoice'
  | 'settlement'
  | 'truck'
  | 'driver'
  | 'party'
  | 'company_settings';

export interface IAuditLog extends Document {
  company_id: Types.ObjectId;
  entity_type: AuditEntityType;
  entity_id: Types.ObjectId;
  entity_identifier?: string; // e.g. "LR-0001", "JRN-0002", "INV-2026-001"
  action: AuditAction;
  actor_id?: Types.ObjectId;
  actor_name: string;
  actor_role?: string;
  ip_address?: string;
  description: string;
  before_snapshot?: Record<string, any>;
  after_snapshot?: Record<string, any>;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    entity_type: {
      type: String,
      enum: ['journey', 'entry', 'invoice', 'settlement', 'truck', 'driver', 'party', 'company_settings'],
      required: true,
      index: true,
    },
    entity_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entity_identifier: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'],
      required: true,
      index: true,
    },
    actor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actor_name: {
      type: String,
      required: true,
      trim: true,
    },
    actor_role: {
      type: String,
      trim: true,
    },
    ip_address: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    before_snapshot: {
      type: Schema.Types.Mixed,
    },
    after_snapshot: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Compound indexes for rapid lookup by entity and company
AuditLogSchema.index({ company_id: 1, entity_type: 1, entity_id: 1, created_at: -1 });
AuditLogSchema.index({ company_id: 1, created_at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
