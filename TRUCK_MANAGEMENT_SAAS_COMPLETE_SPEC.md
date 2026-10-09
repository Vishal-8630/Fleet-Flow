# Truck Management System — Code-Based Feature Reverse-Engineering Specification

**Purpose:** A detailed functional inventory for rebuilding a stronger version in Antigravity.

**Method and confidence:** Static inspection of the uploaded ZIP's React routes/pages/components/hooks/types, Express routes/controllers, Mongoose models/validators, and configuration. This documents what the code indicates; it does not claim live integration/runtime testing against MongoDB, S3, PDF rendering or WhatsApp credentials.


## Executive Summary — Product Scope, Readiness & How to Use This Specification

> **Important interpretation:** This file combines (1) features inferred from the uploaded source code and (2) proposed target-state SaaS architecture. A feature described in this document is **not proof that it is implemented or production-ready**. Treat every capability as `Verified in source`, `Partially present`, `Proposed`, or `Needs runtime verification` until it passes acceptance tests.

### Product goal

Build one secure, multi-tenant Truck / Transport Management SaaS used by multiple independent transport companies under monthly or annual subscriptions. Each company must receive its own isolated workspace, users, data, settings, enabled modules, usage limits and subscription state. Do not create a separate codebase for each customer.

### Current product capability summary

The source-derived inventory identifies these existing or partially present areas:

- Public marketing pages, contact/inquiry forms, quote requests and legal pages.
- Authentication, profile, password-change/recovery endpoints and avatar upload.
- Operational dashboard and watchlists.
- Truck/fleet registry, compliance document vault and driver assignment history.
- Driver registry, identity/licence documents and payment/advance summary.
- Journeys/trips, routes/checkpoints, progress, fuel/diesel, driver expenses, delays, incidents and delivery/POD information.
- Bill entries, billing parties, invoice/PDF output, LR copies and blank LR output.
- Vehicle-entry logs, balance parties and party-balance reports.
- Driver settlement preview, confirmation, recalculation and finalization flows.
- Financial ledger with linked entities, debit/credit, payment modes and generated entries.
- LR-based shipment tracking API/component.
- Inquiry and quotation administration.
- Audit history, S3-backed document handling, exports, printing/PDFs and WhatsApp notifications.

The source inspection also identified gaps such as registration-route reachability, disabled password-reset email delivery, missing dedicated public tracking route, a disabled WhatsApp scheduler, uncertain API authorization coverage, client-side aggregation/filtering, financial formula ambiguity and transaction/idempotency risks. Re-test these against the current branch before deciding they are still defects.

### Target-state SaaS capabilities

The following are required for a commercial multi-company subscription product, even if absent from the original application:

- Tenant onboarding, company workspace and verified company ownership.
- Company membership/invitations, role-based and optionally field-level permissions.
- Server-enforced tenant isolation for every database query, API, file, export, report, background job and integration.
- Plan catalog, monthly/annual billing, trials, add-ons, entitlements, quotas, invoices, payment webhooks, renewals, cancellation and overdue-payment grace policies.
- One central feature catalog with dependency rules and company-specific entitlements.
- Company settings, supported custom fields, form layouts and controlled workflow configuration.
- Secure data export, retention/deletion policy, backups and tested restore.
- Monitoring, error reporting, audit coverage, rate limiting, security testing and deployment/runbook documentation.
- Customer support, service-status/incident process and user-facing help/onboarding.
- Accessibility, responsive UX, consistent search/filter/sort/pagination and reliable empty/loading/error states.
- Documented and tested business formulas for balances, taxes, trip profitability, fuel efficiency and driver settlements.

### Product boundaries and recommended release strategy

**MVP / first paid release:** tenant isolation; secure authentication and membership; company setup; truck, driver and trip management; fuel/expenses; billing/LR/invoices if required by the target market; payment/settlement records; basic reports; subscription entitlements; platform super-admin; backup/restore; audit trail; operational monitoring and essential security tests.

**Follow-up modules:** advanced accounting/reconciliation, GPS hardware integration, customer/driver portals, automated WhatsApp/SMS/email, advanced analytics, workflow builder, custom fields and external integrations. Prioritize these using interviews with target transport operators rather than assuming every customer needs every module.

### Status labels to use throughout implementation

- `EXISTING — VERIFIED`: tested end-to-end in the current environment.
- `EXISTING — SOURCE ONLY`: present in source, runtime behavior not verified.
- `PARTIAL`: some UI/API/model exists, but the workflow is incomplete.
- `PROPOSED`: target-state requirement not yet implemented.
- `BLOCKED — BUSINESS DECISION`: implementation requires a confirmed policy or formula.
- `NOT IN MVP`: deliberately deferred, not forgotten.

### Readiness verdict

This document is a substantial functional and architectural blueprint, but it should **not** be treated as a complete launch-readiness checklist by itself. The extra sections added below cover missing cross-cutting product, operational, security, compliance, quality and release requirements. Pricing examples, statutory tax details and settlement formulas must be confirmed before implementation; illustrative examples are not authoritative business or legal rules.


## 1. Product overview and stack

The project is a React + TypeScript single-page web app with a Node/Express + MongoDB/Mongoose backend. It combines a public logistics company website with an authenticated operations application. Major areas are: login/profile; bill entries, billing parties, invoices and Lorry Receipts (LR); vehicle-entry logs and balance parties; truck/fleet registry; driver registry; truck journeys; driver settlements; financial ledger; public LR-based tracking API; admin inquiry/quote management; operational dashboard/watchlists; audit history; file uploads; PDF/print/export; and WhatsApp notifications.

Frontend dependencies include React 19, TypeScript, Vite, React Router, TanStack React Query, Zustand, Axios, Tailwind, Framer Motion, Lucide/React icons, XLSX, jsPDF, html-to-image/html2canvas, react-to-print. Backend dependencies include Express 5, Mongoose, bcryptjs, JWT, express-validator, multer/multer-s3, AWS S3 SDK, Puppeteer/Puppeteer Core, WhatsApp Web.js and express-rate-limit.

## 2. Route-by-route inventory

### Public pages
- `/` — marketing landing page: company positioning, service/benefit sections, expertise, contact/inquiry form and corporate/client information sections.
- `/about` — company story/values, offerings and call-to-action.
- `/services` — service catalogue and descriptions.
- `/fleet` — public-facing fleet/vehicle-type marketing and request/contact call-to-action. Separate from the internal truck registry.
- `/contact` — contact information and inquiry form: full name, email, subject, message.
- `/faq` — FAQ content.
- `/terms-and-conditions` and `/privacy-policy` — legal pages.
- `/login`, `/forgot-password`, `/reset-password/:token` — account access and password recovery.
- `*` — 404/not-found page.

### Protected pages
- `/profile` — profile, password/security, avatar upload and logout.
- `/bill-entry/all-bill-entries` — billing-entry list, search/filter, pagination, detail navigation.
- `/bill-entry/bill-entry-detail/:id` — selected bill detail/edit.
- `/bill-entry/lrcopy` — search by LR number and generate/download/print an LR copy.
- `/bill-entry/empty-lr` — blank LR template with LR number and date.
- `/bill-entry/bill` — lookup by bill number and view/download/print invoice.
- `/bill-entry/billing-party` and `/bill-entry/billing-party-detail/:id` — billing-party directory and detail.
- `/vehicle-entry/all-vehicle-entries` and `/vehicle-entry/vehicle-entry-detail/:id` — vehicle movement logs and detail.
- `/vehicle-entry/balance-party` — balance-party directory.
- `/vehicle-entry/party-balance` — party balance report, name search and export.
- `/journey/all-journey-entries` — journey/trip list.
- `/journey/all-truck-entries` — truck/fleet list.
- `/journey/all-driver-entries` — driver list.
- `/journey/all-settlements` — driver settlement list.
- `/journey/truck/:id` — truck details, operational records and compliance document vault.
- `/journey/journey-detail/:id` — full operational and financial trip record.
- `/journey/driver-detail/:id` — driver profile, credentials, documents, assigned vehicles and payment context.
- `/journey/driver-detail/:id/settlement` — settlement setup.
- `/journey/driver-detail/:id/settlement/preview` — settlement preview/confirmation stage.
- `/journey/driver-detail/:id/settlement/:settlementId` — saved settlement detail.
- `/ledger/new-ledger`, `/ledger/all-ledgers`, `/ledger/ledger-detail/:id` — create/list/detail financial transactions.
- `/admin/inquiries` and `/admin/quotes` — inquiry/quote queues and status updates.
- `/dashboard/unsettled-journeys`, `/dashboard/driver-settlements`, `/dashboard/party-payments`, `/dashboard/compliance-alerts`, `/dashboard/activity-log` — operational watchlists.

**Routing inconsistency to investigate:** A Register component and `/api/auth/register` exist, but `/register` is not present in the main route table inspected. A tracking API and TrackingModal component exist, but there is no dedicated public tracking route in that route table.

## 3. Shared application shell and reusable behavior

- Sidebar, navbar, mobile bottom bar, nested route outlet, overlay, scroll-to-top and navigation buttons.
- ProtectedRoute and `useAuthCheck` (`/auth/me`) for session checking.
- Zustand stores for auth, messages, sidebar and theme.
- Shared buttons, form inputs, image input, form sections, smart dropdown, loading indicator, confirm/delete modal, message bar, pagination, paginated list, filter container, generic filter, metadata fields, history drawer/timeline and Excel button.
- Framer Motion animation definitions.
- Shared date/number formatting and normalized-error helpers.
- Filter helpers support nested values and flattening data for search/export.
- Duplicate/parallel code exists in `src/api` and `src/lib/api`, and in `src/filters` and `src/lib/filters`; consolidate in the new build.

## 4. Authentication and user profile

### Login/session
- Login form uses an account identifier and password and includes a remember-me option.
- `POST /api/auth/login`; backend compares bcrypt hashes and issues JWT; login route uses rate limiting.
- Cookie parsing and credentialed Axios configuration are present.
- `POST /api/auth/logout`; `GET /api/auth/me`.

### Registration
- User model fields: full name, email, username, password, created/updated timestamps, `isAdmin`, `isVerified`, reset token/expiry and avatar.
- Email and username are unique. Password is hashed using bcrypt before save.
- Registration API and UI exist but route reachability needs verification.

### Password recovery/profile
- Forgot password: `POST /api/auth/forgot-password`; reset: `PATCH /api/auth/reset-password/:token`.
- Controller explicitly says email is disabled and returns that a reset token was generated. A complete end-user delivery flow is therefore not established by the checked code.
- Profile updates use `PATCH /api/auth/update-profile`; password update uses `PATCH /api/auth/update-password`; avatar uses multipart `PATCH /api/auth/update-avatar`.
- Avatar storage uses S3 helpers and attempts to delete the old object when replaced.
- Logout is exposed in profile and shared navigation.

**Security note:** Frontend route protection is not sufficient server-side authorization. In the rebuild, enforce permissions at every API route, especially admin queues, identity documents, ledger edits and destructive actions.

## 5. Main dashboard and watchlists

### Main dashboard
- Greeting includes the current user's full name (“Operational Intelligence”).
- Cash Flow Overview, revenue-impact/financial overview, compliance indicator and journey operations sections.
- KPI cards include unsettled journey/driver-settlement work and pending party/bill-related items.
- Quick action includes Start Journey.
- Recent activity combines journeys and invoice/bill entries; driver-related information/alerts are also present.
- It loads records and calculates some summary values in frontend code rather than using one dedicated aggregate endpoint. Revalidate every formula and time window.

### Unsettled Journeys
- Search; party-payment status filter All/Pending/Partially Paid; overdue-days filter; date-from/date-to; reset; pagination.
- Shows truck, driver, route, end date, days since, party-payment status and navigation to journey details.

### Pending Driver Settlements
- Pending settlement list with payment-direction filter and minimum-amount filter.
- Summary count/total for filtered settlements.
- Columns include driver, period, journeys, distance, total amount and payment direction.
- Direction values include “Driver needs to pay” and “DRL needs to pay”.

### Party Payments Watchlist
- Based on vehicle entries, not driver settlements.
- Search; status filter All/Pending/Received (defaults to Pending); date range; movement type; reset; summary counts/pending total; pagination.
- Keep this status model distinct from journey party-payment status Pending/Partially Paid/Paid.

### Compliance Alerts
- Lists truck compliance document expiry alerts, with pagination and critical/expiry presentation.
- Truck model supports fitness, insurance, national permit, state permit, tax and pollution documents, each with expiry date.
- New build should explicitly define overdue/due-soon windows and alert sorting.

### Operational Activity
- Merges journeys and bill/invoice records.
- Type filter All/Journey/Invoice; journey-status filter; search; date range; reset; pagination.
- Summary counts include journeys and active journeys; rows show truck/status or invoice amount/billing party.

## 6. Bill entries, billing parties, invoices and LR

### Bill-entry list/detail
- Bill list displays bill number and View Details action; shared filtering/search/pagination utilities are available.
- Backend lists all entries populated with billing party and sorted newest-first.
- Detail route loads by ID and supports edit; update validates payload, handles extra-charge rows and writes audit history.
- Bill creation triggers a WhatsApp notification asynchronously/fire-and-forget.

### Bill-entry form (all data fields in the schema)
The UI sections include **Bill & Party Info**, **Consignment Details**, **Extra Charges**, **Billing & Accounts**, **Total Summary**.

- Bill & party: bill number/date, billing party, LR number/date.
- Consignor: name, origin/from address, GST number.
- Consignee: name, destination/to address, GST number.
- Consignment: package count (`pkg`), vehicle number, from/to, BE number/date, weight, CBM, fixed/rate-per/rate, packing mode, invoice number, e-way bill number, goods description, container number, value, clerk name, empty-yard name and remarks.
- Billing: “to be billed at”, hire amount, risk, billing-office address, advance.
- Repeatable extra charges: type, amount, rate, per-amount; add and remove actions with remove confirmation.
- Summary: subtotal, CGST, SGST, IGST, grand total; model also has GST state/other-state fields.
- Many money/quantity fields are strings in MongoDB. Rebuild with decimal-safe numeric storage and explicit, server-authoritative tax/total calculations.

### Invoice/bill output
- `/bill-entry/bill` searches by bill number (example placeholder 1001). Empty state says no invoice loaded until a valid bill is searched.
- Backend `/api/invoice/generate-pdf` uses Puppeteer/browser-based PDF generation; a browser-test endpoint exists for diagnostics.
- Frontend has `Invoice` and `BillInvoice` components plus PDF download/print hooks; confirm which component is used for each workflow.

### LR outputs
- LR Copy page searches by LR number to download/print an official LR copy.
- Empty LR page generates a blank LR template from LR number and date.
- LR number is also the key used by the tracking backend, but tracking is a separate public-facing use case.

### Billing parties
- List/card shows party name, address and View Details.
- Form fields: name, address, GST number.
- APIs: create/list/update and case-insensitive search by name.
- Referenced by billing entries and ledger. Lists sort newest-first.

## 7. Vehicle-entry records and balance parties

### Vehicle entries
- List/detail pages; shows vehicle number and View Details.
- APIs create/list/update and query by balance-party ID. Results populate balance party and sort newest-first.
- New entry calls WhatsApp notification.
- Form groups: Movement & Vehicle, Financial Settlement, Halting & Delays, Party Association.
- Schema fields: date, vehicle number, from/to, freight, driver cash, dala, kamisan/commission, in-account, balance, halting amount, halting-in date, halting-out date, POD stock, owner, linked balance party and status Pending/Received (default Pending).

### Balance parties and party-balance report
- Balance party model is a name field plus timestamps. New-party form asks for full party name.
- Backend supports create/list/update; no delete route is exposed in the route file inspected.
- Party balance page searches party by name and offers Export Report/download filtered data.
- Report uses vehicle entries linked to a balance party. The business formula for opening balance, freight, driver cash, commission/fees, halting, receipts and closing outstanding should be confirmed with the business owner before implementation.

## 8. Fleet and driver management

### Truck registry
- Create/list/update/soft-delete; truck number is required, trimmed and unique.
- Truck detail sections: Operational Records and Compliance Vault; download actions for documents.
- Driver assignments store assignment and unassignment timestamps.
- S3-backed uploads and signed URLs for truck documents.
- Soft delete via `is_deleted`.
- Model fields: truck number; fitness/insurance/national permit/state permit/tax/pollution document URLs and expiry dates; driver assignment history; `last_service_kms`; `service_interval` default 10,000 km.
- Truck form copy also suggests make/model, year and notes/engine/maintenance details, but the core Mongoose model inspected does not formally define make/year/specification fields. Confirm whether these values persist or are ignored.

### Driver registry/detail
- Create/list/update/soft-delete; deleted drivers excluded from list.
- Detail sections: Legal Credentials, Profile Specifications, Digital Documentation; document download actions.
- Driver model: name (required), photo, address, phone, home phone, Aadhaar number, driving licence number, Aadhaar front/back images, licence front/back images, soft-delete, last payment-clear date/amount, advance amount, amount company owes driver (`amount_to_pay`), amount driver owes company (`amount_to_receive`), vehicle assignment history.
- Validation: mobile 10–15 digits, home phone 7–15 digits, Aadhaar and DL unique.
- Driver images/documents use S3 upload and signed URLs. Sensitive identity data needs strict access, encryption and retention policy.

## 9. Journey and trip lifecycle

### Journey list/create
- Create/list/update/soft-delete; truck and driver are required references.
- List populates truck and driver; new journey triggers WhatsApp notification.
- New Journey form sections: Assignment (truck/driver dropdowns with Create New shortcuts), Route Details (from/to/route checkpoints), Timelines & Funds (duration/start/end dates/starting cash), Odometer & Payload (distance, loaded weight, average mileage, starting/ending kilometers), Journey Summary (narrative notes), Plan Actions.

### Journey model fields and automated behavior
- Truck, driver, from, to; route array; journey duration defaults to 5 days.
- Start date defaults to today if missing; end date is generated from today + duration if missing.
- Status Active/Completed/Delayed/Cancelled (default Active).
- Driver expenses array: amount/reason/date. Diesel expenses array: amount/quantity/filling date.
- Delays array: place/date/reason. Settlement fields: amount paid/date/mode/remarks.
- Daily progress array: day number/date/location/remarks; pre-save hook regenerates it if length differs from `journey_days`.
- Issues/incidents: date/note. Delivery details: delivered-to, entry date, empty date, remarks. Status updates: status/timestamp.
- Total driver and diesel expenses computed from arrays before save; virtual `total_expense` sums the two.
- If status is Completed and summary is empty, summary is generated from route, duration and distance.
- Party-payment state Pending/Partially Paid/Paid, due date, received date, remarks.
- Separate journey settlement status Settled/Unsettled. Model comment says Settled should require amount-paid and date-paid values; verify actual enforcement.
- Separate bulk settlement fields `settled` and `settlement_ref`.

### Journey detail sections
Operational Detail; Travel Logs; Driver Ledger; Diesel Logs; Transit Delays; Route Checkpoints; Reported Incidents; Profitability IQ; Financial Overview; Delivery & POD; Account Settlements; Financial Reconciliation. Intended to capture trip progress, route, fuel, expenses, delays/incidents, delivery details, party payments and settlement reconciliation together.

## 10. Driver settlement workflow

- Settlement list populates driver and journeys.
- Driver-specific settlement route supports period selection; preview endpoint computes a preview based on selected journeys and rate/mileage/diesel inputs; confirm endpoint persists settlement and links journeys.
- Model fields: driver, from/to period, journey IDs, total driver expense, total diesel expense/quantity, starting cash, rate-per-km totals, total distance, average mileage, diesel used/difference/value, driver/owner/overall totals, rate/km and diesel rate, payment status, payment metadata, settled flag/time.
- Payment status: Balanced, Driver needs to pay, DRL needs to pay. Payment metadata: mode/date/remarks.
- Confirmation marks journeys settled and links `settlement_ref`; driver payment summary is updated and advance amount reset to zero (comment says this depends on policy).
- Actions: mark settled (`PATCH /api/settlements/:id/mark-settled`), unmark settled (`PATCH /api/settlements/:id/unmark-settled`), recalculate (`POST /api/settlements/:id/recalculate`). Recalculation is rejected for settled records.
- Mark settled cleans up prior auto-generated ledger records for that settlement, writes a settlement payout ledger entry and sends WhatsApp notification. Unmark removes auto-generated ledger entries. Audit history is written for settlement events.
- Critical rebuild requirements: document exact sign/formula rules for driver/owner/overall totals, diesel difference and rate/km; prevent duplicate overlapping settlements; use MongoDB transactions for settlement + journey + driver + ledger changes; make operations idempotent.

## 11. Financial ledger

### UI sections
- New ledger form: Linked Objects, Transaction Details, Financials, Traceability, Additional Metadata.
- Ledger list: search description/truck/driver; category and transaction/post-type filters; date-from/date-to; detail navigation.
- Ledger detail: Core Transaction Info, Entity Associations, References & Notes, System Metadata, delete confirmation.

### Model fields
- Date; optional journey/truck/driver/billing-party/settlement/vehicle-entry references.
- Categories: Freight Income, Diesel Expense, Driver Advance, Driver Settlement, In Account, Driver Expense, Toll Expense, Repair Expense, Maintenance Expense, Office Expense, Payment Received, Payment Made, Cash Transfer, Bank Transfer, Other Income, Other Expense, Journey Settlement.
- Transaction types: Journey, Vehicle Entry, Driver Settlement, Manual Adjustment, Payment Receipt, Expense.
- Description, debit, credit, amount, Debit/Credit balance type.
- Payment mode Cash/Bank/UPI/Cheque/Credit.
- Reference number and type None/Invoice/Bill/Voucher/UTR/Cheque/LR/Slip/Ref; notes.
- Auto-generated, reversed, parent entry, verified, locked, locked timestamp.
- GST rate/amount/CGST/SGST/IGST; arbitrary metadata; balance-after-transaction; timestamps/indexes.
- Backend create/list/update/delete and populates linked entities. Clearly distinguish manual vs generated ledger entries in the replacement.

