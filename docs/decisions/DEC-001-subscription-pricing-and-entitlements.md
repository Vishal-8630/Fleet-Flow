# DEC-001: Commercial Subscription Pricing, Truck Quotas & Starter Plan Inclusions

**Decision ID:** `DEC-001`  
**Title:** Commercial Subscription Pricing, Truck Quotas and Starter Plan Entitlements Alignment  
**Category:** Product Monetization & Commercial Strategy  
**Status:** Approved  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#7-product--architectural-decisions-register-dec-)  
**Directly Resolves Issues:** [`ISS-011`](../issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](../issues/ISS-012-starter-plan-entitlement-trap.md)

---

## 1. Context & Historical Discrepancies

During repository audits across Batches 1–5, two critical commercial and technical discrepancies were identified:

1. **Pricing and Quota Mismatch ([`ISS-011`](../issues/ISS-011-pricing-page-seed-discrepancy.md)):**
   - The frontend marketing page ([`PricingPage.tsx`](../../frontend/src/pages/marketing/PricingPage.tsx)) originally hardcoded display cards:
     - Starter: ₹1,999 / mo (5 trucks)
     - Standard: ₹4,999 / mo (20 trucks) or ₹3,999 / mo (15 trucks in earlier iterations)
     - Pro: ₹8,999 / mo (Unlimited trucks) or ₹9,999 / mo (60 trucks in legacy drafts)
   - In contrast, the backend database seed service ([`billingSeedService.ts`](../../backend/src/utils/billingSeedService.ts)) configured different prices and quotas:
     - Starter: ₹1,499 / mo (`149900` paise, 5 trucks)
     - Standard: ₹3,999 / mo (`399900` paise) or ₹4,999 / mo (`499900` paise, 20 trucks)
     - Pro: ₹8,999 / mo (`899900` paise) or ₹9,999 / mo (`999900` paise, 60 trucks)
   - These mismatches created severe consumer trust and billing reconciliation risks.

2. **Entitlement Trap on Starter Plan ([`ISS-012`](../issues/ISS-012-starter-plan-entitlement-trap.md)):**
   - Marketing promised transport operators that the Starter Plan included 3-part printable LR / Bilty generation and basic PDF GST invoicing.
   - However, the backend feature catalog ([`featureCatalog.ts`](../../backend/src/utils/featureCatalog.ts)) and seed service ([`billingSeedService.ts`](../../backend/src/utils/billingSeedService.ts)) restricted `MOD_LR_ENGINE` and `MOD_BILLING_INVOICE` to the Standard and Pro tiers.
   - As a result, when a customer signed up on trial (which granted Standard features) and converted to a paid Starter subscription, their access to LR creation and Invoicing was revoked, triggering HTTP 403 `FEATURE_LOCKED` on the core day-to-day operations of their transport business.

3. **Evolution of Proposal Drafts:**
   - Earlier preliminary drafts explored aligning to legacy seed numbers (e.g. ₹1,499 with 5 trucks) or lower truck quotas (5 trucks for Starter, 15–20 trucks for Standard, 50–60 trucks for Pro).
   - The proposed pricing matrix was revised to the values shown in this decision, adjusting vehicle allocations (15 trucks for Starter, 30 trucks for Standard), proposing unlimited trucks on Pro subject to a fair-use policy, and defining an explicit 7-day free trial tier.

---

## 2. Authoritative Commercial Decisions (Approved by Product Owner)

The following canonical pricing, quota, and entitlement matrix has received formal Product Owner approval:

### 2.1. Authoritative Proposed Pricing & Quota Matrix

