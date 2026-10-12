# ISS-010: Trip Profitability Report Always Returns Zero Values

**Specification ID:** `ISS-010`  
**Title:** Trip Profitability Report Always Returns Zero Values  
**Type:** Reporting / Analytics Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-13.md`](./ISSUE-13.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`commercialReportController.ts:128-135`](../../backend/src/controllers/commercialReportController.ts#L128-L135), the trip profitability calculation attempts to read `journey.total_freight_paise`, `journey.diesel_expense_paise`, and `journey.toll_expense_paise`. In the [`TruckJourney.ts`](../../backend/src/models/TruckJourney.ts#L25-L60) Mongoose schema, financial values are tracked in standard rupee amounts as `freight_rate`, `total_diesel_cost`, and `total_driver_expenses`. Because the `_paise` attributes do not exist, all variables evaluate to `0`. Every trip row in the profitability table reports ₹0.00 Revenue, ₹0.00 Expenses, and ₹0.00 Net Margin.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact (Controller Mapping Logic):**  
  In `commercialReportController.ts:128-135`:
  ```typescript
  const report = journeys.map((journey) => {
    const freight = (journey.total_freight_paise || 0) / 100;
    const diesel = (journey.diesel_expense_paise || 0) / 100;
    const toll = (journey.toll_expense_paise || 0) / 100;
    const expenses = diesel + toll;
    const netMargin = freight - expenses;
    return { ... };
  });
  ```
- **Confirmed Fact (Schema Reality):**  
  In `TruckJourney.ts`:
  - Freight revenue: `freight_rate: { type: Number, required: true }`
  - Fuel expense: `total_diesel_cost: { type: Number, default: 0 }`
  - Toll & other driver expenses: `total_driver_expenses: { type: Number, default: 0 }`
- **Result:** The mapped object properties are `undefined`. The calculation produces `0` for all metrics across all trips.

---

## 3. Reproduction Steps
1. Create a `TruckJourney` with `freight_rate: 85000`, `total_diesel_cost: 32000`, `total_driver_expenses: 8000`.
2. Send `GET /api/commercial/profitability`.
3. Observe: For the created trip, `freight: 0`, `expenses: 0`, `netMargin: 0`.

---

## 4. Expected Behavior
The profitability calculation must read the actual rupee properties from `TruckJourney`:
- `freight = journey.freight_rate || 0`
- `diesel = journey.total_diesel_cost || 0`
- `expenses = diesel + (journey.total_driver_expenses || 0) + (journey.other_expenses || 0)`
- `netMargin = freight - expenses`
- `marginPercentage = freight > 0 ? (netMargin / freight) * 100 : 0`

---

## 5. Proposed Technical Solution
Update `getTripProfitabilityReport` in `commercialReportController.ts`:
```typescript
const report = journeys.map((journey) => {
  const freight = journey.freight_rate || 0;
  const diesel = journey.total_diesel_cost || 0;
  const driverAndToll = journey.total_driver_expenses || 0;
  const other = journey.other_expenses || 0;
  const totalExpense = diesel + driverAndToll + other;
  const netMargin = freight - totalExpense;
  const marginPercentage = freight > 0 ? Number(((netMargin / freight) * 100).toFixed(2)) : 0;

  return {
    journey_id: journey._id,
    journey_no: journey.journey_no,
    truck_no: (journey.truck_id as any)?.truck_no || 'Unknown',
    driver_name: (journey.driver_id as any)?.name || 'Unknown',
    freight_revenue: freight,
    diesel_cost: diesel,
    other_expenses: driverAndToll + other,
    total_expenses: totalExpense,
    net_margin: netMargin,
    margin_percentage: marginPercentage,
  };
});
```

---

## 6. Acceptance Criteria
- [ ] `GET /api/commercial/profitability` returns accurate non-zero revenue, expenses, and margins matching the underlying `TruckJourney` records.
- [ ] Profit margins match: `Revenue - (Diesel + Toll + Other Expenses)`.
- [ ] Frontend [`ProfitabilityPage.tsx`](../../frontend/src/pages/fleet/MaintenanceDashboardPage.tsx) renders colorful profit badges and correct currency formatting.

---

## 7. Definition of Done
1. `commercialReportController.ts` updated and verified.
2. Verified in [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md).
