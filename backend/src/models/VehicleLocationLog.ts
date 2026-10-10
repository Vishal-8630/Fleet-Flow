/**
 * ============================================================================
 * VEHICLE LOCATION LOG MODEL (VehicleLocationLog.ts)
 * ============================================================================
 * Time-series GPS telemetry records for live fleet tracking. Supports AIS-140
 * compliant GPS pings, OBD-II data streams, and driver smartphone fallback GPS.
 * Each document represents a single recorded position of a vehicle at a moment.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface IVehicleLocationLog extends Document {
  company_id: Types.ObjectId;
  truck_id: Types.ObjectId;
  journey_id?: Types.ObjectId;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading_degrees: number;
  ignition_on: boolean;
  odometer_kms?: number;
  altitude_m?: number;
  accuracy_m?: number;
  source: 'ais140' | 'obd' | 'wheelsye' | 'loconav' | 'driver_app' | 'manual' | 'gps_device';
  landmark?: string; // Reverse-geocoded human-readable landmark
  recorded_at: Date;
  created_at: Date;
}

const VehicleLocationLogSchema = new Schema<IVehicleLocationLog>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    truck_id: { type: Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    journey_id: { type: Schema.Types.ObjectId, ref: 'TruckJourney', index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed_kmh: { type: Number, default: 0, min: 0 },
    heading_degrees: { type: Number, default: 0, min: 0, max: 360 },
    ignition_on: { type: Boolean, default: true },
    odometer_kms: { type: Number },
    altitude_m: { type: Number },
    accuracy_m: { type: Number },
    source: {
      type: String,
      enum: ['ais140', 'obd', 'wheelsye', 'loconav', 'driver_app', 'manual', 'gps_device'],
      default: 'driver_app',
    },
    landmark: { type: String, trim: true },
    recorded_at: { type: Date, required: true, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'vehicle_location_logs' }
);

// Compound index for efficient time-series queries per truck
VehicleLocationLogSchema.index({ truck_id: 1, recorded_at: -1 });
VehicleLocationLogSchema.index({ journey_id: 1, recorded_at: 1 });

VehicleLocationLogSchema.plugin(tenantPlugin);

export const VehicleLocationLog = mongoose.model<IVehicleLocationLog>(
  'VehicleLocationLog',
  VehicleLocationLogSchema
);
