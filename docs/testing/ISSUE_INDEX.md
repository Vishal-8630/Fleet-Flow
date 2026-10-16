# Fleet Flow — Central Issue, Decision & Investigation Index

**Document Type:** Central Master Registry & Traceability Index  
**Project:** Fleet Flow — Transport Management SaaS  
**Source Document:** [`FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`](FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md)  
**Last Updated:** 15 October 2026  
**Implementation Status:** Documentation-Only. No application source code, database schemas, business logic, or configurations have been modified. No fixes have been applied.

---

## 1. Purpose and Usage Instructions

This document provides a single, authoritative, navigable index linking to every individual issue, design decision, and unresolved question extracted from the master handoff document.

### How to use this register:
1. **Traceability:** Every issue and decision document links directly back to the master handoff and to related items using relative Markdown links.
2. **Prioritization & Planning:** Use the summary tables and priority breakdowns to organize future development batches once explicitly authorized.
3. **Execution Invariant:** Do not implement fixes in ad-hoc batches. All development must follow the governance rules outlined in Section 7 of the handoff.
4. **Special Retest Constraint:** **`FF-ISSUE-058` / `QST-014` (Incognito authentication/session bug)** must be retested strictly **LAST** after all other fixes are completed, as requested by the user.

### Comprehensive Audit & Implementation Planning Artifacts:
- **[Comprehensive Issue & Question Audit Report](audit/ISSUE_AUDIT_REPORT.md)**: Full line-by-line evidence audit across all 60 issues and 14 questions.
- **[Prioritized Implementation Batch Plan](audit/IMPLEMENTATION_BATCH_PLAN.md)**: Sequenced Batches A through G plus final Incognito retest.
- **[Architectural Dependency Map](audit/DEPENDENCY_MAP.md)**: Mermaid topology and cross-cutting component cluster analysis.
- **[Audit Open Questions & Product Decisions](audit/AUDIT_OPEN_QUESTIONS.md)**: Catalog of items requiring product owner sign-off.

---

## 2. Summary Statistics

### Total Artifact Counts
- **Total Tracked Issues:** 60 issues (`FF-ISSUE-001` through `FF-ISSUE-060`)
- **Total Architectural / Design Decisions:** 12 decisions (`DEC-001` through `DEC-012`)
- **Total Unresolved Questions:** 14 investigation items (`QST-001` through `QST-014`)
- **Combined Registered Items:** 86 total documentation files

### Issue Counts by Category
| Category | Count | Percentage |
| :--- | :--- | :--- |
| UI-UX | 26 | 43.3% |
| Workflow / Support | 1 | 1.7% |
| Subscriptions & Billing | 1 | 1.7% |
| Workflow / Configuration | 1 | 1.7% |
| Security / Subscriptions | 1 | 1.7% |
| Bug / Financial | 2 | 3.3% |
| Bug | 5 | 8.3% |
| Workflow | 9 | 15.0% |
| Validation / Compliance | 2 | 3.3% |
| Financial | 6 | 10.0% |
| Workflow / Architecture | 1 | 1.7% |
| Bug / Notifications | 1 | 1.7% |
| Architecture / Reliability | 1 | 1.7% |
| Security / Architecture | 1 | 1.7% |
| Security / Workflow | 1 | 1.7% |
| Bug / Authentication | 1 | 1.7% |

### Issue Counts by Priority
| Priority | Count | Percentage |
| :--- | :--- | :--- |
| Medium | 25 | 41.7% |
| Low | 7 | 11.7% |
| High | 25 | 41.7% |
| Critical | 2 | 3.3% |
| High / Intermittent | 1 | 1.7% |

---

## 3. Master Issue Registry

