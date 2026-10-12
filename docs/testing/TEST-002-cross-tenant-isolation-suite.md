# TEST-002: Cross-Tenant Data Isolation & Mutation Boundary Test Suite

**Test Specification ID:** `TEST-002`  
**Title:** Cross-Tenant Data Isolation and Mutation Boundary Test Suite  
**Scope:** Multi-Tenancy, Mongoose Tenant Plugin & Route Scoping  
**Priority:** `P0` (Critical Security Gate)  
**Status:** Verified (Operational in Batch 1)  
**Target Coverage:** Complete Cross-Tenant Boundary Verification  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
The highest risk in a shared-database multi-tenant SaaS is accidental cross-tenant data leakage or cross-tenant document modification. We must systematically prove that User A (belonging to Tenant A) can never view, mutate, or delete records belonging to Tenant B, even if User A explicitly guesses or provides Tenant B's document IDs.

---

## 2. Test Matrix & Boundary Scenarios
1. **Scenario 1 (Read Isolation):**
   - Seed Branch 1 for Tenant A (`id: branch_a`).
   - Authenticate as Tenant B.
   - Send `GET /api/company/branches/branch_a`.
   - Assert: Returns HTTP 404 Not Found (or 403 Forbidden). Must NOT return Branch 1.
2. **Scenario 2 (Update Mutation Isolation):**
   - Authenticate as Tenant B.
   - Attempt `Branch.updateOne({ _id: branch_a }, { $set: { name: 'Compromised' } })`.
   - Assert: Matched count is 0; database inspection confirms Branch 1 is unmodified.
3. **Scenario 3 (Delete Mutation Isolation):**
   - Authenticate as Tenant B.
   - Attempt `Branch.deleteOne({ _id: branch_a })`.
   - Assert: Deleted count is 0; Branch 1 remains in the database.
4. **Scenario 4 (Aggregation Isolation):**
   - Seed 3 Branches in Tenant A and 2 Branches in Tenant B.
   - Run aggregation pipeline as Tenant A.
   - Assert: Pre-aggregate hook automatically prepends `$match: { company_id }`; Tenant A strictly sees 3, never 5.
5. **Scenario 5 (Missing Tenant Context Safe-Fail):**
   - Attempt query/mutation outside `tenantStorage.run()` without `{ skipTenantCheck: true }`.
   - Assert: Operation fails safely by throwing an Error and scoping to null ObjectId.

---

## 3. Acceptance Criteria
- [x] 100% of cross-tenant access attempts are rejected with 404 or 403.
- [x] No un-scoped queries or aggregations execute across tenant boundaries.
- [x] Mutations and deletions across tenant boundaries are rejected by Mongoose hooks.
- [x] Missing tenant context fails safely rather than querying across all tenants.

---

## 4. Definition of Done & Verification Evidence
1. [x] Dedicated test suite `backend/src/tests/integration/tenantIsolation.test.ts` committed.
2. [x] Verified: 22/22 boundary tests passing cleanly with 0 cross-tenant leaks (covering reads, mutations, deletions, aggregation with `$geoNear`, safe-fail, query-option bypass, bulk inserts, and AuditLog isolation).