| Plan Tier | Monthly Price (GST-Inclusive) | Annual Price (GST-Inclusive) | Truck Quota | Branch Quota | User Quota | Included Entitlements & Capabilities |
|---|---:|---:|---|---|---|---|
| **Trial** | **Free for 7 calendar days** | *Not applicable* | **5 trucks** | **1 branch** | **2 users** | Starter-level feature access, including `MOD_LR_ENGINE` and `MOD_BILLING_INVOICE`. Evaluates core workflow fit. |
| **Starter** | **₹1,999** | **₹19,990** | **15 trucks** | **1 branch** | **2 users** | Fleet registry (`MOD_FLEET`), driver master (`MOD_DRIVERS`), trip dispatch (`MOD_TRIPS`), market vehicle movements (`MOD_MARKET_VEHICLES`), party registry (`MOD_PARTIES`), compliance vault (`MOD_DOCUMENT_VAULT`), plus proposed inclusion of **`MOD_LR_ENGINE`** (3-part LR/Bilty generation) and **`MOD_BILLING_INVOICE`** (basic GST invoicing). |
| **Standard** | **₹3,999** | **₹39,990** | **30 trucks** | **3 branches** | **5 users** | All Starter modules plus driver settlements (`MOD_SETTLEMENTS`), double-entry general ledger (`MOD_LEDGERS`), operational reports (`MOD_REPORTS`), and WhatsApp notifications (`MOD_WHATSAPP`).<br><br>**Multi-Branch Entitlement Scope:** The intended scope is strictly a **proposed quota of up to 3 branch hub profiles** (enabling branch codes, addresses, and local LR/invoice prefix generation), subject to catalog reconciliation and actual quota enforcement. This branch quota **must not automatically grant unrelated Enterprise-only features** (e.g. inter-hub transit accounting or regional hub segregation). Catalog reconciliation and branch quota enforcement are required before this entitlement is operational (*Proposed — implementation/catalog verification required*). |
| **Pro** | **₹8,999** | **₹89,990** | **Unlimited** *(Subject to Fair-Use Policy)* | *Undecided* | *Undecided* | All Standard modules plus custom fields studio (`MOD_CUSTOM_FIELDS`), multi-step approvals (`MOD_WORKFLOW_APPROVALS`), audit logs (`MOD_AUDIT_LOGS`), predictive analytics (`MOD_FLEET_IQ`), preventative maintenance (`MOD_MAINTENANCE`), and Tally export (`MOD_TALLY_SYNC`).<br><br>**Unconfirmed / Non-Entitlement Capabilities Clarification:**<br>• **GPS / Telematics:** `MOD_GPS_SYNC` is currently an Enterprise module / standalone add-on and is **not** included in the Pro seed; it is not a Pro entitlement.<br>• **Customer Tracking Portals:** Portals exist in the codebase via OTP auth, but do **not** have a tenant subscription entitlement module; they are not a confirmed Pro entitlement, and their future plan allocation and subscription gating remain undecided.<br>• **External API Integrations:** A developer API gateway and API-key management are not currently implemented; this is a proposed future capability, not an existing plan entitlement.<br>• **Priority Support:** Operational SLA / business commitment, not a currently implemented software module; remains proposed until an actual support policy is defined. |

### 2.2. Core Commercial Rules & Pricing Mechanics

1. **GST Inclusivity:**
   - All proposed paid subscription prices (both monthly and annual) are **GST-inclusive**.
   - The headline price is the exact gross amount charged to the subscriber. The platform will handle internal tax accounting (18% GST: 9% CGST + 9% SGST or 18% IGST) without adding unexpected tax surcharges at checkout. (Detailed breakdown formulas, component rounding rules, and invoice display format remain provisional and subject to formal tax/accounting approval under Section 4, Item 4).

2. **Annual Billing Incentive (10x Monthly Multiplier):**
   - Annual billing is priced at exactly **10 times the monthly price** for 12 months of platform service:
     - Starter: ₹19,990 / year (vs ₹23,988 if paid monthly)
     - Standard: ₹39,990 / year (vs ₹47,988 if paid monthly)
     - Pro: ₹89,990 / year (vs ₹107,988 if paid monthly)
   - This pricing structure delivers **2 months free**, representing an **approximate 16.7% discount** (not exactly 16.7%, reflecting $\frac{2}{12} = 16.\bar{6}\%$) compared to 12 consecutive monthly payments.

3. **Free Trial Tier Definition:**
   - The **Trial** plan is a **free 7-calendar-day trial**, not a separate paid subscription tier.
   - The trial provides Starter-level feature access (including LR generation and basic GST invoicing) with a strict **5-truck limit**, **1 branch**, and **2 users**.
   - The goal is to allow transport operators to evaluate core operational workflows without friction before committing to a paid tier.

