# Fleet Flow — Existing Documentation Reconciliation

**Audit Date:** October 2026  
**Auditor:** Principal Software Architect & QA Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Documents Audited:** `ISSUES.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_CHANGELOG.md`, `docs/issues/ISSUE-01.md` through `ISSUE-14.md`  

---

## 1. Executive Summary: Documentation vs Reality

The repository contains extensive historical documentation detailing architectural plans, past refactoring sprints, and an issue log (`ISSUES.md`) tracking 14 specific system issues (`ISSUE-01` to `ISSUE-14`). In `ISSUES.md` and related changelogs, **all 14 issues are marked as "Resolved" or "Closed".**

**Audit Verdict:** A rigorous static and cross-layer inspection of the actual source code reveals that **a majority of these "Resolved" issues remain actively broken, partially implemented, or exhibit severe regressions.** 

The claims of complete resolution were largely based on isolated model scripts (`backend/src/scripts/verify_fix_audit.ts`) that tested Mongoose models directly while **completely bypassing the Express HTTP routing stack, middleware pipelines, and React frontend contracts.**

---

## 2. True Legacy Issue Inventory & Canonical Superseding Matrix

A rigorous cross-referencing between historical issue files (`docs/issues/ISSUE-01.md` through `ISSUE-14.md`), root tracker (`ISSUES.md`), and the actual implementation reveals the true status and canonical mappings:

