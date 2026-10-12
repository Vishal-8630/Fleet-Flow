# ISS-018: Multi-Document ACID Transactions Crash Standalone MongoDB Instances

**Specification ID:** `ISS-018`  
**Title:** Multi-Document ACID Transactions Crash Standalone MongoDB Instances Without Replica Set  
**Type:** Architecture / Database Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)  
**Requires Decision:** Yes ([`DEC-002`](../decisions/DEC-002-mongodb-transactions-standalone-strategy.md))

---

## 1. Executive Summary
Critical operational flows—including subscription activation in [`billingController.ts:135`](../../backend/src/controllers/billingController.ts#L135) and vehicle dispatch entry creation in [`entryController.ts:110`](../../backend/src/controllers/entryController.ts#L110)—utilize Mongoose transactions (`mongoose.startSession()`, `session.startTransaction()`). MongoDB multi-document transactions strictly require a **Replica Set** deployment. When Fleet Flow is deployed on a standalone single-node MongoDB instance (common in local development, CI test runners, and single VPS deployments), these operations throw `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`, crashing the request with an unhandled 500 error.

---

## 2. Current Behavior & Root Cause
- **Confirmed Code Pattern:** In `billingController.ts` and `entryController.ts`:
  ```typescript
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // ... atomic updates
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  ```
- **Technical Barrier:** Standalone MongoDB instances do not maintain an `oplog` and therefore cannot support multi-document transactions.
- **Consequence:** Without an active replica set, users cannot purchase subscriptions or create gate entries.

---

## 3. Reproduction Steps
1. Start a local MongoDB instance in standalone mode (`mongod --dbpath ...`).
2. Run the Fleet Flow backend.
3. Attempt to record a vehicle entry or activate a subscription.
4. Observe: The request crashes with HTTP 500: `Transaction numbers are only allowed on a replica set member or mongos`.

---

## 4. Supported Deployment Topologies & Expected Behavior
1. **Financial & Commercial Invariant**: Workflows that modify billing status, subscription balances, vehicle entries, invoices, credit notes, and double-entry general ledgers strictly require multi-document atomicity. **Silent non-transactional execution fallbacks for financial workflows are strictly prohibited**, as partial commits permanently corrupt tenant accounting.
2. **Supported MongoDB Deployment Topologies**:
   - **Local Development**: Mandatory single-node Replica Set (`rs0`). Initialized via Docker Compose (`mongo:6.0` running `mongosh --eval "rs.initiate()"`) or local standalone `mongod --replSet rs0 --bind_ip localhost`.
   - **Automated Testing / CI**: `MongoMemoryReplSet` (via `mongodb-memory-server`) or containerized replica set in CI pipelines.
   - **Staging / Pre-Production**: 3-node MongoDB Replica Set cluster (Primary-Secondary-Secondary) or managed MongoDB Atlas cluster.
   - **Production**: High-availability multi-node Replica Set (3-node minimum) with write concern `majority`, `readConcern: majority`, and continuous point-in-time oplog backups (`OPS-003`).
3. **Startup & Execution Guarantees**:
   - Backend boots with topology inspection verifying replica set availability.
   - If an un-replicated standalone MongoDB instance is detected when executing atomic financial mutations, `runInTransaction` will fail-fast with a descriptive HTTP 500 / `ConfigurationError` instructing the developer/administrator to run `rs.initiate()`.
   - If a genuinely non-transactional secondary workflow is required (e.g. non-financial telemetry, audit trails), it must not use `runInTransaction`; instead, it must explicitly document its eventual consistency guarantees, compensating cancellation/cleanup logic, and idempotency keying.

---

## 5. Proposed Technical Solution
Implement a resilient transaction helper in `backend/src/utils/transactionHelper.ts`:
```typescript
import mongoose, { ClientSession } from 'mongoose';
import { ApiError } from './ApiError';
import { logger } from './logger';

export interface TransactionOptions {
  /** If true, strictly aborts if connection is not a replica set (required for financial flows) */
  requireReplicaSet?: boolean;
}

export async function runInTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  options: TransactionOptions = { requireReplicaSet: true }
): Promise<T> {
  const isReplicaSet = !!mongoose.connection.db?.serverConfig?.isReplicaSet?.() ||
                       (mongoose.connection as any).client?.topology?.description?.type?.includes('ReplicaSet');

  if (!isReplicaSet) {
    if (options.requireReplicaSet) {
      logger.error('CRITICAL: Attempted atomic financial transaction on standalone MongoDB without replica set.');
      throw new ApiError(
        500,
        'Database Configuration Error: Multi-document ACID transactions require a MongoDB Replica Set. ' +
        'Please initialize a replica set (e.g., run rs.initiate() or use docker-compose) for financial operations.'
      );
    }
    throw new ApiError(500, 'Non-transactional execution path not configured.');
  }

  const session = await mongoose.startSession();
  session.startTransaction({
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  });

  try {
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
```

---

## 6. Acceptance Criteria
- [ ] Financial controllers (`billingController`, `entryController`, `ledgerController`, `settlementController`) wrap all multi-document operations with `runInTransaction(..., { requireReplicaSet: true })`.
- [ ] Attempting financial operations on a non-replica set instance immediately throws a clear `ConfigurationError` and does NOT perform partial, corrupting sequential writes.
- [ ] `docker-compose.yml` and `docker-compose.dev.yml` configure MongoDB with `--replSet rs0` and run an automated healthcheck initialization script executing `rs.initiate()`.
- [ ] Vitest integration test suite (`TEST-001`, `TEST-003`) runs against `MongoMemoryReplSet` with full ACID atomicity.
- [ ] Production and staging deployment manifests (`OPS-001`) assert MongoDB replica set connectivity during container startup probes (`OPS-005`).

---

## 7. Definition of Done
1. `runInTransaction` implemented with strict fail-fast assertion against silent non-transactional fallbacks for financial mutations.
2. Docker Compose dev topology updated with replica set initialization script (`rs0`).
3. Alignment confirmed with [`DEC-002`](../decisions/DEC-002-mongodb-transactions-standalone-strategy.md) and [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md).
