# Form Select Dropdowns Render as Unstyled Browser Native Elements

## Metadata

- **ID:** FF-ISSUE-011
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Form Inputs & Dispatch Modals
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-016)
- **Related issues:** [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

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

- [ ] All operational form dropdowns feature custom-styled borders, heights, and chevron indicators.
- [ ] Dropdowns match adjacent text and number inputs in height, border radius, and focus state.
- [ ] Full keyboard navigation (Arrow keys, Enter, Esc) is verified.

## 10. Required tests

- Form rendering tests verifying custom select classes and keyboard accessibility.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