## 12. Shipment tracking

- `GET /api/tracking/:lr_no` searches billing entry by LR number; missing LR returns 400; unknown LR returns 404.
- Finds related Active/Completed journey records newest-first and populates truck.
- Uses latest non-empty daily-progress location as last known location; returns journey status and last-updated data, falling back to Processing/LR date when no journey is found.
- TrackingModal exists, but no dedicated public tracking route was found in the main route table. Treat as API/component present but user-facing route potentially disconnected.
- Public tracking should expose only explicitly approved fields; avoid leaking driver/private information.

## 13. Inquiry and quote management

### Inquiry
- Public forms on landing and contact pages: full name, email, subject, message.
- `POST /api/inquiry`; status Pending/Reviewed/Replied (default Pending).
- Admin `/admin/inquiries` loads newest first, has filters and status update via `PATCH /api/inquiry/:id`; status changes are audited.

### Quote
- QuoteModal submits `POST /api/quote`.
- Fields: full name, email, phone number, pickup location, drop location, cargo type, weight, truck type, pickup date and optional message.
- Status Pending/Quoted/Booked/Cancelled (default Pending).
- Admin `/admin/quotes` lists newest-first, filters and updates status via `PATCH /api/quote/:id`; changes are audited.
- Public forms need validation, spam/rate protection and safe handling of contact information.

## 14. Audit history

- AuditLog stores entity type/ID, action create/update/delete/status_change, changed field names, before/after snapshots, actor ID/username/full name, IP/path/method and timestamps.
- Compound index supports entity history by entity and newest date.
- Shared HistoryDrawer and HistoryTimeline components; `GET /api/history/:entityType/:entityId` returns recent paginated history.
- Audit helper functions compute diffs, derive actor and log events.
- Audit calls appear in truck, driver, bill, vehicle-entry, ledger, inquiry, quote and settlement workflows, but verify full create/update/delete coverage for every entity.

## 15. Uploads, PDFs, exports and WhatsApp

### Uploads
- S3 upload middleware and helpers; signed URLs and delete-object helpers.
- Truck compliance files; driver photo/Aadhaar/licence images; user avatar.
- Some upload flows attempt to clean uploaded objects if later validation/update fails.

### PDF/print/export
- Invoice generation endpoint uses Puppeteer; a browser test endpoint exists.
- Frontend PDF download and print hooks; Invoice and BillInvoice components.
- XLSX/FileSaver-related dependencies, Excel button and export helper; Party Balance has explicit export.
- jsPDF/html-to-image/html2canvas/react-to-print are installed; verify which screen uses each path.
- Test browser/chromium compatibility in deployment, not only local development.

### WhatsApp
- `sendWhatsApp.js`, `whatsappScheduler.js`, `/api/whatsapp` routes.
- Templates/events include new bill, new journey and settlement-paid. Vehicle-entry creation also invokes WhatsApp send.
- Notifications are fire-and-forget and may fail independently of the main save operation.
- Daily scheduler startup is commented out in `server.js`, despite a comment about an 8 AM summary. Do not assume scheduled summaries run.
- Better implementation should record delivery status, retry transient failures, log errors, support template/config management and respect opt-in/privacy.

## 16. Search, filters, pagination and formatting

- Generic filtering and per-entity filter definitions for vehicle entries, balance parties, billing parties, bill entries, journeys, trucks, drivers and settlements.
- Nested-value helper and flattening utilities support search/export.
- Shared pagination, date formatting, number formatting, normalized errors and Excel export.
- Some watchlists visibly filter loaded arrays in component state; confirm client/server behavior per page.
- A consistent server-side pagination/sorting contract is not apparent from inspected routes. For scale, support query parameters and database indexes instead of loading every record.

## 17. API endpoint map

| API prefix | Operations indicated by route files | Purpose |
|---|---|---|
| `/api/auth` | register/login/logout/me/forgot/reset/profile/password/avatar | Authentication and account |
| `/api/bill-entry` | create/list/update/search by params/search by ID or LR | Billing and LR records |
| `/api/billing-party` | create/list/update/search by name | Billing parties |
| `/api/vehicle-entry` | create/list/update/by-party | Vehicle logs |
| `/api/balance-party` | create/list/update | Balance-party directory |
| `/api/truck` | create/list/update/delete (soft delete) | Fleet |
| `/api/driver` | create/list/update/delete (soft delete) | Drivers |
| `/api/journey` | create/list/update/delete (soft delete) | Journeys |
| `/api/settlements` | list/preview/confirm/mark settled/unmark/recalculate | Driver settlements |
| `/api/invoice` | generate PDF/browser test | Invoice output |
| `/api/ledger` | create/list/update/delete | Ledger |
| `/api/inquiry` | create/list/update status | Inquiry workflow |
| `/api/quote` | create/list/update status | Quote workflow |
| `/api/tracking` | track by LR number | Shipment status |
| `/api/whatsapp` | status and WhatsApp operations | Messaging integration |
| `/api/history` | get entity history | Audit trail |

This is a route-prefix summary, not a guarantee that every endpoint has correct authorization or production-ready error handling.

## 18. Main data models and relationships

- **User:** full name, email, username, password hash, admin/verified flags, reset token/expiry, avatar and timestamps.
- **Entry / billing entry:** bill/LR identifiers and dates; billing-party ref; consignor/consignee and GST; route; package/weight/CBM; vehicle; BE/invoice/e-way/container/goods data; rates/hire/advance/risk; extra-charge array; subtotal/GST/grand total.
- **BillingParty:** name/address/GST.
- **BalanceParty:** party name.
- **VehicleEntry:** date, vehicle, route, freight/cash/fees/balance/halting/POD/owner, balance-party ref, Pending/Received.
- **Truck:** truck number, six compliance files/expiry dates, driver assignments, soft delete, last-service KM/service interval.
- **Driver:** contact details, Aadhaar/licence identifiers and files, soft delete, payment summary, vehicle assignment history.
- **TruckJourney:** truck/driver, route, duration/dates, cash/distance/load/mileage/odometer, status, expenses, delays, settlement, daily progress, incidents, delivery, status history, computed totals and party-payment fields.
- **Settlement:** driver, period, journey refs, expense/fuel/distance/rate/total values, payment direction/metadata and settled flag/time.
- **Ledger:** category, debit/credit/amount, entity links, payment/reference/GST metadata, verification/lock/reversal/generated flags and balance after transaction.
- **Inquiry:** contact data, status, timestamps.
- **Quote:** contact, pickup/drop, cargo/weight/truck/date/message/status.
- **AuditLog:** before/after snapshots, changed fields, actor/request metadata, timestamps.

## 19. Static-inspection findings to treat as possible gaps/bugs

1. Register page/API may be unreachable from route table.
2. Forgot-password email delivery is explicitly disabled.
3. Tracking API/modal exist without an obvious public route.
4. WhatsApp daily scheduler is commented out at startup.
5. Verify server-side authentication/role checks on every API; client route guards do not secure APIs.
6. Dashboard financial totals need formula/date-window tests.
7. Many monetary fields are strings; risk of inconsistent rounding/arithmetic.
8. Settlement confirmation/finalization mutates multiple collections; use transactions and idempotency.
9. Truck UI suggests make/year/specification fields not present in the inspected core model; verify persistence.
10. Delete semantics vary: truck/driver/journey soft-delete; ledger delete endpoint; party delete routes absent in inspected route files.
11. Duplicate API/filter utility folders can drift.
12. Mixed naming/casing and `any` types weaken maintainability.
13. Aadhaar/licence data needs strict privacy and access controls.
14. Public quote/inquiry endpoints need spam protection/rate limits.
15. LR-only tracking must not expose private operational/person data.
16. Puppeteer/chromium production compatibility needs testing.
17. Fire-and-forget WhatsApp failures may be invisible.
18. Client-side list filtering may not scale; use server-side pagination and indexed queries.
19. Ensure audit coverage includes every critical financial/document/status mutation.
20. Business definitions for balance, owner total, overall total, diesel difference and payment direction need documented examples and tests.

## 20. Rebuild blueprint for Antigravity

### Preserve baseline capabilities
- Authentication/profile/security.
- Public marketing site, inquiries and quote requests.
- Billing parties, bills, extra charges/GST summary, invoice PDF and LR outputs.
- Vehicle-entry logs, balance parties and party balance exports.
- Truck/driver registries, document vaults and assignment history.
- Journey lifecycle with expenses, diesel, route progress/checkpoints, incidents, delays, delivery/POD and payment state.
- Settlement preview/confirm/finalize/recalculate.
- Ledger with debit/credit, categories, references, linked entities and generated entries.
- Dashboard KPIs and five watchlists.
- Audit timeline, Excel export, PDF/print, S3 documents and WhatsApp.

### Improvements worth specifying before implementation
- Define role matrix (owner/admin, operations, accounts, dispatcher, read-only, optional driver) and enforce on backend.
- Shared design system and consistent responsive layouts/forms/tables/modals.
- Server-side search/filter/sort/pagination; persist filter state in URL.
- Global search across truck, driver, journey, bill/LR, party and ledger reference.
- Field-level validation, consistent error messages and unsaved-change warnings.
- Audit timeline on all critical records.
- Expiry and maintenance reminders with acknowledgement.
- Dedicated public tracking page with safe milestones.
- Settlement formula breakdown, duplicate-period checks, transactions and immutable finalized records/reversal workflow.
- Finance reports: receivables/payables aging, journey profitability, diesel efficiency, driver advance balance, category income/expense, cash/bank reconciliation.
- Exports matching current filters and including generation date/time.
- Notification center with delivery status/retries and configurable templates.
- Consistent archive/restore policy and destructive-action confirmation.
- Tests for financial formulas, permissions, validation, route transitions, uploads and PDF output.
- Separate demo seed data from production data.

### Suggested build order
1. Foundation: models/API contracts, authentication, roles, design tokens, navigation, reusable forms/tables.
2. Master data: trucks, drivers, billing parties, balance parties, documents/assignments.
3. Operations: journeys, progress, expenses, diesel, incidents, delivery/POD, vehicle entries.
4. Billing: bill entry, taxes/charges, LR copy, blank LR, invoice output.
5. Accounting: ledger, party balances, settlements.
6. Dashboard: server-backed KPIs/watchlists.
7. Public/admin: marketing, inquiries, quotes, status queues, public tracking.
8. Automation: WhatsApp, scheduled reminders, audit, exports, alerts.
9. Hardening: tests, access/privacy review, performance, error handling and deployment.

## 21. Verification boundary

This is a code-derived feature map, not a live acceptance test. Before treating a feature as “working”, run the app with a test database and verify the entire path: screen → API → validation → persistence → updated UI → audit/notifications/documents. Convert each form field, action, status transition and calculation into explicit acceptance criteria and test cases during the Antigravity rebuild.

---

# PART II: MULTI-TENANT SaaS PRODUCT ARCHITECTURE & COMPREHENSIVE FEATURE ASSESSMENT

**Role:** Senior SaaS Product Architect (Fleet & Transport Management Systems)  
**Business Model:** Monthly/Annual Subscription B2B SaaS for Small Transport Operators (1–10 trucks), Medium Fleet Owners (10–50 trucks), and Large Logistics/Brokerage Businesses (50+ trucks / 3PL / Multi-branch).

---

## 22. Domain-by-Domain Architectural Assessment

Every module and workflow evaluated across the 14 mandatory domains, classified under the 6-tier taxonomy:
- **[Cat 1] Essential Core Feature:** Fundamental base plan functionality required by almost all transport operators.
- **[Cat 2] Optional Paid Module / Add-On:** High-value specialized capability monetized via monthly recurring add-on fees.
- **[Cat 3] Enterprise Feature:** Advanced multi-branch, high-volume, automation, custom integration, or SLA-grade feature.
- **[Cat 4] Platform-Owner / Super-Admin Feature:** Internal SaaS control plane for billing, tenant lifecycle, provisioning, support, and health monitoring.
- **[Cat 5] Future Enhancement:** Long-term strategic capabilities (AI load matching, predictive maintenance, automated FASTag toll recon, e-Way NIC direct sync).
- **[Cat 6] Existing Incomplete / Broken / Duplicated:** Identified deficiencies in the inspected codebase that must be remediated or consolidated.

---

### 22.1 Company Onboarding & Multi-Tenant Architecture

* **Multi-Tenant Data Isolation [Cat 1 - Architecture]**
  * *Purpose:* Guarantee strict logical separation of company data so Company A cannot view or leak Company B’s trucks, drivers, rates, or financial ledgers.
  * *Source Code Status:* **[Cat 6 - Incomplete]** The existing codebase has zero tenant scoping. Every Mongoose model (`Truck`, `Driver`, `TruckJourney`, `Entry`, `Ledger`, `BillingParty`, `BalanceParty`) is global.
  * *Required Rebuild:* Implement an indexed `tenant_id` (or `organization_id`) on all collections, enforced via Mongoose pre-query middleware (`find`, `findOne`, `count`, `aggregate`) and JWT tenant claim verification on every Express route.
  * *Target Customer:* All subscribers.
  * *Complexity / Value:* High complexity / Critical foundation. Base plan.

* **Self-Service Company Registration & Workspace Setup [Cat 1]**
  * *Purpose:* Self-signup onboarding wizard allowing a transport owner to create their company profile, upload transport logo, set operational currency (INR), GSTIN, default tax rates, and invite dispatchers.
  * *Source Code Status:* **[Cat 6 - Broken / Disconnected]** `Register.tsx` and `/api/auth/register` exist in source files but are omitted from route tables, with no tenant-creation logic.
  * *Target Customer:* All new signups.
  * *Complexity / Value:* Medium / High onboarding conversion. Base plan.

* **Multi-Branch & Regional Hub Hierarchy [Cat 3 - Enterprise]**
  * *Purpose:* Allows large logistics operators to manage multiple depots/branches (e.g., Delhi, Mumbai, Kolkata) with branch-level user access, isolated branch ledgers, and consolidated corporate reporting.
  * *Source Code Status:* Completely missing in original codebase.
  * *Target Customer:* Large fleet owners & 3PLs with distributed hubs.
  * *Complexity / Value:* High / Enterprise Tier only.

---

### 22.2 Authentication, Roles & Permissions (RBAC)

* **Multi-Tier Role-Based Access Control [Cat 1]**
  * *Purpose:* Granular access restriction across predefined personas:
    1. *Tenant Admin / Owner*: Full operational, financial, and settings rights.
    2. *Dispatcher / Fleet Manager*: Trips, trucks, drivers, odometer, daily tracking (read/write), zero financial ledger access.
    3. *Accountant / Billing Clerk*: Bill entry, invoices, party balances, payment receipts, settlements.
    4. *Read-Only / Viewer*: Tracking, read-only watchlists for auditors or junior staff.
  * *Source Code Status:* **[Cat 6 - Incomplete]** User model has a simple boolean `isAdmin`. No granular roles exist in controller authorization checks; route protection is purely client-side React routes.
  * *Target Customer:* All tiers. Base plan includes 3 default roles; custom role permission matrix is Enterprise [Cat 3].

* **Secure Authentication & Token Lifecycle [Cat 1]**
  * *Purpose:* Secure JWT authentication with `HttpOnly`, `SameSite` cookies, bcrypt password hashing (work factor 12), and active session invalidation on logout.
  * *Source Code Status:* Login/logout present; forgot password email delivery is hardcoded as disabled (`email disabled` log).
  * *Required Rebuild:* Integrate transactional email (Resend/SendGrid) for password reset tokens, MFA for owners/accountants.

---

### 22.3 Trucks, Drivers & Compliance Vault

* **Truck Master Registry & Operational Specs [Cat 1]**
  * *Purpose:* Central repository for vehicle assets: registration number, chassis/engine number, truck type (Open, Container, Trailer, Tanker), capacity (tonnage, CBM), service intervals, and driver assignment history.
  * *Source Code Status:* **[Cat 6 - Incomplete Data Model]** Frontend UI prompts for make, model, year, and specifications, but the Mongoose `Truck` schema only persists truck number, service KM, and document URLs.
  * *Complexity / Value:* Medium / Core foundational data. Base plan.

* **Compliance Document Vault with Expiry Triggers [Cat 1]**
  * *Purpose:* Digital vault storing official documents with expiry dates: Fitness Certificate, National Permit, State Permit, Insurance, Road Tax, and PUC (Pollution). Automatically flags expiring documents in real-time.
  * *Source Code Status:* Implemented in schema and UI with S3 storage, but lacks automated WhatsApp/Email reminders to the fleet manager prior to expiry (e.g., 30, 15, and 7-day alert triggers).
  * *Complexity / Value:* Medium / Critical legal compliance. Base plan.

* **Driver KYC, Credentials & Identity Vault [Cat 1]**
  * *Purpose:* Complete driver records: full name, mobile, emergency contact, Aadhaar number + front/back photos, Commercial Driving License number + front/back photos, current vehicle assignment, and running advance balances.
  * *Source Code Status:* Driver schema and UI exist; requires strict field-level PII protection, Aadhaar masking, and secure S3 presigned URL downloads.
  * *Complexity / Value:* Medium / High legal & operational accountability. Base plan.

* **Driver Mobile Web Portal / PWA [Cat 2 - Paid Add-On]**
  * *Purpose:* Lightweight smartphone view for drivers: view assigned trip, report diesel fills with receipt photo, log odometer milestones, and view settlement statements.
  * *Source Code Status:* Missing in current codebase (operations staff manually input all driver logs).
  * *Target Customer:* Fleets wanting direct field data capture. Add-on module.

---

### 22.4 Trips, Journeys, Routes & Trip Expenses

* **Journey Planning & Dispatch Workflow [Cat 1]**
  * *Purpose:* End-to-end trip creation: assign truck & driver, origin & destination, planned checkpoints, scheduled start/end dates, trip duration, starting cash advance, and odometer opening reading.
  * *Source Code Status:* Implemented in `TruckJourney` schema and frontend wizard. Needs automatic check to prevent dispatching a truck or driver currently assigned to an uncompleted Active trip.
  * *Complexity / Value:* Medium / Core operational heartbeat. Base plan.

* **Daily In-Transit Progress & Milestone Tracking [Cat 1]**
  * *Purpose:* Daily checkpoint updates: date, current location, transit notes, and issue/delay recording (breakdown, traffic, police checkpoint, weather).
  * *Source Code Status:* Present in schema with automated pre-save array re-generation. Needs interactive timeline UI with quick location pins.
  * *Complexity / Value:* Medium / High visibility. Base plan.

* **Trip Expense Capture (Driver Cash & En-Route Costs) [Cat 1]**
  * *Purpose:* Itemized logging of en-route cash expenditures: toll taxes, loading/unloading charges, border entry taxes, police/weighbridge expenses, and minor en-route repairs.
  * *Source Code Status:* Implemented as sub-document array on journey, but lacks receipt image attachment upload.
  * *Complexity / Value:* Low / High financial accuracy. Base plan.

* **Delivery Confirmation & Proof of Delivery (POD) Stock [Cat 1]**
  * *Purpose:* Capture delivery completion: delivery date, receiver signature status, empty container return yard date, and POD document/acknowledgement slip upload.
  * *Source Code Status:* Fields exist in schema; requires direct camera photo capture and customer delivery confirmation hook.
  * *Complexity / Value:* Medium / Directly unlocks billing. Base plan.

---

### 22.5 Fuel, Maintenance, Repairs & Vehicle Compliance

* **Diesel Consumption & Mileage IQ Engine [Cat 1 / Cat 2]**
  * *Purpose:* Track every fuel stop: quantity (litres), pump rate (₹/L), total cost, petrol pump name, fuel slip number, and odometer reading. Computes actual vehicle fuel efficiency (km/litre) against expected vehicle benchmark.
  * *Source Code Status:* Basic diesel array exists on Journey and Settlement.
  * *SaaS Packaging:* Base plan covers basic diesel logging; **Advanced Fuel Theft & Variance Analytics** (comparing expected mileage vs actual with ₹ gain/loss driver penalty) is packaged under **[Cat 2 - Paid Module: Fleet IQ]**.

* **Scheduled Fleet Maintenance & Preventive Service Log [Cat 2 - Paid Add-On]**
  * *Purpose:* Track engine oil changes, tyre rotations, brake pad replacements, and battery checks based on elapsed kilometers (`last_service_kms` + `service_interval`) and calendar intervals. Alert fleet manager when maintenance is due.
  * *Source Code Status:* **[Cat 6 - Incomplete]** Model has `last_service_kms` and `service_interval`, but there is zero maintenance log collection, repair ticket UI, or workshop cost ledger in the codebase.
  * *Complexity / Value:* Medium / High preventive savings. Add-on module.

---

### 22.6 Customers, Vendors & Business Partners

* **Billing Parties (Shippers / Consignors / Consignees) [Cat 1]**
  * *Purpose:* Customer directory for invoicing: legal company name, PAN, GSTIN, registered billing address, default payment terms (e.g., Net 15, Net 30), and credit limits.
  * *Source Code Status:* Implemented in `BillingParty` model and views. Needs company-wide outstanding balance rollup and aging analysis.
  * *Complexity / Value:* Low / Essential for billing. Base plan.

* **Balance Parties (Market Trucks / Sub-Contracted Fleet Owners) [Cat 1]**
  * *Purpose:* Directory for hired fleet operators and brokerage vehicle owners. Manages freight payables, commissions, driver cash advances, and halting dues.
  * *Source Code Status:* Present in `BalanceParty` and `VehicleEntry` models.
  * *Complexity / Value:* Low / Critical for transport brokers. Base plan.

* **Customer Portal for Shippers [Cat 3 - Enterprise]**
  * *Purpose:* Dedicated self-service portal for enterprise shippers: book truck requests, download approved LR copies and invoices, and track live consignment milestones.
  * *Source Code Status:* Missing in current codebase.
  * *Target Customer:* Enterprise tier.

---

### 22.7 LR/GR Documents, Quotations, Orders & Invoices

