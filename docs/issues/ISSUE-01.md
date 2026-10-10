# Issue 01 — Enforce Subscription Status and Plan Permissions on the Backend

## Metadata
- **Severity**: P0 (Critical)
- **Status**: ✅ Resolved & Verified
- **Category**: Security, Multi-Tenancy, Entitlements & Gating
- **Date**: October 10, 2026

---

## 1. Problem Statement
The codebase previously defined `requireActiveSubscription`, plan entitlements, and quota limits, but had critical enforcement gaps:
1. **Subscription Status Unenforced**: `requireActiveSubscription` was not wired to protected API routes. A suspended, cancelled, or expired tenant was able to perform write operations (create trucks, drivers, dispatches, invoices, and ledger entries).
2. **Missing Module Route Entitlements**: Feature entitlement gating (`requireFeature`) was only applied to `customFieldRoutes`. Other modules (`MOD_FLEET`, `MOD_DRIVERS`, `MOD_TRIPS`, `MOD_MARKET_VEHICLES`, `MOD_LR_ENGINE`, `MOD_BILLING_INVOICE`, `MOD_SETTLEMENTS`, `MOD_LEDGERS`, `MOD_DOCUMENT_VAULT`) had no route-level gating, allowing tenants on basic tiers to execute advanced features via direct API calls.
3. **No Quota Enforcement**: Creating vehicles, drivers, or inviting team members did not validate existing document counts against plan quota limits (`max_trucks`, `max_drivers`, `max_users`).
4. **Missing Dependency Validation**: Module dependencies were defined in `featureCatalog.ts` but were not validated when plans were created or tenant overrides were applied.
5. **Unused Frontend `FeatureGate`**: The frontend `FeatureGate` component was not connected to global auth state and had no usage in the application.

---

## 2. Root Cause Analysis (RCA)
- The initial route implementations focused on RBAC (`requireRole(['admin', 'dispatcher'])`) and tenant isolation (`resolveTenantContext`), but did not attach entitlement layers to route pipelines.
- `requireActiveSubscription` existed in `authMiddleware.ts` but was never mounted as middleware in route files.
- Quota validation was omitted from creation controller handlers.
- `GET /api/auth/me` hydrated user and company data but omitted the company's computed entitlement profile (`enabled_features`, `limits`), preventing frontend components from knowing which features were active.

---

## 3. Architecture & Implementation Solution

### A. Subscription Status & Read-Only Enforcement (`requireActiveSubscription`)
- Mounted on all tenant operational routers after `resolveTenantContext`.
- **Read-Only Invariant**: `GET`, `HEAD`, and `OPTIONS` requests are always allowed, ensuring suspended or expired tenants can view historical data, audit trails, and tax invoices.
- **Write Blocking**: `POST`, `PUT`, `PATCH`, and `DELETE` requests are blocked with HTTP 403:
  - If trial expired: `{ code: 'SUBSCRIPTION_EXPIRED', status: 'expired', is_read_only: true, error: '...' }`
  - If suspended or past due: `{ code: 'SUBSCRIPTION_SUSPENDED', status: 'suspended', is_read_only: true, error: '...' }`
- **Automatic Trial Expiry**: If a tenant's `subscription_status` is `trialing` but `trial_ends_at < Date.now()`, the middleware automatically marks the company as `expired` in MongoDB.

### B. Route-Level Module Entitlements (`requireFeature`)
Mounted directly on respective Express routers:
- `truckRoutes.ts` → `requireFeature('MOD_FLEET')`
- `driverRoutes.ts` → `requireFeature('MOD_DRIVERS')`
- `journeyRoutes.ts` → `requireFeature('MOD_TRIPS')`
- `vehicleEntryRoutes.ts` → `requireFeature('MOD_MARKET_VEHICLES')`
- `partyRoutes.ts` → `requireFeature('MOD_PARTIES')`
- `entryRoutes.ts` → `requireFeature('MOD_LR_ENGINE')`
- `invoiceRoutes.ts` → `requireFeature('MOD_BILLING_INVOICE')`
- `settlementRoutes.ts` → `requireFeature('MOD_SETTLEMENTS')`
- `ledgerRoutes.ts` → `requireFeature('MOD_LEDGERS')`
- `customFieldRoutes.ts` → `requireFeature('MOD_CUSTOM_FIELDS')`
- `documentRoutes.ts` → `requireFeature('MOD_DOCUMENT_VAULT')`

