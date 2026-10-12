# TEST-001: Automated HTTP Integration Test Suite with Vitest & Supertest

**Test Specification ID:** `TEST-001`  
**Title:** Automated HTTP Integration Test Suite with Vitest & Supertest Across Express Routes  
**Scope:** Express Routing, Middleware Chains & HTTP API Contracts  
**Priority:** `P0` (Essential Quality Gate)  
**Status:** Verified (Operational in Batch 1)  
**Target Coverage:** Express API Route Chains  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
Historical maintenance scripts in `backend/src/scripts/` (e.g. `verify_system_fixes.ts`) tested Mongoose models directly in isolation. Because they bypassed the Express HTTP pipeline, they completely failed to catch missing middleware (`resolveTenantContext`), incorrect route mounts, and HTTP 403 authorization failures. The repository previously lacked an automated `npm test` script.

---

## 2. Test Architecture & Framework
1. **Runner & Assertion Engine:** **Vitest** (fast, native TypeScript, Jest-compatible syntax).
2. **HTTP Driver:** **Supertest** (dispatches real in-memory HTTP requests against `app.ts`).
3. **Database Sandbox:** `mongodb-memory-server` (ephemeral, isolated in-memory MongoDB replica set instantiated per test run in `backend/src/tests/setup.ts`).
4. **Execution Strategy:**
   - Run via `npm test` (`vitest run`).
   - Run tests sequentially across clean collections with teardown hooks.

---

## 3. Test Suites Implemented in Batch 1
1. `src/tests/setup.ts`: In-memory Mongo server setup, teardown, and database cleanup.
2. `src/tests/helpers.ts`: Tenant fixture generator (`createTestTenant`, `createSuperAdmin`, JWT generation).
3. `src/tests/smoke.test.ts`: Test infrastructure health check.
4. `src/tests/integration/tenantRoutes.test.ts`: 13 integration tests covering branch, approval, commercial report, support, and telematics routes verifying tenant context resolution, RBAC, and error responses.
5. `src/tests/integration/tenantIsolation.test.ts`: 12 integration tests verifying cross-tenant read/write/delete isolation and aggregation pipeline protection.
6. `src/tests/integration/fileStorageSecurity.test.ts`: 12 integration tests verifying magic byte MIME validation and path traversal defenses.

---

## 4. Acceptance Criteria
- [x] Running `npm test` executes the complete suite in under 60 seconds (Batch 1 suite runs in ~10 seconds).
- [x] Any route missing `resolveTenantContext` or returning unexpected 403/500 fails the test build.
- [x] Clean test lifecycle management with automatic database teardown between runs.

---

## 5. Definition of Done & Verification Evidence
1. [x] Vitest (`vitest.config.ts`), Supertest, and `mongodb-memory-server` configured and committed.
2. [x] `backend/package.json` updated with `"test": "vitest run"` and `"test:watch": "vitest"`.
3. [x] Verified: `npm test` passes 38/38 tests across 4 test suites with 0 failures.
