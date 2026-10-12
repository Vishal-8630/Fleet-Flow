# Fleet Flow — Implementation Batches & Sequencing Blueprint

**Document Version:** 1.0.0  
**Status:** Approved Engineering Execution Plan  
**Target Platform:** Multi-Tenant B2B Transport & Fleet Management SaaS  
**Author:** Independent Systems Reviewer & Principal Architect  
**Authoritative Master Register:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](./FLEET_FLOW_MASTER_REGISTER.md)  
**Readiness Backlog:** [`docs/IMPLEMENTATION_READINESS_BACKLOG.md`](./IMPLEMENTATION_READINESS_BACKLOG.md)  

---

## 1. Executive Sequencing Philosophy

Implementation must follow strict structural dependencies. Security boundaries, multi-tenant isolation, and regression testing infrastructure must be established first before modifying financial calculations, billing entitlements, or external stakeholder portals:

```
[Batch 1: Tenant Isolation & Test Suite] 
                   │
                   ▼
[Batch 2: DB Topology & Aggregation Typing] 
                   │
                   ▼
[Batch 3: Double-Entry Ledger & Financial Invariants] 
                   │
                   ▼
[Batch 4: Public Tracking & Portals Hardening] 
                   │
                   ▼
[Batch 5: Commercial SaaS & Dynamic Billing] 
                   │
                   ▼
[Batch 6: Operational Infrastructure & Release Probes]
                   │
                   ▼
═══ MVP COMMERCIAL LAUNCH GATE ═══
                   │
                   ▼
[Batches 7–11: Post-Launch Improvements & Statutory Integrations]
```

---

## 2. Implementation Batches Breakdown

---

### Batch 1: Tenant Isolation Boundary, File Security & HTTP Test Framework
* **Theme:** Platform Foundation, Security Hardening & Test Harness
* **Priority:** `P0` (Critical Blocker)
* **Included Canonical IDs:**
  - [`ISS-001`](./issues/ISS-001-tenant-context-enforcement.md): Tenant Context Middleware Bypass in Express Routes
  - [`ISS-002`](./issues/ISS-002-tenant-plugin-interception.md): Incomplete Mongoose Tenant Interception Plugin
  - [`ISS-016`](./issues/ISS-016-unmounted-file-security-middleware.md): Unmounted File Security Magic Byte Middleware
  - [`ISS-017`](./issues/ISS-017-local-storage-path-traversal.md): Local Storage Path Traversal & Root Jailing
  - [`TEST-001`](./testing/TEST-001-automated-http-integration-suite.md): Vitest + Supertest HTTP Integration Test Suite
  - [`TEST-002`](./testing/TEST-002-cross-tenant-isolation-suite.md): Cross-Tenant Data Isolation Test Suite
  - [`DEC-003`](./decisions/DEC-003-storage-architecture-s3-vs-local.md): Storage Architecture Decision Alignment
* **Explicit Scope:**
  1. Mount `resolveTenantContext` across all omitted route files (`branchRoutes.ts`, `approvalRoutes.ts`, `commercialReportRoutes.ts`, `supportRoutes.ts`, `trackingRoutes.ts`).
  2. Extend `tenantPlugin.ts` hooks to include `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findOneAndUpdate`, and `aggregate`.
  3. Mount `fileSecurityMiddleware` on file upload endpoints in `documentRoutes.ts` to validate MIME magic bytes.
  4. Assert strict root containment in `storageService.ts` to reject `../` traversal attempts.
  5. Bootstrap Vitest + Supertest test runner and implement the cross-tenant boundary isolation test matrix (`TEST-002`).
* **Non-Goals:** Modifying financial ledger math, billing seed prices, or frontend views.
* **Dependencies & Decisions:** `DEC-003` storage boundary specifications.
* **Expected Files & Modules Affected:**
  - `backend/src/routes/` (`branchRoutes.ts`, `approvalRoutes.ts`, `commercialReportRoutes.ts`, `supportRoutes.ts`, `trackingRoutes.ts`, `documentRoutes.ts`)
  - `backend/src/plugins/tenantPlugin.ts`
  - `backend/src/utils/storageService.ts`
  - `backend/src/middlewares/fileSecurityMiddleware.ts`
  - `backend/src/test/` (Vitest test harness, `tenantIsolation.spec.ts`, `fileSecurity.spec.ts`)
