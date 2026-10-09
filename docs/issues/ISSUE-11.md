# Issue 11 — Finish Configurable Company Features

## Metadata
- **Severity**: P1 (High)
- **Status**: Documented & Ready for Implementation
- **Category**: Enterprise Customization, Multi-Branch, Approval Workflows & Granular RBAC
- **Date**: October 10, 2026

---

## 1. Problem Statement
Several advanced modules listed in the Fleet Flow feature catalog (`MOD_CATALOG`) were defined as catalog entities rather than fully implemented enterprise features:
1. **Missing Configurable Approval Workflows (`MOD_WORKFLOW_APPROVALS`)**: High-value financial operations (e.g. large cash advances to drivers, driver trip settlements exceeding standard caps, freight invoice credit write-offs) are executed immediately without multi-step authorization thresholds, escalation timeouts, or approval audit trails.
2. **Missing Multi-Branch & Regional Hub Architecture (`MOD_MULTI_BRANCH`)**: Transport enterprises operating regional hubs (e.g. Mumbai, Delhi, Bengaluru) have no way to isolate dispatch manifests, restrict branch users to local dispatches, apply branch-specific numbering sequences (`MUM-LR-001`, `DEL-LR-001`), or compare regional branch profitability.
3. **Partial Custom Fields Integration (`MOD_CUSTOM_FIELDS`)**: While custom fields can be defined in the Custom Fields Studio, server-side payload validation against field types (`text`, `number`, `date`, `dropdown`, `regex`, `required`) is not enforced across Truck, Driver, LR, and Invoice creation controllers.
4. **Coarse Role Granularity**: The authorization model relies on 4 broad static roles (`admin`, `dispatcher`, `accountant`, `viewer`). Large enterprises cannot configure fine-grained permission matrices (e.g. allow a user to create LRs but forbid them from viewing invoice freight rates).
5. **No Tiered Report Suite (`MOD_REPORTS`)**: Operational and financial reports are not formally structured into subscription-tiered packages.
6. **No Automated Plan-to-Feature Test Matrix**: There is no automated test proving that each subscription tier correctly gates and allows its exact designated feature catalog set.

---

## 2. Root Cause Analysis (RCA)
- **Catalog vs Execution Gap**: Modules like `MOD_WORKFLOW_APPROVALS`, `MOD_MULTI_BRANCH`, and `MOD_TALLY_SYNC` were categorized for Pro and Enterprise tiers during catalog design, with implementation deferred to Phase 5 hardening.
- **Hardcoded Role Array**: Authorization relied on `requireRole(['admin'])` checks rather than querying a granular permissions bitmask or array on `CompanyMember`.

---

## 3. Implementation Solution & Target Architecture

### A. Configurable Approval Workflow Builder (`ApprovalRule.ts`)
- Schema:
  - `company_id`, `entity_type` (`settlement`, `driver_advance`, `credit_note`, `invoice_void`), `threshold_amount_paise`, `required_approver_roles` (`['admin']` or specific user IDs), `escalation_timeout_hours`.
- Engine in `approvalEngine.ts`:
  - When an operation exceeds the configured threshold (e.g. Driver Settlement > ₹25,000):
    - Pauses execution and transitions entity status to `pending_approval`.
    - Generates an `ApprovalRequest` record with requester details, timestamp, and audit history.
    - Sends urgent in-app and WhatsApp notification to designated approver.
  - Upon approval, transaction resumes atomically; upon rejection, requester is notified with the rejection reason.

### B. Multi-Branch Hub Management (`Branch.ts`)
- Schema:
  - `company_id`, `branch_name`, `branch_code` (e.g. `MUM`, `DEL`), `gstin` (optional state GSTIN), `address`, `phone`, `lr_prefix`, `invoice_prefix`, `is_active`.
- Scoping & Permissions:
  - Add `branch_ids: Types.ObjectId[]` to `CompanyMember`.
  - Dispatchers assigned to `MUM` can only view, create, and dispatch trips originated from or terminating in Mumbai.
  - Automatically prefixes consignment numbers: `${branch.lr_prefix || 'LR'}-${counter}`.
  - Branch P&L Report: Segregated income, fuel, driver expense, and margin by branch.

### C. Server-Enforced Custom Field Validation
- In `customFieldValidator.ts`:
  - Intercepts creation/updates for `Truck`, `Driver`, `Entry` (LR), `Invoice`, and `Party`.
  - Validates `req.body.custom_fields`:
    - Checks mandatory fields (`is_required === true`).
    - Enforces numeric minimums, maximums, and regex patterns.
    - Restricts dropdown choices to pre-approved option lists.

### D. Fine-Grained Permission Matrix
- Replace broad role constraints with granular permission tokens:
  - Fleet: `fleet:read`, `fleet:create`, `fleet:update`, `fleet:delete`, `fleet:assign_driver`
  - Operations: `trip:read`, `trip:dispatch`, `trip:advance`, `trip:complete`
  - Commercial: `lr:read`, `lr:create`, `lr:rate_override`, `invoice:generate`, `invoice:record_payment`
  - Accounting: `settlement:create`, `settlement:approve`, `ledger:view`, `ledger:manual_entry`
- Middleware `requirePermission(perm: PermissionString)`:
  - Validates against member's role defaults or custom role overrides.

