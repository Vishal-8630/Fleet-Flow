# Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display

## Metadata

- **ID:** FF-ISSUE-023
- **Category:** Subscriptions & Billing
- **Priority:** High
- **Status:** Observed / Needs Verification
- **Affected module:** SaaS Billing & Onboarding Lifecycle
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-002)
- **Related issues:** [FF-ISSUE-005](../ui-ux/FF-ISSUE-005-pricing-page-redesign.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

The approved business decision establishes a 7-day free trial (DEC-001), but the public homepage, registration screens, and authenticated dashboard banner display "14 Days Free Trial Left", while the Pricing FAQ advertises 7 days.

## 2. Observed behavior

Upon creating a new tenant account, the dashboard header displays an amber banner: `14 Days Free Trial Left`. The registration page marketing copy also mentions a 14-day trial. However, the approved decision record [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md) and Pricing page FAQ state that Fleet Flow provides a 7-day trial.

## 3. Expected behavior

A single, consistent 7-day trial policy must be enforced across all surfaces:
- Marketing copy and registration CTAs state "Start Your 7-Day Free Trial".
- Backend company registration sets `trial_ends_at = now + 7 days`.
- In-app countdown banner accurately reflects days remaining based on the 7-day window.

## 4. Reproduction steps

1. Register a new company account at `/register`.
2. Inspect registration marketing text (reads 14 days).
3. Complete registration and land on `/dashboard`.
4. Observe banner reading "14 Days Free Trial Left".
5. Compare with Pricing FAQ at `/pricing` which states 7 days.

## 5. Impact and risk

Commercial misalignment and customer dispute risk. Prospective buyers expect 14 days of access; abrupt plan expiration or quota locking after 7 days creates distrust.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Backend company creation logic in `companyController.ts` or `authController.ts` calculates trial expiration using `Date.now() + 14 * 24 * 60 * 60 * 1000`, or frontend hardcodes 14 days into banner display logic.

## 7. Investigation required

- Inspect `backend/src/models/Company.ts` default `trial_ends_at` hook.
- Inspect `backend/src/controllers/authController.ts` company creation logic.
- Inspect `frontend/src/components/layout/TrialBanner.tsx` countdown calculations.

## 8. Proposed resolution or agreed design

Align all code and copy to the canonical 7-day trial rule per DEC-001:
- Backend: `const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);`.
- Frontend: Update all text in `RegisterPage.tsx`, `LandingPage.tsx`, and `TrialBanner.tsx`.

## 9. Acceptance criteria

- [ ] New company registration establishes `trial_ends_at` exactly 7 days from creation.
- [ ] Public marketing, registration forms, and in-app banners consistently state 7 days.
- [ ] Pricing FAQ and documentation reflect the 7-day trial policy.

## 10. Required tests

- Integration tests verifying newly created companies have `trial_ends_at` set to `+7 days`.
- Unit tests verifying trial countdown banner logic at 7, 3, 1, and 0 days remaining.

## 11. Dependencies and related issues

- Governed by [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
