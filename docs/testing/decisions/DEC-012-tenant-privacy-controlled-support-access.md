# DEC-012 — Tenant Privacy Architecture and Controlled Support Impersonation Access

## Metadata

- **Decision ID:** DEC-012
- **Title:** Tenant Privacy Architecture and Controlled Support Impersonation Access
- **Status:** Scope Locked
- **Date:** Design direction locked
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-022](../issues/support-tickets/FF-ISSUE-022-central-support-inbox-missing.md), [FF-ISSUE-056](../issues/support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md), [FF-ISSUE-057](../issues/support-impersonation/FF-ISSUE-057-support-impersonation-approval-missing.md)

---

## 1. Context and Problem Statement

Platform Super-Admins could enter customer workspaces via an unconstrained "Access" button, exposing private fleet and financial records without tenant knowledge or authorization.

## 2. Decision Statement

The tenant data privacy and support access architecture is locked with the following principles:
1. **Data Ownership:** Customers own and control their business data. Platform Super-Admins manage infrastructure and platform telemetry, with zero automatic access to customer operational or financial records.
2. **Workspace-Admin Controlled Access:** Super-Admin support access to a tenant workspace requires explicit authorization from that tenant's Workspace Admin, **except under the formal Dual-Super-Admin Emergency Break-Glass Exception proposed in Section 2.1 (Policy A)**.
3. **Scoped Support Sessions:** Support sessions must be linked to an active support ticket, limited to specific scopes (e.g., Read-Only Diagnostics vs Authorized Configuration), and enforce a strict time limit (default 1 hour).
4. **Revocation & Expiry:** Workspace admins can revoke active support sessions at any time. Sessions automatically expire upon time limit reaching zero.
5. **Backend Enforcement:** The backend enforces support session tokens and scopes on every API route; UI-only hiding is strictly prohibited.
6. **Full Audit Logging:** All operator actions performed during a support session are permanently logged with operator ID, tenant ID, ticket ID, and exact action details.

### 2.1 Proposed Security Policy Selections (PROPOSED — PENDING REVIEW)

The Product Owner has delegated selection of the recommended policy options. The following six policy recommendations are recorded as **PROPOSED — PENDING REVIEW** (Implementation is strictly on **HOLD**):

#### 1. Emergency Break-Glass Access Exception (Policy A — Option 1A) (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** In catastrophic tenant lockout scenarios where customer administrators cannot access their workspace, emergency support access may be granted without prior tenant-admin approval under a strict dual-authorization break-glass exception.
- **Rules & Constraints:**
  - Requires approval from two distinct Super-Admin accounts (`requested_by_user_id !== approved_by_user_id`).
  - Access is strictly read-only diagnostics (`diagnostics_readonly`), with zero mutation or configuration write privileges.
  - Hard maximum duration of **30 minutes** with **zero renewal or extension**.
  - Urgent customer notification is mandatory across registered Workspace Admin contacts.
  - Immutable platform audit logging of requester, approver, target tenant, justification, and all session activity.

#### 2. Notification Delivery Contract: Queue Acceptance (Policy A2 — Option 2A/Option A) (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** Synchronously persist the urgent notification job using MongoDB majority write concern (`{ w: "majority", j: true }`) before issuing an emergency-access token.
- **Rules & Constraints:**
  - **Durable Queue Acceptance:** Guarantees notification job is committed to database replica log and will survive primary failover.
  - **No Guaranteed Customer Delivery:** Durable queue acceptance does **not** guarantee actual delivery to the customer device at token issuance time.
  - **Fail-Closed on Queue Failure:** If durable queueing fails (e.g., replica set cannot achieve majority quorum within timeout), emergency access must be **denied** immediately (`HTTP 503 / EMERGENCY_NOTIFICATION_FAILED`).

#### 3. Database Unavailability & Verification Fail-Closed (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** On every incoming API request during a support session, the backend middleware must verify session validity, token expiry, revocation status, tenant scope, and permission scope against the database.
- **Rules & Constraints:**
  - If the database is unreachable, partitioned, or query times out, the system must **fail closed**.
  - Deny the support request immediately with `HTTP 503 Service Unavailable (SESSION_VERIFICATION_FAILED)`.
  - Impersonation sessions must **never fail open** or optimistically rely on unverified JWT signatures.

#### 4. Operational Financial Redaction & Receipt Image Lockout (Policy B — Option 3A) (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** Enforce complete financial blindness across all support sessions. Block pure financial routes and exports, redact operational monetary fields, and block receipt-image access.
- **Rules & Constraints:**
  - Redact to `null`: `freight_rate_inr`, `driver_advance_inr`, `estimated_diesel_cost`, `toll_budget_inr`, `diesel_expenses[].cost`, `diesel_expenses[].rate_per_liter`, `driver_expenses[].amount`, `VehicleEntry` advance and freight values, `credit_limit`, `current_balance`, and settlement summaries.
  - Preserve physical operational metrics: fuel liters, fuel station, odometer readings, trip status, toll plaza names, vehicle numbers, route lanes, and milestone timestamps.
  - **Receipt Image Blockade:** Block receipt URLs (`receipt_url: null`, `toll_receipt_url: null`) and intercept direct receipt-image access endpoints during all support sessions. A frontend warning is acknowledged as insufficient protection; server-side suppression is mandatory.
  - Pure financial routes (`/api/finance/*`, `/api/commercial/settlements`, `/api/reports/commercial/*`) and financial exports return `HTTP 403 Forbidden`.

