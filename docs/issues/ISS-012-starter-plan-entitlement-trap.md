# ISS-012: Starter Plan Entitlement Trap Blocks Core LR & Invoicing Modules

**Specification ID:** `ISS-012`  
**Title:** Starter Plan Entitlement Trap Blocks Core LR & Invoicing Modules  
**Type:** SaaS / Entitlements Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-08.md`](./ISSUE-08.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)  
**Requires Decision:** Yes ([`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md))

---

## 1. Executive Summary
On [`PricingPage.tsx:40-50`](../../frontend/src/pages/marketing/PricingPage.tsx#L40-L50), the Starter Plan promises transport operators "3-Part Printable LR / Bilty Generation" and "Basic PDF GST Invoicing". However, in [`backend/src/utils/featureCatalog.ts`](../../backend/src/utils/featureCatalog.ts) and [`backend/src/utils/billingSeedService.ts:35-45`](../../backend/src/utils/billingSeedService.ts#L35-L45), the corresponding feature flags `MOD_LR_ENGINE` and `MOD_BILLING_INVOICE` are strictly restricted to the `standard` and `pro` tiers. When a customer subscribes to the Starter Plan, every attempt to create an LR (`POST /api/lrs`) or generate an invoice (`POST /api/invoices`) returns HTTP 403 Forbidden (`Feature not available on your current plan`).

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact (Marketing Promise):**  
  `PricingPage.tsx` lists under Starter:
  - *"3-Part Printable LR / Bilty Generation"*
  - *"Basic PDF GST Invoicing"*
- **Confirmed Fact (Backend Seed & Catalog):**  
  In `billingSeedService.ts`:
  ```typescript
  // Starter Plan feature list:
  features: [
    'MOD_FLEET_MANAGEMENT',
    'MOD_DRIVER_MGMT',
    'MOD_GATE_PASS',
  ] // MOD_LR_ENGINE and MOD_BILLING_INVOICE are completely omitted!
  ```
- **Result:** A transport company subscribing to Fleet Flow cannot generate LRs or Invoices—the two most fundamental operations of a transport business.

---

## 3. Reproduction Steps
1. Register a new company and activate the Starter Plan.
2. Navigate to `/lrs/new` and submit a new Lorry Receipt.
3. Observe: Request fails with HTTP 403 Forbidden (`Plan upgrade required: MOD_LR_ENGINE is not included in the Starter plan`).
4. Repeat for `/commercial/invoices/new`. Observe identical 403 failure.

---

## 4. Expected Behavior
Starter Plan subscribers must have access to:
- Basic LR / Bilty generation (with standard printable templates).
- Basic GST Tax Invoicing (up to a reasonable monthly volume, or standard 1-branch billing).
Advanced enterprise features (multi-stop milk runs, API tracking, automated telematics, multi-branch GSTINs) should remain gated to Standard/Pro.

---

## 5. Proposed Technical Solution
Update `billingSeedService.ts`:
```typescript
{
  tier: 'starter',
  name: 'Starter Plan',
  features: [
    'MOD_FLEET_MANAGEMENT',
    'MOD_DRIVER_MGMT',
    'MOD_GATE_PASS',
    'MOD_LR_ENGINE',         // Grant basic LR creation
    'MOD_BILLING_INVOICE',    // Grant basic Invoicing
  ],
  quotas: {
    max_trucks: 5,
    max_branches: 1,
    max_users: 2,
    monthly_lr_limit: 100,    // Optional usage tier
  }
}
```

---

## 6. Acceptance Criteria
- [ ] Users on the Starter Plan can create, view, and print LRs without receiving 403 Forbidden.
- [ ] Users on the Starter Plan can generate GST Invoices without receiving 403 Forbidden.
- [ ] Feature catalog checks pass in [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md).

---

## 7. Definition of Done
1. Seed service updated and re-seeded.
2. Verified via automated entitlement test.
