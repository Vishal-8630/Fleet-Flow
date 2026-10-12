/**
 * ============================================================================
 * FLEET FLOW — TRANSACTION HELPER (transactionHelper.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODULE?
 * --------------------
 * Provides centralized, fail-fast execution of multi-document ACID transactions
 * using Mongoose ClientSessions and session.withTransaction().
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * - Implements DEC-002 Option A: Mandatory MongoDB Replica Set across all
 *   environments (development, CI, staging, and production).
 * - Implements ISS-018: Guarantees multi-document atomicity across financial,
 *   accounting, settlement, and onboarding mutations.
 * - Prevents silent non-transactional degradation on standalone instances.
 * - Guarantees unconditional session cleanup in try/finally to prevent database
 *   connection / session leakage.
 * ============================================================================
 */

import mongoose, { ClientSession } from 'mongoose';
import { getIdempotencyContext } from '../middleware/idempotencyMiddleware.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';

/**
 * Custom error thrown when the database topology does not satisfy the
 * mandatory MongoDB Replica Set requirement (DEC-002).
 */
export class ConfigurationError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    this.statusCode = 500;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Custom error thrown when a transaction's idempotency lease was lost
 * or superseded by a newer worker during in-flight processing.
 */
export class IdempotencyFencingError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyFencingError';
    this.statusCode = 409;
    Object.setPrototypeOf(this, IdempotencyFencingError.prototype);
  }
}

export interface TransactionOptions {
  /** If true (default), strictly asserts replica set topology before opening a session */
  requireReplicaSet?: boolean;
  /** Custom read concern level (default: 'majority') */
  readConcern?: mongoose.mongo.ReadConcernLevel;
  /** Custom write concern settings (default: { w: 'majority' }) */
  writeConcern?: mongoose.mongo.WriteConcernSettings;
  /** HTTP status code persisted for crash-replay (default: 200) */
  statusCode?: number;
  /** Optional custom response transformer for idempotency response_body serialization */
  responseTransformer?: (result: any) => any;
}

let topologyOverrideForTesting: boolean | null = null;

/**
 * Testing utility to simulate standalone vs replica set topology transitions.
 * Set to null in production / regular execution.
 */
export function __setTopologyOverrideForTesting(override: boolean | null): void {
  topologyOverrideForTesting = override;
}

/**
 * Inspects the current Mongoose MongoDB client topology.
 * Returns true if connected to a replica set, sharded cluster, or load-balanced cluster.
 */
export function isReplicaSetConnection(conn: mongoose.Connection = mongoose.connection): boolean {
  if (topologyOverrideForTesting !== null) {
    return topologyOverrideForTesting;
  }

  if (conn.readyState !== 1) {
    return false;
  }

  const client: any = conn.getClient?.() || (conn as any).client;
  const description = client?.topology?.description;
  const topologyType = (description?.type || '').toLowerCase();

  if (
    topologyType.includes('replicaset') ||
    topologyType.includes('sharded') ||
    topologyType.includes('loadbalanced')
  ) {
    return true;
  }

  if (description?.setName) {
    return true;
  }

  return false;
}

/**
 * Asserts that the active MongoDB connection satisfies the Replica Set topology invariant.
 * Throws ConfigurationError if running against an un-replicated standalone instance.
 */
export function assertReplicaSetTopology(conn: mongoose.Connection = mongoose.connection): void {
  if (!isReplicaSetConnection(conn)) {
    const client: any = conn.getClient?.() || (conn as any).client;
    const topologyType = client?.topology?.description?.type || 'unknown';
    throw new ConfigurationError(
      `Database Configuration Error: Detected MongoDB topology '${topologyType}'. ` +
      `Fleet Flow requires a MongoDB Replica Set across all environments (development, CI, staging, and production) ` +
      `to execute multi-document ACID transactions (DEC-002 Option A). ` +
      `Standalone MongoDB does not support multi-document transactions. Please run via Docker Compose (rs0) or initialize a replica set.`
    );
  }
}

/**
 * Executes a function within a multi-document ACID transaction.
 * 
 * Guaranteed Invariants:
 * 1. Checks replica-set topology fail-fast before opening session if requireReplicaSet is true.
 * 2. Uses session.withTransaction() with readConcern majority and writeConcern majority.
 * 3. Automatically retries transient transaction errors and commit errors.
 * 4. Unconditionally closes the ClientSession in a finally block.
 * 5. Atomically coordinates with active idempotency context: if running under an
 *    idempotency lease, transitions IdempotencyKey to 'COMMITTED' inside the same transaction.
 * 6. Enforces strict lease ownership: if the idempotency record does not match the active
 *    lock token, matchedCount is 0, aborting the transaction and rolling back all writes.
 * 
 * IMPORTANT: Every database operation inside `work` MUST receive `{ session }`.
 */
export async function runInTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  options: TransactionOptions = { requireReplicaSet: true }
): Promise<T> {
  const requireReplicaSet = options.requireReplicaSet !== false;
  if (requireReplicaSet) {
    assertReplicaSetTopology();
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(
      async () => {
        result = await work(session);

        // Transactional Idempotency Coordination (ISS-019 Crash-Safety):
        // If this transaction executes within an active idempotency lease,
        // atomically record the commit state in IdempotencyKey in the SAME transaction session.
        const idemCtx = getIdempotencyContext();
        if (idemCtx) {
          let serializedResult: any = undefined;
          const payloadToSerialize = options.responseTransformer
            ? options.responseTransformer(result)
            : result;

          if (payloadToSerialize !== undefined) {
            try {
              if (typeof (payloadToSerialize as any)?.toJSON === 'function') {
                serializedResult = (payloadToSerialize as any).toJSON();
              } else {
                serializedResult = JSON.parse(JSON.stringify(payloadToSerialize));
              }
            } catch (_) {
              serializedResult = { committed: true };
            }
          }

          const updateRes = await IdempotencyKey.collection.updateOne(
            {
              company_id: idemCtx.companyId,
              key: idemCtx.key,
              lock_token: idemCtx.lockToken,
              status: 'PENDING',
            },
            {
              $set: {
                status: 'COMMITTED',
                status_code: options.statusCode || 200,
                response_body: serializedResult,
                updated_at: new Date(),
              },
            },
            { session }
          );

          if (updateRes.matchedCount === 0) {
            throw new IdempotencyFencingError(
              `[Idempotency Fencing Error]: Transaction commit aborted for key '${idemCtx.key}'. ` +
              `Lock ownership was lost or superseded by a concurrent worker. ` +
              `All participating business writes rolled back.`
            );
          }
        }
      },
      {
        readConcern: { level: options.readConcern || 'majority' },
        writeConcern: { w: options.writeConcern?.w || 'majority' },
      }
    );
    return result!;
  } finally {
    await session.endSession();
  }
}
