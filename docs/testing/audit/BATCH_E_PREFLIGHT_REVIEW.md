# Fleet Flow — Batch E Preflight Review: Subscription Entitlements, Idempotency & Billing Flow

**Document Type:** Technical Governance Pre-Implementation Review  
**Batch Identifier:** `BATCH-E`  
**Target Architecture:** SaaS Subscriptions, Plan Entitlements, Trial Lifecycle, Financial Idempotency, Razorpay Integration, GST-Inclusive Billing, Module Configuration  
**Execution Posture:** **STRICTLY READ-ONLY REVIEW & DOCUMENTATION ONLY. No code modifications, migrations, or database changes authorized.**  
**Date:** 16 October 2026  
**Auditor / Governance Authority:** Antigravity Advanced Agentic AI (Pair-Programming Preflight Inspection)  
**Baseline Git Commit:** `0197cf6` (`docs(testing): mark resolved issues and implemented decisions in registers and issue files`) on branch `main`  
**Baseline Test Status:** Automated backend suite passes 100% (21/21 test suites, 313/313 tests passing). Production builds for backend (`tsc`) and frontend (`vite build`) succeed with zero errors.  
**Implementation Status:** **PROPOSED — PENDING PRODUCT OWNER APPROVAL**

---

## 1. Executive Summary

Following the completion and verification of prior batches, the authoritative canonical roadmap defined in [`ISSUE_INDEX.md`](../ISSUE_INDEX.md) (lines 244–248) establishes **Batch E: Subscription Entitlements, Idempotency & Billing Flow** as the next mandatory engineering scope. 

This preflight audit presents a forensic investigation of the codebase, schemas, client-side state machines, and billing integrations covering all 11 canonical Batch E items:
- **Canonical Issues:** `FF-ISSUE-002`, `FF-ISSUE-012`, `FF-ISSUE-023`, `FF-ISSUE-024`, `FF-ISSUE-025`, `FF-ISSUE-026`, `FF-ISSUE-027`.
- **Approved Architectural Decision:** `DEC-001` (Pricing, Tiering, and Quota Matrix).
- **Architectural Investigation Questions:** `QST-001`, `QST-002`, `QST-007`.

