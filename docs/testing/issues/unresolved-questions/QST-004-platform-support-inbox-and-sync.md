# QST-004 — Platform-Wide Support Inbox Existence and Shared Ticket Synchronization

## Metadata

- **Question ID:** QST-004
- **Title:** Platform-Wide Support Inbox Existence and Shared Ticket Synchronization
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Support Operations / Tenant Ticketing
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q4)`
- **Related Issues:** [FF-ISSUE-020](../support-tickets/FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-021](../support-tickets/FF-ISSUE-021-support-ticket-thread-layout.md), [FF-ISSUE-022](../support-tickets/FF-ISSUE-022-central-support-inbox-missing.md)
- **Related Decisions:** DEC-012
- **Expected Owner / Phase:** Full-Stack Engineer / Inspect frontend admin routes and backend ticket controller during Phase 1 audit.

---

## 1. Core Question

Does a central platform support inbox exist in the codebase, and do ticket conversation messages share a single canonical record synchronized across tenant and support operator views?

## 2. Background and Testing Context

Tenant-side ticketing and replies were verified within impersonation (`TICK-2026-0001`), but no cross-tenant support inbox was discovered in the Super-Admin navigation.

## 3. Evidence Required to Resolve

- [ ] Search codebase for support ticket admin views (e.g. `SupportInbox`, `TicketManagement`, `/admin/support`).
- [ ] Inspect `Ticket` and `TicketMessage` schemas for tenant scoping and synchronization fields.
- [ ] Verify if reply actions trigger notifications or status transitions across actor roles.

## 4. Planned Investigation Activity

Inspect frontend admin routes and backend ticket controller during Phase 1 audit.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-020](../support-tickets/FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-021](../support-tickets/FF-ISSUE-021-support-ticket-thread-layout.md), [FF-ISSUE-022](../support-tickets/FF-ISSUE-022-central-support-inbox-missing.md)
- Related Decisions: DEC-012
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
