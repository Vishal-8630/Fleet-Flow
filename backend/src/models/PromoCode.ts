/**
 * ============================================================================
 * FLEET FLOW — PROMO CODE & DISCOUNT ENGINE SCHEMA (PromoCode.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Stores coupon codes, discount rates, expiration rules, and usage counters
 * applied during plan upgrades and subscription renewals.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IPromoCode extends Document {
  code: string;
  discount_type: 'percentage' | 'fixed_paise';
  discount_value: number; // percentage (e.g., 20 for 20%) or fixed paise (e.g. 50000 for ₹500)
  max_discount_paise?: number;
  min_order_paise?: number;
  valid_from: Date;
  valid_until: Date;
  max_redemptions: number;
  times_redeemed: number;
  is_active: boolean;
  applicable_plan_codes?: string[];
  created_at: Date;
  updated_at: Date;
}

const PromoCodeSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    discount_type: { type: String, enum: ['percentage', 'fixed_paise'], required: true },
    discount_value: { type: Number, required: true, min: 1 },
    max_discount_paise: { type: Number },
    min_order_paise: { type: Number, default: 0 },
    valid_from: { type: Date, default: () => new Date() },
    valid_until: { type: Date, required: true },
    max_redemptions: { type: Number, default: 100 },
    times_redeemed: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true, index: true },
    applicable_plan_codes: [{ type: String }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const PromoCode = mongoose.model<IPromoCode>('PromoCode', PromoCodeSchema);
