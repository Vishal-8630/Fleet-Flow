# TEST-002: Cross-Tenant Data Isolation & Mutation Boundary Test Suite

**Test Specification ID:** `TEST-002`  
**Title:** Cross-Tenant Data Isolation and Mutation Boundary Test Suite  
**Scope:** Multi-Tenancy, Mongoose Tenant Plugin & Route Scoping  
**Priority:** `P0` (Critical Security Gate)  
**Target Coverage:** Complete Cross-Tenant Boundary Verification  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
The highest risk in a shared-database multi-tenant SaaS is accidental cross-tenant data leakage or cross-tenant document modification. We must systematically prove that User A (belonging to Tenant A) can never view, mutate, or delete records belonging to Tenant B, even if User A explicitly guesses or provides Tenant B's document IDs.

---

## 2. Test Matrix & Boundary Scenarios
1. **Scenario 1 (Read Isolation):**
   - Seed Truck 1 for Tenant A (`id: truck_a`).
   - Authenticate as Tenant B.
   - Send `GET /api/trucks/truck_a`.
   - Assert: Returns HTTP 404 Not Found (or 403 Forbidden). Must NOT return Truck 1.
2. **Scenario 2 (Update Mutation Isolation):**
   - Authenticate as Tenant B.
   - Send `PUT /api/trucks/truck_a` with `{ truck_no: 'MUTATED' }`.
   - Assert: Returns HTTP 404. Database inspection confirms Truck 1 is unmodified.
3. **Scenario 3 (Delete Mutation Isolation):**
   - Authenticate as Tenant B.
   - Send `DELETE /api/trucks/truck_a`.
   - Assert: Returns HTTP 404. Truck 1 remains in the database.
4. **Scenario 4 (Aggregation Isolation):**
   - Seed 5 LRs in Tenant A and 10 LRs in Tenant B.
   - Query metrics endpoint as Tenant A.
   - Assert: Total count strictly equals 5, never 15.
5. **Scenario 5 (Public Tracking IDOR):**
   - Query public tracking endpoint with an LR number shared across tenants.
   - Assert: Strict scoping requires company disambiguation token; returns only the authorized shipment without PII leaks.

---

## 3. Acceptance Criteria
- [ ] 100% of cross-tenant access attempts are rejected with 404 or 403.
- [ ] No un-scoped queries or aggregations execute across tenant boundaries.

---

## 4. Definition of Done
1. Dedicated test suite `tests/security/tenant_isolation.test.ts` committed and passing in CI.
