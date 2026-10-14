# Absence of Central Platform-Wide Support Inbox for SaaS Operators

## Metadata

- **ID:** FF-ISSUE-022
- **Category:** Workflow / Support
- **Priority:** High
- **Status:** Observed / Needs Verification
- **Affected module:** Super-Admin Control Plane & Support Operations
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.G, Platform-wide support inbox)
- **Related issues:** [FF-ISSUE-020](FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-021](FF-ISSUE-021-support-ticket-thread-layout.md), [FF-ISSUE-056](../support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md)
- **Related decisions:** [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md)
- **Implementation status:** Not implemented

## 1. Summary

The Super-Admin portal provides no centralized cross-tenant support inbox. Platform operators currently have no view to list, triage, prioritize, or respond to customer tickets without directly impersonating into individual tenant workspaces.

## 2. Observed behavior

In the Super-Admin portal sidebar, the only visible options are "Control Plane & Tenants" and "SaaS Plans & Catalogs". There is no "Support Tickets" or "Help Desk" menu item. The only way the Super-Admin interacted with ticket `TICK-2026-0001` was by clicking "Access" to impersonate Farma Logistics and navigating to the tenant's private `/support` view.

## 3. Expected behavior

A centralized, cross-tenant Platform Support Inbox in the Super-Admin portal where authorized support agents can:
- View all tickets submitted across all client workspaces in real-time.
- Filter by Tenant, Status (Open, In Progress, Waiting on Customer, Resolved), Priority, and Category.
- Reply directly to tickets within a shared ticket conversation record without needing full workspace impersonation.
- Link support tickets to audited support impersonation sessions when deep troubleshooting is approved.

## 4. Reproduction steps

1. Log in with Platform Super-Admin credentials (`vishh8630@gmail.com`).
2. Navigate to `/super-admin`.
3. Inspect sidebar navigation items.
4. Confirm absence of any cross-tenant support inbox.

## 5. Impact and risk

Critical operational bottleneck. Customer support cannot scale if support agents must manually impersonate customer accounts to discover and reply to open help requests. Furthermore, impersonation exposes sensitive financial data for simple ticket questions.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Tenant-level support routes (`supportRoutes.ts`) exist, but no platform-level support controller or Super-Admin view was built to aggregate tickets across tenants.

## 7. Investigation required

- Inspect `backend/src/models/SupportTicket.ts` and `backend/src/routes/supportRoutes.ts`.
- Check if Super-Admin support endpoints exist in `backend/src/routes/superAdminRoutes.ts`.
- Investigate whether ticket messages share a single unified MongoDB collection.

## 8. Proposed resolution or agreed design

1. Implement `GET /api/super-admin/tickets` and `POST /api/super-admin/tickets/:id/reply`.
2. Add "Support Inbox" to the Super-Admin sidebar with badge counters for unread tickets.
3. Ensure two-way message synchronization between the platform support agent and the customer tenant.

## 9. Acceptance criteria

- [ ] Central Support Inbox is accessible in the Super-Admin portal.
- [ ] Support agents can view, filter, and assign tickets from all client companies.
- [ ] Replies submitted from the central inbox appear instantly in the tenant's ticket thread.
- [ ] Platform agents can resolve or update ticket statuses without workspace impersonation.

## 10. Required tests

- API integration tests for Super-Admin cross-tenant ticket listing and message posting.
- Authorization tests verifying regular tenant users cannot access the global support inbox.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-056](../support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md), [DEC-012](../../decisions/DEC-012-tenant-privacy-and-support-access.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
