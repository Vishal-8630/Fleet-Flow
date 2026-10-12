# IMP-001: Comprehensive GSTIN & PAN Regex & Checksum Validation Engine

**Improvement ID:** `IMP-001`  
**Title:** Comprehensive GSTIN & PAN Regex & Checksum Validation Engine  
**Category:** Data Quality & Statutory Compliance  
**Priority:** `P1` (High)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In India, Goods and Services Tax Identification Numbers (GSTIN) and Permanent Account Numbers (PAN) are legally regulated identifiers with strict structural formats, state code mappings, and modulo-36 check digits. Currently, Fleet Flow permits users to enter arbitrary string values into GSTIN and PAN fields across customer onboarding, company registration, and vendor records. When malformed GSTINs are saved:
- Tax bifurcation between CGST/SGST and IGST fails because state code extraction (`gstin.substring(0, 2)`) produces invalid characters.
- Invoices generated with invalid GSTINs cannot be legally submitted by corporate customers for Input Tax Credit (ITC).
- Target Users: Billing clerks, accountants, and transport compliance officers.

---

## 2. Current Behavior & Limitations
- Input fields in [`CustomerModal.tsx`](../../frontend/src/pages/parties/BillingPartyListPage.tsx) and [`CompanySettingsPage.tsx`](../../frontend/src/pages/settings/CompanySettingsPage.tsx) are generic `<input type="text">` without regex masks or validation.
- Backend controllers accept any string without format checks.

---

## 3. Business Value & Intended Outcome
- Guarantee 100% data integrity for tax compliance.
- Prevent tax filing rejections and customer disputes.
- Automatically infer state and union territory names directly from the first 2 digits of the GSTIN.

---

## 4. Scope & Non-Goals
- **In Scope:** Format regex validation, Modulo-36 check digit validation algorithm for GSTIN, PAN 10-character structure validation, and auto-population of State name.
- **Non-Goals:** Live government GST portal API verification (covered under separate future enterprise verification).

---

## 5. Validation & Business Rules
1. **PAN Format:** `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` (4th character indicates status: `P` for Person, `C` for Company, `H` for HUF, `F` for Firm).
2. **GSTIN Format:** `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
   - Characters 1-2: Valid Indian State Code (`01` to `38`).
   - Characters 3-12: Valid PAN.
   - Character 13: Entity number of the same PAN within the state.
   - Character 14: Default `'Z'`.
   - Character 15: Modulo-36 Checksum digit.

---

## 6. Implementation Specifications
- **Utility:** Create `backend/src/utils/gstinValidator.ts` and `frontend/src/utils/gstinValidator.ts` exporting `validateGSTIN(gstin: string): { isValid: boolean; stateName: string; error?: string }`.
- **UI Components:** Add real-time uppercase formatting and green/red badge indicators on GSTIN input fields.
- **API Contracts:** Zod schema validator:
  ```typescript
  export const gstinSchema = z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format');
  ```

---

## 7. Acceptance Criteria
- [ ] Submitting an invalid GSTIN (e.g. `27ABCDE1234F1Z`) is blocked on both frontend and backend with a descriptive error.
- [ ] Entering a valid GSTIN auto-fills the State field on the customer and branch forms.
- [ ] Modulo-36 checksum calculation correctly identifies typo digits.

---

## 8. Definition of Done
1. Validation utilities shared and deployed on frontend and backend.
2. Form fields updated and unit tested.
