/**
 * ============================================================================
 * FLEET FLOW — MARKET VEHICLE ENTRY MODEL (VehicleEntry.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Manages movements performed by third-party hired/brokerage vehicles ("Market Trucks")
 * where the company acts as a freight contractor or freight broker rather than using
 * its own fleet assets.
 * 
 * WHY IS THIS CRITICAL?
 * ---------------------
 * Logistics enterprises regularly hire market vehicles from vendor transporters
 * (Balance Parties) to fulfill high shipper demand:
 * - Commercial agreements involve deductions (commission/kamisan, dala/loading)
 *   and additions (halting/demurrage charges).
 * - Net balance payable to the vehicle supplier is calculated strictly as:
 *   Net Balance = Freight - Driver Advance - Diesel Advance - Dala - Commission + Halting
 * - Proof of Delivery (POD) tracking governs release of final freight payment.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type MarketPaymentStatus = 'pending' | 'partially_paid' | 'paid';

export interface IVehicleEntry extends Document {
  company_id: Types.ObjectId;
  entry_number: string;
  entry_date: Date;

  // Third-party vehicle & driver information
  vehicle_number: string;
  driver_name?: string;
  driver_phone?: string;

  // Origin & Destination
  from_location: string;
  to_location: string;

  // Commercial Associations
  balance_party_id: Types.ObjectId; // Ref BalanceParty (The vendor/truck supplier)
  billing_party_id?: Types.ObjectId; // Ref BillingParty (The shipper customer)

  // Material & Weight
  material_description?: string;
  weight_tonnes?: number;

  // Financial Ledger Structure
  freight_amount: number;
  driver_cash_advance: number;
  diesel_advance_amount: number;
  dala_charges: number; // Deductions for loading/dala
  kamisan_amount: number; // Brokerage / commission deduction
  halting_amount: number; // Demurrage / waiting compensation
  net_balance_due: number; // Computed balance payable to supplier

  // Payment & Settlement State
  status: MarketPaymentStatus;
  paid_amount: number;

  // Proof of Delivery (POD)
  pod_received: boolean;
  pod_stock_date?: Date;
  pod_document_url?: string;

  notes?: string;
  is_deleted: boolean;
}

const VehicleEntrySchema = new Schema<IVehicleEntry>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    entry_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    entry_date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    vehicle_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    driver_name: {
      type: String,
      trim: true,
    },
    driver_phone: {
      type: String,
      trim: true,
    },

    from_location: {
      type: String,
      required: true,
      trim: true,
    },
    to_location: {
      type: String,
      required: true,
      trim: true,
    },

    balance_party_id: {
      type: Schema.Types.ObjectId,
      ref: 'BalanceParty',
      required: true,
      index: true,
    },
    billing_party_id: {
      type: Schema.Types.ObjectId,
      ref: 'BillingParty',
      index: true,
    },

    material_description: {
      type: String,
      trim: true,
    },
    weight_tonnes: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Financial Breakdown
    freight_amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    driver_cash_advance: {
      type: Number,
      default: 0,
      min: 0,
    },
    diesel_advance_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dala_charges: {
      type: Number,
      default: 0,
      min: 0,
    },
    kamisan_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    halting_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    net_balance_due: {
      type: Number,
      default: 0,
    },

    // Payment state
    status: {
      type: String,
      enum: ['pending', 'partially_paid', 'paid'],
      default: 'pending',
      index: true,
    },
    paid_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // POD
    pod_received: {
      type: Boolean,
      default: false,
      index: true,
    },
    pod_stock_date: {
      type: Date,
    },
    pod_document_url: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
    },
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

// Compound unique index per tenant
VehicleEntrySchema.index({ company_id: 1, entry_number: 1 }, { unique: true });

// Multi-tenant plugin
VehicleEntrySchema.plugin(tenantPlugin);

/**
 * Pre-validate / Pre-save hook to calculate net balance due
 * Net = Freight - Driver Cash - Diesel Advance - Dala - Commission (Kamisan) + Halting
 */
VehicleEntrySchema.pre('save', function (next) {
  const freight = this.freight_amount || 0;
  const cash = this.driver_cash_advance || 0;
  const diesel = this.diesel_advance_amount || 0;
  const dala = this.dala_charges || 0;
  const kamisan = this.kamisan_amount || 0;
  const halting = this.halting_amount || 0;

  this.net_balance_due = Math.max(0, freight - cash - diesel - dala - kamisan + halting);

  // If paid amount equals or exceeds net balance due, update status
  if (this.paid_amount >= this.net_balance_due && this.net_balance_due > 0) {
    this.status = 'paid';
  } else if (this.paid_amount > 0 && this.paid_amount < this.net_balance_due) {
    this.status = 'partially_paid';
  } else if (this.paid_amount === 0) {
    this.status = 'pending';
  }

  next();
});

export const VehicleEntry = mongoose.model<IVehicleEntry>('VehicleEntry', VehicleEntrySchema);
