# Fleet Flow — Authoritative Master Issue, Improvement & Feature Register

**Document Version:** 2.1.0  
**Audit & Specification Date:** October 2026  
**Auditor & Principal Architect:** Independent Systems Reviewer & Principal Architect  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Standardized Identifier Conventions:**
- `ISS-###`: Defects, security vulnerabilities, architectural flaws, and integration gaps.
- `IMP-###`: Enhancements, optimizations, and usability improvements to existing capabilities.
- `FEAT-###`: Major functional capabilities, statutory modules, and external integrations.
- `OPS-###`: Production infrastructure, containerization, disaster recovery, and reliability requirements.
- `TEST-###`: Automated testing frameworks, cross-tenant isolation suites, and CI/CD verification.
- `DEC-###`: Architectural, commercial, and policy decisions requiring product owner or lead architect approval.

---

## 1. Executive Summary & Authoritative Index Overview

This document serves as the **central, authoritative master register** for all technical and functional specifications in the Fleet Flow SaaS platform. Every item listed here corresponds to a dedicated, individually actionable specification file in `docs/issues/`, `docs/improvements/`, `docs/features/`, `docs/operations/`, `docs/testing/`, `docs/audit/`, `docs/plans/`, or `docs/decisions/`.

### 1.1 Complete Documentation Library Sitemap

#### A. Core Governance & Architecture Blueprints
- **Authoritative Master Register**: [`docs/FLEET_FLOW_MASTER_REGISTER.md`](./FLEET_FLOW_MASTER_REGISTER.md) — Central source of truth for all requirements, defects, and specifications.
- **Implementation Readiness Backlog**: [`docs/IMPLEMENTATION_READINESS_BACKLOG.md`](./IMPLEMENTATION_READINESS_BACKLOG.md) — Risk-adjusted priority ranking (P0 through P3) across all canonical items.
- **Implementation Batches Blueprint**: [`docs/IMPLEMENTATION_BATCHES.md`](./IMPLEMENTATION_BATCHES.md) — Engineering delivery roadmap sequencing Batches 1 to 11.
- **Documentation Changelog**: [`docs/audit/DOCUMENTATION_CHANGELOG.md`](./audit/DOCUMENTATION_CHANGELOG.md) — Comprehensive audit log of all documentation modifications.
- **Documentation Reconciliation Report**: [`docs/audit/DOCUMENTATION_RECONCILIATION_REPORT.md`](./audit/DOCUMENTATION_RECONCILIATION_REPORT.md) — Formal readiness gate sign-off report.
- **Legacy Issue Reconciliation**: [`docs/audit/EXISTING_DOCUMENTATION_RECONCILIATION.md`](./audit/EXISTING_DOCUMENTATION_RECONCILIATION.md) — Forensic reconciliation of legacy claims vs code reality.

#### B. Commercial MVP Readiness & Manual QA Test Workbooks
- **Website Feature Completeness Audit**: [`docs/audit/WEBSITE_FEATURE_COMPLETENESS_AUDIT.md`](./audit/WEBSITE_FEATURE_COMPLETENESS_AUDIT.md) — Exhaustive pre-launch commercial readiness evaluation across UI, API, DB, and SRE.
- **Complete Website Manual QA Checklist**: [`docs/testing/FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md`](./testing/FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md) — 2,300+ line master manual QA test workbook, execution sequence, defect register & retest tracker.
- **Manual QA Evidence Directory Guide**: [`docs/testing/evidence/README.md`](./testing/evidence/README.md) — Standards and naming rules for visual screenshots, network captures, and console logs.

#### C. Engineering Batch Execution & Milestone Verification Reports (Batches 1–6)
- **Batch 1 Preflight Report**: [`docs/audit/BATCH_1_PREFLIGHT_REPORT.md`](./audit/BATCH_1_PREFLIGHT_REPORT.md) — Tenant isolation boundary, file upload security & HTTP test framework preflight.
- **Batch 2 Preflight Report**: [`docs/audit/BATCH_2_PREFLIGHT_REPORT.md`](./audit/BATCH_2_PREFLIGHT_REPORT.md) — MongoDB replica set topology, aggregation typing & ACID concurrency preflight.
- **Batch 3 Preflight Report**: [`docs/audit/BATCH_3_PREFLIGHT_REPORT.md`](./audit/BATCH_3_PREFLIGHT_REPORT.md) — Double-entry general ledger, credit notes, vendor payouts & GSTIN validation preflight.
- **Batch 4 Preflight Report**: [`docs/audit/BATCH_4_PREFLIGHT_REPORT.md`](./audit/BATCH_4_PREFLIGHT_REPORT.md) — Public tracking IDOR defense, customer/vendor portals & OTP rate limiting preflight.
- **Batch 5 Preflight Report**: [`docs/audit/BATCH_5_PREFLIGHT_REPORT.md`](./audit/BATCH_5_PREFLIGHT_REPORT.md) — Subscription plan entitlements, truck quota enforcement & Razorpay checkout preflight.
- **Batch 5 Implementation Report**: [`docs/audit/BATCH_5_IMPLEMENTATION_REPORT.md`](./audit/BATCH_5_IMPLEMENTATION_REPORT.md) — Dynamic billing catalog, quota enforcement & webhook idempotency verification.
- **Batch 6 Preflight Report**: [`docs/audit/BATCH_6_PREFLIGHT_REPORT.md`](./audit/BATCH_6_PREFLIGHT_REPORT.md) — Docker containerization, deep health probes & backup/recovery preflight.
- **Batch 6A Implementation Report**: [`docs/audit/BATCH_6A_IMPLEMENTATION_REPORT.md`](./audit/BATCH_6A_IMPLEMENTATION_REPORT.md) — Deep readiness & liveness health probes implementation verification.
- **Batch 6B Implementation Report**: [`docs/audit/BATCH_6B_IMPLEMENTATION_REPORT.md`](./audit/BATCH_6B_IMPLEMENTATION_REPORT.md) — Production Docker containerization & multi-environment compose architecture verification.
- **Batch 6C Implementation Report**: [`docs/audit/BATCH_6C_IMPLEMENTATION_REPORT.md`](./audit/BATCH_6C_IMPLEMENTATION_REPORT.md) — Automated database backup, retention policy & disaster recovery verification.

