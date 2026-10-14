# Fleet Flow — Batch B Preflight Review: Financial Invariants & Accounting Balance Integrity

**Document Type:** Technical Governance Pre-Implementation Review  
**Batch Identifier:** `BATCH-B`  
**Target Architecture:** Financial Ledger Invariants, Double-Entry Accounting, DEC-004, DEC-006, DEC-007, QST-009  
**Execution Posture:** **READ-ONLY REVIEW & DOCUMENTATION ONLY. No code modifications, migrations, or database changes authorized.**  
**Date:** 15 October 2026  
**Auditor / Governance Authority:** Antigravity Advanced Agentic AI (Pair-Programming Preflight Inspection)  
**Baseline Test Status:** Automated backend test suite passes 100% (247/247 tests passing) following Batch A Security & Tenant Privacy completion. Clean working tree.

---

## 1. Objective and Scope

### 1.1 Executive Summary
Batch B establishes the financial correctness, balance integrity, and general ledger double-entry foundations of the Fleet Flow transport management platform. 

During manual and static audits, critical financial discrepancies were uncovered across driver cash advance settlements, vendor opening balances, fuel payment mode ledger routings, customer credit limit enforcement, and market vehicle movement financial reporting. In particular, fuel purchased using driver cash advances was omitted from settlement deductions, pump credit slips were logged without general ledger entries, customer credit limits were completely unenforced at dispatch, and market movements presented an apparent ₹3,000 calculation mystery due to hidden deduction columns.

The objective of Batch B is to resolve these commercial calculation defects, enforce immutable double-entry accounting invariants, align customer credit controls with Product Owner Decision `DEC-007` (Option B), and deliver transparent commercial reconciliation across all operations.

> [!CRITICAL]
> **GOVERNANCE POSTURE: DOCUMENTATION ONLY**  
> Implementation of Batch B is strictly unauthorized at this stage. This document serves as the preflight architectural review and proposed implementation plan. Implementation can begin **only** after explicit Product Owner review and formal sign-off.

---

### 1.2 Complete Item Inventory Included in Batch B

| Item Identifier | Type | Title | Severity / Priority | Current Code Status | Scope Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[FF-ISSUE-042](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/financial-accounting/FF-ISSUE-042-opening-balance-edit-reflection.md)** | Canonical Issue | Opening Balance Modification Discrepancy & Current Balance Desynchronization | `High` | Confirmed Defect | Updating `opening_balance` on `BalanceParty` is ignored by `partyController.ts:updateBalanceParty`, never updating the database field, current balance, or audit log. |
| **[FF-ISSUE-043](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/financial-accounting/FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md)** | Canonical Issue | Driver Cash Advance Not Reduced by Fuel Purchases Funded via Advance | `High` | Confirmed Defect | `calculateDriverSettlement` in `settlementCalculator.ts` and `settlementController.ts` only aggregates `starting_cash_advance` and `total_driver_expenses`, completely omitting `diesel_expenses` where `payment_mode === 'cash'`. |
| **[FF-ISSUE-044](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/financial-accounting/FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md)** | Canonical Issue | Fuel Payment Modes Lack Defined Ledger and Payable Accounting Routing | `High` | Confirmed Defect | `addDieselStop` in `journeyController.ts` accepts `payment_mode: 'cash' \| 'fuel_card' \| 'credit'`, but pushes raw objects without emitting double-entry `Ledger` journal vouchers. |
| **[FF-ISSUE-045](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)** | Canonical Issue | Customer Credit Limit, Outstanding Receivables, and Balance Semantics Unenforced | `High` | Confirmed Defect | `BillingParty.credit_limit` exists in schema but is completely unenforced during journey dispatch and LR creation. `outstanding_receivables` is never updated. |
| **[FF-ISSUE-050](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md)** | Canonical Issue | Market Movement Financial Calculation Apparent Arithmetic Discrepancy | `High` | Confirmed Defect (UI Omission) | `VehicleEntry.ts` pre-save hook subtracts `dala_charges` and `kamisan_amount`, but `VehicleEntryListPage.tsx` hides both columns, creating an apparent ₹3,000 calculation mystery. |
| **[DEC-004](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-004-freight-invoice-eligibility.md)** | Architectural Decision | Freight Invoice Eligibility Post Delivery and POD by Default | `Approved` | Scope Boundary | Governs commercial invoice generation eligibility post-delivery; prevents early unearned revenue invoicing without admin justification. |
| **[DEC-006](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-006-payment-allocation-methods.md)** | Architectural Decision | Manual and Automatic Payment Allocation to Invoices (FIFO Default) | `Approved` | Scope Boundary | Governs how receipts reduce customer outstanding balances; supports FIFO auto-allocation and manual invoice split within ACID transactions. |
| **[DEC-007](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-007-credit-limit-warning-and-override.md)** | Architectural Decision | Customer Credit Limit Exceeded Warning and Authorized Override | `Approved (Option B)` | Product Owner Approved | Implements Soft Warning with Mandatory Company Admin Override and Immutable Audit Logging for customer credit limit breaches. |
| **[QST-009](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-009-fuel-and-market-ledger-accounting-semantics.md)** | Unresolved Question | Fuel Payment Mode and Market Movement Deduction Accounting Semantics | `High` | Technical Analysis Complete | Establishes the exact debit/credit general ledger posting rules across all fuel payment modes and brokerage vehicle entries. |

> [!NOTE]
> **Issue Identifier Mapping Clarification:**  
> In the project prompt text, short descriptive labels for `FF-ISSUE-042` and `FF-ISSUE-043` were verbally transposed. The authoritative issue files in the repository establish the canonical mapping:
> - `FF-ISSUE-042`: Opening Balance Modification Discrepancy & Current Balance Desynchronization (`docs/testing/issues/financial-accounting/FF-ISSUE-042-opening-balance-edit-reflection.md`).
> - `FF-ISSUE-043`: Driver Cash Advance Not Reduced by Fuel Purchases Funded via Advance (`docs/testing/issues/financial-accounting/FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md`).  
> This preflight document thoroughly investigates and resolves both issues in complete alignment with their authoritative file specifications.

