/**
 * ============================================================================
 * FLEET FLOW — COMPANY MEMBERSHIP & RBAC SCHEMA (CompanyMember.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * This is the join model that binds a `User` to a specific `Company` workspace.
 * It stores the user's role, permissions, invitation status, and invitation tokens.
 * 
 * WHY IS THIS MODEL ESSENTIAL?
 * ----------------------------
 * 1. Clean Role-Based Access Control (RBAC): A user is not inherently an "admin"
 *    or "dispatcher" globally; they hold that role within a specific company.
 * 2. Invitation Lifecycle: Allows company admins to invite employees before the
 *    employee even creates an account. The document starts with `status: 'invited'`,
 *    stores a secure crypto `invitation_token`, and links to the `User` once accepted.
 * 3. Deactivation Safeguard: If an employee leaves a company, their status is set
 *    to `deactivated`. This immediately revokes their workspace access without
 *    destroying their historical activity in audit logs.
 * 
 * ROLES SUPPORTED:
 * ----------------
 * - `admin`: Company owner or manager. Full access to billing, settings, and team.
 * - `dispatcher`: Day-to-day operations. Manages trucks, drivers, trips, dispatches.
 * - `accountant`: Financial operations. Manages billing, LR entries, invoices, settlements.
 * - `viewer`: Read-only observer (e.g., auditors, client executives).
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'dispatcher' | 'accountant' | 'viewer';

export interface ICompanyMember extends Document {
  company_id: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  email: string;
  role: UserRole;
  status: 'invited' | 'active' | 'deactivated';
  invitation_token?: string;
  token_expires_at?: Date;
  invited_by?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const CompanyMemberSchema = new Schema<ICompanyMember>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['admin', 'dispatcher', 'accountant', 'viewer'],
      default: 'dispatcher',
      required: true,
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'deactivated'],
      default: 'active',
      index: true,
    },
    invitation_token: { type: String, sparse: true },
    token_expires_at: { type: Date },
    invited_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Ensure a user email can only have one membership per company
CompanyMemberSchema.index({ company_id: 1, email: 1 }, { unique: true });

export const CompanyMember = mongoose.model<ICompanyMember>('CompanyMember', CompanyMemberSchema);
