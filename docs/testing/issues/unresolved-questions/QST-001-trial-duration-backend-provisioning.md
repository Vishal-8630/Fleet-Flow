# QST-001 — Trial Duration Backend Provisioning Policy (7 Days vs 14 Days)

## Metadata

- **Question ID:** QST-001
- **Title:** Trial Duration Backend Provisioning Policy (7 Days vs 14 Days)
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Subscriptions & Tenant Provisioning
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q1)`
- **Related Issues:** [FF-ISSUE-002](../ui-ux/FF-ISSUE-002-trial-duration-inconsistency.md), [FF-ISSUE-023](../subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)
- **Related Decisions:** DEC-001
- **Expected Owner / Phase:** Backend / Billing Engineer / Inspect backend tenant registration controller and database schema during Phase 1 code audit.

---

## 1. Core Question

Does the backend tenant provisioning service create trials with a 7-day or 14-day duration, and is the discrepancy purely in frontend presentation or active in database records?

## 2. Background and Testing Context

DEC-001 established an approved 7-day trial policy. However, manual testing observed registration and dashboard headers stating "14 Days Free Trial Left", while the public FAQ states 7 days.

## 3. Evidence Required to Resolve

- [ ] Inspect `tenantService.createTenant` or registration handler in backend source code.
- [ ] Query raw MongoDB `tenants` collection: examine `trial_ends_at - created_at` duration on existing records.
- [ ] Check frontend dashboard countdown calculation component (`TrialBanner` / `HeaderCountdown`).

## 4. Planned Investigation Activity

Inspect backend tenant registration controller and database schema during Phase 1 code audit.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-002](../ui-ux/FF-ISSUE-002-trial-duration-inconsistency.md), [FF-ISSUE-023](../subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)
- Related Decisions: DEC-001
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
