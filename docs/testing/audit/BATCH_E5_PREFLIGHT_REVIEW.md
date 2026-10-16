# Fleet Flow — Batch E5 Preflight Review: Company-Level Module Access Configuration & Super Admin Visibility

**Document Type:** Technical Governance Pre-Implementation Review (Revision 3 — Final Approved Direction)  
**Phase Identifier:** `PHASE-E5`  
**Target Canonical Issue:** [`FF-ISSUE-024`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md) — Company Workspace Module Access Configuration Control Missing  
**Confirmed Product Owner Requirements:**
1. **Subscription Plan:** Authoritative commercial ceiling determining module eligibility.
2. **Company Admin:** Can enable/disable eligible modules included in their plan. Cannot grant modules outside the plan. May disable ANY module including core primitives.
3. **Super Admin:** Centralized read-only visibility into all companies, subscription plans, module eligibility, enabled/disabled preferences, and actual usage. Retains existing platform-level subscription and company administration capabilities.
4. **Effective Access Invariant:** $\text{EffectiveAccess} = \text{PlanEntitlements} \cap \text{CompanyEnabledModules}$.
5. **Automatic Provisioning:** New and existing companies without explicit preferences automatically inherit all eligible modules from their plan.
6. **Trial Driver Cap:** Unresolved and strictly out of scope for E5.

**Execution Posture:** Technical Governance Specification & Implementation Roadmap  
**Baseline Git Commit:** `0197cf6` on branch `main`  
**Baseline Verification Status:** 82/82 automated tests passing across 5 Phase E suites (`phase5BatchE1TrialSecurity`, `phase5BatchE2FeatureGating`, `phase5BatchE3PaymentIdempotency`, `phase5BatchE4PricingGstSecurity`, `phase5SubscriptionGating`).  
**Preflight Recommendation:** **`ACCEPT` (Approved for Implementation)**

---

> [!NOTE]
> ### GOVERNANCE RECONCILIATION & SUPERSEDED MODELS
> - **Revision 1 (Early Draft):** Proposed Company Admin self-service switches with hardcoded core-module locks. *Superseded.*
> - **Revision 2 (Interim Proposal):** Proposed that only Super Admins manage company module assignments and Company Admins have zero toggle authority. *Superseded per Product Owner Authorization.*
> - **Revision 3 (Final Approved Direction):** **Balanced Multi-Tenant Model:**
>   - Subscription Plan defines legal entitlement ceiling (`PlanEntitlements`).
>   - Company Admin configures workspace module activation (`CompanyEnabledModules`), with complete freedom across all entitled modules (including fleet and trips), subject to domain dependencies.
>   - Super Admin possesses global transparency over module eligibility, tenant preferences, and actual usage.

---

## 1. Executive Summary

This preflight audit inspects [`FF-ISSUE-024`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md) within the canonical roadmap established in [`ISSUE_INDEX.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/ISSUE_INDEX.md) (line 246).

### Problem Definition
In the existing codebase:
1. Operational module availability is dictated exclusively by subscription tier (`Plan.included_features` + active add-ons + quota overrides).
2. Workspace administrators (Company Admins) possess no administrative mechanism to enable or disable specific operational modules for their organization. Pure owned-fleet operators cannot turn off Market Movements (`MOD_MARKET_VEHICLES`); transport brokers who do not own workshops cannot turn off Workshop Maintenance (`MOD_MAINTENANCE`).
3. Platform Super Admins lack a unified overview to observe module configuration and actual module utilization across tenants.

### Approved Architecture: Company Preferences with Plan Ceiling & Super Admin Visibility

$$\text{EffectiveAccess} = \text{PlanEntitlements} \cap \text{CompanyEnabledModules}$$

1. **Commercial Ceiling:** What the tenant is legally licensed to use based on their active subscription, add-ons, and super-admin overrides. Company Admins can **never** activate modules outside their subscription plan. Attempts to enable unentitled features fail closed with HTTP 422 `UNENTITLED_MODULE`.
2. **Company Preferences:** Stored in `Company.settings.enabled_modules`. Company Admins can enable or disable any module included in their plan (including core entities like `MOD_FLEET` and `MOD_TRIPS`), as long as prerequisite module dependencies are satisfied.
3. **Automatic Provisioning & Safe Defaults:**
   - When `company.settings.enabled_modules` is `undefined`, the company automatically inherits 100% of its subscription plan entitlements.
   - Newly registered companies are immediately operational with full plan entitlements without requiring manual Super Admin intervention.
   - Existing tenants and test suites operate with zero breaking changes or schema migrations.
4. **Subscription Change Semantics:**
   - **Downgrade:** Effective access to modules excluded by the lower plan is immediately removed, even if stored in company preferences.
   - **Upgrade with Inherited Defaults:** Newly unlocked modules become active automatically.
   - **Upgrade with Explicit Preferences:** Existing intentional disablements are preserved; newly unlocked modules become available to enable in settings, but are not silently activated.
5. **Super Admin Transparency:** Centralized platform overview displaying each company's plan, module eligibility, enabled preferences, disabled preferences, and instrumented usage (where tracked).
6. **Fail-Closed Subscription Security:** Expired or suspended subscriptions retain full lockdown (`is_read_only = true`; write operations rejected with HTTP 403 `SUBSCRIPTION_INACTIVE`) regardless of company module preferences.

---

## 2. Issues, Decisions, and Canonical References

| Identifier | Category | Title | Relevance to Phase E5 |
| :--- | :--- | :--- | :--- |
| **[`FF-ISSUE-024`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md)** | Subscriptions & Billing | Company Workspace Module Access Configuration Control Missing | Primary issue addressed in Phase E5. |
| **[`FF-ISSUE-025`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md)** | Security / Subscriptions | PRO-Locked Modules Remain Accessible Despite UI Lock Badges | Phase E2 baseline; establishes `requireFeature` route guards and sidebar lock badges. |
| **[`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)** | Architectural Decision | Fleet Flow Pricing, Tiering, and Quota Matrix | Authoritative plan feature sets (`starter`, `standard`, `pro`) and pricing rules. |
| **[`QST-002`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md)** | Unresolved Question | Pro Module Feature Lock Backend API Enforcement Status | Proves backend routes enforce `requireFeature` with fail-closed 403 rejections. |

