# ISS-002: Incomplete Mongoose Tenant Interception Plugin

**Specification ID:** `ISS-002`  
**Title:** Incomplete Mongoose Tenant Interception Plugin  
**Type:** Security / Data Isolation Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Verified (Resolved in Batch 1)  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-01.md`](./ISSUE-01.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
The Mongoose tenant isolation plugin ([`tenantPlugin.ts`](../../backend/src/plugins/tenantPlugin.ts)) only registers query middleware for a subset of Mongoose operations (`find`, `findOne`, `findOneAndUpdate`, `updateMany`, `countDocuments`, `estimatedDocumentCount`). Critical mutation and deletion operations—including `updateOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findByIdAndDelete`, `aggregate`, and `distinct`—are **not intercepted**. Any controller executing these methods without manual `{ company_id }` scoping can modify or delete data belonging to another tenant.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In [`tenantPlugin.ts:79-88`](../../backend/src/plugins/tenantPlugin.ts#L79-L88):
  ```typescript
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateMany',
    'countDocuments',
    'estimatedDocumentCount',
  ] as const;
  ```
- **Vulnerability Analysis:**
  1. `updateOne`: Used across controllers (e.g., [`commercialReportController.ts:298`](../../backend/src/controllers/commercialReportController.ts#L298)). A query `{ _id }` updates any document globally if `_id` is known.
  2. `deleteOne` / `deleteMany`: Can wipe documents across tenant boundaries.
  3. `findOneAndDelete` / `findByIdAndDelete`: Can delete records without checking tenant ownership.
  4. `aggregate`: MongoDB aggregation pipelines bypass Mongoose query middleware entirely. If a developer forgets an explicit `{ $match: { company_id } }`, the aggregation scans the entire database across all companies.
  5. `distinct`: Allows enumeration of unique values (such as customer phone numbers or vendor PANs) across competing transport companies.

---

## 3. Reproduction Steps
1. Create Document A for Tenant 1 (e.g., an Invoice or Truck with ID `X`).
2. Set active tenant context to Tenant 2.
3. Execute `Model.updateOne({ _id: 'X' }, { $set: { notes: 'Compromised' } })`.
4. Inspect Document A in the database: Document A is successfully modified despite belonging to Tenant 1.

---

## 4. Expected Behavior
1. Every query, mutation, and deletion method (`find`, `findOne`, `findOneAndUpdate`, `updateMany`, `updateOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findByIdAndDelete`, `distinct`) must automatically append `{ company_id: currentTenantId }` when a tenant context exists in `AsyncLocalStorage`.
2. For aggregation pipelines, provide a helper method or schema aggregate hook (`schema.pre('aggregate', ...)`) that prepends `{ $match: { company_id: currentTenantId } }` to the pipeline stages.

---

## 5. Proposed Technical Solution
Update `tenantPlugin.ts` to include all query and mutation hooks:
```typescript
const queryMethods = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateMany',
  'updateOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findByIdAndDelete',
  'distinct',
  'countDocuments',
  'estimatedDocumentCount',
] as const;

queryMethods.forEach((method) => {
  schema.pre(method as any, function () {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    this.where({ company_id: tenantId });
  });
});

// Prepend tenant match to aggregation pipelines
schema.pre('aggregate', function () {
  const tenantId = getCurrentTenantId();
  if (!tenantId) return;
  this.pipeline().unshift({
    $match: { company_id: new Types.ObjectId(tenantId) }
  });
});
```

---

## 6. Acceptance Criteria
- [x] Calling `Model.updateOne({ _id })` in Tenant A cannot update a document belonging to Tenant B.
- [x] Calling `Model.deleteOne({ _id })` in Tenant A cannot delete a document belonging to Tenant B.
- [x] Calling `Model.aggregate()` automatically scopes results to the active tenant without requiring manual `$match`.
- [x] Superadmin bypass queries (explicitly flagged with `{ skipTenantCheck: true }`) can query cross-tenant when intentionally configured.
- [x] Missing tenant context safely rejects queries without silent bypass.

---

## 7. Definition of Done & Verification Evidence
1. [x] `tenantPlugin.ts` updated with comprehensive hook list, aggregate hook, safe-fail guard, option-based `skipTenantCheck` verification, bulk insert (`insertMany`) protection, and applied to all tenant models including `CustomFieldDefinition` and `AuditLog`.
2. [x] Cross-tenant mutation, bulk insert, AuditLog isolation, `$geoNear`, and aggregation tests passing in [`TEST-002`](../testing/TEST-002-cross-tenant-isolation-suite.md) (`backend/src/tests/integration/tenantIsolation.test.ts` - 22/22 tests passing).
