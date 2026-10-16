# Fleet Flow — DEC-012 Emergency Support Access Policy Change Proposal

**Document Type:** Security Governance Policy Amendment Proposal  
**Target Decision Record:** [DEC-012 (Tenant Privacy Architecture & Controlled Support Access)](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-012-tenant-privacy-controlled-support-access.md)  
**Batch Identifier:** `BATCH-A` Security Policy Revision  
**Document Status:** **PROPOSED — PENDING PRODUCT OWNER APPROVAL**  
**Execution Posture:** **DOCUMENTATION ONLY. No code modifications, migrations, or database changes authorized.**  
**Date:** 15 October 2026  
**Author / Governance Authority:** Technical Architecture & Security Governance Board (Pair-Programming Review)  
**Baseline Test Status:** Verified Historical Suite Baseline: 229 regression tests + 18 Batch A security tests = **247 passing tests** (100% pass rate). Automated test suites were verified in prior review cycles and were not re-executed during this documentation revision.  
**Git Working-Tree Baseline:** Verified via `git status --short`: untracked items are `docs/testing/audit/DEC-012-EMERGENCY-ACCESS-POLICY-PROPOSAL.md` and pre-existing `.tmp_test_fixture_UMI4qX/`; all tracked application code, schemas, controllers, routes, and middleware are completely clean and unmodified against `origin/main` at commit `20673d4`.

---

## 1. Executive Summary & Proposal Objective

### 1.1 Objective
This document formalizes the comprehensive technical, operational, and failure-recovery specifications for amending **DEC-012 Section 2.1 (Policy A: Emergency Break-Glass Access Exception)** in the Fleet Flow Transport Management SaaS platform.

The Product Owner has approved the proposed policy direction:
> **Option A — Immediate, Restricted Emergency Access (Single Super-Admin Break-Glass)**

This finalized proposal incorporates rigorous engineering review findings covering operation-level read-only authorization, distributed transaction outbox reconciliation, post-commit credential failure compensation, notification worker crash recovery leases, provider idempotency, concurrency-safe rolling alert deduplication, and fail-closed session expiry independence.

### 1.2 Core Operational Driver & Production Reality
Under the currently ratified DEC-012 Policy A (Option 1A), emergency break-glass access requires explicit dual-authorization from two distinct Platform Super-Administrators (`requested_by_user_id !== approved_by_user_id`).

In production reality, **Fleet Flow operates with a single Platform Super-Administrator**. Under the dual-authorization rule, a genuine catastrophic tenant lockout or system outage cannot be remediated via the emergency break-glass mechanism because a second Super-Admin account physically does not exist to co-authorize access. This causes an unintended, total operational deadlock where platform operators are permanently locked out of emergency diagnostics.

This proposal refactors Policy A to permit **immediate, restricted emergency access by the single Super-Admin**, balanced by significantly tightened compensating controls:
1. **Single Super-Admin Activation:** Eliminates the impossible secondary Super-Admin approval requirement while preserving all other security boundaries.
2. **Window Compression (15-Minute Hard Cap):** Maximum emergency session duration is slashed by 50%, from **30 minutes down to 15 minutes**, with zero renewal, extension, or token refresh.
3. **Mandatory Meaningful Justification:** Enforcing a non-boilerplate incident declaration of at least 20 characters explaining the incident context, urgency, and why normal tenant-admin pre-approval was unattainable.
4. **Operation-Level Read-Only Diagnostics:** Comprehensive prohibition of state mutations, method overrides (`X-HTTP-Method-Override`, query verb overrides), and side-effecting GETs, alongside financial route blockades, receipt file lockout, and driver PII masking.
5. **Durable Notification Staging & Transactional Outbox:** Enforcing synchronous MongoDB majority write concern (`{ w: "majority", j: true }`) for notification staging before token issuance, with post-commit dispatch eligibility, explicit handling for unknown commit outcomes, and automatic cancellation on transaction aborts.
6. **Rolling 24-Hour Security Monitoring:** Automated security alert generation whenever two or more emergency sessions are activated for the same tenant within a rolling 24-hour window, with concurrency-safe deduplication and zero operational blocking.
7. **Full Customer Control:** Real-time visibility and instant revocation authority preserved for customer Workspace Administrators.

> [!CRITICAL]
> **GOVERNANCE POSTURE: PROPOSAL ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**  
> This deliverable represents an approved policy direction finalized for governance sign-off. It does **not** authorize code modifications, schema changes, route adjustments, or test alterations. Implementation remains strictly on **HOLD**.

---

## 2. Current Policy Baseline and Observed Limitations

### 2.1 Current Policy Baseline (DEC-012 Policy A — Option 1A)
As ratified in `DEC-012:32–41` and implemented in `backend/src/controllers/supportAccessController.ts:297–520`, the current emergency support access mechanism mandates:
- **Dual Super-Admin Requirement:** An emergency session requires a requesting Super-Admin and a distinct secondary approving Super-Admin (`approver_two_id`). The controller rejects requests with `DUAL_ADMIN_IDENTICAL` (HTTP 400) if `req.user._id === approver_two_id`.
- **Duration Cap:** Session duration is capped at 30 minutes (`duration_minutes <= 30`).
- **Scope Restriction:** Hard-coded to `scope: 'diagnostics_readonly'`.
- **Durable Notification:** Persists a `NotificationJob` with MongoDB majority write concern before token generation (Policy A2 / Option 2A).
- **Session & Audit Atomicity:** Persists `SupportAccessRequest` and `PlatformAuditLog` in a MongoDB ACID transaction.
- **Fail-Closed Contract:** Fails closed with HTTP 503 (`EMERGENCY_NOTIFICATION_FAILED`) if notification queueing fails.

### 2.2 Observed Operational Limitations & Defect Analysis

| Area | Current Implementation | Observed Failure / Operational Defect | Severity |
| :--- | :--- | :--- | :--- |
| **Organizational Topology** | Requires two distinct Super-Admin accounts (`User.is_platform_super_admin === true`). | Fleet Flow currently operates with a **single platform Super-Admin**. Dual-authorization is impossible to satisfy, rendering the emergency break-glass mechanism completely inoperable during customer lockouts. | `P0 (Critical Blocker)` |
| **Risk Exposure Window** | 30 minutes duration cap. | For an emergency access grant without prior tenant consent, a 30-minute window presents unnecessary data exposure risk for purely diagnostic inspection. | `Medium Risk` |
| **Reason Validation** | Accepts any non-empty string for `justification`. | A single-word justification (e.g. `'urgent'`) passes validation without explaining the specific technical incident, why normal approval failed, or which systems are impacted. | `Low / Medium Risk` |
| **Fallback Risk** | Because emergency break-glass is blocked by the missing second admin, operators are tempted to fall back to legacy unscoped impersonation. | Bypasses all DEC-012 privacy protections, granting unrestricted `role: 'admin'` write privileges and exposing financial records and driver PII. | `P0 (Severe Security Bypass)` |
| **Monitoring Blindspot** | No frequency-based alert policy exists for repeated emergency access. | A compromised or rogue Super-Admin could repeatedly trigger short sessions without raising an automated threshold alert. | `Medium Risk` |
| **Outbox Ambiguity** | Treats all non-success transaction results as aborts. | During a network timeout on `commitTransaction()`, the outcome is unknown; blindly cancelling can lead to unnotified active sessions, while blindly releasing causes phantom alerts. | `High Risk` |
| **Post-Commit Delivery Gap** | No compensation if token generation or HTTP response fails post-commit. | If `jwt.sign()` throws or connection drops after commit, an active session exists in DB and notification is dispatched, but operator cannot enter. | `Medium Risk` |

---

## 3. Proposed Policy Mandate: Option A (Single Super-Admin Emergency Access)

Under the proposed amendment, DEC-012 Section 2.1 (Policy A) is refactored into the following authoritative policy mandates:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PROPOSED REVISED POLICY A: Immediate Restricted Emergency Access (Single Super-Admin)  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Immediate Activation:                                                               │
│    In genuine critical incidents where tenant administrators are inaccessible or       │
│    locked out, the sole Platform Super-Admin may immediately activate an emergency     │
│    support session without secondary operator approval, provided all automated         │
│    pre-issuance validations and durable notification staging checks succeed.           │
│                                                                                        │
│ 2. Mandatory Validated Emergency Declaration:                                          │
│    The request must include a meaningful, non-boilerplate incident justification of    │
│    at least 20 characters detailing: (a) the operational incident, (b) why urgent      │
│    access is necessary, and (c) why normal tenant-admin approval was unattainable.     │
│                                                                                        │
│ 3. Fifteen-Minute Maximum Duration (15m Hard Cap):                                     │
│    Emergency sessions are strictly bounded to 15 minutes server-side from the exact    │
│    authoritative activation timestamp. Zero automatic renewal, extension, or token     │
│    refresh is permitted. Subsequent sessions require a full new request, justification,│
│    notification, and audit cycle.                                                      │
│                                                                                        │
│ 4. Operation-Level Read-Only Diagnostics:                                              │
│    Hard-locked to `diagnostics_readonly`. All state mutations (POST, PUT, PATCH,       │
│    DELETE), method overrides (`X-HTTP-Method-Override`, `?_method=`), and side-       │
│    effecting GETs are blocked with HTTP 403. Financial routes, reports, and receipt    │
│    downloads remain strictly blocked.                                                  │
│                                                                                        │
│ 5. Strict Notification Staging & Transactional Outbox:                                 │
│    Synchronously persist an urgent notification job with MongoDB majority write       │
│    concern (`{ w: "majority", j: true }`) BEFORE token issuance. Emergency access      │
│    MUST fail closed (HTTP 503) if durable staging fails. The notification is released │
│    for worker dispatch ONLY upon successful activation commit, is transitioned to      │
│    `staged_unconfirmed` on unknown commit outcomes, and is cancelled on confirmed txn  │
│    aborts.                                                                             │
│                                                                                        │
│ 6. Post-Commit Credential Delivery Compensation:                                       │
│    If credential signing or HTTP transmission fails after activation transaction       │
│    commit, the session must be automatically revoked, notification cancelled/clarified,│
│    and an audit failure record emitted.                                                │
│                                                                                        │
│ 7. Worker Crash Recovery & Provider Idempotency:                                       │
│    Notification worker uses time-bounded leases (`lease_expires_at`) to reclaim stale  │
│    jobs upon worker crash, and passes unique `job_id` as provider idempotency key to   │
│    prevent duplicate customer messages during network retries.                         │
│                                                                                        │
│ 8. Rolling 24-Hour Frequency Alert Monitoring:                                         │
│    An automated platform security alert is emitted whenever two or more emergency      │
│    sessions for the same tenant occur within a rolling 24-hour window, using safe      │
│    deduplication without imposing a hard operational block.                            │
│                                                                                        │
│ 9. Full Customer Revocation Authority:                                                 │
│    Tenant Workspace Administrators retain real-time session visibility and the power   │
│    to terminate active emergency sessions instantly.                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Normal Support vs. Emergency Support Comparison

The table below contrasts the routine, customer-consensual support workflow with the proposed single-admin emergency break-glass workflow:

| Architectural Dimension | Normal Support Session (`DEC-012 Standard`) | Proposed Emergency Support (`DEC-012 Amended Policy A`) |
| :--- | :--- | :--- |
| **Trigger Mechanism** | Routine customer support ticket or troubleshooting request. | Critical tenant lockout, platform incident, or severe service degradation where tenant admin is unreachable. |
| **Authorization Requirement** | **Explicit prior approval** from target tenant's Workspace Admin (`role: 'admin'`). | **Self-activation by Platform Super-Admin** under strict emergency declaration. |
| **Approver Identity** | Authorized tenant member (`req.tenant.role === 'admin'`). | Requesting Platform Super-Admin (single-operator break-glass). |
| **Permitted Session Scopes** | `diagnostics_readonly` OR `config_write` (as requested and approved). | **`diagnostics_readonly` ONLY**. Zero write privileges permitted under any circumstance. |
| **Mutation Defense Depth** | HTTP method gating + endpoint permissions. | **Multi-layered:** HTTP method gating, method-override blocking, side-effecting GET blocking, and operation-level authorization. |
| **Maximum Duration** | Configurable from 5 to 60 minutes (default 30m, hard max 120m). | **Strictly 15 minutes maximum** (`duration_minutes <= 15`). Zero renewal. |
| **Token Refresh / Extension** | Not supported; extension requires explicit customer re-approval. | **Strictly prohibited**. Zero refresh, extension, or renewal permitted. |
| **Ticket Linkage** | Mandatory active tenant-scoped `SupportTicket` (`TICK-YYYY-XXXX`). | Mandatory active tenant-scoped `SupportTicket` (created by customer or via out-of-band verified lockout intake). |
| **Customer Notification Timing** | Notification sent upon request creation; customer approves inside app. | **Immediate high-priority notification staged before token issuance**; released to queue upon commit. |
| **Frequency Alert Monitoring** | Routine support requests subject to standard ticketing metrics. | **Automated security alert if $\ge 2$ emergency sessions occur for the same tenant in 24 hours**. |
| **Financial Route Access** | **Strictly blocked** (`HTTP 403`). | **Strictly blocked** (`HTTP 403`). |
| **Operational Monetary Redaction**| **All monetary fields redacted to `null`**. | **All monetary fields redacted to `null`**. |
| **Driver PII Masking** | **Aadhaar, PAN, DL, phone masked; address/DOB null**. | **Aadhaar, PAN, DL, phone masked; address/DOB null**. |
| **Receipt / Document Access** | **Strictly blocked** (`HTTP 403`). | **Strictly blocked** (`HTTP 403`). |
| **Session Revocation** | Workspace Admin OR Super-Admin can revoke instantly. | **Workspace Admin OR Super-Admin can revoke instantly**. |
| **Database Failure Behavior** | **Fail closed** (`HTTP 503 SESSION_VERIFICATION_FAILED`). | **Fail closed** (`HTTP 503 SESSION_VERIFICATION_FAILED`). |

