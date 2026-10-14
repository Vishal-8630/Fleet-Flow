# Customer Credit Limit, Outstanding, and Vendor Balance Semantics Unclear

## Metadata

- **ID:** FF-ISSUE-045
- **Category:** Financial
- **Priority:** High
- **Status:** Needs Verification
- **Affected module:** Financial Accounting / Commercial Parties
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-042`
- **Related issues:** [FF-ISSUE-041](../trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-050](../market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md)
- **Related decisions:** DEC-007
- **Implementation status:** Not implemented

## 1. Summary

Customer Billing Parties display Credit Limit and Outstanding, while Vendor Parties display Current Balance, but the underlying arithmetic, invoice generation rules, and credit limit warning mechanisms are undefined.

## 2. Observed behavior

In commercial settings, Customer Billing Parties show Credit Limit and Outstanding values, while Vendor/Broker Parties show Current Balance. It is unclear how unpaid freight invoices, unbilled trips, credit notes, and market movements interact with these figures.

## 3. Expected behavior

The system must clearly formalize party financial semantics: Customer Outstanding = Unpaid Invoices - Unallocated Receipts + Unbilled Trips (if configured); Vendor Current Balance = Total Payables - Total Disbursements; Credit Limit warnings must trigger when Outstanding + Planned Freight exceeds Credit Limit (DEC-007).

## 4. Reproduction steps

1. Create Customer with ₹100,000 Credit Limit.
1. Generate Freight Invoice for ₹80,000.
1. Attempt dispatch of new trip with ₹30,000 planned freight.
1. Observe whether credit limit warning is triggered.

## 5. Impact and risk

Lack of clear balance and credit limit rules risks extending unauthorized credit to defaulting shippers and misrepresenting company working capital.

## 6. Root-cause status

Data fields exist on party schemas but lack rigorous ledger aggregation services and automated enforcement middleware.

## 7. Investigation required

- Inspect calculation of `party.outstanding` across invoices and payments.
- Check if DEC-007 credit limit check is implemented in dispatch controller.
- Audit vendor balance calculation across supplier payments and truck hires.

## 8. Proposed resolution or agreed design

Document and implement standardized balance calculation services and integrate DEC-007 credit limit warning with authorized override capability.

## 9. Acceptance criteria

- [ ] Customer Outstanding reflects verified ledger formula.
- [ ] Dispatching trips for customers exceeding credit limit presents warning with override approval (DEC-007).
- [ ] Vendor balance distinguishes payables from advances.

## 10. Required tests

- Financial calculation unit tests for party outstanding balance.
- DEC-007 enforcement integration test: Warning raised when credit limit exceeded.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-041](../trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-050](../market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md)
- Related Decisions: DEC-007

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
