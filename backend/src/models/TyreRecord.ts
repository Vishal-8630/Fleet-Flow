/**
 * ============================================================================
 * FLEET FLOW — TYRE & ASSET WEAR TRACKING MODEL (TyreRecord.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Tracks individual commercial vehicle tyres throughout their operational lifecycle:
 * acquisition, axle mounting positions, tread depth wear inspections, retreading
 * cycles, and scrapping.
 * 
 * CORE FEATURES:
 * --------------
 * - Serial number tracking per company.
 * - Standardized axle positions for 10-wheeler, 6-wheeler, and trailer configurations:
 *   FL1 (Front Left Steer), FR1 (Front Right Steer), RL1_OUTER, RL1_INNER, etc.
 * - Millimeter-precise tread depth history with critical threshold warnings (<= 4mm).
 * - Retread count lifecycle management.
 * - Multi-tenant isolation enforced via `tenantPlugin`.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type TyreStatus = 'in_store' | 'fitted' | 'retread' | 'scrapped';

export type AxlePosition =
  | 'FL1'          // Front Left Steer
  | 'FR1'          // Front Right Steer
  | 'RL1_OUTER'    // Rear Axle 1 Left Outer
  | 'RL1_INNER'    // Rear Axle 1 Left Inner
  | 'RR1_OUTER'    // Rear Axle 1 Right Outer
  | 'RR1_INNER'    // Rear Axle 1 Right Inner
  | 'RL2_OUTER'    // Rear Axle 2 Left Outer
  | 'RL2_INNER'    // Rear Axle 2 Left Inner
  | 'RR2_OUTER'    // Rear Axle 2 Right Outer
  | 'RR2_INNER'    // Rear Axle 2 Right Inner
  | 'SPARE';       // Spare Wheel

export interface ITyreWearLog {
  date: Date;
  odometer_kms: number;
  tread_depth_mm: number;
  inspected_by?: string;
  notes?: string;
}

export interface ITyreRecord extends Document {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  serial_number: string;
  brand: string;
  model_name?: string;
  size: string;
  status: TyreStatus;
  current_truck_id?: Types.ObjectId;
  axle_position?: AxlePosition;
  initial_tread_depth_mm: number;
  current_tread_depth_mm: number;
  purchase_cost: number;
  purchase_date: Date;
  fitted_date?: Date;
  fitted_odometer_kms?: number;
  retread_count: number;
  wear_history: ITyreWearLog[];
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const TyreWearLogSchema = new Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    odometer_kms: {
      type: Number,
      required: true,
      min: 0,
    },
    tread_depth_mm: {
      type: Number,
      required: true,
      min: 0,
    },
    inspected_by: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const TyreRecordSchema = new Schema<ITyreRecord>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    serial_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model_name: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
      default: '295/90 R20',
    },
    status: {
      type: String,
      enum: ['in_store', 'fitted', 'retread', 'scrapped'],
      default: 'in_store',
      index: true,
    },
    current_truck_id: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      index: true,
    },
    axle_position: {
      type: String,
      enum: [
        'FL1',
        'FR1',
        'RL1_OUTER',
        'RL1_INNER',
        'RR1_OUTER',
        'RR1_INNER',
        'RL2_OUTER',
        'RL2_INNER',
        'RR2_OUTER',
        'RR2_INNER',
        'SPARE',
      ],
    },
    initial_tread_depth_mm: {
      type: Number,
      required: true,
      min: 0,
      default: 15.0,
    },
    current_tread_depth_mm: {
      type: Number,
      required: true,
      min: 0,
      default: 15.0,
    },
    purchase_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchase_date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    fitted_date: {
      type: Date,
    },
    fitted_odometer_kms: {
      type: Number,
      min: 0,
    },
    retread_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    wear_history: {
      type: [TyreWearLogSchema],
      default: [],
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

// Compound Indexes for fast lookups & unique tyre serials per company
TyreRecordSchema.index({ company_id: 1, serial_number: 1 }, { unique: true });
TyreRecordSchema.index({ company_id: 1, current_truck_id: 1, axle_position: 1 });
TyreRecordSchema.index({ company_id: 1, status: 1 });

// Tenant isolation plugin
TyreRecordSchema.plugin(tenantPlugin);

export const TyreRecord = mongoose.model<ITyreRecord>('TyreRecord', TyreRecordSchema);
