# ISS-019: Missing Client-Side Idempotency Key Generation Exposing Financial Endpoints to Duplicate Execution

**Specification ID:** `ISS-019`  
**Title:** Missing Client-Side Idempotency Key Generation Exposing Financial Endpoints to Duplicate Execution Under Concurrent Submissions  
**Type:** Security / Financial Invariant Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Documents:** [`ISS-004`](./ISS-004-vendor-payout-ledger-reconciliation.md), [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
While the backend implements an idempotency interception middleware ([`backend/src/middleware/idempotencyMiddleware.ts`](../../backend/src/middleware/idempotencyMiddleware.ts)) on driver settlements, invoice payments, and general ledger postings, the middleware contains a fail-open flaw: if `x-idempotency-key` is missing, it immediately calls `next()`. A forensic search of the entire frontend codebase confirms that `idempotency` is referenced **zero times**. The frontend client never generates or transmits an idempotency key. Consequently, network retries, browser back-forward submissions, or rapid double-clicks on "Confirm Settlement", "Record Payment", or "Post Journal" execute duplicate financial mutations in the database.

---

## 2. Current Behavior & Root Cause
- **Confirmed Backend Code Pattern:** In [`idempotencyMiddleware.ts:31-34`](../../backend/src/middleware/idempotencyMiddleware.ts#L31-L34):
  ```typescript
  const rawKey = req.headers['x-idempotency-key'] || req.body?.idempotency_key;
  if (!rawKey || typeof rawKey !== 'string') {
    return next(); // Bypasses idempotency check completely!
  }
  ```
- **Confirmed Frontend Reality:** Grep for `idempotency` across `frontend/src` yields 0 matches.
- **Vulnerability Mechanism:**
  1. An accountant clicks "Confirm Driver Settlement" for ₹25,000.
  2. Due to high network latency, the accountant clicks the button a second time 400ms later.
  3. Because no `x-idempotency-key` is sent, the backend processes both HTTP requests independently.
  4. Two identical settlement records and two journal voucher entries are posted, paying the driver twice and corrupting cash balances.

---

## 3. Reproduction Steps
1. Navigate to `/settlements`.
2. Select a completed trip and click "Confirm Settlement".
3. Using an HTTP client (or simulated rapid double-click in browser), send two concurrent `POST /api/commercial/settlements/confirm` requests with identical payloads and NO `x-idempotency-key` header.
4. Inspect database: Two distinct settlement documents are created with identical trip data, and double payment is deducted.

---

## 4. Expected Behavior
1. The frontend Axios client interceptor ([`frontend/src/api/client.ts`](../../frontend/src/api/client.ts)) must automatically attach a unique `x-idempotency-key: uuidv4()` to all non-GET mutation requests, or form submission buttons must generate an idempotency token upon modal open.
2. The backend `idempotencyMiddleware.ts` must enforce a **fail-closed** policy for critical financial endpoints: if `x-idempotency-key` is missing on `/settlements/confirm`, `/invoices/:id/payments`, or `/ledger/parties/:id/payout`, the request must be rejected with HTTP 400 Bad Request (`Idempotency key required for financial transactions`).

---

## 5. Proposed Technical Solution
1. **Frontend Axios Interceptor:** In `frontend/src/api/client.ts`:
   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   api.interceptors.request.use((config) => {
     if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
       if (!config.headers['x-idempotency-key']) {
         config.headers['x-idempotency-key'] = uuidv4();
       }
     }
     return config;
   });
   ```
2. **Backend Strict Mode:** Update `idempotencyMiddleware.ts` to support strict enforcement on financial routes:
   ```typescript
   export const requireStrictIdempotency = async (req: Request, res: Response, next: NextFunction) => {
     const rawKey = req.headers['x-idempotency-key'] || req.body?.idempotency_key;
     if (!rawKey) {
       return res.status(400).json({ error: 'x-idempotency-key header is required for this financial mutation.' });
     }
     return requireIdempotency(req, res, next);
   };
   ```

---

## 6. Acceptance Criteria
- [ ] Concurrent or duplicated requests sharing the same `x-idempotency-key` return HTTP 200 with `X-Cache: IDEMPOTENT_HIT` without re-executing writes.
- [ ] Sending a settlement confirmation or invoice payment without `x-idempotency-key` returns HTTP 400.
- [ ] Frontend button double-clicks never create duplicate settlements or journal entries.

---

## 7. Definition of Done
1. Frontend request interceptor deployed and verified.
2. Backend strict idempotency enabled and verified in [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md).