* **Lorry Receipt (LR / Bilty / GR) Generation Engine [Cat 1]**
  * *Purpose:* Industry-standard consignment note with consignor, consignee, package count, goods description, declared value, invoice/e-way bill number, container number, risk coverage, and freight terms (Paid / To Pay / To Be Billed).
  * *Source Code Status:* Implemented in `Entry` model, LR search, and empty LR view.
  * *Required Rebuild:* Clean client-side printable vector template formatted to 3-part LR stationary (Consignor Copy, Consignee Copy, Driver/POD Copy) with company branding.
  * *Complexity / Value:* Medium / Absolutely vital for Indian logistics. Base plan.

* **GST Freight Invoice Generator [Cat 1]**
  * *Purpose:* Professional GST-compliant tax invoice covering transport hire charges, dynamic extra charges (loading, unloading, demurrage, multi-drop), reverse charge mechanism (RCM) flags, and automated CGST/SGST/IGST breakdown.
  * *Source Code Status:* Present with Puppeteer endpoint.
  * *Required Rebuild:* Convert to instant client-side responsive PDF (`jsPDF` / print engine) for phone & laptop, keeping server Puppeteer strictly for background WhatsApp automation.
  * *Complexity / Value:* Medium / Core monetization & compliance. Base plan.

* **Public Quote Request & CRM Inquiries [Cat 1 / Cat 2]**
  * *Purpose:* Public landing page forms for freight quote inquiries (pickup, drop, cargo weight, truck type) and contact queries with admin status pipeline (Pending $\rightarrow$ Quoted $\rightarrow$ Booked $\rightarrow$ Cancelled).
  * *Source Code Status:* Implemented in `Inquiry`, `Quote`, and admin queue pages.
  * *SaaS Packaging:* Base plan includes basic inquiry queue; CRM quote-to-journey automated conversion is **[Cat 2 - Paid Add-On]**.

* **Government E-Way Bill & E-Invoice Integration [Cat 3 / Cat 5]**
  * *Purpose:* Direct NIC GST portal integration via GSP API to auto-fetch E-way bills, generate Part-B vehicle updates, and emit IRN QR codes directly onto invoices.
  * *Source Code Status:* Non-existent (currently manual string fields).
  * *Complexity / Value:* Very high / Enterprise Tier & Future Enhancement.

---

### 22.8 GST, Payments, Accounts, Ledgers & Driver Settlements

* **Driver Trip Settlement Engine [Cat 1]**
  * *Purpose:* Reconcile completed trips for a driver over a billing period:
    $$\text{Net Settlement} = \text{Starting Cash} + \text{En-Route Advances} - \text{Driver Expenses} - (\text{Diesel Variance Penalties}) - (\text{Km Rate Earnings})$$
    Determines whether "DRL/Company owes Driver" or "Driver owes Company", resets advance balance, and generates accounting entries.
  * *Source Code Status:* Complex controller and preview/confirm UI exist, but:
    1. Lacks MongoDB ACID transaction protection (mutations across `Settlement`, `TruckJourney`, `Driver`, and `Ledger` happen independently).
    2. Formulas use string parsing susceptible to NaN/floating point bugs.
  * *Required Rebuild:* Strict server-authoritative numeric engine wrapped in `mongoose.startSession()` ACID transactions with idempotency locks.
  * *Complexity / Value:* High / Critical core workflow. Base plan.

* **Double-Entry Style Financial Ledger [Cat 1]**
  * *Purpose:* Complete chart of accounts tracking Freight Income, Diesel Expense, Driver Advances, Driver Settlements, Halting, Tolls, Vehicle Maintenance, and Bank/Cash accounts. Supports manual journal adjustments and audit-locked auto-entries.
  * *Source Code Status:* Model and UI exist with 17 categories and linked entity references.
  * *Required Rebuild:* Add decimal-safe balance rollups, running account balances, and tenant isolation.
  * *Complexity / Value:* Medium / Core financial visibility. Base plan.

* **Party Balance & Vehicle Entry Settlement [Cat 1]**
  * *Purpose:* Reconciliation ledger for market hired trucks and balance parties: freight minus driver cash, kamisan (commission), dala, and halting fees.
  * *Source Code Status:* Implemented in `vehicle-entry` and `party-balance` export.
  * *Complexity / Value:* Medium / Core for fleet brokerage. Base plan.

* **Bank Reconciliation & Tally/Busy Export [Cat 2 - Paid Add-On]**
  * *Purpose:* One-click export of transport vouchers, bills, and payment receipts formatted for direct import into TallyPrime or Busy Accounting.
  * *Source Code Status:* Basic Excel sheet export exists; specialized Tally XML export is absent.
  * *Complexity / Value:* Medium / High accounting value. Add-on module.

---

### 22.9 GPS Tracking & Fleet Telematics

* **Public LR Consignment Milestone Tracking [Cat 1]**
  * *Purpose:* Safe, public-facing tracking page where shippers enter an LR number and view approved consignment milestones (Booked $\rightarrow$ Dispatched $\rightarrow$ In Transit at City $\rightarrow$ Out for Delivery $\rightarrow$ Delivered) without exposing private driver phone numbers, freight rates, or financial data.
  * *Source Code Status:* **[Cat 6 - Disconnected]** API and modal exist, but lack a dedicated, secure public routing page (`/track/:lrNumber`).
  * *Complexity / Value:* Low / High customer satisfaction. Base plan.

* **Live Hardware GPS Telematics Integration [Cat 2 - Paid Add-On]**
  * *Purpose:* Direct API ingestion from popular Indian GPS providers (WheelsEye, Fleetx, BlackBuck, LocoNav, Teltonika) to display live map locations, geofencing alerts, route replay, and automated odometer sync.
  * *Source Code Status:* Non-existent (currently manual daily progress updates).
  * *Complexity / Value:* High / Premium recurring add-on.

* **Automated FASTag Toll Reconciliation [Cat 5 - Future]**
  * *Purpose:* Ingest bank FASTag API statements to automatically match toll plaza debits against ongoing journey routes, eliminating driver toll slip fraud.
  * *Complexity / Value:* High / Major future competitive moat.

---

### 22.10 Reports, Analytics & Dashboards

* **Operational Intelligence Executive Dashboard [Cat 1]**
  * *Purpose:* High-level KPI command center: active journeys, fleet availability, unsettled trips, unbilled LRs, today's revenue, and pending party receivables.
  * *Source Code Status:* Implemented in React, but calculates metrics by fetching entire unpaginated arrays and summing in the browser.
  * *Required Rebuild:* High-performance server-side MongoDB aggregation pipeline (`GET /api/dashboard/summary`) with Redis/memory caching.
  * *Complexity / Value:* Medium / High executive appeal. Base plan.

* **5 Operational Watchlists [Cat 1]**
  * *Purpose:* Actionable management queues:
    1. *Unsettled Journeys Watchlist* (trips completed but finances open).
    2. *Pending Driver Settlements Watchlist* (drivers with pending payouts).
    3. *Party Payments Watchlist* (overdue customer freight).
    4. *Compliance Alerts Watchlist* (expiring fitness, tax, insurance).
    5. *Operational Activity Feed* (real-time dispatch and billing stream).
  * *Source Code Status:* All 5 exist in code.
  * *Required Rebuild:* Convert to server-side paginated queries with URL-persisted search filters.
  * *Complexity / Value:* Low / High day-to-day utility. Base plan.

* **Journey Profitability & Margin Analytics [Cat 2 - Paid Add-On]**
  * *Purpose:* Deep financial intelligence showing net profit per trip:
    $$\text{Trip Profit} = \text{Freight Revenue} - (\text{Diesel Cost} + \text{Driver Advance/Expenses} + \text{Tolls} + \text{Depreciation Allocation})$$
    Ranks most profitable routes, customers, and vehicles.
  * *Complexity / Value:* Medium / High ROI for fleet owners. Add-on module.

---

### 22.11 Document Storage, PDF Generation, Exports & Notifications

* **AWS S3 Document Storage with Presigned Access [Cat 1]**
  * *Purpose:* Secure cloud storage for truck compliance PDFs, driver licenses, Aadhaar cards, POD slips, and invoices. Presigned URLs with 15-minute expirations prevent unauthorized public asset scraping.
  * *Source Code Status:* S3 helpers exist in codebase; needs tenant-partitioned S3 key prefixes (`s3://bucket/tenants/{tenantId}/documents/...`).
  * *Complexity / Value:* Medium / Foundation asset storage. Base plan.

* **Instant Client-Side & Background PDF Generation [Cat 1]**
  * *Purpose:* Client-side vector rendering (`jsPDF` + CSS print engine) for instantaneous phone and laptop invoice/LR viewing/printing without server overhead; backend headless generator for automated notification attachments.
  * *Complexity / Value:* Medium / Essential operational document output. Base plan.

* **Automated WhatsApp Business Notification Engine [Cat 2 - Paid Add-On]**
  * *Purpose:* Trigger automated WhatsApp messages with document links on critical business events:
    - Customer receives WhatsApp when LR is generated.
    - Driver receives WhatsApp on trip dispatch with route details.
    - Consignee receives WhatsApp with delivery OTP / status.
    - Driver receives WhatsApp upon settlement completion.
  * *Source Code Status:* **[Cat 6 - Incomplete & Fragile]** Uses `whatsapp-web.js` running in server memory with commented-out cron schedulers. Extremely fragile for a multi-tenant SaaS.
  * *Required Rebuild:* Replace with an official WhatsApp Business Cloud API / Meta Graph API integration (or unified provider like Interakt/AiSensy/Twilio) with tenant-configurable message templates.
  * *Complexity / Value:* Medium / High customer retention. Sold as recurring add-on.

---

### 22.12 Audit Logs, Security, Backups & Data Isolation

* **Immutable Operational Audit Trail [Cat 1 / Cat 3]**
  * *Purpose:* Record every write, update, delete, and financial state transition with before/after snapshots, actor IP, user ID, and timestamp.
  * *Source Code Status:* `AuditLog` collection and `HistoryDrawer` component exist in codebase.
  * *SaaS Packaging:* Base plan includes 30-day audit log retention; 1-year to 7-year audit retention with compliance export is **[Cat 3 - Enterprise]**.

* **Data Isolation & Automatic Daily Backups [Cat 1 - Architecture]**
  * *Purpose:* Ensure strict multi-tenant boundary compliance and automated point-in-time recovery via MongoDB Atlas daily snapshots.
  * *Complexity / Value:* High / Table stakes for enterprise trust.

---

### 22.13 Subscription Plans, Metering, Trials & Usage Limits

* **SaaS Subscription Billing & Metering Engine [Cat 4 - Platform Admin]**
  * *Purpose:* Manage tenant subscription lifecycles: 14-day free trial, active plan tiers (Starter, Standard, Pro), automated monthly/annual recurring billing (Razorpay Subscriptions / Stripe), grace periods, and feature flag toggles.
  * *Source Code Status:* Missing in original codebase. Must be built from scratch.
  * *Complexity / Value:* High / Essential for SaaS commercialization.

* **Usage Limits & Quota Enforcement [Cat 4 - Platform Admin]**
  * *Purpose:* Enforce plan limits based on active vehicle count (e.g., Starter: up to 5 trucks; Standard: up to 20 trucks; Pro: unlimited), active user seats, and monthly WhatsApp message quotas.
  * *Complexity / Value:* Medium / Prevents service abuse.

---

### 22.14 Customer Support & Platform Administration

* **Platform Super-Admin Multi-Tenant Control Plane [Cat 4]**
  * *Purpose:* Dedicated internal portal for the SaaS platform owner: view total active tenant companies, monthly recurring revenue (MRR), churn rate, active trucks across all tenants, impersonate tenant for customer support, manually extend trials, and toggle tenant feature flags.
  * *Source Code Status:* Missing in current codebase.
  * *Complexity / Value:* High / Operational necessity for SaaS operator.

* **In-App Customer Support & Ticket Helpdesk [Cat 1 / Cat 4]**
  * *Purpose:* In-app help widget allowing tenant users to submit bug reports, feature requests, or billing queries directly to the platform support team.
  * *Complexity / Value:* Low / High satisfaction. Base plan.

---

## 23. Deliverable A: Complete Feature Inventory & SaaS Classification Matrix

| Feature / Capability | Classification | Purpose & Description | Target Customer | Required Data Entities | Key Dependencies | Business Value | Complexity | SaaS Packaging Tier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant Isolation Engine** | **Cat 1** | Logical database isolation across companies | All Subscribers | `Tenant`, `TenantId` on all schemas | Mongoose middleware | Critical / Zero Data Leakage | High | Included in All Plans |
| **User Auth & RBAC** | **Cat 1** | Secure JWT auth with 3 standard roles | All Subscribers | `User`, `Role`, `Session` | JWT, bcrypt, cookies | Core Security & Integrity | Medium | Base Plan |
| **Truck Registry & Docs** | **Cat 1** | Fleet directory & compliance document vault | Small to Large | `Truck`, `DocumentVault` | AWS S3 | Prevents vehicle impound fines | Medium | Base Plan |
| **Driver Master & KYC** | **Cat 1** | Driver records, DL, Aadhaar verification | Small to Large | `Driver`, `DriverKyc` | AWS S3 | Identity compliance & safety | Medium | Base Plan |
| **Billing Parties (Shippers)**| **Cat 1** | Consignor/consignee address & GST directory | All Subscribers | `BillingParty` | None | Accurate tax invoicing | Low | Base Plan |
| **Balance Parties (Brokers)**| **Cat 1** | Market truck supplier balance directory | Broker Fleets | `BalanceParty` | None | Sub-contractor settlement | Low | Base Plan |
| **Journey Dispatch & Route** | **Cat 1** | Trip creation, route checkpoints, milestones | All Subscribers | `TruckJourney` | Truck, Driver | Core operational trip control | Medium | Base Plan |
| **En-Route Expenses & Fuel** | **Cat 1** | Itemized trip expense and diesel logging | All Subscribers | `Expense`, `DieselLog` | Journey | Trip cost transparency | Medium | Base Plan |
| **POD & Delivery Closeout** | **Cat 1** | Delivery confirmation & POD slip upload | All Subscribers | `PodRecord` | AWS S3 | Unlocks billing collection | Medium | Base Plan |
| **Lorry Receipt (LR) Engine** | **Cat 1** | Official consignment note & 3-part printing | All Indian Fleets| `Entry` (LR fields) | jsPDF / Print CSS | Legally required transport note | Medium | Base Plan |
| **GST Freight Invoicing** | **Cat 1** | RCM/Forward GST transport tax invoice | All Subscribers | `Invoice`, `BillEntry` | jsPDF / Print CSS | Accounts receivable & tax filing| Medium | Base Plan |
| **Driver Settlement Engine**| **Cat 1** | Periodic trip reconciliation & cash balance | All Fleet Owners| `Settlement` | ACID Transactions | Stops driver financial leakage | High | Base Plan |
| **Financial General Ledger** | **Cat 1** | Double-entry journal across 17 categories | All Subscribers | `Ledger` | All Financial Models| Real-time financial clarity | Medium | Base Plan |
| **Party Balance Report** | **Cat 1** | Freight vs advance reconciliation report | Broker Fleets | `VehicleEntry` | XLSX Export | Broker debt reconciliation | Medium | Base Plan |
| **Operational Dashboard** | **Cat 1** | KPI cards & 5 operational watchlists | Fleet Managers | Aggregated Data | Mongo Aggregations | Day-to-day command center | Medium | Base Plan |
| **Public LR Tracking Page** | **Cat 1** | Secure public milestone tracking portal | Shippers / Clients| `TrackingMilestone` | Public Route | Customer trust & zero call load | Low | Base Plan |
| **Inquiry & Quote CRM** | **Cat 1** | Public website lead capture & triage pipeline| Marketing Fleets| `Inquiry`, `Quote` | Rate Limiter | Customer acquisition engine | Low | Base Plan |
| **Audit Log History** | **Cat 1** | 30-day timeline of all data mutations | All Subscribers | `AuditLog` | Audit Middleware | Internal dispute resolution | Medium | Base Plan |
| **Fleet IQ: Fuel & Theft Engine**| **Cat 2** | Mileage variance & fuel theft alert analytics| Mid to Large | `DieselAnalytics` | Journey, Telematics | Saves ₹15,000–50,000/mo/truck | High | **Paid Add-on: ₹999/mo** |
| **Preventive Maintenance Log**| **Cat 2** | Service schedules, tyres, repairs & workshop| Mid to Large | `MaintenanceRecord` | Truck, Odometer | Extends vehicle lifespan 30% | Medium | **Paid Add-on: ₹1,499/mo**|
| **WhatsApp Automation Bot** | **Cat 2** | Automated customer & driver WhatsApp updates| Small to Large | `WhatsAppLog` | Meta Cloud API | Eliminates manual phone calls | Medium | **Paid Add-on: ₹1,299/mo**|
| **Live GPS Telematics Sync** | **Cat 2** | WheelsEye/LocoNav API ingest & live map | Mid to Large | `GpsTrackingFeed` | Telematics APIs | Real-time transit visibility | High | **Paid Add-on: ₹1,999/mo**|
| **Tally / Busy Accounting Sync**| **Cat 2** | One-click XML export for TallyPrime/Busy | Mid to Large | `AccountingExport` | Ledger Engine | Eliminates duplicate data entry| Medium | **Paid Add-on: ₹1,499/mo**|
| **Driver Self-Service PWA** | **Cat 2** | Driver mobile app for diesel slips & odometer | Mid to Large | `DriverPortal` | PWA Framework | Clean field data capture | High | **Paid Add-on: ₹1,999/mo**|
| **Multi-Branch Hierarchy** | **Cat 3** | Regional branch isolation & consolidated view| Large Fleets | `Branch`, `OrgUnit` | Multi-tenancy | Distributed national management| High | **Enterprise Tier Only** |
| **Customer Shipper Portal** | **Cat 3** | Self-service tracking & invoice portal | Large Fleets / 3PL| `CustomerPortalUser`| Auth, Invoices | Stickiness with enterprise clients| High | **Enterprise Tier Only** |
| **E-Way Bill & E-Invoice Sync**| **Cat 3** | Direct government NIC GSP API generation | High-Volume Fleets| `EWayBillRecord` | GST NIC API | Zero manual portal filing | Very High | **Enterprise Tier Only** |
| **7-Year Compliance Audit** | **Cat 3** | Long-term immutable audit retention & export | Enterprise Fleets| `AuditArchive` | Cold Storage S3 | Statutory compliance audit | Medium | **Enterprise Tier Only** |
| **Dedicated SLA & Support** | **Cat 3** | 99.9% uptime SLA & dedicated account manager| Enterprise Fleets| `SlaContract` | Support Ops | Enterprise business confidence | Operations | **Enterprise Tier Only** |
| **SaaS Billing & Subscriptions**| **Cat 4** | Automated plan charging, Razorpay recurring | Platform Owner | `Subscription`, `Plan` | Razorpay / Stripe | Recurring revenue engine | High | Platform Admin Only |
| **Super-Admin Control Plane** | **Cat 4** | Global tenant management, metrics, support login| Platform Owner| `TenantMaster` | System Stats | Operational SaaS management | High | Platform Admin Only |
| **Usage Metering & Limits** | **Cat 4** | Enforce truck caps, user seats, storage quotas | Platform Owner | `TenantUsage` | Middleware Checkers | Protects infrastructure costs | Medium | Platform Admin Only |
| **FASTag Auto-Reconciliation**| **Cat 5** | Bank FASTag API toll match against routes | Large Fleets | `FastagTransaction`| Bank Netbanking APIs| Eliminates toll fraud 100% | Very High | Future Roadmap |
| **AI Route & Fuel Optimizer** | **Cat 5** | Optimal route and fuel stop recommendations | Mid to Large | `RouteOptimizer` | Mapbox / OSRM API | Lowers transit costs | Very High | Future Roadmap |

---

## 24. Deliverable B: Recommended SaaS Minimum Viable Product (MVP)

The MVP is engineered for immediate adoption by **Small Transport Operators (1–10 trucks)** who currently manage operations on Excel, paper bilty books, or WhatsApp groups. It provides rapid time-to-value within 15 minutes of signup.

### 24.1 MVP Scope (Included in Base Plan)
1. **Tenant Onboarding & Authentication**: Instant company self-signup, company profile setup (logo, address, GSTIN, default tax settings), and 2 user seats (Admin + Dispatcher).
2. **Master Registries**:
   - Truck Registry (up to 10 vehicles) with compliance document expiry tracking (Fitness, Insurance, Tax, PUC).
   - Driver Registry with mobile, DL, and Aadhaar storage.
   - Billing Party & Balance Party directories.
3. **Operational Core**:
   - Journey Dispatch: Assign truck + driver, route (from/to), starting odometer, cash advance.
   - Expense & Diesel Logging: En-route fuel and cash expenditure tracking.
   - Trip Closeout: Ending odometer, delivery date, POD slip attachment.
4. **Billing & Documents**:
   - Lorry Receipt (LR) Generator: Instant printable 3-part LR copy and empty LR form.
   - GST Freight Invoice: Complete tax invoice generation with CGST/SGST/IGST breakdown and instant client-side PDF download.
5. **Financial Reconciliation**:
   - Driver Trip Settlement: Calculate net balance (advance vs expenses vs earnings), mark settled, and reset advances.
   - Party Balance Report: Summary of freight, advances, and pending dues for market vehicle owners with Excel export.
   - Financial Ledger: Core transaction ledger across standard categories.
6. **Visibility**:
   - Operational Dashboard: Active journeys, expiring compliance alerts, pending settlements.
   - Public LR Tracking Page: Clean link for customers to check milestone status.

### 24.2 Excluded from MVP (Deferred to Phase 2/3 or Add-Ons)
- Live GPS hardware streaming (manual odometer & milestones in MVP).
- Automated WhatsApp notifications (manual PDF sharing in MVP).
- Multi-branch accounting.
- Direct government E-way bill NIC integration.
- Tally XML direct export.

---

## 25. Deliverable C: Recommended Pricing Tier & Paid-Module Structure

