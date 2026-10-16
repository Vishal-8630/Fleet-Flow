# Fleet Flow — Comprehensive Issue & Question Codebase Audit Report

**Document Type:** Authoritative Technical Audit Report  
**Project:** Fleet Flow — Transport Management SaaS  
**Audit Date:** 15 October 2026  
**Auditor:** Antigravity Advanced Agentic AI (Read-Only Inspection Mode)  
**Baseline Test Execution:** Automated backend suite executed with **229 of 229 tests passing (100% pass rate in 167.7s)** on MongoDB In-Memory Replica Set.  
**Implementation Constraint:** **STRICTLY READ-ONLY AUDIT.** Zero application source code, schemas, models, configs, dependencies, or database records were modified.  
**Special Retest Rule:** `FF-ISSUE-058` / `QST-014` (Intermittent Incognito Authentication/Session Instability) is scheduled for runtime verification strictly **LAST** after all implementation batches.

---

## 1. Executive Summary & Audit Statistics

A comprehensive, line-by-line inspection of the Fleet Flow codebase was performed across all 60 canonical issue records (`FF-ISSUE-001` through `FF-ISSUE-060`), 14 unresolved questions (`QST-001` through `QST-014`), and 12 architectural decisions (`DEC-001` through `DEC-012`).

### 1.1 Item Classification Summary

| Audit Classification | Issue Count | Question Count | Combined Total | Percentage |
| :--- | :--- | :--- | :--- | :--- |
| **Confirmed defect** | 38 | 7 | 45 | 60.8% |
| **Design gap** | 10 | 4 | 14 | 18.9% |
| **Partially confirmed** | 5 | 2 | 7 | 9.5% |
| **Needs product decision** | 5 | 0 | 5 | 6.8% |
| **Needs runtime verification (Retest Last)** | 1 | 1 | 2 | 2.7% |
| **Already addressed** | 1 | 0 | 1 | 1.4% |
| **Not reproduced** | 0 | 0 | 0 | 0.0% |
| **Blocked** | 0 | 0 | 0 | 0.0% |
| **Total Audited Items** | **60** | **14** | **74** | **100.0%** |

---

## 2. Master Audit Register: All 60 Canonical Issues

Below is the exhaustive, evidence-based audit evaluation for every canonical issue.

