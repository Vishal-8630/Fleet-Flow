/**
 * ============================================================================
 * FLEET FLOW — COMMERCIAL PARTIES CONTROLLER (partyController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Handles commercial partner directories:
 * 1. Billing Parties: Shippers, consignors, and corporate freight clients.
 * 2. Balance Parties: Vehicle brokers, market truck suppliers, and petrol pumps.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - GSTIN Integrity: Validates 15-character GST numbers for tax compliance.
 * - Multi-Tenant Isolation: Every query and mutation is automatically partitioned
 *   by company workspace via `tenantPlugin`.
 * - Aggregated Receivables & Payables: Calculates outstanding customer receivables
 *   and vendor balances on the fly for financial visibility.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { BillingParty, IBillingParty } from '../models/BillingParty.js';
import { BalanceParty, IBalanceParty, BalancePartyType } from '../models/BalanceParty.js';

// ============================================================================
// PART A: BILLING PARTIES (CUSTOMERS / SHIPPERS / CONSIGNEES)
// ============================================================================

/**
 * 1. listBillingParties
 * ----------------------------------------------------------------------------
 * Retrieves a server-side paginated list of corporate billing parties.
 */
export async function listBillingParties(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const q = (req.query.q as string)?.trim();
    const status = req.query.status as string;

    const filter: any = { is_deleted: false };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { trade_name: { $regex: q, $options: 'i' } },
        { gstin: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const [parties, total, allParties] = await Promise.all([
      BillingParty.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      BillingParty.countDocuments(filter),
      BillingParty.find({ is_deleted: false }, 'status outstanding_receivables'),
    ]);

    let activeCount = 0;
    let totalOutstanding = 0;
    for (const p of allParties) {
      if (p.status === 'active') activeCount++;
      totalOutstanding += p.outstanding_receivables || 0;
    }

    res.json({
      parties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: allParties.length,
        active: activeCount,
        inactive: allParties.length - activeCount,
        total_outstanding: totalOutstanding,
      },
    });
  } catch (error: any) {
    console.error('Error fetching billing parties:', error);
    res.status(500).json({ error: 'Failed to retrieve billing parties.' });
  }
}

/**
 * 2. getBillingPartyById
 * ----------------------------------------------------------------------------
 * Retrieves details for a specific billing party.
 */
export async function getBillingPartyById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const party = await BillingParty.findOne({ _id: id, is_deleted: false });

    if (!party) {
      res.status(404).json({ error: 'Billing party not found.' });
      return;
    }

    res.json({ party });
  } catch (error: any) {
    console.error('Error fetching billing party:', error);
    res.status(500).json({ error: 'Failed to retrieve billing party details.' });
  }
}

/**
 * 3. createBillingParty
 * ----------------------------------------------------------------------------
 * Creates a new customer billing party with optional GST and address details.
 */
export async function createBillingParty(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      trade_name,
      gstin,
      pan_number,
      contact_person,
      email,
      phone,
      billing_address,
      payment_terms_days,
      credit_limit,
      status,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Party legal name is required.' });
      return;
    }

    const cleanGstin = gstin ? gstin.toUpperCase().trim() : undefined;
    const cleanPan = pan_number ? pan_number.toUpperCase().trim() : undefined;

    const party = await BillingParty.create({
      name: name.trim(),
      trade_name: trade_name?.trim(),
      gstin: cleanGstin,
      pan_number: cleanPan,
      contact_person: contact_person?.trim(),
      email: email?.toLowerCase().trim(),
      phone: phone?.trim(),
      billing_address: billing_address || {},
      payment_terms_days: Number(payment_terms_days) || 30,
      credit_limit: Number(credit_limit) || 0,
      status: status || 'active',
    });

    res.status(201).json({
      message: `Billing party ${party.name} created successfully.`,
      party,
    });
  } catch (error: any) {
    console.error('Error creating billing party:', error);
    res.status(500).json({ error: error.message || 'Failed to create billing party.' });
  }
}

/**
 * 4. updateBillingParty
 * ----------------------------------------------------------------------------
 * Updates customer details, credit limits, and billing coordinates.
 */
export async function updateBillingParty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name,
      trade_name,
      gstin,
      pan_number,
      contact_person,
      email,
      phone,
      billing_address,
      payment_terms_days,
      credit_limit,
      status,
    } = req.body;

    const party = await BillingParty.findOne({ _id: id, is_deleted: false });
    if (!party) {
      res.status(404).json({ error: 'Billing party not found.' });
      return;
    }

    if (name) party.name = name.trim();
    if (trade_name !== undefined) party.trade_name = trade_name?.trim();
    if (gstin !== undefined) party.gstin = gstin ? gstin.toUpperCase().trim() : undefined;
    if (pan_number !== undefined) party.pan_number = pan_number ? pan_number.toUpperCase().trim() : undefined;
    if (contact_person !== undefined) party.contact_person = contact_person?.trim();
    if (email !== undefined) party.email = email?.toLowerCase().trim();
    if (phone !== undefined) party.phone = phone?.trim();
    if (billing_address) party.billing_address = billing_address;
    if (payment_terms_days !== undefined) party.payment_terms_days = Number(payment_terms_days);
    if (credit_limit !== undefined) party.credit_limit = Number(credit_limit);
    if (status) party.status = status;

    await party.save();

    res.json({
      message: `Billing party ${party.name} updated successfully.`,
      party,
    });
  } catch (error: any) {
    console.error('Error updating billing party:', error);
    res.status(500).json({ error: error.message || 'Failed to update billing party.' });
  }
}

/**
 * 5. deleteBillingParty
 * ----------------------------------------------------------------------------
 * Soft-deletes a customer billing party record.
 */
