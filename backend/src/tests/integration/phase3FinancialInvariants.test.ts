/**
 * ============================================================================
 * PHASE 3 FINANCIAL INVARIANTS & ACCOUNTING SAFEGUARDS INTEGRATION TESTS
 * (ISS-003, ISS-004, IMP-001, ISS-008, ISS-010)
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { __setTopologyOverrideForTesting } from '../../utils/transactionHelper.js';
import {
  validateGSTIN,
  validatePAN,
  calculateGSTINChecksum,
} from '../../utils/gstinValidator.js';
import { BillingParty } from '../../models/BillingParty.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { Invoice } from '../../models/Invoice.js';
import { CreditNote } from '../../models/CreditNote.js';
import { Ledger } from '../../models/Ledger.js';
import { VehicleEntry } from '../../models/VehicleEntry.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';

describe('Phase 3: Financial Invariants & Accounting Safeguards', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  beforeEach(async () => {
    __setTopologyOverrideForTesting(null);
    await seedBillingCatalog();
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });
  });

  afterEach(() => {
    __setTopologyOverrideForTesting(null);
  });

  // ============================================================================
  // 1. STATUTORY GSTIN & PAN VALIDATION (IMP-001)
  // ============================================================================
  describe('1. Statutory GSTIN & PAN Validation (IMP-001)', () => {
    it('accurately verifies authoritative GSTIN Luhn mod-36 test vectors', () => {
      // Test Vector 1: Maharashtra
      expect(calculateGSTINChecksum('27AAPFU0939F1Z')).toBe('V');
      expect(validateGSTIN('27AAPFU0939F1ZV').isValid).toBe(true);

      // Test Vector 2: Maharashtra
      expect(calculateGSTINChecksum('27AASCS2460H1Z')).toBe('0');
      expect(validateGSTIN('27AASCS2460H1Z0').isValid).toBe(true);

      // Test Vector 3: Tamil Nadu
      expect(calculateGSTINChecksum('33AAACC1206D1Z')).toBe('N');
      expect(validateGSTIN('33AAACC1206D1ZN').isValid).toBe(true);

      // Test Vector 4: Delhi (Independently Verified: Sum=159, Rem=15, Code=21 -> 'L')
      expect(calculateGSTINChecksum('07AABCA1234A1Z')).toBe('L');
      expect(validateGSTIN('07AABCA1234A1ZL').isValid).toBe(true);
      expect(validateGSTIN('07AABCA1234A1ZL').stateName).toBe('Delhi');

      // Test Vector 5: Karnataka (Independently Verified: Sum=190, Rem=10, Code=26 -> 'Q')
      expect(calculateGSTINChecksum('29AABCS1429B1Z')).toBe('Q');
      expect(validateGSTIN('29AABCS1429B1ZQ').isValid).toBe(true);
      expect(validateGSTIN('29AABCS1429B1ZQ').stateName).toBe('Karnataka');
    });

    it('rejects GSTIN with invalid checksum, invalid state code, or invalid structure', () => {
      // Checksum typo ('X' instead of 'V')
      const invalidChecksum = validateGSTIN('27AAPFU0939F1ZX');
      expect(invalidChecksum.isValid).toBe(false);
      expect(invalidChecksum.error).toContain('Invalid GSTIN checksum');

      // Invalid state code ('99')
      const invalidState = validateGSTIN('99AAPFU0939F1ZV');
      expect(invalidState.isValid).toBe(false);
      expect(invalidState.error).toContain('Invalid GSTIN state code');

      // Malformed format
      expect(validateGSTIN('INVALID_GSTIN').isValid).toBe(false);
      expect(validateGSTIN('').isValid).toBe(false);
    });

    it('accurately validates Income Tax PAN structure and entity types', () => {
      expect(validatePAN('AAPFU0939F').isValid).toBe(true);
      expect(validatePAN('AASCS2460H').isValid).toBe(true);

      // 4th char 'Z' is not a valid income tax entity type
      expect(validatePAN('AAPZU0939F').isValid).toBe(false);

      // Incorrect length
      expect(validatePAN('AAPFU0939').isValid).toBe(false);
      expect(validatePAN('AAPFU0939F1').isValid).toBe(false);
    });

    it('enforces GSTIN and PAN validation on BillingParty API endpoints', async () => {
      // Reject invalid GSTIN
      const resInvalid = await request(app)
        .post('/api/parties/billing')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          name: 'Acme Industries',
          gstin: '27AAPFU0939F1ZX', // Wrong checksum
          pan_number: 'AAPFU0939F',
        });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error).toContain('checksum');

      // Reject invalid PAN
      const resInvalidPan = await request(app)
        .post('/api/parties/billing')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          name: 'Acme Industries',
          gstin: '27AAPFU0939F1ZV',
          pan_number: 'AAPZU0939F', // Invalid entity code
        });
      expect(resInvalidPan.status).toBe(400);

      // Accept valid GSTIN and PAN
      const resValid = await request(app)
        .post('/api/parties/billing')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          name: 'Acme Industries',
          gstin: '27AAPFU0939F1ZV',
          pan_number: 'AAPFU0939F',
          phone: '+919876543210',
        });
      expect(resValid.status).toBe(201);
      expect(resValid.body.party.gstin).toBe('27AAPFU0939F1ZV');
    });

    it('enforces PAN validation on BalanceParty vendor endpoints', async () => {
      const resInvalid = await request(app)
        .post('/api/parties/balance')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          party_name: 'Sharma Roadways',
          phone: '+919876543211',
          pan_number: 'INVALID_PAN',
        });
      expect(resInvalid.status).toBe(400);

      const resValid = await request(app)
        .post('/api/parties/balance')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          party_name: 'Sharma Roadways',
          phone: '+919876543211',
          pan_number: 'AASCS2460H',
        });
      expect(resValid.status).toBe(201);
      expect(resValid.body.party.pan_number).toBe('AASCS2460H');
    });

    it('handles casing, whitespace normalization, and optional identifiers without breaking historical reads', async () => {
      // 1. Whitespace and lowercase GSTIN
      const cleanGstin = validateGSTIN('  27aapfu0939f1zv  ');
      expect(cleanGstin.isValid).toBe(true);

      // 2. Whitespace and lowercase PAN
      const cleanPan = validatePAN('  aapfu0939f  ');
      expect(cleanPan.isValid).toBe(true);
      expect(cleanPan.pan).toBe('AAPFU0939F');

      // 3. Historical document compatibility: legacy party without GSTIN can still be queried
      const legacyParty = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Legacy Shipper Unregistered',
        phone: '+919999000111',
      });

      const resGet = await request(app)
        .get(`/api/parties/billing/${legacyParty._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resGet.status).toBe(200);
      expect(resGet.body.party.name).toBe('Legacy Shipper Unregistered');
    });
  });

  // ============================================================================
  // 2. CREDIT NOTE ACCOUNTING & DOUBLE-ENTRY INTEGRITY (ISS-003)
  // ============================================================================
  describe('2. Credit Note Accounting & Double-Entry Integrity (ISS-003)', () => {
    let billingParty: any;
    let invoice: any;

    beforeEach(async () => {
      billingParty = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Tata Steel Corp',
        gstin: '27AAPFU0939F1ZV',
        pan_number: 'AAPFU0939F',
        phone: '+919876543210',
      });

      invoice = await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: 'INV-00100',
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        billing_party_id: billingParty._id,
        billing_party_snapshot: { name: 'Tata Steel Corp', gstin: '27AAPFU0939F1ZV' },
        subtotal: 10000,
        tax_type: 'forward_charge',
        is_rcm: false,
        place_of_supply: 'Maharashtra',
        total_amount: 10500,
        paid_amount: 0,
        credited_amount: 0,
        balance_amount: 10500,
        status: 'issued',
      });
    });

    it('does NOT treat credit note as cash received by incrementing paid_amount', async () => {
      // Issue credit note of ₹2,000 base + 5% GST (₹100) = ₹2,100 total
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-test-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'rate_difference',
          adjustment_amount_paise: 200000, // ₹2,000
          is_interstate: false,
          gst_rate_percent: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify updated Invoice state
      const updatedInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(updatedInvoice!.paid_amount).toBe(0); // MUST NOT BE TOUCHED
      expect(updatedInvoice!.credited_amount).toBe(2100);
      expect(updatedInvoice!.balance_amount).toBe(8400); // 10500 - 2100 = 8400
      expect(updatedInvoice!.status).toBe('partially_paid');
    });

    it('transitions invoice to "paid" when full credit note covers remaining balance', async () => {
      // Invoice total: ₹10,500. Credit note of ₹10,000 base + 5% GST = ₹10,500
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-full-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'cancellation',
          adjustment_amount_paise: 1000000, // ₹10,000
          is_interstate: false,
          gst_rate_percent: 5,
        });

      expect(res.status).toBe(201);

      const updatedInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(updatedInvoice!.paid_amount).toBe(0);
      expect(updatedInvoice!.credited_amount).toBe(10500);
      expect(updatedInvoice!.balance_amount).toBe(0);
      expect(updatedInvoice!.status).toBe('paid');
    });

    it('posts balanced double-entry journal (other_adjustment debit, payment_received credit)', async () => {
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-ledger-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'discount',
          adjustment_amount_paise: 100000, // ₹1,000 base + 5% = ₹1,050
          is_interstate: false,
          gst_rate_percent: 5,
        });

      expect(res.status).toBe(201);
      const creditNoteNo = res.body.credit_note.credit_note_no;

      // Verify Ledger journal entries
      const journalEntries = await Ledger.find(
        {
          company_id: tenantA.company._id,
          reference_number: creditNoteNo,
        },
        null,
        { skipTenantCheck: true }
      );

      expect(journalEntries.length).toBe(2);
      expect(journalEntries[0].journal_id).toBeDefined();
      expect(journalEntries[0].journal_id).toBe(journalEntries[1].journal_id);

      const debitLeg = journalEntries.find((e) => e.balance_type === 'debit');
      const creditLeg = journalEntries.find((e) => e.balance_type === 'credit');

      expect(debitLeg).toBeDefined();
      expect(debitLeg!.category).toBe('other_adjustment');
      expect(debitLeg!.amount).toBe(1050);

      expect(creditLeg).toBeDefined();
      expect(creditLeg!.category).toBe('payment_received');
      expect(creditLeg!.amount).toBe(1050);
      expect(creditLeg!.billing_party_id?.toString()).toBe(billingParty._id.toString());

      // Invariant: Debits === Credits
      expect(debitLeg!.amount).toBe(creditLeg!.amount);
    });

    it('rejects credit note adjustment exceeding eligible invoice balance', async () => {
      // Invoice balance is ₹10,500. Attempt adjustment of ₹15,000 base
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-excess-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'rate_difference',
          adjustment_amount_paise: 1500000, // ₹15,000
          is_interstate: false,
          gst_rate_percent: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds eligible invoice balance');

      // Ensure invoice was not modified
      const currentInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(currentInvoice!.balance_amount).toBe(10500);
      expect(currentInvoice!.credited_amount).toBe(0);
    });

    it('enforces tenant isolation: cannot issue credit note against foreign tenant invoice', async () => {
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantB.token}`) // Tenant B attempting on Tenant A's invoice
        .set('X-Idempotency-Key', `cn-idor-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'rate_difference',
          adjustment_amount_paise: 100000,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Invoice not found');
    });

    it('guarantees idempotency on retried credit note requests', async () => {
      const idemKey = `cn-retry-${Date.now()}`;
      const payload = {
        original_invoice_id: invoice._id.toString(),
        type: 'credit_note',
        reason: 'rate_difference',
        adjustment_amount_paise: 100000, // ₹1,050
        is_interstate: false,
        gst_rate_percent: 5,
      };

      const res1 = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', idemKey)
        .send(payload);

      const res2 = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', idemKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.credit_note.credit_note_no).toBe(res2.body.credit_note.credit_note_no);

      // Verify no duplicate credit note or duplicate journal entries were created
      const cnCount = await CreditNote.countDocuments(
        {
          credit_note_no: res1.body.credit_note.credit_note_no,
        },
        { skipTenantCheck: true }
      );
      expect(cnCount).toBe(1);

      const ledgerCount = await Ledger.countDocuments(
        {
          reference_number: res1.body.credit_note.credit_note_no,
        },
        { skipTenantCheck: true }
      );
      expect(ledgerCount).toBe(2); // exactly one 2-leg journal
    });

    it('verifies invariant total_amount = paid_amount + credited_amount + balance_amount and rejects overpayment', async () => {
      // Starting invariant
      expect(invoice.total_amount).toBe(invoice.paid_amount + invoice.credited_amount + invoice.balance_amount);

      // 1. Record partial payment of ₹3,000
      const payRes = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `idem-pay-inv-${Date.now()}`)
        .send({
          amount: 3000,
          payment_mode: 'bank_transfer',
        });
      expect(payRes.status).toBe(200);

      let inv = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(inv!.paid_amount).toBe(3000);
      expect(inv!.balance_amount).toBe(7500);
      expect(inv!.total_amount).toBe(inv!.paid_amount + inv!.credited_amount + inv!.balance_amount);

      // 2. Issue partial credit note of ₹2,000 base + 5% GST (₹100) = ₹2,100
      const cnRes = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `idem-cn-inv-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'discount',
          adjustment_amount_paise: 200000,
          is_interstate: false,
          gst_rate_percent: 5,
        });
      expect(cnRes.status).toBe(201);

      inv = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(inv!.paid_amount).toBe(3000);
      expect(inv!.credited_amount).toBe(2100);
      expect(inv!.balance_amount).toBe(5400); // 10500 - 3000 - 2100 = 5400
      expect(inv!.total_amount).toBe(inv!.paid_amount + inv!.credited_amount + inv!.balance_amount);

      // 3. Attempt overpayment of ₹6,000 (exceeds balance of ₹5,400)
      const overpayRes = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `idem-overpay-${Date.now()}`)
        .send({
          amount: 6000,
          payment_mode: 'bank_transfer',
        });
      expect(overpayRes.status).toBe(400);
      expect(overpayRes.body.error).toContain('exceeds remaining invoice balance');

      // Verify invariant still holds after rejected attempt
      inv = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(inv!.total_amount).toBe(inv!.paid_amount + inv!.credited_amount + inv!.balance_amount);
    });

    it('rolls back credit note transaction cleanly if an error occurs midway', async () => {
      const initialBal = invoice.balance_amount;
      const initialCredited = invoice.credited_amount;

      // An invalid adjustment of ₹0 will fail validation inside transaction
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-fail-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'rate_difference',
          adjustment_amount_paise: 0,
        });

      expect(res.status).toBe(400);

      // Verify Invoice was not modified
      const invAfter = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(invAfter!.balance_amount).toBe(initialBal);
      expect(invAfter!.credited_amount).toBe(initialCredited);

      // Verify no CreditNote or Ledger entries were persisted
      const cnCount = await CreditNote.countDocuments({ original_invoice_id: invoice._id }, { skipTenantCheck: true });
      expect(cnCount).toBe(0);
      const ledgerCount = await Ledger.countDocuments({ invoice_id: invoice._id }, { skipTenantCheck: true });
      expect(ledgerCount).toBe(0);
    });

    it('confirms credit notes reduce receivables without creating cash/bank entries or inflating cash collections', async () => {
      // 1. Issue credit note of ₹2,000 base + 5% GST = ₹2,100
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `cn-cash-check-${Date.now()}`)
        .send({
          original_invoice_id: invoice._id.toString(),
          type: 'credit_note',
          reason: 'rate_difference',
          adjustment_amount_paise: 200000,
          is_interstate: false,
          gst_rate_percent: 5,
        });

      expect(res.status).toBe(201);
      const creditNoteNo = res.body.credit_note.credit_note_no;

      // 2. Invariant: Ledger entries for credit note must NOT use cash/bank categories
      const cashBankEntries = await Ledger.find(
        {
          company_id: tenantA.company._id,
          reference_number: creditNoteNo,
          category: { $in: ['bank_transfer', 'cash_transfer'] },
        },
        null,
        { skipTenantCheck: true }
      );
      expect(cashBankEntries.length).toBe(0); // Zero cash/bank movements

      // 3. Invariant: Payment mode must be 'system', not cash or bank
      const cnLedgerEntries = await Ledger.find(
        {
          company_id: tenantA.company._id,
          reference_number: creditNoteNo,
        },
        null,
        { skipTenantCheck: true }
      );
      expect(cnLedgerEntries.length).toBe(2);
      cnLedgerEntries.forEach((entry) => {
        expect(entry.payment_mode).toBe('system');
      });

      // 4. Invariant: Invoice paid_amount is strictly 0, credited_amount is 2100
      const inv = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(inv!.paid_amount).toBe(0); // No cash collection inflation
      expect(inv!.credited_amount).toBe(2100);
      expect(inv!.balance_amount).toBe(8400);

      // 5. Invariant: getLedgerSummary net_cash_position has zero net impact
      const summaryRes = await request(app)
        .get('/api/commercial/ledger/summary')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.summary.net_cash_position).toBe(0); // Debits (2100) - Credits (2100) = 0

      // 6. Invariant: getLedgerReconciliation reports 0 collected and 2100 credited
      const reconRes = await request(app)
        .get('/api/commercial/ledger/reconciliation')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(reconRes.status).toBe(200);
      expect(reconRes.body.reconciliation.invoicing.total_collected).toBe(0);
      expect(reconRes.body.reconciliation.invoicing.total_credited).toBe(2100);
    });
  });

  // ============================================================================
  // 3. VENDOR PAYOUTS & PARTY BALANCES (ISS-004)
  // ============================================================================
  describe('3. Vendor Payouts & Party Balances (ISS-004)', () => {
    let vendor: any;

    beforeEach(async () => {
      vendor = await BalanceParty.create({
        company_id: tenantA.company._id,
        party_name: 'Rajput Roadlines',
        party_type: 'transporter',
        phone: '+919876543222',
        opening_balance: 5000, // Opening payable ₹5,000
      });

      // Add two vehicle entries
      await VehicleEntry.create({
        company_id: tenantA.company._id,
        balance_party_id: vendor._id,
        entry_number: 'VE-001',
        entry_date: new Date(),
        vehicle_number: 'MH12AB1234',
        driver_name: 'Driver 1',
        from_location: 'Pune',
        to_location: 'Mumbai',
        freight_amount: 15000,
        driver_cash_advance: 3000,
        kamisan_amount: 500,
        net_balance_due: 11500,
      });

      await VehicleEntry.create({
        company_id: tenantA.company._id,
        balance_party_id: vendor._id,
        entry_number: 'VE-002',
        entry_date: new Date(),
        vehicle_number: 'MH12AB5678',
        driver_name: 'Driver 2',
        from_location: 'Mumbai',
        to_location: 'Nagpur',
        freight_amount: 20000,
        driver_cash_advance: 5000,
        kamisan_amount: 500,
        net_balance_due: 14500,
      });
      // Total payable: 5000 (opening) + 11500 + 14500 = ₹31,000
    });

    it('records vendor payout with balanced double-entry journal under 1 journal_id', async () => {
      const res = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `payout-${Date.now()}`)
        .send({
          amount: 10000,
          payment_mode: 'bank',
          reference_number: 'UTR-987654321',
          notes: 'Interim settlement',
        });

      expect(res.status).toBe(201);
      expect(res.body.journal_id).toBeDefined();
      expect(res.body.entries.length).toBe(2);

      const entries = await Ledger.find({ journal_id: res.body.journal_id }, null, { skipTenantCheck: true });
      expect(entries.length).toBe(2);

      const debitLeg = entries.find((e) => e.balance_type === 'debit');
      const creditLeg = entries.find((e) => e.balance_type === 'credit');

      expect(debitLeg!.category).toBe('payment_made');
      expect(debitLeg!.amount).toBe(10000);
      expect(debitLeg!.balance_party_id?.toString()).toBe(vendor._id.toString());

      expect(creditLeg!.category).toBe('bank_transfer');
      expect(creditLeg!.amount).toBe(10000);
      expect(creditLeg!.balance_party_id?.toString()).toBe(vendor._id.toString());

      // Invariant: Debits === Credits
      expect(debitLeg!.amount).toBe(creditLeg!.amount);
    });

    it('reduces vendor payable balance in party-balances and party-statement exactly once', async () => {
      // 1. Initial balance check: ₹31,000
      const initialBalRes = await request(app)
        .get('/api/commercial/ledger/party-balances')
        .set('Authorization', `Bearer ${tenantA.token}`);

      const initialParty = initialBalRes.body.party_balances.find((p: any) => p._id === vendor._id.toString());
      expect(initialParty.totalOutstanding).toBe(31000);
      expect(initialParty.totalPaidOut).toBe(0);

      // 2. Make payout of ₹12,000
      await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `payout-stmt-${Date.now()}`)
        .send({
          amount: 12000,
          payment_mode: 'bank',
        });

      // 3. Post-payout party-balances check: ₹19,000
      const postBalRes = await request(app)
        .get('/api/commercial/ledger/party-balances')
        .set('Authorization', `Bearer ${tenantA.token}`);

      const updatedParty = postBalRes.body.party_balances.find((p: any) => p._id === vendor._id.toString());
      expect(updatedParty.totalPaidOut).toBe(12000);
      expect(updatedParty.totalOutstanding).toBe(19000);

      // 4. Statement check
      const stmtRes = await request(app)
        .get(`/api/commercial/ledger/party-balances/${vendor._id}/statement`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(stmtRes.body.summary.total_payouts).toBe(12000);
      expect(stmtRes.body.summary.net_outstanding).toBe(19000);
      expect(stmtRes.body.payouts.length).toBe(1);
    });

    it('rejects payout exceeding the outstanding payable balance', async () => {
      // Total payable is ₹31,000. Attempt ₹40,000 payout
      const res = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `payout-excess-${Date.now()}`)
        .send({
          amount: 40000,
          payment_mode: 'bank',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds outstanding vendor payable balance');

      // Verify no ledger entries were created
      const entries = await Ledger.find(
        {
          company_id: tenantA.company._id,
          balance_party_id: vendor._id,
        },
        null,
        { skipTenantCheck: true }
      );
      expect(entries.length).toBe(0);
    });

    it('enforces tenant isolation on vendor payout', async () => {
      const res = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantB.token}`) // Tenant B attempting Tenant A's vendor
        .set('X-Idempotency-Key', `payout-idor-${Date.now()}`)
        .send({
          amount: 5000,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Vendor not found');
    });

    it('guarantees idempotency on retried vendor payout requests', async () => {
      const idemKey = `payout-retry-${Date.now()}`;
      const payload = {
        amount: 8000,
        payment_mode: 'bank',
        reference_number: 'UTR-RETRY-123',
      };

      const res1 = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', idemKey)
        .send(payload);

      const res2 = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', idemKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.journal_id).toBe(res2.body.journal_id);

      // Verify exactly one journal was created, not two
      const journals = await Ledger.find(
        {
          company_id: tenantA.company._id,
          journal_id: res1.body.journal_id,
        },
        null,
        { skipTenantCheck: true }
      );
      expect(journals.length).toBe(2); // exactly 1 debit + 1 credit leg
    });

    it('handles concurrent payouts and rejects attempts that exceed outstanding balance', async () => {
      // Vendor has ₹31,000 outstanding.
      // Launch two concurrent payout requests of ₹20,000 each.
      // One must succeed (leaving ₹11,000 balance), and the other must be rejected because ₹20,000 > ₹11,000.
      const p1 = request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `concurrent-p1-${Date.now()}`)
        .send({ amount: 20000, payment_mode: 'bank', reference_number: 'UTR-C1' });

      const p2 = request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `concurrent-p2-${Date.now()}`)
        .send({ amount: 20000, payment_mode: 'bank', reference_number: 'UTR-C2' });

      const [res1, res2] = await Promise.all([p1, p2]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error).toContain('exceeds outstanding vendor payable balance');

      // Check remaining party balance
      const balRes = await request(app)
        .get(`/api/commercial/ledger/party-balances/${vendor._id}/statement`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(balRes.body.summary.total_payouts).toBe(20000);
      expect(balRes.body.summary.net_outstanding).toBe(11000);
    });

    it('rolls back vendor payout transaction cleanly if an error occurs midway', async () => {
      const initialParty = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
      const initialBalance = initialParty!.current_balance;

      // Attempt payout with invalid negative amount
      const res = await request(app)
        .post(`/api/commercial/ledger/party-balances/${vendor._id}/payout`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('X-Idempotency-Key', `payout-fail-${Date.now()}`)
        .send({ amount: -5000, payment_mode: 'bank' });

      expect(res.status).toBe(400);

      // Verify no ledger entries were created
      const entries = await Ledger.find({ balance_party_id: vendor._id }, null, { skipTenantCheck: true });
      expect(entries.length).toBe(0);

      // Verify party balance was not changed
      const partyAfter = await BalanceParty.findById(vendor._id, null, { skipTenantCheck: true });
      expect(partyAfter!.current_balance).toBe(initialBalance);
    });
  });

  // ============================================================================
  // 4. COMMERCIAL REPORTING & RECONCILIATION INTEGRITY (ISS-008, ISS-010)
  // ============================================================================
  describe('4. Commercial Reporting & Financial Reconciliation (ISS-008 & ISS-010)', () => {
    it('returns customer party name properly in AR Aging report', async () => {
      const bp = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Reliance Logistics Ltd',
        gstin: '27AAPFU0939F1ZV',
        phone: '+919876543299',
      });

      await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: 'INV-AGING-01',
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 5 * 86400000),
        billing_party_id: bp._id,
        billing_party_snapshot: { name: 'Reliance Logistics Ltd' },
        subtotal: 50000,
        tax_type: 'rcm',
        is_rcm: true,
        place_of_supply: 'Maharashtra',
        total_amount: 50000,
        paid_amount: 0,
        balance_amount: 50000,
        status: 'issued',
      });

      const res = await request(app)
        .get('/api/commercial/aging')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const items = res.body.aging.current_0_30.items;
      expect(items.length).toBeGreaterThan(0);

      const target = items.find((it: any) => it.invoice_no === 'INV-AGING-01');
      expect(target).toBeDefined();
      expect(target.party.party_name).toBe('Reliance Logistics Ltd');
      expect(target.customer_name).toBe('Reliance Logistics Ltd');
    });

    it('computes Trip Profitability by accurately mapping TruckJourney fields', async () => {
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12QW1122',
        registration_number: 'MH12QW1122',
        truck_type: 'own',
        make: 'Tata Motors',
        model: 'Prima 4028.S',
        tonnage_capacity: 40,
        body_type: 'Container',
        status: 'available',
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Suresh Kumar',
        phone: '+919876543288',
        license_number: 'MH1420110001234',
        status: 'active',
      });

      await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: 'JRN-2026-001',
        status: 'completed',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Nagpur', hub_name: 'Nagpur Hub' },
        to_location: { city: 'Pune', hub_name: 'Pune Hub' },
        start_date: new Date(),
        start_odometer_kms: 10000,
        end_odometer_kms: 10800,
        total_distance_kms: 800,
        freight_rate: 45000, // Revenue: ₹45,000
        diesel_expenses: [
          {
            filling_date: new Date(),
            petrol_pump_name: 'HPCL Pump',
            fuel_quantity_litres: 200,
            rate_per_litre: 90,
            total_cost: 18000,
            payment_mode: 'fuel_card',
          },
        ],
        driver_expenses: [
          {
            date: new Date(),
            expense_type: 'toll',
            amount: 4000,
          },
        ],
        delivery_status: 'delivered',
        is_settled: true,
      });

      const res = await request(app)
        .get('/api/commercial/profitability')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.trips.length).toBe(1);

      const trip = res.body.trips[0];
      expect(trip.revenue_paise).toBe(4500000); // ₹45,000 in paise
      expect(trip.diesel_expense_paise).toBe(1800000); // ₹18,000 in paise
      expect(trip.driver_expense_paise).toBe(400000); // ₹4,000 in paise
      expect(trip.expenses_paise).toBe(2200000); // Total expenses: ₹22,000 in paise
      expect(trip.net_margin_paise).toBe(2300000); // Net profit: ₹23,000 in paise
      expect(trip.margin_percent).toBe(51.11); // 23000 / 45000 * 100 = 51.11%
      expect(trip.from).toBe('Nagpur');
      expect(trip.to).toBe('Pune');
      expect(trip.truck).toBe('MH12QW1122');
      expect(trip.driver).toBe('Suresh Kumar');
    });

    it('verifies financial reconciliation health with zero unbalance', async () => {
      const res = await request(app)
        .get('/api/commercial/ledger/reconciliation')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.reconciliation.journal_integrity.all_journals_balanced).toBe(true);
      expect(res.body.reconciliation.invoicing.inconsistent_invoices_count).toBe(0);
      expect(res.body.reconciliation.is_healthy).toBe(true);
    });

    it('detects unbalanced journals, inconsistent invoice balances, and excessive payouts without mutating data', async () => {
      // 1. Create an unbalanced journal (simulate corrupted legacy record)
      await Ledger.create({
        company_id: tenantA.company._id,
        transaction_number: 'UNB-001',
        transaction_date: new Date(),
        category: 'other_adjustment',
        transaction_type: 'manual_adjustment',
        balance_type: 'debit',
        amount: 5000,
        journal_id: 'JRN-UNBALANCED-999',
        reference_number: 'REF-UNB-999',
        party_name: 'Test Party',
        description: 'Deliberate single leg debit',
      });

      // 2. Create an inconsistent invoice balance (simulate corrupted legacy record)
      await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: 'INV-CORRUPT-01',
        invoice_date: new Date(),
        due_date: new Date(),
        billing_party_id: new mongoose.Types.ObjectId(),
        billing_party_snapshot: { name: 'Corrupt Invoice Party' },
        subtotal: 10000,
        tax_type: 'rcm',
        is_rcm: true,
        place_of_supply: 'Maharashtra',
        total_amount: 10000,
        paid_amount: 0,
        credited_amount: 0,
        balance_amount: 5000, // Inconsistent: total 10000 != balance 5000 with 0 paid/credited
        status: 'issued',
      });

      // 3. Create an excessive vendor payout (simulate corrupted legacy record)
      const corruptVendor = await BalanceParty.create({
        company_id: tenantA.company._id,
        party_name: 'Overpaid Vendor',
        phone: '+919876543233',
        opening_balance: 1000,
      });
      await Ledger.create({
        company_id: tenantA.company._id,
        transaction_number: 'PAY-EXCESS-01',
        transaction_date: new Date(),
        category: 'payment_made',
        balance_type: 'debit',
        amount: 5000, // 5000 > 1000 gross due
        balance_party_id: corruptVendor._id,
        party_name: corruptVendor.party_name,
        description: 'Deliberate excessive payout',
      });

      // 4. Request reconciliation report
      const res = await request(app)
        .get('/api/commercial/ledger/reconciliation')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const { reconciliation } = res.body;

      // Unbalanced journal detected
      expect(reconciliation.journal_integrity.all_journals_balanced).toBe(false);
      expect(reconciliation.journal_integrity.unbalanced_journals_count).toBeGreaterThan(0);

      // Inconsistent invoice detected
      expect(reconciliation.invoicing.inconsistent_invoices_count).toBeGreaterThan(0);
      const foundInconsistent = reconciliation.invoicing.inconsistent_invoices.find(
        (inv: any) => inv.invoice_number === 'INV-CORRUPT-01'
      );
      expect(foundInconsistent).toBeDefined();

      // Excessive payout detected
      expect(reconciliation.vendor_payouts.excessive_payouts_count).toBeGreaterThan(0);
      const foundExcessive = reconciliation.vendor_payouts.excessive_payouts.find(
        (p: any) => p.balance_party_id === corruptVendor._id.toString()
      );
      expect(foundExcessive).toBeDefined();
      expect(foundExcessive.excess_amount).toBe(4000);

      // Global health is marked unhealthy
      expect(reconciliation.is_healthy).toBe(false);

      // Confirm READ-ONLY integrity: database records were NOT mutated
      const invAfter = await Invoice.findOne({ invoice_number: 'INV-CORRUPT-01' }, null, { skipTenantCheck: true });
      expect(invAfter!.balance_amount).toBe(5000); // Intact, no automatic bulk repair
    });

    it('verifies profitability field consistency with multiple trips and non-zero values', async () => {
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH14XY9999',
        registration_number: 'MH14XY9999',
        truck_type: 'own',
        make: 'Tata Motors',
        model: 'Signa 4825.TK',
        tonnage_capacity: 35,
        body_type: 'Open',
        status: 'available',
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Ramesh Singh',
        phone: '+919876543299',
        license_number: 'MH1420110009999',
        status: 'active',
      });

      // Journey 1: ₹60,000 revenue, ₹22,000 diesel, ₹8,000 driver expense -> ₹30,000 net profit (50.00%)
      await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: 'JRN-MULTI-01',
        status: 'completed',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Mumbai' },
        to_location: { city: 'Delhi' },
        start_date: new Date(),
        start_odometer_kms: 20000,
        end_odometer_kms: 21400,
        total_distance_kms: 1400,
        freight_rate: 60000,
        diesel_expenses: [
          {
            filling_date: new Date(),
            petrol_pump_name: 'IOCL Pump',
            fuel_quantity_litres: 244.44,
            rate_per_litre: 90,
            total_cost: 22000,
            payment_mode: 'fuel_card',
          },
        ],
        driver_expenses: [
          {
            date: new Date(),
            expense_type: 'toll',
            amount: 8000,
          },
        ],
        delivery_status: 'delivered',
        is_settled: true,
      });

      // Journey 2: ₹35,000 revenue, ₹15,000 diesel, ₹3,500 driver expense -> ₹16,500 net profit (47.14%)
      await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: 'JRN-MULTI-02',
        status: 'completed',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Delhi' },
        to_location: { city: 'Jaipur' },
        start_date: new Date(),
        start_odometer_kms: 21400,
        end_odometer_kms: 21700,
        total_distance_kms: 300,
        freight_rate: 35000,
        diesel_expenses: [
          {
            filling_date: new Date(),
            petrol_pump_name: 'BPCL Pump',
            fuel_quantity_litres: 166.67,
            rate_per_litre: 90,
            total_cost: 15000,
            payment_mode: 'fuel_card',
          },
        ],
        driver_expenses: [
          {
            date: new Date(),
            expense_type: 'toll',
            amount: 3500,
          },
        ],
        delivery_status: 'delivered',
        is_settled: true,
      });

      const res = await request(app)
        .get('/api/commercial/profitability')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);

      const j1 = res.body.trips.find((t: any) => t.journey_number === 'JRN-MULTI-01');
      expect(j1).toBeDefined();
      expect(j1.revenue_paise).toBe(6000000); // ₹60,000 in paise
      expect(j1.diesel_expense_paise).toBe(2200000); // ₹22,000 in paise
      expect(j1.driver_expense_paise).toBe(800000); // ₹8,000 in paise
      expect(j1.expenses_paise).toBe(3000000); // ₹30,000 in paise
      expect(j1.net_margin_paise).toBe(3000000); // ₹30,000 in paise
      expect(j1.margin_percent).toBe(50.0);

      const j2 = res.body.trips.find((t: any) => t.journey_number === 'JRN-MULTI-02');
      expect(j2).toBeDefined();
      expect(j2.revenue_paise).toBe(3500000); // ₹35,000 in paise
      expect(j2.diesel_expense_paise).toBe(1500000); // ₹15,000 in paise
      expect(j2.driver_expense_paise).toBe(350000); // ₹3,500 in paise
      expect(j2.expenses_paise).toBe(1850000); // ₹18,500 in paise
      expect(j2.net_margin_paise).toBe(1650000); // ₹16,500 in paise
      expect(j2.margin_percent).toBe(47.14); // 16500 / 35000 * 100 = 47.14%
    });
  });
});
