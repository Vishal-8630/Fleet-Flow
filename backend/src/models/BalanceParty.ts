/**
 * ============================================================================
 * FLEET FLOW — BALANCE PARTY / SUPPLIER & BROKER MODEL (BalanceParty.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents external suppliers, fleet brokers, market truck owners, sub-contractors,
 * and petrol pumps from whom vehicles, fuel, or logistical services are sourced.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Commission & Freight Balances: Tracks financial balances (`opening_balance` and
 *   `current_balance`) for market hire settlements, diesel slips, and broker commissions.
 * - Banking Coordinates: Stores NEFT/RTGS settlement coordinates (`account_number`,
 *   `ifsc_code`, `bank_name`, `account_holder_name`) for direct vendor payouts.
 * - Multi-Tenant Isolation: Scoped by `company_id` using `tenantPlugin`.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type BalancePartyType = 'supplier' | 'broker' | 'transporter' | 'petrol_pump' | 'other';

export interface IBankDetails {
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  account_holder_name?: string;
}

export interface IBalanceParty extends Document {
  company_id: Types.ObjectId;
  party_name: string;
  party_type: BalancePartyType;
  contact_person?: string;
  phone: string;
  email?: string;
  pan_number?: string;
  bank_details: IBankDetails;
  opening_balance: number;
  current_balance: number;
  status: 'active' | 'inactive';
  is_deleted: boolean;
  custom_fields?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const BankDetailsSchema = new Schema(
  {
    account_number: { type: String, trim: true },
    ifsc_code: { type: String, trim: true, uppercase: true },
    bank_name: { type: String, trim: true },
    account_holder_name: { type: String, trim: true },
  },
  { _id: false }
);

const BalancePartySchema = new Schema<IBalanceParty>(
  {
    party_name: { type: String, required: true, trim: true },
    party_type: {
      type: String,
      enum: ['supplier', 'broker', 'transporter', 'petrol_pump', 'other'],
      default: 'supplier',
    },
    contact_person: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    pan_number: { type: String, trim: true, uppercase: true },
    bank_details: { type: BankDetailsSchema, default: () => ({}) },
    opening_balance: { type: Number, default: 0 },
    current_balance: { type: Number, default: 0 },
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
BalancePartySchema.index({ company_id: 1, party_name: 1 });
BalancePartySchema.index({ company_id: 1, party_type: 1 });
BalancePartySchema.index({ company_id: 1, is_deleted: 1 });
BalancePartySchema.index({ 'custom_fields.$**': 1 });

// Apply Multi-Tenant query filter and auto-tenant attachment
BalancePartySchema.plugin(tenantPlugin);

export const BalanceParty = mongoose.model<IBalanceParty>('BalanceParty', BalancePartySchema);