---

## 2. Current-State Findings & Forensic Code Audit

A thorough static and code-level investigation of the backend controllers, models, calculation helpers, and frontend views confirms the exact root causes of each Batch B defect.

### 2.1 Balance Party Opening Balance Handling (`FF-ISSUE-042`)
- **File:** `backend/src/controllers/partyController.ts` (lines 446–487)
- **Current Code:**
  ```typescript
  // backend/src/controllers/partyController.ts
  export async function updateBalanceParty(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        party_name,
        party_type,
        contact_person,
        phone,
        email,
        pan_number,
        bank_details,
        status,
      } = req.body; // <--- opening_balance is completely omitted!
  
      const party = await BalanceParty.findOne({ _id: id, is_deleted: false });
      if (!party) {
        res.status(404).json({ error: 'Balance party not found.' });
        return;
      }
      // Updates fields, but opening_balance and current_balance are never touched
      await party.save();
  ```
- **Vulnerability Evidence:**
  1. `opening_balance` is sent in `req.body` from the frontend (`BalancePartyListPage.tsx:167`), but is **completely omitted** from destructuring in `updateBalanceParty`.
  2. The database model `BalanceParty` maintains two separate balance fields: `opening_balance: { type: Number, default: 0 }` and `current_balance: { type: Number, default: 0 }`.
  3. When an operator updates the opening balance of a vendor (e.g. from ₹0 to ₹25,000), the request succeeds with HTTP 200, but the database values remain unchanged at ₹0.
  4. No audit log entry (`AuditLog`) is emitted when party balances are modified.
  5. The mathematical relationship between `opening_balance` and `current_balance` is broken: editing `opening_balance` should adjust `current_balance` by the net difference $\Delta = \text{new\_opening} - \text{old\_opening}$.

---

### 2.2 Driver Cash Advance Fuel Deduction Omission (`FF-ISSUE-043`)
- **Files:**
  - `backend/src/utils/settlementCalculator.ts` (lines 98–132)
  - `backend/src/controllers/settlementController.ts` (lines 141–146, 193–200, 274–297)
  - `frontend/src/pages/operations/JourneyDetailPage.tsx` (lines 330–334)
- **Current Code in `settlementCalculator.ts`:**
  ```typescript
  // backend/src/utils/settlementCalculator.ts
  const total_advances = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.starting_cash_advance) || 0), 0)
  );
  const total_reimbursements = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.total_driver_expenses) || 0), 0)
  );
  // ...
  const base_earnings = roundMoney(total_kms * validRatePerKm);
  const gross_earnings = roundMoney(base_earnings + total_reimbursements);
  const total_deductions = roundMoney(total_advances + fuel_variance_penalty + validOtherDeductions);
  const net_amount = roundMoney(gross_earnings - total_deductions);
  ```
- **Current Code in `JourneyDetailPage.tsx`:**
  ```typescript
  // frontend/src/pages/operations/JourneyDetailPage.tsx (lines 330-334)
  const totalDriverExpenses =
    journey?.total_driver_expenses ??
    (journey?.driver_expenses?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0);
  const startingAdvance = journey?.starting_cash_advance || 0;
  const driverCashBalance = startingAdvance - totalDriverExpenses; // <--- Cash fuel is omitted!
  ```
- **Vulnerability Evidence:**
  1. In `TruckJourney.ts`, diesel stops are pushed to `diesel_expenses[]` with `payment_mode: 'cash' | 'fuel_card' | 'credit'`.
  2. When a driver uses their trip cash advance to purchase diesel (e.g. ₹9,000 for 100L at ₹90/L), that expense is captured in `diesel_expenses`, NOT in `driver_expenses` (which is restricted to tolls, food, minor repairs).
  3. `JourneyDetailPage.tsx` calculates the driver cash balance as `starting_cash_advance - total_driver_expenses` ($10,000 - 3,360 = \text{₹6,640}$). The ₹9,000 fuel spend is completely ignored.
  4. In `settlementCalculator.ts`, `total_advances` ($10,000) is deducted in full from driver earnings, but the driver is **never credited or reimbursed** for the ₹9,000 cash fuel they purchased on behalf of the company. The driver is financially penalized for company fuel purchases.

---

### 2.3 General Ledger Routing for Fuel Modes (`FF-ISSUE-044` / `QST-009`)
- **File:** `backend/src/controllers/journeyController.ts` (lines 576–622)
- **Current Code:**
  ```typescript
  // backend/src/controllers/journeyController.ts
  export const addDieselStop = async (req: Request, res: Response) => {
    // ...
    journey.diesel_expenses.push({
      filling_date: filling_date ? new Date(filling_date) : new Date(),
      petrol_pump_name,
      slip_number,
      fuel_quantity_litres: Number(fuel_quantity_litres),
      rate_per_litre: Number(rate_per_litre),
      total_cost,
      payment_mode,
      slip_image_url,
    });
    await journey.save();
    return res.json({ message: 'Diesel fuel stop logged successfully.', journey });
  };
  ```
- **Vulnerability Evidence:**
  1. `journeyController.ts` does **not even import** `Ledger.ts`!
  2. Calling `POST /api/operations/journeys/:id/diesel` simply appends an embedded document to `TruckJourney.diesel_expenses` and calls `journey.save()`.
  3. **Zero double-entry ledger entries** are emitted.
  4. If `payment_mode === 'credit'` (fuel slip issued by pump vendor), no payable is posted to `BalanceParty`. Company liabilities to fuel pumps are completely omitted from balance sheets and aging reports.
  5. If `payment_mode === 'fuel_card'`, no clearing transaction is recorded against corporate card liability.
  6. The schema for `IDieselExpense` only contains `petrol_pump_name: string`. It lacks a structured reference `balance_party_id?: Types.ObjectId` to link pump stops to registered fuel vendor accounts.

