/**
 * ============================================================================
 * FLEET FLOW — SUBSCRIPTION ADD-ON SCHEMA (AddOn.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores standalone optional add-ons that tenants can subscribe to on top of
 * their base plan (e.g. WhatsApp Automation Suite, Fleet IQ Predictive Analytics,
 * or Fleet Quota Boosters).
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';
import { ModuleKey } from '../utils/featureCatalog.js';

export interface IAddOn extends Document {
  name: string;
  code: string;
  description: string;
  type: 'module' | 'quota_booster';
  feature_key?: ModuleKey;
  quota_boost?: {
    trucks?: number;
    drivers?: number;
    users?: number;
  };
  monthly_price_paise: number;
  annual_price_paise: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const AddOnSchema = new Schema<IAddOn>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, required: true },
    type: { type: String, required: true, enum: ['module', 'quota_booster'] },
    feature_key: { type: String },
    quota_boost: {
      trucks: { type: Number, default: 0 },
      drivers: { type: Number, default: 0 },
      users: { type: Number, default: 0 },
    },
    monthly_price_paise: { type: Number, required: true, min: 0 },
    annual_price_paise: { type: Number, required: true, min: 0 },
    is_active: { type: Boolean, default: true, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const AddOn = mongoose.model<IAddOn>('AddOn', AddOnSchema);
