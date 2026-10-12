# FEAT-001: NIC E-Way Bill Integration

**Feature ID:** `FEAT-001`  
**Title:** National Informatics Centre (NIC) E-Way Bill API Integration  
**Category:** Regulatory Compliance & Freight Logistics  
**Priority:** `P0` (Essential Commercial Launch Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
In India, Goods and Services Tax rules mandate that any inter-state consignment with a consignment value exceeding ₹50,000 must carry an electronic E-Way Bill (EWB) generated via the government NIC portal. Moving vehicles without a valid EWB or with an expired EWB risks vehicle seizure, goods confiscation, and statutory penalties of 100% to 200% of tax liabilities. Transport dispatchers currently have to manually re-enter shipment details from Fleet Flow into the government portal, leading to operational bottlenecks, typos, and delayed dispatches.

---

## 2. Business Value & Intended Outcome
- **Competitive Advantage:** Direct 1-click E-Way bill generation converts Fleet Flow from a simple management tool into an essential daily operational system.
- **Error Elimination:** Auto-populates Part A from the LR and Part B from vehicle assignments.
- **Real-Time Compliance:** Tracks EWB expiration countdowns based on distance traveled (e.g. 200 km per day rule).

---

## 3. Scope & Non-Goals
- **In Scope:**
  - Automated generation of E-Way Bill (Part A & Part B) directly upon LR approval.
  - Updating Part B vehicle registration in transit (for vehicle breakdown or transshipment).
  - Consolidated E-Way bill generation for multi-consignment truck dispatches.
  - Validity extension request workflow.
  - Expiry alert banner on active trips when validity is under 4 hours.
- **Non-Goals:**
  - Direct taxpayer filing of monthly GSTR-1 returns.

---

## 4. User Stories & Workflows
1. **Dispatcher books an LR:** Dispatcher enters consignor, consignee, HSN code, value (₹1,50,000), and vehicle number.
2. **One-Click Generation:** Dispatcher clicks "Generate E-Way Bill". The system calls the GSP (GST Suvidha Provider) API, authenticates the tenant's NIC credentials, and receives the 12-digit E-Way Bill Number, QR Code string, and valid-until timestamp.
3. **Printable Bilty:** The official E-Way Bill number and QR code are automatically rendered onto the 3-part printable LR PDF.
4. **Breakdown Handling:** If a vehicle breaks down in transit, the dispatcher clicks "Update Vehicle (Part B)", inputs the replacement vehicle plate and transshipment reason, and the government record updates immediately.

---

## 5. Technical Contracts & Data Models
1. **Mongoose Schema Augmentation in [`LR.ts`](../../backend/src/models/Entry.ts):**
   ```typescript
   eway_bill: {
     eway_bill_no: { type: String, index: true },
     generated_at: { type: Date },
     valid_until: { type: Date },
     status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
     part_b_vehicle: { type: String },
     qr_code_payload: { type: String },
   }
   ```
2. **API Endpoints:**
   - `POST /api/lrs/:id/eway-bill/generate`: Generates Part A and Part B.
   - `PUT /api/lrs/:id/eway-bill/update-vehicle`: Updates Part B with reason code (`breakdown`, `transshipment`).
   - `POST /api/lrs/:id/eway-bill/extend`: Extends validity window when vehicle is stranded.
   - `POST /api/lrs/:id/eway-bill/cancel`: Cancels E-Way bill within 24 hours of generation.

---

## 6. Permissions, Entitlements & External Providers
- **Entitlement:** Available on `standard` and `pro` tiers (`MOD_EWAY_BILL`).
- **GSP Gateway:** Connects via authenticated GSP partner (ClearTax / Masters India / Cygnet API) using company GSTIN and NIC API credentials stored encrypted in `Company.settings.integrations.eway`.

---

## 7. Acceptance Criteria
- [ ] Dispatching an LR with value > ₹50,000 provides a 1-click "Generate EWB" action.
- [ ] Successful API response persists the 12-digit EWB number and expiry date in `LR.ts`.
- [ ] The generated LR PDF includes the valid EWB number and barcode/QR code.
- [ ] Active trips warn dispatchers when EWB validity has less than 4 hours remaining.

---

## 8. Definition of Done
1. GSP API integration service implemented.
2. LR controller and frontend actions integrated and tested.