* **Acceptance Criteria:**
  - [ ] Every protected API route enforces tenant context and returns 401/403 for unauthenticated or cross-tenant tokens.
  - [ ] Update and delete queries cannot touch another tenant's documents even when explicit `_id` is supplied.
  - [ ] File uploads with spoofed extensions or traversal keys (`../`) return HTTP 400/403.
  - [ ] `TEST-001` and `TEST-002` pass with 100% green status.
* **Conditions to Exit Batch 1:** `TEST-001` and `TEST-002` pass with 0 errors in CI pipeline.

---

### Batch 2: Database Topology, Aggregation Types & Concurrency Hardening
* **Theme:** Data Layer Integrity, Concurrency Protection & Performance
* **Priority:** `P0` / `P1` (Blocker)
* **Included Canonical IDs:**
  - [`ISS-018`](./issues/ISS-018-acid-transactions-standalone-mongo.md): Multi-Document ACID Transactions on Replica Set
  - [`ISS-014`](./issues/ISS-014-mongodb-aggregation-string-companyid.md): MongoDB Aggregations Pass Raw String `companyId`
  - [`ISS-019`](./issues/ISS-019-client-side-idempotency-key-omission.md): Client-Side Idempotency Key Generation
  - [`ISS-021`](./issues/ISS-021-custom-field-key-injection-defense.md): Custom Field Prototype Pollution Defense
  - [`IMP-004`](./improvements/IMP-004-compound-multitenant-indexes.md): Compound Multi-Tenant Database Indexes
  - [`DEC-002`](./decisions/DEC-002-mongodb-transactions-standalone-strategy.md): MongoDB Replica Set Strategy
* **Explicit Scope:**
  1. Configure `docker-compose.dev.yml` with single-node replica set (`rs0`) and automated initialization probe.
  2. Implement `runInTransaction` in `transactionHelper.ts` with strict assertion against un-replicated standalone MongoDB for financial mutations.
  3. Cast `companyId` to `new Types.ObjectId(companyId)` in all aggregation `$match` stages across controllers.
  4. Implement client-side idempotency header generation (`x-idempotency-key`) in `frontend/src/api/client.ts`.
  5. Sanitize custom field keys against prototype pollution (`__proto__`, `$where`) in `customFieldController.ts`.
  6. Add compound indexes (`company_id: 1, createdAt: -1`) across high-volume collections.
* **Non-Goals:** Changing commercial pricing, building new pages, or altering ledger formulas.
* **Dependencies & Decisions:** Batch 1 complete; `DEC-002` approved.
* **Expected Files & Modules Affected:**
  - `docker-compose.yml`, `docker-compose.dev.yml`
  - `backend/src/utils/transactionHelper.ts`
  - `backend/src/controllers/entryController.ts`, `backend/src/controllers/journeyController.ts`
  - `backend/src/controllers/customFieldController.ts`
  - `frontend/src/api/client.ts`
  - `backend/src/models/` (`GpsPing.ts`, `JournalEntry.ts`, `Document.ts`)
* **Acceptance Criteria:**
  - [ ] Multi-document transactions run cleanly in local Docker Compose (`rs0`) and CI without crashing.
  - [ ] Financial operations on non-replicated MongoDB fail fast with clear `ConfigurationError`.
  - [ ] Aggregation queries match documents accurately and return expected summaries.
  - [ ] Duplicate financial POST requests with identical idempotency keys return cached responses.
  - [ ] Custom field definitions reject prototype pollution keys with HTTP 400.
* **Conditions to Exit Batch 2:** Multi-document transactional integrity verified in replica set mode; zero string-ObjectId aggregation bugs remaining.

---

### Batch 3: Double-Entry Financial Integrity, Ledger Invariants & Commercial UI
* **Theme:** Commercial Accounting, AR Aging & Financial Rectification
* **Priority:** `P0` / `P1` (Financial Blocker)
* **Included Canonical IDs:**
  - [`ISS-003`](./issues/ISS-003-credit-note-balance-reduction.md): Credit Note Balance Reduction Failure
  - [`ISS-004`](./issues/ISS-004-vendor-payout-ledger-reconciliation.md): Vendor Payout Ledger Reconciliation
  - [`ISS-008`](./issues/ISS-008-missing-credit-notes-page.md): Missing Credit Notes Page Component & Navigation
  - [`ISS-009`](./issues/ISS-009-ar-aging-customer-name-display.md): AR Aging Table Displays Blank Customer Names
  - [`ISS-010`](./issues/ISS-010-trip-profitability-zero-calculation.md): Trip Profitability Report Zero Calculation
  - [`IMP-001`](./improvements/IMP-001-gstin-pan-validation.md): Comprehensive GSTIN & PAN Validation Engine
  - [`TEST-003`](./testing/TEST-003-double-entry-ledger-invariants.md): Double-Entry Ledger Invariants Suite
