# Fleet Flow — Technical Repository Inventory

**Audit Date:** October 2026  
**Auditor:** Principal Software Architect & Systems Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Target Environment:** Node.js v24.19.0 / Windows Shell / Express + React + TypeScript + MongoDB  

---

## 1. Executive Summary & Repository Overview

Fleet Flow is designed as an enterprise multi-tenant Software-as-a-Service (SaaS) platform tailored for transport, freight forwarding, and fleet logistics companies operating in India. The application features a decoupled architecture with a TypeScript/Express backend running against MongoDB/Mongoose, and a TypeScript/React frontend powered by Vite.

The platform's business logic aims to address core logistics workflows:
1. **Multi-Tenant Foundation:** Tenant onboarding, company settings, branch partitioning, user invitation, role-based access control (RBAC), and subscription-tier feature flagging.
2. **Fleet & Driver Operations:** Vehicle lifecycle tracking, document compliance (PUC, Insurance, Fitness), maintenance scheduling, driver profiles, and live GPS tracking.
3. **Transport Operations:** Consignment booking (Lorry Receipts / Bilty), vehicle dispatch entries, trip journey logging, diesel issue tracking, and delivery confirmation.
4. **Commercial & Accounting:** GST-compliant freight billing, payment advances, double-entry general ledger, Accounts Receivable (AR) aging, trip profitability, and external stakeholder portals (Consignor/Consignee/Vendor).

---

## 2. Codebase Structure & File Inventory

The repository is organized as a monorepo-style workspace with two primary application directories (`backend` and `frontend`), alongside documentation and configuration roots.

```
TransportManagement/
├── backend/                         # Express & Mongoose Backend API
│   ├── src/
│   │   ├── config/                  # DB connection, Cloudinary, AWS S3
│   │   ├── controllers/             # HTTP Route Controllers (21 controllers)
│   │   ├── middleware/              # Auth, Tenant Context, RBAC, Rate Limit, Uploads
│   │   ├── models/                  # Mongoose Schemas & Interfaces (32 models)
│   │   ├── plugins/                 # Mongoose Tenant Isolation Plugin
│   │   ├── routes/                  # Express Route Definitions (23 route files)
│   │   ├── scripts/                 # Standalone maintenance & verification scripts
│   │   ├── services/                # Business logic, billing seeds, storage, PDF
│   │   ├── types/                   # Express request augmentations & DTOs
│   │   ├── utils/                   # Loggers, GST calc, date helpers, async handlers
│   │   └── workers/                 # Background maintenance & notification workers
│   ├── package.json
│   └── tsconfig.json
├── frontend/                        # React 18 & Vite SPA
│   ├── src/
│   │   ├── api/                     # Axios clients, interceptors & API hooks
│   │   ├── assets/                  # Static SVGs and branding assets
│   │   ├── components/              # Layout, UI library, forms, tables, modals
│   │   ├── context/                 # AuthContext, ThemeContext, TenantContext
│   │   ├── hooks/                   # Custom hooks (permissions, debounce, etc.)
│   │   ├── pages/                   # Route-level view components (35+ pages)
│   │   ├── store/                   # Global state (Zustand / Context)
│   │   ├── types/                   # Shared TypeScript models & API contracts
│   │   ├── utils/                   # Currency formatters, date utilities, validators
│   │   ├── App.tsx                  # Client router & route definition
│   │   ├── main.tsx                 # Entrypoint
│   │   └── index.css                # Global CSS tokens & Tailwind directives
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── docs/                            # Documentation
│   ├── issues/                      # Issue analysis files (ISSUE-01.md to ISSUE-14.md)
│   ├── plans/                       # Architecture & execution plans
│   └── audit/                       # Comprehensive System Audit Deliverables
├── ISSUES.md                        # Historical issue tracker log
├── MASTER_IMPLEMENTATION_PLAN.md    # Multi-tenant roadmap & architecture design
└── IMPLEMENTATION_CHANGELOG.md      # Record of previous refactor passes
```

---

## 3. Technology Stack & Dependencies

