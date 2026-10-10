/**
 * ============================================================================
 * COMMERCIAL REPORT CONTROLLER (commercialReportController.ts)
 * ============================================================================
 * Handles AR Aging matrix, trip profitability analysis, customer SOA,
 * and Tally XML export endpoints for finance teams.
 * 
 * Routes:
 *   GET  /api/commercial/aging           - AR aging buckets by customer
 *   GET  /api/commercial/profitability   - Trip P&L and margin analysis
 *   GET  /api/commercial/export/tally    - Tally Prime XML voucher download
 *   POST /api/commercial/credit-notes    - Create GST credit/debit note
 *   GET  /api/commercial/credit-notes    - List all credit notes
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Invoice } from '../models/Invoice.js';
import { Entry } from '../models/Entry.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { CreditNote } from '../models/CreditNote.js';
import { Ledger } from '../models/Ledger.js';
import { getTenantId } from '../plugins/tenantPlugin.js';
import {
  generateSalesVoucher,
  generateReceiptVoucher,
  wrapInTallyEnvelope,
  TallyInvoiceData,
} from '../utils/tallyExportService.js';

/**
 * GET /api/commercial/aging
 * Returns AR aging buckets: Current (0-30), 31-60, 61-90, 90+ days.
 */
export async function getArAgingReport(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const now = new Date();

    // Get all unpaid or partially paid invoices
    const invoices = await Invoice.find({
      company_id: companyId,
      status: { $in: ['issued', 'partially_paid'] },
    })
      .populate('billing_party_id', 'party_name gstin contact_phone')
      .lean();

    const buckets = {
      current_0_30: [] as any[],
      days_31_60: [] as any[],
      days_61_90: [] as any[],
      overdue_90_plus: [] as any[],
    };

    let totalOutstanding = 0;

    for (const inv of invoices) {
      const outstanding = Math.round((inv.balance_amount ?? (inv.total_amount - (inv.paid_amount || 0))) * 100);
      if (outstanding <= 0) continue;

      const invoiceDate = new Date(inv.invoice_date || inv.created_at);
      const ageDays = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

      const summary = {
        invoice_id: inv._id,
        invoice_no: inv.invoice_number,
        party: inv.billing_party_snapshot?.name || (inv.billing_party_id as any)?.party_name || 'Customer',
        invoice_date: inv.invoice_date || inv.created_at,
        outstanding_paise: outstanding,
        age_days: ageDays,
      };

      totalOutstanding += outstanding;

      if (ageDays <= 30) buckets.current_0_30.push(summary);
      else if (ageDays <= 60) buckets.days_31_60.push(summary);
      else if (ageDays <= 90) buckets.days_61_90.push(summary);
      else buckets.overdue_90_plus.push(summary);
    }

    // Calculate summary totals per bucket
    const summarize = (arr: any[]) => ({
      count: arr.length,
      total_paise: arr.reduce((s, x) => s + x.outstanding_paise, 0),
      items: arr,
    });

    res.json({
      aging: {
        current_0_30: summarize(buckets.current_0_30),
        days_31_60: summarize(buckets.days_31_60),
        days_61_90: summarize(buckets.days_61_90),
        overdue_90_plus: summarize(buckets.overdue_90_plus),
      },
      total_outstanding_paise: totalOutstanding,
      as_of: now.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/commercial/profitability
 * Trip P&L: Revenue - (Diesel + Toll + Driver Settlement + Brokerage) = Net Margin
 */
export async function getTripProfitabilityReport(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { from, to, limit = 50 } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from as string);
    if (to) dateFilter.$lte = new Date(to as string);

    const journeyQuery: any = { company_id: companyId };
    if (Object.keys(dateFilter).length > 0) {
      journeyQuery.dispatch_date = dateFilter;
    }

    const journeys = await TruckJourney.find(journeyQuery)
      .sort({ dispatch_date: -1 })
      .limit(Number(limit))
      .populate('truck_id', 'registration_number')
      .populate('driver_id', 'name')
      .lean();

    const profitReport = journeys.map((j) => {
      const revenue_paise = (j as any).total_freight_paise || 0;
      const expenses_paise =
        ((j as any).diesel_expense_paise || 0) +
        ((j as any).toll_expense_paise || 0) +
        ((j as any).driver_allowance_paise || 0) +
        ((j as any).other_expense_paise || 0);

      const net_margin_paise = revenue_paise - expenses_paise;
      const margin_percent =
        revenue_paise > 0 ? ((net_margin_paise / revenue_paise) * 100).toFixed(2) : '0.00';

      return {
        journey_id: j._id,
        from: j.from_location,
        to: j.to_location,
        truck: (j.truck_id as any)?.truck_no,
        driver: (j.driver_id as any)?.name,
        dispatch_date: j.start_date,
        status: j.status,
        revenue_paise,
        expenses_paise,
        net_margin_paise,
        margin_percent: parseFloat(margin_percent),
      };
    });

    const totalRevenue = profitReport.reduce((s, x) => s + x.revenue_paise, 0);
    const totalExpenses = profitReport.reduce((s, x) => s + x.expenses_paise, 0);
    const overallMargin = totalRevenue > 0
      ? (((totalRevenue - totalExpenses) / totalRevenue) * 100).toFixed(2)
      : '0.00';

    res.json({
      trips: profitReport,
      summary: {
        total_trips: profitReport.length,
        total_revenue_paise: totalRevenue,
        total_expenses_paise: totalExpenses,
        net_profit_paise: totalRevenue - totalExpenses,
        overall_margin_percent: parseFloat(overallMargin),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/commercial/export/tally
 * Downloads Tally XML voucher file for a date range.
 */
export async function exportToTallyXml(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { from, to } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from as string);
    if (to) dateFilter.$lte = new Date(to as string);

    const invoiceQuery: any = { company_id: companyId, status: { $ne: 'cancelled' } };
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.invoice_date = dateFilter;
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('billing_party_id', 'party_name')
      .lean();

    const vouchers: string[] = [];

    for (const inv of invoices) {
      const party = inv.billing_party_id as any;
      const partyName = inv.billing_party_snapshot?.name || party?.party_name || 'Sundry Debtors';
      const data: TallyInvoiceData = {
        invoice_no: inv.invoice_number,
        date: new Date(inv.invoice_date || inv.created_at),
        party_name: partyName,
        party_ledger: partyName,
        freight_amount_paise: Math.round((inv.subtotal || 0) * 100),
        cgst_paise: Math.round((inv.cgst_amount || 0) * 100),
        sgst_paise: Math.round((inv.sgst_amount || 0) * 100),
        igst_paise: Math.round((inv.igst_amount || 0) * 100),
        total_paise: Math.round((inv.total_amount || 0) * 100),
        narration: `Freight Invoice: ${inv.invoice_number}`,
      };
      vouchers.push(generateSalesVoucher(data));
    }

    const xml = wrapInTallyEnvelope(vouchers);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="Tally_Sales_Vouchers.xml"');
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/commercial/credit-notes
 * Create a GST Section 34 credit note against an existing invoice.
 */
export async function createCreditNote(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const user = (req as any).user;
    const {
      original_invoice_id,
      type,
      reason,
      reason_description,
      adjustment_amount_paise,
      is_interstate = false,
      gst_rate_percent = 5,
    } = req.body;

    if (!original_invoice_id || !type || !reason || !adjustment_amount_paise) {
      res.status(400).json({ error: 'original_invoice_id, type, reason, and adjustment_amount_paise are required.' });
      return;
    }

    const invoice = await Invoice.findOne({ _id: original_invoice_id, company_id: companyId });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }

    // Calculate GST on adjustment
    let cgst_paise = 0;
    let sgst_paise = 0;
    let igst_paise = 0;
    const gstAmount = Math.round(adjustment_amount_paise * (gst_rate_percent / 100));

    if (is_interstate) {
      igst_paise = gstAmount;
    } else {
      cgst_paise = Math.round(gstAmount / 2);
      sgst_paise = gstAmount - cgst_paise;
    }

    const total_adjustment_paise = adjustment_amount_paise + cgst_paise + sgst_paise + igst_paise;

    // Generate sequential credit note number
    const count = await CreditNote.countDocuments({ company_id: companyId });
    const year = new Date().getFullYear();
    const credit_note_no = `CN-${year}-${String(count + 1).padStart(4, '0')}`;

    const creditNote = await CreditNote.create({
      company_id: companyId,
      credit_note_no,
      original_invoice_id,
      party_id: invoice.billing_party_id,
      type,
      reason,
      reason_description,
      adjustment_amount_paise,
      cgst_paise,
      sgst_paise,
      igst_paise,
      total_adjustment_paise,
      is_interstate,
      gst_rate_percent,
      status: 'issued',
      issued_at: new Date(),
      created_by: user._id,
    });

    // Reduce the invoice's outstanding balance
    await Invoice.updateOne(
      { _id: original_invoice_id },
      { $inc: { amount_paid_paise: total_adjustment_paise } }
    );

    res.status(201).json({ success: true, credit_note: creditNote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/commercial/credit-notes
 * List all credit/debit notes for the company.
 */
export async function listCreditNotes(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const creditNotes = await CreditNote.find({ company_id: companyId })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    res.json({ credit_notes: creditNotes, total: creditNotes.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
