# Fleet Flow — Current State Audit (Feature-by-Feature)

**Audit Date:** October 2026  
**Auditor:** Principal Software Architect & QA Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Standardized Taxonomy:**  
`Confirmed defect` | `Confirmed security risk` | `Confirmed integration mismatch` | `Incomplete implementation` | `Mocked or simulated behavior` | `Missing feature` | `Improvement opportunity` | `Suspected risk requiring verification` | `Verified working` | `Not tested`  
**Severity Levels:** `P0` (Blocker / Critical Security / Financial Invariant) | `P1` (Major / Broken Feature / Contract Mismatch) | `P2` (Moderate / Degraded UX / Incomplete Workflow) | `P3` (Minor / Cosmetic / Documentation)

---

## 1. Domain: Multi-Tenant Foundation & Identity Access Management

### 1.1 Tenant Context Resolution & Request Scoping
- **Backend Components:** [tenantMiddleware.ts](../../backend/src/middleware/authMiddleware.ts#L18-L75), [tenantPlugin.ts](../../backend/src/plugins/tenantPlugin.ts#L79-L95)
- **Status:** `Confirmed security risk` | **Severity:** `P0`
- **Detailed Findings:**
  1. Five key route files completely omit `resolveTenantContext` middleware from their route pipelines:
     - [branchRoutes.ts](../../backend/src/routes/branchRoutes.ts#L10-L15)
     - [approvalRoutes.ts](../../backend/src/routes/approvalRoutes.ts#L10-L20)
     - [commercialReportRoutes.ts](../../backend/src/routes/commercialReportRoutes.ts#L10-L22)
     - [supportRoutes.ts](../../backend/src/routes/supportRoutes.ts#L10-L15)
     - [trackingRoutes.ts](../../backend/src/routes/trackingRoutes.ts#L25-L35)
  2. Because `resolveTenantContext` is not invoked, `AsyncLocalStorage` (`tenantStorage.run`) is never initiated for these requests. Any internal call to `getCurrentTenantId()` returns `undefined`.
  3. Subsequent middleware such as `requireRole(['admin'])` attempts to read `req.member` or `req.tenant`, which are `undefined`. Requests either throw unhandled 403 / 500 errors or execute queries where `company_id` is evaluated against `undefined`, risking cross-tenant data exposure or complete endpoint unavailability.

### 1.2 User Registration, Tenant Onboarding & Auth Flow
- **Backend Components:** [authController.ts](../../backend/src/controllers/authController.ts#L45-L120), [tenantController.ts](../../backend/src/controllers/companyController.ts#L20-L80)
- **Frontend Components:** [LoginPage.tsx](../../frontend/src/pages/auth/LoginPage.tsx), [RegisterPage.tsx](../../frontend/src/pages/auth/RegisterPage.tsx)
- **Status:** `Verified working` | **Severity:** `P2` (Minor Improvements)
- **Detailed Findings:**
  1. Standard email/password registration with bcrypt hashing (12 rounds) and JWT issuance is functionally intact.
  2. Default company creation attaches the registering user as the initial `admin` member.
  3. **Improvement opportunity:** Email verification tokens and password reset mechanisms rely on temporary un-hashed random tokens stored in memory rather than transactional email verification with expiring HMAC tokens.

### 1.3 Role-Based Access Control (RBAC) & Member Invitations
- **Backend Components:** [roleMiddleware.ts](../../backend/src/middleware/authMiddleware.ts#L12-L45), [CompanyMember.ts](../../backend/src/models/CompanyMember.ts)
- **Frontend Components:** [MembersPage.tsx](../../frontend/src/pages/team/TeamMembersPage.tsx)
- **Status:** `Incomplete implementation` | **Severity:** `P1`
- **Detailed Findings:**
  1. Role permissions (`admin`, `manager`, `operator`, `accountant`, `viewer`) are defined as static enum strings without fine-grained permission matrices.
  2. Member invitations issue an email payload that is merely logged to stdout (`logger.info`) when SMTP environment variables are unconfigured. No pending invitation verification state machine exists in the database.

---

## 2. Domain: Fleet & Asset Management

### 2.1 Truck Fleet Registry & Compliance Tracking
- **Backend Components:** [truckController.ts](../../backend/src/controllers/truckController.ts#L25-L150), [Truck.ts](../../backend/src/models/Truck.ts)
- **Frontend Components:** [TrucksPage.tsx](../../frontend/src/pages/fleet/TruckListPage.tsx), [TruckDetailPage.tsx](../../frontend/src/pages/fleet/TruckDetailPage.tsx)
- **Status:** `Verified working` | **Severity:** `N/A`
- **Detailed Findings:**
  1. Vehicle CRUD operations, registration number validation, chassis/engine number recording, and axle/capacity fields function properly.
  2. Document expiration tracking (Fitness, National Permit, Insurance, Pollution Under Control) triggers expiry warnings correctly based on timestamp comparison.

### 2.2 Driver Management & License Verification
- **Backend Components:** [driverController.ts](../../backend/src/controllers/driverController.ts#L18-L110), [Driver.ts](../../backend/src/models/Driver.ts)
- **Frontend Components:** [DriversPage.tsx](../../frontend/src/pages/fleet/DriverListPage.tsx)
- **Status:** `Verified working` | **Severity:** `P2`
- **Detailed Findings:**
  1. Driver onboarding, driving license (DL) number recording, contact numbers, and emergency contact details persist accurately.
  2. **Improvement opportunity:** Missing integration with government Sarathi API for automatic DL validity and endorsement verification.

### 2.3 Preventive Maintenance & Repair Logs
- **Backend Components:** [maintenanceController.ts](../../backend/src/controllers/maintenanceController.ts#L20-L95), [MaintenanceRecord.ts](../../backend/src/models/MaintenanceOrder.ts)
- **Frontend Components:** [MaintenanceDashboardPage.tsx](../../frontend/src/pages/fleet/MaintenanceDashboardPage.tsx)
- **Status:** `Confirmed integration mismatch` | **Severity:** `P1`
- **Detailed Findings:**
  1. In [dashboardController.ts](../../backend/src/controllers/dashboardController.ts#L84), the maintenance truck aggregation queries `{ status: 'maintenance' }`.
  2. In [Truck.ts](../../backend/src/models/Truck.ts#L32), the schema enum is strictly defined as `['active', 'in_maintenance', 'inactive', 'sold']`.
  3. Consequently, the dashboard always reports 0 trucks under maintenance regardless of active repair logs.

### 2.4 Live GPS Tracking & Telematics Fleet Map
- **Backend Components:** [trackingController.ts](../../backend/src/controllers/trackingController.ts#L100-L160), [GpsPing.ts](../../backend/src/models/VehicleLocationLog.ts)
- **Frontend Components:** [LiveTrackingPage.tsx](../../frontend/src/pages/operations/LiveFleetMapPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P1`
- **Detailed Findings:**
  1. In `trackingController.ts` (`getFleetLiveMap`, line 109), the query attempts:  
     `Truck.find({ company_id, is_active: true }).select('_id registration_number truck_type')`
  2. The `Truck` model does not possess `is_active` (it uses `status: 'active'`), `registration_number` (it uses `truck_no`), or `truck_type` (it uses `body_type`).
  3. The query returns an empty result set or stripped objects lacking vehicle identifiers, causing the Leaflet map markers in `LiveTrackingPage.tsx` to render with blank titles or fail to display entirely.
  4. Furthermore, `/api/tracking/live/fleet` is unmounted from `resolveTenantContext`, leaving `company_id` unpopulated when accessed by authenticated users.

---

## 3. Domain: Transport Operations & Logistics Execution

### 3.1 Gate Movement & Vehicle Entries
- **Backend Components:** [entryController.ts](../../backend/src/controllers/entryController.ts#L30-L180), [Entry.ts](../../backend/src/models/Entry.ts)
- **Frontend Components:** [EntriesPage.tsx](../../frontend/src/pages/operations/VehicleEntryListPage.tsx), [VehicleEntryListPage.tsx](../../frontend/src/pages/operations/VehicleEntryListPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P1`
- **Detailed Findings:**
  1. In [entryController.ts](../../backend/src/controllers/entryController.ts#L93), MongoDB aggregation pipeline queries:
     `{ $match: { company_id: companyId } }` where `companyId` is a raw string from `req.user.company_id`.
  2. Because MongoDB aggregation pipelines do not cast strings to `Types.ObjectId` (unlike standard Mongoose queries), all aggregation matches return zero documents, breaking entry metrics and summary statistics.

### 3.2 Lorry Receipt (LR / Bilty) Engine
- **Backend Components:** [entryController.ts](../../backend/src/controllers/entryController.ts#L25-L220), [LR.ts](../../backend/src/models/Entry.ts)
- **Frontend Components:** [LrListPage.tsx](../../frontend/src/pages/commercial/LRListPage.tsx)
- **Status:** `Verified working` | **Severity:** `P1` (Feature Flag Mismatch)
- **Detailed Findings:**
  1. LR numbering auto-increment per tenant company, consignor/consignee details, freight calculation, delivery terms, and package details generate correctly.
  2. PDF generation with printable 3-part layout executes as intended.
  3. **Critical Subscription Mismatch:** The LR engine is gated by `MOD_LR_ENGINE`. In `billingSeedService.ts`, this module is restricted to Standard Plan and above. However, the customer-facing `PricingPage.tsx` advertises "3-Part Printable LR / Bilty Generation" as an included feature of the Starter Plan.

### 3.3 Trip Journeys & Multi-Stop Dispatch
- **Backend Components:** [journeyController.ts](../../backend/src/controllers/journeyController.ts#L30-L210), [TruckJourney.ts](../../backend/src/models/TruckJourney.ts)
- **Frontend Components:** [JourneyListPage.tsx](../../frontend/src/pages/operations/JourneyListPage.tsx), [NewJourneyPage.tsx](../../frontend/src/pages/operations/NewJourneyPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P1`
- **Detailed Findings:**
  1. Aggregation pipeline in [journeyController.ts](../../backend/src/controllers/journeyController.ts#L127) passes string `companyId` into `$match`, failing to return aggregated operational metrics.
  2. Trip status transitions from `scheduled` to `in_transit` to `completed` persist, but closing settlements fail to reconcile against diesel expenses properly due to currency representation mismatches (see Section 4.3).

---

## 4. Domain: Commercial Operations, Billing & Accounting

### 4.1 GST Tax Invoicing
- **Backend Components:** [invoiceController.ts](../../backend/src/controllers/invoiceController.ts#L25-L260), [Invoice.ts](../../backend/src/models/Invoice.ts)
- **Frontend Components:** [InvoicesPage.tsx](../../frontend/src/pages/commercial/InvoiceListPage.tsx), [CreateInvoicePage.tsx](../../frontend/src/pages/commercial/InvoiceListPage.tsx)
- **Status:** `Verified working` | **Severity:** `P2`
- **Detailed Findings:**
  1. Tax calculation logic accurately bifurcates CGST/SGST (intra-state) versus IGST (inter-state) based on branch state code vs billing party state code.
  2. Reverse Charge Mechanism (RCM) flags for GTA services comply with Indian GST rules (5% RCM vs 12% forward charge).

### 4.2 Credit Notes & AR Adjustment
- **Backend Components:** [commercialReportController.ts](../../backend/src/controllers/commercialReportController.ts#L280-L330), [CreditNote.ts](../../backend/src/models/CreditNote.ts), [Invoice.ts](../../backend/src/models/Invoice.ts)
- **Frontend Components:** None (Missing UI)
- **Status:** `Confirmed defect` & `Confirmed integration mismatch` | **Severity:** `P0`
- **Detailed Findings:**
  1. In `commercialReportController.ts` (`createCreditNote`, lines 298–301), the code attempts:
     ```typescript
     await Invoice.updateOne(
       { _id: original_invoice_id },
       { $inc: { amount_paid_paise: total_adjustment_paise } }
     );
     ```
  2. The `Invoice` model defines `paid_amount` and `balance_amount` in rupee units. `amount_paid_paise` does not exist on the schema.
  3. Consequently, MongoDB creates a useless un-indexed `amount_paid_paise` property, while the actual `balance_amount` of the invoice remains completely unchanged.
  4. In the frontend sidebar (`Sidebar.tsx`, line 81), there is a navigation link to `/commercial/credit-notes`. However, `App.tsx` has no route registered for this path, and no `CreditNotesPage.tsx` component exists, resulting in a **dead link** redirecting to `/dashboard`.

### 4.3 Trip Profitability Analytics
- **Backend Components:** [commercialReportController.ts](../../backend/src/controllers/commercialReportController.ts#L120-L165)
- **Frontend Components:** [ProfitabilityPage.tsx](../../frontend/src/pages/fleet/MaintenanceDashboardPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P1`
- **Detailed Findings:**
  1. In `commercialReportController.ts` (`getTripProfitabilityReport`, lines 128–135), the code attempts to aggregate:
     `journey.total_freight_paise`, `journey.diesel_expense_paise`, and `journey.toll_expense_paise`.
  2. The `TruckJourney` schema defines these as `freight_rate`, `total_diesel_cost`, and `total_driver_expenses` in standard rupees.
  3. All profitability rows return `0` revenue, `0` expenses, and `0` net margin, rendering the trip profitability report completely broken in production.

### 4.4 Accounts Receivable (AR) Aging Report
- **Backend Components:** [commercialReportController.ts](../../backend/src/controllers/commercialReportController.ts#L40-L110)
- **Frontend Components:** [AgingReportPage.tsx](../../frontend/src/pages/commercial/AgingReportPage.tsx#L115-L125)
- **Status:** `Confirmed integration mismatch` | **Severity:** `P1`
- **Detailed Findings:**
  1. The backend controller groups aging buckets and projects the party as a string property: `{ party: partyName }`.
  2. The frontend `AgingReportPage.tsx` expects an object with nested properties: `{ item.party?.party_name }`.
  3. When rendered, evaluating a string with `?.party_name` evaluates to `undefined`, displaying placeholder dashes (`"—"`) for all customer names across the entire table.

### 4.5 General Ledger & Double-Entry Accounting
- **Backend Components:** [ledgerController.ts](../../backend/src/controllers/ledgerController.ts#L480-L540), [JournalEntry.ts](../../backend/src/models/Ledger.ts)
- **Frontend Components:** [LedgerPage.tsx](../../frontend/src/pages/commercial/LedgerListPage.tsx), [PartyBalancesPage.tsx](../../frontend/src/pages/parties/BalancePartyListPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P0`
- **Detailed Findings:**
  1. In `ledgerController.ts` (`recordPartyPayout`, lines 504–522), recording a vendor payout creates only a single debit leg without a corresponding credit leg to Cash/Bank and without assigning a `journal_id`. This directly violates the fundamental double-entry invariant ($\sum \text{Debits} \ne \sum \text{Credits}$).
  2. In `ledgerController.ts` (`getPartyBalances`, lines 393–436), the party balances pipeline aggregates exclusively from `VehicleEntry` freight documents and completely ignores records generated by `recordPartyPayout`.
  3. Because payouts are ignored, recorded vendor payments never deduct from the outstanding vendor balance, causing perpetual balance inflation.

---

## 5. Domain: SaaS Subscription, Quotas & Billing Engine

### 5.1 Subscription Plans & Pricing Discrepancy
- **Backend Components:** [billingSeedService.ts](../../backend/src/utils/billingSeedService.ts#L25-L90), [Plan.ts](../../backend/src/models/Plan.ts)
- **Frontend Components:** [SubscriptionPage.tsx](../../frontend/src/pages/settings/BillingPage.tsx), [PricingPage.tsx](../../frontend/src/pages/marketing/PricingPage.tsx)
- **Status:** `Confirmed integration mismatch` | **Severity:** `P1`
- **Detailed Findings:**
  1. Severe pricing and quota discrepancies exist between the marketing page and the backend database seed:
     - **Starter Plan:** `PricingPage.tsx` advertises ₹1,999/mo; `billingSeedService.ts` defines ₹1,499/mo (`149900` paise).
     - **Standard Plan:** `PricingPage.tsx` advertises ₹3,999/mo (15 trucks); `billingSeedService.ts` defines ₹4,999/mo (20 trucks).
     - **Pro / Enterprise:** `PricingPage.tsx` advertises ₹8,999/mo with unlimited trucks; `billingSeedService.ts` defines ₹9,999/mo with a 60-truck quota.
  2. As detailed in Section 3.2, `PricingPage.tsx` claims LR and Basic Invoicing are included in the Starter Plan, while backend feature gating (`MOD_LR_ENGINE`, `MOD_BILLING_INVOICE`) actively returns HTTP 403 Forbidden for Starter subscribers.

### 5.2 Razorpay Payment Gateway & Checkout Simulation
- **Backend Components:** [billingController.ts](../../backend/src/controllers/billingController.ts#L110-L195)
- **Frontend Components:** [SubscriptionPage.tsx](../../frontend/src/pages/settings/BillingPage.tsx)
- **Status:** `Mocked or simulated behavior` | **Severity:** `P1`
- **Detailed Findings:**
  1. When Razorpay API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are missing or configured as test placeholders, `billingController.ts` enters a simulation mode that directly transitions subscriptions to `active` without verifying digital signatures.
  2. While convenient for local development, this simulation path contains no environment guard (`process.env.NODE_ENV !== 'production'`), meaning that if keys fail to load in production, tenants can activate paid tiers without actual payment capture.

---

## 6. Domain: External Stakeholder Portals & Public Services

### 6.1 Customer & Consignor/Consignee Portal
- **Backend Components:** [portalController.ts](../../backend/src/controllers/portalController.ts#L40-L120)
- **Frontend Components:** [CustomerPortalPage.tsx](../../frontend/src/pages/portal/CustomerPortalPage.tsx)
- **Status:** `Confirmed defect` | **Severity:** `P0`
- **Detailed Findings:**
  1. In `portalController.ts` (`sendPortalOtp`, line 47), customer lookup searches:  
     `BillingParty.findOne({ company_id, contact_phone: phone })`.
  2. In `BillingParty.ts`, the phone number attribute is named `phone`, not `contact_phone`.
  3. Consequently, every customer OTP request fails with HTTP 404 (`Customer not found with this mobile number`), completely blocking customer portal authentication.

### 6.2 Vendor & Supplier Portal
- **Backend Components:** [portalController.ts](../../backend/src/controllers/portalController.ts#L60-L65)
- **Frontend Components:** [VendorPortalPage.tsx](../../frontend/src/pages/portal/VendorPortalPage.tsx#L43-L66)
- **Status:** `Confirmed defect` & `Mocked or simulated behavior` | **Severity:** `P0`
- **Detailed Findings:**
  1. In `portalController.ts` (lines 60–63), `sendPortalOtp` rejects any request where `portal_type === 'vendor'` with HTTP 400 (`Unsupported portal_type`).
  2. In `VendorPortalPage.tsx` (lines 43–66), the vendor portal view completely bypasses the backend API and renders hardcoded mock arrays of trips, invoices, and payment statuses.

### 6.3 Public Consignment Tracking
- **Backend Components:** [trackingController.ts](../../backend/src/controllers/trackingController.ts#L200-L245)
- **Frontend Components:** [PublicTrackPage.tsx](../../frontend/src/pages/public/PublicTrackingPage.tsx)
- **Status:** `Confirmed security risk` | **Severity:** `P0`
- **Detailed Findings:**
  1. In `trackingController.ts` (`publicTrackConsignment`, lines 201–205), document retrieval performs:  
     `Entry.findOne({ $or: [{ lr_no }, { bill_no }] })` without scoping by `company_id`.
  2. Consignment identifiers are tenant-specific (unique per `company_id`). When multiple transport companies use standard numbering sequences (e.g., `LR-1001`), the query returns an arbitrary company's shipment.
  3. The endpoint exposes full consignor names, delivery addresses, driver phone numbers, vehicle registrations, and real-time GPS coordinates to unauthenticated users without any rate-limiting safeguards.

---

## 7. Domain: Cross-Cutting & Extension Modules

### 7.1 Branch Hierarchy & Multi-Location Segregation
- **Backend Components:** [branchController.ts](../../backend/src/controllers/branchController.ts#L15-L80), [branchRoutes.ts](../../backend/src/routes/branchRoutes.ts)
- **Frontend Components:** [BranchesPage.tsx](../../frontend/src/pages/settings/BranchManagementPage.tsx)
- **Status:** `Confirmed defect` (via Missing Middleware) | **Severity:** `P0`
- **Detailed Findings:**
  1. As identified in Section 1.1, `branchRoutes.ts` does not mount `resolveTenantContext`.
  2. `branchController.ts` relies on `req.company._id` or `req.tenant.id`. In production, these are `undefined`, causing branch creation and listing to fail with 403 Forbidden or 500 Internal Server Error.

### 7.2 Multi-Level Approval Workflows
- **Backend Components:** [approvalController.ts](../../backend/src/controllers/approvalController.ts#L20-L115), [approvalRoutes.ts](../../backend/src/routes/approvalRoutes.ts)
- **Frontend Components:** [ApprovalsPage.tsx](../../frontend/src/pages/settings/ApprovalWorkflowPage.tsx)
- **Status:** `Confirmed defect` (via Missing Middleware) | **Severity:** `P0`
- **Detailed Findings:**
  1. `approvalRoutes.ts` does not mount `resolveTenantContext`.
  2. Workflow creation, status transitions (`pending`, `approved`, `rejected`), and manager audit trails fail in production because tenant context is lost.

### 7.3 Support Ticketing System
- **Backend Components:** [supportController.ts](../../backend/src/controllers/supportController.ts#L15-L90), [supportRoutes.ts](../../backend/src/routes/supportRoutes.ts)
- **Status:** `Confirmed defect` (via Missing Middleware) | **Severity:** `P0`
- **Detailed Findings:**
  1. `supportRoutes.ts` does not mount `resolveTenantContext`.
  2. Ticket creation queries and tenant-scoped ticket retrieval fail due to uninitialized tenant state.