#### D. Architectural Baseline & Domain Audit Reports (9 Documents)
- [`CURRENT_STATE_AUDIT.md`](./audit/CURRENT_STATE_AUDIT.md) — Feature-by-feature codebase verification report.
- [`DOCUMENTATION_COMPLETENESS_REVIEW.md`](./audit/DOCUMENTATION_COMPLETENESS_REVIEW.md) — Requirement completeness and workflow validation.
- [`EXISTING_DOCUMENTATION_RECONCILIATION.md`](./audit/EXISTING_DOCUMENTATION_RECONCILIATION.md) — Historical issue status forensic review.
- [`FINANCE_AND_SUBSCRIPTION_AUDIT.md`](./audit/FINANCE_AND_SUBSCRIPTION_AUDIT.md) — Double-entry bookkeeping & subscription billing audit.
- [`PRODUCTION_AND_OPERATIONS_AUDIT.md`](./audit/PRODUCTION_AND_OPERATIONS_AUDIT.md) — SRE, Docker, MongoDB topology & deployment audit.
- [`PRODUCT_GAP_CANDIDATES.md`](./audit/PRODUCT_GAP_CANDIDATES.md) — Catalog of candidate enterprise transport features.
- [`REPOSITORY_INVENTORY.md`](./audit/REPOSITORY_INVENTORY.md) — Complete codebase inventory, routes, middleware, and models catalog.
- [`SECURITY_AND_DATA_ISOLATION_AUDIT.md`](./audit/SECURITY_AND_DATA_ISOLATION_AUDIT.md) — Multi-tenancy boundaries, JWT auth & IDOR audit.
- [`UX_AND_WORKFLOW_AUDIT.md`](./audit/UX_AND_WORKFLOW_AUDIT.md) — Frontend navigation, layout, forms, and usability audit.

#### E. Master Architecture Phase Implementation Plans (6 Documents)
- [`PHASE_1_FOUNDATION_AND_TENANCY.md`](./plans/PHASE_1_FOUNDATION_AND_TENANCY.md) — Multi-tenancy architecture, auth & design system foundation.
- [`PHASE_2_MASTER_REGISTRIES.md`](./plans/PHASE_2_MASTER_REGISTRIES.md) — Truck, driver, party master registries & compliance document vault.
- [`PHASE_3_OPERATIONS_AND_DISPATCH.md`](./plans/PHASE_3_OPERATIONS_AND_DISPATCH.md) — Dispatch, journey lifecycle, trip sheets & driver cash advances.
- [`PHASE_4_COMMERCIAL_FINANCE_SETTLEMENTS.md`](./plans/PHASE_4_COMMERCIAL_FINANCE_SETTLEMENTS.md) — 3-part LRs, invoices, trip settlements & ledger.
- [`PHASE_5_SAAS_BILLING_ENTITLEMENTS_CUSTOMIZATION.md`](./plans/PHASE_5_SAAS_BILLING_ENTITLEMENTS_CUSTOMIZATION.md) — Dynamic billing engine, feature flags & quotas.
- [`PHASE_6_HARDENING_VERIFICATION_RELEASE.md`](./plans/PHASE_6_HARDENING_VERIFICATION_RELEASE.md) — Security hardening, telemetry, containerization & launch runbooks.

