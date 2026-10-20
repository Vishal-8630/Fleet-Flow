# Fleet Flow — Mandatory LR Truck/Driver, Journey Consistency & Table Column Visibility: Architectural Design

**Document Type:** Architectural Design Document & Pre-Implementation Specification  
**Project:** Fleet Flow — Enterprise Transport & Fleet Management SaaS  
**Target Path:** `docs/testing/audit/LR_VEHICLE_DRIVER_AND_TABLE_COLUMN_VISIBILITY_DESIGN.md`  
**Date:** October 2026  
**Status:** Design Proposal (Documentation Only — No Code Implemented)  
**Related Documents & Decisions:**
- [`BILLING_PARTY_LR_JOURNEY_WORKFLOW_DESIGN.md`](./BILLING_PARTY_LR_JOURNEY_WORKFLOW_DESIGN.md) (Commercial Journey Mandatory-LR Baseline)
- [`DEC-004`](../decisions/DEC-004-freight-invoice-eligibility.md) (Freight Invoicing Rules)
- [`DEC-009`](../decisions/DEC-009-lr-trip-workflow-architecture.md) (LR & Trip Architecture)
- [`DEC-010`](../decisions/DEC-010-branches-hubs-operational-model.md) (Branches, Hubs & Operational Numbering)
- [`FF-ISSUE-041`](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md) (Customer Linkage)
- [`FF-ISSUE-049`](../issues/operations/FF-ISSUE-049-table-overcrowding-column-visibility.md) (Table Density & Responsive Layouts)

---

## 1. Executive Summary & Architectural Scope

### 1.1 Purpose
Following the acceptance of Phase 1 (Backend Journey-Creation Contract & LR Linking) and Phase 2 (Billing Party LR Selection & Journey UI), the product owner has clarified critical operational rules governing physical asset assignment and list presentation across the consignment-to-dispatch pipeline:

1. **Mandatory Master Truck & Driver on Every New LR:** Consignments must never be booked with arbitrary, unverified freeform text. Every new Lorry Receipt (LR / Bilty) must reference a registered fleet vehicle asset (`Truck`) and a registered professional driver (`Driver`) from the company master records.
2. **Journey Inherits Vehicle & Driver from Selected LRs:** When assembling a commercial freight journey from one or more LRs, the operational truck and driver are **derived directly from the LRs**. All consignments bundled onto a journey must share the exact same physical truck and operating driver. Any mismatch between selected LRs must be rejected decisively by both backend validation and frontend gating.
3. **Generic Table Column Visibility:** Standardize a reusable, accessible, client-side persisted column-visibility framework to cure data density overcrowding across Fleet Flow tables, beginning with the Lorry Receipt table (`LRListPage.tsx`) by reducing its 10 simultaneous columns to 7 operational defaults.

### 1.2 Boundary Conditions & Implementation Guardrails
- **Design Only:** No source code, tests, configuration, environment, or database records are modified in this step.
- **Backward Compatibility:** Historical LRs created before this rule and historical LR-free journeys must not be broken or invalidated.
- **Legal Consignment Permanence:** Under the Indian Carriage by Road Act 2007 and GST e-Way Bill statutory rules, the issued LR is a permanent legal document. Subsequent vehicle swaps or mid-transit driver handovers on an active journey must not retroactively falsify historical LR issuance records.

```mermaid
flowchart TD
    subgraph Master Records
        TruckMaster[Truck Master Asset\n_id, truck_no, compliance, status]
        DriverMaster[Driver Master KYC\n_id, name, phone, license, status]
    end

    subgraph Step 1: Consignment Issuance (LRListPage)
        SelectTruck[Select Registered Truck]
        SelectDriver[Select Registered Driver]
        TruckMaster -. Validates Active/Compliant .-> SelectTruck
        DriverMaster -. Validates Active/KYC .-> SelectDriver
        IssueLR[Issue LR / Bilty\nPersists: truck_id, driver_id\nSnapshots: vehicle_number, driver_name, driver_phone]
        SelectTruck --> IssueLR
        SelectDriver --> IssueLR
    end

    subgraph Step 2: Journey Dispatch (NewJourneyPage)
        SelectLRs[Select 1 or Multiple LRs]
        IssueLR --> SelectLRs
        ValidateConsistency{Same Truck & Driver\nAcross All Selected LRs?}
        SelectLRs --> ValidateConsistency
        ValidateConsistency -- Mismatch Detected --> RejectHTTP400[HTTP 400: TRUCK_MISMATCH\nor DRIVER_MISMATCH]
        ValidateConsistency -- Uniform Match --> DeriveAssets[Derive Journey truck_id & driver_id\nfrom Selected LRs]
        DeriveAssets --> CreateJourney[Dispatch / Schedule TruckJourney\nAtomic LR Linking]
    end
```

---

## 2. Codebase Inspection & Current State Audit

A thorough inspection of the active codebase was conducted to establish exact schema fields, controller logic, and frontend components currently in production.

### 2.1 Backend Data Models

#### A. Consignment Note Model (`backend/src/models/Entry.ts`)
- **Current State:**
  - Has `vehicle_number: { type: String, required: true, trim: true, uppercase: true, index: true }`.
  - **Does NOT have `truck_id`** in the Mongoose schema.
  - **Does NOT have `driver_id`** in the Mongoose schema.
  - **Does NOT have `driver_name` or `driver_phone`** in the Mongoose schema.
  - Has `journey_id: { type: Schema.Types.ObjectId, ref: 'TruckJourney', index: true }`.
  - Has `branch_id: { type: Schema.Types.ObjectId, ref: 'Branch', index: true }`.
  - Has `billing_party_id: { type: Schema.Types.ObjectId, ref: 'BillingParty', index: true }`.
  - Has `status: { type: String, enum: ['active', 'invoiced', 'cancelled'], default: 'active' }`.
- **Finding:** Currently, `Entry` stores vehicle information purely as a disconnected string (`vehicle_number`). Driver information entered on the frontend is completely dropped by Mongoose strict schema validation because `driver_name` and `driver_phone` do not exist in `EntrySchema`.

