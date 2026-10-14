# QST-009 — Fuel Payment Mode and Market Movement Deduction Accounting Semantics

## Metadata

- **Question ID:** QST-009
- **Title:** Fuel Payment Mode and Market Movement Deduction Accounting Semantics
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Financial Accounting / General Ledger
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q9)`
- **Related Issues:** [FF-ISSUE-043](../financial-accounting/FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md), [FF-ISSUE-044](../financial-accounting/FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md), [FF-ISSUE-050](../market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md)
- **Related Decisions:** N/A
- **Expected Owner / Phase:** Financial Systems Engineer / Deep-dive audit of ledger posting services during Phase 2, feeding into the planned `docs/CALCULATIONS_REFERENCE.md` task.

---

## 1. Core Question

What are the exact general ledger double-entry debit/credit rules implemented in code for fuel payment modes, driver cash advances, and Market Movement deductions?

## 2. Background and Testing Context

Discrepancies observed include fuel advance un-deducted from driver cash balance and an unexplained ₹3,000 difference in Market Movement net due.

## 3. Evidence Required to Resolve

- [ ] Inspect `accountingService` or `journalEntryService` for fuel stop and market movement event handlers.
- [ ] Check chart of accounts definitions (Fuel Expense, Driver Advances, Vendor Payables, Brokerage).
- [ ] Inspect raw transaction logs generated during test execution.

## 4. Planned Investigation Activity

Deep-dive audit of ledger posting services during Phase 2, feeding into the planned `docs/CALCULATIONS_REFERENCE.md` task.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-043](../financial-accounting/FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md), [FF-ISSUE-044](../financial-accounting/FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md), [FF-ISSUE-050](../market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md)
- Related Decisions: N/A
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
