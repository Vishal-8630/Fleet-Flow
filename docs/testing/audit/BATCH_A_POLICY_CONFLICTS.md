# Fleet Flow — Batch A Security Policy Reconciliation & Conflict Analysis

**Document Type:** Security Architecture & Policy Reconciliation Analysis  
**Target Batch:** `BATCH-A` (Security, Tenant Isolation & Controlled Support Access)  
**Governing Architecture:** [DEC-012 (Tenant Privacy Architecture)](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-012-tenant-privacy-controlled-support-access.md)  
**Related Audit Documents:** [`BATCH_A_PREFLIGHT_REVIEW.md`](BATCH_A_PREFLIGHT_REVIEW.md), [`IMPLEMENTATION_BATCH_PLAN.md`](IMPLEMENTATION_BATCH_PLAN.md), [`DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md), [`AUDIT_OPEN_QUESTIONS.md`](AUDIT_OPEN_QUESTIONS.md)  
**Execution Posture:** **DOCUMENTATION ONLY. No code modifications, migrations, or database changes authorized.**  
**Date:** 15 October 2026  
**Auditor / Governance Authority:** Antigravity Advanced Agentic AI (Security Architecture Review)  
**Baseline Test Status:** 229 of 229 automated backend tests passing (100% pass rate in 167.7s) on MongoDB In-Memory Replica Set. Zero tests currently cover impersonation flows.

---

## 1. Executive Summary & Governance Context

Batch A refactors the platform operator impersonation flow from an unconstrained, self-authorized single-click entry into an enterprise-grade, customer-governed **Support Access Request & Scoped Approval Lifecycle**.

Four operational security policies have been proposed to clarify boundary enforcement under `DEC-012`. This document records each proposed policy, provides an exhaustive technical conflict and dependency analysis against the existing repository code, inventories affected endpoints and fields, details safe denial and failure behaviors, and provides a formal implementation readiness verdict.

### 1.1 Policy Selection & Status Summary

The Product Owner has delegated selection of the recommended policy options. All six policy recommendations are recorded as **PROPOSED — PENDING REVIEW** under an explicit **HOLD — DOCUMENTATION ONLY** governance state:

| Policy Identifier | Policy Name | Selected Option | Status | Core Mandate |
| :--- | :--- | :--- | :--- | :--- |
| **Policy A** | Emergency Break-Glass Access | **Option 1A** | **PROPOSED — PENDING REVIEW** | Dual Super-Admin approval (`requested_by !== approved_by`), strictly read-only diagnostics (`diagnostics_readonly`), hard 30-minute maximum duration with zero renewal, mandatory urgent customer notification via SMS/Email, immutable platform audit logging. Proposed formal exception to DEC-012 Principle 2. |
| **Policy A2** | Emergency Notification Delivery Contract | **Option 2A / Option A** | **PROPOSED — PENDING REVIEW** | Fail closed on durable queue failure. Synchronously persist the urgent notification job using MongoDB majority write concern (`{ w: "majority", j: true }`) before issuing an emergency token. Durable queue acceptance does not guarantee actual delivery; access must be denied if durable queueing fails (`HTTP 503`). |
| **Policy B** | Operational Financial Redaction & Receipt Blockade | **Option 3A** | **PROPOSED — PENDING REVIEW** | Redact all designated monetary fields from operational API responses. Preserve physical metrics (litres, km, locations, timestamps). Block receipt URLs (`receipt_url: null`, `toll_receipt_url: null`) and receipt-image access during all support sessions. Block financial routes and exports across all scopes. Frontend warning alone is acknowledged as insufficient. |
| **Policy C** | Extended Permanent Driver PII Masking | **Option 4A** | **PROPOSED — PENDING REVIEW** | Permanently mask driver Aadhaar (`XXXX-XXXX-1234`), PAN (`XXXXX1234X`), bank account (`XXXXXX1234`), mobile/emergency phone (`+91 98765 XXXXX`), driving licence (`DL-XXXXXXXXX1234`), DOB, address, family details, and block KYC document photos (`null`) server-side across all outputs. Zero unmasking exceptions permitted. |
| **Policy D** | Internal Support Ticket & Lockout Intake | **Option 5A** | **PROPOSED — PENDING REVIEW** | Require an existing, active Fleet Flow support ticket (`SupportTicket`) belonging to the exact target tenant. Reject external CRM/Jira references. For customer lockouts, permit authenticated Super-Admin creation of an internal ticket on customer's behalf after documented out-of-band identity verification, fully logged in audit trail. |
| **Policy E** | Database Unavailability Fail-Closed Contract | **Fail-Closed Contract** | **PROPOSED — PENDING REVIEW** | On every operator request, middleware verifies session, expiry, revocation, tenant scope, and permissions against the database. If the database is unreachable or verification cannot complete, fail closed: deny the request with `HTTP 503 Service Unavailable`. Never fail open. |

> [!IMPORTANT]
> **GOVERNANCE POSTURE: HOLD — DOCUMENTATION ONLY. NO CODE CHANGES AUTHORIZED.**  
> Every policy recommendation above is recorded as **PROPOSED — PENDING REVIEW**. The Product Owner has explicitly kept implementation on hold. Selection does not constitute authorization to modify source code, schemas, or database records.

---

## 2. Detailed Specifications of the Six Proposed Policy Selections

### 2.1 Policy A — Emergency Access Exception (Option 1A)

- **Status:** **PROPOSED — PENDING REVIEW**
- **Selected Option:** Option 1A (Dual Super-Admin Break-Glass Access).
- **Objective:** Establish a safe, audited "Break-Glass" mechanism enabling platform operators to enter a tenant workspace during catastrophic lockout scenarios where customer workspace administrators cannot access the application to grant routine approval.
- **Rules & Constraints:**
  1. **Dual Super-Admin Approval:** Emergency access requires explicit authorization from two distinct platform Super-Admin operators. The requesting operator cannot self-approve (`requested_by_user_id !== approved_by_user_id`).
  2. **Strictly Read-Only Scope:** Emergency sessions are hard-locked to `diagnostics_readonly`. Zero mutation, configuration write, or deletion permissions are permitted under emergency mode.
  3. **Strict Time Limit:** Maximum duration is hard-capped at **30 minutes** with **zero renewal or extension**.
  4. **Mandatory Urgent Customer Notification:** An automated, high-priority notification must be dispatched to all registered Workspace Administrators of the target tenant via email and SMS/WhatsApp upon session initiation.
  5. **Immutable Platform Audit Logging:** The requesting operator, approving operator, target tenant ID, justification, emergency reason, timestamps, expiry, and all session activity must be recorded in `PlatformAuditLog` and `AuditLog`.
  6. **DEC-012 Relationship:** Formally recorded as a proposed exception to DEC-012 Principle 2 (normal tenant-admin approval requirement).

---

### 2.2 Policy A2 — Emergency Notification Delivery Contract (Option 2A / Option A)

- **Status:** **PROPOSED — PENDING REVIEW**
- **Selected Option:** Option 2A (Fail Closed) via Option A (Synchronous MongoDB Majority Write Concern).
- **Objective:** Ensure emergency access cannot be executed without durable persistence of customer audit alerts, while avoiding third-party availability deadlocks during infrastructure incidents.
- **Rules & Constraints:**
  1. **Synchronous Majority Persistence:** The backend must synchronously insert the `NotificationJob` record into MongoDB with write concern `{ w: "majority", j: true }` before issuing an emergency-access session token.
  2. **Durable Queue Acceptance Limitation:** Documentation and audit logs must explicitly record that **durable queue acceptance does not guarantee actual customer device delivery** at token generation time. Delivery is processed asynchronously by `notificationWorker.ts`.
  3. **Fail-Closed on Queue Failure:** If the majority write to MongoDB fails, times out, or cannot reach replica quorum, emergency access must be denied immediately (`HTTP 503 Service Unavailable / EMERGENCY_NOTIFICATION_FAILED`). Under no circumstance may an emergency session token be issued or activated when queueing fails.

---

### 2.3 Policy B — Operational Financial Field Redaction & Receipt Blockade (Option 3A)

- **Status:** **PROPOSED — PENDING REVIEW**
- **Selected Option:** Option 3A (Monetary Redaction with Metric Preservation & Receipt Image Blockade).
- **Objective:** Enforce complete financial blindness across all support sessions, eliminating both direct numerical exposures and indirect document exposures.
- **Rules & Constraints:**
  1. **Universal Scope Restriction:** Financial blindness applies universally across **all** support session scopes, including `config_write`. No support operator may be granted financial read or write permissions.
  2. **Pure Financial Route Blocking:** All endpoints under `/api/finance/` (invoices, ledgers, vouchers, aging reports) and `/api/commercial/settlements` are completely blocked, returning `HTTP 403 Forbidden (FINANCIAL_RECORDS_LOCKED)`.
  3. **Bulk Export Lockout:** Commercial exports (e.g. `/api/finance/invoices/export`, ledger exports, Tally XML generators) return `HTTP 403 Forbidden (SUPPORT_EXPORT_BLOCKED)` across all support sessions.
  4. **Operational Endpoint Field Redaction:** Redact to `null`: `freight_rate_inr`, `driver_advance_inr`, `estimated_diesel_cost`, `toll_budget_inr`, `diesel_expenses[].cost`, `diesel_expenses[].rate_per_liter`, `driver_expenses[].amount`, `VehicleEntry` advance and freight values, `credit_limit`, `current_balance`, and settlement summaries.
  5. **Preserve Physical Operational Metrics:** Fuel volume (`liters`), fuel station, odometer readings, trip status, toll plaza names, expense categories, vehicle numbers, route lanes, and milestone timestamps remain visible.
  6. **Receipt URLs & Image Blockade:** Block receipt URLs (`receipt_url: null`, `toll_receipt_url: null`) and intercept receipt file download endpoints during all support sessions. A frontend warning is acknowledged as insufficient protection; server-side suppression is mandatory.

---

### 2.4 Policy C — Extended Permanent Driver PII Masking (Option 4A)

- **Status:** **PROPOSED — PENDING REVIEW**
- **Selected Option:** Option 4A (Extended Permanent Masking Without Exceptions).
- **Objective:** Protect commercial driver statutory identification and personal data in strict compliance with Indian privacy regulations (DPDP Act).
- **Rules & Constraints:**
  1. **Server-Side Enforcement:** Masking must be executed at the server API serialization and query layer across direct responses, nested objects, reports, and exports.
  2. **Zero Unmasking Exceptions:** Masking applies to all support sessions without exception. No workflow may unmask driver PII, even if customer Workspace-Admin consent is offered.
  3. **Complete Field Masking Specifications:**
     - **Aadhaar Number:** Masked to last 4 digits: `XXXX-XXXX-1234`.
     - **PAN Number:** Masked to last 4 characters: `XXXXX1234X`.
     - **Mobile Phone & Emergency Phone:** Masked: `+91 98765 XXXXX`.
     - **Driver Bank Account:** Masked: `XXXXXX1234` (IFSC code omitted).
     - **Driving License Number:** Masked to last 4 characters: `DL-XXXXXXXXX1234`.
     - **Secondary Personal Details:** Date of Birth (`date_of_birth`), Home Address (`address`), and family/father's details redacted to `null` or masked.
     - **KYC Document Images:** Block document photos (`license_front_url`, `license_back_url`, `aadhaar_front_url`, `aadhaar_back_url`, `photo_url` set to `null`).
  4. **Surface Area:** Applies across `/api/fleet/drivers`, populated driver references in `/api/operations/journeys`, `/api/fleet/trucks`, settlements, and tabular exports.

---

### 2.5 Policy D — Internal Support Ticket Requirement & Lockout Intake (Option 5A)

- **Status:** **PROPOSED — PENDING REVIEW**
- **Selected Option:** Option 5A (Strict In-App Support Ticket Required with Out-of-Band Lockout Intake).
- **Objective:** Eliminate untracked or speculative operator browsing by strictly binding every support access request to an active internal customer support ticket.
- **Rules & Constraints:**
  1. **Internal `SupportTicket` Validation:** Every support access request must reference a valid, existing `ticket_no` from the Fleet Flow database (collection: `support_tickets`).
  2. **Strict Tenant Scoping:** The referenced ticket must belong to the exact target tenant (`ticket.company_id.toString() === targetCompanyId.toString()`). Cross-tenant ticket references are rejected immediately (`HTTP 404 / 403`).
  3. **Ticket Eligibility Preconditions:** The ticket status must be active (`open`, `in_review`, or `waiting_customer`). Closed or resolved tickets are ineligible for new support sessions (`HTTP 400 TICKET_CLOSED`).
  4. **Prohibition of External CRM Keys:** Arbitrary external Jira, Zendesk, or email reference keys are strictly prohibited.
  5. **Customer Lockout Intake Workflow:** When a customer is locked out and cannot log in to submit an in-app ticket, an authenticated Super-Admin may create an internal `SupportTicket` on the customer's behalf after documented out-of-band identity verification (e.g. phone verification with registered tenant owner). The ticket creation must record the verification method, operator ID, target tenant ID, timestamp, and intake channel (`intake_channel: 'out_of_band_phone_verified'`) in the audit trail.

---

### 2.6 Policy E — Database Unavailability Fail-Closed Contract

- **Status:** **PROPOSED — PENDING REVIEW**
- **Objective:** Ensure session verification, instant revocation, tenant scoping, and permission enforcement cannot be bypassed if the database cluster is impaired.
- **Rules & Constraints:**
  1. **Mandatory Runtime Verification:** On every incoming API request during a support session (`req.isImpersonation === true`), `resolveTenantContext` middleware queries `SupportAccessRequest` to verify token expiry, active status, tenant scope, and permission bounds.
  2. **Fail-Closed on Database Failure:** If MongoDB is unreachable, partitioned, or times out during verification, the middleware must **fail closed** and deny the request immediately with `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.
  3. **No Optimistic Fail-Open:** Impersonation sessions must **never fail open** or rely on unverified JWT signatures when the database is unavailable.

---

## 3. Conflict & Dependency Reconciliation Matrix

The table below reconciles each of the eight required architectural dimensions. Every item clearly distinguishes confirmed source-code facts, proposed policy mandates, technical conflicts or dependencies, required product-owner decisions, and necessary acceptance tests.

| Dimension | Confirmed Source-Code Facts (Repository Ground Truth) | Proposed Policy Mandate | Technical Conflict or Dependency | Product-Owner Decision Required | Acceptance Test Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Tenant Admin Approval vs Emergency Dual-Admin Access** | `superAdminController.ts:388-446` currently allows single-operator self-authorized entry with a text reason string. `DEC-012` Principle 2 mandates explicit Workspace-Admin approval. | **Policy A (Option 1A):** Dual Super-Admin approval (2 distinct operators) allows 30-minute read-only entry in catastrophic lockouts. | **Direct Policy Conflict:** Policy A is an exception to `DEC-012` Principle 2. If DEC-012 is strictly tenant-admin-only, emergency access violates that principle. | **Selected: Option 1A (Proposed — Pending Review).** Requires formal DEC-012 amendment before implementation. | `SEC-NEG-EMERG-01`: Rejects emergency request if approved by same operator.<br>`SEC-POS-EMERG-02`: Grants 30m read-only token when signed by 2 distinct super-admins. |
| **2. Emergency Notification & Delivery Failure Behavior** | `notificationWorker.ts:118-125` processes SMS/Email asynchronously. In local/isolated environments, provider callbacks fail or are unavailable. | **Policy A2 (Option 2A):** Fail closed. Mandatory urgent customer notification must be queued/dispatched, or access is denied. | **Availability Dependency:** If notification provider is down during an infrastructure incident, fail-closed denial prevents emergency troubleshooting. | **Selected: Option 2A (Proposed — Pending Review).** Fail-closed safe denial approved. Unresolved: Delivery contract definition. | `SEC-NEG-EMERG-03`: Emergency token generation aborts with 503 if notification dispatch fails.<br>`SEC-POS-EMERG-04`: Dispatches notification before token generation. |
| **3. Financial Blindness vs Operational Troubleshooting** | `TruckJourney.ts:18-144` embeds `freight_rate_inr`, `driver_advance_inr`, `diesel_expenses` (with `cost`), and `settlement`. `VehicleEntry.ts:27-120` embeds `freight_amount`, `dala_charges`, `kamisan_amount`. | **Policy B (Option 3A):** Monetary redaction with physical metric preservation. Pure financial routes blocked; operational monetary figures set to `null`. | **Troubleshooting Conflict:** If `diesel_expenses.cost` and driver cash advances are redacted from `TruckJourney`, support cannot troubleshoot trip settlement balance discrepancies. | **Selected: Option 3A (Proposed — Pending Review).** Monetary amounts redacted; physical metrics preserved. Unresolved: Attachment image inspection. | `SEC-NEG-FIN-01`: Accessing `/api/finance/invoices` returns 403.<br>`SEC-NEG-FIN-02`: `/api/finance/invoices/export` returns 403.<br>`SEC-VERIF-FIN-03`: `GET /api/operations/journeys/:id` sets `freight_rate_inr: null`. |
| **4. Always-Masked Driver PII Across All Paths** | `driverController.ts:70-130` returns plaintext `aadhaar_number`, `pan_number`, and `phone`. No masking exists anywhere in backend serialization. | **Policy C (Option 4A):** Server-side masking of Aadhaar, PAN, phone, and bank details across all APIs, nested objects, and exports. Zero unmasking permitted. | **Serialization Dependency:** Requires Mongoose `toJSON` transform or controller middleware to intercept all queries populating `Driver` (including journeys and trucks). | **Selected: Option 4A (Proposed — Pending Review).** Permanent server-side masking confirmed without exceptions. Unresolved: `.lean()` bypass prevention. | `SEC-NEG-PII-01`: `GET /api/fleet/drivers` returns `aadhaar_number: "XXXX-XXXX-1234"`.<br>`SEC-NEG-PII-02`: Exporting driver list returns masked fields. |
| **5. Internal Ticket Linkage vs Batch E Central Inbox** | `SupportTicket.ts` model exists with `company_id`, `ticket_no`, `status`. But `superAdminRoutes.ts` has zero ticket endpoints; central inbox is planned for Batch E (`FF-ISSUE-022`). | **Policy D (Option 5A):** Mandatory linkage to active internal `SupportTicket`. Rejects external CRM/Jira keys. | **Workflow Sequencing:** Super-Admins in Batch A have no central UI inbox to browse customer tickets. They must manually enter the customer-provided ticket number. | **Selected: Option 5A (Proposed — Pending Review).** Internal ticket required. Unresolved: Offline telephone customer intake procedure. | `SEC-NEG-TCK-01`: Rejects request if `support_ticket_id` does not exist in MongoDB.<br>`SEC-NEG-TCK-02`: Rejects request if ticket belongs to Tenant B.<br>`SEC-NEG-TCK-03`: Rejects request if ticket status is `'closed'`. |
| **6. JWT Auth, Stateless Session Persistence & Revocation** | `superAdminController.ts:406-416` signs 1-hour JWT. `authMiddleware.ts:92-129` checks signature and `user.token_version`. Database maintains no state for active impersonation tokens. | Instant revocation: Tenant Admin clicks "Revoke", immediately invalidating active operator token on next API request. | **Architecture Mismatch:** Stateless JWTs cannot be revoked instantly without a database lookup or revocation blacklist on every request. | Confirm database lookup overhead: Approve indexed `SupportAccessRequest` query in `resolveTenantContext` (< 2ms) on every impersonation request. | `SEC-NEG-REV-01`: Tenant Admin calls `/revoke`; operator's next request returns 403 `SUPPORT_SESSION_REVOKED`.<br>`SEC-NEG-EXP-02`: Token rejected after `expires_at`. |
| **7. Immutable Audit Requirements & Persistence Failure** | `PlatformAuditLog.ts` exists. `superAdminController.ts:422` logs entry. `auditService.ts:67-69` wraps operational audits in `try/catch` and logs errors to console, failing silently. | Immutable auditing of requesting operator, approving operator, ticket ID, and all in-tenant actions. Fail-closed on audit failure. | **Reliability Conflict:** If MongoDB replica set election occurs or disk is full, silent catch in `auditService.ts` would allow mutations without audit records. | Mandate transactional fail-closed auditing: If audit record cannot be written, the business action or session grant must abort immediately. | `SEC-NEG-AUD-01`: If `PlatformAuditLog.create` throws, impersonation token is not issued.<br>`SEC-VERIF-AUD-02`: In-tenant mutations record `is_impersonation: true`. |
| **8. Compatibility with Customer Daily Operations** | `authMiddleware.ts:180-220` resolves tenant context for regular members via `CompanyMember`. | Zero disruption to ordinary tenant-admin, dispatcher, accountant, and driver workflows. | **Regression Risk:** Scoping and masking code must strictly check `req.isImpersonation === true` to avoid accidentally masking PII or blocking finance for tenant staff. | Confirm scope isolation: Regular customer users retain full unmasked visibility and financial access governed by their normal RBAC roles. | `COMPAT-01`: Tenant Admin logs in and views full unmasked Aadhaar and full ledger.<br>`COMPAT-02`: Dispatcher dispatches journey without support interference. |

---

### 3.1 Detailed Review of Remaining Technical Conflicts & Unresolved Technical Details

While the Product Owner has selected baseline policy options (1A, 2A, 3A, 4A, 5A) as **PROPOSED — PENDING REVIEW**, the following technical implementation details, trade-offs, and failure contracts remain unresolved and require formal Product Owner decisions and technical verification prior to code authorization:

---

#### 1. Notification Delivery Contract: Queue Acceptance vs Confirmed Delivery (Policy A2)

Policy A2 mandates a **fail-closed** denial behavior: if urgent customer notification cannot be successfully queued or dispatched according to the defined delivery contract, emergency access must be denied (`HTTP 503 / EMERGENCY_NOTIFICATION_FAILED`).

However, the repository currently processes notifications asynchronously via `notificationWorker.ts` and MongoDB `NotificationJob` queueing. Two distinct technical contracts have been proposed:

| Architectural Dimension | Option A: Durable Queue Acceptance (Majority Write) | Option B: Synchronous External Gateway Confirmation |
| :--- | :--- | :--- |
| **Technical Contract** | Insert `NotificationJob` synchronously to MongoDB replica set with write concern `{ w: "majority", j: true }` before issuing emergency token. Worker processes delivery asynchronously. | Bypass async worker queue; make synchronous outbound HTTPS call to external SMS/Email gateway (Twilio / SendGrid) and await `HTTP 200 OK` (carrier acceptance) before issuing token. |
| **Security & Notification Guarantee** | **Durable Queue Acceptance:** Guarantees notification job is durably committed to database replica log and will not be lost on primary failover. However, customer has **NOT yet received** notification when operator enters workspace. | **Carrier Dispatch Acceptance:** High assurance electronic message was accepted by telecommunications carrier/email infrastructure before operator access is granted. |
| **Failure Modes** | Access denied if MongoDB replica set cannot achieve majority write quorum. If external SMS/Email vendor experiences an outage or rate-limit later, notification delivery is delayed or retried by worker without alerting operator. | Access denied if external SMS/Email gateway is down, unreachable, returns 5xx/429, or network times out. During widespread cloud or internet outages, operators are **locked out from emergency recovery**. |
| **Latency Impact** | **Minimal:** 5–20ms (local/intranet database round-trip). | **Significant:** 1,500ms – 5,000ms+ (external TLS handshake, DNS resolution, vendor API processing, carrier queuing). |
| **Operational Dependencies** | MongoDB replica set majority availability only. Decoupled from public internet routing and external SaaS vendor status. | Outbound internet routing, external DNS, third-party vendor API uptime, account billing/credit availability, vendor rate limits. |
| **Distinction** | Durable queue acceptance is **not** confirmed customer delivery. | Gateway dispatch acceptance approaches delivery but still does not guarantee device receipt or human reading. |

- **Recommendation (PROPOSED — NOT APPROVED):** **Recommend Option A with Enhanced Durability.**
  - *Rationale:* Tying emergency break-glass infrastructure remediation to external SaaS vendor uptime (Twilio/SendGrid) introduces a dangerous circular dependency: during severe cloud or networking incidents (the exact scenario where break-glass is most critical), operators could be prevented from accessing the database. Option A guarantees durability in MongoDB while avoiding third-party availability coupling.
  - *Decision Needed from Product Owner:* Approve Option A (Durable Majority Queueing) or Option B (Synchronous Gateway 200 OK) as the binding delivery contract under Policy A2.

---

#### 2. Immediate Revocation, Expiry & Fail-Safe Database Check Contract

To satisfy DEC-012's requirement for immediate revocation by tenant administrators, the proposed design implements an indexed database query in `resolveTenantContext` middleware on every incoming request where `req.isImpersonation === true`:

```typescript
const session = await SupportAccessRequest.findOne({
  _id: decoded.supportRequestId,
  tenant_id: decoded.tenantId,
  status: 'active',
}).lean();
```

- **Enforcement Mechanics:**
  1. **Token Expiry:** Verified both cryptographically via JWT `exp` claim and dynamically against `session.expires_at > new Date()`.
  2. **Instant Revocation:** When a Workspace Admin or Super-Admin clicks "Revoke", `status` transitions to `'revoked'`. The operator's next API call is rejected with `HTTP 403 Forbidden (SUPPORT_SESSION_REVOKED)`.
  3. **Tenant Scope Locking:** Database check verifies `session.tenant_id` matches both the route header (`x-company-id`) and the token claims, preventing cross-tenant hopping.
  4. **Permission Scope Enforcement:** Confirms operator permissions (`diagnostics_readonly` vs `config_write`) to prevent unauthorized privilege escalation.
- **Consistency & Performance Implications:**
  - Query executes against primary index (`_id`), yielding typical latency < 2ms.
  - Read-your-writes consistency on MongoDB replica sets guarantees revocation takes effect across all API pods immediately.
- **Fail-Safe Contract Under Database Unreachability (Recommendation):**
  - *Question:* What occurs if MongoDB is unreachable or the query times out during an operator support session?
  - *Recommended Contract (Fail Closed):* **The middleware must reject the request with `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.**
  - *Principle:* An impersonation session must **never fail open** or optimistically rely on an unverified JWT signature if database connectivity fails, as that would permit revoked or expired sessions to continue mutating customer data.

---

#### 3. Emergency-Access Exception Reconciliation with DEC-012

Proposed Policy A (Option 1A) introduces an intentional exception to DEC-012 Principle 2 (*"Super-Admin support access to a tenant workspace requires explicit authorization from that tenant's Workspace Admin"*).

To reconcile Option 1A with DEC-012 without architectural ambiguity, the following exact modifications are required in [`DEC-012`](../decisions/DEC-012-tenant-privacy-controlled-support-access.md):

1. **Amend Section 1, Principle 2 (Core Principles):**
   - *Current text:* "Tenant-Admin Prior Approval: Super-Admin support access to a tenant workspace requires explicit authorization from that tenant's Workspace Admin."
   - *Amended proposed text:* "Tenant-Admin Prior Approval: Super-Admin support access to a tenant workspace requires explicit prior authorization from that tenant's Workspace Admin, **except under the formal Dual-Super-Admin Emergency Break-Glass Exception defined in Section 2.1 (Policy A)**."
2. **Formalize the Five Invariant Constraints of Policy A in DEC-012 Section 2.1:**
   - **Dual Super-Admin Approvals:** Two distinct platform super-admins must approve (`requested_by !== approved_by`).
   - **Strict Read-Only Diagnostics:** Mode hard-locked to `diagnostics_readonly`. Zero mutations, config writes, or deletes allowed.
   - **30-Minute Cap:** Maximum duration hard-limited to 30 minutes with zero renewal.
   - **Mandatory Customer Notification:** High-priority notification dispatched to all registered Workspace Admins via SMS/Email.
   - **Immutable Audit Logging:** Full transaction logging of requester, approver, target tenant, justification, and all session actions in `PlatformAuditLog`.
3. **Status Note:** Kept as **PROPOSED — PENDING REVIEW** until formal Product Owner sign-off.

---

#### 4. Audit Persistence Failure & Transaction Boundary Validity

- **Fail-Closed Rule for Audit Persistence:**
  - Every access grant (standard or emergency) and every sensitive action conducted under an impersonation session must fail closed if audit persistence fails.
  - In `superAdminController.ts:422`, if `PlatformAuditLog.create(...)` throws an error (e.g. disk quota exhaustion, schema validation error, write concern timeout), the request must immediately abort. No token may be issued, no session cookie set, and `HTTP 500 Internal Server Error (AUDIT_PERSISTENCE_FAILED)` returned.
- **Architectural Validity of Proposed Transaction Boundary:**
  - Fleet Flow architecture mandates MongoDB Replica Sets across all environments ([DEC-002](../decisions/DEC-002-mongodb-replica-sets.md)).
  - MongoDB replica sets natively support multi-document ACID transactions via `mongoose.startSession()` and `session.withTransaction(...)`.
  - Wrapping the state mutation of `SupportAccessRequest` (status: `'active'`) and the insertion of `PlatformAuditLog` into a single MongoDB transaction is **architecturally and technically valid**. If either operation fails, the transaction rolls back cleanly, guaranteeing zero un-audited access grants.

---

#### 5. Monetary-Data Exposure via Scanned Receipt Images (Policy B Conflict)

- **Conflict Analysis:**
  - Policy B mandates "Complete Financial Blindness" and redacting all monetary fields from operational responses (e.g. `freight_rate_inr`, `driver_advance_inr`, `diesel_expenses[].cost`).
  - However, operational endpoints (`/api/operations/journeys/:id`) return document URLs for fuel slips and cash expenses (`receipt_url`, `toll_receipt_url`).
  - Scanned paper receipts contain high-resolution photos where total payment amounts, fuel rates per liter, GST amounts, and payment methods are clearly printed and legible.
  - Permitting support operators to open and view receipt images allows direct inspection of commercial pricing, creating an indirect loophole in Policy B.
- **Trade-Off:**
  - *If receipt images are blocked:* Operators cannot verify physical fuel volume (liters), petrol pump serial numbers, odometer photos, or toll plaza stamps necessary to resolve logistics defects.
  - *If receipt images are allowed:* Operators can read proprietary freight margins and diesel purchase prices.
  - *Cosmetic Warning Insufficiency:* A frontend warning banner alone does not satisfy security compliance or prevent an operator from viewing confidential commercial data.
- **Decision Required from Product Owner:**
  - **Option 5.1 (Permit Images for Operational Verification):** Authorize receipt image viewing as a documented operational exception to Policy B, recognizing that verifying physical liters and odometer readings requires viewing paper vouchers.
  - **Option 5.2 (Strict Financial Blindness / Block Receipt URLs):** Redact `receipt_url` to `null` during all support sessions. Operators must troubleshoot logistics strictly without receipt images.
  - **Option 5.3 (Customer-Approved Attachment Scope):** Redact `receipt_url` by default, but allow tenant admins to explicitly grant "Receipt Inspection Permission" when approving the support request.

---

#### 6. Driver PII Masking: Required Coverage & Remaining Ambiguities (Policy C)

- **Required Coverage Across Surfaces:**
  1. **Direct API Responses:** `GET /api/fleet/drivers`, `GET /api/fleet/drivers/:id`.
  2. **Nested Objects:** Embedded driver references in `TruckJourney`, `VehicleEntry`, `Truck` assigned driver, and settlement records.
  3. **Mongoose `.lean()` Queries:** `driverController.ts:58` and `journeyController.ts:348` use `.lean()`, which completely bypasses Mongoose schema transforms and plugins. Masking must be enforced at the Express serialization layer (`res.json` interceptor or centralized controller helper), not just Mongoose getters.
  4. **Reports & Analytics:** Driver rosters, trip mileage summaries, and attendance logs.
  5. **Exports:** Tabular exports (CSV/Excel/PDF) must output strictly masked values.
  6. **Error Responses:** Sanitizing validation and duplicate-key error strings so raw Aadhaar or phone numbers are never reflected in error messages.
- **Remaining Ambiguities in Masking Scope & Formats:**
  - *Driving License:* Is `license_number` considered personal PII to be masked (e.g. `DL-XXXXXXXXX1234`), or is it an operational credential that support personnel must inspect?
  - *Phone Number Normalization:* Stored phones vary in format (`+919876543210`, `9876543210`, `09876543210`). A standardized normalization contract is required before masking to `+91 98765 XXXXX`.
  - *Secondary PII Fields:* Does Policy C extend to driver emergency contact phone numbers, father's name, date of birth, and home address?
  - *Role Applicability:* Does Policy C masking apply exclusively to support sessions (`req.isImpersonation === true`), or does it apply to lower-privileged tenant staff (e.g. Dispatchers)?
  - *Verification Caveat:* Comprehensive coverage across all backend queries and routes has **not** been verified in code.

---

#### 7. Internal Support Tickets & Customer Lockout Deadlock (Policy D)

- **Operational Deadlock Analysis:**
  - Policy D (Option 5A) mandates: *Every support access request must reference a valid, active Fleet Flow support ticket (`SupportTicket`) belonging to the target tenant. External CRM/Jira keys are strictly prohibited.*
  - *The Lockout Dilemma:* In a catastrophic customer lockout (e.g. company admin forgot credentials, SSO/OAuth failure, or tenant account locked), the customer **cannot log in to Fleet Flow to create an in-app support ticket**.
  - If external tickets are rejected, and the customer cannot access their account to submit an in-app ticket, platform operators are technically blocked from requesting support access or initiating break-glass emergency access under Policy D!
- **Decision Required from Product Owner (No Exception Invented):**
  - **Option 7.1 (Emergency Portal Intake):** Provide a public/unauthenticated emergency ticket creation form (secured by email OTP sent to registered tenant admin).
  - **Option 7.2 (Super-Admin Ticket Creation on Customer Behalf):** Provide an authenticated Super-Admin API/UI to create an internal `SupportTicket` on behalf of the customer after out-of-band identity verification (e.g. phone/call verification), recording the intake channel.
  - **Option 7.3 (Emergency Break-Glass Carve-Out):** For Policy A (Dual Super-Admin Emergency Access), waive the in-app ticket prerequisite in favor of a system-generated emergency ticket linked to the dual-Super-Admin approval record.

---

---

## 4. Source-Code Touchpoints, Endpoints & Field Inventory

### 4.1 Pure Financial Routes (To Be Completely Blocked)

Under Policy B, the following backend route modules must be guarded by `blockFinancialAccess` middleware, returning `HTTP 403 Forbidden` for any request where `req.isImpersonation === true`:

| Route Module | File Path | Guarded Endpoints | Protected Data Content |
| :--- | :--- | :--- | :--- |
| **Invoice Routes** | `backend/src/routes/invoiceRoutes.ts` | `GET /api/finance/invoices`<br>`POST /api/finance/invoices`<br>`GET /api/finance/invoices/:id`<br>`GET /api/finance/invoices/:id/pdf`<br>`GET /api/finance/invoices/export` | Freight customer invoices, billing rates, GST breakdowns, payment status. |
| **Ledger Routes** | `backend/src/routes/ledgerRoutes.ts` | `GET /api/finance/ledgers/accounts`<br>`GET /api/finance/ledgers/journal`<br>`GET /api/finance/ledgers/trial-balance`<br>`GET /api/finance/ledgers/profit-loss`<br>`GET /api/finance/ledgers/balance-sheet`<br>`POST /api/finance/ledgers/vouchers` | General Ledger, chart of accounts, bank balances, journal vouchers, P&L statements. |
| **Settlement Routes** | `backend/src/routes/settlementRoutes.ts` | `GET /api/commercial/settlements`<br>`POST /api/commercial/settlements`<br>`GET /api/commercial/settlements/:id`<br>`POST /api/commercial/settlements/:id/approve`<br>`POST /api/commercial/settlements/:id/pay` | Driver trip wage settlements, fuel advance deductions, cash balances, net payables. |
| **Commercial Reports** | `backend/src/routes/commercialReportRoutes.ts` | `GET /api/reports/commercial/ar-aging`<br>`GET /api/reports/commercial/customer-revenue`<br>`GET /api/reports/commercial/profitability` | Accounts Receivable (AR) aging, revenue per shipper, lane gross margins. |

---

### 4.2 Operational Routes with Nested Financial Fields & Receipts (To Be Redacted)

Under Policy B, operational routes remain accessible for logistics troubleshooting, but nested monetary fields and receipt attachments must be stripped or replaced with `null`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      OPERATIONAL ENDPOINTS NESTED FIELD REDACTION                      │
├─────────────────────────────────┬──────────────────────────────────────────────────────┤
│ Operational Endpoint            │ Fields Redacted / Masked for Support Sessions         │
├─────────────────────────────────┼──────────────────────────────────────────────────────┤
│ GET /api/operations/journeys    │ • freight_rate_inr -> null                           │
│ GET /api/operations/journeys/:id│ • driver_advance_inr -> null                         │
│                                 │ • estimated_diesel_cost -> null                      │
│                                 │ • toll_budget_inr -> null                            │
│                                 │ • diesel_expenses[].cost -> null                     │
│                                 │ • diesel_expenses[].rate_per_liter -> null           │
│                                 │   (diesel_expenses[].liters remains VISIBLE)         │
│                                 │ • diesel_expenses[].receipt_url -> null (BLOCKED)    │
│                                 │ • driver_expenses[].amount -> null                   │
│                                 │   (driver_expenses[].category remains VISIBLE)       │
│                                 │ • driver_expenses[].receipt_url -> null (BLOCKED)    │
│                                 │ • receipt_url -> null (BLOCKED)                      │
│                                 │ • toll_receipt_url -> null (BLOCKED)                 │
│                                 │ • settlement -> null                                 │
├─────────────────────────────────┼──────────────────────────────────────────────────────┤
│ GET /api/operations/entries     │ • freight_amount -> null                             │
│ GET /api/operations/entries/:id │ • advance_cash -> null                               │
│ (VehicleEntry / Market Movement)│ • advance_diesel -> null                             │
│                                 │ • dala_charges -> null                               │
│                                 │ • kamisan_amount -> null                             │
│                                 │ • halting_charges -> null                            │
│                                 │ • net_balance_due -> null                            │
│                                 │ • document_url / receipt_url -> null (BLOCKED)       │
├─────────────────────────────────┼──────────────────────────────────────────────────────┤
│ GET /api/parties/billing        │ • credit_limit -> null                               │
│ GET /api/parties/billing/:id    │ • outstanding_balance -> null                        │
│                                 │ • rate_history -> []                                 │
├─────────────────────────────────┼──────────────────────────────────────────────────────┤
│ GET /api/parties/balance        │ • opening_balance -> null                            │
│ GET /api/parties/balance/:id    │ • current_balance -> null                            │
│                                 │ • bank_details.account_number -> masked              │
├─────────────────────────────────┼──────────────────────────────────────────────────────┤
│ GET /api/dashboard/kpis         │ • monthly_revenue -> null                            │
│                                 │ • total_expenses -> null                             │
│                                 │ • pending_receivables -> null                        │
│                                 │   (active_trips, total_trucks remain VISIBLE)        │
└─────────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

### 4.3 Driver Personally Identifiable Information (PII) — Complete Field Inventory

Under Policy C, the following driver fields must be server-side masked across all direct endpoints, nested relations, exports, reports, and error messages:

- **Source Model:** `backend/src/models/Driver.ts` (and embedded relations in `TruckJourney`, `VehicleEntry`, `Truck`, and `Settlement`)
  - `name`: String -> **Visible** (driver operational name required for trip roster identification)
  - `phone`: String (Format: `^\+?[\d\s-]{10,14}$`) -> Serialized as: `+91 98765 XXXXX`
  - `emergency_phone`: String -> Serialized as: `+91 98765 XXXXX`
  - `address`: String -> Redacted to `null` or masked as `[MASKED RESIDENTIAL ADDRESS]`
  - `date_of_birth`: Date -> Redacted to `null`
  - `license_number`: String -> Serialized as: `DL-XXXXXXXXX${license.slice(-4)}`
  - `license_expiry_date`: Date -> **Visible** (operational safety and compliance check)
  - `license_front_url`, `license_back_url`: String -> Redacted to `null` (contains unmasked PII, photo, and address)
  - `aadhaar_number`: String (Format: `^\d{12}$`) -> Serialized as: `XXXX-XXXX-${aadhaar.slice(-4)}`
  - `aadhaar_front_url`, `aadhaar_back_url`: String -> Redacted to `null` (contains biometric, address, and QR codes)
  - `photo_url`: String -> Redacted to `null` (facial biometric identifier)
  - `pan_number`: String (Format: `^[A-Z]{5}[0-9]{4}[A-Z]$`) -> Serialized as: `XXXXX${pan.slice(-4)}`
  - `bank_details.account_number`: String -> Serialized as: `XXXXXX${account.slice(-4)}`
  - `bank_details.ifsc_code`: String -> Redacted to `null`
  - `custom_fields`: Mixed -> Sanitized to `{}` or masked (purges father's name, family emergency contacts, alternative IDs)
  - `running_advance_balance`, `amount_company_owes_driver`, `amount_driver_owes_company`: Number -> Redacted to `null` (falls under Policy B financial blindness)

---

### 4.4 Support Ticket Verification & Injection Points

Under Policy D, ticket eligibility is validated using existing code primitives:

1. **Model Reference:** `backend/src/models/SupportTicket.ts`
   - Collection: `support_tickets`
   - Relevant fields: `ticket_no`, `company_id`, `status`, `intake_channel`
2. **Multi-Tenant Query Safe Execution:**
   - In `backend/src/plugins/tenantPlugin.ts:121-124`, queries passing an explicit `company_id` filter (Case 3) bypass the missing AsyncLocalStorage check.
   - The validation query in `superAdminController.ts` executes safely:
     ```typescript
     const ticket = await SupportTicket.findOne({
       ticket_no: requestedTicketNo.trim(),
       company_id: new Types.ObjectId(targetCompanyId),
       status: { $in: ['open', 'in_review', 'waiting_customer'] },
     });
     if (!ticket) {
       res.status(400).json({
         code: 'INVALID_SUPPORT_TICKET',
         error: 'A valid, active internal support ticket for this tenant is strictly required.',
       });
       return;
     }
     ```

---

## 5. Product-Owner Policy Selections Registry

The Product Owner has delegated selection of the recommended policy options. All six recommendations are recorded as **PROPOSED — PENDING REVIEW**:

### Selection 1: Emergency Break-Glass Authorization (Policy A)
- **Selected:** **Option 1A (Approved as Proposed Exception)**
- **Policy:** Dual Super-Admin Break-Glass approved as an exceptional carve-out to DEC-012 Principle 2 (strictly read-only diagnostics, max 30 minutes with zero renewal, mandatory customer notification).

### Selection 2: Emergency Customer Notification Delivery Contract (Policy A2)
- **Selected:** **Option 2A (Fail Closed) via Option A (Synchronous MongoDB Majority Write Concern)**
- **Policy:** Synchronously persist notification job with MongoDB write concern `{ w: "majority", j: true }` before issuing emergency token. Durable queue acceptance does not guarantee actual delivery. If queueing fails, access is denied (`HTTP 503`).

### Selection 3: Operational Financial Redaction & Receipt Blockade (Policy B)
- **Selected:** **Option 3A (Monetary Redaction with Metric Preservation & Receipt Image Blockade)**
- **Policy:** Redact all rupee (`INR`) fields to `null` on operational endpoints while keeping physical metrics visible. Block receipt URLs (`receipt_url: null`) and receipt file access during all support sessions. Pure financial routes remain 100% blocked (`HTTP 403`).

### Selection 4: Extended Driver PII Masking (Policy C)
- **Selected:** **Option 4A (Extended Permanent Masking Without Exceptions)**
- **Policy:** Strict permanent server-side masking across all support sessions without exceptions: Aadhaar, PAN, bank accounts, mobile/emergency phones, driving licence (`DL-XXXXXXXXX1234`), DOB, address, and block KYC document photos (`null`). Zero unmasking permitted.

### Selection 5: Internal Support Ticket Prerequisite & Lockout Intake (Policy D)
- **Selected:** **Option 5A (Strict In-App Ticket Required with Out-of-Band Lockout Intake)**
- **Policy:** Strict in-app support ticket required belonging to target tenant. For customer lockouts, permit authenticated Super-Admin creation of an internal ticket on customer's behalf after documented out-of-band identity verification, fully logged in audit trail.

### Selection 6: Database Unavailability Fail-Closed Contract (Policy E)
- **Selected:** **Fail-Closed Verification Contract**
- **Policy:** If session verification, expiry, revocation, tenant scope, or permission verification cannot complete due to database unreachability or timeout, fail closed: deny support request with `HTTP 503 Service Unavailable`. Never fail open.

---

---

## 6. Measurable Acceptance Criteria & Verification Gates

Before implementation can be considered for release, the following quantitative, measurable criteria must be satisfied in automated testing:

### 6.1 Measurable Technical Acceptance Criteria

1. **Notification Durability & Retry Monitoring:**
   - Synchronous write of `NotificationJob` to the MongoDB replica set must enforce write concern `{ w: "majority", j: true }` with a maximum execution timeout of **5,000 ms**.
   - If write exceeds 5,000 ms or fails quorum, emergency token generation must abort and return `HTTP 503` within **5,500 ms**.
   - The notification worker must track delivery states: `queued` -> `dispatched` -> `delivered` / `failed`.
   - If delivery status remains `failed` after 3 retry attempts over 5 minutes, an automated high-severity platform alert (`SEV-1_EMERGENCY_NOTIFICATION_DELIVERY_FAILED`) must be generated in platform telemetry.
2. **Immediate Revocation Latency:**
   - When a tenant admin or operator invokes `POST /api/support/sessions/:id/revoke`, the document status in MongoDB must transition to `'revoked'` with majority write concern.
   - The subsequent API call by the operator bearing the revoked session token must be rejected with `HTTP 403 Forbidden (SUPPORT_SESSION_REVOKED)` within **100 ms** of the revocation timestamp.
3. **Fail-Closed Verification on Database Impairment:**
   - Under simulated MongoDB disconnection or connection pool timeout, all incoming requests where `req.isImpersonation === true` must return `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)` within **2,000 ms**. Zero requests may proceed with optimistic JWT validation.
4. **Audit Transaction Integrity:**
   - The state transition of `SupportAccessRequest` to `'active'` and the insertion of `PlatformAuditLog` must execute within a single MongoDB multi-document ACID transaction session (`session.withTransaction(...)`).
   - If `PlatformAuditLog.create` fails or aborts, `SupportAccessRequest` must roll back cleanly. There must be **0 active support sessions** without an accompanying platform audit record.
5. **Tenant Isolation:**
   - An operator token issued for Tenant A must return `HTTP 403 / 404` when querying or mutating resources belonging to Tenant B (e.g. `x-company-id: TenantB` header or URL parameters).
   - `SupportTicket` validated for access must have `ticket.company_id.toString() === targetCompanyId.toString()`.
6. **Receipt Access Denial:**
   - Every operational endpoint (`/api/operations/journeys`, `/api/operations/journeys/:id`, `/api/operations/entries`, etc.) must return `receipt_url: null`, `toll_receipt_url: null`, and redact nested receipt URLs in arrays.
   - Direct HTTP requests to file download or S3 pre-signed URL generation endpoints for receipts during an impersonation session must return `HTTP 403 Forbidden (RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT)`.
7. **Complete PII Masking:**
   - All response payloads across direct driver routes, nested journey/truck/settlement routes, `.lean()` queries, reports, and CSV exports must format:
     - Aadhaar: `XXXX-XXXX-1234`
     - Phone / Emergency Phone: `+91 98765 XXXXX`
     - PAN: `XXXXX1234X`
     - Bank Account: `XXXXXX1234` (IFSC: `null`)
     - Driving License: `DL-XXXXXXXXX1234`
     - Address: `null`
     - DOB: `null`
     - Document Photos: `null`
   - Zero occurrences of raw unmasked 12-digit Aadhaar numbers or 10-digit mobile numbers in serialized responses.

---

### 6.2 Database Lookup Overhead Benchmark Methodology

The proposed target of "< 2 ms" for the indexed database lookup in `resolveTenantContext` is currently an **UNVERIFIED SPECIFICATION ESTIMATE**, not a measured performance metric.

#### Benchmark Methodology
- **Harness:** Run synthetic HTTP benchmarks using k6 or Autocannon against a staging environment with realistic networking topology (application containers communicating with a managed MongoDB replica set over a VPC intranet, rather than localhost or in-memory).
- **Workload:** Measure P50, P95, and P99 latency of `SupportAccessRequest.findOne({ _id: decoded.supportRequestId, tenant_id: decoded.tenantId, status: 'active' }).lean()` under concurrent load profiles of 100, 500, and 1,000 requests/sec.
- **Reporting Requirement:** Report the specification target (`< 2 ms`) distinctly from actual measured results. Realistic production expectations under load and intra-VPC latency typically yield P50 between 1.5–3.5 ms and P99 between 8–15 ms (especially during replica primary election spikes).

---

### 6.3 Prioritized Negative Security Test Suite

The following negative security test suite must pass with a 100% success rate before any release containing Batch A code:

#### Priority 0 (P0) — Critical Security Gates (Hard Blockers)
- [ ] `SEC-P0-01` (Cross-Tenant Access Rejection): Operator with an approved session for Tenant A attempts to access Tenant B routes (`x-company-id: TenantB`). Expect: `HTTP 403 Forbidden / TENANT_SCOPE_MISMATCH`.
- [ ] `SEC-P0-02` (Revoked Session Immediate Rejection): Tenant Admin revokes active session via `POST /api/support/sessions/:id/revoke`; operator's next API request returns `HTTP 403 Forbidden / SUPPORT_SESSION_REVOKED`.
- [ ] `SEC-P0-03` (Expired Session Rejection): Operator presents token at `expires_at + 1s`. Expect: `HTTP 403 Forbidden / SUPPORT_SESSION_EXPIRED`.
- [ ] `SEC-P0-04` (Fail-Closed on Database Partition): Simulate MongoDB disconnection or connection pool exhaustion; incoming operator request returns `HTTP 503 Service Unavailable / SESSION_VERIFICATION_FAILED` (zero optimistic JWT fallback).
- [ ] `SEC-P0-05` (Audit Persistence Failure Rollback): Mock `PlatformAuditLog.create` write failure; verify session remains unactivated (`HTTP 500 / AUDIT_PERSISTENCE_FAILED`) and no cookie/token is issued.
- [ ] `SEC-P0-06` (Self-Approved Emergency Rejection): Emergency request where `approver_id === requester_id` returns `HTTP 400 Bad Request / CANNOT_APPROVE_OWN_EMERGENCY_REQUEST`.
- [ ] `SEC-P0-07` (Non-Super-Admin Approver Rejection): Emergency request approved by non-super-admin user returns `HTTP 403 Forbidden / APPROVER_NOT_SUPER_ADMIN`.

#### Priority 1 (P1) — High Security Gates
- [ ] `SEC-P1-01` (Notification Queue Failure Rejection): Mock MongoDB write concern timeout during `NotificationJob` insert; emergency token generation aborts with `HTTP 503 / EMERGENCY_NOTIFICATION_FAILED`.
- [ ] `SEC-P1-02` (Pure Financial Route Lockout): Support session attempting `GET /api/finance/invoices`, `GET /api/finance/ledgers/*`, `GET /api/commercial/settlements` returns `HTTP 403 Forbidden / FINANCIAL_RECORDS_LOCKED`.
- [ ] `SEC-P1-03` (Financial Export Lockout): Support session attempting `GET /api/finance/invoices/export` or ledger exports returns `HTTP 403 Forbidden / SUPPORT_EXPORT_BLOCKED`.
- [ ] `SEC-P1-04` (Direct Receipt Access Denial): Direct GET request to download receipt image or generate pre-signed URL during support session returns `HTTP 403 Forbidden / RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT`.
- [ ] `SEC-P1-05` (Operational Receipt URL Suppression): `GET /api/operations/journeys/:id` returns `receipt_url: null` and `toll_receipt_url: null`.
- [ ] `SEC-P1-06` (Direct & Nested Driver PII Masking): `GET /api/fleet/drivers`, `GET /api/operations/journeys/:id` (populated driver), and `GET /api/fleet/trucks` (current driver) verify that Aadhaar, PAN, Bank, Phone, License, Address, and DOB are strictly masked and KYC URLs are `null`.
- [ ] `SEC-P1-07` (Mongoose `.lean()` Query PII Interception): Query using `.lean()` verifies that Express response serialization interceptor prevents raw PII leakage.
- [ ] `SEC-P1-08` (Tabular Export PII Masking): Driver export CSV contains only masked strings (`XXXX-XXXX-1234`, `DL-XXXXXXXXX1234`), with zero raw plaintext identifiers.
- [ ] `SEC-P1-09` (Closed or Nonexistent Ticket Rejection): Support access request referencing a closed ticket or non-existent ticket returns `HTTP 400 Bad Request / INVALID_SUPPORT_TICKET`.
- [ ] `SEC-P1-10` (Cross-Tenant Ticket Rejection): Support access request for Tenant A referencing an active ticket belonging to Tenant B returns `HTTP 403/404 / CROSS_TENANT_TICKET_FORBIDDEN`.

#### Priority 2 (P2) — Medium Security & Integrity Gates
- [ ] `SEC-P2-01` (Out-of-Band Ticket Audit Validation): Super-Admin created ticket on customer behalf missing `verification_method` or `intake_channel` is rejected with `HTTP 400 Bad Request`.
- [ ] `SEC-P2-02` (Error Response Sanitization): Forcing duplicate driver or party validation error during support session verifies raw Aadhaar or phone numbers are never reflected in error payloads.

---

## 7. Security Readiness Gate Verdict

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        BATCH A SECURITY READINESS GATE VERDICT                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ VERDICT: READY FOR IMPLEMENTATION AUTHORIZATION REVIEW                                 │
│ CURRENT POSTURE: HOLD — DOCUMENTATION ONLY. IMPLEMENTATION REMAINS UNAUTHORIZED.       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ EVIDENCE-BASED ASSESSMENT:                                                             │
│ 1. All six policy recommendations are fully reconciled, specified, and recorded as      │
│    PROPOSED — PENDING REVIEW.                                                          │
│ 2. Existing decisions DEC-003 (Pending Review), DEC-007 (Proposed — Pending Review),   │
│    and DEC-008 (Proposed — Pending Review) are strictly preserved.                     │
│ 3. All architectural contradictions (DEC-012 exception, notification queue delivery,   │
│    receipt image lockout, extended PII coverage, and lockout intake) are documented     │
│    with concrete trade-offs and decision options.                                      │
│ 4. Measurable acceptance criteria and a prioritized 19-point negative security test   │
│    matrix (P0, P1, P2) are fully defined.                                              │
│ 5. Database lookup latency (< 2 ms) is formally categorized as an unverified target,  │
│    with an objective staging benchmark methodology established.                        │
│ 6. The governance package is complete and ready for Product Owner decision review.     │
│                                                                                        │
│ NEXT STEP: Await explicit Product Owner authorization before modifying source code.    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```


