# Truck Management SaaS — Master End-to-End Implementation Plan

**Document Version:** 1.0.0  
**Status:** Approved Architecture Blueprint  
**Target Platform:** Multi-Tenant B2B Transport & Fleet Management SaaS  
**Reference Document:** [`TRUCK_MANAGEMENT_SAAS_COMPLETE_SPEC.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/TRUCK_MANAGEMENT_SAAS_COMPLETE_SPEC.md)

---

## Executive Summary

This Master Implementation Plan details the end-to-end execution roadmap for transforming the single-tenant Transport Management application into an enterprise-grade, multi-tenant B2B SaaS platform.

The plan enforces strict logical database isolation, server-authoritative entitlements, decimal-safe financial calculations, ACID transactional settlements, and a 100% database-driven pricing/customization engine—built upon a unified codebase serving small operators, regional fleets, and large brokerage enterprises.

---

## 1. Finalized Technology Stack & Architectural Standards

### Frontend Architecture
* **Core:** React 19 + TypeScript + Vite
* **Routing:** React Router v7 (`createBrowserRouter` / data router)
* **Client State Management:** Zustand (lightweight stores: `authStore`, `tenantStore`, `uiStore`, `filterStore`)
* **Server State & Data Fetching:** TanStack Query v5 + Axios (centralized interceptors for JWT refresh, tenant headers, normalized error toasts, and timeouts)
* **Forms & Validation:** React Hook Form + Zod (dynamic runtime schema synthesis matching backend rules)
* **Styling & CSS Architecture:** 
  * **Zero Tailwind CSS.**
  * **Generic Design System:** CSS custom properties (design tokens in `styles/tokens/`), modern reset (`styles/base/`), flex/grid layout utilities (`styles/layout/`), and reusable generic classes (`.btn`, `.card`, `.form-input`, `.data-table`, `.badge`, `.modal-backdrop` in `styles/components/`).
  * **Component Scoping:** CSS Modules (`[Component].module.css`) strictly reserved for complex canvas views (LR print templates, invoice layouts, and tracking timelines).
* **UI Micro-Animations & Icons:** `framer-motion` for transitions and modals; `lucide-react` for tree-shakeable icons.
* **Document & Export Utilities:** `jsPDF` + CSS Print Engine (`react-to-print`) for client-side responsive phone/laptop rendering; `xlsx` + `file-saver` for spreadsheet reporting.

### Backend & Database Architecture
* **Runtime & Framework:** Node.js (v20+ LTS) + Express.js 5
* **Database & ODM:** MongoDB Atlas (Cloud) + Mongoose 8+
* **Tenant Isolation:** Mongoose tenant plugin injecting indexed `company_id` on all operational queries (`find`, `findOne`, `countDocuments`, `update`, `aggregate`); JWT session claims as source-of-truth.
* **Financial Calculations:** Strict decimal-safe numeric representations (cents/paise integers or 2-decimal floats); multi-document ACID transactions via `mongoose.startSession()`.
* **Authentication & Security:** JWT in `HttpOnly`, `SameSite: strict` secure cookies; `bcryptjs` (salt rounds 12); `helmet`, `cors`, `express-rate-limit`, `mongo-sanitize`.
* **Storage:** AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) partitioned under `s3://bucket/tenants/{company_id}/...` with 15-minute presigned URLs.
* **Headless Background Services:** Puppeteer (strictly for background invoice PDF generation during automated messaging); Meta Cloud API / WhatsApp Web service worker with retry queues.
* **Billing Provider:** Razorpay Subscriptions (Indian domestic cards, UPI, NetBanking, GST B2B tax compliance) with HMAC-SHA256 verified idempotent webhooks.

---

## 2. Six-Phase Implementation Roadmap Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: FOUNDATION, MULTI-TENANCY & DESIGN SYSTEM (Weeks 1–2)                                  │
│  - Generic CSS Token System & Base UI Components (No Tailwind)                                   │
│  - Tenant & User Schemas, JWT Context Injection, Mongoose Scoping Plugin                         │
│  - Company Self-Signup, Workspace Setup & Role-Based Access Control (RBAC)                       │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────────────────────────┐
│  PHASE 2: MASTER DATA REGISTRIES & COMPLIANCE VAULT (Weeks 3–4)                                  │
│  - Truck Master Registry & S3 Compliance Document Vault (Fitness, Tax, Insurance, PUC)           │
│  - Driver KYC Registry (Aadhaar & DL Masking, S3 Presigned Document Access)                      │
│  - Customers (Billing Parties) & Sub-Contracted Vendors (Balance Parties)                        │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────────────────────────┐
│  PHASE 3: TRIP DISPATCH, EXPENSES & VEHICLE MOVEMENTS (Weeks 5–6)                                │
│  - Journey Planning, Route Checkpoints, Daily Milestone Progress Tracking                        │
│  - En-Route Fuel & Cash Expense Logging (Liters, Rate, Pump Slips, Driver Advances)              │
│  - Vehicle Entry Movement Logs, Halting Dues & Proof of Delivery (POD) Stock                     │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────────────────────────┐
│  PHASE 4: COMMERCIAL ENGINE — LR, INVOICES, SETTLEMENTS & LEDGER (Weeks 7–8)                     │
│  - 3-Part Lorry Receipt (LR / Bilty) Print Engine & Blank LR Generator                           │
│  - GST Freight Invoicing (RCM / Forward, CGST/SGST/IGST, Dynamic Charges, Instant PDF)           │
│  - ACID Driver Trip Settlement Engine (Diesel Variance Math, Net Balance, Advances)              │
│  - 17-Category Double-Entry Financial Ledger & Party Balance Reconciliation                      │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────────────────────────┐
│  PHASE 5: SAAS BILLING, ENTITLEMENTS & WORKSPACE CUSTOMIZATION (Weeks 9–10)                      │
│  - Central Feature Catalog (20 Modules), Precedence Waterfall & Dynamic Navigation               │
│  - Subscription Billing Engine (Razorpay Recurring, Proration Math, Webhooks, Dunning)           │
│  - Company Settings, Custom Fields Studio, Form Layouts & Workflow Approvals                     │
│  - Platform Super-Admin Control Plane (`/super-admin`) & Usage Quota Meters                      │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────────────────────────┐
│  PHASE 6: PUBLIC TRACKING, AUTOMATION, HARDENING & RELEASE (Weeks 11–12)                         │
│  - Public LR Milestone Tracking Portal (`/track/:lrNumber`) with Data Sanitization               │
│  - WhatsApp & Email Notification Dispatcher (Meta Cloud API / Resend)                            │
│  - End-to-End Test Verification Suite (Multi-tenant isolation, ACID concurrency, load tests)      │
│  - Backup/Restore Drill, Production Deployment & Operational Runbooks                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Phase Breakdowns

### Phase 1: Foundation, Multi-Tenancy & Design System
* **Goal:** Establish zero-leakage multi-tenancy, authentication, role-based security, and the complete generic design system.
* **Detailed Plan Document:** [`docs/plans/PHASE_1_FOUNDATION_AND_TENANCY.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_1_FOUNDATION_AND_TENANCY.md)
* **Key Deliverables:**
  1. CSS Design System: `tokens/`, `base/`, `layout/`, `components/` (pure CSS, variables, buttons, tables, forms, modals).
  2. Data Layer: `Company`, `User`, `CompanyMember` schemas; Mongoose `tenantPlugin` with pre-query hooks and compound indexes.
  3. Authentication Engine: Secure cookie-based JWT session issuance, password hashing, and invitation accept workflows.
  4. Middleware Pipeline: `requireAuth`, `resolveTenantContext`, `requireRole(['admin', 'dispatcher', 'accountant', 'viewer'])`.
  5. Application Shell: Responsive layout, dynamic sidebar, user profile, workspace switcher.

### Phase 2: Master Data Registries & Compliance Vault
* **Goal:** Secure, tenant-isolated asset and partner registries with document storage.
* **Detailed Plan Document:** [`docs/plans/PHASE_2_MASTER_REGISTRIES.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_2_MASTER_REGISTRIES.md)
* **Key Deliverables:**
  1. Truck Registry: Vehicle specs, driver assignment history, service intervals, soft-delete.
  2. Compliance Vault: S3 upload with presigned URLs; Fitness, Insurance, National Permit, State Permit, Tax, PUC expiry tracking.
  3. Driver Master: Aadhaar/DL PII masking, license verification, running advance balance tracking.
  4. Commercial Directories: Billing Parties (shippers/consignees with GSTIN) and Balance Parties (market truck vendors).
  5. Generic CRUD & Search: Server-side paginated tables with sorting, searching, and URL-persisted filters.

### Phase 3: Trip Dispatch, Expenses & Vehicle Movements
* **Goal:** Core operational trip management from dispatch to delivery closeout.
* **Detailed Plan Document:** [`docs/plans/PHASE_3_OPERATIONS_AND_DISPATCH.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_3_OPERATIONS_AND_DISPATCH.md)
* **Key Deliverables:**
  1. Journey Dispatch: Wizard assigning truck + driver (active conflict checks), checkpoints, starting cash advance, opening odometer.
  2. En-Route Milestones: Daily progress logging, incident and delay tracking.
  3. Fuel & Expense Engine: Itemized cash expenses, diesel fuel stops (liters, rate, pump slips).
  4. Delivery Closeout: Unloading timestamp, empty container return yard, POD slip attachment.
  5. Vehicle Movement Logs: Brokerage vehicle entries, freight dues, driver cash, kamisan (commission), halting fees.

### Phase 4: Commercial Engine — LR, Invoicing, Settlements & Ledger
* **Goal:** Complete financial accuracy, statutory tax compliance, and automated accounting reconciliation.
* **Detailed Plan Document:** [`docs/plans/PHASE_4_COMMERCIAL_FINANCE_SETTLEMENTS.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_4_COMMERCIAL_FINANCE_SETTLEMENTS.md)
* **Key Deliverables:**
  1. LR Print Engine: Client-side vector printable 3-part LR stationary (Consignor, Consignee, Driver/POD copy) and empty LR template.
  2. GST Invoicing Engine: Freight bills, dynamic extra charges, automated CGST/SGST/IGST calculation, RCM flags, instant PDF download.
  3. ACID Driver Settlement Engine: Multi-trip reconciliation, fuel variance formulas, net balance determination, advance reset wrapped in MongoDB ACID transactions.
  4. General Financial Ledger: 17-category double-entry ledger with automatic journal postings from settlements and vehicle entries.
  5. Party Balance Reconciliation: Brokerage balance statements with Excel export.

### Phase 5: SaaS Billing, Entitlements & Workspace Customization
* **Goal:** Complete commercial SaaS infrastructure, dynamic feature gates, customer customization studio, and super-admin controls.
* **Detailed Plan Document:** [`docs/plans/PHASE_5_SAAS_BILLING_ENTITLEMENTS_CUSTOMIZATION.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_5_SAAS_BILLING_ENTITLEMENTS_CUSTOMIZATION.md)
* **Key Deliverables:**
  1. Feature Catalog & Gating: 20 catalog modules, dependency resolution, `requireFeature` middleware, frontend `<FeatureGate>`.
  2. Subscription Billing: Dynamic `Plan` and `AddOn` catalog, Razorpay recurring subscriptions, cryptographic webhook idempotency.
  3. Proration & Dunning: Second-by-second proration math, 7-day payment failure grace period, graceful read-only degradation.
  4. Company Customization: Regional formatting (Indian Lakhs/Crores vs International), sequential numbering series, custom expense categories.
  5. Custom Fields Studio: Typed dynamic fields (`custom_fields: {}`) with runtime Zod synthesis and layout ordering.
  6. Super-Admin Portal (`/super-admin`): SaaS MRR metrics, tenant manager, trial extensions, plan catalog editor, and support impersonation.

### Phase 6: Public Tracking, Automation, Hardening & Release
* **Goal:** Customer-facing touchpoints, notifications, comprehensive testing, and production deployment runbooks.
* **Detailed Plan Document:** [`docs/plans/PHASE_6_HARDENING_VERIFICATION_RELEASE.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/plans/PHASE_6_HARDENING_VERIFICATION_RELEASE.md)
* **Key Deliverables:**
  1. Public Shipment Tracking: `/track/:lrNumber` route with sanitized milestone data (no driver phone, freight rates, or financial data exposed).
  2. Automated Notifications: Meta Cloud API / WhatsApp service worker and transactional emails (Resend/SendGrid) for LR and dispatch events.
  3. Executive Dashboard & Watchlists: High-performance MongoDB aggregation pipelines for 5 operational watchlists.
  4. Test Verification Suite: Automated cross-tenant penetration tests, quota boundary tests, concurrency settlement tests.
  5. Production Operations: Automated Atlas daily backup drills, health check endpoints, structured logging (`morgan`/`winston`), and deployment runbooks.

---

## 4. Definition of Done (DoD) for Every Feature

Every feature implemented across all phases must satisfy the following checklist before being marked `VERIFIED`:
1. **Multi-Tenant Scoping:** Verified that `company_id` is derived strictly from the server session and all database mutations are isolated.
2. **Server-Side Enforcement:** Validation, RBAC permissions, and module entitlements are enforced on the backend (not just client UI hiding).
3. **Data Integrity:** Numeric money fields use decimal-safe representations; multi-entity writes use ACID transactions.
4. **UX States:** Loading skeleton, empty state, validation error state, and responsive behavior on phone and desktop verified.
5. **Audit Logging:** Critical business state transitions and administrative actions record actor, action, timestamp, and metadata in `AuditLog`.
6. **Graceful Degradation:** When a module or subscription is suspended, records remain viewable/exportable while write mutations are safely blocked.
7. **Automated Testing:** Unit test for business logic and integration test for API route passes.

---

*Continue to individual Phase Plan documents for detailed step-by-step task breakdowns, file maps, schema definitions, and test assertions.*
