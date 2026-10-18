# Estimated Transit Days Numeric Input Cannot Clear Default Zero

## Metadata

- **ID:** FF-ISSUE-040
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H2)
- **Affected module:** Trip Lifecycle / Create Dispatch
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-numeric-input-clearing-transit-days.md), [FF-ISSUE-046](../financial-accounting/FF-ISSUE-046-driver-settlement-numeric-inputs-trap-zero.md)
- **Related decisions:** N/A
- **Implementation status:** Implemented & Verified in Batch H2

## 1. Summary

In the Create Truck Dispatch form, the Estimated Transit Days numeric input defaults to 0 and traps the user, preventing backspace deletion of the zero.

## 2. Observed behavior

In the Create Truck Dispatch form, the numeric input for Estimated Transit Days defaults to 0. When user presses backspace to clear the field and type a new number, the zero cannot be deleted (user can only use arrow stepper controls or type beside the zero).

## 3. Expected behavior

Numeric inputs should allow empty string or intermediate clearing on backspace so users can type desired values naturally, applying numeric parsing and validation on blur/submit.

## 4. Reproduction steps

1. Open Create Truck Dispatch modal/page.
1. Click into the Estimated Transit Days field.
1. Press Backspace to delete the default "0".
1. Observe the "0" cannot be deleted or cleared.

## 5. Impact and risk

Frustrating user experience causing dispatchers to accidentally submit "05" or struggle to enter transit duration, slowing down dispatch operations.

## 6. Root-cause status

Input state handler casts input directly via `Number(e.target.value)` or `value={val || 0}`, preventing intermediate empty string `""` state.

## 7. Investigation required

- Inspect `CreateDispatchForm` input change handler for `estimatedTransitDays`.
- Check if numeric input uses controlled component with fallback to 0.
- Check driver settlement calculator for identical pattern.

## 8. Proposed resolution or agreed design

Allow string state representation for controlled numeric inputs or handle empty string gracefully before converting on blur.

## 9. Acceptance criteria

- [x] User can backspace and clear the Estimated Transit Days field completely.
- [x] Typing a number replaces the field cleanly without leading zeros.
- [x] Field validates minimum transit days on blur or form submit.

## 10. Required tests

- Frontend component test: Clearing input via backspace allows entering new number without trapped zero: Completed in `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts` (15 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-numeric-input-clearing-transit-days.md), [FF-ISSUE-046](../financial-accounting/FF-ISSUE-046-driver-settlement-numeric-inputs-trap-zero.md)
- Related Decisions: N/A

## 12. Verification evidence

- In `frontend/src/pages/operations/NewJourneyPage.tsx`, refactored `estimated_duration_days` input handler to preserve string state on `onChange` without numeric trapping.
- Implemented `onBlur` handler to gracefully normalize empty or non-positive values to `1`.
- Added submit validation enforcing transit days >= 1 and safely coercing integer values in creation payload.
- Documented in [`docs/testing/audit/BATCH_H2_AUDIT_REPORT.md`](../../audit/BATCH_H2_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts`.
