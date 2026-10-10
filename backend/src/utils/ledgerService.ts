/**
 * ============================================================================
 * FLEET FLOW — DOUBLE-ENTRY BALANCED LEDGER SERVICE (ledgerService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * The core accounting engine for posting balanced double-entry general ledger
 * vouchers. Enforces the universal accounting invariant:
 * 
 *                  Σ Debits === Σ Credits per Journal ID
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * Posting one-sided transaction rows leaves transport accounting vulnerable to
 * unbalance, untracked cash leakage, and audit failures. By requiring all automated
 * financial operations (settlements, freight collections, reversals) to post
 * paired journal entries sharing an immutable `journal_id`, we guarantee
 * 100% mathematically sound books.
 * ============================================================================
 */

import mongoose, { ClientSession, Types } from 'mongoose';
import { Ledger, ILedger, LedgerCategory, LedgerBalanceType, LedgerTransactionType, LedgerPaymentMode } from '../models/Ledger.js';
import { Company } from '../models/Company.js';
import { roundMoney } from './settlementCalculator.js';

export interface IJournalLeg {
  category: LedgerCategory;
  balance_type: LedgerBalanceType;
  amount: number;
  payment_mode?: LedgerPaymentMode;
  party_name?: string;
  reference_number?: string;
  description?: string;
  truck_id?: Types.ObjectId | string;
  driver_id?: Types.ObjectId | string;
  billing_party_id?: Types.ObjectId | string;
  balance_party_id?: Types.ObjectId | string;
  settlement_id?: Types.ObjectId | string;
  invoice_id?: Types.ObjectId | string;
  journey_id?: Types.ObjectId | string;
  vehicle_entry_id?: Types.ObjectId | string;
}

export interface IPostJournalParams {
  company_id: Types.ObjectId | string;
  session: ClientSession;
  transaction_date?: Date;
  transaction_type: LedgerTransactionType;
  description: string;
  reference_number?: string;
  party_name?: string;
  legs: IJournalLeg[];
  is_auto_generated?: boolean;
  created_by?: Types.ObjectId | string;
  truck_id?: Types.ObjectId | string;
  driver_id?: Types.ObjectId | string;
  billing_party_id?: Types.ObjectId | string;
  balance_party_id?: Types.ObjectId | string;
  settlement_id?: Types.ObjectId | string;
  invoice_id?: Types.ObjectId | string;
  journey_id?: Types.ObjectId | string;
  vehicle_entry_id?: Types.ObjectId | string;
}

/**
 * Creates and posts a balanced multi-leg journal entry into the General Ledger.
 * Throws an Error if Debits != Credits.
 */