| Canonical ID | Title | Category | Priority | Status | Module | Document Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FF-ISSUE-001** | Inconsistent Public-Site Color Scheme and Dark Gradient Overdecoration | UI-UX | `Medium` | Observed | Public Marketing Pages & Landing Shell | [View Document](issues/ui-ux/FF-ISSUE-001-public-site-color-scheme.md) |
| **FF-ISSUE-002** | Unwanted Public Fleet ROI Calculator Component | UI-UX | `Low` | Observed / Approved for Future Design | Public Marketing Pages | [View Document](issues/ui-ux/FF-ISSUE-002-unwanted-fleet-roi-calculator.md) |
| **FF-ISSUE-003** | Homepage Density, Visual Clutter and Unverified Performance Claims | UI-UX | `Medium` | Observed | Public Marketing Homepage | [View Document](issues/ui-ux/FF-ISSUE-003-homepage-content-density.md) |
| **FF-ISSUE-004** | Features Page Layout Density and Lack of Module Categorization | UI-UX | `Medium` | Observed | Public Marketing Features Page | [View Document](issues/ui-ux/FF-ISSUE-004-features-page-density.md) |
| **FF-ISSUE-005** | Pricing Page Visual Styling Discrepancy with App Design System | UI-UX | `Medium` | Observed | Public Pricing Page | [View Document](issues/ui-ux/FF-ISSUE-005-pricing-page-redesign.md) |
| **FF-ISSUE-006** | Pricing Page FAQ Sections Lack Dropdown/Collapsible Accordion Behavior | UI-UX | `Low` | Observed / Approved for Future Design | Public Pricing Page | [View Document](issues/ui-ux/FF-ISSUE-006-pricing-faq-accordion.md) |
| **FF-ISSUE-007** | Public Security Page Content Overload for Top-Level Marketing | UI-UX | `Medium` | Observed | Public Security Page | [View Document](issues/ui-ux/FF-ISSUE-007-security-page-content-density.md) |
| **FF-ISSUE-008** | Redundancy and Ambiguous Boundary Between Help Center and Contact Pages | UI-UX | `Medium` | Observed / Needs Verification | Public Navigation & Support Pages | [View Document](issues/ui-ux/FF-ISSUE-008-help-center-contact-redundancy.md) |
| **FF-ISSUE-009** | Authentication Pages Omit Navigation Bar and Footer | UI-UX | `Medium` | Observed / Needs Verification | Authentication Pages (Login, Register, Password Reset) | [View Document](issues/ui-ux/FF-ISSUE-009-auth-pages-navbar-footer.md) |
| **FF-ISSUE-010** | Deletion Actions Trigger Unstyled Browser Native Confirm Dialogs | UI-UX | `Medium` | Observed | Master Registries (Trucks, Drivers, Parties) | [View Document](issues/ui-ux/FF-ISSUE-010-native-browser-confirm-dialogs.md) |
| **FF-ISSUE-011** | Form Select Dropdowns Render as Unstyled Browser Native Elements | UI-UX | `Medium` | Observed | Form Inputs & Dispatch Modals | [View Document](issues/ui-ux/FF-ISSUE-011-native-select-dropdown-ui.md) |
| **FF-ISSUE-012** | Validation Error Toast Renders Behind Active Modal and Auto-Dismisses Too Rapidly | UI-UX | `High` | Observed | Global Toast Notifications & Modal Dialogs | [View Document](issues/ui-ux/FF-ISSUE-012-toast-zindex-and-dismissal.md) |
| **FF-ISSUE-013** | Category and Party Badge Visual Styling Inconsistency Across Modules | UI-UX | `Low` | Observed | Master Registries (Parties, Vendors, Customers) | [View Document](issues/ui-ux/FF-ISSUE-013-category-badge-styling-inconsistency.md) |
| **FF-ISSUE-014** | Cash Expense Category Badge and Text Presentation Inconsistencies | UI-UX | `Low` | Observed | Fleet Operations (Trip Details & Cash Expenses) | [View Document](issues/ui-ux/FF-ISSUE-014-cash-expense-badge-inconsistency.md) |
| **FF-ISSUE-015** | Fuel Payment Mode Badge Presentation Inconsistency | UI-UX | `Low` | Observed | Fleet Operations (Fuel Stops & Log Sheets) | [View Document](issues/ui-ux/FF-ISSUE-015-payment-mode-badge-inconsistency.md) |
| **FF-ISSUE-016** | Journey Status Display Inconsistency Between Plain Text and Badges | UI-UX | `Low` | Observed | Fleet Operations (Journeys List) | [View Document](issues/ui-ux/FF-ISSUE-016-trip-status-badge-inconsistency.md) |
| **FF-ISSUE-017** | Estimated Transit Days Numeric Field Trapped at Zero Without Clear Behavior | UI-UX | `Medium` | Observed | Fleet Operations (Create Truck Dispatch Modal) | [View Document](issues/ui-ux/FF-ISSUE-017-numeric-input-clearing-transit-days.md) |
| **FF-ISSUE-018** | Driver Settlement Wage Calculator Fields Trapped at Zero Without Clear Behavior | UI-UX | `Medium` | Observed | Commercial Finance (Driver Settlements) | [View Document](issues/ui-ux/FF-ISSUE-018-numeric-input-clearing-settlement.md) |
| **FF-ISSUE-019** | Sidebar Active Menu Item Highlight Missing on Nested Navigation Routes | UI-UX | `Low` | Observed | App Shell & Navigation Sidebar | [View Document](issues/ui-ux/FF-ISSUE-019-sidebar-active-route-highlight.md) |
| **FF-ISSUE-020** | Support Ticket Creation Form Spacing, Field Boundaries, and Layout Distortion | UI-UX | `Medium` | Observed | Help & Customer Support Module | [View Document](issues/support-tickets/FF-ISSUE-020-support-ticket-form-layout.md) |
| **FF-ISSUE-021** | Support Ticket Message Thread and Reply Composer Horizontal Clipping | UI-UX | `Medium` | Observed | Help & Customer Support Module | [View Document](issues/support-tickets/FF-ISSUE-021-support-ticket-thread-layout.md) |
| **FF-ISSUE-022** | Absence of Central Platform-Wide Support Inbox for SaaS Operators | Workflow / Support | `High` | Observed / Needs Verification | Super-Admin Control Plane & Support Operations | [View Document](issues/support-tickets/FF-ISSUE-022-central-support-inbox-missing.md) |
| **FF-ISSUE-023** | Trial Duration Inconsistency Between 7-Day Decision and 14-Day Display | Subscriptions & Billing | `High` | Observed / Needs Verification | SaaS Billing & Onboarding Lifecycle | [View Document](issues/subscriptions-billing/FF-ISSUE-023-trial-duration-inconsistency.md) |
| **FF-ISSUE-024** | Company Workspace Module Access Configuration Control Missing | Workflow / Configuration | `Medium` | Observed / Needs Verification | Company Workspace Settings & Entitlements | [View Document](issues/subscriptions-billing/FF-ISSUE-024-company-module-access-control.md) |
| **FF-ISSUE-025** | PRO-Locked Modules Remain Accessible Despite UI Lock Badges | Security / Subscriptions | `High` | Observed / Needs Verification | Feature Gating & Entitlements Middleware | [View Document](issues/subscriptions-billing/FF-ISSUE-025-pro-module-lock-bypass.md) |
| **FF-ISSUE-026** | Subscription Plan-Change Mutation Fails Due to Missing Idempotency Key Header | Bug / Financial | `High` | Observed | SaaS Billing & Subscription Management | [View Document](issues/subscriptions-billing/FF-ISSUE-026-plan-change-missing-idempotency-key.md) |
| **FF-ISSUE-027** | Subscription Plan-Change Fails with Payment Window Closed Rejection | Bug / Financial | `High` | Observed | SaaS Billing & Razorpay Checkout Integration | [View Document](issues/subscriptions-billing/FF-ISSUE-027-plan-change-payment-window-closed.md) |
| **FF-ISSUE-028** | Vehicle Current Driver Display Stale or Inconsistent After Assignment Mutation | Bug | `High` | **Resolved (Batch C)** | Fleet Management / Vehicle Profiles | [View Document](issues/fleet-assignments/FF-ISSUE-028-vehicle-current-driver-stale-display.md) |
| **FF-ISSUE-029** | Simultaneous Active Vehicle Assignment Display Across Multiple Driver Records | Bug | `Critical` | **Resolved (Batch C)** | Fleet Management / Driver Profiles | [View Document](issues/fleet-assignments/FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md) |
| **FF-ISSUE-030** | Mid-Trip Driver Handover and Concurrent Assignment Safeguards Unclear | Workflow | `High` | **Resolved (Batch C)** | Fleet Management / Dispatch Operations | [View Document](issues/fleet-assignments/FF-ISSUE-030-driver-vehicle-concurrency-safeguards.md) |
| **FF-ISSUE-031** | Driver Assignment History and Unallocated Pool State Discrepancy After Trip Creation | Bug | `High` | **Resolved (Batch C)** | Fleet Management / Driver Profiles | [View Document](issues/fleet-assignments/FF-ISSUE-031-driver-assignment-history-audit-trail-missing.md) |
| **FF-ISSUE-032** | Vehicle Operational Status Stale in Fleet List After Dispatch Action | Bug | `High` | **Resolved (Batch C)** | Fleet Management / Vehicle List | [View Document](issues/fleet-assignments/FF-ISSUE-032-vehicle-status-stale-after-dispatch.md) |
| **FF-ISSUE-033** | Duplicate GSTIN Accepted Across Distinct Customer Billing Parties | Validation / Compliance | `High` | Observed | Master Registries (Parties & Customers) | [View Document](issues/data-validation/FF-ISSUE-033-duplicate-gstin-billing-parties.md) |
| **FF-ISSUE-034** | Multiple Commercial Driver Profiles Accept Duplicate Aadhaar and Mobile Numbers | Validation / Compliance | `High` | Observed | Master Registries (Commercial Drivers) | [View Document](issues/data-validation/FF-ISSUE-034-duplicate-driver-aadhaar-mobile.md) |
| **FF-ISSUE-035** | Draft Trip Exposes Ineligible Routine Operational Action Tabs | Workflow | `High` | **Resolved (Batch C)** | Trip Lifecycle / Trip Details | [View Document](issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md) |
| **FF-ISSUE-036** | Trip Checkpoint Added From List Missing in Record Until Browser Refresh | Bug | `High` | **Resolved (Batch C)** | Trip Lifecycle / Checkpoints & Milestones | [View Document](issues/trip-lifecycle/FF-ISSUE-036-checkpoint-missing-until-browser-refresh.md) |
| **FF-ISSUE-037** | Completed Trip Remains Editable Through Routine Operational Actions | Workflow | `High` | **Resolved (Batch C)** | Trip Lifecycle / Completed Trips | [View Document](issues/trip-lifecycle/FF-ISSUE-037-completed-trip-operational-actions-editable.md) |
| **FF-ISSUE-038** | Fuel Stops and Milestones Cannot Be Edited or Corrected After Submission | Workflow | `Medium` | **Resolved (Batch C)** | Trip Lifecycle / Fuel & Milestones | [View Document](issues/trip-lifecycle/FF-ISSUE-038-fuel-stops-milestones-edit-missing.md) |
| **FF-ISSUE-039** | Cash Expenses Cannot Be Edited to Add or Replace Receipt Voucher | Workflow | `Medium` | **Resolved (Batch C)** | Trip Lifecycle / Cash Expenses | [View Document](issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md) |
| **FF-ISSUE-040** | Estimated Transit Days Numeric Input Cannot Clear Default Zero | UI-UX | `Medium` | Observed | Trip Lifecycle / Create Dispatch | [View Document](issues/trip-lifecycle/FF-ISSUE-040-transit-days-input-traps-zero.md) |
| **FF-ISSUE-041** | Customer or Shipper Billing Party Field Purpose and Downstream Linkage Unclear | Workflow | `Medium` | Needs Verification | Trip Lifecycle / Dispatch Creation | [View Document](issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md) |
| **FF-ISSUE-042** | Opening Balance Modification Discrepancy and Current Balance Desynchronization | Financial | `High` | **Resolved (Batch B)** | Financial Accounting / Party Balances | [View Document](issues/financial-accounting/FF-ISSUE-042-opening-balance-edit-reflection.md) |
| **FF-ISSUE-043** | Driver Cash Advance Not Reduced by Fuel Purchases Funded via Advance | Financial | `High` | **Resolved (Batch B)** | Financial Accounting / Driver Advances & Fuel | [View Document](issues/financial-accounting/FF-ISSUE-043-driver-cash-advance-fuel-deduction-missing.md) |
| **FF-ISSUE-044** | Fuel Payment Modes Lack Defined Ledger and Payable Accounting Routing | Financial | `High` | **Resolved (Batch B)** | Financial Accounting / Fuel & Payables | [View Document](issues/financial-accounting/FF-ISSUE-044-fuel-payment-mode-accounting-semantics.md) |
| **FF-ISSUE-045** | Customer Credit Limit, Outstanding, and Vendor Balance Semantics Unclear | Financial | `High` | **Resolved (Batch B)** | Financial Accounting / Commercial Parties | [View Document](issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md) |
| **FF-ISSUE-046** | Driver Settlement Wage Calculator Numeric Inputs Trap Default Zero | UI-UX | `Medium` | Observed | Financial Accounting / Driver Settlement | [View Document](issues/financial-accounting/FF-ISSUE-046-driver-settlement-numeric-inputs-trap-zero.md) |
| **FF-ISSUE-047** | Market Vehicle Movement Purpose Overlaps Owned-Fleet Trip Dispatch | Workflow | `Medium` | Needs Verification | Market Movements / Commercial Fleet | [View Document](issues/market-movements/FF-ISSUE-047-market-movement-trip-dispatch-overlap.md) |
| **FF-ISSUE-048** | Market Movement Status Remains "Pending" After POD Received | Workflow | `Medium` | Observed | Market Movements / Settlement Lifecycle | [View Document](issues/market-movements/FF-ISSUE-048-market-movement-status-ambiguity-pod.md) |
| **FF-ISSUE-049** | Market Movement List View Overcrowded and Visually Clipped | UI-UX | `Medium` | Observed | Market Movements / Movement Listing | [View Document](issues/market-movements/FF-ISSUE-049-market-movement-list-overcrowded.md) |
| **FF-ISSUE-050** | Market Movement Financial Calculation Unresolved Arithmetic Discrepancy | Financial | `High` | **Resolved (Batch B)** | Market Movements / Financial Settlement | [View Document](issues/market-movements/FF-ISSUE-050-market-movement-financial-discrepancy.md) |
| **FF-ISSUE-051** | Regional Branch Creation Form Excessive Whitespace and Input Boundary Distortion | UI-UX | `Medium` | Observed | Regional Branches & Hubs | [View Document](issues/branches-hubs/FF-ISSUE-051-branch-creation-form-ui.md) |
| **FF-ISSUE-052** | Regional Branch Listing UI Lacks Card Containment and Action Buttons | UI-UX | `Medium` | Observed | Regional Branches & Hubs | [View Document](issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md) |
| **FF-ISSUE-053** | Branches & Hubs Operational Integration Missing (Trips, Sequences, Staff Scope) | Workflow / Architecture | `High` | Agreed Future Behavior / Not Implemented | Regional Branches & Enterprise Operations | [View Document](issues/branches-hubs/FF-ISSUE-053-branch-hub-operational-integration.md) |
| **FF-ISSUE-054** | Notification Delivery Logs Show Sent Status but Zero Delivered Rate | Bug / Notifications | `High` | Observed / Needs Verification | Communications & Notification Delivery Logs | [View Document](issues/notifications/FF-ISSUE-054-notification-delivery-tracking-zero-rate.md) |
| **FF-ISSUE-055** | Notification Delivery System Lacks Comprehensive Lifecycle, Webhook Safety & Retry Policy | Architecture / Reliability | `High` | Agreed Future Behavior / Not Implemented | Communications & Notification Dispatch Engine | [View Document](issues/notifications/FF-ISSUE-055-notification-retry-webhook-lifecycle.md) |
| **FF-ISSUE-056** | Platform Super-Admin Possesses Unrestricted Unscoped Access to Tenant Business Data | Security / Architecture | `Critical` | **Resolved (Batch A)** | Super-Admin Control Plane & Tenant Security | [View Document](issues/support-impersonation/FF-ISSUE-056-superadmin-unscoped-tenant-access.md) |
| **FF-ISSUE-057** | Support Impersonation Session Granted Without Workspace-Admin Prior Approval | Security / Workflow | `High` | **Resolved (Batch A)** | Super-Admin Control Plane & Tenant Governance | [View Document](issues/support-impersonation/FF-ISSUE-057-support-impersonation-approval-missing.md) |
| **FF-ISSUE-058** | Intermittent Incognito Session Data Blanking and Immediate Logout on Refresh | Bug / Authentication | `High / Intermittent` | Observed / Needs Verification (RETEST LAST) | Authentication, JWT Sessions & Tenant Context Initialization | [View Document](issues/authentication-session/FF-ISSUE-058-incognito-session-instability.md) |
| **FF-ISSUE-059** | Approval Workflow Not Triggered for Dispatcher-Created Trip | Workflow | `High` | Needs Verification | Approvals & Governance / Trip Dispatch | [View Document](issues/approvals/FF-ISSUE-059-dispatcher-trip-creation-approval-bypass.md) |
| **FF-ISSUE-060** | Accounts Receivable (AR) Aging Report Visual Styling and Aging Bucket Semantics | Financial | `Medium` | Needs Verification | Reporting & Analytics / AR Aging | [View Document](issues/reporting/FF-ISSUE-060-ar-aging-report-styling-and-bucket-semantics.md) |

