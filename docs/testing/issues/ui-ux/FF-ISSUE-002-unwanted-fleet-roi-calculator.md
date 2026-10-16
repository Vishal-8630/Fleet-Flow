# Unwanted Public Fleet ROI Calculator Component

## Metadata

- **ID:** FF-ISSUE-002
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Resolved (Batch E6)
- **Affected module:** Public Marketing Pages
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-003)
- **Related issues:** [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md), [FF-ISSUE-003](FF-ISSUE-003-homepage-content-density.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch E6

## 1. Summary

The public marketing website includes an interactive "Fleet ROI Calculator" widget that the product owner has explicitly reviewed and decided to remove from the platform.

## 2. Observed behavior

The homepage contains an interactive calculator component that attempts to calculate simulated cost savings, fuel efficiency gains, and ROI percentages based on user-entered fleet sizes and operational variables.

## 3. Expected behavior

Per explicit product owner preference, the Fleet ROI Calculator should be completely removed from all public landing pages to streamline the page layout and avoid presenting unverified mathematical claims to prospective clients.

## 4. Reproduction steps

1. Navigate to the root homepage (`http://localhost:5173/`).
2. Scroll to the interactive ROI calculator section.
3. Observe the presence of slider/numeric inputs for trucks, mileage, and estimated financial return.

## 5. Impact and risk

Presents speculative, unvalidated financial figures to enterprise buyers that may not match real transport operational cost structures. Adds unnecessary page weight and vertical clutter.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Promotional widget component was embedded in `LandingPage.tsx` during initial marketing prototype development.

## 7. Investigation required

- Locate the ROI Calculator component in `frontend/src/components/` or `frontend/src/pages/public/LandingPage.tsx`.
- Check whether any shared state or calculations depend on this component before removal.

## 8. Proposed resolution or agreed design

Remove the ROI calculator component and its corresponding section markup from `LandingPage.tsx`. Clean up any unreferenced subcomponents or CSS assets.

## 9. Acceptance criteria

- [x] ROI Calculator component is completely removed from the public website.
- [x] No broken layout anchors or orphan navigation links remain pointing to the calculator.
- [x] Page load performance and vertical scanability are improved.
- [x] Surrounding sections (Hero CTA, Value Pillars, Social Proof, Final CTA) remain fully intact.

## 10. Required tests

- Component tree render test verifying absence of ROI calculator markup: Verified in `backend/src/tests/integration/phase5BatchE6UiAndToastHardening.test.ts`.
- Navigation smoke test ensuring no broken anchor links in landing header or footer.
- Frontend production build verification (`tsc -b && vite build`: Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-003](FF-ISSUE-003-homepage-content-density.md) (Homepage Density).

## 12. Verification evidence

- Documented in [`docs/testing/audit/BATCH_E6_AUDIT_REPORT.md`](../../audit/BATCH_E6_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase5BatchE6UiAndToastHardening.test.ts` (16 passing).
- Production build verified with zero errors.

