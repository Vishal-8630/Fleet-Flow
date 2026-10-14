# QST-006 — Notification Delivery Receipt Ingestion and Delivery Rate Calculation

## Metadata

- **Question ID:** QST-006
- **Title:** Notification Delivery Receipt Ingestion and Delivery Rate Calculation
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Notifications & Communications
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q6)`
- **Related Issues:** [FF-ISSUE-054](../notifications/FF-ISSUE-054-notification-delivery-tracking-zero-rate.md), [FF-ISSUE-055](../notifications/FF-ISSUE-055-notification-retry-webhook-lifecycle.md)
- **Related Decisions:** DEC-011
- **Expected Owner / Phase:** Integrations & Backend Engineer / Audit notification provider integration and webhook handlers during Phase 4.

---

## 1. Core Question

Why are delivery receipts absent from Notification Delivery Logs, and is the 0% delivered ratio caused by missing provider webhooks, test mock delivery, or a metric computation bug?

## 2. Background and Testing Context

Four WhatsApp notification rows showed status "Sent", but summary metrics displayed "Delivered Ratio: 0%". It is unverified whether webhooks failed or were never sent by the test gateway.

## 3. Evidence Required to Resolve

- [ ] Check webhook endpoint implementation for notification provider callbacks.
- [ ] Inspect message logs in database: are `delivered_at` or `provider_status` fields populated?
- [ ] Inspect the mathematical formula calculating "Delivered Ratio" in `notificationService`.

## 4. Planned Investigation Activity

Audit notification provider integration and webhook handlers during Phase 4.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-054](../notifications/FF-ISSUE-054-notification-delivery-tracking-zero-rate.md), [FF-ISSUE-055](../notifications/FF-ISSUE-055-notification-retry-webhook-lifecycle.md)
- Related Decisions: DEC-011
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
