import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { IdempotencyKey } from '../../models/IdempotencyKey.js';
import { Invoice } from '../../models/Invoice.js';
import { Ledger } from '../../models/Ledger.js';
import { BillingParty } from '../../models/BillingParty.js';
import { Driver } from '../../models/Driver.js';
import { Truck } from '../../models/Truck.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Settlement } from '../../models/Settlement.js';
import { LOCK_LEASE_MS, idempotencyStorage, computePayloadHash } from '../../middleware/idempotencyMiddleware.js';
import { runInTransaction, IdempotencyFencingError } from '../../utils/transactionHelper.js';

describe('Phase 2.3: Distributed Concurrency & Idempotency (ISS-019)', () => {
  let tenantA: any;
  let tenantB: any;

  beforeAll(async () => {
    await IdempotencyKey.syncIndexes();
  });

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Express', role: 'admin' });
    tenantB = await createTestTenant({ name: 'Beta Logistics', role: 'admin' });
  });

  describe('1. Strict Mode Header Requirement', () => {
    it('rejects financial mutation when x-idempotency-key is omitted with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          original_invoice_id: '507f1f77bcf86cd799439011',
          type: 'credit_note',
          reason: 'commercial_discount',
          adjustment_amount_paise: 100000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/x-idempotency-key header is required/i);
    });

    it('rejects financial settlement confirmation when x-idempotency-key is missing with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/commercial/settlements/confirm')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          driver_id: '507f1f77bcf86cd799439011',
          journey_ids: ['507f1f77bcf86cd799439012'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/x-idempotency-key header is required/i);
    });
  });

  describe('2. In-Flight Atomic Locking & Concurrency Conflict (HTTP 409)', () => {
    it('returns HTTP 409 Conflict when a request with the same key is currently PENDING within lease', async () => {
      const idempotencyKey = 'test-concurrent-lock-key-1';

      // Manually simulate in-flight reservation (e.g. slow background mutation)
      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/credit-notes',
        method: 'POST',
        request_hash: 'dummy-hash',
        status: 'PENDING',
        locked_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          original_invoice_id: '507f1f77bcf86cd799439011',
          type: 'credit_note',
          reason: 'commercial_discount',
          adjustment_amount_paise: 100000,
        });

      // Since payload hash doesn't match dummy-hash, it could return 422, OR if hash matches, 409.
      // Let's compute actual hash or verify conflict response:
      expect([409, 422]).toContain(res.status);
    });

    it('returns strict HTTP 409 Conflict when payload matches and lock is PENDING', async () => {
      const idempotencyKey = 'test-concurrent-pending-matching-hash';
      const payload = {
        original_invoice_id: '507f1f77bcf86cd799439011',
        type: 'credit_note',
        reason: 'commercial_discount',
        adjustment_amount_paise: 100000,
      };

      // Compute exact hash matching the endpoint & payload
      const crypto = await import('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(`POST:/api/commercial/credit-notes:${JSON.stringify(payload)}`)
        .digest('hex');

      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/credit-notes',
        method: 'POST',
        request_hash: hash,
        status: 'PENDING',
        locked_at: new Date(), // Active fresh lease
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Request currently in progress/i);
    });
  });

  describe('3. Payload Hash Validation & Tampering Defense (HTTP 422)', () => {
    it('rejects reusing an idempotency key with a modified payload with HTTP 422', async () => {
      const idempotencyKey = 'test-tamper-key-1';

      // Initial request with Payload 1
      const res1 = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          original_invoice_id: '507f1f77bcf86cd799439011',
          type: 'credit_note',
          reason: 'commercial_discount',
          adjustment_amount_paise: 100000,
        });

      // Second request reusing the same key but different amount (500000)
      const res2 = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send({
          original_invoice_id: '507f1f77bcf86cd799439011',
          type: 'credit_note',
          reason: 'commercial_discount',
          adjustment_amount_paise: 500000, // Altered payload!
        });

      expect(res2.status).toBe(422);
      expect(res2.body.error).toMatch(/Idempotency key payload mismatch/i);
    });
  });

  describe('4. Response Replay on Resolved Keys', () => {
    it('replays cached response with X-Cache: IDEMPOTENT_HIT on subsequent matching requests', async () => {
      const idempotencyKey = 'test-replay-key-1';
      const payload = {
        original_invoice_id: '507f1f77bcf86cd799439011',
        type: 'credit_note',
        reason: 'commercial_discount',
        adjustment_amount_paise: 100000,
      };

      const crypto = await import('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(`POST:/api/commercial/credit-notes:${JSON.stringify(payload)}`)
        .digest('hex');

      // Pre-seed a RESOLVED idempotency record
      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/credit-notes',
        method: 'POST',
        request_hash: hash,
        status: 'RESOLVED',
        status_code: 201,
        response_body: { success: true, credit_note_number: 'CN-2026-0001' },
        locked_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.headers['x-cache']).toBe('IDEMPOTENT_HIT');
      expect(res.body.credit_note_number).toBe('CN-2026-0001');
    });
  });

  describe('5. Crash Recovery & Stale Lease Handling', () => {
    it('allows atomic recovery when a PENDING lock is stale (exceeds LOCK_LEASE_MS)', async () => {
      const idempotencyKey = 'test-stale-recovery-key-1';
      const payload = {
        original_invoice_id: '507f1f77bcf86cd799439011',
        type: 'credit_note',
        reason: 'commercial_discount',
        adjustment_amount_paise: 100000,
      };

      const crypto = await import('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(`POST:/api/commercial/credit-notes:${JSON.stringify(payload)}`)
        .digest('hex');

      // Seed a stale PENDING lock from a simulated crashed worker (locked 2 minutes ago)
      const staleTime = new Date(Date.now() - (LOCK_LEASE_MS + 30000));
      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/credit-notes',
        method: 'POST',
        request_hash: hash,
        status: 'PENDING',
        locked_at: staleTime,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // A retry arrives with the exact same key & payload
      const res = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      // It should NOT be rejected with 409 because the lease is stale; it re-acquires the lock
      // and proceeds to handler (which returns 404 since fake original_invoice_id doesn't exist)
      expect(res.status).not.toBe(409);
      expect(res.status).toBe(404); // Invoice not found from controller
    });
  });

  describe('6. Tenant Isolation Boundaries', () => {
    it('ensures Tenant A and Tenant B can independently use identical idempotency keys without conflict', async () => {
      const sharedKey = 'shared-idempotency-key-uuid-1234';
      const payload = {
        original_invoice_id: '507f1f77bcf86cd799439011',
        type: 'credit_note',
        reason: 'commercial_discount',
        adjustment_amount_paise: 100000,
      };

      // Tenant A submits request with sharedKey
      const resA = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', sharedKey)
        .send(payload);

      expect(resA.status).not.toBe(409);

      // Tenant B submits request with the exact same sharedKey
      const resB = await request(app)
        .post('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantB.token}`)
        .set('x-idempotency-key', sharedKey)
        .send(payload);

      // Must NOT be blocked by Tenant A's record or treated as a collision
      expect(resB.status).not.toBe(409);
      expect(resB.headers['x-cache']).toBeUndefined(); // Fresh request for Tenant B, NOT Tenant A's cached replay!
    });
  });

  describe('7. Fencing Tokens & Lost Ownership Overwrite Prevention', () => {
    it('prevents an expired worker from overwriting a newer worker when lease was reclaimed', async () => {
      const idempotencyKey = 'test-fencing-lost-ownership-key';
      const initialWorkerToken = 'worker-1-fencing-token-uuid';
      const newerWorkerToken = 'worker-2-fencing-token-uuid';

      // 1. Worker 1 acquires lock
      const staleTime = new Date(Date.now() - (LOCK_LEASE_MS + 10000));
      const record = await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/credit-notes',
        method: 'POST',
        request_hash: 'initial-hash',
        status: 'PENDING',
        locked_at: staleTime,
        lock_token: initialWorkerToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // 2. Worker 2 detects stale lease and reclaims it via CAS
      const reclaimed: any = await IdempotencyKey.findOneAndUpdate(
        {
          _id: record._id,
          status: 'PENDING',
          locked_at: record.locked_at,
        },
        {
          $set: {
            locked_at: new Date(),
            lock_token: newerWorkerToken,
            request_hash: 'worker-2-hash',
            updated_at: new Date(),
          },
        },
        { new: true, skipTenantCheck: true } as any
      );
      expect(reclaimed?.lock_token).toBe(newerWorkerToken);

      // 3. Worker 1 (which had paused or delayed) attempts to heartbeat with old lock_token
      const heartbeatResult = await IdempotencyKey.collection.updateOne(
        { company_id: tenantA.company._id, key: idempotencyKey, status: 'PENDING', lock_token: initialWorkerToken },
        { $set: { locked_at: new Date() } }
      );
      expect(heartbeatResult.matchedCount).toBe(0); // Fenced out!

      // 4. Worker 1 finishes and attempts to finalize with old lock_token
      const finalizeResult = await IdempotencyKey.updateOne(
        { company_id: tenantA.company._id, key: idempotencyKey, lock_token: initialWorkerToken },
        {
          $set: {
            status: 'RESOLVED',
            status_code: 200,
            response_body: { stale: 'Worker 1 stale payload' },
          },
        },
        { skipTenantCheck: true } as any
      );
      expect(finalizeResult.matchedCount).toBe(0); // Fenced out!

      // 5. Assert the active record in MongoDB was NOT overwritten and still belongs to Worker 2
      const currentDoc = await IdempotencyKey.findById(record._id, null, { skipTenantCheck: true });
      expect(currentDoc?.status).toBe('PENDING');
      expect(currentDoc?.lock_token).toBe(newerWorkerToken);
      expect(currentDoc?.request_hash).toBe('worker-2-hash');
    });
  });

  describe('8. Crash-Safe Financial Idempotency & Post-Commit Failure Window', () => {
    it('proves that a crash after financial transaction commit but before resolution NEVER executes duplicate payment on retry', async () => {
      // 1. Create a customer and invoice for 10,000 INR
      const party = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Crash-Test Customer Ltd',
        gstin: '29ABCDE1234F1Z5',
        phone: '+919876543210',
        address: 'Whitefield, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const invoice = await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: `INV-CRASH-${Date.now()}`,
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

      const idempotencyKey = `idem-crash-inv-${Date.now()}`;
      const paymentPayload = {
        amount: 5000,
        payment_mode: 'bank_transfer',
        reference_number: 'UTR-CRASH-TEST-001',
      };

      // 2. Client submits Payment Request 1
      const res1 = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(paymentPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.invoice.paid_amount).toBe(5000);
      expect(res1.body.invoice.balance_amount).toBe(5000);

      // Verify initial financial state: exactly 5000 paid, 1 receipt journal
      const invoiceAfterReq1 = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      const ledgersAfterReq1 = await Ledger.find({ invoice_id: invoice._id }, null, { skipTenantCheck: true });
      expect(invoiceAfterReq1?.paid_amount).toBe(5000);
      expect(ledgersAfterReq1.length).toBeGreaterThanOrEqual(1);
      const initialLedgerCount = ledgersAfterReq1.length;

      // 3. SIMULATE THE EXACT FAILURE WINDOW:
      // Process crashed immediately after runInTransaction committed, so the record in MongoDB
      // had transitioned to 'COMMITTED' with the transaction, but before any secondary post-processing.
      // Furthermore, simulate that 125 seconds elapsed (exceeding LOCK_LEASE_MS = 120s).
      const staleTime = new Date(Date.now() - (LOCK_LEASE_MS + 5000));
      await IdempotencyKey.collection.updateOne(
        { company_id: tenantA.company._id, key: idempotencyKey },
        {
          $set: {
            status: 'COMMITTED',
            locked_at: staleTime,
          },
        }
      );

      // Verify the simulated crash state in the database
      const crashDoc = await IdempotencyKey.findOne({ company_id: tenantA.company._id, key: idempotencyKey }, null, { skipTenantCheck: true });
      expect(crashDoc?.status).toBe('COMMITTED');

      // 4. Client retries with the EXACT SAME idempotency key after lease expiration
      const res2 = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(paymentPayload);

      // The retry must replay the committed result with X-Cache: IDEMPOTENT_HIT
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('IDEMPOTENT_HIT');
      expect(res2.body.message).toBe('Payment recorded and posted to General Ledger.');
      expect(res2.body.invoice).toBeDefined();
      expect(res2.body.invoice.paid_amount).toBe(5000);
      expect(res2.body.invoice.balance_amount).toBe(5000);

      // 5. CRITICAL VERIFICATION:
      // The financial mutation must NOT have executed a second time!
      const invoiceAfterRetry = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      const ledgersAfterRetry = await Ledger.find({ invoice_id: invoice._id }, null, { skipTenantCheck: true });

      // If duplicate execution occurred, paid_amount would be 10000 and balance would be 0
      expect(invoiceAfterRetry?.paid_amount).toBe(5000); // INVARIANT: MUST STILL BE 5000!
      expect(invoiceAfterRetry?.balance_amount).toBe(5000); // INVARIANT: MUST STILL BE 5000!
      expect(ledgersAfterRetry.length).toBe(initialLedgerCount); // INVARIANT: ZERO duplicate ledger entries!
    });

    it('allows clean retry after lease expiration if previous attempt crashed BEFORE transaction committed', async () => {
      // Simulate crash BEFORE commit: record remains PENDING with stale lease
      const party = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Pre-Commit Crash Customer',
        gstin: '29ABCDE1234F1Z6',
        phone: '+919876543211',
        address: 'Electronic City, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const invoice = await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: `INV-PRECRASH-${Date.now()}`,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        place_of_supply: '29-Karnataka',
        billing_party_id: party._id,
        billing_party_snapshot: { name: party.name, gstin: party.gstin },
        total_amount: 8000,
        paid_amount: 0,
        balance_amount: 8000,
        status: 'issued',
      });

      const idempotencyKey = `idem-precommit-crash-${Date.now()}`;
      const payload = {
        amount: 3000,
        payment_mode: 'bank_transfer',
        reference_number: 'UTR-PRECRASH-001',
      };

      // Seed a stale PENDING lock from an abandoned/crashed worker where commit never took place
      const staleTime = new Date(Date.now() - (LOCK_LEASE_MS + 10000));
      const crypto = await import('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(`POST:/api/commercial/invoices/${invoice._id}/payments:${JSON.stringify(payload)}`)
        .digest('hex');

      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: `/api/commercial/invoices/${invoice._id}/payments`,
        method: 'POST',
        request_hash: hash,
        status: 'PENDING',
        locked_at: staleTime,
        lock_token: 'dead-worker-token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Retry arrives: should re-acquire the expired PENDING lease and execute successfully
      const res = await request(app)
        .post(`/api/commercial/invoices/${invoice._id}/payments`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.invoice.paid_amount).toBe(3000);

      const updatedInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(updatedInvoice?.paid_amount).toBe(3000);
    });

    it('aborts transaction and rolls back financial writes if idempotency commitment matches zero documents (stale lock token)', async () => {
      // 1. Create invoice with 10000 balance
      const party = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Fencing Rollback Customer',
        gstin: '29ABCDE1234F1Z7',
        phone: '+919876543212',
        address: 'Koramangala, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const invoice = await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: `INV-FENCE-${Date.now()}`,
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

      const idempotencyKey = `idem-stale-fence-${Date.now()}`;
      const staleWorkerToken = 'stale-worker-token-001';
      const newerWorkerToken = 'newer-worker-token-002';

      // Seed idempotency record already owned by newer worker (lock_token has changed)
      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: `/api/commercial/invoices/${invoice._id}/payments`,
        method: 'POST',
        request_hash: 'dummy-hash',
        status: 'PENDING',
        locked_at: new Date(),
        lock_token: newerWorkerToken, // Newer worker owns it!
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // 2. Simulate Worker 1 executing runInTransaction with staleWorkerToken
      let transactionAttemptError: any = null;
      await idempotencyStorage.run(
        {
          key: idempotencyKey,
          companyId: tenantA.company._id,
          lockToken: staleWorkerToken, // Stale token that will match 0 documents!
        },
        async () => {
          try {
            await runInTransaction(async (session) => {
              // Mutation write 1: Update invoice
              await Invoice.updateOne(
                { _id: invoice._id, company_id: tenantA.company._id },
                { $inc: { paid_amount: 5000, balance_amount: -5000 } },
                { session }
              );

              // Mutation write 2: Create ledger entry
              await Ledger.create(
                [
                  {
                    company_id: tenantA.company._id,
                    transaction_number: `TXN-FENCE-${Date.now()}`,
                    category: 'payment_received',
                    transaction_type: 'invoice_payment',
                    balance_type: 'credit',
                    payment_mode: 'bank',
                    description: 'Test fencing entry',
                    amount: 5000,
                    invoice_id: invoice._id,
                  },
                ],
                { session }
              );

              return { success: true };
            });
          } catch (err: any) {
            transactionAttemptError = err;
          }
        }
      );

      // Verify that IdempotencyFencingError was thrown
      expect(transactionAttemptError).not.toBeNull();
      expect(transactionAttemptError).toBeInstanceOf(IdempotencyFencingError);
      expect(transactionAttemptError.statusCode).toBe(409);

      // CRITICAL VERIFICATION OF BUSINESS DATA ATOMICITY:
      // Worker 1's financial writes must have been completely ROLLED BACK by MongoDB!
      const invoiceAfterAbortedTx = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      const ledgersAfterAbortedTx = await Ledger.find({ invoice_id: invoice._id }, null, { skipTenantCheck: true });

      expect(invoiceAfterAbortedTx?.paid_amount).toBe(0); // ROLLED BACK: Must be 0, not 5000!
      expect(invoiceAfterAbortedTx?.balance_amount).toBe(10000); // ROLLED BACK: Must be 10000!
      expect(ledgersAfterAbortedTx.length).toBe(0); // ROLLED BACK: Zero ledger entries persisted!
    });

    it('guarantees single execution when lease is reclaimed during an in-flight worker pause', async () => {
      // 1. Create an invoice for 10000
      const party = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Concurrent Pause Customer',
        gstin: '29ABCDE1234F1Z8',
        phone: '+919876543213',
        address: 'Indiranagar, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const invoice = await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: `INV-PAUSE-${Date.now()}`,
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

      const idempotencyKey = `idem-concurrent-pause-${Date.now()}`;
      const worker1Token = 'worker-1-token-pause';
      const worker2Token = 'worker-2-token-pause';

      // 2. Worker 1 obtains reservation
      const initialRecord = await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: `/api/commercial/invoices/${invoice._id}/payments`,
        method: 'POST',
        request_hash: 'dummy-hash',
        status: 'PENDING',
        locked_at: new Date(Date.now() - (LOCK_LEASE_MS + 5000)), // Leased 125s ago
        lock_token: worker1Token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // 3. Worker 2 reclaims the expired lease via CAS
      const reclaimed = await IdempotencyKey.findOneAndUpdate(
        {
          _id: initialRecord._id,
          company_id: tenantA.company._id,
          status: 'PENDING',
          locked_at: initialRecord.locked_at,
        },
        {
          $set: {
            locked_at: new Date(),
            lock_token: worker2Token,
            updated_at: new Date(),
          },
        },
        { new: true, skipTenantCheck: true } as any
      );
      expect((reclaimed as any)?.lock_token).toBe(worker2Token);

      // 4. Worker 1 wakes up and attempts to commit its transaction with worker1Token
      let worker1Error: any = null;
      await idempotencyStorage.run(
        {
          key: idempotencyKey,
          companyId: tenantA.company._id,
          lockToken: worker1Token,
        },
        async () => {
          try {
            await runInTransaction(async (session) => {
              await Invoice.updateOne(
                { _id: invoice._id, company_id: tenantA.company._id },
                { $inc: { paid_amount: 5000, balance_amount: -5000 } },
                { session }
              );
              return { success: true };
            });
          } catch (err) {
            worker1Error = err;
          }
        }
      );

      // Worker 1 must be rejected with IdempotencyFencingError
      expect(worker1Error).toBeInstanceOf(IdempotencyFencingError);

      // 5. Worker 2 executes and commits its transaction with worker2Token
      await idempotencyStorage.run(
        {
          key: idempotencyKey,
          companyId: tenantA.company._id,
          lockToken: worker2Token,
        },
        async () => {
          await runInTransaction(async (session) => {
            await Invoice.updateOne(
              { _id: invoice._id, company_id: tenantA.company._id },
              { $inc: { paid_amount: 5000, balance_amount: -5000 } },
              { session }
            );
            return { success: true };
          });
        }
      );

      // 6. Assert in MongoDB: EXACTLY ONE 5000 payment was applied, NOT TWO!
      const finalInvoice = await Invoice.findById(invoice._id, null, { skipTenantCheck: true });
      expect(finalInvoice?.paid_amount).toBe(5000); // Only Worker 2 committed!
      expect(finalInvoice?.balance_amount).toBe(5000);

      const finalKeyDoc = await IdempotencyKey.findById(initialRecord._id, null, { skipTenantCheck: true });
      expect(finalKeyDoc?.status).toBe('COMMITTED');
      expect(finalKeyDoc?.lock_token).toBe(worker2Token);
    });

    it('replays exact response body and 201 status code after simulated post-commit crash where client never received initial response', async () => {
      // 1. Create Driver and Truck Journey
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: `KA-01-CR-${Date.now().toString().slice(-4)}`,
        truck_type: 'Market',
        ownership_type: 'Market',
        body_type: 'Open',
        make: 'Tata',
        model: 'Prima',
        tonnage_capacity: 16,
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Post-Commit Crash Driver',
        phone: '+919900119988',
        license_number: 'DL-POSTCRASH-001',
        running_advance_balance: 0,
      });

      const journey = await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: `JRN-CRASH-${Date.now()}`,
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Bengaluru', state: 'Karnataka' },
        to_location: { city: 'Chennai', state: 'Tamil Nadu' },
        start_date: new Date(),
        actual_end_date: new Date(),
        start_odometer_kms: 1000,
        end_odometer_kms: 1500,
        starting_cash_advance: 1000,
        total_driver_expenses: 500,
        status: 'completed',
        is_settled: false,
      });

      const idempotencyKey = `idem-postcommit-crash-${Date.now()}`;
      const payload = {
        driver_id: driver._id.toString(),
        journey_ids: [journey._id.toString()],
        rate_per_km: 10,
        benchmark_mileage: 4.5,
        diesel_price_per_litre: 90,
      };

      // 2. Simulate Worker 1 starting execution:
      // Worker 1 reserves the key in PENDING state
      const initialLockToken = 'worker-crash-lock-001';
      const hash = computePayloadHash({
        method: 'POST',
        originalUrl: '/api/commercial/settlements/confirm',
        body: payload,
      } as any);

      await IdempotencyKey.create({
        company_id: tenantA.company._id,
        key: idempotencyKey,
        endpoint: '/api/commercial/settlements/confirm',
        method: 'POST',
        request_hash: hash,
        status: 'PENDING',
        locked_at: new Date(),
        lock_token: initialLockToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // 3. Worker 1 runs runInTransaction with statusCode: 201 and responseTransformer
      let settlementId: any = null;
      await idempotencyStorage.run(
        {
          key: idempotencyKey,
          companyId: tenantA.company._id,
          lockToken: initialLockToken,
        },
        async () => {
          await runInTransaction(
            async (session) => {
              const newSettlement = new Settlement({
                company_id: tenantA.company._id,
                settlement_number: `SET-CRASH-${Date.now()}`,
                settlement_date: new Date(),
                driver_id: driver._id,
                driver_snapshot: { name: driver.name, phone: driver.phone, license_number: driver.license_number },
                journey_ids: [journey._id],
                total_kms: 500,
                rate_per_km: 10,
                base_earnings: 5000,
                gross_earnings: 5000,
                total_deductions: 1000,
                net_amount: 4000,
                settlement_type: 'payable_to_driver',
                status: 'confirmed',
                payment_status: 'unpaid',
              });
              await newSettlement.save({ session });
              settlementId = newSettlement._id;

              await TruckJourney.updateOne(
                { _id: journey._id, company_id: tenantA.company._id },
                { $set: { is_settled: true, settlement_id: newSettlement._id } },
                { session }
              );

              return {
                message: 'Driver trip settlement confirmed and locked.',
                settlement: newSettlement,
                driver,
                isReplay: false,
              };
            },
            {
              statusCode: 201,
              responseTransformer: (r) => ({
                message: r.message,
                settlement: r.settlement,
              }),
            }
          );
        }
      );

      // SIMULATE CRASH:
      // The transaction committed! IdempotencyKey is in COMMITTED status with statusCode: 201,
      // but Worker 1 process immediately crashed / died before res.status(201).json() was sent.
      // So the client never received a response and timed out.

      const committedDoc = await IdempotencyKey.findOne({ company_id: tenantA.company._id, key: idempotencyKey }, null, { skipTenantCheck: true });
      expect(committedDoc?.status).toBe('COMMITTED');
      expect(committedDoc?.status_code).toBe(201);
      expect(committedDoc?.response_body.message).toBe('Driver trip settlement confirmed and locked.');
      expect(committedDoc?.response_body.settlement._id.toString()).toBe(settlementId.toString());

      // 4. Client retries with the exact same idempotency key
      const retryRes = await request(app)
        .post('/api/commercial/settlements/confirm')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      // Must replay the COMMITTED response with HTTP 201, X-Cache: IDEMPOTENT_HIT, and exact body
      expect(retryRes.status).toBe(201);
      expect(retryRes.headers['x-cache']).toBe('IDEMPOTENT_HIT');
      expect(retryRes.body.message).toBe('Driver trip settlement confirmed and locked.');
      expect(retryRes.body.settlement._id.toString()).toBe(settlementId.toString());

      // 5. Assert business state in MongoDB:
      // Settlement count must be exactly 1, journey must be linked to that settlement
      const settlementsInDb = await Settlement.find({ company_id: tenantA.company._id, driver_id: driver._id }, null, { skipTenantCheck: true });
      expect(settlementsInDb.length).toBe(1);
      const updatedJourney = await TruckJourney.findById(journey._id, null, { skipTenantCheck: true });
      expect(updatedJourney?.is_settled).toBe(true);
      expect(updatedJourney?.settlement_id?.toString()).toBe(settlementId.toString());
    });
  });
});
