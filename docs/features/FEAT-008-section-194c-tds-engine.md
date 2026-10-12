# FEAT-008: Income Tax Section 194C TDS Engine

**Feature ID:** `FEAT-008`  
**Title:** Income Tax Section 194C TDS Deduction, Exemption Declaration & Form 16A Engine  
**Category:** Statutory Accounting & Vendor Payouts  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Under Section 194C of the Indian Income Tax Act, freight payments made to transport contractors and truck owners are subject to Tax Deducted at Source (TDS):
- **1% TDS** for Individual / Sole Proprietorship transport contractors.
- **2% TDS** for Corporate / Firm transport contractors.
- **20% TDS** if PAN is not furnished.
- **0% Exemption (Section 194C(6)):** If the transport contractor owns 10 or fewer goods carriages and furnishes a signed PAN declaration.
Fleet Flow currently has no mechanism to calculate, withhold, or report TDS on freight payments, creating immense tax penalty liabilities for transport businesses during Income Tax assessments.

---

## 2. Business Value & Intended Outcome
- Automated legal withholding of TDS during vendor settlement creation.
- Management and document attachment of Section 194C(6) truck ownership declarations.
- Automated generation of quarterly TDS withholding reports for chartered accountants and Form 16A certificate generation.

---

## 3. Workflow & Technical Architecture
1. **Vendor Profile Configuration:**
   - On [`Vendor.ts`](../../backend/src/models/BalanceParty.ts), record: `pan_number`, `entity_type: ['individual', 'company']`, `has_194c_declaration: boolean`, `declaration_doc_url: string`, `declaration_expiry: Date`.
2. **Payout Deduction Logic in [`ledgerController.ts`](../../backend/src/controllers/ledgerController.ts):**
   - When generating vendor payout for freight ₹1,00,000:
     - If `has_194c_declaration === true` and valid: TDS = ₹0.
     - If Individual: Deduct 1% (₹1,000 TDS), Net Payable = ₹99,000.
     - If Company: Deduct 2% (₹2,000 TDS), Net Payable = ₹98,000.
3. **General Ledger Posting:**
   - Debit Vendor Account: ₹1,00,000
   - Credit Bank Account: ₹99,000
   - Credit TDS Payable under Section 194C: ₹1,000

---

## 4. Acceptance Criteria
- [ ] Vendor payment slips clearly show Gross Freight, TDS Deducted (with Section 194C code), and Net Disbursed.
- [ ] Vendors with valid Section 194C(6) declarations are exempt from automatic TDS withholding.
- [ ] Exportable TDS summary report matches TRACES e-TDS return format.

---

## 5. Definition of Done
1. TDS calculation and ledger splitting integrated into vendor payouts.
2. Verified in financial integration tests.
