# Fuel Payment Modes Lack Defined Ledger and Payable Accounting Routing

## Metadata

- **ID:** FF-ISSUE-044
- **Category:** Financial
- **Priority:** High
- **Status:** Needs Verification
- **Affected module:** Financial Accounting / Fuel & Payables
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-043](FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

Fuel payment modes (Fuel Card, Pump Vendor Credit, Driver Cash Advance) appear in the UI, but their respective backend ledger posting, supplier payables creation, and idempotency are unverified.

## 2. Observed behavior

The fuel stop form allows selecting between Fuel Card (HPCL/BPCL DriveTrack), Pump Vendor Credit (Ledger Slip), and Driver Cash Advance. It was questioned whether selection merely acts as a descriptive label or actively drives different double-entry ledger postings.

## 3. Expected behavior

Each payment mode must route to distinct, auditable financial logic: Fuel Card reconciles against corporate fuel card liability/bank account; Pump Vendor Credit creates a supplier payable against the designated pump vendor; Driver Cash Advance deducts from the driver advance sub-ledger.

## 4. Reproduction steps

1. Record fuel stops using each of the three payment modes.
1. Check General Ledger journal entries created for each fuel stop.
1. Check Vendor Payables for Pump Vendor Credit stop.
1. Check Driver Advance balance for Driver Cash Advance stop.

## 5. Impact and risk

Without distinct ledger routing, pump vendor bills cannot be reconciled, fuel card statements cannot be audited, and company liabilities are misstated.

## 6. Root-cause status

Payment mode is currently captured as an informational string field on the fuel stop record without triggering mode-specific accounting handlers.

## 7. Investigation required

- Audit `fuelStopService` to see if accounting entries or journal entries are emitted.
- Check whether `vendor_id` is mandatory when Pump Vendor Credit is chosen.
- Verify if corporate card account ID is linked when Fuel Card is selected.

## 8. Proposed resolution or agreed design

Implement explicit ledger event handlers for each fuel payment mode with proper debit (Fuel Expense) and corresponding credit accounts (Vendor Payable, Driver Advance, or Fuel Card Liability).

## 9. Acceptance criteria

- [ ] Pump Vendor Credit requires vendor selection and posts to Accounts Payable.
- [ ] Fuel Card posts to Fuel Card Clearing / Bank Liability account.
- [ ] Driver Cash Advance deducts from Driver Advance asset account.
- [ ] All journal entries enforce balanced debit/credit invariants.

## 10. Required tests

- Double-entry invariant tests for each fuel payment mode.
- Validation test: Pump Vendor Credit requires valid vendor reference.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-043](FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
