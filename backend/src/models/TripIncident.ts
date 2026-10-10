/**
 * ============================================================================
 * TRIP INCIDENT MODEL (TripIncident.ts)
 * ============================================================================
 * Records breakdowns, punctures, accidents, police stoppages, and fuel stops
 * reported by drivers during active journeys. Supports photo evidence uploads
 * and dispatcher emergency notification triggers.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type IncidentCategory =
  | 'tyre_puncture'
  | 'engine_breakdown'
  | 'accident'
  | 'police_hold'
  | 'fuel_stop'
  | 'meal_rest'
  | 'route_deviation'
  | 'other';

export interface ITripIncident extends Document {
  company_id: Types.ObjectId;
  journey_id: Types.ObjectId;
  truck_id: Types.ObjectId;
  driver_id?: Types.ObjectId;
  category: IncidentCategory;
  description: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  photo_urls: string[];
  reported_at: Date;
  resolved_at?: Date;
  is_emergency: boolean;
  notification_sent: boolean;
  status: 'open' | 'acknowledged' | 'resolved';
  dispatcher_notes?: string;
  created_at: Date;
  updated_at: Date;
}

const TripIncidentSchema = new Schema<ITripIncident>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    journey_id: { type: Schema.Types.ObjectId, ref: 'TruckJourney', required: true, index: true },
    truck_id: { type: Schema.Types.ObjectId, ref: 'Truck', required: true },
    driver_id: { type: Schema.Types.ObjectId, ref: 'Driver' },
    category: {
      type: String,
      enum: ['tyre_puncture', 'engine_breakdown', 'accident', 'police_hold', 'fuel_stop', 'meal_rest', 'route_deviation', 'other'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    landmark: { type: String, trim: true },
    photo_urls: [{ type: String }],
    reported_at: { type: Date, default: Date.now },
    resolved_at: { type: Date },
    is_emergency: { type: Boolean, default: false },
    notification_sent: { type: Boolean, default: false },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    dispatcher_notes: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'trip_incidents' }
);

TripIncidentSchema.plugin(tenantPlugin);

export const TripIncident = mongoose.model<ITripIncident>('TripIncident', TripIncidentSchema);
