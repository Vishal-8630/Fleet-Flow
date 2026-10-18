# Driver Settlement Wage Calculator Fields Trapped at Zero Without Clear Behavior

## Metadata

- **ID:** FF-ISSUE-018
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H2)
- **Affected module:** Commercial Finance (Driver Settlements)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.D, Driver Settlement numeric inputs)
- **Related issues:** [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md), [FF-ISSUE-046](../financial-accounting/FF-ISSUE-046-driver-settlement-numeric-inputs-trap-zero.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch H2

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

- [x] All settlement numeric inputs can be selected and cleared using Backspace or Delete.
- [x] Users can enter decimal and integer figures cleanly without leading zeros.
- [x] On blur, empty fields default gracefully or trigger validation.

## 10. Required tests

- Component tests simulating input clearing and re-entry across all wage calculator fields: Completed in `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts` (15 passing).
- Unit tests: `backend/src/tests/unit/settlementCalculations.test.ts` (5 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-017](FF-ISSUE-017-numeric-input-clearing-transit-days.md).
- Duplicate of [FF-ISSUE-046](../financial-accounting/FF-ISSUE-046-driver-settlement-numeric-inputs-trap-zero.md).

## 12. Verification evidence

- In `frontend/src/pages/commercial/SettlementListPage.tsx`, refactored `rate_per_km`, `benchmark_mileage`, `diesel_price_per_litre`, and `other_deductions` inputs to preserve raw string editing states on `onChange`.
- Implemented `onBlur` handlers to normalize values, strip leading zeros, and trigger validation errors.
- Added strict submit validations blocking non-positive wage rates (<= 0), non-positive benchmark mileage (<= 0), negative diesel prices (< 0), and negative deductions (< 0).
- Guarded benchmark mileage division by zero in real-time math calculations.
- Added missing `other_deductions_notes` input in modal UI and included in confirmation mutation payload.
- Documented in [`docs/testing/audit/BATCH_H2_AUDIT_REPORT.md`](../../audit/BATCH_H2_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH2NumericInputsAndSettlement.test.ts`.
