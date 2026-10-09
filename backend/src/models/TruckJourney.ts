/**
 * ============================================================================
 * FLEET FLOW — TRUCK JOURNEY & TRIP DISPATCH MODEL (TruckJourney.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents an operational freight journey performed by a company-owned commercial
 * vehicle and an assigned professional driver.
 * 
 * KEY OPERATIONAL RESPONSIBILITIES:
 * ---------------------------------
 * 1. Journey Planning & Lifecycle:
 *    - Transitions through `draft` -> `active` -> `completed` (or `delayed`/`cancelled`).
 *    - Logs chronological `status_history` audit records for compliance.
 * 2. Resource Conflict Safeguards:
 *    - Validates that the assigned Truck and Driver cannot be concurrently dispatched
 *      on another active journey.
 * 3. Daily Milestones & En-Route Progress:
 *    - Tracks chronological checkpoints, daily location updates, and transit delays.
 * 4. Comprehensive Fuel Engine (Diesel Tracking):
 *    - Captures diesel fuel stops, quantities in litres, rates per litre, pump names,
 *      and receipt slip attachments.
 *    - Dynamically calculates vehicle fuel economy (km per litre mileage).
 * 5. Driver Cash Advances & En-Route Expenditures:
 *    - Records toll, weighbridge, food allowances, and emergency maintenance.
 * 6. Proof of Delivery (POD) Closeout:
 *    - Uploads consignee signed acknowledgement slip, validates final odometer,
 *      and marks delivery completion to unlock billing.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type JourneyStatus = 'draft' | 'active' | 'completed' | 'delayed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'delivered' | 'rejected';
export type FuelPaymentMode = 'cash' | 'fuel_card' | 'credit';
export type DelayReason = 'breakdown' | 'traffic' | 'weather' | 'rto_check' | 'other';
export type IncidentSeverity = 'minor' | 'critical';
export type DriverExpenseType =
  | 'toll'
  | 'loading'
  | 'unloading'
  | 'weighbridge'
  | 'rto_border'
  | 'minor_repair'
  | 'food_allowance'
  | 'other';

/**
 * Historical status transition entry
 */
export interface IStatusHistoryEntry {
  status: JourneyStatus;
  timestamp: Date;
  note?: string;
  actor_id?: Types.ObjectId;
}

/**
 * Route checkpoint for intermediate stops between origin and destination
 */
export interface IRouteCheckpoint {
  city: string;
  state?: string;
  planned_arrival?: Date;
  actual_arrival?: Date;
  status: 'pending' | 'reached' | 'skipped';
}

/**
 * Daily milestone update logged during vehicle transit
 */
export interface IDailyProgress {
  day_number: number;
  date: Date;
  current_location: string;
  transit_notes?: string;
  updated_by?: Types.ObjectId;
}

/**
 * Logged en-route delay with hours and cause
 */
export interface IDelayRecord {
  location: string;
  date: Date;
  delay_hours: number;
  reason: DelayReason;
  notes?: string;
}

/**
 * En-route safety or vehicle incident
 */
export interface IIncidentRecord {
  date: Date;
  severity: IncidentSeverity;
  description: string;
  financial_impact?: number;
  resolved: boolean;
}

/**
 * En-route diesel fuel fill-up stop
 */
export interface IDieselExpense {
  _id?: Types.ObjectId;
  filling_date: Date;
  petrol_pump_name: string;
  slip_number?: string;
  fuel_quantity_litres: number;
  rate_per_litre: number;
  total_cost: number;
  payment_mode: FuelPaymentMode;
  slip_image_url?: string;
}

/**
 * En-route cash expenditure incurred by the driver
 */
export interface IDriverExpense {
  _id?: Types.ObjectId;
  date: Date;
  expense_type: DriverExpenseType;
  amount: number;
  notes?: string;
  receipt_url?: string;
}

/**
 * Main TruckJourney interface
 */
export interface ITruckJourney extends Document {
  company_id: Types.ObjectId;
  journey_number: string;
  status: JourneyStatus;
  status_history: IStatusHistoryEntry[];

  // Resource allocations
  truck_id: Types.ObjectId;
  driver_id: Types.ObjectId;
  billing_party_id?: Types.ObjectId; // Optional customer for commercial linkage