4. **Starter & Standard Quota Allocations:**
   - **Starter**: 15 trucks, 1 branch, 2 users.
   - **Standard**: 30 trucks, 3 branches, 5 users. (Note: Standard's multi-branch entitlement is defined as a proposed quota of up to 3 branch profiles, subject to catalog reconciliation and actual quota enforcement; this must not automatically grant unrelated Enterprise-only features).
   - **Pro**: Unlimited trucks, subject to a documented fair-use policy. Pro branch and user limits **remain undecided** and are not arbitrarily invented.

5. **Starter Plan Entitlement Inclusions (`MOD_LR_ENGINE` & `MOD_BILLING_INVOICE`):**
   - The proposed decision formally includes both **`MOD_LR_ENGINE`** (LR/Bilty generation) and **`MOD_BILLING_INVOICE`** (basic GST invoicing) in the Starter tier.
   - *Commercial Rationale:* LR generation and freight billing are non-negotiable operational necessities for any transport business in India. A paying Starter subscriber must not lose access to these core operations when their trial ends or when their subscription changes to Starter. Advanced billing capabilities (such as automated e-Way bill sync, multi-branch GSTIN routing, and consolidated milk-run billing) remain restricted to higher tiers (or require implementation/catalog verification).

### 2.3. Implementation Note: Verified Route Entitlement and Quota Gaps

Based on source-code inspection of [`featureCatalog.ts`](../../backend/src/utils/featureCatalog.ts), [`entitlementMiddleware.ts`](../../backend/src/middleware/entitlementMiddleware.ts), and active Express routes:
1. **Route Entitlement Gaps (Unfixed Audit Findings):**
   - `MOD_WORKFLOW_APPROVALS` is catalogued and seeded under Pro, but [`approvalRoutes.ts`](../../backend/src/routes/approvalRoutes.ts) currently lacks a route-level `requireFeature('MOD_WORKFLOW_APPROVALS')` guard.
   - `MOD_TALLY_SYNC` is catalogued and seeded under Pro and implemented via `/api/commercial/reports/export/tally` in [`commercialReportRoutes.ts:27`](../../backend/src/routes/commercialReportRoutes.ts#L27), but lacks a route-level `requireFeature('MOD_TALLY_SYNC')` guard.
   *(Note: These gaps are documented as verified audit findings; no code changes have been made to address them in this documentation task).*
2. **Branch Quota Enforcement Gap:**
   - [`entitlementMiddleware.ts`](../../backend/src/middleware/entitlementMiddleware.ts) currently implements `requireQuota` only for `'trucks' | 'drivers' | 'users'`. No `requireQuota('branches')` exists, and [`branchController.ts`](../../backend/src/controllers/branchController.ts) enforces no branch quantity checks.
3. **Multi-Branch Catalog Alignment:**
   - `MOD_MULTI_BRANCH` is classified under `defaultTier: 'enterprise'` in [`featureCatalog.ts`](../../backend/src/utils/featureCatalog.ts) and only seeded in the Enterprise plan. Standard's proposed 3-branch limit requires either down-tiering a basic branch quota from `MOD_MULTI_BRANCH` or decoupling branch count quotas from enterprise multi-branch ledger features, ensuring Standard subscribers do not inadvertently receive enterprise capabilities.
4. **GPS Sync Classification:**
   - `MOD_GPS_SYNC` is catalogued under `defaultTier: 'enterprise'` (`isStandaloneAddon: true`) and seeded exclusively in the Enterprise plan in [`billingSeedService.ts:126`](../../backend/src/utils/billingSeedService.ts#L126). It is not part of the Pro tier.
5. **Stakeholder Portals & Public Tracking:**
   - Stakeholder portals ([`portalRoutes.ts`](../../backend/src/routes/portalRoutes.ts)) and public tracking ([`trackingRoutes.ts`](../../backend/src/routes/trackingRoutes.ts)) operate via external OTP/JWT authentication and rate limiting without tenant subscription gating. They are not defined as module keys (`ModuleKey`) in `MOD_CATALOG`.

---

## 3. Approved Commercial Decisions & Operational Policies

The following specific policies have received formal Product Owner approval as documented:

1. **Standard 3-Branch Quota Inclusion:**
   - *Recommendation:* Standard should include a proposed quota of up to three branch profiles (local branch codes, prefixes, addresses), subject to catalog reconciliation and actual branch quota enforcement implemented in middleware and controllers. Explicitly, this must not automatically grant unrelated Enterprise-only features.
2. **Pro Unlimited Trucks with Documented Fair-Use Policy:**
   - *Recommendation:* Pro should retain unlimited trucks (`max_trucks: -1`), governed by a documented Fair-Use Policy. Initial implementation may utilize documented monitoring and manual account management review without inventing arbitrary commercial restrictions.
3. **Trial Expiry Transition to Read-Only Mode:**
   - *Recommendation:* Trial expiration without payment should transition tenant to read-only access (`is_read_only: true`), permitting historical viewing, ledger auditing, and document export while blocking write operations. A detailed permissions matrix must be reviewed and approved before technical enforcement.
4. **Downgrade Timing & Billing Cycle Compliance:**
   - *Recommendation:* Downgrades should normally take effect at the end of the current billing cycle (rather than immediately mid-cycle), subject to the tenant resolving resource counts exceeding target quotas before the downgrade completes, and an approved policy for annual subscriptions.
5. **Route-Level Entitlement Guard Hardening in Batch 5:**
   - *Recommendation:* Route-level guards for `MOD_WORKFLOW_APPROVALS` on `approvalRoutes.ts` and `MOD_TALLY_SYNC` on `commercialReportRoutes.ts:27` should be explicitly included in Batch 5 implementation scope and covered by integration tests under canonical specification [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md).
6. **GST-Inclusive Headline Pricing & Tax Reconciliation:**
   - *Recommendation:* GST-inclusive headline prices should be preserved. However, production tax calculations, component rounding (CGST/SGST vs IGST to paise precision), and invoice reconciliation rules must be reviewed and approved before final billing behavior is activated.

---

## 4. Explicit Deferrals (Undecided Commercial Policies & Scope-Specific Blockers)

The following items are recognized as **unresolved and explicitly deferred**. 

> [!IMPORTANT]
> **Scope-Specific Blocking Rule:** Unresolved commercial policies block **only the specific functionality that depends on them**. They do not block independent, foundational Batch 5 technical work (such as dynamic pricing rendering, seed upserting, Starter entitlement corrections, or payment simulation hardening). Affected functionality must **not** be implemented on assumed rules.

1. **Exact Pro Fair-Use Policy (FUP) Numerical Thresholds:**
   - *Scope:* Exact numerical threshold or operational criteria (e.g., soft threshold at 100, 150, or 200 active vehicles; API call rate ceilings; active concurrent trips) triggering account review. Initial implementation may use documented monitoring and manual review only if this does not require inventing a commercial restriction.
   - *Scope-Specific Blocking Impact:* Blocks automated FUP account suspension or hard-capping triggers. Does not block seeding Pro with `max_trucks: -1` and baseline manual monitoring.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

2. **Exact Pro Branch and User Quotas:**
   - *Scope:* Branch and user/driver seat limits for the Pro tier remain undecided. (Must not be arbitrarily invented).
   - *Scope-Specific Blocking Impact:* Blocks setting hard quota caps for Pro branches and users in database seed data.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

3. **Add-On Pricing, Pack Sizes, and Billing Cycles:**
   - *Scope:* Concrete price points for add-ons (e.g., ₹X per truck/month, ₹Y per 5-user pack, ₹Z per 1,000 WhatsApp credits), and billing synchronization (co-terminating vs independent cycles).
   - *Scope-Specific Blocking Impact:* Undefined add-on pricing blocks selling add-ons or offering them at checkout. This does not block core plan subscription checkout, dynamic pricing rendering, or plan upgrade/downgrade workflows.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

4. **Final GST Calculation, Rounding, and Invoice Presentation Rules:**
   - *Scope:* Formal accounting rules for tax separation from GST-inclusive headline prices, component rounding (CGST/SGST vs IGST to paise precision), line-item tax reconciliation, and customer tax invoice display format.
   - *Commercial Status vs. Tax Accounting Rules:* Commercial pricing is agreed as **GST-inclusive** (the gross amount charged to the subscriber). However, the specific tax separation formula and rounding remain strictly an **illustrative, provisional calculation** (e.g., for Starter at ₹1,999 GST-inclusive: Taxable Value = ₹1,999 / 1.18 ≈ ₹1,694.07; 18% GST ≈ ₹304.93, provisionally split into 9% CGST of ₹152.465 and 9% SGST of ₹152.465, or 18% IGST of ₹304.93). Formal production tax-accounting rules must be separately reviewed and approved by tax/accounting before activation.
   - *Scope-Specific Blocking Impact:* GST calculation approval blocks production subscription tax billing. This does not block independently testable work such as dynamic pricing rendering, test payment verification, or payment security hardening.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

5. **Detailed Trial-Expiry Permissions Matrix:**
   - *Scope:* Granular permissions matrix defining permitted vs. blocked operations in read-only trial expiry mode across resource creation, editing, deletion, document uploads/downloads, reprint generation, tracking links, and background jobs.
   - *Scope-Specific Blocking Impact:* Blocks granular write-blocking middleware enforcement beyond top-level `is_read_only` guard.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

6. **Annual Subscription Downgrade, Refund, and Prepaid-Credit Treatment:**
   - *Scope:* Financial and contractual policy for annual prepaid subscriptions undergoing mid-term downgrade, cancellation, or plan modification (e.g., non-refundable forfeiture vs pro-rated store credit).
   - *Scope-Specific Blocking Impact:* Blocks automated mid-term annual subscription downgrade adjustments in the billing controller.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

7. **Cancellation, Refunds, Failed-Renewal Retries, Grace Periods, and Post-Cancellation Data Retention:**
   - *Scope:* Grace period length (e.g., 3 days, 5 days, 7 days) following a failed renewal before tenant service is restricted, automated payment retry schedule via Razorpay webhooks, refund terms, and post-cancellation data retention timelines.
   - *Scope-Specific Blocking Impact:* Unresolved cancellation, refund, and dunning policies block their respective automation (automated dunning suspension, automated refund execution, and post-cancellation data purge routines). This does not block foundational payment webhook signature verification, manual support intervention, or independently testable security hardening.
   - **Assigned Owner:** `[Pending PO Assignment]`
   - **Target Resolution Date:** `[Pending PO Date]`

---

## 5. Architectural Principles & Testing Specifications

### 5.1. Single Source of Truth
Regardless of the final commercial numbers authorized by the Product Owner, the technical implementation must adhere to the following architectural invariants:
1. **Backend Database Authority:** The MongoDB `plans` and `addons` collections, initialized via `billingSeedService.ts` and exposed via `GET /api/billing/plans`, serve as the sole source of truth for pricing, quotas, and feature allocations.
2. **Dynamic Frontend Rendering:** All frontend surfaces—including the marketing pricing page ([`PricingPage.tsx`](../../frontend/src/pages/marketing/PricingPage.tsx)), onboarding plan selector, and in-app checkout modals ([`BillingPage.tsx`](../../frontend/src/pages/settings/BillingPage.tsx))—must dynamically query `GET /api/billing/plans`. Hardcoded static price arrays in frontend code are strictly prohibited.
3. **Dynamic Middleware Entitlement Guards:** Access control middleware (`requireFeature`, `requireQuota`, `requireActiveSubscription`) must evaluate tenant entitlements dynamically against the database catalog in real time, preventing entitlement traps and race conditions.
4. **Zero-Downtime Catalog Updates:** Updating plan pricing or feature allocations in the future must be achieved via database updates or catalog sync, without requiring frontend bundle rebuilds or backend code deployments.

### 5.2. Verification of Canonical Testing Specification (`TEST-004`)
- **Canonical Test Specification ID:** [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md) (*Subscription Tier Feature Gating, Resource Quota Enforcement & Payment Webhook Suite*).
- **Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-).
- **Canonical Backend Test Implementation Path:** `backend/src/tests/integration/phase5SubscriptionGating.test.ts`.
- **Testing Documentation Inspection & Collision Audit:**
  - An inspection of `docs/testing/` confirms that `TEST-004` canonically specifies Subscription Feature Gating, Quota Limits & Webhook Verification for Batch 5.
  - *Historical Identifier Collision Note:* In historical planning document [`docs/audit/BATCH_4_PREFLIGHT_REPORT.md`](../audit/BATCH_4_PREFLIGHT_REPORT.md), the label `TEST-004` was informally drafted for Batch 4 portals & tracking tests. However, in actual implementation, Batch 4 tests were committed to `backend/src/tests/integration/phase4PortalsAndTracking.test.ts` without creating a duplicate markdown specification.
  - *Reconciliation Status:* Fully reconciled in [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md). `TEST-004` is the exclusive, authoritative identifier for Batch 5 subscription, quota, payment signature verification, and webhook testing. No active ID collision exists in `docs/testing/`.

---

## 6. Sign-Off & Scope-Specific Implementation Gates

### 6.1. Implementation Gate Rule
`DEC-001` is formally **Approved** by the Product Owner.

> [!CAUTION]
> **Approval of DEC-001 does NOT authorize Batch 5 implementation.**
> Technical source code changes, database seed modifications, and test suite execution remain blocked until the Product Owner grants separate, explicit authorization to begin Batch 5 implementation.

Batch 5 implementation requires:
1. **Mandatory Global Gate:**
   - [x] Formal Product Owner approval of DEC-001 (*Approved: October 2026*).
   - [ ] Separate, explicit authorization from the Product Owner to commence Batch 5 implementation.
2. **Independent Foundations (Unblocked upon Batch 5 Authorization):**
   - Dynamic marketing pricing page ([`PricingPage.tsx`](../../frontend/src/pages/marketing/PricingPage.tsx) consuming `GET /api/billing/plans` - `ISS-011`).
   - Dynamic pricing rendering and database catalog upsert (`billingSeedService.ts`).
   - Starter entitlement trap resolution (`MOD_LR_ENGINE` & `MOD_BILLING_INVOICE` assigned to Starter in `featureCatalog.ts` - `ISS-012`).
   - Route-level entitlement hardening on `approvalRoutes.ts` and `commercialReportRoutes.ts`.
   - Payment security hardening, payment simulation defense, and webhook secret assertion (`paymentGateway.ts`, `server.ts` - `ISS-013`).
   - Automated integration test suite execution ([`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md)).
3. **Scope-Blocked Functional Gates (Unresolved commercial policies block only the functionality that depends on them):**
   - Undefined add-on pricing blocks selling add-ons or offering them at checkout (Deferral Item 3).
   - Unapproved GST calculation rules block production subscription billing (Deferral Item 4).
   - Undefined trial-expiry permissions block granular write-blocking middleware enforcement (Deferral Item 5).
   - Unresolved annual downgrade/refund policies block automated mid-term annual downgrade adjustments (Deferral Item 6).
   - Unresolved cancellation, refund, and dunning policies block their respective automation (automated dunning suspension, automated refund execution, and data purge routines) (Deferral Item 7).

*Note on Prior Decisions:*
- `DEC-002` (MongoDB Replica Set Architecture) remains **Approved Architecture**.
- `DEC-003` (S3 Object Storage Migration) remains **Pending Approval**.

### 6.2. Gate Checklist

- [x] **Commercial Approval:** Product Owner has signed off on Authoritative Pricing Matrix (Section 2.1) and Starter Plan Entitlements (Section 2.2).
- [x] **Recommended Decisions Approval:** Product Owner has signed off on Commercial Decisions 1–6 (Section 3).
- [x] **Explicit Deferrals Recorded:** Product Owner has confirmed explicit deferral of Items 1–7 with scope-specific blocking rules (Section 4; owners/dates pending assignment).
- [ ] **Separate Batch 5 Authorization:** Product Owner grants explicit authorization to begin Batch 5 implementation.
- [ ] **Database Catalog Alignment:** `billingSeedService.ts` updated to idempotently upsert approved prices, quotas, and feature lists into MongoDB.
- [ ] **Dynamic Pricing Page (`ISS-011`):** `PricingPage.tsx` refactored to consume dynamic data from `GET /api/billing/plans`.
- [ ] **Entitlement Engine Update (`ISS-012`):** `featureCatalog.ts` and `entitlementService.ts` updated with approved Starter inclusions.
- [ ] **Automated Test Verification (`TEST-004`):** Integration test suite in `phase5SubscriptionGating.test.ts` passes 100% green under [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md).
