# DEC-001 — Fleet Flow Pricing, Tiering, and Quota Matrix

## Metadata

- **Decision ID:** DEC-001
- **Title:** Fleet Flow Pricing, Tiering, and Quota Matrix
- **Status:** Approved
- **Date:** 2026-10-14
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-002](../issues/ui-ux/FF-ISSUE-002-trial-duration-inconsistency.md), [FF-ISSUE-023](../issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)

---

## 1. Context and Problem Statement

Fleet Flow required a standardized pricing, subscription tiering, and operational quota matrix to define billing policies, truck/branch/user caps, and trial durations.

## 2. Decision Statement

The following pricing and quota tiers are approved as authoritative:

- **Trial Plan:** 7 days duration; includes Starter tier feature set for evaluation.
- **Starter Plan:** ₹1,999/month or ₹19,990/year. Quotas: 15 trucks, 1 branch, 2 users.
- **Standard Plan:** ₹3,999/month or ₹39,990/year. Quotas: 30 trucks, 3 branches, 5 users.
- **Pro Plan:** ₹8,999/month or ₹89,990/year. Quotas: Unlimited trucks (subject to fair use / documented operational policy), multi-branch, advanced modules (Tyre, Maintenance, Audit Logs).

## 3. Alternatives Considered and Trade-Offs

Considered 14-day trials or per-truck micro-billing, but rejected to maintain simple tier structures and encourage faster trial-to-paid conversion.

## 4. Consequences

All marketing pages, pricing calculators, registration flows, and backend subscription provisioning must strictly adhere to the 7-day trial and approved quota numbers.

## 5. Implementation Implications

Backend tenant creation must provision trial end dates strictly 7 days from creation. Quota enforcement middleware must validate truck, branch, and user creation against the tenant subscription plan.

## 6. Acceptance Criteria and Verification Requirements

- [ ] New tenant registrations provision exactly 7-day trial periods.
- [ ] Pricing page and FAQ reflect Starter (₹1,999/mo), Standard (₹3,999/mo), and Pro (₹8,999/mo).
- [ ] Exceeding 15 trucks on Starter plan is blocked with an upgrade prompt.
- [ ] Exceeding 1 branch on Starter or 3 branches on Standard is rejected by backend APIs.

## 7. Explicit Scope Boundaries

Governs subscription tier pricing, quotas, and trial durations. Does not cover customized enterprise contracts or bespoke payment terms.

## 8. What is Not Yet Implemented or Verified

Backend 7-day trial enforcement vs 14-day display bug (FF-ISSUE-002, FF-ISSUE-023) and backend API quota enforcement remain to be verified.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-002](../issues/ui-ux/FF-ISSUE-002-trial-duration-inconsistency.md), [FF-ISSUE-023](../issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
