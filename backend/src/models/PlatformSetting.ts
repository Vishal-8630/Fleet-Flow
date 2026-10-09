/**
 * ============================================================================
 * FLEET FLOW — PLATFORM SETTING SCHEMA (PlatformSetting.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores global SaaS platform configuration managed exclusively by platform
 * super-administrators, including default free trial durations, grace periods,
 * Indian GST tax rates, payment gateway mode, and support contact details.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSetting extends Document {
  key: string;
  trial_days: number;
  grace_period_days: number;
  gst_rate_percent: number;
  currency: string;
  gateway_provider: 'razorpay' | 'stripe';
  gateway_mode: 'sandbox' | 'live';
  razorpay_key_id: string;
  support_email: string;
  auto_suspend_overdue: boolean;
  created_at: Date;
  updated_at: Date;
}

const PlatformSettingSchema = new Schema<IPlatformSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'platform_billing_config' },
    trial_days: { type: Number, default: 14, min: 1 },
    grace_period_days: { type: Number, default: 7, min: 0 },
    gst_rate_percent: { type: Number, default: 18, min: 0 },
    currency: { type: String, default: 'INR' },
    gateway_provider: { type: String, enum: ['razorpay', 'stripe'], default: 'razorpay' },
    gateway_mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
    razorpay_key_id: { type: String, default: 'rzp_test_fleetflow_demo' },
    support_email: { type: String, default: 'billing@fleetflow.io' },
    auto_suspend_overdue: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const PlatformSetting = mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema);
