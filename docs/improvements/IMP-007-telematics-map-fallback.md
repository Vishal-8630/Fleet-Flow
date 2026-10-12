# IMP-007: Telematics Leaflet Map Fallback & Auto-Centering Resilience

**Improvement ID:** `IMP-007`  
**Title:** Telematics Leaflet Map Fallback & Auto-Centering Resilience  
**Category:** UI / Telematics Experience  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`frontend/src/pages/operations/LiveFleetMapPage.tsx`](../../frontend/src/pages/operations/LiveFleetMapPage.tsx), when fleet vehicles have no recorded GPS pings or when the vehicle list is empty, the Leaflet map centers on coordinate `[0, 0]` (Null Island off the coast of West Africa). Furthermore, when multiple vehicles are scattered across India, the map does not dynamically adjust its bounds to encompass all visible markers, requiring users to manually zoom and pan.

---

## 2. Business Value & Intended Outcome
- Deliver a polished, professional telematics experience for fleet dispatchers.
- Eliminate jarring visual anomalies (e.g. centering in the middle of the Atlantic ocean).
- Provide immediate visual confirmation of all company assets across India.

---

## 3. UI/UX & Technical Specifications
1. **Default Center Fallback:**
   - If company headquarters coordinates are set in `Company.settings.location`, default to HQ.
   - If not set, default to central India geographic center: `[20.5937, 78.9629]` (Nagpur region) at zoom level 5.
2. **Dynamic Bounds Auto-Fitting:**
   - Use Leaflet `map.fitBounds(markersGroup.getBounds(), { padding: [50, 50] })`.
   - Re-fit bounds smoothly whenever active vehicles are filtered or loaded.
3. **Clustering:** Integrate `react-leaflet-cluster` for depots with 20+ vehicles in close proximity to prevent overlapping pins.

---

## 4. Acceptance Criteria
- [ ] An account with no active vehicle pings centers cleanly on India / company headquarters.
- [ ] Loading vehicles dynamically fits bounds to show all markers on screen.
- [ ] Vehicle pins display speed badges (e.g. "Moving: 54 km/h" or "Idle: 3 hrs").

---

## 5. Definition of Done
1. Auto-bounds and fallback logic implemented in `LiveTrackingPage.tsx`.
2. Verified in browser walkthrough.