---

### 2.4 Credit Limit & Exposure Enforcement (`FF-ISSUE-045` / `DEC-007`)
- **Files:**
  - `backend/src/models/BillingParty.ts` (lines 43–44, 82–83)
  - `backend/src/controllers/journeyController.ts` (dispatch logic)
  - `backend/src/controllers/entryController.ts` (LR creation)
  - `backend/src/controllers/invoiceController.ts`
- **Vulnerability Evidence:**
  1. `BillingParty.ts` defines `credit_limit: { type: Number, default: 0, min: 0 }` and `outstanding_receivables: { type: Number, default: 0 }`.
  2. `journeyController.ts:dispatchJourney` dispatches journeys with attached `billing_party_id` without checking customer credit status or credit limits.
  3. `entryController.ts:createEntry` creates Lorry Receipts (LRs) without validating customer exposure.
  4. `invoiceController.ts` never updates `outstanding_receivables` on `BillingParty` when invoices are generated, paid, or cancelled. The field remains permanently at `0`.
  5. Customers with past-due unpaid invoices exceeding ₹1,000,000 can be booked for additional freight trips without a single warning or authorization gate.

---

### 2.5 Market Movement Omitted Deductions UI Defect (`FF-ISSUE-050`)
- **Files:**
  - `backend/src/models/VehicleEntry.ts` (lines 232–240)
  - `frontend/src/pages/operations/VehicleEntryListPage.tsx` (lines 390–396, 448–460)
- **Current Backend Pre-Save Hook:**
  ```typescript
  // backend/src/models/VehicleEntry.ts (lines 232–240)
  VehicleEntrySchema.pre('save', function (next) {
    const freight = this.freight_amount || 0;
    const cash = this.driver_cash_advance || 0;
    const diesel = this.diesel_advance_amount || 0;
    const dala = this.dala_charges || 0;
    const kamisan = this.kamisan_amount || 0;
    const halting = this.halting_amount || 0;
  
    this.net_balance_due = Math.max(0, freight - cash - diesel - dala - kamisan + halting);
    // ...
  ```
- **Current Frontend Listing Columns (`VehicleEntryListPage.tsx:448–460`):**
  ```tsx
  // Table displays only:
  <td>₹{entry.freight_amount?.toLocaleString('en-IN')}</td>
  <td>
    <div>₹{(entry.driver_cash_advance + entry.diesel_advance_amount)?.toLocaleString('en-IN')}</div>
    <div>Cash: ₹{entry.driver_cash_advance} | Fuel: ₹{entry.diesel_advance_amount}</div>
  </td>
  <td>₹{entry.net_balance_due?.toLocaleString('en-IN')}</td>
  ```
- **Root Cause & Forensic Finding:**
  1. The backend calculation is 100% mathematically consistent:
     $$\text{Net Due} = \text{Freight } (50,000) - \text{Cash } (5,000) - \text{Fuel } (0) - \text{Dala } (2,000) - \text{Kamisan } (2,000) = \text{₹41,000}$$
  2. The table header and table body in `VehicleEntryListPage.tsx` **completely omit** columns for `dala_charges` and `kamisan_amount`.
  3. An operator viewing the row sees: Agreed Freight = ₹50,000, Advances = ₹5,000, Net Balance Due = ₹41,000. Mental subtraction $(50,000 - 5,000 = 45,000)$ reveals an apparent, unexplained ₹4,000 (or ₹3,000) discrepancy.
  4. This is a **UI rendering omission defect**, not a backend corruption defect.

---

## 3. Issue-by-Issue Analysis & Proposed Technical Specifications

### 3.1 FF-ISSUE-042: Opening Balance Synchronization
- **Root Cause:** `updateBalanceParty` in `partyController.ts` omits `opening_balance` from destructuring and mutation; does not adjust `current_balance` by delta $(\Delta = \text{new\_opening} - \text{old\_opening})$; does not emit an `AuditLog` record.
- **Affected Files:**
  - `backend/src/controllers/partyController.ts`
  - `backend/src/models/BalanceParty.ts`
  - `frontend/src/pages/parties/BalancePartyListPage.tsx`
- **Intended Behavior:**
  1. When updating a `BalanceParty`, if `opening_balance` is provided, calculate $\Delta = \text{new\_opening} - \text{old\_opening}$.
  2. Set `party.opening_balance = new_opening`.
  3. Increment `party.current_balance = party.current_balance + \Delta`.
  4. If the party has zero posted transactions, `party.current_balance` must equal `new_opening`.
  5. Atomically log an entry to `AuditLog` with `action: 'update_party_opening_balance'`, `actor_user_id`, `old_value`, `new_value`, and `party_id`.
  6. Invalidate React Query caches `['balance-parties']` and `['party-ledger', id]` so the updated balance displays immediately in all frontend views.
- **Dependencies:** None.
- **Acceptance Criteria:**
  - Editing opening balance persists the exact entered amount.
  - Current balance adjusts by the exact delta between old and new opening balance.
  - Audit log records old balance, new balance, timestamp, and author.
  - Party listing reflects the updated balance without requiring browser cache purges.

---

### 3.2 FF-ISSUE-043: Driver Cash Advance Fuel Deduction in Settlement
- **Root Cause:** `settlementCalculator.ts` and `settlementController.ts` fail to inspect `diesel_expenses` for `payment_mode === 'cash'`. `JourneyDetailPage.tsx` computes driver cash balance as `starting_cash_advance - total_driver_expenses`, completely omitting cash-funded diesel stops.
- **Affected Files:**
  - `backend/src/utils/settlementCalculator.ts`
  - `backend/src/controllers/settlementController.ts`
  - `backend/src/models/TruckJourney.ts`
  - `backend/src/models/Settlement.ts`
  - `frontend/src/pages/operations/JourneyDetailPage.tsx`
  - `frontend/src/pages/commercial/SettlementListPage.tsx`