> [!IMPORTANT]
> **NON-SUBSTITUTION INVARIANT:**  
> Emergency support is an extraordinary break-glass exception designed solely for tenant lockouts and system outages. It must **never** silently replace, bypass, or weaken the normal customer-approved support workflow. Routine assistance requests submitted by customers through standard channels must strictly traverse the normal approval lifecycle.

---

## 5. Detailed Emergency-Access Lifecycle & Notification Sequencing

The end-to-end lifecycle of an emergency support session under the proposed policy progresses through five deterministic phases:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: REQUEST & INPUT VALIDATION                                                    │
│ 1. Super-Admin posts: POST /api/super-admin/support-access/emergency-access            │
│    Payload: { company_id, ticket_id, justification, duration_minutes: 15 }             │
│ 2. Controller validates:                                                               │
│    - Caller is authenticated Platform Super-Admin (is_platform_super_admin === true)   │
│    - Target company exists and is active (not deleted)                                 │
│    - SupportTicket exists, belongs strictly to company_id, and is not resolved/closed  │
│    - Justification is non-empty, trimmed, and meets semantic quality rules (len >= 20) │
│    - Duration clamped strictly to Math.min(Math.max(duration, 1), 15)                  │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: SYNCHRONOUS DURABLE NOTIFICATION STAGING (Majority Write Concern)             │
│ 1. Construct NotificationJob:                                                          │
│    - event_type: 'EMERGENCY_ACCESS_GRANTED'                                            │
│    - recipients: Tenant billing email & registered Workspace Admins                    │
│    - details: operator email, timestamp, 15m expiry, emergency reason, revocation link │
│    - status: 'staged' (held back from worker pickup)                                   │
│ 2. Synchronous write: await notificationJob.save({ w: 'majority', j: true })           │
│    - If write fails/times out: ABORT. Return HTTP 503 (EMERGENCY_NOTIFICATION_FAILED).  │
│    - Zero token issuance. Zero session activation. No tenant data exposed.             │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: ATOMIC SESSION ACTIVATION & AUDIT COMMIT (MongoDB ACID Transaction)           │
│ 1. Open mongoose transaction session.                                                  │
│ 2. In session:                                                                         │
│    a) Concurrency check: Ensure no other 'active' emergency session for this tenant.  │
│    b) Create SupportAccessRequest:                                                     │
│       - status: 'active', is_emergency: true, scope: 'diagnostics_readonly'            │
│       - requested_by: superAdmin._id, approved_by: superAdmin._id                      │
│       - duration_minutes: 15, started_at: now, expires_at: now + 15m                   │
│    c) Create PlatformAuditLog:                                                         │
│       - action: 'emergency_support_activated'                                          │
│       - details: ticket_no, justification, expiry, notification_job_id                 │
│    d) Check 24-Hour Rolling Window:                                                    │
│       - If count(emergency_sessions in last 24h) >= 2:                                 │
│         Emit PlatformAuditLog action: 'emergency_access_high_frequency_alert'          │
│    e) Release NotificationJob: update status from 'staged' to 'pending'                │
│ 3. Commit transaction.                                                                 │
│    - If Confirmed Abort: Rollback. Mark NotificationJob 'cancelled' with majority write│
│    - If Unknown Commit Outcome (Network Error): Mark job 'staged_unconfirmed' and rely │
│      on outbox reconciliation.                                                         │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: TOKEN ISSUANCE & COMPENSATION RECOVERY                                        │
│ 1. Sign JWT: { userId, companyId, isImpersonation: true, supportSessionId,             │
│                supportScope: 'diagnostics_readonly', isEmergency: true }               │
│    - Set expiresIn: '15m'                                                              │
│ 2. If token signing or response transmission throws/drops:                             │
│    - Treat as uncertain credential state (presumed inaccessible).                      │
│    - Execute automated compensation: Revoke session ('credential_delivery_uncertain')  │
│    - Reconcile NotificationJob (atomic cancel, pre-send check, or corrective alert)    │
│    - Emit PlatformAuditLog 'emergency_activation_aborted_post_commit'                  │
│    - Return HTTP 500 (CREDENTIAL_DELIVERY_FAILED)                                      │
│ 3. On success: Set HttpOnly cookie & return response.                                 │
│ 4. Worker claims NotificationJob ('pending') with time-bounded lease.                  │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: EXPIRY OR IMMEDIATE REVOCATION                                                │
│ 1. Authoritative Expiry: Clock reaches started_at + 15 minutes.                        │
│    - Per-request middleware rejects with HTTP 403 regardless of status write success.  │
│ 2. Tenant Revocation: Workspace Admin clicks "Revoke Emergency Session"                │
│    - POST /api/support/sessions/:id/revoke                                             │
│    - Status set to 'revoked'. Subsequent requests fail closed immediately.             │
│ 3. Operator Revocation: Super-Admin terminates session upon task completion.           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Transactional Outbox, Worker Concurrency, Delivery Semantics & Failure Recovery

### 6.1 Confirmed Aborts vs. Unknown Commit Outcomes
In distributed database operations, a transaction failure can occur either before `commitTransaction()` or *during* `commitTransaction()`. The notification state machine must distinguish between these two failure modes:

1. **Confirmed Transaction Abort:**
   - *Scenario:* Validation fails inside the transaction, an explicit `abortTransaction()` is called, or a pre-commit document operation throws.
   - *Handling:* The transaction is known to have rolled back completely. The staged notification job must be updated conditionally and idempotently:
     ```typescript
     await NotificationJob.updateOne(
       { _id: notificationJob._id, status: 'staged' },
       {
         $set: {
           status: 'cancelled',
           last_error: `Activation transaction rolled back: ${txnError.message || txnError}`,
         },
       },
       { w: 'majority', j: true }
     ).catch((err) => {
       // Observable Cleanup Failure
       console.error('[CRITICAL] Notification outbox cancellation failed:', err);
       PlatformAuditLog.create({
         action: 'notification_outbox_cleanup_failed',
         target_company_id: company._id,
         details: { notification_job_id: notificationJob._id, error: err.message },
       }).catch(() => {});
     });
     ```
   - *Guarantee:* The notification worker will never pick up a `'cancelled'` job. No false emergency notification is released.

2. **Unknown Commit Outcome (Network Timeout / Socket Drop during Commit):**
   - *Failure Mode:* The driver sends `commitTransaction()`, but the primary replica socket drops or times out before the client driver receives the commit acknowledgment. In distributed MongoDB transactions, the primary replica may have committed the transaction or the transaction coordinator may have rolled it back.
   - *Flaw in Single-Query Handling:* Cancelling the outbox job solely because a single subsequent reconciliation query returns no session is dangerous and prohibited. Due to replication lag, read-preference routing, or transient connectivity hiccups, an initial lookup may miss a successfully committed session. Cancelling on the first miss risks leaving an active emergency session unnotified (silent access). Conversely, immediately releasing to `'pending'` risks emitting a false notification for an aborted session.
   - *Authoritative Bounded-Retry Protocol:*
     1. **Immediate State Transition:** The catch block transitions the job to `status: 'staged_unconfirmed'` with majority write concern, sets `reconciliation_attempts: 0`, `first_unconfirmed_at: new Date()`, and returns `HTTP 503 (ACTIVATION_COMMIT_UNKNOWN)`.
     2. **Bounded Polling & Retries:** An asynchronous **Outbox Reconciliation Worker** polls for jobs in `staged_unconfirmed` status. It executes bounded retries (up to 5 attempts across a bounded 3-minute window with exponential backoff: $T+15\text{s}, T+30\text{s}, T+60\text{s}, T+120\text{s}, T+180\text{s}$).
     3. **Authoritative Outcome Resolution:** The worker queries MongoDB using `readConcern: 'majority'` for `SupportAccessRequest.findOne({ notification_job_id: job._id })`:
        - *Definitive Commit Success:* If the session document exists and `status === 'active'`: The commit definitively succeeded. Transition the notification job conditionally and idempotently from `'staged_unconfirmed'` to `status: 'pending'`, releasing it to workers for customer delivery.
        - *Definitive Abort / Revocation:* If the session exists but `status === 'revoked'` or `'expired'`: Transition the job to `status: 'cancelled'`.
        - *Transient Miss:* If `SupportAccessRequest` is not found, do **not** cancel immediately. Increment `reconciliation_attempts += 1` and schedule the next retry attempt.
     4. **Quarantine & Escalation State:** If after 5 attempts (or 3 minutes elapsed) the session status remains unresolved:
        - Transition the notification job from `'staged_unconfirmed'` to `status: 'quarantined_unresolved'`.
        - Emit a critical platform audit log and operational security alert:
          `PlatformAuditLog.create({ action: 'outbox_commit_outcome_unresolved', target_company_id: job.company_id, details: { notification_job_id: job._id, attempts: job.reconciliation_attempts } })`.
        - Trigger an automated high-priority alert to on-call security and site reliability engineering for manual intervention.
     5. **Preserving Core Invariants:**
        - *No False Notifications:* Jobs in `quarantined_unresolved` are strictly quarantined from worker pickup. No customer notification is dispatched while the outcome remains unresolved.
        - *No Silently Usable Unnotified Access:* To guarantee that an operator cannot access tenant data during an unconfirmed or quarantined outcome:
          - **Fail-Closed Middleware Verification:** `supportSecurityMiddleware.ts` queries the associated `NotificationJob`. If the notification job is in `staged`, `staged_unconfirmed`, or `quarantined_unresolved`, the middleware immediately denies access with `HTTP 403 Forbidden (SUPPORT_NOTIFICATION_UNCONFIRMED)`.
          - **Defensive Revocation on Quarantine:** When transitioning to `quarantined_unresolved`, the reconciler executes a defensive revocation query:
            `SupportAccessRequest.updateMany({ notification_job_id: job._id, status: 'active' }, { $set: { status: 'revoked', revocation_reason: 'outbox_reconciliation_quarantined' } })`.
          - This double-barrier ensures that unresolved outcomes cannot result in either a false notification or silently usable, unnotified access.
     6. **Late Resolution Protocol After Outbox Quarantine:**
        If an unknown transaction outcome becomes clear after a job has entered `quarantined_unresolved` (e.g. via delayed replica synchronization or administrative post-incident reconciliation):
        - **Allowed Target States:** Transitions from `quarantined_unresolved` must be strictly conditional and idempotent, targeting only `cancelled_post_quarantine` or `reconciled_revoked_disclosed`. It is strictly forbidden to transition a quarantined job back to `staged`, `pending`, or `active`.
        - **Scenario A (Late Confirmation of Transaction Abort):** Authoritative database coordinator inspection confirms that the session document was never committed. The reconciler updates the outbox job:
          ```typescript
          await NotificationJob.updateOne(
            { _id: job._id, status: 'quarantined_unresolved' },
            {
              $set: {
                status: 'cancelled_post_quarantine',
                reconciled_at: new Date(),
                resolution_notes: 'Late resolution confirmed transaction aborted; zero session committed.',
              },
            },
            { w: 'majority', j: true }
          );
          ```
          Zero customer notification is released.
        - **Scenario B (Late Discovery of Committed Session):** The query confirms `SupportAccessRequest` was committed in MongoDB.
          - *Reactivation Prohibition:* The session MUST NOT be reactivated. Because defensive revocation already executed upon entering quarantine, the record is in `status: 'revoked'`. Even if defensive revocation was delayed, late reconciliation unconditionally enforces revocation: `status: 'revoked', revocation_reason: 'outbox_reconciliation_quarantined'`. An emergency session that was in doubt can never be made usable retroactively.
          - *Customer Disclosure Mandate:* The platform must not silently discard a committed break-glass record. Customer administrators are entitled to complete audit transparency. Late reconciliation conditionally updates the job from `quarantined_unresolved` to `status: 'reconciled_revoked_disclosed'`, and stages a high-priority **Late Incident Disclosure Notification**:
            - `event_type: 'EMERGENCY_ACCESS_RESOLVED_AFTER_QUARANTINE'`
            - Recipients: Tenant billing email and Workspace Admins.
            - Body: *"Notice: An emergency access transaction was committed for your workspace during a platform network partition, but was immediately quarantined and defensively revoked with zero operator access. The session has been permanently terminated."*
          - Records `PlatformAuditLog` event `emergency_access_late_quarantine_resolved`.
        - **Handling Delayed Workers and Stale Reads:** Delayed workers cannot claim quarantined jobs because worker polling queries strictly filter for `status: 'pending'` or active `processing` leases. Operator access remains fail-closed throughout.

