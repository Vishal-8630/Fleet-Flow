# Fleet Flow — Batch 3 Preflight Audit Report (No Code Changes)

**Document Version:** 1.0.0  
**Audit Date:** October 2026  
**Status:** Complete — Ready for Review & Implementation Approval  
**Audit Scope:** Batch 3 — Double-Entry Financial Integrity, Ledger Invariants, AR Aging & Commercial UI  
**Author:** Independent Systems Reviewer & Principal Architect  
**Authoritative Reference:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md)  
**Sequencing Blueprint:** [`docs/IMPLEMENTATION_BATCHES.md`](../IMPLEMENTATION_BATCHES.md)  
**Readiness Backlog:** [`docs/IMPLEMENTATION_READINESS_BACKLOG.md`](../IMPLEMENTATION_READINESS_BACKLOG.md)  

---

## 1. Executive Summary

This preflight report provides a **source-verified, forensic architectural blueprint** for **Batch 3** of the Fleet Flow B2B Transport Management SaaS platform. 

### Preflight Audit Boundaries Adhered To:
- **Zero code modifications:** No application controllers, services, database models, frontend views, or routes were modified.
- **Zero test harness modifications:** Existing Vitest integration tests and configurations remain untouched.
- **Zero configuration or package changes:** No npm packages, Docker configurations, or TypeScript settings were altered.
- **No speculative implementation:** No Batch 3 issue is marked resolved. Every finding is anchored directly in current source code evidence.
- **Strict decision boundaries:** `DEC-003` (S3 Object Storage Migration) remains strictly **Pending Approval**. No S3 migration is initiated or assumed.

### Core Objectives of Batch 3:
Batch 3 focuses exclusively on **Commercial Accounting, General Ledger Invariants, AR Aging Accuracy, and Commercial UI Completion**. Following the successful establishment of tenant isolation in Batch 1 and database replica-set transactional concurrency in Batch 2, Batch 3 rectifies active financial calculation defects, enforces the fundamental double-entry equation ($\sum \text{Debits} \equiv \sum \text{Credits}$), fixes broken commercial report aggregations, creates the missing Credit Notes frontend view, and establishes automated financial invariant regression testing (`TEST-003`).

---

## 2. Current Baseline and Batch 2 Carry-Forward

### 2.1. Verified Baseline
As verified at the conclusion of Batch 2:
- **Backend Test Suite**: **108/108 tests passing** (100% green across 8 test suites in Vitest).
- **Backend TypeScript Compilation**: Clean build (`tsc`, exit code 0).
- **Frontend Production Build**: Clean build (`tsc -b && vite build`, 1,770 modules transformed, exit code 0).
- **Database Topology & ACID Semantics**: `DEC-002 Option A` enforced. Mandatory replica set topology (`rs0`) asserted fail-fast via `assertReplicaSetTopology()`. Multi-document ACID transactions centralized in `runInTransaction()` with automatic rollback on error.
- **Transactional Idempotency**: Distributed atomic locking with fencing tokens and `COMMITTED` status recording inside the same database transaction session. Stale lease recovery (>120s) and replay deduplication (`X-Cache: IDEMPOTENT_HIT`) operational.
- **Tenant Isolation**: Strict Mongoose query/mutation hooks, aggregation pipeline type-safety (`new Types.ObjectId(companyId)`), and compound multi-tenant indexes (`IMP-004`).
- **File Storage Security**: Magic-byte validation (`ISS-016`) and root path jailing (`ISS-017`) active for local storage.

### 2.2. Batch 2 Carry-Forward Limitations & Invariants to Preserve
1. **Docker Runtime Notice**: Docker daemon remains unverified in the local workstation environment due to host daemon unavailability; Docker Compose manifests (`docker-compose.yml`, `docker-compose.dev.yml`) remain statically verified.
2. **Post-Commit Side Effect Limitation (Best-Effort Notifications)**:
   - External asynchronous dispatches (such as WhatsApp driver settlement slips and customer SMS alerts) trigger post-commit in a background fire-and-forget promise.
   - Because a persistent transactional outbox pattern has not yet been built, these external notifications remain **best-effort**. If the Node.js process crashes immediately after MongoDB commits, the external message dispatch is dropped.
   - **Batch 3 Invariant**: Financial mutations in Batch 3 (credit notes, vendor payouts) must continue to isolate side effects so that notification errors **never** abort committed financial transactions, while deferring the full outbox architecture to its scheduled infrastructure batch (`Batch 8 / OPS-002`).
