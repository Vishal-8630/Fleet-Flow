/**
 * ============================================================================
 * FLEET FLOW — TRUCK & FLEET ASSET MODEL (Truck.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents physical fleet trucks, trailers, tankers, and transport vehicles.
 * Manages mechanical specs, maintenance odometer schedules, driver assignment
 * history, and the 6-document Digital Compliance Vault.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Unique per tenant: `truck_no` is unique per company so different transport
 *   operators can manage identical fleet numbers or state registrations.
 * - Digital Compliance Vault: Holds the 6 statutory Indian commercial vehicle
 *   documents (Fitness, Insurance, National Permit, State Permit, Road Tax, PUC).
 * - Real-Time Compliance Indicator: Automatically calculates whether a vehicle
 *   is `COMPLIANT`, `EXPIRING_SOON` (within 15 days), or `EXPIRED`.
 * - Soft-Deletes: Vehicles removed from service are flagged with `is_deleted: true`
 *   to preserve audit history on past trips, billing receipts, and fuel logs.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type TruckStatus = 'available' | 'on_trip' | 'in_maintenance' | 'decommissioned';
export type BodyType = 'Open' | 'Container' | 'Trailer' | 'Tanker' | 'Flatbed' | 'Tipper';
export type ComplianceStatus = 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED';

export interface IDocumentRecord {
  url?: string;
  key?: string;
  expiry_date?: Date;
  document_number?: string;
  notes?: string;
}

export interface IInsuranceDocument extends IDocumentRecord {
  policy_number?: string;
  insurer_name?: string;
}

export interface IDriverAssignment {
  driver_id: Types.ObjectId;
  assigned_at: Date;
  unassigned_at?: Date;
  notes?: string;
}

export interface ITruck {
  _id?: Types.ObjectId;
  company_id: Types.ObjectId;
  truck_no: string;
  make: string;
  model: string;
  year?: number;
  body_type: BodyType;
  tonnage_capacity: number;
  cbm_capacity?: number;
  
  // Maintenance & Odometer
  current_odometer_kms: number;
  last_service_kms: number;
  service_interval_kms: number;
  next_service_due_kms: number;

  // Active Assignment
  current_driver_id?: Types.ObjectId;
  driver_assignments: IDriverAssignment[];

  // 6 Mandatory Statutory Compliance Documents
  fitness_doc?: IDocumentRecord;
  insurance_doc?: IInsuranceDocument;
  national_permit_doc?: IDocumentRecord;
  state_permit_doc?: IDocumentRecord;
  road_tax_doc?: IDocumentRecord;
  puc_doc?: IDocumentRecord;

  // Status & Lifecycle
  status: TruckStatus;
  is_deleted: boolean;
  compliance_status: ComplianceStatus;
  custom_fields?: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  // Helper method
  calculateComplianceStatus(): ComplianceStatus;
}

const DocumentRecordSchema = new Schema(
  {
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    expiry_date: { type: Date },
    document_number: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const InsuranceDocumentSchema = new Schema(
  {
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    expiry_date: { type: Date },
    policy_number: { type: String, trim: true },
    insurer_name: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const DriverAssignmentSchema = new Schema(
  {
    driver_id: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    assigned_at: { type: Date, default: Date.now },
    unassigned_at: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const TruckSchema = new Schema<ITruck>(
  {
    truck_no: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number },
    body_type: {
      type: String,
      enum: ['Open', 'Container', 'Trailer', 'Tanker', 'Flatbed', 'Tipper'],
      default: 'Open',
    },
    tonnage_capacity: { type: Number, required: true, min: 0 },
    cbm_capacity: { type: Number, min: 0, default: 0 },

    current_odometer_kms: { type: Number, default: 0, min: 0 },
    last_service_kms: { type: Number, default: 0, min: 0 },
    service_interval_kms: { type: Number, default: 10000, min: 1000 },
    next_service_due_kms: { type: Number, default: 10000, min: 0 },

    current_driver_id: { type: Schema.Types.ObjectId, ref: 'Driver' },
    driver_assignments: [DriverAssignmentSchema],

    fitness_doc: DocumentRecordSchema,
    insurance_doc: InsuranceDocumentSchema,
    national_permit_doc: DocumentRecordSchema,
    state_permit_doc: DocumentRecordSchema,
    road_tax_doc: DocumentRecordSchema,
    puc_doc: DocumentRecordSchema,

    status: {
      type: String,
      enum: ['available', 'on_trip', 'in_maintenance', 'decommissioned'],
      default: 'available',
    },
    is_deleted: { type: Boolean, default: false, index: true },
    custom_fields: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Wildcard index for dynamic custom fields querying
TruckSchema.index({ 'custom_fields.$**': 1 });

/**
 * Calculates the real-time compliance status of the truck based on the expiration
 * dates of its 6 statutory documents.
 */
TruckSchema.methods.calculateComplianceStatus = function (): ComplianceStatus {
  const docs = [
    this.fitness_doc,
    this.insurance_doc,
    this.national_permit_doc,
    this.state_permit_doc,
    this.road_tax_doc,
    this.puc_doc,
  ];

  const now = new Date();
  const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  let hasExpiringSoon = false;

  for (const doc of docs) {
    if (doc && doc.expiry_date) {
      const exp = new Date(doc.expiry_date);
      if (exp < now) {
        return 'EXPIRED';
      }
      if (exp <= fifteenDaysFromNow) {
        hasExpiringSoon = true;
      }
    }
  }

  return hasExpiringSoon ? 'EXPIRING_SOON' : 'COMPLIANT';
};

/**
 * Virtual property exposing `compliance_status` automatically in JSON responses.
 */
TruckSchema.virtual('compliance_status').get(function () {
  return this.calculateComplianceStatus();
});

// Enforce unique truck_no per company workspace
TruckSchema.index({ company_id: 1, truck_no: 1 }, { unique: true });
TruckSchema.index({ company_id: 1, status: 1 });
TruckSchema.index({ company_id: 1, is_deleted: 1 });

// Apply Multi-Tenant query filter and auto-tenant attachment
TruckSchema.plugin(tenantPlugin);

export const Truck = mongoose.model<ITruck>('Truck', TruckSchema);
