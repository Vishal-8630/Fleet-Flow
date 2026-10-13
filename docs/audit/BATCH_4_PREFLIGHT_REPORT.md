# Fleet Flow — Batch 4 Preflight Audit Report (No Code Changes)

**Document Version:** 1.2.0  
**Audit Date:** October 2026  
**Status:** Complete — Ready for Review & Implementation Approval  
**Audit Scope:** Batch 4 — Public Tracking Privacy, Telematics Live Map, Stakeholder Portals Hardening & Abuse Defense  
**Author:** Independent Systems Reviewer & Principal Architect  
**Authoritative Reference:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md)  
**Sequencing Blueprint:** [`docs/IMPLEMENTATION_BATCHES.md`](../IMPLEMENTATION_BATCHES.md)  
**Readiness Backlog:** [`docs/IMPLEMENTATION_READINESS_BACKLOG.md`](../IMPLEMENTATION_READINESS_BACKLOG.md)  

---

## 1. Purpose and Scope Boundary

This document delivers an authoritative, source-verified **preflight audit and refined batch plan** for **Batch 4** of the Fleet Flow B2B Transport & Fleet Management SaaS platform.

### 1.1. Preflight Audit Constraints & Boundaries
1. **Preflight Only — Zero Code Modification:** No application source code, database models, Express routes, controllers, frontend views, or test files have been created or modified for Batch 4.
2. **Zero Git Modifications:** No files have been staged, committed, pushed, stashed, reset, cleaned, or discarded.
3. **Pristine Working Tree:** Working tree remains clean on branch `main` at commit `af1c2bc` (apart from this report).
4. **No Speculative Implementation:** Every finding in this document is confirmed by inspecting active lines in the repository. No issue IDs, severities, or test outcomes are fabricated.
5. **No Additional Planning Documents:** This single report serves as the sole preflight planning artifact for Batch 4.
6. **Strict Implementation Gate:** Batch 4 implementation will **not** commence until explicit user review and written approval of this proposed scope is granted.

### 1.2. Preservation of Prior Architectural Decisions
- **`DEC-002` (Approved — MongoDB Replica Set Topology):**  
  Option A remains active. Strict replica-set topology (`rs0`) is required in all environments and validated fail-fast by `assertReplicaSetTopology()`. Multi-document ACID transactions remain centralized in `runInTransaction()`. As with previous batches, Docker daemon runtime remains unverified locally due to host daemon unavailability; Docker Compose configurations (`docker-compose.yml`, `docker-compose.dev.yml`) remain statically verified.
- **`DEC-003` (Pending Formal Approval — Cloud S3 Storage Migration):**  
  Migration to AWS S3 / Cloud Object Storage remains strictly **Pending Approval**. Batch 4 does not introduce, assume, or depend upon S3 storage. Local disk storage with magic-byte validation (`ISS-016`) and root path traversal jailing (`ISS-017`) is preserved.
- **Deferred Transactional Outbox (`OPS-002` / Batch 8):**  
  Post-commit asynchronous side effects (SMS and WhatsApp dispatch) remain best-effort without an outbox table. External notifications must continue to be executed post-commit in isolated `.catch()` handlers so third-party telephony timeouts never abort committed database transactions. The persistent transactional outbox pattern remains scheduled for Batch 8.

---

## 2. Repository State at Inspection

### 2.1. Git Status Summary
A baseline check was executed immediately upon commencing this preflight audit:

```powershell
PS C:\Users\vishh\OneDrive\Desktop\Work\TransportManagement> git status --short
(clean output - exit code 0)

PS C:\Users\vishh\OneDrive\Desktop\Work\TransportManagement> git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

- **Branch:** `main` (synchronized with `origin/main`).
- **Current HEAD Commit:** `af1c2bc` (*feat(batch-3): implement financial invariants, credit notes, vendor payouts & GSTIN validation*).
- **Existing Modified Files:** `0`
- **Existing Untracked Files:** `0`
- **Preservation Status:** Confirmed. All pre-existing tracked and untracked changes from Batch 3 were preserved and remain intact in git history.

### 2.2. Reconciliation of Batch 3 Closeout to Current HEAD (`af1c2bc`)
The Batch 3 closeout report documented **10 modified tracked files** and **5 untracked files**. A forensic check was executed to verify how these files transitioned into the clean working tree at `af1c2bc`:

```powershell
PS C:\Users\vishh\OneDrive\Desktop\Work\TransportManagement> git show --stat --oneline af1c2bc
af1c2bc feat(batch-3): implement financial invariants, credit notes, vendor payouts & GSTIN validation
 .../src/controllers/commercialReportController.ts  |  229 ++--
 backend/src/controllers/companyController.ts       |   15 +-
 backend/src/controllers/invoiceController.ts       |    9 +-
 backend/src/controllers/ledgerController.ts        |  358 +++++-
 backend/src/controllers/partyController.ts         |   69 +-
 backend/src/models/Invoice.ts                      |    2 +
 backend/src/server.ts                              |    2 +
 .../integration/phase3FinancialInvariants.test.ts  | 1146 ++++++++++++++++++++
 backend/src/utils/gstinValidator.ts                |  195 ++++
 backend/src/utils/ledgerService.ts                 |   76 ++
 docs/audit/BATCH_3_PREFLIGHT_REPORT.md             |  500 +++++++++
 frontend/src/App.tsx                               |    3 +
 frontend/src/pages/commercial/AgingReportPage.tsx  |    8 +-
 frontend/src/pages/commercial/CreditNotesPage.tsx  |  753 +++++++++++++
 frontend/src/utils/gstinValidator.ts               |  161 +++
 15 files changed, 3393 insertions(+), 133 deletions(-)