#### B. Dispatch Journey Model (`backend/src/models/TruckJourney.ts`)
- **Current State:**
  - Has `truck_id: { type: Schema.Types.ObjectId, ref: 'Truck', required: true }`.
  - Has `driver_id: { type: Schema.Types.ObjectId, ref: 'Driver', required: true }`.
  - Has `lr_ids: [{ type: Schema.Types.ObjectId, ref: 'Entry' }]`.
  - Has `journey_type: { type: String, enum: ['commercial', 'internal_repositioning', 'maintenance'] }`.
  - Has `driver_handover_history: [DriverHandoverSchema]` for mid-trip relief drivers.
- **Finding:** `TruckJourney` already treats `truck_id` and `driver_id` as authoritative relational foreign keys. However, `createJourney` currently expects them directly in `req.body` and does not derive them from `lr_ids`.

#### C. Fleet Assets: Truck & Driver (`Truck.ts`, `Driver.ts`)
- **`Truck.ts`:**
  - Identifiers: `truck_no` (unique per company).
  - Mechanical: `make`, `model`, `body_type`, `tonnage_capacity`, `cbm_capacity`.
  - Status: `available`, `on_trip`, `in_maintenance`, `decommissioned`, `active`.
  - Statutory Vault: 6 compliance docs (Fitness, Insurance, National Permit, State Permit, Road Tax, PUC) and `calculateComplianceStatus()`.
  - Driver Assignment: `current_driver_id` and `driver_assignments` history.
  - Tenant scope: `company_id`. Neither Truck nor Driver maintains a `branch_id`.
- **`Driver.ts`:**
  - Identifiers: `name`, `phone`, `license_number` (unique per company), `aadhaar_number`.
  - Status: `active`, `on_leave`, `terminated`.
  - Vehicle Assignment: `current_truck_id` and `assignment_history`.

### 2.2 Backend Controllers

#### A. `backend/src/controllers/entryController.ts` (`createEntry`)
- Lines 164–170 already call:
  ```typescript
  await validateTenantOwnership(companyId!, {
    billing_party_id: req.body.billing_party_id,
    truck_id: req.body.truck_id,
    driver_id: req.body.driver_id,
    journey_id: req.body.journey_id,
  });
  ```
- However, because `truck_id` and `driver_id` were not declared in `EntrySchema`, Mongoose silently stripped them during `new Entry({ ...req.body })`.
- Lines 254–276 atomically generate `lr_no` using branch-specific sequence counters (`counters.lr_seq`).
- Lines 291–298 instantiate and save the entry.

#### B. `backend/src/controllers/journeyController.ts` (`createJourney`)
- Lines 224–248: Reads `truck_id` and `driver_id` directly from `req.body` and returns `400` if missing.
- Lines 293–392: Enforces mandatory LRs for commercial journeys, verifies LR eligibility, derives and validates commercial customer (`CUSTOMER_MISMATCH`), and checks branch consistency (`BRANCH_MISMATCH`).
- **Critical Gap:** The controller does **not** inspect `entry.truck_id` or `entry.driver_id`. A user can select LRs that were issued for Truck A and Driver A, but dispatch them on a journey assigned to Truck B and Driver B, or select two LRs that have different trucks.

### 2.3 Frontend Pages

#### A. Consignment Modal & Table (`frontend/src/pages/commercial/LRListPage.tsx`)
- Lines 65–72: `formData` holds freeform text strings:
  ```typescript
  vehicle_number: '',
  driver_name: '',
  driver_phone: '',
  ```
- Lines 931–951: Renders standard `<input type="text">` controls for `vehicle_number` and `driver_name`.
- Lines 840–860: Has a trip selector ("Link to Originating Trip"). Selecting a journey auto-populates the text fields from the journey's populated truck and driver, but users can still manually overwrite them with arbitrary text.
- Lines 557–599: The LR table renders **10 columns** unconditionally: Checkbox, LR Details, Branch, Vehicle & Driver, Route Corridor, Consignor & Consignee, Cargo & Weight, Freight & Terms, Status, Actions. Standard laptop screens experience horizontal crowding and visual clipping.

#### B. Journey Planning Portal (`frontend/src/pages/operations/NewJourneyPage.tsx`)
- Has dedicated selectors for `truck_id` and `driver_id` backed by `/fleet/trucks` and `/fleet/drivers`.
- Automatically pre-fills cargo descriptions, total actual weights, volume, customer, and branch from selected LRs.
- Does **not** pre-fill or enforce vehicle/driver from the selected LRs.

---

## 3. Requirement 1: Mandatory Truck and Driver on Every New LR

### 3.1 Data Architecture & Authoritative Source of Truth

An LR in Indian road freight is simultaneously:
1. An **operational transport order** executed by physical assets.
2. An **immutable legal instrument** under the Carriage by Road Act 2007, used for GST e-Way Bill verification, tax audits, and carrier liability litigation.

Therefore, the data model must maintain **both** relational foreign key pointers to active system assets and **immutable snapshot strings** of the details at the moment of issuance:

```typescript
// Proposed updates to IEntry in backend/src/models/Entry.ts
export interface IEntry extends Document {
  // ... existing fields ...

  // Master Relational References
  truck_id?: Types.ObjectId;   // Required on all new LRs; optional for historical records
  driver_id?: Types.ObjectId;  // Required on all new LRs; optional for historical records

  // Authoritative Legal Consignment Snapshots
  vehicle_number: string;      // Immutable snapshot (e.g., 'MH-04-AB-1234')
  driver_name: string;         // Immutable snapshot (e.g., 'Rameshwar Kumar')
  driver_phone?: string;       // Immutable snapshot (e.g., '+91 98765 43210')

  // ... rest of fields ...
}
```

```typescript
// Proposed schema updates in Entry.ts
truck_id: {
  type: Schema.Types.ObjectId,
  ref: 'Truck',
  index: true,
  // Note: Schema-level required: false to preserve historical LR hydration
},
driver_id: {
  type: Schema.Types.ObjectId,
  ref: 'Driver',
  index: true,
  // Note: Schema-level required: false to preserve historical LR hydration
},
vehicle_number: {
  type: String,
  required: true,
  trim: true,
  uppercase: true,
  index: true,
},
driver_name: {
  type: String,
  required: true,
  trim: true,
  default: '',
},
driver_phone: {
  type: String,
  trim: true,
  default: '',
},
```

