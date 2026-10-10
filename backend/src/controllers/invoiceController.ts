/**
 * ============================================================================
 * FLEET FLOW — GST FREIGHT TAX INVOICING CONTROLLER (invoiceController.ts)
 * ============================================================================
 * 
 * Endpoints for generating GTA freight tax invoices, calculating GST/RCM,
 * tracking receivables, recording payments, and synchronizing with the Ledger.
 * ============================================================================
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Entry } from '../models/Entry.js';
import { BillingParty } from '../models/BillingParty.js';
import { Company } from '../models/Company.js';
import { Ledger } from '../models/Ledger.js';
import { logAuditEvent } from '../utils/auditService.js';
import { validateTenantOwnership, TenantOwnershipError } from '../utils/ownershipValidator.js';
import { roundMoney } from '../utils/settlementCalculator.js';
import { postInvoicePaymentJournal } from '../utils/ledgerService.js';

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: any = { company_id: companyId, is_deleted: false };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { invoice_number: searchRegex },
        { 'billing_party_snapshot.name': searchRegex },
        { 'billing_party_snapshot.gstin': searchRegex },
      ];
    }

    if (req.query.billing_party_id) {
      query.billing_party_id = req.query.billing_party_id;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.is_rcm !== undefined) {
      query.is_rcm = req.query.is_rcm === 'true';
    }

    if (req.query.from_date || req.query.to_date) {
      query.invoice_date = {};
      if (req.query.from_date) query.invoice_date.$gte = new Date(req.query.from_date as string);
      if (req.query.to_date) query.invoice_date.$lte = new Date(req.query.to_date as string);
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('billing_party_id', 'name gstin billing_address')
        .sort({ invoice_date: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve invoices.' });
  }
};

export const getInvoiceMetrics = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;

    const [aggregate] = await Invoice.aggregate([
      { $match: { company_id: companyId, is_deleted: false, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$total_amount' },
          totalCollected: { $sum: '$paid_amount' },
          totalOutstanding: { $sum: '$balance_amount' },
          totalInvoicesCount: { $sum: 1 },
          rcmCount: { $sum: { $cond: ['$is_rcm', 1, 0] } },
        },
      },
    ]);

    const overdueCount = await Invoice.countDocuments({
      company_id: companyId,
      is_deleted: false,
      status: { $in: ['issued', 'partially_paid'] },
      due_date: { $lt: new Date() },
    });

    res.json({
      metrics: {
        total_invoiced: aggregate?.totalInvoiced || 0,
        total_collected: aggregate?.totalCollected || 0,
        total_outstanding: aggregate?.totalOutstanding || 0,
        total_invoices: aggregate?.totalInvoicesCount || 0,
        rcm_invoices_count: aggregate?.rcmCount || 0,
        overdue_invoices_count: overdueCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute invoice metrics.' });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      company_id: req.tenant?.id,
      is_deleted: false,
    })
      .populate('billing_party_id')
      .populate('lr_ids');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    res.json({ invoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve invoice.' });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      billing_party_id,
      invoice_date,
      due_date,
      lr_ids = [],
      items = [],
      extra_charges = [],
      tax_type = 'rcm',
      is_rcm = true,
      place_of_supply,
      notes,
      terms_and_conditions,
    } = req.body;

    // 1. Deep Foreign Key Ownership Validation (Anti-IDOR)
    const allLrIds = [
      ...(Array.isArray(lr_ids) ? lr_ids : []),
      ...(Array.isArray(items) ? items.map((it: any) => it.entry_id || it.lr_id).filter(Boolean) : []),
    ];
    await validateTenantOwnership(companyId!, {
      billing_party_id,
      lr_ids: allLrIds.length > 0 ? allLrIds : undefined,
    });

    const [company, party] = await Promise.all([
      Company.findById(companyId),
      BillingParty.findOne({ _id: billing_party_id, company_id: companyId }),
    ]);

    if (!party) {
      return res.status(404).json({ error: 'Billing Party not found.' });
    }

    // 2. Concurrency-Safe Atomic Sequential Invoice Number
    const invoicePrefix = company?.settings?.invoice_prefix || 'INV-';
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $inc: { 'counters.invoice_seq': 1 } },
      { new: true, upsert: false }
    );
    const seq = updatedCompany?.counters?.invoice_seq || 1;
    const invoice_number = `${invoicePrefix}${String(seq).padStart(4, '0')}`;

    // Resolve Line Items: If items are empty but lr_ids are provided, auto-populate from LRs
    let processedItems = items;
    if (lr_ids.length > 0 && (!items || items.length === 0)) {
      const entries = await Entry.find({ _id: { $in: lr_ids }, company_id: companyId });
      processedItems = entries.map((e) => ({
        entry_id: e._id,
        lr_no: e.lr_no,
        lr_date: e.lr_date || new Date(),
        vehicle_no: e.vehicle_number || 'UNKNOWN',
        from_location: e.from_location || '-',
        to_location: e.to_location || '-',
        goods_description: e.goods_description || 'Transport of Goods',
        chargeable_weight: e.chargeable_weight_tonnes || 0,
        rate: e.rate_per_tonne || e.freight_amount || 0,
        rate_type: e.rate_per_tonne ? 'per_tonne' : 'fixed',
        amount: e.freight_amount || 0,
      }));
    } else {
      // Ensure all required fields exist on passed items
      processedItems = items.map((it: any) => ({
        entry_id: it.entry_id || it.lr_id,
        lr_no: it.lr_no || it.lr_number || 'LR',
        lr_date: it.lr_date || new Date(),
        vehicle_no: it.vehicle_no || it.vehicle_number || 'UNKNOWN',
        from_location: it.from_location || '-',
        to_location: it.to_location || '-',
        goods_description: it.goods_description || it.description || 'Freight Charges',
        chargeable_weight: Number(it.chargeable_weight) || Number(it.weight) || 0,
        rate: Number(it.rate) || Number(it.amount) || 0,
        rate_type: it.rate_type || 'fixed',
        amount: Number(it.amount) || 0,
      }));
    }

    const processedExtras = extra_charges.map((ec: any) => ({
      charge_type: ec.charge_type || 'other',
      description: ec.description || ec.charge_name || 'Extra Charges',
      amount: Number(ec.amount) || 0,
    }));

    // Compute Subtotal
    const itemsTotal = processedItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
    const extraTotal = processedExtras.reduce((sum: number, ec: any) => sum + (Number(ec.amount) || 0), 0);
    const subtotal = Math.round((itemsTotal + extraTotal) * 100) / 100;

    // GST Calculus
    const companyState = company?.address?.state?.trim()?.toLowerCase() || '';
    const posState = (place_of_supply || party.billing_address?.state || '').trim().toLowerCase();
    const is_interstate = companyState !== '' && posState !== '' && companyState !== posState;

    let cgst_rate = 0;
    let cgst_amount = 0;
    let sgst_rate = 0;
    let sgst_amount = 0;
    let igst_rate = 0;
    let igst_amount = 0;
    let total_tax = 0;

    if (!is_rcm && tax_type === 'forward_charge') {
      const standardRate = Number(req.body.gst_rate) || 5; // GTA standard 5% or 12%
      if (is_interstate) {
        igst_rate = standardRate;
        igst_amount = Math.round(((subtotal * igst_rate) / 100) * 100) / 100;
        total_tax = igst_amount;
      } else {
        cgst_rate = standardRate / 2;
        sgst_rate = standardRate / 2;
        cgst_amount = Math.round(((subtotal * cgst_rate) / 100) * 100) / 100;
        sgst_amount = Math.round(((subtotal * sgst_rate) / 100) * 100) / 100;
        total_tax = Math.round((cgst_amount + sgst_amount) * 100) / 100;
      }
    }

    const total_amount = Math.round((subtotal + (is_rcm ? 0 : total_tax)) * 100) / 100;

    const newInvoice = new Invoice({
      company_id: companyId,
      invoice_number,
      invoice_date: invoice_date ? new Date(invoice_date) : new Date(),
      due_date: due_date ? new Date(due_date) : new Date(Date.now() + 15 * 86400000), // Default 15 days
      billing_party_id: party._id,
      billing_party_snapshot: {
        name: party.name,
        gstin: party.gstin,
        pan: party.pan_number,
        address: party.billing_address?.street,
        city: party.billing_address?.city,
        state: party.billing_address?.state,
      },
      lr_ids,
      items: processedItems,
      extra_charges: processedExtras,
      subtotal,
      tax_type,
      is_rcm: Boolean(is_rcm),
      place_of_supply: place_of_supply || party.billing_address?.state || 'Maharashtra',
      is_interstate,
      cgst_rate,
      cgst_amount,
      sgst_rate,
      sgst_amount,
      igst_rate,
      igst_amount,
      total_tax,
      total_amount,
      paid_amount: 0,
      balance_amount: total_amount,
      status: 'issued',
      notes,
      terms_and_conditions,
    });

    await newInvoice.save();

    // Mark associated LRs as invoiced
    if (lr_ids.length > 0) {
      await Entry.updateMany(
        { _id: { $in: lr_ids }, company_id: companyId },
        { $set: { status: 'invoiced', invoice_id: newInvoice._id } }
      );
    }

    logAuditEvent({
      company_id: companyId,
      entity_type: 'invoice',
      entity_id: newInvoice._id,
      entity_identifier: newInvoice.invoice_number,
      action: 'CREATE',
      description: `GST Freight Invoice ${newInvoice.invoice_number} generated for ${newInvoice.billing_party_snapshot?.name} (Total: ₹${newInvoice.total_amount}).`,
      req,
      after_snapshot: { invoice_number: newInvoice.invoice_number, total_amount: newInvoice.total_amount },
    });

    res.status(201).json({
      message: 'GST Freight Invoice created successfully.',
      invoice: newInvoice,
    });
  } catch (err: any) {
    if (err instanceof TenantOwnershipError) {
      return res.status(err.statusCode).json({ error: err.message, entityType: err.entityType });
    }
    res.status(400).json({ error: err.message || 'Failed to create invoice.' });
  }
};

export const recordInvoicePayment = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.tenant?.id;
    const { amount, tds_amount = 0, payment_mode = 'bank_transfer', reference_number, notes } = req.body;

    const paymentVal = roundMoney(Number(amount));
    const tdsVal = roundMoney(Number(tds_amount) || 0);

    if (!paymentVal || paymentVal <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      company_id: companyId,
      is_deleted: false,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (invoice.status === 'paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invoice is already settled in full.' });
    }

    const totalSettledInStep = roundMoney(paymentVal + tdsVal);
    invoice.paid_amount = roundMoney(invoice.paid_amount + totalSettledInStep);
    invoice.balance_amount = Math.max(0, roundMoney(invoice.total_amount - invoice.paid_amount));
    invoice.status = invoice.balance_amount <= 0 ? 'paid' : 'partially_paid';

    invoice.payment_history.push({
      date: new Date(),
      amount: paymentVal,
      tds_amount: tdsVal,
      payment_mode,
      reference_number,
      notes,
    });

    await invoice.save({ session });

    // Automatically post balanced double-entry journal to General Ledger
    await postInvoicePaymentJournal({
      company_id: companyId!,
      session,
      invoice_id: invoice._id as any,
      invoice_number: invoice.invoice_number,
      billing_party_id: invoice.billing_party_id as any,
      party_name: invoice.billing_party_snapshot?.name || 'Customer',
      payment_amount: paymentVal,
      tds_amount: tdsVal,
      payment_mode,
      reference_number,
      created_by: req.user?._id,
    });

    await session.commitTransaction();
    session.endSession();

    logAuditEvent({
      company_id: companyId!,
      entity_type: 'invoice',
      entity_id: invoice._id,
      entity_identifier: invoice.invoice_number,
      action: 'UPDATE',
      description: `Payment of ₹${paymentVal}${tdsVal > 0 ? ` (TDS: ₹${tdsVal})` : ''} recorded against Invoice ${invoice.invoice_number}.`,
      req,
    });

    res.json({
      message: 'Payment recorded and posted to General Ledger.',
      invoice,
    });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: err.message || 'Failed to record payment.' });
  }
};

export const cancelInvoice = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.tenant?.id;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      company_id: companyId,
      is_deleted: false,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (invoice.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invoice has already been cancelled.' });
    }

    if (invoice.paid_amount > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Cannot cancel invoice with recorded payment collections. Reverse payments first.' });
    }

    invoice.status = 'cancelled';
    await invoice.save({ session });

    // Release associated LRs back to active status
    if (invoice.lr_ids?.length > 0) {
      await Entry.updateMany(
        { _id: { $in: invoice.lr_ids }, company_id: companyId },
        { $set: { status: 'active', invoice_id: null } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    logAuditEvent({
      company_id: companyId!,
      entity_type: 'invoice',
      entity_id: invoice._id,
      entity_identifier: invoice.invoice_number,
      action: 'UPDATE',
      description: `Invoice ${invoice.invoice_number} voided/cancelled and linked LRs released.`,
      req,
    });

    res.json({ message: 'Invoice cancelled and linked LRs released.' });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message || 'Failed to cancel invoice.' });
  }
};