### 6.2 Post-Commit Credential Delivery Failure, Uncertainty & In-Flight Race Recovery

1. **The Reality of Credential Delivery Uncertainty:**
   - In distributed web architectures, if a TCP connection resets (`ECONNRESET`, `EPIPE`), times out, or drops during or immediately after the HTTP response stream:
   - **The server cannot reliably prove whether credentials reached the client.** TCP packets containing the token may already have arrived in client-side operating system buffers before the socket terminated, or client application code may have disconnected prematurely. Asserting with certainty that "the operator did not receive credentials" is an unprovable physical claim over an unreliable network.
   - **Safe Handling for Uncertain Credential Delivery:** The platform treats any post-commit response transmission error as **UNCERTAIN CREDENTIAL STATE (PRESUMED INACCESSIBLE)**.
   - The platform takes immediate defensive action rather than assuming failure or success:
     ```typescript
     await SupportAccessRequest.updateOne(
       { _id: accessRequest._id, status: 'active' },
       {
         $set: {
           status: 'revoked',
           revocation_reason: 'credential_delivery_uncertain',
           revoked_at: new Date(),
           revoked_by: req.user!._id,
         },
       },
       { w: 'majority', j: true }
     ).catch((err) => {
       console.error('[CRITICAL] Post-commit compensatory revocation failed:', err);
       PlatformAuditLog.create({
         action: 'post_commit_compensation_failed',
         target_company_id: company._id,
         details: { session_id: accessRequest._id, error: err.message },
       }).catch(() => {});
     });
     ```
   - **Immediate Invalidation Guarantee:** Because `supportSecurityMiddleware.ts` validates MongoDB session status on every subsequent API call, even if the operator's client did receive the JWT bytes, any subsequent request bearing that token will be immediately rejected with `HTTP 403 Forbidden (SUPPORT_SESSION_REVOKED)`. The credential uncertainty is completely neutralized.

2. **The In-Flight Notification vs. Compensation Race:**
   - Because the activation transaction committed before response transmission, the notification job may already have transitioned to `status: 'pending'` and been claimed by a worker.
   - **Honest System Reality: The Distributed Gap:** A database check performed immediately before invoking an external provider API cannot physically eliminate the race window between the check and remote provider acceptance. If compensation revokes the session during this microsecond-to-second interval, the worker has already dispatched or is actively transmitting the TCP payload to the provider. Updating a database status does not abort an HTTP request already in transit across the public internet.
   - **Deterministic Conditional Atomic State Transitions:**
     - Defined outbox states: `staged`, `pending`, `processing`, `compensation_requested`, `cancelled`, `provider_accepted`, `provider_ambiguous_timeout`.
     - **Case A: Job Still `pending`:**
       - Compensation executes an atomic conditional update:
         `NotificationJob.findOneAndUpdate({ _id: job._id, status: 'pending' }, { $set: { status: 'cancelled', last_error: 'Revoked: credential delivery uncertain' } })`.
       - If `matchedCount === 1`: The worker has not claimed the job. It is safely cancelled; no external message will be dispatched.
     - **Case B: Job In-Flight with Worker (`processing`):**
       - Compensation atomically transitions the job:
         `NotificationJob.findOneAndUpdate({ _id: job._id, status: 'processing' }, { $set: { status: 'compensation_requested', compensation_requested_at: new Date() } })`.
       - **Worker Pre-Send Check:** Before initiating the external HTTP request, the worker checks `status === 'compensation_requested'` and queries `SupportAccessRequest.findOne({ _id: job.session_id, status: 'active' })`.
       - If compensation is requested or the session is revoked, the worker halts dispatch, transitions the job to `status: 'cancelled'` (`cancelled_pre_send`), and releases the lease without calling the provider.
     - **Case C: Provider Call Begun / In-Flight (Unknown Outcome):**
       - If the worker has already initiated the HTTP request to the external provider (e.g. SendGrid or Twilio) when compensation requests cancellation:
       - The worker must await the provider's HTTP socket response:
         - *Provider Returns 2xx:* The provider accepted the payload. The worker atomically transitions the job to `status: 'provider_accepted'`.
         - *Provider Times Out or Returns 5xx:* The outcome is ambiguous (the provider may or may not have accepted the message into its delivery pipeline). The worker transitions the job to `status: 'provider_ambiguous_timeout'`.
     - **Case D: Ambiguous Outcome Reconciliation & Truthful Corrective Customer Notification:**
       - Whenever a job reaches `provider_accepted` OR `provider_ambiguous_timeout` and the session was revoked via compensation:
       - **The message cannot be retracted or recalled from customer inboxes or SMS/WhatsApp devices.**
       - The system MUST treat the customer as potentially notified, and MUST stage a mandatory **Corrective Customer Notification**:
         - `event_type: 'EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE'`
         - Recipients: Same tenant billing email and registered Workspace Admins.
         - **Truthful Outcome-Specific Notification Body (No Unproven Delivery Claims):**
           - *For Confirmed Provider Acceptance (`provider_accepted`):*  
             *"Notice: An emergency access notification was dispatched to external delivery networks for your workspace, but the session was immediately aborted and revoked prior to operator access due to an uncertain credential delivery state. Zero administrative, operational, or diagnostic access occurred. Session ID ${session._id} is permanently terminated."*
           - *For Ambiguous Provider Timeout (`provider_ambiguous_timeout`):*  
             *"Notice: An emergency access attempt occurred and may have initiated an external dispatch attempt, but external provider delivery status remains unconfirmed due to a network timeout. The associated emergency session was immediately aborted and revoked prior to operator access. Zero administrative, operational, or diagnostic access occurred. Session ID ${session._id} is permanently terminated."*
         - **Delivery Claim Invariant:** The platform strictly prohibits claiming that an original notification was delivered or dispatched unless verifiable provider acknowledgment evidence (`provider_accepted`) supports that statement.
         - Persisted with majority write concern and dispatched via the worker outbox.
     - **Case E: Preserved Invariant on API Access:**
       - Regardless of whether notification delivery is in-flight, ambiguous, or resolving, `SupportAccessRequest.status = 'revoked'` is committed synchronously in MongoDB.
       - Any subsequent API request bearing the token fails immediately with `HTTP 403 (SUPPORT_SESSION_REVOKED)`. Session usability is completely decoupled from notification delivery resolution.
     - **Case F: Audit Trail:** Record `PlatformAuditLog` entry with `action: 'emergency_activation_aborted_post_commit'`, documenting whether the notification was cancelled cleanly or required corrective customer notification staging.

### 6.3 Notification Worker Crash Recovery, Leases & Realistic Delivery Guarantees

1. **Time-Bounded Leases & Crash Recovery:**
   - To prevent notification jobs from becoming permanently stuck in `processing` if a worker container crashes or restarts, workers claim jobs using an atomic find-and-modify:
     ```typescript
     {
       status: 'processing',
       locked_at: now,
       lease_expires_at: new Date(now.getTime() + 5 * 60 * 1000), // 5-minute lease
       worker_id: process.env.POD_NAME || os.hostname(),
     }
     ```
   - The worker acquisition query polls for:
     a) `status: 'pending', next_run_at: { $lte: now }` OR
     b) `status: 'processing', lease_expires_at: { $lte: now }` (stale lease recovery).
   - Reclaiming a stale lease increments `attempts += 1`.

2. **Realistic External Delivery Guarantees:**
   - **Distinguishing Provider Idempotency from Generic Message IDs:**
     - Embedding generic message IDs or metadata tags (such as SendGrid `custom_args` or AWS SES message tags) serves telemetry and tracking purposes, but does **not** provide client idempotency on the external transmission.
     - Dedicated idempotency headers (such as Twilio client SIDs, or custom HTTP idempotency headers supported by certain REST APIs) depend entirely on the specific third-party provider contract.
     - **No False Promises of "Exactly-Once" External Delivery:** In distributed cloud notifications over SMTP, SMS aggregators, and cellular carrier networks, **exactly-once external delivery cannot be guaranteed**. If a network timeout occurs after the provider processes the message but before sending the HTTP acknowledgment, an automated retry may result in duplicate customer delivery.
     - **Architectural Policy:** Fleet Flow guarantees **at-least-once queue persistence and delivery**, with **best-effort deduplication** using provider-native idempotency keys where supported by the transport contract.

3. **Handling Ambiguous Provider Responses:**
   - If an external provider call times out or returns HTTP 5xx:
     - The outcome is ambiguous (the provider may or may not have queued the message).
     - The worker records `status: 'retry_scheduled'`, increments `attempts`, and calculates exponential backoff.
     - The worker re-uses the exact same client request idempotency key on retry.
     - Only after 5 consecutive failures does the job transition to `status: 'dead_letter'`, emitting `emergency_notification_worker_failure` to `PlatformAuditLog`.

4. **Three Distinct Delivery Milestones (Formally Separated):**
   - *1. Queue Persistence:* Staged to MongoDB replica set log with majority write concern (`status: 'staged'` / `'pending'`). (Guarantees crash durability).
   - *2. Provider Acceptance:* External provider HTTP response returned 2xx with provider message SID / queue ID (`status: 'provider_accepted'`).
   - *3. Confirmed Delivery:* Asynchronous delivery webhook / DLR received from carrier/inbox provider verifying receipt on recipient device (`status: 'delivered'`).
   - The platform never conflates queue persistence with confirmed external delivery.

---

## 7. Strengthened Read-Only Enforcement Beyond HTTP Method Blocking

Relying solely on HTTP verb filtering (`!['GET', 'HEAD', 'OPTIONS']`) is insufficient. Fleet Flow must implement **multi-layered operation-level authorization**:

### 7.1 Layer 1: HTTP Method Gating
Standard filtering permits only `GET`, `HEAD`, and `OPTIONS`. All `POST`, `PUT`, `PATCH`, and `DELETE` requests are rejected with `HTTP 403 (SUPPORT_READ_ONLY_MODE)`.

### 7.2 Layer 2: Method-Override Interception
Malicious or misconfigured clients can tunnel mutation verbs through `GET` requests using override headers or query parameters:
- `X-HTTP-Method-Override`
- `X-Method-Override`
- `X-HTTP-Method`
- Query parameters: `?_method=POST`, `?_method=PUT`, `?_method=DELETE`
- **Enforcement:** `supportSecurityMiddleware.ts` must inspect request headers and query parameters. If any method override parameter is detected, the request is rejected immediately with:
  `HTTP 403 Forbidden (SUPPORT_METHOD_OVERRIDE_PROHIBITED)`.

### 7.3 Layer 3: Operation-Level Authorization & Side-Effecting GET Blockade
In complex Web applications, certain `GET` routes may trigger backend state mutations (e.g. generating export files, triggering batch recalculations, issuing tokens, refreshing external GPS caches):
- **Policy Mandate:** During emergency support sessions, the authorization engine enforces operation-level classification:
  - Whitelist: Only idempotent operational read queries (`query`, `list`, `get_by_id`, `inspect_telemetry`) are permitted.
  - Blacklist: Any route—regardless of HTTP verb—that triggers database writes, outbox pushes, cache flushes, or external API mutations is explicitly blocked with `HTTP 403 (SUPPORT_READ_ONLY_MODE)`.
  - Specific Examples Blocked:
    - `GET /api/reports/commercial/export/tally` $\rightarrow$ Blocked (`HTTP 403`).
    - `GET /api/system/cache/flush` $\rightarrow$ Blocked (`HTTP 403`).
    - `GET /api/tracking/refresh-all` (triggers live API state writes) $\rightarrow$ Blocked (`HTTP 403`).

### 7.4 Layer 4: Preserved Privacy Boundaries (Batch A)
- **Financial Route Blockade:** All endpoints under `/api/commercial`, `/api/finance`, `/api/ledger`, `/api/invoices`, `/api/billing`, and `/api/fleet/maintenance/profitability` return `HTTP 403 (FINANCIAL_RECORDS_LOCKED)`.
- **Monetary Field Redaction:** All operational monetary fields (`freight_rate_inr`, `driver_advance_inr`, `settlement_amount`, etc.) are redacted to `null` server-side via `attachSupportSanitizer()`.
- **Driver PII Masking:** Permanent server-side masking across all outputs (Aadhaar `XXXX-XXXX-1234`, PAN `XXXXX1234X`, phone `+91 98765 XXXXX`, address/DOB null, KYC photos null).
- **Receipt Blockade:** Direct download or preview of receipt slips, fuel receipts, or POD scans is blocked server-side (`HTTP 403 RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT`).

---

## 8. Authoritative 15-Minute Session Enforcement & Expiry Independence

### 8.1 Authoritative Activation-Time Anchoring
- The 15-minute duration is measured strictly from the server-side timestamp recorded at activation:
  $$\text{expires\_at} = \text{started\_at} + (15 \times 60 \times 1000 \text{ ms})$$
- The client-side system clock is completely ignored. Expiration is evaluated exclusively on the server using database-anchored UTC timestamps.