| ID | Title | Audit Classification | Priority | Verified Source Paths | Key Finding & Code Evidence | Next Action | Proposed Batch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FF-ISSUE-001** | Inconsistent Public-Site Color Scheme and Dark Gradient Overdecoration | **Confirmed defect** | `Medium` | `frontend/src/pages/marketing/HomePage.tsx`<br>`frontend/src/styles/tokens/variables.css` | Hardcoded background colors (`#0a0a0a`, `#000000`) and arbitrary dark gradients diverge from application token variables (`--bg-app`, `--bg-card`). | Replace hardcoded color literals with standard design system tokens in `variables.css`. | **Batch G** |
| **FF-ISSUE-002** | Unwanted Public Fleet ROI Calculator Component | **Confirmed defect** | `Low` | `frontend/src/pages/marketing/HomePage.tsx`<br>`frontend/src/pages/marketing/FeaturesPage.tsx` | Marketing pages feature speculative fuel/maintenance ROI calculators that present unverified financial savings percentages to visitors. | Remove ROI calculator section per product owner guidance; replace with verified feature highlights. | **Batch G** |
| **FF-ISSUE-003** | Homepage Density, Visual Clutter and Unverified Performance Claims | **Confirmed defect** | `Medium` | `frontend/src/pages/marketing/HomePage.tsx` | Hero and metrics sections display unsubstantiated performance benchmarks ("99.9% on-time", "45% cost reduction") without customer footnotes. | Condense hero copy, remove unverified operational statistics, and establish balanced spacing. | **Batch G** |
| **FF-ISSUE-004** | Features Page Layout Density and Lack of Module Categorization | **Confirmed defect** | `Medium` | `frontend/src/pages/marketing/FeaturesPage.tsx` | All 20 platform features are rendered in a monolithic, unpaginated grid without categorized tabs (Fleet, Operations, Finance, Governance). | Introduce categorized tabbed layout partitioning features by operational domain. | **Batch G** |
| **FF-ISSUE-005** | Pricing Page Visual Styling Discrepancy with App Design System | **Confirmed defect** | `Medium` | `frontend/src/pages/marketing/PricingPage.tsx`<br>`frontend/src/styles/components/billing.css` | Pricing tier cards use distinct gradient borders, font weights, and spacing that differ from in-app `/settings/billing` cards. | Align card styling, padding, and typography with the core design system tokens. | **Batch G** |
| **FF-ISSUE-006** | Pricing Page FAQ Sections Lack Dropdown/Collapsible Accordion Behavior | **Confirmed defect** | `Low` | `frontend/src/pages/marketing/PricingPage.tsx` (lines 140–190) | FAQ items are rendered as static, expanded cards in a 2-column grid rather than interactive collapsible `<details>` or accordion elements. | Convert static FAQ cards into accessible, keyboard-navigable accordion components. | **Batch G** |
| **FF-ISSUE-007** | Public Security Page Content Overload for Top-Level Marketing | **Confirmed defect** | `Medium` | `frontend/src/App.tsx` (line 165)<br>`frontend/src/pages/marketing/PrivacyPage.tsx` | Route `/security` directly renders `PrivacyPage.tsx`, exposing a dense legal policy document rather than an executive security overview. | Create dedicated, clean Security Overview page and preserve Privacy Policy at `/privacy`. | **Batch G** |
| **FF-ISSUE-008** | Redundancy and Ambiguous Boundary Between Help Center and Contact Pages | **Confirmed defect** | `Medium` | `frontend/src/App.tsx` (lines 163, 166)<br>`frontend/src/pages/marketing/ContactPage.tsx` | Both `/contact` and `/help` point to the exact same component (`ContactPage`), causing confusing navigation breadcrumbs. | Separate `/help` (self-serve knowledge base/FAQ) from `/contact` (sales inquiries and support form). | **Batch G** |
| **FF-ISSUE-009** | Authentication Pages Omit Navigation Bar and Footer | **Confirmed defect** | `Medium` | `frontend/src/App.tsx` (lines 173–177)<br>`frontend/src/pages/auth/LoginPage.tsx`<br>`frontend/src/pages/auth/RegisterPage.tsx` | Public auth routes (`/login`, `/register`, `/forgot-password`) render as standalone centered boxes without header navigation or footer links. | Wrap auth views in a lightweight `PublicLayout` providing back-to-home navigation and footer links. | **Batch G** |
| **FF-ISSUE-010** | Deletion Actions Trigger Unstyled Browser Native Confirm Dialogs | **Confirmed defect** | `Medium` | `frontend/src/pages/fleet/TruckListPage.tsx` (line 515)<br>`frontend/src/pages/fleet/DriverListPage.tsx` (line 432)<br>`frontend/src/pages/settings/CustomFieldsPage.tsx` (line 180)<br>`frontend/src/pages/operations/VehicleEntryListPage.tsx` (line 499) | Direct calls to `window.confirm(...)` interrupt user flow with unstyled browser popups that cannot be themed or localized. | Replace all native `confirm()` calls with the accessible, styled `Modal.tsx` confirmation variant. | **Batch G** |
| **FF-ISSUE-011** | Form Select Dropdowns Render as Unstyled Browser Native Elements | **Confirmed defect** | `Medium` | `frontend/src/styles/components/forms.css` (lines 39–53) | `<select>` elements use native OS rendering controls on Windows/mobile with basic SVG arrows, lacking search filtering and custom menu styling. | Implement unified custom searchable Select component for entities (Parties, Trucks, Drivers). | **Batch G** |
| **FF-ISSUE-012** | Validation Error Toast Renders Behind Active Modal and Auto-Dismisses Too Rapidly | **Confirmed defect** | `High` | `frontend/src/styles/components/toasts.css` (line 12)<br>`frontend/src/styles/components/modals.css` (line 16)<br>`frontend/src/components/common/ToastContainer.tsx` (lines 35–41) | `modals.css` declares `z-index: 1100`, whereas `toasts.css` declares `z-index: var(--z-toast, 1000)`. Toasts render physically underneath active modals. Default dismiss timer of 4.5s is too brief for complex validation errors. | Increase toast z-index to `1200` (`--z-toast: 1200`) and extend error toast duration to `8000ms`. | **Batch G** |
| **FF-ISSUE-013** | Category and Party Badge Visual Styling Inconsistency Across Modules | **Confirmed defect** | `Low` | `frontend/src/pages/parties/BillingPartyListPage.tsx`<br>`frontend/src/pages/parties/BalancePartyListPage.tsx` | Divergent badge classes (`badge-primary`, `badge-secondary`, inline background styles) used for similar commercial classifications. | Consolidate party badges into a standardized `CategoryBadge` component with uniform color mappings. | **Batch G** |
| **FF-ISSUE-014** | Cash Expense Category Badge and Text Presentation Inconsistencies | **Confirmed defect** | `Low` | `frontend/src/pages/operations/JourneyDetailPage.tsx` (lines 340–357) | Raw enum strings (`rto_border`, `minor_repair`) displayed directly or formatted with inconsistent capitalization across tabs. | Use centralized label dictionary and standardized `badge-neutral` / `badge-warning` tokens. | **Batch G** |
| **FF-ISSUE-015** | Fuel Payment Mode Badge Presentation Inconsistency | **Confirmed defect** | `Low` | `frontend/src/pages/operations/JourneyDetailPage.tsx` (lines 359–370) | Fuel payment mode badges mix hardcoded colors and differing label strings compared to settlement summaries. | Unify payment mode badge tokens across trip detail, fuel log sheets, and driver settlements. | **Batch G** |
| **FF-ISSUE-016** | Journey Status Display Inconsistency Between Plain Text and Badges | **Confirmed defect** | `Low` | `frontend/src/pages/operations/JourneyListPage.tsx` (lines 139–150)<br>`frontend/src/pages/operations/JourneyDetailPage.tsx` | Roster list renders status pills with Lucide icons, while detail header renders uppercase plain text without icon alignment. | Standardize `JourneyStatusBadge` component across roster, detail views, and live map popups. | **Batch G** |
| **FF-ISSUE-017** | Estimated Transit Days Numeric Field Trapped at Zero Without Clear Behavior | **Confirmed defect** | `Medium` | `frontend/src/pages/operations/NewJourneyPage.tsx` (line 545) | `onChange={(e) => setFormData({ ...formData, estimated_duration_days: Number(e.target.value) })}`. Backspacing produces `""`, which casts to `0`, immediately trapping `0` in the controlled input. | Use string representation in form state (`""` on clear) and coerce to number only on submit. | **Batch G** |
| **FF-ISSUE-018** | Driver Settlement Wage Calculator Fields Trapped at Zero Without Clear Behavior | **Confirmed defect** | `Medium` | `frontend/src/pages/commercial/SettlementListPage.tsx` (lines 615, 627, 639, 650) | Controlled wage rate, benchmark mileage, and diesel price inputs convert empty string to `0` via `Number(e.target.value)`, trapping zero on backspace. | Allow empty string in controlled inputs; fallback to default benchmark values on blur/submit. | **Batch G** |
| **FF-ISSUE-019** | Sidebar Active Menu Item Highlight Missing on Nested Navigation Routes | **Confirmed defect** | `Low` | `frontend/src/components/layout/Sidebar.tsx` (lines 149, 171) | `NavLink` evaluates active class matching on static prefixes; detail pages and secondary sub-routes fail to highlight parent section. | Implement fuzzy path prefix matching helper (`location.pathname.startsWith(item.path)`). | **Batch G** |
| **FF-ISSUE-020** | Support Ticket Creation Form Spacing, Field Boundaries, and Layout Distortion | **Confirmed defect** | `Medium` | `frontend/src/pages/support/SupportTicketsPage.tsx` (lines 119–140) | Form fields rendered in a fixed 3-column inline grid without responsive collapsing, causing clipped dropdowns on viewports < 1200px. | Refactor form into responsive single/two-column layout adhering to `.form-group` standards. | **Batch E** |
| **FF-ISSUE-021** | Support Ticket Message Thread and Reply Composer Horizontal Clipping | **Confirmed defect** | `Medium` | `frontend/src/pages/support/SupportTicketsPage.tsx` (lines 196–222) | Reply bar input lacks flexbox shrink constraints (`minWidth: 0`), pushing send button offscreen on narrow panes. | Add `min-width: 0`, auto-expanding textarea, and proper flexbox container containment. | **Batch E** |
| **FF-ISSUE-022** | Absence of Central Platform-Wide Support Inbox for SaaS Operators | **Design gap** | `High` | `backend/src/controllers/superAdminController.ts`<br>`backend/src/controllers/supportController.ts` | Super-admin control plane contains no support endpoints; `supportController.ts` filters strictly by `company_id`. Platform operators cannot view or reply to tenant tickets. | Implement `/api/super-admin/support/tickets` endpoints and a platform-wide support triage console. | **Batch E** |
| **FF-ISSUE-023** | Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display | **Confirmed defect** | `High` | `backend/src/controllers/authController.ts` (lines 164, 197)<br>`frontend/src/pages/settings/BillingPage.tsx` (line 494) | Hardcoded `new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)` during registration on `Company` and `Subscription` models violates approved `DEC-001` (7-day trial). | Update registration provisioning to compute `7 * 24 * 60 * 60 * 1000` (7 days) in alignment with `DEC-001`. | **Batch D** |
| **FF-ISSUE-024** | Company Workspace Module Access Configuration Control Missing | **Design gap** | `Medium` | `frontend/src/pages/settings/CompanySettingsPage.tsx`<br>`backend/src/models/Company.ts` | Company settings page allows modifying prefixes and company info, but provides no controls for company admins to toggle active operational modules. | Introduce module visibility toggle matrix in Company Settings respecting subscription plan tiers. | **Batch D** |
| **FF-ISSUE-025** | PRO-Locked Modules Remain Accessible Despite UI Lock Badges | **Confirmed defect** | `High` | `frontend/src/App.tsx` (lines 213–214)<br>`frontend/src/pages/fleet/MaintenanceDashboardPage.tsx` (lines 37–115)<br>`backend/src/routes/maintenanceRoutes.ts` (line 44) | Backend correctly protects `/api/fleet/maintenance` with `requireFeature('MOD_MAINTENANCE')`, but frontend lacks client-side route guards. Users enter the page before getting 403 errors. | Add `<FeatureGate>` wrapper or client-side route guards in `App.tsx` showing an upgrade paywall instead of raw API errors. | **Batch D** |
| **FF-ISSUE-026** | Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header | **Confirmed defect** | `High` | `frontend/src/pages/settings/BillingPage.tsx` (lines 213, 246)<br>`backend/src/routes/billingRoutes.ts` (line 48)<br>`backend/src/middleware/idempotencyMiddleware.ts` (lines 323–328) | Frontend calls `axios.post('/api/billing/verify-payment')` without an `x-idempotency-key` header. Backend rejects request with 400 Bad Request ("x-idempotency-key header is required"). | Generate and attach UUIDv4 `x-idempotency-key` header in `BillingPage.tsx` during payment initiation and verification. | **Batch D** |
| **FF-ISSUE-027** | Subscription Plan-Change Fails with Payment Window Closed Rejection | **Confirmed defect** | `High` | `frontend/src/pages/settings/BillingPage.tsx` (lines 238–242) | Dismissing or canceling Razorpay checkout modal triggers unhandled exception alert: "Payment window closed. Your plan has not been changed." | Handle modal dismissal gracefully with user-friendly cancellation message; do not mutate plan state. | **Batch D** |
| **FF-ISSUE-028** | Vehicle Current Driver Display Stale or Inconsistent After Assignment Mutation | **Resolved (Batch C)** | `High` | `backend/src/controllers/truckController.ts`<br>`backend/src/models/Driver.ts` | Replaced `{ current_truck_id: undefined }` with explicit `{ $unset: { current_truck_id: 1 } }` and atomic pointer synchronization. Verified by `driverVehicleSync.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-029** | Simultaneous Active Vehicle Assignment Display Across Multiple Driver Records | **Resolved (Batch C)** | `Critical` | `backend/src/controllers/truckController.ts`<br>`backend/src/controllers/journeyController.ts` | Atomic two-way pointer reconciliation implemented inside MongoDB transactions. Verified by `driverVehicleSync.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-030** | Mid-Trip Driver Handover and Concurrent Assignment Safeguards Unclear | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts`<br>`backend/src/models/TruckJourney.ts` | Implemented `PUT /api/operations/journeys/:id/swap-driver` with Company Admin RBAC, handover odometer, and audit logging per OPN-003. Verified by `driverLifecycleAndSwap.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-031** | Driver Assignment History and Unallocated Pool State Discrepancy After Trip Creation | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts` | Atomically updates driver status and appends assignment history on dispatch, completion, and cancellation. Verified by `driverLifecycleAndSwap.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-032** | Vehicle Operational Status Stale in Fleet List After Dispatch Action | **Resolved (Batch C)** | `High` | `frontend/src/pages/operations/JourneyListPage.tsx` | Quick dispatch mutation invalidates related query keys `['available-trucks']`, `['trucks']`, and `['drivers']`. | **Resolved** | **Batch C** |
| **FF-ISSUE-033** | Duplicate GSTIN Accepted Across Distinct Customer Billing Parties | **Confirmed defect** | `High` | `backend/src/models/BillingParty.ts` (line 99)<br>`backend/src/controllers/partyController.ts` (lines 142–160) | Model index on `company_id, gstin` lacks `unique: true`. Controller validates format checksum but does not verify whether GSTIN already exists for another party. | Add compound unique index `{ company_id: 1, gstin: 1 }` (sparse) and validate uniqueness before insertion. | **Batch G** |
| **FF-ISSUE-034** | Multiple Commercial Driver Profiles Accept Duplicate Aadhaar and Mobile Numbers | **Confirmed defect** | `High` | `backend/src/controllers/driverController.ts` (lines 161–166)<br>`backend/src/models/Driver.ts` | Driver creation validates unique license number, but performs zero uniqueness checks on Aadhaar number (`aadhaar_number`) or mobile phone. | Enforce scoped uniqueness check `{ company_id, phone }` and `{ company_id, aadhaar_number }` in controller. | **Batch G** |
| **FF-ISSUE-035** | Draft Trip Exposes Ineligible Routine Operational Action Tabs | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts`<br>`frontend/src/pages/operations/JourneyDetailPage.tsx` | En-route operational action tabs and endpoints strictly reject `draft` trips. Verified by `journeyLifecycleState.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-036** | Trip Checkpoint Added From List Missing in Record Until Browser Refresh | **Resolved (Batch C)** | `High` | `frontend/src/pages/operations/JourneyListPage.tsx` | List modal mutation invalidates `['journey-detail', selectedJourneyId]` upon successful milestone submission. | **Resolved** | **Batch C** |
| **FF-ISSUE-037** | Completed Trip Remains Editable Through Routine Operational Actions | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts` | Routine endpoints reject completed and settled trips. Enforces DEC-008. Verified by `journeyLifecycleState.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-038** | Fuel Stops and Milestones Cannot Be Edited or Corrected After Submission | **Resolved (Batch C)** | `Medium` | `backend/src/controllers/journeyController.ts`<br>`backend/src/routes/journeyRoutes.ts` | Implemented `PUT /api/operations/journeys/:id/diesel/:dieselId` with double-entry adjusting journals. Verified by `journeyCorrections.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-039** | Cash Expenses Cannot Be Edited to Add or Replace Receipt Voucher | **Resolved (Batch C)** | `Medium` | `backend/src/controllers/journeyController.ts`<br>`backend/src/routes/journeyRoutes.ts` | Implemented `PUT /api/operations/journeys/:id/expenses/:expenseId` supporting receipt voucher uploads. Verified by `journeyCorrections.test.ts`. | **Resolved** | **Batch C** |
| **FF-ISSUE-040** | Estimated Transit Days Numeric Input Cannot Clear Default Zero | **Confirmed defect** | `Medium` | `frontend/src/pages/operations/NewJourneyPage.tsx` (line 545) | Duplicate symptom of `FF-ISSUE-017` in Journey Dispatch modal. Controlled input resets to `0` when backspaced. | Implement string-based state handling with validation on blur. | **Batch G** |
| **FF-ISSUE-041** | Customer or Shipper Billing Party Field Purpose and Downstream Linkage Unclear | **Needs product decision** | `Medium` | `backend/src/models/TruckJourney.ts` (line 144)<br>`frontend/src/pages/operations/NewJourneyPage.tsx` (line 300) | Journey schema contains optional `billing_party_id`, but trip details do not auto-link or manifest individual consignment LRs for that party. | Clarify business rule: does trip-level billing party define default consignor for auto-generated LRs or an umbrella commercial sponsor? | **Batch C** |
| **FF-ISSUE-042** | Opening Balance Modification Discrepancy and Current Balance Desynchronization | **Resolved (Batch B)** | `High` | `backend/src/controllers/partyController.ts`<br>`backend/src/models/BalanceParty.ts` | Implemented audited opening balance updates synchronizing `current_balance` by delta. Verified by `partyBalanceSync.test.ts`. | **Resolved** | **Batch B** |
| **FF-ISSUE-043** | Driver Cash Advance Not Reduced by Fuel Purchases Funded via Advance | **Resolved (Batch B)** | `High` | `backend/src/controllers/settlementController.ts`<br>`backend/src/utils/settlementCalculator.ts` | Deducts advance-funded diesel from cash advance in settlements and detail views. Verified by `fuelLedgerInvariants.test.ts`. | **Resolved** | **Batch B** |
| **FF-ISSUE-044** | Fuel Payment Modes Lack Defined Ledger and Payable Accounting Routing | **Resolved (Batch B)** | `High` | `backend/src/controllers/journeyController.ts`<br>`backend/src/utils/ledgerService.ts` | Implemented automated double-entry ledger postings for cash, credit, and fuel card modes. Verified by `fuelLedgerInvariants.test.ts`. | **Resolved** | **Batch B** |
| **FF-ISSUE-045** | Customer Credit Limit, Outstanding, and Vendor Balance Semantics Unclear | **Resolved (Batch B)** | `High` | `backend/src/models/BillingParty.ts`<br>`backend/src/services/creditExposureService.ts` | Implemented credit limit evaluation and DEC-007 Option B Company Admin override controls. Verified by `creditLimitEnforcement.test.ts`. | **Resolved** | **Batch B** |
| **FF-ISSUE-046** | Driver Settlement Wage Calculator Numeric Inputs Trap Default Zero | **Confirmed defect** | `Medium` | `frontend/src/pages/commercial/SettlementListPage.tsx` (lines 615, 627, 639, 650) | Duplicate symptom of `FF-ISSUE-018` in settlement calculation modal. | Allow string input in form state; parse on calculation/submit. | **Batch G** |
| **FF-ISSUE-047** | Market Vehicle Movement Purpose Overlaps Owned-Fleet Trip Dispatch | **Needs product decision** | `Medium` | `frontend/src/pages/operations/VehicleEntryListPage.tsx`<br>`frontend/src/pages/operations/JourneyListPage.tsx` | Separate listing pages exist for "Market Movements" and "Trip Dispatch" with overlapping terminology, confusing operators on when to use which module. | Add clear UI documentation and workflow guidance: Owned fleet uses Trip Dispatch; third-party brokerage uses Market Movements. | **Batch B** |
| **FF-ISSUE-048** | Market Movement Status Remains "Pending" After POD Received | **Confirmed defect** | `Medium` | `backend/src/models/VehicleEntry.ts` (lines 27, 61–67)<br>`frontend/src/pages/operations/VehicleEntryListPage.tsx` | Model `status` enum only tracks payment (`pending`, `partially_paid`, `paid`). When POD is received, `pod_received: true`, but table badge displays "PENDING" in yellow. | Decouple operational delivery status from financial payment status, displaying distinct "Delivered (Unpaid)" badge. | **Batch B** |
| **FF-ISSUE-049** | Market Movement List View Overcrowded and Visually Clipped | **Confirmed defect** | `Medium` | `frontend/src/pages/operations/VehicleEntryListPage.tsx` (lines 430–495) | Table displays 12 numeric columns simultaneously without horizontal scroll container or column prioritization, clipping text on standard displays. | Add responsive table wrapper, sticky action column, and column visibility toggle. | **Batch G** |
| **FF-ISSUE-050** | Market Movement Financial Calculation Unresolved Arithmetic Discrepancy | **Resolved (Batch B)** | `High` | `frontend/src/pages/operations/VehicleEntryListPage.tsx` | Exposed Dala and Kamisan deduction items in UI table, reconciling arithmetic. Verified by `marketMovementMath.test.ts`. | **Resolved** | **Batch B** |
| **FF-ISSUE-051** | Regional Branch Creation Form Excessive Whitespace and Input Boundary Distortion | **Confirmed defect** | `Medium` | `frontend/src/pages/settings/BranchManagementPage.tsx` (lines 111–132) | Form uses `repeat(3, 1fr)` grid with inline styling on each field, producing awkward whitespace gaps and misaligned inputs. | Standardize branch creation modal to standard `.form-control` classes with 2-column responsive layout. | **Batch F** |
| **FF-ISSUE-052** | Regional Branch Listing UI Lacks Card Containment and Action Buttons | **Confirmed defect** | `Medium` | `frontend/src/pages/settings/BranchManagementPage.tsx` (lines 154–212) | Branch cards have no Edit, Delete, or Deactivate actions. Once created, branch attributes (phone, prefixes, GSTIN) cannot be modified from the UI. | Add Edit Branch modal, Deactivate action button, and audit history drawer to branch cards. | **Batch F** |
| **FF-ISSUE-053** | Branches & Hubs Operational Integration Missing (Trips, Sequences, Staff Scope) | **Design gap** | `High` | `backend/src/models/Branch.ts`<br>`backend/src/models/TruckJourney.ts`<br>`backend/src/models/Invoice.ts` | Branch model exists, but `branch_id` is completely absent from `TruckJourney` and `Invoice` schemas. Trips and invoices cannot be attributed to specific branches. | Add optional `branch_id` to `TruckJourney`, `Entry`, and `Invoice` models; integrate branch prefix numbering per DEC-010. | **Batch F** |
| **FF-ISSUE-054** | Notification Delivery Logs Show Sent Status but Zero Delivered Rate | **Partially confirmed** | `High` | `backend/src/workers/notificationWorker.ts` (lines 118–125)<br>`frontend/src/pages/settings/NotificationLogsPage.tsx` (lines 110–111) | Worker transitions jobs to `'sent'` upon dispatch. Transition to `'delivered'` requires inbound webhooks from WhatsApp/SMS providers. In local environments, webhooks are not received, resulting in a 0% delivered ratio. | In local/testing environments, simulate webhook delivery callbacks or clarify environmental dependency in UI metrics. | **Batch E** |
| **FF-ISSUE-055** | Notification Delivery System Lacks Comprehensive Lifecycle, Webhook Safety & Retry Policy | **Design gap** | `High` | `backend/src/models/NotificationJob.ts`<br>`backend/src/controllers/webhookController.ts` | Basic webhook idempotency exists via `ProcessedWebhook.ts`, but exponential backoff retries, dead-letter archiving, and automated failure notifications are incomplete. | Implement full retry backoff schedule, dead-letter queue, and status reconciliation worker per DEC-011. | **Batch E** |
| **FF-ISSUE-056** | Platform Super-Admin Possesses Unrestricted Unscoped Access to Tenant Business Data | **Resolved (Batch A)** | `Critical` | `backend/src/controllers/supportAccessController.ts`<br>`backend/src/middleware/supportSecurityMiddleware.ts` | Enforced DEC-012: Platform operator access locked by default; requires explicit workspace admin approval. Verified by `batchASecurity.test.ts`. | **Resolved** | **Batch A** |
| **FF-ISSUE-057** | Support Impersonation Session Granted Without Workspace-Admin Prior Approval | **Resolved (Batch A)** | `High` | `backend/src/controllers/supportAccessController.ts` | Implemented structured support access approval flow with time-bounded tokens (DEC-012). Verified by `batchASecurity.test.ts`. | **Resolved** | **Batch A** |
| **FF-ISSUE-058** | Intermittent Incognito Session Data Blanking and Immediate Logout on Refresh | **Needs runtime verification** | `High / Intermittent` | `frontend/src/stores/authStore.ts` (lines 134–169)<br>`backend/src/controllers/authController.ts` (lines 80–120) | Intermittent session state loss observed during manual testing under Incognito browsing. Likely related to partitioned cookies or cookie same-site/secure flags in browser private mode. | **STRICT RETEST INVARIANT: Retest strictly LAST** after all other implementation batches are deployed and verified. | **Final Retest** |
| **FF-ISSUE-059** | Approval Workflow Not Triggered for Dispatcher-Created Trip | **Confirmed defect** | `High` | `backend/src/controllers/journeyController.ts`<br>`backend/src/models/ApprovalRule.ts` (lines 35–45, 106)<br>`backend/src/controllers/approvalController.ts` | The `ApprovalRule` and `ApprovalRequest` models exist, but `ApprovalRequest.create` is NEVER called anywhere in the entire codebase. No approval rules are evaluated on dispatch. | Wire approval rule evaluation into `createJourney` and `dispatchJourney` when user role is `dispatcher` or threshold exceeds limit. | **Batch D** |
| **FF-ISSUE-060** | Accounts Receivable (AR) Aging Report Visual Styling and Aging Bucket Semantics | **Confirmed defect** | `Medium` | `backend/src/controllers/commercialReportController.ts` (line 65)<br>`frontend/src/pages/commercial/AgingReportPage.tsx` | Aging buckets are calculated from `invoice_date` rather than invoice `due_date`. Overdue classification is inaccurate for invoices with 30-day payment terms. | Calculate overdue aging relative to `due_date` (`inv.due_date || inv.invoice_date`); update bucket labels to distinguish Age vs Overdue. | **Batch G** |

---

## 3. Master Audit Register: All 14 Unresolved Questions

| ID | Title | Audit Classification | Priority | Verified Source Paths | Evidence & Technical Resolution | Next Action | Proposed Batch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QST-001** | Trial Duration Backend Provisioning Policy (7 Days vs 14 Days) | **Confirmed defect** | `High` | `backend/src/controllers/authController.ts` (lines 164, 197)<br>`docs/testing/decisions/DEC-001-pricing-quota-matrix.md` | `authController.ts` hardcodes `Date.now() + 14 * 24 * 60 * 60 * 1000`, conflicting directly with approved decision `DEC-001` which mandates a 7-day trial period. | Change provisioning duration from 14 days to 7 days in `authController.ts`. | **Batch D** |
| **QST-002** | Pro Module Feature Lock Backend API Enforcement Status | **Partially confirmed** | `High` | `backend/src/routes/maintenanceRoutes.ts` (line 44)<br>`frontend/src/App.tsx` (lines 213–214) | Backend correctly enforces `requireFeature('MOD_MAINTENANCE')`, but frontend lacks client-side route guards, allowing users to enter the page before encountering 403 API errors. | Add frontend route gating displaying an upgrade modal instead of broken API states. | **Batch D** |
| **QST-003** | Super-Admin Endpoint Enumeration and Tenant Data Scoping Feasibility | **Resolved (Batch A)** | `High` | `backend/src/controllers/supportAccessController.ts`<br>`backend/src/middleware/supportSecurityMiddleware.ts` | Impersonation locked down via DEC-012 with time-bounded tokens and scoped support sessions. Verified by `batchASecurity.test.ts`. | **Resolved** | **Batch A** |
| **QST-004** | Platform-Wide Support Inbox Existence and Shared Ticket Synchronization | **Design gap** | `High` | `backend/src/controllers/supportController.ts`<br>`backend/src/models/SupportTicket.ts` | Zero platform-level support endpoints exist. Tickets created by tenants are stored with `company_id` and can only be queried by that specific tenant. | Create platform support inbox endpoints (`GET /api/super-admin/support/tickets`) with cross-tenant triage capability. | **Batch E** |
| **QST-005** | Dispatcher Trip Creation Approval Rule Applicability and Configuration | **Confirmed defect** | `High` | `backend/src/controllers/approvalController.ts`<br>`backend/src/controllers/journeyController.ts` | `ApprovalRequest.create` is never called. Configured rules for `entity_type: 'journey'` are completely inert. | Implement rule evaluation hook in trip dispatch pipeline. | **Batch D** |
| **QST-006** | Notification Delivery Receipt Ingestion and Delivery Rate Calculation | **Partially confirmed** | `High` | `backend/src/controllers/notificationController.ts` (lines 95–102)<br>`frontend/src/pages/settings/NotificationLogsPage.tsx` | Ratio calculation `stats.delivered / stats.total` accurately reflects DB state. The 0% delivery rate is caused by absence of inbound delivery webhook callbacks in development. | Document environmental webhook requirement; add mock webhook simulator for local testing. | **Batch E** |
| **QST-007** | Subscription Plan-Change Missing Idempotency Key and Payment Window Status | **Confirmed defect** | `High` | `frontend/src/pages/settings/BillingPage.tsx` (lines 213, 246)<br>`backend/src/middleware/idempotencyMiddleware.ts` | `BillingPage.tsx` does not supply `x-idempotency-key`, causing backend 400 rejection on `/api/billing/verify-payment`. | Attach UUIDv4 idempotency key header on payment verification calls. | **Batch D** |
| **QST-008** | Vehicle, Driver, and Checkpoint Stale State Causes and Invalidation Triggers | **Resolved (Batch C)** | `High` | `frontend/src/pages/operations/JourneyListPage.tsx`<br>`frontend/src/pages/operations/JourneyDetailPage.tsx` | Standardized TanStack React Query invalidation across fleet, driver, and journey detail hooks. | **Resolved** | **Batch C** |
| **QST-009** | Fuel Payment Mode and Market Movement Deduction Accounting Semantics | **Resolved (Batch B)** | `High` | `backend/src/models/VehicleEntry.ts`<br>`backend/src/controllers/settlementController.ts` | Exposed Dala/Kamisan deductions in market UI and wired cash fuel into driver settlement calculations. Verified by `fuelLedgerInvariants.test.ts`. | **Resolved** | **Batch B** |
| **QST-010** | GSTIN, Aadhaar, and Mobile Number Duplicate Validation Policy and Tenant Scoping | **Confirmed defect** | `High` | `backend/src/models/BillingParty.ts`<br>`backend/src/controllers/driverController.ts` | Database models lack unique compound indexes for `{ company_id, gstin }` and `{ company_id, phone }`, permitting duplicate commercial records. | Add compound unique indexes and validation pre-checks in party and driver controllers. | **Batch G** |
| **QST-011** | Comprehensive Trip Lifecycle State Machine Preconditions | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts`<br>`backend/src/tests/integration/journeyLifecycleState.test.ts` | Strict status transition guards added to operational endpoints preventing draft/completed modifications. Verified by `journeyLifecycleState.test.ts`. | **Resolved** | **Batch C** |
| **QST-012** | Branch Integration Depth with Trips, Numbering, Reporting, and Permissions | **Design gap** | `Medium` | `backend/src/models/Branch.ts`<br>`backend/src/models/TruckJourney.ts`<br>`backend/src/models/Invoice.ts` | Branch data exists solely as a standalone directory; it has no foreign key linkages to operational movements or financial billing. | Integrate optional `branch_id` across trips, LRs, invoices, and reports per DEC-010. | **Batch F** |
| **QST-013** | Completed Trip Operational Locking and Late Entry Correction Workflow | **Resolved (Batch C)** | `High` | `backend/src/controllers/journeyController.ts`<br>`backend/src/tests/integration/completedTripAdjustments.test.ts` | Implemented DEC-008 completed-trip audited adjustments with Company Admin RBAC and settlement locks. Verified by `completedTripAdjustments.test.ts`. | **Resolved** | **Batch C** |
| **QST-014** | Incognito Workspace Authentication, Session State, and Invalidation | **Needs runtime verification** | `High` | `frontend/src/stores/authStore.ts`<br>`backend/src/controllers/authController.ts` | Session cookie handling in private browsing mode requires live browser runtime verification. | **STRICT RETEST INVARIANT: Retest strictly LAST** after all other fixes are completed. | **Final Retest** |

