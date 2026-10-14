# Fleet Flow — Documentation Changelog

**Log Maintained By:** Principal Software Architect & QA Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Purpose:** Comprehensive audit log of all structural, architectural, and governance modifications made to the Fleet Flow documentation library.

---

## Release 2.1.0 — 100% Documentation Library Reconciliation (October 2026)

### 1. Master Register Comprehensive Index Synchronization
1. **[`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md)**:
   - Upgraded to Version 2.1.0.
   - Restructured Section 1.1 into 6 clean, domain-specific subsections (Core Governance, Commercial MVP Audits, Batches 1–6 Reports, Baseline Audits, Phase Plans, and Foundational/Historical work).
   - Added missing links for all 10 Batch 1–6 preflight and implementation reports (`BATCH_1_PREFLIGHT_REPORT.md` through `BATCH_6C_IMPLEMENTATION_REPORT.md`).
   - Added links for the Pre-Launch Commercial Readiness Audit (`WEBSITE_FEATURE_COMPLETENESS_AUDIT.md`), Complete Website QA Checklist (`FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md`), and QA Visual Evidence guide (`evidence/README.md`).
   - Added Operations Runbook (`DISASTER_RECOVERY_RUNBOOK.md`) to Section 5.
   - Added Manual QA items (`TEST-MANUAL`, `TEST-EVID`) to Section 6.
   - Hyperlinked all 14 legacy issues (`ISSUE-01.md` through `ISSUE-14.md`) in Section 8 table.
   - Linked root foundational spec (`TRUCK_MANAGEMENT_SAAS_COMPLETE_SPEC.md`).
   - Quantitative validation: 100% of all 101 `.md` files in `docs/` and 4 root markdown files are linked (176 active valid markdown links, 0 broken).

---

## Release 2.0.0 — Documentation Reconciliation & Implementation Readiness Gate (October 2026)

### 1. New Governance & Planning Documents Created
1. **[`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md)**:
   - Upgraded to Version 2.0.0 as the central, authoritative master register.
   - Comprehensive documentation library sitemap and complete cross-linking to all audit reports, phase plans, and canonical specifications.
   - Verified quantitative document count: 53 active canonical specifications, 14 preserved legacy issues, 11 audit documents, 6 phase plans (total 84 files in `docs/`).
   - Detailed status tables separating P0 launch blockers from P1 commercial essentials, P2 improvements, and P3 advanced statutory features.
   - True legacy reconciliation map restoring accurate titles and superseding relationships for `ISSUE-01` through `ISSUE-14`.
2. **[`docs/IMPLEMENTATION_READINESS_BACKLOG.md`](../IMPLEMENTATION_READINESS_BACKLOG.md)**:
   - Classifies every canonical item into P0 (11 items), P1 (21 items), P2 (13 items), or P3 (8 items).
   - Provides for every item: Canonical ID, why it matters, dependencies, decision requirements, external provider prerequisites, recommended batch, and objective verification evidence required before closure.
   - Distinguishes MVP launch requirements from optional future statutory integrations (NIC E-Way Bill, GST E-Invoicing, VAHAN/Sarathi, FASTag, Fuel Cards, Section 194C TDS).
3. **[`docs/IMPLEMENTATION_BATCHES.md`](../IMPLEMENTATION_BATCHES.md)**:
   - Defines an engineering sequencing blueprint grouping work into reviewable batches.
   - Batches 1 through 6 establish the MVP Commercial Launch Gate:
     - Batch 1: Tenant Isolation Boundary, File Security & HTTP Test Framework (`P0`)
     - Batch 2: Database Topology, Aggregation Types & Concurrency Hardening (`P0`/`P1`)
     - Batch 3: Double-Entry Financial Integrity, Ledger Invariants & Commercial UI (`P0`/`P1`)
     - Batch 4: Public Tracking Privacy & Stakeholder Portals Hardening (`P0`/`P1`)
     - Batch 5: Commercial SaaS, Dynamic Billing & Entitlements Engine (`P1`)
     - Batch 6: Operational Infrastructure, Verification Probes & Launch Runbook (`P1`)
   - Batches 7 through 11 organize post-launch improvements and statutory enterprise integrations.
   - Every batch details explicit scope, non-goals, affected files, acceptance criteria, automated/manual tests, and exit conditions.
