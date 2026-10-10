/**
 * ============================================================================
 * FLEET FLOW — FLEET MAINTENANCE & WORK ORDER MODEL (MaintenanceOrder.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Tracks garage work orders, preventative service job cards, breakdown repairs,
 * spare parts, and mechanical downtime for commercial fleet vehicles.
 * 
 * CORE FEATURES:
 * --------------
 * - Itemized cost tracking: Spare parts, labor charges, and GST tax lines.
 * - Automatic vehicle status synchronization: Flags truck as `in_maintenance`
 *   to prevent accidental trip dispatch, and returns to `available` upon completion.
 * - Automatic double-entry accounting posting: Posts to General Ledger under
 *   `vehicle_maintenance` upon work order completion.
 * - Odometer interval recalibration: Automatically advances vehicle's
 *   `next_service_due_kms`.
 * - Multi-tenant isolation enforced via `tenantPlugin`.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type MaintenanceOrderType =
  | 'preventative_service'
  | 'breakdown_repair'
  | 'tyre_replacement'
  | 'accidental'
  | 'statutory_fitness';

export type MaintenanceOrderStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IMaintenanceLineItem {
  description: string;
  part_cost: number;
  labor_cost: number;
  tax_amount: number;
  total: number;
}

export interface IMaintenanceOrder extends Document {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  work_order_no: string;
  truck_id: Types.ObjectId;
  vendor_name: string;
  vendor_invoice_no?: string;
  order_type: MaintenanceOrderType;
  priority: MaintenancePriority;
  status: MaintenanceOrderStatus;
  odometer_kms_at_service: number;
  next_service_due_kms?: number;
  start_date: Date;
  completed_date?: Date;
  downtime_hours: number;
  line_items: IMaintenanceLineItem[];
  total_part_cost: number;
  total_labor_cost: number;
  total_tax: number;
  total_amount: number;
  notes?: string;
  ledger_entry_id?: Types.ObjectId;
  created_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const MaintenanceLineItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    part_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    labor_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const MaintenanceOrderSchema = new Schema<IMaintenanceOrder>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    work_order_no: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    truck_id: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
      index: true,
    },
    vendor_name: {
      type: String,
      required: true,
      trim: true,
    },
    vendor_invoice_no: {
      type: String,
      trim: true,
    },
    order_type: {
      type: String,
      enum: [
        'preventative_service',
        'breakdown_repair',
        'tyre_replacement',
        'accidental',
        'statutory_fitness',
      ],
      default: 'preventative_service',
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'in_progress',
      index: true,
    },
    odometer_kms_at_service: {
      type: Number,
      required: true,
      min: 0,
    },
    next_service_due_kms: {
      type: Number,
      min: 0,
    },
    start_date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    completed_date: {
      type: Date,
    },
    downtime_hours: {
      type: Number,
      default: 0,
      min: 0,
    },
    line_items: {
      type: [MaintenanceLineItemSchema],
      default: [],
    },
    total_part_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_labor_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    ledger_entry_id: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound Indexes for fast querying & uniqueness
MaintenanceOrderSchema.index({ company_id: 1, work_order_no: 1 }, { unique: true });
MaintenanceOrderSchema.index({ company_id: 1, truck_id: 1, status: 1 });
MaintenanceOrderSchema.index({ company_id: 1, start_date: -1 });

// Tenant isolation plugin
MaintenanceOrderSchema.plugin(tenantPlugin);

export const MaintenanceOrder = mongoose.model<IMaintenanceOrder>('MaintenanceOrder', MaintenanceOrderSchema);