#### F. Foundational & Historical Documentation Preserved (Root & Legacy)
- **Foundational Master Specification**: [`TRUCK_MANAGEMENT_SAAS_COMPLETE_SPEC.md`](../TRUCK_MANAGEMENT_SAAS_COMPLETE_SPEC.md) — The 200KB original foundational multi-tenant SaaS architecture specification.
- **Master Implementation Plan**: [`MASTER_IMPLEMENTATION_PLAN.md`](../MASTER_IMPLEMENTATION_PLAN.md) — Original multi-phase architecture blueprint.
- **Root Issue Tracker**: [`ISSUES.md`](../ISSUES.md) — Legacy issue ledger.
- **Historical Implementation Changelog**: [`IMPLEMENTATION_CHANGELOG.md`](../IMPLEMENTATION_CHANGELOG.md) — Historical development logs.
- **Legacy Issue Specifications (14 Files)**:
  - [`ISSUE-01.md`](./issues/ISSUE-01.md) — Enforce Subscription Status and Plan Permissions
  - [`ISSUE-02.md`](./issues/ISSUE-02.md) — Complete and Secure Real Subscription Payments
  - [`ISSUE-03.md`](./issues/ISSUE-03.md) — Harden Authentication and Account Recovery
  - [`ISSUE-04.md`](./issues/ISSUE-04.md) — Verify and Enforce Tenant Isolation Across the Entire API
  - [`ISSUE-05.md`](./issues/ISSUE-05.md) — Make Financial Records Dependable & Accounting Sound
  - [`ISSUE-06.md`](./issues/ISSUE-06.md) — Real Notifications and Background Jobs
  - [`ISSUE-07.md`](./issues/ISSUE-07.md) — Complete Fleet Maintenance Management
  - [`ISSUE-08.md`](./issues/ISSUE-08.md) — Advanced Trip Tracking and Driver Workflows
  - [`ISSUE-09.md`](./issues/ISSUE-09.md) — Complete Commercial and Accounting Operations
  - [`ISSUE-10.md`](./issues/ISSUE-10.md) — Customer, Driver, and Vendor Self-Service Portals
  - [`ISSUE-11.md`](./issues/ISSUE-11.md) — Finish Configurable Company Features
  - [`ISSUE-12.md`](./issues/ISSUE-12.md) — Support, Customer Onboarding & Offboarding Lifecycle
  - [`ISSUE-13.md`](./issues/ISSUE-13.md) — Security, Privacy, and Production Operations
  - [`ISSUE-14.md`](./issues/ISSUE-14.md) — Public-Facing Marketing Website, Documentation & Legal Compliance

### 1.2 Quantitative Document File Inventory
```
+---------------------------------------------------------------------------------------------------+
| Directory / Category     | Spec / Document Type                | File Count | Canonical Status   |
+---------------------------------------------------------------------------------------------------+
| docs/issues/ (Canonical) | ISS-001 through ISS-021             | 21         | Canonical Defects  |
| docs/improvements/       | IMP-001 through IMP-009             | 9          | Canonical Improv.  |
| docs/features/           | FEAT-001 through FEAT-011           | 11         | Canonical Features |
| docs/operations/         | OPS-001..005 + DR Runbook           | 6          | Canonical Ops & DR |
| docs/testing/            | TEST-001..004 + QA Checklist + Evid | 6          | Canonical Testing  |
| docs/decisions/          | DEC-001 through DEC-003             | 3          | Canonical Decis.   |
| SUBTOTAL ACTIVE SPECS    | Independently Actionable Files      | 56         | 100% Indexed       |
+---------------------------------------------------------------------------------------------------+
| docs/issues/ (Legacy)    | ISSUE-01.md through ISSUE-14.md     | 14         | Preserved Legacy   |
| docs/audit/              | Baselines, Batches 1-6 & MVP Audits | 22         | System Audits      |
| docs/plans/              | Phase 1 through Phase 6 Plans       | 6          | Arch. Blueprints   |
| docs/ root               | Master Register, Backlog, Batches   | 3          | Central Governance |
| TOTAL DOCUMENTATION SET  | All Files in docs/                  | 101 Files  | Complete & Audited |
+---------------------------------------------------------------------------------------------------+
| Workspace Root           | Foundational Spec, Tracker & Logs   | 4 Files    | Root Archives      |
| GRAND TOTAL REPOSITORY   | All Markdown Documentation Files    | 105 Files  | 100% Reconciled    |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Issues & Defects Register (`ISS-###`)