export async function postDoubleEntryJournal(params: IPostJournalParams): Promise<{ journal_id: string; entries: ILedger[] }> {
  const {
    company_id,
    session,
    transaction_date = new Date(),
    transaction_type,
    description,
    reference_number,
    party_name,
    legs,
    is_auto_generated = true,
    created_by,
  } = params;

  if (!legs || legs.length < 2) {
    throw new Error('A double-entry journal requires at least two paired transaction legs (debit and credit).');
  }

  // Calculate and verify balanced debits and credits
  let totalDebits = 0;
  let totalCredits = 0;

  for (const leg of legs) {
    const amt = roundMoney(Number(leg.amount) || 0);
    if (amt <= 0) {
      throw new Error(`Invalid journal leg amount: ${leg.amount}. Must be greater than 0.`);
    }
    if (leg.balance_type === 'debit') {
      totalDebits = roundMoney(totalDebits + amt);
    } else if (leg.balance_type === 'credit') {
      totalCredits = roundMoney(totalCredits + amt);
    } else {
      throw new Error(`Invalid balance_type '${leg.balance_type}'. Must be 'debit' or 'credit'.`);
    }
  }

  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    throw new Error(
      `Double-entry balancing invariant violated: Total Debits (₹${totalDebits}) does not equal Total Credits (₹${totalCredits}). Variance: ₹${roundMoney(totalDebits - totalCredits)}.`
    );
  }

  // Concurrency-safe atomic journal and transaction sequencing
  const companyUpdate = await Company.findByIdAndUpdate(
    company_id,
    {
      $inc: {
        'counters.journal_seq': 1,
        'counters.transaction_seq': legs.length,
      },
    },
    { new: true, session }
  );

  const journalSeq = companyUpdate?.counters?.journal_seq || (await Ledger.countDocuments({ company_id }).session(session)) + 1;
  const journal_id = `JRNL-${String(journalSeq).padStart(4, '0')}`;

  const currentTxnSeq = (companyUpdate?.counters?.transaction_seq || (await Ledger.countDocuments({ company_id }).session(session)) + legs.length) - legs.length;

  const entriesToInsert: any[] = legs.map((leg, idx) => {
    const txnNumber = `TXN-${String(currentTxnSeq + idx + 1).padStart(4, '0')}`;
    return {
      company_id,
      transaction_number: txnNumber,
      journal_id,
      transaction_date,
      category: leg.category,
      transaction_type,
      balance_type: leg.balance_type,
      amount: roundMoney(leg.amount),
      payment_mode: leg.payment_mode || 'bank',
      reference_number: leg.reference_number || reference_number,
      party_name: leg.party_name || party_name,
      description: leg.description || description,
      is_auto_generated,
      is_reversal: false,
      truck_id: leg.truck_id || params.truck_id,
      driver_id: leg.driver_id || params.driver_id,
      billing_party_id: leg.billing_party_id || params.billing_party_id,
      balance_party_id: leg.balance_party_id || params.balance_party_id,
      settlement_id: leg.settlement_id || params.settlement_id,
      invoice_id: leg.invoice_id || params.invoice_id,
      journey_id: leg.journey_id || params.journey_id,
      vehicle_entry_id: leg.vehicle_entry_id || params.vehicle_entry_id,
      created_by,
    };
  });

  const createdEntries = await Ledger.insertMany(entriesToInsert, { session });
  return { journal_id, entries: createdEntries as unknown as ILedger[] };
}

/**
 * Posts paired double-entry journal for a driver settlement disbursement.
 * Leg 1 (Debit): 'driver_settlement'
 * Leg 2 (Credit): 'bank_transfer' or 'cash_transfer'
 */
export async function postSettlementDisbursementJournal(params: {
  company_id: Types.ObjectId | string;
  session: ClientSession;
  settlement_id: Types.ObjectId | string;
  settlement_number: string;
  driver_id: Types.ObjectId | string;
  driver_name: string;
  net_amount: number;
  payment_mode?: 'cash' | 'bank_transfer' | 'upi' | 'cheque';
  payment_ref?: string;
  created_by?: any;
}): Promise<{ journal_id: string; entries: ILedger[] }> {
  const {
    company_id,
    session,
    settlement_id,
    settlement_number,
    driver_id,
    driver_name,
    net_amount,
    payment_mode = 'bank_transfer',
    payment_ref,
    created_by,
  } = params;

  const validAmount = roundMoney(Math.abs(net_amount));
  if (validAmount === 0) {
    throw new Error('Settlement disbursement amount is zero. No ledger entries required.');
  }

  const creditPaymentCategory: LedgerCategory =
    payment_mode === 'cash' ? 'cash_transfer' : 'bank_transfer';
  const ledgerMode: LedgerPaymentMode =
    payment_mode === 'cash' ? 'cash' : payment_mode === 'upi' ? 'upi' : payment_mode === 'cheque' ? 'cheque' : 'bank';

  // If net_amount > 0: Company pays driver
  // Debit: driver_settlement, Credit: bank_transfer
  // If net_amount < 0: Driver returns advance/funds to company
  // Debit: bank_transfer/cash_transfer, Credit: driver_settlement
  const legs: IJournalLeg[] =
    net_amount > 0
      ? [
          {
            category: 'driver_settlement',
            balance_type: 'debit',
            amount: validAmount,
            payment_mode: ledgerMode,
            party_name: driver_name,
            reference_number: settlement_number,
            description: `Trip settlement disbursement ${settlement_number} to driver ${driver_name}`,
            driver_id,
            settlement_id,
          },
          {
            category: creditPaymentCategory,
            balance_type: 'credit',
            amount: validAmount,
            payment_mode: ledgerMode,
            party_name: driver_name,
            reference_number: payment_ref || settlement_number,
            description: `Operating payout for settlement ${settlement_number} (${payment_ref || ledgerMode})`,
            driver_id,
            settlement_id,
          },
        ]
      : [
          {
            category: creditPaymentCategory,
            balance_type: 'debit',
            amount: validAmount,
            payment_mode: ledgerMode,
            party_name: driver_name,
            reference_number: payment_ref || settlement_number,
            description: `Driver advance recovery receipt for settlement ${settlement_number}`,
            driver_id,
            settlement_id,
          },
          {
            category: 'driver_settlement',
            balance_type: 'credit',
            amount: validAmount,
            payment_mode: ledgerMode,
            party_name: driver_name,
            reference_number: settlement_number,
            description: `Recovery credit for excess advance in settlement ${settlement_number}`,
            driver_id,
            settlement_id,
          },
        ];

  return postDoubleEntryJournal({
    company_id,
    session,
    transaction_type: 'settlement',
    description: `Settlement ${settlement_number} for driver ${driver_name} (₹${validAmount})`,
    reference_number: settlement_number,
    party_name: driver_name,
    legs,
    settlement_id,
    driver_id,
    created_by,
    is_auto_generated: true,
  });
}

