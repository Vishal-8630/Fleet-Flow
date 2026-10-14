# Platform Super-Admin Possesses Unrestricted Unscoped Access to Tenant Business Data

## Metadata

- **ID:** FF-ISSUE-056
- **Category:** Security / Architecture
- **Priority:** Critical
- **Status:** Observed / Agreed Future Behavior
- **Affected module:** Super-Admin Control Plane & Tenant Security
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.G, Super-Admin workspace access)
- **Related issues:** [FF-ISSUE-022](../support-tickets/FF-ISSUE-022-central-support-inbox-missing.md), [FF-ISSUE-057](FF-ISSUE-057-support-impersonation-approval-missing.md)
- **Related decisions:** [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md)
- **Implementation status:** Not implemented

## 1. Summary

The Platform Super-Admin currently has unrestricted, unscoped access to enter any customer's workspace, allowing SaaS operators to view sensitive business records, customer transactions, bank accounts, and private freight ledgers without scoping or tenant consent.

## 2. Observed behavior

In the Super-Admin portal (`/super-admin`), clicking "Access" on Farma Logistics opens an "Audited Support Impersonation" modal. After entering a generic justification, the Super-Admin enters the tenant's workspace and gains full administrative visibility over trucks, drivers, cash balances, freight invoices, and financial ledger accounts.

## 3. Expected behavior

Per approved security decision [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md):
- Customers own their business data; platform operators manage platform infrastructure.
- Platform Super-Admins should only see platform telemetry, quotas, and subscription statuses by default.
- Access to customer business records must be strictly restricted, ticket-linked, scoped, time-limited, and approved by the customer's workspace administrator.
- Sensitive financial data and private documents must remain masked during support sessions unless explicitly authorized.

## 4. Reproduction steps

1. Log in as Platform Super-Admin.
2. In Super-Admin control plane, click "Access" next to Farma Logistics.
3. Submit justification text and click "Enter Workspace".
4. Navigate to Ledgers, Invoices, and Truck Registries: observe full visibility of private business records.

## 5. Impact and risk

Major enterprise security and data privacy concern. Prospective B2B logistics enterprises will not adopt a platform where SaaS support staff can browse private client freight rates, customer lists, and financial accounts at will.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Super-Admin impersonation assigns a full `admin` role token for the target tenant without scope restrictions or backend field-level masking.

## 7. Investigation required

- Inspect `backend/src/controllers/superAdminController.ts` impersonation token generation.
- Inspect `backend/src/middleware/tenantContext.ts` for support session claims.

## 8. Proposed resolution or agreed design

1. Enforce support session scoping: `read_only` by default, with access restricted to the module related to the support ticket.
2. Mask financial ledger figures and bank details during support sessions unless a specific elevated scope is approved.
3. Enforce backend authorization on all endpoints to prevent API-level data retrieval.

## 9. Acceptance criteria

- [ ] Super-Admin cannot access tenant business records without an active, approved support session.
- [ ] Support sessions default to read-only access.
- [ ] Financial data is masked during ordinary troubleshooting sessions.
- [ ] All actions performed during support sessions are permanently logged in the audit trail.

## 10. Required tests

- Security authorization tests asserting 403 on financial endpoints during basic support impersonation.
- Audit log verification tests recording all impersonation events.

## 11. Dependencies and related issues

- Governed by [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md).
- Related to [FF-ISSUE-057](FF-ISSUE-057-support-impersonation-approval-missing.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
