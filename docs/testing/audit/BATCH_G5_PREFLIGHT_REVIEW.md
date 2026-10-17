# Fleet Flow — Batch G Phase G5 Preflight Review
**Phase:** G5 — Branch Listing UI Containment and Actions  
**Issue:** `FF-ISSUE-052` — Regional Branch Listing UI Lacks Card Containment and Action Buttons  
**Target File:** [`frontend/src/pages/settings/BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx)  
**Mode:** Documentation Only (No Implementation Authorized)  
**Date:** 2026-10-17  

---

## 1. Canonical Acceptance Criteria & Exact Scope

### 1.1 Source Issue Document ([`FF-ISSUE-052`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md))
The authoritative acceptance criteria specified in `FF-ISSUE-052` are:
1. **Card / Container Structure:** Regional branches are rendered in clean, structured cards adhering to design system tokens (replacing uncontained floating text).
2. **Action Triggers:** Each branch displays explicit action triggers:
   - **Edit Branch:** Pre-populated edit modal allowing updating branch name, code, contact, prefixes, and head office status.
   - **Activate / Deactivate:** Toggle button to activate or deactivate branch operations (with Head Office protection).
   - **Guarded Deletion:** Delete button with confirmation, displaying a helpful error message if referenced by historical records.
3. **Search & Status Filtering:** Search input and status filter tabs (`All`, `Active`, `Inactive`) for navigating multi-branch workspaces.

### 1.2 Boundary & DEC-010 Preservation
- **Company Workspace Isolation:** Preserves DEC-010 principle that the workspace is a company subscription; branches are operational depots.
- **Resource Pooling:** Trucks and drivers remain pooled company-wide and are never restricted to single branches.
- **Head Office Safeguard:** Protects the Head Office from deactivation or deletion in the UI, matching backend validations.
- **Strict Isolation:** Does NOT implement Phase G6 (dispatch/LR dropdowns), Support Inbox (`FF-ISSUE-022`), Incognito session testing (`FF-ISSUE-058`), or Batch H UI polish.

---

## 2. Current UI Structure & Defect Evidence

Inspection of [`BranchManagementPage.tsx:305-375`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx#L305-L375) reveals the following concrete layout and functional gaps:

### 2.1 Missing Action Triggers
```tsx
{/* Current branch card rendering */}
<div key={branch._id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', ... }}>
  {/* Header with building icon, branch name, branch code */}
  {/* Body with city, state, phone, LR prefix, INV prefix */}
  {/* ZERO BUTTONS OR ACTION CONTROLS */}
</div>
```
- **Evidence:** Once a branch is created, there is no way for a company administrator to edit its contact details, change prefixes, deactivate it, or delete it from the UI.

### 2.2 Uncontained / Inline Styling
- **Evidence:** The cards use ad-hoc inline styles (`borderRadius: 'var(--radius-xl)'`, `padding: '1.25rem'`) rather than the project's standard `.card` class with structured `.card-header`, `.card-body`, and `.card-footer`.
- There is no status badge distinguishing active versus inactive branches (only a `HEAD OFFICE` tag is rendered if `is_head_office: true`).

### 2.3 Absence of Search and Status Filtering
- **Evidence:** The page directly renders `branches.map(...)` without any search input or status filter. For companies with multiple branches across regions (e.g., Delhi, Mumbai, Kolkata, Chennai), locating a specific branch requires visually scanning every card.

---

## 3. Minimal Proposed Changes

All proposed changes for Phase G5 are contained within [`frontend/src/pages/settings/BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx):

### 3.1 Search & Filter Toolbar
Add a clean control bar above the branch grid:
- **Search Input:** Wrapped in `.search-input-wrapper` with a `Search` icon from `lucide-react`, filtering client-side by `branch_name`, `branch_code`, `city`, or `state`.
- **Status Filter Pills:** Tabs for `All`, `Active`, and `Inactive`, allowing quick operational filtering.
- **Branch Counter:** Displays total matching branches (e.g., "Showing 4 of 4 branches").

### 3.2 Refactored Branch Card Layout
Wrap each branch in a standard `.card` with design token styling:
- **Card Header (`.card-header`):**
  - Branch icon (`Building2`) and branch name.
  - Badges:
    - Status badge: `.badge .badge-success` ("Active") or `.badge .badge-neutral` ("Inactive").
    - Head Office badge: `.badge .badge-info` ("Head Office").
  - Branch Code badge (e.g. `BHW`).
- **Card Body (`.card-body`):**
  - City & State with `MapPin` icon.
  - Phone with `Phone` icon.
  - State GSTIN with `FileText` icon (if configured).
  - Configured Prefixes: `Tag` badges showing `LR: ${lr_prefix}` and `INV: ${invoice_prefix}`.
- **Card Footer (`.card-footer`):**
  - **Edit Button:** `.btn .btn-sm .btn-outline` (`Pencil` icon) to launch the Edit Modal.
  - **Toggle Status Button:** `.btn .btn-sm .btn-secondary` (`Power` or `CheckCircle` icon) to toggle `is_active` via `PUT /api/company/branches/:id`. If Head Office, disabled with hint "Head Office cannot be deactivated".
  - **Delete Button:** `.btn .btn-sm .btn-danger` (`Trash2` icon) to prompt confirmation and call `DELETE /api/company/branches/:id`. If Head Office, disabled. If deletion fails due to existing records (HTTP 409), displays the server's descriptive message advising deactivation instead.

### 3.3 Edit Branch Modal
Reuse [`frontend/src/components/common/Modal.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/Modal.tsx):
- Title: "Edit Regional Branch"
- Body: Form fields pre-populated with `branch_name`, `branch_code`, `city`, `state`, `phone`, `gstin`, `lr_prefix`, `invoice_prefix`, and `is_head_office`.
- Footer: Cancel and "Save Changes" (`.btn .btn-primary`).
- Submission: Calls `PUT /api/company/branches/:id`. On success, updates local state and shows success toast.

### 3.4 Delete Confirmation Dialog
A structured modal or confirmation dialog preventing accidental clicks:
- Explains that active operational records (trips, LRs, invoices) prevent deletion.
- On HTTP 409 (`CANNOT_DELETE_BRANCH_WITH_RECORDS`), displays the friendly guidance:
  *"Cannot delete branch because operational records exist. Please deactivate the branch instead to preserve historical accounting and audit records."*

---

## 4. Existing Backend Contracts & Permission Safeguards

All required backend APIs were hardened and verified in Phase G2 and are ready for UI consumption:

| Action | HTTP Endpoint | Required Role | Backend Guards Already In Place |
| :--- | :--- | :--- | :--- |
| **List Branches** | `GET /api/company/branches` | Any authenticated member | Scoped to tenant (`company_id`). |
| **Update Branch** | `PUT /api/company/branches/:id` | `admin` | Whitelists editable fields; unique `branch_code` check; blocks deactivating Head Office (`400`); automatically demotes previous Head Office if promoting another. |
| **Delete Branch** | `DELETE /api/company/branches/:id` | `admin` | Blocks deleting Head Office (`400`); referential integrity check blocks deletion if referenced by `TruckJourney`, `Entry`, or `Invoice` (`409 CANNOT_DELETE_BRANCH_WITH_RECORDS`). |

---

## 5. Verification Plan

1. **Frontend Build & Compilation Check:**
   ```powershell
   npm --prefix frontend run build
   ```
   Must exit with code 0 (`tsc -b && vite build` clean).
2. **Backend Regression Verification:**
   ```powershell
   npm --prefix backend run test -- src/tests/integration/phase7BatchG2ControllerAndNumbering.test.ts
   ```
   Ensures update, deactivation, and referential integrity delete tests continue to pass.
3. **Interactive & Ergonomic Verification:**
   - Verify search filters cards dynamically by name, code, or city.
   - Verify status filter tabs accurately segment active vs inactive branches.
   - Verify clicking "Edit" opens modal with populated data and saves correctly.
   - Verify clicking "Deactivate" updates status badge immediately.
   - Verify Head Office branch disable states on deactivation and deletion.
   - Verify attempting to delete a branch with operational records renders the HTTP 409 error toast cleanly.

---

## 6. Regression Risks & Safeguards

| Risk | Mitigation |
| :--- | :--- |
| **Accidental Head Office Deactivation:** | UI disables deactivation button if `branch.is_head_office`, matching the backend HTTP 400 safeguard. |
| **Accidental Deletion of Branched Data:** | Backend referential integrity check (`CANNOT_DELETE_BRANCH_WITH_RECORDS`) prevents deleting referenced branches; UI handles 409 gracefully. |
| **State Desynchronization:** | On edit, deactivation, or deletion, `fetchBranches()` or optimistic state updates ensure the UI immediately reflects current database state. |
| **Unintended Scope Creep:** | No changes to dispatch forms, LR forms, commercial reports, backend models, or excluded workstreams. |

---

## 7. Safety & Git State Confirmation

- **Preflight Only:** This document is purely analytical and architectural planning.
- **Zero Modifications:** No application source code, test files, or issue statuses were modified during this turn.
- **Git State:** Working tree remains clean and fully preserved.
- **Stop Condition:** Awaiting explicit user authorization before starting Phase G5 implementation.