```
                  ┌───────────────────────────────────────────────┐
                  │       ENTERPRISE TIER (Custom Quote)          │
                  │  Unlimited Trucks, Multi-Branch, E-Way Sync,  │
                  │  Shipper Portal, Dedicated SLA, 7-Yr Audit    │
                  └───────────────────────▲───────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │         PRO TIER (₹4,999 / month)             │
                  │  Up to 35 Trucks, 10 Users, All 5 Watchlists, │
                  │  Full Ledger, Advanced Driver Settlements     │
                  └───────────────────────▲───────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │       STANDARD TIER (₹2,499 / month)          │
                  │  Up to 15 Trucks, 4 Users, Full LR & Invoicing│
                  │  Compliance Vault, Trip Expenses, Dashboard   │
                  └───────────────────────▲───────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │        STARTER TIER (₹999 / month)            │
                  │  Up to 5 Trucks, 2 Users, Core Journeys,      │
                  │  LR Copy Generator, Driver Records, Basic P&L │
                  └───────────────────────────────────────────────┘
```

### 25.1 Monthly Subscription Plans
* **Starter Plan (₹999 / month or ₹9,990 / year)**
  * *Target:* Small owner-operators (1–5 trucks).
  * *Includes:* 5 active trucks, 2 user accounts, unlimited journeys, LR generation, basic invoicing, compliance expiry alerts, public tracking link.
* **Standard Plan (₹2,499 / month or ₹24,990 / year)**
  * *Target:* Growing fleet operators (6–15 trucks).
  * *Includes:* 15 active trucks, 5 user accounts, full driver settlement engine, complete financial ledger, party balance reports, 5 operational watchlists, Excel exports.
* **Pro Plan (₹4,999 / month or ₹49,990 / year)**
  * *Target:* Medium logistics businesses (16–35 trucks).
  * *Includes:* 35 active trucks, 10 user accounts, unlimited document vault storage, priority support, advanced profitability analytics.
* **Enterprise Plan (₹12,000+ / month, billed annually)**
  * *Target:* Large fleet owners & 3PLs (36+ trucks or multi-branch).
  * *Includes:* Unlimited trucks, custom branch hierarchies, dedicated database instance/sharding, customer shipper portal, 99.9% uptime SLA.

### 25.2 High-Margin Paid Add-On Modules (Billed Monthly)
1. **WhatsApp Automation Suite (+₹1,299 / month)**: 1,000 included WhatsApp messages/month via official Meta Cloud API for automated dispatch, LR delivery, invoice links, and settlement slips.
2. **Fleet IQ Fuel & Theft Analytics (+₹999 / month)**: Detailed mileage variance analysis, driver diesel penalty calculator, and fuel theft detection.
3. **Preventive Maintenance & Workshop Manager (+₹1,499 / month)**: Service schedules, spare parts logs, tyre tracking, and workshop expense ledger.
4. **Live GPS Telematics Connector (+₹1,999 / month)**: Native live map tracking integrated with LocoNav, WheelsEye, or Fleetx.
5. **Tally / Busy Accounting Sync (+₹1,499 / month)**: One-click formatted XML sync of all invoices, party receipts, and driver settlements.

---

## 26. Deliverable D: Enterprise Feature Roadmap

Designed to capture large regional and national logistics providers moving away from legacy on-premise software:

### Quarter 1: Scalability & Branch Control
- **Multi-Branch Hierarchy**: Independent branch offices with individual dispatch counters, distinct billing series (e.g., `DEL/26/1001`, `MUM/26/2004`), and centralized corporate cash aggregation.
- **Granular Custom RBAC Matrix**: Admin UI allowing enterprise owners to create custom roles (e.g., "Branch Cashier", "Loading Clerk") with checkbox-level permissions for every screen and API.

### Quarter 2: Shipper Ecosystem & Compliance
- **Customer Shipper Portal**: Dedicated sub-domain or branded login for corporate clients to place haulage orders, track their consignments in real-time, and download tax invoices and signed PODs.
- **Automated E-Way Bill & E-Invoice NIC Sync**: Direct Government API integration to auto-generate E-way bills upon LR creation and automatically push E-Invoices with IRN and QR code.

### Quarter 3: Telematics & Automation
- **Automated FASTag Toll Reconciliation**: Bank API statement parser comparing route toll charges against driver cash advances to catch fraud.
- **Sim-Based Tracking**: Consent-based cell tower tracking for market/broker trucks without hardware GPS.

### Quarter 4: Enterprise Integrations & AI
- **ERP Integration Connectors**: Ready-made REST webhook and SFTP connectors for SAP, Oracle NetSuite, and Microsoft Dynamics 365.
- **Predictive Fleet Maintenance**: Machine learning models predicting alternator, clutch, and tyre failures based on vehicle age, mileage, and driver driving profiles.

---

## 27. Deliverable E: Source Code Flaws, Missing Features & Technical Risks

Detailed findings from inspecting the uploaded repository codebase:

| Defect / Risk Area | Existing Code Observation | Architectural Severity | Commercial Impact | Rebuild Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Multi-Tenancy Absent** | No `tenant_id` or `org_id` on any Mongoose schema or query. | **Critical Showstopper** | Cross-tenant data leakage if deployed as SaaS. | Add indexed `tenant_id` across all collections; enforce in JWT and Mongoose pre-hook. |
| **2. String Currency Fields** | Monetary fields (`freight`, `advance`, `diesel_cost`, `balance`) stored as strings in MongoDB. | **Critical** | Arithmetic errors, floating-point rounding bugs, incorrect financial ledgers. | Migrate all monetary/quantity fields to strict numeric types (indexed 2-decimal floats/integers). |
| **3. Non-ACID Settlements** | Settlement confirmation updates `Settlement`, `TruckJourney`, `Driver`, and `Ledger` sequentially without transactions. | **High** | Corrupted balances if server crashes mid-settlement. | Wrap all multi-collection mutations in `mongoose.startSession()` ACID transactions. |
| **4. Client-Only Route Guards** | Backend endpoints lack role checks; any authenticated user can call any endpoint (e.g., delete truck, mutate ledger). | **High Security Risk** | Dispatchers could view company profit or tamper with ledger entries. | Implement strict Express RBAC middleware (`authorize(['admin', 'accountant'])`) on all routes. |
| **5. Disconnected Registration** | `Register.tsx` and `/api/auth/register` exist but are omitted from route tables. | **High** | Users cannot sign up without manual database insertion. | Wire up standardized registration with company workspace onboarding wizard. |
| **6. Disabled Email Flow** | Password reset endpoint logs `email disabled` and returns raw token in response. | **Medium** | Users cannot self-service reset passwords in production. | Integrate transactional email provider (Resend / AWS SES). |
| **7. Fragile WhatsApp Engine** | Uses `whatsapp-web.js` running Puppeteer Chromium in server memory; scheduler commented out. | **High Scalability Risk** | Node.js process crashes under multi-tenant load; memory leaks. | Decouple WhatsApp into an asynchronous worker using official Meta Cloud API or webhook service. |
| **8. Unpaginated Aggregations** | Dashboard fetches all journeys and bills into browser and calculates sums in JavaScript. | **High Performance Risk** | Browser freezes once a company has 1,000+ journeys. | Move all calculations to indexed MongoDB aggregation pipelines (`$group`, `$match`). |
| **9. Disconnected Public Tracking**| `TrackingModal` exists, but there is no public URL route accessible to external shippers. | **Medium** | Customers cannot track shipments via a shared link. | Create public `/track/:lrNumber` route exposing strictly sanitized milestone data. |
| **10. Hard Deletes vs Soft Deletes**| Mixed semantics: Trucks and Drivers have `is_deleted`; Ledgers have permanent hard-delete endpoints. | **Medium** | Inadvertent deletion of financial ledger records breaks accounting audit trails. | Enforce strict soft-delete and immutable ledger records with reversal entries only. |

---

## 28. Deliverable F: Prioritized Phased Implementation Plan

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: MULTI-TENANT FOUNDATION & SECURITY (Weeks 1–2)                         │
│  - Tenant models, JWT tenant claims, Mongoose scoping pre-hooks                  │
│  - Numeric data type conversions, input validation & sanitization                │
│  - Generic Design System (CSS Tokens, Reset, Components, Layout)                 │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│  PHASE 2: CORE MASTER DATA & FLEET REGISTRY (Weeks 3–4)                          │
│  - Truck Registry & Compliance Document Vault (with S3 presigned URLs)           │
│  - Driver KYC Registry (Aadhaar/DL masking & validation)                         │
│  - Billing Parties (Customers) & Balance Parties (Brokers) Directories           │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│  PHASE 3: OPERATIONAL ENGINE & DISPATCH (Weeks 5–6)                              │
│  - Journey Dispatch, Routes, Checkpoints & Daily Milestone Logs                  │
│  - Trip Expense & Diesel Logging Engine                                          │
│  - Vehicle Entry Movement Logs & POD Slip Capture                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│  PHASE 4: COMMERCIAL ENGINE — LR, INVOICES & SETTLEMENTS (Weeks 7–8)             │
│  - 3-Part Lorry Receipt (LR) Generator (Fast client-side vector render)          │
│  - GST Freight Invoicing with dynamic charges & tax calculation                  │
│  - ACID Driver Trip Settlement Engine & Party Balance Reconciliation             │
│  - General Ledger Journal Postings                                               │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│  PHASE 5: SAAS MANAGEMENT, WATCHLISTS & DASHBOARDS (Weeks 9–10)                  │
│  - MongoDB Aggregation-backed Executive Dashboard & 5 Operational Watchlists     │
│  - Public LR Consignment Tracking Portal (`/track/:lrNumber`)                    │
│  - Multi-tenant Subscription Billing Engine (Razorpay/Stripe) & Quota Metering   │
│  - Super-Admin SaaS Control Plane                                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│  PHASE 6: PAID ADD-ONS & HARDENING (Weeks 11–12)                                 │
│  - Meta Cloud API WhatsApp Automation Engine (Add-on)                            │
│  - Fleet IQ Fuel Variance & Maintenance Modules (Add-ons)                        │
│  - End-to-end integration testing, load testing & production hardening           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

# PART III: MULTI-TENANT SaaS SYSTEM ARCHITECTURE, SCHEMAS & LIFECYCLE ENGINE

**Role:** Senior SaaS Architect & Full-Stack Engineer  
**Objective:** Complete architectural design, database schemas, authorization mechanics, subscription state machine, billing integration, and migration strategy for converting the Truck Management System into a scalable, multi-tenant B2B SaaS platform.

---

## 29. Multi-Tenant Isolation & Context Architecture

```
                          ┌─────────────────────────────┐
                          │     Client Browser (SPA)    │
                          └──────────────┬──────────────┘
                                         │  1. Request with HttpOnly JWT Cookie
                                         │     (NO client-supplied company_id in URL/body)
                                         ▼
                          ┌─────────────────────────────┐
                          │   Express API Gateway       │
                          ├─────────────────────────────┤
                          │ 2. requireAuth Middleware   │ ──► Decodes JWT, validates signature
                          │ 3. resolveTenantContext     │ ──► Attaches req.user & req.tenant
                          │ 4. checkSubscriptionState   │ ──► Verifies Active/Trial vs Suspended
                          │ 5. checkEntitlements        │ ──► Verifies Module & Resource Quotas
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │   Mongoose Data Layer       │
                          ├─────────────────────────────┤
                          │ Automatic Tenant Scoping:   │
                          │ - find({ company_id, ... }) │ ──► Injected by Tenant Plugin
                          │ - save({ company_id: ... }) │ ──► Locked from req.tenant._id
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │ MongoDB Atlas Multi-Tenant  │
                          │ (Single DB, Pooled Schema,  │
                          │  Indexed company_id)        │
                          └─────────────────────────────┘
```

### 29.1 Trusted Tenant Context Resolution
1. **Zero Client Trust:** The backend never accepts `company_id` from query parameters, request bodies, or route params to determine tenancy.
2. **JWT Session Payload:**
   ```json
   {
     "sub": "user_64f1a2b3c4d5e6f7",
     "company_id": "comp_98a7b6c5d4e3f2",
     "role": "admin",
     "plan_status": "active",
     "session_id": "sess_1122334455"
   }
   ```
3. **Async Context Store / Request Injection:**
   ```typescript
   // req.tenant is established by middleware after verifying user membership and active subscription:
   req.tenant = {
     id: decoded.company_id,
     role: decoded.role,
     status: subscription.status,
     allowedModules: subscription.computed_modules,
     quotas: subscription.computed_quotas
   };
   ```

### 29.2 Mongoose Tenant Scoping Plugin
To guarantee zero cross-tenant leakage across developers, every business schema (`Truck`, `Driver`, `TruckJourney`, `Entry`, `Ledger`, `BillingParty`, `BalanceParty`, `AuditLog`, `VehicleEntry`) utilizes a global Mongoose tenant isolation plugin:

```typescript
// tenantPlugin.ts
export function tenantPlugin(schema: mongoose.Schema) {
  schema.add({
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    }
  });

  // Pre-query filtering for find, findOne, findOneAndUpdate, updateMany, countDocuments
  schema.pre(/^find|count|update/, function (next) {
    const contextCompanyId = getCurrentTenantId(); // From AsyncLocalStorage or req
    if (contextCompanyId && !this.getFilter().skipTenantCheck) {
      this.where({ company_id: contextCompanyId });
    }
    next();
  });

  // Compound Indexes for high-speed multi-tenant queries
  schema.index({ company_id: 1, created_at: -1 });
}
```

### 29.3 S3 Storage Partitioning & Presigned URL Scoping
All file uploads (Aadhaar, DL, fitness, insurance, POD, invoices) are isolated at the object key path:
$$\text{s3://bucket/tenants/}\{\text{company\_id}\}/\{\text{entity\_type}\}/\{\text{year\_month}\}/\{\text{uuid}\}.\{\text{ext}\}$$
- Presigned download URLs are generated on-demand with a 15-minute Time-To-Live (TTL).
- The S3 generator endpoint explicitly verifies that the requested document belongs to `req.tenant.id` before generating a presigned URL, completely preventing cross-tenant document scraping.

---

## 30. SaaS Core Database Schemas & Data Models

All plan tiers, pricing, features, add-ons, and quotas are **100% database-driven and configurable** by the platform super-admin. No plan names or prices are hardcoded in application logic.

### 30.1 `Company` (Tenant) Model
```typescript
interface ICompany {
  _id: mongoose.Types.ObjectId;
  name: string;                          // Legal Business Name: e.g., "Apex Logistics Pvt Ltd"
  slug: string;                          // Unique URL identifier: e.g., "apex-logistics"
  email: string;                         // Primary contact/billing email
  phone: string;
  gstin?: string;                        // Tax Identification
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  settings: {
    currency: string;                    // Default "INR"
    timezone: string;                    // Default "Asia/Kolkata"
    lr_prefix: string;                   // Custom bill/LR prefix: e.g., "APX-"
    invoice_prefix: string;              // e.g., "INV-"
    logo_url?: string;
    financial_year_start: number;        // Month (e.g., 4 for April)
  };
  subscription_id: mongoose.Types.ObjectId; // Reference to active Subscription
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### 30.2 `User` & `CompanyMember` (RBAC & Invitations) Model
```typescript
interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;                         // Globally unique
  password_hash: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_platform_super_admin: boolean;     // Access to /super-admin portal
  created_at: Date;
  updated_at: Date;
}

interface ICompanyMember {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;     // Set once invitation accepted
  email: string;                         // Invited email
  role: 'admin' | 'dispatcher' | 'accountant' | 'viewer';
  status: 'invited' | 'active' | 'deactivated';
  invitation_token?: string;
  token_expires_at?: Date;
  invited_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}
```

### 30.3 `Plan` Model (Dynamic Pricing & Catalog)
```typescript
interface IPlan {
  _id: mongoose.Types.ObjectId;
  code: string;                          // e.g., "starter", "standard", "pro", "enterprise"
  name: string;                          // e.g., "Pro Fleet Manager"
  description: string;
  is_active: boolean;                    // Available for public checkout
  is_public: boolean;                    // False for custom enterprise deals
  billing_intervals: [
    {
      interval: 'monthly' | 'yearly';
      price: number;                     // In paise or cents (e.g., 499900 = ₹4,999.00)
      currency: string;                  // "INR"
      discount_percentage: number;       // e.g., 17% for annual
      gateway_plan_id: string;           // Razorpay / Stripe plan reference ID
    }
  ];
  included_modules: string[];            // e.g., ["core_journeys", "lr_engine", "invoices", "settlements", "watchlists", "general_ledger"]
  quotas: {
    max_trucks: number;                  // e.g., 35
    max_users: number;                   // e.g., 10
    max_storage_mb: number;              // e.g., 10240 (10 GB)
    monthly_whatsapp_quota: number;      // e.g., 0 (or included allowance)
  };
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}
```

### 30.4 `AddOn` Model (Optional Monetized Modules)
```typescript
interface IAddOn {
  _id: mongoose.Types.ObjectId;
  code: string;                          // e.g., "whatsapp_suite", "fleet_iq", "maintenance_mgr", "gps_sync"
  name: string;                          // e.g., "WhatsApp Automation Suite"
  description: string;
  monthly_price: number;                 // e.g., 129900 (₹1,299.00)
  currency: string;
  module_flag: string;                   // Entitlement key injected into session
  quota_increments: {
    extra_trucks?: number;
    extra_users?: number;
    extra_whatsapp_msgs?: number;
  };
  is_active: boolean;
}
```

### 30.5 `Subscription` Model (Lifecycle & Billing State)
```typescript
interface ISubscription {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  plan_id: mongoose.Types.ObjectId;
  billing_interval: 'monthly' | 'yearly';
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  
  // Trial details
  trial_started_at: Date;
  trial_ends_at: Date;
  
  // Billing cycle
  current_period_started_at: Date;
  current_period_ends_at: Date;
  cancelled_at?: Date;
  cancel_at_period_end: boolean;
  
  // Active Add-ons
  active_addons: [
    {
      addon_id: mongoose.Types.ObjectId;
      quantity: number;
      activated_at: Date;
    }
  ];

  // Custom enterprise overrides (super-admin overrides)
  custom_quota_overrides?: {
    max_trucks?: number;
    max_users?: number;
    max_storage_mb?: number;
  };

  // Payment Gateway Reference
  payment_gateway: 'razorpay' | 'stripe' | 'manual';
  gateway_subscription_id?: string;
  gateway_customer_id?: string;

  // Cached computed entitlements for sub-millisecond middleware checks
  computed_modules: string[];            // Union of plan.included_modules + active_addons.module_flag
  computed_quotas: {
    max_trucks: number;
    max_users: number;
    max_storage_mb: number;
    monthly_whatsapp_quota: number;
  };

  created_at: Date;
  updated_at: Date;
}
```

### 30.6 `SubscriptionInvoice` Model (Platform Invoicing)
```typescript
interface ISubscriptionInvoice {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  subscription_id: mongoose.Types.ObjectId;
  invoice_number: string;                // e.g., "SUB-2026-0045"
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: 'paid' | 'open' | 'failed' | 'void';
  billing_period_start: Date;
  billing_period_end: Date;
  pdf_url?: string;
  paid_at?: Date;
  gateway_payment_id?: string;
  failure_reason?: string;
  created_at: Date;
}
```

### 30.7 `ProcessedWebhook` (Idempotency Control)
```typescript
interface IProcessedWebhook {
  _id: mongoose.Types.ObjectId;
  event_id: string;                      // Gateway Event ID (e.g. evt_3Nk4...)
  gateway: 'razorpay' | 'stripe';
  event_type: string;
  processed_at: Date;
  payload_summary: mongoose.Schema.Types.Mixed;
}
```

---

## 31. Subscription Lifecycle State Machine & Transition Rules

```
                      ┌──────────────────────┐
                      │   Self-Registration  │
                      └──────────┬───────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │       TRIALING         │ ◄── 14-Day Free Access (Full Features)
                     └─────┬───────────┬──────┘
       Payment Succeeded   │           │ Trial Expired without Payment
              ┌────────────┘           └────────────┐
              ▼                                     ▼
   ┌──────────────────────┐              ┌──────────────────────┐
   │        ACTIVE        │              │       EXPIRED        │
   └──────┬────────┬──────┘              └──────────┬───────────┘
          │        │                                │
 Payment  │        │ User Requests                  │ Subscribe Now
 Failed   │        │ Cancellation                   │
          ▼        ▼                                ▼
   ┌───────────┐ ┌───────────────────┐    ┌──────────────────────┐
   │ PAST_DUE  │ │ CANCEL_AT_PERIOD  │ ──►│        ACTIVE        │
   └─────┬─────┘ └───────────────────┘    └──────────────────────┘
         │
   7-Day │ Grace Period Exhausted
         ▼
   ┌───────────┐
   │ SUSPENDED │ ◄── Read-Only Mode (Zero Write Access, Data Preserved Indefinitely)
   └─────┬─────┘
         │
         │ Payment Cleared
         ▼
   ┌───────────┐
   │  ACTIVE   │
   └───────────┘