- **Intended Behavior:**
  1. On `TruckJourney`, compute and expose:
     - `advance_funded_diesel_cost`: sum of `diesel_expenses[].total_cost` where `payment_mode === 'cash'`.
  2. In `JourneyDetailPage.tsx`, driver cash balance formula must be:
     $$\text{Driver Cash Balance} = \text{starting\_cash\_advance} - \text{total\_driver\_expenses} - \text{advance\_funded\_diesel\_cost}$$
  3. In `settlementCalculator.ts`, cash fuel purchased by driver from company advance must be accounted for cleanly:
     - The driver was given `starting_cash_advance` (debited to driver).
     - The driver spent cash on diesel fuel (`advance_funded_diesel_cost`) on behalf of the company.
     - Therefore, in settlement, cash-funded fuel either reduces the advance deduction or is added to reimbursable expenses:
       $$\text{Reconciled Advance Deduction} = \text{total\_advances} - \text{advance\_funded\_diesel\_cost}$$
       $$\text{Net Payout} = \text{Gross Earnings} - (\text{Reconciled Advance Deduction} + \text{Fuel Variance Penalty} + \text{Other Deductions})$$
     - If the driver spent more cash than the advance ($\text{expenses} + \text{cash\_fuel} > \text{advance}$), the company owes the driver the net out-of-pocket difference.
- **Dependencies:** `FF-ISSUE-044` (must share consistent definition of `payment_mode === 'cash'`).
- **Acceptance Criteria:**
  - Fuel purchases logged with `payment_mode === 'cash'` deduct directly from the driver's en-route cash advance balance.
  - Driver cash balance widget on Journey Detail reflects ₹10,000 - ₹3,360 - ₹9,000 = -₹2,360 out-of-pocket balance.
  - Driver settlement breakdown explicitly displays `Advance-Funded Diesel (Cash)` line item.
  - Drivers are never docked wages for diesel purchased out of company advances.

---

### 3.3 FF-ISSUE-044: Dual-Entry Ledger for Fuel Expenses
- **Root Cause:** `addDieselStop` in `journeyController.ts` writes directly to the embedded `diesel_expenses` array without executing a general ledger transaction or creating vendor payables.
- **Affected Files:**
  - `backend/src/controllers/journeyController.ts`
  - `backend/src/models/TruckJourney.ts`
  - `backend/src/models/Ledger.ts`
  - `backend/src/models/BalanceParty.ts`
  - `frontend/src/pages/operations/JourneyDetailPage.tsx`
- **Intended Behavior:**
  1. Update `IDieselExpense` schema to include optional `balance_party_id?: Types.ObjectId` (mandatory when `payment_mode === 'credit'`).
  2. In `addDieselStop`, wrap operations in a MongoDB ACID session:
     - Generate a shared UUID `journal_id`.
     - **Debit Entry:**
       - `category: 'diesel_expense'`
       - `balance_type: 'debit'`
       - `amount: total_cost`
       - `journey_id`, `truck_id`, `driver_id`
       - `description: `Diesel fill at ${petrol_pump_name} (${fuel_quantity_litres}L @ ₹${rate_per_litre}/L)``
     - **Credit Entry (determined by `payment_mode`):**
       - **Mode `'credit'` (Pump Vendor Credit):**
         - `category: 'payment_made'` (Vendor Payable Credit)
         - `balance_type: 'credit'`
         - `amount: total_cost`
         - `balance_party_id: vendor._id`
         - Atomically increment `vendor.current_balance += total_cost`.
       - **Mode `'cash'` (Driver Advance Funded):**
         - `category: 'driver_advance'`
         - `balance_type: 'credit'`
         - `amount: total_cost`
         - `driver_id: driver._id`
         - Credits the driver advance asset sub-ledger (settlement deduction).
       - **Mode `'fuel_card'` (Fleet Card / BPCL / HPCL):**
         - `category: 'bank_transfer'` (Fuel Card Clearing / Bank Liability)
         - `balance_type: 'credit'`
         - `amount: total_cost`
         - Credits corporate card clearing account.
     - Enforce balance invariant: $\sum \text{Debit} = \sum \text{Credit}$.
- **Dependencies:** `QST-009`, `FF-ISSUE-043`.
- **Acceptance Criteria:**
  - Logging a credit fuel stop increments vendor `current_balance` and emits balanced journal entries.
  - Logging a cash fuel stop credits driver advance sub-ledger and updates trip settlement cash balance.
  - Logging a fuel card stop credits corporate card clearing account.
  - All ledger entries are tagged `is_auto_generated: true` and locked against direct mutation.

---

### 3.4 FF-ISSUE-045 & DEC-007: Customer Credit Limit Enforcement Policy
- **Root Cause:** `credit_limit` on `BillingParty` is unenforced; dispatch endpoints perform no exposure checks; `outstanding_receivables` is never synchronized with invoice ledgers.
- **Affected Files:**
  - `backend/src/models/BillingParty.ts`
  - `backend/src/controllers/journeyController.ts`
  - `backend/src/controllers/entryController.ts`
  - `backend/src/controllers/invoiceController.ts`
  - `backend/src/services/creditExposureService.ts` (new helper service)
  - `backend/src/models/AuditLog.ts`
  - `frontend/src/components/commercial/CreditLimitWarningModal.tsx` (new component)
  - `frontend/src/pages/operations/NewJourneyPage.tsx`
- **Intended Behavior (DEC-007 Option B):** See Section 4 below for complete specification.
- **Dependencies:** `DEC-004`, `DEC-006`.
- **Acceptance Criteria:**
  - Dispatches for customers exceeding credit limit trigger a soft warning modal.
  - Standard dispatchers are blocked from completing dispatch.
  - Company Admin can enter a mandatory justification and authorize override.
  - Override is logged to `AuditLog` with exposure metrics and user identity.

---

