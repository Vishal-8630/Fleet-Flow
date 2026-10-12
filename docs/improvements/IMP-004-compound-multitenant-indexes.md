# IMP-004: Compound Multi-Tenant Database Indexing Optimization

**Improvement ID:** `IMP-004`  
**Title:** Compound Multi-Tenant Database Indexing Optimization  
**Category:** Database / Performance Engineering  
**Priority:** `P1` (High)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In a shared-database multi-tenant SaaS, every query must be filtered by `company_id`. While primary business entities (like `LR.ts`) have basic indexes, several high-volume transaction models lack compound indexes prefixed by `company_id`. Under production load (millions of GPS pings, thousands of ledger lines, hundreds of documents), MongoDB will execute costly collection scans (COLLSCAN) instead of index scans (IXSCAN), degrading query performance and causing connection timeouts.

---

## 2. Missing Index Audit & Remediation Strategy

| Model File | Current Indexing | Recommended Compound Index | Query Workload Optimized |
|---|---|---|---|
| [`GpsPing.ts`](../../backend/src/models/VehicleLocationLog.ts) | `{ truck_id: 1 }` | `{ company_id: 1, truck_id: 1, timestamp: -1 }` | Live fleet map latest position lookup |
| [`JournalEntry.ts`](../../backend/src/models/Ledger.ts) | `{ party_name: 1 }` | `{ company_id: 1, party_type: 1, date: -1 }` | General ledger balance sheet and party statements |
| [`Document.ts`](../../backend/src/models/Entry.ts) | None | `{ company_id: 1, category: 1, expiry_date: 1 }` | Compliance expiry alert worker |
| [`Invoice.ts`](../../backend/src/models/Invoice.ts) | `{ invoice_no: 1 }` | `{ company_id: 1, status: 1, due_date: 1 }` | AR Aging report bucket calculations |
| [`TruckJourney.ts`](../../backend/src/models/TruckJourney.ts) | `{ journey_no: 1 }` | `{ company_id: 1, status: 1, start_date: -1 }` | Active trips dashboard widget |

---

## 3. Implementation Plan
Add explicit compound indexes to Mongoose schemas:
```typescript
GpsPingSchema.index({ company_id: 1, truck_id: 1, timestamp: -1 });
JournalEntrySchema.index({ company_id: 1, party_type: 1, date: -1 });
DocumentSchema.index({ company_id: 1, category: 1, expiry_date: 1 });
InvoiceSchema.index({ company_id: 1, status: 1, due_date: 1 });
TruckJourneySchema.index({ company_id: 1, status: 1, start_date: -1 });
```

---

## 4. Acceptance Criteria
- [ ] MongoDB `explain('executionStats')` confirms `IXSCAN` usage for all dashboard and report queries.
- [ ] Collection scan count drops to 0 for tenant-scoped operations.

---

## 5. Definition of Done
1. Schema index declarations added.
2. Index build migration executed.