```

### 31.1 State Definitions & Application Behavior
1. **`TRIALING`**: 14 calendar days of full operational access upon registration.
   - *Banner:* Dismissible top notification showing "X days remaining in your free trial".
   - *Write Access:* Fully enabled up to starter quotas (5 trucks, 2 users).
2. **`ACTIVE`**: Paid subscription current.
   - *Write Access:* Full operations enabled within plan quotas and licensed modules.
3. **`PAST_DUE` (Grace Period)**: Payment attempt failed at renewal date.
   - *Duration:* Exactly **7 calendar days** grace period.
   - *Behavior:* Operations continue unrestricted; high-priority persistent banner prompts owner to update payment method. 3 automated retry attempts made on days 1, 3, and 6.
4. **`SUSPENDED` (Grace Period Exhausted)**:
   - *Behavior:* **Graceful Read-Only Degradation**.
   - *Rules:* 
     - Users can log in, view existing records, generate PDF invoices for past records, and export reports to Excel.
     - Any HTTP `POST`, `PUT`, `PATCH`, or `DELETE` on operational resources returns `403 Forbidden` with error code `SUBSCRIPTION_SUSPENDED`.
     - Data is **NEVER deleted**. Complete company history remains intact indefinitely.
     - Immediate unlock modal offers one-click invoice payment link.
5. **`CANCELLED`**:
   - Company owner cancelled auto-renew. Remains `ACTIVE` until `current_period_ends_at`, then transitions to `SUSPENDED`.
6. **`EXPIRED`**:
   - Trial ended without adding payment method. Same behavior as `SUSPENDED`.

---

## 32. Entitlement & Usage Metering Middleware Engine

Centralized Express middlewares intercept incoming requests and validate permissions before reaching any controller:

### 32.1 Middleware Stack Pipeline
```typescript
// Example dispatch route:
router.post(
  '/api/journey',
  requireAuth,                          // 1. Validates JWT signature & attaches user
  resolveTenantContext,                 // 2. Loads active tenant, plan & computes entitlements
  requireRole(['admin', 'dispatcher']), // 3. Checks RBAC role
  requireModule('core_journeys'),       // 4. Checks if current plan includes this feature
  requireActiveSubscription,            // 5. Blocks write requests if past_due > 7d or suspended
  checkQuota('trucks'),                 // 6. Validates if active trucks < plan.quotas.max_trucks
  createJourneyController               // 7. Executes business logic
);
```

### 32.2 Quota Evaluation Service
```typescript
// quotaService.ts
export async function assertQuotaAvailable(
  companyId: mongoose.Types.ObjectId,
  resource: 'trucks' | 'users' | 'storage_mb' | 'whatsapp'
): Promise<void> {
  const subscription = await getCompanySubscription(companyId);
  const quotas = subscription.computed_quotas;

  switch (resource) {
    case 'trucks': {
      const activeCount = await Truck.countDocuments({ company_id: companyId, is_deleted: false });
      if (activeCount >= quotas.max_trucks) {
        throw new QuotaExceededError(
          `Vehicle limit reached (${activeCount}/${quotas.max_trucks}). Please upgrade your plan.`
        );
      }
      break;
    }
    case 'users': {
      const activeUsers = await CompanyMember.countDocuments({ company_id: companyId, status: 'active' });
      if (activeUsers >= quotas.max_users) {
        throw new QuotaExceededError(
          `User seat limit reached (${activeUsers}/${quotas.max_users}). Please invite additional seats or upgrade.`
        );
      }
      break;
    }
    // Storage & WhatsApp quota logic...
  }
}
```

---

## 33. Billing Gateway Architecture (Razorpay & Stripe) & Webhook Security

### 33.1 Payment Processing Flow
1. **Checkout Initiation:** Tenant clicks "Upgrade" on the subscription page. Express backend calls Razorpay/Stripe API using customer details and creates a hosted Checkout Session or Subscription Order.
2. **Client Checkout Modal:** Standard Razorpay/Stripe checkout modal opens on client with UPI, Card, NetBanking, or Wallet options.
3. **Webhook Verification (Source of Truth):** Subscription activation **NEVER** relies on client-side frontend redirects. It activates exclusively upon receiving a cryptographically verified webhook.

### 33.2 Cryptographic Webhook Handler with Idempotency
```typescript
// webhookController.ts
export async function handleBillingWebhook(req: Request, res: Response) {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = req.rawBody; // Captured before JSON parsing

  // 1. Verify HMAC SHA256 Signature
  const isValid = verifyWebhookSignature(rawBody, signature, process.env.BILLING_WEBHOOK_SECRET);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  const eventId = event.event_id || event.id;

  // 2. Idempotency Check: Prevent duplicate event execution
  const alreadyProcessed = await ProcessedWebhook.findOne({ event_id: eventId });
  if (alreadyProcessed) {
    return res.status(200).json({ received: true, note: 'Already processed' });
  }

  // 3. Execute in MongoDB ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    switch (event.event) {
      case 'subscription.charged':
      case 'invoice.payment_succeeded':
        await processSubscriptionRenewal(event.payload, session);
        break;
      case 'subscription.halted':
      case 'invoice.payment_failed':
        await processSubscriptionFailure(event.payload, session);
        break;
      case 'subscription.cancelled':
        await processSubscriptionCancellation(event.payload, session);
        break;
    }

    // 4. Mark Webhook Processed
    await ProcessedWebhook.create(
      [{ event_id: eventId, gateway: 'razorpay', event_type: event.event, processed_at: new Date(), payload_summary: event.payload }],
      { session }
    );

    await session.commitTransaction();
    res.status(200).json({ received: true });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Processing error' });
  } finally {
    session.endSession();
  }
}
```

---

## 34. Platform-Owner Super-Admin Control Plane (`/super-admin`)

A dedicated operational command center isolated from tenant workspaces:

### 34.1 Super-Admin Capabilities
1. **Global SaaS Analytics**: Total Active Tenants, Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), Churn Rate, Total Active Fleets, Storage Consumed.
2. **Tenant Directory & Control**:
   - Search by company name, contact email, GSTIN, or plan status.
   - View live resource utilization (e.g., "Apex Logistics: 28/35 Trucks, 8/10 Users").
   - **Trial Extension**: 1-click extension of free trial by 7, 14, or 30 days.
   - **Manual Plan Overrides**: Grant complimentary custom quotas (e.g., override to 50 trucks for a VIP client).
   - **Emergency Freeze / Suspension**: Immediate lock of fraudulent or abusive tenant workspaces.
3. **Impersonation Support Mode**:
   - Allows platform support engineers to generate a short-lived (1-hour) read-only or authorized session into a specific company's workspace to diagnose customer support issues without asking for passwords.
   - Every impersonation event is permanently recorded in `PlatformAuditLog`.
4. **Plan & Add-On Management**:
   - Create, edit, activate, or archive plans and add-on pricing directly in the UI without deploying code.

---

## 35. SaaS API Contract Specifications

### 35.1 Tenant Onboarding & Team Management
* `POST /api/auth/register-company`
  * *Body:* `{ companyName, slug, name, email, password, phone, gstin }`
  * *Action:* Creates `Company`, creates `User`, assigns `admin` role in `CompanyMember`, initializes 14-day `TRIALING` subscription with starter plan, sets secure `HttpOnly` JWT cookie.
* `GET /api/company/workspace`
  * *Returns:* Company profile, active settings, current member list, user role.
* `PATCH /api/company/workspace`
  * *Body:* `{ name, address, settings: { logo_url, lr_prefix, invoice_prefix } }`
* `POST /api/company/invitations`
  * *Body:* `{ email, role: 'dispatcher' | 'accountant' | 'viewer' }`
  * *Action:* Validates user quota; generates secure invitation token; sends invite email.
* `POST /api/company/invitations/accept`
  * *Body:* `{ token, password, name }`
  * *Action:* Activates user membership and links to workspace.

### 35.2 Tenant Subscription & Billing
* `GET /api/subscription/me`
  * *Returns:* Current plan code, name, status, `trial_ends_at`, `current_period_ends_at`, active add-ons, live usage meters (`trucksCount`, `usersCount`, `storageMB`), and plan quota limits.
* `GET /api/subscription/plans`
  * *Returns:* List of all active public plans and add-ons with monthly/annual pricing.
* `POST /api/subscription/checkout`
  * *Body:* `{ planId, interval: 'monthly' | 'yearly', addOnIds: [] }`
  * *Returns:* Gateway checkout session ID & redirect/modal config.
* `POST /api/subscription/cancel`
  * *Action:* Sets `cancel_at_period_end: true`.
* `GET /api/subscription/invoices`
  * *Returns:* Paginated list of historical platform billing receipts with download links.

### 35.3 Platform Super-Admin APIs (`requireSuperAdmin`)
* `GET /api/super-admin/stats` $\rightarrow$ SaaS metrics (MRR, tenant counts).
* `GET /api/super-admin/tenants` $\rightarrow$ Paginated tenant company directory with filters.
* `PATCH /api/super-admin/tenants/:id/override` $\rightarrow$ Modify trial dates, quotas, or suspension status.
* `POST /api/super-admin/tenants/:id/impersonate` $\rightarrow$ Issues temporary scoped access token.
* `POST /api/super-admin/plans` $\rightarrow$ Create or update subscription plan definition.

---

## 36. Migration & Hardening Strategy for Existing Data & Code

### 36.1 Legacy Data Migration Pipeline
To upgrade the existing single-company database without data loss:
1. **Step 1: Seed Primary System Tenant**
   - Execute a migration script creating the initial default `Company` record ("Primary Transport Fleet", slug `primary-fleet`).
2. **Step 2: Assign `company_id` to All Legacy Records**
   - Bulk update all existing records across collections:
     ```javascript
     const defaultCompanyId = primaryCompany._id;
     await Truck.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await Driver.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await TruckJourney.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await Entry.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await Ledger.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await BillingParty.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await BalanceParty.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     await VehicleEntry.updateMany({ company_id: { $exists: false } }, { $set: { company_id: defaultCompanyId } });
     ```
3. **Step 3: Enforce Indexing & Schema Validation**
   - Create compound index `{ company_id: 1, created_at: -1 }` on all operational collections.
   - Set `company_id: { required: true }` in Mongoose schemas.
4. **Step 4: Seed Default SaaS Catalog**
   - Populate `Plan` collection with `Starter` (₹999/mo), `Standard` (₹2,499/mo), and `Pro` (₹4,999/mo) records.
   - Populate `AddOn` collection with WhatsApp, Fleet IQ, Maintenance, and GPS sync modules.
   - Associate `Primary Transport Fleet` with an active enterprise/pro subscription.

### 36.2 Incremental Test Verification Matrix
| Verification Area | Test Case Scenario | Expected Pass Result |
| :--- | :--- | :--- |
| **Data Isolation** | User A (Company 1) calls `GET /api/journey/:id` for Journey owned by Company 2 | Returns `404 Not Found` (Mongoose tenant filter automatically excludes it). |
| **Quota Enforcement** | Company on Starter Plan (5 truck limit) attempts to add 6th truck | API rejects with `403 Forbidden` (`QuotaExceededError`) and prompt to upgrade. |
| **Entitlement Check**| Company without `Fleet IQ` add-on attempts to access mileage variance API | API returns `403 Forbidden` (`MODULE_NOT_ENTITLED`). |
| **Graceful Degradation**| Company subscription is `SUSPENDED`; user calls `POST /api/bill-entry` | API blocks write with `403 SUBSCRIPTION_SUSPENDED`; read requests (`GET`) succeed. |
| **Webhook Idempotency**| Gateway sends duplicate `invoice.payment_succeeded` webhook with same ID | System acknowledges `200 OK` without creating duplicate invoices or extending period twice. |

---

*This specification establishes the architectural foundation for transforming the TransportManagement platform into a market-leading, high-margin, multi-tenant B2B SaaS system.*

---

# PART IV: CONFIGURABLE MODULE & FEATURE-ENTITLEMENT SYSTEM SPECIFICATION

**Role:** Senior SaaS Product Architect & Platform Engineer  
**Core Requirement:** A single unified codebase and application instance serving multiple transport companies with dynamically varied operational needs (from basic fleet tracking to advanced multi-tax GST bilty and fuel theft AI) governed strictly by dynamic runtime feature entitlements.

---

## 37. Centralized Feature Catalog & Dependency Graph

All features and modules are registered in a centralized catalog with immutable, type-safe identifiers (`FEATURE_KEYS`). No feature keys are hardcoded in disjointed components.

```
                                  ┌─────────────────────────────┐
                                  │      MOD_PARTIES (Core)     │
                                  │  (Shippers, Consignors/ees) │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      MOD_FLEET (Core)       │   │   MOD_BILLING_INVOICES      │
│     (Trucks & Documents)    │   │  (Freight Bills, Extra Chg) │
└──────────────┬──────────────┘   └──────────────┬──────────────┘
               │                                 │
               ▼                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│     MOD_DRIVERS (Core)      │   │     MOD_GST_COMPLIANCE      │
│      (KYC, Aadhaar, DL)     │   │     (CGST/SGST/IGST, RCM)   │
└──────────────┬──────────────┘   └──────────────┬──────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │       MOD_TRIPS (Core)      │
                 │ (Journeys, Routes, Dispatch)│
                 └──────────────┬──────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│MOD_FUEL_EXPENSE│      │MOD_SETTLEMENTS│       │  MOD_GPS_SYNC │
│(Diesel Logs,  │       │(Driver Period │       │(Live Hardware │
│ En-Route Cash)│       │ Reconciliation)│      │  Telematics)  │
└───────┬───────┘       └───────┬───────┘       └───────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│MOD_MAINTENANCE│       │  MOD_LEDGERS  │
│(Preventive    │       │(Double-Entry  │
│ Schedules)    │       │ General Books)│
└───────────────┘       └───────────────┘
```

### 37.1 Feature Catalog Specification
| Module Key (`code`) | Module Name | Category | Hard Dependencies | Included In Base? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MOD_FLEET` | Truck & Vehicle Registry | Operations | None | **Yes (Starter+)** | Vehicle records, compliance document vault (fitness, insurance, tax, PUC), service intervals. |
| `MOD_DRIVERS` | Driver & Crew Management | Operations | None | **Yes (Starter+)** | Driver profiles, commercial DL, Aadhaar KYC, emergency contacts, assignment history. |
| `MOD_PARTIES` | Customer & Vendor Directory | Commercial | None | **Yes (Starter+)** | Billing Parties (shippers/consignees) and Balance Parties (market truck vendors/brokers). |
| `MOD_TRIPS` | Journey & Dispatch Engine | Operations | `MOD_FLEET`, `MOD_DRIVERS` | **Yes (Starter+)** | Trip planning, route checkpoints, milestone progress, odometer logs, delivery closeout. |
| `MOD_FUEL_EXPENSE` | Trip Expenses & Diesel Logs | Operations | `MOD_TRIPS` | **Yes (Starter+)** | En-route driver cash expenses, diesel fuel stops (liters, rate, pump slips). |
| `MOD_LR_ENGINE` | Lorry Receipt (LR) Generator | Logistics | `MOD_PARTIES`, `MOD_TRIPS` | **Yes (Starter+)** | Official 3-part consignment note printing (Consignor, Consignee, POD copy), blank LR generator. |
| `MOD_BILLING_INVOICE`| GST Freight Invoicing | Accounting | `MOD_PARTIES`, `MOD_LR_ENGINE` | **Yes (Starter+)** | Freight bill creation, dynamic extra charges (halting, loading), PDF downloads. |
| `MOD_GST_CONFIG` | GST Tax Breakdown & RCM | Accounting | `MOD_BILLING_INVOICE` | **Yes (Starter+)** | Automated CGST, SGST, IGST calculations, Reverse Charge Mechanism toggles. |
| `MOD_SETTLEMENTS` | Driver Trip Settlements | Accounting | `MOD_TRIPS`, `MOD_FUEL_EXPENSE` | **Standard+** | Driver period settlement calculator, diesel variance penalty, advance clearance. |
| `MOD_LEDGERS` | Financial General Ledger | Accounting | `MOD_PARTIES`, `MOD_SETTLEMENTS` | **Standard+** | 17-category double-entry ledger, transaction history, debit/credit journal reconciliations. |
| `MOD_PARTY_BALANCE` | Market Truck Party Balances | Accounting | `MOD_PARTIES` | **Standard+** | Balance Party freight vs advance vs kamisan/commission reconciliation and Excel export. |
| `MOD_WATCHLISTS` | Operational Watchlists | Analytics | `MOD_TRIPS` | **Standard+** | 5 operational queues (Unsettled Trips, Pending Settlements, Party Dues, Compliance, Activity). |
| `MOD_DOC_VAULT` | Cloud Document Vault | Storage | None | **Yes (Starter+)** | AWS S3 document storage with secure 15-min presigned URL access. |
| `MOD_GPS_SYNC` | Live GPS Telematics Sync | Telematics | `MOD_TRIPS` | **Add-On / Pro** | Direct API sync with WheelsEye/LocoNav/Fleetx; live map coordinates, automated odometer sync. |
| `MOD_FLEET_IQ` | Fuel Theft & Variance AI | Analytics | `MOD_FUEL_EXPENSE` | **Add-On / Pro** | Vehicle mileage variance benchmark, fuel theft alert triggers, driver mileage rating. |
| `MOD_MAINTENANCE` | Preventive Maintenance | Operations | `MOD_FLEET` | **Add-On / Pro** | Service logs, tyre tracking, spare parts, scheduled maintenance alerts. |
| `MOD_WHATSAPP` | Automated WhatsApp Bot | Notifications | `MOD_TRIPS`, `MOD_LR_ENGINE` | **Add-On** | Automated WhatsApp dispatch slips, LR download links, invoice delivery, settlement slips. |
| `MOD_TALLY_SYNC` | Tally / Busy Accounting Sync | Integrations | `MOD_LEDGERS` | **Add-On / Enterprise**| One-click export of transport vouchers in XML format for TallyPrime and Busy Accounting. |
| `MOD_MULTI_BRANCH` | Multi-Branch Hierarchy | Enterprise | None | **Enterprise** | Regional depot branches, branch-isolated ledgers, consolidated corporate rollups. |
| `MOD_SHIPPER_PORTAL`| Customer Shipper Portal | Enterprise | `MOD_BILLING_INVOICE` | **Enterprise** | Dedicated portal for corporate shippers to track shipments and download tax invoices. |

---

## 38. Company Entitlement Evaluation Engine & Precedence Rules

### 38.1 Evaluation Formula & Precedence Hierarchy
An entitlement request for a specific company and feature is resolved using an authoritative, deterministic precedence waterfall:

$$\text{Entitlement}(C, F) = \text{AccountActive}(C) \land \text{DependenciesSatisfied}(C, F) \land \text{AccessGranted}(C, F)$$

Where $\text{AccessGranted}(C, F)$ evaluates down the precedence chain:

```
[Level 1: System Security Override]
   │
   ├─► IF Company is SUSPENDED or CANCELLED ──► DENY ALL WRITE OPERATIONS (Read-Only)
   │
[Level 2: Super-Admin Explicit Overrides]
   │
   ├─► IF SuperAdmin Override exists for (Company, Feature):
   │     ├─► State == 'revoked' ──────────────► DENY (Explicit administrative revocation)
   │     └─► State == 'granted' AND NOT expired► GRANT (Complimentary grant / Beta trial)
   │
[Level 3: Active Paid Add-Ons]
   │
   ├─► IF Feature is covered by an Active Add-on ──► GRANT
   │
[Level 4: Active Subscription Plan Inclusions]
   │
   ├─► IF Feature is included in Subscription.plan.included_modules ──► GRANT
   │
[Level 5: Active 14-Day Free Trial]
   │
   ├─► IF Subscription is TRIALING AND NOT expired ──► GRANT (All core + standard features)
   │
[Level 6: Default Fallback]
   │
   └─► DENY (Module not licensed)
```

### 38.2 Dependency Resolution Algorithm
A feature **cannot be enabled** or accessed if any of its prerequisite dependencies are unfulfilled:
```typescript
// entitlementService.ts
export function evaluateFeatureAccess(
  featureKey: string,
  companyEntitlements: Set<string>,
  featureCatalog: Map<string, IModuleCatalog>
): { allowed: boolean; reason?: string; missingDependencies?: string[] } {
  const moduleDef = featureCatalog.get(featureKey);
  if (!moduleDef) {
    return { allowed: false, reason: `Unknown feature identifier: ${featureKey}` };
  }

  // 1. Check direct license/grant
  if (!companyEntitlements.has(featureKey)) {
    return { allowed: false, reason: `Feature ${moduleDef.name} is not included in your active plan or add-ons.` };
  }

  // 2. Validate all hard dependencies
  const missing = moduleDef.required_dependencies.filter(depKey => !companyEntitlements.has(depKey));
  if (missing.length > 0) {
    const missingNames = missing.map(k => featureCatalog.get(k)?.name || k).join(', ');
    return {
      allowed: false,
      reason: `Feature ${moduleDef.name} requires prerequisite module(s): ${missingNames}`,
      missingDependencies: missing
    };
  }

  return { allowed: true };
}
```

---

## 39. Entitlement Database Schemas & Storage Design

### 39.1 `ModuleCatalog` Model (Central Catalog Collection)
```typescript
interface IModuleCatalog {
  _id: mongoose.Types.ObjectId;
  code: string;                          // Unique identifier, e.g., "MOD_GPS_SYNC"
  name: string;                          // Human-readable: "Live GPS Telematics Sync"
  category: 'Operations' | 'Logistics' | 'Accounting' | 'Analytics' | 'Integrations' | 'Enterprise';
  description: string;
  required_dependencies: string[];      // Array of module codes, e.g., ["MOD_TRIPS"]
  min_plan_tier: 'starter' | 'standard' | 'pro' | 'enterprise';
  is_add_on: boolean;                    // Can be purchased independently as add-on
  add_on_code?: string;                  // Links to AddOn schema
  icon_name: string;                     // Lucide icon identifier: e.g., "Radio", "Truck", "Receipt"
  is_active: boolean;                    // System-wide availability flag
  created_at: Date;
  updated_at: Date;
}
```

### 39.2 `CompanyEntitlementOverride` Model (Super-Admin Custom Grants)
```typescript
interface ICompanyEntitlementOverride {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  feature_code: string;                  // e.g., "MOD_FLEET_IQ"
  override_state: 'granted' | 'revoked';
  expires_at?: Date;                     // Optional: null = indefinite grant
  reason: string;                        // e.g., "Beta test pilot program", "VIP retention gift"
  granted_by: mongoose.Types.ObjectId;   // Super-Admin User ID
  created_at: Date;
  updated_at: Date;
}
```

