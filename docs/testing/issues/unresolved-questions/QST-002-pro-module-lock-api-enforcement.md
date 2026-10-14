# QST-002 — Pro Module Feature Lock Backend API Enforcement Status

## Metadata

- **Question ID:** QST-002
- **Title:** Pro Module Feature Lock Backend API Enforcement Status
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Tenant Entitlements / Access Control
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q2)`
- **Related Issues:** [FF-ISSUE-012](../ui-ux/FF-ISSUE-012-pro-badge-module-lock-bypass.md), [FF-ISSUE-025](../subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md)
- **Related Decisions:** DEC-001
- **Expected Owner / Phase:** Security & Backend Engineer / Audit Express route middleware and entitlement services in Phase 1 code audit.

---

## 1. Core Question

Are PRO module restrictions (e.g. Maintenance & Repairs, Tyre Management) enforced by backend authorization middleware, or are endpoints completely open if accessed directly?

## 2. Background and Testing Context

Maintenance & Repairs opened its full operational interface despite having a PRO lock badge on the Starter plan. Testing did not verify whether direct API requests are blocked with HTTP 403.

## 3. Evidence Required to Resolve

- [ ] Inspect route definition files for `/api/maintenance` and `/api/tyres`.
- [ ] Check for existence of `requirePlan('PRO')` or `requireEntitlement('maintenance')` middleware.
- [ ] Execute direct curl/Postman requests to maintenance endpoints using a Starter tenant bearer token.

## 4. Planned Investigation Activity

Audit Express route middleware and entitlement services in Phase 1 code audit.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-012](../ui-ux/FF-ISSUE-012-pro-badge-module-lock-bypass.md), [FF-ISSUE-025](../subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md)
- Related Decisions: DEC-001
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