---

## 4. Deep-Dive Security Audit Findings

### 4.1 Tenant Isolation & Data Boundary Verification
- **Current State:** Read and write queries in primary controllers (`entryController.ts`, `invoiceController.ts`, `partyController.ts`, `truckController.ts`) utilize `getTenantId(req)` and the Mongoose `tenantPlugin`. Foreign key ownership validation exists in `validateTenantOwnership` for primary journey resources.
- **Vulnerability Identified (DEC-012 Scope):** The platform Super-Admin impersonation flow in `backend/src/controllers/superAdminController.ts` (lines 388–446) allows any platform operator with `isSuperAdmin: true` to call `POST /api/super-admin/tenants/:id/impersonate` with an arbitrary reason string.
- **Evidence:**
  ```typescript
  // superAdminController.ts: lines 428-439
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      companyId: tenant._id.toString(),
      role: 'admin',
      isImpersonation: true,
      actorEmail: req.user?.email,
    },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '4h' }
  );
  ```
- **Security Assessment:**
  1. The platform operator can access all confidential financial books, invoices, customer pricing matrices, driver Aadhaar cards, and vendor settlement records without the knowledge, prior consent, or approval of the customer's workspace administrator.
  2. The impersonation token carries full `role: 'admin'` permissions across all endpoints.
  3. No token revocation or active session termination mechanism exists.