  // Route & Schedule
  from_location: {
    city: string;
    state?: string;
    hub_name?: string;
  };
  to_location: {
    city: string;
    state?: string;
    hub_name?: string;
  };
  route_checkpoints: IRouteCheckpoint[];
  start_date: Date;
  estimated_duration_days: number;
  scheduled_end_date?: Date;
  actual_end_date?: Date;

  // Odometers & Payload
  start_odometer_kms: number;
  end_odometer_kms?: number;
  total_distance_kms: number;
  loaded_weight_tonnes?: number;
  cbm_volume?: number;
  cargo_description?: string;

  // Commercial & Financials
  freight_rate?: number;
  starting_cash_advance: number;

  // Daily milestones & tracking
  daily_progress: IDailyProgress[];
  last_known_location?: string;
  last_location_updated_at?: Date;
  delays: IDelayRecord[];
  incidents: IIncidentRecord[];

  // En-Route Expenditures
  diesel_expenses: IDieselExpense[];
  driver_expenses: IDriverExpense[];

  // Proof of Delivery & Closeout
  delivery_status: DeliveryStatus;
  delivered_to?: {
    contact_name?: string;
    delivery_timestamp?: Date;
    notes?: string;
  };
  pod_slip_url?: string;
  empty_container_yard_return_date?: Date;

  // Computed Totals (Stored for high-speed indexing & queries)
  total_diesel_litres: number;
  total_diesel_cost: number;
  total_driver_expenses: number;
  actual_mileage_km_per_litre: number;

  // Settlement reconciliation
  is_settled: boolean;
  settlement_id?: Types.ObjectId;

  // Soft delete flag
  is_deleted: boolean;
}