### 3.5 FF-ISSUE-050: Market Movement Column Alignment for Dala & Kamisan
- **Root Cause:** The `VehicleEntry` listing table in `VehicleEntryListPage.tsx` omits table headers and data cells for `dala_charges` and `kamisan_amount`, obscuring the math that yields `net_balance_due`.
- **Affected Files:**
  - `frontend/src/pages/operations/VehicleEntryListPage.tsx`
  - `frontend/src/pages/operations/VehicleEntryModal.tsx`
  - `backend/src/models/VehicleEntry.ts`
- **Intended Behavior:**
  1. Update table header in `VehicleEntryListPage.tsx` to include:
     - `Dala (₹)`
     - `Kamisan / Brokerage (₹)`
  2. In table rows, render:
     - `<td>₹{Number(entry.dala_charges || 0).toLocaleString('en-IN')}</td>`
     - `<td>₹{Number(entry.kamisan_amount || 0).toLocaleString('en-IN')}</td>`
  3. In the detail modal/drawer, render an explicit arithmetic calculation breakdown:
     ```
     Agreed Freight:           ₹50,000
     - Driver Cash Advance:   - ₹5,000
     - Diesel Advance:        -     ₹0
     - Dala Charges:          - ₹2,000
     - Brokerage (Kamisan):   - ₹2,000
     + Halting Compensation:  +     ₹0
     ─────────────────────────────────
     = Net Balance Due:        ₹41,000
     ```
  4. Ensure backend and frontend use identical rounding (`roundMoney`).
- **Dependencies:** None.
- **Acceptance Criteria:**
  - `VehicleEntryListPage.tsx` renders dedicated columns for `dala_charges` and `kamisan_amount`.
  - Detailed modal shows line-by-line arithmetic breakdown summing to `net_balance_due`.
  - Apparent ₹3,000 discrepancy is 100% resolved without backend formula modification.

---

## 4. DEC-007 Policy Architecture: Credit Limit Enforcement (Option B)

### 4.1 Product Owner Approved Decision
The Product Owner has approved:
- **Decision:** DEC-007 — Credit Limit Enforcement Policy (`QST-009`)
- **Selected Option:** **Option B — Soft warning with mandatory Company Admin override and audit log.**
- **Status:** **Approved by Product Owner; implementation not yet authorized.**

---

### 4.2 Architectural Exposure Formula
Customer financial exposure represents the total uncollected commercial credit extended to a customer, comprising issued but unpaid freight invoices plus active unbilled freight in transit:

$$\text{Total Customer Exposure} = \sum(\text{Open Freight Invoices Balance Due}) + \sum(\text{Dispatched Unbilled Freight}) - \sum(\text{Unallocated Receipts})$$

Where:
1. $\sum(\text{Open Freight Invoices Balance Due})$: Sum of `balance_due` on all invoices where `status IN ('sent', 'partially_paid', 'overdue')` and `is_deleted === false`.
2. $\sum(\text{Dispatched Unbilled Freight})$: Sum of agreed freight on active journeys and market movements attached to this customer that have not yet been invoiced.
3. $\sum(\text{Unallocated Receipts})$: Any unallocated customer credit balance held in ledger accounts per `DEC-006`.

A **Credit Limit Breach** occurs whenever:
$$\text{Projected Exposure} = \text{Total Customer Exposure} + \text{New Freight Amount} > \text{BillingParty.credit\_limit}$$

---

### 4.3 Operational Workflow & Authorization Gates

```
                                  [Trip Dispatch / LR Creation Request]
                                                    │
                                                    ▼
                                  [Evaluate Customer Credit Exposure]
                                                    │
                                   Is credit_limit > 0 AND
                                   Projected Exposure > credit_limit?
                                       /                         \
                                     NO                           YES
                                     │                             │
                                     ▼                             ▼
                          [Dispatch Authorized]       [Credit Limit Breach Detected]
                                                                   │
                                                                   ▼
                                                       User Role == 'admin'?
                                                           /            \
                                                         NO              YES
                                                         │                │
                                                         ▼                ▼
                                                [HARD BLOCK 403]   [Advisory Warning Modal]
                                                "Credit Limit      "Exposure: ₹X | Limit: ₹Y"
                                                 Exceeded. Admin   Prompt: Mandatory Business
                                                 Approval Req."    Justification Reason String
                                                                          │
                                                                          ▼
                                                                Entered Reason Valid?
                                                                    (Length >= 10 chars)
                                                                    /             \
                                                                  NO               YES
                                                                  │                 │
                                                                  ▼                 ▼
                                                            [Validation     [Record AuditLog]
                                                             Error 400]     action: 'credit_limit_override'
                                                                            details: { exposure, limit, reason }
                                                                                    │
                                                                                    ▼
                                                                            [Dispatch Authorized]
```

#### Gate 1: Server-Side Validation
- The credit exposure calculation must execute on the backend inside `journeyController.ts` and `entryController.ts`. Client-side evaluation is for UX only; server enforcement is mandatory.
- If a breach occurs and `req.body.credit_override` is absent:
  - Return HTTP 409 Conflict with payload:
    ```json
    {
      "code": "CREDIT_LIMIT_EXCEEDED",
      "error": "Customer credit limit exceeded.",
      "details": {
        "customer_id": "670...",
        "customer_name": "ABC Logistics",
        "credit_limit": 100000,
        "current_exposure": 95000,
        "planned_freight": 20000,
        "projected_exposure": 115000,
        "overage_amount": 15000
      }
    }
    ```

#### Gate 2: Authorization & Role Downgrade
- Only users with role `admin` (Company Admin) or `superadmin` are authorized to override.
- Users with role `dispatcher`, `operator`, or `driver` receive HTTP 403 Forbidden: `"Credit limit exceeded. Company Admin authorization required to dispatch."`

#### Gate 3: Mandatory Justification & Audit Trail
- An override request must supply:
  - `credit_override: true`
  - `override_reason: string` (minimum 10 characters, trimmed; non-whitespace).
