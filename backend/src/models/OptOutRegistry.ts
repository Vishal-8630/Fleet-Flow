/**
 * ============================================================================
 * FLEET FLOW — RECIPIENT OPT-OUT & DND REGISTRY (OptOutRegistry.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores an audit record of customer, driver, or vendor opt-outs (DND) across
 * messaging channels (WhatsApp, SMS) to prevent unsolicited automated messaging,
 * complying with Meta WhatsApp Business Policies and telecom regulations.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type OptOutChannel = 'whatsapp' | 'sms' | 'email';
export type OptOutReason = 'INBOUND_STOP' | 'USER_UNSUBSCRIBE' | 'ADMIN_PREFERENCE' | 'SPAM_REPORT';

export interface IOptOutRegistry extends Document {
  company_id?: Types.ObjectId; // Optional: can be tenant-scoped or global
  phone?: string;
  email?: string;
  channel: OptOutChannel;
  reason: OptOutReason;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const OptOutRegistrySchema = new Schema<IOptOutRegistry>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'email'],
      default: 'whatsapp',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['INBOUND_STOP', 'USER_UNSUBSCRIBE', 'ADMIN_PREFERENCE', 'SPAM_REPORT'],
      default: 'INBOUND_STOP',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound indexes for fast DND checking before dispatching
OptOutRegistrySchema.index({ phone: 1, channel: 1 });
OptOutRegistrySchema.index({ email: 1, channel: 1 });

export const OptOutRegistry = mongoose.model<IOptOutRegistry>('OptOutRegistry', OptOutRegistrySchema);

/**
 * Checks whether a phone or email has opted out of automated notifications on a specific channel
 */
export async function isRecipientOptedOut(phoneOrEmail?: string, channel = 'whatsapp'): Promise<boolean> {
  if (!phoneOrEmail) return false;
  const cleaned = phoneOrEmail.replace(/[^0-9]/g, '');
  const normalized = cleaned.length === 10 ? `91${cleaned}` : cleaned;

  const optOut = await OptOutRegistry.findOne({
    $or: [
      { phone: normalized, channel },
      { phone: phoneOrEmail, channel },
      { email: phoneOrEmail.toLowerCase(), channel },
    ],
  }).lean();

  return Boolean(optOut);
}
