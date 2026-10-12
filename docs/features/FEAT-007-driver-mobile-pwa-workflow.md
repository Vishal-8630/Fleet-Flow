# FEAT-007: Driver Mobile PWA Workflow

**Feature ID:** `FEAT-007`  
**Title:** Driver Mobile Progressive Web App (PWA) Workflow  
**Category:** Mobile Logistics & Field Operations  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Indian truck drivers operate in rugged highway environments on budget Android smartphones and do not access desktop computers. Driver communications are conducted almost entirely through chaotic WhatsApp photos, phone calls, and lost paper chits. Dispatchers must manually transcribe driver reports into Fleet Flow.
- **Target User:** Long-haul truck drivers, delivery assistants, and dispatch supervisors.

---

## 2. Business Value & Intended Outcome
- Deliver a lightweight, ultra-fast Progressive Web App (installable on mobile home screens without App Store hurdles).
- Support vernacular languages (Hindi, Marathi, Punjabi, Tamil, Telugu, English).
- Enable drivers to view assigned trips, upload en-route expense photos, report status updates, and capture delivery proofs directly from their phone camera.

---

## 3. PWA Capabilities & Features
1. **Simplified Mobile Navigation:**
   - Big touch buttons, high-contrast daylight theme, offline caching.
2. **Trip Sheet View:** Shows origin, destination, customer contact, pickup contact, and advance received.
3. **Expense Voucher Snap:** Driver snaps photo of weighing bridge receipt (dharam kanta), puncture repair slip, or loading tip (kharcha). The photo is compressed locally and uploaded with amount and category.
4. **GPS Ping Provider:** For fleets without dedicated OBD telematics hardware, the driver PWA transmits background geolocation coordinates periodically while on an active trip.

---

## 4. Technical Contracts & Endpoints
- **Mobile Routes:** `/driver/trip`, `/driver/expenses`, `/driver/pod`.
- **API Endpoints:**
  - `GET /api/driver/active-trip`: Returns assigned trip sheet.
  - `POST /api/driver/expenses/upload`: Submits driver cash advance expense slip.
  - `POST /api/driver/location/ping`: Ingests mobile GPS coordinates into `GpsPing`.

---

## 5. Acceptance Criteria
- [ ] PWA installs on Android mobile home screen and loads in under 1.5 seconds.
- [ ] Drivers can switch language to Hindi with complete UI translation.
- [ ] Snapping an expense receipt attaches the photo and expense amount to the trip settlement sheet instantly.

---

## 6. Definition of Done
1. Mobile-optimized PWA views built in `frontend/src/pages/driver/`.
2. Verified across real mobile devices and network throttling.
