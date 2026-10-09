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
import { Ledger } from '../models/Ledger.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { VehicleEntry } from '../models/VehicleEntry.js';

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
        { description: searchRegex },
        { party_name: searchRegex },
        { reference_number: searchRegex },
      ];
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

    const [aggregates, categoryBreakdown] = await Promise.all([
      Ledger.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
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
        { $match: { company_id: companyId, is_deleted: false } },
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
    } = req.body;

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
    res.status(400).json({ error: err.message || 'Failed to create ledger entry.' });
  }
};

export const reverseLedgerEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { reversal_reason } = req.body;

    const originalEntry = await Ledger.findOne({
      _id: req.params.id,
      company_id: companyId,
      is_deleted: false,
    });

    if (!originalEntry) {
      return res.status(404).json({ error: 'Ledger entry not found.' });
    }

    if (originalEntry.is_reversal) {
      return res.status(400).json({ error: 'This ledger entry has already been reversed.' });
    }

    // Flag original entry as reversed
    originalEntry.is_reversal = true;
    originalEntry.reversal_reason = reversal_reason || 'Reversed by user';
    await originalEntry.save();

    // Create the counter-balancing reversal entry
    const count = await Ledger.countDocuments({ company_id: companyId });
    const transaction_number = `REV-${String(count + 1).padStart(4, '0')}`;

    const reversalEntry = new Ledger({
      company_id: companyId,
      transaction_number,
      transaction_date: new Date(),
      category: originalEntry.category,
      transaction_type: originalEntry.transaction_type,
      balance_type: originalEntry.balance_type === 'debit' ? 'credit' : 'debit', // Invert balance
      amount: originalEntry.amount,
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
      created_by: req.user?._id,
    });

    await reversalEntry.save();

    res.json({
      message: 'Journal entry reversed with counter-balancing audit posting.',
      reversal_entry: reversalEntry,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reverse entry.' });
  }
};

// ==========================================
// Sub-Contracted Vendor (Balance Party) Reconciliation
// ==========================================

export const getPartyBalances = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;

    const parties = await BalanceParty.find({ company_id: companyId, is_deleted: false }).lean();

    // Aggregate all vehicle entries by balance_party_id
    const movements = await VehicleEntry.aggregate([
      { $match: { company_id: companyId, is_deleted: false } },
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
    ]);

    const movementMap = new Map();
    movements.forEach((m) => {
      if (m._id) movementMap.set(m._id.toString(), m);
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

      return {
        _id: p._id,
        party_name: p.party_name,
        contact_person: p.contact_person,
        phone: p.phone,
        pan_number: p.pan_number,
        bank_details: p.bank_details,
        opening_balance: p.opening_balance || 0,
        ...stats,
        totalOutstanding: stats.netBalancePayable + (p.opening_balance || 0),
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

    const [party, movements] = await Promise.all([
      BalanceParty.findOne({ _id: partyId, company_id: companyId, is_deleted: false }),
      VehicleEntry.find({ balance_party_id: partyId, company_id: companyId, is_deleted: false })
        .sort({ entry_date: -1 })
        .lean(),
    ]);

    if (!party) {
      return res.status(404).json({ error: 'Balance party not found.' });
    }

    const totalFreight = movements.reduce((s, m) => s + (m.freight_amount || 0), 0);
    const totalAdvances = movements.reduce((s, m) => s + (m.driver_cash_advance || 0), 0);
    const totalKamisan = movements.reduce((s, m) => s + (m.kamisan_amount || 0), 0);
    const totalHalting = movements.reduce((s, m) => s + (m.halting_amount || 0), 0);
    const totalNetBalance = movements.reduce((s, m) => s + (m.net_balance_due || 0), 0);

    res.json({
      party,
      movements,
      summary: {
        total_movements: movements.length,
        total_freight: totalFreight,
        total_advances: totalAdvances,
        total_kamisan: totalKamisan,
        total_halting: totalHalting,
        total_net_balance: totalNetBalance,
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

    const party = await BalanceParty.findOne({ _id: partyId, company_id: companyId, is_deleted: false });
    if (!party) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const payoutAmount = Number(amount);
    if (!payoutAmount || payoutAmount <= 0) {
      return res.status(400).json({ error: 'Valid payout amount is required.' });
    }

    // Post to General Ledger as a Debit
    const count = await Ledger.countDocuments({ company_id: companyId });
    const transaction_number = `TXN-${String(count + 1).padStart(4, '0')}`;

    const ledgerEntry = new Ledger({
      company_id: companyId,
      transaction_number,
      transaction_date: new Date(),
      category: 'payment_made',
      transaction_type: 'vehicle_entry',
      balance_type: 'debit',
      amount: payoutAmount,
      payment_mode,
      reference_number,
      party_name: party.party_name,
      description: `Vendor payout to ${party.party_name}: ${notes || 'Brokerage freight balance settlement'}`,
      is_auto_generated: true,
      balance_party_id: party._id,
      created_by: req.user?._id,
    });

    await ledgerEntry.save();

    res.json({
      message: 'Vendor payout recorded and posted to General Ledger.',
      ledger_entry: ledgerEntry,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record vendor payout.' });
  }
};