#### Why Decouple Schema Defaults from Creation Validation?
Marking `truck_id` and `driver_id` as `required: true` at the Mongoose schema level would break existing stored LRs that were created before this feature was introduced (they would fail validation whenever loaded, updated, or invoiced). Instead, we enforce mandatory presence strictly at the **API creation boundary** (`POST /api/commercial/entries`) and frontend form validation.

### 3.2 Frontend UI & Selector Experience (`LRListPage.tsx`)

1. **Replace Raw Text Inputs with Master Record Selectors:**
   - Remove the freeform text inputs for `vehicle_number`, `driver_name`, and `driver_phone`.
   - Introduce two searchable dropdown selectors backed by React Query hooks:
     - `availableTrucksData` via `GET /fleet/trucks?limit=100`
     - `activeDriversData` via `GET /fleet/drivers?limit=100`
2. **Truck Selector Presentation:**
   - Label: `Assigned Commercial Vehicle *`
   - Option format: `MH-04-AB-1234 — Tata Prima 4028.S (Container, 28T) [COMPLIANT]`
   - Displays compliance badge:
     - Compliant vehicles display green `[COMPLIANT]` badge.
     - Expired compliance produces an inline advisory warning: `(Compliance Expired — Advisory Warning: Renewal Required Prior to Dispatch)`. Booking remains permitted so clerks can issue paperwork in advance.
     - Decommissioned, deleted, or otherwise out-of-service vehicles are completely filtered out from the active selector.
   - On change:
     - Stores selected `truck_id` in form state.
     - Auto-populates snapshot string `formData.vehicle_number = selectedTruck.truck_no`.
     - **Default Driver Convenience:** If the selected truck has a `current_driver_id` assigned in the master record and the user has not yet picked a driver, automatically pre-select that driver in the driver dropdown.
3. **Driver Selector Presentation:**
   - Label: `Assigned Professional Driver *`
   - Option format: `Rameshwar Kumar (+91 98765 43210) — Lic: DL-MH04201800123`
   - Displays status badge (`active`, `on_leave`). Terminated or deleted drivers are filtered out.
   - On change:
     - Stores selected `driver_id` in form state.
     - Auto-populates snapshot strings `formData.driver_name = selectedDriver.name` and `formData.driver_phone = selectedDriver.phone`.
4. **Originating Trip Link Interaction (`formData.journey_id`):**
   - If user selects an originating trip from `activeJourneysData`:
     - Both `truck_id` and `driver_id` are automatically locked and populated from the selected `TruckJourney`.
     - The selectors display badges: `Inherited from Trip JRN-0042`.
     - If the user changes or removes the trip link, unlock the selectors without retaining stale incompatible IDs.
5. **Standalone Consignments Supported:**
   - Standalone LRs (no trip link at creation time) remain 100% supported. The operator simply selects the registered Truck and Driver directly from the master fleet lists.

### 3.3 Backend Validation Rules (`entryController.ts:createEntry`)

When a new LR creation request is received:

1. **Mandatory Field Presence:**
   ```typescript
   const { truck_id, driver_id } = req.body;
   if (!truck_id || !Types.ObjectId.isValid(truck_id)) {
     return res.status(400).json({
       code: 'TRUCK_REQUIRED',
       error: 'A registered commercial vehicle is mandatory to issue a Lorry Receipt.',
     });
   }
   if (!driver_id || !Types.ObjectId.isValid(driver_id)) {
     return res.status(400).json({
       code: 'DRIVER_REQUIRED',
       error: 'A registered professional driver is mandatory to issue a Lorry Receipt.',
     });
   }
   ```
2. **Deep Multi-Tenant Ownership & Existence Validation:**
   - `validateTenantOwnership` verifies that `truck_id` and `driver_id` belong to `req.tenant.id` (`Anti-IDOR`).
   - Loads `Truck` and `Driver` documents. Returns `404` if either record is missing or flagged with `is_deleted: true`.
3. **Operational Eligibility & Two-Stage Enforcement Model (Issuance vs. Dispatch):**
   - **Truck Eligibility at LR Issuance:**
     - **Strict Rejections:** Vehicle must not be deleted (`is_deleted: true`), decommissioned (`status === 'decommissioned'`), or otherwise ineligible according to existing fleet rules (e.g., scrapped, impounded, or marked out-of-service). Attempting to book an LR with an ineligible vehicle returns `HTTP 400` (`TRUCK_INELIGIBLE`).
     - **Statutory Compliance Warning (Non-Blocking at Booking):** If statutory certificates are expired (`truck.calculateComplianceStatus() === 'EXPIRED'`), the LR creation succeeds, but the backend includes an advisory warning object in the response:
       ```json
       { "warning": "COMPLIANCE_EXPIRED", "message": "Vehicle certificates expired. Renewal required prior to trip dispatch." }
       ```
       This accommodates standard logistics workflows where transport clerks book consignments hours or days in advance while fleet compliance teams finalize certificate renewals.
   - **Truck Compliance & Availability Enforcement at Dispatch (`createJourney` / `dispatchTrip`):**
     - Full operational gatekeeping is strictly enforced at physical journey dispatch.
     - If dispatched as `status === 'active'`, an expired certificate strictly blocks dispatch with `HTTP 422 Unprocessable Entity` (`COMPLIANCE_ALERT: Vehicle has expired statutory documents. Renew certificates before dispatching.`).
     - Real-time availability is verified: if the vehicle is currently on an active or delayed journey (`status: 'on_trip'` or active in `TruckJourney`), dispatch is rejected with `HTTP 409 Conflict`.
   - **Driver Eligibility at LR Issuance:**
     - Driver must exist, `is_deleted: false`, and status must not be `'terminated'`. If `status === 'on_leave'`, the request is rejected with `HTTP 400` (`DRIVER_ON_LEAVE`, `Selected driver is marked on leave and cannot be assigned to new consignments.`).