export async function deleteBillingParty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const party = await BillingParty.findOne({ _id: id, is_deleted: false });
    if (!party) {
      res.status(404).json({ error: 'Billing party not found.' });
      return;
    }

    party.is_deleted = true;
    party.status = 'inactive';
    await party.save();

    res.json({ message: `Billing party ${party.name} removed.` });
  } catch (error: any) {
    console.error('Error deleting billing party:', error);
    res.status(500).json({ error: 'Failed to delete billing party.' });
  }
}

// ============================================================================
// PART B: BALANCE PARTIES (VENDORS / BROKERS / SUPPLIERS / PUMPS)
// ============================================================================

/**
 * 6. listBalanceParties
 * ----------------------------------------------------------------------------
 * Retrieves a paginated list of external vendor and balance parties.
 */
export async function listBalanceParties(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const q = (req.query.q as string)?.trim();
    const partyType = req.query.party_type as BalancePartyType;
    const status = req.query.status as string;

    const filter: any = { is_deleted: false };

    if (q) {
      filter.$or = [
        { party_name: { $regex: q, $options: 'i' } },
        { contact_person: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    if (partyType && ['supplier', 'broker', 'transporter', 'petrol_pump', 'other'].includes(partyType)) {
      filter.party_type = partyType;
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const [parties, total, allParties] = await Promise.all([
      BalanceParty.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      BalanceParty.countDocuments(filter),
      BalanceParty.find({ is_deleted: false }, 'status party_type current_balance'),
    ]);

    let totalBalance = 0;
    let suppliersCount = 0;
    let brokersCount = 0;
    let transportersCount = 0;

    for (const p of allParties) {
      totalBalance += p.current_balance || 0;
      if (p.party_type === 'supplier') suppliersCount++;
      else if (p.party_type === 'broker') brokersCount++;
      else if (p.party_type === 'transporter') transportersCount++;
    }

    res.json({
      parties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: allParties.length,
        total_balance: totalBalance,
        suppliers: suppliersCount,
        brokers: brokersCount,
        transporters: transportersCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching balance parties:', error);
    res.status(500).json({ error: 'Failed to retrieve balance parties.' });
  }
}

/**
 * 7. getBalancePartyById
 * ----------------------------------------------------------------------------
 * Retrieves details for a specific vendor or broker balance party.
 */
export async function getBalancePartyById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const party = await BalanceParty.findOne({ _id: id, is_deleted: false });

    if (!party) {
      res.status(404).json({ error: 'Balance party not found.' });
      return;
    }

    res.json({ party });
  } catch (error: any) {
    console.error('Error fetching balance party:', error);
    res.status(500).json({ error: 'Failed to retrieve balance party details.' });
  }
}

/**
 * 8. createBalanceParty
 * ----------------------------------------------------------------------------
 * Adds a new supplier, fleet broker, or transport provider.
 */
export async function createBalanceParty(req: Request, res: Response): Promise<void> {
  try {
    const {
      party_name,
      party_type,
      contact_person,
      phone,
      email,
      pan_number,
      bank_details,
      opening_balance,
      status,
    } = req.body;

    if (!party_name || !phone) {
      res.status(400).json({ error: 'Party name and contact phone number are required.' });
      return;
    }

    const party = await BalanceParty.create({
      party_name: party_name.trim(),
      party_type: party_type || 'supplier',
      contact_person: contact_person?.trim(),
      phone: phone.trim(),
      email: email?.toLowerCase().trim(),
      pan_number: pan_number ? pan_number.toUpperCase().trim() : undefined,
      bank_details: bank_details || {},
      opening_balance: Number(opening_balance) || 0,
      current_balance: Number(opening_balance) || 0,
      status: status || 'active',
    });

    res.status(201).json({
      message: `Balance party ${party.party_name} created successfully.`,
      party,
    });
  } catch (error: any) {
    console.error('Error creating balance party:', error);
    res.status(500).json({ error: error.message || 'Failed to create balance party.' });
  }
}

/**
 * 9. updateBalanceParty
 * ----------------------------------------------------------------------------
 * Updates vendor profile, bank details, and ledger balances.
 */
export async function updateBalanceParty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      party_name,
      party_type,
      contact_person,
      phone,
      email,
      pan_number,
      bank_details,
      status,
    } = req.body;

    const party = await BalanceParty.findOne({ _id: id, is_deleted: false });
    if (!party) {
      res.status(404).json({ error: 'Balance party not found.' });
      return;
    }

    if (party_name) party.party_name = party_name.trim();
    if (party_type) party.party_type = party_type;
    if (contact_person !== undefined) party.contact_person = contact_person?.trim();
    if (phone) party.phone = phone.trim();
    if (email !== undefined) party.email = email?.toLowerCase().trim();
    if (pan_number !== undefined) party.pan_number = pan_number ? pan_number.toUpperCase().trim() : undefined;
    if (bank_details) party.bank_details = bank_details;
    if (status) party.status = status;

    await party.save();

    res.json({
      message: `Balance party ${party.party_name} updated successfully.`,
      party,
    });
  } catch (error: any) {
    console.error('Error updating balance party:', error);
    res.status(500).json({ error: error.message || 'Failed to update balance party.' });
  }
}

/**
 * 10. deleteBalanceParty
 * ----------------------------------------------------------------------------
 * Soft-deletes a balance party record.
 */
export async function deleteBalanceParty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const party = await BalanceParty.findOne({ _id: id, is_deleted: false });
    if (!party) {
      res.status(404).json({ error: 'Balance party not found.' });
      return;
    }

    party.is_deleted = true;
    party.status = 'inactive';
    await party.save();

    res.json({ message: `Balance party ${party.party_name} removed.` });
  } catch (error: any) {
    console.error('Error deleting balance party:', error);
    res.status(500).json({ error: 'Failed to delete balance party.' });
  }
}