#### 5. Extended Driver PII Masking & Complete Inventory (Policy C — Option 4A) (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** Permanently mask designated driver statutory identification and extended personal details across all support sessions without exceptions.
- **Rules & Constraints:**
  - Mandatory server-side masking across all direct responses, nested data, reports, exports, and error responses.
  - **Complete Field Coverage:**
    - Aadhaar Number: Masked to last 4 digits (`XXXX-XXXX-1234`).
    - PAN Number: Masked to last 4 characters (`XXXXX1234X`).
    - Mobile Phone & Emergency Phone: Masked (`+91 98765 XXXXX`).
    - Bank Account Number: Masked to last 4 digits (`XXXXXX1234`, IFSC omitted).
    - Driving License Number: Masked to last 4 characters (`DL-XXXXXXXXX1234`).
    - Secondary Personal Details: Date of Birth (`date_of_birth`), Home Address (`address`), and family/father's details redacted to `null` or masked.
    - KYC Document URLs: Block document images (`license_front_url`, `license_back_url`, `aadhaar_front_url`, `aadhaar_back_url`, `photo_url` set to `null`).
  - Zero unmasking exceptions permitted, even with customer Workspace-Admin consent.

#### 6. Customer Lockout Ticket Intake (Policy D — Option 5A) (Proposed — Pending Review)
- **Status:** Proposed — Pending Review
- **Policy:** Every support access request must reference an existing, active Fleet Flow internal support ticket (`SupportTicket`) belonging to the exact target tenant. External CRM/Jira keys are strictly prohibited.
- **Rules & Constraints:**
  - **Lockout Ticket Creation:** For customer lockout scenarios where customer admins cannot log in to submit an in-app ticket, an authenticated Super-Admin may create an internal `SupportTicket` on the customer's behalf after documented out-of-band identity verification (e.g., telephone verification with registered customer principal).
  - **Mandatory Audit Trail:** The ticket creation must record the verification method, operator ID, target tenant ID, timestamp, and intake channel (`intake_channel: 'out_of_band_verified_phone'`).
  - The ticket must belong strictly to the exact target tenant (`company_id`). Arbitrary external ticket strings (`JIRA-XXXX`, `INC-XXXX`) remain strictly prohibited.

## 3. Alternatives Considered and Trade-Offs

Unconditional operator access was rejected as a violation of enterprise customer trust and data privacy standards.

## 4. Consequences

Requires a formal Support Access Request and Approval workflow, session token issuance, and authorization middleware across all tenant-facing APIs.

## 5. Implementation Implications

Implement `supportAccessRequest` collection, approval flow in workspace settings, and `requireSupportScope` middleware in backend API controllers.

## 6. Acceptance Criteria and Verification Requirements

- [ ] DEC-012 design direction is locked. Implementation not authorized in this documentation phase.
- [ ] Super-Admin cannot enter tenant workspace without approved support session token.
- [ ] Support sessions expire automatically after duration and can be revoked by Workspace Admin.
- [ ] Every action taken during support session is stamped with operator identity in audit logs.
- [ ] Proposed Policies A, A2, B, C, and D are evaluated in BATCH_A_POLICY_CONFLICTS.md and require formal sign-off.

## 7. Explicit Scope Boundaries

Governs platform operator access to customer business records. Does not prevent Super-Admin from managing tenant subscriptions, billing status, or platform health telemetry.

## 8. What is Not Yet Implemented or Verified

Workspace-admin approval workflow and scoped backend token enforcement are not yet implemented (FF-ISSUE-056, FF-ISSUE-057). The six recommended policy options are recorded as **PROPOSED — PENDING REVIEW**. Implementation is strictly on **HOLD — DOCUMENTATION ONLY. NO CODE CHANGES AUTHORIZED.**

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-022](../issues/support-tickets/FF-ISSUE-022-central-support-inbox-missing.md), [FF-ISSUE-056](../issues/support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md), [FF-ISSUE-057](../issues/support-impersonation/FF-ISSUE-057-support-impersonation-approval-missing.md)
- Reconciliation Analysis: [BATCH_A_POLICY_CONFLICTS.md](../audit/BATCH_A_POLICY_CONFLICTS.md)
- Preflight Review: [BATCH_A_PREFLIGHT_REVIEW.md](../audit/BATCH_A_PREFLIGHT_REVIEW.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`