4. **[`docs/audit/DOCUMENTATION_CHANGELOG.md`](./DOCUMENTATION_CHANGELOG.md)**:
   - Authoritative audit record of documentation updates and architectural decisions.
5. **[`docs/audit/DOCUMENTATION_RECONCILIATION_REPORT.md`](./DOCUMENTATION_RECONCILIATION_REPORT.md)**:
   - Formal validation and readiness gate audit report summarizing findings, resolutions, link validations, and Batch 1 presentation.

---

### 2. Specification Reconciliations & Conflict Resolutions

#### Conflict A: MongoDB Multi-Document Transactions & Deployment Topologies
- **Files Reconciled**: [`docs/issues/ISS-018-acid-transactions-standalone-mongo.md`](../issues/ISS-018-acid-transactions-standalone-mongo.md), [`docs/decisions/DEC-002-mongodb-transactions-standalone-strategy.md`](../decisions/DEC-002-mongodb-transactions-standalone-strategy.md).
- **Core Changes**:
  - Eliminated the proposed silent non-transactional fallback for financial and dispatch workflows.
  - Established supported MongoDB deployment topologies across all environments:
    - **Development**: Mandatory single-node Replica Set (`rs0`) via Docker Compose with automated `rs.initiate()` healthcheck.
    - **Testing / CI**: `MongoMemoryReplSet` via `mongodb-memory-server` in Vitest/Supertest test runners.
    - **Staging**: 3-node MongoDB Replica Set cluster or MongoDB Atlas dedicated tier.
    - **Production**: High-availability multi-node Replica Set (minimum 3 nodes) with `majority` write concern and point-in-time oplog backups (`OPS-003`).
  - Updated `runInTransaction` specification in `transactionHelper.ts` to assert replica set support and fail-fast with a descriptive `ConfigurationError` if an un-replicated standalone instance is detected.
  - Specified that any non-transactional asynchronous workflow (non-financial) must define consistency guarantees, two-phase compensation logic, and automated recovery tests separately.

#### Conflict B: Commercial Pricing, Truck Quotas & Starter Plan Entitlements
- **Files Reconciled**: [`docs/issues/ISS-011-pricing-page-seed-discrepancy.md`](../issues/ISS-011-pricing-page-seed-discrepancy.md), [`docs/issues/ISS-012-starter-plan-entitlement-trap.md`](../issues/ISS-012-starter-plan-entitlement-trap.md), [`docs/decisions/DEC-001-subscription-pricing-and-entitlements.md`](../decisions/DEC-001-subscription-pricing-and-entitlements.md).
- **Core Changes**:
  - Explicitly isolated the commercial choices requiring Product Owner approval (Proposal 1 Marketing Alignment vs Proposal 2 Seed Alignment vs Custom, Starter plan inclusion of 3-part LRs and Invoicing, annual discounts, add-on pricing, trial duration, and proration mechanics).
  - Avoided unilaterally deciding or inventing prices; presented structured options for Product Owner review.
  - Established the architectural **Single Source of Truth**: The MongoDB `plans`/`addons` collections and `/api/billing/plans` backend endpoint must be the sole authority, dynamically consumed by `PricingPage.tsx`, registration cards, checkout flows, and backend entitlement middleware (`requireFeature`, quota guards).
  - Eliminated static price hardcoding in frontend components.

