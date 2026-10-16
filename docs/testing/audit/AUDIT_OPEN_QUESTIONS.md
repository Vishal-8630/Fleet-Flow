# Fleet Flow — Audit Open Questions & Product Decisions Registry

**Document Type:** Formal Register of Open Technical & Product Governance Questions  
**Project:** Fleet Flow — Transport Management SaaS  
**Audit Reference:** [`ISSUE_AUDIT_REPORT.md`](ISSUE_AUDIT_REPORT.md)  
**Last Updated:** 15 October 2026  
**Governance:** Product Management & Engineering Architecture  

---

## 1. Overview & Classification

During the read-only code and test audit, several behaviors were identified that cannot be resolved solely through static source inspection or safe, non-mutating test commands. These items represent **business policy choices, operational protocols, or infrastructure dependencies** that require stakeholder alignment before implementation.

---

## 2. Register of Open Questions

### OPN-001: Root Cause & Fix Verification for Incognito Session Drops
- **Related Items:** `FF-ISSUE-058`, `QST-014`
- **Current Observation:** Intermittent session dropouts and blank data screens were reported during manual testing under browser Incognito/Private mode upon page refreshes.
- **Missing Evidence:** Static inspection reveals `useAuthStore` uses `GET /api/auth/me` on mount and stores `active_company_id` in `localStorage`. In browser private modes, third-party cookie restrictions, partitioned storage, or same-site cookie handling may purge the JWT cookie or restrict `localStorage`.
- **Safest Way to Obtain Evidence:** Perform controlled runtime matrix testing across Chrome Incognito, Firefox Private Window, and Safari Private Browsing with browser DevTools Application/Network tabs open.
- **Execution Invariant:** Per user instructions, **this runtime verification must be conducted strictly LAST** after all implementation batches (A through G) are completed.

---

### OPN-002: Production S3 & Object Storage Enforcement (DEC-003)
- **Related Items:** `DEC-003`, `backend/src/middleware/uploadMiddleware.ts`
- **Current Observation:** The application currently falls back to local disk storage (`uploads/`) when AWS S3 environment variables are absent.
- **Proposed Product Owner Position (Pending Review):** **No decision yet.** Production storage requirements must be reviewed before choosing the final approach.
  - Do not assume AWS S3 is approved.
  - Do not assume local-disk fallback is approved.
  - Preserves the pending status until infrastructure requirements, hosting models, and compliance needs are reviewed and explicit approval is provided.
- **Safest Way to Obtain Evidence:** Complete infrastructure and hosting topology review before requesting formal sign-off.

---

### OPN-003: Operational Protocol for Mid-Trip Driver Handover (FF-ISSUE-030) [RESOLVED — Batch C]
- **Status:** **RESOLVED** (Implemented in Batch C — Commit `79d8a30`)
- **Related Items:** `FF-ISSUE-030`, `backend/src/controllers/journeyController.ts`, `backend/src/tests/integration/driverLifecycleAndSwap.test.ts`
- **Resolution:** Implemented structured driver swap workflow requiring odometer reading, reason, and location. Updates driver statuses, vehicle pointer, releases driver unallocated pool, and records immutable audit log under transaction.

---

### OPN-004: Trip-Level Customer Linkage vs Multi-Consignor Manifests (FF-ISSUE-041)
- **Related Items:** `FF-ISSUE-041`, `DEC-009`, `backend/src/models/TruckJourney.ts`
- **Current Observation:** `TruckJourney` contains an optional `billing_party_id`. However, in full-truckload (FTL) vs less-than-truckload (LTL) logistics:
  - FTL trips typically serve a single consignor who pays the freight contract rate.
  - LTL / parcel trips carry multiple LRs, each billed to different consignors or consignees.
- **Missing Evidence:** Is `billing_party_id` on the trip intended solely for single-customer FTL dedicated contracts, or should trips omit customer linkage and derive all commercial billing strictly from attached Lorry Receipts (LRs) per `DEC-009`?
- **Safest Way to Obtain Evidence:** Align with product management on whether FTL trip-level contract billing should coexist with multi-LR aggregated invoicing.

---

### OPN-005: Market Movement vs Owned-Fleet Architecture Convergence (FF-ISSUE-047)
- **Related Items:** `FF-ISSUE-047`, `backend/src/models/VehicleEntry.ts`, `backend/src/models/TruckJourney.ts`
- **Current Observation:** The application maintains two separate modules: "Trip Dispatch" (`TruckJourney`) for owned fleet, and "Market Movements" (`VehicleEntry`) for third-party brokerage/hired trucks. The UI presents overlapping terminology, confusing operators.
- **Missing Evidence:** Should "Market Movements" remain a permanent, lightweight standalone registry optimized for quick brokerage entries, or should it eventually merge into the unified `TruckJourney` data model with an `ownership_type: 'market' | 'owned'` discriminator?
- **Safest Way to Obtain Evidence:** Product roadmap review. Recommended path: keep separate models in Batches B and C to avoid database schema disruption, while adding clear UI guidance.

