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
2. **Workspace-Admin Controlled Access:** Super-Admin support access to a tenant workspace requires explicit authorization from that tenant's Workspace Admin.
3. **Scoped Support Sessions:** Support sessions must be linked to an active support ticket, limited to specific scopes (e.g., Read-Only Diagnostics vs Authorized Configuration), and enforce a strict time limit (default 1 hour).
4. **Revocation & Expiry:** Workspace admins can revoke active support sessions at any time. Sessions automatically expire upon time limit reaching zero.
5. **Backend Enforcement:** The backend enforces support session tokens and scopes on every API route; UI-only hiding is strictly prohibited.
6. **Full Audit Logging:** All operator actions performed during a support session are permanently logged with operator ID, tenant ID, ticket ID, and exact action details.

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

## 7. Explicit Scope Boundaries

Governs platform operator access to customer business records. Does not prevent Super-Admin from managing tenant subscriptions, billing status, or platform health telemetry.

## 8. What is Not Yet Implemented or Verified

Workspace-admin approval workflow and scoped backend token enforcement are not yet implemented (FF-ISSUE-056, FF-ISSUE-057).

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-022](../issues/support-tickets/FF-ISSUE-022-central-support-inbox-missing.md), [FF-ISSUE-056](../issues/support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md), [FF-ISSUE-057](../issues/support-impersonation/FF-ISSUE-057-support-impersonation-approval-missing.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
