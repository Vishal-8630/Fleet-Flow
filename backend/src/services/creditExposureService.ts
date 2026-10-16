/**
 * ============================================================================
 * FLEET FLOW — CUSTOMER CREDIT EXPOSURE & DEC-007 ENFORCEMENT SERVICE
 * (creditExposureService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Real-time commercial credit exposure tracking and DEC-007 Option B credit limit
 * enforcement for shipper billing parties.
 * 
 * MATHEMATICAL EXPOSURE INVARIANT:
 * --------------------------------
 * Total Customer Exposure = Σ(Open Invoices Balance Amount)
 *                         + Σ(Dispatched Unbilled Freight from Active LRs / Journeys)
 *                         - Σ(Unallocated Receipts / Credits)
 * 
 * PROJECTED EXPOSURE & BREACH CHECK:
 * ----------------------------------
 * Projected Exposure = Total Customer Exposure + New Planned Freight
 * Breach condition:
 * - If enforce_credit_limit === false (unconfigured limit): Unrestricted (never breaches).
 * - If enforce_credit_limit === true && credit_limit === 0: Zero credit allowed (breaches if projected > 0).
 * - If enforce_credit_limit === true && credit_limit > 0: Breaches if projected > credit_limit.
 * ============================================================================
 */

import { ClientSession, Types } from 'mongoose';
import { BillingParty, IBillingParty } from '../models/BillingParty.js';
import { Invoice } from '../models/Invoice.js';
import { Entry } from '../models/Entry.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { roundMoney } from '../utils/settlementCalculator.js';

export interface IExposureMathParams {
  open_invoices_balance: number;
  dispatched_unbilled_freight: number;
  unallocated_credits?: number;
  credit_limit: number;
  enforce_credit_limit: boolean;
  planned_freight?: number;
}

export interface IExposureMathResult {
  current_exposure: number;
  planned_freight: number;
  projected_exposure: number;
  overage_amount: number;
  is_breached: boolean;
  is_unrestricted: boolean;
}

export interface ICustomerCreditExposureResult extends IExposureMathResult {
  customer_id: string;
  customer_name: string;
  credit_limit: number;
  enforce_credit_limit: boolean;
  open_invoices_balance: number;
  dispatched_unbilled_freight: number;
  unallocated_credits: number;
}

/**
 * Pure calculation helper for exposure math and limit evaluation.
 * Deterministic and free of side-effects for unit testing.
 */
export function computeExposureMath(params: IExposureMathParams): IExposureMathResult {
  const openInvoices = roundMoney(Math.max(0, Number(params.open_invoices_balance) || 0));
  const unbilledFreight = roundMoney(Math.max(0, Number(params.dispatched_unbilled_freight) || 0));
  const unallocatedCredits = roundMoney(Math.max(0, Number(params.unallocated_credits) || 0));
  const creditLimit = roundMoney(Math.max(0, Number(params.credit_limit) || 0));
  const plannedFreight = roundMoney(Math.max(0, Number(params.planned_freight) || 0));
  const enforceLimit = Boolean(params.enforce_credit_limit);

  const current_exposure = roundMoney(openInvoices + unbilledFreight - unallocatedCredits);
  const projected_exposure = roundMoney(current_exposure + plannedFreight);

  // Unconfigured limit policy: If not enforced, credit is unrestricted
  if (!enforceLimit) {
    return {
      current_exposure,
      planned_freight: plannedFreight,
      projected_exposure,
      overage_amount: 0,
      is_breached: false,
      is_unrestricted: true,
    };
  }

  // Enforced limit:
  // If credit_limit is 0, any positive projected exposure is a breach (strictly zero credit permitted)
  const is_breached = projected_exposure > creditLimit;
  const overage_amount = is_breached ? roundMoney(projected_exposure - creditLimit) : 0;

  return {
    current_exposure,
    planned_freight: plannedFreight,
    projected_exposure,
    overage_amount,
    is_breached,
    is_unrestricted: false,
  };
}