4. **Originating Trip Consistency Check:**
   - If `req.body.journey_id` is supplied:
     - Fetch the associated `TruckJourney`.
     - Verify: `String(journey.truck_id) === String(truck_id)`. If mismatch, reject with `400` (`TRIP_TRUCK_MISMATCH`).
     - Verify: `String(journey.driver_id) === String(driver_id)`. If mismatch, reject with `400` (`TRIP_DRIVER_MISMATCH`).
5. **Authoritative Snapshot Population (Anti-Tampering):**
   - Overwrite any client-supplied string overrides with authoritative master data:
     ```typescript
     newEntry.truck_id = truck._id;
     newEntry.driver_id = driver._id;
     newEntry.vehicle_number = truck.truck_no.toUpperCase().trim();
     newEntry.driver_name = driver.name.trim();
     newEntry.driver_phone = driver.phone?.trim() || '';
     ```

---

## 4. Requirement 2: Journey Inherits Truck and Driver from LRs

### 4.1 Derivation Mechanics on Journey Creation (`createJourney`)

When a commercial journey is created with one or more `lr_ids`:

1. **Automatic Asset Derivation:**
   - The backend extracts `truck_id` and `driver_id` from the selected LRs.
   - If the API client omitted `truck_id` or `driver_id`, the backend automatically sets them to the derived values.
2. **Multi-LR Consistency Enforcement:**
   - All selected LRs must reference the **exact same truck asset** (`truck_id`).
   - All selected LRs must reference the **exact same driver** (`driver_id`).
3. **Strict Conflict Rejection Rules:**
   - If any LR disagrees on the truck, the request is rejected with `HTTP 400` `TRUCK_MISMATCH`.
   - If any LR disagrees on the driver, the request is rejected with `HTTP 400` `DRIVER_MISMATCH`.
   - The error response identifies the specific conflicting LRs and asset details to enable immediate operational correction.

### 4.2 Validation Matrix: Commercial Journey Creation

| Scenario | `lr_ids` | Request `truck_id` | Request `driver_id` | LR Truck Consistency | LR Driver Consistency | Backend Action | Response Code / Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Single LR** | `[LR1]` | Omitted | Omitted | N/A (1 LR) | N/A (1 LR) | Auto-derive Truck & Driver from LR1 | `201 Created` |
| **B. Multi-LR Uniform** | `[LR1, LR2]` | Omitted | Omitted | Both have Truck A | Both have Driver X | Auto-derive Truck A & Driver X | `201 Created` |
| **C. Explicit Match** | `[LR1, LR2]` | Truck A | Driver X | Both have Truck A | Both have Driver X | Validated & Accepted | `201 Created` |
| **D. Mixed Truck** | `[LR1, LR2]` | Any / Omitted | Any / Omitted | LR1=Truck A, LR2=Truck B | Any | **Strictly Rejected** | `400 TRUCK_MISMATCH` |
| **E. Mixed Driver** | `[LR1, LR2]` | Any / Omitted | Any / Omitted | Both have Truck A | LR1=Driver X, LR2=Driver Y | **Strictly Rejected** | `400 DRIVER_MISMATCH` |
| **F. Client Truck Conflict** | `[LR1]` | Truck B | Any | LR1 has Truck A | Any | **Strictly Rejected** | `400 TRUCK_CONFLICT_WITH_LRS` |
| **G. Client Driver Conflict** | `[LR1]` | Any | Driver Y | Any | LR1 has Driver X | **Strictly Rejected** | `400 DRIVER_CONFLICT_WITH_LRS` |
| **H. Legacy LR Missing Ref** | `[LR_Old]` | Any / Omitted | Any / Omitted | `truck_id` is null | `driver_id` is null | **Strictly Rejected** | `400 LR_MISSING_ASSET_REFERENCE` |

### 4.3 Detailed Backend Implementation Specification

In `backend/src/controllers/journeyController.ts` (`createJourney`), after validating `lr_ids` and customer consistency:

```typescript
// 4.5. Derive and Enforce Truck & Driver Consistency Across All Selected LRs
if (journey_type === 'commercial' && validatedEntries.length > 0) {
  // Check that all selected LRs possess mandatory master references
  const unlinkedTruckLrs = validatedEntries.filter((e) => !e.truck_id);
  if (unlinkedTruckLrs.length > 0) {
    return res.status(400).json({
      code: 'LR_MISSING_ASSET_REFERENCE',
      error: `Consignment '${unlinkedTruckLrs[0].lr_no}' was created without a registered vehicle reference. Historical or unreferenced LRs cannot be dispatched on a commercial journey until updated.`,
    });
  }

  const unlinkedDriverLrs = validatedEntries.filter((e) => !e.driver_id);
  if (unlinkedDriverLrs.length > 0) {
    return res.status(400).json({
      code: 'LR_MISSING_ASSET_REFERENCE',
      error: `Consignment '${unlinkedDriverLrs[0].lr_no}' was created without a registered driver reference. Historical or unreferenced LRs cannot be dispatched on a commercial journey until updated.`,
    });
  }

  // 1. Vehicle Consistency Validation
  const firstTruckId = String(validatedEntries[0].truck_id);
  const truckMismatchLr = validatedEntries.find(
    (e) => String(e.truck_id) !== firstTruckId
  );

  if (truckMismatchLr) {
    return res.status(400).json({
      code: 'TRUCK_MISMATCH',
      error: `Vehicle mismatch: Lorry Receipt '${validatedEntries[0].lr_no}' is assigned to vehicle '${validatedEntries[0].vehicle_number}', but '${truckMismatchLr.lr_no}' is assigned to '${truckMismatchLr.vehicle_number}'. All consignments on a commercial journey must share the same physical vehicle.`,
      details: {
        expected_truck: validatedEntries[0].vehicle_number,
        conflicting_lr: truckMismatchLr.lr_no,
        conflicting_truck: truckMismatchLr.vehicle_number,
      },
    });
  }

  // 2. Driver Consistency Validation
  const firstDriverId = String(validatedEntries[0].driver_id);
  const driverMismatchLr = validatedEntries.find(
    (e) => String(e.driver_id) !== firstDriverId
  );

  if (driverMismatchLr) {
    return res.status(400).json({
      code: 'DRIVER_MISMATCH',
      error: `Driver mismatch: Lorry Receipt '${validatedEntries[0].lr_no}' is assigned to driver '${validatedEntries[0].driver_name}', but '${driverMismatchLr.lr_no}' is assigned to '${driverMismatchLr.driver_name}'. All consignments on a commercial journey must share the same operating driver.`,
      details: {
        expected_driver: validatedEntries[0].driver_name,
        conflicting_lr: driverMismatchLr.lr_no,
        conflicting_driver: driverMismatchLr.driver_name,
      },
    });
  }

  // 3. Resolve Authoritative Truck ID
  if (truck_id) {
    if (String(truck_id) !== firstTruckId) {
      return res.status(400).json({
        code: 'TRUCK_CONFLICT_WITH_LRS',
        error: `Supplied vehicle does not match the vehicle '${validatedEntries[0].vehicle_number}' assigned to the selected Lorry Receipts.`,
      });
    }
  } else {
    truck_id = validatedEntries[0].truck_id;
  }

  // 4. Resolve Authoritative Driver ID
  if (driver_id) {
    if (String(driver_id) !== firstDriverId) {
      return res.status(400).json({
        code: 'DRIVER_CONFLICT_WITH_LRS',
        error: `Supplied driver does not match the driver '${validatedEntries[0].driver_name}' assigned to the selected Lorry Receipts.`,
      });
    }
  } else {
    driver_id = validatedEntries[0].driver_id;
  }
}
```

