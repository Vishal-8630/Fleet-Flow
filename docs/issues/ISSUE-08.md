# Issue 08 — Advanced Trip Tracking and Driver Workflows

## Metadata
- **Severity**: P1 (High)
- **Status**: ✅ Resolved & Verified
- **Category**: Telematics, Live GPS, Driver Mobile Experience, e-POD & Offline Sync
- **Date**: October 10, 2026

---

## 1. Problem Statement
The platform's current shipment tracking (`PublicTrackingPage.tsx`) displays static milestone steps (Booked → Dispatched → In-Transit → Delivered) manually entered by dispatchers, rather than real-time live telematics:
1. **No Live Telematics Integration**: The system does not interface with Indian AIS-140 compliant GPS trackers, OBD-II devices, or commercial telematics APIs (WheelsEye, Loconav, Intangles, MapmyIndia).
2. **Missing Live Interactive Map**: Dispatchers and consignees cannot view a live map with current vehicle coordinates, speed (km/h), heading, and route path.
3. **No Dynamic ETA & Delay Alerts**: Estimated time of arrival (ETA) is not recalculated based on real-world vehicle progress, traffic bottlenecks, or halting durations.
4. **Absence of Geofencing & Route Deviation**: The system does not automatically detect when a vehicle arrives at or departs a loading warehouse, nor does it alert operators if a truck deviates from approved highway corridors.
5. **No Mobile Driver Workflow**: Drivers lack an optimized mobile interface to record checkpoint updates, report enroute incidents (breakdowns, punctures, police stoppages), or upload fuel bills.
6. **No Digital Proof of Delivery (e-POD)**: Proof of delivery is manual. Consignee signature capture and camera photos of stamped physical LRs are not natively integrated.
7. **Failure in Remote / Offline Conditions**: Commercial freight often travels through remote corridors without 4G/5G connectivity. The application lacks offline data caching and resilient background sync.

---

## 2. Root Cause Analysis (RCA)
- **Phase 3 Milestone Model**: The original implementation treated tracking as a static status field on `Entry` and `TruckJourney` rather than a streaming time-series location stream.
- **Desktop-Only Viewport Design**: The UI was designed for logistics dispatchers on desktop monitors without a lightweight, touch-first driver workflow or Service Worker offline cache.

---

## 3. Implementation Solution & Target Architecture

### A. Universal Telematics Gateway (`MOD_GPS_SYNC`)
- Create `backend/src/models/VehicleLocationLog.ts`:
  - `truck_id`, `company_id`, `journey_id`, `latitude`, `longitude`, `speed_kmh`, `heading_degrees`, `ignition_on`, `odometer_kms`, `recorded_at`.
- Integration Adapter in `backend/src/utils/telematicsAdapter.ts`:
  - Webhook/Polling adapters for standard telematics providers:
    - WheelsEye API
    - Loconav API
    - Generic AIS-140 GPS TCP/HTTP push
    - Driver Smartphone GPS fallback ping
  - Reverse geocoding to human-readable landmark (e.g. "NH-48 near Vadodara Toll, Gujarat").

### B. Live Map & Public Tracking Overhaul
- Upgrade `PublicTrackingPage.tsx` and create `LiveFleetMapPage.tsx`:
  - Embed lightweight open-source MapLibre GL / Leaflet map (no paid Google Maps dependency required).
  - Renders truck icon with rotation heading, current speed pill, and route corridor polyline.
  - Live calculated ETA based on remaining distance and historical average transit velocity.

### C. Geofencing & Corridor Deviation Engine
- Calculate polygon / circular geofences around origin and destination hub addresses (radius: 500m - 2km).
- Automatic triggers:
  - Entering loading dock → Auto-transition status to `at_loading_hub`.
  - Exiting destination warehouse → Auto-transition to `delivered`.
  - Route deviation alert if distance from planned corridor exceeds 15 km.

### D. Mobile-First Driver Progressive Web App (PWA) (`/driver/app`)
- Lightweight mobile web portal accessible via secure SMS/WhatsApp magic link:
  - Active trip card with large touch targets.
  - One-tap status updates: "Departed Origin", "Halted for Meal/Sleep", "Reached Destination".
  - One-tap Incident Report: Category (Tyre Puncture, Engine Breakdown, Accident, Police Hold), photo upload, and instant dispatcher emergency notification.
  - Digital e-POD Studio:
    - Consignee touch screen signature pad (`react-signature-canvas` or vanilla canvas).
    - Camera photo capture of stamped physical LR.
    - Captures device GPS coordinates and timestamp at moment of delivery.

