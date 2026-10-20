/**
 * ============================================================================
 * FLEET FLOW — LORRY RECEIPT (LR / BILTY) CONTROLLER (entryController.ts)
 * ============================================================================
 * 
 * Endpoints for creating, searching, and managing official 3-part consignment
 * notes (LR / Bilty) with automated numbering and commercial freight terms.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { Entry } from '../models/Entry.js';
import { Company } from '../models/Company.js';
import { Branch } from '../models/Branch.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { BillingParty } from '../models/BillingParty.js';
import { notifyLRGenerated } from '../utils/notificationService.js';
import { logAuditEvent } from '../utils/auditService.js';
import { validateTenantOwnership, TenantOwnershipError } from '../utils/ownershipValidator.js';
import { evaluateCustomerCreditExposure } from '../services/creditExposureService.js';

export const getEntries = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: any = { company_id: companyId, is_deleted: false };

    // Search filter: LR #, Bill #, Vehicle #, Consignor or Consignee name
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { lr_no: searchRegex },
        { bill_no: searchRegex },
        { vehicle_number: searchRegex },
        { 'consignor.name': searchRegex },
        { 'consignee.name': searchRegex },
        { from_location: searchRegex },
        { to_location: searchRegex },
      ];
    }

    if (req.query.billing_party_id) {
      query.billing_party_id = req.query.billing_party_id;
    }

    if (req.query.freight_terms) {
      query.freight_terms = req.query.freight_terms;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.unassigned === 'true' || (req.query.unassigned as unknown) === true) {
      query.journey_id = { $in: [null, undefined] };
      if (!req.query.status) {
        query.status = 'active';
      }
    } else if (req.query.journey_id) {
      query.journey_id = req.query.journey_id;
    }

    if (req.query.from_date || req.query.to_date) {
      query.lr_date = {};
      if (req.query.from_date) query.lr_date.$gte = new Date(req.query.from_date as string);
      if (req.query.to_date) query.lr_date.$lte = new Date(req.query.to_date as string);
    }

    if (req.query.branch_id) {
      const branch = await Branch.findOne({ _id: req.query.branch_id, company_id: companyId });
      if (!branch) {
        return res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
      }
      query.branch_id = branch._id;
    }

    const [entries, total] = await Promise.all([
      Entry.find(query)
        .populate('billing_party_id', 'name gstin')
        .populate('journey_id', 'journey_number status')
        .populate('branch_id', 'branch_name branch_code is_head_office')
        .populate('truck_id', 'truck_no make model body_type tonnage_capacity status compliance_status')
        .populate('driver_id', 'name phone license_number status')
        .sort({ lr_date: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Entry.countDocuments(query),
    ]);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve Lorry Receipts.' });
  }
};

export const getEntryMetrics = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const companyObjectId = new Types.ObjectId(String(companyId));

    const [totalLrs, activeLrs, invoicedLrs, toBeBilled, aggregateVal] = await Promise.all([
      Entry.countDocuments({ company_id: companyId, is_deleted: false }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, status: 'active' }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, status: 'invoiced' }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, freight_terms: 'to_be_billed', status: 'active' }),
      Entry.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        { $group: { _id: null, totalFreight: { $sum: '$freight_amount' } } },
      ]),
    ]);

    const totalFreightValue = aggregateVal[0]?.totalFreight || 0;

    res.json({
      metrics: {
        total_lrs: totalLrs,
        active_lrs: activeLrs,
        invoiced_lrs: invoicedLrs,
        to_be_billed_count: toBeBilled,
        total_freight_value: totalFreightValue,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute LR metrics.' });
  }
};

export const getEntryById = async (req: Request, res: Response) => {
  try {
    const entry = await Entry.findOne({
      _id: req.params.id,
      company_id: req.tenant?.id,
      is_deleted: false,
    })
      .populate('billing_party_id')
      .populate('journey_id')
      .populate('branch_id', 'branch_name branch_code is_head_office')
      .populate('truck_id', 'truck_no make model body_type tonnage_capacity status compliance_status')
      .populate('driver_id', 'name phone license_number status');

    if (!entry) {
      return res.status(404).json({ error: 'Lorry Receipt not found.' });
    }

    res.json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve LR.' });
  }
};

export const createEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    let { truck_id, driver_id, journey_id, billing_party_id } = req.body;

    // 0. Resolve originating trip first if journey_id is supplied
    let originatingJourney: any = null;
    if (journey_id) {
      if (!Types.ObjectId.isValid(journey_id)) {
        return res.status(400).json({
          code: 'INVALID_JOURNEY_ID',
          error: 'Invalid journey_id format.',
        });
      }
      originatingJourney = await TruckJourney.findOne({
        _id: journey_id,
        company_id: companyId,
        is_deleted: false,
      });
      if (!originatingJourney) {
        return res.status(404).json({
          code: 'JOURNEY_NOT_FOUND',
          error: 'Selected originating journey not found in your workspace.',
        });
      }

      // Prefill truck and driver from originating trip if not explicitly provided
      if (!truck_id && originatingJourney.truck_id) {
        truck_id = originatingJourney.truck_id.toString();
      }
      if (!driver_id && originatingJourney.driver_id) {
        driver_id = originatingJourney.driver_id.toString();
      }
    }

    // 1. Mandatory Billing Party Validation
    if (typeof billing_party_id === 'string') {
      billing_party_id = billing_party_id.trim();
    }
    if (!billing_party_id) {
      return res.status(400).json({
        code: 'BILLING_PARTY_REQUIRED',
        error: 'A registered Billing Party is mandatory to issue a Lorry Receipt.',
      });
    }
    if (!Types.ObjectId.isValid(billing_party_id)) {
      return res.status(400).json({
        code: 'INVALID_BILLING_PARTY_ID',
        error: 'Invalid billing_party_id format.',
      });
    }

    // 2. Mandatory Truck & Driver Presence Check for new LRs
    if (!truck_id || !Types.ObjectId.isValid(truck_id)) {
      return res.status(400).json({
        code: 'TRUCK_REQUIRED',
        error: 'A registered commercial vehicle is mandatory to issue a Lorry Receipt.',
      });
    }
    if (!driver_id || !Types.ObjectId.isValid(driver_id)) {
      return res.status(400).json({
        code: 'DRIVER_REQUIRED',
        error: 'A registered professional driver is mandatory to issue a Lorry Receipt.',
      });
    }

    // 3. Deep Foreign Key Ownership Validation (Anti-IDOR)
    await validateTenantOwnership(companyId!, {
      billing_party_id,
      truck_id,
      driver_id,
      journey_id,
    });

    // 4. Fetch Master records to validate eligibility & populate authoritative snapshots
    const [billingParty, truck, driver] = await Promise.all([
      BillingParty.findOne({ _id: billing_party_id, company_id: companyId, is_deleted: false }),
      Truck.findOne({ _id: truck_id, company_id: companyId, is_deleted: false }),
      Driver.findOne({ _id: driver_id, company_id: companyId, is_deleted: false }),
    ]);

    if (!billingParty) {
      return res.status(404).json({
        code: 'BILLING_PARTY_NOT_FOUND',
        error: 'Selected Billing Party not found in your workspace.',
      });
    }

    if (billingParty.status === 'inactive') {
      return res.status(400).json({
        code: 'BILLING_PARTY_INACTIVE',
        error: `Billing Party '${billingParty.name}' is inactive and cannot be assigned to new consignments.`,
      });
    }

    if (!truck) {
      return res.status(404).json({
        code: 'TRUCK_NOT_FOUND',
        error: 'Selected vehicle not found in your workspace.',
      });
    }

    // Truck status eligibility: decommissioned, deleted, or otherwise out-of-service trucks must be rejected
    if (truck.status === 'decommissioned') {
      return res.status(400).json({
        code: 'TRUCK_INELIGIBLE',
        error: `Vehicle ${truck.truck_no} is decommissioned and cannot be assigned to new consignments.`,
      });
    }

    if (!driver) {
      return res.status(404).json({
        code: 'DRIVER_NOT_FOUND',
        error: 'Selected driver not found in your workspace.',
      });
    }

    // Driver eligibility: must not be terminated or on leave
    if (driver.status === 'terminated') {
      return res.status(400).json({
        code: 'DRIVER_INELIGIBLE',
        error: `Driver ${driver.name} is terminated and cannot be assigned to new consignments.`,
      });
    }

    if (driver.status === 'on_leave') {
      return res.status(400).json({
        code: 'DRIVER_ON_LEAVE',
        error: `Driver ${driver.name} is currently on leave and cannot be assigned to new consignments.`,
      });
    }

    // 4. Originating Trip Consistency Check (when trip is supplied)
    if (originatingJourney) {
      if (String(originatingJourney.truck_id) !== String(truck._id)) {
        return res.status(400).json({
          code: 'TRIP_TRUCK_MISMATCH',
          error: `Selected vehicle does not match originating trip's assigned vehicle.`,
        });
      }
      if (String(originatingJourney.driver_id) !== String(driver._id)) {
        return res.status(400).json({
          code: 'TRIP_DRIVER_MISMATCH',
          error: `Selected driver does not match originating trip's assigned driver.`,
        });
      }
    }

    // 5. Two-Stage Compliance Check: Advisory Warning at Booking (Non-Blocking)
    let complianceWarning: any = null;
    const complianceStatus = truck.calculateComplianceStatus();
    if (complianceStatus === 'EXPIRED') {
      complianceWarning = {
        code: 'COMPLIANCE_EXPIRED',
        message: `Vehicle ${truck.truck_no} has expired statutory documents. Renewal required prior to trip dispatch.`,
      };
    }

    let overrideAuditParams: any = null;

    // 1.5. Customer Credit Limit Enforcement (DEC-007 Option B)
    if (req.body.billing_party_id) {
      const exposureResult = await evaluateCustomerCreditExposure({
        company_id: companyId!,
        billing_party_id: req.body.billing_party_id,
        planned_freight: Number(req.body.freight_amount) || 0,
      });

      if (exposureResult.is_breached) {
        if (!req.body.credit_override) {
          return res.status(409).json({
            code: 'CREDIT_LIMIT_EXCEEDED',
            error: `Credit limit exceeded for customer ${exposureResult.customer_name}. Company Admin authorization required to issue LR.`,
            details: exposureResult,
          });
        }

        const userRole = req.tenant?.role || req.member?.role || (req as any).membership?.role || (req as any).user?.role;
        const isCompanyAdmin =
          userRole === 'admin' || (req as any).user?.is_superadmin || (req as any).user?.role === 'superadmin';

        if (!isCompanyAdmin) {
          return res.status(403).json({
            code: 'CREDIT_OVERRIDE_UNAUTHORIZED',
            error: 'Credit limit exceeded. Company Admin authorization required to issue LR.',
            details: exposureResult,
          });
        }

        const overrideReason = (req.body.override_reason || '').trim();
        if (overrideReason.length < 10) {
          return res.status(400).json({
            code: 'JUSTIFICATION_REQUIRED',
            error: 'A valid business justification (minimum 10 characters) is required to override credit limit.',
          });
        }

        overrideAuditParams = {
          company_id: companyId!,
          entity_type: 'party',
          entity_id: req.body.billing_party_id,
          entity_identifier: exposureResult.customer_name,
          action: 'OVERRIDE',
          description: `Credit limit override authorized for ${exposureResult.customer_name} on new LR: ${overrideReason}`,
          req,
          before_snapshot: {
            credit_limit: exposureResult.credit_limit,
            current_exposure: exposureResult.current_exposure,
          },
          after_snapshot: {
            projected_exposure: exposureResult.projected_exposure,
            overage_amount: exposureResult.overage_amount,
            override_reason: overrideReason,
          },
        };
      }
    }

    // Validate branch if branch_id is supplied, or inherit from associated journey (trip/LR workflow)
    let branch: any = null;
    if (req.body.branch_id) {
      branch = await Branch.findOne({ _id: req.body.branch_id, company_id: companyId });
      if (!branch) {
        return res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
      }
      if (!branch.is_active) {
        return res.status(400).json({ error: 'Cannot issue Lorry Receipt for an inactive regional branch.' });
      }
    } else if (originatingJourney && originatingJourney.branch_id) {
      const journeyBranch = await Branch.findOne({ _id: originatingJourney.branch_id, company_id: companyId });
      if (journeyBranch && journeyBranch.is_active) {
        branch = journeyBranch;
      }
    }

    const company = await Company.findById(companyId);

    // 2. Concurrency-Safe Atomic LR Numbering
    let lr_no = req.body.lr_no?.trim()?.toUpperCase();
    if (!lr_no) {
      if (branch) {
        const lrPrefix = branch.lr_prefix || `${branch.branch_code}-LR-`;
        const updatedBranch = await Branch.findOneAndUpdate(
          { _id: branch._id, company_id: companyId },
          { $inc: { 'counters.lr_seq': 1 } },
          { new: true, upsert: false }
        );
        const seq = updatedBranch?.counters?.lr_seq || 1;
        lr_no = `${lrPrefix}${String(seq).padStart(4, '0')}`;
      } else {
        const lrPrefix = company?.settings?.lr_prefix || 'LR-';
        const updatedCompany = await Company.findByIdAndUpdate(
          companyId,
          { $inc: { 'counters.lr_seq': 1 } },
          { new: true, upsert: false }
        );
        const seq = updatedCompany?.counters?.lr_seq || 1;
        lr_no = `${lrPrefix}${String(seq).padStart(4, '0')}`;
      }
    }

    // Check uniqueness
    const existing = await Entry.findOne({ company_id: companyId, lr_no, is_deleted: false });
    if (existing) {
      return res.status(409).json({ error: `LR number '${lr_no}' already exists in your workspace.` });
    }

    // Auto-generate Bill number
    let bill_no = req.body.bill_no?.trim()?.toUpperCase();
    if (!bill_no) {
      const count = await Entry.countDocuments({ company_id: companyId });
      bill_no = `BILL-${String(count + 1).padStart(4, '0')}`;
    }

    // Authoritative Snapshot Population from master records (Anti-Tampering)
    const newEntry = new Entry({
      ...req.body,
      company_id: companyId,
      branch_id: branch?._id || undefined,
      billing_party_id: billingParty._id,
      truck_id: truck._id,
      driver_id: driver._id,
      vehicle_number: truck.truck_no.toUpperCase().trim(),
      driver_name: driver.name.trim(),
      driver_phone: driver.phone?.trim() || '',
      journey_id: originatingJourney?._id || undefined,
      bill_no,
      lr_no,
      status: 'active',
    });

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await newEntry.save();
        break;
      } catch (saveErr: any) {
        if (
          saveErr.code === 11000 &&
          (saveErr.keyPattern?.tracking_token || saveErr.message?.includes('tracking_token')) &&
          attempt < maxRetries - 1
        ) {
          newEntry.tracking_token = `trk_${crypto.randomBytes(16).toString('hex')}`;
          continue;
        }
        throw saveErr;
      }
    }

    await newEntry.populate([
      { path: 'billing_party_id', select: 'name gstin' },
      { path: 'truck_id', select: 'truck_no make model body_type tonnage_capacity status compliance_status' },
      { path: 'driver_id', select: 'name phone license_number status' },
    ]);

    if (overrideAuditParams) {
      await logAuditEvent(overrideAuditParams);
    }

    if (company) {
      notifyLRGenerated(newEntry, company).catch((err) =>
        console.error('[Notification Trigger Error - LR]:', err)
      );
    }

    logAuditEvent({
      company_id: companyId,
      entity_type: 'entry',
      entity_id: newEntry._id,
      entity_identifier: newEntry.lr_no,
      action: 'CREATE',
      description: `Lorry Receipt ${newEntry.lr_no} registered for route ${newEntry.from_location} to ${newEntry.to_location}.`,
      req,
      after_snapshot: { lr_no: newEntry.lr_no, freight_amount: newEntry.freight_amount },
    });

    res.status(201).json({
      message: 'Lorry Receipt created successfully.',
      entry: newEntry,
      warning: complianceWarning || undefined,
    });
  } catch (err: any) {
    if (err instanceof TenantOwnershipError) {
      return res.status(err.statusCode).json({ error: err.message, entityType: err.entityType });
    }
    res.status(400).json({ error: err.message || 'Failed to create Lorry Receipt.' });
  }
};

export const updateEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const entry = await Entry.findOne({
      _id: req.params.id,
      company_id: companyId,
      is_deleted: false,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Lorry Receipt not found.' });
    }

    if (entry.status === 'invoiced' && req.body.freight_amount && req.body.freight_amount !== entry.freight_amount) {
      return res.status(400).json({ error: 'Cannot modify freight amount on an already invoiced LR.' });
    }

    // Billing Party update validation & lifecycle protections
    let validatedPartyId: Types.ObjectId | undefined = undefined;
    if (req.body.billing_party_id !== undefined) {
      let rawPartyId = req.body.billing_party_id;
      if (typeof rawPartyId === 'string') {
        rawPartyId = rawPartyId.trim();
      }

      // 1. Guard linked LRs: Prevent changing or removing Billing Party if linked to an active, completed, or delayed journey
      if (entry.journey_id) {
        const linkedJourney = await TruckJourney.findOne({
          _id: entry.journey_id,
          company_id: companyId,
          is_deleted: false,
        });

        if (linkedJourney && ['active', 'completed', 'delayed'].includes(linkedJourney.status)) {
          if (!rawPartyId || String(rawPartyId) !== String(entry.billing_party_id)) {
            return res.status(409).json({
              code: 'LINKED_LR_BILLING_PARTY_LOCKED',
              error: `Cannot modify Billing Party for Lorry Receipt '${entry.lr_no}' because it is linked to an ${linkedJourney.status} journey ('${linkedJourney.journey_number || linkedJourney._id}').`,
            });
          }
        }
      }

      // 2. Reject empty or null Billing Party values
      if (!rawPartyId) {
        return res.status(400).json({
          code: 'BILLING_PARTY_REQUIRED',
          error: 'A registered Billing Party is mandatory to update a Lorry Receipt.',
        });
      }

      // 3. Reject malformed ObjectId formats
      if (!Types.ObjectId.isValid(rawPartyId)) {
        return res.status(400).json({
          code: 'INVALID_BILLING_PARTY_ID',
          error: 'Invalid billing_party_id format.',
        });
      }

      // 4. Validate tenant ownership (Anti-IDOR)
      await validateTenantOwnership(companyId!, { billing_party_id: rawPartyId });

      // 5. Verify Billing Party master record exists and is active
      const party = await BillingParty.findOne({
        _id: rawPartyId,
        company_id: companyId,
        is_deleted: false,
      });

      if (!party) {
        return res.status(404).json({
          code: 'BILLING_PARTY_NOT_FOUND',
          error: 'Selected Billing Party not found in your workspace.',
        });
      }

      if (party.status === 'inactive') {
        return res.status(400).json({
          code: 'BILLING_PARTY_INACTIVE',
          error: `Billing Party '${party.name}' is inactive and cannot be assigned to consignments.`,
        });
      }

      validatedPartyId = party._id;
    }

    const updateData = { ...req.body };
    delete updateData.company_id;
    delete updateData._id;
    if (req.body.billing_party_id !== undefined) {
      delete updateData.billing_party_id;
      entry.billing_party_id = validatedPartyId;
    }

    // If updating truck_id or driver_id, validate ownership and update snapshots
    Object.assign(entry, updateData);

    if (req.body.truck_id) {
      await validateTenantOwnership(companyId!, { truck_id: req.body.truck_id });
      const truck = await Truck.findOne({ _id: req.body.truck_id, company_id: companyId, is_deleted: false });
      if (truck) {
        entry.truck_id = truck._id;
        entry.vehicle_number = truck.truck_no.toUpperCase().trim();
      }
    }
    if (req.body.driver_id) {
      await validateTenantOwnership(companyId!, { driver_id: req.body.driver_id });
      const driver = await Driver.findOne({ _id: req.body.driver_id, company_id: companyId, is_deleted: false });
      if (driver) {
        entry.driver_id = driver._id;
        entry.driver_name = driver.name.trim();
        entry.driver_phone = driver.phone?.trim() || '';
      }
    }

    await entry.save();

    await entry.populate([
      { path: 'billing_party_id', select: 'name gstin' },
      { path: 'branch_id', select: 'branch_name branch_code is_head_office' },
      { path: 'truck_id', select: 'truck_no make model body_type tonnage_capacity status compliance_status' },
      { path: 'driver_id', select: 'name phone license_number status' },
    ]);

    res.json({
      message: 'Lorry Receipt updated successfully.',
      entry,
    });
  } catch (err: any) {
    if (err instanceof TenantOwnershipError) {
      return res.status(err.statusCode).json({ error: err.message, entityType: err.entityType });
    }
    res.status(400).json({ error: err.message || 'Failed to update LR.' });
  }
};

export const deleteEntry = async (req: Request, res: Response) => {
  try {
    const entry = await Entry.findOne({
      _id: req.params.id,
      company_id: req.tenant?.id,
      is_deleted: false,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Lorry Receipt not found.' });
    }

    if (entry.status === 'invoiced') {
      return res.status(400).json({ error: 'Cannot cancel an invoiced LR. Credit note / invoice adjustment required.' });
    }

    entry.is_deleted = true;
    entry.status = 'cancelled';
    await entry.save();

    res.json({ message: 'Lorry Receipt cancelled successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel LR.' });
  }
};

export const getPrintableLR = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const [entry, company] = await Promise.all([
      Entry.findOne({ _id: req.params.id, company_id: companyId, is_deleted: false })
        .populate('billing_party_id')
        .populate('journey_id')
        .populate('truck_id', 'truck_no make model body_type tonnage_capacity')
        .populate('driver_id', 'name phone license_number'),
      Company.findById(companyId),
    ]);

    if (!entry) {
      return res.status(404).json({ error: 'Lorry Receipt not found.' });
    }

    res.json({
      lr: entry,
      company: {
        name: company?.name,
        gstin: company?.gstin,
        phone: company?.phone,
        email: company?.email,
        address: company?.address,
        logo_url: company?.settings?.logo_url,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve printable LR.' });
  }
};
