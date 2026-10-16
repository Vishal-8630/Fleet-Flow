# QST-006 — Notification Delivery Receipt Ingestion and Delivery Rate Calculation

## Metadata

- **Question ID:** QST-006
- **Title:** Notification Delivery Receipt Ingestion and Delivery Rate Calculation
- **Priority:** High
- **Status:** **Resolved (Batch F)**
- **Affected Module:** Notifications & Communications
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q6)`
- **Related Issues:** [FF-ISSUE-054](../notifications/FF-ISSUE-054-notification-delivery-tracking-zero-rate.md), [FF-ISSUE-055](../notifications/FF-ISSUE-055-notification-retry-webhook-lifecycle.md)
- **Related Decisions:** [DEC-011](../../decisions/DEC-011-notification-delivery-reliability-scope.md)
- **Resolution:** Resolved in Batch F with authenticated delivery webhook ingestion, deduplicated processing, monotonic progression, and corrected metric formulas.

---

## 1. Core Question

Why are delivery receipts absent from Notification Delivery Logs, and is the 0% delivered ratio caused by missing provider webhooks, test mock delivery, or a metric computation bug?

## 2. Background and Testing Context

Four WhatsApp notification rows showed status "Sent", but summary metrics displayed "Delivered Ratio: 0%". It was unverified whether webhooks failed or were never sent by the test gateway.

## 3. Findings & Root Cause Analysis

1. **Premature Timestamp vs Status Decoupling:** In the legacy worker, message logs were marked `sent` immediately upon dispatch, but `delivered_at` was never set by the dispatch loop.
2. **Missing Delivery Receipt Ingestion:** Inbound WhatsApp webhooks lacked signature verification, state machine validation, and idempotency deduplication to transition messages from `sent` to `delivered`.
3. **Metric Calculation Semantics:** The dashboard calculation strictly counted `delivered` or `read` statuses in the numerator. Because messages remained in `sent` pending asynchronous webhook callbacks, the delivered ratio accurately evaluated to `0 / 4 = 0%`. Without an explicit "Pending Confirmation" counter or visual indicator, operators interpreted 0% as total dispatch failure.

## 4. Resolution Implemented in Batch F

- **Webhook Handler (`webhookController.ts`):** Ingests WhatsApp status payloads (`delivered`, `read`, `failed`), verifies `X-Hub-Signature-256`, deduplicates via `ProcessedWebhook`, and strictly enforces monotonic progression (`queued` < `sent` < `delivered` < `read`).
- **Metric Formulation (`notificationController.ts`):** Excludes skipped (DND) recipients from the denominator (`eligibleCount = total - skipped`), computes `delivered_ratio = Math.round((delivered / eligibleCount) * 100)`, and exports `pending: stats.sent`.
- **UI Clarification (`NotificationLogsPage.tsx`):** Added a 5th KPI card for "Pending Confirmation", displayed "Sent (Pending)" badges with helper tooltips, and included a 4-step delivery progress timeline in the log details modal.

## 5. Verification Evidence

- Automated integration test suite: `backend/src/tests/integration/phase6BatchFNotificationTracking.test.ts` (21 tests passing).
- Zero regression across all Batch E suites (116 total tests passing).
- Clean frontend production build (`tsc -b && vite build`).