#### Conflict C: File Storage Architecture & Directory Traversal Defense
- **Files Reconciled**: [`docs/issues/ISS-017-local-storage-path-traversal.md`](../issues/ISS-017-local-storage-path-traversal.md), [`docs/decisions/DEC-003-storage-architecture-s3-vs-local.md`](../decisions/DEC-003-storage-architecture-s3-vs-local.md).
- **Core Changes**:
  - Specified universal security requirements enforced across all storage providers: strict path normalization, root jailing, unguessable UUID storage keys (`uuidv4()`), multi-tenant key scoping (`tenants/${companyId}/${category}/${uuid}.${ext}`), private-by-default buckets/folders, and pre-upload magic byte checks (`ISS-016`).
  - Defined operational differences: Local development permits sandboxed local disk storage (`LOCAL_STORAGE_DIR`) or local containerized MinIO for offline productivity; production strictly mandates S3-compatible cloud object storage (AWS S3 / Cloudflare R2) with server-side encryption and 15-minute expiring pre-signed URLs, completely disallowing local disk storage due to container ephemerality and multi-node scaling.

#### Conflict D: Public Consignment Milestone Tracking Contract
- **Files Reconciled**: [`docs/issues/ISS-005-public-tracking-privacy-idor.md`](../issues/ISS-005-public-tracking-privacy-idor.md), [`docs/plans/PHASE_6_HARDENING_VERIFICATION_RELEASE.md`](../plans/PHASE_6_HARDENING_VERIFICATION_RELEASE.md).
- **Core Changes**:
  - Reconciled older bare LR-number tracking routes with privacy and enumeration defenses.
  - Established the primary tracking contract: Unguessable 128-bit cryptographic token (`tracking_token`) delivered via transactional WhatsApp/SMS notifications (`/track?token=...`).
  - Established secondary tracking contract: Multi-factor lookup requiring `Company Code` + `LR Number` + `Consignor/Consignee Phone Number` (or SMS OTP); bare LR lookup across tenants is strictly rejected.
  - Harmonized backend and frontend response schemas: Formalized `PublicShipmentTrackingDTO` returning milestone status, origin/destination hubs, estimated delivery, and event log, with strict redaction of driver phone numbers, driver identity, pricing/freight values, and raw GPS coordinates.
  - Enforced IP rate limiting (20 req/min) via `express-rate-limit`.

#### Conflict E: Legacy Issue Mapping & Reconciliation Corrections
- **Files Reconciled**: [`docs/audit/EXISTING_DOCUMENTATION_RECONCILIATION.md`](./EXISTING_DOCUMENTATION_RECONCILIATION.md), [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md).
- **Core Changes**:
  - Corrected a previous internal documentation defect where audit findings were mistakenly matched against legacy issue numbers sequentially rather than by true subject matter.
  - Restored true titles for all 14 legacy documents (`ISSUE-01.md` through `ISSUE-14.md`) and mapped each to its true canonical superseding specifications.

---

### 3. Hyperlink Validation & Slash Normalization
- Converted **454 markdown links** across **62 documentation files** from Windows backslashes (`\`) to standard forward slashes (`/`), ensuring cross-platform markdown viewer and browser compatibility.
- Fixed broken hyperlink in `docs/audit/CURRENT_STATE_AUDIT.md` line 99, removing reference to non-existent `operations/LRListPage.tsx` and directing to `frontend/src/pages/commercial/LRListPage.tsx`.
- Automated test script confirmed **0 broken links** across the entire documentation library.

---

## Batch 1 Implementation & Quality Assurance Verification (October 2026)

### 1. Specifications Verified & Resolved
- **`TEST-001`**: Automated HTTP integration test infrastructure with Vitest, Supertest, and `mongodb-memory-server` instantiated (`backend/src/tests/setup.ts`, `backend/src/tests/helpers.ts`). Added `npm test` script.
- **`ISS-001`**: Mounted `resolveTenantContext` across Express routers: `branchRoutes.ts`, `approvalRoutes.ts`, `commercialReportRoutes.ts`, `supportRoutes.ts`, and `trackingRoutes.ts`.
- **`ISS-002`**: Enhanced Mongoose `tenantPlugin.ts` to intercept all query and mutation hooks (`updateOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `distinct`, etc.) and prepended tenant match to `aggregate`. Added safe-fail query guard requiring explicit `{ skipTenantCheck: true }` for cross-tenant operations. Applied plugin to `CustomFieldDefinition`.
- **`ISS-016`**: Mounted `fileSecurityMiddleware` (`validateFileMagicBytes`) on `POST /api/documents/upload` in `backend/src/routes/documentRoutes.ts`.
- **`ISS-017`**: Hardened `backend/src/utils/storageService.ts` with strict path jailing (`getLocalFilePath`), rejection of traversal tokens (`..`, null bytes), file extension allowlisting, and tenant directory containment.
- **`TEST-002`**: Implemented cross-tenant boundary verification suite (`backend/src/tests/integration/tenantIsolation.test.ts`) validating 100% rejection of unauthorized cross-tenant operations.

