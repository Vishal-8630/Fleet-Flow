# TEST-001: Automated HTTP Integration Test Suite with Vitest & Supertest

**Test Specification ID:** `TEST-001`  
**Title:** Automated HTTP Integration Test Suite with Vitest & Supertest Across Express Routes  
**Scope:** Express Routing, Middleware Chains & HTTP API Contracts  
**Priority:** `P0` (Essential Quality Gate)  
**Target Coverage:** 100% of Express Endpoints  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
Historical maintenance scripts in `backend/src/scripts/` (e.g. `verify_system_fixes.ts`) tested Mongoose models directly in isolation. Because they bypassed the Express HTTP pipeline, they completely failed to catch missing middleware (`resolveTenantContext`), incorrect route mounts, and HTTP 403 authorization failures. The repository currently lacks an automated `npm test` script.

---

## 2. Test Architecture & Framework
1. **Runner & Assertion Engine:** **Vitest** (fast, native TypeScript, Jest-compatible syntax).
2. **HTTP Driver:** **Supertest** (dispatches real in-memory HTTP requests against `app.ts`).
3. **Database Sandbox:** `mongodb-memory-server` (ephemeral, isolated in-memory MongoDB replica set instantiated per test suite).
4. **Execution Strategy:**
   - Run on every git push and PR via GitHub Actions CI pipeline.
   - Run tests sequentially across clean collections with teardown hooks.

---

## 3. Test Suites to Implement
1. `tests/integration/auth.test.ts`: Signup, Login, Token Refresh, Password Reset.
2. `tests/integration/tenant_scoping.test.ts`: Verify `resolveTenantContext` and RBAC across all 23 route files.
3. `tests/integration/fleet.test.ts`: Truck CRUD, Driver CRUD, Document renewals.
4. `tests/integration/operations.test.ts`: Entry booking, LR generation, Journey dispatch.
5. `tests/integration/commercial.test.ts`: Invoicing, Credit notes, AR aging, Profitability.
6. `tests/integration/portals.test.ts`: Customer OTP, Vendor OTP, Public tracking.

---

## 4. Acceptance Criteria
- [ ] Running `npm test` executes the complete suite in under 60 seconds.
- [ ] Any route missing `resolveTenantContext` or returning unexpected 403/500 fails the test build.
- [ ] Code coverage reports generate automatically with thresholds enforced (>80% statement coverage).

---

## 5. Definition of Done
1. Vitest and Supertest configuration files committed.
2. Automated CI test pipeline configured and passing.
