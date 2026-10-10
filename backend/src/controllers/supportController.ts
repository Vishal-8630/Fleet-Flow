/**
 * ============================================================================
 * SUPPORT CONTROLLER (supportController.ts)
 * ============================================================================
 * Customer support ticket management. Companies submit bug reports, billing
 * queries, or compliance questions. Super-admins triage and reply.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { SupportTicket } from '../models/SupportTicket.js';
import { getTenantId } from '../plugins/tenantPlugin.js';

export async function createTicket(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const user = (req as any).user;
    const { subject, category, priority = 'medium', message } = req.body;

    if (!subject || !category || !message) {
      res.status(400).json({ error: 'subject, category, and message are required.' });
      return;
    }

    const count = await SupportTicket.countDocuments({});
    const year = new Date().getFullYear();
    const ticket_no = `TICK-${year}-${String(count + 1).padStart(4, '0')}`;

    const ticket = await SupportTicket.create({
      company_id: companyId,
      ticket_no,
      created_by: user._id,
      subject,
      category,
      priority,
      status: 'open',
      messages: [
        {
          sender_id: user._id,
          sender_name: user.name || user.email,
          sender_role: 'user',
          message,
          sent_at: new Date(),
        },
      ],
    });

    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listTickets(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const tickets = await SupportTicket.find({ company_id: companyId })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    res.json({ tickets, total: tickets.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTicket(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const ticket = await SupportTicket.findOne({ _id: id, company_id: companyId }).lean();

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    res.json({ ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function replyToTicket(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const user = (req as any).user;
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'message is required.' });
      return;
    }

    const ticket = await SupportTicket.findOne({ _id: id, company_id: companyId });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    ticket.messages.push({
      sender_id: user._id,
      sender_name: user.name || user.email,
      sender_role: 'user',
      message,
      sent_at: new Date(),
    } as any);

    if (ticket.status === 'waiting_customer') {
      ticket.status = 'in_review';
    }
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