```

**Reconciliation Analysis:**
1. **The 10 Modified Tracked Files in `af1c2bc`:**
   - `backend/src/controllers/commercialReportController.ts`
   - `backend/src/controllers/companyController.ts`
   - `backend/src/controllers/invoiceController.ts`
   - `backend/src/controllers/ledgerController.ts`
   - `backend/src/controllers/partyController.ts`
   - `backend/src/models/Invoice.ts`
   - `backend/src/server.ts`
   - `backend/src/utils/ledgerService.ts`
   - `frontend/src/App.tsx`
   - `frontend/src/pages/commercial/AgingReportPage.tsx`
2. **The 5 Previously Untracked Files in `af1c2bc`:**
   - `backend/src/tests/integration/phase3FinancialInvariants.test.ts` (1,146 lines, 27 tests)
   - `backend/src/utils/gstinValidator.ts` (195 lines)
   - `docs/audit/BATCH_3_PREFLIGHT_REPORT.md` (500 lines)
   - `frontend/src/pages/commercial/CreditNotesPage.tsx` (753 lines)
   - `frontend/src/utils/gstinValidator.ts` (161 lines)
3. **Discrepancy Evaluation:** **Zero Discrepancies.**  
   All 15 Batch 3 artifacts (10 modified + 5 untracked) were committed together as a unified snapshot in commit `af1c2bc` and pushed to `origin/main`. All implementation code, schemas, utilities, UI pages, and integration tests are verified present in the active working tree.

### 2.3. Verified Baseline Health Checks
To confirm the integrity of the active codebase before scoping Batch 4, the test harness and production builds were independently executed and verified:

1. **Backend Integration & Unit Test Suite (`backend`):**
   ```powershell
   npm test
   ```
   - **Result:** **135 passed (135 tests)** across **9 test suites** (100% green in 28.08s).
   - Test suites verified:
     - `src/tests/smoke.test.ts` (1 test)
     - `src/tests/integration/tenantRoutes.test.ts` (14 tests)
     - `src/tests/integration/phase21Hardening.test.ts` (7 tests)
     - `src/tests/integration/phase22Indexes.test.ts` (5 tests)
     - `src/tests/integration/phase23Idempotency.test.ts` (13 tests)
     - `src/tests/integration/fileStorageSecurity.test.ts` (22 tests)
     - `src/tests/integration/tenantIsolation.test.ts` (22 tests)
     - `src/tests/integration/phase25Transactions.test.ts` (16 tests)
     - `src/tests/integration/phase3FinancialInvariants.test.ts` (27 tests)
2. **Backend TypeScript Compilation (`backend`):**
   ```powershell
   npm run build
   ```
   - **Result:** Exit code 0 (`tsc` succeeded without diagnostic errors).
3. **Frontend Production Bundle (`frontend`):**
   ```powershell
   npm run build
   ```
   - **Result:** Exit code 0 (`tsc -b && vite build` transformed 1,771 modules cleanly).
4. **Docker Daemon Runtime:**
   - **Result:** Unverified. The Docker daemon remains unavailable in the workstation environment. Statically validated Compose manifests are unchanged.

---

## 3. Source Documents and Evidence Reviewed

The following canonical specifications, audits, source files, and test files were inspected to ground this preflight audit:

### 3.1. Specifications and Governance Documents
- [`docs/audit/BATCH_3_PREFLIGHT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/audit/BATCH_3_PREFLIGHT_REPORT.md): Batch 3 audit pattern and baseline carry-forward.
- [`docs/FLEET_FLOW_MASTER_REGISTER.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/FLEET_FLOW_MASTER_REGISTER.md): Master inventory of issues, improvements, features, and decisions.
- [`docs/IMPLEMENTATION_BATCHES.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/IMPLEMENTATION_BATCHES.md): Engineering sequencing roadmap (Section 2, Batch 4 specification).
- [`docs/issues/ISS-005-public-tracking-privacy-idor.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/issues/ISS-005-public-tracking-privacy-idor.md): Public tracking IDOR and privacy specification.
- [`docs/issues/ISS-006-stakeholder-portals-auth-breakdown.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/issues/ISS-006-stakeholder-portals-auth-breakdown.md): Customer, driver, and vendor portal authentication defects.
- [`docs/issues/ISS-007-live-fleet-map-projection-mismatch.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/issues/ISS-007-live-fleet-map-projection-mismatch.md): Live fleet map schema and projection mismatch specification.
- [`docs/issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md): Portal OTP rate limiting and anti-flooding specification.

