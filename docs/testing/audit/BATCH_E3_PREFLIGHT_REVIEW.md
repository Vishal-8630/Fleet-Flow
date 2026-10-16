# Fleet Flow — Batch E3 Preflight Review: Payment Idempotency & Payment-Window Error Handling

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `PHASE-E3`  
**Target Canonical Issues:**  
- [`FF-ISSUE-026`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md) — Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header  
- [`FF-ISSUE-027`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md) — Subscription Plan-Change Fails with Payment Window Closed Rejection  
**Architectural Investigation Question:** [`QST-007`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-007-plan-change-idempotency-and-payment-window.md) — Subscription Plan-Change Missing Idempotency Key & Payment Window Status  
**Execution Posture:** Technical Governance Specification & Architectural Plan  
**Baseline Git Commit:** `0197cf6` on branch `main`  
**Preflight Recommendation:** **`ACCEPT`**

---

## 1. Executive Summary

Phase E3 addresses critical financial mutation vulnerabilities and client-side error masking during subscription plan upgrades and renewals:

1. **Missing Idempotency Key Header (`FF-ISSUE-026`):** The backend billing routes enforce strict financial idempotency via [`requireStrictIdempotency`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/idempotencyMiddleware.ts#L325). However, [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx#L19) performed payment checkout and verification using direct, raw `axios.post` calls rather than the application's configured API client [`api`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/api/client.ts). As a result, the request completely bypassed the interceptor that injects the required `x-idempotency-key` header, triggering HTTP 400 rejections from the server.
2. **False "Payment Window Closed" Rejections (`FF-ISSUE-027`):** Because of an overly broad `try/catch` block wrapping the Razorpay checkout callback in `BillingPage.tsx`, any downstream HTTP error (including the HTTP 400 missing idempotency key rejection) was caught and erroneously reported to the user as `"Payment window closed. Your plan has not been changed."`, even when the Razorpay payment window had completed successfully.
3. **Double-Debit and Replay Vulnerability:** Without client-generated idempotency keys and server-side atomic checks, repeated network submissions during checkout or payment verification risked creating duplicate transaction records or race conditions.

---

## 2. Issues, Decisions, and Canonical References

| Identifier | Category | Title | Relevance to Phase E3 |
| :--- | :--- | :--- | :--- |
| **[`FF-ISSUE-026`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md)** | Bug / Financial | Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header | Core defect addressed in Phase E3. |
| **[`FF-ISSUE-027`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md)** | Bug / Financial | Subscription Plan-Change Fails with Payment Window Closed Rejection | Core UX/error-handling defect addressed in Phase E3. |
| **[`QST-007`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-007-plan-change-idempotency-and-payment-window.md)** | Unresolved Question | Subscription Plan-Change Missing Idempotency Key & Payment Window Status | Forensic analysis of raw `axios` usage in `BillingPage.tsx`. |

---

## 3. Source Files Inspected

| File Path | Component / Layer | Relevant Symbols & Locations |
| :--- | :--- | :--- |
| [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx) | Frontend / View | Raw `axios` import (Line 19), checkout invocation (Lines 150–220). |
| [`frontend/src/api/client.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/api/client.ts) | Frontend / HTTP Client | Request interceptor, idempotency key generation & headers. |
| [`frontend/src/utils/paymentErrorHandler.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/utils/paymentErrorHandler.ts) | Frontend / Utility | Payment error normalization and modal dismissal differentiation. |
| [`backend/src/routes/billingRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/billingRoutes.ts) | Backend / Route Definition | `requireStrictIdempotency` middleware binding on `/verify-payment`. |
| [`backend/src/middleware/idempotencyMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/idempotencyMiddleware.ts) | Backend / Middleware | `requireStrictIdempotency` implementation and cache lookup. |
| [`backend/src/controllers/billingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts) | Backend / Controller | `initializeCheckout`, `verifyPayment`, `changePlan`. |

---

## 4. Current Behavior vs. Required Corrections

1. **Client Migration in `BillingPage.tsx`:**
   - *Previous:* `import axios from 'axios'`; manual headers and unintercepted calls.
   - *Correction:* Migrate entirely to `import api from '../../api/client'`. All billing actions (`/calculate-change`, `/checkout`, `/verify-payment`, `/change-plan`, `/apply-scheduled`, `/cancel-scheduled`, `/toggle-addon`) use `api.get` and `api.post`.
2. **Automatic Idempotency Key Management (`client.ts`):**
   - Ensure the request interceptor detects mutation endpoints (`/checkout`, `/verify-payment`, `/change-plan`) and automatically generates and injects a cryptographically strong UUIDv4 `x-idempotency-key` header if not explicitly supplied.
3. **Accurate Error Differentiation (`paymentErrorHandler.ts`):**
   - Separate Razorpay window modal dismissals (`modal.ondismiss`) from HTTP response errors returned during payment verification.
   - True modal dismissals surface: `"Payment window was closed before completion."`
   - Server or network verification failures surface the specific backend error message (e.g. invalid signature, expired order, or payment declined).
4. **Backend Idempotency Verification:**
   - Guarantee that repeated requests with the identical `x-idempotency-key` replay the stored HTTP response from MongoDB without re-charging or creating duplicate invoice entries.

---

## 5. Architectural Invariants & Testing Strategy

- **Financial Safety:** No financial mutation may execute without an authenticated tenant context and a validated `x-idempotency-key`.
- **Tenant Isolation:** Payment verification queries must always match `order_id` AND `company_id: req.company._id`.
- **Automated Verification:** Create dedicated test suite `backend/src/tests/integration/phase5BatchE3PaymentIdempotency.test.ts` testing:
  - Missing `x-idempotency-key` rejected with HTTP 400.
  - Valid `x-idempotency-key` accepted and processed.
  - Replay of identical `x-idempotency-key` returns cached result without duplicate processing.
  - Concurrent requests with identical key handled safely without duplicate records.
  - Mismatched tenant order verification rejected with HTTP 404/403.

---

## 6. Preflight Recommendation

### Recommendation: **`ACCEPT`**
Phase E3 eliminates a high-severity customer billing blocker, protects payment flows against double-debits, and restores transparent error reporting during checkout.