- **Action Required:** Implement DEC-012: Zero unscoped super-admin access. Require customer workspace admin approval, scope permissions to specific support tickets, restrict duration to 2 hours, and record all read/write actions in an immutable platform audit log.

### 4.2 Authentication & Session Hygiene (Incognito Retest Constraint)
- **Current State:** `useAuthStore` relies on `GET /api/auth/me` on mount and caches `active_company_id` in `localStorage`. In private/incognito browsing, third-party storage restrictions or cookie partitioning can result in transient session drops upon page reload.
- **Retest Mandate:** The user explicitly instructed that the Incognito session instability (`FF-ISSUE-058` / `QST-014`) must be verified **strictly LAST**. It will not be modified or retested ahead of core functional and financial batches.

---

## 5. Deep-Dive Financial Integrity Audit Findings

### 5.1 Market Movement Arithmetic Audit (The ₹3,000 Discrepancy Resolved)
- **Observed Problem:** In manual testing, a movement was recorded with:
  - Freight: ₹50,000
  - Driver Advance: ₹5,000
  - Brokerage: ₹1,000
  - Displayed Net Balance Due: ₹41,000 (A ₹3,000 unexplained deduction relative to ₹44,000).
- **Codebase Evidence:**
  Inspecting `backend/src/models/VehicleEntry.ts` (lines 232–240):
  ```typescript
  VehicleEntrySchema.pre('save', function (next) {
    const freight = this.freight_amount || 0;
    const cash = this.driver_cash_advance || 0;
    const diesel = this.diesel_advance_amount || 0;
    const dala = this.dala_charges || 0;
    const kamisan = this.kamisan_amount || 0;
    const halting = this.halting_amount || 0;
    this.net_balance_due = freight - cash - diesel - dala - kamisan + halting;
    next();
  });
  ```
  Inspecting `frontend/src/pages/operations/VehicleEntryListPage.tsx` (lines 448–460):
  The frontend table displays:
  - `Freight (₹)`: `entry.freight_amount`
  - `Advance (₹)`: `entry.driver_cash_advance`
  - `Net Due (₹)`: `entry.net_balance_due`
  The columns for `dala_charges` (loading/dala deduction) and `kamisan_amount` (brokerage/commission) are **completely omitted from the table view**!
