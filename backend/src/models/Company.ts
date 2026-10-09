/**
 * ============================================================================
 * FLEET FLOW — COMPANY WORKSPACE SCHEMA (Company.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents a discrete transport company / tenant organization in the SaaS platform.
 * Every truck, driver, trip, bill entry, invoice, and ledger entry belongs to
 * exactly one Company via `company_id`.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - `slug`: Unique URL-friendly identifier for the company workspace (e.g., "alpha-logistics").
 * - `settings`: Stores company-specific formatting defaults (currency symbol, LR bill prefix,
 *   invoice prefix, timezone, and date format) so that users see their preferred numbers
 *   without requiring separate databases.
 * - `subscription_status` & `trial_ends_at`: Drives billing access. New companies
 *   start with a 14-day free trial ('trialing') without needing a credit card upfront.
 * - `is_deleted`: Soft-delete flag ensuring audit compliance and preventing accidental data loss.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  slug: string;
  email: string;
  phone: string;
  gstin?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  settings: {
    currency: string;
    timezone: string;
    lr_prefix: string;
    invoice_prefix: string;
    logo_url?: string;
    date_format: string;
  };
  subscription_status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  trial_ends_at: Date;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postal_code: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    settings: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      lr_prefix: { type: String, default: 'LR-' },
      invoice_prefix: { type: String, default: 'INV-' },
      logo_url: { type: String },
      date_format: { type: String, default: 'DD/MM/YYYY' },
    },
    subscription_status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'],
      default: 'trialing',
      index: true,
    },
    trial_ends_at: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default trial
    },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Company = mongoose.model<ICompany>('Company', CompanySchema);
