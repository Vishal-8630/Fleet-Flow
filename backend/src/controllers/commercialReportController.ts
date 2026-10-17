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
import { Branch } from '../models/Branch.js';
import { Ledger } from '../models/Ledger.js';
import { getTenantId } from '../plugins/tenantPlugin.js';
import {
  generateSalesVoucher,
  generateReceiptVoucher,
  wrapInTallyEnvelope,
  TallyInvoiceData,
} from '../utils/tallyExportService.js';
import { roundMoney } from '../utils/settlementCalculator.js';
import { postCreditNoteJournal } from '../utils/ledgerService.js';
import { runInTransaction, ConfigurationError } from '../utils/transactionHelper.js';

/**
 * GET /api/commercial/aging
 * Returns AR aging buckets: Current (0-30), 31-60, 61-90, 90+ days.
 */
export async function getArAgingReport(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const now = new Date();

    const invoiceQuery: any = {
      company_id: companyId,
      status: { $in: ['issued', 'partially_paid'] },
    };

    if (req.query.branch_id) {
      const branch = await Branch.findOne({ _id: req.query.branch_id, company_id: companyId });
      if (!branch) {
        res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
        return;
      }
      invoiceQuery.branch_id = branch._id;
    }

    // Get all unpaid or partially paid invoices
    const invoices = await Invoice.find(invoiceQuery)
      .populate('billing_party_id', 'party_name gstin contact_phone')
      .populate('branch_id', 'branch_name branch_code')
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

      const partyName = inv.billing_party_snapshot?.name || (inv.billing_party_id as any)?.party_name || (inv.billing_party_id as any)?.name || 'Customer';
      const summary = {
        invoice_id: inv._id,
        invoice_no: inv.invoice_number,
        branch_id: (inv as any).branch_id?._id || inv.branch_id || null,
        party: { party_name: partyName, name: partyName },
        customer_name: partyName,
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
    const { from, to, limit = 50, branch_id } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from as string);
    if (to) dateFilter.$lte = new Date(to as string);

    const journeyQuery: any = { company_id: companyId, is_deleted: false };
    if (Object.keys(dateFilter).length > 0) {
      journeyQuery.start_date = dateFilter;
    }

    if (branch_id) {
      const branch = await Branch.findOne({ _id: branch_id, company_id: companyId });
      if (!branch) {
        res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
        return;
      }
      journeyQuery.branch_id = branch._id;
    }

    const journeys = await TruckJourney.find(journeyQuery)
      .sort({ start_date: -1 })
      .limit(Number(limit))
      .populate('truck_id', 'registration_number truck_no')
      .populate('driver_id', 'name')
      .populate('branch_id', 'branch_name branch_code is_head_office')
      .lean();

    const profitReport = journeys.map((j) => {
      const freightRupees = Number((j as any).freight_rate) || 0;
      const dieselRupees = Number((j as any).total_diesel_cost) || 0;
      const driverRupees = Number((j as any).total_driver_expenses) || 0;

      const revenue_paise = Math.round(freightRupees * 100);
      const diesel_expense_paise = Math.round(dieselRupees * 100);
      const driver_expense_paise = Math.round(driverRupees * 100);
      const expenses_paise = diesel_expense_paise + driver_expense_paise;

      const net_margin_paise = revenue_paise - expenses_paise;
      const margin_percent =
        revenue_paise > 0 ? ((net_margin_paise / revenue_paise) * 100).toFixed(2) : '0.00';

      const fromLocation =
        typeof j.from_location === 'object' && j.from_location !== null
          ? ((j.from_location as any).city || (j.from_location as any).hub_name || 'Origin')
          : (j.from_location || 'Origin');
      const toLocation =
        typeof j.to_location === 'object' && j.to_location !== null
          ? ((j.to_location as any).city || (j.to_location as any).hub_name || 'Destination')
          : (j.to_location || 'Destination');

      return {
        journey_id: j._id,
        journey_number: (j as any).journey_number,
        branch_id: (j as any).branch_id?._id || (j as any).branch_id || null,
        branch_name: (j as any).branch_id?.branch_name || 'Head Office / Global',
        from: fromLocation,
        to: toLocation,
        truck: (j.truck_id as any)?.registration_number || (j.truck_id as any)?.truck_no || 'Vehicle',
        driver: (j.driver_id as any)?.name || 'Driver',
        dispatch_date: (j as any).start_date || (j as any).createdAt,
        status: j.status,
        revenue_paise,
        diesel_expense_paise,
        driver_expense_paise,
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
    const { from, to, branch_id } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from as string);
    if (to) dateFilter.$lte = new Date(to as string);

    const invoiceQuery: any = { company_id: companyId, status: { $ne: 'cancelled' } };
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.invoice_date = dateFilter;
    }

    if (branch_id) {
      const branch = await Branch.findOne({ _id: branch_id, company_id: companyId });
      if (!branch) {
        res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
        return;
      }
      invoiceQuery.branch_id = branch._id;
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
      type = 'credit_note',
      reason,
      reason_description,
      adjustment_amount_paise,
      is_interstate = false,
      gst_rate_percent = 5,
    } = req.body;

    if (!original_invoice_id || !reason || !adjustment_amount_paise) {
      res.status(400).json({ error: 'original_invoice_id, reason, and adjustment_amount_paise are required.' });
      return;
    }

    const result = await runInTransaction(
      async (session) => {
        const invoice = await Invoice.findOne({
          _id: original_invoice_id,
          company_id: companyId,
          is_deleted: false,
        }).session(session);

        if (!invoice) {
          const err: any = new Error('Invoice not found.');
          err.statusCode = 404;
          throw err;
        }

        if (invoice.status === 'paid' && invoice.balance_amount <= 0) {
          const err: any = new Error('Invoice has already been settled in full.');
          err.statusCode = 400;
          throw err;
        }

        // Calculate GST on adjustment
        let cgst_paise = 0;
        let sgst_paise = 0;
        let igst_paise = 0;
        const gstAmount = Math.round(Number(adjustment_amount_paise) * (Number(gst_rate_percent) / 100));

        if (is_interstate) {
          igst_paise = gstAmount;
        } else {
          cgst_paise = Math.round(gstAmount / 2);
          sgst_paise = gstAmount - cgst_paise;
        }

        const total_adjustment_paise = Number(adjustment_amount_paise) + cgst_paise + sgst_paise + igst_paise;
        const creditAdjustmentRupees = roundMoney(total_adjustment_paise / 100);

        if (creditAdjustmentRupees <= 0) {
          const err: any = new Error('Credit note adjustment amount must be greater than zero.');
          err.statusCode = 400;
          throw err;
        }

        if (creditAdjustmentRupees > invoice.balance_amount) {
          const err: any = new Error(
            `Credit note adjustment (₹${creditAdjustmentRupees}) exceeds eligible invoice balance (₹${invoice.balance_amount}).`
          );
          err.statusCode = 400;
          throw err;
        }

        // Generate sequential credit note number
        const count = await CreditNote.countDocuments({ company_id: companyId }).session(session);
        const year = new Date().getFullYear();
        const credit_note_no = `CN-${year}-${String(count + 1).padStart(4, '0')}`;

        const [creditNote] = await CreditNote.create(
          [
            {
              company_id: companyId,
              credit_note_no,
              original_invoice_id: invoice._id,
              party_id: invoice.billing_party_id,
              type,
              reason,
              reason_description,
              adjustment_amount_paise: Number(adjustment_amount_paise),
              cgst_paise,
              sgst_paise,
              igst_paise,
              total_adjustment_paise,
              is_interstate: Boolean(is_interstate),
              gst_rate_percent: Number(gst_rate_percent),
              status: 'issued',
              issued_at: new Date(),
              created_by: user?._id || user?.id,
            },
          ],
          { session }
        );

        // Update invoice credited_amount and balance_amount (do NOT touch paid_amount)
        invoice.credited_amount = roundMoney((invoice.credited_amount || 0) + creditAdjustmentRupees);
        invoice.balance_amount = Math.max(
          0,
          roundMoney(invoice.total_amount - (invoice.paid_amount || 0) - invoice.credited_amount)
        );
        invoice.status = invoice.balance_amount <= 0 ? 'paid' : 'partially_paid';
        await invoice.save({ session });

        // Post balanced double-entry journal to General Ledger
        await postCreditNoteJournal({
          company_id: companyId!,
          session,
          credit_note_id: creditNote._id as any,
          credit_note_no,
          invoice_id: invoice._id as any,
          invoice_number: invoice.invoice_number,
          billing_party_id: invoice.billing_party_id as any,
          party_name: invoice.billing_party_snapshot?.name || 'Customer',
          credit_amount: creditAdjustmentRupees,
          created_by: user?._id || user?.id,
        });

        return {
          success: true,
          credit_note: creditNote,
          invoice,
        };
      },
      { statusCode: 201 }
    );

    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
      return;
    }
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to create credit note.' });
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