### 4.4 Interaction with Master Assignments, Resource Conflicts & Mid-Trip Swaps

#### A. Master Truck-to-Driver Assignments vs. Operational LR Drivers
- `Truck.current_driver_id` represents the depot's default custodial assignment.
- However, for an actual freight movement, the driver recorded on the LR is **authoritative**.
- If a relief or contract driver is assigned to the LR, the journey inherits that relief driver. The depot custodian assignment on `Truck` is not forcibly mutated unless the journey transitions to `status: 'active'`.

#### B. Resource Conflict Safeguards
- Before creating the journey, the controller checks:
  1. `TruckJourney.findOne({ truck_id, status: { $in: ['active', 'delayed'] } })`: Verifies vehicle is not already dispatched.
  2. `TruckJourney.findOne({ driver_id, status: { $in: ['active', 'delayed'] } })`: Verifies driver is not operating another concurrent trip.
- If either resource is double-booked, the request is rejected with `HTTP 409 Conflict`.

#### C. Handling Subsequent Mid-Transit Swaps (`swapDriver`)
- **Operational Reality:** In long-haul routes across India (e.g. Mumbai to Guwahati), drivers are frequently swapped midway due to medical emergencies, hours-of-service compliance, or relay hubs.
- **Audited Handover Mechanism:** Fleet Flow handles this via `POST /api/operations/journeys/:id/swap-driver`, updating `journey.driver_id` and appending an audited entry to `journey.driver_handover_history` (`outgoing_driver_id`, `incoming_driver_id`, `handover_odometer`, `reason`, `authorized_by`, `timestamp`).
- **Preservation of Legal Consignment Snapshots:**
  - An issued LR is a permanent legal receipt signed by the consignor under the Indian Carriage by Road Act 2007.
  - The LRs carried on the trip remain linked via `Entry.journey_id`.
  - Operational dispatch queries (`Entry.journey_id -> driver_id`) dynamically resolve the *currently active driver* operating the vehicle en route.
  - The original `driver_id` reference and snapshot strings (`driver_name`, `driver_phone`) on each `Entry` record are **strictly preserved without mutation**, guaranteeing legal non-repudiation, tax audit permanence, and insurance validity.

#### D. Historical LR Handling & Journey Cancellation Safeguards
1. **Gating Historical LRs from New Commercial Journeys:**
   - Historical LRs created before this feature that lack `truck_id` or `driver_id` **cannot enter a new commercial journey**.
   - When an operator attempts to create a commercial journey bundling such LRs, the backend strictly rejects the request with `HTTP 400` `LR_MISSING_ASSET_REFERENCE` (`Consignment '...' was created without a registered vehicle or driver reference`).
   - Historical consignments cannot be dispatched under the new journey model until an authorized operator explicitly updates the LR by assigning a valid registered `Truck` and `Driver`.
2. **Journey Cancellation & Consignment Unlinking:**
   - When a journey is cancelled (or individual LRs are unlinked prior to trip dispatch):
     - The atomic transaction releases the consignments by setting `Entry.journey_id = null`.
     - The unlinking operation **must NEVER silently rewrite, wipe, or overwrite the LR's original issuance snapshots** (`vehicle_number`, `driver_name`, `driver_phone`, `truck_id`, `driver_id`).
     - The LRs return to an unassigned `status: 'active'` state with their original vehicle and driver references 100% intact, ready for re-dispatch on an alternative compatible journey or administrative review without corrupting historical booking data.

#### E. Concurrency Safeguards
- All operations inside `createJourney` execute inside a MongoDB transaction (`runInTransaction`).
- `Entry.updateMany` uses an atomic filter:
  ```typescript
  const updateResult = await Entry.updateMany(
    {
      _id: { $in: lr_ids },
      company_id: companyId,
      status: 'active',
      journey_id: { $in: [null, undefined] },
    },
    { $set: { journey_id: journey._id } },
    { session }
  );
  if (updateResult.matchedCount !== lr_ids.length) {
    throw new ConcurrencyError('One or more LRs were concurrently assigned or modified.');
  }
  ```
- If two users concurrently attempt to dispatch journeys containing overlapping LRs, exactly one transaction succeeds; the other rolls back completely with `409 Conflict`.

---

## 5. Requirement 3: Generic Table Column Visibility Architecture

### 5.1 Problem Statement & UX Motivation
In `frontend/src/pages/commercial/LRListPage.tsx`, the data table currently renders 10 columns simultaneously:
1. `Checkbox` (Bulk selection for journey bundling)
2. `LR Details` (`lr_no`, `lr_date`, `bill_no`, linked trip badge)
3. `Branch` (`branch_code`, `branch_name`)
4. `Vehicle & Driver` (`vehicle_number`, `driver_name`)
5. `Route Corridor` (`from_location` → `to_location`)
6. `Consignor & Consignee` (Shipper & Receiver names)
7. `Cargo & Weight` (Package count, packaging, goods description, tonnes)
8. `Freight & Terms` (Freight amount, payment terms badge)
9. `Status` (`active`, `invoiced`, `cancelled`)
10. `Actions` (Create Journey, Print, Cancel)

