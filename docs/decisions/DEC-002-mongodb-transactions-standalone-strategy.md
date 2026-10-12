# DEC-002: Standalone MongoDB Fallback vs Mandatory Replica Set in Production

**Decision ID:** `DEC-002`  
**Title:** Standalone MongoDB Fallback vs Mandatory Replica Set in Production  
**Category:** Database Architecture & Reliability Engineering  
**Status:** Pending Lead Architect & DevOps Approval  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#7-product--architectural-decisions-register-dec-)  
**Directly Resolves Issue:** [`ISS-018`](../issues/ISS-018-acid-transactions-standalone-mongo.md)

---

## 1. Context & Operational Conflict
Mongoose multi-document transactions (`startSession()`, `startTransaction()`) are utilized during subscription activation and gate entry creation. Standalone MongoDB instances do not support multi-document transactions and crash with `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`.

---

## 2. Decision Options
 
### Option A: Enforce Mandatory Replica Set Topology Across All Environments (Recommended Architecture)
- Require MongoDB Replica Set for all environments:
  - **Local Development**: Single-node replica set (`rs0`) pre-configured in `docker-compose.yml` (`mongod --replSet rs0 --bind_ip_all` + automated `rs.initiate()` healthcheck). For developers without Docker, provide one-line startup script (`mongod --replSet rs0` + `rs.initiate()`).
  - **Automated Testing / CI**: `MongoMemoryReplSet` in Vitest/Supertest suites (`TEST-001`, `TEST-003`) and containerized replica sets in CI runners.
  - **Staging**: 3-node replica set cluster or MongoDB Atlas dedicated tier.
  - **Production**: High-availability multi-node replica set (minimum 3 nodes: Primary-Secondary-Secondary) or managed MongoDB Atlas cluster with `majority` write concern.
- Prohibit silent non-transactional execution for financial mutations (billing, gate entries, invoices, credit notes, ledger journals).
- **Pros:** 100% ACID consistency across financial operations; zero risk of corrupt ledger states, orphan entries, or phantom balances; eliminates divergence between development and production behavior.
- **Cons:** Developers running raw `mongod` without Docker must run `rs.initiate()` once during initial machine setup.

### Option B: Silent Fallback to Non-Transactional Sequential Execution (REJECTED)
- Detect standalone MongoDB at runtime and silently omit sessions/transactions.
- **Why Rejected**: Causes split-brain and partial document writes. For instance, if an error or crash occurs halfway through a billing subscription activation or vehicle entry creation, funds are marked deducted while entries are missing, permanently violating double-entry invariants (`TEST-003`).

### Option C: Compensating Saga Logic for Non-Transactional Workflows (Allowed only for Non-Financial Secondary Workflows)
- If a secondary, non-financial workflow cannot run in a transaction (e.g. distributed event fanout, external telematics ingestion), it must implement an explicit two-phase compensating transaction / saga pattern with idempotency tokens and automated recovery tests. It must not run silently without compensation guarantees.

---

## 3. Recommended Architectural Decision
**Adopt Option A (Mandatory Replica Set Topology Across All Environments):**
1. **Zero Silent Fallback**: In `backend/src/utils/transactionHelper.ts`, `runInTransaction(..., { requireReplicaSet: true })` asserts replica set membership. If absent, it throws a fast, descriptive `ConfigurationError` directing the developer or operator to initialize `rs0`.
2. **Containerized Dev & CI**: `docker-compose.yml` and `docker-compose.dev.yml` configure MongoDB container as a single-node replica set (`mongod --replSet rs0`) with an automatic initialization probe.
3. **Production Validation**: Production startup readiness probes (`OPS-005`) assert multi-node replica set topology before opening ingress traffic.
4. **Compensation Specification**: Any future non-transactional asynchronous workflow must define its consistency model, compensation rollbacks, and automated recovery tests separately.

---

## 4. Sign-Off & Next Steps
- [ ] DevOps & Lead Architect approve Docker single-node replica set topology and production cluster requirements.
- [ ] `transactionHelper.ts` implemented with fail-fast validation (`ISS-018`).
- [ ] `docker-compose.dev.yml` updated with automated `rs.initiate()` healthcheck.
- [ ] Automated integration test suite (`TEST-001`, `TEST-003`) configured with `MongoMemoryReplSet`.
