# IMP-004: Compound Multi-Tenant Database Indexing Optimization

**Improvement ID:** `IMP-004`  
**Title:** Compound Multi-Tenant Database Indexing Optimization  
**Category:** Database / Performance Engineering  
**Priority:** `P1` (High)  
**Proposed Status:** Resolved & Verified (Batch 2)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In a shared-database multi-tenant SaaS, every query must be filtered by `company_id`. While primary business entities (like `LR.ts`) have basic indexes, several high-volume transaction models lack compound indexes prefixed by `company_id`. Under production load (millions of GPS pings, thousands of ledger lines, hundreds of documents), MongoDB will execute costly collection scans (COLLSCAN) instead of index scans (IXSCAN), degrading query performance and causing connection timeouts.

---

## 2. Missing Index Audit & Remediation Strategy

| Model File | Actual Model | Actual Index | Query Workload Optimized | Explain Plan |
|---|---|---|---|---|
| [`VehicleLocationLog.ts`](../../backend/src/models/VehicleLocationLog.ts) | `VehicleLocationLog` | `{ company_id: 1, truck_id: 1, recorded_at: -1 }` | Live fleet map latest position lookup (field is `recorded_at`, NOT `timestamp`) | `IXSCAN` |
| [`Ledger.ts`](../../backend/src/models/Ledger.ts) | `Ledger` | `{ company_id: 1, balance_party_id: 1, transaction_date: -1 }`<br/>`{ company_id: 1, billing_party_id: 1, transaction_date: -1 }` | Vendor/customer party statements (fields are `balance_party_id`/`billing_party_id` and `transaction_date`, NOT `party_type` or `date`) | `IXSCAN` |
| [`Entry.ts`](../../backend/src/models/Entry.ts) | `Entry` | `{ company_id: 1, status: 1, lr_date: -1 }` | Active dispatch list querying active/invoiced LRs sorted by lr_date (NOT document expiry) | `IXSCAN` |
| [`Invoice.ts`](../../backend/src/models/Invoice.ts) | `Invoice` | `{ company_id: 1, status: 1, due_date: 1 }` | Accounts Receivable Aging report bucket calculations | `IXSCAN` |
| [`TruckJourney.ts`](../../backend/src/models/TruckJourney.ts) | `TruckJourney` | `{ company_id: 1, status: 1, start_date: -1 }`<br/>`{ company_id: 1, truck_id: 1, start_date: -1 }` | Active trips dashboard widget and truck journey history | `IXSCAN` |

---

## 3. Implementation Plan
Explicit compound indexes declared on Mongoose schemas:
```typescript
VehicleLocationLogSchema.index({ company_id: 1, truck_id: 1, recorded_at: -1 });
LedgerSchema.index({ company_id: 1, balance_party_id: 1, transaction_date: -1 });
LedgerSchema.index({ company_id: 1, billing_party_id: 1, transaction_date: -1 });
EntrySchema.index({ company_id: 1, status: 1, lr_date: -1 });
InvoiceSchema.index({ company_id: 1, status: 1, due_date: 1 });
TruckJourneySchema.index({ company_id: 1, status: 1, start_date: -1 });
TruckJourneySchema.index({ company_id: 1, truck_id: 1, start_date: -1 });
```

---

## 4. Acceptance Criteria
- [x] Compound multi-tenant indexes declared on high-volume models prefixed with `company_id`.
- [x] Schema field names precisely match Mongoose schema definitions (`recorded_at`, `transaction_date`, `lr_date`).
- [x] MongoDB `explain('executionStats')` confirms `IXSCAN` usage for tenant-scoped queries instead of `COLLSCAN`.
- [x] Indexes safely created via `initIndexes()` and verified with index build tests.

---

## 5. Definition of Done
1. [x] Schema index declarations added to `VehicleLocationLog.ts`, `Ledger.ts`, `Entry.ts`, `Invoice.ts`, and `TruckJourney.ts`.
2. [x] Automated index creation and IXSCAN verification implemented in `backend/src/tests/integration/phase22Indexes.test.ts`.

---

## 6. Verification Evidence (Batch 2)
- **Automated Test Suite:** `backend/src/tests/integration/phase22Indexes.test.ts` (7/7 tests passing with real `explain('executionStats')` queries).
- **Verified Compound Indexes:**
  1. `VehicleLocationLog`: `{ company_id: 1, truck_id: 1, recorded_at: -1 }` (IXSCAN verified via explain plan).
  2. `Ledger`: `{ company_id: 1, balance_party_id: 1, transaction_date: -1 }` & `{ company_id: 1, billing_party_id: 1, transaction_date: -1 }` (IXSCAN verified via explain plan).
  3. `TruckJourney`: `{ company_id: 1, status: 1, start_date: -1 }` & `{ company_id: 1, truck_id: 1, start_date: -1 }` (IXSCAN verified via explain plan).
  4. `Invoice`: `{ company_id: 1, status: 1, due_date: 1 }` (IXSCAN verified via explain plan).
  5. `Entry`: `{ company_id: 1, status: 1, lr_date: -1 }` (IXSCAN verified via explain plan).
  6. Overall: Verified index registration and IXSCAN stage execution across all five high-volume operational models.