---

### OPN-006: Local Webhook Delivery Simulation for Notifications (FF-ISSUE-054, QST-006)
- **Related Items:** `FF-ISSUE-054`, `QST-006`, `DEC-011`, `backend/src/workers/notificationWorker.ts`
- **Current Observation:** Notification Delivery Logs report a 0% delivery rate in local development because WhatsApp and SMS webhook delivery callbacks from providers cannot reach `localhost`.
- **Missing Evidence:** Do staging and QA environments have public HTTPS tunnels (e.g. ngrok or cloud staging gateways) configured to ingest actual provider webhooks, or should a mock webhook delivery receipt generator be built for development/test environments?
- **Safest Way to Obtain Evidence:** Technical lead confirmation on whether to add a `POST /api/webhooks/mock-delivery-receipt` utility for development testing.

---

### OPN-007: Credit Limit Warning vs Hard-Stop Enforcement Policy (DEC-007, FF-ISSUE-045) [RESOLVED — Batch B]
- **Status:** **RESOLVED** (Implemented in Batch B — Commit `f6dd446`)
- **Related Items:** `FF-ISSUE-045`, `DEC-007`, `backend/src/models/BillingParty.ts`, `backend/src/tests/integration/creditLimitEnforcement.test.ts`
- **Resolution:** Implemented DEC-007 Option B (Soft warning with authorized Admin override). Credit exposure is validated at dispatch, requiring Admin approval with mandatory reason justification when credit limits are exceeded.

---

### OPN-008: Authorization Threshold for Completed Trip Corrections (DEC-008, QST-013) [RESOLVED — Batch C]
- **Status:** **RESOLVED** (Implemented in Batch C — Commit `79d8a30`)
- **Related Items:** `DEC-008`, `QST-013`, `backend/src/controllers/journeyController.ts`, `backend/src/tests/integration/completedTripAdjustments.test.ts`
- **Resolution:** Implemented DEC-008. Routine operational mutations on completed journeys are rejected at backend level. Corrections require Company Admin approval with mandatory reason and produce immutable audit log entries.

---

### OPN-009: Emergency Support Access Authorization & Break-Glass (DEC-012 Policy A) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `FF-ISSUE-057`, `backend/src/controllers/supportAccessController.ts`, `backend/src/tests/integration/batchASecurity.test.ts`
- **Resolution:** Implemented Option 1A (Dual Super-Admin Break-Glass Access). Emergency access requires two distinct Super-Admin accounts (`requested_by !== approved_by`), is restricted to read-only diagnostics (`diagnostics_readonly`), capped at 30 minutes with zero extension, with mandatory customer notification and immutable audit logging.

---

### OPN-010: Emergency Support Access Notification Delivery Contract (DEC-012 Policy A2) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `FF-ISSUE-057`, `backend/src/controllers/supportAccessController.ts`
- **Resolution:** Implemented Option 2A via Option A (Synchronous MongoDB Majority Write Concern `{ w: "majority", j: true }`) to persist urgent notification jobs before issuing break-glass emergency tokens, failing closed if durable queueing cannot complete.

---

### OPN-011: Operational Financial Field Classification & Receipt Image Blockade (DEC-012 Policy B) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `backend/src/middleware/tenantContext.ts`
- **Resolution:** Implemented Option 3A (Complete Financial Blindness). Pure financial routes return 403 Forbidden; operational monetary fields (`freight_rate_inr`, `driver_advance_inr`, `diesel_expenses[].cost`, etc.) are redacted to `null`; receipt URLs and receipt-image access endpoints are blocked at the server level.

---

### OPN-012: Extended Driver PII Masking & Complete Inventory (DEC-012 Policy C) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-034`, `backend/src/middleware/tenantContext.ts`
- **Resolution:** Implemented Option 4A (Permanent server-side driver PII masking without exceptions). Driving licenses, Aadhaar, PAN, phone numbers, bank accounts, and addresses are masked; KYC document URLs are suppressed.

---

### OPN-013: Support Ticket Validation & Customer Lockout Intake (DEC-012 Policy D) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-022`, `FF-ISSUE-057`, `backend/src/controllers/supportAccessController.ts`
- **Resolution:** Implemented Option 5A. Support access requests require an active internal `SupportTicket` belonging strictly to the target tenant. In customer lockout scenarios, authenticated Super-Admins may initiate ticket intake with documented out-of-band verification.

---

### OPN-014: Database Unavailability & Verification Fail-Closed Contract (DEC-012 Policy E) [RESOLVED — Batch A]
- **Status:** **RESOLVED** (Implemented in Batch A — Commits `52404f1`, `72bc74a`)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `backend/src/middleware/tenantContext.ts`
- **Resolution:** Implemented Fail-Closed Verification Contract. Support session validity is verified against the database on each request; if the database is unreachable or times out, the middleware immediately fails closed with `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.