On standard 1080p and 1366x768 screens, displaying 10 dense columns causes horizontal clipping, awkward line wraps, and cognitive overload. Users need a clear, focused default operational view, with the flexibility to customize and persist visible columns.

### 5.2 Reusable Architectural Foundation

We design a generic, framework-agnostic, zero-Tailwind infrastructure that can be adopted across Fleet Flow tables (LR Table, Vehicle Entry Table, Journey Table, Invoice Table).

#### A. Data Contract: `TableColumnDefinition`
```typescript
// frontend/src/types/table.ts
export interface ITableColumnConfig {
  id: string;               // Unique column key (e.g., 'cargo_weight')
  label: string;            // Human-readable header (e.g., 'Cargo & Weight')
  isDefaultVisible: boolean;// Default visibility if user has no saved preference
  isRequired?: boolean;     // Cannot be hidden (e.g., Checkbox, LR Details, Status, Actions)
  description?: string;     // Contextual tooltip explanation
}
```

#### B. Reusable Hook: `useTableColumnVisibility`
```typescript
// frontend/src/hooks/useTableColumnVisibility.ts
import { useState, useEffect, useCallback, useMemo } from 'react';

export function useTableColumnVisibility(
  tableKey: string,
  columns: ITableColumnConfig[],
  userId: string = 'guest'
) {
  // Scoped strictly per authenticated user and table to isolate preferences across users
  const storageKey = useMemo(
    () => `fleetflow_tbl_cols_${userId}_${tableKey}`,
    [tableKey, userId]
  );

  const columnMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const validColumnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  // Compute default visible column set from configuration
  const defaultVisibleSet = useMemo(() => {
    return new Set(
      columns
        .filter((col) => col.isDefaultVisible || col.isRequired)
        .map((col) => col.id)
    );
  }, [columns]);

  // Helper: Reconcile saved array with current column catalog
  const reconcileSavedColumns = useCallback(
    (savedArray: string[]): Set<string> => {
      const reconciled = new Set<string>();

      // 1. Unknown Column ID Purging: Keep saved columns that still exist in current catalog
      savedArray.forEach((id) => {
        if (validColumnIds.has(id)) {
          reconciled.add(id);
        }
      });

      // 2. Newly Introduced Columns: If a column exists in the current catalog with
      // isDefaultVisible: true and was never present when the user saved their preference,
      // include it automatically so users do not miss new capabilities
      const savedSet = new Set(savedArray);
      columns.forEach((col) => {
        if (!savedSet.has(col.id) && col.isDefaultVisible) {
          reconciled.add(col.id);
        }
      });

      // 3. Strict Required Columns Invariant: Required columns can NEVER be omitted
      columns.forEach((col) => {
        if (col.isRequired) {
          reconciled.add(col.id);
        }
      });

      return reconciled;
    },
    [columns, validColumnIds]
  );

  // Load and sanitize initial state safely from localStorage
  const loadState = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return reconcileSavedColumns(parsed);
        } else {
          // Corrupt non-array data: discard and purge
          console.warn(`[useTableColumnVisibility] Corrupt non-array data for ${storageKey}. Resetting.`);
          localStorage.removeItem(storageKey);
        }
      }
    } catch (e) {
      // Corrupt JSON: catch cleanly, discard, and fall back to defaults
      console.warn(`[useTableColumnVisibility] Failed to parse saved columns for ${storageKey}:`, e);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    return defaultVisibleSet;
  }, [storageKey, defaultVisibleSet, reconcileSavedColumns]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadState);

  // Account Switching & Dynamic Key Isolation:
  // Reactively re-hydrate preferences whenever userId or tableKey changes
  useEffect(() => {
    setVisibleColumns(loadState());
  }, [storageKey, loadState]);

  // Sync sanitized changes to localStorage
  const persistState = useCallback(
    (newSet: Set<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.warn(`[useTableColumnVisibility] Failed to persist columns for ${storageKey}:`, e);
      }
    },
    [storageKey]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      const colDef = columnMap.get(columnId);
      if (!colDef || colDef.isRequired) return; // Invariant: Cannot toggle required columns

      setVisibleColumns((prev) => {
        const next = new Set(prev);
        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }
        // Invariant: Always retain required columns
        columns.forEach((c) => {
          if (c.isRequired) next.add(c.id);
        });
        persistState(next);
        return next;
      });
    },
    [columnMap, columns, persistState]
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumns(defaultVisibleSet);
    persistState(defaultVisibleSet);
  }, [defaultVisibleSet, persistState]);

  const showAllColumns = useCallback(() => {
    const allSet = new Set(columns.map((c) => c.id));
    setVisibleColumns(allSet);
    persistState(allSet);
  }, [columns, persistState]);

  const isVisible = useCallback(
    (columnId: string) => visibleColumns.has(columnId),
    [visibleColumns]
  );

  return {
    visibleColumns,
    isVisible,
    toggleColumn,
    resetToDefaults,
    showAllColumns,
    totalColumnsCount: columns.length,
    visibleCount: visibleColumns.size,
  };
}
```

#### C. Dropdown UI Component: `<TableColumnVisibilityMenu />`
- Placed immediately above the table header adjacent to search filters.
- **Button:**
  - `<Columns size={14} /> Columns (${visibleCount}/${totalCount})`
- **Dropdown Menu:**
  - Checkbox per column with label.
  - Required columns (`isRequired: true`) have checked and disabled checkboxes with a badge: `Locked`.
  - Footer actions:
    - `Reset to Defaults`
    - `Show All`
- **Accessibility:**
  - Keyboard navigable (`Escape` closes menu, `Space` toggles checkbox).
  - ARIA attributes: `aria-expanded`, `aria-haspopup="menu"`, `role="menuitemcheckbox"`.

