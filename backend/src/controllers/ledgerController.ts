/**
 * ============================================================================
 * FLEET FLOW — GENERAL FINANCIAL LEDGER & PARTY BALANCES (ledgerController.ts)
 * ============================================================================
 * 
 * Manages the double-entry accounting general ledger across 17 categories,
 * enforces immutability on auto-generated entries, and provides party balance
 * reconciliation for sub-contracted market truck vendors.
 * ============================================================================
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Ledger } from '../models/Ledger.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { Invoice } from '../models/Invoice.js';
import { Settlement } from '../models/Settlement.js';
import { Company } from '../models/Company.js';
import { roundMoney } from '../utils/settlementCalculator.js';
import { postDoubleEntryJournal } from '../utils/ledgerService.js';
import { runInTransaction, ConfigurationError } from '../utils/transactionHelper.js';

export const getLedgerEntries = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query: any = { company_id: companyId, is_deleted: false };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { transaction_number: searchRegex },
        { journal_id: searchRegex },
        { description: searchRegex },
        { party_name: searchRegex },
        { reference_number: searchRegex },
      ];
    }

    if (req.query.journal_id) {
      query.journal_id = req.query.journal_id;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.balance_type) {
      query.balance_type = req.query.balance_type;
    }

    if (req.query.payment_mode) {
      query.payment_mode = req.query.payment_mode;
    }

    if (req.query.from_date || req.query.to_date) {
      query.transaction_date = {};
      if (req.query.from_date) query.transaction_date.$gte = new Date(req.query.from_date as string);
      if (req.query.to_date) query.transaction_date.$lte = new Date(req.query.to_date as string);
    }

    const [entries, total] = await Promise.all([
      Ledger.find(query)
        .sort({ transaction_date: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ledger.countDocuments(query),
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
    res.status(500).json({ error: err.message || 'Failed to retrieve ledger entries.' });
  }
};

export const getLedgerSummary = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const companyObjectId = new mongoose.Types.ObjectId(String(companyId));

    const [aggregates, categoryBreakdown] = await Promise.all([
      Ledger.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: { $cond: [{ $eq: ['$balance_type', 'credit'] }, '$amount', 0] } },
            totalDebits: { $sum: { $cond: [{ $eq: ['$balance_type', 'debit'] }, '$amount', 0] } },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
      Ledger.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    const totalCredits = aggregates[0]?.totalCredits || 0;
    const totalDebits = aggregates[0]?.totalDebits || 0;
    const netCashPosition = totalCredits - totalDebits;

    res.json({
      summary: {
        total_credits: totalCredits,
        total_debits: totalDebits,
        net_cash_position: netCashPosition,
        transaction_count: aggregates[0]?.transactionCount || 0,
        category_breakdown: categoryBreakdown,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute ledger summary.' });
  }
};

export const createManualLedgerEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      transaction_date,
      category,
      balance_type,
      amount,
      payment_mode = 'bank',
      reference_number,
      party_name,
      description,
      truck_id,
      driver_id,
      billing_party_id,
      balance_party_id,
      legs,
    } = req.body;

    // Multi-leg double-entry manual journal voucher (atomic transaction)
    if (legs && Array.isArray(legs) && legs.length >= 2) {
      const journalResult = await runInTransaction(
        async (session) => {
          const posted = await postDoubleEntryJournal({
            company_id: companyId!,
            session,
            transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
            transaction_type: 'manual_adjustment',
            description: description || 'Manual Double-Entry Journal Voucher',
            reference_number,
            party_name,
            legs,
            is_auto_generated: false,
            created_by: req.user?._id,
            truck_id,
            driver_id,
            billing_party_id,
            balance_party_id,
          });
          return {
            message: 'Manual journal voucher recorded with double-entry balance.',
            journal_id: posted.journal_id,
            entries: posted.entries,
          };
        },
        { statusCode: 201 }
      );

      return res.status(201).json(journalResult);
    }

    const count = await Ledger.countDocuments({ company_id: companyId });
    const transaction_number = `TXN-${String(count + 1).padStart(4, '0')}`;

    const newEntry = new Ledger({
      company_id: companyId,
      transaction_number,
      transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
      category,
      transaction_type: 'manual_adjustment',
      balance_type,
      amount: Number(amount),
      payment_mode,
      reference_number,
      party_name,
      description,
      is_auto_generated: false,
      truck_id,
      driver_id,
      billing_party_id,
      balance_party_id,
      created_by: req.user?._id,
    });

    await newEntry.save();

    res.status(201).json({
      message: 'Ledger journal entry recorded.',
      entry: newEntry,
    });
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Failed to create ledger entry.' });
  }
};

export const reverseLedgerEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { reversal_reason } = req.body;

    const reversalEntry = await runInTransaction(async (session) => {
      const originalEntry = await Ledger.findOne({
        _id: req.params.id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!originalEntry) {
        const err: any = new Error('Ledger entry not found.');
        err.statusCode = 404;
        throw err;
      }

      if (originalEntry.is_reversal) {
        const err: any = new Error('This ledger entry has already been reversed.');
        err.statusCode = 400;
        throw err;
      }

      // Flag original entry as reversed
      originalEntry.is_reversal = true;
      originalEntry.reversal_reason = reversal_reason || 'Reversed by user';
      await originalEntry.save({ session });

      // Create the counter-balancing reversal entry
      const count = await Ledger.countDocuments({ company_id: companyId }).session(session);
      const transaction_number = `REV-${String(count + 1).padStart(4, '0')}`;
      const reversal_journal_id = originalEntry.journal_id ? `REV-${originalEntry.journal_id}` : undefined;

      const newReversal = new Ledger({
        company_id: companyId,
        transaction_number,
        journal_id: reversal_journal_id,
        transaction_date: new Date(),
        category: originalEntry.category,
        transaction_type: originalEntry.transaction_type,
        balance_type: originalEntry.balance_type === 'debit' ? 'credit' : 'debit', // Invert balance
        amount: roundMoney(originalEntry.amount),
        payment_mode: originalEntry.payment_mode,
        reference_number: `REV:${originalEntry.transaction_number}`,
        party_name: originalEntry.party_name,
        description: `Reversal of ${originalEntry.transaction_number}: ${reversal_reason || 'Correction entry'}`,
        is_auto_generated: true,
        is_reversal: true,
        reversed_entry_id: originalEntry._id,
        journey_id: originalEntry.journey_id,
        truck_id: originalEntry.truck_id,
        driver_id: originalEntry.driver_id,
        billing_party_id: originalEntry.billing_party_id,
        balance_party_id: originalEntry.balance_party_id,
        settlement_id: originalEntry.settlement_id,
        invoice_id: originalEntry.invoice_id,
        vehicle_entry_id: originalEntry.vehicle_entry_id,
        created_by: req.user?._id,
      });

      await newReversal.save({ session });
      return {
        message: 'Journal entry reversed with counter-balancing audit posting.',
        reversal_entry: newReversal,
      };
    });

    res.json(reversalEntry);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to reverse entry.' });
  }
};

/**
 * GET /api/commercial/ledger/reconciliation
 * Performs an automated financial audit verifying that debits and credits
 * are balanced across the entire general ledger, checking double-entry journal
 * consistency, and reconciling invoices and driver settlements.
 */