### 39.3 Cached Entitlements on Company Session
To avoid executing 5 database lookups on every HTTP request, computed entitlements are compiled upon login/token refresh and cached in Redis or in the decoded JWT session claim:
```json
{
  "company_id": "comp_98a7b6c5d4e3f2",
  "plan": "standard",
  "status": "active",
  "entitlements": [
    "MOD_FLEET", "MOD_DRIVERS", "MOD_PARTIES", "MOD_TRIPS", 
    "MOD_FUEL_EXPENSE", "MOD_LR_ENGINE", "MOD_BILLING_INVOICE", 
    "MOD_GST_CONFIG", "MOD_SETTLEMENTS", "MOD_LEDGERS", 
    "MOD_PARTY_BALANCE", "MOD_WATCHLISTS", "MOD_DOC_VAULT", "MOD_WHATSAPP"
  ],
  "quotas": {
    "max_trucks": 15,
    "max_users": 5,
    "max_storage_mb": 5120
  }
}
```

---

## 40. Backend Enforcement Architecture & Middleware Services

Security is never delegated to the client browser. Every Express router, controller, and background job explicitly validates feature permissions.

### 40.1 Reusable Entitlement Enforcement Middleware
```typescript
// middleware/entitlementGuard.ts
import { Request, Response, NextFunction } from 'express';

export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Verify tenant context exists
    if (!req.tenant) {
      return res.status(401).json({ error: 'Unauthorized: No active tenant context' });
    }

    const { status, allowedModules, quotas } = req.tenant;

    // 2. Block write actions if subscription is past grace period
    if (['suspended', 'cancelled', 'expired'].includes(status) && req.method !== 'GET') {
      return res.status(403).json({
        code: 'SUBSCRIPTION_SUSPENDED',
        error: 'Your workspace is in read-only mode due to an inactive subscription. Please renew to resume write operations.',
        upgradeUrl: '/settings/subscription'
      });
    }

    // 3. Verify feature license
    if (!allowedModules.includes(featureKey)) {
      return res.status(403).json({
        code: 'FEATURE_NOT_ENTITLED',
        feature: featureKey,
        error: `Your subscription does not include access to the '${featureKey}' module.`,
        upgradeUrl: '/settings/modules'
      });
    }

    next();
  };
}
```

### 40.2 Multi-Feature Gate (`requireAllFeatures` & `requireAnyFeature`)
```typescript
// For routes that span multiple domains (e.g., Driver Settlement writes to Trips & Ledgers):
router.post(
  '/api/settlements/confirm',
  requireAuth,
  resolveTenantContext,
  requireRole(['admin', 'accountant']),
  requireAllFeatures(['MOD_SETTLEMENTS', 'MOD_LEDGERS']),
  confirmSettlementController
);
```

### 40.3 Background Job Execution Protection
All automated workers, scheduled cron jobs, and webhook dispatchers verify company feature licenses before executing:
```typescript
// jobs/whatsappDailySummary.ts
export async function runDailyWhatsAppBroadcast(companyId: string) {
  const isLicensed = await EntitlementService.hasFeature(companyId, 'MOD_WHATSAPP');
  if (!isLicensed) {
    // Gracefully skip execution without throwing errors
    return logger.info(`Skipping WhatsApp broadcast: Company ${companyId} not entitled to MOD_WHATSAPP.`);
  }
  // Proceed with broadcast...
}
```

---

## 41. Dynamic Frontend Architecture & UI Component Gates

### 41.1 Frontend React State & Entitlement Hook
```typescript
// hooks/useEntitlement.ts
import { useAuthStore } from '../stores/authStore';

export function useEntitlement() {
  const { currentTenant } = useAuthStore();
  const entitlements = new Set(currentTenant?.allowedModules || []);

  const hasFeature = (featureKey: string): boolean => {
    return entitlements.has(featureKey);
  };

  const hasAllFeatures = (...featureKeys: string[]): boolean => {
    return featureKeys.every(k => entitlements.has(k));
  };

  const isSuspended = ['suspended', 'expired'].includes(currentTenant?.status || '');

  return { hasFeature, hasAllFeatures, isSuspended, quotas: currentTenant?.quotas };
}
```

### 41.2 Reusable `<FeatureGate>` Component
Protects UI controls, buttons, forms, and cards gracefully:
```tsx
// components/common/FeatureGate.tsx
interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback = null,
  showUpgradePrompt = false
}) => {
  const { hasFeature } = useEntitlement();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (showUpgradePrompt) {
    return (
      <div className="card card-locked">
        <div className="card-body text-center">
          <LockIcon className="icon-locked" />
          <h4 className="title">Unlock {feature}</h4>
          <p className="description">This capability requires an upgraded subscription or add-on module.</p>
          <a href="/settings/modules" className="btn btn-primary btn-sm">Explore Plans & Add-ons</a>
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
};
```

### 41.3 Dynamic Navigation Generator
The application sidebar automatically filters links based on active entitlements so users never encounter dead or confusing navigation links:
```typescript
// navigation/sidebarConfig.ts
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', requiredFeature: null },
  { label: 'Fleet & Trucks', path: '/journey/all-truck-entries', requiredFeature: 'MOD_FLEET' },
  { label: 'Drivers', path: '/journey/all-driver-entries', requiredFeature: 'MOD_DRIVERS' },
  { label: 'Trips & Dispatch', path: '/journey/all-journey-entries', requiredFeature: 'MOD_TRIPS' },
  { label: 'Bill Entries & LR', path: '/bill-entry/all-bill-entries', requiredFeature: 'MOD_LR_ENGINE' },
  { label: 'Freight Invoices', path: '/bill-entry/bill', requiredFeature: 'MOD_BILLING_INVOICE' },
  { label: 'Driver Settlements', path: '/journey/all-settlements', requiredFeature: 'MOD_SETTLEMENTS' },
  { label: 'Financial Ledger', path: '/ledger/all-ledgers', requiredFeature: 'MOD_LEDGERS' },
  { label: 'Party Balances', path: '/vehicle-entry/party-balance', requiredFeature: 'MOD_PARTY_BALANCE' },
  { label: 'Live GPS Tracking', path: '/tracking/live-map', requiredFeature: 'MOD_GPS_SYNC' },
  { label: 'Fuel Theft & IQ', path: '/reports/fleet-iq', requiredFeature: 'MOD_FLEET_IQ' },
  { label: 'Maintenance Log', path: '/fleet/maintenance', requiredFeature: 'MOD_MAINTENANCE' },
];

export function getAuthorizedNavItems(allowedModules: string[]) {
  return NAV_ITEMS.filter(item => !item.requiredFeature || allowedModules.includes(item.requiredFeature));
}
```

### 41.4 Data Preservation Policy when Modules are Disabled
When a company downgrades a plan or cancels an add-on (e.g., disables `MOD_SETTLEMENTS` or `MOD_WHATSAPP`):
1. **Never Purge Data:** All historical settlements, WhatsApp logs, or ledger journals remain permanently in the database.
2. **Read-Only Inspection:** When visiting historical reports or search, existing records remain visible and exportable.
3. **Write Protection:** The "Create New Settlement" or "Send WhatsApp" action buttons are disabled with a tooltip: *"Re-enable module to create new records"*.

---

## 42. Company Administration & Super-Admin Entitlement Portals

### 42.1 Company Module Management Screen (`/settings/modules`)
Accessible to the Tenant Administrator:
* **Current Plan Summary**: Displays active plan name, renewal date, and included modules list.
* **Module Grid**: Interactive cards for all 20 catalog features grouped by category:
  * **Badge State:**
    * `Included in Plan` (Green badge, active)
    * `Active Add-On` (Blue badge, active)
    * `Available Add-on` (Purple badge, "+₹1,299/mo - Activate Now" CTA)
    * `Requires Upgrade` (Orange badge, "Available in Pro Tier - Upgrade" CTA)
    * `Blocked by Dependencies` (Grey badge with tooltip: *"Requires MOD_TRIPS and MOD_DRIVERS"*)
* **Live Usage Meters**:
  * Active Trucks: `12 / 15` (Progress bar at 80%)
  * User Seats: `4 / 5`
  * S3 Storage: `2.4 GB / 10 GB`
* **Upgrade Modal**: Instant in-app checkout via Razorpay to activate an add-on immediately.

### 42.2 Super-Admin Cross-Tenant Entitlement Console (`/super-admin/tenants/:id/entitlements`)
Accessible exclusively to `is_platform_super_admin`:
* **Complete Entitlement Matrix**: Master table showing every catalog module with toggle switches:
  * `Inherited from Plan` (Default ON)
  * `Force Grant (Override)` (Allows granting any paid module for free)
  * `Force Revoke (Override)` (Allows blacklisting a module for non-payment or abuse)
* **Temporary Trial Granting**:
  * Calendar picker to grant any feature until a specific date (e.g., *"Grant MOD_GPS_SYNC for 30 days trial"*).
* **Custom Quota Overrides**:
  * Input fields to override `max_trucks` (e.g., bump from 15 to 40 for a VIP customer) without altering their base plan tier.
* **Audit Trail Feed**: Log displaying who made each entitlement override, timestamp, and justification reason.

---

## 43. Entitlement Testing, Verification & Migration Suite

### 43.1 Incremental Test Verification Matrix
| Test Area | Action Tested | Expected Behavioral Outcome |
| :--- | :--- | :--- |
| **Direct URL Access** | Starter plan user navigates directly to `/ledger/all-ledgers` in browser | React router guard intercepts route, displays `<FeatureGate>` upgrade card. |
| **API Bypass Attempt** | Malicious client sends `POST /api/ledger` with valid session cookie on Starter plan | Server middleware `requireFeature('MOD_LEDGERS')` immediately halts request with `403 Forbidden` (`FEATURE_NOT_ENTITLED`). |
| **Missing Dependency** | Tenant attempts to enable `MOD_BILLING_INVOICE` while `MOD_PARTIES` is revoked | Engine returns `400 Bad Request` with `missingDependencies: ['MOD_PARTIES']`. |
| **Timed Expiry Trigger**| Super-admin grants `MOD_FLEET_IQ` with `expires_at = yesterday` | Middleware detects expired timestamp; feature immediately reverts to locked state without manual intervention. |
| **Data Preservation** | Company downgrades from Pro to Starter; views past driver settlements | Past settlements render normally in read-only tables; "New Settlement" button is disabled. |
| **Real-time Invalidation**| Tenant purchases WhatsApp add-on in tab A; tab B navigates to dispatch | TanStack Query invalidates `/api/subscription/me`; sidebar and WhatsApp buttons illuminate instantly without full page refresh. |

### 43.2 Seed & Migration Plan for Existing Database
1. **Migration 001 - Catalog Initialization**:
   - Seed all 20 modules from Section 37 into the `ModuleCatalog` MongoDB collection with category, dependencies, and min plan tier.
2. **Migration 002 - Plan Catalog Association**:
   - Update `Plan` documents (`Starter`, `Standard`, `Pro`) mapping their respective `included_modules` arrays.
3. **Migration 003 - Backfill Existing Company**:
   - Run backfill script reading the existing primary company, attaching `computed_modules` to its active `Subscription` record matching the Pro plan catalog.
4. **Zero Code Duplication**:
   - All legacy controllers wrap their entry handlers with `requireFeature(...)` without changing underlying business queries.

---

*This specification establishes a robust, highly extensible module entitlement architecture, enabling flexible SaaS monetization, dynamic customer tailoring, strict server enforcement, and zero code branching across clients.*

---

# PART V: CONFIGURABLE COMPANY-CUSTOMIZATION, CUSTOM FIELDS & WORKFLOW ENGINE

**Role:** Senior Enterprise Application Architect  
**Objective:** Architect a flexible, enterprise-grade customization engine allowing distinct transport companies to tailor settings, business fields, form layouts, and approval workflows dynamically within a single, unified SaaS codebase—without codebase branching, arbitrary client injection vulnerabilities, or compromising core system integrity.

---

## 44. Architectural Vision & Guardrail Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TENANT WORKSPACE                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────┐  │
│  │   Company Regional & Fin    │  │    Custom Field Studio    │  │ Approval Engine  │  │
│  │   Settings (Number, Date,   │  │   (Typed Dynamic Metadata │  │ (Trips, Expenses,│  │
│  │   Currency, GST, Prefixes)  │  │   for 6 Core Entities)    │  │  Invoices)       │  │
│  └──────────────┬──────────────┘  └─────────────┬─────────────┘  └────────┬─────────┘  │
│                 │                               │                         │            │
│                 ▼                               ▼                         ▼            │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     DYNAMIC RUNTIME SYNTHESIS & VALIDATION                       │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │  1. Immutable Core Guardrails (Prevents removing truck_no, tenant_id, GST, etc.) │  │
│  │  2. Dynamic Zod Validator Generated on-the-fly per Tenant Definition            │  │
│  │  3. Role-Based Field Editability & Visibility Filter                            │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│                                         ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                   HYBRID TYPED MAP DATA STORAGE (MongoDB)                        │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │  Standard Schema Fields  +  custom_fields: { [stable_field_key]: typed_value }   │  │
│  │  (Isolated per company_id with Wildcard Indexed Querying)                        │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 44.1 Core Customization Principles
1. **Single Universal Codebase:** No tenant-specific forks, branches, or conditional hardcoded switch statements (`if (tenant === 'apex')`). All behavior is driven at runtime from tenant configuration collections.
2. **Strict Immutable Guardrails:** Tenants can customize labels, order, and add custom fields, but **can never hide, delete, or bypass mandatory core business fields** (e.g., Truck Registration Number, Driver Phone, Origin/Destination, Subtotal, CGST/SGST/IGST breakdown, or `company_id`).
3. **Type Safety & Injection Defense:** Custom fields are strictly typed, checked against database definitions, and sanitized prior to database persistence. Unregistered fields in payload bodies are automatically stripped.
4. **Data Isolation & Predictability:** Custom field configurations belong exclusively to `company_id`. Changing or retiring a field preserves historical data integrity.

---

## 45. Company Settings Engine

Administrators configure global business defaults under `/settings/company`:

### 45.1 Settings Model Schema
```typescript
interface ICompanySettings {
  company_id: mongoose.Types.ObjectId;
  
  // 1. Regional & Localization
  localization: {
    date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'; // Default 'DD/MM/YYYY'
    time_format: '12h' | '24h';
    timezone: string;                                          // Default 'Asia/Kolkata'
    currency_code: string;                                     // Default 'INR'
    currency_symbol: string;                                   // Default '₹'
    number_format_system: 'indian' | 'international';         // 'indian' = ₹1,50,000; 'international' = $150,000
    decimal_precision: number;                                 // Default 2
  };

  // 2. Sequential Document Numbering Series
  numbering_series: {
    lr: {
      prefix: string;           // e.g., "LR-26-"
      starting_number: number;  // e.g., 1001
      padding_digits: number;   // e.g., 5 -> "LR-26-01001"
      auto_generate: boolean;
    };
    invoice: {
      prefix: string;           // e.g., "INV-26-"
      starting_number: number;
      padding_digits: number;
      auto_generate: boolean;
    };
    settlement: {
      prefix: string;           // e.g., "SET-"
      starting_number: number;
      padding_digits: number;
    };
  };

  // 3. Tax & Accounting Preferences
  tax_preferences: {
    default_gst_rate: number;          // Default 5% or 12%
    is_rcm_applicable_by_default: boolean; // Reverse Charge Mechanism for GTA
    pan_number?: string;
    lut_number?: string;               // For export freight
    default_payment_terms_days: number;// e.g., 30 days
  };

  // 4. Custom Operational Expense Categories
  operational_expense_categories: [
    {
      category_id: string;             // e.g., "cat_toll", "cat_loading"
      display_name: string;            // e.g., "Weighbridge & Dharamkanta"
      is_driver_reimbursable: boolean;
      requires_slip_attachment: boolean;
      is_active: boolean;
    }
  ];

  // 5. Document & POD Policies
  document_preferences: {
    mandatory_pod_for_invoice: boolean; // Block invoice generation until POD slip uploaded
    allow_overdue_compliance_dispatch: boolean; // Allow dispatching truck with expired PUC/Tax (with warning)
    document_retention_days: number;
  };
}
```

---

## 46. Custom Fields Engine & Data Storage Architecture

### 46.1 Evaluation of Custom Field Storage Patterns
| Storage Architecture | How It Works | Strengths | Weaknesses | Architectural Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A. Entity-Attribute-Value (EAV)** | Separate SQL-like table storing `(entity_id, field_id, value)` per field. | Flexible in relational databases. | Massive join overhead, breaks MongoDB document model, poor reporting performance. | **Rejected** |
| **B. Untyped Document Bag (`metadata: {}`)** | Arbitrary, unvalidated JSON object saved directly on the record. | Zero development friction. | No validation, zero type safety, prone to schema corruption, high risk of injection. | **Rejected** |
| **C. Hybrid Embedded Typed Map + Metadata Schema** | `custom_fields: { [key]: value }` stored inside the entity document, strictly validated at runtime against tenant's `CustomFieldDefinition` collection. | **Fast single-document reads/writes, fully type-safe, indexed, supports MongoDB projection & filtering, schema evolution friendly.** | Requires dynamic runtime validator. | **Selected & Implemented** |

### 46.2 `CustomFieldDefinition` Schema
```typescript
interface ICustomFieldDefinition {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  entity_type: 'Truck' | 'Driver' | 'TruckJourney' | 'BillingParty' | 'BalanceParty' | 'Entry';
  field_key: string;                     // Immutable machine key: e.g., "gps_vendor_id", "fastag_barcode"
  display_label: string;                 // UI Label: e.g., "FASTag Barcode Number"
  field_type: 
    | 'text' 
    | 'number' 
    | 'date' 
    | 'boolean' 
    | 'dropdown' 
    | 'multi_select' 
    | 'lookup'                           // References another entity
    | 'url';
  
  // Validation Rules
  is_required: boolean;
  default_value?: any;
  validation_rules?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    regex_pattern?: string;              // e.g., "^[0-9]{10}$" for custom mobile
    regex_error_message?: string;
  };

  // Dropdown / Multi-Select options
  options?: [
    {
      label: string;                     // e.g., "Dry Container"
      value: string;                     // e.g., "dry_container"
      color_tag?: string;                // UI badge color
    }
  ];

  // Lookup settings (if field_type === 'lookup')
  lookup_config?: {
    target_entity: 'Driver' | 'Truck' | 'BillingParty';
    display_field: string;
  };

  // Visibility and Access Control
  visibility: 'all_roles' | 'admin_only' | 'manager_and_above';
  editability: 'always' | 'create_only' | 'admin_only'; // 'create_only' = locked after initial save
  is_searchable: boolean;                // Include in global search index
  is_archived: boolean;                  // Soft-deprecation
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}
```

### 46.3 Entity Schema Integration
Every core Mongoose schema embeds a validated `custom_fields` object with wildcard indexing:
```typescript
// Inside TruckSchema, DriverSchema, JourneySchema, EntrySchema:
{
  // ... standard schema fields ...
  custom_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}

// MongoDB Wildcard Index for high-speed tenant custom field queries:
EntitySchema.index({ "company_id": 1, "custom_fields.$**": 1 });
```

---

## 47. Form Layout & Section Configuration

Allows companies to rename labels, reorder fields, and group them into distinct sections without modifying code.

### 47.1 `FormLayoutConfiguration` Schema
```typescript
interface IFormLayoutConfiguration {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  entity_type: 'Truck' | 'Driver' | 'TruckJourney' | 'Entry';
  sections: [
    {
      section_id: string;               // e.g., "sec_general", "sec_compliance"
      title: string;                    // e.g., "Vehicle Legal Documents"
      description?: string;
      sort_order: number;
      fields: [
        {
          field_key: string;            // Standard field key or custom field key
          custom_label?: string;        // Overridden display label (e.g., "Bilty No" instead of "LR No")
          is_hidden: boolean;           // Hidden in UI (only allowed on non-mandatory fields)
          is_required_override?: boolean;// Can make optional fields required, never required fields optional
          sort_order: number;
        }
      ];
    }
  ];
}
```

### 47.2 Immutable Core System Fields (Non-Removable Guardrails)
The layout engine enforces that the following fields **cannot be hidden or made optional**:
* **`Truck`**: `truck_no`, compliance document files & expiries (`fitness`, `insurance`, `tax`, `puc`).
* **`Driver`**: `name`, `phone`, `license_number`, `aadhaar_number`.
* **`TruckJourney`**: `truck_id`, `driver_id`, `from_location`, `to_location`, `start_date`, `status`.
* **`Entry` (LR / Bill)**: `lr_no`, `billing_party_id`, `consignor_name`, `consignee_name`, `freight_amount`.

---

## 48. Configurable Multi-Step Approval Workflows

Provides workflow governance for transport operations to prevent unvetted dispatches, unauthorized driver cash payouts, or unverified invoices.

```
                     ┌─────────────────────────────┐
                     │   Journey Created (Draft)   │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │ Requires Dispatch Approval? │
                     └──────┬───────────────┬──────┘
                       Yes  │               │ No
        ┌───────────────────┘               └───────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐                       ┌───────────────┐
│     PENDING_APPROVAL          │                       │  DISPATCHED   │
│  (Dispatcher / Ops Manager)   │                       │   (Active)    │
└───────┬───────────────┬───────┘                       └───────────────┘
        │ Approved      │ Rejected
        ▼               ▼
┌───────────────┐ ┌───────────────┐
│  DISPATCHED   │ │   REJECTED    │
│   (Active)    │ │(Needs Revision│
└───────────────┘ └───────────────┘
```

### 48.1 `WorkflowDefinition` Schema
```typescript
interface IWorkflowDefinition {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  workflow_type: 'TRIP_DISPATCH' | 'EXPENSE_REIMBURSEMENT' | 'INVOICE_ISSUANCE' | 'DRIVER_SETTLEMENT';
  is_enabled: boolean;
  rules: {
    trigger_condition: 'ALWAYS' | 'THRESHOLD_AMOUNT';
    threshold_amount?: number;          // e.g., Expenses > ₹5,000 require approval
  };
  approval_steps: [
    {
      step_number: number;
      step_name: string;                // e.g., "Branch Manager Sign-Off"
      approver_role: 'admin' | 'dispatcher' | 'accountant';
      action_on_rejection: 'RETURN_TO_DRAFT' | 'CANCEL';
    }
  ];
}
```