---

## 4. Architectural & Product Design Decisions (DEC Register)

| Decision ID | Title | Approval Status | Scope / Impact | Document Link |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-001** | DEC-001 — Fleet Flow Pricing, Tiering, and Quota Matrix | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-001-pricing-quota-matrix.md) |
| **DEC-002** | DEC-002 — Mandatory MongoDB Replica Sets Across Environments | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-002-mongodb-replica-sets.md) |
| **DEC-003** | DEC-003 — Production S3 and Object Storage Enforcement | **Pending Review** | Core Architecture / Governance | [View Decision](decisions/DEC-003-production-s3-object-storage.md) |
| **DEC-004** | DEC-004 — Freight Invoice Eligibility Post Delivery and POD by Default | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-004-freight-invoice-eligibility.md) |
| **DEC-005** | DEC-005 — Freight Invoice Creation Dual Access Paths | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-005-invoice-creation-dual-paths.md) |
| **DEC-006** | DEC-006 — Manual and Automatic Payment Allocation to Invoices | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-006-payment-allocation-methods.md) |
| **DEC-007** | DEC-007 — Customer Credit Limit Exceeded Warning and Authorized Override | **Implemented (Option B - Batch B)** | Core Architecture / Governance | [View Decision](decisions/DEC-007-credit-limit-warning-and-override.md) |
| **DEC-008** | DEC-008 — Completed Trip Operational Locks and Reason-Audited Late Corrections | **Implemented (Audited Corrections - Batch C)** | Core Architecture / Governance | [View Decision](decisions/DEC-008-completed-trip-operational-locks.md) |
| **DEC-009** | DEC-009 — Decoupled Lorry Receipt (LR) and Trip Workflow Architecture | **Approved** | Core Architecture / Governance | [View Decision](decisions/DEC-009-lr-trip-workflow-architecture.md) |
| **DEC-010** | DEC-010 — Branches and Regional Hubs Organizational and Operational Model | **Agreed** | Core Architecture / Governance | [View Decision](decisions/DEC-010-branches-hubs-operational-model.md) |
| **DEC-011** | DEC-011 — Notification Delivery Tracking, Webhook Reliability, and Audit Architecture | **Scope Locked** | Core Architecture / Governance | [View Decision](decisions/DEC-011-notification-delivery-reliability-scope.md) |
| **DEC-012** | DEC-012 — Tenant Privacy Architecture and Controlled Support Impersonation Access | **Implemented (Support Access Center - Batch A)** | Core Architecture / Governance | [View Decision](decisions/DEC-012-tenant-privacy-controlled-support-access.md) |

