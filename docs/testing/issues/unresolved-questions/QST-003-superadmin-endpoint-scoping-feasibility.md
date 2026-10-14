# QST-003 — Super-Admin Endpoint Enumeration and Tenant Data Scoping Feasibility

## Metadata

- **Question ID:** QST-003
- **Title:** Super-Admin Endpoint Enumeration and Tenant Data Scoping Feasibility
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Super-Admin Portal / Platform Security
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q3)`
- **Related Issues:** [FF-ISSUE-056](../support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md)
- **Related Decisions:** DEC-012
- **Expected Owner / Phase:** Platform Security Lead / Comprehensive endpoint audit and architectural review of impersonation mechanisms in Phase 2.

---

## 1. Core Question

Which exact backend endpoints grant Super-Admin access to tenant business data, and how can they be refactored to enforce scoped, time-limited support sessions under DEC-012?

## 2. Background and Testing Context

Super-Admin portal allows entering Farma Logistics workspace with an audited justification modal, but grants broad, unconstrained access to tenant trucks and money flow once inside.

## 3. Evidence Required to Resolve

- [ ] Enumerate all routes mounted under `/api/admin` and tenant-scoped routes accepting Super-Admin JWTs.
- [ ] Inspect token verification middleware (`authenticate`, `requireRole`, `tenantContext`).
- [ ] Determine how tenant context is established during impersonation (session cookie vs header vs claims).

## 4. Planned Investigation Activity

Comprehensive endpoint audit and architectural review of impersonation mechanisms in Phase 2.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-056](../support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md)
- Related Decisions: DEC-012
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