| Legacy ID | True Historical Document Title | Claimed Status | Actual Implementation Reality | Canonical Specifications Superseding Legacy Work |
|---|---|---|---|---|
| **ISSUE-01** | Enforce Subscription Status and Plan Permissions on the Backend | **Resolved** | Gating omitted on operational routes; pricing cards contradict database seed; Starter plan blocked from LR and Invoices. | [`ISS-011`](../issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](../issues/ISS-012-starter-plan-entitlement-trap.md), [`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md), [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md) |
| **ISSUE-02** | Complete and Secure Real Subscription Payments | **Resolved** | Test simulation checkout bypass mode remains active; webhook verification lacks automated regression suite. | [`ISS-013`](../issues/ISS-013-unsafe-payment-checkout-simulation.md), [`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md), [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md) |
| **ISSUE-03** | Harden Authentication and Account Recovery | **Resolved** | Portal OTP login broken by phone schema mismatches; endpoints lack rate limiting against SMS abuse. | [`ISS-006`](../issues/ISS-006-stakeholder-portals-auth-breakdown.md), [`ISS-020`](../issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md), [`IMP-002`](../improvements/IMP-002-granular-rbac-permission-matrix.md), [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md) |
| **ISSUE-04** | Verify and Enforce Tenant Isolation Across the Entire API | **Resolved** | Five Express route files completely bypass `resolveTenantContext`; Mongoose plugin misses `updateOne`/`deleteMany`/`aggregate`. | [`ISS-001`](../issues/ISS-001-tenant-context-enforcement.md), [`ISS-002`](../issues/ISS-002-tenant-plugin-interception.md), [`ISS-014`](../issues/ISS-014-mongodb-aggregation-string-companyid.md), [`TEST-002`](../testing/TEST-002-cross-tenant-isolation-suite.md) |
| **ISSUE-05** | Make Financial Records Dependable & Accounting Sound | **Resolved** | Vendor payouts are one-sided debits; party balances omit payouts; credit notes update wrong field; aggregations zero out profit. | [`ISS-003`](../issues/ISS-003-credit-note-balance-reduction.md), [`ISS-004`](../issues/ISS-004-vendor-payout-ledger-reconciliation.md), [`ISS-010`](../issues/ISS-010-trip-profitability-zero-calculation.md), [`ISS-018`](../issues/ISS-018-acid-transactions-standalone-mongo.md), [`ISS-019`](../issues/ISS-019-client-side-idempotency-key-omission.md), [`TEST-003`](../testing/TEST-003-double-entry-ledger-invariants.md) |
| **ISSUE-06** | Real Notifications and Background Jobs | **Resolved** | Workers lack distributed multi-node coordination and automated fallback cascade (WhatsApp -> SMS -> Email). | [`IMP-008`](../improvements/IMP-008-notification-multi-channel-failover.md), [`OPS-002`](../operations/OPS-002-distributed-task-processing-bullmq.md) |
| **ISSUE-07** | Complete Fleet Maintenance Management | **Resolved** | Dashboard counter references non-existent enum `'maintenance'` instead of `'in_maintenance'`, reporting 0. | [`ISS-015`](../issues/ISS-015-dashboard-maintenance-truck-counter.md), [`FEAT-009`](../features/FEAT-009-tyre-lifecycle-management.md) |
| **ISSUE-08** | Advanced Trip Tracking and Driver Workflows | **Resolved** | Live fleet map query projects wrong field names (`registration_number`), rendering empty telematics markers. | [`ISS-007`](../issues/ISS-007-live-fleet-map-projection-mismatch.md), [`IMP-007`](../improvements/IMP-007-telematics-map-fallback.md), [`FEAT-007`](../features/FEAT-007-driver-mobile-pwa-workflow.md) |
| **ISSUE-09** | Complete Commercial and Accounting Operations | **Resolved** | UI credit notes sidebar route is dead link; AR aging customer name displays `"—"`; missing GSTIN/PAN regex checks. | [`ISS-008`](../issues/ISS-008-missing-credit-notes-page.md), [`ISS-009`](../issues/ISS-009-ar-aging-customer-name-display.md), [`IMP-001`](../improvements/IMP-001-gstin-pan-validation.md), [`IMP-005`](../improvements/IMP-005-dynamic-tax-recalculation.md), [`FEAT-002`](../features/FEAT-002-gst-einvoicing-irn-qr.md), [`FEAT-008`](../features/FEAT-008-section-194c-tds-engine.md) |
| **ISSUE-10** | Customer, Driver, and Vendor Self-Service Portals | **Resolved** | Customer login queries non-existent `contact_phone`; vendor login disabled; vendor dashboard is hardcoded mock data. | [`ISS-006`](../issues/ISS-006-stakeholder-portals-auth-breakdown.md), [`ISS-020`](../issues/ISS-020-portal-otp-rate-limiting-sms-flooding.md), [`FEAT-010`](../features/FEAT-010-vendor-portal-end-to-end.md) |
| **ISSUE-11** | Finish Configurable Company Features | **Resolved** | `branchRoutes` and `approvalRoutes` omit tenant context; custom fields accept prototype pollution and `$where`. | [`ISS-001`](../issues/ISS-001-tenant-context-enforcement.md), [`ISS-021`](../issues/ISS-021-custom-field-key-injection-defense.md), [`IMP-002`](../improvements/IMP-002-granular-rbac-permission-matrix.md) |
| **ISSUE-12** | Support, Customer Onboarding & Offboarding Lifecycle | **Resolved** | `supportRoutes` omits tenant context; no tenant export engine; member invitations lack expiry state machine. | [`ISS-001`](../issues/ISS-001-tenant-context-enforcement.md), [`FEAT-011`](../features/FEAT-011-tenant-data-export-offboarding.md), [`IMP-003`](../improvements/IMP-003-expiring-member-invitations.md) |
| **ISSUE-13** | Security, Privacy, and Production Operations | **Resolved** | Public tracking query leaks PII via IDOR; magic byte middleware is unmounted; local storage lacks path jailing. | [`ISS-005`](../issues/ISS-005-public-tracking-privacy-idor.md), [`ISS-016`](../issues/ISS-016-unmounted-file-security-middleware.md), [`ISS-017`](../issues/ISS-017-local-storage-path-traversal.md), [`DEC-003`](../decisions/DEC-003-storage-architecture-s3-vs-local.md), [`OPS-001`](../operations/OPS-001-docker-compose-architecture.md), [`OPS-003`](../operations/OPS-003-backup-retention-disaster-recovery.md), [`OPS-004`](../operations/OPS-004-observability-sentry-apm.md), [`OPS-005`](../operations/OPS-005-deep-health-check-probes.md) |
| **ISSUE-14** | Public-Facing Marketing Website, Documentation & Legal Compliance | **Resolved** | Marketing pricing page advertises prices and unlimited quotas contradictory to backend billing seeds. | [`ISS-011`](../issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](../issues/ISS-012-starter-plan-entitlement-trap.md), [`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md) |

---

## 3. Discrepancy Forensic Breakdown & Root Causes

### 3.1 Resolving Previous Internal Reconciliation Inconsistencies
In earlier internal notes, an attempt was made to map the 21 newly discovered audit findings (`ISS-001` through `ISS-021`) directly to `ISSUE-01` through `ISSUE-14` by arbitrary numerical sequence. This created confusing misalignments (e.g. mapping `ISSUE-01` to Tenant Context when `ISSUE-01` was actually Subscription Status). The matrix in Section 2 restores the true historical titles and creates a bidirectional, unambiguous mapping to canonical specifications.

### 3.2 Architectural Failure Modes of Earlier Passes
1. **Isolated Script Testing**: The previous "Resolved" statuses relied on scripts (`verify_fix_audit.ts`, `test_tenant_isolation.ts`) that instantiated Mongoose models directly. They bypassed Express routers and HTTP middleware entirely, missing five route files that lacked `resolveTenantContext` and unmounted file security middleware.
2. **Contract Asymmetry Across Stack Boundaries**: Frontend UI pages were built with static assumptions or hardcoded mock fixtures while backend controllers evolved independently. This caused projection bugs (e.g., `registration_number` vs `truck_no`), broken navigation links, and blank AR aging names.
3. **Premature Status Declarations**: Documents were closed when code was drafted rather than after end-to-end integration and security test verification.

---

## 4. Remediation Governance

1. **Preserve Legacy Documents Intact**: Historical files (`docs/issues/ISSUE-01.md` through `ISSUE-14.md`) are permanently preserved in the repository as audit artifacts.
2. **Authoritative Canonical Register**: All future implementation and verification must reference canonical identifiers (`ISS-###`, `IMP-###`, `FEAT-###`, `OPS-###`, `TEST-###`, `DEC-###`) indexed in [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md).
3. **Readiness Gate Enforcement**: An issue is considered resolved only when all testable acceptance criteria pass automated integration suites and end-to-end browser verification.