| ID | Title | Category | Severity / Priority | Release Target | Current Evidence Status | Dependencies | Decision Required? | Path to Detailed Spec |
|---|---|---|---|---|---|---|---|---|
| **ISS-001** | Tenant Context Middleware Bypass in Express Routes | Security / Multi-Tenancy | P0 / Blocker | Launch Blocker | Verified (Resolved in Batch 1) | None | No | [`docs/issues/ISS-001-tenant-context-enforcement.md`](./issues/ISS-001-tenant-context-enforcement.md) |
| **ISS-002** | Incomplete Mongoose Tenant Interception Plugin | Security / Data Isolation | P0 / Blocker | Launch Blocker | Verified (Resolved in Batch 1) | `ISS-001` | No | [`docs/issues/ISS-002-tenant-plugin-interception.md`](./issues/ISS-002-tenant-plugin-interception.md) |
| **ISS-003** | Credit Note Balance Reduction Failure & Schema Mismatch | Financial / Accounting | P0 / Blocker | Launch Blocker | Confirmed Defect | `ISS-001`, `ISS-002` | No | [`docs/issues/ISS-003-credit-note-balance-reduction.md`](./issues/ISS-003-credit-note-balance-reduction.md) |
| **ISS-004** | One-Sided Vendor Payouts & Omission from Party Balances | Financial / General Ledger | P0 / Blocker | Launch Blocker | Confirmed Defect | `ISS-001`, `ISS-002` | No | [`docs/issues/ISS-004-vendor-payout-ledger-reconciliation.md`](./issues/ISS-004-vendor-payout-ledger-reconciliation.md) |
| **ISS-005** | IDOR & Unauthenticated PII Exposure in Public Tracking | Security / Privacy | P0 / Blocker | Launch Blocker | Confirmed Security Risk | `ISS-001` | Reconciled | [`docs/issues/ISS-005-public-tracking-privacy-idor.md`](./issues/ISS-005-public-tracking-privacy-idor.md) |
| **ISS-006** | Stakeholder Portals Authentication & Data Breakdown | Auth / Portals | P0 / Blocker | Launch Blocker | Confirmed Defect | `ISS-001`, `ISS-020` | No | [`docs/issues/ISS-006-stakeholder-portals-auth-breakdown.md`](./issues/ISS-006-stakeholder-portals-auth-breakdown.md) |
| **ISS-007** | Live Fleet Map Broken by Schema & Projection Discrepancy | Frontend / Telematics | P1 / High | Launch Blocker | Confirmed Defect | `ISS-001` | No | [`docs/issues/ISS-007-live-fleet-map-projection-mismatch.md`](./issues/ISS-007-live-fleet-map-projection-mismatch.md) |
| **ISS-008** | Dead Credit Notes Sidebar Link & Missing Page Component | Frontend / Navigation | P1 / High | Launch Blocker | Confirmed Integration Mismatch | None | No | [`docs/issues/ISS-008-missing-credit-notes-page.md`](./issues/ISS-008-missing-credit-notes-page.md) |
| **ISS-009** | AR Aging Table Displays Blank Customer Names | Frontend / Commercial | P1 / High | Launch Blocker | Confirmed Integration Mismatch | None | No | [`docs/issues/ISS-009-ar-aging-customer-name-display.md`](./issues/ISS-009-ar-aging-customer-name-display.md) |
| **ISS-010** | Trip Profitability Report Always Returns Zero Values | Reporting / Analytics | P1 / High | Launch Blocker | Confirmed Defect | `ISS-014` | No | [`docs/issues/ISS-010-trip-profitability-zero-calculation.md`](./issues/ISS-010-trip-profitability-zero-calculation.md) |
| **ISS-011** | Marketing Pricing Page Contradicts Backend Plan Seeds | Monetization / Billing | P1 / High | Launch Blocker | Confirmed Integration Mismatch | `DEC-001` | Yes (`DEC-001`) | [`docs/issues/ISS-011-pricing-page-seed-discrepancy.md`](./issues/ISS-011-pricing-page-seed-discrepancy.md) |
| **ISS-012** | Starter Plan Entitlement Trap Blocks Core LR & Invoices | SaaS / Entitlements | P1 / High | Launch Blocker | Confirmed Defect | `DEC-001` | Yes (`DEC-001`) | [`docs/issues/ISS-012-starter-plan-entitlement-trap.md`](./issues/ISS-012-starter-plan-entitlement-trap.md) |
| **ISS-013** | Unsafe Payment Checkout Simulation Mode in Production | Security / Billing | P1 / High | Launch Blocker | Confirmed Security Risk | `ISS-001` | No | [`docs/issues/ISS-013-unsafe-payment-checkout-simulation.md`](./issues/ISS-013-unsafe-payment-checkout-simulation.md) |
| **ISS-014** | MongoDB Aggregations Pass Raw String `companyId` into `$match` | Database / Operations | P1 / High | Launch Blocker | Verified (Resolved in Batch 2) | None | No | [`docs/issues/ISS-014-mongodb-aggregation-string-companyid.md`](./issues/ISS-014-mongodb-aggregation-string-companyid.md) |
| **ISS-015** | Dashboard Maintenance Counter Uses Non-Existent Enum | Dashboard / KPI | P1 / High | Launch Blocker | Confirmed Integration Mismatch | None | No | [`docs/issues/ISS-015-dashboard-maintenance-truck-counter.md`](./issues/ISS-015-dashboard-maintenance-truck-counter.md) |
| **ISS-016** | Unmounted File Security Magic Byte Middleware on Uploads | Security / File Upload | P1 / High | Launch Blocker | Verified (Resolved in Batch 1) | None | No | [`docs/issues/ISS-016-unmounted-file-security-middleware.md`](./issues/ISS-016-unmounted-file-security-middleware.md) |
| **ISS-017** | Local Storage Service Lacks Path Normalization Check | Security / Storage | P1 / High | Launch Blocker | Verified (Resolved in Batch 1; Prod S3 Pending DEC-003) | `DEC-003` | Yes (`DEC-003`) | [`docs/issues/ISS-017-local-storage-path-traversal.md`](./issues/ISS-017-local-storage-path-traversal.md) |
| **ISS-018** | Multi-Document ACID Transactions Crash Standalone Mongo | Architecture / Database | P0 / Blocker | Launch Blocker | Verified (Resolved in Batch 2; Option A Implemented) | `DEC-002` | Yes (`DEC-002`) | [`docs/issues/ISS-018-acid-transactions-standalone-mongo.md`](./issues/ISS-018-acid-transactions-standalone-mongo.md) |
| **ISS-019** | Missing Client-Side Idempotency Key Generation | Security / Race Condition | P1 / High | Launch Blocker | Verified (Resolved in Batch 2) | None | No | [`docs/issues/ISS-019-client-side-idempotency-key-omission.md`](./issues/ISS-019-client-side-idempotency-key-omission.md) |
| **ISS-020** | Unthrottled Portal OTP Endpoints (SMS Flooding & Abuse) | Security / Abuse | P1 / High | Launch Blocker | Confirmed Security Risk | None | No | [`docs/issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md`](./issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md) |
| **ISS-021** | Custom Field Key Injection & Prototype Pollution Risk | Security / Validation | P2 / Moderate | Post-Launch | Verified (Resolved in Batch 2) | `ISS-001` | No | [`docs/issues/ISS-021-custom-field-key-injection-defense.md`](./issues/ISS-021-custom-field-key-injection-defense.md) |

---

## 3. Improvements Register (`IMP-###`)

