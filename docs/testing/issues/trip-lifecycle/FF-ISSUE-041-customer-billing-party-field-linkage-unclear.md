# Customer or Shipper Billing Party Field Purpose and Downstream Linkage Unclear

## Metadata

- **ID:** FF-ISSUE-041
- **Category:** Workflow
- **Priority:** Medium
- **Status:** Needs Verification
- **Affected module:** Trip Lifecycle / Dispatch Creation
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- **Related decisions:** DEC-004, DEC-005
- **Implementation status:** Not implemented

## 1. Summary

An optional Customer/Shipper Billing Party field appears on trip creation, but its downstream relationship to freight invoicing, party balances, and reporting is undefined.

## 2. Observed behavior

On the trip creation form, there is an optional field labeled "Customer/Shipper Billing Party". It was unclear during testing whether selecting this party automatically determines the invoice debtor, affects credit limit checks, or is purely descriptive.

## 3. Expected behavior

The system must explicitly define the role of Customer/Shipper Billing Party: if selected, it should default the bill-to party on freight invoices (DEC-004, DEC-005), apply customer credit limits (DEC-007), and route receivables to the customer ledger.

## 4. Reproduction steps

1. Open Create Trip form.
1. Inspect Customer/Shipper Billing Party dropdown.
1. Select a billing party, complete trip dispatch, and deliver trip.
1. Check whether the selected party automatically populates when generating freight invoice.

## 5. Impact and risk

Ambiguity in billing party linkage risks disassociated trips, untracked receivables, or manual re-entry errors during invoicing.

## 6. Root-cause status

Data model includes `billing_party_id` on Trip, but downstream invoice creation and ledger workflows do not strictly enforce or explain its role.

## 7. Investigation required

- Audit `Trip` schema for `billing_party_id` or `customer_id`.
- Check invoice generation endpoint (`/api/invoices/generate-from-trip`) to see if trip customer ID is referenced.
- Verify credit limit check integration during dispatch.

## 8. Proposed resolution or agreed design

Clarify UI tooltip explaining that selecting Billing Party binds the trip to customer freight billing, and ensure invoice generation pre-fills this party automatically.

## 9. Acceptance criteria

- [ ] Selecting Customer/Shipper Billing Party pre-fills freight invoice debtor.
- [ ] Form provides clear helper text explaining the field's billing impact.
- [ ] Credit limit warning is triggered at dispatch if customer exceeds limit (DEC-007).

## 10. Required tests

- Integration test: Generating invoice from trip uses trip's designated billing party.
- Validation test: Helper text rendered on trip creation form.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- Related Decisions: DEC-004, DEC-005

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
