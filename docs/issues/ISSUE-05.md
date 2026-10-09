# Issue 05 — Make Financial Records Dependable & Accounting Sound

## Metadata
- **Severity**: P0 (Critical)
- **Status**: Documented & Ready for Implementation
- **Category**: Financial Ledger, Double-Entry Accounting, Settlements & Data Integrity
- **Date**: October 10, 2026

---

## 1. Problem Statement
The application handles commercial freight invoicing, diesel accounting, driver trip advances, and settlements, but lacks mathematical guarantees and accounting invariants necessary for financial dependability:
1. **Inconsistent Monetary Representation**: Amounts across models (e.g. `Entry.freight_amount`, `Invoice.total_amount`, `Ledger.amount`, `TruckJourney.driver_advance`) are stored as IEEE 754 floating-point numbers rather than integer paise (or a strict 2-decimal rounded format), risking fractional rounding drift.
2. **Ambiguous Driver Settlement Formula**: The relationship between freight income, driver trip allowance, cash advances, diesel pump vouchers, toll reimbursements, and damage deductions is not bound by a single, mathematically verified formula.
3. **Non-Atomic Financial State Mutations**: When a driver settlement or invoice payment is recorded, multiple collections (`Settlement`, `TruckJourney`, `Driver`, `Ledger`, `BalanceParty`) are updated in sequential promises without a MongoDB ACID multi-document transaction (`session.startTransaction()`). If one write fails, the ledger and driver balance diverge.
4. **No Idempotency / Duplicate-Payment Guards**: Network timeouts or user double-clicks on "Disburse Settlement" or "Record Payment" can duplicate ledger postings and payouts.
5. **Absence of True Double-Entry Invariants**: The `Ledger` schema stores individual lines with `balance_type: 'debit' | 'credit'`, but does not enforce paired balancing journal entries where `Σ Debits == Σ Credits` per transaction identifier.
6. **No Financial Reconciliation Tools**: Operators lack an automated reconciliation audit tool to verify that the general ledger matches bank accounts, invoice receivables, and driver sub-ledgers.

---

## 2. Root Cause Analysis (RCA)
- **Unpaired Single-Entry Postings**: Early prototype treated `Ledger` as an expense tracker list rather than a double-entry general ledger with credit/debit transaction pairing.
- **Absence of Database Transactions**: Handlers called `await modelA.save()` followed by `await modelB.save()` without checking if the second operation succeeded.
- **Missing Idempotency Headers**: POST endpoints did not parse or store idempotency tokens (`X-Idempotency-Key`).

---

## 3. Implementation Solution & Target Architecture

### A. Canonical Monetary Representation & Precision
- Standardize on **integer paise** (1 INR = 100 paise) or strict half-up two-decimal mathematical rounding (`Math.round((amount + Number.EPSILON) * 100) / 100`).
- Ensure all financial schemas define explicit integer or precision validators.

### B. Formally Defined Settlement Engine Formula
Formalize the driver trip settlement math in `backend/src/utils/settlementCalculator.ts`:
$$\text{Net Driver Payable} = (\text{Trip Allowance} + \text{Approved Reimbursements}) - (\text{Cash Advances} + \text{Diesel Excess} + \text{TDS} + \text{Shortage Deductions})$$
- **Invariants**:
  - `Trip Allowance`: Calculated either per trip or per metric ton / km.
  - `Approved Reimbursements`: Verified toll receipts, loading/unloading receipts, halting allowance.
  - `Deductions`: Cash advance slips issued to driver during trip + diesel slips exceeding route mileage threshold + cargo transit shortages.
  - If `Net Payable < 0`, driver owes company: balance is carried over as a driver advance debit.

### C. Balanced Double-Entry Journal Engine
- In `backend/src/utils/ledgerService.ts`:
  - Every financial event must post a **paired journal entry** (`journal_id` linking 2 or more legs).
  - **Example: Driver Settlement Payout (₹5,000 via Bank Transfer)**:
    - **Leg 1 (Debit)**: `category: 'driver_settlement'`, `account: 'driver_payable'`, `balance_type: 'debit'`, `amount: 500000`
    - **Leg 2 (Credit)**: `category: 'bank_transfer'`, `account: 'hdfc_bank'`, `balance_type: 'credit'`, `amount: 500000`
    - **Invariant Check**: Assert `Σ Debits === Σ Credits` before saving to database.

### D. Multi-Document ACID Transactions
- Wrap all settlement, invoice payment, and manual adjustment pipelines inside a Mongoose transaction:
  ```ts
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Create Settlement record
    // 2. Update TruckJourney settlement_status = 'settled'
    // 3. Post balanced paired Ledger entries
    // 4. Update Driver outstanding advance balance
    // 5. Update BalanceParty (fuel pump) if applicable
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
  ```

### E. Idempotency Keys (`X-Idempotency-Key`)
- Create `IdempotencyKey` model or cache table:
  - Stores `key`, `company_id`, `request_hash`, `response_body`, `status_code`, `created_at`.
- Middleware `requireIdempotency`:
  - Intercepts financial writes (`POST /api/settlements`, `POST /api/invoices/:id/payments`, `POST /api/ledger`).
  - If key was processed within 24 hours, returns cached response immediately with header `X-Cache: IDEMPOTENT_HIT`, preventing duplicate money movements.

