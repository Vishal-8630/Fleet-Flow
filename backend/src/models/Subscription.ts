/**
 * ============================================================================
 * FLEET FLOW — COMPANY SUBSCRIPTION SCHEMA (Subscription.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents a company's commercial billing contract with the platform.
 * It tracks active plans, add-ons, Razorpay IDs, mathematical proration states,
 * dunning lifecycle, and super-admin quota overrides.
 * 
 * LIFECYCLE STATES:
 * -----------------
 * - `trialing`: 14-day free trial on signup. Base operations unlocked.
 * - `active`: Paid subscription active and current.
 * - `past_due`: Renewal payment failed. System in 7-day grace dunning period.
 * - `suspended`: Past 7-day grace. Workspace locked down to read-only access.
 * - `cancelled`: Explicitly terminated by customer at period end.
 * ============================================================================
 */

import mongoose, { Document, Schema, Types } from 'mongoose';
import { ModuleKey } from '../utils/featureCatalog.js';

export interface ISubscription extends Document {
  company_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  billing_cycle: 'monthly' | 'annual';
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  current_period_start: Date;
  current_period_end: Date;
  trial_ends_at?: Date;
  active_addons: Array<{
    addon_id: Types.ObjectId;
    code: string;
    subscribed_at: Date;
  }>;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  locked_pricing?: {
    plan_price_paise: number;
    billing_cycle: 'monthly' | 'annual';
  };
  scheduled_change?: {
    action: 'downgrade' | 'cancel';
    target_plan_id?: Types.ObjectId;
    effective_at: Date;
  };
  dunning: {
    attempt_count: number;
    last_attempt_at?: Date;
    next_attempt_at?: Date;
    grace_period_ends_at?: Date;
  };
  quota_overrides?: {
    max_trucks?: number;
    max_drivers?: number;
    max_users?: number;
    custom_feature_grants?: ModuleKey[];
    custom_feature_revocations?: ModuleKey[];
  };
  created_at: Date;
  updated_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
    plan_id: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    billing_cycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'suspended', 'cancelled'],
      default: 'trialing',
      index: true,
    },
    current_period_start: { type: Date, default: () => new Date() },
    current_period_end: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    trial_ends_at: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    active_addons: [
      {
        addon_id: { type: Schema.Types.ObjectId, ref: 'AddOn', required: true },
        code: { type: String, required: true },
        subscribed_at: { type: Date, default: () => new Date() },
      },
    ],
    razorpay_customer_id: { type: String, trim: true },
    razorpay_subscription_id: { type: String, trim: true },
    locked_pricing: {
      plan_price_paise: { type: Number },
      billing_cycle: { type: String, enum: ['monthly', 'annual'] },
    },
    scheduled_change: {
      action: { type: String, enum: ['downgrade', 'cancel'] },
      target_plan_id: { type: Schema.Types.ObjectId, ref: 'Plan' },
      effective_at: { type: Date },
    },
    dunning: {
      attempt_count: { type: Number, default: 0 },
      last_attempt_at: { type: Date },
      next_attempt_at: { type: Date },
      grace_period_ends_at: { type: Date },
    },
    quota_overrides: {
      max_trucks: { type: Number },
      max_drivers: { type: Number },
      max_users: { type: Number },
      custom_feature_grants: [{ type: String }],
      custom_feature_revocations: [{ type: String }],
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