/**
 * Posts paired double-entry journal for a freight tax invoice payment collection.
 * Supports TDS deductions:
 * Leg 1 (Debit): bank/cash for net collected
 * Leg 2 (Debit, optional): other_adjustment/tax for TDS amount
 * Leg 3 (Credit): payment_received for total settled (payment + TDS)
 */
export async function postInvoicePaymentJournal(params: {
  company_id: Types.ObjectId | string;
  session: ClientSession;
  invoice_id: Types.ObjectId | string;
  invoice_number: string;
  billing_party_id?: Types.ObjectId | string;
  party_name: string;
  payment_amount: number;
  tds_amount?: number;
  payment_mode?: string;
  reference_number?: string;
  created_by?: any;
}): Promise<{ journal_id: string; entries: ILedger[] }> {
  const {
    company_id,
    session,
    invoice_id,
    invoice_number,
    billing_party_id,
    party_name,
    payment_amount,
    tds_amount = 0,
    payment_mode = 'bank_transfer',
    reference_number,
    created_by,
  } = params;

  const validPayment = roundMoney(Number(payment_amount) || 0);
  const validTds = roundMoney(Number(tds_amount) || 0);
  const totalSettled = roundMoney(validPayment + validTds);

  if (validPayment <= 0) {
    throw new Error('Payment collection amount must be greater than zero.');
  }

  const debitCategory: LedgerCategory =
    payment_mode === 'cash' ? 'cash_transfer' : 'bank_transfer';
  const ledgerMode: LedgerPaymentMode =
    payment_mode === 'cash' ? 'cash' : payment_mode === 'upi' ? 'upi' : payment_mode === 'cheque' ? 'cheque' : 'bank';

  const legs: IJournalLeg[] = [
    {
      category: debitCategory,
      balance_type: 'debit',
      amount: validPayment,
      payment_mode: ledgerMode,
      party_name,
      reference_number: reference_number || invoice_number,
      description: `Collection against Invoice ${invoice_number} via ${payment_mode}`,
      invoice_id,
      billing_party_id,
    },
  ];

  if (validTds > 0) {
    legs.push({
      category: 'rto_border_tax', // Statutory tax withheld / TDS
      balance_type: 'debit',
      amount: validTds,
      payment_mode: 'system',
      party_name,
      reference_number: reference_number || invoice_number,
      description: `TDS deducted at source on Invoice ${invoice_number}`,
      invoice_id,
      billing_party_id,
    });
  }

  legs.push({
    category: 'payment_received',
    balance_type: 'credit',
    amount: totalSettled,
    payment_mode: ledgerMode,
    party_name,
    reference_number: reference_number || invoice_number,
    description: `Freight revenue settled for Invoice ${invoice_number}${validTds > 0 ? ` (Net ₹${validPayment} + TDS ₹${validTds})` : ''}`,
    invoice_id,
    billing_party_id,
  });

  return postDoubleEntryJournal({
    company_id,
    session,
    transaction_type: 'invoice_payment',
    description: `Payment collection for Invoice ${invoice_number} from ${party_name} (₹${totalSettled})`,
    reference_number: reference_number || invoice_number,
    party_name,
    legs,
    invoice_id,
    billing_party_id,
    created_by,
    is_auto_generated: true,
  });
}
