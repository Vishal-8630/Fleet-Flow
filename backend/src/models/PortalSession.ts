/**
 * ============================================================================
 * PORTAL SESSION MODEL (PortalSession.ts)
 * ============================================================================
 * Manages temporary OTP codes and JWT sessions for external stakeholder portals
 * (customers, drivers, vendors). These are separate from internal employee
 * CompanyMember authentication and carry strict entity-level scope.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type PortalType = 'customer' | 'driver' | 'vendor';

export interface IPortalSession extends Document {
  portal_type: PortalType;
  entity_id: Types.ObjectId;  // BillingParty, Driver, or BalanceParty ID
  company_id: Types.ObjectId;
  phone?: string;
  email?: string;
  otp_hash?: string;            // bcrypt hash of 6-digit OTP
  otp_expires_at?: Date;
  otp_attempts: number;
  is_verified: boolean;
  jwt_token?: string;
  expires_at: Date;
  created_at: Date;
}

const PortalSessionSchema = new Schema<IPortalSession>(
  {
    portal_type: { type: String, enum: ['customer', 'driver', 'vendor'], required: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    otp_hash: { type: String },
    otp_expires_at: { type: Date },
    otp_attempts: { type: Number, default: 0 },
    is_verified: { type: Boolean, default: false },
    jwt_token: { type: String },
    expires_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'portal_sessions' }
);

// TTL index: auto-expire sessions
PortalSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
PortalSessionSchema.index({ entity_id: 1, portal_type: 1 });

export const PortalSession = mongoose.model<IPortalSession>('PortalSession', PortalSessionSchema);