export const getLedgerReconciliation = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const companyObjectId = new mongoose.Types.ObjectId(String(companyId));

    // 1. Ledger Balance Aggregates
    const [ledgerAgg] = await Ledger.aggregate([
      { $match: { company_id: companyObjectId, is_deleted: false } },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: { $cond: [{ $eq: ['$balance_type', 'credit'] }, '$amount', 0] } },
          totalDebits: { $sum: { $cond: [{ $eq: ['$balance_type', 'debit'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalDebits = roundMoney(ledgerAgg?.totalDebits || 0);
    const totalCredits = roundMoney(ledgerAgg?.totalCredits || 0);
    const difference = roundMoney(Math.abs(totalDebits - totalCredits));
    const isBalanced = difference === 0;

    // 2. Journal Double-Entry Integrity Check
    const journalUnbalance = await Ledger.aggregate([
      { $match: { company_id: companyObjectId, is_deleted: false, journal_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$journal_id',
          debits: { $sum: { $cond: [{ $eq: ['$balance_type', 'debit'] }, '$amount', 0] } },
          credits: { $sum: { $cond: [{ $eq: ['$balance_type', 'credit'] }, '$amount', 0] } },
          legsCount: { $sum: 1 },
        },
      },
      {
        $project: {
          journal_id: '$_id',
          debits: 1,
          credits: 1,
          legsCount: 1,
          variance: { $abs: { $subtract: ['$debits', '$credits'] } },
        },
      },
      {
        $match: {
          variance: { $gt: 0.001 },
        },
      },
    ]);

    // 3. Invoicing Commercial Balance
    const [invoiceAgg] = await Invoice.aggregate([
      { $match: { company_id: companyObjectId, is_deleted: false, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$total_amount' },
          totalCollected: { $sum: '$paid_amount' },
          totalCredited: { $sum: { $ifNull: ['$credited_amount', 0] } },
          totalBalance: { $sum: '$balance_amount' },
          invoicesCount: { $sum: 1 },
        },
      },
    ]);

    // Read-only financial integrity audit: identify inconsistent invoice balances
    const inconsistentInvoices = await Invoice.find({
      company_id: companyObjectId,
      is_deleted: false,
      status: { $ne: 'cancelled' },
      $expr: {
        $gt: [
          {
            $abs: {
              $subtract: [
                '$balance_amount',
                {
                  $subtract: [
                    '$total_amount',
                    { $add: [{ $ifNull: ['$paid_amount', 0] }, { $ifNull: ['$credited_amount', 0] }] },
                  ],
                },
              ],
            },
          },
          0.01,
        ],
      },
    })
      .select('invoice_number total_amount paid_amount credited_amount balance_amount status')
      .limit(20)
      .lean();

    // 4. Driver Settlement Statistics
    const [settlementAgg] = await Settlement.aggregate([
      { $match: { company_id: companyObjectId, is_deleted: false } },
      {
        $group: {
          _id: null,
          totalNetSettled: { $sum: '$net_amount' },
          totalPaidOut: { $sum: { $cond: [{ $eq: ['$payment_status', 'paid'] }, '$net_amount', 0] } },
          totalUnpaid: { $sum: { $cond: [{ $eq: ['$payment_status', 'unpaid'] }, '$net_amount', 0] } },
          settlementsCount: { $sum: 1 },
        },
      },
    ]);

    // 5. Vendor Payables and Payouts Integrity Check
    const [payoutsByParty, duesByParty, balanceParties] = await Promise.all([
      Ledger.aggregate([
        {
          $match: {
            company_id: companyObjectId,
            category: 'payment_made',
            balance_type: 'debit',
            is_deleted: false,
            is_reversal: false,
            balance_party_id: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$balance_party_id',
            totalPayouts: { $sum: '$amount' },
            payoutCount: { $sum: 1 },
          },
        },
      ]),
      VehicleEntry.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        {
          $group: {
            _id: '$balance_party_id',
            totalNetDue: { $sum: '$net_balance_due' },
          },
        },
      ]),
      BalanceParty.find({ company_id: companyObjectId, is_deleted: false })
        .select('party_name opening_balance')
        .lean(),
    ]);

    const dueMap = new Map();
    duesByParty.forEach((d) => {
      if (d._id) dueMap.set(d._id.toString(), d.totalNetDue || 0);
    });

    const partyMap = new Map();
    balanceParties.forEach((p) => {
      partyMap.set(p._id.toString(), p);
    });

    const excessivePayouts: any[] = [];
    payoutsByParty.forEach((p) => {
      const partyIdStr = p._id ? p._id.toString() : '';
      const partyDoc = partyMap.get(partyIdStr);
      const grossDue = roundMoney((dueMap.get(partyIdStr) || 0) + (partyDoc?.opening_balance || 0));
      const payouts = roundMoney(p.totalPayouts || 0);
      if (payouts > grossDue + 0.01) {
        excessivePayouts.push({
          balance_party_id: p._id,
          party_name: partyDoc?.party_name || 'Vendor',
          total_payouts: payouts,
          gross_payable: grossDue,
          excess_amount: roundMoney(payouts - grossDue),
        });
      }
    });

    res.json({
      reconciliation: {
        global_ledger: {
          total_debits: totalDebits,
          total_credits: totalCredits,
          difference,
          is_balanced: isBalanced,
          transaction_count: ledgerAgg?.count || 0,
        },
        journal_integrity: {
          unbalanced_journals_count: journalUnbalance.length,
          unbalanced_journals: journalUnbalance,
          all_journals_balanced: journalUnbalance.length === 0,
        },
        invoicing: {
          total_invoiced: roundMoney(invoiceAgg?.totalInvoiced || 0),
          total_collected: roundMoney(invoiceAgg?.totalCollected || 0),
          total_credited: roundMoney(invoiceAgg?.totalCredited || 0),
          total_outstanding: roundMoney(invoiceAgg?.totalBalance || 0),
          invoices_count: invoiceAgg?.invoicesCount || 0,
          inconsistent_invoices_count: inconsistentInvoices.length,
          inconsistent_invoices: inconsistentInvoices,
        },
        driver_settlements: {
          total_net_settled: roundMoney(settlementAgg?.totalNetSettled || 0),
          total_paid_out: roundMoney(settlementAgg?.totalPaidOut || 0),
          total_unpaid_outstanding: roundMoney(settlementAgg?.totalUnpaid || 0),
          settlements_count: settlementAgg?.settlementsCount || 0,
        },
        vendor_payouts: {
          tracked_vendors_count: payoutsByParty.length,
          excessive_payouts_count: excessivePayouts.length,
          excessive_payouts: excessivePayouts,
        },
        is_healthy:
          isBalanced &&
          journalUnbalance.length === 0 &&
          inconsistentInvoices.length === 0 &&
          excessivePayouts.length === 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute financial reconciliation.' });
  }
};

// ==========================================
// Sub-Contracted Vendor (Balance Party) Reconciliation
// ==========================================

export const getPartyBalances = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const companyObjectId = new mongoose.Types.ObjectId(String(companyId));

    const parties = await BalanceParty.find({ company_id: companyId, is_deleted: false }).lean();

    // 1. Aggregate all vehicle entries by balance_party_id
    const [movements, payouts] = await Promise.all([
      VehicleEntry.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        {
          $group: {
            _id: '$balance_party_id',
            totalMovements: { $sum: 1 },
            totalFreight: { $sum: '$freight_amount' },
            totalAdvances: { $sum: '$driver_cash_advance' },
            totalKamisan: { $sum: '$kamisan_amount' },
            totalHalting: { $sum: '$halting_amount' },
            totalOtherDeductions: { $sum: '$dala_charges' },
            netBalancePayable: { $sum: '$net_balance_due' },
          },
        },
      ]),
      // 2. Aggregate actual vendor payouts posted to Ledger
      Ledger.aggregate([
        {
          $match: {
            company_id: companyObjectId,
            category: 'payment_made',
            balance_type: 'debit',
            is_deleted: false,
            is_reversal: false,
            balance_party_id: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$balance_party_id',
            totalPayouts: { $sum: '$amount' },
            payoutCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const movementMap = new Map();
    movements.forEach((m) => {
      if (m._id) movementMap.set(m._id.toString(), m);
    });

    const payoutMap = new Map();
    payouts.forEach((p) => {
      if (p._id) payoutMap.set(p._id.toString(), roundMoney(p.totalPayouts || 0));
    });

    const partyStatements = parties.map((p) => {
      const stats = movementMap.get(p._id.toString()) || {
        totalMovements: 0,
        totalFreight: 0,
        totalAdvances: 0,
        totalKamisan: 0,
        totalHalting: 0,
        totalOtherDeductions: 0,
        netBalancePayable: 0,
      };

      const totalPaidOut = payoutMap.get(p._id.toString()) || 0;
      const grossDue = roundMoney(stats.netBalancePayable + (p.opening_balance || 0));
      const netOutstanding = Math.max(0, roundMoney(grossDue - totalPaidOut));

      return {
        _id: p._id,
        party_name: p.party_name,
        contact_person: p.contact_person,
        phone: p.phone,
        pan_number: p.pan_number,
        bank_details: p.bank_details,
        opening_balance: p.opening_balance || 0,
        ...stats,
        totalPaidOut,
        totalOutstanding: netOutstanding,
      };
    });

    res.json({ party_balances: partyStatements });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve party balances.' });
  }
};

export const getPartyStatement = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { partyId } = req.params;

    const [party, movements, payouts] = await Promise.all([
      BalanceParty.findOne({ _id: partyId, company_id: companyId, is_deleted: false }),
      VehicleEntry.find({ balance_party_id: partyId, company_id: companyId, is_deleted: false })
        .sort({ entry_date: -1 })
        .lean(),
      Ledger.find({
        balance_party_id: partyId,
        company_id: companyId,
        category: 'payment_made',
        balance_type: 'debit',
        is_deleted: false,
        is_reversal: false,
      })
        .sort({ transaction_date: -1 })
        .lean(),
    ]);

    if (!party) {
      return res.status(404).json({ error: 'Balance party not found.' });
    }

    const totalFreight = roundMoney(movements.reduce((s, m) => s + (m.freight_amount || 0), 0));
    const totalAdvances = roundMoney(movements.reduce((s, m) => s + (m.driver_cash_advance || 0), 0));
    const totalKamisan = roundMoney(movements.reduce((s, m) => s + (m.kamisan_amount || 0), 0));
    const totalHalting = roundMoney(movements.reduce((s, m) => s + (m.halting_amount || 0), 0));
    const totalNetBalance = roundMoney(movements.reduce((s, m) => s + (m.net_balance_due || 0), 0));
    const totalPayouts = roundMoney(payouts.reduce((s, p) => s + (p.amount || 0), 0));
    const grossDue = roundMoney(totalNetBalance + (party.opening_balance || 0));
    const netOutstanding = Math.max(0, roundMoney(grossDue - totalPayouts));

    res.json({
      party,
      movements,
      payouts,
      summary: {
        total_movements: movements.length,
        total_freight: totalFreight,
        total_advances: totalAdvances,
        total_kamisan: totalKamisan,
        total_halting: totalHalting,
        total_net_balance: totalNetBalance,
        total_payouts: totalPayouts,
        opening_balance: party.opening_balance || 0,
        net_outstanding: netOutstanding,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve vendor statement.' });
  }
};

export const recordPartyPayout = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { partyId } = req.params;
    const { amount, payment_mode = 'bank', reference_number, notes } = req.body;

    const payoutAmount = roundMoney(Number(amount));
    if (!payoutAmount || payoutAmount <= 0) {
      return res.status(400).json({ error: 'Valid payout amount is required.' });
    }

    const result = await runInTransaction(
      async (session) => {
        // 1. Tenant-isolated vendor lookup
        const party = await BalanceParty.findOne({
          _id: partyId,
          company_id: companyId,
          is_deleted: false,
        }).session(session);

        if (!party) {
          const err: any = new Error('Vendor not found.');
          err.statusCode = 404;
          throw err;
        }

        // 2. Compute current outstanding payable balance
        const partyObjectId = new mongoose.Types.ObjectId(String(partyId));
        const companyObjectId = new mongoose.Types.ObjectId(String(companyId));

        const [movementsAgg] = await VehicleEntry.aggregate([
          {
            $match: {
              company_id: companyObjectId,
              balance_party_id: partyObjectId,
              is_deleted: false,
            },
          },
          {
            $group: {
              _id: null,
              totalNetDue: { $sum: '$net_balance_due' },
            },
          },
        ]).session(session);

        const [payoutsAgg] = await Ledger.aggregate([
          {
            $match: {
              company_id: companyObjectId,
              balance_party_id: partyObjectId,
              category: 'payment_made',
              balance_type: 'debit',
              is_deleted: false,
              is_reversal: false,
            },
          },
          {
            $group: {
              _id: null,
              totalPayouts: { $sum: '$amount' },
            },
          },
        ]).session(session);

        const grossDue = roundMoney((movementsAgg?.totalNetDue || 0) + (party.opening_balance || 0));
        const priorPayouts = roundMoney(payoutsAgg?.totalPayouts || 0);
        const currentOutstanding = Math.max(0, roundMoney(grossDue - priorPayouts));

        // 3. Reject if payout exceeds outstanding payable balance
        if (payoutAmount > currentOutstanding) {
          const err: any = new Error(
            `Payout amount (₹${payoutAmount}) exceeds outstanding vendor payable balance (₹${currentOutstanding}).`
          );
          err.statusCode = 400;
          throw err;
        }

        // 4. Construct balanced double-entry legs
        const creditCategory: any = payment_mode === 'cash' ? 'cash_transfer' : 'bank_transfer';
        const ledgerMode: any =
          payment_mode === 'cash' ? 'cash' : payment_mode === 'upi' ? 'upi' : payment_mode === 'cheque' ? 'cheque' : 'bank';

        const legs = [
          {
            category: 'payment_made' as const,
            balance_type: 'debit' as const,
            amount: payoutAmount,
            payment_mode: ledgerMode,
            party_name: party.party_name,
            reference_number,
            description: `Vendor payout to ${party.party_name}: ${notes || 'Brokerage freight balance settlement'}`,
            balance_party_id: party._id,
          },
          {
            category: creditCategory,
            balance_type: 'credit' as const,
            amount: payoutAmount,
            payment_mode: ledgerMode,
            party_name: party.party_name,
            reference_number,
            description: `Bank/cash disbursement for vendor payout to ${party.party_name}`,
            balance_party_id: party._id,
          },
        ];

        // 5. Post double-entry journal atomically inside transaction
        const posted = await postDoubleEntryJournal({
          company_id: companyId!,
          session,
          transaction_type: 'vehicle_entry',
          description: `Vendor payout to ${party.party_name} (₹${payoutAmount})`,
          reference_number,
          party_name: party.party_name,
          legs,
          balance_party_id: party._id,
          created_by: req.user?._id,
          is_auto_generated: true,
        });

        // 6. Update cached current_balance
        party.current_balance = Math.max(0, roundMoney(currentOutstanding - payoutAmount));
        await party.save({ session });

        return {
          message: 'Vendor payout recorded and posted to General Ledger.',
          journal_id: posted.journal_id,
          entries: posted.entries,
          remaining_balance: party.current_balance,
        };
      },
      { statusCode: 201 }
    );

    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Failed to record vendor payout.' });
  }
};
