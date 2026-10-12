# ISS-007: Live Fleet Map Broken by Projection & Schema Discrepancy

**Specification ID:** `ISS-007`  
**Title:** Live Fleet Map Broken by Projection & Schema Discrepancy  
**Type:** Frontend / Telematics Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-06.md`](./ISSUE-06.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`trackingController.ts:109`](../../backend/src/controllers/trackingController.ts#L109), the fleet live map query attempts to filter trucks by `is_active: true` and projects `_id registration_number truck_type`. In the [`Truck.ts`](../../backend/src/models/Truck.ts#L25-L40) schema, the fields are named `status`, `truck_no`, and `body_type`. Consequently, the query returns an empty array or strips the vehicle identifier. The frontend [`LiveTrackingPage.tsx`](../../frontend/src/pages/operations/LiveFleetMapPage.tsx) receives empty datasets or blank vehicle tags, rendering an empty Leaflet map or blank marker pins.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In [`trackingController.ts:109`](../../backend/src/controllers/trackingController.ts#L109):
  ```typescript
  export const getFleetLiveMap = async (req: Request, res: Response) => {
    const trucks = await Truck.find({
      company_id,
      is_active: true,
    }).select('_id registration_number truck_type');
  ```
- **Confirmed Fact:** In [`Truck.ts`](../../backend/src/models/Truck.ts):
  - Field for active status is `status: { type: String, enum: ['active', 'in_maintenance', 'inactive', 'sold'], default: 'active' }`. There is no `is_active`.
  - Field for number plate is `truck_no: { type: String, required: true }`. There is no `registration_number`.
  - Field for vehicle category is `body_type: { type: String }`. There is no `truck_type`.
- **Result:** MongoDB filters out all trucks because `is_active: true` matches nothing. If the filter is bypassed, the projection strips `truck_no`, delivering empty objects `{ _id: ... }` to the frontend.

---

## 3. Reproduction Steps
1. Create 5 trucks in Company A with `status = 'active'` and standard vehicle numbers (e.g. `MH-12-AB-1234`).
2. Log into the web application and navigate to `/tracking`.
3. Open Developer Tools Network tab and inspect the response from `GET /api/tracking/live/fleet`.
4. Observe: The response array is empty `[]`, and the Leaflet map renders zero vehicles.

---

## 4. Expected Behavior
`getFleetLiveMap` must query `{ company_id, status: 'active' }`, select `_id truck_no body_type last_location status`, and join the latest GPS coordinates from `GpsPing`. The frontend must receive and display valid vehicle plates on the map pins.

---

## 5. Proposed Technical Solution
Update `getFleetLiveMap` in `trackingController.ts`:
```typescript
export const getFleetLiveMap = async (req: Request, res: Response) => {
  const company_id = req.company?._id || req.user?.company_id;
  const trucks = await Truck.find({
    company_id,
    status: 'active',
  }).select('_id truck_no body_type make model');

  // Fetch latest GPS ping for each active truck
  const truckLocations = await Promise.all(
    trucks.map(async (truck) => {
      const ping = await GpsPing.findOne({ truck_id: truck._id })
        .sort({ timestamp: -1 })
        .select('latitude longitude speed timestamp address');
      return {
        id: truck._id,
        truck_no: truck.truck_no,
        body_type: truck.body_type,
        location: ping ? {
          lat: ping.latitude,
          lng: ping.longitude,
          speed: ping.speed,
          timestamp: ping.timestamp,
          address: ping.address
        } : null
      };
    })
  );

  return res.json({ success: true, data: truckLocations });
};
```
Also ensure `LiveTrackingPage.tsx` consumes `truck.truck_no`.

---

## 6. Acceptance Criteria
- [ ] `GET /api/tracking/live/fleet` returns all active company vehicles with `truck_no`.
- [ ] Vehicles with recorded GPS pings display on the Leaflet map with correct registration markers and speed telemetry.
- [ ] Vehicles without pings are listed gracefully in the sidebar as "Offline / No GPS".

---

## 7. Definition of Done
1. `trackingController.ts` and `LiveTrackingPage.tsx` updated and aligned.
2. Verified in [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md).