### 3.1 Backend Runtime & Dependencies
- **Runtime Environment:** Node.js (tested against Node.js v24.19.0).
- **Core Framework:** Express 4.x (`express`) with TypeScript (`typescript`, `tsx`, `@types/node`, `@types/express`).
- **Database & ODM:** MongoDB with Mongoose 8.x (`mongoose`).
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), password hashing with `bcryptjs`, CORS (`cors`), security headers (`helmet`), rate limiting (`express-rate-limit`).
- **File Management & Cloud Services:** `multer`, Cloudinary SDK (`cloudinary`), AWS SDK S3 client (`@aws-sdk/client-s3`), PDF generation (`pdfkit`, `jspdf`).
- **Validation & Utilities:** `zod`, `dotenv`, `winston` (logging), `uuid`.
- **Payment & Subscriptions:** Razorpay Node SDK (`razorpay`).

### 3.2 Frontend Runtime & Dependencies
- **Build Tool & Bundler:** Vite 5.x (`vite`, `@vitejs/plugin-react`).
- **Core Library:** React 18.x (`react`, `react-dom`).
- **Routing:** React Router DOM 6.x (`react-router-dom`).
- **Styling:** Tailwind CSS (`tailwindcss`, `postcss`, `autoprefixer`), Lucide React icons (`lucide-react`).
- **HTTP Client:** Axios (`axios`).
- **State Management:** Zustand (`zustand`) and React Context.
- **Data Display & UI:** Leaflet / React-Leaflet (`leaflet`, `react-leaflet`), Chart.js / Recharts for analytics.

---

## 4. Backend Inventory: Controllers, Routes, Models & Middleware

### 4.1 Route Controllers (`backend/src/controllers/`)
| Controller Name | File Path | Core Responsibilities |
|---|---|---|
| `authController` | `backend/src/controllers/authController.ts` | Superadmin/Tenant login, signup, token refresh, password resets |
| `tenantController` | `backend/src/controllers/companyController.ts` | Company registration, domain binding, member invitations |
| `truckController` | `backend/src/controllers/truckController.ts` | CRUD for fleet vehicles, document renewals, status transitions |
| `driverController` | `backend/src/controllers/driverController.ts` | Driver records, license verification, vehicle assignment |
| `entryController` | `backend/src/controllers/entryController.ts` | Vehicle gate entries, inward/outward records, diesel slips |
| `lrController` | `backend/src/controllers/lrController.ts` | Lorry Receipts (Bilty) generation, goods description, charges |
| `journeyController` | `backend/src/controllers/journeyController.ts` | Multi-stop trip journeys, freight advances, closing settlements |
| `invoiceController` | `backend/src/controllers/invoiceController.ts` | GST tax invoice generation, rate calculation, status updates |
| `billingController` | `backend/src/controllers/billingController.ts` | Subscription plans, Razorpay orders, subscription upgrades |
| `commercialReportController` | `backend/src/controllers/commercialReportController.ts` | AR aging reports, trip profitability, credit notes |
| `ledgerController` | `backend/src/controllers/ledgerController.ts` | Double-entry journal vouchers, party balances, payment payouts |
| `trackingController` | `backend/src/controllers/trackingController.ts` | GPS ping ingestion, fleet live map, public consignment tracking |
| `portalController` | `backend/src/controllers/portalController.ts` | External consignor/consignee/vendor OTP login & access |
| `branchController` | `backend/src/controllers/branchController.ts` | Company branch creation, GSTIN segregation, code management |
| `approvalController` | `backend/src/controllers/approvalController.ts` | Multi-level approval workflows for bills, advances, and expenses |
| `documentController` | `backend/src/controllers/documentController.ts` | Document upload, categorization, compliance expiry alerts |
| `maintenanceController` | `backend/src/controllers/maintenanceController.ts` | Service records, scheduled repairs, spare parts tracking |
| `customerController` | `backend/src/controllers/customerController.ts` | Billing parties, consignors, consignees directory |
| `vendorController` | `backend/src/controllers/vendorController.ts` | Market truck vendors, broker accounts, payment terms |
| `dashboardController` | `backend/src/controllers/dashboardController.ts` | High-level metrics, active fleet count, revenue summaries |
| `supportController` | `backend/src/controllers/supportController.ts` | In-app support tickets, priority assignments, resolution |