#### D. Preference Isolation & Resilience Guarantees
1. **User & Table Scoping:** Preferences are keyed by both `userId` and `tableKey` (`fleetflow_tbl_cols_${userId}_${tableKey}`). Different users sharing the same computer or terminal never overwrite each other's views.
2. **Account Switching Reaction:** The `useEffect([storageKey, loadState])` hook monitors the active user identity. When an operator logs out and another user logs in, the component immediately re-hydrates the new user's saved preferences from localStorage.
3. **Unknown Column Purging:** If stored preferences reference column IDs removed in software updates, they are safely stripped during hydration without error.
4. **Corrupt Saved Data Handling:** If saved data in `localStorage` is malformed, non-array, or invalid JSON, it is caught safely, cleared from storage, and restored to `defaultVisibleSet` without crashing the application.
5. **Newly Introduced Column Discovery:** Newly added columns with `isDefaultVisible: true` are automatically merged into existing user views upon upgrade.
6. **Strict Required Column Invariant:** Columns marked `isRequired: true` (e.g. Selection Checkbox, LR Details, Status, Actions) are unconditionally enforced on load, during toggling, and across resets. They cannot be hidden under any condition.

### 5.3 LR Table Column Catalog & Operational Defaults

| Column ID | Column Label | Default Visible | Required? | Operational Rationale |
| :--- | :--- | :---: | :---: | :--- |
| `select` | Selection Checkbox | **Yes** | **Yes** | Critical for multi-LR journey bundling. |
| `lr_details` | LR Details | **Yes** | **Yes** | Primary identifier (`lr_no`, `lr_date`, `bill_no`, trip link). |
| `vehicle_driver` | Vehicle & Driver | **Yes** | No | Immediate operational verification of assigned assets. |
| `route` | Route Corridor | **Yes** | No | Origin and destination corridor (`Mumbai → Ahmedabad`). |
| `parties` | Consignor & Consignee | **Yes** | No | Shipper and receiver party identification. |
| `status` | Status | **Yes** | **Yes** | Consignment lifecycle state (`active`, `invoiced`, `cancelled`). |
| `actions` | Actions | **Yes** | **Yes** | Operational triggers: Create Journey, Print Stationary, Cancel. |
| `branch` | Branch | *No (Hidden)* | No | Redundant in single-branch companies or when filtering by branch. |
| `cargo_weight` | Cargo & Weight | *No (Hidden)* | No | Secondary detail; visible upon expanding or on print preview. |
| `freight_terms` | Freight & Terms | *No (Hidden)* | No | Financial billing details; primarily needed by billing accountants. |

**Result:** Default visible columns reduced from **10 to 7**, dramatically improving scannability, eliminating visual clipping, and optimizing layout for standard desktop viewports.

---

## 6. Implementation Phases & Verification Matrix

### 6.1 Phase Breakdown

#### Phase 1: Data Model & Backend LR Truck/Driver Validation
1. Update `IEntry` interface and `EntrySchema` in `backend/src/models/Entry.ts`:
   - Add `truck_id`, `driver_id`, `driver_name`, `driver_phone`.
   - Maintain schema-level `required: false` to safeguard historical records.
2. Update `createEntry` in `backend/src/controllers/entryController.ts`:
   - Mandate `truck_id` and `driver_id` on new creation requests.
   - Enforce tenant ownership, non-deleted status, and driver non-terminated status.
   - Validate originating trip match if `journey_id` is passed.
   - Authoritatively populate `vehicle_number`, `driver_name`, `driver_phone` from database records.
3. Update `getEntries` in `entryController.ts`:
   - Populate `truck_id` (`truck_no make model body_type`) and `driver_id` (`name phone license_number`).

#### Phase 2: Backend Commercial Journey Derivation & Consistency
1. Update `createJourney` in `backend/src/controllers/journeyController.ts`:
   - When `journey_type === 'commercial'` and `lr_ids.length > 0`:
     - Validate that all LRs have registered `truck_id` and `driver_id`.
     - Validate all LRs share identical `truck_id`. Reject mismatches with `400 TRUCK_MISMATCH`.
     - Validate all LRs share identical `driver_id`. Reject mismatches with `400 DRIVER_MISMATCH`.
     - Auto-derive `journey.truck_id` and `journey.driver_id` if omitted by client.
     - Validate client-provided `truck_id` / `driver_id` against derived values.
2. Preserve direct dispatches for `internal_repositioning` and `maintenance` without requiring LRs.
3. Ensure mid-trip driver handover (`swapDriver`) updates only `journey.driver_id` without corrupting historical LR records.

#### Phase 3: Frontend LR Modal Asset Selectors (`LRListPage.tsx`)
1. In `frontend/src/pages/commercial/LRListPage.tsx`:
   - Add React Query hooks for `availableTrucks` and `activeDrivers`.
   - Replace text inputs with searchable dropdown selectors.
   - Implement default driver auto-selection when a truck is chosen.
   - Bind originating trip inheritance: pre-fill and lock truck/driver when trip is selected.
   - Send `truck_id`, `driver_id`, `vehicle_number`, `driver_name`, `driver_phone` in payload.

#### Phase 4: Frontend Journey UI Asset Inheritance (`NewJourneyPage.tsx`)
1. In `frontend/src/pages/operations/NewJourneyPage.tsx`:
   - When LRs are selected in commercial mode:
     - Automatically populate `truck_id` and `driver_id` from the selected LRs.
     - Display visual badges: `Inherited from Consignments`.
     - Detect mixed-truck or mixed-driver selections and display clear error callouts.
     - Disable submission if an asset conflict exists.

#### Phase 5: Generic Table Column Visibility Infrastructure
1. Create `frontend/src/types/table.ts` and `frontend/src/hooks/useTableColumnVisibility.ts`.
2. Create `frontend/src/components/common/TableColumnVisibilityMenu.tsx`.
3. Integrate into `frontend/src/pages/commercial/LRListPage.tsx`:
   - Define LR table column catalog (7 default visible, 3 optional).
   - Conditionally render `<th>` and `<td>`.
   - Update `colSpan` dynamically for loading and empty state table rows.

---

### 6.2 Automated Test Matrix

