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
import { TruckJourney } from '../models/TruckJourney.js';
import { Entry } from '../models/Entry.js';
import { Invoice } from '../models/Invoice.js';
import { getTenantId } from '../plugins/tenantPlugin.js';
import { getTenantEntitlements } from '../utils/entitlementService.js';

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

    // Server-side quota check to protect against race conditions
    if (req.company) {
      const entitlements = await getTenantEntitlements(req.company);
      const limit = entitlements.limits.max_branches;
      if (limit !== -1) {
        const currentCount = await Branch.countDocuments({ company_id: companyId });
        if (currentCount >= limit) {
          res.status(403).json({
            code: 'QUOTA_EXCEEDED',
            resource: 'branches',
            limit,
            current: currentCount,
            error: `Branch quota exceeded (${currentCount}/${limit}). Upgrade your plan to manage more regional branch hubs.`,
          });
          return;
        }
      }
    }

    const normalizedCode = branch_code.trim().toUpperCase();
    const exists = await Branch.findOne({ company_id: companyId, branch_code: normalizedCode });
    if (exists) {
      res.status(409).json({ error: `Branch code "${normalizedCode}" already exists in your workspace.` });
      return;
    }

    if (is_head_office) {
      await Branch.updateMany({ company_id: companyId, is_head_office: true }, { $set: { is_head_office: false } });
    }

    const branch = await Branch.create({
      company_id: companyId,
      branch_name: branch_name.trim(),
      branch_code: normalizedCode,
      gstin: gstin?.trim(),
      state: state?.trim(),
      state_code: state_code?.trim(),
      address: address?.trim(),
      city: city?.trim(),
      phone: phone?.trim(),
      lr_prefix: lr_prefix?.trim() || `${normalizedCode}-LR-`,
      invoice_prefix: invoice_prefix?.trim() || `INV-${normalizedCode}-`,
      counters: { lr_seq: 0, invoice_seq: 0 },
      is_head_office: Boolean(is_head_office),
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
    const existingBranch = await Branch.findOne({ _id: id, company_id: companyId });

    if (!existingBranch) {
      res.status(404).json({ error: 'Branch not found in your workspace.' });
      return;
    }

    // Whitelist allowed updates to prevent overwriting immutable tenant or counter data
    const allowedFields = [
      'branch_name',
      'branch_code',
      'gstin',
      'state',
      'state_code',
      'address',
      'city',
      'phone',
      'lr_prefix',
      'invoice_prefix',
      'is_head_office',
      'is_active',
      'member_ids',
    ];

    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Branch code uniqueness check within tenant
    if (updates.branch_code) {
      const normalizedCode = updates.branch_code.trim().toUpperCase();
      const conflict = await Branch.findOne({
        company_id: companyId,
        branch_code: normalizedCode,
        _id: { $ne: id },
      });
      if (conflict) {
        res.status(409).json({ error: `Branch code "${normalizedCode}" already exists in your workspace.` });
        return;
      }
      updates.branch_code = normalizedCode;
    }

    // Head office protection: Head office cannot be deactivated
    if (existingBranch.is_head_office && updates.is_active === false) {
      res.status(400).json({ error: 'Cannot deactivate the head office branch.' });
      return;
    }

    // Head office protection: Cannot unset head office flag directly without promoting another
    if (existingBranch.is_head_office && updates.is_head_office === false) {
      res.status(400).json({ error: 'Cannot remove head office status. Designate another branch as head office instead.' });
      return;
    }

    // If designating this branch as head office, unset previous head office
    if (updates.is_head_office === true) {
      await Branch.updateMany(
        { company_id: companyId, _id: { $ne: id }, is_head_office: true },
        { $set: { is_head_office: false } }
      );
    }

    const branch = await Branch.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { $set: updates },
      { new: true }
    );

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
      res.status(404).json({ error: 'Branch not found in your workspace.' });
      return;
    }

    if (branch.is_head_office) {
      res.status(400).json({ error: 'Cannot delete the head office branch.' });
      return;
    }

    // Referential Integrity Check: Verify no operational records reference this branch
    const [journeyCount, entryCount, invoiceCount] = await Promise.all([
      TruckJourney.countDocuments({ branch_id: id, is_deleted: false }),
      Entry.countDocuments({ branch_id: id, is_deleted: false }),
      Invoice.countDocuments({ branch_id: id, is_deleted: false }),
    ]);

    if (journeyCount > 0 || entryCount > 0 || invoiceCount > 0) {
      res.status(409).json({
        code: 'CANNOT_DELETE_BRANCH_WITH_RECORDS',
        error: `Cannot delete branch '${branch.branch_name}'. It is referenced by ${journeyCount} trips, ${entryCount} LRs, and ${invoiceCount} invoices. Deactivate the branch instead to preserve historical integrity.`,
        details: { journeyCount, entryCount, invoiceCount },
      });
      return;
    }

    await Branch.deleteOne({ _id: id, company_id: companyId });
    res.json({ success: true, message: 'Branch deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

