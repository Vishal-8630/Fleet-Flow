# TEST-003: Double-Entry Accounting & Ledger Balance Invariant Test Suite

**Test Specification ID:** `TEST-003`  
**Title:** End-to-End Double-Entry General Ledger and Financial Invariant Verification Suite  
**Scope:** Financial Accounting, Vendor Settlements & Credit Notes  
**Priority:** `P0` (Critical Financial Integrity Gate)  
**Target Coverage:** Complete Ledger Mathematical Invariance  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
In financial software, subtle bugs (such as one-sided journal postings or field name mismatches like `amount_paid_paise`) corrupt general ledgers, trial balances, and debtor/creditor statements. Automated mathematical invariant tests must run continuously to guarantee that the fundamental principles of accounting are never breached by code changes.

---

## 2. Invariant Assertions to Enforce
1. **Double-Entry Balance Invariant ($\sum \text{Debits} \equiv \sum \text{Credits}$):**
   - For every journal transaction or voucher created in `JournalEntry`, the sum of debit amounts must strictly equal the sum of credit amounts:
     `assert(totalDebits === totalCredits)`.
2. **Invoice Balance Invariant:**
   - For every invoice in `Invoice`:
     `assert(invoice.paid_amount + invoice.balance_amount === invoice.total_amount)`.
3. **Vendor Settlement Balance Invariant:**
   - When a vendor payout of ₹X is recorded:
     - `net_vendor_balance_after === net_vendor_balance_before - X`.
4. **Credit Note Invariant:**
   - Issuing a credit note of ₹C against invoice of balance ₹B:
     - `new_balance === Math.max(0, B - C)`.

---

## 3. Test Scenarios to Implement
- `tests/financial/double_entry.test.ts`:
  - Test A: Record vendor payout -> verify two balanced legs created in `JournalEntry`.
  - Test B: Issue invoice -> record part payment -> verify status transitions to `'partially_paid'`.
  - Test C: Issue credit note -> verify invoice balance decreases and status updates to `'paid'`.
  - Test D: Query `getPartyBalances` after payment -> verify outstanding balance decreases.

---

## 4. Acceptance Criteria
- [ ] Any code mutation that produces an unbalanced journal entry immediately fails the build.
- [ ] Vendor payouts accurately reduce party balances.
- [ ] Invoices reflect credit notes accurately.

---

## 5. Definition of Done
1. Financial invariant tests implemented and passing.