* **Explicit Scope:**
  1. Refactor `createCreditNote` to decrement `balance_amount` and increment `paid_amount` on `Invoice`.
  2. Refactor `recordPartyPayout` to post balanced double-entry journals with credit to Bank/Cash and unique `journal_id`.
  3. Update `getPartyBalances` to deduct payouts from vendor payable balances.
  4. Create `frontend/src/pages/commercial/CreditNotesPage.tsx` and wire `/commercial/credit-notes` route in `App.tsx` and `Sidebar.tsx`.
  5. Fix customer name property resolution on AR Aging report.
  6. Fix field projections in trip profitability aggregation (`freight_amount`, `fuel_cost`, `driver_advance`).
  7. Implement GSTIN and PAN checksum/regex validation helper.
* **Non-Goals:** Modifying public tracking or subscription pricing tiers.
* **Dependencies & Decisions:** Batches 1 & 2 complete.
* **Expected Files & Modules Affected:**
  - `backend/src/controllers/commercialReportController.ts`
  - `backend/src/controllers/ledgerController.ts`
  - `backend/src/models/Invoice.ts`, `backend/src/models/JournalEntry.ts`
  - `frontend/src/pages/commercial/CreditNotesPage.tsx` (new component)
  - `frontend/src/pages/commercial/AgingReportPage.tsx`
  - `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/App.tsx`
  - `backend/src/utils/gstUtils.ts`
  - `backend/src/test/ledgerInvariants.spec.ts`
* **Acceptance Criteria:**
  - [ ] Posting a credit note reduces the invoice `balance_amount` in rupees.
  - [ ] `TEST-003` passes: Every journal posting balances ($\sum \text{debits} == \sum \text{credits}$); vendor balances accurately reflect net payouts.
  - [ ] Navigating to Credit Notes in sidebar renders functional credit note list and details.
  - [ ] AR aging table displays customer company names alongside aging buckets.
  - [ ] Trip profitability table computes and displays accurate revenue, expenses, and net profit.
* **Conditions to Exit Batch 3:** `TEST-003` 100% green; zero financial discrepancy across simulated accounting workflows.

---

### Batch 4: Public Tracking Privacy & Stakeholder Portals Hardening
* **Theme:** External Stakeholder Experience, Privacy Protection & Abuse Defense
* **Priority:** `P0` / `P1` (Security & Privacy Blocker)
* **Included Canonical IDs:**
  - [`ISS-005`](./issues/ISS-005-public-tracking-privacy-idor.md): Public Tracking IDOR & PII Sanitization
  - [`ISS-006`](./issues/ISS-006-stakeholder-portals-auth-breakdown.md): Stakeholder Portals Authentication & Real Data
  - [`ISS-007`](./issues/ISS-007-live-fleet-map-projection-mismatch.md): Live Fleet Map Schema & Projection Discrepancy
  - [`ISS-020`](./issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md): Portal OTP Rate Limiting & Abuse Defense
* **Explicit Scope:**
  1. Add indexed `tracking_token` to `Entry` and `LR` models; implement `/api/public/track?token=...` endpoint with sanitized `PublicShipmentTrackingDTO`.
  2. Implement 3-factor LR lookup (`company_code` + `lr_no` + `phone`); reject bare `lr_no` queries without verification.
  3. Mount IP rate limiting on public tracking and OTP endpoints (20 req/min).
  4. Fix customer OTP query to search `phone` on `BillingParty`; enable vendor OTP login; connect `VendorPortalPage.tsx` to real API endpoints.
  5. Align live fleet map query projections with `Truck.ts` schema (`truck_no`, `status`).
* **Non-Goals:** Building full native mobile apps or e-POD OTP signing.
* **Dependencies & Decisions:** Batch 1 complete.
* **Expected Files & Modules Affected:**
  - `backend/src/controllers/trackingController.ts`, `backend/src/routes/trackingRoutes.ts`
  - `backend/src/controllers/portalController.ts`, `backend/src/routes/portalRoutes.ts`
  - `frontend/src/pages/public/PublicTrackingPage.tsx`
  - `frontend/src/pages/portals/VendorPortalPage.tsx`
  - `frontend/src/pages/operations/LiveTrackingPage.tsx`
