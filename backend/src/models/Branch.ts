/**
 * ============================================================================
 * BRANCH MODEL (Branch.ts)
 * ============================================================================
 * Regional hub/branch management for multi-location transport enterprises.
 * Each branch can have its own LR prefix, invoice prefix, GSTIN, and team.
 * Dispatchers assigned to a branch can only view/create trips for that branch.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface IBranch extends Document {
  company_id: Types.ObjectId;
  branch_name: string;
  branch_code: string;         // e.g. 'MUM', 'DEL', 'BHW'
  gstin?: string;              // State-specific GSTIN (optional)
  state?: string;
  state_code?: string;
  address?: string;
  city?: string;
  phone?: string;
  lr_prefix: string;           // e.g. 'MUM-LR-', 'BHW-'
  invoice_prefix: string;      // e.g. 'INV-MUM-'
  is_head_office: boolean;
  is_active: boolean;
  member_ids: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    branch_name: { type: String, required: true, trim: true },
    branch_code: { type: String, required: true, trim: true, uppercase: true },
    gstin: { type: String, trim: true },
    state: { type: String, trim: true },
    state_code: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    phone: { type: String, trim: true },
    lr_prefix: { type: String, required: true, default: 'LR-', trim: true },
    invoice_prefix: { type: String, required: true, default: 'INV-', trim: true },
    is_head_office: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    member_ids: [{ type: Schema.Types.ObjectId, ref: 'CompanyMember' }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'branches' }
);

BranchSchema.index({ company_id: 1, branch_code: 1 }, { unique: true });
BranchSchema.plugin(tenantPlugin);

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);
