# OPS-004: Structured JSON Telemetry, Correlated Logging & Sentry APM

**Operational Requirement ID:** `OPS-004`  
**Title:** Structured JSON Telemetry, Correlated Logging and Sentry APM Integration  
**Category:** Observability, Telemetry & Monitoring  
**Priority:** `P2` (Moderate Operational Requirement)  
**Implementation Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#5-operations--production-register-ops-)

---

## 1. Operational Problem Statement
Currently, logging in [`backend/src/utils/storageService.ts`](../../backend/src/utils/storageService.ts) outputs basic strings to local files (`combined.log`, `error.log`) and standard console. Log entries do not include a correlated `requestId`, `tenantId`, or `userId`. When investigating an error reported by a customer, operators cannot isolate the log trail belonging to that specific request. Furthermore, there is no centralized error tracking (e.g. Sentry) or Application Performance Monitoring (APM), so runtime exceptions in production remain completely silent until reported by angry users.

---

## 2. Telemetry Architecture & Implementation
1. **Request Tracing Middleware:**
   - Attach a unique `requestId` (UUIDv4) to every incoming request.
   - Inject `requestId` and active `tenantId` into Winston child logger contexts.
2. **Log Format:**
   - Standardize on structured JSON logging:
     ```json
     {
       "timestamp": "2026-10-12T14:30:00.000Z",
       "level": "error",
       "message": "Payment signature mismatch",
       "requestId": "c8a149a0-97c7-4f5d-9b16-56f8f17eb231",
       "tenantId": "66f123456789abcdef123456",
       "route": "POST /api/billing/verify",
       "statusCode": 400,
       "stack": "..."
     }
     ```
3. **Log Rotation:**
   - Configure `winston-daily-rotate-file` (max size 20MB, max retention 14 days) to prevent disk space exhaustion.
4. **Error Tracking & APM:**
   - Integrate `@sentry/node` in backend and `@sentry/react` in frontend.
   - Capture unhandled exceptions with full stack traces, release tags, and tenant context.

---

## 3. Acceptance Criteria
- [ ] Every API log entry contains `requestId` and `tenantId`.
- [ ] Unhandled backend exceptions trigger real-time alerts in Sentry with contextual metadata.
- [ ] Local log files rotate daily and are automatically purged after 14 days.

---

## 4. Definition of Done
1. Correlated logger and Sentry integration implemented.
2. Verified in staging environment.
