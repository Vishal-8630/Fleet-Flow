/**
 * ============================================================================
 * FLEET FLOW — LORRY RECEIPT (LR / BILTY) CONSIGNMENT MODEL (Entry.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * The official legal consignment note / Lorry Receipt (LR) generated under the
 * Indian Carriage by Road Act. Represents the contract of carriage between the
 * transport operator, consignor (sender), and consignee (receiver).
 * 
 * KEY FEATURES:
 * -------------
 * - Auto-sequenced `bill_no` and `lr_no` per tenant.
 * - 3-Part printable consignment structure (Consignor, Consignee, Driver/POD copy).
 * - Multi-package specifications: Packaging type, quantity, actual weight,
 *   chargeable weight, CBM volume, declared goods value, risk category.
 * - Customs / Port linkage: Bill of Entry (BE #), Container #, E-Way Bill #.
 * - Commercial terms: 'to_be_billed' | 'paid' | 'to_pay' with agreed freight.
 * - Operational link to `TruckJourney` (optional).
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type LRFreightTerms = 'to_be_billed' | 'paid' | 'to_pay';
export type LRRiskType = 'owner_risk' | 'carrier_risk';
export type LRStatus = 'active' | 'invoiced' | 'cancelled';

export interface ILREntity {
  name: string;
  address?: string;
  gstin?: string;
  phone?: string;
}

export interface IEntry extends Document {
  company_id: Types.ObjectId;
  bill_no: string;
  bill_date: Date;
  lr_no: string;
  lr_date: Date;

  // Commercial billing customer
  billing_party_id?: Types.ObjectId;

  // Shipper & Consignee details
  consignor: ILREntity;
  consignee: ILREntity;

  // Transit Corridor
  vehicle_number: string;
  from_location: string;
  to_location: string;

  // Consignment Specifications
  package_count: number;
  packaging_type: string;
  goods_description: string;
  declared_value: number;
  risk_type: LRRiskType;

  // Weight & Volume
  actual_weight_tonnes: number;
  chargeable_weight_tonnes: number;
  cbm_volume: number;

  // Statutory & Port References
  be_number?: string;
  be_date?: Date;
  container_number?: string;
  invoice_number?: string;
  eway_bill_number?: string;
  empty_yard_name?: string;
  clerk_name?: string;
  remarks?: string;

  // Commercial Terms
  freight_terms: LRFreightTerms;
  freight_amount: number;
  rate_per_tonne?: number;

  // Operational & Billing Linkages
  journey_id?: Types.ObjectId;
  invoice_id?: Types.ObjectId;
  status: LRStatus;

  is_deleted: boolean;
  custom_fields?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    bill_no: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    bill_date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lr_no: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    lr_date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    billing_party_id: {
      type: Schema.Types.ObjectId,
      ref: 'BillingParty',
      index: true,
    },

    consignor: {
      name: { type: String, required: true, trim: true },
      address: { type: String, trim: true, default: '' },
      gstin: { type: String, trim: true, uppercase: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },
    consignee: {
      name: { type: String, required: true, trim: true },
      address: { type: String, trim: true, default: '' },
      gstin: { type: String, trim: true, uppercase: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },

    vehicle_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
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

    package_count: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    packaging_type: {
      type: String,
      required: true,
      trim: true,
      default: 'Bags',
    },
    goods_description: {
      type: String,
      required: true,
      trim: true,
      default: 'General Goods',
    },
    declared_value: {
      type: Number,
      default: 0,
      min: 0,
    },
    risk_type: {
      type: String,
      enum: ['owner_risk', 'carrier_risk'],
      default: 'owner_risk',
    },

    actual_weight_tonnes: {
      type: Number,
      default: 0,
      min: 0,
    },
    chargeable_weight_tonnes: {
      type: Number,
      default: 0,
      min: 0,
    },
    cbm_volume: {
      type: Number,
      default: 0,
      min: 0,
    },

    be_number: { type: String, trim: true },
    be_date: { type: Date },
    container_number: { type: String, trim: true, uppercase: true },
    invoice_number: { type: String, trim: true },
    eway_bill_number: { type: String, trim: true },
    empty_yard_name: { type: String, trim: true },
    clerk_name: { type: String, trim: true },
    remarks: { type: String, trim: true },

    freight_terms: {
      type: String,
      enum: ['to_be_billed', 'paid', 'to_pay'],
      default: 'to_be_billed',
      required: true,
      index: true,
    },
    freight_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rate_per_tonne: {
      type: Number,
      default: 0,
      min: 0,
    },

    journey_id: {
      type: Schema.Types.ObjectId,
      ref: 'TruckJourney',
      index: true,
    },
    invoice_id: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'invoiced', 'cancelled'],
      default: 'active',
      index: true,
    },

    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    custom_fields: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique indexes per tenant company
EntrySchema.index({ company_id: 1, lr_no: 1 }, { unique: true });
EntrySchema.index({ company_id: 1, bill_no: 1 });
EntrySchema.index({ company_id: 1, lr_date: -1 });
EntrySchema.index({ 'custom_fields.$**': 1 });

// Multi-tenant isolation plugin
EntrySchema.plugin(tenantPlugin);

export const Entry = mongoose.model<IEntry>('Entry', EntrySchema);
