# Driver Settlement Wage Calculator Numeric Inputs Trap Default Zero

## Metadata

- **ID:** FF-ISSUE-046
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Financial Accounting / Driver Settlement
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-040](../trip-lifecycle/FF-ISSUE-040-transit-days-input-traps-zero.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

Wage calculator numeric fields (Driver Wage Rate, Benchmark Mileage, Diesel Price, Other Deductions) default to zero and trap the user, preventing backspace clearing.

## 2. Observed behavior

In Driver Settlement wage calculator, all numeric fields (Wage Rate, Benchmark Mileage, Diesel Price, Other Deductions) initialize with "0". Users cannot delete the "0" using backspace to type a new value, forcing them to position the cursor carefully or type awkward combinations.

## 3. Expected behavior

Numeric input components should allow users to backspace and clear the field to empty string, applying zero fallback or validation only on blur or submit.

## 4. Reproduction steps

1. Navigate to Driver Settlement > Calculate Wages.
1. Click on Driver Wage Rate or Diesel Price field.
1. Press Backspace to clear "0".
1. Observe the zero remains and cannot be cleared.

## 5. Impact and risk

Hampers accountant workflow during driver settlement processing, increasing frustration and potential for data entry errors.

## 6. Root-cause status

Controlled inputs coerce empty string to `0` on change: `onChange={e => setValue(Number(e.target.value))}`.

## 7. Investigation required

- Inspect `DriverSettlementCalculator` component input handlers.
- Check shared numeric input helper or form library integration.

## 8. Proposed resolution or agreed design

Refactor numeric inputs to maintain string state while typing and parse to number on blur, or use a numeric input component that supports clear-on-focus/backspace.

## 9. Acceptance criteria

- [ ] All driver settlement numeric fields can be cleared with Backspace.
- [ ] Typing replaces the value cleanly without trapped leading zeros.
- [ ] Calculations update accurately when valid numbers are entered.

## 10. Required tests

- Component test: Backspacing numeric input allows typing new number without leading zero.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-040](../trip-lifecycle/FF-ISSUE-040-transit-days-input-traps-zero.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