### 4.2 Route Definitions (`backend/src/routes/`)
| Route File | Base Path Mount | Authentication Middleware | Tenant Middleware |
|---|---|---|---|
| `authRoutes.ts` | `/api/auth` | Mixed (Public + `authenticate`) | Optional / Implicit |
| `tenantRoutes.ts` | `/api/tenants` | `authenticate` | Handled internally |
| `truckRoutes.ts` | `/api/trucks` | `authenticate` | `resolveTenantContext` |
| `driverRoutes.ts` | `/api/drivers` | `authenticate` | `resolveTenantContext` |
| `entryRoutes.ts` | `/api/entries` | `authenticate` | `resolveTenantContext` |
| `lrRoutes.ts` | `/api/lrs` | `authenticate` | `resolveTenantContext` |
| `journeyRoutes.ts` | `/api/journeys` | `authenticate` | `resolveTenantContext` |
| `invoiceRoutes.ts` | `/api/invoices` | `authenticate` | `resolveTenantContext` |
| `billingRoutes.ts` | `/api/billing` | `authenticate` | `resolveTenantContext` |
| `commercialReportRoutes.ts` | `/api/commercial` | `authenticate` | **MISSING** (Bypassed) |
| `ledgerRoutes.ts` | `/api/ledger` | `authenticate` | `resolveTenantContext` |
| `trackingRoutes.ts` | `/api/tracking` | Partial (Public endpoints) | **MISSING** on `/live`, `/ping` |
| `portalRoutes.ts` | `/api/portal` | `authenticatePortal` | Scoped via Portal Token |
| `branchRoutes.ts` | `/api/branches` | `authenticate` | **MISSING** (Bypassed) |
| `approvalRoutes.ts` | `/api/approvals` | `authenticate` | **MISSING** (Bypassed) |
| `documentRoutes.ts` | `/api/documents` | `authenticate` | `resolveTenantContext` |
| `maintenanceRoutes.ts` | `/api/maintenance` | `authenticate` | `resolveTenantContext` |
| `customerRoutes.ts` | `/api/customers` | `authenticate` | `resolveTenantContext` |
| `vendorRoutes.ts` | `/api/vendors` | `authenticate` | `resolveTenantContext` |
| `dashboardRoutes.ts` | `/api/dashboard` | `authenticate` | `resolveTenantContext` |
| `supportRoutes.ts` | `/api/support` | `authenticate` | **MISSING** (Bypassed) |

### 4.3 Mongoose Data Models (`backend/src/models/`)
The persistence layer defines 32 distinct Mongoose models:
- **Tenant & Identity:** `Company.ts`, `User.ts`, `CompanyMember.ts`, `Branch.ts`, `Role.ts`, `RefreshToken.ts`, `ApiKey.ts`
- **Subscription & Billing:** `SubscriptionPlan.ts`, `CompanySubscription.ts`, `PaymentTransaction.ts`, `BillingInvoice.ts`, `FeatureFlag.ts`
- **Fleet & Assets:** `Truck.ts`, `Driver.ts`, `TruckDocument.ts`, `MaintenanceRecord.ts`, `GpsPing.ts`, `TyreRecord.ts`
- **Logistics Operations:** `Entry.ts` (VehicleEntry), `LR.ts`, `TruckJourney.ts`, `DeliveryProof.ts`, `ConsignmentStatus.ts`
- **Commercial & Finance:** `Invoice.ts`, `CreditNote.ts`, `LedgerAccount.ts`, `JournalEntry.ts`, `PartyBalance.ts`, `BillingParty.ts`, `Vendor.ts`
- **System & Support:** `Document.ts`, `ApprovalRequest.ts`, `SupportTicket.ts`, `AuditLog.ts`

### 4.4 Middleware & Plugins (`backend/src/middleware/` & `backend/src/plugins/`)
- `authMiddleware.ts`: Verifies Bearer JWT, extracts `userId` and `superadmin` status.
- `tenantMiddleware.ts`: `resolveTenantContext` extracts `company_id` from JWT, header (`X-Company-ID`), or subdomain; validates active status and attaches to request and AsyncLocalStorage.
- `roleMiddleware.ts`: `requireRole(['admin', 'operator', ...])` verifies tenant membership permissions.
- `quotaMiddleware.ts`: Verifies resource counts against active subscription limits (e.g., maximum trucks).
- `tenantPlugin.ts`: Mongoose global/schema plugin intended to automatically inject `{ company_id: currentTenantId }` into Mongoose queries.
- `fileSecurityMiddleware.ts`: Intended to validate MIME type magic numbers on file uploads.
- `rateLimiter.ts`: Redis or memory-backed request throttling.

---

## 5. Frontend Inventory: Pages, Navigation, and Stores