| ID | Title | Category | Priority | Release Target | Current Status | Dependencies | Path to Detailed Spec |
|---|---|---|---|---|---|---|---|
| **IMP-001** | Comprehensive GSTIN & PAN Regex & Checksum Validation | Data Quality / Compliance | P1 | Commercial Launch | Proposed | None | [`docs/improvements/IMP-001-gstin-pan-validation.md`](./improvements/IMP-001-gstin-pan-validation.md) |
| **IMP-002** | Granular RBAC Permission Matrix & Custom Tenant Roles | Identity & Access / Security | P2 | Post-Launch (Batch 7) | Proposed | `ISS-001` | [`docs/improvements/IMP-002-granular-rbac-permission-matrix.md`](./improvements/IMP-002-granular-rbac-permission-matrix.md) |
| **IMP-003** | Expiring Member Invitation Flow & Acceptance State Machine | User Onboarding / Admin | P2 | Post-Launch (Batch 7) | Proposed | None | [`docs/improvements/IMP-003-expiring-member-invitations.md`](./improvements/IMP-003-expiring-member-invitations.md) |
| **IMP-004** | Compound Multi-Tenant Database Indexing Optimization | Database / Performance | P1 | Commercial Launch (Batch 2) | Verified (Implemented in Batch 2) | None | [`docs/improvements/IMP-004-compound-multitenant-indexes.md`](./improvements/IMP-004-compound-multitenant-indexes.md) |
| **IMP-005** | Real-Time Dynamic Tax Recalculation on Invoice UI | Frontend / Commercial | P2 | Post-Launch (Batch 7) | Proposed | None | [`docs/improvements/IMP-005-dynamic-tax-recalculation.md`](./improvements/IMP-005-dynamic-tax-recalculation.md) |
| **IMP-006** | Server-Side Pagination, Search & Sorting on Data Tables | UI / Performance | P2 | Post-Launch (Batch 7) | Proposed | `IMP-004` | [`docs/improvements/IMP-006-serverside-pagination-tables.md`](./improvements/IMP-006-serverside-pagination-tables.md) |
| **IMP-007** | Telematics Leaflet Map Fallback & Auto-Centering Resilience | UI / Telematics | P2 | Post-Launch (Batch 7) | Proposed | `ISS-007` | [`docs/improvements/IMP-007-telematics-map-fallback.md`](./improvements/IMP-007-telematics-map-fallback.md) |
| **IMP-008** | Multi-Channel Notification Failover (WhatsApp -> SMS -> Email)| Communications / SRE | P2 | Post-Launch (Batch 8) | Proposed | `OPS-002` | [`docs/improvements/IMP-008-notification-multi-channel-failover.md`](./improvements/IMP-008-notification-multi-channel-failover.md) |
| **IMP-009** | Platform Super-Admin Impersonation Banner & Safeguards | Platform Governance / Security | P2 | Post-Launch (Batch 7) | Proposed | None | [`docs/improvements/IMP-009-superadmin-impersonation-safeguards.md`](./improvements/IMP-009-superadmin-impersonation-safeguards.md) |

---

## 4. Features Register (`FEAT-###`)

| ID | Title | Category | Priority | Release Target | Target Users | External Dependencies & Prerequisites | Path to Detailed Spec |
|---|---|---|---|---|---|---|---|
| **FEAT-001** | NIC E-Way Bill Integration (Part A, Part B, Real-Time Expiry) | Regulatory / Logistics | P3 | Future (Batch 10) | Dispatchers, Operators | NIC GSP/ASP Credentials, Sandbox Access | [`docs/features/FEAT-001-nic-eway-bill-integration.md`](./features/FEAT-001-nic-eway-bill-integration.md) |
| **FEAT-002** | GST E-Invoicing & Invoice Registration Portal (IRN & QR Code) | Tax / Invoicing | P3 | Future (Batch 10) | Accountants, Finance | IRP GSP/ASP Credentials, CA Tax Audit | [`docs/features/FEAT-002-gst-einvoicing-irn-qr.md`](./features/FEAT-002-gst-einvoicing-irn-qr.md) |
| **FEAT-003** | Parivahan VAHAN RC & Sarathi DL Verification Engine | Asset / Risk Compliance | P3 | Future (Batch 10) | Fleet Managers | ULIP / Parivahan API Agreement & Usage Fee | [`docs/features/FEAT-003-vahan-sarathi-verification.md`](./features/FEAT-003-vahan-sarathi-verification.md) |
| **FEAT-004** | Electronic Proof of Delivery (e-POD) Mobile Capture & OTP | Cash Flow / Operations | P2 | Post-Launch (Batch 9) | Drivers, Consignees | SMS Gateway for Consignee OTP | [`docs/features/FEAT-004-epod-mobile-capture-otp.md`](./features/FEAT-004-epod-mobile-capture-otp.md) |
| **FEAT-005** | FASTag Electronic Toll Reconciliation & Auto Trip Linking | Expense / Telemetry | P3 | Future (Batch 11) | Fleet Accountants | NETC / Bank FASTag Corporate Agreement | [`docs/features/FEAT-005-fastag-toll-reconciliation.md`](./features/FEAT-005-fastag-toll-reconciliation.md) |
| **FEAT-006** | Corporate Fuel Card Sync (BPCL / HPCL / IOCL API) | Fuel / Expense | P3 | Future (Batch 11) | Fleet Managers | Oil Marketing Company API Agreement | [`docs/features/FEAT-006-fuel-card-sync-integration.md`](./features/FEAT-006-fuel-card-sync-integration.md) |
| **FEAT-007** | Driver Mobile PWA Workflow (Vernacular UI, Trip Slips) | Driver Operations | P3 | Future (Batch 11) | Truck Drivers | Driver Smartphone Usability Study | [`docs/features/FEAT-007-driver-mobile-pwa-workflow.md`](./features/FEAT-007-driver-mobile-pwa-workflow.md) |
| **FEAT-008** | Income Tax Section 194C TDS Deduction & 194C(6) Engine | Taxation / Accounts | P3 | Future (Batch 10) | Accountants | CA Tax Practice Certification & Form 16A | [`docs/features/FEAT-008-section-194c-tds-engine.md`](./features/FEAT-008-section-194c-tds-engine.md) |
| **FEAT-009** | Tyre Lifecycle, Tread Depth & Wheel Position Matrix | Maintenance / Fleet | P3 | Future (Batch 11) | Workshop Supervisors | Specialized Workshop Operations Input | [`docs/features/FEAT-009-tyre-lifecycle-management.md`](./features/FEAT-009-tyre-lifecycle-management.md) |
| **FEAT-010** | Real End-to-End Vendor Portal (Real Trips, Invoices, Slips) | Portals / Supplier | P2 | Post-Launch (Batch 9) | Market Truck Vendors | Vendor Onboarding Readiness | [`docs/features/FEAT-010-vendor-portal-end-to-end.md`](./features/FEAT-010-vendor-portal-end-to-end.md) |
| **FEAT-011** | Complete Tenant Data Export & Compliant Offboarding Archival| Compliance / Portability | P2 | Post-Launch (Batch 9) | Company Admins | S3 Cold Storage & BullMQ Pipeline | [`docs/features/FEAT-011-tenant-data-export-offboarding.md`](./features/FEAT-011-tenant-data-export-offboarding.md) |

