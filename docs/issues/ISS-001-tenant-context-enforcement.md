# ISS-001: Tenant Context Resolution Middleware Bypass in Express Routes

**Specification ID:** `ISS-001`  
**Title:** Tenant Context Resolution Middleware Bypass in Express Routes  
**Type:** Security / Architecture Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-01.md`](./ISSUE-01.md) and [`docs/issues/ISSUE-14.md`](./ISSUE-14.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
Five major Express route definition files ([`branchRoutes.ts`](../../backend/src/routes/branchRoutes.ts), [`approvalRoutes.ts`](../../backend/src/routes/approvalRoutes.ts), [`commercialReportRoutes.ts`](../../backend/src/routes/commercialReportRoutes.ts), [`supportRoutes.ts`](../../backend/src/routes/supportRoutes.ts), and [`trackingRoutes.ts`](../../backend/src/routes/trackingRoutes.ts)) mount user authentication (`authenticate`) but completely omit the mandatory tenant resolution middleware (`resolveTenantContext`). Consequently, `req.tenant`, `req.company`, and Node.js `AsyncLocalStorage` tenant context remain `undefined`. This triggers false 403 Forbidden errors or runs database queries where `company_id` is `undefined`, causing severe multi-tenant data leaks and endpoint breakdowns.

---

## 2. Current Behavior
When an authenticated HTTP request hits any endpoint in the affected routes:
1. `authenticate` verifies the JWT and attaches `req.user`.
2. `resolveTenantContext` is **never invoked**.
3. `AsyncLocalStorage` (`tenantStorage.run()`) is never initialized for the execution stack of that request.
4. Downstream middleware such as `requireRole(['admin'])` attempts to access `req.member.role`. Since `req.member` is populated only by `resolveTenantContext`, it evaluates to `undefined`, rejecting legitimate tenant admins with HTTP 403 Forbidden.
5. In controllers where fallback logic queries `req.company?._id` or `req.user?.company_id`, if the user belongs to multiple tenants or if `req.user.company_id` is missing, the query executes with `{ company_id: undefined }`. In MongoDB, this matches documents where `company_id` is absent or null, leaking un-isolated global records.

---

## 3. Root Cause Analysis
- **Confirmed Fact:** In [`branchRoutes.ts`](../../backend/src/routes/branchRoutes.ts#L10), the router initializes:
  ```typescript
  router.use(authenticate);
  // resolveTenantContext is completely omitted!
  ```
- **Confirmed Fact:** In [`approvalRoutes.ts`](../../backend/src/routes/approvalRoutes.ts#L10), [`commercialReportRoutes.ts`](../../backend/src/routes/commercialReportRoutes.ts#L10), and [`supportRoutes.ts`](../../backend/src/routes/supportRoutes.ts#L10), the identical pattern occurs: `authenticate` is mounted as top-level middleware, but `resolveTenantContext` is omitted.
- **Confirmed Fact:** In [`trackingRoutes.ts`](../../backend/src/routes/trackingRoutes.ts#L25), `/live/fleet` and `/ping` do not mount `resolveTenantContext`.
- **Reason for Prior Miss:** Standalone verification scripts (`verify_system_fixes.ts`) tested Mongoose models directly without invoking Express HTTP routing.

---

## 4. Reproduction Steps
1. Authenticate as a valid tenant admin user (`POST /api/auth/login`) and obtain a Bearer JWT.
2. Send `GET /api/branches` with `Authorization: Bearer <token>`.
3. Observe response: HTTP 403 Forbidden (`Access denied: Insufficient permissions`) or HTTP 500 (`Cannot read properties of undefined (reading 'role')`).
4. Repeat for `GET /api/commercial/aging` or `GET /api/approvals`. Observe identical failure.

---

## 5. Expected Behavior
Every tenant-scoped Express route must execute `resolveTenantContext` immediately following `authenticate`. The middleware must:
1. Extract tenant identity from JWT, `X-Company-ID` header, or tenant subdomain.
2. Verify active membership of the user in that company.
3. Populate `req.tenant`, `req.company`, and `req.member`.
4. Wrap request handling within `tenantStorage.run(tenantId, next)`.

---

## 6. Business, Security & User Impact
- **Security Impact:** Cross-tenant query execution when `company_id` evaluates to `undefined`.
- **User Impact:** Legitimate company admins cannot manage branches, approve advances, or view aging reports.
- **Business Impact:** Complete operational failure for multi-branch transport enterprises.

---

## 7. Proposed Technical Solution
Update each affected route file to import and mount `resolveTenantContext`:
```typescript
import { authenticate } from '../middleware/authMiddleware';
import { resolveTenantContext } from '../middleware/tenantMiddleware';

router.use(authenticate);
router.use(resolveTenantContext);
```
Ensure route files mount this at router level before individual endpoint handlers:
- [`backend/src/routes/branchRoutes.ts`](../../backend/src/routes/branchRoutes.ts)
- [`backend/src/routes/approvalRoutes.ts`](../../backend/src/routes/approvalRoutes.ts)
- [`backend/src/routes/commercialReportRoutes.ts`](../../backend/src/routes/commercialReportRoutes.ts)
- [`backend/src/routes/supportRoutes.ts`](../../backend/src/routes/supportRoutes.ts)
- [`backend/src/routes/trackingRoutes.ts`](../../backend/src/routes/trackingRoutes.ts) (for all authenticated telematics endpoints)

---

## 8. Affected Components
- **Backend Routes:** `branchRoutes.ts`, `approvalRoutes.ts`, `commercialReportRoutes.ts`, `supportRoutes.ts`, `trackingRoutes.ts`.
- **Backend Middleware:** `tenantMiddleware.ts`, `roleMiddleware.ts`.
- **Frontend Impact:** Unblocks `BranchesPage.tsx`, `ApprovalsPage.tsx`, `AgingReportPage.tsx`, `LiveTrackingPage.tsx`.

---

## 9. API / Schema / Migration Implications
- **API Signature:** No breaking changes. Expected HTTP headers (`Authorization: Bearer <token>`, optional `X-Company-ID`) remain standard.
- **Database Migrations:** None.

---

## 10. Dependencies & Related Documents
- Related Issue: [`ISS-002`](./ISS-002-tenant-plugin-interception.md) (Mongoose plugin interception).
- Related Test Suite: [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md) and [`TEST-002`](../testing/TEST-002-cross-tenant-isolation-suite.md).

---

## 11. Acceptance Criteria
- [ ] `GET /api/branches` returns HTTP 200 with tenant-scoped branches for an authenticated tenant admin.
- [ ] `GET /api/commercial/aging` returns HTTP 200 with tenant-scoped receivables.
- [ ] `GET /api/approvals` returns HTTP 200 with tenant-scoped approval requests.
- [ ] Any request without a valid tenant association returns HTTP 400 or 401 with descriptive error.
- [ ] `AsyncLocalStorage.getStore()` returns the active `company_id` inside all downstream controller handlers.

---

## 12. Testing Plan
- **Integration Test:** Supertest suite calling `GET /api/branches` with valid tenant admin tokens for Tenant A and Tenant B, verifying that Tenant A never receives Tenant B's branches.
- **Security Test:** Request with a forged or mismatched `X-Company-ID` header must return HTTP 403 Forbidden.

---

## 13. Definition of Done
1. Code changes applied and verified across all 5 route files.
2. Automated HTTP integration test passing in CI.
3. No regressions in authentication or RBAC middleware.
