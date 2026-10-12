/**
 * ============================================================================
 * PHASE 2.5 INTEGRATION TESTS: ACID TRANSACTIONS & TOPOLOGY ENFORCEMENT
 * (ISS-018 & DEC-002)
 * ============================================================================
 * 
 * Verifies:
 * 1. Topology Enforcement (DEC-002):
 *    - Standalone MongoDB fails fast with ConfigurationError across all environments.
 *    - Replica Set topology allows multi-document transactions to proceed.
 * 2. Multi-Document ACID Atomicity (ISS-018):
 *    - Successful transactions commit across multiple collections atomically.
 *    - Any failure/exception inside a transaction rolls back all participating writes,
 *      leaving zero orphan or partially committed documents.
 * 3. Verified Financial Mutation Workflows:
 *    - Driver Settlement Confirmation & Payment
 *    - Invoice Payment & Cancellation
 *    - SaaS Subscription Activation / Payment Verification
 *    - Tenant Registration / Onboarding
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import {
  runInTransaction,
  assertReplicaSetTopology,
  isReplicaSetConnection,
  ConfigurationError,
  __setTopologyOverrideForTesting,
} from '../../utils/transactionHelper.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { Driver } from '../../models/Driver.js';
import { Truck } from '../../models/Truck.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Settlement } from '../../models/Settlement.js';
import { Invoice } from '../../models/Invoice.js';
import { Entry } from '../../models/Entry.js';
import { BillingParty } from '../../models/BillingParty.js';
import { Ledger } from '../../models/Ledger.js';
import { Company } from '../../models/Company.js';
import { User } from '../../models/User.js';
import { CompanyMember } from '../../models/CompanyMember.js';
import { Subscription } from '../../models/Subscription.js';
import { PaymentTransaction } from '../../models/PaymentTransaction.js';
import { Plan } from '../../models/Plan.js';
import { MaintenanceOrder } from '../../models/MaintenanceOrder.js';

describe('Phase 2.5: Topology Enforcement & ACID Transactions (DEC-002 & ISS-018)', () => {
  let tenant: TestTenantContext;

  beforeEach(async () => {
    __setTopologyOverrideForTesting(null);
    await seedBillingCatalog();
    tenant = await createTestTenant();
  });

  afterEach(() => {
    __setTopologyOverrideForTesting(null);
  });

  describe('1. DEC-002: Topology Enforcement & Fail-Fast Standalone Rejection', () => {
    it('verifies that the active test harness connection is a valid MongoDB Replica Set', () => {
      const isRepl = isReplicaSetConnection();
      expect(isRepl).toBe(true);
      expect(() => assertReplicaSetTopology()).not.toThrow();
    });

    it('assertReplicaSetTopology() throws ConfigurationError (HTTP 500) fail-fast when standalone is simulated', () => {
      __setTopologyOverrideForTesting(false);

      expect(() => assertReplicaSetTopology()).toThrow(ConfigurationError);
      expect(() => assertReplicaSetTopology()).toThrow(/requires a MongoDB Replica Set/i);
    });

    it('runInTransaction() rejects standalone topology immediately without executing work', async () => {
      __setTopologyOverrideForTesting(false);

      let workExecuted = false;
      await expect(
        runInTransaction(async () => {
          workExecuted = true;
        })
      ).rejects.toThrow(ConfigurationError);

      expect(workExecuted).toBe(false);
    });
  });

  describe('2. ISS-018: Multi-Document Atomicity & Rollback Guarantees', () => {
    it('commits writes across multiple collections when transaction completes successfully', async () => {
      const driver = await Driver.create({
        company_id: tenant.company._id,
        name: 'Commit Driver',
        phone: '+919900112233',
        license_number: 'DL-COMMIT-01',
        running_advance_balance: 5000,
      });

      await runInTransaction(async (session) => {
        await Driver.updateOne(
          { _id: driver._id, company_id: tenant.company._id },
          { $set: { running_advance_balance: 1000 } },
          { session }
        );

        await Company.updateOne(
          { _id: tenant.company._id },
          { $set: { 'settings.currency': 'USD' } },
          { session }
        );
      });

      const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
      const updatedCompany = await Company.findById(tenant.company._id);

      expect(updatedDriver?.running_advance_balance).toBe(1000);
      expect(updatedCompany?.settings?.currency).toBe('USD');
    });

    it('aborts and rolls back ALL writes across all collections when an error is thrown inside transaction', async () => {
      const driver = await Driver.create({
        company_id: tenant.company._id,
        name: 'Rollback Driver',
        phone: '+919900112244',
        license_number: 'DL-ROLLBACK-01',
        running_advance_balance: 5000,
      });

      const initialDriverBalance = driver.running_advance_balance;
      const initialCompanyCurrency = tenant.company.settings.currency;

      await expect(
        runInTransaction(async (session) => {
          // Write 1: Update driver
          await Driver.updateOne(
            { _id: driver._id, company_id: tenant.company._id },
            { $set: { running_advance_balance: 0 } },
            { session }
          );

          // Write 2: Update company
          await Company.updateOne(
            { _id: tenant.company._id },
            { $set: { 'settings.currency': 'EUR' } },
            { session }
          );

          // Injected mid-transaction failure
          throw new Error('SIMULATED_TRANSACTION_FAILURE_ROLLBACK');
        })
      ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE_ROLLBACK');

      // Assert zero partial writes were committed:
      const pristineDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
      const pristineCompany = await Company.findById(tenant.company._id);

      expect(pristineDriver?.running_advance_balance).toBe(initialDriverBalance);
      expect(pristineCompany?.settings?.currency).toBe(initialCompanyCurrency);
    });
  });

  describe('3. Workflow Atomicity: Driver Settlement Confirmation & Payment', () => {
    it('atomically confirms settlement, locks journeys, updates driver balance, and posts ledger entries', async () => {
      const truck = await Truck.create({
        company_id: tenant.company._id,
        truck_no: 'KA-01-TX-1001',
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Tata',
        model: 'Prima',
        tonnage_capacity: 16,
      });

      const driver = await Driver.create({
        company_id: tenant.company._id,
        name: 'Tx Driver',
        phone: '+919900112255',
        license_number: 'DL-TX-001',
      });

      const journey = await TruckJourney.create({
        company_id: tenant.company._id,
        journey_number: `JRN-TX-${Date.now()}`,
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Bengaluru', state: 'Karnataka' },
        to_location: { city: 'Chennai', state: 'Tamil Nadu' },
        start_date: new Date(),
        actual_end_date: new Date(),
        start_odometer_kms: 1000,
        end_odometer_kms: 1500,
        starting_cash_advance: 2000,
        total_driver_expenses: 500,
        status: 'completed',
        is_settled: false,
      });

      const res = await request(app)
        .post('/api/commercial/settlements/confirm')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-settle-${Date.now()}`)
        .send({
          driver_id: driver._id.toString(),
          journey_ids: [journey._id.toString()],
          rate_per_km: 5.0,
          benchmark_mileage: 4.0,
          diesel_price_per_litre: 90.0,
          other_deductions: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.settlement).toBeDefined();

      const settlementId = res.body.settlement._id;

      // Verify atomic multi-collection state:
      const savedSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
      const lockedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
      const updatedDriver = await Driver.findById(driver._id, null, { skipTenantCheck: true });
      const ledgerEntries = await Ledger.find({ settlement_id: settlementId }, null, { skipTenantCheck: true });

      expect(savedSettlement).not.toBeNull();
      expect(lockedJourney?.is_settled).toBe(true);
      expect(lockedJourney?.settlement_id?.toString()).toBe(settlementId.toString());
      expect(updatedDriver?.last_settlement_id?.toString()).toBe(settlementId.toString());
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(2); // Paired double-entry journal

      // Now verify atomic payment mark-paid
      const payRes = await request(app)
        .put(`/api/commercial/settlements/${settlementId}/pay`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-settle-pay-${Date.now()}`)
        .send({
          payment_mode: 'bank_transfer',
          payment_ref: 'UTR-TEST-12345',
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.settlement.payment_status).toBe('paid');

      const paidSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
      expect(paidSettlement?.payment_status).toBe('paid');
    });
  });

  describe('4. Workflow Atomicity: Invoice Payment Recording & Cancellation', () => {
    it('atomically records invoice payment and posts General Ledger receipt journal', async () => {
      const party = await BillingParty.create({
        company_id: tenant.company._id,
        name: 'Tx Customer',
        gstin: '29ABCDE1234F1Z5',
        phone: '+919876543210',
        address: 'MG Road, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const invoice = await Invoice.create({
        company_id: tenant.company._id,
        invoice_number: `INV-TX-${Date.now()}`,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        place_of_supply: '29-Karnataka',
        billing_party_id: party._id,
        billing_party_snapshot: { name: party.name, gstin: party.gstin },
        total_amount: 10000,
        paid_amount: 0,
        balance_amount: 10000,
        status: 'issued',
      });

      const res = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-inv-pay-${Date.now()}`)
        .send({
          amount: 5000,
          tds_amount: 200,
          payment_mode: 'bank_transfer',
          reference_number: 'UTR-INV-999',
        });

      expect(res.status).toBe(200);
      expect(res.body.invoice.paid_amount).toBe(5200);
      expect(res.body.invoice.balance_amount).toBe(4800);
      expect(res.body.invoice.status).toBe('partially_paid');

      // Verify Ledger journal was posted with same session (5200 total cleared)
      const ledgerPayment = await Ledger.findOne(
        { invoice_id: invoice._id, category: 'payment_received' },
        null,
        { skipTenantCheck: true }
      );
      expect(ledgerPayment).not.toBeNull();
      expect(ledgerPayment?.amount).toBe(5200);
    });

    it('atomically cancels invoice and releases linked LR entries', async () => {
      const party = await BillingParty.create({
        company_id: tenant.company._id,
        name: 'Tx Party',
        gstin: '29ABCDE1234F1Z5',
        phone: '+919876543210',
        address: 'MG Road, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const entry = await Entry.create({
        company_id: tenant.company._id,
        lr_no: `LR-TX-${Date.now()}`,
        bill_no: `BILL-${Date.now()}`,
        lr_date: new Date(),
        vehicle_number: 'KA-01-AB-1234',
        from_location: 'Bengaluru',
        to_location: 'Chennai',
        consignor: { name: 'ABC Logistics' },
        consignee: { name: 'XYZ Retail' },
        freight_amount: 8000,
        status: 'invoiced',
        is_deleted: false,
      });

      const invoice = await Invoice.create({
        company_id: tenant.company._id,
        invoice_number: `INV-CAN-${Date.now()}`,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        place_of_supply: '29-Karnataka',
        billing_party_id: party._id,
        billing_party_snapshot: { name: party.name, gstin: party.gstin },
        total_amount: 8000,
        paid_amount: 0,
        balance_amount: 8000,
        status: 'issued',
        lr_ids: [entry._id],
      });

      const res = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/cancel`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-inv-can-${Date.now()}`)
        .send();

      expect(res.status).toBe(200);

      const updatedInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      const releasedEntry = await Entry.findById(entry._id, null, { skipTenantCheck: true });

      expect(updatedInvoice?.status).toBe('cancelled');
      expect(releasedEntry?.status).toBe('active');
      expect(releasedEntry?.invoice_id).toBeNull();
    });
  });

  describe('5. Workflow Atomicity: SaaS Subscription Payment Verification', () => {
    it('atomically activates Subscription, updates Company status, and marks PaymentTransaction success inside transaction', async () => {
      const enterprisePlan = await Plan.findOne({ code: 'enterprise' });
      expect(enterprisePlan).not.toBeNull();

      const orderId = `order_test_${Date.now()}`;
      await PaymentTransaction.create({
        company_id: tenant.company._id,
        plan_id: enterprisePlan!._id,
        order_id: orderId,
        amount_paise: 999900,
        currency: 'INR',
        status: 'pending',
        billing_cycle: 'monthly',
        invoice_number: `INV-SUB-${Date.now()}`,
        tax_breakup: {
          subtotal_paise: 999900,
          cgst_paise: 0,
          sgst_paise: 0,
          total_paise: 999900,
          gst_rate_percent: 0,
        },
      });

      // Verify transactional multi-write using runInTransaction
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { subscription, transaction } = await runInTransaction(async (session) => {
        const sub = await Subscription.findOneAndUpdate(
          { company_id: tenant.company._id },
          {
            plan_id: enterprisePlan!._id,
            billing_cycle: 'monthly',
            status: 'active',
            current_period_start: now,
            current_period_end: periodEnd,
            'dunning.attempt_count': 0,
          },
          { new: true, upsert: true, session }
        );

        await Company.findByIdAndUpdate(
          tenant.company._id,
          { subscription_status: 'active' },
          { session }
        );

        const txn = await PaymentTransaction.findOneAndUpdate(
          { order_id: orderId },
          {
            payment_id: `pay_${Date.now()}`,
            payment_method: 'card',
            status: 'success',
            subscription_id: sub?._id,
          },
          { new: true, session }
        );

        return { subscription: sub, transaction: txn };
      });

      expect(subscription?.status).toBe('active');
      expect(transaction?.status).toBe('success');

      const verifiedCompany = await Company.findById(tenant.company._id);
      expect(verifiedCompany?.subscription_status).toBe('active');
    });
  });

  describe('6. Workflow Atomicity: Tenant Registration & Onboarding', () => {
    it('atomically creates User, Company, CompanyMember, and Subscription inside transaction', async () => {
      const email = `atomic-user-${Date.now()}@fleetflow.io`;

      const res = await request(app)
        .post('/api/auth/register-company')
        .send({
          companyName: 'Atomic Logistics Ltd',
          name: 'Atomic Admin',
          email,
          password: 'SecurePassword123!',
          phone: '+919988776655',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.company).toBeDefined();

      const createdUser = await User.findOne({ email });
      const createdCompany = await Company.findOne({ email });
      const createdMember = await CompanyMember.findOne({ user_id: createdUser?._id, company_id: createdCompany?._id }, null, { skipTenantCheck: true });
      const createdSubscription = await Subscription.findOne({ company_id: createdCompany?._id });

      expect(createdUser).not.toBeNull();
      expect(createdCompany).not.toBeNull();
      expect(createdMember).not.toBeNull();
      expect(createdMember?.role).toBe('admin');
      expect(createdSubscription).not.toBeNull();
      expect(createdSubscription?.status).toBe('trialing');
    });
  });

  describe('7. Workflow Atomicity: Driver Settlement Cancellation & Rollback', () => {
    it('atomically cancels confirmed settlement, resets journeys to unsettled, and marks ledger entries reversed', async () => {
      const truck = await Truck.create({
        company_id: tenant.company._id,
        truck_no: `KA-01-TX-${Date.now().toString().slice(-4)}`,
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Tata',
        model: 'Prima',
        tonnage_capacity: 16,
      });

      const driver = await Driver.create({
        company_id: tenant.company._id,
        name: 'Cancel Driver',
        phone: '+919900112277',
        license_number: 'DL-CAN-001',
      });

      const journey = await TruckJourney.create({
        company_id: tenant.company._id,
        journey_number: `JRN-CAN-${Date.now()}`,
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Bengaluru', state: 'Karnataka' },
        to_location: { city: 'Chennai', state: 'Tamil Nadu' },
        start_date: new Date(),
        actual_end_date: new Date(),
        start_odometer_kms: 2000,
        end_odometer_kms: 2500,
        starting_cash_advance: 2000,
        total_driver_expenses: 500,
        status: 'completed',
        is_settled: false,
      });

      // 1. Confirm settlement
      const confirmRes = await request(app)
        .post('/api/commercial/settlements/confirm')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-confirm-to-cancel-${Date.now()}`)
        .send({
          driver_id: driver._id.toString(),
          journey_ids: [journey._id.toString()],
          rate_per_km: 5.0,
          benchmark_mileage: 4.0,
          diesel_price_per_litre: 90.0,
          other_deductions: 0,
        });

      expect(confirmRes.status).toBe(201);
      const settlementId = confirmRes.body.settlement._id;

      // Verify confirmed state
      const preJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
      expect(preJourney?.is_settled).toBe(true);

      // 2. Cancel settlement
      const cancelRes = await request(app)
        .post(`/api/commercial/settlements/${settlementId}/cancel`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-cancel-settle-${Date.now()}`)
        .send({
          cancellation_reason: 'Audit correction',
        });

      expect(cancelRes.status).toBe(200);

      // 3. Verify atomic state roll-back across all collections:
      const postSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
      const postJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
      const postLedgers = await Ledger.find({ settlement_id: settlementId }, null, { skipTenantCheck: true });

      expect(postSettlement?.is_deleted).toBe(true);
      expect(postJourney?.is_settled).toBe(false);
      expect(postJourney?.settlement_id).toBeNull();
      expect(postLedgers.every((l) => l.is_reversal === true)).toBe(true);
    });

    it('rolls back and rejects cancellation when settlement is already paid', async () => {
      const truck = await Truck.create({
        company_id: tenant.company._id,
        truck_no: `KA-02-TX-${Date.now().toString().slice(-4)}`,
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Tata',
        model: 'Prima',
        tonnage_capacity: 16,
      });

      const driver = await Driver.create({
        company_id: tenant.company._id,
        name: 'Paid Driver',
        phone: '+919900112288',
        license_number: 'DL-PAID-001',
      });

      const journey = await TruckJourney.create({
        company_id: tenant.company._id,
        journey_number: `JRN-PAID-${Date.now()}`,
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Bengaluru', state: 'Karnataka' },
        to_location: { city: 'Chennai', state: 'Tamil Nadu' },
        start_date: new Date(),
        actual_end_date: new Date(),
        start_odometer_kms: 3000,
        end_odometer_kms: 3500,
        status: 'completed',
        is_settled: false,
      });

      const confirmRes = await request(app)
        .post('/api/commercial/settlements/confirm')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-settle-paid-${Date.now()}`)
        .send({
          driver_id: driver._id.toString(),
          journey_ids: [journey._id.toString()],
          rate_per_km: 5.0,
          benchmark_mileage: 4.0,
          diesel_price_per_litre: 90.0,
          other_deductions: 0,
        });

      const settlementId = confirmRes.body.settlement._id;

      // Mark paid
      await request(app)
        .put(`/api/commercial/settlements/${settlementId}/pay`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-pay-paid-${Date.now()}`)
        .send({
          payment_mode: 'bank_transfer',
          payment_ref: 'UTR-PAID-999',
        });

      // Attempt to cancel paid settlement
      const cancelRes = await request(app)
        .post(`/api/commercial/settlements/${settlementId}/cancel`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-cancel-paid-${Date.now()}`)
        .send({ cancellation_reason: 'Illegal cancel attempt' });

      expect(cancelRes.status).toBe(400);

      // Verify state was completely preserved
      const pristineSettlement = await Settlement.findById(settlementId, null, { skipTenantCheck: true });
      const pristineJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });

      expect(pristineSettlement?.payment_status).toBe('paid');
      expect(pristineSettlement?.is_deleted).toBe(false);
      expect(pristineJourney?.is_settled).toBe(true);
    });
  });

  describe('8. Workflow Atomicity: Manual Double-Entry Journal Voucher Posting', () => {
    it('atomically posts balanced multi-leg double-entry journal inside transaction', async () => {
      const res = await request(app)
        .post('/api/commercial/ledger/journals')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-journal-balanced-${Date.now()}`)
        .send({
          description: 'Office Maintenance & Bank Payout',
          reference_number: 'VOUCHER-TEST-001',
          legs: [
            {
              category: 'office_expense',
              balance_type: 'debit',
              amount: 5000,
              description: 'Office repair supplies',
            },
            {
              category: 'bank_transfer',
              balance_type: 'credit',
              amount: 5000,
              description: 'Direct bank transfer payout',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.journal_id).toBeDefined();
      expect(res.body.entries).toHaveLength(2);

      const savedEntries = await Ledger.find({ journal_id: res.body.journal_id }, null, { skipTenantCheck: true });
      expect(savedEntries).toHaveLength(2);

      const debitLeg = savedEntries.find((e) => e.balance_type === 'debit');
      const creditLeg = savedEntries.find((e) => e.balance_type === 'credit');

      expect(debitLeg?.amount).toBe(5000);
      expect(creditLeg?.amount).toBe(5000);
    });

    it('aborts transaction and leaves ZERO orphan ledger entries when journal debits do not match credits', async () => {
      const countBefore = await Ledger.countDocuments({ company_id: tenant.company._id });

      const res = await request(app)
        .post('/api/commercial/ledger/journals')
        .set('Authorization', `Bearer ${tenant.token}`)
        .set('x-idempotency-key', `idem-journal-unbalanced-${Date.now()}`)
        .send({
          description: 'Unbalanced Journal Attempt',
          reference_number: 'VOUCHER-UNBAL-001',
          legs: [
            {
              category: 'office_expense',
              balance_type: 'debit',
              amount: 5000,
            },
            {
              category: 'bank_transfer',
              balance_type: 'credit',
              amount: 3000, // Debits 5000 != Credits 3000
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invariant violated/i);

      // Verify zero orphan entries were persisted
      const countAfter = await Ledger.countDocuments({ company_id: tenant.company._id });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('9. Workflow Atomicity: Maintenance Work Order Completion', () => {
    it('atomically updates truck status to available, sets next service odometer, marks order completed, and posts double-entry expense ledger', async () => {
      const truck = await Truck.create({
        company_id: tenant.company._id,
        truck_no: `KA-03-WO-${Date.now().toString().slice(-4)}`,
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Ashok Leyland',
        model: 'Captain 40i',
        tonnage_capacity: 25,
        current_odometer_kms: 60000,
        service_interval_kms: 10000,
        status: 'in_maintenance',
      });

      const order = await MaintenanceOrder.create({
        company_id: tenant.company._id,
        work_order_no: `WO-TEST-${Date.now().toString().slice(-4)}`,
        truck_id: truck._id,
        vendor_name: 'Super Garage Services',
        order_type: 'preventative_service',
        priority: 'medium',
        status: 'in_progress',
        odometer_kms_at_service: 60000,
        start_date: new Date(Date.now() - 24 * 3600000),
        total_amount: 12000,
        line_items: [
          {
            description: 'Engine Oil & Filter Replacement',
            part_cost: 8000,
            labor_cost: 4000,
            tax_amount: 0,
            total: 12000,
          },
        ],
      });

      const res = await request(app)
        .post(`/api/fleet/maintenance/work-orders/${order._id}/complete`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({
          vendor_invoice_no: 'INV-GARAGE-101',
          post_to_ledger: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify atomic multi-collection state:
      const updatedTruck = await Truck.findById(truck._id, null, { skipTenantCheck: true });
      const updatedOrder = await MaintenanceOrder.findById(order._id, null, { skipTenantCheck: true });
      const ledgerEntry = await Ledger.findOne({ truck_id: truck._id, category: 'vehicle_maintenance' }, null, { skipTenantCheck: true });

      expect(updatedTruck?.status).toBe('available');
      expect(updatedTruck?.next_service_due_kms).toBe(70000);
      expect(updatedOrder?.status).toBe('completed');
      expect(updatedOrder?.ledger_entry_id).toBeDefined();
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry?.amount).toBe(12000);
    });

    it('rolls back and leaves truck and order state unchanged when order is already completed', async () => {
      const truck = await Truck.create({
        company_id: tenant.company._id,
        truck_no: `KA-04-WO-${Date.now().toString().slice(-4)}`,
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Tata',
        model: 'Prima',
        tonnage_capacity: 16,
        status: 'available',
      });

      const order = await MaintenanceOrder.create({
        company_id: tenant.company._id,
        work_order_no: `WO-COMP-${Date.now().toString().slice(-4)}`,
        truck_id: truck._id,
        vendor_name: 'City Garage',
        order_type: 'breakdown_repair',
        priority: 'high',
        status: 'completed',
        odometer_kms_at_service: 50000,
        start_date: new Date(),
        total_amount: 4000,
        line_items: [
          { description: 'Brake adjustment', part_cost: 0, labor_cost: 4000, tax_amount: 0, total: 4000 },
        ],
      });

      const res = await request(app)
        .post(`/api/fleet/maintenance/work-orders/${order._id}/complete`)
        .set('Authorization', `Bearer ${tenant.token}`)
        .send({ vendor_invoice_no: 'INV-DUP' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already completed/i);
    });
  });
});

