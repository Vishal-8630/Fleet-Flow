/**
 * ============================================================================
 * LEAD INQUIRY MODEL (LeadInquiry.ts)
 * ============================================================================
 * Stores demo requests and sales inquiries from the public marketing website.
 * Triggers WhatsApp/email alerts to the Fleet Flow sales team.
 * ============================================================================
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILeadInquiry extends Document {
  full_name: string;
  company_name: string;
  work_email?: string;
  phone: string;
  fleet_size: '1-5' | '6-20' | '21-50' | '50+';
  pain_point?: string;
  notes?: string;
  source: 'demo_request' | 'contact_form' | 'pricing_cta';
  status: 'new' | 'contacted' | 'qualified' | 'demo_scheduled' | 'converted' | 'not_interested';
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
}

const LeadInquirySchema = new Schema<ILeadInquiry>(
  {
    full_name: { type: String, required: true, trim: true },
    company_name: { type: String, required: true, trim: true },
    work_email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    fleet_size: {
      type: String,
      enum: ['1-5', '6-20', '21-50', '50+'],
      required: true,
    },
    pain_point: { type: String, trim: true },
    notes: { type: String },
    source: {
      type: String,
      enum: ['demo_request', 'contact_form', 'pricing_cta'],
      default: 'contact_form',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'demo_scheduled', 'converted', 'not_interested'],
      default: 'new',
    },
    assigned_to: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'lead_inquiries' }
);

export const LeadInquiry = mongoose.model<ILeadInquiry>('LeadInquiry', LeadInquirySchema);