### 5.1 Route Mapping & View Components (`frontend/src/pages/`)
| Category | Page Component | Route Path in `App.tsx` | Status |
|---|---|---|---|
| **Auth** | `LoginPage.tsx` | `/login` | Functional |
| | `RegisterPage.tsx` | `/register` | Functional |
| | `ForgotPasswordPage.tsx` | `/forgot-password` | Functional |
| **Dashboard** | `DashboardPage.tsx` | `/dashboard` | Functional |
| **Operations** | `EntriesPage.tsx` | `/entries` | Functional |
| | `CreateEntryPage.tsx` | `/entries/new` | Functional |
| | `LrListPage.tsx` | `/lrs` | Functional |
| | `CreateLrPage.tsx` | `/lrs/new` | Functional |
| | `LrDetailsPage.tsx` | `/lrs/:id` | Functional |
| | `JourneysPage.tsx` | `/journeys` | Functional |
| | `CreateJourneyPage.tsx` | `/journeys/new` | Functional |
| **Fleet** | `TrucksPage.tsx` | `/trucks` | Functional |
| | `TruckDetailsPage.tsx` | `/trucks/:id` | Functional |
| | `DriversPage.tsx` | `/drivers` | Functional |
| | `DriverDetailsPage.tsx` | `/drivers/:id` | Functional |
| | `LiveTrackingPage.tsx` | `/tracking` | Functional (Degraded data) |
| | `MaintenancePage.tsx` | `/maintenance` | Functional |
| **Commercial** | `InvoicesPage.tsx` | `/commercial/invoices` | Functional |
| | `CreateInvoicePage.tsx` | `/commercial/invoices/new` | Functional |
| | `AgingReportPage.tsx` | `/commercial/aging` | Functional (Display bug) |
| | `ProfitabilityPage.tsx` | `/commercial/profitability` | Functional (Zero calc bug) |
| | **Credit Notes** | **NONE** (`/commercial/credit-notes`) | **DEAD LINK (Missing Page)** |
| **Accounting** | `LedgerPage.tsx` | `/accounting/ledger` | Functional |
| | `PartyBalancesPage.tsx` | `/accounting/parties` | Functional |
| **Subscription**| `SubscriptionPage.tsx` | `/subscription` | Functional |
| | `PricingPage.tsx` | `/pricing` | Static Marketing (Data drift) |
| **Portals** | `CustomerPortalPage.tsx`| `/portal/customer` | Incomplete (OTP lookup bug)|
| | `VendorPortalPage.tsx` | `/portal/vendor` | **100% Mocked Data** |
| | `PublicTrackPage.tsx` | `/track` | Functional (Security leak) |
| **Settings** | `CompanySettingsPage.tsx`| `/settings/company` | Functional |
| | `BranchesPage.tsx` | `/settings/branches` | Functional (Tenant 403 bug) |
| | `MembersPage.tsx` | `/settings/members` | Functional |
| | `ApprovalsPage.tsx` | `/approvals` | Functional (Tenant 403 bug) |

---

## 6. Build, Test, and Runtime Execution Status

### 6.1 Package Installation & Environment Status
- **Node Modules Status:** Both backend and frontend currently do not have `node_modules` installed on disk. In accordance with strict audit constraints, no package managers (`npm install`, `pnpm`, `yarn`) were run.
- **Node Version:** Node.js v24.19.0 is installed on the host system.
- **Global Compilers:** Neither `tsc` nor `vite` are installed globally.
- **Testing Scripts Inventory:**
  - Located in `backend/src/scripts/`:
    - `verify_fix_audit.ts`
    - `verify_system_fixes.ts`
    - `seed_test_data.ts`
    - `test_tenant_isolation.ts`
  - **Critical Limitation of Test Scripts:** These standalone scripts run against models directly using isolated Mongoose connections. They **bypass the Express HTTP middleware pipeline**, which is why previous passes missed routing middleware omissions (such as missing `resolveTenantContext`).

---

## 7. Version Control & Git State

- **Current Branch:** Active workspace on `Vishal-8630/Fleet-Flow`.
- **Working Tree State:** Clean. No application source code, package files, or configuration files were modified during this audit.
- **Documentation Safety:** All audit deliverables are housed strictly within `docs/audit/`. Existing files `ISSUES.md`, `IMPLEMENTATION_CHANGELOG.md`, `MASTER_IMPLEMENTATION_PLAN.md`, and `docs/issues/` remain completely untouched.
