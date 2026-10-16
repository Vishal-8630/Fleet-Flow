# Fleet Flow — Batch E2 Preflight Review: Frontend Feature Gating & Sidebar Lock Interception

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `PHASE-E2`  
**Target Canonical Issue:** [`FF-ISSUE-025`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md) — PRO-Locked Modules Remain Accessible Despite UI Lock Badges  
**Approved Architectural Decision:** [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md) — Fleet Flow Pricing, Tiering, and Quota Matrix  
**Architectural Investigation Question:** [`QST-002`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md) — Pro Module Feature Lock Backend API Enforcement Status  
**Execution Posture:** Technical Governance Specification & Architectural Plan  
**Baseline Git Commit:** `0197cf6` on branch `main`  
**Preflight Recommendation:** **`ACCEPT`**

---

## 1. Executive Summary

Phase E2 addresses the client-side enforcement gap cataloged in [`FF-ISSUE-025`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md):

1. **Backend Protection Verified:** As confirmed by [`QST-002`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md), backend endpoints for Maintenance (`/api/maintenance/*`) and Tyres (`/api/tyres/*`) enforce `requireFeature('MOD_MAINTENANCE')`, strictly rejecting unentitled Starter/Standard tier tenants with HTTP 403 `FEATURE_LOCKED`.
2. **Frontend Route Vulnerability:** In [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx#L213-L214), routes `/fleet/maintenance` and `/fleet/tyres` mounted full operational components (`MaintenanceDashboardPage` and `TyreManagementPage`) without any `<FeatureGate>` wrapper.
3. **Sidebar Lock Bypass:** In [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx#L166-L181), locked items rendered visual `PRO` badges, but were wrapped inside standard `<NavLink>` elements. Clicking or pressing `Enter`/`Space` navigated directly into the locked views, where operational API queries immediately failed and surfaced jarring raw network error toasts.
4. **Missing Paywall Fallback:** [`FeatureGate.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/FeatureGate.tsx) lacked an integrated upgrade paywall card with clear upgrade paths and commercial context.

---

## 2. Issues, Decisions, and Canonical References

| Identifier | Category | Title | Relevance to Phase E2 |
| :--- | :--- | :--- | :--- |
| **[`FF-ISSUE-025`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md)** | Security / Subscriptions | PRO-Locked Modules Remain Accessible Despite UI Lock Badges | Core defect addressed in Phase E2. |
| **[`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)** | Architectural Decision | Fleet Flow Pricing, Tiering, and Quota Matrix | Authoritative plan feature definitions (`MOD_MAINTENANCE` exclusive to Pro). |
| **[`QST-002`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md)** | Unresolved Question | Pro Module Feature Lock Backend API Enforcement Status | Proves backend fail-closed protection is operational. |

---

## 3. Source Files Inspected

| File Path | Component / Layer | Relevant Symbols & Locations |
| :--- | :--- | :--- |
| [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx) | Frontend / Routing Tree | Lines 213–214 (Maintenance and Tyres route definitions). |
| [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx) | Frontend / Navigation | Lines 81–107 (`workspaceNavItems`), Lines 166–205 (Nav item click handling and lock badges). |
| [`frontend/src/components/common/FeatureGate.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/FeatureGate.tsx) | Frontend / Gating Guard | Lines 25–65 (Fallback rendering, hydration safety, upgrade CTA). |
| [`frontend/src/pages/fleet/MaintenanceDashboardPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/fleet/MaintenanceDashboardPage.tsx) | Frontend / Page View | API query invocations on mount. |
| [`frontend/src/pages/fleet/TyreManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/fleet/TyreManagementPage.tsx) | Frontend / Page View | API query invocations on mount. |
| [`backend/src/routes/maintenanceRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/maintenanceRoutes.ts) | Backend / Route Guard | `requireFeature('MOD_MAINTENANCE')`. |
| [`backend/src/routes/tyreRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/tyreRoutes.ts) | Backend / Route Guard | `requireFeature('MOD_MAINTENANCE')`. |

---

## 4. Current Behavior vs. Required Corrections

1. **Routing Interception (`App.tsx`):**
   - *Previous:* Unconditional rendering `<Route path="/fleet/maintenance" element={<MaintenanceDashboardPage />} />`.
   - *Correction:* Wrap both routes in `<FeatureGate feature="MOD_MAINTENANCE">`.
2. **Navigation Interception (`Sidebar.tsx`):**
   - *Previous:* Locked links permitted navigation, exposing users to raw API errors.
   - *Correction:* When `isLocked` is true:
     - Intercept click events (`e.preventDefault()`, `e.stopPropagation()`).
     - Intercept keyboard activation (`Enter`, `Space`).
     - Trigger the centralized plan upgrade modal: `uiStore.openUpgradeModal(item.planRequired || 'PRO')`.
     - Prevent browser URL transition.
3. **Paywall Banner Fallback (`FeatureGate.tsx`):**
   - *Previous:* Rendered generic or empty placeholder.
   - *Correction:* Provide an elegant upgrade banner with:
     - Feature title and explanation.
     - "Pro Tier Feature" badge.
     - Direct CTA button redirecting to `/settings/billing` or opening the upgrade modal.
     - Graceful loading state during authentication hydration to prevent layout flashing.
4. **Operational Page Guarding:**
   - In `MaintenanceDashboardPage` and `TyreManagementPage`, avoid issuing unauthenticated or unentitled queries prior to entitlement verification.

---

## 5. Architectural Invariants & Testing Strategy

- **Defense in Depth:** Frontend feature gates guide user experience and reduce network noise, while backend `requireFeature` remains the authoritative security barrier.
- **Accessibility:** Keyboard users (`Tab`, `Enter`, `Space`) must experience identical interceptor behavior as mouse clicks.
- **Automated Verification:** Create dedicated test suite `backend/src/tests/integration/phase5BatchE2FeatureGating.test.ts` testing:
  - Starter tier blocked from Maintenance API (HTTP 403 `FEATURE_LOCKED`).
  - Standard tier blocked from Maintenance API (HTTP 403 `FEATURE_LOCKED`).
  - Pro tier granted access to Maintenance API (HTTP 200).
  - Add-on entitlement grants access.
  - Super-admin quota overrides grant access.
  - Multi-tenant boundary preservation.

---

## 6. Preflight Recommendation

### Recommendation: **`ACCEPT`**
Phase E2 establishes unified frontend and backend gating, eliminating unhandled 403 error toasts and providing seamless commercial upsell pathways.
