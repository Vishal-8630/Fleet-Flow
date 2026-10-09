/**
 * ============================================================================
 * FLEET FLOW — DRIVER TRIP SETTLEMENT MODEL (Settlement.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents an immutable financial settlement reconciling one or multiple completed
 * journeys for a commercial driver across a pay period:
 * 
 * MATHEMATICAL RECONCILIATION FORMULA:
 * ------------------------------------
 * Driver Gross Earnings = (Total KMs × Rate Per KM) + Approved En-Route Reimbursements
 * Driver Deductions     = Starting Advances + Additional Cash + Diesel Mileage Penalty
 * Net Settlement        = Gross Earnings - Deductions
 * 
 * If Net > 0: Transport company pays driver (Payable).
 * If Net < 0: Driver owes company from excess advances (Receivable).
 * 
 * ACID ATOMICITY:
 * ---------------
 * Executed inside MongoDB transactions to ensure journeys are locked, driver balances
 * are reset, and ledger entries are generated with 100% idempotency.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type SettlementType = 'payable_to_driver' | 'receivable_from_driver' | 'settled_even';
export type SettlementPaymentStatus = 'unpaid' | 'paid';

export interface IJourneySettlementSnapshot {
  journey_id: Types.ObjectId;
  journey_number: string;
  from_city: string;
  to_city: string;
  distance_kms: number;
  start_date: Date;
  end_date?: Date;
  advances_received: number;
  reimbursements_claimed: number;
  actual_diesel_litres: number;
  actual_mileage: number;
}

export interface ISettlement extends Document {
  company_id: Types.ObjectId;
  settlement_number: string;
  settlement_date: Date;

  // Driver details
  driver_id: Types.ObjectId;
  driver_snapshot: {
    name: string;
    phone: string;
    license_number: string;
  };

  // Reconciled Journeys
  journey_ids: Types.ObjectId[];
  journey_breakdowns: IJourneySettlementSnapshot[];

  // Mileage & Gross Earnings
  total_kms: number;
  rate_per_km: number;
  base_earnings: number;
  total_reimbursements: number;
  gross_earnings: number;

  // Advances & Deductions
  total_advances: number;
  benchmark_mileage: number;
  fuel_variance_penalty: number;
  other_deductions: number;
  other_deductions_notes?: string;
  total_deductions: number;

  // Net Balance
  net_amount: number;
  settlement_type: SettlementType;

  // Settlement payout status
  payment_status: SettlementPaymentStatus;
  payment_date?: Date;
  payment_mode?: 'cash' | 'bank_transfer' | 'upi' | 'cheque';
  payment_ref?: string;

  idempotency_key?: string;
  notes?: string;
  created_by?: Types.ObjectId;

  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    settlement_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    settlement_date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    driver_id: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    driver_snapshot: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true, default: '' },
      license_number: { type: String, trim: true, default: '' },
    },

    journey_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TruckJourney',
      },
    ],
    journey_breakdowns: [
      {
        journey_id: { type: Schema.Types.ObjectId, ref: 'TruckJourney' },
        journey_number: { type: String, required: true },
        from_city: { type: String, required: true },
        to_city: { type: String, required: true },
        distance_kms: { type: Number, default: 0 },
        start_date: { type: Date, required: true },
        end_date: { type: Date },
        advances_received: { type: Number, default: 0 },
        reimbursements_claimed: { type: Number, default: 0 },
        actual_diesel_litres: { type: Number, default: 0 },
        actual_mileage: { type: Number, default: 0 },
      },
    ],

    total_kms: { type: Number, required: true, min: 0 },
    rate_per_km: { type: Number, required: true, min: 0 },
    base_earnings: { type: Number, required: true, min: 0 },
    total_reimbursements: { type: Number, default: 0, min: 0 },
    gross_earnings: { type: Number, required: true, min: 0 },

    total_advances: { type: Number, default: 0, min: 0 },
    benchmark_mileage: { type: Number, default: 4.0 },
    fuel_variance_penalty: { type: Number, default: 0, min: 0 },
    other_deductions: { type: Number, default: 0, min: 0 },
    other_deductions_notes: { type: String, trim: true },
    total_deductions: { type: Number, required: true, min: 0 },

    net_amount: { type: Number, required: true },
    settlement_type: {
      type: String,
      enum: ['payable_to_driver', 'receivable_from_driver', 'settled_even'],
      required: true,
    },

    payment_status: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
      index: true,
    },
    payment_date: { type: Date },
    payment_mode: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'cheque'],
    },
    payment_ref: { type: String, trim: true },

    idempotency_key: {
      type: String,
      trim: true,
      index: true,
    },
    notes: { type: String, trim: true },
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

// Compound unique index per tenant company
SettlementSchema.index({ company_id: 1, settlement_number: 1 }, { unique: true });
SettlementSchema.index({ company_id: 1, settlement_date: -1 });

// Multi-tenant isolation plugin
SettlementSchema.plugin(tenantPlugin);

export const Settlement = mongoose.model<ISettlement>('Settlement', SettlementSchema);
