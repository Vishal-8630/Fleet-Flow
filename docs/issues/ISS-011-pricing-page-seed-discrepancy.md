# ISS-011: Discrepancy Between Marketing Pricing Page and Backend Plan Seeds

**Specification ID:** `ISS-011`  
**Title:** Discrepancy Between Marketing Pricing Page and Backend Seed Plan Pricing / Quotas  
**Type:** Monetization / Billing Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Integration Mismatch  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-08.md`](./ISSUE-08.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)  
**Requires Decision:** Yes ([`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md))

---

## 1. Executive Summary
A severe discrepancy exists between the prices and vehicle quotas advertised on the frontend marketing page ([`frontend/src/pages/marketing/PricingPage.tsx:35-95`](../../frontend/src/pages/marketing/PricingPage.tsx#L35-L95)) and those configured in the backend database seed service ([`backend/src/utils/billingSeedService.ts:25-90`](../../backend/src/utils/billingSeedService.ts#L25-L90)). Users are promised one price and quota on the website, but are charged different amounts and subjected to lower quotas in the checkout flow.

---

## 2. Current Behavior & Root Cause

| Tier Name | Marketing Page (`PricingPage.tsx`) | Backend Seed (`billingSeedService.ts`) | Discrepancy Variance |
|---|---|---|---|
| **Starter** | **₹1,999 / mo** (5 Trucks) | **₹1,499 / mo** (`149900` paise, 5 Trucks) | Price differs by ₹500/mo. |
| **Standard** | **₹3,999 / mo** (15 Trucks) | **₹4,999 / mo** (`499900` paise, 20 Trucks) | Price differs by ₹1,000/mo; Quota differs by 5 trucks. |
| **Pro / Enterprise** | **₹8,999 / mo** (**Unlimited Trucks**) | **₹9,999 / mo** (`999900` paise, **60 Trucks**) | Price differs by ₹1,000/mo; Marketing promises Unlimited, backend caps at 60. |

- **Root Cause:** The frontend pricing page was designed with hardcoded pricing cards rather than consuming the backend `/api/billing/plans` endpoint, and backend seed values were adjusted in isolation during refactoring.

---

## 3. Business & User Impact
- **Trust & Legal Compliance:** Discrepancy between advertised prices and checkout prices violates consumer protection norms and leads to chargebacks.
- **Quota Frustration:** Pro customers who purchased expecting "Unlimited" vehicles will receive hard `403 Quota Exceeded` errors when attempting to add their 61st truck.

---

## 4. Expected Behavior
1. The frontend `PricingPage.tsx` must dynamically query `GET /api/billing/plans` to fetch live plan names, prices, billing cycles, vehicle quotas, and feature lists.
2. The canonical prices, quotas, and feature matrix must be officially finalized via Product Decision [`DEC-001`](../decisions/DEC-001-subscription-pricing-and-entitlements.md).

---

## 5. Proposed Technical Solution
1. Finalize the commercial pricing matrix in `DEC-001`.
2. Update `billingSeedService.ts` to reflect the approved canonical values.
3. Update `PricingPage.tsx` to dynamically fetch plans using `useEffect` calling `/api/billing/plans`:
   ```tsx
   const { data: plans } = useQuery(['billing-plans'], () => api.get('/billing/plans'));
   ```
4. Render pricing cards dynamically from the database response, removing all static hardcoded numbers.

---

## 6. Acceptance Criteria
- [ ] Prices, truck limits, and features displayed on `PricingPage.tsx` match `GET /api/billing/plans` 100%.
- [ ] Creating an order via Razorpay matches the exact amount advertised on the pricing card.

---

## 7. Definition of Done
1. `DEC-001` approved by Product Owner.
2. `billingSeedService.ts` and `PricingPage.tsx` aligned and verified.