---

## 5. Operations & Production Register (`OPS-###`)

| ID | Title | Category | Priority | Release Target | Current Status | Dependencies | Path to Detailed Spec |
|---|---|---|---|---|---|---|---|
| **OPS-001** | Docker Containerization & Multi-Environment Compose Architecture | Deployment / Infra | P1 | Commercial Launch (Batch 6) | Proposed | `DEC-002` | [`docs/operations/OPS-001-docker-compose-architecture.md`](./operations/OPS-001-docker-compose-architecture.md) |
| **OPS-002** | Distributed Task Processing Architecture with Redis, BullMQ & Redlock | Background / Jobs | P2 | Post-Launch (Batch 8) | Proposed | Redis Provisioning | [`docs/operations/OPS-002-distributed-task-processing-bullmq.md`](./operations/OPS-002-distributed-task-processing-bullmq.md) |
| **OPS-003** | Automated Database Backup, Retention Policy & Disaster Recovery | Database / SRE | P1 | Commercial Launch (Batch 6) | Proposed | S3 Backup Bucket | [`docs/operations/OPS-003-backup-retention-disaster-recovery.md`](./operations/OPS-003-backup-retention-disaster-recovery.md) |
| **OPS-004** | Structured JSON Telemetry, Correlated Logging & Sentry APM | Observability / APM | P2 | Post-Launch (Batch 8) | Proposed | Sentry DSN | [`docs/operations/OPS-004-observability-sentry-apm.md`](./operations/OPS-004-observability-sentry-apm.md) |
| **OPS-005** | Deep Readiness & Liveness Probes with Dependency Connectivity | Monitoring / Health | P1 | Commercial Launch (Batch 6) | Proposed | None | [`docs/operations/OPS-005-deep-health-check-probes.md`](./operations/OPS-005-deep-health-check-probes.md) |
| **OPS-RUNBOOK** | Multi-Tier Database & Infrastructure Disaster Recovery Runbook | SRE / Disaster Recovery | P1 | Commercial Launch (Batch 6) | Verified (Operational in Batch 6C) | `OPS-003` | [`docs/operations/DISASTER_RECOVERY_RUNBOOK.md`](./operations/DISASTER_RECOVERY_RUNBOOK.md) |

---

## 6. Testing & Quality Assurance Register (`TEST-###`)

| ID | Title | Scope & Framework | Priority | Release Target | Current Status | Path to Detailed Spec |
|---|---|---|---|---|---|---|
| **TEST-001** | Automated HTTP Integration Test Suite with Vitest & Supertest | Express API Routes | P0 | Launch Blocker (Batch 1) | Verified (Operational in Batch 1; 38/38 passing) | [`docs/testing/TEST-001-automated-http-integration-suite.md`](./testing/TEST-001-automated-http-integration-suite.md) |
| **TEST-002** | Cross-Tenant Data Isolation & Mutation Boundary Test Suite | Multi-Tenancy / Mongoose | P0 | Launch Blocker (Batch 1) | Verified (Operational in Batch 1; 12/12 passing) | [`docs/testing/TEST-002-cross-tenant-isolation-suite.md`](./testing/TEST-002-cross-tenant-isolation-suite.md) |
| **TEST-003** | Double-Entry Accounting & Ledger Balance Invariant Test Suite | Financial Math & Ledgers | P0 | Launch Blocker (Batch 3) | Pending Batch 3 | [`docs/testing/TEST-003-double-entry-ledger-invariants.md`](./testing/TEST-003-double-entry-ledger-invariants.md) |
| **TEST-004** | Subscription Feature Gating, Quota Limits & Webhook Verification | Billing & Entitlements | P1 | Launch Blocker (Batch 5) | Pending Batch 5 | [`docs/testing/TEST-004-subscription-feature-gating-quotas.md`](./testing/TEST-004-subscription-feature-gating-quotas.md) |
| **TEST-MANUAL** | Complete Website Manual QA & Feature Testing Checklist Workbook | All Pages / E2E Manual QA | P0 | Commercial Launch Gate | Active Master QA Workbook (23 Suites) | [`docs/testing/FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md`](./testing/FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md) |
| **TEST-EVID** | Manual QA Visual, Network HAR & Audit Evidence Guidelines | QA Evidence Archive | P1 | Commercial Launch Gate | Active Evidence Conventions & Structure | [`docs/testing/evidence/README.md`](./testing/evidence/README.md) |