### F. Immutable Audit & Reversal Entries
- Postings with `is_auto_generated: true` can never be updated or deleted.
- If a settlement is cancelled or an invoice voided:
  - Post counter-balancing reversal entry (`is_reversal: true`, `reversed_entry_id`).
  - Preserves immutable paper trail for GST audit compliance.

### G. Financial Reconciliation & Invariant Testing
- Create `GET /api/ledger/reconciliation`:
  - Compares Total LR Freight Billing vs Invoiced Receivables vs Received Payments.
  - Computes global ledger balance: `Math.abs(Total Debits - Total Credits) === 0`.
- Automated test script `backend/src/scripts/verifyFinancialIntegrity.ts`:
  - Tests rounding edge cases, partial payments, simultaneous double-clicks, and negative balance rollovers.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/utils/settlementCalculator.ts` | Mathematical settlement engine formula and deductions breakdown |
| `backend/src/utils/ledgerService.ts` | Balanced double-entry paired journal generator with debit/credit assertions |
| `backend/src/middleware/idempotencyMiddleware.ts` | Idempotent transaction guard preventing duplicate payments |
| `backend/src/models/Ledger.ts` | Compound index, `journal_id`, and strict immutability checks |
| `backend/src/models/Settlement.ts` | Itemized settlement legs, formula fields, and transaction references |
| `backend/src/controllers/settlementController.ts` | Multi-document transactional settlement execution |
| `backend/src/controllers/invoiceController.ts` | Transactional payment receipts and paired ledger postings |
| `backend/src/controllers/ledgerController.ts` | Reversal entry creation and reconciliation report endpoint |
| `backend/src/routes/ledgerRoutes.ts` | Mount `/reconciliation` and apply `requireIdempotency` |
| `backend/src/scripts/verifyFinancialIntegrity.ts` | Automated accounting invariants and edge-case test suite |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Completing a Driver Settlement & Verifying Itemized Math
1. **Navigate to Settlements**:
   - Open browser and log in as Tenant Admin or Accountant at `http://localhost:5173/login`.
   - In the sidebar, navigate to **Financials** -> **Driver Settlements** (`/financials/settlements`).
2. **Create New Settlement**:
   - Click the **"+ New Settlement"** button.
   - Select a completed trip from the dropdown (e.g. `Trip #TRP-104 - Mumbai to Ahmedabad`).
   - Enter payment variables:
     - Driver Base Freight: `12000`
     - Advance Deductions: `4000`
     - Fuel Slip Deductions: `1500`
     - Toll Reimbursement: `800`
3. **Verify Live Calculation on Screen**:
   - Notice the live calculation summary card dynamically updates:
     - Formula: `(12,000 + 800) - (4,000 + 1,500) = ₹7,300.00 Net Payable`.
   - Select Payment Method: `Bank Transfer (NEFT/IMPS)`.
   - Enter Bank Transaction Reference / UTR: `UTR9922881144`.
   - Click **"Confirm & Post Settlement"**.
4. **What You Should See on the Screen**:
   - Green success toast:  
     > ✅ *"Settlement #SET-2026-089 approved and successfully posted to General Ledger."*
   - The settlement card status turns to `SETTLED` (green badge).
   - The fields lock to read-only mode to prevent retro-active alteration.

---

### Test 2: Verifying Double-Entry Balancing on General Ledger
1. **Navigate to General Ledger**:
   - In the sidebar, click **Financials** -> **General Ledger** (`/financials/ledger`).
2. **Inspect Paired Journal Postings**:
   - Locate the rows generated by Settlement `#SET-2026-089`.
3. **What You Should See on the Screen**:
   - Two paired rows appear bearing the same Journal Voucher ID:
     - Row 1: Account `Freight Operational Expenses` | Debit: `₹7,300.00` | Credit: `-`
     - Row 2: Account `HDFC Operating Bank Account` | Debit: `-` | Credit: `₹7,300.00`
   - Scroll to the bottom of the ledger table:
     - Total Debits: `₹7,300.00`
     - Total Credits: `₹7,300.00`
     - Difference: `₹0.00` (Perfect Balanced Books ⚖️).

---

### Test 3: Testing Rapid Double-Click Idempotency on Payment
1. **Record Invoice Payment**:
   - Navigate to **Freight Invoices** (`/commercial/invoices`).
   - Click on an unpaid invoice with a balance of `₹25,000`.
   - Click **"Record Payment"**, enter amount `10000`, select date, and mode `Cheque`.
2. **Double-Click Submit**:
   - Rapidly double-click the **"Submit Payment"** button in under 0.5 seconds.
3. **What You Should See on the Screen**:
   - The submit button enters a disabled state immediately after the first click.
   - Only **one** payment receipt of `₹10,000` is generated.
   - The remaining unpaid balance displays `₹15,000` (not reduced twice to `₹5,000`).

---

### Test 4: Testing Document Cancellation Reversals
1. **Void an Erroneous Invoice**:
   - On `/commercial/invoices`, click the three-dots menu on a draft invoice and choose **"Void / Cancel Document"**.
   - Type cancellation justification: `Billed to incorrect customer GSTIN`.
   - Click **"Confirm Cancellation"**.
2. **What You Should See on the Screen**:
   - The invoice displays an unmistakable red badge: `VOIDED`.
   - Navigate to **General Ledger** (`/financials/ledger`).
   - Notice an equal-and-opposite counter entry (`is_reversal: true`) posted automatically to reverse the earlier accrual without deleting original logs.

