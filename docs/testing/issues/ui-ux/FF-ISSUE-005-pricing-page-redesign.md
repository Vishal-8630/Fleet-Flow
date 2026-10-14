# Pricing Page Visual Styling Discrepancy with App Design System

## Metadata

- **ID:** FF-ISSUE-005
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Public Pricing Page
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-006)
- **Related issues:** [FF-ISSUE-006](FF-ISSUE-006-pricing-faq-accordion.md), [FF-ISSUE-023](FF-ISSUE-023-trial-duration-inconsistency.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

The public Pricing page (`/pricing`) uses visual styling, background treatments, and card gradients that diverge noticeably from the clean, restrained aesthetic of the authenticated app dashboard.

## 2. Observed behavior

The Pricing page features dark background cards, high-saturation pill badges, and styling inconsistencies when compared with the clean white surfaces, subtle slate borders, and crisp typography of the logged-in `/settings/billing` view.

## 3. Expected behavior

The Pricing page should present a clean, restrained pricing card hierarchy (Starter, Standard, Pro, Enterprise) using the app's standard design tokens, transparent quota boundaries, and clear annual/monthly toggle switches.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/pricing`.
2. Compare the card styles, borders, and buttons with the logged-in view at `http://localhost:5173/settings/billing`.

## 5. Impact and risk

Creates an inconsistent user journey from marketing pricing discovery to in-app billing management. Unclear tier hierarchy can cause buyer hesitation.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** `PricingPage.tsx` was built with standalone landing page styles rather than shared card and button design system components.

## 7. Investigation required

- Inspect `frontend/src/pages/public/PricingPage.tsx`.
- Cross-reference tier details with approved decision [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md).

## 8. Proposed resolution or agreed design

Redesign `PricingPage.tsx` using standard card primitives:
- Clean white card backgrounds with `border: 1px solid #E2E8F0`.
- Distinct highlighted border and "Most Popular" badge for Standard tier.
- Transparent display of monthly vs annual pricing (₹1,999/mo Starter, ₹3,999/mo Standard, ₹8,999/mo Pro per DEC-001).
- Clear feature inclusion checklists.

## 9. Acceptance criteria

- [ ] Pricing page cards adhere to the application's clean design tokens.
- [ ] Tier prices, truck quotas, user limits, and branch limits exactly match DEC-001.
- [ ] Annual billing toggle clearly shows 2 months free discount calculation.

## 10. Required tests

- Snapshot tests for Pricing page in both Monthly and Annual toggle states.
- Unit tests verifying pricing calculation display.

## 11. Dependencies and related issues

- Governed by [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md).
- Related to [FF-ISSUE-006](FF-ISSUE-006-pricing-faq-accordion.md), [FF-ISSUE-023](FF-ISSUE-023-trial-duration-inconsistency.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