---

## 7. Product & Architectural Decisions Register (`DEC-###`)

| ID | Decision Title | Stakeholder / Domain | Priority | Release Target | Current Status | Resolves Issues | Path to Detailed Spec |
|---|---|---|---|---|---|---|---|
| **DEC-001** | Commercial Subscription Pricing, Truck Quotas & Starter Plan Inclusions | Product Owner / Commercial | P1 | Launch Blocker (Batch 5) | Pending Product Owner Approval | `ISS-011`, `ISS-012` | [`docs/decisions/DEC-001-subscription-pricing-and-entitlements.md`](./decisions/DEC-001-subscription-pricing-and-entitlements.md) |
| **DEC-002** | Standalone MongoDB Fallback vs Mandatory Replica Set in Production | Lead Architect / DevOps | P0 | Launch Blocker (Batch 2) | Approved Architecture & Implemented (Option A Verified in Batch 2) | `ISS-018` | [`docs/decisions/DEC-002-mongodb-transactions-standalone-strategy.md`](./decisions/DEC-002-mongodb-transactions-standalone-strategy.md) |
| **DEC-003** | File Storage Architecture: Cloud S3 Object Storage vs Secured Local Disk | Security / Infrastructure | P1 | Launch Blocker (Batch 1/6) | Pending Approval (Prod S3 Policy Pending; Local Containment Verified) | `ISS-017` | [`docs/decisions/DEC-003-storage-architecture-s3-vs-local.md`](./decisions/DEC-003-storage-architecture-s3-vs-local.md) |

---

## 8. Legacy Documentation Reconciliation & Superseding Map

All 14 legacy issue documents from `docs/issues/` and the root tracker (`ISSUES.md`) are permanently preserved in the repository and reconciled below against the canonical specifications:

