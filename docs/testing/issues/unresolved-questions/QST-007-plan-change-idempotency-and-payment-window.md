# QST-007 — Subscription Plan-Change Missing Idempotency Key and Payment Window Status

## Metadata

- **Question ID:** QST-007
- **Title:** Subscription Plan-Change Missing Idempotency Key and Payment Window Status
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Subscriptions & Billing
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q7)`
- **Related Issues:** [FF-ISSUE-026](../subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md), [FF-ISSUE-027](../subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md)
- **Related Decisions:** DEC-001
- **Expected Owner / Phase:** Billing & Payments Engineer / Inspect billing frontend mutations and payment gateway integration in Phase 1.

---

## 1. Core Question

Why do plan-change requests omit the `x-idempotency-key` header, and what causes the backend to immediately report that the payment window is closed?

## 2. Background and Testing Context

Clicking plan upgrade on `/settings/billing` produced two error toasts: missing `x-idempotency-key` header and "Payment window closed".

## 3. Evidence Required to Resolve

- [ ] Inspect client-side billing API caller in `billingApi.ts` / frontend mutation hook.
- [ ] Check backend financial idempotency middleware for required headers on plan change route.
- [ ] Audit payment gateway session creation controller to determine why payment window is flagged closed.

## 4. Planned Investigation Activity

Inspect billing frontend mutations and payment gateway integration in Phase 1.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-026](../subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md), [FF-ISSUE-027](../subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md)
- Related Decisions: DEC-001
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
