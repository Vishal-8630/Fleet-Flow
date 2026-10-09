/**
 * ============================================================================
 * FLEET FLOW — SUBSCRIPTION PLAN SCHEMA (Plan.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores commercial subscription plan definitions for the Fleet Flow platform.
 * It governs which module features are included, resource quotas (max trucks,
 * max drivers, max team members), and pricing in integer paise (INR).
 * 
 * WHY STORE PRICES IN PAISE?
 * --------------------------
 * Storing currency as integers (1 INR = 100 paise) completely avoids IEEE 754
 * floating-point rounding errors during financial calculations and integrates
 * directly with Razorpay API specifications.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';
import { ModuleKey } from '../utils/featureCatalog.js';

export interface IPlan extends Document {
  name: string;
  code: 'starter' | 'standard' | 'pro' | 'enterprise';
  description: string;
  monthly_price_paise: number;
  annual_price_paise: number;
  included_features: ModuleKey[];
  max_trucks: number; // -1 represents unlimited
  max_drivers: number; // -1 represents unlimited
  max_users: number; // -1 represents unlimited
  is_active: boolean;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['starter', 'standard', 'pro', 'enterprise'],
      index: true,
    },
    description: { type: String, required: true },
    monthly_price_paise: { type: Number, required: true, min: 0 },
    annual_price_paise: { type: Number, required: true, min: 0 },
    included_features: [{ type: String, required: true }],
    max_trucks: { type: Number, required: true, default: 5 },
    max_drivers: { type: Number, required: true, default: 5 },
    max_users: { type: Number, required: true, default: 2 },
    is_active: { type: Boolean, default: true, index: true },
    is_public: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