### 8.2 Fail-Closed Per-Request Check with Write-Failure Independence
On every incoming API request during an emergency session:
1. `supportSecurityMiddleware.ts` queries the active session record from MongoDB.
2. If MongoDB is unreachable or the query times out, it **fails closed** immediately:
   `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.
3. If `session.status !== 'active'`, access is immediately denied:
   `HTTP 403 Forbidden (SUPPORT_SESSION_REVOKED)`.
4. **Immediate Expiry Enforcement Independence & Malformed Expiry Fail-Closed:**
   ```typescript
   const isMalformedExpiry = !session.expires_at || isNaN(new Date(session.expires_at).getTime());
   if (isMalformedExpiry || new Date() > new Date(session.expires_at)) {
     if (isMalformedExpiry) {
       // Defensively revoke corrupt session record with majority write concern
       SupportAccessRequest.updateOne(
         { _id: session._id, status: 'active' },
         { $set: { status: 'revoked', revocation_reason: 'malformed_expiry_timestamp' } },
         { w: 'majority', j: true }
       ).catch((err) => {
         // Observable Error Telemetry: cleanup failure must not be silently swallowed
         console.error(JSON.stringify({
           event: 'MALFORMED_EXPIRY_CLEANUP_FAILED',
           level: 'CRITICAL',
           session_id: session._id,
           company_id: session.company_id,
           error: err.message,
         }));
       });
       PlatformAuditLog.create({
         action: 'emergency_session_malformed_expiry_detected',
         target_company_id: session.company_id,
         details: { session_id: session._id, raw_expires_at: session.expires_at },
       }).catch((err) => {
         console.error('[CRITICAL] Audit log creation failed for malformed expiry:', err.message);
       });
       
       return res.status(403).json({
         code: 'SUPPORT_SESSION_INVALID_EXPIRY',
         error: 'Support session has invalid or missing expiry timestamp; access denied.',
       });
     }

     // Asynchronously attempt to mark expired in DB and log audit event
     SupportAccessRequest.updateOne({ _id: session._id }, { $set: { status: 'expired' } }).catch(() => {});
     PlatformAuditLog.create({ action: 'emergency_support_expired', ... }).catch(() => {});
     
     // CRITICAL: Access denial is immediate, synchronous, and unconditional!
     // It does NOT depend on whether the database write or audit logging succeeds!
     return res.status(403).json({
       code: 'SUPPORT_SESSION_EXPIRED',
       error: 'Support session has expired.',
     });
   }
   ```
   - *Guarantee & Partial Unique Index Protection:* Even if MongoDB is in a read-only state, background writes throw, or audit logging fails, the expired or malformed request is **strictly denied**. Expiry enforcement never depends on a successful audit or status mutation write. Crucially, if cleanup writes fail, the corrupt record remains in `status: 'active'`, meaning it continues to occupy the unique slot in the partial unique index (`unique_active_emergency_session_per_tenant`). This database constraint **strictly prevents conflicting active sessions** from being created until safe cleanup (via pre-activation sweep or manual repair) successfully transitions the corrupt record out of `status: 'active'`. Cleanup failures are emitted directly to structured error telemetry so monitoring systems flag the condition immediately.

### 8.3 Absolute Prohibition of Session Renewal, Extension, or Refresh
- **Zero Renewal:** The server provides zero endpoints or mechanisms to extend, renew, or top up an active emergency session.
- **Token Refresh Blocked:** The authentication refresh endpoint `/api/auth/refresh-token` rejects tokens flagged with `isImpersonation: true` or `isEmergency: true` (`HTTP 403 SUPPORT_REFRESH_PROHIBITED`).
- **Subsequent Access Mandate:** If troubleshooting cannot be completed within 15 minutes, the active session is terminated. Any further intervention requires initiating a brand-new emergency request with a fresh incident justification, triggering a new durable notification and an independent audit log entry.

---

## 9. Concurrency-Safe Rolling 24-Hour Alert Detection, Deduplication & Storage Failure Recovery

### 9.1 Concurrency Serialization, Single-Active Mutex & Stale Session Expiry Sweep
To prevent race conditions where simultaneous emergency activation requests create duplicate sessions or corrupt alert metrics:
1. **Single-Active Invariant:** A tenant workspace can have at most **ONE active emergency session** at any given moment.
2. **Partial Unique Index Specification:**
   - The database-level constraint is implemented via a partial unique index on [`SupportAccessRequest`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/SupportAccessRequest.ts):
     ```typescript
     SupportAccessRequestSchema.index(
       { company_id: 1 },
       {
         unique: true,
         partialFilterExpression: {
           status: 'active',
           is_emergency: true,
         },
         name: 'unique_active_emergency_session_per_tenant',
       }
     );
     ```
   - **Elimination of Ambiguity for Historical Sessions:**
     - Crucially, this unique index indexes **only** documents where `status === 'active'` and `is_emergency === true`.
     - Historical emergency sessions that have progressed to `status: 'expired'` or `status: 'revoked'`, as well as routine support sessions (`is_emergency: false`), do **not** match the `partialFilterExpression` and are completely excluded from the index.
     - Therefore, a tenant may accumulate unlimited historical expired or revoked emergency sessions over time without any index collisions.
3. **Reconciling Expired-But-Still-Active and Malformed Records (Stale Expiry Sweep):**
   - *The Stale Status Problem:* If a previous emergency session's 15-minute window elapsed (`expires_at <= now`), or if an active record contains an absent or malformed `expires_at`, but no subsequent operator request arrived or background status updates failed, the document in MongoDB still retains `status: 'active'`. Because it has `status: 'active'`, it continues to occupy the unique slot for `company_id` in the partial unique index. A subsequent emergency activation would hit an `E11000 duplicate key error`, indefinitely blocking emergency access for that tenant.
   - *Pre-Activation Stale Session Sweep:* Inside the activation controller (executed immediately before or within the transaction), the system performs an atomic conditional transition:
     ```typescript
     await SupportAccessRequest.updateMany(
       {
         company_id: company._id,
         status: 'active',
         is_emergency: true,
         $or: [
           { expires_at: { $lte: new Date() } },
           { expires_at: { $exists: false } },
           { expires_at: null },
         ],
       },
       {
         $set: {
           status: 'expired',
           expired_at: new Date(),
           auto_expired_by_sweep: true,
         },
       },
       { w: 'majority', j: true }
     );
     ```
   - Because `expires_at <= now` (or absent/null), these records are already functionally dead per server-side clock rules. Transitioning their stored status to `'expired'` removes them from the partial unique index, freeing the slot for legitimate new emergency activation. Corrupt records lacking valid expiry can never indefinitely occupy the slot or permit two active sessions.
4. **Concurrency Race, Aborted Transaction Hygiene & Activation Retries (`E11000`):**
   - *Application-Level Check:* The controller checks `SupportAccessRequest.findOne({ company_id, status: 'active', is_emergency: true, expires_at: { $gt: new Date() } }).session(mongoSession)`. If a genuinely active unexpired session exists, it immediately responds with `HTTP 409 Conflict (EMERGENCY_SESSION_ALREADY_ACTIVE)`.
   - *Write-Layer Exclusion:* If two simultaneous activation requests pass the check concurrently, MongoDB's unique index permits exactly one insert; the competing transaction fails with `MongoServerError: E11000 duplicate key error collection ... index: unique_active_emergency_session_per_tenant`.
   - *Conflict Resolution Protocol (Clean Context & Valid Transaction Retry):*
     When code `11000` is trapped:
     1. **Do NOT Reuse the Aborted Transaction:** In MongoDB, encountering a write conflict (such as duplicate key) fatally aborts the transaction session. The controller must immediately abort and terminate the poisoned transaction:
        ```typescript
        await mongoSession.abortTransaction();
        mongoSession.endSession();
        ```
     2. **Inspect Conflicting Document Outside Aborted Transaction:**
        Using a clean connection/context, inspect the conflicting active record:
        - If `conflicting.expires_at && conflicting.expires_at > new Date()`: A genuinely active emergency session is currently running. Return `HTTP 409 Conflict (EMERGENCY_SESSION_ALREADY_ACTIVE)`.
        - If `conflicting.expires_at <= new Date()` or expiry is missing/null: The conflicting record is stale/expired.
     3. **Execute Sweep on Fresh Context with Majority Write Concern:**
        Perform the stale session sweep (`updateMany`) on the clean context with `{ w: 'majority', j: true }` to guarantee that status transitions are durably acknowledged across the replica set before starting the retry transaction.
     4. **Start a Valid New Transaction Session:**
        Open a brand-new MongoDB transaction session:
        `const retrySession = await mongoose.startSession(); retrySession.startTransaction();`
     5. **Re-Validate the Active-Session Invariant:**
        Inside the new transaction, re-execute the single-active check:
        `SupportAccessRequest.findOne({ company_id, status: 'active', is_emergency: true, expires_at: { $gt: new Date() } }).session(retrySession)`.
        If an active unexpired session is found, abort `retrySession`, end it, and return `HTTP 409 Conflict (EMERGENCY_SESSION_ALREADY_ACTIVE)`.
     6. **Bounded Activation Retry (Recreating All Records & Links):**
        Retry the full activation sequence at most ONCE within `retrySession` (bounded to 2 total transaction attempts across the request lifecycle):
        - Create the new `SupportAccessRequest` document with all emergency attributes (`duration_minutes: 15`, `scope: 'diagnostics_readonly'`, etc.).
        - Create the authoritative `PlatformAuditLog` record (`emergency_support_activated`).
        - Execute the rolling 24-hour evaluation and `PlatformSecurityAlert` upsert.
        - Release the staged notification outbox job, explicitly updating the foreign key reference to link the newly generated session ID (`notification_job.session_id = accessRequest._id`, transitioning status `'staged'` $\rightarrow$ `'pending'`).
        - Commit `retrySession`.
        If `E11000` is encountered on retry as well, abort `retrySession`, end it, and fail closed with `HTTP 409 Conflict (EMERGENCY_SESSION_ALREADY_ACTIVE)`.
5. **Immediate Expiry Enforcement Independence:**
   - As specified in Section 8.2, `supportSecurityMiddleware.ts` synchronously evaluates expiration and timestamp validity in memory and immediately returns `HTTP 403` (`SUPPORT_SESSION_EXPIRED` or `SUPPORT_SESSION_INVALID_EXPIRY`), completely independent of whether database status updates or audit writes succeed.

### 9.2 Concurrency-Safe 24-Hour Rolling Alert Detection & Sliding Deduplication Window
1. **Rolling 24-Hour Threshold vs. Alert Deduplication Window:**
   - **Rolling 24-Hour Session-Count Threshold:** An evaluation rule. When a session is activated at timestamp $T$, the controller counts all emergency sessions for that tenant where `started_at >= T - 24 hours`:
     $$\text{Count} = \text{SupportAccessRequest.countDocuments}(\{ \text{company\_id}, \text{is\_emergency: true}, \text{started\_at} \ge \text{now} - 24\text{h} \})$$
     If $\text{Count} \ge 2$, the high-frequency security policy is triggered.
   - **Alert Deduplication Window:** An alert suppression rule. Once the threshold condition is met, an operational alert is created. To prevent flooding platform leadership and SIEM with repetitive alerts for each subsequent session, a sliding 60-minute suppression window from the last external alert dispatch (`suppress_external_alerts_until = alert.dispatched_at + 60m`) suppresses external dispatch while recording session IDs.
   - **Elimination of Arbitrary Hourly Buckets:** Fixed wall-clock hourly buckets (`Math.floor(Date.now() / 3600000)`) are eliminated because they create boundary races (e.g. alerts firing at 10:59 and 11:01). The deduplication policy operates on an authoritative, sliding suppression window anchored to the tenant's active `PlatformSecurityAlert` record.
2. **Idempotent Session Recording in Alert Records:**
   - To guarantee that transaction retries, reconciliation sweeps, and concurrent executions for the *same* session ID can NEVER increment the count repeatedly, the alert record stores session IDs as a unique set:
     - Collection: `PlatformSecurityAlert`
     - Compound Unique Index: `{ company_id: 1, active_window_id: 1 }` or `{ alert_key: 1 }`
     - Update Mechanism:
       ```typescript
       await PlatformSecurityAlert.findOneAndUpdate(
         { alert_key: currentAlertKey },
         {
           $setOnInsert: {
             alert_type: 'emergency_access_high_frequency_alert',
             company_id: company._id,
             trigger_session_id: accessRequest._id,
             first_triggered_at: new Date(),
             suppress_external_alerts_until: new Date(Date.now() + 60 * 60 * 1000), // sliding 60m
             status: 'pending_dispatch',
           },
           $addToSet: { associated_session_ids: accessRequest._id },
           $set: { last_session_at: new Date() },
         },
         { upsert: true, new: true, setDefaultsOnInsert: true }
       );
       ```
   - The authoritative count of associated sessions is strictly `associated_session_ids.length`. No `$inc` operations are used, guaranteeing strict idempotency across retries.
3. **Concurrency-Safe Unique-Key Conflict Resolution:**
   - If simultaneous activations encounter a MongoDB duplicate-key error (`E11000`) on the alert key during upsert, the catch block executes a bounded retry with backoff (up to 3 attempts) to append the session ID via `$addToSet` to the existing active alert record.
4. **Authoritative Lifecycle: Created, Suppressed, Dispatched, and Re-Dispatched:**
   - *Created (`pending_dispatch`):* When count $\ge 2$ in rolling 24h, and no active unexpired `PlatformSecurityAlert` exists for this tenant (`now > alert.suppress_external_alerts_until` or no record exists). Staged with majority write concern in `status: 'pending_dispatch'`.
   - *Suppressed (`status: 'suppressed'` or updated in-place):* When count $\ge 2$ and an active alert record exists (`now <= alert.suppress_external_alerts_until`). Appends session ID via `$addToSet`, updates `last_session_at: now`, logs an internal audit event, and suppresses duplicate external dispatch. This clearly distinguishes suppression (internal set updated, zero external transmission) from successful external dispatch.
   - *Re-Dispatched / Escalated:* If a subsequent activation occurs after the deduplication suppression window has expired (`now > alert.suppress_external_alerts_until`) and sessions are still within the rolling 24-hour window, a new alert record is created and staged for dispatch with the refreshed cumulative session list.
   - *Authoritative Durable State:* Stored in the `PlatformSecurityAlert` collection in MongoDB, written with `{ w: 'majority', j: true }`.
5. **Complete Alert-Dispatch State Machine, Fencing Leases, Crash Recovery & Observable Escalation:**
   - **State Machine States & Invariants:**
     - `pending_dispatch`: Newly created alert staged for initial worker dispatch.
     - `dispatching`: Claimed by an active worker under an atomic, time-bounded lease guarded by a unique fencing token (`dispatch_lease_token`).
     - `retry_scheduled`: Bounded retry scheduled following a transient provider error or ambiguous socket timeout; ineligible for claiming until `next_run_at <= now`.
     - `dispatched`: Authoritative external 2xx acknowledgment received from the webhook/SIEM provider during a valid lease, with zero concurrent sessions added in-flight; anchors the 60-minute sliding suppression window.
     - `dispatch_failed`: Terminal failure reached after exhausting all 5 bounded retry attempts; permanently halts automatic retries and triggers immediate high-priority operational escalation.
   - **1. Atomic Dispatch-Claim Mechanism & Retry Eligibility (`next_run_at`):**
     - To prevent concurrent background workers or retry loops from independently claiming and double-dispatching the same security alert, workers claim alerts using an atomic conditional find-and-modify.
     - **Eligibility Query:** An alert is eligible for a worker claim if and only if:
       a) It is newly staged: `{ status: 'pending_dispatch' }`, OR
       b) It is an active retry whose backoff window has matured: `{ status: 'retry_scheduled', next_run_at: { $lte: new Date() } }`, OR
       c) It is a stale/crashed in-flight lease: `{ status: 'dispatching', dispatch_lease_expires_at: { $lte: new Date() } }`.
     - **Unique Lease & Fencing Token Generation:**
       Every claim generates a cryptographically random or unique ObjectId fencing token (`dispatch_lease_token`) and increments `lease_version`:
       ```typescript
       const now = new Date();
       const leaseDurationMs = 2 * 60 * 1000; // 2-minute lease
       const newLeaseToken = new mongoose.Types.ObjectId().toHexString(); // unique fencing token

       const claimedAlert = await PlatformSecurityAlert.findOneAndUpdate(
         {
           _id: alert._id,
           $or: [
             { status: 'pending_dispatch' },
             { status: 'retry_scheduled', next_run_at: { $lte: now } }, // backoff matured
             { status: 'dispatching', dispatch_lease_expires_at: { $lte: now } }, // crash/stale lease recovery
           ],
         },
         {
           $set: {
             status: 'dispatching',
             dispatch_worker_id: process.env.POD_NAME || os.hostname(),
             dispatch_lease_token: newLeaseToken, // FENCING TOKEN
             dispatch_lease_expires_at: new Date(now.getTime() + leaseDurationMs),
             dispatched_session_snapshot: alert.associated_session_ids, // snapshot of sessions being sent
           },
           $inc: { lease_version: 1 },
         },
         { new: true }
       );
       ```
     - If `claimedAlert === null`: Another worker already claimed the alert, or the retry backoff has not yet matured (`next_run_at > now`). The worker skips processing immediately.
   - **2. Guarded Conditional Result Updates (Fencing Token Protection against Stale Workers):**
     - In distributed systems, a slow worker (delayed by thread pauses, CPU starvation, or garbage collection) might resume execution after its 2-minute lease has expired and another worker has reclaimed the alert.
     - **Fencing Requirement:** Every state update by a worker (`dispatched`, `retry_scheduled`, `pending_dispatch`, or `dispatch_failed`) MUST be strictly conditional on the worker still holding the current lease:
       ```typescript
       const updateResult = await PlatformSecurityAlert.updateOne(
         {
           _id: alert._id,
           dispatch_lease_token: newLeaseToken, // FENCING CHECK: must match current lease
           status: 'dispatching',
         },
         {
           $set: updateFields,
           $unset: { dispatch_lease_expires_at: 1 },
         },
         { w: 'majority', j: true }
       );
       ```
     - **Stale Worker Discard Protocol:** If `updateResult.matchedCount === 0`:
       - The worker's lease expired, was reclaimed, or was preempted by a subsequent worker.
       - The worker detects fencing preemption, halts execution immediately, discards any local provider response, and emits structured warning telemetry:
         ```typescript
         console.warn(JSON.stringify({
           event: 'STALE_ALERT_WORKER_DISCARDED',
           alert_id: alert._id,
           lease_token: newLeaseToken,
           message: 'Worker lease expired or preempted; update rejected by fencing token.',
         }));
         ```
       - This guarantees that a zombie or stale worker can **never** overwrite a newer worker's state or erase progress.
   - **3. Expired Lease Recovery with Lost Acknowledgment & Honest Delivery Semantics:**
     - *The Unacknowledged Provider Call Scenario:* If Worker 1 successfully transmits the payload to the external SIEM/webhook, but crashes, is terminated by orchestrator autoscaling, or loses connectivity before writing the outcome to MongoDB:
     - When Worker 1's lease expires (`dispatch_lease_expires_at <= now`), Worker 2 reclaims the record.
     - **Physical Reality in Distributed Networks:** Worker 2 cannot inspect the remote provider's private socket memory to know whether Worker 1's payload was accepted.
     - **Honest At-Least-Once Delivery Mandate:**
       - Fleet Flow guarantees **at-least-once external dispatch with best-effort provider deduplication**.
       - Worker 2 re-transmits the alert payload using the deterministic `alert.alert_key` or `alert._id` as the external request/idempotency key.
       - **Strict Prohibition of False Delivery Confirmations:** The system **must never mark delivery as confirmed (`dispatched`)** unless an authoritative HTTP 2xx response is received from the provider within the *current, active* lease held by Worker 2.
       - If the third-party provider supports client idempotency headers, duplicate processing is suppressed on the receiver end. If the provider does not support client idempotency, at-least-once delivery may produce a duplicate webhook event. This duplicate is explicitly acceptable, whereas falsely marking an unconfirmed alert delivered or dropping an alert silently is prohibited.
   - **4. Ambiguous Webhook / SIEM Timeout Handling & Bounded Retry Exhaustion:**
     - If the external security webhook or SIEM endpoint times out, drops the socket, or returns HTTP 5xx:
       - **The worker MUST NOT mark the alert `status: 'dispatched'`.** Claiming delivery on an ambiguous timeout is prohibited as it would falsely suppress alerts for 60 minutes and silently drop security visibility.
       - The worker calculates the next attempt count: `nextAttempt = (alert.dispatch_attempts || 0) + 1`.
       - **Case A: Retries Remaining (`nextAttempt < 5`):**
         - Worker calculates exponential backoff: $\text{backoffMs} = 15\,000 \times 2^{\text{nextAttempt} - 1}$ (i.e. $15\text{s}, 30\text{s}, 60\text{s}, 120\text{s}$).
         - Worker atomically executes the fenced update:
           ```typescript
           await PlatformSecurityAlert.updateOne(
             { _id: alert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
             {
               $set: {
                 status: 'retry_scheduled',
                 next_run_at: new Date(Date.now() + backoffMs),
                 dispatch_attempts: nextAttempt,
                 last_error: err.message,
               },
               $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
             },
             { w: 'majority', j: true }
           );
           ```
         - The alert remains ineligible for worker claiming until the clock reaches `next_run_at`.
       - **Case B: Retry Budget Exhausted (`nextAttempt >= 5`):**
         - The alert transitions to `status: 'dispatch_failed'` rather than `retry_scheduled`.
   - **5. Observable `dispatch_failed` State & Operational Escalation Path:**
     - When `nextAttempt >= 5` is reached, the worker marks terminal failure:
       ```typescript
       await PlatformSecurityAlert.updateOne(
         { _id: alert._id, dispatch_lease_token: newLeaseToken, status: 'dispatching' },
         {
           $set: {
             status: 'dispatch_failed',
             dispatch_attempts: nextAttempt,
             exhausted_at: new Date(),
             last_error: `Exhausted 5 dispatch attempts: ${err.message}`,
           },
           $unset: { dispatch_lease_expires_at: 1, dispatch_lease_token: 1 },
         },
         { w: 'majority', j: true }
       );
       ```
     - **Observable Multi-Channel Escalation Path:**
       1. **Authoritative Audit Ledger:** Emits `PlatformAuditLog.create({ action: 'security_alert_dispatch_exhausted', target_company_id: alert.company_id, details: { alert_id: alert._id, alert_key: alert.alert_key, attempts: nextAttempt, last_error: alert.last_error } })`.
       2. **Structured Standard Error Telemetry:** Emits structured JSON to `process.stderr`:
          ```json
          {
            "event": "SECURITY_ALERT_DISPATCH_EXHAUSTED",
            "level": "CRITICAL",
            "alert_id": alert._id,
            "alert_key": alert.alert_key,
            "company_id": alert.company_id,
            "attempts": 5,
            "error": alert.last_error
          }
          ```
       3. **Infrastructure Metrics Counter:** Increments Prometheus / OpenTelemetry counter: `security_alert_dispatch_failures_total{alert_type="emergency_access_high_frequency_alert", company_id=alert.company_id}`.
       4. **Urgent On-Call Paging:** Triggers high-priority incident paging to on-call Site Reliability Engineering (SRE) and Security Operations (SecOps) channels (e.g. PagerDuty / Opsgenie webhook) for immediate human triage.
   - **6. Concurrent Activation Handling During In-Flight Dispatch:**
     - If another emergency activation occurs for the same tenant while `status === 'dispatching'`, the activation updates the document via `$addToSet: { associated_session_ids: accessRequest._id }`.
     - Upon receiving confirmed 2xx delivery from the external webhook, the worker compares the current `associated_session_ids` with `dispatched_session_snapshot`:
       - If new sessions were added during transmission: The worker executes a fenced transition moving the record back to `status: 'pending_dispatch'` (clearing the lease) so the newly arrived session IDs are dispatched in an immediate follow-up cycle, ensuring zero session alerts are silently lost.
       - If no new sessions were added: The worker executes a fenced transition to `status: 'dispatched'`, sets `dispatched_at: new Date()`, anchors `suppress_external_alerts_until: new Date(Date.now() + 60 * 60 * 1000)`, and clears the lease.
   - **7. Achievable Delivery Guarantees Stated Accurately:**
     - **Durable Persistence Guarantee:** Internal security alert records (`PlatformSecurityAlert`) are written to MongoDB with majority write concern (`{ w: 'majority', j: true }`) and are durable across cluster failures.
     - **External Webhook / SIEM Guarantee:** External delivery operates under **at-least-once semantics with best-effort external delivery**. Because public networks, third-party webhooks, and SIEM receivers are subject to latency spikes and outages, exactly-once external delivery cannot be promised. The system guarantees safe deduplication, crash recovery via leases, honest failure tracking, and non-blocking operation for the emergency operator.

### 9.3 Alert Persistence Failure Handling & Disclosed Monitoring Limitations
1. **The Double-Failure Scenario:**
   - In a severe database outage, disk exhaustion, or replica set partition, the primary write to `PlatformSecurityAlert` throws an error.
   - If the subsequent attempt to write a fallback record to `PlatformAuditLog.create({ action: 'security_alert_persistence_failed' })` ALSO fails due to the underlying storage degradation, a total persistence failure occurs.
2. **Realistic Engineering Reality (No False Claims):**
   - **Do NOT claim a durable audit trail exists when every durable store write has failed.** When MongoDB is completely unreachable or unable to accept majority writes, database persistence is physically impossible.
3. **Multi-Channel Observable Escalation Mechanisms:**
   - *Process Telemetry:* The catch block writes a structured, machine-parsable JSON event to `process.stderr`:
     ```typescript
     console.error(JSON.stringify({
       event: 'SECURITY_ALERT_PERSISTENCE_TOTAL_FAILURE',
       level: 'CRITICAL',
       company_id: company._id,
       session_id: accessRequest._id,
       operator_id: req.user!._id,
       timestamp: new Date().toISOString(),
       error: err.message,
     }));
     ```
   - *Independent Metrics Counter:* Increments an in-memory OpenTelemetry/Prometheus metrics counter: `emergency_alert_persistence_failures_total{company_id}`, scraped independently of the database by external infrastructure monitoring.
   - *In-Memory Retry Buffer:* Pushes the failed alert payload into a bounded in-memory FIFO queue (capped at 100 entries) with background retry every 30 seconds for up to 10 minutes.
4. **Disclosed Limitation (Unavoidable Monitoring Gap):**
   - If the application container crashes, terminates, or restarts before log collectors (e.g. FluentBit / Datadog Agent) scrape the stderr stream and before database connectivity is restored, **an unavoidable monitoring persistence gap occurs**.
   - No software architecture can guarantee durable record persistence when all durable storage systems are unreachable and volatile container memory is lost.
5. **Policy Consistency:**
   - Under the approved single-Super-Admin emergency break-glass policy, the primary operational imperative during catastrophic customer outages is disaster recovery.
   - Therefore, the emergency access session is NOT aborted solely because alert metric persistence failed. The platform accepts this risk trade-off, fully disclosing the monitoring gap, to avoid blocking recovery during platform crises.

---

## 10. Security Controls and Failure Behavior Matrix

| Failure / Security Scenario | Detection Point | Enforced System Behavior | HTTP Status & Error Code |
| :--- | :--- | :--- | :--- |
| **Missing Justification** | Controller validation | Reject request immediately. | `HTTP 400 Bad Request`<br>`INVALID_JUSTIFICATION` |
| **Whitespace-Only / Short Justification** | Controller validation | Trim string; reject if `trimmed.length < 20`. | `HTTP 400 Bad Request`<br>`JUSTIFICATION_TOO_SHORT` |
| **Cross-Tenant Ticket Linkage** | Controller validation | Verify `ticket.company_id === company_id`. Reject cross-tenant or missing tickets. | `HTTP 404 Not Found`<br>`TICKET_NOT_FOUND` |
| **Resolved / Closed Ticket** | Controller validation | Reject if ticket status is `'resolved'` or `'closed'`. Active ticket mandatory. | `HTTP 400 Bad Request`<br>`TICKET_INACTIVE` |
| **Non-Super-Admin Caller** | Route & controller check | Verify `req.user.is_platform_super_admin === true`. | `HTTP 403 Forbidden`<br>`SUPER_ADMIN_REQUIRED` |
| **Notification Persistence Failure** | `notificationJob.save()` | If MongoDB fails to achieve majority replication quorum for notification, abort immediately. | `HTTP 503 Service Unavailable`<br>`EMERGENCY_NOTIFICATION_FAILED` |
| **Transaction Abort (Confirmed)** | `withTransaction` catch | Rollback transaction; conditionally mark staged job `'cancelled'`. Never release false notifications. | `HTTP 500 Internal Error`<br>`ACTIVATION_TRANSACTION_FAILED` |
| **Unknown Commit Outcome** | `commitTransaction` catch | Mark job `'staged_unconfirmed'`. Bounded retries (5 attempts over 3m) query majority replica. If unresolved after retries, transition to `'quarantined_unresolved'`, trigger `outbox_commit_outcome_unresolved` alert, execute defensive revocation, and middleware blocks access (`HTTP 403 SUPPORT_NOTIFICATION_UNCONFIRMED`). | `HTTP 503 Service Unavailable`<br>`ACTIVATION_COMMIT_UNKNOWN` |
| **Late Resolution of Quarantined Outbox Job (`quarantined_unresolved`)** | `OutboxReconciliationWorker` late poll / coordinator query | If late resolution confirms transaction aborted, conditionally transition job to `'cancelled_post_quarantine'`. If late resolution discovers committed session, session remains permanently revoked (reactivation strictly prohibited); conditionally update job to `'reconciled_revoked_disclosed'`, stage mandatory late customer disclosure notification (`EMERGENCY_ACCESS_RESOLVED_AFTER_QUARANTINE`), and log `emergency_access_late_quarantine_resolved`. Middleware denies operator API access fail-closed throughout. | Background reconciliation<br>(Operator access blocked: `HTTP 403 SUPPORT_NOTIFICATION_UNCONFIRMED` / `SUPPORT_SESSION_REVOKED`) |
| **Post-Commit Credential Delivery Failure / Uncertainty** | Response dispatch / socket catch | Treat as uncertain credential state (presumed inaccessible). Execute compensatory revocation (`'credential_delivery_uncertain'`). Atomic conditional state transitions for outbox: if `pending` $\rightarrow$ `'cancelled'`; if `processing` $\rightarrow$ `'compensation_requested'`. Worker pre-send check halts dispatch if not yet sent. If provider call already in-flight or accepted (`provider_accepted` / `provider_ambiguous_timeout`), changing DB status does NOT cancel external message; worker stages mandatory corrective customer notification (`EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE`) with truthful wording distinguishing confirmed delivery from unconfirmed timeouts. Synchronous DB revocation ensures subsequent token use fails closed immediately. | `HTTP 500 Internal Error`<br>`CREDENTIAL_DELIVERY_FAILED` |
| **Database Down during Subsequent Request** | `supportSecurityMiddleware` | If database query for `SupportAccessRequest` errors or times out, fail closed immediately. | `HTTP 503 Service Unavailable`<br>`SESSION_VERIFICATION_FAILED` |
| **Write Mutation Attempted** | `supportSecurityMiddleware` | Block `POST`, `PUT`, `PATCH`, `DELETE`. Emergency sessions are strictly read-only diagnostics. | `HTTP 403 Forbidden`<br>`SUPPORT_READ_ONLY_MODE` |
| **Method Override Header / Param Attempt** | `supportSecurityMiddleware` | Reject `X-HTTP-Method-Override`, `X-Method-Override`, `X-HTTP-Method`, or `?_method=*`. | `HTTP 403 Forbidden`<br>`SUPPORT_METHOD_OVERRIDE_PROHIBITED` |
| **Side-Effecting GET Endpoint Attempt** | `supportSecurityMiddleware` | Block state-mutating, export, or cache-flush GET endpoints at operation level. | `HTTP 403 Forbidden`<br>`SUPPORT_READ_ONLY_MODE` |
| **Financial Route Access Attempt** | `supportSecurityMiddleware` | If path starts with `/api/commercial`, `/api/finance`, `/api/ledger`, `/api/invoices`, block. | `HTTP 403 Forbidden`<br>`FINANCIAL_RECORDS_LOCKED` |
| **Receipt / Document Access Attempt** | `supportSecurityMiddleware` | Direct download or preview of receipt slips, fuel receipts, or POD scans is blocked. | `HTTP 403 Forbidden`<br>`RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT` |
| **Session Expired or Malformed (> 15 Minutes or Absent/Invalid)** | `supportSecurityMiddleware` | Check `now > session.expires_at` or `!session.expires_at` or invalid timestamp. Deny unconditionally in memory with `HTTP 403` (`SUPPORT_SESSION_EXPIRED` or `SUPPORT_SESSION_INVALID_EXPIRY`), independent of audit write success. Defensively revoke corrupt records. | `HTTP 403 Forbidden`<br>`SUPPORT_SESSION_EXPIRED` /<br>`SUPPORT_SESSION_INVALID_EXPIRY` |
| **Stale or Malformed Active Record in Partial Unique Index** | Pre-activation sweep / `E11000` duplicate key catch | Prior to activation (or on `E11000` conflict), controller sweeps stale/malformed records where `status: 'active'`, `is_emergency: true`, and `expires_at <= now` (or `expires_at` is missing/null) to `status: 'expired'`, freeing the partial unique index slot. If `E11000` occurs, aborted transaction is closed, sweep runs on fresh context, and activation retries on valid new transaction after re-validating active-session invariant (bounded to 1 retry). Corrupt records lacking valid expiry cannot bypass the index or permit concurrent active sessions. | Transparent sweep & clean retry, or `HTTP 409 Conflict`<br>`EMERGENCY_SESSION_ALREADY_ACTIVE` if unexpired session active |
| **Tenant Admin Revokes Session** | `supportSecurityMiddleware` | Check `session.status === 'revoked'`. Deny subsequent requests immediately. | `HTTP 403 Forbidden`<br>`SUPPORT_SESSION_REVOKED` |
| **Token Refresh Attempted** | Auth refresh controller | Reject refresh attempts for emergency support tokens. | `HTTP 403 Forbidden`<br>`SUPPORT_REFRESH_PROHIBITED` |
| **Concurrent Emergency Activations** | Controller validation & Partial Unique Index | Reject duplicate active session. If simultaneous requests race past controller check, MongoDB partial unique index (`unique_active_emergency_session_per_tenant`) enforces exclusion via `E11000` duplicate key conflict. Controller traps `11000` and returns 409. Historical sessions unaffected. | `HTTP 409 Conflict`<br>`EMERGENCY_SESSION_ALREADY_ACTIVE` |
| **Two or More Activations in 24 Hours (Rolling Threshold)** | Controller activation check & `PlatformSecurityAlert` atomic upsert | Evaluates rolling 24h count ($\ge 2$ sessions in `now - 24h`). Deduplicates external dispatch via sliding 60-minute suppression window anchored to active `PlatformSecurityAlert`. Records session IDs idempotently via `$addToSet: { associated_session_ids }` (authoritative count is `associated_session_ids.length`, no `$inc`). Concurrency conflicts on unique alert key resolved via bounded retries (up to 3). Atomic conditional dispatch-claim with unique fencing token lease (`status: 'pending_dispatch'` or `retry_scheduled` with `next_run_at <= now` $\rightarrow$ `'dispatching'`) prevents duplicate worker claims. Stale worker updates fenced out. Stale lease recovered with honest at-least-once re-transmission (zero false delivery claims). Non-blocking to emergency operator. | `HTTP 200 OK` (with audit alert logged and external dispatch managed) |
| **Alert Persistence Primary Write Failure** | `PlatformSecurityAlert` write catch | Primary write fails; fallback write to `PlatformAuditLog` (`security_alert_persistence_failed`) records degradation. Non-blocking to emergency activation. | `HTTP 200 OK` (non-blocking; fallback audit logged) |
| **Alert Persistence Double-Failure (Total Storage Outage)** | `PlatformAuditLog` fallback write catch | Both primary `PlatformSecurityAlert` and fallback `PlatformAuditLog` writes fail due to storage degradation. Platform does NOT claim durable persistence exists. Escalates via observable telemetry: structured JSON to `process.stderr` (`SECURITY_ALERT_PERSISTENCE_TOTAL_FAILURE`), increments OpenTelemetry metrics counter `emergency_alert_persistence_failures_total`, and enqueues payload in bounded in-memory buffer for background retry. Emergency activation continues non-blockingly per disaster recovery policy, with transparent disclosure of unavoidable monitoring gap during uncollected container crashes. | `HTTP 200 OK` (non-blocking; multi-channel telemetry emitted) |
| **Worker Crash or Timeout during Alert Dispatch** | Worker lease timeout & fencing token | Stale lease (`dispatch_lease_expires_at <= now`) reclaimed by next worker iteration with retry increment and new fencing token. Reclaims execute honest at-least-once re-dispatch without falsely marking delivery confirmed. Stale worker results discarded via fencing check. Ambiguous timeouts transition to `retry_scheduled` with backoff; 5 exhausted attempts transition to `dispatch_failed` with multi-channel SRE paging. | Automatic worker recovery & escalation |

---

## 11. Comprehensive Audit Requirements & Customer Controls

### 11.1 Authoritative Audit Event Inventory
All emergency support operations generate permanent, append-only records in [`PlatformAuditLog`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/PlatformAuditLog.ts):

| Audit Action Code | Trigger Condition | Recorded Payload Attributes |
| :--- | :--- | :--- |
| `emergency_access_rejected` | Request fails validation (reason < 20 chars, ticket invalid, non-superadmin). | Caller ID, target tenant ID, failure reason code, IP address. |
| `emergency_activation_failed` | Notification staging fails (HTTP 503) or activation transaction aborts. | Caller ID, target tenant ID, ticket ID, error details, duration. |
| `emergency_activation_aborted_post_commit` | Token signing or credential transmission fails post-commit. | Caller ID, target tenant ID, session ID, compensation outcome (`cancelled` vs `corrective_notification_staged`). |
| `post_commit_compensation_failed` | Compensatory session revocation or notification cleanup throws an unhandled error during recovery. | Session ID, target tenant ID, error details, timestamp. |
| `emergency_support_activated` | Session successfully committed and activated. | Caller ID, target tenant ID, session ID, ticket no, justification, 15m expiry, notification job ID. |
| `emergency_access_high_frequency_alert` | 2nd or greater emergency activation for same tenant in 24h rolling window. | Tenant ID, count of sessions in window, associated session IDs, alert key, timestamp. |
| `security_alert_persistence_failed` | Primary database error encountered during high-frequency alert persistence; fallback audit log written. | Alert key, target tenant ID, error message, stack trace. |
| `security_alert_persistence_total_failure` | Both primary alert write and fallback audit write fail during storage outage. | Target tenant ID, session ID, operator ID, error details, escalation channels (stderr JSON, metrics counter). |
| `emergency_session_stale_sweep_executed` | Pre-activation sweep transitions expired-but-active emergency records to `'expired'` to free partial unique index slot. | Target tenant ID, swept session IDs count, sweep execution timestamp. |
| `emergency_session_malformed_expiry_detected` | Active emergency session found with absent, null, or unparseable `expires_at`. Session defensively revoked and blocked. | Session ID, target tenant ID, raw expires_at value, detection timestamp. |
| `emergency_access_late_quarantine_resolved` | Outbox reconciliation confirms outcome after job entered `quarantined_unresolved`. | Session ID, tenant ID, outbox job ID, resolution outcome (`cancelled_post_quarantine` vs `reconciled_revoked_disclosed`), corrective disclosure job ID. |
| `emergency_support_revoked` | Tenant Workspace Admin or Super-Admin revokes active session. | Revoker ID, revoker role (`admin` vs `superadmin`), revocation timestamp, reason. |
| `emergency_support_expired` | Clock reaches `started_at + 15m`. Synchronously denied at middleware before async DB write. | Session ID, tenant ID, expiry timestamp. |
| `support_access_denied_mutation` | Operator attempts write mutation or method override during session. | Operator ID, tenant ID, attempted path, attempted method / override header. |
| `emergency_notification_worker_failure` | Notification worker exhausts retries and transitions job to dead letter. | Notification job ID, tenant ID, attempt count, last error, provider status. |
| `notification_outbox_cleanup_failed` | Compensation write fails during transaction abort. | Notification job ID, tenant ID, error details, timestamp. |
| `outbox_commit_outcome_unresolved` | Unconfirmed outbox job unresolved after 5 reconciliation attempts; transitioned to quarantine state. | Notification job ID, target tenant ID, attempt count, elapsed duration, action taken. |
| `security_alert_dispatch_exhausted` | Alert dispatch worker exhausts 5 bounded attempts and transitions record to `dispatch_failed`. | Alert ID, alert key, target tenant ID, attempt count, last error, escalation channels. |

### 11.2 Customer Workspace Admin Visibility & Revocation Authority
- Customer administrators maintain full, real-time visibility into active and historical emergency sessions under **Settings > Support Sessions** (`/api/support/sessions`).
- An active emergency session displays a prominent, high-visibility security banner detailing operator identity, reason, activation timestamp, and remaining seconds.
- The Workspace Admin can revoke the session at any second via `POST /api/support/sessions/:id/revoke`. Revocation updates the database record instantly, causing the very next operator request to fail with `HTTP 403 (SUPPORT_SESSION_REVOKED)`.

---

## 12. Backward Compatibility and Migration Considerations

### 12.1 Impact Analysis on Existing Architecture

| Area | Current Implementation | Impact of Proposed Single-Admin Policy | Migration Action Required |
| :--- | :--- | :--- | :--- |
| **`SupportAccessRequest` Schema** | `emergency_approver_two` is a required field for emergency requests. | `emergency_approver_two` is no longer applicable when there is only one Super-Admin. | Make `emergency_approver_two` optional on Mongoose schema. Add `is_single_admin_emergency: true` flag for audit traceability. |
| **API Request Payload** | `POST /api/super-admin/support-access/emergency-access` requires `approver_two_id`. | Clients (frontend/scripts) must not be forced to provide an imaginary second admin ID. | Deprecate `approver_two_id` requirement. Update controller validation to accept single-operator payload. |
| **Session Duration Constraints** | Current max is 30 minutes (`duration_minutes <= 30`). | Proposed policy caps duration strictly at **15 minutes**. | Clamp `finalDuration = Math.min(Math.max(requestedMinutes, 1), 15)` in controller. Update token sign `expiresIn: '15m'`. |
| **Active Sessions** | Any historical or active emergency sessions in testing. | Currently active sessions must be honored until their existing expiry; do not retroactively truncate. | Apply 15-minute cap strictly to newly created emergency sessions. |
| **Standard Support Requests** | Requests pending customer approval. | **Zero impact**. Routine customer-admin approvals via `/api/support/sessions/:id/approve` remain unchanged. | None. Preserves complete isolation between routine and emergency paths. |
| **Automated Test Suite** | 247 tests passing; `batchASecurity.test.ts` includes `SEC-NEG-12` and `SEC-NEG-13` verifying dual-admin requirements. | Tests expecting 400 for missing `approver_two_id` or identical approver will fail when dual-admin is removed. | When authorized, refactor `SEC-NEG-12` and `SEC-NEG-13` to test single-admin constraints (min reason length, 15m duration cap). |

---

## 13. Expanded Regression Test Matrix

*(Note: Listed for governance review only; no code implementation is authorized at this stage).*

| Test Identifier | Test Category | Target Validation Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| `SEC-EMG-01` | Integration | Single Super-Admin activates emergency access with valid 25-char reason. | Returns `HTTP 200 OK`. `is_emergency: true`, `duration_minutes: 15`. Token issued. |
| `SEC-EMG-02A`| Negative | Super-Admin provides empty or whitespace-only justification. | Returns `HTTP 400 Bad Request` (`INVALID_JUSTIFICATION`). |
| `SEC-EMG-02B`| Negative | Super-Admin provides short justification (`"too short"` < 20 chars). | Returns `HTTP 400 Bad Request` (`JUSTIFICATION_TOO_SHORT`). |
| `SEC-EMG-03` | Negative | Non-Super-Admin user attempts emergency activation. | Returns `HTTP 403 Forbidden` (`SUPER_ADMIN_REQUIRED`). |
| `SEC-EMG-04` | Integration | Verify token expires after 15 minutes; subsequent request blocked. | `expires_at` is exactly `now + 15m`. Request at 16m returns `HTTP 403 SUPPORT_SESSION_EXPIRED`. |
| `SEC-EMG-04B`| Negative | Active emergency session has absent (null) or malformed `expires_at`. | `supportSecurityMiddleware` fails closed immediately with `HTTP 403 SUPPORT_SESSION_INVALID_EXPIRY`, logs `emergency_session_malformed_expiry_detected`, and defensively revokes session. |
| `SEC-EMG-05` | Negative | Attempt token refresh on emergency token (`POST /api/auth/refresh-token`). | Returns `HTTP 403 Forbidden` (`SUPPORT_REFRESH_PROHIBITED`). |
| `SEC-EMG-06A`| Negative | Operator attempts write mutation (`POST /api/fleet/trucks`) during emergency session. | Returns `HTTP 403 Forbidden` (`SUPPORT_READ_ONLY_MODE`). |
| `SEC-EMG-06B`| Negative | Operator attempts method override (`GET` with `X-HTTP-Method-Override: POST`). | Returns `HTTP 403 Forbidden` (`SUPPORT_METHOD_OVERRIDE_PROHIBITED`). |
| `SEC-EMG-06C`| Negative | Operator attempts query param override (`GET /api/fleet/trucks?_method=DELETE`). | Returns `HTTP 403 Forbidden` (`SUPPORT_METHOD_OVERRIDE_PROHIBITED`). |
| `SEC-EMG-06D`| Negative | Operator attempts side-effecting GET endpoint (e.g. export trigger or cache flush). | Returns `HTTP 403 Forbidden` (`SUPPORT_READ_ONLY_MODE`). |
| `SEC-EMG-07` | Negative | Operator attempts to access financial endpoint (`/api/commercial/settlements`). | Returns `HTTP 403 Forbidden` (`FINANCIAL_RECORDS_LOCKED`). |
| `SEC-EMG-08` | Negative | Operator attempts to access receipt slip or download document. | Returns `HTTP 403 Forbidden` (`RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT`). |
| `SEC-EMG-09` | Integration | Simulate MongoDB replica timeout during notification staging. | Fails closed with `HTTP 503 EMERGENCY_NOTIFICATION_FAILED`. Zero token issued. |
| `SEC-EMG-10` | Integration | Transaction abort occurs before commit; verify staged notification cancelled. | Notification job marked `'cancelled'`. Worker never picks it up. Zero false alert. |
| `SEC-EMG-11A`| Integration | Unknown commit outcome (timeout during commitTransaction). | Job marked `'staged_unconfirmed'`. Reconciler polls and promotes job to `'pending'` upon finding active session. |
| `SEC-EMG-11B`| Integration | Delayed / ambiguous commit outcome with transient lookup miss. | Initial lookup miss during reconciliation does not cancel job prematurely; retry at attempt 2 confirms active session. |
| `SEC-EMG-11C`| Integration | Outbox reconciliation timeout after 5 bounded attempts. | Job marked `'quarantined_unresolved'`, triggers `outbox_commit_outcome_unresolved` alert, defensive revocation executed, middleware blocks access (`HTTP 403`). |
| `SEC-EMG-11D`| Integration | Late resolution after outbox quarantine. | If late check confirms session aborted, job conditionally transitions to `cancelled_post_quarantine`. If late check confirms session committed, session remains permanently revoked (reactivation prohibited), job transitions to `reconciled_revoked_disclosed`, and late customer disclosure notification (`EMERGENCY_ACCESS_RESOLVED_AFTER_QUARANTINE`) is staged. |
| `SEC-EMG-12A`| Integration | Post-commit token signing fails; verify compensatory session revocation. | Session marked `'revoked'` (`credential_delivery_uncertain`), pending outbox job cancelled cleanly, HTTP 500 returned. |
| `SEC-EMG-12B`| Integration | Simultaneous worker claiming and post-commit compensation race. | Worker claiming uses conditional state transition; pre-send verification detects session revoked or `compensation_requested` and aborts external provider call (`cancelled_pre_send`). |
| `SEC-EMG-12C`| Integration | Provider acceptance occurs before post-commit compensation execution. | External call cannot be retracted; job transitions to `provider_accepted` and compensation stages mandatory corrective customer alert (`EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE`). Synchronous DB revocation ensures API access remains blocked (`HTTP 403`). |
| `SEC-EMG-12D`| Integration | Post-commit compensation database write failure. | Compensation failure logged to stderr and recorded as observable audit failure (`post_commit_compensation_failed`); middleware fails closed on token use. |
| `SEC-EMG-12E`| Integration | Ambiguous provider outcome during compensation (network timeout while calling provider). | Worker transitions job to `provider_ambiguous_timeout`, avoids assuming cancellation, and stages corrective notification (`EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE`). Operator API access remains blocked. |
| `SEC-EMG-13` | Integration | Notification worker crash recovery via processing lease timeout. | Stale lease (`lease_expires_at <= now`) reclaimed by worker with retry increment. |
| `SEC-EMG-14A`| Integration | Provider idempotency on notification retry. | Identical `job_id` passed as idempotency key on retry; suppresses duplicate customer delivery where provider contract supports idempotency. |
| `SEC-EMG-14B`| Integration | Provider acceptance followed by lost network acknowledgment. | Worker receives timeout, retries with idempotency key; provider contract acknowledges without double dispatch where supported. |
| `SEC-EMG-15` | Integration | Ambiguous provider response (HTTP 500 / timeout). | Job marked `retry_scheduled`, delivery not falsely marked confirmed. |
| `SEC-EMG-16` | Integration | Tenant Workspace Admin invokes `/api/support/sessions/:id/revoke`. | Session status becomes `'revoked'`. Subsequent operator request returns `HTTP 403`. |
| `SEC-EMG-17A`| Integration | Concurrent emergency activation attempts for same tenant caught by controller. | Second request rejected with `HTTP 409 EMERGENCY_SESSION_ALREADY_ACTIVE`. |
| `SEC-EMG-17B`| Integration | Concurrent activations race past application check; partial unique index conflict. | MongoDB enforces mutual exclusion with `E11000` duplicate key conflict; controller traps code 11000 and returns `HTTP 409`. Historical sessions unaffected. |
| `SEC-EMG-17C`| Integration | Pre-activation sweep for expired-but-active records. | Existing session with `expires_at <= now` (or null) and `status: 'active'` is conditionally swept to `'expired'`, freeing partial unique index slot and permitting legitimate new activation. In-memory check rejects expired requests unconditionally. |
| `SEC-EMG-17D`| Integration | Concurrency conflict retry hygiene on `E11000`. | Aborted transaction session is closed, sweep executes on fresh context, activation retries on valid new transaction after re-validating active-session invariant without transaction reuse. |
| `SEC-EMG-18A`| Integration | Trigger 2nd emergency activation for same tenant within 24h rolling window. | Succeeds (`HTTP 200`), logs `emergency_access_high_frequency_alert` to audit ledger and persists `PlatformSecurityAlert`. |
| `SEC-EMG-18B`| Integration | Idempotent session recording in alert record across retries. | Retries and reconciliation update `PlatformSecurityAlert` via `$addToSet: { associated_session_ids }`, guaranteeing `occurrence_count` cannot increment repeatedly for the same session. |
| `SEC-EMG-18C`| Integration | High-frequency alert persistence primary write failure. | Database write error during alert persistence is logged to error telemetry and recorded as fallback audit event `security_alert_persistence_failed`; activation proceeds without blocking. |
| `SEC-EMG-18D`| Integration | Alert persistence double-failure (both primary and fallback fail). | Structured JSON written to stderr, OpenTelemetry metric counter incremented, in-memory queue buffered, non-blocking activation completes, and monitoring gap disclosed. |
| `SEC-EMG-18E`| Integration | Alert dispatch worker claim concurrency, fencing tokens, and crash recovery. | Atomic conditional update (`pending_dispatch` or `retry_scheduled` with `next_run_at <= now` $\rightarrow$ `dispatching`) with unique fencing token prevents duplicate worker claims. Stale worker updates rejected via fencing token. Crashed worker lease expires and is safely reclaimed with honest at-least-once re-transmission (zero false delivery confirmation). Retry exhaustion after 5 attempts transitions to `dispatch_failed` with multi-channel SRE escalation. Distinguishes suppression from external dispatch. |
| `SEC-EMG-19` | Integration | Audit/status mutation write failure during expiry check. | Middleware still rejects expired request with `HTTP 403` (functional expiry independent). |
| `SEC-EMG-20` | Integration | Verify driver PII (Aadhaar, PAN, DL, phone) masked and monetary fields `null`. | Responses verified sanitized server-side across operational endpoints. |
| `SEC-REG-01` | Regression | Normal support request created, approved by tenant admin, activated. | Succeeds 100% per normal workflow; unaffected by emergency policy amendment. |

---

## 14. Comprehensive Acceptance Criteria Checklist

Before this policy can be considered fully implemented (if approved), the following criteria must be satisfied:

- [ ] **Single Super-Admin Activation:** Emergency support access can be activated by the sole Platform Super-Admin without requiring a secondary approver ID.
- [ ] **No Legacy Fallback:** Emergency access strictly utilizes the controlled `SupportAccessRequest` session framework; legacy unconstrained impersonation remains dead and blocked.
- [ ] **Partial Unique Index Mutex, Stale Sweep & Clean Retry:** Database-level mutual exclusion enforced via partial unique index (`company_id: 1` where `status: 'active'` and `is_emergency: true`), with pre-activation conditional sweep of expired or malformed records (`expires_at <= now` or absent/null $\rightarrow$ `'expired'`). In-memory check rejects expired or corrupt sessions with HTTP 403. If `E11000` occurs, aborted transaction is closed, sweep executes on fresh context, and activation retries on a valid new transaction after re-validating the active-session invariant without transaction reuse. Historical sessions remain excluded from index.
- [ ] **15-Minute Hard Cap:** Session expiry is enforced server-side at 15 minutes maximum. Zero renewal, extension, or token refresh permitted.
- [ ] **Mandatory Justification Rule:** Emergency access requires a non-boilerplate incident justification of at least 20 characters.
- [ ] **Operation-Level Read-Only Enforcement:** All mutation HTTP methods, method-override headers/query params, and side-effecting GETs are blocked with HTTP 403.
- [ ] **Complete Privacy Preservation:** Financial route blocks, monetary field redactions (`null`), driver PII masking, and receipt download blockades apply 100% to emergency sessions.
- [ ] **Durable Notification Staging:** Urgent notification job is staged with MongoDB majority write concern (`{ w: "majority", j: true }`) before token generation.
- [ ] **Fail-Closed on Queue Failure:** If notification queue persistence fails, emergency access fails closed with HTTP 503 (`EMERGENCY_NOTIFICATION_FAILED`).
- [ ] **Post-Commit Release & Abort Safety:** Staged notification job is released to `'pending'` only upon successful activation commit, and is marked `'cancelled'` if the transaction aborts.
- [ ] **Bounded Outbox Reconciliation & Quarantine:** Outbox reconciler executes bounded retries (5 attempts over 3m) for `staged_unconfirmed` jobs; transitions to `quarantined_unresolved` if unresolved, triggering audit escalation and defensive revocation so that unconfirmed access cannot be used silently.
- [ ] **Late Resolution Protocol After Quarantine:** Allowed transitions from `quarantined_unresolved` are strictly conditional and idempotent (`cancelled_post_quarantine` or `reconciled_revoked_disclosed`), permanently prohibiting session reactivation, requiring late customer disclosure notification, and keeping API access fail-closed.
- [ ] **Credential Uncertainty Compensation & In-Flight Race:** Post-commit transmission errors trigger compensatory session revocation; conditional states (`pending` $\rightarrow$ `cancelled`, `processing` $\rightarrow$ `compensation_requested`) and worker pre-send checks halt dispatch if not sent; if provider call already in-flight or accepted (`provider_accepted` / `provider_ambiguous_timeout`), truthful corrective notification (`EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE`) is staged distinguishing confirmed delivery from unconfirmed timeouts without false delivery claims; API access fails closed independently.
- [ ] **Worker Crash Recovery & Realistic Delivery:** Notification worker uses time-bounded leases (5m) to recover from crashes, passes unique `job_id` as provider idempotency key where supported, and adheres to at-least-once delivery semantics without false exactly-once claims.
- [ ] **Rolling 24-Hour Alerting, Sliding Deduplication & Fenced Dispatch Claim:** Automated security alert triggered when $\ge 2$ emergency sessions occur in rolling 24 hours, deduplicated via sliding 60-minute window, recorded idempotently via unique session set (`$addToSet: { associated_session_ids }`) without `$inc`, with bounded `E11000` retries, atomic conditional dispatch claims with unique fencing token leases (`dispatch_lease_token`), `retry_scheduled` backoff with `next_run_at`, rejection of stale worker updates via lease fencing, honest at-least-once crash recovery without false delivery claims, observable `dispatch_failed` escalation upon 5 exhausted attempts, clear distinction between alert suppression and external dispatch, and non-blocking operator execution.
- [ ] **Alert Persistence Total Storage Failure Escalation:** If both primary and fallback database alert writes fail, platform does not claim durable persistence exists; escalates via stderr structured JSON, OpenTelemetry counter, and bounded in-memory buffer, with explicit disclosure of monitoring gaps during uncollected container crashes.
- [ ] **Customer Revocation Preserved:** Target tenant Workspace Administrators can revoke active emergency sessions in real time.
- [ ] **Independent Expiry & Malformed Expiry Enforcement:** Rejection of expired sessions functions unconditionally in memory, even if background status updates or audit writes fail. Sessions with missing or malformed `expires_at` fail closed immediately with HTTP 403 (`SUPPORT_SESSION_INVALID_EXPIRY`), trigger defensive revocation, and are audited.
- [ ] **Immutable Audit Logging:** Every emergency request, activation, justification, expiry, revocation, and failure is recorded in `PlatformAuditLog`.
- [ ] **Normal Support Workflow Preserved:** Normal tenant-admin-approved support sessions remain completely isolated and unaffected.
- [ ] **Automated Test Coverage:** Dedicated regression test suite verifies single-admin activation, 15m duration, read-only locks, and notification outbox lifecycle.

---

## 15. Policy Invariants vs. Implementation Engineering Verification Items

> [!NOTE]
> **SPECIFICATION STATUS DECLARATION:**  
> None of the proposed behaviors, schema modifications, state machines, or middleware logic described in this proposal currently exist in application code. The current codebase enforces the legacy dual-Super-Admin policy with a 30-minute duration cap as recorded in Section 2.1. All descriptions in this document represent the target technical specification proposed for implementation once Product Owner approval is granted.

### 15.1 Authoritative Policy Invariants (Non-Negotiable Governance Mandates)
The following elements represent firm policy decisions established by platform governance and require explicit Product Owner ratification:
1. **Single Super-Admin Activation:** Eliminating the dual-admin prerequisite to reflect Fleet Flow's single-operator production topology.
2. **Meaningful 20-Character Justification:** Requiring a non-boilerplate incident declaration of at least 20 characters explaining the operational crisis and customer lockout reason.
3. **15-Minute Hard Session Cap:** Reducing maximum session duration from 30 minutes to 15 minutes, with absolute prohibition of renewal, extension, or token refresh.
4. **Strict Read-Only Diagnostics:** Mandatory multi-layered blocking of all state mutations (POST, PUT, PATCH, DELETE), method-override headers/query parameters, and side-effecting GET routes.
5. **Preserved Batch A Privacy Boundaries:** Absolute lockout of financial routes, full redaction of monetary fields (`null`), permanent masking of driver PII, and blocking of receipt/document downloads.
6. **Durable Notification Staging & Fail-Closed Behavior:** Pre-issuance staging with MongoDB majority write concern (`{ w: "majority", j: true }`) failing closed with HTTP 503 if unacknowledged.
7. **Customer Revocation Authority:** Real-time visibility and instant session termination powers preserved for tenant Workspace Administrators.
8. **Separation from Normal Support:** Complete architectural isolation between normal customer-approved support (`DEC-012 Standard`) and emergency break-glass sessions.

### 15.2 Implementation Details Requiring Engineering Verification (To be verified during development)
The following technical details represent implementation mechanics that must be verified and benchmarked by the engineering team during actual code implementation:
1. **Provider-Specific Idempotency Headers:**
   - Engineering must inspect the specific production notification transport (e.g. SendGrid custom args / client message ID, AWS SES message tags, Twilio WhatsApp client message SID) to confirm exact header schemas and client idempotency support.
2. **Outbox Reconciliation Interval & Architecture:**
   - Engineering must verify whether outbox reconciliation for `staged_unconfirmed` jobs should execute as an in-process sub-routine of `notificationWorker.ts` (polling every 30 seconds) or via an isolated background worker cron.
3. **Comprehensive Side-Effecting GET Route Audit:**
   - Engineering must audit the entire Express router table to catalog any existing `GET` routes that perform asynchronous task queueing, export generation, counter increments, or cache flushes, ensuring each is explicitly registered in the operation-level whitelist/blacklist.
4. **Method-Override Middleware Precedence:**
   - Engineering must verify that `supportSecurityMiddleware` executes prior to any routing or parser middleware that might interpret `_method` query strings or override headers.
5. **Partial Unique Index Syntax, Expiry Sweeps & MongoDB Compatibility:**
   - Verify Mongoose schema definition and MongoDB engine compatibility for the partial unique index on `SupportAccessRequest`: `{ company_id: 1 }` with `unique: true, partialFilterExpression: { status: 'active', is_emergency: true }` and index name `'unique_active_emergency_session_per_tenant'`. Confirm that historical expired and revoked sessions are excluded from the index and duplicate key conflicts (`code: 11000`) are cleanly trapped and translated to `HTTP 409 Conflict`. Validate pre-activation stale/malformed session sweep query performance (`updateMany` with `$or` for `expires_at <= now`, missing, null), and verify clean session abort, fresh context sweep, and valid new transaction retry without transaction reuse on `E11000`.
6. **PlatformSecurityAlert Idempotent Session Set, Fenced Dispatch Claim & Sliding Window Verification:**
   - Verify Mongoose / MongoDB driver atomic behavior for `PlatformSecurityAlert.findOneAndUpdate({ alert_key }, { $setOnInsert: { ... }, $addToSet: { associated_session_ids: accessRequest._id }, $set: { last_session_at: new Date() } }, { upsert: true, new: true })` across replica set deployments. Verify that `associated_session_ids.length` provides an idempotent count without `$inc`, confirm sliding 60-minute suppression window calculation and bounded retry on `E11000`, and benchmark atomic conditional dispatch-claim queries with unique fencing tokens (`dispatch_lease_token`), `retry_scheduled` backoff with `next_run_at`, stale worker fencing rejection, and at-least-once crash recovery re-dispatch.

### 15.3 Identified Operational Risks & Mitigations
1. **Risk of Operator Abuse / Overuse:**
   - *Risk:* Without a second admin check, a single Super-Admin might activate emergency access for non-emergency convenience.
   - *Mitigation:* The customer notification alert cannot be suppressed. Because customer leadership is notified on every emergency entry, unnecessary activations will trigger customer complaints and operational escalation. Furthermore, the 24-hour frequency alert highlights repeated usage.
2. **Tenant Notification Deliverability Gaps:**
   - *Risk:* If a tenant's registered administrative email is dormant, the alert may bounce.
   - *Mitigation:* The notification worker attempts multi-channel dispatch (email and SMS/WhatsApp where registered). A post-incident report review protocol is recommended for all emergency interventions.
3. **Outbox Reconciliation Polling Overhead:**
   - *Risk:* Background polling for unconfirmed outbox jobs adds database query overhead.
   - *Mitigation:* The reconciliation worker only queries jobs with `status: 'staged_unconfirmed'`, supported by a sparse index. In normal operations, zero documents match this query.

---

## 16. Formal Approval Gate

> [!WARNING]
> ### FORMAL APPROVAL GATE: IMPLEMENTATION STRICTLY ON HOLD
> **Execution of code modifications for this emergency support access proposal is strictly unauthorized until final Product Owner review and explicit implementation authorization.**
> 
> - No application source code has been modified.
> - No database migrations or schema alterations have been executed.
> - No route definitions or middleware logic have been altered.
> - No test suites have been modified.
> - The authoritative `DEC-012` decision file remains unchanged.
> - The working tree has been verified via `git status --short`: untracked items are `docs/testing/audit/DEC-012-EMERGENCY-ACCESS-POLICY-PROPOSAL.md` and pre-existing `.tmp_test_fixture_UMI4qX/`; all tracked application code and tests remain 100% clean and unmodified.
> 
> **Next Step:** Await explicit Product Owner authorization before implementing this policy proposal.
