# DEC-001: Commercial Subscription Pricing, Truck Quotas & Starter Plan Inclusions

**Decision ID:** `DEC-001`  
**Title:** Commercial Subscription Pricing, Truck Quotas and Starter Plan Entitlements Alignment  
**Category:** Product Monetization & Commercial Strategy  
**Status:** Pending Product Owner Approval  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#7-product--architectural-decisions-register-dec-)  
**Directly Resolves Issues:** [`ISS-011`](../issues/ISS-011-pricing-page-seed-discrepancy.md), [`ISS-012`](../issues/ISS-012-starter-plan-entitlement-trap.md)

---

## 1. Context & Business Conflict
As exposed during the repository audit:
1. **Pricing Mismatch:** [`PricingPage.tsx`](../../frontend/src/pages/marketing/PricingPage.tsx) advertises Starter at ₹1,999/mo, Standard at ₹3,999/mo (15 trucks), and Pro at ₹8,999/mo (Unlimited trucks). In contrast, [`billingSeedService.ts`](../../backend/src/utils/billingSeedService.ts) seeds Starter at ₹1,499/mo, Standard at ₹4,999/mo (20 trucks), and Pro at ₹9,999/mo (60 trucks).
2. **Entitlement Trap:** The marketing website promises Starter subscribers 3-part LR creation and Basic GST Invoicing, but backend feature gating blocks both modules (`MOD_LR_ENGINE`, `MOD_BILLING_INVOICE`), returning HTTP 403.

---

## 2. Commercial Choices Requiring Product Owner Approval

The following specific commercial options are submitted for formal Product Owner review and sign-off:

### Decision Item 1: Tier Pricing & Vehicle Quota Matrix
| Option | Starter Tier | Standard Tier | Pro / Enterprise Tier |
|---|---|---|---|
| **Proposal 1 (Marketing Alignment - Recommended)** | **₹1,999 / mo** (₹19,990 / yr)<br>Quota: **5 Trucks**, 1 Branch, 2 Users | **₹3,999 / mo** (₹39,990 / yr)<br>Quota: **15 Trucks**, 3 Branches, 5 Users | **₹8,999 / mo** (₹89,990 / yr)<br>Quota: **Unlimited** (with FUP) or 50 Trucks, Unlimited Branches |
| **Proposal 2 (Legacy Seed Alignment)** | **₹1,499 / mo** (₹14,990 / yr)<br>Quota: **5 Trucks**, 1 Branch, 2 Users | **₹4,999 / mo** (₹49,990 / yr)<br>Quota: **20 Trucks**, 3 Branches, 5 Users | **₹9,999 / mo** (₹99,990 / yr)<br>Quota: Hard cap at **60 Trucks** |
| **Proposal 3 (Custom Owner Decision)** | *[Awaiting PO Input]* | *[Awaiting PO Input]* | *[Awaiting PO Input]* |

### Decision Item 2: Starter Plan Included Modules (LR & Invoicing Entitlements)
- **Choice A (Recommended for Indian Market)**: Starter Plan includes 3-Part Lorry Receipts (`MOD_LR_ENGINE`) and Basic GST Tax Invoicing (`MOD_BILLING_INVOICE`).  
  *Rationale*: A transport management SaaS that blocks bilty and freight invoices cannot convert Indian transporters, as these are the primary day-to-day operations of every fleet owner.
- **Choice B (Pure Asset Registry)**: Starter Plan strictly limits access to vehicle & driver registries and gate passes (`MOD_FLEET_MANAGEMENT`, `MOD_DRIVER_MGMT`, `MOD_GATE_PASS`), forcing users to upgrade to Standard for LR generation and Invoicing.

### Decision Item 3: Billing Periods & Annual Prepayment Discounts
- **Monthly Billing**: Recurring monthly charge via Razorpay Subscriptions.
- **Annual Billing**: Prepayment option with incentive (e.g. 2 months free / 10x monthly price) vs flat 12x monthly price.

### Decision Item 4: Add-Ons, Quota Expansions & Quota Enforcement
- **Extra Truck Add-On**: Allow tenants to exceed plan truck quotas by purchasing add-on packs (e.g., ₹200 / truck / month) without forcing a full tier jump.
- **Driver & User Packs**: Fixed add-ons for additional concurrent users.
- **SMS / WhatsApp Packs**: Pre-paid transaction message credit packs for consignment tracking links and dispatch notifications.

### Decision Item 5: Trial Policy, Dunning & Upgrade/Downgrade Mechanics
- **Trial Duration**: 14 calendar days from tenant registration with full access to Starter/Standard features.
- **Trial Expiry**: Transition to read-only mode (`is_read_only: true`), allowing historical data export while blocking new creation.
- **Mid-Cycle Upgrade**: Immediate pro-rata billing via Razorpay webhook.
- **Downgrade Policy**: If an active fleet exceeds the target lower tier quota (e.g. 12 trucks active when downgrading to Starter limit 5), require user to deactivate surplus trucks before downgrade completes.

---

## 3. Architecture: Single Source of Truth Enforcement

Regardless of the final commercial numbers chosen by the Product Owner, the application architecture must enforce **one authoritative source of truth**:

1. **Backend Database Authority**: The MongoDB `plans` and `addons` collections, managed by the billing service and exposed via `GET /api/billing/plans`, constitute the sole source of truth.
2. **Dynamic Frontend Rendering**: `frontend/src/pages/marketing/PricingPage.tsx`, registration cards, and in-app checkout modals must dynamically query `GET /api/billing/plans` and render prices, quotas, and feature lists from this endpoint. Hardcoded prices and static cards are strictly prohibited.
3. **Middleware Entitlement Guards**: Backend authorization middleware (`requireFeature`, `requireActiveSubscription`, quota guards in creation controllers) must dynamically look up the active plan's module catalog and limits in real-time, preventing entitlement traps.
4. **No Code Hardcoding**: Modifying plan prices or feature allocations in the future will be a database/catalog update with zero frontend or backend code redeployment required.

---

## 4. Sign-Off & Implementation Gates
- [ ] **Commercial Approval**: Product Owner selects Proposal 1, Proposal 2, or custom values for Items 1–5.
- [ ] **Seed & Catalog Alignment**: `billingSeedService.ts` and `featureCatalog.ts` updated with approved numbers.
- [ ] **Dynamic Pricing Page**: `PricingPage.tsx` refactored to consume dynamic API data (`ISS-011`).
- [ ] **Entitlement Verification**: Automated verification passing under [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md).
