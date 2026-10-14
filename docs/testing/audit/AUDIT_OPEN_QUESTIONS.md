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

### OPN-003: Operational Protocol for Mid-Trip Driver Handover (FF-ISSUE-030)
- **Related Items:** `FF-ISSUE-030`, `backend/src/controllers/journeyController.ts`
- **Current Observation:** `TruckJourney` currently binds a single `driver_id` from dispatch to POD closeout. In practical Indian road logistics, drivers may fall sick, face emergency leave, or hand over vehicles at intermediate regional hubs.
- **Missing Evidence:** Business workflow requirements for driver handover:
  1. What fields must be logged during handover? (Handover odometer, handover location, fuel dip reading, physical vehicle condition notes, new driver digital signature)?
  2. How are en-route cash advances split between the departing driver and the replacement driver for subsequent settlement reconciliation?
- **Safest Way to Obtain Evidence:** Product interview with commercial fleet operations team to draft a formal Driver Handover Specification before implementing backend endpoints.

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

### OPN-007: Credit Limit Warning vs Hard-Stop Enforcement Policy (DEC-007, FF-ISSUE-045)
- **Related Items:** `FF-ISSUE-045`, `DEC-007`, `backend/src/models/BillingParty.ts`
- **Current Observation:** `credit_limit` is stored on `BillingParty` but is completely unenforced during LR creation and trip dispatch.
- **Proposed Product Owner Policy (Pending Review):** **Soft warning with authorized Admin override.**
  - Warn users with an advisory modal when a customer's credit limit is exceeded.
  - Permit an override only by an appropriately authorized Company Admin.
  - Record the override and its justification reason in the immutable audit trail, consistent with the approved security architecture.
  - Do not implement this policy yet.
- **Safest Way to Obtain Evidence:** Validate modal UX and backend authorization checks during Batch B implementation once formally authorized.

---

### OPN-008: Authorization Threshold for Completed Trip Corrections (DEC-008, QST-013)
- **Related Items:** `DEC-008`, `QST-013`, `backend/src/controllers/journeyController.ts`
- **Current Observation:** Decision `DEC-008` states that completed trips must lock against routine operational actions, and late entries require authorized reason logging.
- **Proposed Product Owner Policy (Pending Review):** **Company Admin approval is required for every post-completion trip correction, regardless of amount.**
  - Routine actions on completed trips remain restricted according to the decision.
  - Late corrections must require Company Admin approval.
  - Preserve the requirement for a reason and an auditable record of the correction.
  - Do **NOT** introduce an Accountant exception or an amount-based threshold.
  - Do not implement this policy yet.
- **Safest Way to Obtain Evidence:** Include Admin-only approval rule in the Batch C trip locking specification.

---

### OPN-009: Emergency Support Access Authorization & Break-Glass (DEC-012 Policy A)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `FF-ISSUE-057`, `superAdminController.ts`
- **Current Observation:** DEC-012 Principle 2 dictates that tenant-admin approval is mandatory for all workspace access.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Option 1A (Dual Super-Admin Break-Glass Access).**
  - Emergency access requires approval from two distinct Super-Admin operators (`requested_by !== approved_by`).
  - Access is strictly read-only diagnostics (`diagnostics_readonly`), capped at 30 minutes with zero renewal or extension.
  - Mandatory urgent customer notification and immutable audit logging.
  - Formally recorded as a proposed exception to DEC-012 Principle 2.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

---

### OPN-010: Emergency Support Access Notification Delivery Contract (DEC-012 Policy A2)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `FF-ISSUE-057`, `backend/src/workers/notificationWorker.ts`
- **Current Observation:** When emergency support access is approved by two Super-Admins, urgent customer notification must be dispatched to tenant administrators.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Option 2A (Fail Closed) via Option A (Synchronous MongoDB Majority Write Concern).**
  - Synchronously persist the urgent notification job using MongoDB majority write concern (`{ w: "majority", j: true }`) before issuing an emergency-access token.
  - Clearly document that durable queue acceptance does **not** guarantee actual delivery to the customer device.
  - Access must be denied immediately (`HTTP 503 Service Unavailable / EMERGENCY_NOTIFICATION_FAILED`) if durable queueing fails.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

---

