# FEAT-003: Parivahan VAHAN RC & Sarathi Driving License Verification Engine

**Feature ID:** `FEAT-003`  
**Title:** Parivahan VAHAN RC & Sarathi Driving License Digital Verification API  
**Category:** Asset Management & Risk Compliance  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Transport operators frequently hire third-party market trucks (hire trucks) and recruit contract drivers. Manually verifying vehicle Registration Certificates (RC), fitness certificates, national permits, and driver licenses is error-prone. Fraudulent licenses or expired vehicle fitness certificates lead to severe police penalties, impounded consignments, and total repudiation of accident insurance claims.
- **Target User:** Fleet Managers, Safety Officers, and Dispatchers.

---

## 2. Business Value & Intended Outcome
- Instantly verify vehicle ownership, chassis number, engine number, insurance validity, and pollution fitness directly against Ministry of Road Transport and Highways (MoRTH) databases.
- Validate driver license authenticity, authorized vehicle categories (e.g. Hazardous chemical endorsements, Heavy Goods Vehicle), and date of validity.
- 10-second automated onboarding for market trucks upon entering vehicle number plates.

---

## 3. Scope & User Workflows
1. **Vehicle Onboarding:** Fleet manager types vehicle registration number (e.g. `NL-01-AB-1234`) on [`TrucksPage.tsx`](../../frontend/src/pages/fleet/TruckListPage.tsx).
2. **Automated Fetch:** System queries VAHAN API and auto-populates Make, Model, Chassis No, Engine No, Axle Count, Unladen Weight, Gross Vehicle Weight, Fitness Expiry Date, National Permit Expiry Date, and Insurance Policy No.
3. **Driver Onboarding:** Fleet manager inputs DL Number and Date of Birth on [`DriversPage.tsx`](../../frontend/src/pages/fleet/DriverListPage.tsx). System fetches Driver Name, Father's Name, Blood Group, License Class (TRANS/HMV), and Expiry Date.
4. **Verification Badge:** Vehicles and drivers verified via Parivahan display a green "Govt Verified" badge.

---

## 4. Technical Contracts & API Endpoints
- `POST /api/trucks/verify-vahan`: Accepts `{ registration_no }`, returns structured RC data.
- `POST /api/drivers/verify-sarathi`: Accepts `{ dl_no, dob }`, returns verified DL profile.
- Schema Addition: `is_govt_verified: { type: Boolean, default: false }`, `verification_payload: { type: Object }`.

---

## 5. Acceptance Criteria
- [ ] Entering a valid vehicle registration plate auto-populates vehicle specs and document expiry dates.
- [ ] Mismatched or forged driving licenses are flagged with warning banners.
- [ ] Expired fitness or permits automatically prevent vehicle assignment to long-haul trips.

---

## 6. Definition of Done
1. VAHAN & Sarathi API connectors implemented.
2. Auto-fill workflows tested on Truck and Driver onboarding forms.
