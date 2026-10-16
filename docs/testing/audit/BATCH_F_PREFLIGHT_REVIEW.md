# Fleet Flow — Batch F Preflight Review: Notification Delivery Tracking, Webhooks & Reliable Retries

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `BATCH-F` (Preflight Review & Architectural Plan)  
**Target Architecture:** Multi-Channel Communications, Meta WhatsApp Cloud API Webhooks, Delivery Lifecycle State Machine, Resilient Retry Worker, Metric Aggregations, Platform Support Governance  
**Authoritative Source Register:** [`docs/testing/ISSUE_INDEX.md`](../ISSUE_INDEX.md) (Lines 249–253)  
**Execution Posture:** **STRICTLY READ-ONLY TECHNICAL PREFLIGHT. No application code, schemas, tests, or configurations modified.**  
**Auditor / Governance Authority:** Antigravity Advanced Agentic AI (Pair-Programming Preflight Inspection)  
**Baseline Git Commit:** [`1070969`](https://github.com/Vishal-8630/Fleet-Flow/commit/1070969) (`feat(billing): implement Batch E (E1-E6) subscription security, feature gating, GST pricing, module preferences, and UI toast hardening`) on branch `main`  
**Current Working-Tree Status:** Clean (`nothing to commit, working tree clean`)  
**Preflight Recommendation:** **`ACCEPT` (Pending Product Owner Scope & Phase Alignment)**  

---

## 1. Executive Summary & Purpose

Following the completion, automated test verification (125/125 integration tests passing across 7 suites), production build validation, and Git push of **Batch E (E1–E6)**, this document establishes the authoritative preflight review for **Batch F**.

### 1.1 Core Objectives
1. **Establish the Authoritative Scope:** Determine the exact canonical issues and decisions assigned to Batch F by cross-referencing the master index [`ISSUE_INDEX.md`](../ISSUE_INDEX.md), historical planning documents ([`IMPLEMENTATION_BATCH_PLAN.md`](IMPLEMENTATION_BATCH_PLAN.md), [`ISSUE_AUDIT_REPORT.md`](ISSUE_AUDIT_REPORT.md)), and historical notes.
2. **Reconcile Scope Conflicts:** Disambiguate the historical association of Batch F with platform Super-Admin and support inbox functionality versus notification tracking versus regional branches.
3. **Forensic Code Inspection:** Substantiate reported defects with direct code evidence from backend controllers, models, worker loops, webhook receivers, and frontend pages.
4. **Architectural Hardening Plan:** Define modular, dependency-ordered implementation phases, explicit acceptance criteria, security safeguards, and an automated test strategy before any code is modified.

### 1.2 Central Preflight Findings
1. **Authoritative Master Registry Scope:** Per [`ISSUE_INDEX.md`](../ISSUE_INDEX.md) Section 7 (lines 249–253), canonical Batch F focuses on **Notification Delivery Tracking, Webhooks & Reliable Retries**, encompassing `FF-ISSUE-054`, `FF-ISSUE-055`, `DEC-011`, and `QST-006`.
2. **Confirmed Root Cause of 0% Delivered Ratio (`FF-ISSUE-054`, `QST-006`):** In [`notificationWorker.ts`](../../backend/src/workers/notificationWorker.ts#L184-L196), successful dispatch sets `NotificationJob.status = 'delivered'` but sets `NotificationLog.status = 'sent'`. The delivery logs aggregation controller ([`notificationController.ts`](../../backend/src/controllers/notificationController.ts#L86-L102)) and frontend monitor ([`NotificationLogsPage.tsx`](../../frontend/src/pages/settings/NotificationLogsPage.tsx#L111)) strictly calculate `delivered / total`. Because no webhook callbacks update `NotificationLog.status` to `'delivered'` in development/simulated mode or unverified production setups, the dashboard displays an alarming `0% Delivered Ratio` despite all records showing green `Sent` badges.
3. **Webhook Security & Idempotency Deficiencies (`FF-ISSUE-055`, `DEC-011`):** While [`webhookController.ts`](../../backend/src/controllers/webhookController.ts#L45-L124) accepts WhatsApp status receipts, it **completely lacks cryptographic signature verification** (`X-Hub-Signature-256` HMAC-SHA256 check against `WHATSAPP_APP_SECRET`). It also lacks idempotency deduplication (unlike the billing webhook which records `event_id` in `ProcessedWebhook`), and possesses no protection against out-of-order webhook delivery (e.g., a delayed `delivered` webhook regressing a message that was already marked `read`).
4. **Historical Scope Conflict Analysis (Super Admin Support Inbox vs Notifications):**
   - In early draft notes ([`IMPLEMENTATION_BATCH_PLAN.md`](IMPLEMENTATION_BATCH_PLAN.md) lines 173–195), Notifications and Support Inbox were combined into an earlier "Batch E".
   - When Subscriptions took over the "Batch E" designation, `ISSUE_INDEX.md` partitioned the remaining roadmap: Notifications became **Batch F**, Regional Branches became **Batch G**, and UI form polish became **Batch H**.
   - `FF-ISSUE-022` (Absence of Central Platform-Wide Support Inbox) was originally listed under Batch A (Super-Admin Control Plane) in `ISSUE_INDEX.md` line 222, but was deferred when Batch A focused strictly on `DEC-012` impersonation security and break-glass controls.
   - Code inspection reveals that [`SupportTicket`](../../backend/src/models/SupportTicket.ts) exists, but [`supportController.ts`](../../backend/src/controllers/supportController.ts) filters strictly by `company_id`. Zero platform-level support endpoints exist in [`superAdminRoutes.ts`](../../backend/src/routes/superAdminRoutes.ts), and [`SuperAdminDashboardPage.tsx`](../../frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx) lacks a support triage inbox.
   - This preflight provides an explicit decision gate for the Product Owner to determine whether to execute Batch F strictly as Notifications (Option 1) or to incorporate the deferred Super-Admin Support Inbox into Batch F (Option 2).

---

## 2. Current Git Branch and Working-Tree Baseline

- **Active Branch:** `main`
- **Tracking Branch:** `origin/main` (`https://github.com/Vishal-8630/Fleet-Flow.git`)
- **Baseline Commit:** `1070969` (`feat(billing): implement Batch E (E1-E6) subscription security, feature gating, GST pricing, module preferences, and UI toast hardening`)
- **Working Tree Status:** 100% clean (`nothing to commit, working tree clean`).
- **Active Background Services:** Local development server running on ports 5173 (Vite) and 5000 (Express).
- **Preservation Invariant:** All previous work (Batches A, B, C, and E1–E6) remains intact. No files have been staged, committed, pushed, reset, stashed, cleaned, or reverted.

---

## 3. Authoritative Batch F Scope and Scope Reconciliation

### 3.1 Canonical Master Scope (`ISSUE_INDEX.md` Section 7)

The authoritative master index [`docs/testing/ISSUE_INDEX.md`](../ISSUE_INDEX.md#L249-L253) defines Batch F as:

| Identifier | Type | Canonical Title | Priority | Module | Master Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[FF-ISSUE-054](../issues/notifications/FF-ISSUE-054-notification-delivery-tracking-zero-rate.md)** | Bug / Notifications | Notification Delivery Logs Show Sent Status but Zero Delivered Rate | `High` | Communications & Notification Logs | Observed / Needs Verification |
| **[FF-ISSUE-055](../issues/notifications/FF-ISSUE-055-notification-retry-webhook-lifecycle.md)** | Architecture / Reliability | Notification Delivery System Lacks Comprehensive Lifecycle, Webhook Safety & Retry Policy | `High` | Communications & Notification Engine | Agreed Future Behavior / Not Implemented |
| **[DEC-011](../decisions/DEC-011-notification-delivery-reliability-scope.md)** | Architectural Decision | Notification Delivery Tracking, Webhook Reliability, and Audit Architecture | Approved Policy | Core Architecture / Governance | Scope Locked |
| **[QST-006](../issues/unresolved-questions/QST-006-notification-receipt-ingestion-and-metrics.md)** | Unresolved Question | Notification Delivery Receipt Ingestion and Delivery Rate Calculation | `High` | Notifications & Communications | Investigation Required |

---

### 3.2 Reconciliation of Historical Scope Conflicts

Cross-referencing documentation across the repository reveals three distinct perspectives on Batch F that require explicit formal reconciliation:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PERSPECTIVE COMPARISON MATRIX                               │
├──────────────────────────┬─────────────────────────────┬────────────────────────────────────┤
│ 1. Master Registry Index │ 2. Historical Planning Plan │ 3. Investigated Historical Leads   │
│   (ISSUE_INDEX.md)       │  (IMPLEMENTATION_BATCH_PLAN)│   (BATCH_E Preflight line 70)      │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Batch E: Subscriptions   │ Batch D: Subscriptions      │ Batch A: Impersonation Safeguards  │
│ (COMPLETED E1–E6)        │                             │ (COMPLETED)                        │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Batch F: Notifications   │ Batch E: Notifications &    │ Orphaned Batch A Lead:             │
│ (FF-054, FF-055, DEC-011,│          Support Inbox      │ Platform Super Admin Support Inbox │
│  QST-006)                │ (FF-020, 021, 022, 054, 055)│ (FF-ISSUE-022, QST-004)            │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Batch G: Regional Hubs   │ Batch F: Regional Hubs      │ Legacy Batch F:                    │
│ (FF-051, FF-052, FF-053, │ (FF-051, 052, 053, DEC-010) │ Regional Branches & Hubs           │
│  DEC-010, QST-012)       │                             │ (Now Batch G in Master Index)      │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Batch H: Design & UI/UX  │ Batch G: Design & UI/UX     │ Form Polish:                       │
│ (FF-001, 003-011, etc.)  │                             │ (Now Batch H in Master Index)      │
└──────────────────────────┴─────────────────────────────┴────────────────────────────────────┘
```

#### Detailed Forensic Analysis of the Three Perspectives:

1. **Perspective 1 — The Authoritative Master Registry (`ISSUE_INDEX.md`):**
   - Section 7 of [`ISSUE_INDEX.md`](../ISSUE_INDEX.md#L249-L253) is the central active roadmap. It explicitly assigns `FF-ISSUE-054`, `FF-ISSUE-055`, `DEC-011`, and `QST-006` to **Batch F**.
   - Regional Branches and Hubs are assigned to **Batch G** (`FF-ISSUE-051`, `FF-ISSUE-052`, `FF-ISSUE-053`, `DEC-010`, `QST-012`).
   - General UI/UX forms and styling are assigned to **Batch H** (`FF-ISSUE-001`, `FF-ISSUE-003` to `011`, `FF-ISSUE-013` to `016`, `FF-ISSUE-019` to `021`, etc.).

2. **Perspective 2 — The Historical Planning Plan (`IMPLEMENTATION_BATCH_PLAN.md`):**
   - Created on 15 October 2026 before Batch execution began.
   - It originally had Subscriptions as "Batch D" and combined Notifications with Support Tickets under "Batch E".
   - When the engineering team and user prioritized Subscriptions as **Batch E** (executed across sub-phases E1 through E6), the remaining batches shifted down by one letter, turning Notifications into Batch F and Branches into Batch G.

3. **Perspective 3 — The Investigated Lead (`FF-ISSUE-022` / `QST-004` Platform Support Inbox):**
   - Historical drafting notes and a passing remark in [`BATCH_E_PREFLIGHT_REVIEW.md`](BATCH_E_PREFLIGHT_REVIEW.md#L70) loosely linked Batch F with "platform superadmin and support inbox".
   - `FF-ISSUE-022` ("Absence of Central Platform-Wide Support Inbox for SaaS Operators") was originally registered under Batch A in `ISSUE_INDEX.md` line 222 alongside `FF-ISSUE-056` and `FF-ISSUE-057`.
   - When Batch A was implemented, it strictly addressed tenant impersonation safeguards, break-glass security, and support access authorization requests (`DEC-012`), leaving `FF-ISSUE-022` and `QST-004` deferred and unassigned in Section 7.
   - Both `FF-ISSUE-022` (inbound customer support ticketing) and `FF-ISSUE-054`/`055` (outbound notification delivery) share common operational communications infrastructure and platform operator workflows.

---

## 4. Current Status and Code Evidence for Every In-Scope Item

### 4.1 `FF-ISSUE-054` & `QST-006`: Dispatched "Sent" Status vs 0% Delivered Ratio Bug

- **Severity:** High  
- **Classification:** Confirmed Defect  
- **Expected Behavior:**
  1. The notification engine must accurately distinguish between **Dispatched/Sent** (successfully handed off to provider gateway) and **Delivered** (confirmed arrival on recipient device via provider webhook).
  2. Summary KPI cards on `/settings/notifications/logs` must calculate delivery ratios based strictly on confirmed deliveries, but must explicitly communicate pending delivery confirmations rather than rendering a confusing `0% Delivered Ratio` while rows show green `Sent` badges.
  3. In development, testing, and sandbox environments where outbound webhooks are not connected, the system should either provide simulated webhook ingestion or clearly display `Pending Gateway Confirmation` / `Simulated Dispatch`.
- **Actual Code Evidence:**
  1. **Worker Prematurely Sets `delivered_at` but Leaves `status: 'sent'`:**
     In [`backend/src/workers/notificationWorker.ts`](../../backend/src/workers/notificationWorker.ts#L184-L196):
     ```typescript
     job.status = 'delivered';
     job.provider_message_id = dispatchResult.messageId;
     job.attempts += 1;
     await job.save();

     if (job.notification_log_id) {
       await NotificationLog.findByIdAndUpdate(job.notification_log_id, {
         status: 'sent', // <--- Set to 'sent'
         provider_message_id: dispatchResult.messageId,
         retry_count: job.attempts,
         delivered_at: new Date(), // <--- But delivered_at is stamped!
       });
     }
     ```
  2. **Controller Status Aggregation Excludes `sent` from Delivered Metric:**
     In [`backend/src/controllers/notificationController.ts`](../../backend/src/controllers/notificationController.ts#L86-L102):
     ```typescript
     const stats = { total: 0, delivered: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };

     for (const item of statusAgg) {
       stats.total += item.count;
       if (item._id === 'delivered' || item._id === 'read') stats.delivered += item.count;
       else if (item._id === 'sent') stats.sent += item.count;
       else if (item._id === 'queued') stats.queued += item.count;
       else if (item._id === 'failed') stats.failed += item.count;
       else if (item._id === 'skipped') stats.skipped += item.count;
     }
     ```
  3. **Frontend Strictly Computes `delivered / total`:**
     In [`frontend/src/pages/settings/NotificationLogsPage.tsx`](../../frontend/src/pages/settings/NotificationLogsPage.tsx#L110-L111):
     ```tsx
     const stats = data?.stats || { total: 0, delivered: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };
     const deliveredPercentage = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
     ```
     And renders lines 153–157:
     ```tsx
     <div className="commercial-metric-val" style={{ color: '#059669' }}>
       {deliveredPercentage}%
     </div>
     <div className="commercial-metric-label">Delivered Ratio ({stats.delivered})</div>
     ```
  4. **Simulated Client Never Triggers Webhook Receipt:**
     In [`backend/src/utils/whatsappClient.ts`](../../backend/src/utils/whatsappClient.ts#L147-L158), simulated dispatches generate a synthetic `messageId = wamid.<hex>`, but never trigger an internal mock status transition or webhook callback. As a result, in any non-production environment, `stats.delivered` is permanently `0`, resulting in `0% Delivered Ratio`.

---

### 4.2 `FF-ISSUE-055` & `DEC-011`: Notification Lifecycle, Webhook Security & Retry Policy

- **Severity:** High  
- **Classification:** Confirmed Architectural Defect / Security Gap  
- **Expected Behavior:**
  Per approved policy [`DEC-011`](../decisions/DEC-011-notification-delivery-reliability-scope.md):
  1. **Cryptographic Webhook Verification:** Incoming webhook callbacks from Meta/WhatsApp Cloud API must verify `X-Hub-Signature-256` HMAC-SHA256 signatures against `WHATSAPP_APP_SECRET`.
  2. **Webhook Idempotency & Deduplication:** Webhook payloads must be processed idempotently using provider event/message IDs, preventing duplicate processing from corrupting metrics or audit logs.
  3. **Monotonic State Transitions:** Out-of-order webhooks must not overwrite newer terminal states (e.g., an out-of-order `delivered` event must never downgrade a message that is already in `read` status).
  4. **Categorized Retry Policy:**
     - Transient 5xx server errors and 429 rate limits must be retried with bounded exponential backoff (e.g. 1m, 5m, 15m, 1h) up to 3 attempts.
     - Permanent 4xx errors (e.g. invalid phone number, unregistered WhatsApp user, recipient DND opt-out) must fail fast without retrying.
  5. **Audited Manual Retry Control:** The UI must expose an explicit retry action for failed notifications that preserves audit lineage and links to the original log entry.
- **Actual Code Evidence:**
  1. **Webhook Endpoint Completely Lacks HMAC Signature Verification:**
     In [`backend/src/controllers/webhookController.ts`](../../backend/src/controllers/webhookController.ts#L45-L60):
     ```typescript
     export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
       try {
         const body = req.body;
         if (body.object !== 'whatsapp_business_account' && !body.entry) {
           res.status(200).json({ status: 'ignored' });
           return;
         }
         // NO X-Hub-Signature-256 VERIFICATION!
         // ANY UNAUTHENTICATED CALLER CAN SPOOF DELIVERY RECEIPTS OR INJECT DND COMMANDS!
     ```
  2. **Missing Webhook Idempotency & Deduplication:**
     Unlike billing webhooks which check [`ProcessedWebhook`](../../backend/src/models/ProcessedWebhook.ts) to guarantee exactly-once processing, `handleWhatsAppWebhook` performs no event deduplication. Repeated webhook retries from Meta will trigger duplicate database updates and duplicate console logs.
  3. **Lack of State Transition Monotonicity:**
     In lines 69–84:
     ```typescript
     const updateData: any = { status: newStatus };
     const updatedLog = await NotificationLog.findOneAndUpdate(
       { provider_message_id: messageId },
       { $set: updateData },
       { new: true }
     );
     ```
     If Meta sends a `read` callback at $T_1$, and network latency causes a delayed `delivered` callback to arrive at $T_2$, the status regresses from `read` back to `delivered`.
  4. **Missing Error Categorization in Retry Loop:**
     In [`backend/src/workers/notificationWorker.ts`](../../backend/src/workers/notificationWorker.ts#L201-L240), all errors (whether network timeout or invalid recipient number) are treated identically and scheduled for exponential retries, needlessly exhausting worker cycles on invalid phone numbers.

---

### 4.3 Investigated Lead: Platform Super-Admin Support Inbox (`FF-ISSUE-022`, `QST-004`)

- **Severity:** High  
- **Classification:** Confirmed Design Gap (Orphaned Batch A Capability)  
- **Expected Behavior:**
  1. Platform operators with `is_platform_super_admin: true` must have a centralized cross-tenant Support Inbox in [`SuperAdminDashboardPage.tsx`](../../frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx).
  2. Super-admins must be able to list, search, filter (by tenant, category, priority, status), inspect conversation history, and reply directly to customer support tickets without needing full workspace impersonation.
  3. Two-way message synchronization: Replies posted by platform support agents must appear in the tenant's ticket view ([`SupportTicketsPage.tsx`](../../frontend/src/pages/support/SupportTicketsPage.tsx)) with `sender_role: 'support'`.
- **Actual Code Evidence:**
  1. **Backend Ticket Controller is Hardcoded to Single-Tenant Context:**
     In [`backend/src/controllers/supportController.ts`](../../backend/src/controllers/supportController.ts#L54-L65):
     ```typescript
     export async function listTickets(req: Request, res: Response): Promise<void> {
       const companyId = getTenantId(req);
       const tickets = await SupportTicket.find({ company_id: companyId }) // Strictly single tenant!
     ```
  2. **Super-Admin Route Definitions Omit Ticket Endpoints:**
     In [`backend/src/routes/superAdminRoutes.ts`](../../backend/src/routes/superAdminRoutes.ts), there is a route for creating lockout intake tickets (`/support-tickets/lockout-intake`), but **zero routes exist** for `GET /api/super-admin/support-tickets` or `POST /api/super-admin/support-tickets/:id/reply`.
  3. **Super-Admin UI Lacks Support Inbox:**
     In [`frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx`](../../frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx#L600-L690), the main tab bar includes `tenants`, `modules_overview`, `support_sessions`, and `audit_logs`. There is no ticket triage tab or conversation inbox.

---

## 5. Root-Cause Analysis and Relevant File Paths

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                ROOT CAUSE TOPOLOGY                                     │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ Defect / Gap                   │ Underlying Architectural Cause                        │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 1. 0% Delivered Ratio          │ 1. notificationWorker.ts stamps delivered_at but      │
│    (FF-ISSUE-054, QST-006)     │    saves status: 'sent'.                              │
│                                │ 2. Controller and Frontend compute delivered / total; │
│                                │    'sent' is excluded from numerator.                 │
│                                │ 3. Local/sandbox mode lacks simulated webhook receipts│
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Insecure & Non-Idempotent   │ 1. webhookController.ts does not check                │
│    Webhooks (FF-055, DEC-011)  │    X-Hub-Signature-256 HMAC header.                   │
│                                │ 2. No ProcessedWebhook deduplication tracking.        │
│                                │ 3. Unconstrained status updates allow state regression │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Missing Super-Admin Support │ 1. supportController.ts requires companyId.           │
│    Inbox (FF-022, QST-004)     │ 2. superAdminRoutes.ts has no ticket endpoints.       │
│                                │ 3. SuperAdminDashboardPage.tsx has no support tab.    │
└────────────────────────────────┴───────────────────────────────────────────────────────┘
```

### Key Source Files Affected:

#### Communications & Notification Subsystem (Canonical Batch F):
- `backend/src/controllers/notificationController.ts` — Log pagination, filter queries, KPI metric calculation.
- `backend/src/controllers/webhookController.ts` — Inbound WhatsApp webhook verification and status receipts.
- `backend/src/workers/notificationWorker.ts` — Queue worker, backoff calculation, retry policies, status stamping.
- `backend/src/models/NotificationLog.ts` — Notification audit schema and status enums.
- `backend/src/models/NotificationJob.ts` — Persistent job queue and retry tracking schema.
- `backend/src/models/ProcessedWebhook.ts` — Idempotency ledger for incoming provider events.
- `backend/src/utils/whatsappClient.ts` — Meta Cloud API client, HMAC validation helper, simulated dispatch/webhook generator.
- `frontend/src/pages/settings/NotificationLogsPage.tsx` — Delivery monitor UI, KPI ribbons, log table, manual retry action.

#### Platform Support & Ticketing Subsystem (Investigated Lead):
- `backend/src/controllers/supportController.ts` — Customer support ticket operations.
- `backend/src/controllers/superAdminController.ts` — Super-admin management operations.
- `backend/src/routes/superAdminRoutes.ts` — Super-admin REST routing.
- `backend/src/models/SupportTicket.ts` — Ticket and conversation message schema.
- `frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx` — Super-admin dashboard tabs and command center.
- `frontend/src/pages/support/SupportTicketsPage.tsx` — Tenant-facing support desk and message thread.

---

## 6. Dependencies on Earlier Batches and Existing Architecture

1. **Batch A Security Architecture (`DEC-012`):**
   - The notification worker already integrates DEC-012 Outbox leasing and pre-send compensation checks (`session_id` revocation checks in `notificationWorker.ts` lines 86–96).
   - Any modifications to `notificationWorker.ts` must strictly preserve DEC-012 emergency access notification handling (`EMERGENCY_ACCESS_GRANTED`, `EMERGENCY_ACCESS_ABORTED_CREDENTIAL_FAILURE`).
2. **Batch E Webhook Idempotency Patterns:**
   - In Batch E, `ProcessedWebhook` was hardened with cryptographic HMAC verification and replay protection for Razorpay billing webhooks.
   - The WhatsApp webhook subsystem in Batch F should reuse the proven `ProcessedWebhook` model pattern (`event_id` or `provider_message_id + status`).
3. **MongoDB Replica Set Invariant (`DEC-002`):**
   - All state transitions across `NotificationJob`, `NotificationLog`, and `ProcessedWebhook` must execute within MongoDB ACID sessions (`startSession()`) where cross-document consistency is required.
4. **Tenant Isolation Invariant:**
   - Inbound webhook processing must match `provider_message_id` without exposing or leaking cross-tenant payload data.

---

## 7. Security, Tenant-Isolation, and Regression Risks

| Risk Category | Severity | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Webhook Spoofing** | Critical | Unauthenticated attackers send fake delivery receipts or inject malicious DND opt-out commands. | Mandatory `X-Hub-Signature-256` HMAC-SHA256 verification using `WHATSAPP_APP_SECRET`. Reject unverified requests with HTTP 401. |
| **State Regression** | Medium | Out-of-order network arrival downgrades a `read` message back to `delivered`. | Enforce monotonic status hierarchy: `queued` < `sent` < `delivered` < `read`. Prevent backward transitions. |
| **Worker Starvation** | High | Unretriable errors (e.g. invalid phone format) loop infinitely in the retry queue. | Categorize errors: fail fast on 4xx / permanent client errors; retry only on transient 5xx / 429 gateway errors. |
| **DEC-012 Outbox Regression** | Critical | Modifying notification dispatch breaks emergency access outbox lease fencing. | Preserve all existing DEC-012 compensation checks in `notificationWorker.ts`. Execute full `batchASecurity.test.ts` suite. |
| **Cross-Tenant Data Exposure** | High | Super-Admin support inbox allows operator to see tenant tickets without authorization checks. | Restrict platform support routes strictly to `requireSuperAdmin`. Ensure ticket queries do not bypass platform audit logging. |

---

## 8. Proposed Implementation Phases Ordered by Dependency

We recommend structuring Batch F into **four core phases** for the canonical Notifications scope, with an **optional fifth phase** if the Product Owner approves including the deferred Super-Admin Support Inbox:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F1: Webhook Ingestion Security, Signature & Idempotency          │
│ - HMAC-SHA256 signature verification (X-Hub-Signature-256)             │
│ - ProcessedWebhook idempotency deduplication                           │
│ - Monotonic state transition guards (no status regression)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F2: Notification Lifecycle State Machine & Resilient Retries     │
│ - Distinguish transient 5xx vs permanent 4xx failures                  │
│ - Bounded exponential backoff retry queue execution                    │
│ - Stamping log status: 'sent' on dispatch, 'delivered' on webhook      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F3: Accurate Delivery Metrics & Local Simulated Webhook Engine   │
│ - Metric calculator: Dispatched, Delivered, Pending Confirmation, Failed│
│ - Local test/dev simulated webhook callback generator                  │
│ - Zero artificial 0% Delivered Ratios in non-production environments   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F4: Frontend Notification Delivery Monitor Hardening             │
│ - KPI ribbon with 'Pending Confirmation' status indicator              │
│ - Visual timeline for Sent -> Delivered -> Read in preview modal       │
│ - Audited one-click manual retry button for failed dispatches          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Conditional Gate: Product Owner Review)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F5 (Optional): Platform-Wide Support Inbox for SaaS Operators    │
│ - GET /api/super-admin/support-tickets cross-tenant triage endpoint    │
│ - POST /api/super-admin/support-tickets/:id/reply platform support     │
│ - Central Support Inbox tab in SuperAdminDashboardPage.tsx             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Explicit Acceptance Criteria by Phase

### Phase F1 — Webhook Ingestion Security, Signature Verification & Idempotency
- [ ] `POST /api/webhooks/whatsapp` validates the `X-Hub-Signature-256` header against `process.env.WHATSAPP_APP_SECRET` using `crypto.createHmac('sha256', secret)`.
- [ ] Requests with missing or invalid signatures are rejected with HTTP 401 Unauthorized in production environments.
- [ ] Webhook payloads record their event identifier in `ProcessedWebhook`. Duplicate webhook deliveries return HTTP 200 `{ status: 'duplicate_ignored' }` without duplicate mutations.
- [ ] Monotonic state guard prevents a status regression: if a log is already `read`, an incoming `delivered` webhook does not overwrite the status.

### Phase F2 — Delivery Lifecycle & Resilient Retry Policy (`DEC-011`)
- [ ] `notificationWorker.ts` correctly stamps `status: 'sent'` on `NotificationLog` upon gateway acceptance, leaving `delivered_at` unpopulated until confirmed.
- [ ] When a delivery receipt webhook is received, `NotificationLog.status` transitions to `'delivered'` and stamps `delivered_at`.
- [ ] Transient errors (HTTP 500, 502, 503, 504, 429) retry up to 3 times with exponential backoff (60s, 300s, 900s).
- [ ] Permanent errors (HTTP 400, invalid phone number, user opted out) immediately transition to `status: 'failed'` / `'skipped'` without scheduling retry attempts.
- [ ] Existing DEC-012 emergency access session outbox checks and compensation mechanisms continue to execute without regressions.

### Phase F3 — Accurate Delivery Metrics & Simulated Webhook Delivery Engine
- [ ] `getNotificationLogs` computes delivery statistics reflecting: `total`, `sent` (pending receipt), `delivered`, `read`, `failed`, `skipped`.
- [ ] `Delivered Ratio` metric calculates strictly `delivered / (total - skipped)`.
- [ ] In development or simulated environments (`SIMULATE_WHATSAPP=true` or missing credentials), an automated simulated delivery receipt can be triggered or scheduled to transition simulated messages to `delivered` after a brief delay (e.g. 1000ms), eliminating artificial `0%` delivery rates during testing.

### Phase F4 — Frontend Delivery Monitor UI Hardening (`NotificationLogsPage.tsx`)
- [ ] Top KPI ribbon displays:
  - **Total Dispatched**
  - **Delivered Ratio** (with count of confirmed deliveries)
  - **Pending Confirmation** (sent to gateway, awaiting delivery receipt)
  - **Failed Deliveries**
  - **Skipped / DND**
- [ ] Message preview modal displays a clear visual delivery timeline: `Queued` → `Dispatched` (`sent_at`) → `Delivered` (`delivered_at`) → `Read`.
- [ ] Failed messages expose a direct "Retry Dispatch" button that queues an audited retry job.

### Phase F5 (Conditional / Optional) — Platform Support Inbox (`FF-ISSUE-022`, `QST-004`)
- [ ] Super-admins can access a dedicated "Support Inbox" tab in `SuperAdminDashboardPage.tsx`.
- [ ] Cross-tenant ticket list supports search, filter by company/tenant, category, priority, and status.
- [ ] Platform operators can reply to tickets with `sender_role: 'support'`. Replies appear in the customer tenant view.
- [ ] Ticket resolution updates ticket status and records audit log entries.

---

## 10. Automated Test Strategy

To guarantee zero regressions and comprehensive coverage, Batch F will implement a dedicated integration test suite:

### Test Suite: `backend/src/tests/integration/phase6BatchFNotificationTracking.test.ts`

1. **Webhook Security & HMAC Verification:**
   - Test that `POST /api/webhooks/whatsapp` rejects requests with invalid `X-Hub-Signature-256` with HTTP 401.
   - Test that requests with valid HMAC-SHA256 signatures are accepted with HTTP 200.
2. **Webhook Idempotency & Deduplication:**
   - Test that sending identical delivery status payloads twice executes only one database update and records exactly one `ProcessedWebhook` entry.
3. **Monotonic State Transitions:**
   - Ingest a `read` receipt, then simulate a delayed `delivered` receipt for the same message ID. Verify status remains `read`.
4. **Retry Loop Error Categorization:**
   - Simulate a transient 503 error: verify job is re-scheduled with `next_run_at` in the future and `attempts: 1`.
   - Simulate an invalid phone number error (400): verify job immediately fails permanently with `attempts: 1` and zero future runs.
5. **Metric Calculation Accuracy:**
   - Create 4 messages: 2 delivered, 1 sent (pending), 1 skipped. Verify API reports `total: 4`, `delivered: 2`, `sent: 1`, `skipped: 1`, and `deliveredRatio: 67%` (2 / (4 - 1)).
6. **DEC-012 Non-Regression:**
   - Verify that emergency access notifications continue to pass lease fencing and trigger proper audit logs.

### Regression Verification:
- Run all 7 existing integration suites:
  - `batchASecurity.test.ts`
  - `phase5BatchE1TrialSecurity.test.ts`
  - `phase5BatchE2FeatureGating.test.ts`
  - `phase5BatchE3PaymentIdempotency.test.ts`
  - `phase5BatchE4PricingGstSecurity.test.ts`
  - `phase5BatchE5CompanyModules.test.ts`
  - `phase5BatchE6UiAndToastHardening.test.ts`
  - `phase5SubscriptionGating.test.ts`
- Total passing tests must remain at **125+ passing tests** with 0 failures.

---

## 11. Manual Acceptance Checklist

```markdown
- [ ] 1. Open /settings/notifications/logs as tenant admin.
- [ ] 2. Trigger an automated notification (e.g. generate LR or dispatch trip).
- [ ] 3. Observe new row in Notification Logs table with status "Sent" and pending delivery receipt.
- [ ] 4. In simulated test mode, verify message transitions to "Delivered" with delivery timestamp.
- [ ] 5. Confirm Delivered Ratio KPI card updates accurately without showing artificial 0%.
- [ ] 6. Inspect Message Preview modal: verify provider message ID, channel, and timeline timestamps.
- [ ] 7. POST /api/webhooks/whatsapp with forged signature: verify immediate rejection with HTTP 401.
- [ ] 8. POST /api/webhooks/whatsapp with valid signature: verify message status transitions to 'delivered' or 'read'.
- [ ] 9. Send duplicate webhook: confirm status is preserved and no duplicate mutations occur.
```

---

## 12. Decisions Requiring Product Owner Approval

Before implementation begins, the Product Owner must resolve three key technical and scope governance decisions:

### Decision F-DEC-1: Canonical Scope vs Extended Scope (Support Inbox)
- **Option 1A (Strict Canonical Scope — Recommended Baseline):**  
  Execute Batch F strictly as **Notification Delivery Tracking, Webhooks & Reliable Retries** (`FF-ISSUE-054`, `FF-ISSUE-055`, `DEC-011`, `QST-006`). Leave `FF-ISSUE-022` (Super-Admin Support Inbox) as an independent future batch.  
  *Pros:* Keeps Batch F tightly focused, low risk, and fast to implement and verify.
- **Option 1B (Unified Communications & Support Batch):**  
  Expand Batch F to include Phase F5 (`FF-ISSUE-022`, `QST-004`, and tenant support ticket layouts `FF-ISSUE-020`, `FF-ISSUE-021`).  
  *Pros:* Solves both inbound customer support and outbound notifications in a single pass, giving platform operators complete communications oversight.  
  *Cons:* Increases scope by ~400 lines of frontend/backend code.

### Decision F-DEC-2: Local Simulated Webhook Delivery Mechanism
- In development and local test environments, live Meta webhooks cannot reach `localhost:5000` without an external tunnel (e.g. ngrok).
- **Recommendation:** When `NODE_ENV !== 'production'` and `SIMULATE_WHATSAPP === 'true'`, have the simulated client schedule an asynchronous internal delivery receipt after 500ms. This ensures developer and QA testing sees realistic `Delivered` transitions and delivery ratio calculations without requiring live WhatsApp Cloud API credentials.

### Decision F-DEC-3: Webhook Secret Enforcement in Non-Production
- **Recommendation:** Require `WHATSAPP_APP_SECRET` in production (`NODE_ENV === 'production'`) and fail closed with HTTP 500 if missing. In development/test mode, provide a default fallback dev secret (`dev_whatsapp_webhook_secret`) to enable automated test execution without mandatory environment injection.

---

## 13. Explicit Out-of-Scope Items

To prevent scope creep, the following items are strictly excluded from Batch F:

1. **`FF-ISSUE-058` / `QST-014` (Incognito Authentication & Session Instability):**  
   Per the strict project governance rule, incognito session testing must occur strictly **LAST** after all other implementation batches (A through H) are deployed and verified.
2. **Regional Branches, Hubs & Operational Numbering (`FF-ISSUE-051`, `FF-ISSUE-052`, `FF-ISSUE-053`, `DEC-010`, `QST-012`):**  
   Belongs strictly to **Batch G** per `ISSUE_INDEX.md` line 254.
3. **Public Marketing Redesign & General UI Form Polish (`FF-ISSUE-001`, `FF-ISSUE-003` to `011`, `FF-ISSUE-040`, `FF-ISSUE-046`):**  
   Belongs strictly to **Batch H** per `ISSUE_INDEX.md` line 259.
4. **Bulk Marketing Broadcast Systems:**  
   Batch F covers transactional notifications only (LRs, dispatches, deliveries, settlements). Bulk marketing broadcasts are excluded per `DEC-011` Section 7.

---

## 14. Risks, Assumptions, and Unresolved Conflicts Summary

1. **Reconciliation Confirmed:** We have resolved the discrepancy between the old `IMPLEMENTATION_BATCH_PLAN.md` (which called Regional Branches "Batch F") and the master `ISSUE_INDEX.md` (which designates Notifications as "Batch F"). All work is governed by `ISSUE_INDEX.md`.
2. **Meta Cloud API Versioning:** The implementation assumes Meta WhatsApp Cloud API v20.0 webhook payload schema (`entry[].changes[].value.statuses[]`).
3. **Zero Disruptions to DEC-012:** The emergency support access outbox lease runner relies on `NotificationJob`. All changes will be additive and covered by regression tests against `batchASecurity.test.ts`.

---

## 15. Final Recommendation and Implementation Authorization Gate

### Technical Verdict: `ACCEPT` (Preflight Complete — Ready for Authorization)

The technical inspection is complete. All reported defects in notification delivery tracking and webhook handling have been forensically substantiating in the codebase. The implementation plan is structured into modular, isolated, testable phases.

```
══════════════════════════════════════════════════════════════════════════════
               TECHNICAL PREFLIGHT COMPLETE — STOP FOR REVIEW                 
══════════════════════════════════════════════════════════════════════════════
  • Working Tree: CLEAN (No code modified, nothing staged, committed or pushed)
  • Automated Suites: 125/125 tests passing
  • Document Created: docs/testing/audit/BATCH_F_PREFLIGHT_REVIEW.md
  • Awaiting Product Owner Sign-off on:
      1. Scope Option (Option 1A Notifications Only vs Option 1B with Support Inbox)
      2. Decision F-DEC-2 (Local Simulated Webhook Callback Mechanism)
      3. Implementation Authorization for Phase F1
══════════════════════════════════════════════════════════════════════════════
```
