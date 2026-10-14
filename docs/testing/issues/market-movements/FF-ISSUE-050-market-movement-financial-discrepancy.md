# Market Movement Financial Calculation Unresolved Arithmetic Discrepancy

## Metadata

- **ID:** FF-ISSUE-050
- **Category:** Financial
- **Priority:** High
- **Status:** Needs Verification
- **Affected module:** Market Movements / Financial Settlement
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-042`
- **Related issues:** [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

A Market Movement record displayed Freight ₹50,000, Driver Advance ₹5,000, Brokerage ₹1,000, and Net Due ₹41,000, presenting an unexplained ₹3,000 difference that requires investigation.

## 2. Observed behavior

In manual testing, a market movement record showed Freight: ₹50,000, Driver Advances: ₹5,000, Brokerage: ₹1,000, and Net Due: ₹41,000. Basic arithmetic (₹50,000 − ₹5,000 − ₹1,000) yields ₹44,000, leaving an unexplained difference of ₹3,000 between expected arithmetic and displayed Net Due.

## 3. Expected behavior

The calculation formula and breakdown must be completely explicit. If other deductions (such as TDS, loading deductions, fuel advances, or transit insurance) account for the ₹3,000 difference, they must be transparently displayed. If not, the calculation logic must be audited and corrected.

## 4. Reproduction steps

1. Open the test Market Movement record observed in manual testing.
1. Inspect the financial breakdown section (Freight ₹50k, Advances ₹5k, Brokerage ₹1k, Net Due ₹41k).
1. Check whether any hidden deductions (TDS, detention, penalty) are present in the underlying data object.

## 5. Impact and risk

Unexplained financial discrepancies undermine trust in settlement statements and risk financial loss or disputes with truck brokers.

## 6. Root-cause status

Requires investigation: Could be unrendered deductions (e.g. 5% TDS or loading charge) stored in DB but omitted from UI display, or an arithmetic defect in the `net_due` computation function.

## 7. Investigation required

- Audit `marketMovementService.calculateNetDue` or equivalent function.
- Check raw MongoDB record for the tested market movement for `other_deductions`, `tds_amount`, or `fuel_advance`.
- Determine if frontend formula differs from backend calculation.

## 8. Proposed resolution or agreed design

Investigate the exact database fields and formula during code audit. Render all deduction line items explicitly so `Net Due = Freight - Advances - Brokerage - Other Deductions` balances with zero unexplained discrepancies.

## 9. Acceptance criteria

- [ ] Every deduction contributing to Net Due is explicitly labeled and displayed.
- [ ] Mathematical invariant verified: Net Due equals Freight minus sum of all itemized deductions.
- [ ] Backend and frontend calculations agree 100% on settlement totals.

## 10. Required tests

- Unit test: Arithmetic formula for market movement net due calculation.
- Data integrity test: Net Due matches sum of itemized ledger entries.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
