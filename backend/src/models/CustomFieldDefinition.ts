/**
 * ============================================================================
 * FLEET FLOW — CUSTOM FIELD DEFINITION SCHEMA (CustomFieldDefinition.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores tenant-defined metadata attributes for core entities:
 * `Truck`, `Driver`, `TruckJourney`, `BillingParty`, `BalanceParty`, `Entry`.
 * 
 * WHY IS SOFT-DEPRECATION IMPLEMENTED?
 * ------------------------------------
 * When a company no longer needs a custom field (e.g. "Legacy GPS IMEI"),
 * deleting it outright would corrupt historical database records. Setting
 * `is_archived: true` hides it from new forms while preserving historical values.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export type CustomFieldTargetEntity =
  | 'Truck'
  | 'Driver'
  | 'TruckJourney'
  | 'BillingParty'
  | 'BalanceParty'
  | 'Entry';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'dropdown'
  | 'multi_select'
  | 'url';

export interface ICustomFieldDefinition extends Document {
  company_id: Types.ObjectId;
  entity: CustomFieldTargetEntity;
  field_key: string; // e.g. "fastag_account_no", "tyre_serial_code"
  field_label: string; // e.g. "FASTag Account No."
  field_type: CustomFieldType;
  options?: string[]; // for dropdown or multi_select
  is_required: boolean;
  default_value?: any;
  placeholder?: string;
  help_text?: string;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

const CustomFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    entity: {
      type: String,
      required: true,
      enum: ['Truck', 'Driver', 'TruckJourney', 'BillingParty', 'BalanceParty', 'Entry'],
      index: true,
    },
    field_key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Field key must contain only lowercase letters, numbers, and underscores.'],
    },
    field_label: { type: String, required: true, trim: true },
    field_type: {
      type: String,
      required: true,
      enum: ['text', 'number', 'date', 'boolean', 'dropdown', 'multi_select', 'url'],
    },
    options: [{ type: String, trim: true }],
    is_required: { type: Boolean, default: false },
    default_value: { type: Schema.Types.Mixed },
    placeholder: { type: String, trim: true },
    help_text: { type: String, trim: true },
    is_archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Compound unique index ensuring field_key is unique per entity within each tenant
CustomFieldDefinitionSchema.index({ company_id: 1, entity: 1, field_key: 1 }, { unique: true });

export const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  'CustomFieldDefinition',
  CustomFieldDefinitionSchema
);
