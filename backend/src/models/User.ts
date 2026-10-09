import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_platform_super_admin: boolean;
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
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