* **Acceptance Criteria:**
  - [ ] Public tracking by unverified raw `lr_no` returns HTTP 400.
  - [ ] Public tracking via `tracking_token` returns sanitized milestone data with 0 driver phone numbers and 0 freight rates.
  - [ ] Submitting >3 OTP requests in 10 minutes returns HTTP 429 Too Many Requests.
  - [ ] Customer and vendor portal users successfully log in via OTP and view real tenant records.
  - [ ] Live fleet map displays interactive vehicle markers with correct registration numbers and statuses.
* **Conditions to Exit Batch 4:** Zero IDOR leakage verified; stakeholder portals operational with real data.

---

### Batch 5: Commercial SaaS, Dynamic Billing & Entitlements Engine
* **Theme:** SaaS Monetization, Subscription Entitlements & Pricing Alignment
* **Priority:** `P1` (Commercial Blocker)
* **Included Canonical IDs:**
  - [`ISS-011`](./issues/ISS-011-pricing-page-seed-discrepancy.md): Pricing Page Contradicts Backend Plan Seeds
  - [`ISS-012`](./issues/ISS-012-starter-plan-entitlement-trap.md): Starter Plan Entitlement Trap Blocks LRs & Invoices
  - [`ISS-013`](./issues/ISS-013-unsafe-payment-checkout-simulation.md): Unsafe Payment Simulation Mode Defense
  - [`DEC-001`](./decisions/DEC-001-subscription-pricing-and-entitlements.md): Commercial Pricing Matrix Approval
  - [`TEST-004`](./testing/TEST-004-subscription-feature-gating-quotas.md): Subscription Feature Gating & Quota Suite
* **Explicit Scope:**
  1. Record Product Owner sign-off on `DEC-001` pricing, quotas, and Starter plan module inclusions.
  2. Update `billingSeedService.ts` and `featureCatalog.ts` with approved canonical values; grant `MOD_LR_ENGINE` and `MOD_BILLING_INVOICE` to Starter Plan.
  3. Refactor `frontend/src/pages/marketing/PricingPage.tsx` to dynamically query `GET /api/billing/plans`.
  4. Block checkout simulation mode when `NODE_ENV === 'production'`; assert Razorpay cryptographic HMAC webhook signatures.
  5. Execute `TEST-004` verifying quota limits (`max_trucks`, `max_users`) and module gating across all tiers.
* **Non-Goals:** External accounting audit or TDS tax certificates.
* **Dependencies & Decisions:** Batches 1–4 complete; `DEC-001` approved by Product Owner.
* **Expected Files & Modules Affected:**
  - `backend/src/utils/billingSeedService.ts`
  - `backend/src/utils/featureCatalog.ts`
  - `backend/src/controllers/billingController.ts`
  - `frontend/src/pages/marketing/PricingPage.tsx`
  - `backend/src/test/subscriptionGating.spec.ts`
* **Acceptance Criteria:**
  - [ ] Starter Plan subscribers can create, print, and view LRs and GST Invoices without receiving 403 Forbidden.
  - [ ] `PricingPage.tsx` displays prices, vehicle limits, and features dynamically matching `/api/billing/plans`.
  - [ ] Simulation mode is completely rejected in production; payment activation requires verified Razorpay signatures.
  - [ ] `TEST-004` passes with 100% green status.
* **Conditions to Exit Batch 5:** Commercial monetization and entitlement gating fully verified.

---

### Batch 6: Operational Infrastructure, Verification Probes & Launch Runbook
* **Theme:** SRE, Reliability Engineering & Production Deployment Readiness
* **Priority:** `P1` (Operational Launch Blocker)
* **Included Canonical IDs:**
  - [`ISS-015`](./issues/ISS-015-dashboard-maintenance-truck-counter.md): Dashboard Maintenance Counter Enum Mismatch
  - [`OPS-001`](./operations/OPS-001-docker-compose-architecture.md): Multi-Environment Docker Compose Architecture
  - [`OPS-003`](./operations/OPS-003-backup-retention-disaster-recovery.md): Automated Backup, Retention & Recovery
  - [`OPS-005`](./operations/OPS-005-deep-health-check-probes.md): Deep Readiness & Liveness Health Check Probes
  - [`DEC-003`](./decisions/DEC-003-storage-architecture-s3-vs-local.md): Cloud Object Storage Architecture Sign-Off
