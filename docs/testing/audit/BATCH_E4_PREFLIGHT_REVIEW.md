# Fleet Flow — Batch E4 Preflight Review: GST-Inclusive Pricing & Trial-Conversion Security

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `PHASE-E4`  
**Target Canonical Scope:**  
- Approved Decision [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md) — Fleet Flow Pricing, Tiering, and Quota Matrix (Section 2.2 GST-Inclusive Mandate)  
- Trial-to-Paid Conversion Security Defect (Identified during Batch E Forensic Preflight)  
**Execution Posture:** Technical Governance Specification & Architectural Plan  
**Baseline Git Commit:** `0197cf6` on branch `main`  
**Preflight Recommendation:** **`ACCEPT`**

---

## 1. Executive Summary

Phase E4 addresses two critical commercial and security discrepancies in the billing system:

1. **GST Math Violation vs. `DEC-001`:** In [`backend/src/controllers/billingController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts#L218-L220), `initializeCheckout` treated the headline plan prices as pre-tax net amounts and added an extra 18% GST (9% CGST + 9% SGST) on top. This resulted in gross charges of ₹2,358.82 for Starter and ₹4,718.82 for Standard, directly violating [`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md) Section 2.2 and [`billingSeedService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/billingSeedService.ts#L21), which mandate that headline prices are **GST-inclusive** (₹1,999/mo, ₹3,999/mo, ₹8,999/mo).
2. **Trial Plan Switch Security Vulnerability:** In [`billingController.ts:changePlan`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/billingController.ts#L491), accounts in `trialing` status could call `/api/billing/change-plan` to switch to `pro` or `standard` tiers freely without completing payment verification. This allowed tenants to bypass checkout and obtain paid subscription access without payment.

---

## 2. Issues, Decisions, and Canonical References

| Identifier | Category | Title | Relevance to Phase E4 |
| :--- | :--- | :--- | :--- |
| **[`DEC-001`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-001-pricing-quota-matrix.md)** | Architectural Decision | Fleet Flow Pricing, Tiering, and Quota Matrix | Authoritative GST-inclusive pricing matrix for all 6 plan variants. |
| **Batch E Preflight Item #4 & #5** | Security & Compliance | GST Calculation Discrepancy & Trial Conversion Bypass | Forensic findings documented in `BATCH_E_PREFLIGHT_REVIEW.md`. |

---

## 3. Approved Pricing Matrix (`DEC-001` Section 2.2)

All prices in Indian Rupees (INR), inclusive of 18% GST (9% CGST + 9% SGST):

| Plan | Billing Cycle | Gross Price (GST-Inclusive) | Base Taxable Subtotal | 18% GST Amount |
| :--- | :--- | :--- | :--- | :--- |
| **Starter** | Monthly | **₹1,999** | ₹1,694.07 | ₹304.93 |
| **Starter** | Annual | **₹19,990** | ₹16,940.68 | ₹3,049.32 |
| **Standard** | Monthly | **₹3,999** | ₹3,388.98 | ₹610.02 |
| **Standard** | Annual | **₹39,990** | ₹33,889.83 | ₹6,100.17 |
| **Pro** | Monthly | **₹8,999** | ₹7,626.27 | ₹1,372.73 |
| **Pro** | Annual | **₹89,990** | ₹76,262.71 | ₹13,727.29 |

---

## 4. Current Behavior vs. Required Corrections

1. **Reverse GST-Inclusive Math (`billingController.ts`):**
   - *Previous:* $\text{subtotal} = \text{grossPlanPrice}$, $\text{tax} = \text{subtotal} \times 0.18$, $\text{total} = \text{subtotal} + \text{tax}$.
   - *Correction:* Implement reverse extraction:
     $$\text{subtotal} = \text{round}\left(\frac{\text{gross}}{1.18}, 2\right)$$
     $$\text{tax} = \text{gross} - \text{subtotal}$$
     $$\text{cgst} = \text{round}\left(\frac{\text{tax}}{2}, 2\right),\quad \text{sgst} = \text{tax} - \text{cgst}$$
     $$\text{totalCharged} = \text{gross}$$
2. **Trial Conversion Lockdown (`billingController.ts`):**
   - *Previous:* `changePlan` permitted any account with an active or trialing subscription to switch plans without payment.
   - *Correction:* In `changePlan`, check `subscription.status === 'trialing'`. If true, reject with HTTP 403 `TRIAL_CONVERSION_REQUIRES_PAYMENT`:
     `"Trial accounts must complete payment checkout to activate a paid tier."`
3. **Database & Seed Alignment:**
   - Ensure [`billingSeedService.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/utils/billingSeedService.ts) and the `Plan` collection store amounts consistent with approved gross amounts in paise.
4. **Client-Side Display Consistency:**
   - In [`BillingPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BillingPage.tsx), clearly display that prices are GST-inclusive, preventing checkout total surprises.

---

## 5. Architectural Invariants & Testing Strategy

- **Financial Integrity:** The amount charged in Razorpay orders must equal the exact gross price in paise.
- **Fail-Closed Conversion:** Free trial accounts can only convert to paid tiers via Razorpay verified payment (`/api/billing/verify-payment`), never via `/change-plan`.
- **Automated Verification:** Create dedicated test suite `backend/src/tests/integration/phase5BatchE4PricingGstSecurity.test.ts` testing:
  - All 6 plan variants charge exact approved gross amounts in paise.
  - Tax breakdown satisfies $\text{subtotal} + \text{cgst} + \text{sgst} = \text{gross}$.
  - Trial accounts attempting `/change-plan` rejected with HTTP 403 `TRIAL_CONVERSION_REQUIRES_PAYMENT`.
  - Paid active accounts can switch plans with appropriate proration.
  - Verification persists correct GST amounts to invoices and receipts.

---

## 6. Preflight Recommendation

### Recommendation: **`ACCEPT`**
Phase E4 corrects critical pricing compliance and closes a significant revenue leakage exploit.
