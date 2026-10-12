# FEAT-009: Tyre Lifecycle & Axle Position Inventory Management

**Feature ID:** `FEAT-009`  
**Title:** Commercial Vehicle Tyre Lifecycle, Tread Depth & Wheel Position Matrix  
**Category:** Fleet Maintenance & Asset Management  
**Priority:** `P2` (Moderate Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Tyres represent the second largest operating expense for commercial vehicle fleets after diesel fuel. A 10-wheeler or 16-wheeler truck carries ₹3,00,000+ worth of rubber. Fleet operators struggle with tyre theft, premature wear, uneven alignment damage, and chaotic retreading schedules. Without tyre serial number tracking and axle position logging, fleet managers cannot evaluate tyre brand cost-per-kilometer (CPKM) or maintain preventive tyre rotation schedules.

---

## 2. Business Value & Intended Outcome
- Track every tyre by unique serial number, brand (Apollo, MRF, JK, Michelin), size, and purchase cost.
- Maintain visual interactive axle diagrams (Front-Left, Rear-Right-Outer, Stepney) showing which tyre is mounted on which wheel of which truck.
- Log periodic tread depth measurements (in millimeters) to trigger automated tyre rotation and retreading alerts.
- Compute true Cost Per Kilometer (CPKM) across tyre brands.

---

## 3. Data Models & UI Visualization
1. **Model: `TyreRecord.ts`:**
   - `company_id`, `serial_no`, `brand`, `model`, `size`, `purchase_cost`, `purchase_date`, `current_truck_id`, `axle_position`, `current_tread_depth_mm`, `initial_tread_depth_mm`, `status: ['new', 'mounted', 'retread_1', 'retread_2', 'scrapped']`, `total_km_run`.
2. **Visual Axle Matrix UI:** An interactive graphic of the truck chassis where clicking any wheel displays the mounted tyre serial, tread wear gauge, and permits one-click rotation or removal to inventory.

---

## 4. Acceptance Criteria
- [ ] Users can mount, unmount, and rotate tyres across wheel positions.
- [ ] Tread depth falling below 3mm triggers an automatic "Due for Retreading" alert.
- [ ] CPKM report ranks tyre brands by cost efficiency.

---

## 5. Definition of Done
1. Visual axle UI and tyre management endpoints implemented.
2. Verified in workshop maintenance workflows.
