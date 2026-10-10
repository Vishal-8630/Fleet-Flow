/**
 * ============================================================================
 * SUPPORT TICKET MODEL (SupportTicket.ts)
 * ============================================================================
 * In-app customer support desk. Companies can submit bugs, billing queries,
 * and compliance questions. Super-admins can triage, reply, and resolve.
 * ============================================================================
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

export interface ITicketMessage {
  sender_id: Types.ObjectId;
  sender_name: string;
  sender_role: 'user' | 'support';
  message: string;
  attachment_urls?: string[];
  sent_at: Date;
}

export interface ISupportTicket extends Document {
  company_id: Types.ObjectId;
  ticket_no: string;
  created_by: Types.ObjectId;
  subject: string;
  category: 'billing' | 'dispatch' | 'compliance' | 'bug' | 'feature_request' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_review' | 'waiting_customer' | 'resolved' | 'closed';
  messages: ITicketMessage[];
  attachment_urls: string[];
  resolved_at?: Date;
  assigned_to?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    sender_id: { type: Schema.Types.ObjectId, required: true },
    sender_name: { type: String, required: true },
    sender_role: { type: String, enum: ['user', 'support'], required: true },
    message: { type: String, required: true },
    attachment_urls: [{ type: String }],
    sent_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    company_id: { type: Schema.Types.ObjectId, required: true, index: true },
    ticket_no: { type: String, required: true, unique: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['billing', 'dispatch', 'compliance', 'bug', 'feature_request', 'other'],
      required: true,
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'in_review', 'waiting_customer', 'resolved', 'closed'],
      default: 'open',
    },
    messages: [TicketMessageSchema],
    attachment_urls: [{ type: String }],
    resolved_at: { type: Date },
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'support_tickets' }
);

SupportTicketSchema.plugin(tenantPlugin);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
