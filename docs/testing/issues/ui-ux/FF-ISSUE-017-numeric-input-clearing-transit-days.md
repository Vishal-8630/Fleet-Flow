# Estimated Transit Days Numeric Field Trapped at Zero Without Clear Behavior

## Metadata

- **ID:** FF-ISSUE-017
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Fleet Operations (Create Truck Dispatch Modal)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.B, Estimated Transit Days input)
- **Related issues:** [FF-ISSUE-018](FF-ISSUE-018-numeric-input-clearing-settlement.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

In the Create Truck Dispatch form, the "Estimated Transit Days" numeric input defaults to `0`, and users cannot delete or backspace the zero to enter a new number, trapping them unless they use spinner arrow controls.

## 2. Observed behavior

When focusing on the Estimated Transit Days input field, pressing Backspace or Delete fails to clear the `0`. Typing "5" results in "05" or fails to register properly. Only clicking the browser increment arrows changes the value.

## 3. Expected behavior

Numeric input fields should allow users to backspace and completely clear intermediate values (empty string state while editing), validating and defaulting to appropriate minimum values only on blur or form submission.

## 4. Reproduction steps

1. Navigate to Fleet Operations > Dispatch Truck (`/journeys/new`).
2. Locate the "Estimated Transit Days" field (displays `0`).
3. Click into the field and press Backspace.
4. Observe that the zero cannot be deleted.

## 5. Impact and risk

Causes frustration and input errors during fast-paced truck dispatch data entry.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Controlled input state enforces `value={field.value || 0}` or an `onChange` handler that converts empty strings immediately back to `0` via `Number(e.target.value)`, preventing intermediate empty states.

## 7. Investigation required

- Inspect `frontend/src/pages/journeys/CreateJourneyPage.tsx` or `DispatchModal.tsx`.
- Check React Hook Form controller for `estimated_transit_days`.

## 8. Proposed resolution or agreed design

Update the input handler to allow intermediate empty strings:
`onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}`
On blur, if empty, set default value to `1` or validate with Zod schema.

## 9. Acceptance criteria

- [ ] Users can backspace and clear the Estimated Transit Days field cleanly.
- [ ] Typing numbers replaces the default value without awkward "05" formatting.
- [ ] On blur or submit, empty fields validate with helpful feedback.

## 10. Required tests

- Component tests simulating user typing, clearing via Backspace, and submitting form.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-018](FF-ISSUE-018-numeric-input-clearing-settlement.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
