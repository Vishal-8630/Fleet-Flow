# FEAT-006: Corporate Fuel Card API Integration

**Feature ID:** `FEAT-006`  
**Title:** Corporate Fuel Card Integration (BPCL SmartFleet / HPCL DriveTrack Plus / IOCL XtraPower)  
**Category:** Fuel Management & Expense Automation  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Diesel fuel accounts for over 50% of the operating cost of long-haul commercial transport. Fleet operators provide drivers with corporate fuel cards issued by state oil marketing companies (BPCL SmartFleet, HPCL DriveTrack Plus, IOCL XtraPower). Currently, fuel entries in Fleet Flow require drivers to hand in physical paper pump slips at branch offices, leading to delayed expense logging, fuel pilferage, and inaccurate fuel efficiency (km/L) calculations.

---

## 2. Business Value & Intended Outcome
- Automatically import fuel dispensing transactions directly from oil company APIs or portal statement dumps.
- Capture exact timestamp, fuel station name, city, volume (liters), rate per liter, and odometer reading entered by the pump attendant.
- Real-time KMPL mileage tracking per truck and driver, identifying abnormal fuel consumption or theft.

---

## 3. Data Models & API Contracts
1. **Model: `FuelTransaction.ts`:**
   - `company_id`, `card_no`, `truck_no`, `journey_id`, `fuel_station`, `liters`, `rate_per_liter`, `total_amount`, `odometer_km`, `kmpl`, `timestamp`.
2. **Endpoints:**
   - `POST /api/fleet/fuel/sync`: Pulls transactions via corporate fuel card API.
   - `POST /api/fleet/fuel/upload-statement`: Ingests portal CSV statements.
   - `GET /api/fleet/fuel/kmpl-analytics`: Returns fleet fuel efficiency leaderboards.

---

## 4. Acceptance Criteria
- [ ] Fuel transactions populate `TruckJourney.total_diesel_cost` automatically.
- [ ] Odometer differences between fuelings calculate instant fuel efficiency (km/L).
- [ ] Drop in fuel efficiency below vehicle benchmark triggers an alert for workshop inspection.

---

## 5. Definition of Done
1. Fuel card parsing service implemented.
2. Fuel metrics integrated into trip profitability calculations.
