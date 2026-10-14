# Support Impersonation Session Granted Without Workspace-Admin Prior Approval

## Metadata

- **ID:** FF-ISSUE-057
- **Category:** Security / Workflow
- **Priority:** High
- **Status:** Observed / Agreed Future Behavior
- **Affected module:** Super-Admin Control Plane & Tenant Governance
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.G, Access should require workspace-admin approval)
- **Related issues:** [FF-ISSUE-056](FF-ISSUE-056-superadmin-unscoped-tenant-access.md)
- **Related decisions:** [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md)
- **Implementation status:** Not implemented

## 1. Summary

The current support access mechanism allows the Platform Super-Admin to self-authorize entry into any customer workspace simply by filling out a text justification, completely bypassing customer workspace-admin approval.

## 2. Observed behavior

When the Super-Admin initiates access to a tenant workspace, the modal justification field is prefilled ("Customer support & troubleshooting session"). Clicking "Enter Workspace" immediately generates an active session. The tenant is not notified, and no customer admin approval is requested or verified.

## 3. Expected behavior

Per approved security decision [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md):
- A request-and-approval workflow must be enforced:
  1. Operator submits support access request linking a specific Ticket ID, requested scope, and duration (e.g. 30 mins).
  2. Workspace Admin receives an approval notification inside their dashboard.
  3. Workspace Admin reviews operator identity, ticket ID, and scope, then Approves or Rejects.
  4. Only upon explicit approval is a time-limited session token generated.
  5. Workspace Admin can instantly revoke the session at any time.

## 4. Reproduction steps

1. Log in as Super-Admin.
2. In the tenant table, click "Access" on any tenant.
3. Click "Enter Workspace".
4. Observe immediate entry without any confirmation from the tenant owner.

## 5. Impact and risk

Violates enterprise B2B SaaS security trust boundaries. Enables potential operator abuse without customer knowledge or consent.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Backend endpoint `POST /api/super-admin/impersonate` issues JWT tokens immediately upon request without checking a database `SupportSessionRequest` approval state.

## 7. Investigation required

- Inspect `backend/src/routes/superAdminRoutes.ts` and `superAdminController.ts`.
- Check if any support approval models currently exist.

## 8. Proposed resolution or agreed design

Implement a formal `SupportAccessRequest` model and approval state machine:
`status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired'`.
The backend must reject token generation unless status is `approved` and current time is within `expires_at`.

## 9. Acceptance criteria

- [ ] Super-Admin cannot generate an impersonation token without an approved support request.
- [ ] Workspace Admins can review, approve, or reject support access requests.
- [ ] Workspace Admins can revoke active support sessions immediately.
- [ ] Expired or revoked sessions immediately invalidate operator tokens.

## 10. Required tests

- Security integration tests verifying 403 when requesting impersonation on unapproved requests.
- Immediate revocation test asserting token rejection on next API call.

## 11. Dependencies and related issues

- Governed by [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md).
- Related to [FF-ISSUE-056](FF-ISSUE-056-superadmin-unscoped-tenant-access.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
