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

// Ensure a user can only have one active membership per company
CompanyMemberSchema.index({ company_id: 1, email: 1 }, { unique: true });

export const CompanyMember = mongoose.model<ICompanyMember>('CompanyMember', CompanyMemberSchema);
