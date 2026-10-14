# Driver Settlement Wage Calculator Fields Trapped at Zero Without Clear Behavior

## Metadata

- **ID:** FF-ISSUE-018
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Commercial Finance (Driver Settlements)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.D, Driver Settlement numeric inputs)
- **Related issues:** [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

Multiple numeric input fields in the Driver Settlement wage calculator (Driver Wage Rate, Benchmark Mileage, Diesel Price, Other Deductions) default to `0` and cannot be cleared with Backspace, hindering wage calculation adjustments.

## 2. Observed behavior

Inside the Driver Settlement calculation modal, attempting to edit Driver Wage Rate, Diesel Price, or Benchmark Mileage traps the cursor at `0`. Users cannot delete the zero to type clean figures, causing values like "085" or requiring arrow clicking.

## 3. Expected behavior

All calculator numeric fields must allow intermediate empty states while actively typing, allowing users to backspace and cleanly type replacement values. Validation and numeric coercion should occur on blur.

## 4. Reproduction steps

1. Navigate to Commercial > Settlements > Create Settlement.
2. Select a completed trip and open the Wage Calculator tab.
3. Attempt to backspace and change Driver Wage Rate or Diesel Price from `0`.
4. Observe inability to delete the zero.

## 5. Impact and risk

Friction and high risk of entering corrupted wage rate data (e.g. "0500" or miscalculated deductions) directly impacting driver settlement payouts.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Controlled input bindings coerce empty values directly to `0` on every keystroke in settlement calculation state handlers.

## 7. Investigation required

- Inspect `frontend/src/pages/settlements/SettlementForm.tsx` or `DriverWageCalculator.tsx`.

## 8. Proposed resolution or agreed design

Implement a robust `<NumericInput />` component that preserves local string editing state and syncs validated numbers to form state on blur/change.

## 9. Acceptance criteria

- [ ] All settlement numeric inputs can be selected and cleared using Backspace or Delete.
- [ ] Users can enter decimal and integer figures cleanly without leading zeros.
- [ ] On blur, empty fields default gracefully or trigger validation.

## 10. Required tests

- Component tests simulating input clearing and re-entry across all wage calculator fields.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
