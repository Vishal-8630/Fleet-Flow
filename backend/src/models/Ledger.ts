/**
 * ============================================================================
 * FLEET FLOW — GENERAL FINANCIAL DOUBLE-ENTRY LEDGER (Ledger.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * The central double-entry general ledger for the transport enterprise. Tracks all
 * operational cash outflows, commercial freight collections, vendor disbursements,
 * and driver settlements across 17 standardized accounting categories.
 * 
 * ACCOUNTING INVARIANTS:
 * ----------------------
 * - Immutability of System Postings: Journal entries flagged `is_auto_generated: true`
 *   (e.g., created by settlements or invoice payments) are locked against direct
 *   mutation or deletion. Adjustments MUST be made via explicit counter-balancing
 *   reversal entries (`is_reversal: true`).
 * - Audit Trail: Preserves full transaction linkage (`journey_id`, `invoice_id`,
 *   `settlement_id`, `vehicle_entry_id`).
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type LedgerCategory =
  | 'freight_income'
  | 'diesel_expense'
  | 'driver_advance'
  | 'driver_settlement'
  | 'halting_charges'
  | 'toll_fastag'
  | 'weighbridge_charges'
  | 'loading_unloading'
  | 'vehicle_maintenance'
  | 'tyre_expense'
  | 'rto_border_tax'
  | 'office_expense'
  | 'payment_received'
  | 'payment_made'
  | 'bank_transfer'
  | 'cash_transfer'
  | 'other_adjustment';

export type LedgerTransactionType =
  | 'journey'
  | 'vehicle_entry'
  | 'settlement'
  | 'invoice_payment'
  | 'manual_adjustment'
  | 'expense';

export type LedgerBalanceType = 'debit' | 'credit';

export type LedgerPaymentMode =
  | 'cash'
  | 'bank'
  | 'upi'
  | 'cheque'
  | 'fuel_card'
  | 'credit'
  | 'system';

export interface ILedger extends Document {
  company_id: Types.ObjectId;
  transaction_number: string;
  transaction_date: Date;

  // Category & Balance
  category: LedgerCategory;
  transaction_type: LedgerTransactionType;
  balance_type: LedgerBalanceType;
  amount: number;

  // Payment Instrument
  payment_mode: LedgerPaymentMode;
  reference_number?: string;
  party_name?: string;
  description: string;

  // Auto-generation & Reversal safeguards
  is_auto_generated: boolean;
  is_reversal: boolean;
  reversed_entry_id?: Types.ObjectId;
  reversal_reason?: string;

  // Entity Relationships
  journey_id?: Types.ObjectId;
  truck_id?: Types.ObjectId;
  driver_id?: Types.ObjectId;
  billing_party_id?: Types.ObjectId;
  balance_party_id?: Types.ObjectId;
  settlement_id?: Types.ObjectId;
  invoice_id?: Types.ObjectId;
  vehicle_entry_id?: Types.ObjectId;

  created_by?: Types.ObjectId;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

const LedgerSchema = new Schema<ILedger>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    transaction_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    transaction_date: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        'freight_income',
        'diesel_expense',
        'driver_advance',
        'driver_settlement',
        'halting_charges',
        'toll_fastag',
        'weighbridge_charges',
        'loading_unloading',
        'vehicle_maintenance',
        'tyre_expense',
        'rto_border_tax',
        'office_expense',
        'payment_received',
        'payment_made',
        'bank_transfer',
        'cash_transfer',
        'other_adjustment',
      ],
      required: true,
      index: true,
    },
    transaction_type: {
      type: String,
      enum: ['journey', 'vehicle_entry', 'settlement', 'invoice_payment', 'manual_adjustment', 'expense'],
      default: 'manual_adjustment',
      required: true,
      index: true,
    },
    balance_type: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    payment_mode: {
      type: String,
      enum: ['cash', 'bank', 'upi', 'cheque', 'fuel_card', 'credit', 'system'],
      default: 'bank',
      required: true,
    },
    reference_number: { type: String, trim: true },
    party_name: { type: String, trim: true },
    description: { type: String, required: true, trim: true },

    is_auto_generated: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_reversal: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversed_entry_id: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
    },
    reversal_reason: { type: String, trim: true },

    journey_id: { type: Schema.Types.ObjectId, ref: 'TruckJourney', index: true },
    truck_id: { type: Schema.Types.ObjectId, ref: 'Truck', index: true },
    driver_id: { type: Schema.Types.ObjectId, ref: 'Driver', index: true },
    billing_party_id: { type: Schema.Types.ObjectId, ref: 'BillingParty', index: true },
    balance_party_id: { type: Schema.Types.ObjectId, ref: 'BalanceParty', index: true },
    settlement_id: { type: Schema.Types.ObjectId, ref: 'Settlement', index: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    vehicle_entry_id: { type: Schema.Types.ObjectId, ref: 'VehicleEntry', index: true },

    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes per tenant company
LedgerSchema.index({ company_id: 1, transaction_number: 1 }, { unique: true });
LedgerSchema.index({ company_id: 1, transaction_date: -1 });
LedgerSchema.index({ company_id: 1, category: 1, transaction_date: -1 });
LedgerSchema.index({ company_id: 1, balance_type: 1 });

// Multi-tenant isolation plugin
LedgerSchema.plugin(tenantPlugin);

export const Ledger = mongoose.model<ILedger>('Ledger', LedgerSchema);
