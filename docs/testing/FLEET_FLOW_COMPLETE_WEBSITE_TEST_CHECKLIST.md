# Fleet Flow — Complete Website Manual QA & Feature Testing Checklist

**Document Version:** 2.0.0 (repository-reconciled)  
**Status:** Master Manual QA Workbook; source-derived coverage appendix added after repository inspection  
**Target Application:** Fleet Flow B2B Transport & Fleet Management SaaS  
**Target Environment:** Local Dev (`http://localhost:5173` frontend, `http://localhost:5000` backend) & Production Staging  
**Author:** Principal QA Architect & Systems Engineering Reviewer  
**Repository State:** `main` @ `d22eb2275dec05fb0f163f076318f64d23249797`  
**Evidence Directory:** [`docs/testing/evidence/`](evidence/README.md)  
**Related Audit Reports:**
- [`docs/audit/WEBSITE_FEATURE_COMPLETENESS_AUDIT.md`](../audit/WEBSITE_FEATURE_COMPLETENESS_AUDIT.md)
- [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md)
- [`docs/IMPLEMENTATION_BATCHES.md`](../IMPLEMENTATION_BATCHES.md)

---

## Master Table of Contents

1. [Interactive QA Execution Instructions](#1-interactive-qa-execution-instructions)
2. [Master Testing Progress Dashboard](#2-master-testing-progress-dashboard)
3. [Master Test Inventory & Scope Metrics](#3-master-test-inventory--scope-metrics)
4. [Master Defect Register](#4-master-defect-register)
5. [Master Retest Register](#5-master-retest-register)
6. [Recommended Test Execution Sequence](#6-recommended-test-execution-sequence)
7. [The First 10 Manual Tests to Execute](#7-the-first-10-manual-tests-to-execute)
8. [Master Requirements Traceability Matrix](#8-master-requirements-traceability-matrix)
9. [Detailed Test Suites](#9-detailed-test-suites)
   - [Suite A: Website Access, Navigation, Shell & Layout (NAV)](#suite-a-website-access-navigation-shell--layout)
   - [Suite B: Authentication, Sessions & Account Access (AUTH)](#suite-b-authentication-sessions--account-access)
   - [Suite C: Marketing Website, Inquiries & Lead Capture (MKT)](#suite-c-marketing-website-inquiries--lead-capture)
   - [Suite D: Master Registries — Trucks, Drivers, Parties & Branches (MD)](#suite-d-master-registries--trucks-drivers-parties--branches)
   - [Suite E: Fleet Operations, Dispatches, Journeys & Fuel (OPS)](#suite-e-fleet-operations-dispatches-journeys--fuel)
   - [Suite F: Commercial Engine — LRs, Invoices & Credit Notes (COM)](#suite-f-commercial-engine--lrs-invoices--credit-notes)
   - [Suite G: Double-Entry Ledger, Settlements & Balance Integrity (FIN)](#suite-g-double-entry-ledger-settlements--balance-integrity)
   - [Suite H: Subscription Plans, Quotas & Payment Workflows (SUB)](#suite-h-subscription-plans-quotas--payment-workflows)
   - [Suite I: Public Tracking & Stakeholder Portals (PORT)](#suite-i-public-tracking--stakeholder-portals)
   - [Suite J: Uploads, Documents & Local Storage Jailing (DOC)](#suite-j-uploads-documents--local-storage-jailing)
   - [Suite K: Executive Dashboard, KPIs, Reports & Exports (DASH)](#suite-k-executive-dashboard-kpis-reports--exports)
   - [Suite L: Notifications, Approvals, Custom Fields & Support (SYS)](#suite-l-notifications-approvals-custom-fields--support)
   - [Suite M: Security, Tenant Isolation & Vulnerability Hardening (SEC)](#suite-m-security-tenant-isolation--vulnerability-hardening)
   - [Suite N: Accessibility, Responsive Breakpoints & Cross-Browser (A11Y)](#suite-n-accessibility-responsive-breakpoints--cross-browser)
   - [Suite O: Error Resilience, Network Failures & Recovery (ERR)](#suite-o-error-resilience-network-failures--recovery)
   - [Suite P: Deployment Readiness, Health Probes & SRE Tools (SRE)](#suite-p-deployment-readiness-health-probes--sre-tools)
10. [Audit Limitations & PO Clarification Items](#10-audit-limitations--po-clarification-items)

---

## 1. Interactive QA Execution Instructions

This Markdown document is designed as your **active testing workbook**. You can edit this file directly in VS Code, Obsidian, GitHub Web Editor, or any standard Markdown viewer.

### How to Execute and Record Tests

1. **Follow the Steps Sequentially:** Execute the test following the numbered steps under the test case.
2. **Update the Status Checkboxes:**
   - Each test case provides 5 mutually exclusive checkboxes:
     - `[x] Not tested` (Default state)
     - `[ ] Pass` (Verified exactly as expected)
     - `[ ] Fail` (Observed behavior deviates from expected result)
     - `[ ] Blocked` (Cannot execute due to prior failure or missing prerequisite)
     - `[ ] Needs investigation` (Ambiguous behavior or edge-case observed)
   - *Rule:* Select **exactly one** checkbox per test. Uncheck `Not tested` when marking the final result.
3. **Record Findings in the Fields:**
   - **Actual result:** Brief factual summary of what occurred on screen / API.
   - **Failure category:** Select the applicable failure classification (`UI`, `API`, `Validation`, `Database`, `Permission`, `Business logic`, `Integration`, `Environment`, `Unknown`).
   - **Failure reason:** Include specific error messages, HTTP status codes, or visual defects.
   - **Screenshot path:** Link your saved image in [`docs/testing/evidence/`](evidence/README.md).
4. **Log Defects:** Whenever a test fails, add an entry to the [Master Defect Register](#4-master-defect-register).
5. **Update Progress Counters:** Periodically tally results in the [Master Testing Progress Dashboard](#2-master-testing-progress-dashboard).

---

## 2. Master Testing Progress Dashboard (Legacy Baseline Only)

**Important:** The counts in this original dashboard refer only to the original 175-case checklist. They do not include the additional route, page, API, model, regression and end-to-end coverage added in the repository-reconciled appendices below. Track the appendices separately or update these totals as you execute tests. Do not treat 175 as the total coverage of this version.

*Update these summary counts as you execute the legacy baseline tests:*

| Metric | Count | Percentage | Target for MVP Launch Gate |
| :--- | :---: | :---: | :---: |
| **Legacy baseline cases** | **175** | — | Execute all applicable cases plus the source-derived coverage appendix |
| **Not Tested** | 175 | 100.0% | 0 (All executed) |
| **Passed** | 0 | 0.0% | 100% of P0 & P1 tests |
| **Failed** | 0 | 0.0% | 0 Active P0/P1 Defects |
| **Blocked** | 0 | 0.0% | 0 Unresolved Blockers |
| **Needs Investigation** | 0 | 0.0% | 0 Unresolved Discrepancies |

### Progress by Test Priority

| Priority Tier | Total Tests | Pass | Fail | Blocked | Not Tested | Gate Criteria |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **P0 (Security & Data Integrity)** | 35 | 0 | 0 | 0 | 35 | **100% Pass Required** |
| **P1 (Core Operational & Financial)** | 65 | 0 | 0 | 0 | 65 | **100% Pass Required** |
| **P2 (Usability, SRE & Edge-Cases)**| 55 | 0 | 0 | 0 | 55 | **95% Pass / Documented Risk** |
| **P3 (Post-Launch & Enhancements)** | 20 | 0 | 0 | 0 | 20 | Non-blocking roadmap |

---

## 3. Master Test Inventory & Scope Metrics

The original 175-case suite is the legacy baseline. The appended source-derived inventories expand it substantially. Counts and exact paths from the uploaded ZIP are listed in the repository-reconciled appendices; source presence is not runtime verification. The earlier narrative below is historical and must be read alongside the appendices, which correct its route/model/API counts. The test cases in this workbook were derived through source inspection of the uploaded repository:

- **Frontend routes:** See the source-derived route inventory in Appendix A. The earlier 48-route estimate is retained only as historical audit metadata and is not treated as authoritative.
- **Page components:** Count and file list are supplied in Appendix A from the uploaded repository.
- **Interactive Modals & Dialogs:** 21 interactive modal forms (e.g. Add Truck, Add Driver, Add Party, Issue Credit Note, Settlement, Journey Expense).
- **Backend API declarations:** Source scan found 191 route declarations across 27 route files; see Appendix B. Aliases and mounted base paths are included where resolved.
- **Mongoose model files:** 37 files under `backend/src/models/`; see Appendix C for the exact names. Do not rely on the older 18-model estimate.
- **Calculations & Invariants Covered:** Double-entry ledger balance ($\sum D == \sum C$), GST calculation (18% Forward/RCM), Net invoice balance decrement on credit notes, Driver trip balance arithmetic, AR aging bucket classification, and Trip gross margin calculations.
- **Status Transition Lifecycles:**
  - Journey: `created` → `in_transit` → `completed` → `settled`.
  - Invoice: `unpaid` → `partially_paid` → `paid` / `cancelled`.
  - Subscription: `trialing` → `active` → `past_due` → `cancelled` / `expired`.
  - Truck: `available` → `in_transit` → `in_maintenance` → `decommissioned`.

---

## 4. Master Defect Register

*When a test case fails, log it here with a unique DEF ID and reference the failing Test ID:*

| Defect ID | Associated Test ID | Severity | Component | Summary of Defect / Root Cause | Status | Fixed in Commit |
| :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **DEF-001** | `MKT-003` | P1 | Marketing Contact Form | `fleet_size` `<select>` values mismatch `LeadInquiry.ts` enum. Causes HTTP 500 on all demo requests. | Open | Pending Patch |
| **DEF-002** | `SUB-006` | P1 | Quota Concurrency | TOCTOU check-then-insert race condition on truck/branch creation under parallel requests. | Open (Risk) | Carried Forward |
| *DEF-003* | | | | | | |

---

## 5. Master Retest Register

*Log retest verification once a fix has been committed:*

| Defect ID | Associated Test ID | Original Failure Date | Retest Date | Retester | Retest Outcome | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| *DEF-001* | `MKT-003` | 2026-10-14 | | | [ ] Pass [ ] Fail | Retest after enum alignment |

---

## 6. Recommended Test Execution Sequence

To prevent workflow blocking and respect structural data dependencies, execute testing in this order:

```text
[Stage 1: Preflight & Public Access] (NAV, MKT)
                  │
                  ▼
[Stage 2: Authentication & Multi-Tenancy] (AUTH, SEC)
                  │
                  ▼
[Stage 3: Onboarding & Master Data Registries] (MD)
                  │
                  ▼
[Stage 4: Operations & Trip Execution] (OPS)
                  │
                  ▼
[Stage 5: Commercial Freight, LRs & Invoices] (COM)
                  │
                  ▼
[Stage 6: Double-Entry Ledger & Settlements] (FIN)
                  │
                  ▼
[Stage 7: Public Tracking & Stakeholder Portals] (PORT)
                  │
                  ▼
[Stage 8: Subscription Gating & Dynamic Billing] (SUB)
                  │
                  ▼
[Stage 9: Dashboards, Reports, Watchlists & Exports] (DASH, SYS)
                  │
                  ▼
[Stage 10: SRE, Responsive UI, Error Recovery & Infrastructure] (A11Y, ERR, SRE)
```

---

## 7. The First 10 Manual Tests to Execute

Start your testing session by executing these 10 foundational tests:

1. **`NAV-001`** — Verify public homepage loads with brand styling and responsive navigation.
2. **`MKT-003`** — Submit Demo Request form on `/contact` (Verifies known P1 enum defect `DEF-001`).
3. **`AUTH-001`** — Register a fresh tenant workspace on `/register`.
4. **`AUTH-005`** — Log out and log back in on `/login` to confirm session cookie persistence.
5. **`MD-001`** — Create an owned truck on `/fleet/trucks` (`MH12AB1234`).
6. **`MD-015`** — Create a driver on `/fleet/drivers` with license validation.
7. **`MD-025`** — Create a Billing Party with real GSTIN checksum validation (`27AABCT3518Q1ZV`).
8. **`OPS-001`** — Create a trip dispatch journey on `/operations/journeys/new`.
9. **`COM-001`** — Generate a 3-part Lorry Receipt (LR) on `/bill-entry/all` and test print preview.
10. **`SUB-001`** — Verify `/pricing` dynamically loads catalog from backend (`GET /api/billing/plans`).

---

## 8. Master Requirements Traceability Matrix

| Master Register ID | Canonical Requirement Title | Implementation Location | Verification Test ID |
| :--- | :--- | :--- | :--- |
| **ISS-001** | Tenant Context Middleware Bypass | `backend/src/routes/*.ts` | `SEC-001`, `SEC-002` |
| **ISS-002** | Mongoose Tenant Interception Plugin | `backend/src/plugins/tenantPlugin.ts` | `SEC-003`, `SEC-004` |
| **ISS-003** | Credit Note Balance Reduction Failure | `controllers/commercialReportController.ts` | `COM-015`, `COM-016` |
| **ISS-004** | Vendor Payout Ledger Reconciliation | `controllers/ledgerController.ts` | `FIN-010`, `FIN-011` |
| **ISS-005** | Public Tracking Privacy & IDOR Prevention | `controllers/trackingController.ts` | `PORT-001`, `PORT-002` |
| **ISS-006** | Stakeholder Portals Authentication Breakdown| `controllers/portalController.ts` | `PORT-008`, `PORT-015` |
| **ISS-007** | Live Fleet Map Projection Mismatch | `controllers/trackingController.ts` | `OPS-025` |
| **ISS-008** | Missing Credit Notes Page Component | `frontend/src/pages/commercial/CreditNotesPage.tsx` | `COM-014` |
| **ISS-009** | AR Aging Table Blank Customer Names | `controllers/commercialReportController.ts` | `FIN-020` |
| **ISS-010** | Trip Profitability Zero Calculation Bug | `controllers/commercialReportController.ts` | `FIN-025` |
| **ISS-011** | Pricing Page Contradicts Backend Seeds | `frontend/src/pages/marketing/PricingPage.tsx` | `SUB-001` |
| **ISS-012** | Starter Plan Entitlement Trap Blocks LRs | `backend/src/utils/billingSeedService.ts` | `SUB-010` |
| **ISS-013** | Unsafe Payment Checkout Simulation | `controllers/billingController.ts` | `SUB-018` |
| **ISS-014** | MongoDB Aggregation String companyId | `controllers/*.ts` | `DASH-002`, `FIN-021` |
| **ISS-015** | Dashboard Maintenance Truck Counter Enum | `controllers/dashboardController.ts` | `DASH-005` |
| **ISS-016** | Unmounted File Security Magic Bytes | `middlewares/fileSecurityMiddleware.ts` | `DOC-001`, `DOC-002` |
| **ISS-017** | Local Storage Path Traversal Root Jail | `utils/storageService.ts` | `DOC-005` |
| **ISS-018** | Multi-Document ACID Transactions | `utils/transactionHelper.ts` | `OPS-006`, `SRE-005` |
| **ISS-019** | Client-Side Idempotency Key Omission | `frontend/src/api/client.ts` | `COM-008` |
| **ISS-020** | Portal OTP Rate Limiting & Abuse Defense | `controllers/portalController.ts` | `PORT-005` |
| **ISS-021** | Custom Field Prototype Pollution Defense| `controllers/customFieldController.ts` | `SYS-010` |
| **IMP-001** | GSTIN & PAN Checksum Engine | `backend/src/utils/gstUtils.ts` | `MD-026` |
| **IMP-004** | Compound Multi-Tenant Database Indexes | `backend/src/models/*.ts` | `SEC-005` |
| **OPS-001** | Multi-Environment Docker Compose Architecture| `docker-compose.yml`, `nginx.conf` | `SRE-010` |
| **OPS-003** | Automated Database Backup & Recovery | `scripts/backup.sh`, `scripts/restore.sh` | `SRE-008`, `SRE-009` |
| **OPS-005** | Deep Health & Readiness Check Probes | `backend/src/routes/healthRoutes.ts` | `SRE-001`, `SRE-002` |
| **DEC-001** | Commercial Pricing & Entitlement Matrix | Approved Matrix | `SUB-002` |
| **DEC-002** | MongoDB Replica Set Strategy | Approved Strategy | `SRE-005` |
| **DEC-003** | Cloud Object Storage Decision | Pending S3 Approval (Local Jail Active) | `DOC-010` |

---

## 9. Detailed Test Suites

---

### Suite A: Website Access, Navigation, Shell & Layout

#### NAV-001 — Public Marketing Homepage Load & Branding
- **Module:** Public Navigation & Brand Shell
- **Priority:** P1
- **Type:** UI & Visual Smoke
- **Requirement/source:** [`frontend/src/pages/marketing/HomePage.tsx`](../../frontend/src/pages/marketing/HomePage.tsx)
- **Preconditions:** Browser open, dev server running on `http://localhost:5173`.
- **Test data:** URL `http://localhost:5173/` or `http://localhost:5173/home`.
- **Steps:**
  1. Open browser and navigate to `http://localhost:5173/`.
  2. Inspect browser tab title and favicon.
  3. Verify top navigation bar renders brand logo (`Truck` icon) and name "Fleet Flow".
  4. Verify links: "Features", "Pricing", "Security", "Help Center", "Contact", "Sign In", "Get Started".
  5. Scroll to footer and verify copyright, version, and legal links.
- **Expected result:** Page renders cleanly in dark theme (`#0a0a0a`), typography is crisp, hero headline reads "The Operating System for Modern Indian Fleet Operators", no horizontal scrollbar or console errors.
- **Evidence to collect:** Screenshot of Hero section and Footer.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/NAV-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### NAV-002 — Public Header Navigation Links
- **Module:** Public Navigation
- **Priority:** P2
- **Type:** Navigation Flow
- **Requirement/source:** [`frontend/src/components/layout/PublicLayout.tsx`](../../frontend/src/components/layout/PublicLayout.tsx)
- **Preconditions:** On public homepage.
- **Test data:** Nav items: Features (`/features`), Pricing (`/pricing`), Security (`/security`), Contact (`/contact`).
- **Steps:**
  1. Click "Features" in header → verify navigation to `/features`.
  2. Click "Pricing" in header → verify navigation to `/pricing`.
  3. Click "Security" in header → verify navigation to `/security` (PrivacyPage).
  4. Click "Contact" in header → verify navigation to `/contact`.
  5. Click browser "Back" button twice and verify history navigation operates smoothly without full page reloads.
- **Expected result:** All routes resolve immediately without 404s, white flashes, or dead links.
- **Evidence to collect:** Screenshot of each marketing page loaded.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/NAV-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### NAV-003 — Authenticated Workspace Sidebar Links & Active Highlight
- **Module:** Workspace App Layout
- **Priority:** P1
- **Type:** UI Navigation
- **Requirement/source:** [`frontend/src/components/layout/Sidebar.tsx`](../../frontend/src/components/layout/Sidebar.tsx)
- **Preconditions:** Authenticated as Company Admin (`admin` role).
- **Test data:** Workspace route `/dashboard`.
- **Steps:**
  1. Log into workspace and observe vertical left sidebar.
  2. Click each sidebar navigation item in order:
     - Dashboard (`/dashboard`)
     - Fleet & Trucks (`/fleet/trucks`)
     - Driver Master (`/fleet/drivers`)
     - Billing Parties (`/parties/billing`)
     - Balance Parties (`/parties/balance`)
     - Trip Dispatch (`/operations/journeys`)
     - Live Fleet Map (`/operations/live-map`)
     - Market Movements (`/operations/market-entries`)
     - Bill Entries & LR (`/bill-entry/all`)
     - Freight Invoices (`/invoices`)
     - Credit Notes (`/commercial/credit-notes`)
     - AR Aging Report (`/commercial/aging`)
     - Driver Settlements (`/settlements`)
     - General Ledger (`/ledger`)
     - Team & Access (`/team`)
     - Branches & Hubs (`/settings/branches`)
     - Billing & Plans (`/settings/billing`)
     - Company Settings (`/settings/company`)
     - Support Tickets (`/support/tickets`)
     - Profile & Security (`/settings/profile`)
  3. Confirm the active link displays an illuminated accent background (`.active`).
- **Expected result:** Every route renders its respective page container within `<Outlet />`. Zero dead links, zero 404 redirects, zero white-screen crashes.
- **Evidence to collect:** Screenshot of sidebar with active route highlighting.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/NAV-003/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### NAV-004 — Mobile Sidebar Drawer Toggle & Backdrop Dismissal
- **Module:** Responsive Navigation
- **Priority:** P2
- **Type:** Responsive & Touch UI
- **Requirement/source:** [`frontend/src/components/layout/AppLayout.tsx`](../../frontend/src/components/layout/AppLayout.tsx)
- **Preconditions:** Browser window resized to mobile width (375px width, iPhone SE / Pixel viewport).
- **Test data:** Viewport width 375px.
- **Steps:**
  1. Open DevTools device emulator (width: 375px, height: 812px).
  2. Observe sidebar is hidden by default.
  3. Click hamburger menu icon (`Menu`) in top Navbar.
  4. Verify sidebar slides in smoothly over content with a dim dark backdrop (`.sidebar-backdrop.active`).
  5. Click anywhere on the dim backdrop outside the drawer.
  6. Verify drawer closes smoothly.
  7. Re-open drawer and click a navigation link (e.g. "Fleet & Trucks").
- **Expected result:** Drawer navigates to the selected page and automatically closes the mobile drawer upon route change.
- **Evidence to collect:** Screenshot of mobile open drawer and backdrop.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/NAV-004/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### NAV-005 — Unknown Route / Catch-All Fallback Redirect
- **Module:** Client-Side Routing
- **Priority:** P2
- **Type:** Error Handling & Fallback
- **Requirement/source:** [`frontend/src/App.tsx`](../../frontend/src/App.tsx)
- **Preconditions:** Authenticated user session.
- **Test data:** Random URL `http://localhost:5173/non-existent-random-page-12345`.
- **Steps:**
  1. Type `http://localhost:5173/non-existent-random-page-12345` into browser address bar.
  2. Press Enter.
- **Expected result:** The application catch-all route (`<Route path="*" ... />`) catches the invalid path and redirects gracefully to `/dashboard` (or `/home` if unauthenticated) without crashing.
- **Evidence to collect:** Screenshot of redirected dashboard page with URL bar visible.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/NAV-005/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite B: Authentication, Sessions & Account Access

#### AUTH-001 — New Company & Admin User Registration
- **Module:** Authentication & Tenant Creation
- **Priority:** P0 (Release Blocker)
- **Type:** Functional End-to-End
- **Requirement/source:** [`frontend/src/pages/auth/RegisterPage.tsx`](../../frontend/src/pages/auth/RegisterPage.tsx), `backend/src/controllers/authController.ts`
- **Preconditions:** Clean browser incognito window or logged-out state.
- **Test data:**
  - Company Name: `Sharma Roadways Logistics Private Limited`
  - Full Name: `Rajesh Sharma`
  - Email: `rajesh.sharma+test1@sharmalogistics.in`
  - Phone: `9820198201`
  - Password: `Password@12345!`
- **Steps:**
  1. Navigate to `http://localhost:5173/register`.
  2. Fill in all form fields with test data.
  3. Click "Create Workspace & Start 14-Day Free Trial".
  4. Observe network request `POST /api/auth/register` in DevTools.
  5. Observe redirect target.
- **Expected result:**
  - Backend responds with HTTP 201 Created and sets an `HttpOnly` session cookie `token`.
  - Frontend stores user profile in Zustand.
  - Automatically redirects user to Onboarding Setup (`/onboarding/setup`) or Workspace Dashboard (`/dashboard`).
  - Welcome toast notification displays: "Workspace created successfully".
- **Evidence to collect:** Screenshot of filled registration form, DevTools network request 201, and landing dashboard view.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-002 — Registration Form Field Validation (Omission & Bad Formats)
- **Module:** Form Validation
- **Priority:** P1
- **Type:** Boundary & Validation
- **Requirement/source:** [`frontend/src/pages/auth/RegisterPage.tsx`](../../frontend/src/pages/auth/RegisterPage.tsx)
- **Preconditions:** On `/register` page.
- **Test cases to execute individually:**
  1. **Empty Submit:** Click "Create Workspace" with zero fields entered → verify inline error or warning toast: "Please fill in all required fields".
  2. **Short Password:** Enter password `123` (< 6 chars) → verify validation error.
  3. **Invalid Email:** Enter `notanemail` → verify standard email format rejection.
  4. **Invalid Phone:** Enter `abc123` or `123` (< 10 digits) → verify phone validation rejection.
  5. **Duplicate Email:** Re-submit the exact email used in `AUTH-001` → verify HTTP 400/409 error: "An account with this email address already exists."
- **Expected result:** Every validation check triggers clear inline error messages without submitting to backend (except duplicate check which displays backend message).
- **Evidence to collect:** Screenshots of inline error states.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-003 — Standard User Login with Valid Credentials
- **Module:** Authentication
- **Priority:** P0 (Release Blocker)
- **Type:** Functional
- **Requirement/source:** [`frontend/src/pages/auth/LoginPage.tsx`](../../frontend/src/pages/auth/LoginPage.tsx)
- **Preconditions:** User registered in `AUTH-001`.
- **Test data:**
  - Email: `rajesh.sharma+test1@sharmalogistics.in`
  - Password: `Password@12345!`
- **Steps:**
  1. Navigate to `http://localhost:5173/login`.
  2. Enter valid email and password.
  3. Click "Sign In to Workspace".
  4. Inspect DevTools Cookies: check `token` cookie attributes (`HttpOnly`, `SameSite=Lax`).
- **Expected result:** Authenticates immediately, button shows loading spinner during request, redirects to `/dashboard`, top Navbar displays "Sharma Roadways Logistics" and user initials.
- **Evidence to collect:** Screenshot of login form and authenticated dashboard Navbar.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-003/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-004 — Invalid Login Rejection & Password Masking
- **Module:** Authentication Security
- **Priority:** P1
- **Type:** Security & UI
- **Requirement/source:** [`frontend/src/pages/auth/LoginPage.tsx`](../../frontend/src/pages/auth/LoginPage.tsx)
- **Preconditions:** On `/login` page.
- **Test data:** Email `rajesh.sharma+test1@sharmalogistics.in`, Wrong Password `WrongPassword999!`.
- **Steps:**
  1. Enter registered email and wrong password.
  2. Verify password input field masks characters (`type="password"`).
  3. Click eye icon toggle if present to unmask and verify entered text.
  4. Click "Sign In".
- **Expected result:** Server responds with HTTP 401 Unauthorized (`Invalid credentials`), toast or alert displays "Invalid email or password", form remains populated with email, password field is cleared or focused. Zero internal stack traces exposed.
- **Evidence to collect:** Screenshot of 401 error message toast.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-004/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-005 — Session Persistence Across Hard Browser Refresh
- **Module:** Session Lifecycle
- **Priority:** P0 (Release Blocker)
- **Type:** Session State
- **Requirement/source:** [`frontend/src/stores/authStore.ts`](../../frontend/src/stores/authStore.ts), `GET /api/auth/me`
- **Preconditions:** Authenticated and viewing `/fleet/trucks`.
- **Test data:** Active session.
- **Steps:**
  1. Open `/fleet/trucks`.
  2. Press `Ctrl + F5` (Hard Browser Refresh).
  3. Observe initial loading spinner ("Loading Fleet Flow Workspace...").
  4. Observe whether `GET /api/auth/me` executes and verifies session.
- **Expected result:** User remains authenticated on `/fleet/trucks` without being kicked back to `/login`.
- **Evidence to collect:** Screenshot of restored view post-refresh.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-005/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-006 — User Logout & Session Cookie Destruction
- **Module:** Authentication
- **Priority:** P1
- **Type:** Functional
- **Requirement/source:** [`frontend/src/components/layout/Navbar.tsx`](../../frontend/src/components/layout/Navbar.tsx), `POST /api/auth/logout`
- **Preconditions:** Authenticated in workspace.
- **Test data:** Logged-in session.
- **Steps:**
  1. Click "Sign Out" button (`LogOut` icon) in top right of Navbar.
  2. Observe network request `POST /api/auth/logout`.
  3. Observe redirect to `/login`.
  4. Press browser "Back" button.
- **Expected result:**
  - Session cookie `token` is cleared (`Max-Age=0`).
  - Browser redirect to `/login` completes.
  - Pressing "Back" does NOT display authenticated data; ProtectedRoute intercepts and keeps user on `/login`.
- **Evidence to collect:** Screenshot of login page after logout and cleared cookies tab in DevTools.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-006/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### AUTH-007 — Role-Based Route Protection (Dispatcher Role Restrictions)
- **Module:** Role-Based Access Control (RBAC)
- **Priority:** P1
- **Type:** Security Boundary
- **Requirement/source:** [`frontend/src/components/layout/Sidebar.tsx`](../../frontend/src/components/layout/Sidebar.tsx), `authMiddleware.ts`
- **Preconditions:** Create a user with role `dispatcher` under Company Settings or Team Members.
- **Test data:** Dispatcher user credentials.
- **Steps:**
  1. Log in as Dispatcher.
  2. Inspect sidebar links: Confirm "General Ledger", "Credit Notes", "AR Aging", "Company Settings", and "Billing & Plans" are NOT visible.
  3. Manually type `http://localhost:5173/ledger` into address bar and press Enter.
  4. Manually type `http://localhost:5173/settings/billing` into address bar and press Enter.
- **Expected result:** Direct URL access to restricted routes is blocked by UI/backend authorization. API calls return HTTP 403 Forbidden.
- **Evidence to collect:** Screenshot of Dispatcher sidebar and blocked route toast.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/AUTH-007/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite C: Marketing Website, Inquiries & Lead Capture

#### MKT-001 — Marketing System Operational Status Page
- **Module:** Marketing Status Page
- **Priority:** P2
- **Type:** Dynamic Integration
- **Requirement/source:** [`frontend/src/pages/marketing/StatusPage.tsx`](../../frontend/src/pages/marketing/StatusPage.tsx), `GET /api/public/status`
- **Preconditions:** Backend server running with MongoDB connected.
- **Test data:** URL `http://localhost:5173/status`.
- **Steps:**
  1. Navigate to `http://localhost:5173/status`.
  2. Verify overall banner displays "ALL SYSTEMS OPERATIONAL" with green pulsing indicator.
  3. Verify subsystem breakdown items:
     - Core Web Application (99.98%)
     - Database Cluster (99.95%)
     - Payment Gateway (99.9%)
     - GPS Ingestion Engine (99.7%)
     - WhatsApp Notifications (99.5%)
  4. Verify 90-day historical bar chart renders without missing SVG segments.
- **Expected result:** Dynamic response loads from `GET /api/public/status` and correctly reflects live database connection state.
- **Evidence to collect:** Screenshot of Status page with green indicators.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MKT-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MKT-002 — Interactive Pricing Page & Tier Toggle
- **Module:** Marketing Pricing
- **Priority:** P1
- **Type:** Dynamic Catalog UI
- **Requirement/source:** [`frontend/src/pages/marketing/PricingPage.tsx`](../../frontend/src/pages/marketing/PricingPage.tsx), `GET /api/billing/plans`
- **Preconditions:** Billing plans seeded in backend (`DEC-001`).
- **Test data:** URL `http://localhost:5173/pricing`.
- **Steps:**
  1. Navigate to `/pricing`.
  2. Verify 4 tier cards render:
     - Starter Plan: ₹1,999/mo (5 Trucks, 2 Users, 1 Branch)
     - Standard Plan: ₹3,999/mo (15 Trucks, 5 Users, 2 Branches)
     - Pro Plan: ₹8,999/mo (40 Trucks, 15 Users, 5 Branches)
     - Enterprise Plan: ₹19,999/mo (Unlimited)
  3. Toggle between "Monthly Billing" and "Annual Billing (20% Off)".
  4. Verify annual prices calculate correctly:
     - Starter: ₹1,599/mo (billed annually ₹19,190)
     - Standard: ₹3,199/mo (billed annually ₹38,390)
     - Pro: ₹7,199/mo (billed annually ₹86,390)
- **Expected result:** Plans load dynamically from backend API; annual discount calculation updates card values smoothly.
- **Evidence to collect:** Screenshot of pricing cards in Monthly and Annual views.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MKT-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MKT-003 — Contact & Demo Request Submission (KNOWN DEFECT DEF-001 VERIFICATION)
- **Module:** Inbound Lead Capture
- **Priority:** P1 (Commercial Blocker)
- **Type:** Form & Schema Validation
- **Requirement/source:** [`frontend/src/pages/marketing/ContactPage.tsx`](../../frontend/src/pages/marketing/ContactPage.tsx), `backend/src/models/LeadInquiry.ts`
- **Preconditions:** Unauthenticated marketing visitor.
- **Test data:**
  - Full Name: `Vikramaditya Transport`
  - Company: `Vikram Freightways`
  - Work Email: `vikram@vikramfreight.com`
  - Phone: `9820011223`
  - Fleet Size: Default selected value `11-25`
  - Challenge: `Driver diesel settlement disputes and delayed customer bills`
- **Steps:**
  1. Navigate to `http://localhost:5173/contact`.
  2. Fill in all fields with test data.
  3. Keep default Fleet Size dropdown (`11-25 Trucks`).
  4. Click "Schedule Interactive Walkthrough".
  5. Inspect DevTools Network tab for `POST /api/public/demo-request`.
- **Expected result:**
  - *Current Actual Defect:* Backend responds with HTTP 500 (`InternalServerError: LeadInquiry validation failed: fleet_size: 11-25 is not a valid enum value`). Toast shows "Failed to submit demo request".
  - *Target Pass Result (Post-Fix):* Backend responds with HTTP 201 Created and displays confirmation: "Thank you, Vikramaditya Transport! Our transport technology specialist will schedule your interactive walkthrough within 2 business hours."
- **Evidence to collect:** Screenshot of 500 error in DevTools Console & Network response (Evidence for `DEF-001`).
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [x] API  [x] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Documented enum mismatch in ContactPage.tsx vs LeadInquiry.ts]
- **Screenshot path:** [Evidence Folder](evidence/MKT-003/)
- **Reproduction notes:** [Select any dropdown option in ContactPage and submit]
- **Related defect ID:** `DEF-001`
- **Retest status/date:** [Fill in]

---

### Suite D: Master Registries — Trucks, Drivers, Parties & Branches

#### MD-001 — Add Owned Truck with Valid Data
- **Module:** Truck Management
- **Priority:** P1
- **Type:** Functional CRUD
- **Requirement/source:** [`frontend/src/pages/fleet/TruckListPage.tsx`](../../frontend/src/pages/fleet/TruckListPage.tsx), `backend/src/models/Truck.ts`
- **Preconditions:** Authenticated as Company Admin; active workspace.
- **Test data:**
  - Truck Number: `MH12AB1234`
  - Ownership: `owned`
  - Type: `Container`
  - Capacity (Tons): `16`
  - Make / Model: `Tata Signa 4825.TK`
  - Manufacturing Year: `2023`
  - Chassis Number: `MAT1234567890ABCD`
  - Engine Number: `ENG987654321`
- **Steps:**
  1. Navigate to `/fleet/trucks`.
  2. Click "+ Add Truck" button to open modal.
  3. Enter all test data fields.
  4. Click "Save Truck".
  5. Observe list refresh.
- **Expected result:** Modal closes, success toast "Truck added successfully" appears, new truck row `MH12AB1234` is visible in table with status `available` and ownership `owned`.
- **Evidence to collect:** Screenshot of completed Add Truck modal and updated table row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-002 — Duplicate Truck Number Rejection
- **Module:** Truck Management
- **Priority:** P1
- **Type:** Data Integrity & Validation
- **Requirement/source:** `backend/src/models/Truck.ts` (Compound unique index `company_id + truck_no`)
- **Preconditions:** Truck `MH12AB1234` created in `MD-001`.
- **Test data:** Truck Number: `MH12AB1234` (Exact duplicate).
- **Steps:**
  1. On `/fleet/trucks`, click "+ Add Truck".
  2. Enter `MH12AB1234`.
  3. Fill in other required fields and click "Save Truck".
- **Expected result:** Submission rejected with HTTP 400 or 409 Conflict: "A vehicle with this registration number already exists in your fleet."
- **Evidence to collect:** Screenshot of duplicate error toast.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-003 — Edit Truck Details & Status Transition
- **Module:** Truck Management
- **Priority:** P2
- **Type:** Functional CRUD
- **Requirement/source:** [`frontend/src/pages/fleet/TruckDetailPage.tsx`](../../frontend/src/pages/fleet/TruckDetailPage.tsx)
- **Preconditions:** Truck `MH12AB1234` exists.
- **Test data:** Capacity updated to `20`, Status set to `in_maintenance`.
- **Steps:**
  1. From `/fleet/trucks`, click row `MH12AB1234` to open detail page.
  2. Click "Edit Truck".
  3. Change Capacity from `16` to `20`.
  4. Change Status from `available` to `in_maintenance`.
  5. Click "Save Changes".
  6. Refresh browser page (`F5`).
- **Expected result:** Updates persist immediately; badge shows `in_maintenance` in yellow; capacity reads `20 Tons`.
- **Evidence to collect:** Screenshot of updated detail page post-refresh.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-003/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-015 — Add Driver with License & Phone Validation
- **Module:** Driver Management
- **Priority:** P1
- **Type:** Functional CRUD
- **Requirement/source:** [`frontend/src/pages/fleet/DriverListPage.tsx`](../../frontend/src/pages/fleet/DriverListPage.tsx), `backend/src/models/Driver.ts`
- **Preconditions:** Authenticated admin.
- **Test data:**
  - Name: `Ramesh Kumar Yadav`
  - Phone: `9820298202`
  - License Number: `MH1420180012345`
  - License Expiry: Future date (`2028-12-31`)
  - Experience Years: `8`
  - Aadhaar (Last 4): `9876`
- **Steps:**
  1. Navigate to `/fleet/drivers`.
  2. Click "+ Add Driver".
  3. Fill form with test data.
  4. Click "Save Driver".
- **Expected result:** Driver created with status `available`, appears in drivers list with phone and formatted license expiry.
- **Evidence to collect:** Screenshot of driver row in table.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-015/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-025 — Create Billing Party with GSTIN Checksum Validation
- **Module:** Commercial Party Master
- **Priority:** P0 (Financial Invariant)
- **Type:** Regulatory Validation
- **Requirement/source:** [`frontend/src/pages/parties/BillingPartyListPage.tsx`](../../frontend/src/pages/parties/BillingPartyListPage.tsx), `backend/src/utils/gstUtils.ts` (`IMP-001`)
- **Preconditions:** Authenticated admin.
- **Test data:**
  - Valid Name: `Tata Motors Limited Commercial Vehicles`
  - Valid GSTIN: `27AABCT3518Q1ZV` (Maharashtra state code 27, valid checksum character `V`)
  - Valid PAN: `AABCT3518Q`
  - Address: `Bombay House, 24 Homi Mody Street, Fort, Mumbai 400001`
  - Payment Terms: `30` days
- **Steps:**
  1. Navigate to `/parties/billing`.
  2. Click "+ Add Billing Party".
  3. Enter test data.
  4. Click "Save Billing Party".
- **Expected result:** Checksum validation passes; party saved successfully.
- **Evidence to collect:** Screenshot of saved Billing Party row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-025/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-026 — Invalid GSTIN Checksum Rejection
- **Module:** Commercial Party Master
- **Priority:** P1
- **Type:** Negative Validation
- **Requirement/source:** `backend/src/utils/gstUtils.ts`
- **Preconditions:** On Add Billing Party modal.
- **Test data:** Invalid GSTIN: `27AABCT3518Q1Z9` (Bad check character `9` instead of `V`).
- **Steps:**
  1. In Add Billing Party modal, enter invalid GSTIN `27AABCT3518Q1Z9`.
  2. Click "Save Billing Party".
- **Expected result:** Form rejects submission with message: "Invalid GSTIN format or checksum calculation failed."
- **Evidence to collect:** Screenshot of GSTIN validation failure message.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-026/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### MD-035 — Create Operational Branch / Transshipment Hub
- **Module:** Branch Management
- **Priority:** P2
- **Type:** Functional CRUD
- **Requirement/source:** [`frontend/src/pages/settings/BranchManagementPage.tsx`](../../frontend/src/pages/settings/BranchManagementPage.tsx), `Branch.ts`
- **Preconditions:** Authenticated admin on Standard/Pro plan.
- **Test data:**
  - Branch Name: `Bhiwandi Transshipment Hub`
  - Branch Code: `BHW-01`
  - City: `Bhiwandi`
  - State: `Maharashtra`
  - Contact Person: `Sunil Patil`
  - Phone: `9820398203`
- **Steps:**
  1. Navigate to `/settings/branches`.
  2. Click "+ Create Branch".
  3. Enter test data and save.
- **Expected result:** Branch created, appears in table with active status badge.
- **Evidence to collect:** Screenshot of branch list table.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/MD-035/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite E: Fleet Operations, Dispatches, Journeys & Fuel

#### OPS-001 — Create New Journey Dispatch with Truck & Driver Assignment
- **Module:** Dispatch Operations
- **Priority:** P0 (Core Operational Workflow)
- **Type:** Multi-Document ACID Transaction
- **Requirement/source:** [`frontend/src/pages/operations/NewJourneyPage.tsx`](../../frontend/src/pages/operations/NewJourneyPage.tsx), `backend/src/controllers/journeyController.ts`
- **Preconditions:** Available Truck (`MH12AB1234`) and Driver (`Ramesh Kumar Yadav`) created in Suite D.
- **Test data:**
  - Origin: `Pune, Maharashtra`
  - Destination: `Indore, Madhya Pradesh`
  - Truck: `MH12AB1234`
  - Driver: `Ramesh Kumar Yadav`
  - Planned Departure: Today
  - Driver Cash Advance: `₹12,000`
  - Freight Rate Agreed: `₹45,000`
- **Steps:**
  1. Navigate to `/operations/journeys/new`.
  2. Select Truck, Driver, Origin, Destination, Freight Rate, and Advance.
  3. Click "Dispatch Journey".
  4. Inspect DevTools network response for `POST /api/operations/journeys`.
- **Expected result:**
  - Journey created with status `in_transit`.
  - Assigned truck status atomically transitions to `in_transit`.
  - Assigned driver status atomically transitions to `on_trip`.
  - Redirects to `/operations/journeys/:id` detail page.
- **Evidence to collect:** Screenshot of completed new journey form and resulting journey detail view.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/OPS-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### OPS-002 — Log En-Route Diesel Fuel Expense
- **Module:** Journey Expenses
- **Priority:** P1
- **Type:** Functional Mutation
- **Requirement/source:** [`frontend/src/pages/operations/JourneyDetailPage.tsx`](../../frontend/src/pages/operations/JourneyDetailPage.tsx)
- **Preconditions:** Active journey from `OPS-001`.
- **Test data:**
  - Expense Type: `Diesel / Fuel`
  - Fuel Pump: `Indian Oil Dhule Highway Outlet`
  - Litres: `150`
  - Fuel Rate (per L): `₹92.50`
  - Total Fuel Amount: `₹13,875` (Formula: $150 \times 92.50 = 13,875$)
  - Payment Method: `Driver Advance Cash`
- **Steps:**
  1. Open Journey Detail page (`/operations/journeys/:id`).
  2. Click "+ Add Expense".
  3. Select "Fuel", enter Litres `150`, Rate `92.50`.
  4. Verify total calculates to `₹13,875`.
  5. Click "Save Expense".
- **Expected result:** Expense record added to Journey timeline; "Total Expenses" counter increments by ₹13,875; driver cash balance decrements accordingly.
- **Evidence to collect:** Screenshot of expense modal and updated journey financial summary card.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/OPS-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### OPS-003 — Complete Journey & Release Truck / Driver Resources
- **Module:** Status Lifecycle
- **Priority:** P0 (Core Operational Workflow)
- **Type:** Transactional Lifecycle
- **Requirement/source:** `controllers/journeyController.ts`
- **Preconditions:** Active `in_transit` journey.
- **Test data:** Closing Odometer: `125,480 km`, Unloading Date: Today.
- **Steps:**
  1. On Journey Detail page, click "Mark Journey Completed".
  2. Enter closing odometer and confirm delivery receipt.
  3. Click "Confirm Completion".
  4. Navigate to `/fleet/trucks` and check truck `MH12AB1234`.
  5. Navigate to `/fleet/drivers` and check driver `Ramesh Kumar Yadav`.
- **Expected result:**
  - Journey status updates to `completed`.
  - Truck status atomically updates back to `available`.
  - Driver status atomically updates back to `available`.
- **Evidence to collect:** Screenshot of completed journey badge and available truck table row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/OPS-003/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### OPS-025 — Live Fleet Map Vehicle Positioning
- **Module:** Telematics & Map
- **Priority:** P2
- **Type:** Map Visualization
- **Requirement/source:** [`frontend/src/pages/operations/LiveFleetMapPage.tsx`](../../frontend/src/pages/operations/LiveFleetMapPage.tsx), `ISS-007`
- **Preconditions:** Trucks with coordinates or journey dispatches exist.
- **Test data:** URL `/operations/live-map`.
- **Steps:**
  1. Navigate to `/operations/live-map`.
  2. Observe map canvas rendering.
  3. Click vehicle marker on map.
- **Expected result:** Map displays truck registration number (`truck_no`), driver name, speed, and status without schema projection errors.
- **Evidence to collect:** Screenshot of live map with vehicle marker popup open.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/OPS-025/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite F: Commercial Engine — LRs, Invoices & Credit Notes

#### COM-001 — Create 3-Part Lorry Receipt (LR) with Automatic Numbering
- **Module:** Freight Documentation
- **Priority:** P0 (Core Commercial Workflow)
- **Type:** Document Generation
- **Requirement/source:** [`frontend/src/pages/commercial/LRListPage.tsx`](../../frontend/src/pages/commercial/LRListPage.tsx), `backend/src/models/Entry.ts`
- **Preconditions:** Billing party Tata Motors exists.
- **Test data:**
  - Consignor: `Tata Motors Limited Commercial Vehicles`
  - Consignee: `Indore Auto Spares Hub`
  - Vehicle: `MH12AB1234`
  - Material Description: `Automobile Gearbox Assemblies (12 Pallets)`
  - Weight: `14.5 MT`
  - Freight Rate: `₹45,000`
  - Loading Charges: `₹1,500`
  - Total LR Freight: `₹46,500`
- **Steps:**
  1. Navigate to `/bill-entry/all`.
  2. Click "+ Create LR / Bill Entry".
  3. Fill in consignor, consignee, material, weight, and rate fields.
  4. Click "Generate LR".
- **Expected result:** LR is created with sequential number (e.g. `LR-2026-001`); appears in LR table with status `created`.
- **Evidence to collect:** Screenshot of LR table row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/COM-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### COM-002 — 3-Part LR Printable View (Consignor, Consignee, Driver Copies)
- **Module:** Print & Document Generation
- **Priority:** P1
- **Type:** UI Print Layout
- **Requirement/source:** [`frontend/src/pages/commercial/LRListPage.tsx`](../../frontend/src/pages/commercial/LRListPage.tsx)
- **Preconditions:** LR created in `COM-001`.
- **Test data:** Action "Print 3-Part LR".
- **Steps:**
  1. Click "Print" icon next to `LR-2026-001`.
  2. Observe browser print preview dialog.
- **Expected result:** Renders standard 3-part layout:
  - Copy 1: Consignor Copy (Header in Blue)
  - Copy 2: Consignee Copy (Header in Green)
  - Copy 3: Driver / Lorry Copy (Header in Orange/Red)
  - Includes GSTIN of both parties, terms & conditions, and signature blocks.
- **Evidence to collect:** Screenshot or PDF of print preview dialog.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/COM-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### COM-008 — GST Freight Invoice Generation & Idempotency Key Validation
- **Module:** Freight Invoicing
- **Priority:** P0 (Financial Invariant)
- **Type:** Idempotency & Math Invariant
- **Requirement/source:** [`frontend/src/pages/commercial/InvoiceListPage.tsx`](../../frontend/src/pages/commercial/InvoiceListPage.tsx), `ISS-019`
- **Preconditions:** Unbilled LR `LR-2026-001` exists with freight subtotal ₹46,500.
- **Test data:**
  - Customer: `Tata Motors Limited Commercial Vehicles`
  - GST Rate: `18% Forward Charge` (CGST 9% = ₹4,185, SGST 9% = ₹4,185)
  - Total GST: `₹8,370`
  - Grand Total: `₹54,870` (Formula: $46,500 + 8,370 = 54,870$)
- **Steps:**
  1. Navigate to `/invoices`.
  2. Click "+ Create Invoice".
  3. Select Customer Tata Motors and link `LR-2026-001`.
  4. Verify GST computes automatically to ₹8,370 and Total to ₹54,870.
  5. Inspect DevTools Network tab: Verify `x-idempotency-key` UUID header is attached.
  6. Click "Generate Invoice".
  7. Double-click "Generate Invoice" rapidly.
- **Expected result:** Invoice `INV-2026-001` generated with Total ₹54,870 and Balance ₹54,870. Idempotency middleware intercepts second click and prevents duplicate invoice creation.
- **Evidence to collect:** Screenshot of invoice table and network tab showing idempotency key header.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/COM-008/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### COM-015 — Credit Note Issuance & Automatic Invoice Balance Decrement
- **Module:** Commercial Accounting
- **Priority:** P0 (Financial Invariant)
- **Type:** Multi-Document ACID Transaction
- **Requirement/source:** [`frontend/src/pages/commercial/CreditNotesPage.tsx`](../../frontend/src/pages/commercial/CreditNotesPage.tsx), `ISS-003`, `ISS-008`
- **Preconditions:** Invoice `INV-2026-001` exists with balance ₹54,870.
- **Test data:**
  - Credit Note Reason: `Rate difference / Loading detention adjustment`
  - Credit Amount: `₹5,000`
  - Expected Remaining Balance: `₹49,870` (Formula: $54,870 - 5,000 = 49,870$)
- **Steps:**
  1. Navigate to `/commercial/credit-notes`.
  2. Click "+ Issue Credit Note".
  3. Select Invoice `INV-2026-001`.
  4. Enter Credit Amount `₹5,000` and reason.
  5. Click "Post Credit Note".
  6. Navigate back to `/invoices` and inspect `INV-2026-001`.
- **Expected result:**
  - Credit note posted with unique number (e.g. `CN-2026-001`).
  - Invoice `balance_amount` decrements from ₹54,870 to exactly ₹49,870.
  - Invoice `paid_amount` / credit amount increments by ₹5,000.
- **Evidence to collect:** Screenshot of Credit Notes list and updated Invoice balance column.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/COM-015/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite G: Double-Entry Ledger, Settlements & Balance Integrity

#### FIN-001 — Double-Entry Invariant Verification on Journal Postings
- **Module:** General Ledger
- **Priority:** P0 (Financial Invariant)
- **Type:** Accounting Integrity ($\sum \text{Debits} == \sum \text{Credits}$)
- **Requirement/source:** [`frontend/src/pages/commercial/LedgerListPage.tsx`](../../frontend/src/pages/commercial/LedgerListPage.tsx), `TEST-003`
- **Preconditions:** Authenticated admin or accountant.
- **Test data:**
  - Description: `Office Rent Payment - Navi Mumbai Branch`
  - Debit Account: `Rent Expense (Indirect)` → Amount `₹35,000`
  - Credit Account: `HDFC Bank Current Account` → Amount `₹35,000`
- **Steps:**
  1. Navigate to `/ledger`.
  2. Click "+ Manual Journal Entry".
  3. Add Line 1: Debit Rent Expense ₹35,000.
  4. Add Line 2: Credit HDFC Bank ₹35,000.
  5. Verify total debits = ₹35,000, total credits = ₹35,000, difference = ₹0.
  6. Click "Post Journal Entry".
- **Expected result:** Journal entry posts with unique `journal_id`. The double-entry invariant holds: $\sum \text{Debits} == \sum \text{Credits}$.
- **Evidence to collect:** Screenshot of balanced journal entry modal and table row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/FIN-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### FIN-002 — Unbalanced Journal Entry Rejection
- **Module:** General Ledger
- **Priority:** P0 (Financial Invariant)
- **Type:** Negative Validation
- **Requirement/source:** `backend/src/controllers/ledgerController.ts`
- **Preconditions:** On Manual Journal Entry modal.
- **Test data:** Debit `₹35,000`, Credit `₹30,000` (Difference: ₹5,000).
- **Steps:**
  1. Enter Debit ₹35,000 and Credit ₹30,000.
  2. Observe modal UI: "Post" button is disabled or warns "Unbalanced entry".
  3. Attempt submit if button enabled.
- **Expected result:** Rejected with message: "Total debits must equal total credits before posting."
- **Evidence to collect:** Screenshot of disabled button or error banner.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/FIN-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### FIN-010 — Driver Trip Settlement & Vendor Payout Ledger Reconciliation
- **Module:** Settlements & Payouts
- **Priority:** P0 (Financial Invariant)
- **Type:** Multi-Document Reconciliation
- **Requirement/source:** [`frontend/src/pages/commercial/SettlementListPage.tsx`](../../frontend/src/pages/commercial/SettlementListPage.tsx), `ISS-004`
- **Preconditions:** Completed journey with driver advance ₹12,000, diesel ₹13,875, agreed freight ₹45,000.
- **Test data:**
  - Net Balance Payable: `₹19,125` (Formula: $45,000 - 12,000 - 13,875 = 19,125$)
  - Payout Method: `Bank Transfer / NEFT`
- **Steps:**
  1. Navigate to `/settlements`.
  2. Click "+ New Driver Settlement".
  3. Select driver Ramesh Kumar Yadav and completed journey.
  4. Verify formula auto-calculates Net Payable: ₹19,125.
  5. Click "Finalize Settlement & Disburse Payout".
  6. Navigate to `/ledger` and inspect the resulting posting.
- **Expected result:**
  - Settlement marked `finalized`.
  - Payout journal entry posted: Debit Driver Freight Payable ₹19,125, Credit Bank Account ₹19,125.
  - Driver payable balance clears to ₹0.
- **Evidence to collect:** Screenshot of finalized settlement card and corresponding ledger row.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/FIN-010/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### FIN-020 — Accounts Receivable (AR) Aging Report Customer Name Display
- **Module:** Financial Reporting
- **Priority:** P1
- **Type:** Aggregation & Reporting
- **Requirement/source:** [`frontend/src/pages/commercial/AgingReportPage.tsx`](../../frontend/src/pages/commercial/AgingReportPage.tsx), `ISS-009`
- **Preconditions:** Unpaid invoices exist for Tata Motors.
- **Test data:** URL `/commercial/aging`.
- **Steps:**
  1. Navigate to `/commercial/aging`.
  2. Inspect AR Aging breakdown table.
  3. Verify column "Customer / Billing Party".
- **Expected result:** Table displays actual company name "Tata Motors Limited Commercial Vehicles" alongside aging buckets (0-30 Days, 31-60 Days, 61-90 Days, 90+ Days). Zero blank labels or raw ObjectIds displayed (`ISS-009` verified).
- **Evidence to collect:** Screenshot of AR Aging table with visible customer name.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/FIN-020/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite H: Subscription Plans, Quotas & Payment Workflows

#### SUB-001 — Dynamic Plan Catalog Retrieval
- **Module:** SaaS Monetization
- **Priority:** P1
- **Type:** Dynamic Integration
- **Requirement/source:** `backend/src/utils/billingSeedService.ts`, `DEC-001`
- **Preconditions:** Running server.
- **Test data:** Endpoint `GET /api/billing/plans`.
- **Steps:**
  1. Navigate to `/settings/billing`.
  2. Inspect plans rendered in UI.
- **Expected result:** Catalog displays approved tiers: Starter (₹1,999, 5 trucks), Standard (₹3,999, 15 trucks), Pro (₹8,999, 40 trucks), Enterprise (₹19,999, unlimited).
- **Evidence to collect:** Screenshot of Settings > Billing plans grid.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SUB-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SUB-005 — Truck Quota Enforcement (Starter Plan 5-Truck Limit)
- **Module:** Entitlement Gating
- **Priority:** P0 (Commercial Gate)
- **Type:** Limit Enforcement
- **Requirement/source:** `backend/src/controllers/truckController.ts`, `TEST-004`
- **Preconditions:** Workspace subscribed to Starter Plan (Limit: 5 trucks); 5 trucks already created.
- **Test data:** Attempting to create 6th truck (`MH12AB9999`).
- **Steps:**
  1. Open `/fleet/trucks`.
  2. Click "+ Add Truck".
  3. Fill form and click "Save Truck".
- **Expected result:** Submission blocked with HTTP 403 Forbidden: "Vehicle quota exceeded for your current plan (Maximum 5 trucks). Please upgrade your subscription."
- **Evidence to collect:** Screenshot of 403 Quota Exceeded error banner.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SUB-005/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SUB-006 — Truck & Branch Quota Concurrency Limitation (DEF-002 Verification)
- **Module:** Concurrency & Race Condition
- **Priority:** P2
- **Type:** Concurrency Risk
- **Requirement/source:** Carried forward from Batch 5 audit report (`DEF-002`)
- **Preconditions:** 4 trucks created on a 5-truck plan (1 slot remaining).
- **Test data:** 2 parallel asynchronous POST requests to `/api/fleet/trucks`.
- **Steps:**
  1. Dispatch 2 parallel requests simultaneously.
  2. Check final `Truck.countDocuments()`.
- **Expected result:** Document whether 5 or 6 trucks were created. If 6 were created, TOCTOU risk is confirmed as documented.
- **Evidence to collect:** Log of created truck count.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [x] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Documented TOCTOU quota concurrency limit]
- **Screenshot path:** [Evidence Folder](evidence/SUB-006/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** `DEF-002`
- **Retest status/date:** [Fill in]

---

#### SUB-010 — Starter Plan Module Entitlements Unblocked for LRs & Invoices
- **Module:** Feature Gating
- **Priority:** P0 (Commercial Gate)
- **Type:** Entitlement Access
- **Requirement/source:** `ISS-012`
- **Preconditions:** Workspace on Starter Plan.
- **Test data:** Navigate to `/bill-entry/all` and `/invoices`.
- **Steps:**
  1. On Starter Plan workspace, navigate to `/bill-entry/all`.
  2. Navigate to `/invoices`.
- **Expected result:** Both modules are fully accessible; sidebar does NOT display lock badge; user can create LRs and invoices (`ISS-012` trap resolved).
- **Evidence to collect:** Screenshot of accessible LR creation page on Starter tier.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SUB-010/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SUB-018 — Production Payment Simulation Mode Lockdown
- **Module:** Payment Gateway Security
- **Priority:** P0 (Security & Financial Gate)
- **Type:** Environment Hardening
- **Requirement/source:** `backend/src/controllers/billingController.ts`, `ISS-013`
- **Preconditions:** Server simulated with `NODE_ENV=production`.
- **Test data:** `POST /api/billing/verify-payment` with payload `{ simulation: true }`.
- **Steps:**
  1. Dispatch checkout verification request with simulation flag.
- **Expected result:** Server immediately rejects with HTTP 403: "Payment simulation mode is disabled in production environment." Cryptographic HMAC signature required.
- **Evidence to collect:** DevTools or API log of 403 response.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SUB-018/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite I: Public Tracking & Stakeholder Portals

#### PORT-001 — Public Shipment Tracking via Unguessable Token & PII Scrubbing
- **Module:** Public Tracking & Privacy
- **Priority:** P0 (Security & Privacy Blocker)
- **Type:** IDOR & PII Sanitization
- **Requirement/source:** [`frontend/src/pages/public/PublicTrackingPage.tsx`](../../frontend/src/pages/public/PublicTrackingPage.tsx), `ISS-005`
- **Preconditions:** LR `LR-2026-001` with generated `tracking_token`.
- **Test data:** URL `http://localhost:5173/track?token=<tracking_token>`.
- **Steps:**
  1. Open Public Tracking URL in an Incognito browser window.
  2. Inspect milestone timeline.
  3. Inspect page HTML and DevTools network response payload.
- **Expected result:**
  - Milestone status renders cleanly (e.g. "Dispatched from Pune", "In Transit").
  - Driver personal phone number is completely redacted.
  - Commercial freight rates and billing amounts are completely absent from both UI and JSON API response.
- **Evidence to collect:** Screenshot of public tracking page and sanitized API response JSON.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/PORT-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### PORT-002 — Bare LR Number IDOR Attack Prevention
- **Module:** Public Tracking Security
- **Priority:** P0 (Security Blocker)
- **Type:** IDOR Penetration Check
- **Requirement/source:** `backend/src/controllers/trackingController.ts`, `ISS-005`
- **Preconditions:** Unauthenticated attacker.
- **Test data:** Request with only `lr_no=LR-2026-001` without `tracking_token` or 3-factor credentials.
- **Steps:**
  1. Send request `GET /api/public/track?lr_no=LR-2026-001`.
- **Expected result:** Request rejected with HTTP 400 Bad Request: "Tracking queries require either a valid tracking token or full 3-factor verification (company code + LR number + registered phone)."
- **Evidence to collect:** Network response showing 400 error.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/PORT-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### PORT-005 — Portal OTP Rate Limiting & SMS Flooding Defense
- **Module:** Stakeholder Portal Security
- **Priority:** P0 (Security Blocker)
- **Type:** Rate Limiting
- **Requirement/source:** `backend/src/controllers/portalController.ts`, `ISS-020`
- **Preconditions:** External user on `/portal/login`.
- **Test data:** Phone `9820198201`.
- **Steps:**
  1. Navigate to `/portal/login`.
  2. Request OTP for phone `9820198201`.
  3. Immediately request OTP 3 more times within 1 minute.
- **Expected result:** 4th request is blocked with HTTP 429 Too Many Requests: "Maximum OTP request limit reached. Please wait 10 minutes before requesting another verification code."
- **Evidence to collect:** Screenshot of HTTP 429 rate limit warning toast.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/PORT-005/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### PORT-008 — Customer Portal Login & Consignment Visibility
- **Module:** Customer Portal
- **Priority:** P1
- **Type:** Functional Portal
- **Requirement/source:** [`frontend/src/pages/portal/CustomerPortalPage.tsx`](../../frontend/src/pages/portal/CustomerPortalPage.tsx), `ISS-006`
- **Preconditions:** Consignee phone `9820298202` linked to an active LR.
- **Test data:** Customer OTP login.
- **Steps:**
  1. Log into Customer Portal via OTP.
  2. View Consignments table.
- **Expected result:** Customer sees only shipments where they are Consignor or Consignee. Other tenants' and customers' records are strictly inaccessible.
- **Evidence to collect:** Screenshot of Customer Portal shipments view.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/PORT-008/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite J: Uploads, Documents & Local Storage Jailing

#### DOC-001 — Valid Document Upload (Vehicle RC PDF)
- **Module:** Document Storage
- **Priority:** P1
- **Type:** File Upload
- **Requirement/source:** `backend/src/routes/documentRoutes.ts`, `backend/src/utils/storageService.ts`
- **Preconditions:** Valid truck exists.
- **Test data:** Harmless PDF file `truck_rc_sample.pdf` (< 5 MB).
- **Steps:**
  1. Open Truck Detail page (`/fleet/trucks/:id`).
  2. Click "Upload Document" → select `truck_rc_sample.pdf`.
  3. Select Category: `Registration Certificate (RC)`.
  4. Click "Upload".
- **Expected result:** File uploads successfully; metadata record created in MongoDB; download link available in UI.
- **Evidence to collect:** Screenshot of uploaded document row in documents table.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/DOC-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### DOC-002 — Executable / Malicious MIME Type Spoofing Rejection
- **Module:** File Upload Security
- **Priority:** P0 (Security Blocker)
- **Type:** MIME Magic Byte Inspection
- **Requirement/source:** `backend/src/middlewares/fileSecurityMiddleware.ts`, `ISS-016`
- **Preconditions:** Authenticated user.
- **Test data:** Plain text or executable file renamed to `payload.pdf` (without valid PDF `%PDF-` magic header).
- **Steps:**
  1. Attempt to upload the spoofed `payload.pdf`.
- **Expected result:** Upload rejected with HTTP 400 Bad Request: "File content magic bytes do not match declared MIME type. Executable or corrupted files are prohibited."
- **Evidence to collect:** Network response showing 400 error.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/DOC-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### DOC-005 — Local Storage Path Traversal Root Jailing Check
- **Module:** File Security
- **Priority:** P0 (Security Blocker)
- **Type:** Path Traversal
- **Requirement/source:** `backend/src/utils/storageService.ts`, `ISS-017`
- **Preconditions:** Authenticated user.
- **Test data:** File download request with path traversal parameter `../../../../etc/passwd` or `..\..\..\windows\win.ini`.
- **Steps:**
  1. Dispatch file retrieval request with traversal sequence.
- **Expected result:** Storage service detects path escaping tenant jail directory and throws HTTP 403 Forbidden: "Access denied: Path traversal outside root containment jail detected."
- **Evidence to collect:** DevTools response showing 403 rejection.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/DOC-005/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite K: Executive Dashboard, KPIs, Reports & Exports

#### DASH-001 — Executive Dashboard Operational Counter Accuracy
- **Module:** Executive Dashboard
- **Priority:** P1
- **Type:** Aggregation Validation
- **Requirement/source:** [`frontend/src/pages/dashboard/DashboardPage.tsx`](../../frontend/src/pages/dashboard/DashboardPage.tsx), `GET /api/dashboard/stats`
- **Preconditions:** Fleet with 1 available truck, 1 in-transit truck, 1 in-maintenance truck.
- **Test data:** Known operational counts.
- **Steps:**
  1. Navigate to `/dashboard`.
  2. Inspect top stat cards:
     - Total Fleet Size: Should read `3`
     - Trucks In Transit: Should read `1`
     - Trucks In Maintenance: Should read `1` (`ISS-015` verified)
- **Expected result:** All KPI counters reflect database state accurately without aggregation mismatches.
- **Evidence to collect:** Screenshot of dashboard stat cards.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/DASH-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### DASH-010 — Tally XML Accounting Data Export
- **Module:** Accounting Export
- **Priority:** P2
- **Type:** Data Export
- **Requirement/source:** `backend/src/controllers/commercialReportController.ts`
- **Preconditions:** Invoices and journal entries exist.
- **Test data:** Date range: Current month.
- **Steps:**
  1. Navigate to `/invoices` or `/commercial/ledger`.
  2. Click "Export to Tally XML".
  3. Inspect downloaded `.xml` file.
- **Expected result:** File downloads with valid XML structure containing `<ENVELOPE>`, `<HEADER>`, and `<VOUCHER>` elements matching Tally Prime import specifications.
- **Evidence to collect:** Downloaded XML sample snippet.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/DASH-010/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite L: Notifications, Approvals, Custom Fields & Support

#### SYS-001 — In-App Operational Notifications & Unread Badge
- **Module:** Notifications
- **Priority:** P2
- **Type:** UI State
- **Requirement/source:** [`frontend/src/pages/settings/NotificationLogsPage.tsx`](../../frontend/src/pages/settings/NotificationLogsPage.tsx)
- **Preconditions:** Trigger an operational event (e.g. document expiry or journey dispatch).
- **Test data:** Notification event.
- **Steps:**
  1. Observe bell icon in Navbar.
  2. Click bell to view dropdown / navigate to `/settings/notifications`.
  3. Click "Mark as Read".
- **Expected result:** Unread badge count decrements; log updates to read status.
- **Evidence to collect:** Screenshot of notification dropdown and log table.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SYS-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SYS-010 — Custom Field Key Injection & Prototype Pollution Defense
- **Module:** Custom Fields Security
- **Priority:** P0 (Security Blocker)
- **Type:** Prototype Pollution Injection
- **Requirement/source:** `backend/src/controllers/customFieldController.ts`, `ISS-021`
- **Preconditions:** Admin on Pro plan.
- **Test data:** Key payload: `__proto__`, `constructor`, or `$where`.
- **Steps:**
  1. Navigate to `/settings/custom-fields`.
  2. Click "+ Add Custom Field".
  3. Attempt to enter Field Key: `__proto__`.
  4. Submit form.
- **Expected result:** Backend rejects key with HTTP 400 Bad Request: "Reserved or dangerous prototype keys (__proto__, constructor, prototype) are strictly disallowed."
- **Evidence to collect:** Screenshot of error toast.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SYS-010/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite M: Security, Tenant Isolation & Vulnerability Hardening

#### SEC-001 — Cross-Tenant Document Access Interception
- **Module:** Multi-Tenancy Boundary
- **Priority:** P0 (Critical Release Blocker)
- **Type:** Cross-Tenant Isolation
- **Requirement/source:** `backend/src/plugins/tenantPlugin.ts`, `ISS-001`, `ISS-002`, `TEST-002`
- **Preconditions:** Tenant A (Company 1) owns Truck `TRK-A1` (`_id: 670000000000000000000001`). User authenticated under Tenant B (Company 2).
- **Test data:** `GET /api/fleet/trucks/670000000000000000000001` with Tenant B's JWT cookie.
- **Steps:**
  1. Send GET request targeting Tenant A's truck ID using Tenant B's session.
- **Expected result:** Response is HTTP 404 Not Found (or 403 Forbidden). Zero data leaked from Tenant A.
- **Evidence to collect:** API response showing 404.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SEC-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SEC-002 — Cross-Tenant Mutation & Deletion Interception
- **Module:** Multi-Tenancy Boundary
- **Priority:** P0 (Critical Release Blocker)
- **Type:** Cross-Tenant Modification
- **Requirement/source:** `ISS-002`
- **Preconditions:** Tenant A owns Invoice `INV-A1`. User logged into Tenant B.
- **Test data:** `PUT /api/invoices/<Tenant-A-Invoice-ID>` with Tenant B's session.
- **Steps:**
  1. Send update or delete request targeting Tenant A's document.
- **Expected result:** Tenant plugin injects `company_id: tenantB` into the Mongoose query filter. Zero documents matched; returns 404 without mutating Tenant A's document.
- **Evidence to collect:** API response and database inspection confirming Tenant A document unchanged.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SEC-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite N: Accessibility, Responsive Breakpoints & Cross-Browser

#### A11Y-001 — Responsive Layout Across Breakpoints (Desktop, Tablet, Mobile)
- **Module:** Responsive Design
- **Priority:** P2
- **Type:** UI Responsiveness
- **Requirement/source:** Global styles, `index.css`
- **Preconditions:** Open application in browser.
- **Test data:** Viewports:
  - Desktop: 1920x1080 & 1440x900
  - Tablet: 768x1024 (iPad Portrait)
  - Mobile: 375x812 (iPhone)
- **Steps:**
  1. Resize browser window through each breakpoint.
  2. Inspect `/dashboard`, `/fleet/trucks`, `/operations/journeys`, and `/invoices`.
- **Expected result:** Data tables scroll horizontally inside container (`overflow-x: auto`) without breaking outer shell layout. No overlapping buttons, text truncation with ellipsis where appropriate.
- **Evidence to collect:** Screenshots at 1440px, 768px, and 375px widths.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/A11Y-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite O: Error Resilience, Network Failures & Recovery

#### ERR-001 — Frontend Toast Alert on Network Drop & Offline State
- **Module:** Error Resilience
- **Priority:** P2
- **Type:** Network Failure Handling
- **Requirement/source:** [`frontend/src/api/client.ts`](../../frontend/src/api/client.ts)
- **Preconditions:** Logged in.
- **Test data:** Chrome DevTools Network set to "Offline".
- **Steps:**
  1. In DevTools Network tab, select "Offline".
  2. Click "Save Truck" on Add Truck modal.
- **Expected result:** Client catches network error gracefully and displays red error toast: "Network connection lost. Please verify your internet connection and try again." App does not crash or display raw white screen.
- **Evidence to collect:** Screenshot of error toast during offline attempt.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/ERR-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

### Suite P: Deployment Readiness, Health Probes & SRE Tools

#### SRE-001 — Liveness Health Probe (`/api/health/live`)
- **Module:** SRE & Probes
- **Priority:** P1
- **Type:** Health Check
- **Requirement/source:** [`backend/src/routes/healthRoutes.ts`](../../backend/src/routes/healthRoutes.ts), `OPS-005`
- **Preconditions:** Backend running.
- **Test data:** `GET http://localhost:5000/api/health/live`.
- **Steps:**
  1. Send GET request to `/api/health/live`.
- **Expected result:** HTTP 200 OK with payload `{"status": "ok", "uptime_seconds": <number>}`.
- **Evidence to collect:** Terminal curl or PowerShell Invoke-RestMethod output.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SRE-001/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SRE-002 — Readiness Health Probe with Bounded MongoDB Latency (`/api/health/ready`)
- **Module:** SRE & Probes
- **Priority:** P1
- **Type:** Deep Health Check
- **Requirement/source:** `backend/src/routes/healthRoutes.ts`, `OPS-005`
- **Preconditions:** Backend and MongoDB replica set active.
- **Test data:** `GET http://localhost:5000/api/health/ready`.
- **Steps:**
  1. Send GET request to `/api/health/ready`.
- **Expected result:** HTTP 200 UP with `status: "UP"`, `database: "CONNECTED"`, `checks.mongodb.latency_ms` reported, and memory statistics.
- **Evidence to collect:** Terminal probe output showing latency.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SRE-002/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

#### SRE-008 — Automated Database Backup Script Execution & Authenticity
- **Module:** Disaster Recovery
- **Priority:** P1
- **Type:** Scripted SRE Operation
- **Requirement/source:** [`scripts/backup.sh`](../../scripts/backup.sh), `OPS-003`
- **Preconditions:** Linux/WSL environment with OpenSSL and mongodump.
- **Test data:** Command `bash scripts/backup.sh`.
- **Steps:**
  1. Execute backup script in test environment.
  2. Inspect output archive `.enc` and separate `.hmac` file.
- **Expected result:** Produces encrypted database archive using AES-256-CBC, PBKDF2 600,000 iterations, and HMAC-SHA256 Encrypt-then-MAC signature.
- **Evidence to collect:** Terminal execution log and generated backup archive file listing.
- **Actual result:** [Fill in during manual testing]
- **Status:** [x] Not tested  [ ] Pass  [ ] Fail  [ ] Blocked  [ ] Needs investigation
- **Failure category:** [ ] UI  [ ] API  [ ] Validation  [ ] Database  [ ] Permission  [ ] Business logic  [ ] Integration  [ ] Environment  [ ] Unknown
- **Failure reason:** [Fill in]
- **Screenshot path:** [Evidence Folder](evidence/SRE-008/)
- **Reproduction notes:** [Fill in]
- **Related defect ID:** [Fill in]
- **Retest status/date:** [Fill in]

---

## 10. Audit Limitations & PO Clarification Items

During test case discovery and construction, the following boundary items and known risks were recorded:

1. **`DEF-001` (Marketing Lead Demo Enum Mismatch):** In `ContactPage.tsx`, the `<select>` options `['1-10', '11-25', '26-50', '51-100', '100+']` mismatch `LeadInquiry.ts` enum `['1-5', '6-20', '21-50', '50+']`. Must be patched prior to commercial traffic.
2. **`DEF-002` (TOCTOU Quota Concurrency Risk):** Minor check-then-insert concurrency window on truck and branch creation carried forward from Batch 5.
3. **`DEC-003` (S3 Object Storage Pending Approval):** Local root-jailed disk storage remains active; cloud S3 upload is pending formal approval.
4. **Docker Host Runtime Verification:** Docker Compose runtime behavior was verified statically; host lacked Docker daemon during automated runs.
5. **Requirements Needing PO Clarification for Post-Launch Batches:**
   - *Section 194C TDS Threshold:* Confirm whether single contract threshold of ₹30,000 or aggregate ₹1,00,000 applies to transporter declaration (Batch 10).
   - *FASTag Toll Integration Partner:* Confirm whether NPCI direct API or bank aggregator (ICICI / IDFC) will be selected for FASTag auto-sync (Batch 11).

---
*Fleet Flow Complete Website Manual QA & Feature Testing Checklist v1.0.0 Generated.*  
*Ready for human execution.*


---

# Repository-Reconciled Coverage Appendices (added after ZIP inspection)

> **How to use this addendum:** This section supplements the existing manual tests with a source-derived inventory. The route/page inventory is based on the uploaded ZIP, not live browser execution. Every case begins **Not tested**. A route declaration, component, or automated test is not proof of production behavior. Run the website against a safe test environment and record actual evidence.

## Appendix A — Frontend route and page coverage

### A1. Route-by-route smoke checklist

For each route below, execute the shared checks and any route-specific checks in the original suites. If a route is a redirect alias, verify its destination and that browser refresh works. For protected routes, test signed-out redirect, authorized role access, unauthorized role denial, direct URL navigation, refresh, loading/error/empty states, and no cross-tenant data.

**Shared per-route result fields:** Status `[ ] Not tested [ ] Pass [ ] Fail [ ] Blocked [ ] N/A`; actual result; browser/viewport; screenshot path; defect ID; retest result.

| Test ID | URL pattern | Page / behavior from source | Priority | Status | Actual result / evidence / defect |
|---|---|---|---|---|---|
| `WEB-001` | `/` | `RootRoute` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-002` | `/home` | `HomePage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-003` | `/features` | `FeaturesPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-004` | `/pricing` | `PricingPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-005` | `/contact` | `ContactPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-006` | `/demo` | `ContactPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-007` | `/security` | `PrivacyPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-008` | `/help` | `ContactPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-009` | `/privacy` | `PrivacyPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-010` | `/terms` | `TermsPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-011` | `/refund-policy` | `RefundPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-012` | `/status` | `StatusPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-013` | `/login` | `LoginPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-014` | `/register` | `RegisterPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-015` | `/accept-invite` | `AcceptInvitePage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-016` | `/forgot-password` | `ForgotPasswordPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-017` | `/reset-password` | `ResetPasswordPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-018` | `/track` | `PublicTrackingPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-019` | `/track/:lrNumber` | `PublicTrackingPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-020` | `/portal/login` | `PortalLoginPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-021` | `/portal/customer` | `CustomerPortalPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-022` | `/portal/driver` | `DriverPortalPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-023` | `/portal/vendor` | `VendorPortalPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-024` | `dashboard` | `DashboardRoute` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-025` | `team` | `TeamMembersPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-026` | `settings/company` | `CompanySettingsPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-027` | `settings/profile` | `ProfileSecurityPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-028` | `fleet/trucks` | `TruckListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-029` | `fleet/trucks/:id` | `TruckDetailPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-030` | `fleet/maintenance` | `MaintenanceDashboardPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-031` | `fleet/tyres` | `TyreManagementPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-032` | `fleet/drivers` | `DriverListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-033` | `fleet/drivers/:id` | `DriverDetailPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-034` | `parties/billing` | `BillingPartyListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-035` | `parties/balance` | `BalancePartyListPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-036` | `operations/journeys` | `JourneyListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-037` | `operations/journeys/new` | `NewJourneyPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-038` | `operations/journeys/:id` | `JourneyDetailPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-039` | `operations/live-map` | `LiveFleetMapPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-040` | `journey/all` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-041` | `journey/all-journey-entries` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-042` | `journey/new-journey` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-043` | `journey/journey-detail/:id` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-044` | `operations/market-entries` | `VehicleEntryListPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-045` | `vehicle-entry/all` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-046` | `vehicle-entry/all-vehicle-entries` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-047` | `bill-entry/all` | `LRListPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-048` | `commercial/entries` | `LRListPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-049` | `invoices` | `InvoiceListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-050` | `commercial/invoices` | `InvoiceListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-051` | `commercial/credit-notes` | `CreditNotesPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-052` | `credit-notes` | `Navigate` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-053` | `commercial/aging` | `AgingReportPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-054` | `financials/aging` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-055` | `settlements` | `SettlementListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-056` | `commercial/settlements` | `SettlementListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-057` | `ledger` | `LedgerListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-058` | `commercial/ledger` | `LedgerListPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-059` | `settings/billing` | `BillingPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-060` | `settings/custom-fields` | `CustomFieldsPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-061` | `settings/notifications` | `NotificationLogsPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-062` | `settings/approvals` | `ApprovalWorkflowPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-063` | `approvals` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-064` | `settings/branches` | `BranchManagementPage` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-065` | `branches` | `Navigate` | P1 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-066` | `support/tickets` | `SupportTicketsPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-067` | `support` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-068` | `super-admin` | `SuperAdminDashboardPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-069` | `super-admin/plans` | `SuperAdminPlansPage` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `WEB-070` | `*` | `Navigate` | P2 | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |

### A2. Page component inventory

For **every page** below, verify: correct title and breadcrumbs; all visible controls respond; table columns match displayed data; sorting/filter/search/pagination behave when present; form validation and cancel/save paths work; loading/empty/error states are understandable; no console errors; data persists after refresh; permissions and tenant boundaries hold. Record `N/A` with a reason if a behavior does not exist.

| Test ID | Component file | Minimum manual checks | Status / evidence |
|---|---|---|---|
| `PAGE-001` | `frontend/src/pages/auth/AcceptInvitePage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~4 input/select/textarea tags, ~1 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-002` | `frontend/src/pages/auth/ForgotPasswordPage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~1 input/select/textarea tags, ~3 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-003` | `frontend/src/pages/auth/LoginPage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~2 input/select/textarea tags, ~2 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-004` | `frontend/src/pages/auth/RegisterPage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~7 input/select/textarea tags, ~2 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-005` | `frontend/src/pages/auth/ResetPasswordPage.tsx` | Verify visible interactions (source scan: ~2 button tags, ~2 input/select/textarea tags, ~2 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-006` | `frontend/src/pages/commercial/AgingReportPage.tsx` | Verify visible interactions (source scan: ~2 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-007` | `frontend/src/pages/commercial/CreditNotesPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~6 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-008` | `frontend/src/pages/commercial/InvoiceListPage.tsx` | Verify visible interactions (source scan: ~11 button tags, ~16 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-009` | `frontend/src/pages/commercial/LRListPage.tsx` | Verify visible interactions (source scan: ~7 button tags, ~27 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-010` | `frontend/src/pages/commercial/LedgerListPage.tsx` | Verify visible interactions (source scan: ~14 button tags, ~16 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-011` | `frontend/src/pages/commercial/SettlementListPage.tsx` | Verify visible interactions (source scan: ~10 button tags, ~10 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-012` | `frontend/src/pages/dashboard/DashboardPage.tsx` | Verify visible interactions (source scan: ~9 button tags, ~0 input/select/textarea tags, ~6 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-013` | `frontend/src/pages/fleet/DriverDetailPage.tsx` | Verify visible interactions (source scan: ~10 button tags, ~7 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-014` | `frontend/src/pages/fleet/DriverListPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~11 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-015` | `frontend/src/pages/fleet/MaintenanceDashboardPage.tsx` | Verify visible interactions (source scan: ~15 button tags, ~18 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-016` | `frontend/src/pages/fleet/TruckDetailPage.tsx` | Verify visible interactions (source scan: ~14 button tags, ~8 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-017` | `frontend/src/pages/fleet/TruckListPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~13 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-018` | `frontend/src/pages/fleet/TyreManagementPage.tsx` | Verify visible interactions (source scan: ~10 button tags, ~15 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-019` | `frontend/src/pages/marketing/ContactPage.tsx` | Verify visible interactions (source scan: ~2 button tags, ~6 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-020` | `frontend/src/pages/marketing/FeaturesPage.tsx` | Verify visible interactions (source scan: ~0 button tags, ~0 input/select/textarea tags, ~2 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-021` | `frontend/src/pages/marketing/HomePage.tsx` | Verify visible interactions (source scan: ~0 button tags, ~1 input/select/textarea tags, ~5 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-022` | `frontend/src/pages/marketing/PricingPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~0 input/select/textarea tags, ~1 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-023` | `frontend/src/pages/marketing/PrivacyPage.tsx` | Verify visible interactions (source scan: ~0 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-024` | `frontend/src/pages/marketing/RefundPage.tsx` | Verify visible interactions (source scan: ~0 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-025` | `frontend/src/pages/marketing/StatusPage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-026` | `frontend/src/pages/marketing/TermsPage.tsx` | Verify visible interactions (source scan: ~0 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-027` | `frontend/src/pages/onboarding/OnboardingWizardPage.tsx` | Verify visible interactions (source scan: ~6 button tags, ~8 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-028` | `frontend/src/pages/operations/JourneyDetailPage.tsx` | Verify visible interactions (source scan: ~33 button tags, ~20 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-029` | `frontend/src/pages/operations/JourneyListPage.tsx` | Verify visible interactions (source scan: ~8 button tags, ~3 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-030` | `frontend/src/pages/operations/LiveFleetMapPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-031` | `frontend/src/pages/operations/NewJourneyPage.tsx` | Verify visible interactions (source scan: ~6 button tags, ~18 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-032` | `frontend/src/pages/operations/VehicleEntryListPage.tsx` | Verify visible interactions (source scan: ~8 button tags, ~15 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-033` | `frontend/src/pages/parties/BalancePartyListPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~13 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-034` | `frontend/src/pages/parties/BillingPartyListPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~14 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-035` | `frontend/src/pages/portal/CustomerPortalPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~0 input/select/textarea tags, ~1 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-036` | `frontend/src/pages/portal/DriverPortalPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~1 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-037` | `frontend/src/pages/portal/PortalLoginPage.tsx` | Verify visible interactions (source scan: ~4 button tags, ~3 input/select/textarea tags, ~2 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-038` | `frontend/src/pages/portal/VendorPortalPage.tsx` | Verify visible interactions (source scan: ~1 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-039` | `frontend/src/pages/public/PublicTrackingPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~1 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-040` | `frontend/src/pages/settings/ApprovalWorkflowPage.tsx` | Verify visible interactions (source scan: ~6 button tags, ~4 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-041` | `frontend/src/pages/settings/BillingPage.tsx` | Verify visible interactions (source scan: ~19 button tags, ~0 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-042` | `frontend/src/pages/settings/BranchManagementPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~1 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-043` | `frontend/src/pages/settings/CompanySettingsPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~18 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-044` | `frontend/src/pages/settings/CustomFieldsPage.tsx` | Verify visible interactions (source scan: ~7 button tags, ~6 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-045` | `frontend/src/pages/settings/NotificationLogsPage.tsx` | Verify visible interactions (source scan: ~5 button tags, ~4 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-046` | `frontend/src/pages/settings/ProfileSecurityPage.tsx` | Verify visible interactions (source scan: ~3 button tags, ~3 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-047` | `frontend/src/pages/superadmin/SuperAdminDashboardPage.tsx` | Verify visible interactions (source scan: ~12 button tags, ~6 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-048` | `frontend/src/pages/superadmin/SuperAdminPlansPage.tsx` | Verify visible interactions (source scan: ~17 button tags, ~36 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-049` | `frontend/src/pages/support/SupportTicketsPage.tsx` | Verify visible interactions (source scan: ~4 button tags, ~5 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |
| `PAGE-050` | `frontend/src/pages/team/TeamMembersPage.tsx` | Verify visible interactions (source scan: ~10 button tags, ~3 input/select/textarea tags, ~0 links; includes conditional/repeated markup and is not a count of unique runtime controls). | [ ] Not tested; actual: ___; screenshot: ___; defect: ___ |

### A3. Cross-cutting control checks — apply to every page where relevant

- [ ] Every button has the correct label and intended action; no dead buttons, double-trigger, or accidental form submit.
- [ ] Disabled/loading states prevent duplicate submissions and communicate progress.
- [ ] Every input has the correct label, required marker, input type, default, placeholder, min/max/length and validation behavior.
- [ ] Dropdown options match backend accepted values and display saved values correctly on edit.
- [ ] Date/time fields handle timezone, invalid dates, start-after-end and boundary dates.
- [ ] Currency values display INR consistently, use correct decimal precision, and do not silently turn missing values into misleading zeroes.
- [ ] Search handles leading/trailing whitespace, case differences, no results, special characters and clearing the query.
- [ ] Filters combine correctly, can be reset, and do not leak into another tenant or user session.
- [ ] Pagination does not duplicate/skip records; page size and total count are consistent.
- [ ] Destructive actions require appropriate confirmation; cancel leaves data unchanged.
- [ ] Toasts/errors are accessible and meaningful; errors do not reveal stack traces, secrets or other tenants' data.
- [ ] Direct URL, refresh, browser back/forward and expired session behavior are correct.
- [ ] At 320px, 375px, 768px, 1024px and desktop widths, content remains usable without hidden critical controls or unintended horizontal overflow.

## Appendix B — Backend API route declaration coverage

For each route declaration below, use the exact HTTP method and path, then test the applicable checks: (1) expected success response/schema; (2) missing/invalid body and query parameters; (3) unauthenticated request; (4) wrong role; (5) foreign tenant/company ID; (6) nonexistent/malformed resource ID; (7) duplicate/retry behavior for mutations; (8) persistence and related records; (9) consistent HTTP status/error shape; (10) pagination/filter boundaries. Not every check applies to every route—mark N/A with reason. Do not run destructive tests against production.

**API baseline:** successful requests must return the documented status and response shape; invalid requests must fail safely without unintended writes; tenant-scoped routes must only return or mutate data owned by the authenticated tenant; mutation endpoints must be checked for idempotency where financially or operationally consequential.

| Test ID | Route module | Method | Mounted path | Source line | Handler / middleware tail (source excerpt) | Status | Actual / evidence / defect |
|---|---|---:|---|---:|---|---|---|
| `API-001` | `approvalRoutes` | `GET` | `/api/approvals/rules` | 23 | ` listApprovalRules` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-002` | `approvalRoutes` | `POST` | `/api/approvals/rules` | 24 | ` requireRole(['admin']), createApprovalRule` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-003` | `approvalRoutes` | `GET` | `/api/approvals/pending` | 25 | ` listPendingApprovals` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-004` | `approvalRoutes` | `POST` | `/api/approvals/:id/process` | 26 | ` requireRole(['admin']), processApproval` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-005` | `authRoutes` | `POST` | `/api/auth/register-company` | 51 | ` registerLimiter, registerCompany` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-006` | `authRoutes` | `POST` | `/api/auth/register` | 52 | ` registerLimiter, registerCompany` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-007` | `authRoutes` | `POST` | `/api/auth/login` | 53 | ` authLimiter, login` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-008` | `authRoutes` | `POST` | `/api/auth/logout` | 54 | ` logout` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-009` | `authRoutes` | `POST` | `/api/auth/forgot-password` | 55 | ` passwordResetLimiter, forgotPassword` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-010` | `authRoutes` | `POST` | `/api/auth/reset-password` | 56 | ` passwordResetLimiter, resetPassword` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-011` | `authRoutes` | `POST` | `/api/auth/change-password` | 62 | ` requireAuth, changePassword` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-012` | `authRoutes` | `GET` | `/api/auth/workspaces` | 65 | ` requireAuth, listWorkspaces` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-013` | `authRoutes` | `POST` | `/api/auth/switch-company` | 66 | ` requireAuth, switchCompany` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-014` | `authRoutes` | `POST` | `/api/auth/create-workspace` | 67 | ` requireAuth, createWorkspace` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-015` | `authRoutes` | `GET` | `/api/auth/me` | 70 | ` requireAuth, resolveTenantContext, getMe` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-016` | `billingRoutes` | `POST` | `/api/billing/webhooks/billing` | 34 | ` handleBillingWebhook` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-017` | `billingRoutes` | `GET` | `/api/billing/plans` | 37 | ` getBillingPlans` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-018` | `billingRoutes` | `GET` | `/api/billing/subscription` | 43 | ` getCompanySubscription` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-019` | `billingRoutes` | `GET` | `/api/billing/history` | 44 | ` getBillingHistory` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-020` | `billingRoutes` | `GET` | `/api/billing/invoices/:id/receipt` | 45 | ` getBillingInvoiceReceipt` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-021` | `billingRoutes` | `POST` | `/api/billing/calculate-change` | 46 | ` calculatePlanChangePreview` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-022` | `billingRoutes` | `POST` | `/api/billing/checkout` | 47 | ` initializeCheckout` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-023` | `billingRoutes` | `POST` | `/api/billing/verify-payment` | 48 | ` requireRole(['admin']), requireStrictIdempotency, verifyPayment` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-024` | `billingRoutes` | `POST` | `/api/billing/change-plan` | 49 | ` requireRole(['admin']), changePlan` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-025` | `billingRoutes` | `POST` | `/api/billing/apply-scheduled` | 50 | ` requireRole(['admin']), applyScheduledChange` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-026` | `billingRoutes` | `POST` | `/api/billing/cancel-scheduled` | 51 | ` requireRole(['admin']), cancelScheduledChange` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-027` | `billingRoutes` | `POST` | `/api/billing/toggle-addon` | 52 | ` requireRole(['admin']), toggleAddon` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-028` | `branchRoutes` | `GET` | `/api/company/branches` | 18 | ` listBranches` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-029` | `branchRoutes` | `POST` | `/api/company/branches` | 19 | ` requireRole(['admin']), requireQuota('branches'), createBranch` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-030` | `branchRoutes` | `PUT` | `/api/company/branches/:id` | 20 | ` requireRole(['admin']), updateBranch` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-031` | `branchRoutes` | `DELETE` | `/api/company/branches/:id` | 21 | ` requireRole(['admin']), deleteBranch` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-032` | `commercialReportRoutes` | `GET` | `/api/commercial/aging` | 26 | ` getArAgingReport` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-033` | `commercialReportRoutes` | `GET` | `/api/commercial/profitability` | 27 | ` getTripProfitabilityReport` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-034` | `commercialReportRoutes` | `GET` | `/api/commercial/export/tally` | 28 | ` requireFeature('MOD_TALLY_SYNC'), exportToTallyXml` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-035` | `commercialReportRoutes` | `GET` | `/api/commercial/credit-notes` | 29 | ` listCreditNotes` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-036` | `commercialReportRoutes` | `POST` | `/api/commercial/credit-notes` | 30 | ` requireStrictIdempotency, createCreditNote` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-037` | `companyRoutes` | `GET` | `/api/company/invitations/verify` | 43 | ` verifyInvitationToken` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-038` | `companyRoutes` | `POST` | `/api/company/invitations/accept` | 44 | ` acceptInvitation` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-039` | `companyRoutes` | `GET` | `/api/company/profile` | 54 | ` getCompanyProfile` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-040` | `companyRoutes` | `PUT` | `/api/company/profile` | 55 | ` requireRole(['admin']), updateCompanyProfile` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-041` | `companyRoutes` | `GET` | `/api/company/members` | 58 | ` listCompanyMembers` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-042` | `companyRoutes` | `POST` | `/api/company/members/invite` | 59 | ` requireRole(['admin']), requireQuota('users'), inviteCompanyMember` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-043` | `companyRoutes` | `PATCH` | `/api/company/members/:id/role` | 60 | ` requireRole(['admin']), updateMemberRole` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-044` | `companyRoutes` | `PATCH` | `/api/company/members/:id/status` | 61 | ` requireRole(['admin']), updateMemberStatus` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-045` | `companyRoutes` | `DELETE` | `/api/company/members/:id` | 62 | ` requireRole(['admin']), removeMember` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-046` | `customFieldRoutes` | `GET` | `/api/settings/custom-fields` | 28 | ` listCustomFields` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-047` | `customFieldRoutes` | `POST` | `/api/settings/custom-fields` | 31 | ` requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), createCustomField` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-048` | `customFieldRoutes` | `PUT` | `/api/settings/custom-fields/:id` | 32 | ` requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), updateCustomField` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-049` | `customFieldRoutes` | `PATCH` | `/api/settings/custom-fields/:id/archive` | 33 | ` requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), toggleArchiveCustomField` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-050` | `customFieldRoutes` | `DELETE` | `/api/settings/custom-fields/:id` | 34 | ` requireRole(['admin']), requireFeature('MOD_CUSTOM_FIELDS'), deleteCustomField` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-051` | `dashboardRoutes` | `GET` | `/api/dashboard/summary` | 20 | ` getDashboardSummary` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-052` | `dashboardRoutes` | `GET` | `/api/dashboard/watchlists` | 23 | ` getDashboardWatchlists` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-053` | `dashboardRoutes` | `GET` | `/api/dashboard/audit/:entityType/:entityId` | 26 | ` getEntityAuditTrail` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-054` | `documentRoutes` | `POST` | `/api/documents/upload` | 31 | ` documentUploadMiddleware, fileSecurityMiddleware, uploadDocument` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-055` | `documentRoutes` | `GET` | `/api/documents/presigned-url` | 34 | ` getPresignedUrl` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-056` | `documentRoutes` | `GET` | `/api/documents/file` | 37 | ` serveLocalFile` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-057` | `driverRoutes` | `GET` | `/api/fleet/drivers` | 30 | ` listDrivers` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-058` | `driverRoutes` | `GET` | `/api/fleet/drivers/:id` | 31 | ` getDriverById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-059` | `driverRoutes` | `POST` | `/api/fleet/drivers` | 34 | ` requireRole(['admin', 'dispatcher']), requireQuota('drivers'), createDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-060` | `driverRoutes` | `PUT` | `/api/fleet/drivers/:id` | 35 | ` requireRole(['admin', 'dispatcher']), updateDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-061` | `driverRoutes` | `DELETE` | `/api/fleet/drivers/:id` | 36 | ` requireRole(['admin']), deleteDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-062` | `entryRoutes` | `GET` | `/api/commercial/entries/metrics` | 26 | ` getEntryMetrics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-063` | `entryRoutes` | `GET` | `/api/commercial/entries/:id/print` | 29 | ` getPrintableLR` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-064` | `entryRoutes` | `GET` | `/api/commercial/entries/:id/printable` | 30 | ` getPrintableLR` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-065` | `entryRoutes` | `GET` | `/api/commercial/entries` | 33 | ` getEntries` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-066` | `entryRoutes` | `GET` | `/api/commercial/entries/:id` | 34 | ` getEntryById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-067` | `entryRoutes` | `POST` | `/api/commercial/entries` | 35 | ` requireRole(['admin', 'dispatcher', 'accountant']), createEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-068` | `entryRoutes` | `PUT` | `/api/commercial/entries/:id` | 36 | ` requireRole(['admin', 'dispatcher', 'accountant']), updateEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-069` | `entryRoutes` | `DELETE` | `/api/commercial/entries/:id` | 37 | ` requireRole(['admin', 'dispatcher', 'accountant']), deleteEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-070` | `healthRoutes` | `GET` | `/api/health/['/live` | 338 | ` '/liveness'], handleLiveness` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-071` | `healthRoutes` | `GET` | `/api/health/['/ready` | 339 | ` '/readiness'], handleReadiness` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-072` | `invoiceRoutes` | `GET` | `/api/invoices/metrics` | 25 | ` getInvoiceMetrics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-073` | `invoiceRoutes` | `GET` | `/api/invoices` | 26 | ` getInvoices` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-074` | `invoiceRoutes` | `GET` | `/api/invoices/:id` | 27 | ` getInvoiceById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-075` | `invoiceRoutes` | `POST` | `/api/invoices` | 28 | ` requireRole(['admin', 'accountant']), createInvoice` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-076` | `invoiceRoutes` | `POST` | `/api/invoices/:id/payments` | 29 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, recordInvoicePayment` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-077` | `invoiceRoutes` | `PUT` | `/api/invoices/:id/cancel` | 30 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, cancelInvoice` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-078` | `invoiceRoutes` | `POST` | `/api/invoices/:id/cancel` | 31 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, cancelInvoice` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-079` | `journeyRoutes` | `GET` | `/api/operations/journeys` | 37 | ` getJourneys` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-080` | `journeyRoutes` | `GET` | `/api/operations/journeys/metrics` | 38 | ` getJourneyMetrics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-081` | `journeyRoutes` | `GET` | `/api/operations/journeys/:id` | 39 | ` getJourneyById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-082` | `journeyRoutes` | `POST` | `/api/operations/journeys` | 42 | ` requireRole(['admin', 'dispatcher']), createJourney` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-083` | `journeyRoutes` | `PUT` | `/api/operations/journeys/:id/dispatch` | 43 | ` requireRole(['admin', 'dispatcher']), dispatchJourney` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-084` | `journeyRoutes` | `POST` | `/api/operations/journeys/:id/milestones` | 46 | ` requireRole(['admin', 'dispatcher']), addMilestone` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-085` | `journeyRoutes` | `POST` | `/api/operations/journeys/:id/delays` | 47 | ` requireRole(['admin', 'dispatcher']), recordDelay` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-086` | `journeyRoutes` | `POST` | `/api/operations/journeys/:id/diesel` | 50 | ` requireRole(['admin', 'dispatcher', 'accountant']), addDieselStop` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-087` | `journeyRoutes` | `POST` | `/api/operations/journeys/:id/expenses` | 51 | ` requireRole(['admin', 'dispatcher', 'accountant']), addDriverExpense` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-088` | `journeyRoutes` | `POST` | `/api/operations/journeys/:id/pod` | 54 | ` requireRole(['admin', 'dispatcher']), completeDeliveryAndPOD` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-089` | `journeyRoutes` | `PUT` | `/api/operations/journeys/:id/cancel` | 57 | ` requireRole(['admin', 'dispatcher']), cancelJourney` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-090` | `ledgerRoutes` | `GET` | `/api/ledger/summary` | 28 | ` getLedgerSummary` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-091` | `ledgerRoutes` | `GET` | `/api/ledger/reconciliation` | 29 | ` getLedgerReconciliation` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-092` | `ledgerRoutes` | `GET` | `/api/ledger` | 30 | ` getLedgerEntries` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-093` | `ledgerRoutes` | `POST` | `/api/ledger` | 31 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-094` | `ledgerRoutes` | `POST` | `/api/ledger/manual` | 32 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-095` | `ledgerRoutes` | `POST` | `/api/ledger/journals` | 33 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, createManualLedgerEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-096` | `ledgerRoutes` | `POST` | `/api/ledger/:id/reverse` | 34 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, reverseLedgerEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-097` | `ledgerRoutes` | `GET` | `/api/ledger/party-balances` | 37 | ` getPartyBalances` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-098` | `ledgerRoutes` | `GET` | `/api/ledger/party-balances/:partyId/statement` | 38 | ` getPartyStatement` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-099` | `ledgerRoutes` | `GET` | `/api/ledger/party-statements/:partyId` | 39 | ` getPartyStatement` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-100` | `ledgerRoutes` | `POST` | `/api/ledger/party-balances/:partyId/payout` | 40 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, recordPartyPayout` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-101` | `ledgerRoutes` | `POST` | `/api/ledger/parties/:partyId/payout` | 41 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, recordPartyPayout` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-102` | `maintenanceRoutes` | `GET` | `/api/fleet/maintenance/work-orders` | 49 | ` getWorkOrders` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-103` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/work-orders` | 50 | ` createWorkOrder` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-104` | `maintenanceRoutes` | `GET` | `/api/fleet/maintenance/work-orders/:id` | 51 | ` getWorkOrderById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-105` | `maintenanceRoutes` | `PUT` | `/api/fleet/maintenance/work-orders/:id` | 52 | ` updateWorkOrder` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-106` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/work-orders/:id/complete` | 53 | ` completeWorkOrder` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-107` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/work-orders/:id/cancel` | 54 | ` cancelWorkOrder` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-108` | `maintenanceRoutes` | `GET` | `/api/fleet/maintenance/tyres` | 59 | ` getTyres` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-109` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/tyres` | 60 | ` createTyre` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-110` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/tyres/mount` | 61 | ` mountTyre` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-111` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/tyres/:id/inspect` | 62 | ` inspectTyre` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-112` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/tyres/:id/retread` | 63 | ` retreadTyre` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-113` | `maintenanceRoutes` | `POST` | `/api/fleet/maintenance/tyres/:id/scrap` | 64 | ` scrapTyre` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-114` | `maintenanceRoutes` | `GET` | `/api/fleet/maintenance/analytics` | 69 | ` getMaintenanceAnalytics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-115` | `maintenanceRoutes` | `GET` | `/api/fleet/maintenance/profitability` | 70 | ` getVehicleProfitability` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-116` | `notificationRoutes` | `GET` | `/api/notifications/logs` | 33 | ` getNotificationLogs` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-117` | `notificationRoutes` | `POST` | `/api/notifications/logs/:id/resend` | 34 | ` requireRole(['admin', 'dispatcher', 'accountant']), resendNotification` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-118` | `notificationRoutes` | `GET` | `/api/notifications/opt-outs` | 35 | ` getOptOuts` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-119` | `notificationRoutes` | `POST` | `/api/notifications/opt-outs` | 36 | ` requireRole(['admin', 'dispatcher']), toggleOptOut` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-120` | `partyRoutes` | `GET` | `/api/parties/billing` | 37 | ` listBillingParties` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-121` | `partyRoutes` | `GET` | `/api/parties/billing/:id` | 38 | ` getBillingPartyById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-122` | `partyRoutes` | `POST` | `/api/parties/billing` | 39 | ` requireRole(['admin', 'dispatcher', 'accountant']), createBillingParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-123` | `partyRoutes` | `PUT` | `/api/parties/billing/:id` | 40 | ` requireRole(['admin', 'dispatcher', 'accountant']), updateBillingParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-124` | `partyRoutes` | `DELETE` | `/api/parties/billing/:id` | 41 | ` requireRole(['admin']), deleteBillingParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-125` | `partyRoutes` | `GET` | `/api/parties/balance` | 46 | ` listBalanceParties` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-126` | `partyRoutes` | `GET` | `/api/parties/balance/:id` | 47 | ` getBalancePartyById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-127` | `partyRoutes` | `POST` | `/api/parties/balance` | 48 | ` requireRole(['admin', 'dispatcher', 'accountant']), createBalanceParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-128` | `partyRoutes` | `PUT` | `/api/parties/balance/:id` | 49 | ` requireRole(['admin', 'dispatcher', 'accountant']), updateBalanceParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-129` | `partyRoutes` | `DELETE` | `/api/parties/balance/:id` | 50 | ` requireRole(['admin']), deleteBalanceParty` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-130` | `portalRoutes` | `POST` | `/api/portal/send-otp` | 29 | ` portalOtpSendLimiter, sendPortalOtp` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-131` | `portalRoutes` | `POST` | `/api/portal/verify-otp` | 30 | ` portalOtpVerifyLimiter, verifyPortalOtp` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-132` | `portalRoutes` | `GET` | `/api/portal/customer/dashboard` | 33 | ` externalPortalAuth, getCustomerDashboard` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-133` | `portalRoutes` | `GET` | `/api/portal/driver/trip` | 36 | ` externalPortalAuth, getDriverCurrentTrip` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-134` | `portalRoutes` | `POST` | `/api/portal/driver/epod` | 37 | ` externalPortalAuth, submitEpod` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-135` | `portalRoutes` | `GET` | `/api/portal/vendor/dashboard` | 40 | ` externalPortalAuth, getVendorDashboard` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-136` | `publicRoutes` | `POST` | `/api/public/demo-request` | 20 | ` async (req, res) => {` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-137` | `publicRoutes` | `GET` | `/api/public/status` | 56 | ` (_req, res) => {` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-138` | `settlementRoutes` | `GET` | `/api/commercial/settlements/metrics` | 26 | ` getSettlementMetrics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-139` | `settlementRoutes` | `GET` | `/api/commercial/settlements/pending-journeys/:driverId` | 27 | ` getPendingJourneysForDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-140` | `settlementRoutes` | `GET` | `/api/commercial/settlements/driver/:driverId/pending-trips` | 28 | ` getPendingJourneysForDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-141` | `settlementRoutes` | `POST` | `/api/commercial/settlements/preview` | 29 | ` previewSettlement` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-142` | `settlementRoutes` | `POST` | `/api/commercial/settlements/confirm` | 30 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, confirmSettlement` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-143` | `settlementRoutes` | `PUT` | `/api/commercial/settlements/:id/pay` | 31 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, markSettlementPaid` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-144` | `settlementRoutes` | `POST` | `/api/commercial/settlements/:id/mark-paid` | 32 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, markSettlementPaid` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-145` | `settlementRoutes` | `PUT` | `/api/commercial/settlements/:id/mark-paid` | 33 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, markSettlementPaid` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-146` | `settlementRoutes` | `POST` | `/api/commercial/settlements/:id/cancel` | 34 | ` requireRole(['admin', 'accountant']), requireStrictIdempotency, cancelSettlement` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-147` | `settlementRoutes` | `GET` | `/api/commercial/settlements` | 35 | ` getSettlements` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-148` | `superAdminRoutes` | `GET` | `/api/super-admin/kpis` | 41 | ` getPlatformKPIs` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-149` | `superAdminRoutes` | `GET` | `/api/super-admin/tenants` | 42 | ` listAllTenants` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-150` | `superAdminRoutes` | `PATCH` | `/api/super-admin/tenants/:id/override` | 43 | ` overrideTenantQuota` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-151` | `superAdminRoutes` | `PATCH` | `/api/super-admin/tenants/:id/extend-trial` | 44 | ` extendTenantTrial` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-152` | `superAdminRoutes` | `PATCH` | `/api/super-admin/tenants/:id/status` | 45 | ` toggleTenantStatus` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-153` | `superAdminRoutes` | `PATCH` | `/api/super-admin/tenants/:id/plan` | 46 | ` assignTenantPlan` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-154` | `superAdminRoutes` | `POST` | `/api/super-admin/tenants/:id/impersonate` | 47 | ` impersonateTenant` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-155` | `superAdminRoutes` | `POST` | `/api/super-admin/exit-impersonation` | 48 | ` exitImpersonation` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-156` | `superAdminRoutes` | `GET` | `/api/super-admin/audit-logs` | 49 | ` getAuditLogs` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-157` | `superAdminRoutes` | `GET` | `/api/super-admin/plans-catalog` | 52 | ` getPlatformPlansCatalog` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-158` | `superAdminRoutes` | `PUT` | `/api/super-admin/plans/:id` | 53 | ` updatePlan` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-159` | `superAdminRoutes` | `POST` | `/api/super-admin/plans` | 54 | ` createPlan` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-160` | `superAdminRoutes` | `PUT` | `/api/super-admin/addons/:id` | 55 | ` updateAddOn` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-161` | `superAdminRoutes` | `POST` | `/api/super-admin/addons` | 56 | ` createAddOn` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-162` | `superAdminRoutes` | `PUT` | `/api/super-admin/settings` | 57 | ` updatePlatformSettings` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-163` | `superAdminRoutes` | `POST` | `/api/super-admin/promo-codes` | 58 | ` createPromoCode` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-164` | `superAdminRoutes` | `PATCH` | `/api/super-admin/promo-codes/:id/toggle` | 59 | ` togglePromoCode` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-165` | `supportRoutes` | `GET` | `/api/support/tickets` | 17 | ` listTickets` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-166` | `supportRoutes` | `POST` | `/api/support/tickets` | 18 | ` createTicket` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-167` | `supportRoutes` | `GET` | `/api/support/tickets/:id` | 19 | ` getTicket` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-168` | `supportRoutes` | `POST` | `/api/support/tickets/:id/reply` | 20 | ` replyToTicket` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-169` | `trackingRoutes` | `GET` | `/api/telematics` | 23 | ` publicTrackingLimiter, publicTrackConsignment` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-170` | `trackingRoutes` | `GET` | `/api/telematics/:lrNumber` | 24 | ` publicTrackingLimiter, publicTrackConsignment` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-171` | `trackingRoutes` | `POST` | `/api/telematics/ping` | 27 | ` requireAuth, resolveTenantContext, ingestGpsPing` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-172` | `trackingRoutes` | `GET` | `/api/telematics/live/fleet` | 28 | ` requireAuth, resolveTenantContext, getFleetLiveMap` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-173` | `trackingRoutes` | `GET` | `/api/telematics/live/:truckId` | 29 | ` requireAuth, resolveTenantContext, getLiveTruckLocation` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-174` | `trackingRoutes` | `POST` | `/api/telematics/incident` | 30 | ` requireAuth, resolveTenantContext, reportTripIncident` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-175` | `truckRoutes` | `GET` | `/api/fleet/trucks` | 32 | ` listTrucks` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-176` | `truckRoutes` | `GET` | `/api/fleet/trucks/:id` | 33 | ` getTruckById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-177` | `truckRoutes` | `POST` | `/api/fleet/trucks` | 36 | ` requireRole(['admin', 'dispatcher']), requireQuota('trucks'), createTruck` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-178` | `truckRoutes` | `PUT` | `/api/fleet/trucks/:id` | 37 | ` requireRole(['admin', 'dispatcher']), updateTruck` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-179` | `truckRoutes` | `DELETE` | `/api/fleet/trucks/:id` | 38 | ` requireRole(['admin']), deleteTruck` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-180` | `truckRoutes` | `POST` | `/api/fleet/trucks/:id/assign-driver` | 41 | ` requireRole(['admin', 'dispatcher']), assignDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-181` | `truckRoutes` | `POST` | `/api/fleet/trucks/:id/unassign-driver` | 42 | ` requireRole(['admin', 'dispatcher']), unassignDriver` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-182` | `vehicleEntryRoutes` | `GET` | `/api/operations/vehicle-entries` | 32 | ` getVehicleEntries` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-183` | `vehicleEntryRoutes` | `GET` | `/api/operations/vehicle-entries/metrics` | 33 | ` getVehicleEntryMetrics` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-184` | `vehicleEntryRoutes` | `GET` | `/api/operations/vehicle-entries/:id` | 34 | ` getVehicleEntryById` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-185` | `vehicleEntryRoutes` | `POST` | `/api/operations/vehicle-entries` | 37 | ` requireRole(['admin', 'dispatcher', 'accountant']), createVehicleEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-186` | `vehicleEntryRoutes` | `PUT` | `/api/operations/vehicle-entries/:id` | 38 | ` requireRole(['admin', 'dispatcher', 'accountant']), updateVehicleEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-187` | `vehicleEntryRoutes` | `PUT` | `/api/operations/vehicle-entries/:id/pod` | 41 | ` requireRole(['admin', 'dispatcher', 'accountant']), updateVehicleEntryPOD` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-188` | `vehicleEntryRoutes` | `DELETE` | `/api/operations/vehicle-entries/:id` | 44 | ` requireRole(['admin']), deleteVehicleEntry` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-189` | `webhookRoutes` | `POST` | `/api/webhooks/billing` | 17 | ` handleBillingWebhook` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-190` | `webhookRoutes` | `GET` | `/api/webhooks/whatsapp` | 20 | ` verifyWhatsAppWebhook` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |
| `API-191` | `webhookRoutes` | `POST` | `/api/webhooks/whatsapp` | 21 | ` handleWhatsAppWebhook` | [ ] Not tested | Actual: ___; evidence: ___; defect: ___ |

## Appendix C — Mongoose model inventory and data integrity checks

For each model, verify required fields, enum values, defaults, casting, timestamps, indexes/uniqueness, tenant/company ownership, references, delete semantics and serialization. Validate through supported UI/API/test tools; do not edit production data directly.

| Test ID | Model file | Checks | Status / evidence |
|---|---|---|---|
| `MODEL-01` | `backend/src/models/AddOn.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-02` | `backend/src/models/ApprovalRule.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-03` | `backend/src/models/AuditLog.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-04` | `backend/src/models/BalanceParty.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-05` | `backend/src/models/BillingParty.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-06` | `backend/src/models/Branch.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-07` | `backend/src/models/Company.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-08` | `backend/src/models/CompanyMember.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-09` | `backend/src/models/CreditNote.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-10` | `backend/src/models/CustomFieldDefinition.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-11` | `backend/src/models/Driver.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-12` | `backend/src/models/Entry.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-13` | `backend/src/models/IdempotencyKey.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-14` | `backend/src/models/Invoice.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-15` | `backend/src/models/LeadInquiry.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-16` | `backend/src/models/Ledger.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-17` | `backend/src/models/MaintenanceOrder.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-18` | `backend/src/models/NotificationJob.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-19` | `backend/src/models/NotificationLog.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-20` | `backend/src/models/OptOutRegistry.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-21` | `backend/src/models/PaymentTransaction.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-22` | `backend/src/models/Plan.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-23` | `backend/src/models/PlatformAuditLog.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-24` | `backend/src/models/PlatformSetting.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-25` | `backend/src/models/PortalSession.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-26` | `backend/src/models/ProcessedWebhook.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-27` | `backend/src/models/PromoCode.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-28` | `backend/src/models/Settlement.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-29` | `backend/src/models/Subscription.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-30` | `backend/src/models/SupportTicket.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-31` | `backend/src/models/TripIncident.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-32` | `backend/src/models/Truck.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-33` | `backend/src/models/TruckJourney.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-34` | `backend/src/models/TyreRecord.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-35` | `backend/src/models/User.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-36` | `backend/src/models/VehicleEntry.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |
| `MODEL-37` | `backend/src/models/VehicleLocationLog.ts` | Required/enum/defaults; tenant scoping; references; indexes; created/updated timestamps; deletion/archive semantics; sensitive fields not leaked. | [ ] Not tested; evidence: ___; defect: ___ |

## Appendix D — Known issue and discrepancy regression suite

The repository includes issue reports and audits that sometimes conflict with one another or with the current source. These tests are **verification tasks, not assertions that the defect still exists**. Reproduce each against the current ZIP/build and record the observed result. If a prior issue report says “resolved,” still verify the acceptance criteria before release.

| Test ID | Issue / concern to verify | Reproduction / expected result | Priority | Status / evidence / defect |
|---|---|---|---|---|
| `REG-001` | Public demo/contact request fleet-size enum | Submit each frontend fleet-size option; backend should accept documented values, create one lead inquiry, and return success. No 500. | P1 | [ ] Not tested; ___ |
| `REG-002` | Marketing pricing vs seeded/live plans | Compare `/pricing` against `GET /api/billing/plans`; plan names, prices, limits, features and billing intervals must agree. | P1 | [ ] Not tested; ___ |
| `REG-003` | Checkout/payment simulation safety | In production-like config, missing/invalid payment credentials or forged signatures must never activate a paid plan. Test only in isolated staging. | P0 | [ ] Not tested; ___ |
| `REG-004` | Subscription entitlements | Confirm intended Starter/trial plan can use the agreed core workflows; denied features return clear explanation and appropriate status. | P1 | [ ] Not tested; ___ |
| `REG-005` | Quota enforcement under concurrency | Parallel create requests at remaining quota of one must not exceed quota. Run only against isolated test DB. | P1 | [ ] Not tested; ___ |
| `REG-006` | Credit note financial invariant | Issue credit note against invoice; invoice outstanding amount and ledger/party balances reduce exactly once and never below allowed floor. | P0 | [ ] Not tested; ___ |
| `REG-007` | Vendor payout ledger reconciliation | Record payout; party balance, settlement and balanced debit/credit entries reconcile, with no one-sided posting. | P0 | [ ] Not tested; ___ |
| `REG-008` | Public tracking privacy/IDOR | Try valid, invalid, guessed and another tenant's tracking references; return only approved public fields and no PII. | P0 | [ ] Not tested; ___ |
| `REG-009` | Portal OTP and account matching | Test customer/driver/vendor supported login types; correct phone field mapping, OTP expiry, retry/rate limit, wrong OTP and cross-company isolation. | P0 | [ ] Not tested; ___ |
| `REG-010` | Live fleet map schema projection | Add active truck and GPS ping; verify marker, truck identity and coordinates; stale/no GPS state must be clear. | P1 | [ ] Not tested; ___ |
| `REG-011` | AR aging party names | Seed known debtor balances; each row shows correct party name and amounts land in correct aging bucket. | P1 | [ ] Not tested; ___ |
| `REG-012` | Trip profitability calculation | Known journey revenue and cost fixture yields independently calculated expected margin; no unexplained zero or double-counted expense. | P1 | [ ] Not tested; ___ |
| `REG-013` | Dashboard maintenance truck count | Create truck in each status; dashboard count matches documented status mapping. | P1 | [ ] Not tested; ___ |
| `REG-014` | Mongo aggregation tenant ID types | With non-empty tenant data, dashboard/reports/metrics return correct values for that tenant and none from another tenant. | P0 | [ ] Not tested; ___ |
| `REG-015` | File upload MIME and path security | Try valid file, wrong extension, mismatched magic bytes, oversized file, traversal path and cross-tenant file ID; reject safely. | P0 | [ ] Not tested; ___ |
| `REG-016` | MongoDB transaction deployment mode | Verify financial multi-document operations on the actual target MongoDB topology; errors must be safe and no partial write may remain. | P0 | [ ] Not tested; ___ |
| `REG-017` | Idempotency on financial mutations | Repeat identical request with same key, without key, concurrent key use and changed payload with reused key; no duplicate posting. | P0 | [ ] Not tested; ___ |
| `REG-018` | Branch/company tenant context | Test all branch routes with missing context, wrong company, malformed ID and user lacking role; deny without side effects. | P0 | [ ] Not tested; ___ |
| `REG-019` | Custom field injection defense | Try reserved/prototype-related keys and malformed definitions; reject safely and ensure normal custom fields still render/save. | P1 | [ ] Not tested; ___ |
| `REG-020` | Credit notes page / route consistency | Sidebar item, App route, component and API must agree; navigation must not redirect unexpectedly to dashboard. | P1 | [ ] Not tested; ___ |
| `REG-021` | Hardcoded/mock data in stakeholder portals | Confirm customer, driver and vendor screens render authenticated server data; seeded/demo rows must not be mistaken for real tenant records. | P1 | [ ] Not tested; ___ |
| `REG-022` | Forgot/reset password lifecycle | Verify generic response avoids account enumeration, token expiry/one-time use, mail delivery configuration and safe invalid-token handling. | P1 | [ ] Not tested; ___ |
| `REG-023` | Invoice tax and rounding | Independently calculate GST, CGST/SGST/IGST selection where applicable, rounding, credit note impact and PDF totals. | P1 | [ ] Not tested; ___ |
| `REG-024` | Notification opt-out and resend | Respect opt-outs, role access, provider failures and duplicate resend; log state accurately. | P2 | [ ] Not tested; ___ |
| `REG-025` | Delete/archive semantics | For each entity, verify whether deletion is hard, soft or blocked by references; list/detail/report behavior remains consistent. | P1 | [ ] Not tested; ___ |

## Appendix E — End-to-end business workflows

Use unique, clearly marked QA data and keep a record of IDs created so cleanup is safe. Execute each flow across UI, API-backed persistence and related reports.

### E1. New tenant to first operational trip
- [ ] Register tenant; confirm duplicate email/company and invalid input handling.
- [ ] Complete onboarding; verify company and default subscription/branch state.
- [ ] Create branch, billing party, balance party, truck and driver.
- [ ] Verify all records persist after reload and appear only in the tenant that created them.
- [ ] Create journey, dispatch truck/driver, add milestones, diesel and expenses, then complete delivery/POD.
- [ ] Verify journey state transitions and that invalid/out-of-order transitions are rejected or handled explicitly.
- [ ] Verify dashboard, fleet status, maintenance counters and journey metrics after each relevant change.

### E2. Lorry receipt to invoice to payment to ledger
- [ ] Create LR with known consignor, consignee, route, quantity and freight.
- [ ] Validate required fields and any charge/tax calculations.
- [ ] Generate/print LR; compare printed fields with saved record.
- [ ] Generate invoice; independently calculate subtotal, tax, total and outstanding amount.
- [ ] Record partial payment; outstanding balance decreases exactly by payment amount.
- [ ] Record final payment; invoice reaches intended paid state and further invalid payment is rejected.
- [ ] Issue credit note; verify invoice, party balances and ledger reconciliation.
- [ ] Export/print relevant records; confirm file opens and matches UI values.

### E3. Driver settlement and vendor payout
- [ ] Create a completed eligible journey with known advance, diesel and expenses.
- [ ] Preview settlement; independently calculate net payable/receivable.
- [ ] Confirm once, double-submit, retry and use duplicate idempotency key.
- [ ] Mark paid; verify settlement state and ledger postings.
- [ ] Reverse/cancel if supported; verify reversal entries rather than destructive edits to posted financial history.
- [ ] Reconcile party statement, settlement list and ledger totals.

### E4. Subscription lifecycle and quota boundaries
- [ ] Compare public pricing to live plan catalog.
- [ ] Verify trial start/end, active, past-due, cancelled and expired states where test fixtures permit.
- [ ] For each quota-controlled entity, test below limit, exactly at limit, at limit + 1 and concurrent creation.
- [ ] Verify plan upgrade/downgrade proration, entitlement changes and payment verification.
- [ ] Confirm a tenant cannot alter another tenant's plan, quota or billing state.

### E5. Portal and public tracking lifecycle
- [ ] Generate a legitimate tracking reference and confirm only approved public fields are shown.
- [ ] Test unknown reference, malformed input, excessive requests and another tenant's reference.
- [ ] Request and verify portal OTP; test wrong, expired, reused and throttled OTP.
- [ ] Verify each portal only returns records associated with the authenticated stakeholder and tenant.
- [ ] Submit driver e-POD if implemented; verify uploaded evidence, journey state and audit trail.

## Appendix F — Feature scope boundaries: do not falsely mark planned work as implemented

The repository's feature specs/backlog include deferred or approval-dependent items. Treat these as scope/availability checks; do not test them as fully implemented unless the source and running environment demonstrate the feature.

| Feature / decision | Checklist treatment | Result / evidence |
|---|---|---|
| DEC-003 S3 object storage migration | Verify current configured storage backend and local-storage behavior; cloud/offsite storage is not considered available without explicit approval and configuration. | [ ] Checked; ___ |
| FEAT-001 NIC e-way bill integration | Verify only if credentials, routes and working integration are implemented; otherwise record `Not implemented / deferred`, not Pass. | [ ] Checked; ___ |
| FEAT-002 GST e-invoicing IRN/QR | Same rule; verify real provider/API integration rather than placeholder UI. | [ ] Checked; ___ |
| FEAT-003 VAHAN/Sarathi verification | Manual fields/document upload are not proof of live government verification. | [ ] Checked; ___ |
| FEAT-004 e-POD mobile capture with OTP | Verify actual end-to-end capture and OTP; simple document upload is not equivalent. | [ ] Checked; ___ |
| FEAT-005 FASTag toll reconciliation | Require actual import/provider integration and reconciliation evidence. | [ ] Checked; ___ |
| FEAT-006 fuel-card sync | Require real sync data and error handling, not a static screen. | [ ] Checked; ___ |
| FEAT-007 driver mobile PWA/offline workflow | Verify installability, offline queueing, sync conflict behavior and recovery only if implemented. | [ ] Checked; ___ |
| FEAT-008 Section 194C TDS engine | Do not infer automatic TDS from generic tax support. | [ ] Checked; ___ |
| FEAT-010 vendor portal end-to-end | Distinguish a functional API-backed vendor workflow from a visual mockup. | [ ] Checked; ___ |
| FEAT-011 tenant data export/offboarding | Verify export completeness, authorization, privacy and deletion/retention semantics only where implemented. | [ ] Checked; ___ |
| IMP-002 granular RBAC matrix | Verify actual role-level behavior; do not assume deferred per-permission matrix exists. | [ ] Checked; ___ |
| IMP-003 expiring member invitations | Verify token expiry/revocation behavior only if implemented; document any permanent/non-expiring token limitation. | [ ] Checked; ___ |
| OPS-002 distributed queue/BullMQ | Verify deployed worker topology; an in-process worker is not equivalent to distributed processing. | [ ] Checked; ___ |

## Appendix G — Final coverage sign-off

- [ ] Every route in Appendix A was tested or explicitly marked N/A/Blocked with a reason.
- [ ] Every page component in Appendix A was tested or explicitly marked N/A/Blocked with a reason.
- [ ] Every API declaration in Appendix B was exercised directly or through a traceable end-to-end test.
- [ ] Every Mongoose model in Appendix C has relevant data integrity and tenant-isolation coverage.
- [ ] All P0/P1 known-issue regressions in Appendix D have an evidence-backed outcome.
- [ ] At least one complete E2E workflow in each applicable Appendix E section passed.
- [ ] Deferred scope in Appendix F is clearly documented and not represented as a passing feature.
- [ ] No P0 defect remains open; all P1 defects are fixed or explicitly accepted by the product owner with risk documented.
- [ ] Final test environment, commit/version, browser, test data, tester and execution date are recorded.

**Important repository observation:** The ZIP contains `backend/.env`. I did not read or reproduce its contents. Avoid sharing ZIPs containing live secrets; if that file contains real credentials and the ZIP was shared outside a trusted environment, rotate those credentials and keep `.env` out of future archives.
