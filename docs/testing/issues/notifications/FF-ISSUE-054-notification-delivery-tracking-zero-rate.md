# Notification Delivery Logs Show Sent Status but Zero Delivered Rate

## Metadata

- **ID:** FF-ISSUE-054
- **Category:** Bug / Notifications
- **Priority:** High
- **Status:** **Resolved (Batch F)**
- **Affected module:** Communications & Notification Delivery Logs
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.F, Notification Delivery Logs)
- **Related issues:** [FF-ISSUE-055](FF-ISSUE-055-notification-retry-webhook-lifecycle.md)
- **Related decisions:** [DEC-011](../../decisions/DEC-011-notification-delivery-reliability-scope.md)
- **Implementation status:** Implemented & Verified (Batch F)

## 1. Summary

In Notification Delivery Logs, all dispatched messages display status `Sent`, yet the summary metrics report `Total Dispatched: 4`, `Delivered Ratio: 0%`, `Failed: 0`, and `Skipped: 0`, with zero delivery receipts recorded.

## 2. Observed behavior

Viewing Notification Delivery Logs displays four WhatsApp dispatch events. While each event row displays a green badge marked "Sent", the dashboard KPI card indicates a 0% Delivered Ratio. No delivery timestamps or read receipts are populated.

## 3. Expected behavior

The notification engine should distinguish between `Sent` (dispatched to gateway) and `Delivered` (gateway webhook confirmed delivery to recipient device):
- Summary metric "Delivered Ratio" should accurately reflect the ratio of confirmed `Delivered` messages against `Total Dispatched`.
- If delivery receipts are pending from the provider, the status should indicate `Pending Receipt` rather than showing a broken 0% ratio without explanation.

## 4. Reproduction steps

1. Navigate to Settings > Notifications > Delivery Logs (`/settings/notifications/logs`).
2. Review the summary metrics cards at the top.
3. Review table rows showing WhatsApp notifications marked `Sent`.
4. Observe the mismatch between Sent rows and 0% Delivered metric.

## 5. Impact and risk

Operators cannot tell whether automated WhatsApp alerts (trip dispatches, settlement slips) are actually reaching drivers and customers, or failing silently at the telecommunications provider.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Either WhatsApp gateway delivery webhooks are not configured/received, or the backend metric aggregation formula specifically counts `status: 'delivered'` while worker jobs only ever update status to `sent`.

## 7. Investigation required

- Inspect `backend/src/workers/notificationWorker.ts` and `notificationService.ts`.
- Inspect `backend/src/controllers/webhookController.ts` for WhatsApp delivery receipt webhooks.

## 8. Proposed resolution or agreed design

1. Implement inbound webhook handling for delivery receipts (`delivered`, `read`, `failed`).
2. Update metric calculator to provide clear breakdown: `Dispatched`, `Delivered`, `Pending Confirmation`, `Failed`.

## 9. Acceptance criteria
 
- [x] Delivery receipt webhooks update notification status from `sent` to `delivered`.
- [x] Delivered Ratio accurately calculates `delivered / (total dispatched - skipped)`.
- [x] Message rows display receipt timestamps and delivery status timelines.
 
## 10. Required tests
 
- Integration tests simulating delivery receipt webhooks and verifying metric accuracy: `backend/src/tests/integration/phase6BatchFNotificationTracking.test.ts`.
 
## 11. Dependencies and related issues
 
- Governed by [DEC-011](../../decisions/DEC-011-notification-delivery-reliability-scope.md).
- Related to [FF-ISSUE-055](FF-ISSUE-055-notification-retry-webhook-lifecycle.md).
 
## 12. Verification evidence
 
- **Automated Integration Tests:** `phase6BatchFNotificationTracking.test.ts` (21 tests passing).
  - Verified webhook ingestion transitions message status to `delivered` with `delivered_at` timestamp.
  - Verified delivered ratio calculation formula: `Math.round((delivered / eligibleCount) * 100)` where `eligibleCount = total - skipped`.
  - Verified pending confirmation counter is returned to UI (`pending: stats.sent`), eliminating unexplained 0% ratio.
- **Frontend Dashboard:** Updated `NotificationLogsPage.tsx` with:
  - 5-metric KPI cards: Total Dispatched, Confirmed Delivered Ratio, Pending Confirmation, Failed Deliveries, Skipped (DND).
  - Explicit pending receipt badge with tooltip `Awaiting gateway delivery receipt webhook confirmation`.
  - Row badges showing `Sent (Pending)`.
  - 4-stage lifecycle timeline (`Queued` → `Dispatched` → `Delivered` → `Read`).
- **Production Build:** `npm --prefix frontend run build` (`tsc -b && vite build`) passed with zero errors.
