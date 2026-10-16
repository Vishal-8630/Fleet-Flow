# Opening Balance Modification Discrepancy and Current Balance Desynchronization

## Metadata

- **ID:** FF-ISSUE-042
- **Category:** Financial
- **Priority:** High
- **Status:** Resolved
- **Affected module:** Financial Accounting / Party Balances
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-045](FF-ISSUE-045-credit-limit-balance-semantics.md)
- **Related decisions:** N/A
- **Implementation status:** Implemented (Batch B — Commit f6dd446)

## 1. Summary

Editing the opening balance for party Divyanshi Road Lines displayed ₹26,000 on the form despite an intended value described as ₹25,000, and the party list continued to show ₹0 current balance.

## 2. Observed behavior

User modified the opening balance for billing/vendor party "Divyanshi Road Lines". The form displayed ₹26,000 even though the user intended to input ₹25,000, and upon saving, the party list view continued to display a Current Balance of ₹0 instead of reflecting the saved opening balance.

## 3. Expected behavior

The system must clearly distinguish between opening balance, ledger mutations, and calculated current balance. Saved opening balances must immediately update the party's starting financial position and propagate to current balance if no transactions exist.

## 4. Reproduction steps

1. Navigate to Commercial > Billing/Vendor Parties.
1. Select party "Divyanshi Road Lines" and open Edit modal.
1. Enter or update opening balance field.
1. Save the form and observe the value rendered on the form vs the ₹0 balance displayed in the party listing.

## 5. Impact and risk

Inaccurate vendor/customer balances distort financial statements, leading to erroneous receivables/payables reporting and incorrect payment disbursements.

## 6. Root-cause status

Suspected disconnect between party profile `opening_balance` attribute and general ledger balance aggregation, or caching failure preventing party list from recomputing current balance.

## 7. Investigation required

- Inspect `Party` model schema for `opening_balance` and `current_balance` fields.
- Audit whether opening balance creates an initial `JournalEntry` or general ledger transaction.
- Check party listing query pipeline to see how current balance is computed (stored scalar vs ledger aggregation).

## 8. Proposed resolution or agreed design

Ensure opening balance edits write an audited initial ledger entry or update the base balance atomically, and invalidate party queries so the updated balance displays immediately in all views.

## 9. Acceptance criteria

- [x] Editing opening balance accurately persists the exact entered amount.
- [x] Party list displays updated current balance matching opening balance (in absence of transactions).
- [x] Audit log captures changes to party opening balance with author and timestamp.

## 10. Required tests

- Financial invariant test: Party current balance equals opening balance + sum of ledger credits - sum of ledger debits.
- Integration test: Updating opening balance invalidates party cache and displays new balance.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-045](FF-ISSUE-045-credit-limit-balance-semantics.md)
- Related Decisions: N/A

## 12. Verification evidence

- **Resolved in Commit:** `f6dd446` (Batch B)
- **Controller & Service Implementation:** `backend/src/services/ledgerService.ts`, `backend/src/controllers/partyController.ts` / `balancePartyController.ts`, creating audited initial journal entries and synchronizing current balances atomically.
- **Integration Test Suite:** `backend/src/tests/integration/partyBalanceSync.test.ts` (Validates opening balance persistence, ledger synchronization, and current balance recalculation).

