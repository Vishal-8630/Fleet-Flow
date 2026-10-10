/**
 * ============================================================================
 * FLEET FLOW — GLOBAL USER SCHEMA (User.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODEL?
 * -------------------
 * Represents an individual human account (login credentials, identity, and profile).
 * In Fleet Flow's multi-tenant architecture, `User` is global and decoupled from
 * company-specific roles.
 * 
 * WHY IS IT DECOUPLED FROM COMPANY?
 * ---------------------------------
 * Decoupling `User` from `Company` allows a person (e.g., an accountant or fleet
 * consultant) to hold accounts in multiple companies in the future using a single
 * email and login credential. The company-specific role, permissions, and active
 * status are stored in the join model: `CompanyMember`.
 * 
 * KEY FIELDS:
 * -----------
 * - `email`: Normalized lowercase unique identifier for authentication.
 * - `password_hash`: Bcrypt salted password hash (never stored in plaintext).
 * - `is_platform_super_admin`: Flag reserved for SaaS platform operators to manage
 *   system health, plans, and cross-tenant support inquiries.
 * ============================================================================
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_platform_super_admin: boolean;
  reset_password_token?: string;
  reset_password_expires?: Date;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, required: true },
    phone: { type: String, trim: true },
    avatar_url: { type: String },
    is_verified: { type: Boolean, default: true },
    is_platform_super_admin: { type: Boolean, default: false },
    reset_password_token: { type: String, index: true },
    reset_password_expires: { type: Date },
    token_version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
