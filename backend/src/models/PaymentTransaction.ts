/**
 * ============================================================================
 * FLEET FLOW — PAYMENT TRANSACTION & INVOICE SCHEMA (PaymentTransaction.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Persistent audit ledger of all commercial SaaS payment transactions,
 * Razorpay orders, credit card / UPI authorizations, and generated GST tax invoices.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaymentTransaction extends Document {
  company_id: Types.ObjectId;
  subscription_id?: Types.ObjectId;
  plan_id?: Types.ObjectId;
  order_id: string;
  payment_id?: string;
  amount_paise: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  payment_method?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'bank_transfer' | 'simulated';
  billing_cycle: 'monthly' | 'annual';
  promo_code?: string;
  discount_paise?: number;
  tax_breakup: {
    subtotal_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    total_paise: number;
    gst_rate_percent: number;
  };
  invoice_number: string;
  invoice_date: Date;
  receipt_url?: string;
  failure_reason?: string;
  notes?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    subscription_id: { type: Schema.Types.ObjectId, ref: 'Subscription', index: true },
    plan_id: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    order_id: { type: String, required: true, unique: true, index: true },
    payment_id: { type: String, index: true },
    amount_paise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    payment_method: { type: String, default: 'card' },
    billing_cycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    promo_code: { type: String },
    discount_paise: { type: Number, default: 0 },
    tax_breakup: {
      subtotal_paise: { type: Number, required: true },
      cgst_paise: { type: Number, default: 0 },
      sgst_paise: { type: Number, default: 0 },
      total_paise: { type: Number, required: true },
      gst_rate_percent: { type: Number, default: 18 },
    },
    invoice_number: { type: String, required: true, unique: true, index: true },
    invoice_date: { type: Date, default: () => new Date() },
    receipt_url: { type: String },
    failure_reason: { type: String },
    notes: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