> [!IMPORTANT]
> **Strict Out-of-Scope Clarification:**  
> The unresolved question regarding the five-driver trial cap remains strictly **OUT OF SCOPE for Phase E5**. Phase E5 is exclusively limited to **Subscription-Based Modules, Company Preferences, and Super Admin Visibility**. Driver quotas and driver creation limits will not be altered or enforced in E5.

---

## 3. Source Files Inspected

| File Path | Component / Layer | Relevant Symbols & Locations |
| :--- | :--- | :--- |
| [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts) | Model / Database Schema | Lines 39–57 (`ICompany.settings`), Lines 86–125 (`CompanySchema.settings`). |
| [`backend/src/models/Subscription.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Subscription.ts) | Model / Billing Schema | Lines 45–65 (`quota_overrides.custom_feature_grants` / `custom_feature_revocations`). |
| [`backend/src/models/AuditLog.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/AuditLog.ts) | Model / Tenant Audit Log | Records tenant-level administrative configuration updates. |
| [`backend/src/models/PlatformAuditLog.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/PlatformAuditLog.ts) | Model / Platform Audit Log | Records Super Admin platform actions. |
| [`backend/src/utils/featureCatalog.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/featureCatalog.ts) | Catalog / Utilities | Lines 20–40 (`ModuleKey`), Lines 52–233 (`MOD_CATALOG`), Lines 260–300 (`validateModuleDependencies`). |
| [`backend/src/utils/entitlementService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/entitlementService.ts) | Service / Business Logic | Lines 44–155 (`getTenantEntitlements`), Lines 160–164 (`hasFeatureAccess`). |
| [`backend/src/middleware/entitlementMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/entitlementMiddleware.ts) | Middleware / Security | Lines 27–54 (`requireFeature`), Lines 59–85 (`requireAllFeatures`). |
| [`backend/src/controllers/companyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/companyController.ts) | Controller / Tenant API | Profile management handlers. |
| [`backend/src/routes/companyRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/companyRoutes.ts) | Routes / Security Boundary | Protected by `requireAuth`, `resolveTenantContext`, `requireActiveSubscription`. |
| [`backend/src/controllers/superAdminController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/superAdminController.ts) | Controller / Super Admin | Multi-tenant overview and directory. |
| [`backend/src/routes/superAdminRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/superAdminRoutes.ts) | Routes / Platform Boundary | Protected by `requireAuth`, `requireSuperAdmin`. |
| [`frontend/src/pages/settings/CompanySettingsPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/CompanySettingsPage.tsx) | Frontend / Admin View | Organization settings view. |
| [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/Sidebar.tsx) | Frontend / Layout | Lines 81–107 (`workspaceNavItems`), Lines 203–220 (Navigation item rendering and lock badges). |
| [`frontend/src/components/common/FeatureGate.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/FeatureGate.tsx) | Frontend / Gating Guard | Lines 30–70 (`isUnlocked` check, paywall/deactivated prompts). |