Returns standard error on unauthorized calls:
```json
{
  "code": "FEATURE_LOCKED",
  "module": "MOD_LR_ENGINE",
  "module_name": "Lorry Receipt & Consignment Notes",
  "required_tier": "standard",
  "error": "The feature \"Lorry Receipt & Consignment Notes\" is not included in your current subscription plan. Please upgrade to unlock this capability."
}
```

### C. Resource Quota Enforcement (`requireQuota`)
Created `requireQuota(resource: 'trucks' | 'drivers' | 'users')` middleware in `entitlementMiddleware.ts`:
- Validates active counts against `limits`:
  - `POST /api/trucks` → Checks `Truck.countDocuments` vs `limits.max_trucks`
  - `POST /api/drivers` → Checks `Driver.countDocuments` vs `limits.max_drivers`
  - `POST /api/company/members/invite` → Checks `CompanyMember.countDocuments` vs `limits.max_users`
- Returns HTTP 403:
```json
{
  "code": "QUOTA_EXCEEDED",
  "resource": "trucks",
  "limit": 5,
  "current": 5,
  "error": "Truck quota exceeded (5/5). Upgrade your plan or purchase a fleet booster to add more trucks."
}
```

### D. Module Dependency Validation
- In `backend/src/utils/featureCatalog.ts`:
  - `validateModuleDependencies(modules: ModuleKey[])`: Returns `{ valid: boolean, missing: Array<{ module, requires }> }`.
  - `resolveModuleDependencies(modules: ModuleKey[])`: Recursively resolves and includes required dependencies.
- In `superAdminController.ts`: Validates module dependencies during `createPlan`, `updatePlan`, and `overrideTenantQuota`.

### E. Frontend State Hydration & `FeatureGate` Component
- `getMe` endpoint now populates `enabledFeatures` and `limits` from `getTenantEntitlements(company)`.
- `authStore.ts` stores `enabledFeatures` and `limits`.
- `FeatureGate.tsx` connects directly to `useAuthStore()`, rendering children when unlocked or displaying a lock card with an upgrade CTA when locked.

---

## 4. Files Modified / Created
| File | Changes Made |
| :--- | :--- |
| `backend/src/middleware/authMiddleware.ts` | Enhanced `requireActiveSubscription` with trial expiry detection and consistent error codes |
| `backend/src/middleware/entitlementMiddleware.ts` | Added `requireQuota` middleware for trucks, drivers, and user seat limits |
| `backend/src/utils/featureCatalog.ts` | Added `validateModuleDependencies` and `resolveModuleDependencies` |
| `backend/src/controllers/billingController.ts` | Added immediate plan switching for trials/tests, downgrade quota headroom checks, and scheduled downgrade management |
| `backend/src/routes/billingRoutes.ts` | Mounted `apply-scheduled` and `cancel-scheduled` plan change routes |
| `backend/src/controllers/superAdminController.ts` | Wired module dependency validation on plan updates and added `assignTenantPlan` |
| `backend/src/routes/superAdminRoutes.ts` | Mounted `PATCH /tenants/:id/plan` for Super Admin plan assignments |
| `backend/src/controllers/authController.ts` | Included `enabledFeatures` and `limits` in `getMe` session hydration payload |
| `backend/src/routes/truckRoutes.ts` | Added `requireActiveSubscription`, `requireFeature('MOD_FLEET')`, and `requireQuota('trucks')` |
| `backend/src/routes/driverRoutes.ts` | Added `requireActiveSubscription`, `requireFeature('MOD_DRIVERS')`, and `requireQuota('drivers')` |
| `backend/src/routes/journeyRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_TRIPS')` |
| `backend/src/routes/vehicleEntryRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_MARKET_VEHICLES')` |
| `backend/src/routes/partyRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_PARTIES')` |
| `backend/src/routes/entryRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_LR_ENGINE')` |
| `backend/src/routes/invoiceRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_BILLING_INVOICE')` |
| `backend/src/routes/settlementRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_SETTLEMENTS')` |
| `backend/src/routes/ledgerRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_LEDGERS')` |
| `backend/src/routes/customFieldRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_CUSTOM_FIELDS')` |
| `backend/src/routes/documentRoutes.ts` | Added `requireActiveSubscription` and `requireFeature('MOD_DOCUMENT_VAULT')` |
| `backend/src/routes/companyRoutes.ts` | Added `requireActiveSubscription` and `requireQuota('users')` on member invites |
| `frontend/src/stores/authStore.ts` | Added `enabledFeatures` and `limits` to `AuthState` |
| `frontend/src/stores/uiStore.ts` | Added automatic toast notification deduplication |
| `frontend/src/components/common/FeatureGate.tsx` | Enhanced with `pageMode`, tier perks, sparkle badges, and upgrade CTA buttons |
| `frontend/src/styles/components/featureGate.css` | Added styling for locked showcase cards and sidebar lock badges |
| `frontend/src/components/layout/Sidebar.tsx` | Added `PRO` and `STD` lock badges next to tier-restricted navigation items |
| `frontend/src/pages/settings/BillingPage.tsx` | Added immediate plan switching, scheduled downgrade banner with "Apply Immediately" button, and auth store re-hydration |
| `frontend/src/pages/settings/CustomFieldsPage.tsx` | Guarded API fetching and wrapped studio in `FeatureGate` when locked |
| `frontend/src/pages/commercial/LRListPage.tsx` | Guarded queries and wrapped with `FeatureGate('MOD_LR_ENGINE')` |
| `frontend/src/pages/commercial/InvoiceListPage.tsx` | Guarded queries and wrapped with `FeatureGate('MOD_BILLING_INVOICE')` |
| `frontend/src/pages/commercial/SettlementListPage.tsx` | Guarded queries and wrapped with `FeatureGate('MOD_SETTLEMENTS')` |
| `frontend/src/pages/commercial/LedgerListPage.tsx` | Guarded queries and wrapped with `FeatureGate('MOD_LEDGERS')` |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Testing Read-Only Mode on an Inactive Workspace
1. **Suspend a Tenant from Super-Admin**:
   - Open browser and log in as Super Admin at `http://localhost:5173/login`.
   - In the sidebar, click **Control Plane & Tenants** (`/super-admin`).
   - In the tenant table, pick a company (e.g. *Patel Roadways Logistics*) and click the **Suspend (red icon)** button. Notice the status pill turns orange/red (`suspended`).