- The server validates the reason and atomically creates an `AuditLog` entry in the tenant workspace:
  ```typescript
  await AuditLog.create({
    company_id: req.tenant.id,
    user_id: req.user._id,
    user_name: req.user.name,
    user_email: req.user.email,
    action: 'credit_limit_override',
    entity_type: 'BillingParty',
    entity_id: customer._id,
    details: {
      action_type: 'journey_dispatch',
      journey_number: journey.journey_number,
      customer_id: customer._id,
      customer_name: customer.name,
      credit_limit: customer.credit_limit,
      current_exposure: exposure,
      planned_freight: plannedFreight,
      projected_exposure: exposure + plannedFreight,
      overage_amount: (exposure + plannedFreight) - customer.credit_limit,
      justification_reason: override_reason.trim(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    },
  });
  ```

---

### 4.4 Edge Cases & Safeguards
1. **Zero Credit Limit (`credit_limit === 0`):**
   - In freight operations, `credit_limit === 0` signifies either:
     a) A cash-only / advance-payment customer (zero credit allowed).
     b) An unconfigured credit limit.
   - **Rule:** A configured flag `enforce_credit_limit: boolean` (default: `true` if `credit_limit > 0`) dictates enforcement. If `credit_limit === 0` and `enforce_credit_limit === true`, all dispatches trigger the warning. If unconfigured (`enforce_credit_limit === false`), no breach is triggered.
2. **Negative Exposure:**
   - If a customer has made advance payments exceeding unbilled freight, exposure is negative. Negative exposure adds credit headroom.
3. **Concurrent Dispatches:**
   - Two dispatchers concurrently dispatching trips for the same customer must not bypass limits. Exposure check and dispatch status transition must execute within a MongoDB transaction session.
4. **DEC-004 Interaction (POD Delivery Rule):**
   - Freight invoices can only be generated after POD delivery per `DEC-004`. Unbilled dispatched freight remains in `dispatched_unbilled_freight` until an invoice is formally issued, ensuring continuous exposure coverage.
5. **DEC-006 Interaction (FIFO Payment Allocation):**
   - When customer payments arrive, FIFO auto-allocation immediately reduces the oldest open invoices' `balance_due`, freeing up credit headroom in real time.

---

## 5. Accounting Invariants & Ledger Integrity

Batch B introduces strict accounting guarantees across all financial paths:

### 5.1 General Ledger Double-Entry Invariant
Every financial event emitted in Fleet Flow must post a balanced journal voucher to `Ledger`:
$$\sum_{\text{journal\_id}} \text{Debit Amount} = \sum_{\text{journal\_id}} \text{Credit Amount}$$

| Transaction Type | Debit Account (`category`) | Credit Account (`category`) | Balance Impact |
| :--- | :--- | :--- | :--- |
| **Fuel Stop (Cash Mode)** | `diesel_expense` (Debit) | `driver_advance` (Credit) | Operating Expense increases; Driver Advance Asset decreases |
| **Fuel Stop (Credit Mode)** | `diesel_expense` (Debit) | `payment_made` / Accounts Payable (Credit) | Operating Expense increases; Pump Vendor Payable increases |
| **Fuel Stop (Card Mode)** | `diesel_expense` (Debit) | `bank_transfer` / Clearing (Credit) | Operating Expense increases; Fleet Card Clearing increases |
| **Driver Settlement Payout** | `driver_settlement` (Debit) | `bank_transfer` / Cash (Credit) | Settlement Expense debited; Cash/Bank disbursed |
| **Customer Invoice Issued** | Accounts Receivable (Debit) | `freight_income` (Credit) | Customer Asset increases; Revenue recognized |
| **Customer Payment Received** | `payment_received` / Bank (Debit) | Accounts Receivable (Credit) | Cash increases; Customer Asset decreases |

### 5.2 Party Balance Consistency
For any `BalanceParty` (Vendor / Transporter / Fuel Pump):
$$\text{Current Balance} = \text{Opening Balance} + \sum(\text{Credit Movements / Diesel Slips}) - \sum(\text{Debit Payments / Disbursements})$$

For any `BillingParty` (Customer / Consignor):
$$\text{Outstanding Receivables} = \text{Opening Balance} + \sum(\text{Invoices Issued}) - \sum(\text{Payments Received}) - \sum(\text{Credit Notes Issued})$$

### 5.3 Driver Advance Reconciliation Invariant
For any active journey:
$$\text{Driver In-Hand Cash Balance} = \text{Starting Cash Advance} - \text{Driver Cash Expenses} - \text{Advance-Funded Diesel Purchases}$$

For driver settlement:
$$\text{Net Wage Payout} = \text{Base Earnings} + \text{Out-of-Pocket Reimbursements} - \text{Total Cash Advances} - \text{Fuel Variance Penalty} - \text{Other Deductions}$$

### 5.4 Market Vehicle Entry Equation
For any hired / market truck entry (`VehicleEntry`):
$$\text{Net Balance Due} = \text{Freight Amount} - \text{Driver Cash Advance} - \text{Diesel Advance} - \text{Dala Charges} - \text{Kamisan Amount} + \text{Halting Amount}$$
This formula must hold identically across the MongoDB model pre-save hook, frontend calculation preview, and UI table display.

### 5.5 Transaction Atomicity & Idempotency
- All operations writing to both operational documents (`TruckJourney`, `VehicleEntry`, `Settlement`) and financial documents (`Ledger`, `BalanceParty`, `BillingParty`) must execute inside a MongoDB transaction session with write concern `{ w: 'majority' }`.
- Financial endpoints must require `X-Idempotency-Key` headers (`IdempotencyKey` model) to prevent duplicate journal postings during network retries.

---

## 6. Tenant Isolation & Authorization Safeguards