---

## 5. Unresolved Questions & Code Audit Investigations

| Question ID | Title | Priority | Status | Focus Module | Investigation Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QST-001** | QST-001 — Trial Duration Backend Provisioning Policy (7 Days vs 14 Days) | `High` | Investigation Required | Subscriptions & Tenant Provisioning | [View Question](issues/unresolved-questions/QST-001-trial-duration-backend-provisioning.md) |
| **QST-002** | QST-002 — Pro Module Feature Lock Backend API Enforcement Status | `High` | Investigation Required | Tenant Entitlements / Access Control | [View Question](issues/unresolved-questions/QST-002-pro-module-lock-api-enforcement.md) |
| **QST-003** | QST-003 — Super-Admin Endpoint Enumeration and Tenant Data Scoping Feasibility | `High` | **Resolved (Batch A)** | Super-Admin Portal / Platform Security | [View Question](issues/unresolved-questions/QST-003-superadmin-endpoint-scoping-feasibility.md) |
| **QST-004** | QST-004 — Platform-Wide Support Inbox Existence and Shared Ticket Synchronization | `High` | Investigation Required | Support Operations / Tenant Ticketing | [View Question](issues/unresolved-questions/QST-004-platform-support-inbox-and-sync.md) |
| **QST-005** | QST-005 — Dispatcher Trip Creation Approval Rule Applicability and Configuration | `High` | Investigation Required | Governance & Approvals / Trip Dispatch | [View Question](issues/unresolved-questions/QST-005-dispatcher-trip-creation-approval-rules.md) |
| **QST-006** | QST-006 — Notification Delivery Receipt Ingestion and Delivery Rate Calculation | `High` | Investigation Required | Notifications & Communications | [View Question](issues/unresolved-questions/QST-006-notification-receipt-ingestion-and-metrics.md) |
| **QST-007** | QST-007 — Subscription Plan-Change Missing Idempotency Key and Payment Window Status | `High` | Investigation Required | Subscriptions & Billing | [View Question](issues/unresolved-questions/QST-007-plan-change-idempotency-and-payment-window.md) |
| **QST-008** | QST-008 — Vehicle, Driver, and Checkpoint Stale State Causes and Invalidation Triggers | `High` | **Resolved (Batch C)** | Frontend State Architecture / Real-time Sync | [View Question](issues/unresolved-questions/QST-008-stale-state-invalidation-triggers.md) |
| **QST-009** | QST-009 — Fuel Payment Mode and Market Movement Deduction Accounting Semantics | `High` | **Resolved (Batch B)** | Financial Accounting / General Ledger | [View Question](issues/unresolved-questions/QST-009-fuel-and-market-ledger-accounting-semantics.md) |
| **QST-010** | QST-010 — GSTIN, Aadhaar, and Mobile Number Duplicate Validation Policy and Tenant Scoping | `High` | Investigation Required | Data Validation / Identity Security | [View Question](issues/unresolved-questions/QST-010-identifier-uniqueness-policy-and-scoping.md) |
| **QST-011** | QST-011 — Comprehensive Trip Lifecycle State Machine Preconditions | `High` | **Resolved (Batch C)** | Trip Operations / State Machine | [View Question](issues/unresolved-questions/QST-011-trip-lifecycle-state-machine-preconditions.md) |
| **QST-012** | QST-012 — Branch Integration Depth with Trips, Numbering, Reporting, and Permissions | `Medium` | Investigation Required | Branches & Regional Hubs | [View Question](issues/unresolved-questions/QST-012-branch-operational-integration-depth.md) |
| **QST-013** | QST-013 — Completed Trip Operational Locking and Late Entry Correction Workflow | `High` | **Resolved (Batch C)** | Trip Lifecycle / Governance | [View Question](issues/unresolved-questions/QST-013-completed-trip-correction-workflow-status.md) |
| **QST-014** | QST-014 — Incognito Workspace Authentication, Session State, and Invalidation (Retest LAST) | `High` | Investigation Required | Authentication & Session Management | [View Question](issues/unresolved-questions/QST-014-incognito-auth-session-invalidation.md) |