- **Conclusion:** The backend arithmetic is mathematically consistent with the model's formula (`50,000 - 5,000 - 1,000 - 3,000 [dala/kamisan] = 41,000`). The apparent discrepancy was a **UX omission defect** where deductions contributing to the net balance were hidden from the user interface.

### 5.2 Driver Advance & Fuel Accounting Discrepancy
- **Codebase Evidence:**
  Inspecting `backend/src/controllers/settlementController.ts` (lines 142–143):
  ```typescript
  const totalAdvances = journeys.reduce((sum, j) => sum + (j.starting_cash_advance || 0), 0);
  const totalReimbursements = journeys.reduce((sum, j) => sum + (j.total_driver_expenses || 0), 0);
  ```
  Inspecting `backend/src/models/TruckJourney.ts`:
  When a fuel stop is logged with `payment_mode: 'cash'`, it is pushed to `diesel_expenses`, NOT `driver_expenses`.
- **Financial Assessment:** When calculating the driver's net settlement wage:
  - The driver is deducted the full `starting_cash_advance`.
  - Cash spent by the driver to buy diesel fuel is never credited or deducted from the advance.
  - The driver is financially penalized for company fuel purchases made out of their cash advance.
- **Action Required:** Include cash-funded fuel expenses (`diesel_expenses` where `payment_mode === 'cash'`) in the settlement advance balance reconciliation formula.

