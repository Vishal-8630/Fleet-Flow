/**
 * ============================================================================
 * FLEET FLOW — BILLING PARTY / CUSTOMER MODEL (BillingParty.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents corporate clients, freight shippers, consignors, and consignees who
 * contract transport movements and receive Lorry Receipts (LRs) and Tax Invoices.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - GST Compliance: Stores 15-character statutory GSTIN with uppercase normalization
 *   and format validation to guarantee proper E-Way Bill and tax invoice generation.
 * - Commercial Safeguards: Tracks `credit_limit` and `payment_terms_days` (defaults
 *   to 30 days) to prevent over-extension of freight credit.
 * - Multi-Tenant Isolation: Scoped by `company_id` using `tenantPlugin`.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface IBillingAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  state_code?: string;
}

export interface IBillingParty extends Document {
  company_id: Types.ObjectId;
  name: string;
  trade_name?: string;
  gstin?: string;
  pan_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  billing_address: IBillingAddress;
  payment_terms_days: number;
  credit_limit: number;
  outstanding_receivables: number;
  status: 'active' | 'inactive';
  is_deleted: boolean;
  custom_fields?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const BillingAddressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    state_code: { type: String, trim: true },
  },
  { _id: false }
);

const BillingPartySchema = new Schema<IBillingParty>(
  {
    name: { type: String, required: true, trim: true },
    trade_name: { type: String, trim: true },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      match: [
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        'Please provide a valid 15-digit Indian GSTIN format (e.g. 27ABCDE1234F1Z5)',
      ],
    },
    pan_number: { type: String, trim: true, uppercase: true },
    contact_person: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    billing_address: { type: BillingAddressSchema, default: () => ({}) },
    payment_terms_days: { type: Number, default: 30, min: 0 },
    credit_limit: { type: Number, default: 0, min: 0 },
    outstanding_receivables: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    is_deleted: { type: Boolean, default: false, index: true },
    custom_fields: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// High performance indices
BillingPartySchema.index({ company_id: 1, name: 1 });
BillingPartySchema.index({ company_id: 1, gstin: 1 });
BillingPartySchema.index({ company_id: 1, is_deleted: 1 });
BillingPartySchema.index({ 'custom_fields.$**': 1 });

// Apply Multi-Tenant query filter and auto-tenant attachment
BillingPartySchema.plugin(tenantPlugin);

export const BillingParty = mongoose.model<IBillingParty>('BillingParty', BillingPartySchema);
