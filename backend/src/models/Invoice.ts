/**
 * ============================================================================
 * FLEET FLOW — GST FREIGHT TAX INVOICE MODEL (Invoice.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Official Goods Transport Agency (GTA) Freight Tax Invoice complying with
 * Indian Goods and Services Tax (GST) laws:
 * 
 * KEY FEATURES:
 * -------------
 * - Reverse Charge Mechanism (RCM): Evaluates Section 9(3) GTA provisions
 *   (5% GST payable by registered consignor/consignee, carrier collects 0 tax).
 * - Forward Charge: Auto-calculates Intra-state (CGST + SGST) vs Inter-state (IGST).
 * - Line item aggregation across one or many Lorry Receipts (LRs).
 * - Repeatable extra charges: Halting, loading, unloading, toll, detention.
 * - Payment reconciliation ledger: Tracks partial collections, TDS deductions,
 *   and outstanding balances.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled';
export type InvoiceTaxType = 'rcm' | 'forward_charge' | 'exempt';
export type ExtraChargeType = 'loading' | 'unloading' | 'halting' | 'multi_drop' | 'toll' | 'detention' | 'other';
export type RateType = 'per_tonne' | 'fixed' | 'per_trip';

export interface IInvoiceItem {
  entry_id?: Types.ObjectId;
  lr_no: string;
  lr_date: Date;
  vehicle_no: string;
  from_location: string;
  to_location: string;
  goods_description: string;
  chargeable_weight: number;
  rate: number;
  rate_type: RateType;
  amount: number;
}

export interface IExtraCharge {
  charge_type: ExtraChargeType;
  description: string;
  amount: number;
}

export interface IInvoicePayment {
  _id?: Types.ObjectId;
  date: Date;
  amount: number;
  tds_amount?: number;
  payment_mode: 'bank_transfer' | 'cheque' | 'upi' | 'cash' | 'tds';
  reference_number?: string;
  notes?: string;
}

export interface IInvoice extends Document {
  company_id: Types.ObjectId;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;

  // Billing Party (Shipper)
  billing_party_id: Types.ObjectId;
  billing_party_snapshot: {
    name: string;
    gstin?: string;
    pan?: string;
    address?: string;
    city?: string;
    state?: string;
    state_code?: string;
  };

  // Associated LRs and itemized charges
  lr_ids: Types.ObjectId[];
  items: IInvoiceItem[];
  extra_charges: IExtraCharge[];

  // Mathematical Totals
  subtotal: number;
  tax_type: InvoiceTaxType;
  is_rcm: boolean;
  place_of_supply: string;
  place_of_supply_code?: string;
  is_interstate: boolean;

  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;

  paid_amount: number;
  balance_amount: number;
  status: InvoiceStatus;

  payment_history: IInvoicePayment[];
  notes?: string;
  terms_and_conditions?: string;

  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    invoice_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    invoice_date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    due_date: {
      type: Date,
      required: true,
    },

    billing_party_id: {
      type: Schema.Types.ObjectId,
      ref: 'BillingParty',
      required: true,
      index: true,
    },
    billing_party_snapshot: {
      name: { type: String, required: true, trim: true },
      gstin: { type: String, trim: true, uppercase: true },
      pan: { type: String, trim: true, uppercase: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      state_code: { type: String, trim: true },
    },

    lr_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Entry',
      },
    ],

    items: [
      {
        entry_id: { type: Schema.Types.ObjectId, ref: 'Entry' },
        lr_no: { type: String, required: true, trim: true },
        lr_date: { type: Date, default: Date.now },
        vehicle_no: { type: String, required: true, trim: true },
        from_location: { type: String, required: true, trim: true },
        to_location: { type: String, required: true, trim: true },
        goods_description: { type: String, required: true, trim: true },
        chargeable_weight: { type: Number, default: 0 },
        rate: { type: Number, required: true, min: 0 },
        rate_type: {
          type: String,
          enum: ['per_tonne', 'fixed', 'per_trip'],
          default: 'fixed',
        },
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    extra_charges: [
      {
        charge_type: {
          type: String,
          enum: ['loading', 'unloading', 'halting', 'multi_drop', 'toll', 'detention', 'other'],
          required: true,
        },
        description: { type: String, trim: true },
        amount: { type: Number, required: true },
      },
    ],

    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tax_type: {
      type: String,
      enum: ['rcm', 'forward_charge', 'exempt'],
      default: 'rcm',
      required: true,
    },
    is_rcm: {
      type: Boolean,
      default: true,
      required: true,
    },
    place_of_supply: {
      type: String,
      required: true,
      trim: true,
    },
    place_of_supply_code: {
      type: String,
      trim: true,
    },
    is_interstate: {
      type: Boolean,
      default: false,
    },

    cgst_rate: { type: Number, default: 0 },
    cgst_amount: { type: Number, default: 0 },
    sgst_rate: { type: Number, default: 0 },
    sgst_amount: { type: Number, default: 0 },
    igst_rate: { type: Number, default: 0 },
    igst_amount: { type: Number, default: 0 },
    total_tax: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, min: 0 },

    paid_amount: { type: Number, default: 0, min: 0 },
    balance_amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'],
      default: 'issued',
      index: true,
    },

    payment_history: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true, min: 0 },
        tds_amount: { type: Number, default: 0 },
        payment_mode: {
          type: String,
          enum: ['bank_transfer', 'cheque', 'upi', 'cash', 'tds'],
          default: 'bank_transfer',
        },
        reference_number: { type: String, trim: true },
        notes: { type: String, trim: true },
      },
    ],

    notes: { type: String, trim: true },
    terms_and_conditions: { type: String, trim: true },

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

// Compound unique index per tenant company
InvoiceSchema.index({ company_id: 1, invoice_number: 1 }, { unique: true });
InvoiceSchema.index({ company_id: 1, invoice_date: -1 });
InvoiceSchema.index({ company_id: 1, status: 1 });

// Multi-tenant isolation plugin
InvoiceSchema.plugin(tenantPlugin);

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