---

## 6. Legacy Identifier Reconciliation (`FF-MT` Mapping)

The original manual testing notes contained historical `FF-MT` labels. As documented in Section 4 of the master handoff, several historical identifiers were reused inconsistently in earlier assistant passes (specifically `FF-MT-021` through `FF-MT-026`).

The table below reconciles all legacy identifiers to their canonical, stable Fleet Flow issue records:

| Legacy ID | Canonical ID | Issue Title | Resolution / Note |
| :--- | :--- | :--- | :--- |
| **FF-MT-001** | `FF-ISSUE-001` | Inconsistent Public-Site Color Scheme | 1:1 mapping preserved |
| **FF-MT-002** | `FF-ISSUE-002` / `FF-ISSUE-023` | Inconsistent Trial Duration Display | Preserved in UI-UX & Subscriptions |
| **FF-MT-003** | `FF-ISSUE-003` | Unwanted Fleet ROI Calculator on Public Site | 1:1 mapping preserved |
| **FF-MT-004** | `FF-ISSUE-004` | Homepage Layout Density and Unverified Claims | 1:1 mapping preserved |
| **FF-MT-005** | `FF-ISSUE-005` | Features Page Information Architecture Density | 1:1 mapping preserved |
| **FF-MT-006** | `FF-ISSUE-006` | Pricing Page Visual Hierarchy and Design Restraint | 1:1 mapping preserved |
| **FF-MT-007** | `FF-ISSUE-007` | Pricing FAQ Layout Not Collapsible | 1:1 mapping preserved |
| **FF-MT-008** | `FF-ISSUE-008` | Security Page Content Overload for Top-Level Marketing | 1:1 mapping preserved |
| **FF-MT-009** | `FF-ISSUE-009` | Help Center and Contact Us Redundant Content | 1:1 mapping preserved |
| **FF-MT-010** | `FF-ISSUE-010` | Authentication Pages Missing Navigation and Footer | 1:1 mapping preserved |
| **FF-MT-011** | `FF-ISSUE-011` / `FF-ISSUE-024` | Company-Level Module Access Management Unclear | Preserved in UI-UX & Subscriptions |
| **FF-MT-012** | `FF-ISSUE-012` / `FF-ISSUE-025` | PRO-Locked Modules Accessible Despite Lock Badge | Preserved in UI-UX & Subscriptions |
| **FF-MT-013** | `FF-ISSUE-013` / `FF-ISSUE-020` | Support Ticket Creation Form Poor Layout | Preserved in UI-UX & Support Tickets |
| **FF-MT-014** | `FF-ISSUE-014` / `FF-ISSUE-021` | Support Ticket Thread & Reply Composer Misalignment | Preserved in UI-UX & Support Tickets |
| **FF-MT-015** | `FF-ISSUE-015` | Native Browser Confirm Dialog on Vehicle Deletion | 1:1 mapping preserved |
| **FF-MT-016** | `FF-ISSUE-016` | Dropdown Inputs Render Unstyled Native Controls | 1:1 mapping preserved |
| **FF-MT-017** | `FF-ISSUE-017` / `FF-ISSUE-028` | Stale Assignment State Requiring Manual Refresh | Preserved in UI-UX & Fleet Assignments |
| **FF-MT-018** | `FF-ISSUE-018` / `FF-ISSUE-029` | Simultaneous Active Vehicle Display on Dual Drivers | Preserved in UI-UX & Fleet Assignments |
| **FF-MT-019** | `FF-ISSUE-019` | GSTIN Error Toast Hidden Behind Modal | 1:1 mapping preserved |
| **FF-MT-020** | `FF-ISSUE-020` / `FF-ISSUE-033` | Duplicate GSTIN Accepted for Separate Billing Parties | Preserved in Data Validation |
| **FF-MT-021 (Legacy Conflict)** | `FF-ISSUE-034` | Duplicate Driver Aadhaar and Mobile Number Accepted | Disambiguated from legacy duplicate |
| **FF-MT-022 (Legacy Conflict)** | `FF-ISSUE-042` | Opening Balance Modification Discrepancy | Disambiguated from legacy duplicate |
| **FF-MT-023 (Legacy Conflict)** | `FF-ISSUE-040` | Estimated Transit Days Input Traps Zero | Disambiguated from legacy duplicate |
| **FF-MT-024 (Legacy Conflict)** | `FF-ISSUE-035` | Draft Trip Exposes Routine Operational Actions | Disambiguated from legacy duplicate |
| **FF-MT-026 (Legacy Conflict)** | `FF-ISSUE-036` | Checkpoint Missing From Trip Record Until Refresh | Disambiguated from legacy duplicate |
| **FF-MT-036** | `FF-ISSUE-030` | Mid-Trip Driver Handover and Concurrency Safeguards | 1:1 mapping preserved |
| **FF-MT-039** | `FF-ISSUE-047` | Market Vehicle Movement Purpose Overlaps Trip Dispatch | 1:1 mapping preserved |
| **FF-MT-040** | `FF-ISSUE-048` | Market Movement Status Ambiguity Post POD Received | 1:1 mapping preserved |
| **FF-MT-041** | `FF-ISSUE-049` | Market Movement List View Overcrowded and Clipped | 1:1 mapping preserved |
| **FF-MT-042** | `FF-ISSUE-045` / `FF-ISSUE-050` | Credit Limit Semantics & Market Discrepancy (₹3k) | Split into Accounting & Discrepancy |