2. **Log in as the Suspended Tenant**:
   - In an incognito tab, log in as that tenant's user (`rohit@patellogistics.com`).
   - Notice the top warning banner stating: *"Your workspace is in read-only mode due to an inactive subscription."*
3. **Verify Read Operations Work (Zero Disruption)**:
   - Click **Fleet & Trucks**, **Driver Master**, and **Freight Invoices**.
   - **What you should see**: All previous trucks, drivers, and bills load properly so operators can view history.
4. **Verify Write Operations are Blocked**:
   - Go to **Fleet & Trucks** (`/fleet/trucks`) and click the **"+ Add Truck"** button.
   - Enter vehicle number `MH12AB9999`, choose Make/Model, and click **"Save Truck"**.
   - **What you should see**: The request is rejected with a red error toast notification: *"Your workspace is currently suspended and restricted to read-only mode. Please renew your billing subscription to perform write actions."* The truck is not added.

---

### Test 2: Testing Feature Gating (Locked Tier Capabilities)
1. **Navigate to a Gated Feature as a Basic/Starter Tier User**:
   - Log in with a workspace on the **Starter Plan** (which does not include Custom Fields or Invoices).
   - In the sidebar, click **Custom Fields** (`/settings/custom-fields`).
2. **What You Should See on the Screen**:
   - You will see an elevated lock card with a lock icon and sparkles badge:
     > 🔒 **Requires PRO Enterprise Tier**  
     > *Custom Fields Studio is not included in your current subscription plan.*  
     > Button: **[Upgrade Plan to Unlock]**
   - Click the **"Upgrade Plan to Unlock"** button and verify it takes you directly to the SaaS Billing page.

---

### Test 3: Testing Resource Quota Enforcement (Trucks / Drivers / Team Seats)
1. **Check Your Plan Limit**:
   - Go to **Billing & Plans** (`/settings/billing`).
   - Check the resource meter: e.g. **Fleet Trucks: 5 / 5 trucks (Limit reached)**.
2. **Attempt to Add Beyond Quota**:
   - In the sidebar, click **Fleet & Trucks** (`/fleet/trucks`).
   - Click the **"+ Add Truck"** button.
   - Fill in the form and click **"Save Vehicle"**.
3. **What You Should See on the Screen**:
   - A warning alert modal or red error notification:
     > ⚠️ **Quota Exceeded (5/5 Trucks)**  
     > *You have reached the maximum truck capacity on your current plan. Please upgrade your tier or add a Fleet Capacity Booster to register more trucks.*
   - The vehicle creation is stopped and no extra vehicle is created.