export async function evaluateCustomerCreditExposure(params: {
  company_id: Types.ObjectId | string;
  billing_party_id?: Types.ObjectId | string;
  customer_id?: Types.ObjectId | string;
  planned_freight?: number;
  new_order_amount?: number;
  session?: ClientSession;
}): Promise<any> {
  const company_id = params.company_id;
  const billing_party_id = params.billing_party_id || params.customer_id;
  const planned_freight = params.planned_freight ?? params.new_order_amount ?? 0;
  const session = params.session;

  if (!billing_party_id) {
    throw new Error('Billing party ID is required to evaluate credit exposure.');
  }

  const partyQuery = BillingParty.findOne({
    _id: billing_party_id,
    company_id,
    is_deleted: false,
  });
  if (session) partyQuery.session(session);
  const party = await partyQuery;

  if (!party) {
    throw new Error('Billing party not found in tenant workspace.');
  }

  if (session && (party.enforce_credit_limit ?? ((party.credit_limit || 0) > 0))) {
    // Acquire exclusive document lock on BillingParty to serialize concurrent credit evaluations within transaction
    await BillingParty.updateOne(
      { _id: party._id, company_id },
      { $inc: { __v: 0 } },
      { session }
    );
  }

  // 1. Open Unpaid Invoices
  const invoiceQuery = Invoice.find({
    company_id,
    billing_party_id,
    is_deleted: false,
    status: { $in: ['issued', 'partially_paid', 'draft'] },
  });
  if (session) invoiceQuery.session(session);
  const openInvoices = await invoiceQuery;

  const invoices_balance_sum = roundMoney(
    openInvoices.reduce((sum, inv) => sum + (Number(inv.balance_amount) || 0), 0)
  );
  // Include party's recorded receivables if no active invoices or if higher (opening/migrated receivables)
  const open_invoices_balance = Math.max(
    roundMoney(Number(party.outstanding_receivables) || 0),
    invoices_balance_sum
  );

  // 2. Active Dispatched Unbilled LRs (Entry)
  const entryQuery = Entry.find({
    company_id,
    billing_party_id,
    is_deleted: false,
    status: 'active',
  });
  if (session) entryQuery.session(session);
  const activeEntries = await entryQuery;

  const unbilled_lrs_freight = roundMoney(
    activeEntries.reduce((sum, entry) => sum + (Number(entry.freight_amount) || 0), 0)
  );

  // 3. Active Dispatched Journeys without LRs (to prevent omission and double-counting)
  const activeEntryJourneyIds = new Set(
    activeEntries.map((e) => e.journey_id?.toString()).filter(Boolean)
  );

  const journeyQuery = TruckJourney.find({
    company_id,
    billing_party_id,
    is_deleted: false,
    status: { $in: ['active', 'delayed', 'completed'] },
    is_settled: false,
  });
  if (session) journeyQuery.session(session);
  const activeJourneys = await journeyQuery;

  const unbilled_journeys_freight = roundMoney(
    activeJourneys
      .filter((j) => !activeEntryJourneyIds.has(j._id.toString()))
      .reduce((sum, j) => sum + (Number(j.freight_rate) || 0), 0)
  );

  const dispatched_unbilled_freight = roundMoney(unbilled_lrs_freight + unbilled_journeys_freight);

  // 4. Unallocated Credits (if any)
  const unallocated_credits = 0;

  const mathResult = computeExposureMath({
    open_invoices_balance,
    dispatched_unbilled_freight,
    unallocated_credits,
    credit_limit: party.credit_limit || 0,
    enforce_credit_limit: party.enforce_credit_limit ?? ((party.credit_limit || 0) > 0),
    planned_freight,
  });

  const exposure = {
    customer_id: party._id.toString(),
    customer_name: party.name,
    credit_limit: party.credit_limit || 0,
    enforce_credit_limit: party.enforce_credit_limit ?? ((party.credit_limit || 0) > 0),
    current_exposure: mathResult.current_exposure,
    order_amount: mathResult.planned_freight,
    planned_freight: mathResult.planned_freight,
    projected_exposure: mathResult.projected_exposure,
    excess_amount: mathResult.overage_amount,
    overage_amount: mathResult.overage_amount,
    open_invoices_balance,
    dispatched_unbilled_freight,
    unallocated_credits,
    is_breached: mathResult.is_breached,
    is_unrestricted: mathResult.is_unrestricted,
  };

  const message = mathResult.is_breached
    ? `Credit limit exceeded for customer ${party.name}. Current exposure ₹${mathResult.current_exposure} + new order ₹${mathResult.planned_freight} = ₹${mathResult.projected_exposure} exceeds limit ₹${party.credit_limit || 0}.`
    : 'Credit limit within permitted bounds.';

  return {
    ...exposure,
    exposure,
    message,
  };
}
