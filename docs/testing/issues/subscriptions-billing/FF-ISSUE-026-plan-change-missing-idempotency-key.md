# Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header

## Metadata

- **ID:** FF-ISSUE-026
- **Category:** Bug / Financial
- **Priority:** High
- **Status:** Observed
- **Affected module:** SaaS Billing & Subscription Management
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.J, Subscription plan changes blocked)
- **Related issues:** [FF-ISSUE-027](FF-ISSUE-027-plan-change-payment-window-closed.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

When a user attempts to change subscription plans in `/settings/billing`, the mutation fails and triggers an error toast stating: `x-idempotency-key header is required for this financial mutation`.

## 2. Observed behavior

On the Billing Settings page (`/settings/billing`), clicking "Upgrade Plan" or "Switch Plan" immediately throws a validation error toast:
`x-idempotency-key header is required for this financial mutation`
The plan change request is rejected by the backend, and no payment window or checkout session is created.

## 3. Expected behavior

The frontend API client should automatically generate a unique UUIDv4 idempotency key (or retrieve an active checkout session key) and attach it as the `x-idempotency-key` HTTP header on all financial and plan-change POST/PUT requests.

## 4. Reproduction steps

1. Navigate to Settings > Billing (`/settings/billing`).
2. Click "Upgrade Plan" or choose a different tier (e.g. Standard or Pro).
3. Observe the immediate error toast referencing the missing `x-idempotency-key`.

## 5. Impact and risk

Critical commercial blocker. Existing customers cannot upgrade their subscriptions, add extra truck capacity, or convert from trial to paid accounts.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Backend financial routes are protected by `requireIdempotencyKey` middleware (introduced in Batch 2), but the frontend billing service in `frontend/src/api/billingApi.ts` omitted generating and attaching the `x-idempotency-key` header on the plan change payload.

## 7. Investigation required

- Inspect `backend/src/routes/billingRoutes.ts` middleware pipeline.
- Inspect `frontend/src/services/billingService.ts` or `billingApi.ts` for request header construction.

## 8. Proposed resolution or agreed design

Update the frontend billing API client to generate a fresh `crypto.randomUUID()` on plan change submissions and attach it as `headers['x-idempotency-key'] = uuid`.

## 9. Acceptance criteria

- [ ] Plan change requests automatically include a valid UUID `x-idempotency-key` header.
- [ ] Backend idempotency middleware accepts the request and records the key.
- [ ] Missing idempotency header error toast no longer appears.

## 10. Required tests

- Frontend unit test verifying `x-idempotency-key` header is attached on billing upgrade calls.
- API integration test verifying plan-change route handles valid idempotency keys correctly.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-027](FF-ISSUE-027-plan-change-payment-window-closed.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