---

## 4. Architectural Design & Specifications

### 4.1 Data Model: `Company.settings.enabled_modules`

In [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts):

```typescript
export interface ICompanySettings {
  currency: string;
  timezone: string;
  lr_prefix: string;
  lr_zero_pad: number;
  invoice_prefix: string;
  invoice_zero_pad: number;
  settlement_prefix: string;
  settlement_zero_pad: number;
  logo_url?: string;
  date_format: string;
  number_system: 'indian_lakhs' | 'international_millions';
  expense_categories: Array<{ code: string; label: string; is_driver_reimbursable: boolean }>;
  enabled_modules?: ModuleKey[]; // Explicitly enabled module keys (undefined = inherits all plan entitlements)
}
```

```typescript
// Mongoose schema in Company.ts:
enabled_modules: {
  type: [{ type: String }],
  default: undefined, // undefined = company inherits 100% of plan entitlements
},
```

#### Invariant: Distinguishing Inherited Defaults from Explicit Choices
- `enabled_modules === undefined`: The company inherits all eligible modules from its subscription plan.
- `Array.isArray(enabled_modules)`: An explicit company configuration exists. Only the modules present in this array AND included in the company's active subscription plan are enabled.

---

### 4.2 Entitlement Service & Precedence Calculus

In [`backend/src/utils/entitlementService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/entitlementService.ts):

```typescript
export interface TenantEntitlementSummary {
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  plan: { code: string; name: string };
  plan_features: ModuleKey[];       // Eligible features permitted by plan + active add-ons + overrides
  enabled_features: ModuleKey[];    // Effective access (PlanEntitlements ∩ CompanyPreferences)
  company_modules?: ModuleKey[];    // Stored company preferences (undefined if default)
  limits: { max_trucks: number; max_drivers: number; max_users: number; max_branches: number };
  is_read_only: boolean;
  days_remaining_in_trial?: number;
}
```

#### Precedence Waterfall:
1. **Subscription Status Lockdown:** If status is `suspended`, `cancelled`, or `expired`, write operations remain strictly blocked (`is_read_only = true`), and the tenant is rejected with HTTP 403 `SUBSCRIPTION_INACTIVE` on write mutations regardless of company preferences.
2. **Plan Entitlement Ceiling:** Calculate the superset of features authorized by Plan + Paid Add-Ons + Super-Admin Overrides (`planFeatures`).
3. **Company Preference Filter:**
   - If `company.settings?.enabled_modules` is an array:
     $$\text{enabledFeatures} = \text{planFeatures} \cap \text{company.settings.enabled\_modules}$$
   - If `company.settings?.enabled_modules` is undefined:
     $$\text{enabledFeatures} = \text{planFeatures}$$
4. **Subscription Change Rules:**
   - **Downgrade:** Modules excluded by the new lower tier are immediately inaccessible on API and UI because `f ∉ planFeatures`.
   - **Upgrade (Inherited Defaults):** If `enabled_modules === undefined`, newly unlocked modules become active automatically.
   - **Upgrade (Explicit Preferences):** If `enabled_modules` is an array, previously disabled modules remain disabled. Newly unlocked modules are available in settings for the Company Admin to turn on, but are not silently activated.

---

### 4.3 Core Modules Policy: Full Administrator Discretion with Dependency Safety

Per Product Owner instruction:
- Company Admins **may enable or disable ANY module** included in their subscription plan, including:
  `MOD_FLEET`, `MOD_DRIVERS`, `MOD_PARTIES`, `MOD_DOCUMENT_VAULT`, `MOD_TRIPS`.
- The backend will **not** return `CORE_MODULE_REQUIRED` or enforce permanent core-module locks.
- **Dependency Safety:** Disabling a prerequisite module when a dependent module is enabled is rejected with HTTP 422 `DEPENDENCY_MISSING`:
  - E.g., Disabling `MOD_LR_ENGINE` while keeping `MOD_BILLING_INVOICE` enabled returns:
    `"Cannot disable Lorry Receipt (LR) Engine while GST Tax Invoicing is active."`
  - E.g., Disabling `MOD_FLEET` while keeping `MOD_MAINTENANCE` enabled returns:
    `"Cannot disable Fleet & Asset Registry while Workshop Maintenance is active."`

---

### 4.4 Backend API & Authorization

#### 1. Tenant Preference Endpoints (`companyRoutes.ts`)
- `GET /api/company/modules`:
  - **Auth:** `requireAuth`, `resolveTenantContext`, `requireActiveSubscription`.
  - **Accessible:** All workspace roles (`admin`, `dispatcher`, `accountant`, `viewer`).
  - **Response (HTTP 200):**
    ```json
    {
      "success": true,
      "plan": { "code": "pro", "name": "Pro Enterprise" },
      "plan_features": ["MOD_FLEET", "MOD_DRIVERS", "MOD_PARTIES", "MOD_DOCUMENT_VAULT", "MOD_TRIPS", "MOD_MARKET_VEHICLES", "MOD_MAINTENANCE"],
      "enabled_modules": ["MOD_FLEET", "MOD_DRIVERS", "MOD_PARTIES", "MOD_DOCUMENT_VAULT", "MOD_TRIPS", "MOD_MAINTENANCE"],
      "effective_features": ["MOD_FLEET", "MOD_DRIVERS", "MOD_PARTIES", "MOD_DOCUMENT_VAULT", "MOD_TRIPS", "MOD_MAINTENANCE"],
      "is_customized": true,
      "modules": [
        {
          "key": "MOD_MARKET_VEHICLES",
          "name": "Market Vehicle Movements",
          "category": "Operations",
          "is_entitled": true,
          "is_enabled": false,
          "dependencies": ["MOD_PARTIES"]
        }
      ]
    }
    ```
- `PUT /api/company/modules`:
  - **Auth:** `requireAuth`, `resolveTenantContext`, `requireActiveSubscription`, `requireRole(['admin'])`.
  - **Tenant Scoping:** Operates strictly on `req.company._id`. Request body company IDs are ignored.
  - **Validation:**
    1. Rejects unentitled keys with HTTP 422 `UNENTITLED_MODULE`.
    2. Validates dependencies via `validateModuleDependencies`. If unfulfilled, returns HTTP 422 `DEPENDENCY_MISSING`.
  - **Audit Logging:** Logs configuration change in `AuditLog` (`entity_type: 'company_settings'`). If audit persistence fails, request fails.

#### 2. Super Admin Visibility Endpoint (`superAdminRoutes.ts`)
- `GET /api/super-admin/tenants/modules-overview`:
  - **Auth:** `requireAuth`, `requireSuperAdmin`.
  - **Function:** Returns global multi-tenant module overview across all companies:
    - Company ID, name, status, plan code.
    - Plan entitled modules count.
    - Explicitly enabled modules count.
    - Explicitly disabled modules count.
    - Actual module usage (where reliable usage records exist in DB; otherwise tagged `usage_untracked: true`).
    - Read-only: Does not expose an arbitrary tenant module mutation bypass.

---

### 4.5 Frontend User Experience

1. **Company Settings (`CompanySettingsPage.tsx`):**
   - Adds "Workspace Modules" tab (`<Boxes size={16} />`).
   - Company Admins can toggle any eligible module on/off.
   - Plan-excluded modules are displayed with a "Requires [Tier] Plan" lock badge.
   - Clear helper text explaining that deactivating a module simplifies navigation and does not cancel the subscription.
2. **Sidebar Navigation (`Sidebar.tsx`):**
   - Company-disabled modules are completely hidden from the workspace navigation.
   - Plan-locked modules retain lock badges and trigger the Upgrade Modal (Phase E2 behavior).
3. **Deep-Link Direct URL Access (`FeatureGate.tsx`):**
   - If direct URL is accessed for a company-disabled module: surfaces deactivated notice ("This module has been deactivated by your workspace administrator in Company Settings").
4. **Super Admin Control Plane (`SuperAdminDashboardPage.tsx`):**
   - Adds "Module Allocations" view/modal showing companies, plan eligibility, custom preferences, and actual usage.

---

## 5. Summary of Scope & Dependencies (Phase 0)

- **Issue:** [`FF-ISSUE-024`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md) in canonical Batch E.
- **Data Model:** `Company.settings.enabled_modules?: ModuleKey[]` in [`backend/src/models/Company.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Company.ts).
- **Entitlement Logic:** `getTenantEntitlements` in [`backend/src/utils/entitlementService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/entitlementService.ts).
- **Backend Routes:**
  - `GET /api/company/modules` & `PUT /api/company/modules` in `companyRoutes.ts`.
  - `GET /api/super-admin/tenants/modules-overview` in `superAdminRoutes.ts`.
- **Audit Logging:** Tenant `AuditLog` for company settings updates; `PlatformAuditLog` for super-admin actions.
- **Frontend Pages:** `CompanySettingsPage.tsx`, `Sidebar.tsx`, `FeatureGate.tsx`, `SuperAdminDashboardPage.tsx`.
- **Conflicts:** Zero conflicts identified with canonical master registry `ISSUE_INDEX.md` or approved decisions `DEC-001`.
