# FEAT-005: FASTag Electronic Toll Reconciliation & Auto Trip Linking

**Feature ID:** `FEAT-005`  
**Title:** FASTag Electronic Toll Reconciliation & Automated Trip Expense Tracking  
**Category:** Expense Management & Telematics Automation  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Electronic toll payments via NETC FASTag represent 15% to 25% of operational expenses on Indian highway freight trips. Fleet managers currently receive monthly bank statements (e.g. IDFC, ICICI, Axis Bank FASTag accounts) containing thousands of unorganized toll deductions. Reconciling which toll plaza fee belongs to which customer trip or route is performed manually on Excel spreadsheets, resulting in lost receipts, undetected toll fraud (drivers using vehicle tags on unauthorized private trips), and inaccurate trip profitability calculations.

---

## 2. Business Value & Intended Outcome
- Automatically import FASTag deductions via banking API or CSV statement uploads.
- Auto-match toll transactions to active `TruckJourney` trip sheets based on vehicle registration plate and timestamp.
- Update `total_toll_cost` on `TruckJourney` in real time, delivering accurate gross profit margins.
- Flag toll leakage alerts when a vehicle is debited at a toll plaza outside its scheduled route corridor.

---

## 3. Workflow & Technical Specifications
1. **Transaction Sync:** Connects to bank FASTag webhook/API or allows statement CSV dropzone.
2. **Trip Auto-Linker Engine:**
   - Evaluates: `transaction.vehicle_no === journey.truck_id.truck_no` AND `journey.start_date <= transaction.timestamp <= journey.end_date`.
   - Automatically attaches toll plaza name, amount, and timestamp as a line item to the active journey.
3. **Ledger Posting:** Creates balancing journal entry debiting Toll Expense Account and crediting FASTag Bank Account.

---

## 4. Data Models & API Endpoints
1. **Model: `TollTransaction.ts`:**
   - `company_id`, `truck_no`, `journey_id`, `toll_plaza_name`, `amount`, `timestamp`, `bank_ref_no`, `status: ['linked', 'unlinked', 'flagged']`.
2. **Endpoints:**
   - `POST /api/telematics/fastag/sync`: Triggers API sync from banking provider.
   - `POST /api/telematics/fastag/upload-csv`: Parses FASTag statement CSV.
   - `GET /api/telematics/fastag/unlinked`: Lists toll transactions not associated with active trips.

---

## 5. Acceptance Criteria
- [ ] Uploading a FASTag statement auto-links 90%+ of toll transactions to ongoing or completed trips.
- [ ] Journey expense total reflects actual FASTag deductions without requiring manual driver slip entry.
- [ ] Toll charges occurring when the vehicle was scheduled in workshop maintenance trigger an alert.

---

## 6. Definition of Done
1. FASTag statement parser and auto-linker worker implemented.
2. Trip sheet expense summary updated.