---

## 7. Recommended Implementation Batches & Dependency Mappings

When implementation is formally authorized in future phases, issues should be addressed in the following coordinated batches to respect architectural dependencies:

### Batch A: Security, Tenant Privacy & Access Control
- **Focus:** Super-Admin impersonation safeguards, backend role scoping, and tenant isolation.
- **Issues:** `FF-ISSUE-056`, `FF-ISSUE-057`, `FF-ISSUE-022`
- **Decisions & Questions:** `DEC-012`, `QST-003`, `QST-004`
- **Dependencies:** Core authentication middleware must enforce tenant boundaries before UI workflows are built.

### Batch B: Core Fleet Assignments, Concurrency & Data Refresh
- **Focus:** Driver/truck assignment integrity, eliminating stale cached UI states, and driver handover safeguards.
- **Issues:** `FF-ISSUE-017`, `FF-ISSUE-018`, `FF-ISSUE-028`, `FF-ISSUE-029`, `FF-ISSUE-030`, `FF-ISSUE-031`, `FF-ISSUE-032`, `FF-ISSUE-036`
- **Decisions & Questions:** `QST-008`, `QST-010`
- **Dependencies:** Fix database assignment query logic before applying React Query cache invalidation.

### Batch C: Financial Invariants, Advance Reconciliation & Ledger Integrity
- **Focus:** Driver cash advance fuel deductions, market movement arithmetic audit, party balance reconciliation, and credit limits.
- **Issues:** `FF-ISSUE-042`, `FF-ISSUE-043`, `FF-ISSUE-044`, `FF-ISSUE-045`, `FF-ISSUE-050`
- **Decisions & Questions:** `DEC-004`, `DEC-006`, `DEC-007`, `QST-009`
- **Dependencies:** Requires code audit of general ledger postings and double-entry invariants.