| Legacy ID | True Historical Document Title | Historical Status Claimed | Actual Implementation Reality | Canonical Specifications Superseding Legacy Work |
|---|---|---|---|---|
| [`**ISSUE-01**`](./issues/ISSUE-01.md) | Enforce Subscription Status and Plan Permissions on the Backend | **Resolved** | Gating omitted on operational routes; pricing cards contradict database seed; Starter plan blocked from LR and Invoices. | [`ISS-011`](./issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](./issues/ISS-012-starter-plan-entitlement-trap.md), [`DEC-001`](./decisions/DEC-001-subscription-pricing-and-entitlements.md), [`TEST-004`](./testing/TEST-004-subscription-feature-gating-quotas.md) |
| [`**ISSUE-02**`](./issues/ISSUE-02.md) | Complete and Secure Real Subscription Payments | **Resolved** | Test simulation checkout bypass mode remains active; webhook verification lacks automated regression suite. | [`ISS-013`](./issues/ISS-013-unsafe-payment-checkout-simulation.md), [`DEC-001`](./decisions/DEC-001-subscription-pricing-and-entitlements.md), [`TEST-004`](./testing/TEST-004-subscription-feature-gating-quotas.md) |
| [`**ISSUE-03**`](./issues/ISSUE-03.md) | Harden Authentication and Account Recovery | **Resolved** | Portal OTP login broken by phone schema mismatches; endpoints lack rate limiting against SMS abuse. | [`ISS-006`](./issues/ISS-006-stakeholder-portals-auth-breakdown.md), [`ISS-020`](./issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md), [`IMP-002`](./improvements/IMP-002-granular-rbac-permission-matrix.md), [`TEST-001`](./testing/TEST-001-automated-http-integration-suite.md) |
| [`**ISSUE-04**`](./issues/ISSUE-04.md) | Verify and Enforce Tenant Isolation Across the Entire API | **Resolved** | Five Express route files completely bypass `resolveTenantContext`; Mongoose plugin misses `updateOne`/`deleteMany`/`aggregate`. | [`ISS-001`](./issues/ISS-001-tenant-context-enforcement.md), [`ISS-002`](./issues/ISS-002-tenant-plugin-interception.md), [`ISS-014`](./issues/ISS-014-mongodb-aggregation-string-companyid.md), [`TEST-002`](./testing/TEST-002-cross-tenant-isolation-suite.md) |
| [`**ISSUE-05**`](./issues/ISSUE-05.md) | Make Financial Records Dependable & Accounting Sound | **Resolved** | Vendor payouts are one-sided debits; party balances omit payouts; credit notes update wrong field; aggregations zero out profit. | [`ISS-003`](./issues/ISS-003-credit-note-balance-reduction.md), [`ISS-004`](./issues/ISS-004-vendor-payout-ledger-reconciliation.md), [`ISS-010`](./issues/ISS-010-trip-profitability-zero-calculation.md), [`ISS-018`](./issues/ISS-018-acid-transactions-standalone-mongo.md), [`ISS-019`](./issues/ISS-019-client-side-idempotency-key-omission.md), [`TEST-003`](./testing/TEST-003-double-entry-ledger-invariants.md) |
| [`**ISSUE-06**`](./issues/ISSUE-06.md) | Real Notifications and Background Jobs | **Resolved** | Workers lack distributed multi-node coordination and automated fallback cascade (WhatsApp -> SMS -> Email). | [`IMP-008`](./improvements/IMP-008-notification-multi-channel-failover.md), [`OPS-002`](./operations/OPS-002-distributed-task-processing-bullmq.md) |
| [`**ISSUE-07**`](./issues/ISSUE-07.md) | Complete Fleet Maintenance Management | **Resolved** | Dashboard counter references non-existent enum `'maintenance'` instead of `'in_maintenance'`, reporting 0. | [`ISS-015`](./issues/ISS-015-dashboard-maintenance-truck-counter.md), [`FEAT-009`](./features/FEAT-009-tyre-lifecycle-management.md) |
| [`**ISSUE-08**`](./issues/ISSUE-08.md) | Advanced Trip Tracking and Driver Workflows | **Resolved** | Live fleet map query projects wrong field names (`registration_number`), rendering empty telematics markers. | [`ISS-007`](./issues/ISS-007-live-fleet-map-projection-mismatch.md), [`IMP-007`](./improvements/IMP-007-telematics-map-fallback.md), [`FEAT-007`](./features/FEAT-007-driver-mobile-pwa-workflow.md) |
| [`**ISSUE-09**`](./issues/ISSUE-09.md) | Complete Commercial and Accounting Operations | **Resolved** | UI credit notes sidebar route is dead link; AR aging customer name displays `"—"`; missing GSTIN/PAN regex checks. | [`ISS-008`](./issues/ISS-008-missing-credit-notes-page.md), [`ISS-009`](./issues/ISS-009-ar-aging-customer-name-display.md), [`IMP-001`](./improvements/IMP-001-gstin-pan-validation.md), [`IMP-005`](./improvements/IMP-005-dynamic-tax-recalculation.md), [`FEAT-002`](./features/FEAT-002-gst-einvoicing-irn-qr.md), [`FEAT-008`](./features/FEAT-008-section-194c-tds-engine.md) |
| [`**ISSUE-10**`](./issues/ISSUE-10.md) | Customer, Driver, and Vendor Self-Service Portals | **Resolved** | Customer login queries non-existent `contact_phone`; vendor login disabled; vendor dashboard is hardcoded mock data. | [`ISS-006`](./issues/ISS-006-stakeholder-portals-auth-breakdown.md), [`ISS-020`](./issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md), [`FEAT-010`](./features/FEAT-010-vendor-portal-end-to-end.md) |
| [`**ISSUE-11**`](./issues/ISSUE-11.md) | Finish Configurable Company Features | **Resolved** | `branchRoutes` and `approvalRoutes` omit tenant context; custom fields accept prototype pollution and `$where`. | [`ISS-001`](./issues/ISS-001-tenant-context-enforcement.md), [`ISS-021`](./issues/ISS-021-custom-field-key-injection-defense.md), [`IMP-002`](./improvements/IMP-002-granular-rbac-permission-matrix.md) |
| [`**ISSUE-12**`](./issues/ISSUE-12.md) | Support, Customer Onboarding & Offboarding Lifecycle | **Resolved** | `supportRoutes` omits tenant context; no tenant export engine; member invitations lack expiry state machine. | [`ISS-001`](./issues/ISS-001-tenant-context-enforcement.md), [`FEAT-011`](./features/FEAT-011-tenant-data-export-offboarding.md), [`IMP-003`](./improvements/IMP-003-expiring-member-invitations.md) |
| [`**ISSUE-13**`](./issues/ISSUE-13.md) | Security, Privacy, and Production Operations | **Resolved** | Public tracking query leaks PII via IDOR; magic byte middleware is unmounted; local storage lacks path jailing. | [`ISS-005`](./issues/ISS-005-public-tracking-privacy-idor.md), [`ISS-016`](./issues/ISS-016-unmounted-file-security-middleware.md), [`ISS-017`](./issues/ISS-017-local-storage-path-traversal.md), [`DEC-003`](./decisions/DEC-003-storage-architecture-s3-vs-local.md), [`OPS-001`](./operations/OPS-001-docker-compose-architecture.md), [`OPS-003`](./operations/OPS-003-backup-retention-disaster-recovery.md), [`OPS-004`](./operations/OPS-004-observability-sentry-apm.md), [`OPS-005`](./operations/OPS-005-deep-health-check-probes.md) |
| [`**ISSUE-14**`](./issues/ISSUE-14.md) | Public-Facing Marketing Website, Documentation & Legal Compliance | **Resolved** | Marketing pricing page advertises prices and unlimited quotas contradictory to backend billing seeds. | [`ISS-011`](./issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](./issues/ISS-012-starter-plan-entitlement-trap.md), [`DEC-001`](./decisions/DEC-001-subscription-pricing-and-entitlements.md) |