### 48.2 Workflow Instance Tracking on Operational Records
Operational documents embed workflow approval status:
```typescript
interface IWorkflowState {
  approval_status: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  current_step: number;
  history: [
    {
      step_name: string;
      action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
      actor_id: mongoose.Types.ObjectId;
      actor_name: string;
      comments?: string;
      timestamp: Date;
    }
  ];
}
```

---

## 49. Dynamic Frontend Form Engine & Backend Validation Pipeline

### 49.1 Backend Dynamic Schema Synthesizer
When receiving an entity creation/update request, the backend fetches the company's active `CustomFieldDefinition` records and synthesizes a strict validation schema on-the-fly:

```typescript
// services/customFieldValidator.ts
import { z } from 'zod';

export async function buildDynamicEntityValidator(companyId: string, entityType: string) {
  const definitions = await CustomFieldDefinition.find({
    company_id: companyId,
    entity_type: entityType,
    is_archived: false
  });

  const customFieldShape: Record<string, z.ZodTypeAny> = {};

  for (const def of definitions) {
    let fieldValidator: z.ZodTypeAny;

    switch (def.field_type) {
      case 'text':
        fieldValidator = z.string();
        if (def.validation_rules?.min_length) fieldValidator = (fieldValidator as z.ZodString).min(def.validation_rules.min_length);
        if (def.validation_rules?.max_length) fieldValidator = (fieldValidator as z.ZodString).max(def.validation_rules.max_length);
        if (def.validation_rules?.regex_pattern) {
          fieldValidator = (fieldValidator as z.ZodString).regex(
            new RegExp(def.validation_rules.regex_pattern),
            def.validation_rules.regex_error_message || 'Invalid format'
          );
        }
        break;
      case 'number':
        fieldValidator = z.number();
        if (def.validation_rules?.min_value !== undefined) fieldValidator = (fieldValidator as z.ZodNumber).min(def.validation_rules.min_value);
        if (def.validation_rules?.max_value !== undefined) fieldValidator = (fieldValidator as z.ZodNumber).max(def.validation_rules.max_value);
        break;
      case 'date':
        fieldValidator = z.coerce.date();
        break;
      case 'boolean':
        fieldValidator = z.boolean();
        break;
      case 'dropdown':
        const allowedValues = (def.options || []).map(o => o.value);
        fieldValidator = z.enum(allowedValues as [string, ...string[]]);
        break;
      default:
        fieldValidator = z.any();
    }

    if (!def.is_required) {
      fieldValidator = fieldValidator.optional().nullable();
    }

    customFieldShape[def.field_key] = fieldValidator;
  }

  return z.object({
    // Standard schema validation is merged here...
    custom_fields: z.object(customFieldShape).strict() // .strict() automatically rejects unregistered injected fields!
  });
}
```

### 49.2 Frontend `<DynamicFieldRenderer>` Component
A generic React component rendering the appropriate input based on the field definition:
```tsx
// components/custom/DynamicFieldRenderer.tsx
export const DynamicFieldRenderer: React.FC<{
  fieldDef: ICustomFieldDefinition;
  value: any;
  onChange: (val: any) => void;
  error?: string;
  disabled?: boolean;
}> = ({ fieldDef, value, onChange, error, disabled }) => {
  const isReadOnly = disabled || fieldDef.editability === 'admin_only';

  return (
    <div className="form-group">
      <label className="form-label">
        {fieldDef.display_label}
        {fieldDef.is_required && <span className="text-danger">*</span>}
      </label>

      {fieldDef.field_type === 'text' && (
        <input
          type="text"
          className="form-input"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={isReadOnly}
        />
      )}

      {fieldDef.field_type === 'number' && (
        <input
          type="number"
          className="form-input"
          value={value ?? ''}
          onChange={e => onChange(Number(e.target.value))}
          disabled={isReadOnly}
        />
      )}

      {fieldDef.field_type === 'dropdown' && (
        <select
          className="form-select"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={isReadOnly}
        >
          <option value="">Select {fieldDef.display_label}</option>
          {fieldDef.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {fieldDef.field_type === 'boolean' && (
        <input
          type="checkbox"
          className="form-checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          disabled={isReadOnly}
        />
      )}

      {error && <span className="form-error">{error}</span>}
    </div>
  );
};
```

---

## 50. Admin Configuration Studio & Data Integrity Safeguards

Under `/settings/customization`:

### 50.1 Custom Field Studio Experience
* **Entity Selector Tabs**: Trucks | Drivers | Trips | Shippers | Invoices.
* **Active Field Roster**: Table showing field labels, data types, required status, and usage metrics (e.g., *"Populated across 142 records"*).
* **Drag-and-Drop Form Builder**: Allows administrators to arrange fields in logical order and configure custom section headers.
* **New Field Modal**: Wizard with real-time validation preview and regex tester.

### 50.2 Data Integrity Safeguards & Deprecation Lifecycle
To avoid corrupting existing database records when administrators modify configurations:
1. **Immutable `field_key`**: Once created, a field's machine key can never be renamed.
2. **Type-Locking**: Changing a field's data type (e.g., changing `number` to `dropdown`) is **prohibited** if existing records contain values.
3. **Soft-Deprecation (Archive)**:
   - Administrators cannot hard-delete fields with active records.
   - Deleting a field marks `is_archived: true`.
   - Archived fields disappear from new creation forms, but remain visible in historical records and exports.
4. **Impact Warning Dialog**:
   ```
   ┌─────────────────────────────────────────────────────────────┐
   │ ⚠️ Archive Custom Field: "FASTag Barcode Number"            │
   ├─────────────────────────────────────────────────────────────┤
   │ This field contains stored data across 328 Truck records.    │
   │                                                             │
   │ Archiving this field will:                                  │
   │  ✓ Hide this field from New Truck creation forms.           │
   │  ✓ Preserve existing barcode values on all 328 trucks.       │
   │  ✓ Keep data accessible in Excel exports and audit logs.     │
   │                                                             │
   │ [ Cancel ]                                [ Confirm Archive] │
   └─────────────────────────────────────────────────────────────┘
   ```

---

## 51. Migration, Backward Compatibility & Verification Matrix

### 51.1 Zero-Downtime Migration for Existing Data
1. **Schema Non-Invasiveness**: Existing collections (`Truck`, `Driver`, `TruckJourney`, `Entry`) simply have `custom_fields: { type: Map, default: {} }` added to their schemas.
2. **Backward Compatibility**: Existing records require zero backfill. If `custom_fields` is empty or undefined, the document behaves exactly as before.
3. **Default Company Settings**: A database seed script creates default `CompanySettings` records for all existing companies with standard Indian formats (`DD/MM/YYYY`, `INR`, Indian number grouping).

### 51.2 Incremental Test Verification Matrix
| Test Scenario | Action Tested | Expected Outcome |
| :--- | :--- | :--- |
| **Custom Field Validation** | Company defines required `gps_imei` (15 digits); user submits 12 digits | Backend rejects with `400 Bad Request: gps_imei must match regex ^[0-9]{15}$`. |
| **Unregistered Field Injection**| Malicious client submits `custom_fields: { hack_field: true }` | Zod `.strict()` automatically strips or rejects `hack_field`; database remains clean. |
| **Core Field Guardrail** | Administrator attempts to hide `truck_no` via Form Layout API | Backend validator returns `422 Unprocessable: Cannot hide mandatory system field 'truck_no'`. |
| **Cross-Tenant Custom Field Leak**| Company 1 requests custom field definitions using valid session | Server returns only records matching `req.tenant.id`; zero visibility of Company 2's custom definitions. |
| **Workflow Step Approval** | User dispatches trip requiring Manager approval | Trip status transitions to `PENDING_APPROVAL`; truck status changes to reserved; dispatch locked until manager approves. |
| **Field Deprecation Read-Only** | Admin archives `fastag_barcode`; user views truck detail page | Field renders in read-only section; field is omitted from "Edit Truck" input form. |

---

*This specification establishes a robust, enterprise-grade dynamic customization engine, providing deep flexibility per transport company while maintaining complete codebase unification, type safety, and database integrity.*

---

# PART VI: FLEXIBLE PRICING, PACKAGING, BILLING & METERING SYSTEM SPECIFICATION

**Role:** Senior SaaS Commercial & Systems Architect  
**Objective:** Engineer a dynamic, 100% database-driven pricing, packaging, and billing engine capable of serving small owner-operators (1–5 trucks), mid-sized regional transport fleets (6–35 trucks), and complex enterprise logistics enterprises (36+ trucks) with automated subscription lifecycles, mathematical proration, coupons, GST compliance, and usage metering—without deploying code for pricing changes.

---

## 52. Commercial Architecture & Core Packaging Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUPER-ADMIN DYNAMIC CATALOG CONTROL                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌────────────────────┐  │
│  │   Dynamic Base Plans      │  │  Monetized Paid Add-Ons   │  │ Promotional Codes  │  │
│  │  (Starter, Standard, Pro, │  │ (WhatsApp, GPS, Fleet IQ, │  │ (Coupons, % or Fix,│  │
│  │   Custom Enterprise)      │  │  Maintenance, Tally Sync) │  │  Usage Caps)       │  │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────────┬─────────┘  │
│                │                              │                           │            │
│                ▼                              ▼                           ▼            │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         PRORATION & BILLING ENGINE                               │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │  - Mathematical Second-by-Second Credit & Charge Calculations                   │  │
│  │  - Grandfathered Price Locking (Existing subscribers retain agreed price)        │  │
│  │  - Indian GST Compliance (18% SAC 998313, CGST/SGST/IGST B2B Invoices)           │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│                                         ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     TENANT WORKSPACE SUBSCRIPTION & METERING                     │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │  1. Company Entitlement Layer: Subscription unlocks module for the company       │  │
│  │  2. Employee RBAC Layer: Internal roles govern which employees can access it     │  │
│  │  3. Real-Time Quota Monitors: Trucks (N/Max), Users (N/Max), Storage (MB/Max)    │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 52.1 Separation of Entitlements vs. User Permissions
* **Company Entitlement (Commercial Layer):** When a company subscribes to the Standard plan or purchases the "Financial Ledger" add-on, the *workspace* is entitled to execute ledger operations.
* **Employee RBAC (Security Layer):** Purchasing the module does **not** grant every employee access. A Dispatcher or Driver in that company remains locked out of the ledger via their individual RBAC role. Only users assigned the `admin` or `accountant` roles can interact with it.

### 52.2 Grandfathering & Price Protection Principle
When a super-admin modifies plan pricing, alters quotas, or retires an older plan:
* **Existing Subscribers are Protected:** The active subscription retains its original `locked_unit_price` and terms indefinitely.
* **Explicit Migration Only:** Existing subscribers only move to new pricing if they voluntarily upgrade, change billing interval, or an administrator initiates a grandfathered price migration.

---

## 53. Comprehensive Pricing Data Models & Schema Design

All plan names, tier limits, prices, discounts, and quotas are dynamic MongoDB documents. No monetary figures or package names exist in frontend code.

### 53.1 `Plan` Model (Dynamic Plan Catalog)
```typescript
interface IPlan {
  _id: mongoose.Types.ObjectId;
  code: string;                          // Unique machine slug: "starter", "standard", "pro", "enterprise_custom"
  name: string;                          // Display name: "Standard Fleet Operator"
  badge_text?: string;                   // e.g., "Most Popular", "Best Value"
  description: string;
  is_active: boolean;                    // Available for new signups
  is_public: boolean;                    // Visible on public pricing page (false for bespoke enterprise)
  sort_order: number;
  
  // Pricing Options
  pricing: [
    {
      interval: 'monthly' | 'yearly';
      unit_amount: number;               // In paise: ₹2,499.00 = 249900; ₹24,990.00 = 2499000
      currency: string;                  // "INR"
      discount_percentage: number;       // e.g., 16.6% for annual upfront
      gateway_plan_id: string;           // Razorpay / Stripe plan ID
    }
  ];

  // Base Included Modules (Catalog Keys from Section 37)
  included_modules: string[];            // e.g., ["MOD_FLEET", "MOD_DRIVERS", "MOD_TRIPS", "MOD_LR_ENGINE", "MOD_BILLING_INVOICE", "MOD_SETTLEMENTS", "MOD_LEDGERS"]

  // Base Resource Quotas
  quotas: {
    max_trucks: number;                  // e.g., 15
    max_users: number;                   // e.g., 5
    max_storage_mb: number;              // e.g., 5120 (5 GB)
    monthly_whatsapp_allowance: number;  // e.g., 200 included messages
  };

  trial_days: number;                    // Default 14 days
  created_at: Date;
  updated_at: Date;
}
```

### 53.2 `AddOn` Model (Optional Monetized Modules & Capacity Boosters)
```typescript
interface IAddOn {
  _id: mongoose.Types.ObjectId;
  code: string;                          // "addon_whatsapp_1000", "addon_fleet_iq", "addon_gps_sync"
  name: string;                          // "WhatsApp Automation Suite (1,000 msgs/mo)"
  description: string;
  category: 'Feature' | 'Capacity';     // 'Feature' unlocks module; 'Capacity' increases quotas
  is_active: boolean;
  
  pricing: [
    {
      interval: 'monthly' | 'yearly';
      unit_amount: number;               // e.g., 129900 (₹1,299/mo)
      currency: string;
      gateway_addon_id: string;
    }
  ];

  // Feature unlocked
  module_flag?: string;                  // e.g., "MOD_WHATSAPP"

  // Capacity boost
  quota_boosts?: {
    extra_trucks?: number;               // e.g., +5 trucks pack
    extra_users?: number;                // e.g., +2 user seats pack
    extra_storage_mb?: number;           // e.g., +10240 MB pack
    extra_whatsapp_msgs?: number;        // e.g., +1000 msgs pack
  };
}
```

### 53.3 `Subscription` Model (Company Subscription Record)
```typescript
interface ISubscription {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  plan_id: mongoose.Types.ObjectId;
  
  // Status State Machine
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  billing_interval: 'monthly' | 'yearly';
  
  // Grandfathered Price Snapshot
  locked_pricing: {
    plan_unit_amount: number;            // Exact amount charged at signup/upgrade
    currency: string;
    agreed_at: Date;
  };

  // Active Add-ons
  active_addons: [
    {
      addon_id: mongoose.Types.ObjectId;
      quantity: number;
      locked_unit_amount: number;
      activated_at: Date;
    }
  ];

  // Active Promo Code
  applied_promo?: {
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    expires_at?: Date;
  };

  // Dates & Cycles
  trial_started_at: Date;
  trial_ends_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancelled_at?: Date;
  cancel_at_period_end: boolean;

  // Scheduled Downgrades
  scheduled_change?: {
    target_plan_id: mongoose.Types.ObjectId;
    effective_date: Date;                // Executed upon current_period_end
  };

  // Payment Gateway
  payment_gateway: 'razorpay' | 'stripe' | 'manual_invoice';
  gateway_customer_id?: string;
  gateway_subscription_id?: string;

  // Cached Computed Totals (for real-time middleware validation)
  computed_modules: string[];
  computed_quotas: {
    max_trucks: number;
    max_users: number;
    max_storage_mb: number;
    monthly_whatsapp_quota: number;
  };

  created_at: Date;
  updated_at: Date;
}
```

### 53.4 `PromoCode` Model (Discounts & Promotional Engine)
```typescript
interface IPromoCode {
  _id: mongoose.Types.ObjectId;
  code: string;                          // e.g., "FREIGHT2026", "LAUNCH50"
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;                // 20 = 20% off; 50000 = ₹500 off
  currency: string;                      // "INR"
  duration: 'once' | 'forever' | 'repeating'; // 'repeating' = lasts X months
  duration_in_months?: number;
  max_redemptions?: number;
  times_redeemed: number;
  applies_to_plans: mongoose.Types.ObjectId[]; // Empty = all plans
  valid_from: Date;
  valid_until: Date;
  is_active: boolean;
}
```

### 53.5 `SubscriptionInvoice` Model (GST Tax Receipts)
```typescript
interface ISubscriptionInvoice {
  _id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  subscription_id: mongoose.Types.ObjectId;
  invoice_number: string;                // e.g., "SUB-INV-26-00412"
  billing_period_start: Date;
  billing_period_end: Date;

  // Line items
  line_items: [
    {
      description: string;               // e.g., "Standard Plan (1 Month)", "Prorated Credit"
      unit_amount: number;
      quantity: number;
      total_amount: number;
    }
  ];

  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  
  // GST Tax Split (18% for SaaS in India - SAC 998313)
  tax_details: {
    sac_code: string;                    // "998313"
    gst_rate: number;                    // 18.0
    cgst_amount: number;                 // 9% (if intra-state)
    sgst_amount: number;                 // 9% (if intra-state)
    igst_amount: number;                 // 18% (if inter-state)
    buyer_gstin?: string;
  };

  total_amount: number;                  // Grand total paid
  status: 'paid' | 'open' | 'failed' | 'void';
  payment_method: 'card' | 'upi' | 'netbanking' | 'bank_transfer';
  gateway_payment_id?: string;
  paid_at?: Date;
  pdf_download_url?: string;
  created_at: Date;
}
```

---

## 54. Subscription Lifecycle State Machine & Dunning Engine

```
                       ┌─────────────────────────┐
                       │    Trialing (14 Days)   │
                       └────────────┬────────────┘
         Checkout Success   │            │ Trial Expiration
        ┌───────────────────┘            └───────────────────┐
        ▼                                                    ▼
┌───────────────┐  Renewal Payment Failed  ┌─────────────────┐ 7-Day Grace ┌───────────────┐
│    ACTIVE     │ ───────────────────────► │    PAST_DUE     │ ──────────► │   SUSPENDED   │
└───────┬───────┘                          │  (Grace Period) │  Exhausted  │  (Read-Only)  │
        │                                  └────────┬────────┘             └───────┬───────┘
        │ User Cancels Auto-Renew                   │ Payment Cleared              │
        ▼                                           └──────────────────────────────┘
┌─────────────────────────┐                                 Payment Cleared
│  CANCEL_AT_PERIOD_END   │ ──► Transitions to SUSPENDED at current_period_end
└─────────────────────────┘
```

### 54.1 Automated Dunning & Retry Schedule (Failed Payments)
When an automatic renewal payment fails:
* **Day 0 (Failure Event):** Webhook `invoice.payment_failed` arrives.
  - State moves to `PAST_DUE`.
  - Operations continue uninterrupted.
  - System triggers email & WhatsApp notification to Company Admin: *"Payment of ₹2,499 failed. Your account enters a 7-day grace period."*
* **Day 3 (First Retry):** Gateway automatically retries debit. If failed, top persistent amber alert bar renders on all dashboard screens with an immediate "Update Card / Pay via UPI" button.
* **Day 5 (Second Retry):** Gateway retries debit. Warning email sent to Company Owner.
* **Day 7 (Grace Period Cut-Off):** Final retry fails.
  - State moves automatically to `SUSPENDED`.
  - **Graceful Read-Only Degradation:** All existing records remain viewable and exportable. Any attempt to create a journey, bill entry, or settlement triggers an upgrade/payment modal.
* **Recovery:** The moment the invoice is paid via any payment method, a webhook restores status to `ACTIVE` and unlocks full write operations immediately.

---

## 55. Plan Upgrades, Downgrades & Mathematical Proration

Mid-cycle changes are calculated using authoritative, second-by-second proration math:

### 55.1 Mathematical Proration Formula
Given a billing cycle of duration $T_{\text{total}}$ seconds with $T_{\text{remaining}}$ seconds left:

1. **Calculate Unused Credit from Current Plan:**
   $$\text{Credit}_{\text{unused}} = \text{Current Plan Price} \times \left( \frac{T_{\text{remaining}}}{T_{\text{total}}} \right)$$

2. **Calculate Prorated Cost of New Plan:**
   $$\text{Charge}_{\text{new}} = \text{New Plan Price} \times \left( \frac{T_{\text{remaining}}}{T_{\text{total}}} \right)$$

3. **Net Amount Payable Immediately:**
   $$\text{Net Due} = \max\left(0, \left(\text{Charge}_{\text{new}} - \text{Credit}_{\text{unused}} - \text{Discount}_{\text{promo}}\right)\right)$$

### 55.2 Immediate Upgrades vs. End-of-Cycle Downgrades
* **Upgrades (e.g., Starter $\rightarrow$ Standard):**
  - Executed **immediately**.
  - Customer pays the net prorated difference at checkout.
  - New quotas (e.g., truck limit increases from 5 to 15) and newly unlocked modules (e.g., Driver Settlements) activate instantly.
* **Downgrades (e.g., Pro $\rightarrow$ Standard):**
  - Executed **at the end of the current billing period** (`scheduled_change`).
  - *Reason:* Prevents catastrophic data locks mid-month. If a company currently has 28 active trucks and downgrades to a 15-truck plan, forcing an immediate downgrade would leave 13 trucks in an illegal state. The end-of-period schedule gives the fleet operator time to archive or retire excess vehicles.
  - If excess trucks remain when the downgrade takes effect, the workspace enters a quota-locked state: existing trucks operate normally, but creating new trucks is blocked until active trucks are under 15.

---

## 56. Discounts, Coupons & Promotional Engine

### 56.1 Coupon Validation Pipeline
```typescript
// services/promoService.ts
export async function validateAndApplyCoupon(
  code: string,
  companyId: string,
  targetPlanId: string,
  baseAmount: number
): Promise<{ valid: boolean; discountAmount: number; error?: string }> {
  const promo = await PromoCode.findOne({ code: code.toUpperCase(), is_active: true });

  if (!promo) return { valid: false, discountAmount: 0, error: 'Invalid coupon code.' };
  if (new Date() > promo.valid_until) return { valid: false, discountAmount: 0, error: 'Coupon code has expired.' };
  if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
    return { valid: false, discountAmount: 0, error: 'Coupon usage limit reached.' };
  }
  if (promo.applies_to_plans.length > 0 && !promo.applies_to_plans.includes(targetPlanId)) {
    return { valid: false, discountAmount: 0, error: 'Coupon does not apply to this plan.' };
  }

  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = Math.round((baseAmount * promo.discount_value) / 100);
  } else {
    discount = promo.discount_value;
  }

  return { valid: true, discountAmount: Math.min(discount, baseAmount) };
}
```