### 2. Verification Outcomes
- **Automated Tests**: 4 test files, 38 tests executed, 38 passed (100% pass rate).
- **TypeScript Backend Build**: `tsc` completed with exit code 0 (zero compilation errors).
- **Registers & Backlogs Updated**: `FLEET_FLOW_MASTER_REGISTER.md`, `IMPLEMENTATION_READINESS_BACKLOG.md`, individual issue specs in `docs/issues/` and `docs/testing/` marked `Verified`.
- **Decision Gates**: `DEC-003` remains Pending Approval for production-only S3 enforcement, while local storage path containment and magic byte checks are fully implemented and verified.

---

## Batch 1.1 Security Hardening & Post-Review Findings Resolution (October 2026)

### 1. Findings Resolved
- **`H-01` — AuditLog Tenant Isolation**: Attached `tenantPlugin` to `AuditLogSchema` in `backend/src/models/AuditLog.ts`. Eliminated duplicate compound index definition. Added tests verifying that cross-tenant read/write attempts on audit logs are strictly prevented.
- **`M-01` — Tenant-Specific Upload Containment**: Hardened `uploadTenantFile()` in `backend/src/utils/storageService.ts` to require `companyId`, enforce key prefixing (`tenants/${companyId}/`), and validate that resolved paths reside strictly within `LOCAL_STORAGE_DIR/tenants/${companyId}`. Updated `documentController.ts`. Added integration tests for legitimate uploads, cross-tenant keys, and directory escape attempts.
- **`M-02` — Secure skipTenantCheck**: Updated `tenantPlugin.ts` to check query options (`this.getOptions().skipTenantCheck === true`) rather than query-filter parameters. Purged `filter.skipTenantCheck` from filters to prevent client filter manipulation. Updated privileged call sites in `superAdminController.ts` and `trackingController.ts` to `.setOptions({ skipTenantCheck: true })`. Added automated regression tests proving filter `{ skipTenantCheck: true }` cannot bypass isolation.
- **`M-03` — Strict File-Signature Validation**: Hardened `cryptoService.ts` with complete 12-byte WebP validation (`RIFF` at 0–3, `WEBP` at 8–11). Replaced fail-open behavior with fail-closed rejection on unsupported or unmapped MIME types. Handled empty and truncated files. Wrapped Multer in `documentController.ts` to return HTTP 415 on rejected MIME types.
- **`M-04` — Bulk Insert (insertMany) Tenant Protection**: Extended `tenantPlugin.ts` with `schema.pre('insertMany')` middleware to enforce active tenant scoping, block mismatched `company_id` overrides, and safe-fail when tenant context is missing unless explicit `skipTenantCheck` option is provided. Added comprehensive automated tests.

### 2. Additional Review Tests Added
- `$geoNear` aggregation preserving `$geoNear` at stage 0 and inserting `{ $match: { company_id } }` at stage 1.
- Valid Tenant A JWT token combined with Tenant B `X-Company-ID` header returns HTTP 403 Forbidden.
- Empty (0-byte) and truncated (< 12 bytes) file uploads rejected with HTTP 415.
- Cross-tenant upload attempts blocked.

### 3. Verification Outcomes
- **Automated Tests**: 4 test files, 59 tests executed, 59 passed (100% pass rate).
- **TypeScript Backend Build**: `tsc` completed with exit code 0 (zero errors).
- **Decision Invariant**: `DEC-003` remains Pending Approval; production-only S3 migration was not prematurely enforced.

