# IMP-005: Real-Time Dynamic Tax Recalculation on Invoice UI

**Improvement ID:** `IMP-005`  
**Title:** Real-Time Dynamic Tax Recalculation on Invoice UI  
**Category:** Frontend / Commercial Experience  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`CreateInvoicePage.tsx`](../../frontend/src/pages/commercial/InvoiceListPage.tsx), billing clerks enter multiple line items (freight charges, loading/unloading charges, detention fees, demurrage). When users toggle the "Reverse Charge Mechanism (RCM)" checkbox or modify line item rates, the subtotal, CGST, SGST, IGST, and total invoice amounts do not recompute automatically in real time until the user triggers a blur or submit event. This leads to user errors and unexpected total amounts.

---

## 2. Business Value & Intended Outcome
- Eliminate billing calculation errors prior to form submission.
- Provide clear visual breakdown of tax splits (e.g. 2.5% CGST + 2.5% SGST vs 5% IGST).
- Increase operational speed for logistics billing teams.

---

## 3. UI/UX & Calculation Specifications
1. Implement a reactive calculation hook `useInvoiceCalculator`:
   - Inputs: `items: Array<{ rate: number, qty: number }>`, `isRcm: boolean`, `companyStateCode: string`, `customerStateCode: string`.
   - Dynamic outputs: `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `totalTax`, `grandTotal`.
2. Tax Rules:
   - If `isRcm === true`: Tax rate is 5%, but tax payable is ₹0 (borne by recipient), grand total equals taxable amount.
   - If `isRcm === false`:
     - Same state (`companyStateCode === customerStateCode`): Apply 6% CGST + 6% SGST (for 12% forward charge GTA) or 2.5% + 2.5% (for 5% forward charge).
     - Different state: Apply full 12% or 5% IGST.

---

## 4. Acceptance Criteria
- [ ] Modifying quantity or rate instantly updates the Grand Total summary card without delay.
- [ ] Toggling RCM instantly zeroes out tax on the bill total and displays an amber "RCM Active" statutory notice.

---

## 5. Definition of Done
1. Reactive calculation hook implemented and integrated into `CreateInvoicePage.tsx`.
2. UI tested across responsive screen sizes.