### 6.1 Multi-Tenant Data Scoping
All Batch B database operations must enforce strict workspace isolation:
1. Every query to `BalanceParty`, `BillingParty`, `TruckJourney`, `VehicleEntry`, `Settlement`, and `Ledger` must include `{ company_id: req.tenant.id }`.
2. Cross-tenant balance mutations or ledger postings are strictly prohibited.
3. The `tenantPlugin` must be active on all affected models.

### 6.2 Role-Based Access Control (RBAC)
- **`dispatcher` / `operator`:**
  - Can view party balances, trip expenses, and credit exposure.
  - Can log fuel stops and market entries.
  - **BLOCKED** from executing credit limit overrides (`HTTP 403`).
  - **BLOCKED** from modifying party opening balances (`HTTP 403`).
- **`accountant`:**
  - Can edit party profiles and opening balances.
  - Can generate settlements and record payouts.
  - Can view and export general ledgers.
- **`admin` (Company Admin):**
  - Full operational and financial authority.
  - Authorized to execute `credit_limit_override` with mandatory business justification.
- **Support Impersonation Sessions (Batch A Boundary):**
  - All monetary fields redacted (`null`).
  - Financial routes (`/api/finance/*`, `/api/commercial/settlements`) blocked with HTTP 403.
  - Cannot execute credit overrides or modify party balances.

### 6.3 Negative Test Cases
1. Tenant B user attempts to update opening balance of Tenant A `BalanceParty` $\rightarrow$ `HTTP 404 Not Found`.
2. Standard `dispatcher` attempts to dispatch trip for customer over credit limit $\rightarrow$ `HTTP 403 Forbidden / CREDIT_OVERRIDE_UNAUTHORIZED`.
3. Company Admin attempts override with whitespace-only or empty reason $\rightarrow$ `HTTP 400 Bad Request / JUSTIFICATION_REQUIRED`.
4. Concurrent duplicate payout requests with identical idempotency key $\rightarrow$ Second request returns cached response, zero duplicate `Ledger` entries.

---

## 7. Comprehensive Regression Test Plan

### 7.1 Unit Test Specifications

| Suite File | Test Case | Target Invariant |
| :--- | :--- | :--- |
| `backend/src/tests/unit/settlementCalculations.test.ts` | Advance deduction with mixed cash and fuel-card stops | Deducts cash fuel from advance; does not deduct fuel-card fuel from driver advance. |
| `backend/src/tests/unit/settlementCalculations.test.ts` | Out-of-pocket driver reimbursement | If cash fuel + expenses > advance, yields `payable_to_driver`. |
| `backend/src/tests/unit/creditExposureHelper.test.ts` | Exposure evaluation across open invoices and active trips | Formula matches $\sum \text{Invoices} + \sum \text{Dispatched} - \sum \text{Receipts}$. |
| `backend/src/tests/unit/creditExposureHelper.test.ts` | Zero credit limit evaluation | Returns breach when configured, passes when unconfigured. |
| `backend/src/tests/unit/marketMovementMath.test.ts` | Net balance equation with all deductions | $\text{Net Due} = \text{Freight} - \text{Cash} - \text{Diesel} - \text{Dala} - \text{Kamisan} + \text{Halting}$. |
| `backend/src/tests/unit/partyBalanceSync.test.ts` | Opening balance delta calculation | $\Delta = \text{new} - \text{old}$; adjusts current balance by exact delta. |

---

### 7.2 Integration Test Specifications

| Suite File | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| `backend/src/tests/integration/partyBalanceSync.test.ts` | Update party opening balance via API | Database updates `opening_balance` and `current_balance`; logs to `AuditLog`. |
| `backend/src/tests/integration/fuelLedgerInvariants.test.ts` | Record fuel stop with mode `'credit'` | Emits balanced `Ledger` debit/credit; increments vendor `current_balance`. |
| `backend/src/tests/integration/fuelLedgerInvariants.test.ts` | Record fuel stop with mode `'cash'` | Emits balanced `Ledger` debit/credit; credits driver advance asset sub-ledger. |
| `backend/src/tests/integration/fuelLedgerInvariants.test.ts` | Record fuel stop with mode `'fuel_card'` | Emits balanced `Ledger` debit/credit; credits card clearing account. |
| `backend/src/tests/integration/creditLimitEnforcement.test.ts` | Dispatcher dispatches over-limit customer | Returns `HTTP 403 Forbidden` with exposure details. |
| `backend/src/tests/integration/creditLimitEnforcement.test.ts` | Admin overrides over-limit customer with valid reason | Returns `HTTP 200 OK`; dispatches journey; persists audit log entry. |
| `backend/src/tests/integration/creditLimitEnforcement.test.ts` | Admin attempts override with empty reason | Returns `HTTP 400 Bad Request`. |
| `backend/src/tests/integration/marketMovementAlignment.test.ts` | Create and retrieve market movement with Dala and Kamisan | Net due matches formula; all deduction fields present in API response. |

---

### 7.3 Financial Edge Cases to Verify
1. **Paise Precision Rounding:** Verify that 3-decimal rates (e.g. 105.45 litres @ ₹92.355/L) round deterministically to 2 decimal places using `roundMoney`.
2. **Zero-Distance Trips:** Ensure zero-distance or cancelled trips do not cause division-by-zero errors in mileage or fuel calculations.
3. **Transaction Abort Rollback:** Simulate a database failure during fuel stop logging; verify that neither `TruckJourney` nor `Ledger` nor `BalanceParty` retains orphaned records.
4. **Existing Suite Regression:** Rerun `phase3FinancialInvariants.test.ts`, `phase25Transactions.test.ts`, `phase23Idempotency.test.ts`, and `batchASecurity.test.ts` to ensure 100% pass rate.

---

## 8. Implementation Sequence & Phasing Strategy