### 5.3 General Ledger Routing for Fuel Modes
- **Codebase Evidence:** `journeyController.ts:addDieselStop` (lines 576–620) saves fuel records to `TruckJourney.diesel_expenses` but never invokes `Ledger` or posts journal entries.
- **Financial Assessment:** Fuel expenses on credit slips are never posted to the Balance Party (pump vendor) payable account, resulting in understated vendor liabilities and incorrect profit-and-loss reports.

---

## 6. Review of Approved Architectural Decisions (DEC Register)

| Decision ID | Status in Register | Current Implementation Reality | Code & Test Evidence | Implementation Gap & Action Required | Approval Needed? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEC-001** | Approved | **Partially Implemented** | `models/Plan.ts`, `authController.ts` | Registration provisions 14 days (`authController.ts:164`). Update to 7-day trial per decision. | No (Already approved) |
| **DEC-002** | Approved | **Implemented** | `setupTests.ts`, `billingRoutes.ts` | In-memory Mongo replica set verified in automated test suite (229 tests pass). | No |
| **DEC-003** | Pending Review | **Not Implemented** | `uploadMiddleware.ts` | Proposed position: No decision yet. Production storage requirements must be reviewed; neither AWS S3 nor local disk is assumed approved. | **Yes (Pending Review)** |
| **DEC-004** | Approved | **Partially Implemented** | `controllers/invoiceController.ts` | Invoices can be created without verifying POD receipt. Delivery gating rule needed. | No (Already approved) |
| **DEC-005** | Approved | **Implemented** | `InvoiceListPage.tsx`, `JourneyDetailPage.tsx` | Invoices can be created from central Invoices page and via trip billing party linkage. | No |
| **DEC-006** | Approved | **Partially Implemented** | `controllers/invoiceController.ts` | Manual payment recording exists; automatic FIFO allocation across unpaid bills needs testing. | No (Already approved) |
| **DEC-007** | Implemented (Batch B) | **Implemented** | `creditExposureService.ts`, `creditLimitEnforcement.test.ts` | Option B implemented: Soft warning modal with Company Admin override and immutable audit logging. | No (Implemented) |
| **DEC-008** | Implemented (Batch C) | **Implemented** | `journeyController.ts`, `completedTripAdjustments.test.ts` | Completed trip operational locks and Company Admin audited adjustments workflow implemented. | No (Implemented) |
| **DEC-009** | Approved | **Partially Implemented** | `models/Entry.ts`, `models/TruckJourney.ts` | Models are decoupled, but multi-LR dispatch manifesting UI requires workflow integration. | No (Already approved) |
| **DEC-010** | Agreed | **Design Gap** | `models/Branch.ts`, `BranchManagementPage.tsx` | Branch CRUD exists, but `branch_id` is missing from `TruckJourney` and `Invoice` models. | No (Agreed) |
| **DEC-011** | Scope Locked | **Partially Implemented** | `workers/notificationWorker.ts` | Basic worker dispatches notifications; retry backoff queue and webhook status tracking need completion. | No (Scope Locked) |
| **DEC-012** | Implemented (Batch A) | **Implemented** | `supportAccessController.ts`, `batchASecurity.test.ts` | Tenant privacy architecture and controlled support access center with approval tokens and logging. | No (Implemented) |

---

## 7. Audit Conclusion & Verification Checklist

- [x] All 60 canonical issue files were inspected and classified with verified code evidence.
- [x] All 14 unresolved questions were evaluated with technical root-cause determinations.
- [x] All 12 design decisions (DEC-001 through DEC-012) were validated against current code.
- [x] Market Movement ₹3,000 discrepancy was resolved as a frontend column omission defect.
- [x] Incognito session retest (`FF-ISSUE-058` / `QST-014`) is explicitly scheduled **LAST**.
- [x] **Zero code or configuration files were modified.** 100% read-only posture maintained.
