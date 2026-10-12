# OPS-002: Distributed Task Processing Architecture with Redis, BullMQ & Redlock

**Operational Requirement ID:** `OPS-002`  
**Title:** Distributed Task Processing Architecture with Redis, BullMQ & Redlock  
**Category:** Background Processing & Scalability  
**Priority:** `P1` (High Operational Requirement)  
**Implementation Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#5-operations--production-register-ops-)

---

## 1. Operational Problem Statement
Currently, background jobs in Fleet Flow ([`backend/src/server.ts`](../../backend/src/server.ts) and [`notificationWorker.ts`](../../backend/src/workers/notificationWorker.ts)) are scheduled using Node.js in-process timers:
`setInterval(() => checkExpiries(), 24 * 60 * 60 * 1000);`.
When deploying multiple container instances for load balancing, every container executes its own timer. This triggers:
- Duplicate notification emails and SMS dispatches to customers.
- Concurrent competing writes to database records.
- Silent job drops when containers restart.
- No visibility, retries, exponential backoff, or Dead-Letter Queues (DLQ).

---

## 2. Target Architecture
Migrate background scheduling to a centralized, Redis-backed distributed task queue using **BullMQ**:
1. **Separation of Responsibilities:**
   - Producers (API containers) push tasks to named Redis queues.
   - Dedicated Worker instances pop and process jobs with concurrency controls.
2. **Distributed Locking (Redlock):** For daily scheduled cron tasks (e.g. daily document expiry checks), acquire a distributed lock ensuring only a single container runs the job.
3. **Resilience & Dead-Letter Queues:** Automatic 3x retries with exponential backoff on network failures; permanently failed jobs route to DLQ for alerting.

---

## 3. Queue Definitions
- `queue:document-compliance`: Expiry scans for PUC, Insurance, Fitness.
- `queue:telematics-ingestion`: Batch processing of high-volume GPS pings.
- `queue:notifications`: Email and SMS dispatch.
- `queue:reports-generation`: Asynchronous PDF/Excel export for large ledgers.

---

## 4. Acceptance Criteria
- [ ] Scaling backend to 5 clustered containers results in exactly 1 execution of daily maintenance tasks.
- [ ] Failed external API calls (e.g. SMTP or SMS gateways) retry automatically with backoff.
- [ ] BullMQ Bull-Board dashboard accessible to superadmins for job inspection.

---

## 5. Definition of Done
1. BullMQ workers and queue definitions implemented.
2. In-process `setInterval` timers removed.
