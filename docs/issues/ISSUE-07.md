# Issue 07 — Complete Fleet Maintenance Management

## Metadata
- **Severity**: P1 (High)
- **Status**: ✅ Resolved & Verified
- **Category**: Fleet Engineering, Asset Maintenance, Telematics, Cost per Km (CPK) & P&L
- **Date**: October 10, 2026

---

## 1. Problem Statement
While the `Truck` schema contains basic odometer and service interval properties (`current_odometer_kms`, `service_interval_kms`), there is no operational maintenance module across the backend API or frontend UI:
1. **No Service Work Orders or Job Cards**: Fleets cannot log repair work orders, describe mechanical failures, record garage visits, or track labor and parts costs.
2. **Missing Spare Parts & Tyre Lifecycle Tracking**: Tyres represent up to 25% of commercial vehicle operating costs. There is no model to track tyre serial numbers, tread depth (mm), axle positions (e.g. Front Steer, Rear Drive, Trailer), retreading cycles, or scrap dates.
3. **Uncaptured Vehicle Downtime**: Vehicles undergoing major overhaul are not tracked for downtime duration (days off road), leading to inaccurate utilization metrics.
4. **No Service Vendor & Garage Registry**: Maintenance bills cannot be directly linked to approved mechanical workshops, auto-electricians, or spare parts retailers.
5. **Absence of Maintenance Cost per Kilometre (CPK)**: Fleet managers cannot compute mechanical cost efficiency ($\text{Total Maintenance Spend} / \text{Total Odometer Kms}$) across makes and models (e.g. Tata Prima vs BharatBenz vs Ashok Leyland).
6. **No Vehicle Profitability & Fuel Efficiency Reporting**: The platform lacks an asset P&L report comparing gross trip freight income against diesel expenses, driver trip costs, tolls, and maintenance repairs.

---

## 2. Root Cause Analysis (RCA)
- `MOD_MAINTENANCE` was specified in `featureCatalog.ts` as an add-on/pro capability, but implementation stopped at the `Truck` schema fields without dedicated maintenance routes, controllers, or UI pages.
- Trip diesel slips were recorded in `TruckJourney` but never correlated back to the vehicle's odometer delta to compute real-world fuel economy ($\text{km/litre}$).

---

## 3. Implementation Solution & Target Architecture

### A. Maintenance Work Order & Job Card Engine
- Create `backend/src/models/MaintenanceOrder.ts`:
  - `company_id`, `work_order_no` (e.g. `WO-2026-0001`), `truck_id`, `vendor_id` (garage/mechanic), `order_type` (`preventative_service`, `breakdown_repair`, `tyre_replacement`, `accidental`).
  - `odometer_kms_at_service`, `start_date`, `completed_date`, `downtime_hours`.
  - Itemized lines: `description`, `part_cost_paise`, `labor_cost_paise`, `tax_paise`, `total_paise`.
  - Status: `scheduled` → `in_progress` → `completed` → `cancelled`.
  - Postings: Option to auto-post maintenance expenses directly to General Ledger (`category: 'vehicle_maintenance'`).

### B. Tyre & Spare Parts Master (`TyreRecord.ts`)
- Model tracking:
  - `serial_number`, `brand` (MRF, Apollo, JK), `size` (295/90 R20), `current_truck_id`, `axle_position` (`steer_left`, `steer_right`, `drive_outer_left`, etc.).
  - `initial_tread_depth_mm`, `current_tread_depth_mm`, `purchase_cost_paise`, `retread_count`.
  - Status: `in_store` → `fitted` → `retread` → `scrapped`.

### C. Preventative Maintenance Scheduler & Alerts
- Service Rules:
  - Engine Oil & Filter Change (every 20,000 km)
  - Hub Greasing & Brake Shoe Overhaul (every 40,000 km)
  - Coolant & Transmission Fluid Flush (every 80,000 km)
  - Annual Statutory Fitness Certificate Overhaul
- Background engine checks vehicle odometer during trip completion:
  - If `truck.current_odometer_kms >= truck.next_service_due_kms - 1000`, generates `SERVICE_DUE_SOON` alert.
  - Automatically updates `truck.status = 'in_maintenance'` when work order begins.

### D. Maintenance Cost per Kilometre (CPK) & Fuel Economy Analytics
- Create `GET /api/fleet/analytics/maintenance`:
  $$\text{CPK} = \frac{\sum \text{Maintenance Work Orders (₹)}}{\text{Odometer Delta (kms)}}$$
- Create `GET /api/fleet/analytics/profitability`:
  $$\text{Net Vehicle Profit} = \text{Freight Revenue} - (\text{Diesel Spend} + \text{Tolls} + \text{Driver Settlements} + \text{Maintenance Costs})$$
  $$\text{Fuel Economy} = \frac{\text{Total Trip Kms}}{\text{Total Diesel Litres Consumed}} \quad (\text{km/litre})$$