### Key Audit Findings
1. **Trial Provisioning Policy Defect (`FF-ISSUE-023`, `QST-001`, `DEC-001`):** Active code directly violates approved decision [`DEC-001`](../decisions/DEC-001-pricing-quota-matrix.md). Newly registered companies are provisioned with **14-day** trials rather than **7-day** trials in [`Company.ts`](../../backend/src/models/Company.ts#L136) and [`authController.ts`](../../backend/src/controllers/authController.ts#L164), and are mistakenly assigned the `standard` plan instead of the `starter` tier feature set. Furthermore, public marketing pages, registration screens, and the in-app navigation bar advertise and display 14 days, contradicting the 7-day policy stated in `DEC-001` and the Pricing FAQ.
2. **Missing Frontend Route Guards & Sidebar Lock Bypass (`FF-ISSUE-025`, `QST-002`):** While backend endpoints for Maintenance (`/api/maintenance/*`) and Tyres enforce `requireFeature('MOD_MAINTENANCE')` with HTTP 403 `FEATURE_LOCKED`, the frontend [`App.tsx`](../../frontend/src/App.tsx#L213-L214) routes `/fleet/maintenance` and `/fleet/tyres` directly to full operational components without any `<FeatureGate>` wrapper. Moreover, [`Sidebar.tsx`](../../frontend/src/components/layout/Sidebar.tsx#L166-L181) renders clickable `<NavLink>` elements even when a feature is locked, allowing users to enter locked pages and receive unhandled raw API error toasts instead of an upgrade paywall CTA.
3. **Idempotency Key Header Omission on Plan Changes (`FF-ISSUE-026`, `FF-ISSUE-027`, `QST-007`):** The frontend [`BillingPage.tsx`](../../frontend/src/pages/settings/BillingPage.tsx#L19) imports and executes raw `axios.post` rather than using the centralized API client [`api`](../../frontend/src/api/client.ts). Raw `axios` completely bypasses the request interceptor that auto-generates `x-idempotency-key`. When calling `/api/billing/verify-payment`, the backend [`requireStrictIdempotency`](../../backend/src/middleware/idempotencyMiddleware.ts#L325) middleware rejects the request with HTTP 400 (`x-idempotency-key header is required for this financial mutation`), which in turn trips the frontend dismissal catch handler to display `Payment window closed. Your plan has not been changed.`.
4. **GST Calculation Inconsistency vs. DEC-001 Pricing:** In [`billingController.ts`](../../backend/src/controllers/billingController.ts#L218-L220), `initializeCheckout` treats headline prices (e.g. ₹1,999/mo) as pre-tax base prices and adds 18% GST (9% CGST + 9% SGST) on top, charging ₹2,358.82 for Starter and ₹4,718.82 for Standard. However, `DEC-001` Section 2.2 and [`billingSeedService.ts`](../../backend/src/utils/billingSeedService.ts#L21) explicitly mandate that headline prices are **GST-inclusive**.
5. **Trial Plan Switch Security Vulnerability:** In [`billingController.ts`](../../backend/src/controllers/billingController.ts#L491), any tenant in `trialing` status can call `/api/billing/change-plan` to switch to the `pro` tier immediately for free without paying, bypassing all payment checks.
6. **Workspace Module Access Configuration Gap (`FF-ISSUE-024`):** The `Company.settings` schema lacks an `enabled_modules` field, and no UI or backend endpoint exists to allow workspace administrators to toggle active operational modules within their subscribed tier.
7. **Scope Mismatch Analysis (`FF-ISSUE-002`, `FF-ISSUE-012`):** Historical early drafting notes conflated issue IDs (e.g. referencing `FF-ISSUE-002` as trial duration and `FF-ISSUE-012` as PRO lock bypass in early registers). In the canonical registry, `FF-ISSUE-002` is the Unwanted Fleet ROI Calculator on `HomePage.tsx` (a public UI-UX item) and `FF-ISSUE-012` is the Toast Z-Index and Dismissal defect (a global component item). Both were placed in Batch E in `ISSUE_INDEX.md`. This preflight flags the scope mismatch and provides an execution strategy to resolve both alongside the billing flow.

---

## 2. Authoritative Batch E Scope and Exclusions

### 2.1 Authoritative Item Inventory

| Identifier | Category | Title | Severity | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **[FF-ISSUE-002](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/ui-ux/FF-ISSUE-002-unwanted-fleet-roi-calculator.md)** | UI-UX / Public | Unwanted Public Fleet ROI Calculator Component | Low | Confirmed Defect in `HomePage.tsx` |
| **[FF-ISSUE-012](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/ui-ux/FF-ISSUE-012-toast-zindex-and-dismissal.md)** | UI-UX / Components | Validation Error Toast Renders Behind Active Modal and Auto-Dismisses Too Rapidly | High | Confirmed Defect (`toasts.css` vs `modals.css`) |
| **[FF-ISSUE-023](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md)** | Subscriptions & Billing | Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display | High | Confirmed Defect (`Company.ts`, `authController.ts`) |
| **[FF-ISSUE-024](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md)** | Subscriptions & Billing | Company Workspace Module Access Configuration Control Missing | Medium | Design Gap (Missing `enabled_modules` schema & UI) |
| **[FF-ISSUE-025](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md)** | Security / Subscriptions | PRO-Locked Modules Remain Accessible Despite UI Lock Badges | High | Confirmed Defect (`App.tsx`, `Sidebar.tsx`) |
| **[FF-ISSUE-026](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md)** | Bug / Financial | Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header | High | Confirmed Defect (`BillingPage.tsx` uses raw `axios`) |
| **[FF-ISSUE-027](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md)** | Bug / Financial | Subscription Plan-Change Fails with Payment Window Closed Rejection | High | Confirmed Defect (`BillingPage.tsx` catch handler) |
| **[DEC-001](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)** | Architectural Decision | Fleet Flow Pricing, Tiering, and Quota Matrix | Approved Policy | Active Code Drift Identified |
| **[QST-001](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-001-trial-duration-backend-provisioning.md)** | Unresolved Question | Trial Duration Backend Provisioning Policy (7 Days vs 14 Days) | High | Forensic Audit Complete (Answer: 14 Days Active) |
| **[QST-002](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md)** | Unresolved Question | Pro Module Feature Lock Backend API Enforcement Status | High | Forensic Audit Complete (Backend Protected, Frontend Open) |
| **[QST-007](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-007-plan-change-idempotency-and-payment-window.md)** | Unresolved Question | Subscription Plan-Change Missing Idempotency Key & Payment Window Status | High | Forensic Audit Complete (Raw Axios Bypasses Interceptor) |

### 2.2 Scope Mismatch and Historical Conflation Analysis

During audit cross-referencing between historical testing notes and canonical registers, two prominent scope discrepancies were uncovered:

1. **Inclusion of `FF-ISSUE-002` in Subscription Batch:**
   - In early manual testing handoff notes ([`DEC-001`](../decisions/DEC-001-pricing-quota-matrix.md#L10)), the trial duration inconsistency was informally referred to as `FF-ISSUE-002`.
   - When canonical issue files were generated, the trial duration defect was cataloged as [`FF-ISSUE-023`](../issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md), while `FF-ISSUE-002` was assigned to [`FF-ISSUE-002-unwanted-fleet-roi-calculator.md`](../issues/ui-ux/FF-ISSUE-002-unwanted-fleet-roi-calculator.md).
   - In [`ISSUE_INDEX.md`](../ISSUE_INDEX.md#L245), `FF-ISSUE-002` was retained inside Batch E. While the Fleet ROI Calculator is a public marketing component rather than a billing controller, removing it from `HomePage.tsx` eliminates misleading mathematical savings calculations before marketing and pricing pages are harmonized under `DEC-001`.
   - **Recommendation:** Retain `FF-ISSUE-002` in Batch E under a dedicated cleanup phase (Phase E6) rather than silently dropping it.

2. **Historical Conflation of `FF-ISSUE-012`:**
   - Early notes in [`QST-002`](../issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md#L11) referenced `FF-ISSUE-012` as "pro-badge-module-lock-bypass".
   - The canonical issue registry assigned `FF-ISSUE-012` to [`FF-ISSUE-012-toast-zindex-and-dismissal.md`](../issues/ui-ux/FF-ISSUE-012-toast-zindex-and-dismissal.md), while the Pro module lock bypass was assigned to [`FF-ISSUE-025`](../issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md).
   - Toast z-index stacking is directly coupled to billing workflows: when payment or validation fails inside the Billing checkout modal, error toasts render behind the modal backdrop (`z-index: 1000` vs `z-index: 1100`). Resolving `FF-ISSUE-012` in Batch E directly unblocks billing failure visibility.

### 2.3 Explicit Out-of-Scope Exclusions for Batch E
- **Batch D Scope:** Invoicing, balance party ledgers, and credit limits (`FF-ISSUE-020`, `FF-ISSUE-021`, `FF-ISSUE-022`, `DEC-002`, `DEC-003`).
- **Batch F Scope:** Platform superadmin and support inbox (`FF-ISSUE-040`, `FF-ISSUE-042`, `DEC-006`, `QST-003`, `QST-004`).
- **Live Payment Gateway Transactions:** No live credit cards, bank accounts, or real monetary charges will be triggered. All tests and verifications utilize sandbox/mock Razorpay credentials and existing cryptographic simulators.

---

## 3. Current Implementation Map

| Scope Item | Current Status | Codebase File Location | Forensic Assessment |
| :--- | :--- | :--- | :--- |
| **`FF-ISSUE-002`** | Confirmed Defect | [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx#L205-L254) | Interactive ROI Calculator component is active, calculating speculative savings from truck sliders. |
| **`FF-ISSUE-012`** | Confirmed Defect | [`frontend/src/styles/components/toasts.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/toasts.css#L12), [`frontend/src/styles/components/modals.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/modals.css#L16), [`frontend/src/stores/uiStore.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/stores/uiStore.ts#L67) | `.toast-container` has `z-index: 1000`, while `.modal-backdrop` has `z-index: 1100`. Toasts render behind modals; auto-dismiss lacks hover pause. |
| **`FF-ISSUE-023`** | Confirmed Defect | [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts#L136), [`backend/src/controllers/authController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/authController.ts#L164-L198), [`frontend/src/components/layout/Navbar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Navbar.tsx#L57) | Backend defaults and controller hardcode +14 days and provision `standard` plan. Frontend banner and copy state 14 days. |
| **`FF-ISSUE-024`** | Unimplemented Design Gap | [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts#L86-L119), [`frontend/src/pages/settings/CompanySettingsPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/CompanySettingsPage.tsx) | `Company.settings` lacks `enabled_modules`; no API endpoint or UI exists to toggle active company modules. |
| **`FF-ISSUE-025`** | Confirmed Defect | [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx#L213-L214), [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx#L166-L181) | Backend routes have `requireFeature('MOD_MAINTENANCE')`, but frontend routes lack guards and sidebar allows clicking locked links. |
| **`FF-ISSUE-026`** | Confirmed Defect | [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx#L19-L246), [`backend/src/middleware/idempotencyMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/idempotencyMiddleware.ts#L325) | `BillingPage.tsx` uses raw `axios.post`, omitting `x-idempotency-key`. Backend rejects `/api/billing/verify-payment` with HTTP 400. |
| **`FF-ISSUE-027`** | Confirmed Defect | [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx#L212-L241) | Premature execution of dismissal catch handler displays `Payment window closed` whenever modal closes or verification errors. |
| **`DEC-001`** | Policy Drift | [`backend/src/controllers/billingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts#L218-L220) | `initializeCheckout` adds 18% GST on top of headline price, violating GST-inclusive pricing rule. |
| **`QST-001`** | Resolved Investigation | Database defaults, controllers, and tests audited | Backend currently provisions 14 days and Standard plan; discrepancy is active in database records, not just frontend copy. |
| **`QST-002`** | Resolved Investigation | Route files audited: `maintenanceRoutes.ts`, `entitlementMiddleware.ts` | Backend routes enforce 403 `FEATURE_LOCKED`; frontend routes are unguarded and sidebar does not intercept locked clicks. |
| **`QST-007`** | Resolved Investigation | Frontend caller & backend middleware audited | Raw Axios in `BillingPage.tsx` bypasses `api` interceptor, triggering 400 rejection and cascading `Payment window closed` toast. |

---

## 4. Issue-by-Issue Findings with Code Evidence

### 4.1 Trial Duration Inconsistency (`FF-ISSUE-023`, `QST-001`, `DEC-001`)
- **Severity:** High  
- **Expected Behavior:** Per approved `DEC-001`, every newly registered company receives exactly a **7-calendar-day free trial** with Starter tier feature access (5 trucks, 1 branch, 2 users). Marketing copy, registration forms, backend provisioning, and dashboard countdown banners must agree on 7 days.
- **Actual Code Evidence:**
  1. [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts#L134-L137):
     ```typescript
     trial_ends_at: {
       type: Date,
       default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default trial
     },
     ```
  2. [`backend/src/controllers/authController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/authController.ts#L164-L198) in `register`:
     ```typescript
     // 3. Create Company Workspace with 14-day free trial
     trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
     ...
     // 5. Initialize Trial Subscription if standard plan or any active plan exists
     const standardPlan = (await Plan.findOne({ code: 'standard' }).session(session)) || (await Plan.findOne().session(session));
     ```
  3. [`backend/src/controllers/authController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/authController.ts#L537-L570) in `createWorkspace`:
     ```typescript
     trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
     const standardPlan = await Plan.findOne({ code: 'standard' });
     ```
  4. [`frontend/src/components/layout/Navbar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Navbar.tsx#L57):
     ```typescript
     const calculateDaysRemaining = (dateStr?: string) => {
       if (!dateStr) return 14;
       ...
     };
     ```
  5. [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx#L474):
     ```tsx
     {status === 'trialing' && `14-Day Free Trial (${entitlements?.days_remaining_in_trial ?? 14} days remaining)`}
     ```
  6. Public marketing copy in [`HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx#L114), [`FeaturesPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/FeaturesPage.tsx#L198), [`RefundPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/RefundPage.tsx#L49), [`RegisterPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/RegisterPage.tsx#L97), and [`LoginPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/auth/LoginPage.tsx#L275) all advertise "14-Day Free Trial".
- **Reproduction Steps:**
  1. Register a new tenant via `/register`.
  2. Query MongoDB: `db.companies.findOne({ email: ... }, { trial_ends_at: 1, created_at: 1 })`.
  3. Verify duration equals `14 * 24 * 60 * 60 * 1000` ms.
  4. Inspect active subscription: `db.subscriptions.findOne({ company_id: ... })`. Note `plan_id` points to `standard` plan, not `starter`.
  5. Navigate to `/dashboard` and `/settings/billing`. Observe banner stating 14 days.
- **Recommended Fix:**
  - Update `Company.ts` default to `Date.now() + 7 * 24 * 60 * 60 * 1000`.
  - Update `authController.ts` in `register` and `createWorkspace` to `+7 days` and provision `starter` plan.
  - Update frontend copy across `Navbar.tsx`, `BillingPage.tsx`, `HomePage.tsx`, `FeaturesPage.tsx`, `RefundPage.tsx`, `RegisterPage.tsx`, and `LoginPage.tsx` to 7 days.
  - Ensure expired trial access blocks write mutations server-side.

---

### 4.2 Pro Module Lock Bypass (`FF-ISSUE-025`, `QST-002`)
- **Severity:** High  
- **Expected Behavior:** When a tenant's subscription tier does not include a feature (e.g. Maintenance or Tyres for Starter/Standard tiers):
  1. Backend routes must reject direct API calls with HTTP 403 `FEATURE_LOCKED`.
  2. Frontend route definitions in `App.tsx` must block access using `<FeatureGate>` and render an upgrade call-to-action preview.
  3. Sidebar navigation must intercept clicks on locked links, preventing page navigation and triggering the upgrade modal.
- **Actual Code Evidence:**
  1. **Backend Route Status:** [`backend/src/routes/maintenanceRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/maintenanceRoutes.ts#L44) correctly applies `router.use(requireFeature('MOD_MAINTENANCE'))`. This middleware correctly verifies access via [`entitlementMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/entitlementMiddleware.ts#L36-L47) and returns 403 `FEATURE_LOCKED`. Direct API access is blocked!
  2. **Frontend Route Vulnerability:** [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx#L213-L214):
     ```tsx
     <Route path="fleet/maintenance" element={<MaintenanceDashboardPage />} />
     <Route path="fleet/tyres" element={<TyreManagementPage />} />
     ```
     Neither route has a `<FeatureGate>` wrapper or subscription guard.
  3. **Sidebar Click Defect:** [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx#L166-L181):
     ```tsx
     <NavLink
       key={item.path}
       to={item.path}
       end={item.end}
       onClick={handleLinkClick}
       className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
     >
       <Icon size={18} />
       <span style={{ flex: 1 }}>{item.label}</span>
       {isLocked && (
         <span className="sidebar-lock-badge" title={`Requires ${item.tier} plan`}>
           <Lock size={10} />
           <span>{item.tier}</span>
         </span>
       )}
     </NavLink>
     ```
     The `<NavLink>` renders a visual lock badge, but clicking the link still triggers client-side navigation to `/fleet/maintenance`. The page mounts, triggers API queries, fails with 403 errors, and displays a broken interface rather than an upgrade paywall.
- **Reproduction Steps:**
  1. Log in as a Starter tenant.
  2. Click "Maintenance & Repairs" on the sidebar.
  3. Observe browser navigating to `/fleet/maintenance` and rendering the full maintenance dashboard skeleton with red error toasts.
- **Recommended Fix:**
  - Wrap `/fleet/maintenance` and `/fleet/tyres` in `App.tsx` with `<FeatureGate feature="MOD_MAINTENANCE">`.
  - In `Sidebar.tsx`, intercept click on locked items (`e.preventDefault()`) and invoke a callback to show the plan upgrade modal.

---

### 4.3 Missing Idempotency Key & Payment Window Rejection (`FF-ISSUE-026`, `FF-ISSUE-027`, `QST-007`)
- **Severity:** High / Critical Financial Blocker  
- **Expected Behavior:**
  1. Every financial mutation (checkout, verification, plan change) must include a valid `x-idempotency-key` header.
  2. Payment verification must succeed idempotently without crashing.
  3. The "Payment window closed" warning should only appear if the user deliberately cancels or dismisses the gateway dialog, not on validation or network errors.
- **Actual Code Evidence:**
  1. [`frontend/src/api/client.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/api/client.ts#L46-L65) defines an Axios interceptor on the exported `api` instance that automatically injects `config.headers['x-idempotency-key'] = generateIdempotencyKey()` for all mutating requests (`post`, `put`, `patch`, `delete`).
  2. [`frontend/src/pages/settings/BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx#L19) does **not** import `api`. It imports raw `axios from 'axios'`:
     ```typescript
     import axios from 'axios';
     ```
  3. In `BillingPage.tsx` lines 176, 246, 304, 325, 345, 376, 394, all requests use raw `axios.post`:
     ```typescript
     // line 246 (verify payment)
     const res = await axios.post('/api/billing/verify-payment', verificationPayload, { withCredentials: true });
     ```
  4. Backend route in [`backend/src/routes/billingRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/billingRoutes.ts#L48):
     ```typescript
     router.post('/verify-payment', requireRole(['admin']), requireStrictIdempotency, verifyPayment);
     ```
  5. Backend [`requireStrictIdempotency`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/idempotencyMiddleware.ts#L324-L329):
     ```typescript
     const rawKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
     if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
       res.status(400).json({
         error: 'x-idempotency-key header is required for this financial mutation',
       });
       return;
     }
     ```
     Because raw `axios` bypassed the interceptor, no idempotency header was attached. The backend rejected the mutation with HTTP 400.
  6. In `BillingPage.tsx` lines 212–215 and 238–242, when checkout initialization fails or verification errors, the catch handler invokes:
     ```typescript
     toast.warning('Payment window closed. Your plan has not been changed.');
     ```
- **Reproduction Steps:**
  1. Open `/settings/billing`.
  2. Select any plan upgrade and complete payment in test/emulator mode.
  3. Observe error toast: `x-idempotency-key header is required for this financial mutation`.
  4. Immediately observe secondary warning toast: `Payment window closed. Your plan has not been changed.`.
- **Recommended Fix:**
  - In `BillingPage.tsx`, replace `import axios from 'axios'` with `import api from '../../api/client'`.
  - Refactor all `axios.get` and `axios.post` calls to `api.get` and `api.post`.
  - Update `handleVerifyPayment` and `handleCancelCheckout` to distinguish between explicit user closure and server verification errors.

---

### 4.4 GST Pricing Calculation Inconsistency vs. Approved DEC-001
- **Severity:** High Financial Calculation Defect  
- **Approved Decision (`DEC-001` Section 2.2):**
  - Starter Plan: ₹1,999/month (199,900 paise) GST-inclusive.
  - Standard Plan: ₹3,999/month (399,900 paise) GST-inclusive.
  - Pro Plan: ₹8,999/month (899,900 paise) GST-inclusive.
- **Actual Code Evidence:**
  [`backend/src/controllers/billingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts#L205-L220):
  ```typescript
  let basePricePaise = billing_cycle === 'annual'
    ? targetPlan.annual_price_paise
    : targetPlan.monthly_price_paise;

  const subtotalPaise = Math.max(0, basePricePaise - discountPaise);
  // GST 18% (9% CGST + 9% SGST) for Indian SaaS compliance
  const cgstPaise = Math.round(subtotalPaise * 0.09);
  const sgstPaise = Math.round(subtotalPaise * 0.09);
  const totalPaise = subtotalPaise + cgstPaise + sgstPaise;
  ```
  `basePricePaise` is treated as a pre-tax net amount, and 18% GST is added on top.
  - For Starter: charges `199,900 + 17,991 + 17,991 = 235,882` paise (₹2,358.82) instead of ₹1,999.
  - For Standard: charges `399,900 + 35,991 + 35,991 = 471,882` paise (₹4,718.82) instead of ₹3,999.
  - For Pro: charges `899,900 + 80,991 + 80,991 = 1,061,882` paise (₹10,618.82) instead of ₹8,999.
- **Contrast with Test Suite:**
  In [`phase5SubscriptionGating.test.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/tests/integration/phase5SubscriptionGating.test.ts#L504-L510), tests construct transactions using correct GST-inclusive back-calculation:
  ```typescript
  tax_breakup: {
    subtotal_paise: 762627,
    cgst_paise: 68636,
    sgst_paise: 68636,
    total_paise: 899900,
    gst_rate_percent: 18,
  }
  ```
  (`899,900 / 1.18 = 762,627.11`; CGST = 68,636; SGST = 68,636; Total = 899,900).
- **Recommended Fix:** Update `initializeCheckout` in `billingController.ts` to compute tax using GST-inclusive reverse math:
  ```typescript
  const totalPaise = Math.max(0, basePricePaise - discountPaise);
  const subtotalPaise = Math.round(totalPaise / 1.18);
  const totalGstPaise = totalPaise - subtotalPaise;
  const cgstPaise = Math.round(totalGstPaise / 2);
  const sgstPaise = totalGstPaise - cgstPaise;
  ```

---

### 4.5 Unauthorized Trial Plan Switch Security Flaw
- **Severity:** High Security & Revenue Leakage  
- **Observed Behavior:**
  In [`backend/src/controllers/billingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts#L481-L510):
  ```typescript
  // Disallow free upgrades when on an active paid subscription
  if (subscription.status !== 'trialing' && targetPricePaise > currentPricePaise) {
    res.status(402).json({ code: 'PAYMENT_REQUIRED', ... });
    return;
  }

  // In trial mode or if immediate change requested:
  if (subscription.status === 'trialing' || immediate) {
    subscription.plan_id = targetPlan._id as any;
    ...
  ```
  When `subscription.status === 'trialing'`, the payment check is bypassed completely! A trial user can call `/api/billing/change-plan` with `{ target_plan_id: proPlan._id, immediate: true }` and switch their trial account to the Pro tier for free without going through checkout.
- **Recommended Fix:** Trial users must remain restricted to the Starter feature set per `DEC-001`. Trial plan changes to higher tiers must require payment checkout and trial conversion.

---

### 4.6 Company Workspace Module Access Configuration Gap (`FF-ISSUE-024`)
- **Severity:** Medium  
- **Observed Behavior:**
  1. [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts#L86-L119) `settings` subdocument contains prefixes, timezone, currency, and expense categories, but has no `enabled_modules` field.
  2. [`frontend/src/pages/settings/CompanySettingsPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/CompanySettingsPage.tsx) provides general settings, sequence numbers, and logo uploads, but no module toggle interface.
  3. Operators cannot voluntarily hide modules they do not use (e.g. Market Vehicles, Tyre Management) to streamline their team's sidebar.
- **Recommended Fix:**
  - Add `enabled_modules: [{ type: String }]` to `Company.settings`.
  - Expose `PUT /api/company/settings/modules` allowing admins to toggle modules within their plan's entitlements.
  - Update `Sidebar.tsx` to filter navigation links against both plan entitlements and company `enabled_modules`.

---

### 4.7 Toast Z-Index and Dismissal Defect (`FF-ISSUE-012`)
- **Severity:** High (Directly affects checkout modal error visibility)  
- **Observed Behavior:**
  1. [`frontend/src/styles/components/toasts.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/toasts.css#L12) sets `z-index: var(--z-toast, 1000);`.
  2. [`frontend/src/styles/components/modals.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/modals.css#L16) sets `z-index: 1100;`.
  3. When an action inside a modal triggers an error toast (e.g. billing validation, GSTIN error, proration failure), the toast renders beneath the modal backdrop.
  4. [`frontend/src/stores/uiStore.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/stores/uiStore.ts#L67) hardcodes duration to 4500ms and lacks mouse hover pause listeners.
- **Recommended Fix:**
  - Set toast container `z-index: 99999` in `toasts.css`.
  - In `uiStore.ts`, set error toast default duration to 6000ms.
  - Add hover pause/resume event listeners to the toast component.

---

### 4.8 Unwanted Public Fleet ROI Calculator Component (`FF-ISSUE-002`)
- **Severity:** Low (Public Marketing / Brand Accuracy)  
- **Observed Behavior:**
  [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx#L205-L254) embeds an interactive "Fleet ROI Calculator" with sliders and unverified automated savings calculations (billing automation + fuel leakage reduction).
- **Product Owner Decision:** Remove completely to streamline page scanability and eliminate unverified mathematical claims.
- **Recommended Fix:** Delete the calculator section (lines 204–254) and the state hook (lines 64–80) from `HomePage.tsx`. Ensure no broken anchor tags remain.

---

## 5. Decision and Dependency Review

### 5.1 DEC-001: Pricing, Tiering, and Quota Matrix
- **Status:** Formally approved.
- **Authoritative Matrix:**
  - **Trial:** 7 days, 5 trucks, 1 branch, 2 users, Starter feature set.
  - **Starter:** ₹1,999/month (₹19,990/year) GST-inclusive; 15 trucks, 1 branch, 2 users.
  - **Standard:** ₹3,999/month (₹39,990/year) GST-inclusive; 30 trucks, 3 branches, 5 users.
  - **Pro:** ₹8,999/month (₹89,990/year) GST-inclusive; unlimited trucks (subject to FUP), advanced modules (Maintenance, Tyres, Tally Export, Custom Fields, Approvals, Audit Logs).
- **Enforcement Directives for Batch E:**
  - Align all database defaults and registration controllers strictly to 7 days.
  - Align GST calculation to GST-inclusive reverse math.
  - Do not invent new limits or alter approved prices.

### 5.2 Questions Resolved by This Audit
- **`QST-001` (Trial Duration Provisioning):** Resolved. Code currently provisions 14 days and Standard plan in database records. Must be corrected to 7 days and Starter plan.
- **`QST-002` (Pro Module Feature Lock API Status):** Resolved. Backend API is already secured via `requireFeature('MOD_MAINTENANCE')`. Frontend routing and sidebar navigation are unprotected and must be gated.
- **`QST-007` (Missing Idempotency Key & Payment Window Status):** Resolved. Direct raw Axios usage in `BillingPage.tsx` bypasses the API client interceptor, triggering 400 rejection from backend `requireStrictIdempotency`.

---

## 6. Recommended Implementation Phases

To ensure zero downtime, tenant safety, and financial integrity, the implementation is decomposed into six strictly gated phases ordered by dependency:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ Phase E1: Trial Duration & Provisioning Harmonization                  │
  │ (Company.ts, authController.ts, Navbar.tsx, Marketing copy)            │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ Phase E2: Frontend Feature Gating & Sidebar Lock Interception          │
  │ (App.tsx route guards, FeatureGate on Maintenance/Tyres, Sidebar.tsx)  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ Phase E3: Idempotency Key Injection & Client-Side Billing Migration    │
  │ (BillingPage.tsx migration from raw Axios to api client, Modal alerts) │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ Phase E4: GST Calculation Correction & Trial Conversion Security       │
  │ (billingController.ts GST-inclusive math, block free trial Pro switch) │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ Phase E5: Workspace Module Access Configuration Control                │
  │ (Company.settings.enabled_modules schema, API routes, Settings UI)     │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ Phase E6: UI-UX Scope Cleanup & Toast Stacking Hardening               │
  │ (Remove ROI calculator from HomePage.tsx, Toast z-index & duration)   │
  └────────────────────────────────────────────────────────────────────────┘
```

### Phase E1: Trial Duration & Provisioning Harmonization
- Update `Company.ts` default `trial_ends_at` to `Date.now() + 7 * 24 * 60 * 60 * 1000`.
- Update `authController.ts` (`register` and `createWorkspace`) to set 7 days and provision the `starter` plan.
- Update fallback in `Navbar.tsx` (`calculateDaysRemaining`) to default to 7 days.
- Harmonize marketing and onboarding copy across `HomePage.tsx`, `FeaturesPage.tsx`, `RefundPage.tsx`, `RegisterPage.tsx`, and `LoginPage.tsx` to 7 days.
- Ensure expired trial tenants cannot perform write actions.

### Phase E2: Frontend Feature Gating & Sidebar Lock Interception
- In `frontend/src/App.tsx`, wrap `/fleet/maintenance` and `/fleet/tyres` with `<FeatureGate feature="MOD_MAINTENANCE">`.
- In `frontend/src/components/layout/Sidebar.tsx`, add an `onClick` handler for locked items that calls `e.preventDefault()` and opens the Plan Upgrade modal instead of executing navigation.
- Add an upgrade banner / paywall card fallback in `<FeatureGate>` linking to `/settings/billing`.

### Phase E3: Idempotency Key Injection & Client-Side Billing Migration
- In `frontend/src/pages/settings/BillingPage.tsx`, replace `import axios from 'axios'` with `import api from '../../api/client'`.
- Migrate all endpoints (`/calculate-change`, `/checkout`, `/verify-payment`, `/change-plan`, `/apply-scheduled`, `/cancel-scheduled`, `/toggle-addon`) to `api.get` and `api.post`.
- Ensure `x-idempotency-key` is automatically injected and verified.
- Fix dismissal handlers so `Payment window closed` only appears when the user explicitly cancels checkout.

### Phase E4: GST Calculation Correction & Trial Conversion Security
- Update `initializeCheckout` in `backend/src/controllers/billingController.ts` to compute subtotal and 18% GST using reverse GST-inclusive calculation.
- In `billingController.ts` `changePlan`, disallow trial accounts from autonomously switching to `pro` or `standard` without completing paid checkout.

### Phase E5: Workspace Module Access Configuration Control
- Add `enabled_modules: [{ type: String }]` to `Company.settings` schema.
- Create backend endpoint `PUT /api/company/settings/modules` to persist enabled modules.
- Create frontend module toggle panel in `CompanySettingsPage.tsx`.
- Update `Sidebar.tsx` to respect `enabled_modules`.

### Phase E6: UI-UX Scope Cleanup & Toast Stacking Hardening
- Remove Fleet ROI Calculator component and state from `HomePage.tsx` (`FF-ISSUE-002`).
- Set toast container `z-index: 99999` in `toasts.css` (`FF-ISSUE-012`).
- Increase error toast duration to 6000ms and add hover pause listener in `Toast` component and `uiStore.ts`.

---

## 7. Security, Tenant Isolation, Concurrency, Idempotency, and Billing Safeguards

1. **Strict Idempotency Invariants:**
   - Every financial mutation must be backed by an atomic check on the `IdempotencyKey` collection in MongoDB.
   - Retries with the same idempotency key must return the cached transaction response without re-executing payment verification, plan changes, or invoice generation.
2. **Tenant Scoping on Payment Lookups:**
   - In `verifyPayment`, the transaction lookup must always filter by `order_id` AND `company_id: req.company._id`. Cross-tenant order verification must fail closed with HTTP 404.
3. **Server-Side Truth for Pricing and Plans:**
   - Never accept client-supplied amounts or feature lists. Amounts charged must be looked up exclusively from the canonical `Plan` collection in database records.
4. **Signature Verification Fail-Closed:**
   - HMAC SHA256 signatures generated by Razorpay must be verified server-side using constant-time comparison before modifying company subscription state.
5. **Session Safety:**
   - Database operations for tenant registration, subscription creation, and payment verification must be wrapped in MongoDB ACID sessions (`ClientSession`) where supported.

---

## 8. Automated Regression Tests and Manual Acceptance Checklist

### 8.1 Proposed Automated Regression Test Suite (`phase5BatchESubscription.test.ts`)
1. **Trial Provisioning Tests:**
   - Test company registration sets `trial_ends_at` exactly 7 days from `created_at` ($\pm 5$ seconds).
   - Test trial company receives `starter` plan with 15 trucks, 1 branch, and 2 users limit.
   - Test expired trial company is blocked from creating trucks with HTTP 403 `TRIAL_EXPIRED`.
2. **Feature Gating Tests:**
   - Test Starter tenant receives 403 `FEATURE_LOCKED` when accessing `/api/maintenance/work-orders`.
   - Test Pro tenant receives 200 OK when accessing maintenance endpoints.
3. **Idempotency & Payment Tests:**
   - Test `/api/billing/verify-payment` rejects requests missing `x-idempotency-key` with HTTP 400.
   - Test sending the same `x-idempotency-key` twice returns cached response without duplicate execution.
   - Test checkout calculates GST-inclusive tax breakup: Starter ₹1,999 total = ₹1,694.07 subtotal + ₹304.93 GST.
   - Test trial user cannot switch to `pro` via `/api/billing/change-plan` without payment (HTTP 402).
4. **Module Configuration Tests:**
   - Test company admin can update `enabled_modules`.
   - Test non-admin cannot update `enabled_modules` (HTTP 403).

### 8.2 Manual Acceptance Checklist
- [ ] Register new account: Verify dashboard banner says "7 Days Free Trial Left".
- [ ] Inspect pricing page: Starter ₹1,999/mo, Standard ₹3,999/mo, Pro ₹8,999/mo (GST incl.).
- [ ] Log in as Starter tenant: Click "Maintenance & Repairs" on sidebar; verify Plan Upgrade modal appears instead of broken page.
- [ ] Open `/settings/billing`: Click "Upgrade Plan"; verify checkout modal opens cleanly without missing idempotency key error.
- [ ] In checkout modal: Trigger validation failure; verify error toast appears above modal backdrop with 6-second duration.
- [ ] Complete emulator payment: Verify subscription upgrades immediately to target plan.
- [ ] Visit homepage: Verify ROI calculator section is completely gone.

---

## 9. Explicit Acceptance Criteria for Each Proposed Phase

### Phase E1 Acceptance Criteria
- [ ] Newly registered company has `trial_ends_at` set to exactly 7 calendar days from creation.
- [ ] New company is linked to `starter` plan document.
- [ ] `Navbar.tsx` trial countdown pill displays 7 days for fresh registrations.
- [ ] Marketing pages (`HomePage`, `FeaturesPage`, `RefundPage`, `RegisterPage`, `LoginPage`) state 7 days.

### Phase E2 Acceptance Criteria
- [ ] `/fleet/maintenance` and `/fleet/tyres` routes render `<FeatureGate>` upgrade card when user lacks Pro tier.
- [ ] Clicking locked items in `Sidebar.tsx` opens the upgrade modal without navigating to the locked URL.

### Phase E3 Acceptance Criteria
- [ ] All billing mutations in `BillingPage.tsx` use the centralized `api` client.
- [ ] `x-idempotency-key` header is present on all POST requests to `/api/billing/*`.
- [ ] `Payment window closed` toast does not appear during successful checkout or on API validation errors.

### Phase E4 Acceptance Criteria
- [ ] Checkout charges exactly ₹1,999 for Starter, ₹3,999 for Standard, and ₹8,999 for Pro.
- [ ] Tax breakup in generated invoices reflects 18% reverse calculation.
- [ ] Trial users cannot call `/api/billing/change-plan` to switch to Pro for free.

### Phase E5 Acceptance Criteria
- [ ] `Company.settings.enabled_modules` persists array of active module keys.
- [ ] `CompanySettingsPage.tsx` allows admins to toggle modules included in their plan.
- [ ] Sidebar hides disabled modules.

### Phase E6 Acceptance Criteria
- [ ] Fleet ROI Calculator is removed from `HomePage.tsx`.
- [ ] Toast notifications render with `z-index: 99999` above all modals.
- [ ] Error toasts remain for 6 seconds; mouse hover pauses countdown.

---

## 10. Blockers and Unresolved Questions

There are **zero technical blockers** preventing execution of Batch E. All root causes have been forensically isolated to specific lines of code.

### Product Decisions Required from Product Owner
1. **Trial Provisioning Confirmation:** Confirm that all new companies must receive a 7-day trial on the **Starter** plan per `DEC-001`, rather than the 14-day Standard trial previously coded.
2. **Existing 14-Day Companies:** Confirm whether existing test/pilot companies in the database should be migrated to 7 days or grandfathered until their current trial date expires. (Recommendation: Grandfather existing records; apply 7 days strictly to new registrations).
3. **Module Config Scope:** Confirm that `enabled_modules` in `CompanySettingsPage.tsx` is strictly for disabling non-core features within the subscribed plan, never granting features beyond the subscribed tier.

---

## 11. Implementation Authorization Gate

> [!CAUTION]
> **STOP CONDITION:**  
> This preflight document is complete and strictly read-only.  
> **NO APPLICATION SOURCE CODE, DATABASE SCHEMAS, CONFIGURATION, OR TESTS HAVE BEEN MODIFIED.**  
> Awaiting explicit Product Owner authorization before proceeding to implementation.
