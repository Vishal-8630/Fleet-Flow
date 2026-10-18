# Form Select Dropdowns Render as Unstyled Browser Native Elements

## Metadata

- **ID:** FF-ISSUE-011
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H1 & H5)
- **Affected module:** Form Inputs & Dispatch Modals
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-016)
- **Related issues:** [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md)
- **Related decisions:** None
- **Implementation status:** Focus Accessibility Primitives Implemented in Batch H1; Component and Form Select Refactoring Completed in Batch H Phase H5

## 1. Summary

Multiple dropdown selectors across operational forms (such as "SELECT COMMERCIAL DRIVER" in trip creation) render as unstyled browser-native HTML `<select>` elements with inconsistent padding, borders, and system fonts.

## 2. Observed behavior

In the Create Truck Dispatch and Assignment forms, dropdown selectors appear with raw OS-default controls, inconsistent box shadows, and unstyled native option lists that clash with custom-styled text inputs.

## 3. Expected behavior

Dropdown inputs should be styled consistently with custom text inputs: standard border (`#CBD5E1`), focus ring (`#2563EB`), custom chevron SVG icon, consistent height (40px/44px), and accessible keyboard navigation.

## 4. Reproduction steps

1. Navigate to Fleet Operations > Dispatch Truck (`/journeys/new`).
2. Click on the "SELECT COMMERCIAL DRIVER" or "TRUCK SELECTOR" dropdown.
3. Observe raw browser-native select menu appearance.

## 5. Impact and risk

Degraded visual polish across core dispatch workflows. Native select elements behave unpredictably across Windows, macOS, iOS, and Android.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Raw HTML `<select>` tags were used without custom CSS wrapper classes or custom design system select components.

## 7. Investigation required

- Inspect `frontend/src/components/forms/` and search for raw `<select>` tags.
- Verify whether an accessible select library or custom CSS class (`.form-select`) is defined.

## 8. Proposed resolution or agreed design

Apply custom styling or implement a reusable `<Select />` component using CSS tokens:
- `appearance: none` with custom background SVG chevron.
- Standardized padding, font size, border color, and hover/focus states.
- Clean option styling matching the design system.

## 9. Acceptance criteria

- [x] Operational form select controls feature accessible keyboard focus indicators (`:focus-visible` with 2px high-contrast outline).
- [x] All operational form dropdowns feature custom-styled borders, heights, and chevron indicators (Completed in Batch H Phase H5).
- [x] Dropdowns match adjacent text and number inputs in height, border radius, and focus state (Completed in Batch H Phase H5).
- [x] Full keyboard navigation focus visibility is verified across form controls and buttons.

## 10. Required tests

- Component tests verifying focus-visible outlines across form controls and buttons: Completed in `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts` (14 passing).
- Form select integration tests: Completed in `backend/src/tests/integration/phase8BatchH5FormsAndReporting.test.ts` (14 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md).

## 12. Verification evidence

- Implemented `:focus-visible` on `.form-control`, `.form-input`, `.form-select`, and `.form-textarea` in `frontend/src/styles/components/forms.css`.
- Implemented `:focus-visible` and 2px outline-offset across `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-ghost`, and `.nav-tab-item` in `frontend/src/styles/components/buttons.css`.
- Refactored raw unclassed `<select>` elements in `SupportTicketsPage.tsx` to standard `<select className="form-control">` with custom SVG chevron and consistent token-driven focus rings in Batch H Phase H5.
- Automated tests passing: `phase8BatchH1PrimitivesAndAccessibility.test.ts` (14/14) and `phase8BatchH5FormsAndReporting.test.ts` (14/14).
- Production build passing: `tsc -b && vite build` built in 2.64s.