### Batch D: Trip Lifecycle, State Machine & Audit Locks
- **Focus:** Locking draft and completed trips, providing audited late entry workflows, and decoupling LRs from trips.
- **Issues:** `FF-ISSUE-035`, `FF-ISSUE-037`, `FF-ISSUE-038`, `FF-ISSUE-039`, `FF-ISSUE-041`, `FF-ISSUE-059`
- **Decisions & Questions:** `DEC-008`, `DEC-009`, `QST-005`, `QST-011`, `QST-013`
- **Dependencies:** Backend state machine guards must be deployed before UI tabs are updated.

### Batch E: Subscription Entitlements, Idempotency & Billing Flow
- **Focus:** 7-day trial provisioning, plan change idempotency keys, payment window lifecycle, and PRO module lock enforcement.
- **Issues:** `FF-ISSUE-002`, `FF-ISSUE-012`, `FF-ISSUE-023`, `FF-ISSUE-024`, `FF-ISSUE-025`, `FF-ISSUE-026`, `FF-ISSUE-027`
- **Decisions & Questions:** `DEC-001`, `QST-001`, `QST-002`, `QST-007`

### Batch F: Notification Delivery Tracking, Webhooks & Reliable Retries
- **Focus:** Webhook ingestion for delivery receipts, retry backoff queues, and accurate delivery ratio metrics.
- **Issues:** `FF-ISSUE-054`, `FF-ISSUE-055`
- **Decisions & Questions:** `DEC-011`, `QST-006`

