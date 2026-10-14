# Driver Cash Advance Not Reduced by Fuel Purchases Funded via Advance

## Metadata

- **ID:** FF-ISSUE-043
- **Category:** Financial
- **Priority:** High
- **Status:** Observed
- **Affected module:** Financial Accounting / Driver Advances & Fuel
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-044](FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

A ₹10,000 driver advance was disbursed and a 100L × ₹90 fuel purchase (₹9,000) was logged using "Driver Cash Advance", but displayed cash balance was ₹6,640 (reflecting ₹10,000 − ₹3,360 cash expenses), omitting the ₹9,000 fuel deduction.

## 2. Observed behavior

In testing, a ₹10,000 advance was given to a driver. A fuel stop of 100L at ₹90/L (₹9,000) was recorded selecting payment mode "Driver Cash Advance". Other cash expenses totaled ₹3,360. The trip summary reported driver cash balance as ₹6,640 (₹10,000 − ₹3,360), leaving the ₹9,000 fuel purchase completely un-deducted from the driver's advance balance.

## 3. Expected behavior

When fuel is purchased using "Driver Cash Advance", the purchase amount must deduct exactly once from that driver's advance balance/ledger. The resulting driver balance in this scenario should have reflected ₹10,000 − ₹3,360 − ₹9,000 = -₹2,360 (or prompt for reimbursement/settlement).

## 4. Reproduction steps

1. Record a ₹10,000 cash advance for a driver on an active trip.
1. Record a fuel stop of ₹9,000 selecting payment mode "Driver Cash Advance".
1. Record cash expenses of ₹3,360.
1. Inspect Trip Financial Summary and Driver Cash Balance widget.
1. Observe driver cash balance shows ₹6,640, omitting the ₹9,000 fuel expense.

## 5. Impact and risk

Substantial financial leakage: drivers are not held accountable for fuel purchased from advances, leading to double-payment of fuel during settlements or unaccounted cash loss.

## 6. Root-cause status

Fuel purchases with mode "Driver Cash Advance" are stored in `tripFuelStops` but omitted from the driver advance balance deduction aggregation pipeline, which only sums items from `tripCashExpenses`.

## 7. Investigation required

- Inspect `tripSettlementService.getDriverCashBalance` or calculation helper.
- Check whether fuel stops with payment mode `DRIVER_CASH_ADVANCE` are queried and subtracted.
- Verify general ledger entries generated for fuel purchases by payment mode.

## 8. Proposed resolution or agreed design

Include fuel stops with payment mode `DRIVER_CASH_ADVANCE` in the driver cash advance reconciliation formula: `Remaining Advance = Total Advances - Cash Expenses - Advance-funded Fuel`.

## 9. Acceptance criteria

- [ ] Fuel purchases marked "Driver Cash Advance" deduct directly from the driver's advance balance.
- [ ] Trip financial summary displays advance-funded fuel breakdown distinctly.
- [ ] Driver settlement reconciliation includes advance fuel receipts in debit total.

## 10. Required tests

- Unit test: `calculateDriverAdvanceBalance` subtracts both cash expenses and advance fuel stops.
- Integration test: Fuel stop with DRIVER_CASH_ADVANCE updates driver trip ledger balance.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-044](FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