const TruckJourneySchema = new Schema<ITruckJourney>(
  {
    company_id: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    journey_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'delayed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    status_history: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, trim: true },
        actor_id: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    // Resources
    truck_id: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
      index: true,
    },
    driver_id: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    billing_party_id: {
      type: Schema.Types.ObjectId,
      ref: 'BillingParty',
      index: true,
    },

    // Origin and Destination
    from_location: {
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      hub_name: { type: String, trim: true },
    },
    to_location: {
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      hub_name: { type: String, trim: true },
    },
    route_checkpoints: [
      {
        city: { type: String, required: true, trim: true },
        state: { type: String, trim: true },
        planned_arrival: { type: Date },
        actual_arrival: { type: Date },
        status: {
          type: String,
          enum: ['pending', 'reached', 'skipped'],
          default: 'pending',
        },
      },
    ],
    start_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    estimated_duration_days: {
      type: Number,
      default: 2,
      min: 1,
    },
    scheduled_end_date: {
      type: Date,
    },
    actual_end_date: {
      type: Date,
    },

    // Odometer & Load
    start_odometer_kms: {
      type: Number,
      required: true,
      min: 0,
    },
    end_odometer_kms: {
      type: Number,
      min: 0,
    },
    total_distance_kms: {
      type: Number,
      default: 0,
      min: 0,
    },
    loaded_weight_tonnes: {
      type: Number,
      min: 0,
    },
    cbm_volume: {
      type: Number,
      min: 0,
    },
    cargo_description: {
      type: String,
      trim: true,
    },

    // Financial parameters
    freight_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    starting_cash_advance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Daily Milestone updates
    daily_progress: [
      {
        day_number: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        current_location: { type: String, required: true, trim: true },
        transit_notes: { type: String, trim: true },
        updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    last_known_location: {
      type: String,
      trim: true,
    },
    last_location_updated_at: {
      type: Date,
    },

    // En-Route Issues
    delays: [
      {
        location: { type: String, required: true, trim: true },
        date: { type: Date, default: Date.now },
        delay_hours: { type: Number, required: true, min: 0 },
        reason: {
          type: String,
          enum: ['breakdown', 'traffic', 'weather', 'rto_check', 'other'],
          required: true,
        },
        notes: { type: String, trim: true },
      },
    ],
    incidents: [
      {
        date: { type: Date, default: Date.now },
        severity: {
          type: String,
          enum: ['minor', 'critical'],
          default: 'minor',
        },
        description: { type: String, required: true, trim: true },
        financial_impact: { type: Number, default: 0 },
        resolved: { type: Boolean, default: false },
      },
    ],

    // Fuel Stops
    diesel_expenses: [
      {
        filling_date: { type: Date, default: Date.now },
        petrol_pump_name: { type: String, required: true, trim: true },
        slip_number: { type: String, trim: true },
        fuel_quantity_litres: { type: Number, required: true, min: 0 },
        rate_per_litre: { type: Number, required: true, min: 0 },
        total_cost: { type: Number, required: true, min: 0 },
        payment_mode: {
          type: String,
          enum: ['cash', 'fuel_card', 'credit'],
          default: 'credit',
        },
        slip_image_url: { type: String, trim: true },
      },
    ],

    // Driver Cash Expenditures
    driver_expenses: [
      {
        date: { type: Date, default: Date.now },
        expense_type: {
          type: String,
          enum: [
            'toll',
            'loading',
            'unloading',
            'weighbridge',
            'rto_border',
            'minor_repair',
            'food_allowance',
            'other',
          ],
          required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        notes: { type: String, trim: true },
        receipt_url: { type: String, trim: true },
      },
    ],

    // Proof of Delivery
    delivery_status: {
      type: String,
      enum: ['pending', 'delivered', 'rejected'],
      default: 'pending',
      index: true,
    },
    delivered_to: {
      contact_name: { type: String, trim: true },
      delivery_timestamp: { type: Date },
      notes: { type: String, trim: true },
    },
    pod_slip_url: {
      type: String,
      trim: true,
    },
    empty_container_yard_return_date: {
      type: Date,
    },

    // Calculated fields stored on document
    total_diesel_litres: {
      type: Number,
      default: 0,
    },
    total_diesel_cost: {
      type: Number,
      default: 0,
    },
    total_driver_expenses: {
      type: Number,
      default: 0,
    },
    actual_mileage_km_per_litre: {
      type: Number,
      default: 0,
    },

    is_settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settlement_id: {
      type: Schema.Types.ObjectId,
      ref: 'Settlement',
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

// Compound unique index: Journey number is unique per company tenant
TruckJourneySchema.index({ company_id: 1, journey_number: 1 }, { unique: true });

// Multi-tenant isolation plugin
TruckJourneySchema.plugin(tenantPlugin);

/**
 * Pre-validate / Pre-save hook to recalculate summary numbers
 * Computes:
 * - total_distance_kms from (end_odometer_kms - start_odometer_kms)
 * - total_diesel_litres & total_diesel_cost
 * - total_driver_expenses
 * - actual_mileage_km_per_litre
 * - updates last_known_location from latest daily_progress entry
 */
TruckJourneySchema.pre('save', function (next) {
  // 1. Calculate distance if end odometer is available
  if (this.end_odometer_kms && this.end_odometer_kms >= this.start_odometer_kms) {
    this.total_distance_kms = this.end_odometer_kms - this.start_odometer_kms;
  } else {
    this.total_distance_kms = 0;
  }

  // 2. Compute diesel totals
  let litresSum = 0;
  let costSum = 0;
  if (this.diesel_expenses && this.diesel_expenses.length > 0) {
    for (const fuel of this.diesel_expenses) {
      litresSum += fuel.fuel_quantity_litres || 0;
      costSum += fuel.total_cost || 0;
    }
  }
  this.total_diesel_litres = Math.round(litresSum * 100) / 100;
  this.total_diesel_cost = Math.round(costSum * 100) / 100;

  // 3. Compute driver expense totals
  let expenseSum = 0;
  if (this.driver_expenses && this.driver_expenses.length > 0) {
    for (const exp of this.driver_expenses) {
      expenseSum += exp.amount || 0;
    }
  }
  this.total_driver_expenses = Math.round(expenseSum * 100) / 100;

  // 4. Compute mileage (km per litre)
  if (this.total_distance_kms > 0 && this.total_diesel_litres > 0) {
    this.actual_mileage_km_per_litre =
      Math.round((this.total_distance_kms / this.total_diesel_litres) * 100) / 100;
  } else {
    this.actual_mileage_km_per_litre = 0;
  }

  // 5. Update last known location from latest daily_progress if present
  if (this.daily_progress && this.daily_progress.length > 0) {
    const latest = this.daily_progress[this.daily_progress.length - 1];
    this.last_known_location = latest.current_location;
    this.last_location_updated_at = latest.date || new Date();
  } else if (!this.last_known_location && this.from_location?.city) {
    this.last_known_location = `${this.from_location.city} (Origin)`;
    this.last_location_updated_at = this.start_date || new Date();
  }

  next();
});

export const TruckJourney = mongoose.model<ITruckJourney>('TruckJourney', TruckJourneySchema);
