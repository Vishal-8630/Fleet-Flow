# ISS-003: Credit Note Balance Reduction Failure & Schema Mismatch

**Specification ID:** `ISS-003`  
**Title:** Credit Note Balance Reduction Failure & Schema Mismatch  
**Type:** Financial / Accounting Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-03.md`](./ISSUE-03.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`commercialReportController.ts:298-301`](../../backend/src/controllers/commercialReportController.ts#L298-L301), the credit note creation handler attempts to reduce the original invoice's outstanding balance by incrementing a non-existent schema field `amount_paid_paise`. In [`Invoice.ts`](../../backend/src/models/Invoice.ts#L28-L55), balances are stored in standard rupees as `paid_amount` and `balance_amount`. Consequently, the credit note is created, but the invoice balance remains completely unchanged, causing phantom balance drift, false payment collections, and accounting ledger corruption.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In [`commercialReportController.ts:298-301`](../../backend/src/controllers/commercialReportController.ts#L298-L301):
  ```typescript
  await Invoice.updateOne(
    { _id: original_invoice_id },
    { $inc: { amount_paid_paise: total_adjustment_paise } }
  );
  ```
- **Confirmed Fact:** In [`Invoice.ts:32-45`](../../backend/src/models/Invoice.ts#L32-L45):
  ```typescript
  total_amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  balance_amount: { type: Number, required: true },
  status: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'cancelled'], default: 'unpaid' }
  ```
- **Defect Mechanism:**
  1. Mongoose silently accepts `$inc: { amount_paid_paise: ... }` and sets an untracked property in the MongoDB document.
  2. The legitimate fields `paid_amount` and `balance_amount` are unaffected.
  3. The invoice `status` is not transitioned from `unpaid` to `partially_paid` or `paid`.
  4. The customer's receivable balance remains unchanged in Accounts Receivable.

---

## 3. Reproduction Steps
1. Create a GST Tax Invoice with `total_amount = 50000`, `paid_amount = 0`, `balance_amount = 50000`.
2. Issue a Credit Note against this invoice for ₹10,000 (`total_adjustment_paise = 1000000`).
3. Fetch the invoice via `GET /api/invoices/:id`.
4. Observe: `balance_amount` is still `50000` and `status` is still `'unpaid'`.

---

## 4. Expected Behavior
1. Issuing a Credit Note must convert `total_adjustment_paise` to rupees (`adjustmentRupees = total_adjustment_paise / 100`).
2. Atomically increment `paid_amount` by `adjustmentRupees` and decrement `balance_amount` by `adjustmentRupees`.
3. If `balance_amount <= 0`, transition status to `'paid'`; if `balance_amount < total_amount`, transition status to `'partially_paid'`.
4. Create a paired General Ledger journal voucher reflecting the sales return/discount.

---

## 5. Proposed Technical Solution
Update `createCreditNote` in `commercialReportController.ts`:
```typescript
const adjustmentRupees = (total_adjustment_paise || 0) / 100;
const invoice = await Invoice.findById(original_invoice_id);
if (!invoice) throw new ApiError(404, 'Original invoice not found');

const newPaidAmount = (invoice.paid_amount || 0) + adjustmentRupees;
const newBalanceAmount = Math.max(0, (invoice.total_amount || 0) - newPaidAmount);
const newStatus = newBalanceAmount === 0 ? 'paid' : 'partially_paid';

await Invoice.updateOne(
  { _id: original_invoice_id, company_id },
  {
    $set: {
      paid_amount: newPaidAmount,
      balance_amount: newBalanceAmount,
      status: newStatus,
    }
  }
);
```

---

## 6. Acceptance Criteria
- [ ] Issuing a credit note for ₹10,000 against a ₹50,000 invoice updates `balance_amount` to ₹40,000.
- [ ] Full credit note issuance transitions invoice status to `'paid'`.
- [ ] No `amount_paid_paise` property is written to `Invoice`.
- [ ] AR Aging report reflects the reduced outstanding balance.

---

## 7. Definition of Done
1. `commercialReportController.ts` updated and verified.
2. Financial invariant test added to [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md).