### OPN-011: Operational Financial Field Classification & Receipt Image Blockade (DEC-012 Policy B)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `backend/src/models/TruckJourney.ts`, `backend/src/models/VehicleEntry.ts`
- **Current Observation:** Proposed Policy B enforces "Complete Financial Blindness" for support operators across all scopes. Pure financial routes (`/api/finance/*`, `/api/commercial/settlements`) are completely blocked.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Option 3A (Monetary Redaction with Metric Preservation & Receipt Image Blockade).**
  - Redact all designated monetary fields from operational API responses during support sessions: `freight_rate_inr`, `driver_advance_inr`, `estimated_diesel_cost`, `toll_budget_inr`, `diesel_expenses[].cost`, `diesel_expenses[].rate_per_liter`, `driver_expenses[].amount`, `VehicleEntry` advance and freight values, `credit_limit`, `current_balance`, and settlement summaries set to `null`.
  - Preserve approved physical operational metrics: fuel volume (`liters`), fuel station, odometer readings, trip status, toll plaza names, expense categories, vehicle numbers, route lanes, and milestone timestamps.
  - Block receipt URLs (`receipt_url: null`, `toll_receipt_url: null`) and intercept receipt-image access endpoints during all support sessions. A frontend warning is acknowledged as insufficient protection; server-side suppression is mandatory.
  - Block financial routes and exports across all scopes.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

---

### OPN-012: Extended Driver PII Masking & Complete Inventory (DEC-012 Policy C)
- **Related Items:** `DEC-012`, `FF-ISSUE-034`, `backend/src/models/Driver.ts`
- **Current Observation:** Driver Aadhaar numbers, PAN cards, bank details, and mobile phones are stored and returned in plaintext by `driverController.ts`.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Option 4A (Extended Permanent Masking Without Exceptions).**
  - Extend permanent support-session masking to driving licence numbers (`DL-XXXXXXXXX1234`) and secondary personal details, including emergency-contact phone numbers (`+91 98765 XXXXX`), date of birth (`date_of_birth: null`), home address (`address: null`), and family details where present.
  - Block KYC document images (`license_front_url`, `license_back_url`, `aadhaar_front_url`, `photo_url` set to `null`).
  - Always mask Aadhaar (`XXXX-XXXX-1234`), PAN (`XXXXX1234X`), bank account (`XXXXXX1234`), and mobile phone (`+91 98765 XXXXX`).
  - Zero unmasking exceptions permitted, even with customer Workspace-Admin consent.
  - Enforce server-side across direct responses, nested objects, reports, and exports.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

---

### OPN-013: Support Ticket Validation & Customer Lockout Intake (DEC-012 Policy D)
- **Related Items:** `DEC-012`, `FF-ISSUE-022`, `FF-ISSUE-057`, `backend/src/models/SupportTicket.ts`
- **Current Observation:** Proposed Policy D requires that every support access request reference an existing internal `SupportTicket` (`TICK-YYYY-XXXX`) for the target tenant. In a customer lockout, customer admins cannot log in to submit a ticket.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Option 5A (Strict In-App Support Ticket Required with Out-of-Band Lockout Intake).**
  - Require an existing, active Fleet Flow support ticket belonging to the exact target tenant (`company_id`).
  - Reject nonexistent, closed/resolved, and cross-tenant tickets. Reject external CRM/Jira references.
  - In customer lockout scenarios, permit authenticated Super-Admin creation of an internal `SupportTicket` on the customer's behalf after documented out-of-band identity verification (e.g. phone verification with registered tenant owner).
  - The ticket creation must record the verification method, operator ID, target tenant ID, timestamp, and intake channel (`intake_channel: 'out_of_band_phone_verified'`) in the audit trail.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

---

### OPN-014: Database Unavailability & Verification Fail-Closed Contract (DEC-012 Policy E)
- **Related Items:** `DEC-012`, `FF-ISSUE-056`, `backend/src/middleware/authMiddleware.ts`
- **Current Observation:** The proposed design executes an indexed database check on every operator API request to verify token expiry, active status, instant revocation, tenant scope, and permission bounds.
- **Product Owner Recommended Policy (PROPOSED — PENDING REVIEW):** **Fail-Closed Verification Contract.**
  - If session verification, expiry, revocation, tenant scope, or permission verification cannot complete due to database unreachability or timeout, the system must **fail closed**.
  - Deny the support request immediately with `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.
  - Impersonation sessions must **never fail open** or optimistically rely on unverified JWT signatures.
  - Implementation is on **HOLD — DOCUMENTATION ONLY**.

