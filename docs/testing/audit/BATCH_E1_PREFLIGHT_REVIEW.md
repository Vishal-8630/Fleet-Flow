# Fleet Flow — Batch E1 Preflight Review: Trial Duration & Provisioning Harmonization

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `PHASE-E1`  
**Target Canonical Issue:** [`FF-ISSUE-023`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md) — Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display  
**Approved Architectural Decision:** [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md) — Fleet Flow Pricing, Tiering, and Quota Matrix  
**Architectural Investigation Question:** [`QST-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-001-trial-duration-backend-provisioning.md) — Trial Duration Backend Provisioning Policy (7 Days vs 14 Days)  
**Execution Posture:** Technical Governance Specification & Architectural Plan  
**Baseline Git Commit:** `0197cf6` on branch `main`  
**Preflight Recommendation:** **`ACCEPT`**

---

## 1. Executive Summary

Phase E1 addresses the fundamental business and security inconsistency between the approved pricing governance ([`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)) and the active application codebase regarding trial duration and feature provisioning:

1. **Duration Discrepancy:** [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md) Section 2.1 strictly mandates a **7-day** free trial. In contrast, the active schema in [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts#L136) and registration controller [`backend/src/controllers/authController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/authController.ts#L164) provisioned a **14-day** trial (`Date.now() + 14 * 24 * 60 * 60 * 1000`).
2. **Tier Misallocation:** Registrations defaulted new workspaces to the `standard` tier rather than the intended `starter` tier.
3. **Marketing & UI Drift:** Public marketing pages ([`HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx), [`FeaturesPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/FeaturesPage.tsx), [`RefundPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/RefundPage.tsx)) and authentication views ([`LoginPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/LoginPage.tsx), [`RegisterPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/RegisterPage.tsx)) advertised "14-day free trial" and "no credit card required", creating severe commercial and legal ambiguity.
4. **Trial Expiration Security:** Expired trial tenants must be transitioned into a read-only state where write mutations are fail-closed with HTTP 403 `SUBSCRIPTION_INACTIVE`.

---

## 2. Issues, Decisions, and Canonical References

| Identifier | Category | Title | Relevance to Phase E1 |
| :--- | :--- | :--- | :--- |
| **[`FF-ISSUE-023`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)** | Subscriptions & Billing | Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display | Core defect addressed in Phase E1. |
| **[`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)** | Architectural Decision | Fleet Flow Pricing, Tiering, and Quota Matrix | Authoritative policy mandating 7-day trial on Starter tier. |
| **[`QST-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-001-trial-duration-backend-provisioning.md)** | Unresolved Question | Trial Duration Backend Provisioning Policy (7 Days vs 14 Days) | Investigation establishing active 14-day drift. |

---

## 3. Source Files Inspected

| File Path | Component / Layer | Relevant Symbols & Locations |
| :--- | :--- | :--- |
| [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts) | Model / Database Schema | `trial_ends_at` default value (Line 136). |
| [`backend/src/controllers/authController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/authController.ts) | Controller / Auth & Workspace Provisioning | `register` (Lines 160–180), `createWorkspace` (Lines 240–265). |
| [`backend/src/utils/entitlementService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/entitlementService.ts) | Service / Entitlement Logic | `getTenantEntitlements`, trial expiration calculation. |
| [`frontend/src/components/layout/Navbar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Navbar.tsx) | Frontend / Top Navigation | `calculateDaysRemaining` fallback calculation. |
| [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx) | Frontend / Marketing Home | Hero and pricing trial duration copy. |
| [`frontend/src/pages/marketing/FeaturesPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/FeaturesPage.tsx) | Frontend / Marketing Features | Trial duration badge and CTA copy. |
| [`frontend/src/pages/marketing/RefundPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/RefundPage.tsx) | Frontend / Marketing Legal | FAQ and trial policy terms. |
| [`frontend/src/pages/auth/RegisterPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/RegisterPage.tsx) | Frontend / Registration Form | Value proposition sidebar copy. |
| [`frontend/src/pages/auth/LoginPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/LoginPage.tsx) | Frontend / Login Form | Trial promotional banner copy. |

---

## 4. Current Behavior vs. Required Corrections

1. **Company Schema:**
   - *Previous:* Default `trial_ends_at` was `Date.now() + 14 * 24 * 60 * 60 * 1000`.
   - *Correction:* Update default `trial_ends_at` to `Date.now() + 7 * 24 * 60 * 60 * 1000`.
2. **Registration Controller:**
   - *Previous:* Explicitly calculated 14 days and assigned `plan: 'standard'`.
   - *Correction:* Explicitly compute 7 days (`7 * 24 * 60 * 60 * 1000`) and provision `plan: 'starter'`.
3. **Navbar Days Remaining:**
   - *Previous:* Fallback defaulted to 14 days if `trial_ends_at` was null.
   - *Correction:* Fallback defaults to 7 days.
4. **Marketing & UI Copy:**
   - *Previous:* Displayed "14-Day Free Trial" across 5 client pages.
   - *Correction:* Harmonize all text to "7-Day Free Trial" in lockstep with `DEC-001`.
5. **Fail-Closed Trial Expiration:**
   - Tenants whose trial has elapsed must be rejected on all write mutations with HTTP 403 `SUBSCRIPTION_INACTIVE`.

---

## 5. Architectural Invariants & Testing Strategy

- **Tenant Isolation:** Trial calculations must strictly use the authenticated company's `trial_ends_at`.
- **Zero Ambiguity:** Frontend marketing, authentication, and backend provisioning must be identical.
- **Automated Verification:** Create dedicated test suite `backend/src/tests/integration/phase5BatchE1TrialSecurity.test.ts` testing:
  - Default schema 7-day calculation.
  - Registration 7-day provisioning on `starter` plan.
  - Workspace creation 7-day provisioning.
  - Correct `days_remaining` reporting.
  - Trial expiration write lock (HTTP 403).
  - Active trial write permission (HTTP 200/201).

---

## 6. Preflight Recommendation

### Recommendation: **`ACCEPT`**
Phase E1 represents a direct, low-risk harmonization aligning active code with approved architectural decision [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md).
