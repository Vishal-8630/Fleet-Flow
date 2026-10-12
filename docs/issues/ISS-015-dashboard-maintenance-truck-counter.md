# ISS-015: Dashboard Maintenance Truck Counter Uses Non-Existent Enum

**Specification ID:** `ISS-015`  
**Title:** Dashboard Maintenance Truck Counter Uses Non-Existent Enum (`'maintenance'` vs `'in_maintenance'`)  
**Type:** Dashboard / KPI Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Integration Mismatch  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-07.md`](./ISSUE-07.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`backend/src/controllers/dashboardController.ts:84`](../../backend/src/controllers/dashboardController.ts#L84), the executive KPI query for maintenance vehicles executes `Truck.countDocuments({ company_id, status: 'maintenance' })`. However, in [`backend/src/models/Truck.ts:32`](../../backend/src/models/Truck.ts#L32), the schema enum is strictly defined as `['active', 'in_maintenance', 'inactive', 'sold']`. Because the controller queries for `'maintenance'` instead of `'in_maintenance'`, the query matches zero vehicles, and the dashboard KPI widget "Vehicles in Workshop / Maintenance" permanently displays `0`.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact (Controller Query):**  
  In `dashboardController.ts:84`:
  ```typescript
  const inMaintenanceTrucks = await Truck.countDocuments({
    company_id,
    status: 'maintenance', // Non-existent enum value!
  });
  ```
- **Confirmed Fact (Mongoose Model Schema):**  
  In `Truck.ts:32`:
  ```typescript
  status: {
    type: String,
    enum: ['active', 'in_maintenance', 'inactive', 'sold'],
    default: 'active',
  }
  ```
- **User Impact:** Fleet managers checking the executive dashboard cannot see vehicles undergoing maintenance or repairs, leading to operational blind spots.

---

## 3. Reproduction Steps
1. Create 3 trucks with `status = 'in_maintenance'`.
2. Send `GET /api/dashboard/metrics`.
3. Inspect `metrics.in_maintenance_trucks`: Value is `0`.

---

## 4. Expected Behavior
`dashboardController.ts` must query using the exact schema enum value: `status: 'in_maintenance'`.

---

## 5. Proposed Technical Solution
Update `dashboardController.ts:84`:
```typescript
const inMaintenanceTrucks = await Truck.countDocuments({
  company_id,
  status: 'in_maintenance',
});
```

---

## 6. Acceptance Criteria
- [ ] `GET /api/dashboard/metrics` returns the accurate count of vehicles with `status: 'in_maintenance'`.
- [ ] The dashboard overview card displays the live count of vehicles currently in workshop bays.

---

## 7. Definition of Done
1. Controller query aligned with schema enum.
2. Verified in integration tests.
