/**
 * ============================================================================
 * BRANCH CONTROLLER (branchController.ts)
 * ============================================================================
 * CRUD operations for regional branch hub management.
 * Each branch has its own LR prefix, invoice prefix, and member list.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Branch } from '../models/Branch.js';
import { getTenantId } from '../plugins/tenantPlugin.js';

export async function listBranches(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const branches = await Branch.find({ company_id: companyId }).sort({ is_head_office: -1, branch_name: 1 }).lean();
    res.json({ branches, total: branches.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createBranch(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const {
      branch_name,
      branch_code,
      gstin,
      state,
      state_code,
      address,
      city,
      phone,
      lr_prefix,
      invoice_prefix,
      is_head_office = false,
    } = req.body;

    if (!branch_name || !branch_code) {
      res.status(400).json({ error: 'branch_name and branch_code are required.' });
      return;
    }

    const exists = await Branch.findOne({ company_id: companyId, branch_code: branch_code.toUpperCase() });
    if (exists) {
      res.status(409).json({ error: `Branch code "${branch_code.toUpperCase()}" already exists.` });
      return;
    }

    const branch = await Branch.create({
      company_id: companyId,
      branch_name,
      branch_code: branch_code.toUpperCase(),
      gstin,
      state,
      state_code,
      address,
      city,
      phone,
      lr_prefix: lr_prefix || `${branch_code.toUpperCase()}-LR-`,
      invoice_prefix: invoice_prefix || `INV-${branch_code.toUpperCase()}-`,
      is_head_office,
      is_active: true,
    });

    res.status(201).json({ success: true, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateBranch(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const updates = req.body;

    const branch = await Branch.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { $set: updates },
      { new: true }
    );

    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }

    res.json({ success: true, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteBranch(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;

    const branch = await Branch.findOne({ _id: id, company_id: companyId });
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }

    if (branch.is_head_office) {
      res.status(400).json({ error: 'Cannot delete the head office branch.' });
      return;
    }

    await Branch.deleteOne({ _id: id });
    res.json({ success: true, message: 'Branch deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
