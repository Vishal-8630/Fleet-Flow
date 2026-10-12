# FEAT-004: Electronic Proof of Delivery (e-POD) Mobile Capture & OTP

**Feature ID:** `FEAT-004`  
**Title:** Electronic Proof of Delivery (e-POD) Mobile Web Capture & OTP Verification  
**Category:** Freight Operations & Cash Flow Acceleration  
**Priority:** `P0` (Essential Operational Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
In freight transport, bills cannot be presented to customers without an acknowledged, stamped Proof of Delivery (POD) signed by the consignee. Currently, transport companies wait 15 to 45 days for physical paper copies of bilty/receipts to travel back with drivers by road or courier. This severe delay chokes cash flow, stalls freight billing cycles, and causes customer payment deductions due to unverified shortage or damage claims.

---

## 2. Business Value & Intended Outcome
- Compress the billing cycle from 30+ days down to same-day freight invoicing upon unloading.
- Eliminate paper disputes through geotagged, timestamped digital photos of stamped bilties.
- Provide consignee SMS-OTP verification confirming exact delivery quantities and condition.

---

## 3. Workflow & Technical Architecture
1. **Arrival at Destination:** Driver or delivery agent navigates to the mobile delivery page (`/delivery/:tracking_token`).
2. **Delivery Inspection:** Driver logs:
   - Delivered packages count vs booked count.
   - Shortage units (if any) and damage description.
   - Demurrage waiting hours.
3. **Consignee Verification:**
   - Option A (Digital Signature & Photo): Consignee signs on the mobile screen and driver captures photo of the physical stamped LR.
   - Option B (SMS OTP): System sends a 6-digit OTP to the consignee's registered phone number.
4. **Instant Invoicing Trigger:** Once verified, `LR.delivery_status` transitions to `'delivered'`, the geotagged POD image is attached to the LR record, and the accounting department is automatically notified that the shipment is unblocked for freight invoice generation.

---

## 4. Data Models & API Contracts
1. **Schema: `DeliveryProof.ts`:**
   - `lr_id`, `company_id`, `consignee_name`, `otp_code`, `otp_verified_at`, `signature_url`, `pod_image_url`, `latitude`, `longitude`, `shortage_packages`, `damage_remarks`, `delivered_at`.
2. **API Endpoints:**
   - `POST /api/delivery/send-otp`: Dispatches delivery OTP to consignee mobile.
   - `POST /api/delivery/confirm`: Accepts OTP or digital signature, uploads geotagged POD image to S3/Cloudinary, and updates LR status.

---

## 5. Acceptance Criteria
- [ ] Delivering an LR uploads a high-resolution stamped image and records geolocation coordinates.
- [ ] Successfully confirmed e-POD immediately unlocks invoice creation on `CreateInvoicePage.tsx`.
- [ ] POD images can be viewed and printed directly alongside the LR document.

---

## 6. Definition of Done
1. Mobile-friendly delivery web capture page implemented.
2. End-to-end e-POD workflow tested and verified.
