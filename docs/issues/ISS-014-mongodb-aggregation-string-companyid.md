# ISS-014: MongoDB Aggregations Pass Raw String `companyId` into `$match`

**Specification ID:** `ISS-014`  
**Title:** MongoDB Aggregations Pass Raw String `companyId` into `$match`  
**Type:** Database / Operations Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Resolved & Verified (Batch 2)  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-12.md`](./ISSUE-12.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`backend/src/controllers/entryController.ts:93`](../../backend/src/controllers/entryController.ts#L93) and [`backend/src/controllers/journeyController.ts:127`](../../backend/src/controllers/journeyController.ts#L127), MongoDB aggregation pipelines construct `$match` filter stages using a raw string representation of `companyId` extracted from `req.user.company_id` (e.g. `{ $match: { company_id: companyId } }`). Unlike standard Mongoose `.find()` queries, MongoDB aggregation pipelines **do not perform automatic type casting**. Because documents store `company_id` as a BSON `ObjectId`, matching against a string always evaluates to false, returning zero documents and corrupting operations metrics.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In `entryController.ts:93`:
  ```typescript
  const companyId = req.user?.company_id; // string from JWT payload
  const metrics = await Entry.aggregate([
    { $match: { company_id: companyId } }, // String passed directly!
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  ```
- **Technical Mechanism:** In MongoDB, BSON types are strictly compared. `"66f123456789abcdef123456"` (string) does not match `ObjectId("66f123456789abcdef123456")`. The `$match` stage silently filters out 100% of the tenant's documents.
- **User Impact:** Dashboard summary widgets ("Today's Inward Entries", "Active Trip Dispatches") display `0` or empty charts even when hundreds of records exist.

---

## 3. Reproduction Steps
1. Create 10 entries for a tenant in the database.
2. Call the metrics endpoint: `GET /api/entries/summary`.
3. Observe: The returned aggregated metrics report `total_entries: 0`, `active_entries: 0`.

---

## 4. Expected Behavior
All aggregation stages filtering by tenant ID must explicitly convert string IDs to BSON ObjectIds:
`new Types.ObjectId(companyId)`.

---

## 5. Proposed Technical Solution
Update all aggregation calls across controllers:
```typescript
import { Types } from 'mongoose';

const companyObjectId = new Types.ObjectId(String(req.company?._id || req.user?.company_id));

const metrics = await Entry.aggregate([
  { $match: { company_id: companyObjectId } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```
Apply this fix across `entryController.ts`, `journeyController.ts`, and `commercialReportController.ts`.

---

## 6. Acceptance Criteria
- [x] Aggregation metrics endpoints return accurate counts and revenue sums matching actual database records.
- [x] No raw string `companyId` is passed into aggregation `$match` filters.

---

## 7. Definition of Done
1. [x] Type casting applied to all controller aggregations across `entryController.ts`, `journeyController.ts`, `settlementController.ts`, `invoiceController.ts`, `ledgerController.ts`, and `vehicleEntryController.ts`.
2. [x] Verified in [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md) and `backend/src/tests/integration/phase21Hardening.test.ts`.

---

## 8. Verification Evidence (Batch 2)
- **Automated Test Suite:** `backend/src/tests/integration/phase21Hardening.test.ts` (7/7 tests passing).
- **Verified Endpoints:**
  - `GET /api/entries/summary` (`getEntryMetrics`): Returns verified accurate counts grouped by status.
  - `GET /api/truck-journeys/analytics` (`getJourneyMetrics`): Returns accurate total trips and revenue metrics matching seeded BSON documents.
- **Controllers Updated with BSON ObjectId Casting:**
  - `backend/src/controllers/entryController.ts`
  - `backend/src/controllers/journeyController.ts`
  - `backend/src/controllers/settlementController.ts`
  - `backend/src/controllers/invoiceController.ts`
  - `backend/src/controllers/ledgerController.ts`
  - `backend/src/controllers/vehicleEntryController.ts`
