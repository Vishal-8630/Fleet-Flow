# IMP-006: Server-Side Pagination, Search & Sorting on Data Tables

**Improvement ID:** `IMP-006`  
**Title:** Server-Side Pagination, Search & Sorting on Data Tables  
**Category:** Frontend / Performance Engineering  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`LrListPage.tsx`](../../frontend/src/pages/commercial/LRListPage.tsx), [`EntriesPage.tsx`](../../frontend/src/pages/operations/VehicleEntryListPage.tsx), and [`InvoicesPage.tsx`](../../frontend/src/pages/commercial/InvoiceListPage.tsx), the application fetches all records from the backend in a single request and performs filtering and pagination purely in the browser. When a transport enterprise accumulates thousands of consignments, the initial JSON payload exceeds 10MB, causing prolonged initial page loading times, high network bandwidth usage, and browser DOM freezing.

---

## 2. Business Value & Intended Outcome
- Scalability to handle companies generating 50,000+ LRs per year.
- Sub-200ms page response times regardless of total database volume.
- Efficient backend querying using MongoDB `$skip`, `$limit`, and compound indexes.

---

## 3. Technical Contract & Architecture
1. Standardize query parameters across list endpoints:
   - `page`: default 1
   - `limit`: default 25 (options: 10, 25, 50, 100)
   - `search`: string query (searches LR number, vehicle number, customer name)
   - `sort_by`: field name (default: `createdAt`)
   - `sort_order`: `asc` | `desc` (default: `desc`)
2. Backend Response Shape:
   ```json
   {
     "success": true,
     "data": [...],
     "pagination": {
       "page": 1,
       "limit": 25,
       "total_records": 1420,
       "total_pages": 57
     }
   }
   ```
3. Reusable UI Component: Create `<DataTablePagination />` handling page changes, page sizes, and showing "Showing 1 to 25 of 1,420 entries".

---

## 4. Acceptance Criteria
- [ ] Network payload for table list views stays under 50KB regardless of database size.
- [ ] Searching by LR number triggers debounced server-side query with instant results.
- [ ] Page navigation retains active filters and sorting in URL query parameters.

---

## 5. Definition of Done
1. Pagination standardized across backend controllers and frontend tables.
2. Verified in load tests.