### 3.2. Active Source Code Files Inspected
- [`backend/src/controllers/trackingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts): Lines 100–140 (`getFleetLiveMap`) and lines 185–296 (`publicTrackConsignment`).
- [`backend/src/routes/trackingRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/trackingRoutes.ts): Unauthenticated and authenticated telematics route definitions.
- [`backend/src/controllers/portalController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts): Lines 34–98 (`sendPortalOtp`), lines 104–166 (`verifyPortalOtp`), lines 172–196 (`getCustomerDashboard`), lines 202–226 (`getDriverCurrentTrip`), lines 232–278 (`submitEpod`).
- [`backend/src/routes/portalRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/portalRoutes.ts): Unthrottled OTP routes and missing vendor routes.
- [`backend/src/server.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/server.ts): Lines 154 and 161 (route mounting for `/api/public/track` and `/api/telematics`).
- [`backend/src/middleware/securityMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/securityMiddleware.ts): Existing rate limiters (`authLimiter`, `registerLimiter`, etc.).
- [`backend/src/models/Entry.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Entry.ts): Consignment schema, compound tenant indexes, lack of `tracking_token`.
- [`backend/src/models/Truck.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Truck.ts): Fleet vehicle schema (`status`, `truck_no`, `body_type`).
- [`backend/src/models/TruckJourney.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts): Journey status enum (`'draft' | 'active' | 'completed' | 'delayed' | 'cancelled'`).
- [`backend/src/models/BillingParty.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/BillingParty.ts): Customer model with `phone` attribute.
- [`backend/src/models/BalanceParty.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/BalanceParty.ts): Vendor/supplier/broker model with `phone` attribute.
- [`backend/src/models/PortalSession.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/PortalSession.ts): Stakeholder OTP session schema.
- [`frontend/src/pages/public/PublicTrackingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/public/PublicTrackingPage.tsx): Lines 42–79 (contract interface) and lines 208–250 (JSX render).
- [`frontend/src/pages/portal/VendorPortalPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/VendorPortalPage.tsx): Lines 42–66 (hardcoded mock data).
- [`frontend/src/pages/portal/CustomerPortalPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/CustomerPortalPage.tsx): Consignment and invoice state requirements.
- [`frontend/src/pages/portal/DriverPortalPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/DriverPortalPage.tsx): Lines 17–28 and line 52 (trip data consumption).
- [`frontend/src/pages/operations/LiveFleetMapPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/LiveFleetMapPage.tsx): Telematics API consumption and vehicle markers.

---

## 4. Unresolved Issues and Risk Ranking

Following the resolution of Batches 1, 2, and 3, four critical defects remain in the public, telematics, and stakeholder portal domains. They are ranked below by risk, severity, and security exposure:

| Issue ID | Severity | Category | Title | Confidence | Affected Code Files |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ISS-005`** | **P0 / Blocker** | Security & Privacy | Public Tracking Cross-Tenant IDOR, Enumeration & UI Crash | Confirmed Active Defect | [`backend/src/controllers/trackingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts)<br>[`frontend/src/pages/public/PublicTrackingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/public/PublicTrackingPage.tsx) |
| **`ISS-006`** | **P0 / Blocker** | Authentication & Portals | Stakeholder Portals Authentication Breakdown & Mock Facade | Confirmed Active Defect | [`backend/src/controllers/portalController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts)<br>[`backend/src/routes/portalRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/portalRoutes.ts)<br>[`frontend/src/pages/portal/VendorPortalPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/VendorPortalPage.tsx) |
| **`ISS-007`** | **P1 / High** | Telematics & UI | Live Fleet Map Broken by Schema & Projection Discrepancy | Confirmed Active Defect | [`backend/src/controllers/trackingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts)<br>[`frontend/src/pages/operations/LiveFleetMapPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/LiveFleetMapPage.tsx) |
| **`ISS-020`** | **P1 / High** | Security & Abuse | Unthrottled Portal OTP & Public Tracking Endpoints | Confirmed Security Risk | [`backend/src/routes/portalRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/portalRoutes.ts)<br>[`backend/src/routes/trackingRoutes.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/trackingRoutes.ts)<br>[`backend/src/middleware/securityMiddleware.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/middleware/securityMiddleware.ts) |

---

### Detailed Findings and Forensic Code Evidence

#### 1. `ISS-005`: Insecure Direct Object Reference (IDOR) & Frontend Contract Crash in Public Tracking
- **Severity:** `P0` / Blocker
- **Finding:**
  1. **Cross-Tenant IDOR & Enumeration:** In [`trackingController.ts:201-206`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts#L201-L206):
     ```typescript
     const entry = await Entry.findOne({
       $or: [{ lr_no: cleanLr }, { bill_no: cleanLr }],
     })
       .setOptions({ skipTenantCheck: true })
       .lean();
     ```
     In `Entry.ts:270`, `lr_no` is compound-unique only per company (`{ company_id: 1, lr_no: 1 }`). Transport companies frequently start numbering at `1`, `101`, or `1001`. Because `publicTrackConsignment` queries with `{ skipTenantCheck: true }` without requiring tenant credentials, token, or party verification, an unauthenticated user tracking `1001` receives whichever tenant's entry MongoDB returns first. Sequential scrapers can harvest competitor consignments across all tenants.
  2. **Runtime Frontend Crash (`TypeError`):**
     In [`trackingController.ts:257-290`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts#L257-L290), the backend returns a flat payload (`lr_number`, `from_city`, `to_city`, `consignment_description`, `package_count`, `weight_kg`).
     However, in [`PublicTrackingPage.tsx:210-250`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/public/PublicTrackingPage.tsx#L210-L250), the React component expects:
     - `trackingData.carrier.company_name`
     - `trackingData.transit.origin`
     - `trackingData.transit.current_status`
     - `trackingData.consignment.consignor_name`
     Because `trackingData.carrier` and `trackingData.transit` are `undefined`, any successful API response immediately throws:
     `TypeError: Cannot read properties of undefined (reading 'company_name')`, completely crashing the page.
  3. **Zero Request Throttling:**
     In [`trackingRoutes.ts:22`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/trackingRoutes.ts#L22), `router.get('/:lrNumber', publicTrackConsignment)` is mounted without any rate limiting.
- **Impact:** Critical data privacy breach; cross-tenant consignment leakage; unhandled React crash rendering the public portal unusable.
- **Existing Tests:** Zero test coverage for public tracking. Covered only by skipped legacy manual scripts.
- **Confidence:** Confirmed Defect.

---

#### 2. `ISS-006`: Stakeholder Portals Authentication & Real Data Breakdown
- **Severity:** `P0` / Blocker
- **Finding:**
  1. **Customer OTP Lookup Broken:**
     In [`portalController.ts:47`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts#L47) and line 115:
     ```typescript
     const party = await BillingParty.findOne({ company_id, contact_phone: phone });
     ```
     In [`BillingParty.ts:40`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/BillingParty.ts#L40), the field is named `phone`, not `contact_phone`. As a result, 100% of customer OTP requests fail with HTTP 404 (`No customer account found for this phone number`).
  2. **Vendor Portal Authentication Blocked:**
     In [`portalController.ts:60-63`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts#L60-L63):
     ```typescript
     } else if (portal_type === 'driver') {
       ...
     } else {
       res.status(400).json({ error: 'Unsupported portal_type. Use: customer, driver, or vendor.' });
       return;
     }
     ```
     `portal_type === 'vendor'` falls into the `else` branch and is rejected with HTTP 400. In `verifyPortalOtp` (line 114), there is no branch for `'vendor'`. Vendors can neither request nor verify OTPs.
  3. **Vendor Dashboard Omitted & Frontend Hardcoded Mock Facade:**
     In `portalRoutes.ts`, there are zero vendor routes. In `portalController.ts:16`, `GET /vendor/dashboard` is listed in comments but never implemented.
     In [`VendorPortalPage.tsx:43-66`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/VendorPortalPage.tsx#L43-L66), the page renders static dummy arrays (`MH12RN4590`, `MH04AB8921`) and makes no backend API call.
  4. **Customer Dashboard Projections Non-Existent Fields & Omitted Invoices:**
     In [`portalController.ts:183`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts#L183):
     `.select('lr_number from_city to_city status created_at material_description packages actual_weight')`.
     None of these field names exist on `Entry` (`lr_no`, `from_location`, `to_location`, `goods_description`, `package_count`, `actual_weight_tonnes` are the actual fields). The query returns objects with empty properties.
     In line 186, `BillingParty.findById(entityId).select('party_name contact_email contact_phone')` selects fields that do not exist on `BillingParty` (`name`, `email`, `phone`).
     Furthermore, `getCustomerDashboard` completely omits `invoices`, returning an empty invoice list to the customer.
  5. **Driver Portal Status Enum Inconsistency:**
     In [`portalController.ts:210`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts#L210):
     `status: { $in: ['planned', 'loading', 'in_transit'] }`.
     In [`TruckJourney.ts:36`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts#L36), valid statuses are `'draft' | 'active' | 'completed' | 'delayed' | 'cancelled'`. Active journeys are never found.
     In line 220, the controller returns `{ current_trip }`, whereas [`DriverPortalPage.tsx:52`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/portal/DriverPortalPage.tsx#L52) expects `res.data.trip`, setting `trip` to `null`.
- **Impact:** External customer, driver, and vendor self-service portals are completely non-functional.
- **Existing Tests:** Zero test coverage for stakeholder portal endpoints.
- **Confidence:** Confirmed Defect.

---

#### 3. `ISS-007`: Live Fleet Map Broken by Projection & Schema Discrepancy
- **Severity:** `P1` / High
- **Finding:**
  1. In [`trackingController.ts:109`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/trackingController.ts#L109):
     ```typescript
     const trucks = await Truck.find({ company_id: companyId, is_active: true })
       .select('_id registration_number truck_type').lean();
     ```
     - In [`Truck.ts:25-35`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Truck.ts#L25-L35), active status is `status: 'active'`. The field `is_active` does not exist on `Truck`. The query matches 0 vehicles!
     - In `Truck.ts`, registration number is `truck_no` (not `registration_number`) and type is `body_type` (not `truck_type`).
     - In lines 121–122, `truck.truck_no` and `truck.body_type` are read, but they were excluded by the projection!
  2. In [`LiveFleetMapPage.tsx:42`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/LiveFleetMapPage.tsx#L42):
     Frontend queries `api.get('/telematics/live/fleet')`.
     In `trackingRoutes.ts:26`, it is mounted at `/live/fleet`.
     Because `trackingController.ts` returns 0 trucks, the dispatch live map displays an empty state ("0 active vehicles").
- **Impact:** Core operational feature (Live Fleet Map) is completely broken; dispatchers cannot view vehicle locations on the Leaflet map.
- **Existing Tests:** Zero test coverage for `/api/telematics/live/fleet`.
- **Confidence:** Confirmed Defect.

---

#### 4. `ISS-020`: Unthrottled Portal OTP & Public Tracking Endpoints (SMS Flooding & Scraping)
- **Severity:** `P1` / High
- **Finding:**
  1. In [`portalRoutes.ts:23-24`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/routes/portalRoutes.ts#L23-L24):
     ```typescript
     router.post('/send-otp', sendPortalOtp);
     router.post('/verify-otp', verifyPortalOtp);
     ```
     Neither route has rate limiting middleware. An attacker can dispatch thousands of OTP requests in seconds, exhausting SMS credits (SMS Toll Fraud / Telephony DoS) and harassing mobile owners.
  2. In [`portalController.ts:71-84`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/portalController.ts#L71-L84):
     `PortalSession.findOneAndUpdate` sets `otp_attempts: 0` with `{ upsert: true }` on every `send-otp` call. This allows an attacker guessing OTPs to reset brute-force lockout by simply requesting a new OTP, evading the 5-attempt limit.
  3. Non-Atomic Cooldown Check Vulnerable to Race Conditions: Two simultaneous requests can both observe `last_otp_sent_at` as expired, generate two different OTPs, send two SMS messages, and leave the database in an inconsistent state where only the second OTP matches the stored hash while the user received the first OTP.
  4. In `trackingRoutes.ts:22`, `GET /:lrNumber` has zero rate limiting, allowing unhindered automated scraping.
- **Impact:** Telephony toll fraud; financial loss on SMS gateway billing; recipient harassment; brute-force exposure on 6-digit OTPs; race conditions under concurrent requests.
- **Existing Tests:** Zero rate-limiting tests on portal or tracking routes.
- **Confidence:** Confirmed Security Risk.

---

## 5. Recommended Batch 4 Scope

### 5.1. Scope Definition
Batch 4 addresses the entire **External Public & Stakeholder Experience, Telematics Live Map, and Abuse Defense Boundary**. It resolves all four confirmed issues in a unified, cohesive pass:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BATCH 4 RECOMMENDED SCOPE                         │
│     External Stakeholder Portals, Public Tracking & Telematics Hardening    │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. ISS-005: Public Tracking IDOR Elimination, Secure Tokens & UI Contract  │
│  2. ISS-006: Stakeholder Portals Authentication & Real Data Connectivity    │
│  3. ISS-007: Live Fleet Map Schema, Projection & Telematics Alignment       │
│  4. ISS-020: Rate Limiting & Cooldown Protection for OTP & Tracking Routes  │
│  5. TEST-004: Automated Integration Test Suite for Portals & Tracking       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2. Why the Selected Work Forms a Cohesive Batch
1. **Shared Domain Boundary:** All four issues govern external, unauthenticated, or OTP-authenticated entry points into Fleet Flow: public consignment tracking, customer self-service, driver workflow, vendor portal, and dispatcher live map.
2. **Coupled Controllers and Routes:** `trackingController.ts` and `portalController.ts` share the same data models (`Entry`, `Truck`, `TruckJourney`, `Driver`, `BillingParty`, `BalanceParty`) and route mounting infrastructure.
3. **Unified Abuse & Security Model:** Rate limiting (`ISS-020`) applies directly to the public endpoints introduced and refactored in `ISS-005` and `ISS-006`. Implementing rate limiting alongside these endpoints ensures no external route remains unprotected.
4. **Zero Unapproved Dependencies:** Unlike Batch 5 (which is blocked pending Product Owner approval of `DEC-001` subscription pricing), Batch 4 has zero business decision blockers. It operates completely within approved architectural boundaries.

### 5.3. Explicit Exclusions from Batch 4
To maintain strict batch discipline and avoid scope creep, the following items are strictly **excluded** from Batch 4:

| Canonical ID | Area | Reason for Exclusion | Scheduled Batch |
| :--- | :--- | :--- | :--- |
| **`DEC-001` / `ISS-011`–`013`** | Commercial SaaS & Dynamic Billing | Blocked on Product Owner sign-off for pricing matrix seeds and Starter plan entitlements. | Batch 5 |
| **`ISS-015`** | Dashboard Maintenance Enum | Internal executive dashboard KPI counter; belongs to operational infrastructure. | Batch 6 |
| **`OPS-001`–`005`** | SRE, Health Probes & Backups | Deep readiness health probes, backup scripts, and Docker production manifests belong to SRE batch. | Batch 6 |
| **`DEC-003`** | S3 Cloud Storage Migration | **Pending Formal Approval**. Local file storage remains active and hardened. | Batch 6 / Ops |
| **`OPS-002`** | Transactional Outbox (BullMQ) | Persistent outbox for asynchronous notifications remains deferred. Post-commit side effects remain best-effort. | Batch 8 |
| **`FEAT-001`–`003`** | Statutory Government Integrations | NIC E-Way Bill, GST E-Invoicing, and Vahan API require external government sandbox credentials and CA audit. | Batch 10 |

---

## 6. Implementation Considerations

### 6.1. Likely Files and Components Affected

#### Backend:
1. `backend/src/models/Entry.ts`:
   - Add indexed `tracking_token: { type: String, unique: true, sparse: true, index: true }`.
   - Default generation: `trk_${crypto.randomBytes(16).toString('hex')}` (128-bit cryptographic randomness).
   - Collision retry handling on duplicate key (`E11000`).
2. `backend/src/models/PortalSession.ts`:
   - Add `last_otp_sent_at: { type: Date }`.
   - Add `lockout_until: { type: Date }`.
   - Ensure OTP attempt tracking does not reset on generation if a session is actively locked.
3. `backend/src/controllers/trackingController.ts`:
   - Refactor `publicTrackConsignment`:
     - Primary: Support lookup by `token` (`trk_...`).
     - Secondary: Support 3-factor lookup by `company_code` + `lr_no` + `phone`.
     - Reject bare `lr_no` query with HTTP 400.
     - Return synchronized contract DTO matching `PublicTrackingPage.tsx` interface (`carrier`, `transit`, `consignment`, `milestones`).
     - Strictly redact sensitive data: omit freight rates, margin, advance, driver phone, Aadhaar, and raw GPS coordinates.
   - Refactor `getFleetLiveMap`:
     - Query `Truck.find({ company_id: companyId, status: 'active' }).select('_id truck_no body_type make model status')`.
     - Map vehicle registration to `truck_no` and vehicle type to `body_type`.
4. `backend/src/controllers/portalController.ts`:
   - In `sendPortalOtp`:
     - Query `BillingParty.findOne({ company_id, phone })` for `portal_type: 'customer'`.
     - Query `Driver.findOne({ company_id, phone })` for `portal_type: 'driver'`.
     - Query `BalanceParty.findOne({ company_id, phone })` for `portal_type: 'vendor'`.
     - Enforce atomic conditional cooldown via `findOneAndUpdate`.
     - Enforce lockout: If `lockout_until > new Date()`, reject with HTTP 429 without sending OTP.
     - Preserve failed attempts: Do NOT reset `otp_attempts: 0` if previous session is locked.
   - In `verifyPortalOtp`:
     - Query corresponding party (`BillingParty`, `Driver`, `BalanceParty`) by `phone`.
     - Check `lockout_until`; reject if active.
     - Increment `otp_attempts` on failure; if `otp_attempts >= 5`, set `lockout_until: new Date(Date.now() + 15 * 60000)` and reject with HTTP 429.
     - Issue scoped JWT with `{ portalType, entityId, companyId }`.
   - Implement `getVendorDashboard`:
     - Assert `req.portalUser.portalType === 'vendor'`.
     - Fetch trips/movements from `VehicleEntry` where `{ company_id: companyId, balance_party_id: entityId, is_deleted: false }`.
     - Fetch current balance and bank details from `BalanceParty.findOne({ _id: entityId, company_id: companyId })`.
   - Fix `getCustomerDashboard`:
     - Query actual `Entry` fields (`lr_no`, `from_location`, `to_location`, `goods_description`, `package_count`, `actual_weight_tonnes`).
     - Query `Invoice.find({ company_id: companyId, billing_party_id: entityId }).select('_id invoice_number invoice_date total_amount paid_amount balance_amount status')`.
     - Query `BillingParty` fields (`name`, `email`, `phone`).
   - Fix `getDriverCurrentTrip`:
     - Query `TruckJourney.findOne({ company_id, driver_id: entityId, status: 'active' })`.
     - Return `{ trip: journey, current_trip: journey }` for frontend backward-compatibility.
5. `backend/src/middleware/securityMiddleware.ts`:
   - Define `portalOtpSendLimiter`: max 5 requests per 15 minutes per IP.
   - Define `portalOtpVerifyLimiter`: max 5 verification attempts per 1 minute per IP.
   - Define `publicTrackingLimiter`: max 30 requests per minute per IP.
6. `backend/src/routes/portalRoutes.ts`:
   - Mount `portalOtpSendLimiter` on `POST /send-otp`.
   - Mount `portalOtpVerifyLimiter` on `POST /verify-otp`.
   - Mount `GET /vendor/dashboard` protected by `externalPortalAuth`.
7. `backend/src/routes/trackingRoutes.ts`:
   - Mount `publicTrackingLimiter` on public tracking endpoints.
   - Separate public tracking routes from authenticated telematics routes.
8. `backend/src/tests/integration/phase4PortalsAndTracking.test.ts` *(new test suite)*:
   - Dedicated integration tests for public tracking, portal OTP, rate limits, and live map.

#### Frontend:
1. `frontend/src/pages/public/PublicTrackingPage.tsx`:
   - Ensure resilient fallback for both token-based and LR-based tracking.
   - Handle sanitized payload without crashing.
2. `frontend/src/pages/portal/VendorPortalPage.tsx`:
   - Replace static mock data array with real API call to `GET /portal/vendor/dashboard`.
   - Display real trips, freight amounts, advance received, and balance payable.
3. `frontend/src/pages/operations/LiveFleetMapPage.tsx`:
   - Verify compatibility with updated `getFleetLiveMap` response schema.

---

### 6.2. Concurrency-Safe OTP Issuance Protocol
To eliminate race conditions, cooldown bypasses, and inconsistencies between stored OTP hashes and delivered codes under concurrent requests, OTP issuance must adhere to a strict **Atomic Lease Protocol**:

```
Client Requests POST /send-otp (phone, portal_type, company_id)
                      │
                      ▼
 1. Entity Validation: Locate BillingParty / Driver / BalanceParty
                      │
                      ▼
 2. Prepare Candidate: Generate otpCandidate (6-digit) + bcrypt hash otpHash
                      │
                      ▼
 3. Atomic State Claim (Single MongoDB findOneAndUpdate):
    Query Condition:
      - entity_id, portal_type, company_id
      - lockout_until: null OR <= now (assert not in 15-minute brute-force lockout)
      - last_otp_sent_at: null OR <= (now - 60,000ms) (assert cooldown elapsed)
    Update Action:
      - $set: { otp_hash: otpHash, otp_expires_at, last_otp_sent_at: now, phone, is_verified: false }
      - $setOnInsert: { otp_attempts: 0 }
                      │
        ┌─────────────┴─────────────┐
        │                           │
  [Matched & Updated]         [Null / Unmatched]
        │                           │
        ▼                           ▼
 4. Dispatch Telephony:     5. Cooldown / Lockout Rejection:
    Send SMS via Gateway       Check Session:
    (with strict 5s timeout)   - If locked: HTTP 429 ("Account locked")
        │                      - If in cooldown: HTTP 429 ("Wait 60s")
        ▼                      (Zero SMS sent; zero state mutated)
 6. Success Response (HTTP 200)
```

**Why This Guarantees Concurrency Safety:**
- If two identical requests hit the server at the exact same millisecond, MongoDB's document-level write lock ensures only the first request matches the conditional query (`last_otp_sent_at <= now - 60s`).
- The second request immediately sees `last_otp_sent_at` updated to the current timestamp, fails the filter, returns `null`, and exits with HTTP 429.
- The stored hash in the database is guaranteed to match the exact OTP candidate dispatched to the recipient's device. No competing request can overwrite the stored OTP during the active lease.

---

### 6.3. SMS Gateway Delivery Failure Policy
Third-party telephony providers (Twilio, MSG91, Fast2SMS) can experience gateway timeouts, socket disconnects, or carrier rejections:

1. **Fail-Closed on Telephony Error:**
   - Telephony dispatch runs with a strict 5-second timeout.
   - If the gateway throws an error or times out:
     - An error is logged in `AuditLog` / console.
     - **The 60-second cooldown is NOT reset to zero:** Permitting an instant retry upon gateway error creates an SMS flooding and denial-of-wallet vector (attackers can supply malformed phone routing headers to trigger errors and spam upstream providers).
     - **OTP State Retention:** The generated OTP remains stored and valid in MongoDB until `otp_expires_at` (10 minutes). If the SMS was delayed or queued asynchronously by carrier routing, the delivered code remains valid for login.
     - **Attempt Counter Invariance:** Delivery failures do not increment `otp_attempts` (only incorrect verification attempts increment `otp_attempts`).
     - **Client Response:** The endpoint returns HTTP 502 / 500 (`Failed to dispatch SMS via gateway. Cooldown active; please retry after 60 seconds`).
2. **Development / Test Environment Bypass:**
   - In non-production (`NODE_ENV !== 'production'`), `dev_otp` is returned in the API response JSON, guaranteeing that automated Vitest integration suites and local testing are never blocked by external SMS provider downtime.

---

### 6.4. Cryptographic Tracking-Token Uniqueness & Collision Handling
1. **Token Generation:**
   - Tracking tokens are generated via `trk_${crypto.randomBytes(16).toString('hex')}`.
   - 16 bytes = 128 bits of cryptographic entropy ($3.4 \times 10^{38}$ distinct combinations), rendering brute-force enumeration mathematically impossible.
2. **Database Indexing:**
   - `EntrySchema.index({ tracking_token: 1 }, { unique: true, sparse: true })`.
3. **Collision Handling Mechanism:**
   - Although the mathematical probability of collision is negligible, the entry creation logic must wrap document insertion in a collision handler:
   ```typescript
   let attempts = 0;
   while (attempts < 3) {
     try {
       entry.tracking_token = `trk_${crypto.randomBytes(16).toString('hex')}`;
       await entry.save();
       break;
     } catch (err: any) {
       if (err.code === 11000 && err.keyPattern?.tracking_token) {
         attempts++;
         if (attempts >= 3) throw new Error('Failed to generate unique tracking token');
         continue;
       }
       throw err;
     }
   }
   ```
4. **Historical Entries Without Tokens:**
   - Historical records created prior to Batch 4 lack `tracking_token`.
   - Direct raw lookup by `lr_no` alone (e.g. `GET /api/public/track/1001`) returns HTTP 400 Bad Request (`Valid tracking token or verified query credentials required`).
   - Verified 3-factor lookup (`company_code` + `lr_no` + `phone`) acts as the secure fallback. The query resolves `company_code` to `company_id`, then matches `Entry` by `lr_no` and asserts `phone` matches `consignor.phone` or `consignee.phone`. If verification fails, returns HTTP 404 without leaking whether the consignment exists.

---

### 6.5. Rate Limiting Architecture and Deployment Limitations
- **Current Mechanism:** Implemented using `express-rate-limit` with default in-memory `MemoryStore`.
- **Mounted Routes:**
  - `POST /api/portal/send-otp`: `portalOtpSendLimiter` (max 5 requests per 15 min per IP).
  - `POST /api/portal/verify-otp`: `portalOtpVerifyLimiter` (max 5 attempts per 1 min per IP).
  - `GET /api/public/track`: `publicTrackingLimiter` (max 30 requests per minute per IP).
- **Deployment Limitations:**  
  1. In-memory counters are local to the running Node.js process. When the application runs across multiple clustered worker instances or a horizontally scaled container cluster, rate-limiting windows are partitioned across instances rather than shared globally.
  2. Server restarts reset in-memory counters.
  3. **Architectural Path:** For single-node development and staging, `express-rate-limit` provides verified abuse defense against sequential scraping and automated SMS flooding. Multi-node production deployment requires a shared Redis store via `rate-limit-redis`, which is scheduled alongside Redis provisioning in Batch 6 / Batch 8.

---

## 7. Refined Acceptance Criteria

```
+-----------------------------------------------------------------------------------------------------------------------+
| Domain / Issue | Target Scenario                                    | Objective Acceptance Criteria                   |
+-----------------------------------------------------------------------------------------------------------------------+
| ISS-005        | Public tracking query with raw lr_no only          | Rejected with HTTP 400 Bad Request; zero        |
| (Tokens & IDOR)| (e.g. GET /api/public/track/1001)                  | cross-tenant consignment data leaked.           |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Public tracking query with valid tracking_token    | Returns HTTP 200 with sanitized tracking DTO;   |
|                |                                                    | 128-bit cryptographically unique token;         |
|                |                                                    | PublicTrackingPage renders without TypeError.   |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Redaction of sensitive commercial & PII fields     | Response payload strictly OMITS: freight rate,  |
|                |                                                    | advance, invoice balance, driver phone, Aadhaar,|
|                |                                                    | license, and raw GPS coordinates.               |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Historical entries without tracking_token          | Rejects raw lr_no query with HTTP 400; accepts  |
|                |                                                    | verified 3-factor lookup (company_code + lr_no  |
|                |                                                    | + phone); returns 404 if phone does not match.  |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Negative cross-tenant lookup attempt               | Querying Tenant A's LR using Tenant B's code or |
|                |                                                    | phone returns HTTP 404 (zero tenant leakage).   |
+----------------+----------------------------------------------------+-------------------------------------------------+
| ISS-006        | Customer OTP request with registered phone         | Matches phone on BillingParty; sends OTP (200). |
| (Portals Auth) +----------------------------------------------------+-------------------------------------------------+
|                | Vendor OTP request with registered phone           | Matches phone on BalanceParty; sends OTP (200). |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Vendor dashboard data isolation                    | GET /api/portal/vendor/dashboard returns        |
|                |                                                    | movements & payables scoped strictly to         |
|                |                                                    | authenticated balance_party_id and company_id;  |
|                |                                                    | Vendor A cannot view Vendor B or Tenant B data. |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Vendor portal UI live rendering                    | /portal/vendor renders live movements & balance |
|                |                                                    | fetched from API; 0 mock data arrays rendered.  |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Customer dashboard projections & invoices          | Returns real consignments with correct fields   |
|                |                                                    | (lr_no, from_location) and non-empty invoices.  |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Driver portal active trip status                   | Returns active TruckJourney matching 'active'   |
|                |                                                    | status; UI renders vehicle number & route.      |
+----------------+----------------------------------------------------+-------------------------------------------------+
| ISS-007        | Dispatcher Live Fleet Map data fetching            | GET /api/telematics/live/fleet returns active   |
| (Live Map)     |                                                    | trucks matching Truck.status == 'active';       |
|                |                                                    | truck_no & body_type populated; map renders.    |
+----------------+----------------------------------------------------+-------------------------------------------------+
| ISS-020        | Rapid OTP requests (>5 in 15 mins from same IP)    | Blocked with HTTP 429 Too Many Requests.        |
| (Abuse Defense)+----------------------------------------------------+-------------------------------------------------+
|                | Resend OTP within 60 seconds (single or concurrent)| Atomically blocked with HTTP 429 Cooldown;      |
|                |                                                    | exactly 1 of concurrent requests acquires lease.|
|                +----------------------------------------------------+-------------------------------------------------+
|                | Lockout persistence across resend attempts         | 5 failed verify attempts locks for 15 minutes;  |
|                |                                                    | requesting another OTP does NOT reset lockout!  |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Telephony delivery failure handling                | Returns HTTP 502/500; preserves cooldown;       |
|                |                                                    | does not reset last_otp_sent_at or attempt count|
|                +----------------------------------------------------+-------------------------------------------------+
|                | Rapid verification attempts (>5 in 1 min from IP)  | Blocked with HTTP 429 Too Many Requests.        |
|                +----------------------------------------------------+-------------------------------------------------+
|                | Repeated public tracking scrapes (>30/min from IP) | Blocked with HTTP 429 Rate Limit Exceeded.      |
+----------------+----------------------------------------------------+-------------------------------------------------+
| TEST-004       | Automated Vitest test suite execution              | 100% green; zero cross-tenant IDOR leakage;     |
|                |                                                    | concurrent leases, cooldowns, and locks verified|
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 8. Verification Plan

### 8.1. Exact Verification Commands (Repository Package Scripts)
The following commands exist in the repository and must be executed during Batch 4 verification:

1. **Targeted Portals, Tracking & Rate Limiting Integration Suite:**
   ```powershell
   npx vitest run src/tests/integration/phase4PortalsAndTracking.test.ts
   ```
2. **Complete Backend Regression Test Suite (All 10 Suites):**
   ```powershell
   npm test
   ```
   *Baseline: 135/135 tests passing across 9 suites.*  
   *Target with Batch 4: ~150/150 tests passing across 10 suites.*
3. **Backend TypeScript Production Compilation:**
   ```powershell
   npm run build
   ```
   *(Executes `tsc` in `backend`, must exit with code 0).*
4. **Frontend TypeScript & Production Bundle:**
   ```powershell
   npm run build
   ```
   *(Executes `tsc -b && vite build` in `frontend`, must exit with code 0).*

### 8.2. Required Specific Integration Scenarios (`TEST-004`)
The new integration suite `backend/src/tests/integration/phase4PortalsAndTracking.test.ts` must implement:
1. **Concurrent OTP Burst Test:**
   - Execute `Promise.all([sendOtp(phone), sendOtp(phone), sendOtp(phone)])`.
   - Assert exactly 1 request returns HTTP 200 and exactly 2 return HTTP 429 Cooldown.
   - Assert database hash matches the successful request candidate.
2. **Lockout Persistence Test:**
   - Submit 5 invalid OTPs to `/verify-otp`.
   - Assert session enters 15-minute lockout (HTTP 429).
   - Call `/send-otp` during lockout. Assert request is rejected with HTTP 429 (`Account locked`).
   - Call `/verify-otp` again. Assert request remains rejected with HTTP 429 (lockout not cleared).
3. **SMS Delivery Failure Test:**
   - Mock SMS gateway rejection/timeout.
   - Assert API returns HTTP 502/500, cooldown is active (immediate subsequent request returns HTTP 429), and `otp_attempts` is not incremented.
4. **Tracking Token Collision & Recovery Test:**
   - Test duplicate key recovery logic on token generation.
5. **Historical Records Without Token Test:**
   - Seed `Entry` lacking `tracking_token`.
   - Assert raw LR lookup returns HTTP 400.
   - Assert 3-factor lookup (`company_code` + `lr_no` + `phone`) returns HTTP 200 with sanitized DTO.
   - Assert wrong phone returns HTTP 404.
6. **Vendor Dashboard Isolation Test:**
   - Issue portal JWT for Vendor A.
   - Query `GET /api/portal/vendor/dashboard`. Assert only Vendor A movements and payables are returned.
   - Attempt to access Vendor B or Tenant B data. Assert 0 records returned.

### 8.3. Manual and Runtime Verifications
1. Navigate to `/track`: submit invalid LR number, submit valid token, verify zero React console errors.
2. Navigate to `/portal/customer`: log in with customer test phone and OTP, verify consignments and invoices render.
3. Navigate to `/portal/vendor`: log in with vendor test phone and OTP, verify real vehicle entries render instead of mock data.
4. Navigate to `/operations/live-map`: verify active company vehicles render with registration numbers.

### 8.4. Docker and Environment Limitations
- Host Docker daemon remains unavailable in the local environment. Docker runtime checks remain blocked. Compose manifests will be verified via static inspection.

---

## 9. Risks, Dependencies, and Open Questions

| Risk / Dependency | Impact | Status | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **DEC-003 Scope Boundary** | Cloud S3 migration remains pending. | **Pending Approval** | Batch 4 uses zero cloud storage; local file handling remains unchanged. |
| **Notification Reliability** | Background SMS/WhatsApp OTP dispatches remain best-effort without an outbox. | Known Constraint | Retain try/catch isolation on external dispatches; return dev OTP in non-production. |
| **Rate Limit Storage** | In-memory `express-rate-limit` resets on server restart and clusters across workers. | Known Limitation | In-memory limiter is standard for single-node; Redis-backed store deferred to Batch 6/8. |
| **Historical LRs without Tokens** | Existing consignments lack `tracking_token`. | Backward Compatibility | Allow 3-factor lookup (`company_code` + `lr_no` + `phone`) as verified fallback. |
| **Implementation Approval** | No code may be edited without user authorization. | Gate Active | Preflight report only; wait for explicit user approval before editing code. |

---

## 10. Approval Gate

- [x] **Preflight Audit Complete:** Repository state inspected, clean working tree confirmed, active defects verified against source code.
- [x] **Zero Code Changes:** No implementation files, test files, or configurations have been touched.
- [x] **DEC-002 Preserved:** Replica set topology requirements remain enforced; Docker daemon limitation noted.
- [x] **DEC-003 Preserved:** Cloud S3 migration remains strictly **Pending Approval**.
- [x] **Deferred Outbox Preserved:** Transactional outbox remains scheduled for Batch 8 (`OPS-002`).
- [ ] **Implementation Gate:** **Batch 4 implementation has NOT started.** Awaiting explicit user review and formal authorization to begin implementation.
