# FEAT-002: GST E-Invoicing & Invoice Registration Portal (IRN & Signed QR Code)

**Feature ID:** `FEAT-002`  
**Title:** GST E-Invoicing & Invoice Registration Portal (IRN & Signed QR Code) Generation  
**Category:** Tax Compliance & Commercial Invoicing  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Under Indian GST mandate, registered businesses with an aggregate annual turnover exceeding statutory thresholds (currently ₹5 Crore) must register every B2B tax invoice with the government Invoice Registration Portal (IRP). An invoice without a 64-character Invoice Reference Number (IRN) and a digitally signed government QR code is legally deemed invalid. Large corporate freight customers (e.g. Tata, Reliance, Unilever) will not process freight payments for non-compliant transport invoices.

---

## 2. Business Value & Intended Outcome
- Enable enterprise transport companies to service Tier-1 corporate clients.
- Eliminate invoice rejections and ensure immediate payment clearance.
- Provide automated real-time IRN generation upon finalizing freight bills.

---

## 3. Scope & Workflow
1. **Invoice Finalization:** When an accountant approves a GST Tax Invoice, the system prepares the schema payload adhering to the government standard format (e-Invoice JSON Schema V1.03).
2. **IRP Transmission:** Payload is transmitted via GSP API to the IRP.
3. **Response Persistence:** The 64-character IRN hash, digital signature string, and signed QR code payload are persisted in [`Invoice.ts`](../../backend/src/models/Invoice.ts).
4. **PDF Generation:** The generated tax invoice PDF prominently renders the official QR code in the upper right quadrant, alongside the printed IRN string and Ack Date.

---

## 4. Schema Augmentation in [`Invoice.ts`](../../backend/src/models/Invoice.ts)
```typescript
einvoice: {
  irn: { type: String, index: true },
  ack_no: { type: String },
  ack_date: { type: Date },
  signed_invoice: { type: String },
  signed_qr_code: { type: String },
  status: { type: String, enum: ['not_generated', 'generated', 'cancelled', 'failed'], default: 'not_generated' },
  error_message: { type: String },
}
```

---

## 5. Acceptance Criteria
- [ ] Submitting a finalized B2B invoice calls the IRP API and receives a valid IRN.
- [ ] The generated invoice PDF displays the authentic, scannable government QR code.
- [ ] Attempting to edit an invoice after IRN generation is locked; only government cancellation (within 24 hours) or Credit Notes are permitted.

---

## 6. Definition of Done
1. e-Invoicing integration service implemented.
2. PDF generator updated to print signed QR codes.
3. Verification completed against IRP sandbox.
