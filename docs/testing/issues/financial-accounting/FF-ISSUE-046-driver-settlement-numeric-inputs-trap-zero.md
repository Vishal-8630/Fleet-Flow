# Driver Settlement Wage Calculator Numeric Inputs Trap Default Zero

## Metadata

- **ID:** FF-ISSUE-046
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H2)
- **Affected module:** Financial Accounting / Driver Settlement
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-018](../ui-ux/FF-ISSUE-018-numeric-input-clearing-settlement.md), [FF-ISSUE-040](../trip-lifecycle/FF-ISSUE-040-transit-days-input-traps-zero.md)
- **Related decisions:** N/A
- **Implementation status:** Implemented & Verified in Batch H2

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

- [x] All driver settlement numeric fields can be cleared with Backspace.
- [x] Typing replaces the value cleanly without trapped leading zeros.
- [x] Calculations update accurately when valid numbers are entered.

## 10. Required tests

- Component tests simulating input clearing, typing, and validation: Completed in `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts` (15 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-018](../ui-ux/FF-ISSUE-018-numeric-input-clearing-settlement.md), [FF-ISSUE-040](../trip-lifecycle/FF-ISSUE-040-transit-days-input-traps-zero.md)
- Related Decisions: N/A

## 12. Verification evidence

- In `frontend/src/pages/commercial/SettlementListPage.tsx`, refactored `rate_per_km`, `benchmark_mileage`, `diesel_price_per_litre`, and `other_deductions` inputs to preserve raw string editing states on `onChange`.
- Implemented `onBlur` handlers to normalize values, strip leading zeros, and trigger validation errors.
- Added strict submit validations blocking non-positive wage rates (<= 0), non-positive benchmark mileage (<= 0), negative diesel prices (< 0), and negative deductions (< 0).
- Guarded benchmark mileage division by zero in real-time math calculations.
- Added missing `other_deductions_notes` input in modal UI and included in confirmation mutation payload.
- Documented in [`docs/testing/audit/BATCH_H2_AUDIT_REPORT.md`](../../audit/BATCH_H2_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts`.
