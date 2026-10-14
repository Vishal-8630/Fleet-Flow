# Deletion Actions Trigger Unstyled Browser Native Confirm Dialogs

## Metadata

- **ID:** FF-ISSUE-010
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Master Registries (Trucks, Drivers, Parties)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-015)
- **Related issues:** None
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

Destructive deletion actions in the application trigger native browser dialogs (`window.confirm`) rather than styled, accessible in-app confirmation modals.

## 2. Observed behavior

When attempting to delete vehicle record `MH29KL23`, the browser intercepted the action with a native browser alert popup:
`localhost:5173 says Are you sure you want to remove vehicle MH29KL23?`
The dialog is unstyled, lacks brand alignment, and provides no contextual warnings regarding cascading data impacts.

## 3. Expected behavior

All destructive actions (vehicle removal, driver deactivation, party deletion) should present an accessible, themed in-app modal component with explicit confirmation text, distinct red destructive button styling, cancel option, and keyboard trap focus management.

## 4. Reproduction steps

1. Navigate to Master Registries > Trucks (`/trucks`).
2. Click the Delete/Remove action on any vehicle record (e.g. `MH29KL23`).
3. Observe the browser-native modal popup appearing at the top of the browser viewport.

## 5. Impact and risk

Substandard enterprise user experience. Browser native confirms cannot be styled, cannot display rich warnings (e.g. active journeys or outstanding balances), and can be accidentally suppressed by browser "Prevent this page from creating additional dialogs" settings.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Frontend action handlers invoke `if (window.confirm(...))` directly instead of opening a state-controlled `<ConfirmationModal />` component.

## 7. Investigation required

- Search for `window.confirm` calls across `frontend/src/`.
- Check if a shared `ConfirmationModal` component exists in `frontend/src/components/common/`.

## 8. Proposed resolution or agreed design

Replace all instances of `window.confirm()` with a reusable, accessible `<ConfirmDialog />` component built on top of Fleet Flow's design system tokens, featuring:
- Clear title and warning description.
- Cancel and Confirm buttons with auto-focus on Cancel.
- Escape key support to dismiss.

## 9. Acceptance criteria

- [ ] Zero invocations of `window.confirm()` remain in frontend source code.
- [ ] Deleting a vehicle or record opens an in-app confirmation modal.
- [ ] Modal displays the exact record identifier and destructive consequences.
- [ ] Focus is trapped inside the modal while open, and focus returns to the trigger on close.

## 10. Required tests

- Component tests for `ConfirmDialog` testing Open, Confirm, Cancel, and Escape dismissal.

## 11. Dependencies and related issues

- None.

## 12. Verification evidence

- Implementation and verification evidence pending.
