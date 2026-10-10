/**
 * ============================================================================
 * APPROVAL CONTROLLER (approvalController.ts)
 * ============================================================================
 * Configurable threshold-based approval workflows. Finance operations above
 * configured thresholds are paused for designated approvers before execution.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { ApprovalRule, ApprovalRequest } from '../models/ApprovalRule.js';
import { getTenantId } from '../plugins/tenantPlugin.js';

export async function listApprovalRules(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const rules = await ApprovalRule.find({ company_id: companyId, is_active: true }).sort({ entity_type: 1 }).lean();
    res.json({ rules, total: rules.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createApprovalRule(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const user = (req as any).user;
    const {
      name,
      entity_type,
      threshold_amount_paise,
      required_approver_roles = ['admin'],
      escalation_timeout_hours = 24,
    } = req.body;

    if (!name || !entity_type || threshold_amount_paise === undefined) {
      res.status(400).json({ error: 'name, entity_type, and threshold_amount_paise are required.' });
      return;
    }

    const rule = await ApprovalRule.create({
      company_id: companyId,
      name,
      entity_type,
      threshold_amount_paise,
      required_approver_roles,
      escalation_timeout_hours,
      is_active: true,
      created_by: user._id,
    });

    res.status(201).json({ success: true, rule });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listPendingApprovals(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const pending = await ApprovalRequest.find({
      company_id: companyId,
      status: 'pending',
    }).sort({ created_at: -1 }).lean();

    res.json({ approvals: pending, total: pending.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function processApproval(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const user = (req as any).user;
    const { id } = req.params;
    const { action, note } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'action must be "approve" or "reject".' });
      return;
    }

    const approvalReq = await ApprovalRequest.findOne({ _id: id, company_id: companyId, status: 'pending' });
    if (!approvalReq) {
      res.status(404).json({ error: 'Pending approval request not found.' });
      return;
    }

    approvalReq.status = action === 'approve' ? 'approved' : 'rejected';
    approvalReq.approved_by = user._id;
    approvalReq.approved_at = new Date();
    if (action === 'reject') approvalReq.rejection_reason = note;
    if (action === 'approve') approvalReq.approval_note = note;
    await approvalReq.save();

    res.json({ success: true, status: approvalReq.status, message: `Request ${action}d successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