### E. Frontend Maintenance Studio (`/fleet/maintenance`)
- UI Dashboard:
  - Active Work Orders & Downed Vehicles count
  - Upcoming Service Schedule Due Dates
  - Tyre Inventory & Wear Status Matrix
  - Fleet Maintenance Cost per Km trends chart
  - "New Service Work Order" modal

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/MaintenanceOrder.ts` | Schema for garage work orders, parts/labor costs, downtime |
| `backend/src/models/TyreRecord.ts` | Schema for tyre serial numbers, axle positions, tread depth, retreads |
| `backend/src/controllers/maintenanceController.ts` | CRUD for work orders, preventative schedules, and tyre tracking |
| `backend/src/routes/maintenanceRoutes.ts` | Mount `/api/fleet/maintenance` protected by `requireFeature('MOD_MAINTENANCE')` |
| `backend/src/controllers/truckController.ts` | Correlate trip odometer logs with maintenance schedules |
| `frontend/src/pages/fleet/MaintenanceDashboardPage.tsx` | UI maintenance job card management and preventative scheduler |
| `frontend/src/pages/fleet/TyreManagementPage.tsx` | UI tyre axle placement and tread wear monitoring studio |
| `frontend/src/components/layout/Sidebar.tsx` | Register Maintenance navigation link under Fleet section |
| `backend/src/scripts/verifyMaintenanceEngine.ts` | Test script verifying CPK calculation and service schedule triggers |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Creating a Maintenance Work Order & Job Card
1. **Navigate to Maintenance Dashboard**:
   - Log in as Fleet Manager or Admin at `http://localhost:5173/login`.
   - In the sidebar, click **Fleet** -> **Maintenance & Repairs** (`/fleet/maintenance`).
2. **Issue New Work Order**:
   - Click the **"+ Create Work Order"** button.
   - Select Truck from dropdown: `MH12AB1001` (odometer auto-populates `124,500 km`).
   - Select Vendor: `Star Diesel Services & Spares`.
   - Service Category: `Preventative Maintenance - 10,000 KM Engine Overhaul`.
   - Add Spare Parts:
     - Part 1: `Synthetic Engine Oil (15L)` | Unit Price: `6500`
     - Part 2: `Primary Fuel Filter` | Unit Price: `1200`
   - Labour Charges: `1500`.
   - Click **"Submit Work Order"**.
3. **What You Should See on the Screen**:
   - A new work order card appears under the `IN PROGRESS` column.
   - Total Cost calculates automatically: `₹9,200.00`.
   - Navigating to **Fleet & Trucks** (`/fleet/trucks`), the truck displays an amber badge: `🔧 In Maintenance` (preventing accidental trip dispatch).

---

### Test 2: Completing Service & Verifying Cost Per KM (CPK) Metrics
1. **Close the Service Order**:
   - Return to `/fleet/maintenance`.
   - Open the work order for `MH12AB1001` and click **"Complete Work Order"**.
   - Enter vendor invoice number: `INV-STAR-9022`.
   - Enter Next Service Due Odometer: `134,500 km`.
   - Click **"Save & Close Order"**.
2. **Inspect Vehicle Performance Analytics**:
   - Navigate to **Truck Details Page** (`/fleet/trucks/MH12AB1001`).
3. **What You Should See on the Screen**:
   - Work order is archived with status `COMPLETED`.
   - The truck status reverts back to `AVAILABLE` (green badge).
   - The **Maintenance Cost Per KM (CPK)** widget updates with the real formula:  
     `Total Maintenance Expenses / Total Odometer KMs`.
   - A preventative service reminder card displays:  
     > ⏱️ *"Next Preventative Service due at 134,500 km (10,000 km remaining)"*.

---

### Test 3: Tyre Axle Inspection & Tread Depth Studio
1. **Open Tyre Axle View**:
   - In the sidebar, click **Fleet** -> **Tyre Management** (`/fleet/tyres`).
   - Select vehicle `MH12AB1001`.
2. **Mount Tyre on Visual Chassis**:
   - A visual 10-wheeler axle blueprint is rendered.
   - Click the **Front-Left Steer (FL1)** position.
   - In the slide-over drawer, input:
     - Serial Number: `APOLLO-ENDURACE-881`
     - Size: `295/80 R22.5`
     - Tread Depth: `15.0 mm`
   - Click **"Mount Tyre"**.
3. **What You Should See on the Screen**:
   - The Front-Left tire slot turns green with label `APOLLO-ENDURACE-881 (15mm)`.
   - The tyre history tab logs the installation date and vehicle odometer for tyre life tracking.

