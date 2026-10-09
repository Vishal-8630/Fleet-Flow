/**
 * ============================================================================
 * FLEET FLOW — DRIVER MASTER & KYC MODEL (Driver.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents commercial vehicle drivers employed by or contracted to a transport
 * company. Manages identity KYC (Driving License, Aadhaar), vehicle assignments,
 * active duty status, and financial advance balance ledgers.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - PII Masking: Aadhaar numbers are sensitive biometric identifiers under Indian
 *   law. The schema provides a `masked_aadhaar` virtual (`XXXX-XXXX-1234`) and a
 *   `toSafeJSON(role)` serializer to prevent accidental disclosure to non-admin roles.
 * - Decimal-Safe Balances: Financial advance balances are stored in paise (cents)
 *   to avoid floating-point drift during trip settlements and trip advance payouts.
 * - Dynamic Assignment: Tracks both current truck assignment and full historical
 *   assignment logs with timestamps.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export type DriverStatus = 'active' | 'on_leave' | 'terminated';

export interface IDriverVehicleAssignment {
  truck_id: Types.ObjectId;
  assigned_at: Date;
  unassigned_at?: Date;
  notes?: string;
}

export interface IDriver extends Document {
  company_id: Types.ObjectId;
  name: string;
  photo_url?: string;
  phone: string;
  emergency_phone?: string;
  address?: string;
  date_of_birth?: Date;

  // KYC & Licensing
  license_number: string;
  license_expiry_date?: Date;
  license_front_url?: string;
  license_back_url?: string;
  aadhaar_number?: string;
  aadhaar_front_url?: string;
  aadhaar_back_url?: string;

  // Financial Ledger Balances (stored in paise: 100 paise = 1 INR)
  running_advance_balance: number;
  amount_company_owes_driver: number;
  amount_driver_owes_company: number;
  last_settlement_date?: Date;
  last_settlement_id?: Types.ObjectId;

  // Vehicle Assignments
  current_truck_id?: Types.ObjectId;
  assignment_history: IDriverVehicleAssignment[];

  // Status & Soft Delete
  status: DriverStatus;
  is_deleted: boolean;
  custom_fields?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
 
   // Helper Methods
   getMaskedAadhaar(): string;
   toSafeJSON(userRole?: string): Record<string, any>;
 }
 
 const DriverVehicleAssignmentSchema = new Schema(
   {
     truck_id: { type: Schema.Types.ObjectId, ref: 'Truck', required: true },
     assigned_at: { type: Date, default: Date.now },
     unassigned_at: { type: Date },
     notes: { type: String, trim: true },
   },
   { _id: true }
 );
 
 const DriverSchema = new Schema<IDriver>(
   {
     name: { type: String, required: true, trim: true },
     photo_url: { type: String, trim: true },
     phone: { type: String, required: true, trim: true },
     emergency_phone: { type: String, trim: true },
     address: { type: String, trim: true },
     date_of_birth: { type: Date },
 
     license_number: {
       type: String,
       required: true,
       trim: true,
       uppercase: true,
     },
     license_expiry_date: { type: Date },
     license_front_url: { type: String, trim: true },
     license_back_url: { type: String, trim: true },
 
     aadhaar_number: { type: String, trim: true },
     aadhaar_front_url: { type: String, trim: true },
     aadhaar_back_url: { type: String, trim: true },
 
     running_advance_balance: { type: Number, default: 0 },
     amount_company_owes_driver: { type: Number, default: 0 },
     amount_driver_owes_company: { type: Number, default: 0 },
     last_settlement_date: { type: Date },
     last_settlement_id: { type: Schema.Types.ObjectId },
 
     current_truck_id: { type: Schema.Types.ObjectId, ref: 'Truck' },
     assignment_history: [DriverVehicleAssignmentSchema],
 
     status: {
       type: String,
       enum: ['active', 'on_leave', 'terminated'],
       default: 'active',
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
 
 DriverSchema.index({ 'custom_fields.$**': 1 });

/**
 * Returns a masked representation of the Aadhaar number (e.g., `XXXX-XXXX-1234`).
 */
DriverSchema.methods.getMaskedAadhaar = function (): string {
  if (!this.aadhaar_number) return '';
  const cleanDigits = this.aadhaar_number.replace(/\D/g, '');
  if (cleanDigits.length < 4) return 'XXXX-XXXX-XXXX';
  const lastFour = cleanDigits.slice(-4);
  return `XXXX-XXXX-${lastFour}`;
};

DriverSchema.virtual('masked_aadhaar').get(function () {
  return this.getMaskedAadhaar();
});

/**
 * Returns a role-sanitized object representation for API responses.
 * Hides raw Aadhaar number from non-administrative roles.
 */
DriverSchema.methods.toSafeJSON = function (userRole: string = 'viewer'): Record<string, any> {
  const obj = this.toObject();
  const isAdminOrAccountant = ['admin', 'accountant'].includes(userRole);

  if (!isAdminOrAccountant && obj.aadhaar_number) {
    obj.aadhaar_number = this.getMaskedAadhaar();
  }
  return obj;
};

// Enforce unique license number per company
DriverSchema.index({ company_id: 1, license_number: 1 }, { unique: true });
DriverSchema.index({ company_id: 1, phone: 1 });
DriverSchema.index({ company_id: 1, status: 1 });
DriverSchema.index({ company_id: 1, is_deleted: 1 });

// Apply Multi-Tenant query filter and auto-tenant attachment
DriverSchema.plugin(tenantPlugin);

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
