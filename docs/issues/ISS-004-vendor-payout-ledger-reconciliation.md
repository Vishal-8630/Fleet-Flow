# ISS-004: One-Sided Vendor Payouts & Omission from Party Balances

**Specification ID:** `ISS-004`  
**Title:** One-Sided Vendor Payouts & Omission from Party Balances  
**Type:** Financial / General Ledger Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-04.md`](./ISSUE-04.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`ledgerController.ts:504-522`](../../backend/src/controllers/ledgerController.ts#L504-L522), `recordPartyPayout` generates an isolated single debit leg in [`JournalEntry`](../../backend/src/models/Ledger.ts) without a corresponding credit leg to a Cash/Bank ledger account and without assigning a `journal_id`. This directly violates the double-entry accounting invariant ($\sum \text{Debits} = \sum \text{Credits}$). Furthermore, in `getPartyBalances` (lines 393–436), the vendor balance aggregation pipeline queries exclusively from [`Entry`](../../backend/src/models/Entry.ts) (freight movements) and completely omits recorded payout entries from `JournalEntry`. Vendor balances never decrease when payouts are recorded, risking catastrophic overpayments to market vehicle vendors.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact 1 (One-Sided Journal Entry):** In [`ledgerController.ts:504-522`](../../backend/src/controllers/ledgerController.ts#L504-L522):
  ```typescript
  const voucher = new JournalEntry({
    company_id,
    party_name: party_name,
    party_type: 'vendor',
    voucher_type: 'payment',
    debit_amount: amount,
    credit_amount: 0,
    description: remarks || `Vendor payout recorded`,
    date: new Date(),
  });
  await voucher.save();
  ```
  No balancing credit leg is saved for the Cash/Bank account. The trial balance is corrupted.
- **Confirmed Fact 2 (Omission in Balance Calculation):** In [`ledgerController.ts:393-436`](../../backend/src/controllers/ledgerController.ts#L393-L436):
  ```typescript
  const partySummary = await Entry.aggregate([
    { $match: { company_id: new Types.ObjectId(companyId) } },
    {
      $group: {
        _id: '$party_name',
        total_freight: { $sum: '$freight_amount' },
        total_advance: { $sum: '$advance_amount' },
        balance_payable: { $sum: '$balance_amount' }
      }
    }
  ]);
  ```
  `JournalEntry` records are never queried. When a vendor is paid ₹50,000, `PartyBalancesPage.tsx` continues to show the original unreduced balance.

---

## 3. Reproduction Steps
1. Create a trip with vendor "Sharma Transporters" with freight ₹60,000 and advance ₹10,000 (balance ₹50,000).
2. Check party balances: Sharma Transporters balance payable = ₹50,000.
3. Call `POST /api/ledger/payout` recording a payment of ₹50,000 to Sharma Transporters.
4. Check party balances again: Sharma Transporters balance payable is **still ₹50,000**.
5. Check Journal Entries: A single debit entry exists; total debits exceed credits by ₹50,000.

---

## 4. Expected Behavior
1. Every payment voucher must generate two balanced legs under a shared `journal_id`:
   - Debit: Vendor Payable Account (`debit_amount: amount, credit_amount: 0`)
   - Credit: Bank / Cash Account (`debit_amount: 0, credit_amount: amount`)
2. `getPartyBalances` must compute net balance by combining freight liabilities from `Entry` with net settlements from `JournalEntry`.

---

## 5. Proposed Technical Solution
1. In `recordPartyPayout`, generate balanced entries:
   ```typescript
   const journal_id = new Types.ObjectId();
   const vendorLeg = new JournalEntry({
     company_id,
     journal_id,
     account_id: vendorAccountId,
     party_name,
     party_type: 'vendor',
     voucher_type: 'payment',
     debit_amount: amount,
     credit_amount: 0,
     date: new Date(),
   });
   const bankLeg = new JournalEntry({
     company_id,
     journal_id,
     account_id: bankAccountId,
     party_name: 'Bank / Cash',
     party_type: 'bank',
     voucher_type: 'payment',
     debit_amount: 0,
     credit_amount: amount,
     date: new Date(),
   });
   await JournalEntry.insertMany([vendorLeg, bankLeg]);
   ```
2. In `getPartyBalances`, union or join `JournalEntry` payments where `party_name == $party_name` to calculate `net_balance = balance_payable - total_payouts`.

---

## 6. Acceptance Criteria
- [ ] Recording a payout creates two balanced legs in `JournalEntry` sharing the same `journal_id`.
- [ ] $\sum \text{Debits} == \sum \text{Credits}$ across the general ledger at all times.
- [ ] Recording a ₹50,000 payout to a vendor reduces their outstanding balance to ₹0 in `PartyBalancesPage.tsx`.

---

## 7. Definition of Done
1. Balanced voucher creation and combined party balance aggregation implemented in `ledgerController.ts`.
2. Verified in [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md).
