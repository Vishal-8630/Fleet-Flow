# Notification Delivery System Lacks Comprehensive Lifecycle, Webhook Safety & Retry Policy

## Metadata

- **ID:** FF-ISSUE-055
- **Category:** Architecture / Reliability
- **Priority:** High
- **Status:** **Resolved (Batch F)**
- **Affected module:** Communications & Notification Dispatch Engine
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.F, Design scope agreed/locked)
- **Related issues:** [FF-ISSUE-054](FF-ISSUE-054-notification-delivery-tracking-zero-rate.md)
- **Related decisions:** [DEC-011](../../decisions/DEC-011-notification-delivery-reliability-scope.md)
- **Implementation status:** Implemented & Verified (Batch F)

## 1. Summary

The current notification service lacks an enterprise-grade delivery lifecycle: missing bounded exponential backoff retries for transient provider outages, lack of duplicate webhook protection, and absence of manual retry triggers for failed critical alerts.

## 2. Observed behavior

Notifications are dispatched synchronously or via a basic interval worker without formal retry policies. Failed dispatches are not retried with backoff, out-of-order webhooks can overwrite final states, and operators cannot manually re-trigger a failed trip dispatch alert.

## 3. Expected behavior

Per approved decision [DEC-011](../../decisions/DEC-011-notification-reliability-and-retries.md):
- Explicit states: `Queued`, `Sending`, `Sent`, `Delivered`, `Failed`, `Skipped`.
- Bounded retries: 3 attempts with exponential backoff for transient 5xx errors; zero retries for permanent 4xx invalid numbers or opt-outs.
- Webhook safety: Idempotent processing using provider message IDs.
- Audit history: Full attempt logs with timestamps, error codes, and payload previews.
- Operator controls: Manual "Retry Notification" action for authorized staff.

## 4. Reproduction steps

1. Disconnect network or configure invalid provider credentials.
2. Trigger an LR generation event.
3. Observe notification immediately marked failed without retry scheduling.

## 5. Impact and risk

Critical operational alerts (e.g. driver dispatch instructions, payment receipts) are lost during temporary gateway downtime, causing operational delays.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Architecture lacks an asynchronous message queue (e.g. BullMQ / Redis or durable MongoDB task queue) with stateful retry scheduling.

## 7. Investigation required

- Inspect `backend/src/models/NotificationLog.ts` and `backend/src/models/NotificationJob.ts`.
- Review [DEC-011](../../decisions/DEC-011-notification-reliability-and-retries.md) specification.

## 8. Proposed resolution or agreed design

Implement durable task execution with retry counters, error categorization (transient vs permanent), and secure webhook signature verification.

## 9. Acceptance criteria

- [x] Transient failures automatically retry up to 3 times with exponential backoff.
- [x] Permanent failures (invalid number, opt-out) fail fast without retrying.
- [x] Duplicate or out-of-order webhooks do not corrupt delivery states.
- [x] UI provides audit trail and manual retry action for failed jobs.

## 10. Required tests

- Automated integration tests: `backend/src/tests/integration/phase6BatchFNotificationTracking.test.ts`.

## 11. Dependencies and related issues

- Governed by [DEC-011](../../decisions/DEC-011-notification-delivery-reliability-scope.md).
- Related to [FF-ISSUE-054](FF-ISSUE-054-notification-delivery-tracking-zero-rate.md).

## 12. Verification evidence

- **Webhook Security & Verification:**
  - HMAC-SHA256 signature verification in `webhookController.ts` validates `X-Hub-Signature-256`. Fails closed if production secret is missing.
  - Subscription challenge verification passes with matching token and rejects invalid tokens (HTTP 403).
- **Idempotency & Monotonic State Progression:**
  - Ingestion deduplicates status events and message events using `ProcessedWebhook`.
  - State hierarchy (`queued` < `sent` < `delivered` < `read`) guarantees out-of-order `delivered` or `sent` events never overwrite or downgrade terminal states (`delivered` or `read`).
- **Error Categorization & Retries:**
  - `isPermanentError()` identifies permanent 4xx errors, invalid numbers, and DND opt-outs, failing fast (`attempts: 1, status: 'failed'`).
  - Transient 5xx / 429 gateway errors trigger bounded exponential backoff (`Math.min(30 * Math.pow(2, attempt - 1), 600)`) up to `max_attempts: 3`.
- **Audited Manual Retry:**
  - `resendNotification` controller checks permissions, re-queues failed jobs, and creates an immutable tenant `AuditLog` entry (`entity_type: 'notification'`, `action: 'UPDATE'`).
- **Automated Tests:** 21 integration tests in `phase6BatchFNotificationTracking.test.ts` passing.
