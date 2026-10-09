# Phase 3: Trip Dispatch, Expenses & Vehicle Movements

**Phase Objective:** Deliver end-to-end operational dispatch management—journey planning, conflict-checked resource assignment, daily milestone tracking, en-route diesel and cash expense logging, POD closeouts, and market vehicle movement entries.

---

## 1. Journey Planning & Dispatch Engine (`MOD_TRIPS`)

### 1.1 Data Model (`backend/src/models/TruckJourney.ts`)
* **Identifiers & State:** `journey_number` (auto-sequenced per company), `status` (`draft` | `active` | `completed` | `delayed` | `cancelled`), `status_history: [{ status, timestamp, note, actor_id }]`.
* **Resource Assignments:**
  * `truck_id`: Ref Truck (must have status `available` or be assigned to this journey).
  * `driver_id`: Ref Driver (must be `active` and not on another concurrent active trip).
* **Route & Timelines:**
  * `from_location`: City, state, hub name.
  * `to_location`: City, state, destination hub.
  * `route_checkpoints: [{ city, planned_arrival, actual_arrival, status }]`.
  * `start_date`, `estimated_duration_days`, `scheduled_end_date`, `actual_end_date`.
* **Odometer & Payload:**
  * `start_odometer_kms`, `end_odometer_kms`, `total_distance_kms` (computed).
  * `loaded_weight_tonnes`, `cbm_volume`, `cargo_description`.
* **Trip Advances & Cash:**
  * `starting_cash_advance`: Given to driver at dispatch (deducted from driver advance balance).
* **Delivery & Proof of Delivery (POD):**
  * `delivery_status`: `pending` | `delivered` | `rejected`.
  * `delivered_to`: Contact name, delivery timestamp.
  * `pod_slip_url`: S3 document URL.
  * `empty_container_yard_return_date`: Where applicable.

### 1.2 Resource Conflict Prevention Middleware
Before dispatching a journey, backend validators verify:
1. `Truck` does not have an active journey with status `active` or `delayed`.
2. `Driver` does not have an active journey with status `active` or `delayed`.
3. If compliance documents on `Truck` are expired, verify whether company settings allow `allow_overdue_compliance_dispatch`. If not, dispatch is blocked with `422 Unprocessable Entity`.

---

## 2. Milestone Progress, Issues & Delays

### 2.1 Daily Progress Log
* Array of progress checkpoints: `daily_progress: [{ day_number, date, current_location, transit_notes, updated_by }]`.
* Pre-save hook automatically updates journey's `last_known_location` and timestamp.

### 2.2 Delay & Incident Management
* `delays: [{ location, date, delay_hours, reason: ('breakdown' | 'traffic' | 'weather' | 'rto_check' | 'other'), notes }]`.
* `incidents: [{ date, severity: ('minor' | 'critical'), description, financial_impact, resolved }]`.

---

## 3. En-Route Expenses & Diesel Engine (`MOD_FUEL_EXPENSE`)

### 3.1 Diesel Fuel Stops
* Stored on journey: `diesel_expenses: [{ filling_date, petrol_pump_name, slip_number, fuel_quantity_litres, rate_per_litre, total_cost, payment_mode: ('cash' | 'fuel_card' | 'credit'), slip_image_url }]`.
* Virtual computed totals:
  * `total_diesel_litres`: Sum of all fuel stops.
  * `total_diesel_cost`: Decimal-safe sum of all fuel expenditures.
  * `actual_mileage_km_per_litre`: $\text{total\_distance\_kms} / \text{total\_diesel\_litres}$.

### 3.2 En-Route Cash Expenditures
* `driver_expenses: [{ date, expense_type: ('toll' | 'loading' | 'unloading' | 'weighbridge' | 'rto_border' | 'minor_repair' | 'food_allowance'), amount, notes, receipt_url }]`.
* Validated against custom operational expense categories defined in Company Settings.
* Virtual computed total: `total_driver_expenses`.

---

## 4. Market Vehicle Entries (`MOD_PARTY_BALANCE`)

Manages hired/brokerage vehicle movements independent of company-owned fleet trips:

### 4.1 Data Model (`backend/src/models/VehicleEntry.ts`)
* **Movement Details:** `entry_date`, `vehicle_number`, `from_location`, `to_location`.
* **Financial Agreement:**
  * `freight_amount`: Agreed rate for the movement.
  * `driver_cash_advance`: Handed to vehicle driver.
  * `dala_charges`: Loading/unloading deductions.
  * `kamisan_amount`: Brokerage/commission deducted.
  * `halting_amount`: Demurrage fee charged for delays.
  * `net_balance_due`: Computed as $\text{freight} - \text{driver\_cash} - \text{dala} - \text{kamisan} + \text{halting}$.
* **Vendor Association:** `balance_party_id` (Ref BalanceParty).
* **Payment State:** `status` (`pending` | `partially_paid` | `received`).
* **Document Tracking:** `pod_received`: boolean, `pod_stock_date`.

---

## 5. UI Views & Dispatch Workflows

1. `/journey/all-journey-entries` — Tabbed list of journeys (Active, Completed, Delayed, Cancelled) with truck, driver, route, and progress pins.
2. `/journey/new-journey` — Multi-step wizard:
   * Step 1: Resource Assignment (Truck & Driver conflict validation).
   * Step 2: Route, Checkpoints & Estimated Timelines.
   * Step 3: Starting Cash Advance, Odometer & Load Details.
   * Step 4: Confirmation & Instant Dispatch.
3. `/journey/journey-detail/:id` — Operational command center for a single trip:
   * Live Route Timeline & Milestone Log.
   * Expense & Diesel Logging drawer with receipt preview.
   * Delay/Incident Reporting modal.
   * Delivery Closeout & POD upload.
4. `/vehicle-entry/all-vehicle-entries` — Broker vehicle movement ledger with balance calculations.
5. `/vehicle-entry/new` & `/:id` — Vehicle entry creation and reconciliation view.

---

## 6. Phase 3 Verification & Acceptance Criteria

1. **Resource Assignment Conflict Test:** Attempt to create Journey B with Truck 1 while Truck 1 is currently assigned to an `active` Journey A; verify API rejects with `409 Conflict: Truck 1 is already in transit`.
2. **Fuel Math Accuracy Test:** Enter 3 diesel stops with 120.5L, 85.0L, and 150.25L at varied rates; verify `total_diesel_litres` and `actual_mileage_km_per_litre` compute accurately with decimal safety.
3. **POD Closeout Transition:** Upload POD and mark journey delivered; verify journey status transitions to `completed` and unlocks downstream billing.
4. **Market Vehicle Entry Balance Check:** Verify net balance formula $\text{freight} - \text{cash} - \text{dala} - \text{kamisan} + \text{halting}$ matches exactly against vendor account rollups.