```typescript
describe('Mandatory LR Truck/Driver & Journey Consistency Test Suite', () => {
  describe('Requirement 1: Mandatory LR Truck & Driver', () => {
    it('rejects LR creation when truck_id is omitted (HTTP 400 TRUCK_REQUIRED)');
    it('rejects LR creation when driver_id is omitted (HTTP 400 DRIVER_REQUIRED)');
    it('rejects LR creation when truck belongs to another tenant (HTTP 404/403 Anti-IDOR)');
    it('rejects LR creation when driver belongs to another tenant (HTTP 404/403 Anti-IDOR)');
    it('rejects LR creation if selected truck is decommissioned, deleted, or out of service (HTTP 400 TRUCK_INELIGIBLE)');
    it('rejects LR creation if selected driver is terminated or on leave (HTTP 400 DRIVER_ON_LEAVE)');
    it('permits LR booking with advisory warning if truck compliance is expired (COMPLIANCE_EXPIRED warning)');
    it('strictly blocks journey dispatch if truck compliance is expired (HTTP 422 COMPLIANCE_ALERT)');
    it('strictly blocks journey dispatch if truck or driver is already on an active journey (HTTP 409 Conflict)');
    it('rejects LR creation if originating trip truck does not match selected truck (HTTP 400 TRIP_TRUCK_MISMATCH)');
    it('rejects LR creation if originating trip driver does not match selected driver (HTTP 400 TRIP_DRIVER_MISMATCH)');
    it('successfully creates standalone LR and authoritatively writes snapshot strings from master records');
    it('preserves historical LR records lacking truck_id/driver_id during hydration and updates');
  });

  describe('Requirement 2: Journey Inherits Truck & Driver from LRs', () => {
    it('successfully derives journey truck_id and driver_id from single LR without client passing them');
    it('successfully bundles multiple LRs having the same truck and driver');
    it('rejects commercial journey when LRs have different trucks (HTTP 400 TRUCK_MISMATCH)');
    it('rejects commercial journey when LRs have different drivers (HTTP 400 DRIVER_MISMATCH)');
    it('rejects commercial journey bundling historical LRs missing truck/driver reference (HTTP 400 LR_MISSING_ASSET_REFERENCE)');
    it('rejects commercial journey if client supplies truck_id conflicting with LRs (HTTP 400 TRUCK_CONFLICT_WITH_LRS)');
    it('rejects commercial journey if client supplies driver_id conflicting with LRs (HTTP 400 DRIVER_CONFLICT_WITH_LRS)');
    it('allows direct internal repositioning journeys without LRs to pass explicit truck and driver');
    it('swapping driver on active journey updates journey.driver_id and handover history while keeping LR driver intact');
    it('journey cancellation unlinks LRs without mutating original truck/driver snapshots or references');
    it('handles concurrent journey dispatches with atomic transaction rollback on conflicting LRs (HTTP 409)');
  });

  describe('Requirement 3: Table Column Visibility', () => {
    it('initializes LR table with 7 default operational columns visible');
    it('scopes column visibility preferences strictly by userId and tableKey in localStorage');
    it('reactively switches visible column preferences when userId changes on account switching');
    it('prevents hiding required columns (select, lr_details, status, actions)');
    it('safely purges unknown or deprecated column IDs from saved localStorage preferences');
    it('automatically discovers and includes newly introduced default-visible columns for existing users');
    it('gracefully handles missing, corrupted, or non-array localStorage preferences by resetting to defaults');
    it('restores default columns when reset button is clicked');
  });
});
```

---

## 7. Open Product Questions & Decision Log

During our technical inspection, we identified four operational nuances that warrant explicit product owner alignment:

| ID | Operational Question | Recommended Architectural Approach | Impact / Trade-off |
| :--- | :--- | :--- | :--- |
| **Q1** | **Truck Compliance Expiry at LR Issuance vs. Dispatch:** Should an expired truck certificate block LR creation, or only block Journey Dispatch? | **Two-Stage Enforcement Model:** Decommissioned, deleted, or ineligible trucks are **strictly rejected at booking** (`HTTP 400 TRUCK_INELIGIBLE`). Expired compliance generates an **advisory warning** at LR creation, permitting advance booking. Physical dispatch strictly enforces statutory compliance (`HTTP 422`) and live availability (`HTTP 409`). | Prevents booking invalid or scrapped assets while allowing advance consignment booking during certificate renewals. |
| **Q2** | **Multi-Driver Long-Haul Trips (Co-Drivers):** Some heavy interstate routes deploy two drivers (primary + co-driver). Should the initial implementation enforce strictly one driver across all LRs? | **Yes, enforce single driver initially.** As specified in Requirement 2.3, enforce identical single `driver_id` across all LRs. Co-driver tracking can be modeled in a subsequent phase via a secondary `co_driver_id` field on `TruckJourney`. | Simplifies consistency validation while fulfilling 95% of standard commercial dispatches. |
| **Q3** | **Historical LRs without Truck/Driver References & Cancellation:** How should the system handle legacy LRs if bundled into journeys, and what happens upon cancellation? | **Mandatory Reference Assignment Before Dispatch & Immutable Snapshots:** Legacy LRs lacking master references cannot be dispatched on commercial journeys until an operator explicitly assigns a registered Truck and Driver (`HTTP 400 LR_MISSING_ASSET_REFERENCE`). Cancelling a journey unlinks LRs (`journey_id = null`) without rewriting or wiping original issuance snapshots. Mid-trip driver swaps update the journey handover history without mutating LR carrier details. | Preserves legal document non-repudiation and prevents orphaned or unreferenced assets on commercial dispatches. |
| **Q4** | **Transshipment / Hub Consolidation (Cross-Docking):** If consignments are moved in feeder trucks (e.g. Surat to Mumbai Hub) and then consolidated into a long-haul trailer (Mumbai to Bangalore), does changing the truck require an administrative LR update or journey reassignment? | **Commercial Journey creation binds the active line-haul vehicle.** In future cross-docking workflows, an administrative multi-leg consignment transfer will be supported. For the current single-journey phase, the LR's assigned vehicle must match the line-haul journey vehicle. | Maintains strict 1-to-1 asset alignment without premature complexity. |
