# Subscription Plan-Change Fails with Payment Window Closed Rejection

## Metadata

- **ID:** FF-ISSUE-027
- **Category:** Bug / Financial
- **Priority:** High
- **Status:** Observed
- **Affected module:** SaaS Billing & Razorpay Checkout Integration
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.J, Subscription plan changes blocked)
- **Related issues:** [FF-ISSUE-026](FF-ISSUE-026-plan-change-missing-idempotency-key.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

Following or alongside the idempotency error during subscription plan changes, the UI displays a second failure toast: `Payment window closed. Your plan has not been changed.`, preventing checkout initialization.

## 2. Observed behavior

In `/settings/billing`, attempting to switch plans produces:
`Payment window closed. Your plan has not been changed.`
The Razorpay checkout modal fails to open, or closes prematurely without presenting payment options.

## 3. Expected behavior

Clicking Upgrade/Change Plan should:
1. Create a server-side payment order/checkout session.
2. Open the payment gateway modal cleanly.
3. Keep the payment window open until the user completes payment, cancels, or the session expires after a standard timeout (e.g. 15 minutes).
4. In local development or sandbox mode, provide a mock checkout flow if Razorpay live keys are not configured.

## 4. Reproduction steps

1. Navigate to `/settings/billing`.
2. Select any plan upgrade option.
3. Observe the "Payment window closed" error notification.

## 5. Impact and risk

Direct revenue loss. Prevents subscription monetization and paid conversions.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Either the Razorpay order creation failed on the backend (due to invalid API keys or test mode restrictions), causing the frontend handler to immediately fire its `onDismiss` / `onPaymentFailed` callback, or the frontend modal unmounts immediately upon receiving an initial error.

## 7. Investigation required

- Inspect `backend/src/controllers/billingController.ts` order generation logic.
- Inspect `frontend/src/components/billing/PaymentModal.tsx` and Razorpay checkout event listeners (`modal.ondismiss`).

## 8. Proposed resolution or agreed design

1. Harden backend checkout session initialization with explicit error logging and fallback handling.
2. Ensure frontend Razorpay wrapper only treats explicit user dismissal as a closed window.
3. Provide a clear developer sandbox mode when `NODE_ENV=development` and payment credentials are unconfigured.

## 9. Acceptance criteria

- [ ] Checkout session initializes smoothly when upgrading plans.
- [ ] "Payment window closed" error only triggers if the user genuinely dismisses the payment modal.
- [ ] Failed payment attempts provide clear actionable diagnostics.

## 10. Required tests

- Integration tests simulating Razorpay order creation and webhook receipt.
- Frontend component tests for payment modal dismissal and retry flows.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-026](FF-ISSUE-026-plan-change-missing-idempotency-key.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
