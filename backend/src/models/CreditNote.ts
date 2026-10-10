/**
 * ============================================================================
 * CREDIT NOTE MODEL (CreditNote.ts)
 * ============================================================================
 * GST Section 34 compliant credit and debit note schema for freight invoice
 * adjustments. Handles rate differences, cargo damage shortages, volume
 * discounts, and invoice cancellations with auto GST recalculation.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface ICreditNote extends Document {
  company_id: Types.ObjectId;
  credit_note_no: string;
  original_invoice_id: Types.ObjectId;
  party_id: Types.ObjectId;
  type: 'credit_note' | 'debit_note';
  reason: 'rate_difference' | 'shortage_damage' | 'discount' | 'cancellation' | 'other';
  reason_description?: string;
  // Adjustment amounts (all in paise)
  adjustment_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_adjustment_paise: number;
  // State of supply for inter/intra GST determination
  is_interstate: boolean;
  gst_rate_percent: number;
  status: 'draft' | 'issued' | 'cancelled';
  issued_at?: Date;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const CreditNoteSchema = new Schema<ICreditNote>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    credit_note_no: { type: String, required: true, trim: true },
    original_invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    party_id: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: ['credit_note', 'debit_note'], required: true },
    reason: {
      type: String,
      enum: ['rate_difference', 'shortage_damage', 'discount', 'cancellation', 'other'],
      required: true,
    },
    reason_description: { type: String, trim: true },
    adjustment_amount_paise: { type: Number, required: true, min: 0 },
    cgst_paise: { type: Number, default: 0, min: 0 },
    sgst_paise: { type: Number, default: 0, min: 0 },
    igst_paise: { type: Number, default: 0, min: 0 },
    total_adjustment_paise: { type: Number, required: true, min: 0 },
    is_interstate: { type: Boolean, default: false },
    gst_rate_percent: { type: Number, default: 5 },
    status: { type: String, enum: ['draft', 'issued', 'cancelled'], default: 'draft' },
    issued_at: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'credit_notes' }
);

CreditNoteSchema.plugin(tenantPlugin);

export const CreditNote = mongoose.model<ICreditNote>('CreditNote', CreditNoteSchema);