3. **DEC-003 Storage Status**: `DEC-003` remains **Pending Approval**. Credit note PDF attachments and local document storage must continue to use the hardened local storage engine without assuming cloud S3 bucket availability.

---

## 3. Repository Evidence and Unresolved Findings

A comprehensive audit of the active codebase revealed the following high-priority defects and functional gaps:

| ID | Title | Priority | Status | Source Code Location |
| :--- | :--- | :--- | :--- | :--- |
| **`ISS-003`** | Credit Note Balance Reduction Failure | `P0` / Blocker | Confirmed Active Defect | [`backend/src/controllers/commercialReportController.ts:297-302`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts#L297-L302) |
| **`ISS-004`** | Vendor Payout Ledger Reconciliation & Single-Leg Debit | `P0` / Blocker | Confirmed Active Defect | [`backend/src/controllers/ledgerController.ts:544-565`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/ledgerController.ts#L544-L565)<br>[`backend/src/controllers/ledgerController.ts:434-448`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/ledgerController.ts#L434-L448) |
| **`ISS-008`** | Missing Credit Notes Page Component & Navigation | `P1` / High | Confirmed Integration Mismatch | [`frontend/src/components/layout/Sidebar.tsx:81`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx#L81)<br>[`frontend/src/App.tsx:231-256`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx#L231-L256) |
| **`ISS-009`** | AR Aging Table Displays Blank Customer Names (`"—"`) | `P1` / High | Confirmed Active Defect | [`frontend/src/pages/commercial/AgingReportPage.tsx:233`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/AgingReportPage.tsx#L233)<br>[`backend/src/controllers/commercialReportController.ts:67`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts#L67) |
| **`ISS-010`** | Trip Profitability Report Always Returns Zero Values | `P1` / High | Confirmed Active Defect | [`backend/src/controllers/commercialReportController.ts:128-135`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts#L128-L135)<br>[`backend/src/models/TruckJourney.ts:172,197-200`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts#L172-L200) |
| **`IMP-001`** | Comprehensive GSTIN & PAN Validation Engine | `P1` / High | Proposed Improvement | [`backend/src/controllers/billingPartyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingPartyController.ts)<br>[`backend/src/models/BillingParty.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/BillingParty.ts) |
| **`TEST-003`**| Double-Entry Accounting Invariant Test Suite | `P0` / Blocker | Missing Test Infrastructure | [`backend/src/tests/integration/`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/tests/integration) |

---

### Detailed Source Evidence

#### 1. `ISS-003`: Credit Note Balance Reduction Failure
- **Source Inspection**: Lines 297–302 in `backend/src/controllers/commercialReportController.ts`:
  ```typescript
  // Reduce the invoice's outstanding balance
  await Invoice.updateOne(
    { _id: original_invoice_id },
    { $inc: { amount_paid_paise: total_adjustment_paise } }
  );
  ```
- **The Defect**:
  1. `Invoice.ts` does not contain any field named `amount_paid_paise`. Invoice amounts are stored in standard rupees as `paid_amount` and `balance_amount`.
  2. Mongoose sets an unindexed, untracked field on the document while leaving `balance_amount` untouched.
  3. `total_adjustment_paise` is expressed in paise (1/100 INR), whereas `Invoice` fields are in rupees.
  4. The invoice `status` is never updated (remains `unpaid` even if fully credited).
  5. The operation does not run within an ACID transaction (`runInTransaction`), risking orphaned credit notes if server execution halts.
  6. No double-entry General Ledger journal is posted to reflect sales returns or rate adjustments.

#### 2. `ISS-004`: Vendor Payout Ledger Reconciliation & Single-Leg Debit
- **Source Inspection A (One-Sided Journal Entry)**: Lines 548–565 in `backend/src/controllers/ledgerController.ts`:
  ```typescript
  const ledgerEntry = new Ledger({
    company_id: companyId,
    transaction_number,
    transaction_date: new Date(),
    category: 'payment_made',
    transaction_type: 'vehicle_entry',
    balance_type: 'debit',
    amount: payoutAmount,
    payment_mode,
    reference_number,
    party_name: party.party_name,
    description: `Vendor payout to ${party.party_name}: ${notes || 'Brokerage freight balance settlement'}`,
    is_auto_generated: true,
    balance_party_id: party._id,
    created_by: req.user?._id,
  });
  await ledgerEntry.save();
  ```
  - **The Defect**: The handler saves a solitary `debit` row to `Ledger`. It generates **no credit leg** for the Cash/Bank account and assigns no `journal_id`. Total debits exceed total credits, corrupting the trial balance.
- **Source Inspection B (Omission in Balance Aggregation)**: Lines 434–448 in `backend/src/controllers/ledgerController.ts`:
  ```typescript
  const movements = await VehicleEntry.aggregate([
    { $match: { company_id: companyObjectId, is_deleted: false } },
    {
      $group: {
        _id: '$balance_party_id',
        totalMovements: { $sum: 1 },
        totalFreight: { $sum: '$freight_amount' },
        totalAdvances: { $sum: '$driver_cash_advance' },
        totalKamisan: { $sum: '$kamisan_amount' },
        totalHalting: { $sum: '$halting_amount' },
        totalOtherDeductions: { $sum: '$dala_charges' },
        netBalancePayable: { $sum: '$net_balance_due' },
      },
    },
  ]);
  ```
  - **The Defect**: `getPartyBalances` groups exclusively from `VehicleEntry` records. It completely ignores payments recorded in `Ledger`. When a user records a ₹50,000 vendor payout, the vendor's payable balance in `getPartyBalances` remains completely unchanged.

#### 3. `ISS-008`: Missing Frontend Credit Notes Route and Page Component
- **Source Inspection**: 
  - `frontend/src/components/layout/Sidebar.tsx:81` renders:
    ```typescript
    { label: 'Credit Notes', path: '/commercial/credit-notes', icon: FileX, roles: ['admin', 'accountant'] },
    ```
  - `frontend/src/App.tsx:232-243` defines commercial routes for `/invoices`, `/commercial/invoices`, `/commercial/aging`, `/settlements`, `/commercial/settlements`, `/ledger`, `/commercial/ledger`, but **omits** `/commercial/credit-notes`.
  - Directory listing of `frontend/src/pages/commercial/` confirms `CreditNotesPage.tsx` does not exist.
  - When users click "Credit Notes", the router falls through to the catch-all wildcard (`<Route path="*" element={<Navigate to="/dashboard" replace />} />`), immediately bouncing users to `/dashboard`.

#### 4. `ISS-009`: AR Aging Report Table Displays Missing Customer Names (`"—"`)
- **Source Inspection A (Frontend Render)**: Line 233 in `frontend/src/pages/commercial/AgingReportPage.tsx`:
  ```tsx
  <td style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-sm)' }}>
    {item.party?.party_name || '—'}
  </td>
  ```
- **Source Inspection B (Backend Projection)**: Line 67 in `backend/src/controllers/commercialReportController.ts`:
  ```typescript
  const summary = {
    invoice_id: inv._id,
    invoice_no: inv.invoice_number,
    party: inv.billing_party_snapshot?.name || (inv.billing_party_id as any)?.party_name || 'Customer',
    invoice_date: inv.invoice_date || inv.created_at,
    outstanding_paise: outstanding,
    age_days: ageDays,
  };
  ```
- **The Defect**: The backend returns `party` as a flat primitive string (e.g. `'Ultratech Cement'`). In JavaScript, evaluating `("Ultratech Cement")?.party_name` yields `undefined`, forcing the fallback `'—'` for every single row in the report.

#### 5. `ISS-010`: Trip Profitability Report Always Returns Zero Values
- **Source Inspection A (Controller Calculation)**: Lines 128–135 in `backend/src/controllers/commercialReportController.ts`:
  ```typescript
  const profitReport = journeys.map((j) => {
    const revenue_paise = (j as any).total_freight_paise || 0;
    const expenses_paise =
      ((j as any).diesel_expense_paise || 0) +
      ((j as any).toll_expense_paise || 0) +
      ((j as any).driver_allowance_paise || 0) +
      ((j as any).other_expense_paise || 0);
  ```
- **Source Inspection B (Schema Reality)**: In `backend/src/models/TruckJourney.ts:172,197-200`:
  ```typescript
  freight_rate?: number; // Rupee freight revenue
  total_diesel_cost: number; // Rupee diesel expenses
  total_driver_expenses: number; // Rupee toll, driver advance & en-route expenses
  ```
- **The Defect**: `TruckJourney` does not track financial fields with the `_paise` suffix. Because all accessed properties evaluate to `undefined`, revenue is 0, expenses are 0, and net profit is 0 across all trips.

#### 6. `IMP-001`: Lack of GSTIN & PAN Structural & Checksum Validation
- **Source Inspection**: In `backend/src/controllers/billingPartyController.ts`, GSTIN and PAN are saved directly from `req.body` without format regex or Modulo-36 check-digit verification. Invalid GSTINs prevent accurate state extraction (`gstin.substring(0, 2)`), corrupting automated tax calculations (CGST/SGST vs IGST).

---

## 4. Proposed Batch 3 Scope and Prioritization

### Prioritization Matrix

| Canonical ID | Proposed Title | Severity | Priority Tier | Rationale | Recommended Batch |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ISS-003`** | Credit Note Balance Reduction & ACID Transaction | Critical | **P0** | Direct financial data corruption; invoice balance never decreases upon credit note issuance. | **Batch 3** |
| **`ISS-004`** | Double-Entry Vendor Payouts & Net Balance Aggregation | Critical | **P0** | Direct general ledger corruption; breaks double-entry equality; ignores payouts in vendor balance. | **Batch 3** |
| **`TEST-003`**| Double-Entry Accounting Invariant Test Suite | Blocker | **P0** | Mathematical verification gate ensuring zero debit/credit variance and financial atomicity. | **Batch 3** |
| **`ISS-008`** | Credit Notes UI Page Component & Route Wiring | High | **P1** | Dead navigation link; prevents commercial operators from accessing credit notes in web app. | **Batch 3** |
| **`ISS-009`** | AR Aging Report Customer Name Display Fix | High | **P1** | Essential collections report; table displays blank customer names across all aging buckets. | **Batch 3** |
| **`ISS-010`** | Trip Profitability Report Real Metric Mapping | High | **P1** | Executive P&L report; all journeys report ₹0 revenue, ₹0 expenses, and 0% margins. | **Batch 3** |
| **`IMP-001`** | Comprehensive GSTIN & PAN Validation Engine | High | **P1** | Statutory tax data integrity; prevents malformed tax IDs and ensures accurate interstate bifurcation. | **Batch 3** |

---

### Detailed Scope Specifications

#### Item 1: `ISS-003` — Credit Note Balance Reduction & Transactional Ledger Posting
- **Problem**: Invoice balance does not decrease upon credit note creation; non-existent schema field updated; no transaction or ledger journal.
- **Recommended Solution**:
  1. Wrap `createCreditNote` in `runInTransaction(async (session) => { ... }, { statusCode: 201 })`.
  2. Read invoice rupee balance (`balance_amount`, `paid_amount`, `total_amount`).
  3. Convert `total_adjustment_paise` to rupees (`adjustmentRupees = total_adjustment_paise / 100`).
  4. Assert adjustment does not exceed invoice `balance_amount`.
  5. Increment invoice `paid_amount` by `adjustmentRupees`, decrement `balance_amount` by `adjustmentRupees`.
  6. Transition `status` to `'paid'` if `balance_amount <= 0`, or `'partially_paid'` if `balance_amount < total_amount`.
  7. Post a balanced double-entry journal via `postDoubleEntryJournal` in `ledgerService.ts` (Debit: `other_adjustment` for sales return / discount; Credit: `payment_received` for invoice balance clearance).
- **Files Affected**:
  - [`backend/src/controllers/commercialReportController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts)
  - [`backend/src/utils/ledgerService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/ledgerService.ts)

#### Item 2: `ISS-004` — Balanced Vendor Payouts & Party Balance Reconciliation
- **Problem**: `recordPartyPayout` writes a single debit leg without balancing credit; `getPartyBalances` ignores payouts in balance calculation.
- **Recommended Solution**:
  1. Refactor `recordPartyPayout` to execute inside `runInTransaction()` and call `postDoubleEntryJournal`:
     - Leg 1 (Debit): Category `payment_made`, balance_type `debit`, amount `payoutAmount`, `balance_party_id: party._id`.
     - Leg 2 (Credit): Category `bank_transfer` (or `cash_transfer`), balance_type `credit`, amount `payoutAmount`, payment instrument details.
  2. Update `getPartyBalances` aggregation in `ledgerController.ts`:
     - Pipeline Stage 1: Aggregate freight liabilities, advances, and net balance due from `VehicleEntry`.
     - Pipeline Stage 2: Aggregate all debit payments from `Ledger` matching `{ balance_party_id: party._id, category: 'payment_made', is_deleted: false }`.
     - Pipeline Stage 3: Compute `net_balance_due = gross_freight_balance - total_payouts_made`.
- **Files Affected**:
  - [`backend/src/controllers/ledgerController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/ledgerController.ts)
  - [`backend/src/utils/ledgerService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/ledgerService.ts)

#### Item 3: `ISS-008` — Credit Notes Frontend Page & Route Integration
- **Problem**: Dead navigation link `/commercial/credit-notes` redirects to dashboard; missing page component.
- **Recommended Solution**:
  1. Build `frontend/src/pages/commercial/CreditNotesPage.tsx`:
     - Data table rendering Credit Note Number, Original Invoice Number, Party Name, Type, Reason, Adjusted Amount (₹), Status Badge, and Date.
     - Search and filter bar (by credit note number, party, or reason).
     - "Issue Credit Note" modal with invoice selector, adjustment amount input, reason selector, and real-time GST preview.
  2. Register `<Route path="commercial/credit-notes" element={<CreditNotesPage />} />` in `frontend/src/App.tsx`.
- **Files Affected**:
  - `frontend/src/pages/commercial/CreditNotesPage.tsx` *(new file)*
  - [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx)

#### Item 4: `ISS-009` — AR Aging Table Customer Name Display
- **Problem**: Evaluates `item.party?.party_name`, which is `undefined` on string primitive `item.party`.
- **Recommended Solution**:
  1. In `AgingReportPage.tsx:233`, render resiliently:
     ```tsx
     {typeof item.party === 'object' && item.party !== null
       ? item.party.party_name || item.party.name || '—'
       : item.party || '—'}
     ```
  2. Align frontend interface `AgingItem` to specify `party: string | { party_name?: string; name?: string }`.
- **Files Affected**:
  - [`frontend/src/pages/commercial/AgingReportPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/AgingReportPage.tsx)

#### Item 5: `ISS-010` — Trip Profitability Real Metric Mapping
- **Problem**: Reads non-existent `_paise` properties from `TruckJourney`, returning ₹0 for all journeys.
- **Recommended Solution**:
  1. In `getTripProfitabilityReport` (`commercialReportController.ts`), map actual schema fields:
     - `revenue = j.freight_rate || 0`
     - `diesel_cost = j.total_diesel_cost || 0`
     - `other_expenses = j.total_driver_expenses || 0`
     - `total_expenses = diesel_cost + other_expenses`
     - `net_margin = revenue - total_expenses`
     - `margin_percent = revenue > 0 ? ((net_margin / revenue) * 100).toFixed(2) : '0.00'`
  2. Return formatted values supporting both rupee display and paise compatibility.
- **Files Affected**:
  - [`backend/src/controllers/commercialReportController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts)

#### Item 6: `IMP-001` — GSTIN & PAN Checksum Validation Engine
- **Problem**: Accepts malformed GSTIN and PAN strings, breaking tax classification and compliance.
- **Recommended Solution**:
  1. Create `backend/src/utils/gstinValidator.ts` and `frontend/src/utils/gstinValidator.ts`:
     - PAN regex: `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`
     - GSTIN regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
     - State code map (01 to 38)
     - Modulo-36 check-digit verification algorithm (ISO/IEC 7064 Mod 37, 36 adapted for Indian GST)
  2. Mount validator on `BillingParty` and `Company` controllers.
- **Files Affected**:
  - `backend/src/utils/gstinValidator.ts` *(new file)*
  - `frontend/src/utils/gstinValidator.ts` *(new file)*
  - [`backend/src/models/BillingParty.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/BillingParty.ts)
  - [`backend/src/controllers/billingPartyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingPartyController.ts)

#### Item 7: `TEST-003` — Automated Double-Entry Invariant Test Suite
- **Problem**: Missing automated mathematical invariant test suite for accounting operations.
- **Recommended Solution**:
  1. Create `backend/src/tests/integration/phase3FinancialInvariants.test.ts` testing:
     - Double-entry balance invariant ($\sum \text{Debits} == \sum \text{Credits}$) on vendor payouts, credit notes, invoice collections, and driver settlements.
     - Invoice balance invariant (`paid_amount + balance_amount == total_amount`).
     - Vendor balance net reduction on payout.
     - Credit note status transition (`partially_paid`, `paid`).
     - Trip profitability calculations matching seeded journeys.
     - GSTIN/PAN valid vs invalid checksum tests.
- **Files Affected**:
  - `backend/src/tests/integration/phase3FinancialInvariants.test.ts` *(new file)*

---

## 5. Explicit Out-of-Scope Items

To prevent scope creep and maintain strict batch discipline, the following items are strictly **excluded** from Batch 3:

| Canonical ID | Title | Excluded Scope & Deferral Rationale | Scheduled Batch |
| :--- | :--- | :--- | :--- |
| **`DEC-003`** | S3 Object Storage Architecture | **Pending Approval**. Production cloud S3 storage migration remains blocked until formal infrastructure approval is granted. | Batch 6 / Ops |
| **`ISS-005` / `ISS-020`** | Public Tracking IDOR & OTP Rate Limiting | External public tracking privacy, unguessable tokens, and OTP rate limiting belong to the Public & Portal Hardening batch. | Batch 4 |
| **`ISS-006` / `ISS-007`** | Stakeholder Portals Authentication & Live Fleet Map | Portal OTP login fixes, vendor portal authentication, and Leaflet live fleet map schema alignments belong to Batch 4. | Batch 4 |
| **`DEC-001` / `ISS-011`–`013`** | Subscription Pricing Matrix & Entitlements Engine | Commercial plan pricing seeds, Starter plan entitlement unlock, and Razorpay webhook signing belong to Batch 5. | Batch 5 |
| **`OPS-001`–`005`** | SRE, Health Probes & Backup Scripts | Production health probes, backup scripts, and BullMQ background workers belong to Batch 6 & 8. | Batch 6 / 8 |
| **`FEAT-001`–`003`** | Statutory Government Integrations (NIC / IRP / ULIP) | External statutory APIs requiring government sandbox credentials and CA review belong to Batch 10. | Batch 10 |

---

## 6. Decision Dependencies, Including DEC-003

```
┌─────────────────────────────────────────────────────────────┐
│                       DEC-002: Option A                     │
│           Mandatory MongoDB Replica Set Topology            │
│                       [APPROVED]                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Enables
┌─────────────────────────────────────────────────────────────┐
│                    Batch 3 Implementation                   │
│   Double-Entry Accounting, Credit Notes & Vendor Payouts    │
│            [READY FOR IMPLEMENTATION APPROVAL]              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     DEC-003: Cloud S3 Storage               │
│                   [PENDING FORMAL APPROVAL]                 │
│      - S3 Migration: BLOCKED Pending Approval               │
│      - Batch 3 Dependency on DEC-003: NONE (0% Blocked)     │
│      - Local Storage Jailing & Security: SUFFICIENT         │
└─────────────────────────────────────────────────────────────┘
```

### Analysis of DEC-003 Decision Boundary:
1. **Status**: `DEC-003` remains **Pending Approval**.
2. **Impact on Batch 3**: **Zero Impact**. 
   - Batch 3 handles database transaction logic, general ledger postings, AR aging calculations, GSTIN validation, and commercial UI routes.
   - Credit note document records (`CreditNote`) store metadata in MongoDB. File attachments (PDF invoices or credit note slips) utilize the existing local file storage engine, which was already hardened in Batch 1 with magic-byte MIME inspection (`ISS-016`) and root path traversal jailing (`ISS-017`).
   - No feature in Batch 3 requires or assumes S3 cloud storage.

---

## 7. Implementation Sequence and Dependency Map

Batch 3 implementation must follow a strict 4-phase chronological sequence to ensure each layer builds upon verified foundations:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 3.1: Data Validation & Utility Foundations (IMP-001)                   │
│ - Implement backend/src/utils/gstinValidator.ts                             │
│ - Implement frontend/src/utils/gstinValidator.ts                            │
│ - Unit test Modulo-36 check-digit algorithm and PAN regex                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 3.2: General Ledger & Accounting Invariant Rectification (ISS-003, 004)│
│ - Extend ledgerService.ts with balanced postCreditNoteJournal & postVendorPayout│
│ - Refactor commercialReportController.ts:createCreditNote to use runInTransaction│
│ - Refactor ledgerController.ts:recordPartyPayout to use postDoubleEntryJournal│
│ - Update ledgerController.ts:getPartyBalances to deduct recorded payouts     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 3.3: Reporting Calculations & Commercial UI Components (ISS-008, 009, 010)│
│ - Fix commercialReportController.ts:getTripProfitabilityReport field mappings│
│ - Fix frontend/src/pages/commercial/AgingReportPage.tsx customer name render│
│ - Create frontend/src/pages/commercial/CreditNotesPage.tsx                  │
│ - Register /commercial/credit-notes route in frontend/src/App.tsx            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 3.4: Automated Test Suite & Regression Verification (TEST-003)        │
│ - Build backend/src/tests/integration/phase3FinancialInvariants.test.ts    │
│ - Execute complete backend test suite (target: 108 + new tests = ~120 tests)│
│ - Run full backend & frontend production builds                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Security, Tenant Isolation, and Financial Integrity Risks

| Risk Category | Potential Failure Scenario | Mitigation Safeguard in Batch 3 |
| :--- | :--- | :--- |
| **Double-Entry Variance** | Vendor payout or credit note posts unequal debits and credits, breaking general ledger trial balance. | Enforced at service layer via `postDoubleEntryJournal()`: asserts `Math.abs(totalDebits - totalCredits) <= 0.001` or throws error. |
| **Transaction Split / Orphan Writes** | Credit note is saved but invoice balance update fails, or invoice updates but credit note creation fails. | Enforced via `runInTransaction()`: all writes execute inside a single MongoDB ClientSession with automatic atomic rollback. |
| **Cross-Tenant Financial Leakage** | Tenant A issues credit note referencing Tenant B's invoice, reducing Tenant B's balance. | Scoped query assertion: `Invoice.findOne({ _id: original_invoice_id, company_id: tenantA })`. Throws 404 if cross-tenant. |
| **Prototype Pollution via GSTIN** | Malicious inputs injected into GSTIN/PAN form fields attempt MongoDB operator injection. | Sanitized with strict regex validation: only alphanumeric characters matching exact length (15 for GSTIN, 10 for PAN) are accepted. |
| **Negative Invoice Balance Drift** | Issuing a credit note larger than the invoice balance results in negative receivable liability. | Boundary assertion: `if (adjustmentRupees > invoice.balance_amount) throw new Error('Credit note cannot exceed balance')`. |
| **Notification Failure Rollback** | Outbox failure or WhatsApp API timeout causes financial transaction to abort. | Isolated post-commit side effects: notification dispatches run outside `runInTransaction()` in background `.catch()` handlers. |

---

## 9. Test Plan and Acceptance Criteria

### 9.1. Exact Verification Commands
The following package scripts must be run during Batch 3 implementation:

1. **Targeted Financial Invariants Test Suite**:
   ```powershell
   npx vitest run src/tests/integration/phase3FinancialInvariants.test.ts
   ```
2. **Complete Backend Test Suite (All 9 Suites)**:
   ```powershell
   npm test
   ```
   *Baseline: 108/108 passing. Expected with Batch 3: ~120/120 passing.*
3. **Backend TypeScript Compilation**:
   ```powershell
   npm run build
   ```
4. **Frontend Production Build**:
   ```powershell
   npm run build
   ```

### 9.2. Measurable Acceptance Criteria

```
+--------------------------------------------------------------------------------------------------------------------+
| Target Specification | Test Case / Scenario                                | Pass / Fail Acceptance Criteria        |
+--------------------------------------------------------------------------------------------------------------------+
| ISS-003 (Credit Note) | Issue ₹10,000 credit note against ₹50,000 invoice    | Invoice balance_amount == 40000;       |
|                      |                                                     | paid_amount == 10000; status == partial |
|                      | Issue full credit note for remaining ₹40,000        | Invoice balance_amount == 0;           |
|                      |                                                     | status == 'paid'                       |
|                      | Attempt credit note exceeding balance               | Rejected with HTTP 400 Bad Request     |
|                      | General Ledger entries for credit note              | Exactly 2 legs: Debit other_adjustment |
|                      |                                                     | Credit payment_received (balanced)     |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| ISS-004 (Payouts)    | Record ₹25,000 vendor payout in ledger              | Exactly 2 legs under same journal_id:  |
|                      |                                                     | Debit payment_made, Credit bank_transfer|
|                      | Query getPartyBalances after payout                 | net_balance_due decreases by ₹25,000    |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| ISS-008 (UI Route)   | Click 'Credit Notes' in sidebar                     | Navigates to /commercial/credit-notes   |
|                      |                                                     | Renders data table, 0 dashboard redirect|
|                      | Submit Issue Credit Note form in modal              | Issues credit note and refreshes table  |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| ISS-009 (AR Aging)   | Query GET /api/commercial/aging and view UI table   | Customer column renders real debtor     |
|                      |                                                     | company names (0 instances of '—')      |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| ISS-010 (P&L Report) | Query GET /api/commercial/profitability             | Revenue, diesel, driver expenses, and   |
|                      |                                                     | net margin calculate accurate non-zero  |
|                      |                                                     | figures matching underlying journeys   |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| IMP-001 (GSTIN/PAN)  | Submit valid GSTIN '29ABCDE1234F1Z5'                | Passes validation; extracts 'Karnataka' |
|                      | Submit invalid GSTIN with wrong check digit         | Rejected with descriptive format error  |
|                      | Submit malformed PAN 'ABC123456F'                   | Rejected with HTTP 400                  |
+----------------------+-----------------------------------------------------+-----------------------------------------+
| TEST-003 (Invariants)| Run automated invariant test suite                  | 100% green; zero debit/credit variance; |
|                      |                                                     | zero cross-tenant contamination         |
+----------------------+-----------------------------------------------------+-----------------------------------------+
```

---

## 10. Deployment, Migration, and Rollback Considerations

### 10.1. Database Schema Impact
- **No destructive schema changes**: All modifications are backward-compatible.
- **CreditNote Model**: Schema already exists in `backend/src/models/CreditNote.ts`; controller logic will now correctly populate and link it.
- **Ledger Model**: Schema already supports `journal_id`, `balance_party_id`, and `balance_type`; `recordPartyPayout` will now populate them fully.
- **Invoice Model**: No schema changes required; operations will correctly update existing fields (`paid_amount`, `balance_amount`, `status`).

### 10.2. Rollback Strategy
If any defect is detected during or after Batch 3 implementation:
1. **Application Rollback**: Git revert of Batch 3 commit safely restores prior controller and frontend logic.
2. **Database State Invariance**: Because all financial operations use `runInTransaction()`, any failed operation leaves zero partial state.
3. **Data Compatibility**: Invoices and ledger entries created under Batch 3 adhere strictly to existing Mongoose schemas and can be read by older code without migration errors.

---

## 11. Risks, Unknowns, and Required Approvals

| Item | Risk / Unknown Description | Status | Required Action / Approval |
| :--- | :--- | :--- | :--- |
| **DEC-003 Scope Boundary** | Cloud S3 storage migration remains pending. | **Pending Approval** | Preserve local storage jailing; do not touch S3 migration. |
| **Notification Reliability** | Background WhatsApp delivery is best-effort until transactional outbox is built. | Known Limitation | Retain try/catch isolation; schedule outbox in Batch 8 (`OPS-002`). |
| **Tally XML Export Format** | `exportToTallyXml` in `commercialReportController.ts` uses basic XML templates. | Low Risk | Validated against standard Tally ERP 9 / Prime XML voucher schemas. |
| **Implementation Approval** | Batch 3 requires formal user authorization prior to executing code changes. | Gate Active | Await explicit user instruction before editing source code. |

---

## 12. Final Recommendation

### **Recommendation: PROCEED TO IMPLEMENTATION UPON APPROVAL**

1. **Preflight Audit Complete**: All findings in Batch 3 are source-verified against the active codebase. No assumptions or invented IDs were introduced.
2. **Clear Technical Roadmap**: The minimal, robust solutions for `ISS-003`, `ISS-004`, `ISS-008`, `ISS-009`, `ISS-010`, `IMP-001`, and `TEST-003` are fully specified and sequence-mapped.
3. **Guardrails Preserved**: Batch 2 transaction atomicity, replica-set requirements, idempotency, and tenant isolation guarantees are strictly preserved.
4. **DEC-003 Respected**: Cloud S3 storage migration remains safely blocked pending separate infrastructure review.
5. **No Code Changed**: The repository remains in a clean, pristine state ready for execution upon user authorization.