### E. Tiered Report Suite by Plan
Formalize the report catalog:
- **Starter Tier**: Basic Operational Summary (Fleet status, Active Drivers, Monthly Trip Count).
- **Standard Tier**: Core Commercial Registers (LR Consignment Register, Customer Invoicing Register, Driver Advance Log).
- **Pro Tier**: Financial & Efficiency Intelligence (Trip Profitability Margin, Diesel Consumption Variance, Fuel Pump Statement, Tally Export).
- **Enterprise Tier**: Executive Multi-Branch P&L, Customer DSO Aging Matrix, Fleet IQ Telematics Risk Profiling.

### F. Automated Plan-to-Feature Entitlement Test Matrix
- Create `backend/src/scripts/verifyPlanFeatureMatrix.ts`:
  - Spawns tenants on Starter, Standard, Pro, and Enterprise tiers.
  - Systematically calls each of the 20 catalog API routes.
  - Verifies that Starter is blocked from LRs and Invoices with 403 `FEATURE_LOCKED`, Standard is blocked from Custom Fields and Approvals, and Enterprise has 100% access.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/ApprovalRule.ts` | Schema for threshold-based multi-step approval workflows |
| `backend/src/models/ApprovalRequest.ts` | Itemized approval requests, audit trail, and escalation logs |
| `backend/src/models/Branch.ts` | Schema for regional branch hubs, state GSTINs, and local numbering prefixes |
| `backend/src/utils/approvalEngine.ts` | Threshold evaluation and execution resumption engine |
| `backend/src/utils/customFieldValidator.ts` | Server-side validation for custom attributes across all entities |
| `backend/src/middleware/permissionMiddleware.ts` | Fine-grained permission matrix evaluator |
| `backend/src/controllers/branchController.ts` | CRUD and user assignment for regional branches |
| `backend/src/routes/branchRoutes.ts` | Mount `/api/company/branches` protected by `requireFeature('MOD_MULTI_BRANCH')` |
| `backend/src/controllers/approvalController.ts` | Workflow builder endpoints and pending approvals inbox |
| `frontend/src/pages/settings/ApprovalWorkflowPage.tsx` | UI workflow builder with threshold sliders and approver selector |
| `frontend/src/pages/settings/BranchManagementPage.tsx` | Regional branch directory and prefix configuration studio |
| `backend/src/scripts/verifyPlanFeatureMatrix.ts` | Automated plan-to-feature matrix verification suite |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Configuring an Approval Rule & Testing the Approvals Inbox
1. **Create an Approval Workflow Rule**:
   - Log in as Company Owner at `http://localhost:5173/login`.
   - In the sidebar, click **Settings** -> **Approval Workflows** (`/settings/approvals`).
   - Click **"+ Create Approval Rule"**.
   - Entity: `Driver Settlements`.
   - Condition: `Payout Amount Greater Than (>) ₹20,000`.
   - Designated Approver: `Company Owner / Finance Head`.
   - Click **"Save Workflow"**.
2. **Submit a Settlement Exceeding the Threshold**:
   - In an incognito tab, log in as an Accountant or Dispatcher.
   - Go to **Driver Settlements** (`/financials/settlements`), click **"+ New Settlement"**, and enter a net payable of `₹25,000`.
   - Click **"Submit for Settlement"**.
3. **What You Should See on the Screen**:
   - The settlement is not marked paid immediately. It displays status:  
     > ⏳ `PENDING APPROVAL` (Amber badge)
   - Log back into the Company Owner account:
     - A notification pill in the top header indicates: *"1 Pending Approval Request"*.
     - Navigate to **Pending Approvals** (`/approvals`).
     - Click **"Approve Request"** with optional remark: *"Approved after fuel slip audit"*.
   - The settlement flips to `APPROVED` and automatically posts to the ledger.

---

### Test 2: Configuring Regional Branches & Unique LR Series
1. **Set Up a Regional Branch**:
   - In the sidebar, navigate to **Settings** -> **Branches & Hubs** (`/settings/branches`).
   - Click **"+ Add Regional Branch"**.
   - Branch Name: `Bhiwandi Central Logistics Hub`.
   - State: `Maharashtra (27)`.
   - Dedicated LR Prefix: `BHW-`.
   - Dedicated Invoice Prefix: `INV-BHW-`.
   - Click **"Save Branch"**.
2. **Create Consignment Under That Branch**:
   - Go to **Consignments** (`/consignments`) -> **"+ New Consignment"**.
   - In the "Dispatching Branch" dropdown, select `Bhiwandi Central Logistics Hub`.
   - Click **"Generate LR"**.
3. **What You Should See on the Screen**:
   - The auto-generated consignment number appears strictly with the custom branch prefix:  
     `BHW-2026-0001`.
   - Navigating to Reports allows filtering revenue and tonnage specifically by the Bhiwandi Branch.

---

### Test 3: Testing Fine-Grained Permissions (Hiding Freight Rates)
1. **Configure Role Permissions**:
   - Go to **Settings** -> **Roles & Permissions** (`/settings/roles`).
   - Select the `Field Dispatcher` role.
   - Uncheck the toggle: **"View Freight Rates & Invoices"**.
   - Keep checked: **"Create Consignments & Manage Fleet"**.
   - Click **"Save Role Matrix"**.
2. **Verify Field Dispatcher View**:
   - Log in with a user assigned the `Field Dispatcher` role.
3. **What You Should See on the Screen**:
   - The **Invoices** and **Financial Ledger** links disappear completely from the sidebar.
   - When viewing the LR Table (`/consignments`), the "Freight Rate" and "Advance" columns are masked:  
     > `🔒 Rate Restricted`
   - Dispatchers can record physical cargo and vehicle movement without exposing company financials.

