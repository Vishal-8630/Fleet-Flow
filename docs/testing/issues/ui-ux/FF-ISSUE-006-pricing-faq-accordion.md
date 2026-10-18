# Pricing Page FAQ Sections Lack Dropdown/Collapsible Accordion Behavior

## Metadata

- **ID:** FF-ISSUE-006
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Resolved (Batch H4)
- **Affected module:** Public Pricing Page
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-007)
- **Related issues:** [FF-ISSUE-005](FF-ISSUE-005-pricing-page-redesign.md)
- **Related decisions:** None
- **Implementation status:** Implemented (Batch H4)

## 1. Summary

The Frequently Asked Questions (FAQ) section on the public Pricing page renders all questions and answers fully expanded as static text blocks, creating unnecessary vertical scroll length.

## 2. Observed behavior

Questions and answers in the Pricing FAQ section are displayed completely open in a flat list. Users cannot collapse or expand questions to quickly find topics of interest.

## 3. Expected behavior

The FAQ section should implement an interactive accordion pattern where question headers can be clicked to toggle answer visibility, defaulting to collapsed (or first item expanded), with smooth transitions and keyboard accessibility.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/pricing`.
2. Scroll to the "Frequently Asked Questions" section at the bottom.
3. Observe all questions and answers displayed in fully expanded state.

## 5. Impact and risk

Minor usability and aesthetic friction. Elongates the page and makes scanning for specific billing terms (e.g. trial duration, GST invoices, refunds) cumbersome.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** FAQ items are mapped as static `<div>` elements without interactive state handling (`useState`) or accessible `<details>`/`<summary>` markup.

## 7. Investigation required

- Inspect FAQ markup in `frontend/src/pages/public/PricingPage.tsx`.

## 8. Proposed resolution or agreed design

Implement an accessible Accordion component for the FAQ section with:
- Clickable question trigger displaying chevron icon indicator.
- Smooth collapse/expand micro-animation.
- ARIA attributes (`aria-expanded`, `aria-controls`) for screen reader support.

## 9. Acceptance criteria

- [x] FAQ questions render collapsed by default with clear expand indicators.
- [x] Clicking a question smoothly toggles the visibility of its answer.
- [x] Keyboard navigation (Tab, Enter/Space) toggles accordion items correctly.

## 10. Required tests

- Component tests verifying click toggle behavior and ARIA state updates.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-005](FF-ISSUE-005-pricing-page-redesign.md).

## 12. Verification evidence

- Implemented interactive accordion state in `PricingPage.tsx` using `openFaqIndex`, `toggleFaq`, `aria-expanded`, `aria-controls`, and `ChevronDown` rotation.
- Added full keyboard access for `Enter` and `Space` key presses.
- Verified via `backend/src/tests/integration/phase8BatchH4PublicAndAuthShell.test.ts`.
