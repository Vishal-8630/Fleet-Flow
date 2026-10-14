# Notification Delivery Logs Show Sent Status but Zero Delivered Rate

## Metadata

- **ID:** FF-ISSUE-054
- **Category:** Bug / Notifications
- **Priority:** High
- **Status:** Observed / Needs Verification
- **Affected module:** Communications & Notification Delivery Logs
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.F, Notification Delivery Logs)
- **Related issues:** [FF-ISSUE-055](FF-ISSUE-055-notification-retry-webhook-lifecycle.md)
- **Related decisions:** [DEC-011](../../decisions/DEC-011-notification-reliability-and-retries.md)
- **Implementation status:** Not implemented

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

- [ ] Delivery receipt webhooks update notification status from `sent` to `delivered`.
- [ ] Delivered Ratio accurately calculates `delivered / (total dispatched - skipped)`.
- [ ] Message rows display receipt timestamps and delivery status timelines.

## 10. Required tests

- Integration tests simulating delivery receipt webhooks and verifying metric accuracy.

## 11. Dependencies and related issues

- Governed by [DEC-011](../../decisions/DEC-011-notification-reliability-and-retries.md).
- Related to [FF-ISSUE-055](FF-ISSUE-055-notification-retry-webhook-lifecycle.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