To maintain complete stability and zero regression risk, Batch B must be implemented in five strictly sequenced phases:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Pure Calculation Helpers & Unit Tests              │
│ - creditExposureService.ts                                  │
│ - settlementCalculator.ts update for cash fuel              │
│ - Unit test validation                                      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Schema & Model Enhancements                        │
│ - TruckJourney.ts: add advance_funded_diesel_cost           │
│ - IDieselExpense: add balance_party_id reference            │
│ - BillingParty.ts: add enforce_credit_limit flag            │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Backend Controllers & ACID Transaction Handlers    │
│ - partyController.ts: opening balance delta + audit log     │
│ - journeyController.ts: addDieselStop Ledger integration    │
│ - journeyController.ts: dispatch credit limit gate (DEC-007)│
│ - entryController.ts: LR credit limit gate                  │
│ - settlementController.ts: cash fuel deduction in payouts   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Frontend Component & Table Alignment               │
│ - VehicleEntryListPage.tsx: render Dala & Kamisan columns   │
│ - JourneyDetailPage.tsx: update cash balance equation       │
│ - CreditLimitWarningModal.tsx: advisory & override dialog   │
│ - BalancePartyListPage.tsx: verify balance refresh          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Verification & Full Regression Suite Sign-Off      │
│ - Integration tests execution                               │
│ - Multi-tenant isolation verification                       │
│ - Full automated test suite verification (Target: 260+ pass)│
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Risks, Assumptions and Unresolved Product Questions

### 9.1 Technical & Operational Risks
1. **Historical Settlement Data Immutability:**
   - *Risk:* Altering the settlement calculation formula could retroactively alter financial figures on completed trips.
   - *Mitigation:* The cash fuel deduction formula must strictly apply only to new settlements created after Batch B release. Completed settlements (`is_settled: true`) must remain permanently immutable.
2. **Fuel Pump Vendor Selection Friction:**
   - *Risk:* Requiring a registered `BalanceParty` for every credit fuel stop could create operational friction for dispatchers if a local pump is not yet onboarded.
   - *Mitigation:* Allow quick on-the-fly pump vendor creation or allow selecting an existing vendor from a dropdown with a fallback "Unregistered Pump" vendor account.

### 9.2 DEC-007 Decision Governance Status
- Product Owner Decision `DEC-007` (Option B: Soft Warning with Company Admin Override and Audit Log) has been formally documented in this preflight report.
- The authoritative decision file `docs/testing/decisions/DEC-007-credit-limit-warning-and-override.md` currently records status `Proposed — Pending Review`.
- **Proposed Documentation Action:** Following Product Owner review of this preflight report, update `DEC-007` status from `Proposed — Pending Review` to `Approved (Option B)`.

### 9.3 Unresolved Questions for Product Owner Review
1. **Credit Limit Definition for Unconfigured Shippers:**
   - Should a newly registered customer with `credit_limit === 0` default to "Unlimited Credit" or "Zero Credit (Cash in Advance)"?
   - *Engineering Recommendation:* Default to "Unlimited / Unrestricted" until a positive `credit_limit` is explicitly configured on the customer profile.
2. **DEC-004 Gating Exemption:**
   - Does early freight invoice creation (pre-delivery / pre-POD) require the same Company Admin override modal as credit limit breaches, or a distinct billing supervisor permission?
   - *Engineering Recommendation:* Use Company Admin override with mandatory justification, recorded in `AuditLog`.

---

## 10. Acceptance Checklist

Before Batch B can be considered complete during its future implementation phase, every one of the following criteria must pass:

- [ ] **FF-ISSUE-042:** Modifying party `opening_balance` updates the database record and adjusts `current_balance` by $\Delta = \text{new} - \text{old}$.
- [ ] **FF-ISSUE-042:** Party opening balance edits generate an immutable `AuditLog` entry.
- [ ] **FF-ISSUE-043:** Diesel purchases marked `payment_mode === 'cash'` deduct directly from driver cash balance on Journey Detail.
- [ ] **FF-ISSUE-043:** Driver settlements reconcile cash-funded fuel expenses so drivers are not docked wages for company fuel.
- [ ] **FF-ISSUE-044:** Fuel stops logged with `payment_mode === 'credit'` post balanced double-entry ledger journals to Accounts Payable (`BalanceParty`).
- [ ] **FF-ISSUE-044:** Fuel stops logged with `payment_mode === 'cash'` credit the driver advance asset sub-ledger.
- [ ] **FF-ISSUE-044:** Fuel stops logged with `payment_mode === 'fuel_card'` credit the corporate card clearing account.
- [ ] **FF-ISSUE-045 / DEC-007:** Dispatching a trip for a customer exceeding their credit limit triggers an advisory warning modal.
- [ ] **FF-ISSUE-045 / DEC-007:** Standard dispatchers are blocked from completing dispatch when credit limit is breached (`HTTP 403`).
- [ ] **FF-ISSUE-045 / DEC-007:** Company Admin can override the credit limit breach with a mandatory justification string (minimum 10 characters).
- [ ] **FF-ISSUE-045 / DEC-007:** Credit limit overrides generate an immutable `AuditLog` record with exposure metrics, user ID, and justification reason.
- [ ] **FF-ISSUE-050:** `VehicleEntryListPage.tsx` renders explicit columns for `dala_charges` and `kamisan_amount`.
- [ ] **FF-ISSUE-050:** Market Movement detail view renders line-by-line arithmetic breakdown resolving the apparent ₹3,000 difference.
- [ ] **Test Coverage:** All new unit and integration tests pass 100%. Full backend automated test suite passes with zero regressions.
- [ ] **Tenant Isolation:** All queries and ledger transactions strictly enforce `company_id: req.tenant.id`.

---

## 11. Approval Gate

> [!WARNING]
> ### FORMAL APPROVAL GATE: IMPLEMENTATION ON HOLD
> **Execution of Batch B code modifications is strictly prohibited until this preflight document has been reviewed and approved by the Product Owner.**
> 
> - No application source code has been modified.
> - No database migrations or schema alterations have been executed.
> - No test suites have been modified.
> - The existing Batch A commit remains the authoritative HEAD.
> 
> **Next Step:** Await explicit Product Owner review and authorization before implementing Batch B.
