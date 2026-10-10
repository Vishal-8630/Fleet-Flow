/**
 * ============================================================================
 * FLEET FLOW — IDEMPOTENCY KEY MODEL (IdempotencyKey.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores cached HTTP request-response signatures for financial and commercial
 * state mutations (driver settlements, freight payments, refunds).
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * Network retries or rapid client double-clicks on payment/settlement buttons
 * must never post duplicate ledger journal entries or duplicate payouts.
 * If a request with the same idempotency key is received within 24 hours,
 * the server replays the cached response with `X-Cache: IDEMPOTENT_HIT`.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface IIdempotencyKey extends Document {
  company_id: Types.ObjectId;
  key: string;
  endpoint: string;
  method: string;
  request_hash?: string;
  status_code: number;
  response_body: any;
  expires_at: Date;
  created_at: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    request_hash: {
      type: String,
      trim: true,
    },
    status_code: {
      type: Number,
      required: true,
    },
    response_body: {
      type: Schema.Types.Mixed,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 Hours TTL
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Compound unique index per tenant
IdempotencyKeySchema.index({ company_id: 1, key: 1 }, { unique: true });

// Auto-expire documents after 24 hours via MongoDB TTL index
IdempotencyKeySchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

IdempotencyKeySchema.plugin(tenantPlugin);

export const IdempotencyKey = mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema);