### E. Offline Storage & Background Sync
- Integrate PWA Service Worker + IndexedDB (`idb-keyval`):
  - When driver is offline (no signal on rural highway):
    - Status updates, incident photos, and e-POD signatures are saved locally in IndexedDB.
    - UI displays clear indicator: "Saved offline (3 items pending upload)".
  - When connection is restored:
    - Background sync fires automatically to push all queued payloads to `POST /api/driver/sync`.
    - Idempotent payload handlers ensure no duplicate records are generated.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/VehicleLocationLog.ts` | Time-series GPS location logs, speed, heading, ignition |
| `backend/src/models/TripIncident.ts` | Schema for breakdowns, punctures, accidents, and route delays |
| `backend/src/utils/telematicsAdapter.ts` | AIS-140 and third-party telematics ingestion adapter |
| `backend/src/utils/geofenceService.ts` | Point-in-polygon hub detection and corridor deviation alerts |
| `backend/src/controllers/trackingController.ts` | Live location stream, ETA computation, and incident submission |
| `backend/src/controllers/driverPortalController.ts` | Driver magic-link session, checkpoint check-in, offline sync handler |
| `backend/src/routes/trackingRoutes.ts` | Ingestion endpoint `POST /api/telematics/ping` and live map stream |
| `frontend/src/pages/public/PublicTrackingPage.tsx` | MapLibre interactive map with live vehicle marker and ETA |
| `frontend/src/pages/operations/LiveFleetMapPage.tsx` | Dispatcher multi-vehicle real-time birds-eye map |
| `frontend/src/pages/driver/DriverTripPortalPage.tsx` | Touch-first mobile PWA with e-POD signature pad and camera capture |
| `frontend/src/utils/offlineSync.ts` | IndexedDB offline persistence queue and automatic network sync |
| `backend/src/scripts/verifyTelematicsEngine.ts` | End-to-end test script verifying GPS ingestion, geofencing, and e-POD |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Inspecting the Real-Time Dispatcher Birds-Eye Map
1. **Navigate to Live Map**:
   - Log in as Dispatcher or Admin at `http://localhost:5173/login`.
   - In the sidebar, click **Operations** -> **Live Fleet Map** (`/operations/live-map`).
2. **Interact with Active Vehicles**:
   - The map loads with interactive vector styling.
   - Active trucks display vehicle marker pins on the map (e.g. `MH12AB1001`).
3. **What You Should See on the Screen**:
   - Clicking on a vehicle pin reveals a flyout telemetry card:
     - Current Speed: `58 km/h` (Green moving indicator)
     - Ignition: `ON`
     - Associated Trip: `Trip #TRP-104 (Mumbai to Ahmedabad)`
     - Dynamic ETA: `Arriving in 3h 45m`
     - Driver Name: `Ramesh Kumar` with a direct click-to-call button.

---

### Test 2: Testing Public Consignment Tracking Without Login
1. **Open Tracking Link**:
   - Open an incognito browser tab.
   - Navigate to the public URL: `http://localhost:5173/track/LR-2026-9042`.
2. **What You Should See on the Screen**:
   - The public tracking interface renders immediately with company branding.
   - Visual milestone progress bar shows: `Booked` -> `Dispatched` -> `In Transit` -> `Delivered`.
   - The live truck location marker is visible on an embedded map.
   - **Security Check**: Financial margins, internal vendor costs, and unrelated consignments are strictly absent from the screen.

---

### Test 3: Testing Driver Mobile Portal, Check-In & e-POD Signature Pad
1. **Open Mobile Driver View**:
   - Open browser developer tools and toggle device emulation (e.g. *iPhone 14*).
   - Navigate to the driver portal link: `http://localhost:5173/portal/driver?token=sample_driver_token_123`.
2. **Perform Waypoint Check-In**:
   - The mobile-optimized card shows current assignment: *Mumbai to Bhiwandi Hub*.
   - Tap the large blue button: **"Check-In at Checkpoint"**.
   - Select Checkpoint: `Ghodbunder Toll Plaza`. Tap **"Confirm Check-In"**.
   - Notice the checkpoint logs with timestamp on screen.
3. **Capture Digital e-POD & Receiver Signature**:
   - Tap **"Complete Delivery & Upload POD"**.
   - Upload or snap a test photo of the delivery document.
   - On the interactive HTML5 signature pad on screen, draw a test signature using your mouse/touch.
   - Type Receiver Name: `Amit Shah (Warehouse Manager)`.
   - Tap **"Submit Proof of Delivery"**.
4. **What You Should See on the Screen**:
   - Green delivery confirmation banner appears.
   - In the Dispatcher console (`/consignments`), consignment `#LR-2026-9042` status instantly flips to `DELIVERED`, and clicking the POD icon displays the signed image and signature preview.

---

### Test 4: Testing Offline Resilience on the Driver Portal
1. **Simulate Connection Drop**:
   - On the mobile driver portal page, open DevTools -> **Network** -> select **Offline**.
2. **Perform an Action while Offline**:
   - Tap **"Log Incident / Fuel Stop"**, enter `Fuel expense ₹2,500 at IOCL pump`, and tap **"Save Expense"**.
3. **What You Should See on the Screen**:
   - The app does not crash or display a browser error page.
   - A sticky status badge appears:  
     > 📶 *"Offline Mode: 1 update stored locally. Syncing will resume when online."*
4. **Restore Network**:
   - Toggle Network back to **Online (No Throttling)**.
   - Observe the badge flash green:  
     > 🟢 *"Connected: All offline records synchronized successfully."*

