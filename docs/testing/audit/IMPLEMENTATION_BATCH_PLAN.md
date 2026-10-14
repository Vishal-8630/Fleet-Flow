# Fleet Flow — Prioritized Implementation Batch Plan

**Document Type:** Strategic Implementation & Verification Plan  
**Project:** Fleet Flow — Transport Management SaaS  
**Plan Date:** 15 October 2026  
**Governance:** Architecture & Technical Governance Board  
**Execution Posture:** **PLANNING ONLY. Fixes are NOT authorized until explicit user approval.**  
**Strict Invariant:** `FF-ISSUE-058` / `QST-014` (Incognito Session Instability) is scheduled for verification strictly **LAST**.

---

## 1. Implementation Phasing Strategy

Rather than treating the 60 findings as isolated fixes, work is organized into seven modular batches (Batches A through G) and one final runtime verification phase. This structure reflects architectural dependencies: security perimeter first, followed by ledger invariants, core relational state, subscription workflows, operations, regional hubs, and design system polish.

```
┌─────────────────────────────────────────────────────────────┐
│ Batch A: Security, Tenant Isolation & Controlled Support    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch B: Financial Invariants & Accounting Balance Integrity│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch C: Core Fleet Assignments & Trip State Machine Locks  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch D: Subscription Entitlements & Approval Workflows     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch E: Notification Reliability & Support Operations      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch F: Regional Branches & Hub Operational Integration     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Batch G: Design System, Input Trapping & UI/UX Consistency  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Final Phase: Incognito Authentication Runtime Retest        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Batch Specifications

### Batch A: Security, Tenant Isolation & Controlled Support Access

- **Batch ID:** `BATCH-A`
- **Included Items:** `FF-ISSUE-056`, `FF-ISSUE-057`, `DEC-012`, `QST-003`
- **Product Owner Recommended Policies (PROPOSED — PENDING REVIEW):**
  - **Policy A (Emergency Break-Glass Access — Option 1A):** Dual Super-Admin approval (`requested_by !== approved_by`), strictly read-only diagnostics (`diagnostics_readonly`), hard 30 mins duration with zero renewal, mandatory urgent customer notification, immutable audit logging. Proposed formal exception to DEC-012 Principle 2.
  - **Policy A2 (Emergency Notification Delivery Contract — Option 2A / Option A):** Fail closed on durable queue failure. Synchronously persist notification job using MongoDB majority write concern (`{ w: "majority", j: true }`) before issuing emergency token. Durable queue acceptance does not guarantee actual delivery; access must be denied if durable queueing fails (`HTTP 503`).
  - **Policy B (Operational Financial Redaction & Receipt Blockade — Option 3A):** Redact all designated monetary fields from operational API responses during support sessions (`freight_rate_inr`, `driver_advance_inr`, `settlement`, etc.). Preserve approved physical operational metrics (litres, km, locations, statuses). Block receipt URLs (`receipt_url: null`, `toll_receipt_url: null`) and direct receipt file downloads during all support sessions. Block financial routes and exports across all scopes.
  - **Policy C (Extended Permanent Driver PII Masking — Option 4A):** Mandatory server-side masking across direct responses, nested data, reports, exports, and error responses: driver Aadhaar (`XXXX-XXXX-1234`), PAN (`XXXXX1234X`), bank account (`XXXXXX1234`), mobile/emergency phone (`+91 98765 XXXXX`), driving licence (`DL-XXXXXXXXX1234`), DOB, address, and block KYC document photos (`null`) with zero unmasking allowed even with consent.
  - **Policy D (Internal Support Ticket & Lockout Intake — Option 5A):** Mandatory reference to an existing, active Fleet Flow support ticket for target tenant. Reject external CRM/Jira references. For customer lockouts, permit authenticated Super-Admin creation of an internal ticket on customer's behalf after documented out-of-band identity verification, fully logged in audit trail.
  - **Policy E (Database Unavailability Fail-Closed Contract):** Verify session, expiry, revocation, tenant scope, and permissions against database on every request. If database is unreachable or verification cannot complete, fail closed: deny with HTTP 503. Never fail open.
- **Justification:** Platform operators currently possess unrestricted, unscoped impersonation tokens to tenant workspaces without customer administrator approval. Securing customer commercial data is the highest priority before functional fixes.
- **Prerequisites:** None. Must be executed first.
- **Model Dependencies:** Depends on `SupportTicket` model for ticket eligibility validation (independent of Batch E's central support inbox UI).
- **Affected Source Areas:**
  - `backend/src/controllers/superAdminController.ts` (lines 388–446)
  - `backend/src/middleware/authMiddleware.ts` (lines 153–178)
  - `backend/src/models/PlatformAuditLog.ts`
  - `backend/src/models/SupportAccessRequest.ts` (new model)
  - `frontend/src/components/layout/ImpersonationBanner.tsx`
  - `frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx`
  - `frontend/src/pages/settings/CompanySettingsPage.tsx`
- **Acceptance Criteria:**
  1. Super-admins cannot generate an active impersonation token without an approved support request from the tenant workspace admin (or dual Super-Admin approval for Emergency Break-Glass).
  2. Support sessions must specify a maximum duration (max 2 hours standard, 30 mins emergency with zero renewal) and be immediately revocable by either the tenant admin or the operator.
  3. All read and write operations conducted during impersonation must be logged to `PlatformAuditLog` with actor email, IP address, and changed fields.
  4. Impersonation tokens must restrict access to tenant financial records, export endpoints, block receipt images, and mask extended driver PII.
  5. Requests fail closed with HTTP 503 if MongoDB is unreachable during session verification.
- **Required Tests:**
  - `backend/src/tests/security/tenantImpersonation.test.ts`: Verify that unapproved impersonation attempts return 403 Forbidden.
  - Test session expiration, immediate token revocation, extended PII masking, receipt image blocking, and financial route rejection.
- **Risks & Rollback:** Low risk of impacting tenant operations; affects only platform administrative routes. Rollback restores previous `impersonateTenant` handler.
- **User Approval Required:** Scope locked per `DEC-012`. Six proposed policy recommendations are recorded as **PROPOSED — PENDING REVIEW**. Implementation is strictly on **HOLD — DOCUMENTATION ONLY. NO CODE CHANGES AUTHORIZED.**

---

### Batch B: Financial Invariants & Accounting Balance Integrity

- **Batch ID:** `BATCH-B`
- **Included Items:** `FF-ISSUE-042`, `FF-ISSUE-043`, `FF-ISSUE-044`, `FF-ISSUE-045`, `FF-ISSUE-050`, `DEC-004`, `DEC-006`, `DEC-007`, `QST-009`
- **Justification:** Resolves commercial calculation errors, including driver advance deductions for fuel, opening balance desynchronization, unmonitored credit limits, and unexposed deductions on Market Movements.
- **Prerequisites:** Batch A (ensures ledger endpoints are strictly tenant-scoped).
- **Affected Source Areas:**
  - `backend/src/controllers/settlementController.ts` (lines 142–143)
  - `backend/src/controllers/partyController.ts` (lines 449–487)
  - `backend/src/controllers/journeyController.ts` (lines 576–620)
  - `backend/src/controllers/entryController.ts`
  - `backend/src/models/VehicleEntry.ts` (lines 232–240)
  - `frontend/src/pages/operations/VehicleEntryListPage.tsx` (lines 448–460)
  - `frontend/src/pages/commercial/SettlementListPage.tsx`
- **Acceptance Criteria:**
  1. Fuel stops recorded with `payment_mode === 'cash'` are deducted from driver advance balances during settlement calculations.
  2. Modifying a party's `opening_balance` automatically adjusts `current_balance` by the net difference `(new - old)` and logs an audit entry.
  3. Fuel stops post double-entry ledger transactions to respective liability and expense accounts.
  4. Dispatching a trip or issuing an LR for a customer exceeding their `credit_limit` triggers a soft warning modal and permits override exclusively by an authorized Admin, logged in the audit trail (Proposed DEC-007; pending review).
  5. Market Movement listing table renders dedicated columns for `dala_charges` and `kamisan_amount`, fully resolving the unexplained ₹3,000 calculation difference.
- **Required Tests:**
  - `backend/src/tests/unit/settlementCalculations.test.ts`: Verify advance deductions with mixed cash and fuel-card stops.
  - `backend/src/tests/integration/ledgerInvariants.test.ts`: Verify that debit/credit balance invariants hold across all fuel payment modes.
- **Risks & Rollback:** Modifies financial arithmetic. Existing completed settlements must not be retroactively recalculated without migration flags.
- **User Approval Required:** DEC-007 is recorded as **Proposed — Pending Review**. Implementation is not authorized until explicit stakeholder policy approval.

---

### Batch C: Core Fleet Assignments, Driver Handover & Trip State Machine Locks

- **Batch ID:** `BATCH-C`
- **Included Items:** `FF-ISSUE-017`, `FF-ISSUE-018`, `FF-ISSUE-028`, `FF-ISSUE-029`, `FF-ISSUE-030`, `FF-ISSUE-031`, `FF-ISSUE-032`, `FF-ISSUE-035`, `FF-ISSUE-036`, `FF-ISSUE-037`, `FF-ISSUE-038`, `FF-ISSUE-039`, `FF-ISSUE-041`, `DEC-008`, `DEC-009`, `QST-008`, `QST-011`, `QST-013`
- **Justification:** Eliminates dual vehicle assignment anomalies (e.g., Sameer Khan & Rahul Singh defect), enforces atomic Mongoose `$unset` operations, prevents mutations on completed trips, and resolves stale React Query cache synchronization.
- **Prerequisites:** Batch B.
- **Affected Source Areas:**
  - `backend/src/controllers/truckController.ts` (lines 413–416, 492–495)
  - `backend/src/controllers/journeyController.ts` (lines 328–332, 444–446, 483–700)
  - `backend/src/models/Driver.ts`
  - `frontend/src/pages/operations/JourneyListPage.tsx` (lines 98, 121)
  - `frontend/src/pages/operations/JourneyDetailPage.tsx` (lines 103, 700–850)
  - `frontend/src/pages/fleet/TruckDetailPage.tsx`
- **Acceptance Criteria:**
  1. Unassigning a driver uses Mongoose `$unset: { current_truck_id: 1 }` and logs `unassigned_at` timestamp.
  2. Assigning a vehicle to Driver B atomically detaches it from Driver A in a MongoDB ACID session.
  3. Trip sub-resources (milestones, diesel stops, driver expenses) cannot be added or modified when `journey.status === 'completed'`.
  4. Adding a milestone from the roster list invalidates both `['journeys']` and `['journey-detail', id]`, eliminating stale cached views.
  5. Fuel stops and driver cash expenses provide audited edit endpoints with reason logging.
  6. Post-completion trip corrections require Company Admin approval regardless of amount, capturing mandatory reason and audit trail (no Accountant exception or threshold) (Proposed DEC-008; pending review).
- **Required Tests:**
  - `backend/src/tests/integration/driverVehicleSync.test.ts`: Test concurrent vehicle reassignment and historical audit trail generation.
  - `backend/src/tests/integration/journeyLifecycle.test.ts`: Test that post-completion mutations return 400 Bad Request.
- **Risks & Rollback:** Low risk if guarded by transactions. Rollback preserves previous non-atomic queries.
- **User Approval Required:** DEC-008 is recorded as **Proposed — Pending Review**. Implementation is not authorized until explicit stakeholder policy approval.

---

### Batch D: Subscription Entitlements, Idempotency & Approval Workflows

- **Batch ID:** `BATCH-D`
- **Included Items:** `FF-ISSUE-002`, `FF-ISSUE-012`, `FF-ISSUE-023`, `FF-ISSUE-024`, `FF-ISSUE-025`, `FF-ISSUE-026`, `FF-ISSUE-027`, `FF-ISSUE-059`, `DEC-001`, `QST-001`, `QST-002`, `QST-005`, `QST-007`
- **Justification:** Aligns trial provisioning with DEC-001 (7 days), fixes plan-change checkout failures caused by missing idempotency keys, and wires the inert approval workflow engine into trip dispatch.
- **Prerequisites:** Batch C.
- **Affected Source Areas:**
  - `backend/src/controllers/authController.ts` (lines 164, 197)
  - `backend/src/controllers/approvalController.ts`
  - `backend/src/controllers/journeyController.ts`
  - `backend/src/models/ApprovalRule.ts`
  - `frontend/src/pages/settings/BillingPage.tsx` (lines 213, 240, 246)
  - `frontend/src/App.tsx` (lines 213–214)
  - `frontend/src/components/common/FeatureGate.tsx`
- **Acceptance Criteria:**
  1. New company registrations provision an exact 7-day trial period on both `Company` and `Subscription` models.
  2. Plan upgrade API calls attach `x-idempotency-key` header, eliminating 400 Bad Request errors.
  3. Closing the Razorpay checkout window displays a friendly cancellation toast without unhandled exceptions.
  4. PRO-tier modules (Maintenance, Tyres) block unentitled route access at the client layer with an upgrade paywall modal.
  5. Tripping dispatch by a dispatcher user triggers an active `ApprovalRequest` when matching threshold rules exist.
- **Required Tests:**
  - `backend/src/tests/integration/billingIdempotency.test.ts`: Verify duplicate payment callbacks are handled idempotently.
  - `backend/src/tests/integration/approvalTriggers.test.ts`: Verify dispatcher dispatch requires admin approval.
- **Risks & Rollback:** Changes payment verification flow. Must be tested against Razorpay test mode keys.

---

### Batch E: Notification Reliability & Platform Support Operations

- **Batch ID:** `BATCH-E`
- **Included Items:** `FF-ISSUE-020`, `FF-ISSUE-021`, `FF-ISSUE-022`, `FF-ISSUE-054`, `FF-ISSUE-055`, `DEC-011`, `QST-004`, `QST-006`
- **Justification:** Provides SaaS platform operators with a central support ticket triage inbox, refactors distorted ticket form layouts, and establishes reliable webhook receipt tracking and delivery metrics.
- **Prerequisites:** Batch A (super-admin routing) and Batch D.
- **Affected Source Areas:**
  - `backend/src/controllers/supportController.ts`
  - `backend/src/controllers/superAdminController.ts`
  - `backend/src/workers/notificationWorker.ts`
  - `backend/src/controllers/webhookController.ts`
  - `frontend/src/pages/support/SupportTicketsPage.tsx` (lines 119–222)
  - `frontend/src/pages/settings/NotificationLogsPage.tsx`
  - `frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx`
- **Acceptance Criteria:**
  1. Super-admins have access to `/super-admin/support` to triage, view, and reply to customer tickets across all tenants.
  2. Support ticket form and message thread layouts are responsive, eliminating horizontal input clipping.
  3. Notification worker implements exponential backoff retries and dead-letter queuing for undelivered WhatsApp/SMS jobs.
  4. Delivery ratio metrics accurately reflect provider callback statuses without reporting artificial 0% delivery rates.
- **Required Tests:**
  - Test mock webhook ingestion for WhatsApp delivery receipts.
  - Test super-admin support ticket cross-tenant reply synchronization.

---

### Batch F: Regional Branches, Hubs & Operational Numbering

- **Batch ID:** `BATCH-F`
- **Included Items:** `FF-ISSUE-051`, `FF-ISSUE-052`, `FF-ISSUE-053`, `DEC-010`, `QST-012`
- **Justification:** Transitions Regional Branches from an isolated directory into an active operational hub model capable of prefixing LRs, scoping dispatch responsibility, and enabling hub-level performance reporting.
- **Prerequisites:** Batch C (trip lifecycle) and Batch D (invoicing).
- **Affected Source Areas:**
  - `backend/src/models/Branch.ts`
  - `backend/src/models/TruckJourney.ts`
  - `backend/src/models/Invoice.ts`
  - `backend/src/models/Entry.ts`
  - `frontend/src/pages/settings/BranchManagementPage.tsx` (lines 111–212)
  - `frontend/src/pages/operations/NewJourneyPage.tsx`
- **Acceptance Criteria:**
  1. Branch cards include Edit, Deactivate, and Delete actions with permission gating.
  2. Regional branch form layout adheres to standardized design tokens with responsive grid alignment.
  3. Trips and LRs accept an optional `branch_id`, automatically prefixing document serial numbers according to branch rules (`BHW-LR-0001`).
  4. Regional performance filtering is available on the fleet dashboard and trip rosters.
- **Required Tests:**
  - Verify branch document sequence generation under concurrent creation requests.
  - Verify branch deletion restrictions when active journeys are attached.

---

### Batch G: Design System, Input Trapping & UI/UX Consistency

- **Batch ID:** `BATCH-G`
- **Included Items:** `FF-ISSUE-001`, `FF-ISSUE-003` to `FF-ISSUE-011`, `FF-ISSUE-013` to `FF-ISSUE-016`, `FF-ISSUE-019`, `FF-ISSUE-033`, `FF-ISSUE-034`, `FF-ISSUE-040`, `FF-ISSUE-046`, `FF-ISSUE-047`, `FF-ISSUE-048`, `FF-ISSUE-049`, `FF-ISSUE-060`, `QST-010`
- **Justification:** Solves input trapping bugs (numeric fields trapped at zero), unifies badge tokens, eliminates unstyled browser dialogs, aligns public marketing styling with the app design system, and cleans up form layouts.
- **Prerequisites:** Batches A through F.
- **Affected Source Areas:**
  - `frontend/src/pages/marketing/` (all pages)
  - `frontend/src/styles/components/toasts.css` (line 12: z-index update to 1200)
  - `frontend/src/styles/components/modals.css`
  - `frontend/src/styles/components/forms.css`
  - `frontend/src/components/common/Modal.tsx`
  - `frontend/src/pages/operations/NewJourneyPage.tsx` (line 545)
  - `frontend/src/pages/commercial/SettlementListPage.tsx` (lines 615, 627, 639, 650)
  - `frontend/src/pages/commercial/AgingReportPage.tsx`
- **Acceptance Criteria:**
  1. Backspacing numeric fields in journey creation and settlement modals clears the field cleanly without resetting to zero.
  2. Toasts render in front of active modals with accessible dismissal and a minimum 8-second error display.
  3. All native `confirm()` popups are replaced with styled `Modal` confirm variants.
  4. Public marketing pages use CSS custom properties from `variables.css`, eliminating dark gradient clutter.
  5. Duplicate GSTIN, Aadhaar, and phone numbers are rejected with localized validation alerts.
- **Required Tests:**
  - Component unit tests for numeric input clearing and form validation.
  - Visual regression inspection of public marketing pages.

---

### Final Phase: Intermittent Incognito Authentication Runtime Retest

- **Batch ID:** `FINAL-INC-RETEST`
- **Included Items:** `FF-ISSUE-058`, `QST-014`
- **Strict Invariant:** Must be executed **strictly LAST** after all implementation batches (A through G) are complete, deployed, and verified in automated suites.
- **Investigation & Testing Scope:**
  1. Inspect cookie same-site, domain, path, and secure attributes in `authMiddleware.ts` and `authController.ts`.
  2. Inspect `localStorage` vs cookie partition state in browser private browsing windows.
  3. Execute multi-window incognito test matrix across Google Chrome, Mozilla Firefox, Microsoft Edge, and Safari.
  4. Validate session persistence through repeated page reloads, tab duplication, and workspace switching.
- **Acceptance Criteria:**
  - Session remains active across incognito refreshes; data does not blank out or force premature logout.

---

## 3. Dependency & Precedence Matrix

| Batch | Title | Hard Dependencies | Soft Dependencies | Approvals Required |
| :--- | :--- | :--- | :--- | :--- |
| **Batch A** | Security & Support Impersonation | None | None | DEC-012 Scope Sign-off |
| **Batch B** | Financial Invariants & Balances | Batch A | None | DEC-007 Policy Sign-off (Proposed — Pending Review) |
| **Batch C** | Fleet Assignments & Trip Locks | Batch B | Batch A | DEC-008 Policy Sign-off (Proposed — Pending Review) |
| **Batch D** | Subscriptions & Approvals | Batch C | Batch B | None |
| **Batch E** | Notifications & Support Ops | Batch A, Batch D | Batch C | None |
| **Batch F** | Branches & Hub Integration | Batch C, Batch D | Batch B | DEC-010 Integration Sign-off |
| **Batch G** | Design System & UI/UX Polish | Batches A–F | None | None |
| **Final** | Incognito Session Retest | All Batches (A–G) | Full Deployment | None |
