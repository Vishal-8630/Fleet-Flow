# Fleet Flow — UX & Workflow Audit

**Audit Date:** October 2026  
**Auditor:** Principal Frontend Architect & UX Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Standardized Taxonomy:** `Confirmed integration mismatch` | `Confirmed defect` | `Mocked or simulated behavior` | `Incomplete implementation` | `Improvement opportunity`  
**Classification Severities:** `P0` (Broken Critical Flow) | `P1` (Dead Link / Disconnected Feature / UI Data Breakdown) | `P2` (Degraded Interaction / Visual Glitch) | `P3` (Cosmetic)

---

## 1. Executive Summary: User Experience & Workflow Cohesion

Fleet Flow's frontend application is constructed as a Single Page Application (SPA) utilizing React 18, Vite, Tailwind CSS, and Lucide React icons.

**Audit Verdict:** While the UI demonstrates modern design language with card layouts, responsive sidebars, and styled data tables, several core workflows are severely broken due to cross-layer contract mismatches, dead navigation links, hardcoded mock arrays in production views, and silent schema attribute mismatches between frontend expectations and backend MongoDB projections.

---

## 2. P1 High Severity: Dead Navigation Links & Missing Page Components

### 2.1 Missing Credit Notes Interface
- **Dead Link Location:** [Sidebar.tsx:81](../../frontend/src/components/layout/Sidebar.tsx#L81)
- **Target URL:** `/commercial/credit-notes`
- **Router Audit:** [App.tsx](../../frontend/src/App.tsx)
- **Defect Description:**
  1. The sidebar contains an explicit navigation entry under the Commercial menu: `Credit Notes` (`href: '/commercial/credit-notes'`).
  2. In `App.tsx`, no route matches `/commercial/credit-notes`.
  3. No component file named `CreditNotesPage.tsx` exists in `frontend/src/pages/commercial/` or anywhere else in the repository.
  4. **User Impact:** When an operator or accountant clicks "Credit Notes" in the sidebar, the router triggers a wildcard fallback redirecting the user back to `/dashboard`. Users cannot view, search, or print issued credit notes from the UI.

---

## 3. P1 High Severity: Broken Telematics & Empty Fleet Map Display

### 3.1 Code Inspection: [LiveTrackingPage.tsx](../../frontend/src/pages/operations/LiveFleetMapPage.tsx) vs [trackingController.ts:109](../../backend/src/controllers/trackingController.ts#L109)
The live fleet map is intended to show all active vehicles on an interactive Leaflet map with real-time GPS coordinates.
- **Backend Query:**
  ```typescript
  // trackingController.ts: getFleetLiveMap
  const trucks = await Truck.find({
    company_id,
    is_active: true,
  }).select('_id registration_number truck_type');
  ```
- **Mongoose Schema Reality:** [Truck.ts](../../backend/src/models/Truck.ts#L25-L40)
  - The schema has no `is_active` field (it uses `status: 'active'`).
  - The schema has no `registration_number` field (it uses `truck_no`).
  - The schema has no `truck_type` field (it uses `body_type`).
- **User Impact:**
  1. Because `{ is_active: true }` matches no documents, the backend returns an empty array `[]`.
  2. If the filter is bypassed, the projection `.select('_id registration_number truck_type')` strips the actual `truck_no` field, leaving only `_id`.
  3. The frontend `LiveTrackingPage.tsx` attempts to render vehicle labels using `truck.registration_number`. The map markers render with empty tooltips or fail to plot entirely, giving operators the impression that no fleet vehicles exist.

---

## 4. P1 High Severity: AR Aging Report Customer Name Render Bug

### 4.1 Code Inspection: [AgingReportPage.tsx:115-125](../../frontend/src/pages/commercial/AgingReportPage.tsx#L115-L125)
The Accounts Receivable (AR) aging report breaks down outstanding balances into aging buckets (`0-30 days`, `31-60 days`, `61-90 days`, `90+ days`).
- **Frontend Template:**
  ```tsx
  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
    {item.party?.party_name || '—'}
  </td>
  ```
- **Backend Response:** [commercialReportController.ts:80-95](../../backend/src/controllers/commercialReportController.ts#L80-L95)
  The backend aggregation projects the customer name as a flat string:
  ```typescript
  {
    party: partyName, // string e.g. "Tata Steel Logistics"
    current_paise: ...,
    days_30_paise: ...,
    ...
  }
  ```
- **User Impact:** In JavaScript, evaluating `"Tata Steel Logistics"?.party_name` returns `undefined`. The fallback `'—'` is always displayed. Every single customer row in the aging table displays `"—"`, rendering it impossible for collection agents to identify which debtor owes which amount.

---

## 5. P0 Critical / P1 High: External Stakeholder Portals UX Breakdown

### 5.1 Customer Portal Login Workflow
- **Customer View:** [CustomerPortalPage.tsx](../../frontend/src/pages/portal/CustomerPortalPage.tsx)
- **Workflow:** Customer enters company code and registered 10-digit mobile number to request an SMS OTP.
- **Failure:** In [portalController.ts:47](../../backend/src/controllers/portalController.ts#L47), the backend queries `{ contact_phone: phone }` on `BillingParty`. The schema field is `phone`.
- **User Experience:** Customer clicks "Send OTP", receives an immediate red error toast `"Customer not found with this mobile number"` (HTTP 404), and cannot log in under any circumstances.

### 5.2 Vendor Portal Mock Data Facade
- **Vendor View:** [VendorPortalPage.tsx:43-66](../../frontend/src/pages/portal/VendorPortalPage.tsx#L43-L66)
- **Workflow:** Truck brokers and market vehicle owners log in to check attached truck trips, fuel slip deductions, and net payable balances.
- **Facade Reality:**
  - `VendorPortalPage.tsx` defines static in-memory objects:
    ```typescript
    const mockTrips = [
      { id: 'TRP-101', vehicle: 'NL-01-AB-1234', from: 'Mumbai', to: 'Delhi', amount: 85000, status: 'In Transit' },
      { id: 'TRP-102', vehicle: 'NL-01-AB-5678', from: 'Pune', to: 'Chennai', amount: 92000, status: 'Completed' },
    ];
    ```
  - The component makes **zero network requests** to `/api/portal/vendor` or any backend endpoint.
  - The OTP login route for vendors in `portalController.ts` explicitly rejects requests with `400 Unsupported portal_type`.
- **User Experience:** The vendor portal is a non-functional static mockup.

---

## 6. P1 High Severity: Dashboard Inaccuracies & Aggregation String Bugs

### 6.1 Maintenance Vehicle Counter Always Displays Zero
- **Inspection:** [dashboardController.ts:84](../../backend/src/controllers/dashboardController.ts#L84)
- **Query:** `Truck.countDocuments({ company_id, status: 'maintenance' })`
- **Schema Enum:** [Truck.ts:32](../../backend/src/models/Truck.ts#L32) defines `['active', 'in_maintenance', 'inactive', 'sold']`.
- **User Experience:** Even when multiple vehicles are actively checked into workshop bays under maintenance, the Executive KPI widget "Vehicles in Maintenance" permanently reads `0`.

### 6.2 Operations Aggregation String vs ObjectId Mismatch
- **Inspection:** [entryController.ts:93](../../backend/src/controllers/entryController.ts#L93) and [journeyController.ts:127](../../backend/src/controllers/journeyController.ts#L127)
- Aggregation pipelines match on `{ company_id: companyId }` where `companyId` is a raw string.
- Because MongoDB aggregation pipelines require `new Types.ObjectId(companyId)`, the aggregations match zero records.
- **User Experience:** Dashboard summary cards ("Today's Dispatches", "Active Inward Entries") display `0` or empty charts even when valid entries exist in the database.

---

## 7. Form Validation, Accessibility & Error Handling UX Review

| UI Component / Screen | Evaluation Area | Findings & Deficiencies |
|---|---|---|
| **Create LR Form** | Input validation & feedback | Missing client-side validation for mandatory consignor/consignee GSTIN formats; submitting empty packages triggers unhandled backend validation errors. |
| **Create Invoice Modal** | Calculation transparency | Real-time tax calculation does not dynamically update if user modifies RCM checkbox after entering line items. |
| **Live Tracking Page** | Fallback states | If no GPS coordinates exist for a truck, the map centers on `[0, 0]` in the Atlantic Ocean instead of centering on company headquarters. |
| **Global Modals** | Accessibility & Keyboard Nav | Modals lack Focus Trap and do not close on Escape key press, degrading keyboard navigation accessibility. |
| **Data Tables** | Pagination & Empty States | Table views lack unified server-side pagination; large datasets (>500 rows) cause DOM lag on low-power client devices. |

---

## 8. Summary of UX & Workflow Findings

```
+-----------------------------------------------------------------------------------+
| Severity | Location                      | Defect Description                     |
+-----------------------------------------------------------------------------------+
| P0       | Customer Portal Login         | OTP fails 100% due to contact_phone    |
|          |                               | schema mismatch                        |
| P0       | Vendor Portal                 | OTP disabled (400); page displays      |
|          |                               | static mock data                       |
| P1       | Sidebar Navigation            | Dead link /commercial/credit-notes; no |
|          |                               | matching route or page component       |
| P1       | Live Fleet Map                | Schema mismatch (registration_number,  |
|          |                               | is_active) causes blank map display    |
| P1       | AR Aging Report Table         | Customer name renders "—" due to       |
|          |                               | item.party?.party_name string mismatch |
| P1       | Executive Dashboard           | Maintenance counter always displays 0  |
|          |                               | (maintenance vs in_maintenance)        |
| P1       | Operations Summary KPIs       | Aggregations return 0 due to string    |
|          |                               | company_id in MongoDB $match           |
+-----------------------------------------------------------------------------------+
```
