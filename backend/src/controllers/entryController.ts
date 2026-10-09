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
import { Entry } from '../models/Entry.js';
import { Company } from '../models/Company.js';

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

    if (req.query.from_date || req.query.to_date) {
      query.lr_date = {};
      if (req.query.from_date) query.lr_date.$gte = new Date(req.query.from_date as string);
      if (req.query.to_date) query.lr_date.$lte = new Date(req.query.to_date as string);
    }

    const [entries, total] = await Promise.all([
      Entry.find(query)
        .populate('billing_party_id', 'name gstin')
        .populate('journey_id', 'journey_number status')
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

    const [totalLrs, activeLrs, invoicedLrs, toBeBilled, aggregateVal] = await Promise.all([
      Entry.countDocuments({ company_id: companyId, is_deleted: false }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, status: 'active' }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, status: 'invoiced' }),
      Entry.countDocuments({ company_id: companyId, is_deleted: false, freight_terms: 'to_be_billed', status: 'active' }),
      Entry.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
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
      .populate('journey_id');

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

    // Fetch company defaults for prefix
    const company = await Company.findById(companyId);
    const lrPrefix = company?.settings?.lr_prefix || 'LR-';

    // Auto-generate next LR number if not provided
    let lr_no = req.body.lr_no?.trim()?.toUpperCase();
    if (!lr_no) {
      const lastEntry = await Entry.findOne({ company_id: companyId })
        .sort({ created_at: -1 })
        .select('lr_no');

      let nextNum = 1;
      if (lastEntry?.lr_no) {
        const matches = lastEntry.lr_no.match(/\d+$/);
        if (matches) {
          nextNum = parseInt(matches[0], 10) + 1;
        }
      }
      lr_no = `${lrPrefix}${String(nextNum).padStart(4, '0')}`;
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

    const newEntry = new Entry({
      ...req.body,
      company_id: companyId,
      bill_no,
      lr_no,
      status: 'active',
    });

    await newEntry.save();

    res.status(201).json({
      message: 'Lorry Receipt created successfully.',
      entry: newEntry,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create Lorry Receipt.' });
  }
};

export const updateEntry = async (req: Request, res: Response) => {
  try {
    const entry = await Entry.findOne({
      _id: req.params.id,
      company_id: req.tenant?.id,
      is_deleted: false,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Lorry Receipt not found.' });
    }

    if (entry.status === 'invoiced' && req.body.freight_amount && req.body.freight_amount !== entry.freight_amount) {
      return res.status(400).json({ error: 'Cannot modify freight amount on an already invoiced LR.' });
    }

    Object.assign(entry, req.body);
    await entry.save();

    res.json({
      message: 'Lorry Receipt updated successfully.',
      entry,
    });
  } catch (err: any) {
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
        .populate('journey_id'),
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