---

## 57. Indian B2B SaaS Tax & Statutory Compliance (GST SAC 998313)

### 57.1 Statutory Invoicing Requirements
All subscription charges for Indian transport companies adhere to GST regulations:
* **SAC Code:** `998313` (Information technology software services).
* **Tax Rate:** 18% standard rate.
* **State of Supply Logic:**
  - If Company GSTIN state code matches SaaS Platform state code $\rightarrow$ **CGST 9% + SGST 9%**.
  - If Company GSTIN state code differs from SaaS Platform state code $\rightarrow$ **IGST 18%**.
  - If Company is unregistered (no GSTIN) $\rightarrow$ Treat as B2C with standard IGST or CGST/SGST based on address.
* **Invoice Numbering:** Sequential statutory fiscal format (`SUB-INV-26-0001`) with platform GSTIN and company GSTIN prominently displayed on PDF receipts for input tax credit (ITC) claims.

---

## 58. Super-Admin Plan Studio & Custom Enterprise Deals

Platform operators configure pricing via `/super-admin/pricing`:

### 58.1 Super-Admin Capabilities
1. **Dynamic Catalog Studio**:
   - Create new plans or add-ons with visual sliders for truck caps, user limits, and module checkboxes.
   - Set monthly and annual pricing with instant discount calculations.
   - Changes publish immediately to the public pricing page without deploying code.
2. **Retire / Grandfather Plans**:
   - Marking a plan `is_active: false` archives it from new customer signups.
   - All existing subscribers on that plan continue renewing at their agreed rate.
3. **Custom Enterprise Plan Generator**:
   - Create tailored contracts: e.g., *"Adani Logistics Custom Plan - 250 Trucks, 50 Users, Custom E-Way Sync, ₹35,000/mo billed annually"*.
   - Generates a private checkout link or manual bank wire invoice contract.

---

## 59. Real-Time Usage Metering & Quota Reporting

The tenant dashboard under `/settings/subscription` displays real-time meters and proactive capacity warnings:

### 59.1 Live Quota Monitoring API
`GET /api/subscription/usage` returns real-time aggregated metrics:
```json
{
  "plan": { "code": "standard", "name": "Standard Fleet Operator" },
  "status": "active",
  "billing_cycle": { "renews_at": "2026-11-01T00:00:00Z", "interval": "monthly" },
  "meters": {
    "trucks": { "used": 12, "limit": 15, "percent": 80.0, "status": "normal" },
    "users": { "used": 4, "limit": 5, "percent": 80.0, "status": "normal" },
    "storage": { "used_mb": 3410, "limit_mb": 5120, "percent": 66.6, "status": "normal" },
    "whatsapp": { "used": 182, "limit": 200, "percent": 91.0, "status": "near_limit" }
  }
}
```

### 59.2 Automated Threshold Warnings
* **80% Quota Consumed:** Yellow status indicator on the meter bar.
* **95% Quota Consumed:** Amber alert banner recommending an add-on capacity booster (e.g., *"+5 Trucks Pack for ₹499/mo"*).
* **100% Quota Consumed:** Creation buttons for that resource trigger an upgrade modal with one-click Razorpay payment.

---

## 60. Verification, Billing Idempotency & Test Matrix

### 60.1 Incremental Test Verification Matrix
| Test Scenario | Action Tested | Expected Behavioral Outcome |
| :--- | :--- | :--- |
| **Mid-Cycle Upgrade** | Standard (₹2,499) upgrades to Pro (₹4,999) with 15 days remaining in month | System credits ₹1,249.50 unused Standard, charges ₹2,499.50 prorated Pro; net due ₹1,250.00; quotas upgrade immediately upon payment. |
| **End-of-Cycle Downgrade** | Pro subscriber downgrades to Standard | Change schedules for end of period; Pro features and 35-truck quota remain active until `current_period_end`. |
| **Grandfathered Price Preservation**| Admin raises Standard plan from ₹2,499 to ₹2,999 | Existing subscribers continue auto-renewing at ₹2,499; new subscribers charged ₹2,999. |
| **Coupon Code Redemption**| User applies `LAUNCH50` (50% off) at checkout | Invoice reflects 50% discount on taxable amount; coupon redemption counter increments; usage cap enforced. |
| **Dunning & Grace Degradation**| Renewal charge fails on day 0 | State transitions to `PAST_DUE`; write operations continue for 7 days; on day 8, workspace transitions to read-only `SUSPENDED`. |
| **Webhook Replay Idempotency**| Razorpay delivers `subscription.charged` webhook twice with identical event ID | `ProcessedWebhook` catches duplicate; second execution returns `200 OK` without creating duplicate invoice or extending cycle twice. |

---

*This specification completes the commercial monetization, dynamic pricing, and automated subscription lifecycle architecture for the TransportManagement SaaS platform.*

---

## 61. Missing Requirements & Launch-Readiness Gap Register

This section supplements, rather than replaces, the code-derived inventory above. Items here are recommended target-state requirements unless their implementation is explicitly verified.

| Area | Gap / decision to resolve | Priority | Acceptance evidence |
|---|---|---:|---|
| Tenant lifecycle | Company creation, verification, owner assignment, invitation, suspension and closure are not proven end-to-end | P0 | Lifecycle tests from signup through closure |
| Tenant isolation | Every tenant-owned model/query/file/export/job must be scoped by server-derived `company_id` | P0 | Automated cross-tenant negative tests |
| Authorization | Define role/permission matrix and enforce at API/service layer | P0 | Permission tests for every protected route |
| Subscription entitlements | Ensure plan, add-on, manual grant, trial and suspension precedence is explicit | P0 | Matrix tests for entitlement combinations |
| Billing correctness | Define payment provider, webhook events, retries, refund handling, invoice states and reconciliation | P0 | Verified webhook and duplicate-event tests |
| Financial correctness | Confirm settlement, party balance, ledger, tax and profitability formulas with worked examples | P0 | Approved examples + automated calculation tests |
| Backup/restore | Define backup frequency, retention, recovery point/time objectives and perform restore drills | P0 | Dated restore-test evidence |
| Secrets and environments | Separate local/test/staging/production secrets; document rotation and least privilege | P0 | Secret scan and deployment checklist |
| Error monitoring | Centralized backend/frontend error reporting, correlation/request IDs and alert ownership | P0 | Simulated failure generates actionable alert |
| Data privacy | Define access, masking, retention, export and deletion for Aadhaar/licence, contact and financial data | P0 | Privacy/access review and deletion tests |
| File security | Validate file type/size, scan where practical, authorize signed URL issuance, expire URLs, prevent public bucket access | P0 | Upload abuse and cross-tenant file tests |
| Password recovery | Deliver reset tokens securely by configured email provider; avoid exposing account existence | P0 | End-to-end email/reset test |
| Account security | Verify email, session expiry/revocation, secure cookie settings, CSRF strategy, login throttling and optional MFA | P0/P1 | Security test checklist |
| Audit coverage | Cover all critical financial, subscription, permission, document and status mutations | P0 | Audit assertions for every critical workflow |
| Concurrency | Prevent duplicate settlements, duplicate invoices and conflicting updates; use transactions where supported | P0 | Concurrent request and retry tests |
| Data integrity | Add unique/index constraints, referential validation and safe archival/restore rules | P0 | Migration and integrity tests |
| Operational workflow | Define trip status transitions, cancellation, reopening, reassignment and correction policies | P1 | State-transition tests |
| Maintenance | Define service intervals, odometer rules, work orders, cost history and reminder windows | P1 | Example maintenance lifecycle test |
| Customer receivables | Define partial receipts, advances, credit notes, overdue aging and allocations | P1 | Reconciled sample statement |
| Accounting | Define opening balances, debit/credit sign conventions, reversals, period closing and bank/cash reconciliation | P1 | Approved accounting examples |
| Notifications | Delivery logs, retry/backoff, failure queue, opt-in, templates and per-company configuration | P1 | Failed-provider test and retry evidence |
| Public tracking | Dedicated route, safe milestone model, token/guessing protection and minimal public data | P1 | Public privacy test |
| Search/list scalability | Server-side pagination, sorting, filtering, indexes and bounded exports | P1 | Performance test with representative data |
| Import/export | Validated CSV/XLSX import, error report, deduplication and exports respecting permissions/filters | P1 | Import/export acceptance tests |
| Customer support | Help/onboarding, support contact/ticket path, account recovery and incident communication | P1 | Documented support workflow |
| Accessibility | Keyboard navigation, labels, contrast, focus states, accessible errors and responsive layouts | P1 | Accessibility checklist/manual review |
| Localization | Consistent timezone, date, number, currency and language policy | P1 | Tests around timezone/date boundaries |
| Product analytics | Privacy-conscious adoption and usage metrics for onboarding, support and product decisions | P2 | Documented events and retention policy |
| Integrations | Versioned integration contracts, credentials, retry policy, health status and disconnect behavior | P1/P2 | Integration contract tests |
| Release process | CI checks, migrations, rollback plan, staging smoke tests and release notes | P0 | Rehearsed deployment/rollback |
| Legal/commercial | Review SaaS terms, privacy notice, data processing, cancellation/refund and billing disclosures | P0 | Qualified review and approved documents |
| Pricing/tax | Validate Indian GST/SAC treatment, invoice fields, tax place-of-supply and accounting with a qualified advisor | P0 | Written confirmation before charging customers |

### 61.1 Priorities

- **P0 — launch blocker:** security, tenant isolation, financial integrity, billing correctness, backup/restore, critical legal/commercial decisions.
- **P1 — required for dependable operations:** workflows, support, notifications, scalable lists, imports/exports, accessibility and maintenance.
- **P2 — expansion:** advanced analytics, richer integrations and product analytics.

---

## 62. Complete Feature Catalogue & Recommended Module Boundaries

This is the concise product-level summary. It is a planning catalogue, not a claim that all features are currently implemented.

### 62.1 Platform core — all paying tenants

- Company workspace and company profile.
- Authentication, secure recovery, sessions and membership.
- Roles and permissions.
- Trucks, drivers, customers/parties and document storage.
- Journeys/trips, route, status, fuel, expenses and delivery records.
- Search, filters, pagination and essential dashboards.
- Activity/audit history for sensitive actions.
- Notifications and user preferences.
- Subscription page, current plan, renewal status and usage meters.
- Data export and account support.

### 62.2 Fleet operations module

- Truck registry, registration and vehicle details.
- Driver assignment history.
- Insurance, fitness, permits, tax and pollution document tracking.
- Service schedule, odometer, maintenance work orders and repair costs.
- Availability/status, downtime and vehicle utilization.
- Driver credentials and expiry reminders.
- Optional GPS/live tracking integration; never imply GPS is available without a connected provider/device.

### 62.3 Trip and dispatch module

- Trip planning and assignment.
- Pickup/delivery, origin/destination, route checkpoints and milestones.
- Starting/ending odometer, distance and load details.
- Driver advances, fuel/diesel, tolls, allowances and trip expenses.
- Delays, incidents, notes, attachments and proof of delivery.
- Trip completion, cancellation, correction and reassignment policies.
- Customer payment status, due dates, receipts and reconciliation.
- Trip profitability based on documented and approved formulas.

### 62.4 Billing, LR and customer module

- Customer/billing-party and vendor directory.
- LR/GR generation, copy, numbering and secure lookup.
- Consignment details, goods, weight, packages, invoice/e-way references.
- Charges, discounts, advances, tax calculations and invoice PDFs.
- Partial payments, credit notes/refunds if supported by the accounting model.
- Customer statements, receivables/payables aging and payment allocation.
- Document templates and company identity settings.
- Tax rules must be configurable and validated for the actual transaction; do not hardcode one rate or tax treatment into every invoice.

### 62.5 Finance and settlements module

- Driver advances and settlement preview/finalization.
- Expense and income ledger with debit/credit convention.
- Cash, bank, UPI and cheque/payment references where applicable.
- Party balances, receipts and payments.
- Reversals instead of destructive edits to finalized accounting records.
- Period/date filters, account statements and exports.
- Cash/bank reconciliation and audit history.
- Approved formulas for balances, settlement directions, diesel variance and trip profitability.
- Financial records must use decimal-safe monetary representations and server-authoritative calculations.

### 62.6 Reporting and analytics module

- Operational dashboard and overdue worklists.
- Fleet utilization and downtime.
- Maintenance and compliance expiry.
- Revenue, expenses and profit by trip, truck, driver and customer.
- Fuel efficiency and fuel cost per distance unit.
- Driver advances and settlement aging.
- Receivables/payables aging and cash/bank summary.
- Exportable reports that reflect applied filters and authorized data scope.
- Report definitions must state date ranges, units, timezone and calculation formula.

### 62.7 SaaS platform and commercial module

- Public pricing page and plan comparison.
- Company signup/onboarding and verification.
- Plans, add-ons, coupons and custom enterprise contracts.
- Trials, billing cycles, payment methods and subscription invoices.
- Renewal, failed payment, grace period, cancellation, suspension and reactivation.
- Company-level entitlements and dependency rules.
- User/truck/storage/API/notification quotas where commercially needed.
- Platform-owner super-admin with audited access.
- Usage meters, threshold warnings and upgrade/downgrade workflows.
- Payment gateway webhooks with signature verification, idempotency and reconciliation.
- Data export and clear post-cancellation retention policy.

### 62.8 Customization module

- Company settings and supported defaults.
- Custom fields with type-safe validation.
- Configurable labels, form sections and field order.
- Approval workflows for selected business processes.
- Feature-specific configuration.
- Versioned configurations, change history, rollback or safe disable.
- Configuration cannot bypass security, accounting invariants or required platform controls.

### 62.9 Shared platform services

- Email/WhatsApp/SMS notifications with delivery tracking and retries.
- Secure uploads, signed URLs, retention and deletion rules.
- PDF generation, printing and exports.
- Global search with tenant-scoped results.
- Background jobs and scheduled reminders.
- Audit events, logs, metrics, error reporting and health checks.
- Backup, restore, migrations, deployment and incident runbooks.
- Accessibility, responsive design, consistent validation and empty/loading/error states.

---

## 63. Decisions Required Before Building the Commercial Product

Do not let an AI coding agent invent these business rules. Record an explicit decision for each item.

| Decision | Required answer |
|---|---|
| Initial target segment | Small owner-operators, fleet owners, transport brokers, logistics firms, or a defined combination |
| Initial geography | India-only at launch or multiple countries |
| Product name and tenant URL model | Shared domain/workspace path, subdomain, or custom domain later |
| Billing provider | Select the initial provider; do not implement two gateways without a clear requirement |
| Subscription collection | Automatic recurring charge, manual monthly payment, or both |
| Grace policy | Exact read/write behavior after payment failure and subscription expiry |
| Trial policy | Duration, payment method requirement and trial-to-paid conversion |
| Plan limits | Trucks, users, storage, API requests and optional messaging usage |
| Module packaging | Which modules are included in each launch plan |
| Customization | Which fields/forms/workflows are customer-configurable |
| Accounting scope | Operational bookkeeping only or full accounting/tax compliance |
| Tax policy | Confirm applicable GST, invoicing and place-of-supply rules with a qualified advisor |
| Settlement formula | Worked examples for all payment directions, advances, fuel variance and rounding |
| Party balance formula | Opening balance, charges, receipts, adjustments and closing balance examples |
| Document retention | Retention period, archival, export and deletion rules |
| Support commitments | Support channel, response expectations and service availability target |
| Data recovery | Backup retention, recovery-point objective (RPO) and recovery-time objective (RTO) |
| Integrations | Which providers are required for GPS, email, WhatsApp, accounting and e-way bill, if any |

---

## 64. Definition of Done for Every Feature

A feature is not complete just because Antigravity creates a screen or a model. Every feature must meet the applicable criteria:

1. **UX:** loading, empty, success, validation and failure states exist; responsive behavior is checked.
2. **Authorization:** roles, tenant scope, module entitlement and subscription state are enforced on the server.
3. **Validation:** client and server validate inputs; the server is authoritative.
4. **Persistence:** create/read/update/archive flows work against the real test database.
5. **Integrity:** uniqueness, relationships, concurrency and transaction behavior are defined.
6. **Audit:** sensitive changes record actor, timestamp, action and appropriate before/after details without logging secrets.
7. **Privacy:** access to personal, financial and document data is least-privilege.
8. **Resilience:** network failures, provider failures, retries and duplicate requests are handled.
9. **Testing:** unit, integration and authorization tests cover expected and negative cases.
10. **Documentation:** business rules, APIs, configuration and operational behavior are documented.
11. **Observability:** errors can be traced and actionable failures are visible to operators.
12. **Migration:** existing records remain compatible or have a tested migration/rollback path.

---

## 65. Additional Antigravity Prompt — Complete Missing Product Requirements and Documentation

Copy this prompt into Antigravity after opening the project and this specification file.

```text
Act as a senior SaaS product architect, transport-domain analyst, security engineer,
QA lead and technical writer.

Context:
- This is a Truck / Transport Management System intended to become a multi-tenant,
  monthly/annual subscription SaaS for multiple independent transport companies.
- Read the complete FEATURE_REVERSE_ENGINEERING_SPEC.md before changing anything.
- The specification contains both source-derived observations and proposed architecture.
  Do not assume a documented feature is implemented.
- Maintain one codebase with company-specific module entitlements, settings, roles,
  quotas and data isolation.
- Inspect the actual repository and compare it against the specification.

PHASE 1 — AUDIT, DO NOT IMPLEMENT YET
1. Inspect frontend routes/components, backend routes/controllers/services, database
   models, middleware, environment variables, integrations, tests and deployment files.
2. Create a traceability matrix for every feature:
   Existing and verified / Exists in source only / Partial / Missing / Broken /
   Needs business decision.
3. For each finding, cite the actual file path and relevant symbol or route.
4. Identify contradictions, duplicate systems, undocumented behavior and risky assumptions.
5. Never label something “working” based only on a UI component or schema.

PHASE 2 — CLOSE THE REQUIREMENTS GAPS
Evaluate and document:
- Tenant onboarding, company ownership, invitations and lifecycle.
- Server-enforced tenant isolation for every model, query, API, file, export and job.
- Authentication, password recovery, email verification, sessions and optional MFA.
- RBAC and sensitive field/document permissions.
- Plan catalog, subscription lifecycle, billing provider, verified webhooks, idempotency,
  retries, invoices, refunds, grace policy, cancellation and data retention.
- Feature catalog, company entitlements, dependencies, add-ons and quotas.
- Company settings, safe custom fields, configurable forms and approval workflows.
- Truck/driver compliance, maintenance, trip lifecycle, delivery/POD and notifications.
- Billing/LR/invoice, payment allocation, party balances, settlements and ledger.
- Financial formula definitions and decimal-safe calculations.
- Secure document uploads, signed URLs, exports, data import and account data export.
- Backups, restore drills, migrations, logging, monitoring, alerting and incident response.
- Rate limiting, CSRF strategy, secret management, dependency scanning and secure headers.
- Accessibility, responsive behavior, timezone/date/number formatting and localization policy.
- Customer onboarding/help/support, service status and release/rollback documentation.
- Unit/integration/end-to-end/security/performance tests and CI checks.
- Applicable legal, privacy, GST and statutory decisions that require qualified review.

PHASE 3 — BUSINESS DECISIONS
Do not invent critical business rules. Create a clearly marked decision register for:
- Target customer segment and launch geography.
- Plan limits and module packaging.
- Subscription grace/suspension behavior.
- Accounting scope and tax treatment.
- Driver settlement, diesel variance, party balance and profitability formulas.
- Data retention, deletion, backup RPO/RTO and support commitments.
For each, give options, impact and the specific decision required.

PHASE 4 — UPDATE DOCUMENTATION
Update the Markdown specification with:
- Executive summary and product boundaries.
- Feature inventory and MVP vs later roadmap.
- Current-state vs target-state traceability.
- Missing requirements and risk register with priority.
- Data model and API/security implications.
- Acceptance criteria and test matrix.
- Deployment, backup/restore, monitoring and incident runbooks.
- Business decision register.
- Clear status labels: VERIFIED, SOURCE ONLY, PARTIAL, PROPOSED, BLOCKED,
  and NOT IN MVP.
Keep existing useful reverse-engineering details. Do not erase source findings.
Remove contradictions and mark uncertain claims as uncertain.
Do not state that tests passed unless they were actually run.

PHASE 5 — IMPLEMENTATION PLAN
Provide a dependency-aware phased plan with P0/P1/P2 priorities, affected files,
migrations, tests, risks and acceptance criteria. Do not rewrite the whole application
or make broad destructive changes.

Stop after the audit and documentation update. Do not implement code until the user
approves the findings and plan.
```

---

## 66. Accuracy and Implementation Guardrails

1. **Tax is not a generic hardcoded constant.** The existing document's SAC/GST examples are hypotheses to validate, not legal advice. Confirm the applicable classification, rate, registration, place-of-supply, invoice fields and tax treatment with a qualified Indian GST advisor before production billing.
2. **Do not trust sample pricing or proration numbers without recomputing them.** Use a documented billing policy, currency-minor-unit arithmetic where appropriate, rounding rules and provider reconciliation.
3. **Do not implement both Razorpay and Stripe automatically.** Choose one initial payment provider based on launch geography and business needs; add an abstraction only if it materially helps.
4. **Do not expose Aadhaar or licence information by default.** Apply least-privilege access, secure storage, masking, access logging and a retention policy.
5. **Do not delete accounting history to “fix” a mistake.** Use approved reversal/adjustment workflows and audit them.
6. **Do not enable a module based only on frontend state.** The backend must verify tenant, user role, entitlement, subscription policy and resource quota.
7. **Do not promise GPS tracking unless the required hardware/provider and data feed are actually integrated.**
8. **Do not claim the product is launch-ready until backup restoration, tenant isolation, financial formulas, payment webhooks and authorization tests pass.**
9. **Keep this specification synchronized with reality.** After each implementation phase, update the traceability matrix and record tests, decisions and known limitations.
