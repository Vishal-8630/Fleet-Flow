# DEC-002 — Mandatory MongoDB Replica Sets Across Environments

## Metadata

- **Decision ID:** DEC-002
- **Title:** Mandatory MongoDB Replica Sets Across Environments
- **Status:** Approved
- **Date:** Prior architectural work
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** N/A

---

## 1. Context and Problem Statement

Fleet Flow uses multi-document ACID transactions for financial mutations, journal entries, and inventory updates. Transactions require MongoDB replica sets.

## 2. Decision Statement

Mandatory MongoDB replica sets (`rs0`) must be configured and enforced across all runtime environments: Development (via automated Docker Compose initialization), CI/CD pipelines, Staging, and Production. Automated test suites must utilize MongoDB Memory Server with replica set configurations enabled. Application initialization must fail-fast with a descriptive startup error if connected to a standalone MongoDB instance.

## 3. Alternatives Considered and Trade-Offs

Two-phase commits or eventual consistency without transactions were considered but rejected due to high risk of ledger imbalances and race conditions in financial operations.

## 4. Consequences

Standalone MongoDB deployments are unsupported. Developers and deployment pipelines must run MongoDB with replica sets.

## 5. Implementation Implications

Application bootstrap code verifies replica set status via `db.adminCommand({ replSetGetStatus: 1 })` and aborts startup if not in a replica set.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Application starts cleanly when connected to an initialized MongoDB replica set.
- [ ] Application terminates startup with descriptive error if connected to standalone MongoDB.
- [ ] Docker Compose includes automatic single-node replica set initialization script (`rs0`).
- [ ] Test runner boots in-memory replica set for transactional integration tests.

## 7. Explicit Scope Boundaries

Applies to MongoDB database infrastructure and connection bootstrap logic.

## 8. What is Not Yet Implemented or Verified

Runtime verification of Docker Compose replica set scripts across fresh developer environments.

## 9. Related Issues and Artifacts

- Related Issues: N/A
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