### Batch G: Regional Branches, Hubs & Operational Numbering
- **Focus:** UI layouts for branch creation/listing and operational integration into trip dispatch and document numbering.
- **Issues:** `FF-ISSUE-051`, `FF-ISSUE-052`, `FF-ISSUE-053`
- **Decisions & Questions:** `DEC-010`, `QST-012`

### Batch H: Design System, UI-UX Polish & Forms
- **Focus:** Public landing pages, form alignment, badge styling consistency, accessible modals, and input clearing.
- **Issues:** `FF-ISSUE-001`, `FF-ISSUE-003` to `FF-ISSUE-011`, `FF-ISSUE-013` to `FF-ISSUE-016`, `FF-ISSUE-019`, `FF-ISSUE-020`, `FF-ISSUE-021`, `FF-ISSUE-040`, `FF-ISSUE-046`, `FF-ISSUE-049`, `FF-ISSUE-060`

### Final Regression & Retest (STRICT RULE)
- **Item:** `FF-ISSUE-058` / `QST-014` — Intermittent Incognito Authentication & Session Instability
- **Constraint:** Must be tested **strictly after all other batches are deployed and verified**, using clean multi-browser incognito sessions.

---

## 8. Governance Reminder

> [!IMPORTANT]
> **Documentation is Not Evidence of a Fix:** The existence of these issue records and design decisions does not indicate that the issues have been resolved or that the code currently adheres to these designs.
> **Authorization Invariant:** No application source code changes, database migrations, or git commits are authorized under this task.