* **Explicit Scope:**
  1. Fix dashboard maintenance KPI aggregation to filter by `in_maintenance`.
  2. Implement standardized `docker-compose.yml` and `docker-compose.dev.yml` with healthchecks.
  3. Implement automated backup script (`backup.sh`) with S3 upload and write restore verification runbook (`restore.sh`).
  4. Implement `/api/health/readiness` probe verifying MongoDB replica set and Redis ping.
  5. Assert production configuration assertions (disallow local storage, require S3 credentials in production).
* **Non-Goals:** Third-party government integrations (NIC / Parivahan).
* **Dependencies & Decisions:** Batches 1–5 complete.
* **Expected Files & Modules Affected:**
  - `backend/src/controllers/dashboardController.ts`
  - `docker-compose.yml`, `docker-compose.dev.yml`
  - `backend/src/routes/healthRoutes.ts`, `backend/src/server.ts`
  - `scripts/backup.sh`, `scripts/restore.sh`
* **Acceptance Criteria:**
  - [ ] Full application stack boots via `docker compose up` with all healthchecks passing.
  - [ ] Readiness probe returns 200 with dependency latencies when healthy; returns 503 if MongoDB disconnects.
  - [ ] Backup script generates valid encrypted database archive; test restore drill succeeds.
  - [ ] Executive dashboard displays accurate vehicle maintenance counter.
* **Conditions for MVP Launch Approval:** Batches 1 through 6 complete, tested, and approved.

---

## 3. Post-Launch Roadmap Batches (Batches 7–11)

The following batches contain `P2` improvements and `P3` advanced features scheduled for execution following initial commercial launch:

### Batch 7: Enterprise Governance & UX Polish (`P2`)
- **Included IDs:** [`IMP-002`](./improvements/IMP-002-granular-rbac-permission-matrix.md), [`IMP-003`](./improvements/IMP-003-expiring-member-invitations.md), [`IMP-005`](./improvements/IMP-005-dynamic-tax-recalculation.md), [`IMP-006`](./improvements/IMP-006-serverside-pagination-tables.md), [`IMP-007`](./improvements/IMP-007-telematics-map-fallback.md), [`IMP-009`](./improvements/IMP-009-superadmin-impersonation-safeguards.md).
- **Prerequisites:** MVP Launch active.

### Batch 8: Distributed Background Processing & Observability (`P2`)
- **Included IDs:** [`IMP-008`](./improvements/IMP-008-notification-multi-channel-failover.md), [`OPS-002`](./operations/OPS-002-distributed-task-processing-bullmq.md), [`OPS-004`](./operations/OPS-004-observability-sentry-apm.md).
- **Prerequisites:** Redis instance provisioned; Sentry DSN configured.

### Batch 9: Advanced Mobile & Stakeholder Workflows (`P2`)
- **Included IDs:** [`FEAT-004`](./features/FEAT-004-epod-mobile-capture-otp.md), [`FEAT-010`](./features/FEAT-010-vendor-portal-end-to-end.md), [`FEAT-011`](./features/FEAT-011-tenant-data-export-offboarding.md).
- **Prerequisites:** Stakeholder user onboarding active.

### Batch 10: Statutory Logistics & Tax Integrations (`P3`)
- **Included IDs:** [`FEAT-001`](./features/FEAT-001-nic-eway-bill-integration.md), [`FEAT-002`](./features/FEAT-002-gst-einvoicing-irn-qr.md), [`FEAT-003`](./features/FEAT-003-vahan-sarathi-verification.md), [`FEAT-008`](./features/FEAT-008-section-194c-tds-engine.md).
- **Prerequisites:** External NIC/IRP GSP production contracts; ULIP agreement; CA tax audit.

### Batch 11: Automated Telemetry & Specialized Fleet Assets (`P3`)
- **Included IDs:** [`FEAT-005`](./features/FEAT-005-fastag-toll-reconciliation.md), [`FEAT-006`](./features/FEAT-006-fuel-card-sync-integration.md), [`FEAT-007`](./features/FEAT-007-driver-mobile-pwa-workflow.md), [`FEAT-009`](./features/FEAT-009-tyre-lifecycle-management.md).
- **Prerequisites:** FASTag/Fuel card corporate partnerships; Driver PWA usability study.

---

## 4. Immediate Action Item: Batch 1 Presentation

**Batch 1 (Tenant Isolation Boundary, File Security & HTTP Test Framework)** is the immediate next step. Implementation must not commence until formal approval of Batch 1 is granted by the user.
