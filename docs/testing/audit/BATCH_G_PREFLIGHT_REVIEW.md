# Fleet Flow — Batch G Preflight Review: Regional Branches, Hubs & Operational Numbering

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `BATCH-G` (Preflight Review & Architectural Plan)  
**Target Architecture:** Multi-Location Regional Branches, Document Prefixing (LR & Invoices), Trip Dispatch Association, Branch Filtering, RBAC Operational Scoping  
**Authoritative Source Register:** [`docs/testing/ISSUE_INDEX.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/ISSUE_INDEX.md#L254-L258) (Lines 254–258)  
**Execution Posture:** **STRICTLY READ-ONLY TECHNICAL PREFLIGHT. No application code, schemas, tests, or configurations modified.**  
**Auditor / Governance Authority:** Antigravity Advanced Agentic AI (Pair-Programming Preflight Inspection)  
**Baseline Git Commit:** [`228b3c9`](https://github.com/Vishal-8630/Fleet-Flow/commit/228b3c9) (`fix(webhooks): add concurrent webhook test and harden deduplication`) on branch `main`  
**Current Working-Tree Status:** Clean (`nothing to commit, working tree clean`)  
**Preflight Recommendation:** **`ACCEPT` (Decision Aligned with Product Owner & Ready for Implementation Authorization Gate)**  

---

## 1. Executive Summary & Purpose

Following the successful implementation, dual-hardening audit, test suite verification (129/129 integration tests passing across 8 suites), production build validation, and Git push of **Batch F (F1–F4 + Follow-ups)**, this document establishes the authoritative, documentation-only preflight review for **Batch G: Regional Branches, Hubs & Operational Numbering**.

### 1.1 Core Objectives
1. **Establish Authoritative Scope:** Lock the canonical scope for Batch G to [`FF-ISSUE-051`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-051-branch-creation-form-ui.md), [`FF-ISSUE-052`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md), [`FF-ISSUE-053`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-053-branch-hub-operational-integration.md), [`DEC-010`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-010-branches-hubs-operational-model.md), and [`QST-012`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-012-branch-operational-integration-depth.md).
2. **Forensic Codebase Audit:** Inspect existing backend models ([`Branch.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Branch.ts), [`TruckJourney.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts), [`Entry.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Entry.ts), [`Invoice.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Invoice.ts), [`CompanyMember.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/CompanyMember.ts)), controllers, routes, and frontend pages ([`BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx), [`NewJourneyPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/NewJourneyPage.tsx), [`LRListPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/LRListPage.tsx), [`InvoiceListPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/InvoiceListPage.tsx)) to establish exact differences between current behavior and required behavior.
3. **Preserve Agreed DEC-010 Principles:** Uphold core architectural decisions: Workspace = Company; Branch = Operational Location; Trips record originating branch; Branches support distinct document prefixes; Single-branch operators receive frictionless auto-defaulting; Staff branch restrictions remain flexible without rigid siloing; Hub-and-spoke transshipment routing remains deferred.
4. **Clarify Concrete Implementation Specifications:** Detail independent branch sequence counters vs. company fallbacks, dispatcher scoping with company-wide asset visibility, single-branch auto-defaulting, referential-integrity deletion guards, safe backward compatibility, and comprehensive acceptance test criteria.
5. **Implementation & Test Blueprint:** Construct a phased, risk-mitigated implementation plan with automated verification tests and explicit approval gates without modifying any application code or Git state.

---

## 2. Scope & Canonical Governance Register

### 2.1 In-Scope Canonical Items

Per [`docs/testing/ISSUE_INDEX.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/ISSUE_INDEX.md#L254-L258) Section 7 (Batch G), the authoritative scope consists strictly of:

| Identifier | Type | Canonical Title | Priority | Current Status | Primary Source File(s) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[`FF-ISSUE-051`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-051-branch-creation-form-ui.md)** | UI-UX | Regional Branch Creation Form Excessive Whitespace and Input Boundary Distortion | `Medium` | Observed | [`BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx#L108-L149) |
| **[`FF-ISSUE-052`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md)** | UI-UX | Regional Branch Listing UI Lacks Card Containment and Action Buttons | `Medium` | Observed | [`BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx#L154-L224) |
| **[`FF-ISSUE-053`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/branches-hubs/FF-ISSUE-053-branch-hub-operational-integration.md)** | Workflow / Architecture | Branches & Hubs Operational Integration Missing (Trips, Sequences, Staff Scope) | `High` | Agreed Future Behavior / Not Implemented | [`TruckJourney.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts), [`Entry.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Entry.ts), [`Invoice.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Invoice.ts), [`journeyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/journeyController.ts), [`entryController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/entryController.ts) |
| **[`DEC-010`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-010-branches-hubs-operational-model.md)** | Decision Record | Branches and Regional Hubs Organizational and Operational Model | Approved Policy | `Agreed` | Governs operational branch taxonomy within tenant |
| **[`QST-012`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-012-branch-operational-integration-depth.md)** | Unresolved Question | Branch Integration Depth with Trips, Numbering, Reporting, and Permissions | `Medium` | Investigation Required | Cross-service audit across backend models, controllers, and auth middleware |

### 2.2 Explicit Exclusions from Batch G

To preserve repository safety and adhere to mandatory testing sequences:
1. **Support Inbox Exclusion:** `FF-ISSUE-022` ("Absence of Central Platform-Wide Support Inbox") and `QST-004` ("Platform-Wide Support Inbox Existence and Shared Ticket Synchronization") remain **STRICTLY EXCLUDED** from Batch G.
2. **Incognito Authentication Retest Exclusion:** `FF-ISSUE-058` and `QST-014` ("Intermittent Incognito Session Data Blanking and Immediate Logout on Refresh") are **STRICTLY EXCLUDED** and must be performed **LAST** after all application batches are complete.
3. **General UI/UX Form Consistency (Batch H):** General marketing landing pages, button padding, and numeric input trapping on settlements (`FF-ISSUE-001`, `FF-ISSUE-003` to `FF-ISSUE-016`, `FF-ISSUE-046`, etc.) are assigned to Batch H. Only branch-specific UI pages (`BranchManagementPage.tsx` and branch selectors in trip/LR creation) are touched by Batch G.

---

## 3. Git Working Tree & Baseline Verification

A strict read-only audit of the Git status was conducted prior to preparing this report:

```bash
$ git status
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

- **Branch:** `main`
- **Head Commit:** `228b3c9` (`fix(webhooks): add concurrent webhook test and harden deduplication`)
- **Working Tree:** 100% clean. No modified, staged, or untracked files.
- **Background Processes:** Dev server actively running on `http://localhost:5173` and `http://localhost:5000`.
- **Preservation Invariant:** No application code, schemas, routes, configuration files, or tests have been created or modified during this preflight step.

---

## 4. Forensic Inspection of Current Codebase

### 4.1 `FF-ISSUE-051`: Regional Branch Creation Form UI & Distortion

#### Current Implementation Analysis
In [`frontend/src/pages/settings/BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx#L108-L149):
- The creation form is conditionally displayed when `showForm === true`.
- **Layout Defect:** The input fields are laid out via inline styles: `display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem'`. On standard desktop monitors, this spreads 8 diverse fields across three wide columns, creating unnatural horizontal stretching and awkward empty gaps in the third row.
- **Visual Boundary Defect:** Inputs use `border: '1px solid var(--border-default)'` with `background: 'var(--bg-input)'` without clear focus outlines, helper text, or fieldset categorization. They look like faint, uncontained text lines.
- **Action Button Placement:** The Save and Cancel buttons are rendered in a raw `flex` container below the inputs without right-alignment or clear visual hierarchy.

#### Required Behavior
- Refactor the form container into a structured, bounded modal or card container (`max-w-3xl mx-auto` or standard modal dialog).
- Organize inputs into logical sections:
  1. **Branch Identity:** Branch Name (`branch_name`), Unique Branch Code (`branch_code`), Head Office toggle (`is_head_office`).
  2. **Physical Location & Contact:** City (`city`), State (`state`), State Code (`state_code`), Phone (`phone`), Address (`address`).
  3. **Statutory & Operational Sequences:** State GSTIN (`gstin`), LR Prefix (`lr_prefix`), Invoice Prefix (`invoice_prefix`).
- Provide clear helper text (e.g., "Default prefix for all LRs dispatched from this hub: e.g. BHW-LR-").
- Provide standardized buttons with primary/secondary hierarchy and loading spinner state during submission.

---

### 4.2 `FF-ISSUE-052`: Regional Branch Listing UI, Card Containment & Action Buttons

#### Current Implementation Analysis
In [`frontend/src/pages/settings/BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx#L154-L224):
- Branches are mapped in a CSS grid (`gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))'`).
- **Missing Actions Defect:** While cards display basic metadata (name, code, phone, city, prefixes, and head office tag), there are **ZERO action buttons**. There is no "Edit Branch", no "Deactivate Branch", and no "Delete Branch".
- **Administrative Impossibility:** Once an administrator creates a regional branch, it cannot be edited or renamed through the user interface. Misconfigured prefixes or typos cannot be corrected without direct database intervention.
- **Missing Filtration Defect:** For transport enterprises with 10+ branches, there is no search input, state filter, or active/inactive toggle.

#### Required Behavior
- Each branch card (or data table row) must feature an explicit actions menu or button group:
  - **Edit Branch:** Opens pre-filled edit modal allowing update of name, contact, address, prefixes, and GSTIN.
  - **Deactivate / Activate:** Toggle active operational status. Inactive branches cannot be selected for new dispatches but retain historical integrity.
  - **Delete Branch:** Available only if the branch has zero associated trips, LRs, and invoices, and is NOT marked as Head Office.
- Display operational summary statistics per branch where available (e.g. Active Trips, Configured Prefix).
- Provide search-by-name/code and status filter controls (`All`, `Active`, `Inactive`).

---

### 4.3 `FF-ISSUE-053`: Operational Integration Missing (Trips, Sequences, Staff Scope)

#### Current Implementation Analysis

1. **`TruckJourney` Model Inspection:**
   - In [`backend/src/models/TruckJourney.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/TruckJourney.ts), there is **no `branch_id` field**.
   - In [`backend/src/controllers/journeyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/journeyController.ts#L207-L390), `createJourney` accepts truck, driver, billing party, origin, and destination, but does not accept or validate `branch_id`.
   - Trip numbering (line 356) uses `company.counters.journey_seq` and hardcoded prefix `JRN-${String(seq).padStart(4, '0')}`.

2. **`Entry` (Lorry Receipt) Model Inspection:**
   - In [`backend/src/models/Entry.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Entry.ts), there is **no `branch_id` field**.
   - In [`backend/src/controllers/entryController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/entryController.ts#L211-L225):
     ```typescript
     const company = await Company.findById(companyId);
     const lrPrefix = company?.settings?.lr_prefix || 'LR-';
     const updatedCompany = await Company.findByIdAndUpdate(
       companyId,
       { $inc: { 'counters.lr_seq': 1 } },
       { new: true, upsert: false }
     );
     const seq = updatedCompany?.counters?.lr_seq || 1;
     lr_no = `${lrPrefix}${String(seq).padStart(4, '0')}`;
     ```
     LR generation strictly pulls the global company prefix and increments `company.counters.lr_seq`, completely ignoring branch settings even if the user operates multiple regional hubs.

3. **`Invoice` Model Inspection:**
   - In [`backend/src/models/Invoice.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/Invoice.ts), there is **no `branch_id` field**.
   - In [`backend/src/controllers/invoiceController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/invoiceController.ts#L182-L190):
     ```typescript
     const invoicePrefix = company?.settings?.invoice_prefix || 'INV-';
     const updatedCompany = await Company.findByIdAndUpdate(
       companyId,
       { $inc: { 'counters.invoice_seq': 1 } },
       { new: true, upsert: false }
     );
     const seq = updatedCompany?.counters?.invoice_seq || 1;
     const invoice_number = `${invoicePrefix}${String(seq).padStart(4, '0')}`;
     ```
     Invoice numbers are strictly company-global.

4. **Frontend Form Disconnect:**
   - In [`NewJourneyPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/NewJourneyPage.tsx), there is no Branch dropdown or field.
   - In [`LRListPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/LRListPage.tsx), manual or auto-generated LR creation has no branch context.

#### Required Behavior
- Add `branch_id` (foreign key to `Branch`, indexed) as an optional reference on `TruckJourney`, `Entry`, and `Invoice`.
- During trip and LR creation:
  - If a company has **exactly 1 active branch** (or only a head office), the system must **automatically default and bind `branch_id`** with zero user friction.
  - If a company has **multiple active branches**, the UI must render an intuitive Branch Selector, pre-selected to the user's assigned branch or the Head Office.
- Apply branch-configured prefixes (`Branch.lr_prefix` and `Branch.invoice_prefix`) and independent branch sequence counters when documents are issued under that branch.

---

### 4.4 `DEC-010`: Architectural Review of Branch/Hub Organizational Model

#### DEC-010 Status: `Agreed`

[`DEC-010`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/decisions/DEC-010-branches-hubs-operational-model.md) establishes six foundational principles:
1. **Workspace = Company:** The workspace is the top-level tenant and billing context. Branches do NOT represent separate SaaS tenants or billing accounts.
2. **Branch = Operational Location:** A branch is an operational regional depot/office within the company. It is NOT a separate legal entity by default.
3. **Trip Responsibility:** Every trip dispatch records the responsible originating branch (`branch_id`).
4. **Document Numbering:** Branches support branch-specific document numbering sequences (LR prefix, invoice prefix) where configured.
5. **Single-Branch Default:** Single-branch operators experience zero workflow overhead; their primary location is auto-selected everywhere.
6. **Hub Distinction:** Physical transshipment/sorting terminals ("Hubs") are distinct from administrative branch offices. Complex multi-leg routing (hub-to-hub) is deferred to future phases; for Batch G, `Branch` serves as the operational dispatch and document location.

#### Consequences and Implementation Demands
- Schema models must maintain `company_id` as the root tenant partition, with `branch_id` as an internal operational partition.
- Vehicles (`Truck`) and drivers (`Driver`) remain company-wide shared assets to prevent operational fragmentation.
- Reports and dashboards must allow consolidating company-wide or slicing by individual branch.

---

### 4.5 `QST-012`: Resolution & Evidence on Branch Integration Depth

[`QST-012`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/unresolved-questions/QST-012-branch-operational-integration-depth.md) asked:
> *"To what extent does regional branch data currently connect to trip dispatch, LR/invoice numbering sequences, financial reporting, and user permission boundaries?"*

#### Direct Audit Evidence & Definitive Resolution:
1. **Foreign Key Attachment:** Currently **0% integrated**. Neither `TruckJourney`, `Entry`, `Invoice`, `Truck`, nor `Driver` contain a `branch_id` attribute.
2. **Document Numbering Sequences:** Currently **0% integrated**. `entryController.ts` and `invoiceController.ts` only check `Company.settings.lr_prefix` and `Company.counters.lr_seq`. `Branch.lr_prefix` and `Branch.invoice_prefix` are stored in the database but completely unused by document creation pipelines.
3. **User Permissions & Scoping:** Currently **0% integrated**.
   - `authMiddleware.ts` strictly resolves `req.company` and `req.member` at the tenant boundary.
   - `CompanyMember` role is limited to `'admin' | 'dispatcher' | 'accountant' | 'viewer'`.
   - `Branch.member_ids` exists in the schema as an array of `Types.ObjectId` referencing `CompanyMember`, but no middleware or controller enforces branch filtering against this array.
4. **Financial Reporting:** Currently **0% integrated**. [`commercialReportController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts) queries strictly by `{ company_id: companyId }`. No branch filter query parameter is supported.
5. **Single-Branch Friction:** Currently **defective by omission**. Because operational pages don't know about branches, single-branch tenants cannot benefit from branch prefixes, while multi-branch enterprises cannot record dispatch origins.

---

## 5. Tenant & Branch Data Isolation Architecture

### 5.1 Multi-Tenant Boundaries vs. Branch Operational Locations

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           TENANT ISOLATION BOUNDARY (AsyncLocalStorage)                     │
│                                      Company A (Tenant)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Shared Company Resources (Fleet-Wide):                                                     │
│  - Trucks Master (`Truck`)                                                                  │
│  - Drivers Master (`Driver`)                                                                │
│  - Customers & Billing Parties (`BillingParty`)                                             │
│  - Subscriptions & Entitlements (`Subscription`, `Plan`)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Operational Regional Branches:                                                             │
│                                                                                             │
│  ┌───────────────────────────────┐               ┌───────────────────────────────┐          │
│  │     Branch 1: Mumbai Hub      │               │     Branch 2: Delhi Depot     │          │
│  │     Code: MUM                 │               │     Code: DEL                 │          │
│  │     LR Prefix: MUM-LR-        │               │     LR Prefix: DEL-LR-        │          │
│  │     Inv Prefix: INV-MUM-      │               │     Inv Prefix: INV-DEL-      │          │
│  │     is_head_office: true      │               │     is_head_office: false     │          │
│  └──────────────┬────────────────┘               └──────────────┬────────────────┘          │
│                 │                                               │                           │
│                 ▼                                               ▼                           │
│  Dispatched Trips (`branch_id: MUM`)              Dispatched Trips (`branch_id: DEL`)       │
│  Issued LRs (`branch_id: MUM`)                    Issued LRs (`branch_id: DEL`)             │
│  Issued Invoices (`branch_id: MUM`)               Issued Invoices (`branch_id: DEL`)        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Root Tenant Isolation (Strict):**
   - Tenant isolation is governed by `AsyncLocalStorage` and `tenantPlugin.ts`. All queries must filter by `company_id`.
   - Cross-tenant data leakage is impossible: a user from Company A can never view or assign a branch belonging to Company B.
2. **Branch-Level Operational Partitioning (Intra-Tenant):**
   - Within Company A, branches represent operational locations.
   - Company Admins and Accountants require visibility across all branches to consolidate tax filings, P&L, and fleet utilization.
   - Dispatchers default to their primary assigned branch for dispatch origin, but retain company-wide visibility over available fleet vehicles and drivers.

---

### 5.2 Roles and Permissions Matrix (Existing Architectural Roles Only)

In strict accordance with [`CompanyMember.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/models/CompanyMember.ts#L33), Fleet Flow supports exactly four roles: `'admin' | 'dispatcher' | 'accountant' | 'viewer'`. No artificial roles (such as `branch_admin` or `regional_director`) may be introduced.

| Operation / Endpoint | `admin` | `dispatcher` | `accountant` | `viewer` | Operational Scoping Rules |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **List Branches** (`GET /api/company/branches`) | Yes | Yes | Yes | Yes | All active members can view branch directory |
| **Create Branch** (`POST /api/company/branches`) | Yes | No | No | No | Gated by `requireRole(['admin'])` & `requireQuota('branches')` |
| **Update Branch** (`PUT /api/company/branches/:id`) | Yes | No | No | No | Gated by `requireRole(['admin'])` |
| **Delete Branch** (`DELETE /api/company/branches/:id`) | Yes | No | No | No | Gated by `requireRole(['admin'])`; Head Office cannot be deleted; referenced branches blocked |
| **Trip Dispatch with Branch** (`POST /api/journeys`) | Yes | Yes | No | No | Auto-defaults if 1 branch; dispatcher selects branch; assets fleet-wide |
| **Create LR with Branch** (`POST /api/entries`) | Yes | Yes | Yes | No | Uses branch prefix & sequence if `branch_id` selected; company fallback |
| **Issue Invoice with Branch** (`POST /api/invoices`) | Yes | No | Yes | No | Uses branch invoice prefix & sequence if selected; company fallback |
| **Filter Reports by Branch** (`GET /api/commercial/*`) | Yes | No | Yes | Yes | Query param `?branch_id=` filters results; defaults to company-wide consolidation |

#### Dispatcher Scope Specification:
- **Proposed Behavior:** **Branch-default dispatch with company-wide asset visibility.**
- **Details:** 
  - When a dispatcher opens `/operations/journeys/new`, the branch selector defaults to their assigned branch (from `Branch.member_ids`) or the company Head Office.
  - The vehicle and driver dropdowns list all available resources belonging to the tenant, allowing nationwide fleet dispatch and return loads.
  - Dispatchers are not strictly walled off from viewing other branches' trips; transport companies require dispatchers at destination depots to view incoming loads and coordinate unloading.
- **Existing Rule Conflict Check:**
  - Route middleware on `POST /api/journeys` requires `requireRole(['admin', 'dispatcher'])`. No existing route rule restricts dispatchers to a single geographic silo. Introducing rigid branch siloing would break multi-leg movements and vehicle reallocation.

---

### 5.3 Branch Lifecycle Operations & Referential-Integrity Safeguards

1. **Branch Creation:**
   - Validates `branch_name` and `branch_code`.
   - Normalizes `branch_code` to uppercase (e.g., `MUM`).
   - Checks compound uniqueness: `{ company_id: 1, branch_code: 1 }`.
   - Validates subscription quota (`entitlements.limits.max_branches`).
   - Sanitizes default document prefixes: `lr_prefix: lr_prefix || `${code}-LR-``, `invoice_prefix: invoice_prefix || `INV-${code}-``.
   - Initializes atomic counters: `counters: { lr_seq: 0, invoice_seq: 0 }`.
2. **Branch Editing:**
   - Must sanitize updates: prevent overwriting `company_id` or modifying `branch_code` into an existing code.
   - Cannot unset `is_head_office` unless another branch is designated as Head Office.
3. **Branch Deactivation (Preferred Path):**
   - Inactive branches (`is_active: false`) remain in database for historical trip/invoice integrity.
   - Inactive branches are excluded from new trip dispatch, new LR generation, and new invoice dropdowns.
   - Historical records referencing inactive branches continue to display branch names and prefixes seamlessly.
4. **Branch Deletion Safeguard (Referential Integrity):**
   - Cannot delete the Head Office branch (`is_head_office: true`).
   - **Strict Referential Integrity Enforcement:** Before executing deletion, the controller runs parallel count checks:
     ```typescript
     const [journeyCount, entryCount, invoiceCount] = await Promise.all([
       TruckJourney.countDocuments({ branch_id: id, is_deleted: false }),
       Entry.countDocuments({ branch_id: id, is_deleted: false }),
       Invoice.countDocuments({ branch_id: id, is_deleted: false }),
     ]);
     if (journeyCount > 0 || entryCount > 0 || invoiceCount > 0) {
       return res.status(409).json({
         code: 'CANNOT_DELETE_BRANCH_WITH_RECORDS',
         error: `Cannot delete branch '${branch.branch_name}'. It is referenced by ${journeyCount} trips, ${entryCount} LRs, and ${invoiceCount} invoices. Deactivate the branch instead to preserve historical integrity.`,
       });
     }
     ```
   - Only truly unreferenced branches may be permanently removed.

---

## 6. Detailed Operational Specifications

### 6.1 Document Numbering Architecture (Independent Counters & Configured Prefixes)

#### 1. Aligned Architectural Direction
- **Recommendation:** **Independent branch counters with configured branch prefixes.**
- Each branch maintains its own atomic counters on `Branch`:
  ```typescript
  counters: {
    lr_seq: { type: Number, default: 0 },
    invoice_seq: { type: Number, default: 0 },
  }
  ```
- Mumbai issues: `MUM-LR-0001`, `MUM-LR-0002`, `INV-MUM-0001`.
- Delhi issues: `DEL-LR-0001`, `DEL-LR-0002`, `INV-DEL-0001`.
- Direct compliance with Indian transport practice and GST rules requiring distinct, continuous sequential numbering series per operating location.

#### 2. Handling Company-Level Counters and Fallbacks
- `Company.counters.lr_seq` and `Company.counters.invoice_seq` remain intact in `Company.ts`.
- When an LR or Invoice is created **without** a `branch_id` (e.g. legacy tenant or global company dispatch):
  - Prefix defaults to `Company.settings.lr_prefix` (default `'LR-'`).
  - Sequence atomically increments `Company.counters.lr_seq`.
- When an LR or Invoice is created **with** a `branch_id`:
  - Prefix is drawn from `Branch.lr_prefix` (or fallback `${branch_code}-LR-`).
  - Sequence atomically increments `Branch.counters.lr_seq`.

#### 3. Historical Documents
- All existing documents in the database (`lr_no: 'LR-0001'`, `invoice_number: 'INV-0045'`) are immutable financial records.
- Historical documents are **never retroactively re-numbered** or re-sequenced.
- New branch sequences start at `1` for that branch prefix without colliding with old numbers.

#### 4. Uniqueness Guarantees
- MongoDB index on `Entry` ensures `{ company_id: 1, lr_no: 1, is_deleted: 1 }` uniqueness.
- MongoDB index on `Invoice` ensures `{ company_id: 1, invoice_number: 1, is_deleted: 1 }` uniqueness.
- Different prefixes across branches naturally prevent collisions (`MUM-LR-0001` vs `DEL-LR-0001`).

#### 5. Concurrent Requests
- Handled strictly via atomic MongoDB operations:
  ```typescript
  const updatedBranch = await Branch.findOneAndUpdate(
    { _id: branchId, company_id: companyId },
    { $inc: { 'counters.lr_seq': 1 } },
    { new: true, upsert: false }
  );
  const seq = updatedBranch.counters.lr_seq;
  const lr_no = `${prefix}${String(seq).padStart(4, '0')}`;
  ```
- Because MongoDB performs field increments atomically at the document level, parallel requests from multiple dispatchers always receive distinct, monotonic numbers.

#### 6. Failed Transactions & Sequence Gaps Policy
- In high-throughput transport accounting, standard industry practice treats sequence counter reservations as monotonic increments.
- To prevent sequence gaps from validation failures, **counter increments must occur immediately prior to document save**, strictly after all payload validations, credit limit checks, compliance checks, and resource conflict checks have succeeded.
- If a subsequent unrecoverable database save fails, the counter is not rolled back (rolling back in concurrent environments causes race condition duplicates). An occasional gap is legally permissible under GST audit rules with an audit log explanation, whereas duplicate numbering constitutes an illegal tax violation.

---

### 6.2 Branch Association Lifecycle (Trips, LRs, and Invoices)

1. **Historical Records:**
   - In Mongoose schemas, `branch_id: { type: Schema.Types.ObjectId, ref: 'Branch', required: false, index: true }`.
   - Historical records with `branch_id === undefined` remain valid and accessible across all APIs.
2. **New Operational Records:**
   - **Single-Branch Tenants:**
     - When a company has exactly **1 active branch** (or only the Head Office):
     - The frontend auto-binds that `branch_id`.
     - The backend controller verifies: if `!req.body.branch_id`, queries `Branch.find({ company_id, is_active: true })`. If exactly 1 exists, it automatically sets `branch_id = singleBranch._id`.
     - Zero extra clicks or friction for single-depot operators.
   - **Multi-Branch Tenants:**
     - The trip creation form, LR creation form, and invoice creation form display an active Branch Selector.
     - Pre-selected by default to the dispatcher's assigned branch or Head Office.
     - For new records in multi-branch setups, selecting an active branch is mandatory.
   - **Zero-Branch Tenants (Fresh Workspace Edge Case):**
     - If no branches have been configured yet, operational documents proceed with `branch_id: undefined` using global company defaults.

---

## 7. Data Migration and Backward-Compatibility Strategy

### 7.1 Safe Migration Roadmap
- **No Destructive Database Changes:** Adding optional `branch_id` and `counters` fields requires zero downtime and zero schema backfills.
- **Dual-Path Controller Logic:**
  ```typescript
  if (branchId) {
    // Branch-specific prefix and atomic counter
    const branch = await Branch.findOneAndUpdate(
      { _id: branchId, company_id: companyId },
      { $inc: { 'counters.lr_seq': 1 } },
      { new: true }
    );
    prefix = branch.lr_prefix || `${branch.branch_code}-LR-`;
    seq = branch.counters?.lr_seq || 1;
  } else {
    // Legacy / Company-global fallback
    const company = await Company.findByIdAndUpdate(
      companyId,
      { $inc: { 'counters.lr_seq': 1 } },
      { new: true }
    );
    prefix = company.settings?.lr_prefix || 'LR-';
    seq = company.counters?.lr_seq || 1;
  }
  ```
- **Historical Data Viewing:** Existing trips, LRs, and invoices continue to render without `branch_id`. UI components check `journey.branch_id?.branch_name || 'Head Office / Global'`.

---

## 8. Recommended Phased Implementation Roadmap & Approval Gates

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                BATCH G EXECUTION ROADMAP                                    │
├──────────────────────────┬─────────────────────────────┬────────────────────────────────────┤
│ Phase G1: Backend Schema │ Phase G2: Document Sequences│ Phase G3: Operational Binding      │
│ - branch_id on Journey   │ - Branch atomic counters    │ - Auto-defaulting in dispatch      │
│ - branch_id on Entry     │ - Branch prefix generator   │ - Trip & LR branch validation      │
│ - branch_id on Invoice   │ - Prevent branch deletion   │ - Report filtering by branch       │
│   (Backward compatible)  │   with active documents     │                                    │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Phase G4: UI Layouts     │ Phase G5: Listing & Actions │ Phase G6: Automated Verification   │
│ - Form card containment  │ - Edit Branch modal         │ - Concurrent sequence tests        │
│   (FF-ISSUE-051)         │ - Deactivate / Delete       │ - Quota & isolation regression     │
│ - Token input borders    │   (FF-ISSUE-052)            │ - Build & lint sign-off            │
└──────────────────────────┴─────────────────────────────┴────────────────────────────────────┘
```

### Phase G1: Backend Schema Extensions & Migration Resilience — **IMPLEMENTED & VERIFIED**
- **Status:** **Completed & Verified** (14/14 Automated Tests Passing in `phase7BatchG1ModelsAndSchemas.test.ts`)
- **Model Modifications:**
  - `Branch.ts`: Added `counters: { lr_seq: { type: Number, default: 0 }, invoice_seq: { type: Number, default: 0 } }` to `IBranch` interface and `BranchSchema`. Added `{ company_id: 1, is_active: 1 }` index.
  - `TruckJourney.ts`: Added optional `branch_id?: Types.ObjectId` reference with index, and compound index `{ company_id: 1, branch_id: 1, start_date: -1 }`.
  - `Entry.ts`: Added optional `branch_id?: Types.ObjectId` reference with index, and compound index `{ company_id: 1, branch_id: 1, lr_date: -1 }`.
  - `Invoice.ts`: Added optional `branch_id?: Types.ObjectId` reference with index, and compound index `{ company_id: 1, branch_id: 1, invoice_date: -1 }`.
- **Backward Compatibility Verified:** Existing and historical journeys, entries, and invoices without `branch_id` compile, persist, and serialize without error.
- **Audit Report:** Documented in [`BATCH_G1_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G1_AUDIT_REPORT.md).

### Phase G2: Branch Controller Hardening & Sequence Generation
- **Status:** **Completed & Verified** (23/23 Automated Tests Passing in `phase7BatchG2ControllerAndNumbering.test.ts`)
- **Controller Hardening:**
  - [`branchController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/branchController.ts):
    - Whitelisted update fields; prevented overwriting `company_id` and sequence counters.
    - Protected Head Office branch from deletion, deactivation, and unsetting of `is_head_office`.
    - Protected referenced branches from deletion: returns HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS` if referenced by `TruckJourney`, `Entry`, or `Invoice`.
  - [`entryController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/entryController.ts):
    - Validates branch existence and active status.
    - Concurrency-safe atomic sequence generation using `Branch.counters.lr_seq` and `Branch.lr_prefix`. Preserved company-level fallback.
  - [`invoiceController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/invoiceController.ts):
    - Validates branch existence and active status.
    - Concurrency-safe atomic sequence generation using `Branch.counters.invoice_seq` and `Branch.invoice_prefix`. Preserved company-level fallback.
- **Audit Report:** Documented in [`BATCH_G2_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G2_AUDIT_REPORT.md).

### Phase G3: Operational Trip Dispatch & LR Integration
- **Status:** **Completed & Verified** (18/18 Automated Tests Passing in `phase7BatchG3TripAndReports.test.ts`)
- **Operational Integration:**
  - [`journeyController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/journeyController.ts):
    - Accepts and validates `branch_id` (returns HTTP 404 on foreign, HTTP 400 on inactive).
    - Frictionless auto-assignment of `branch_id` for single-branch workspaces.
    - Defaulting hierarchy for multi-branch workspaces (user assigned branch -> Head Office -> requires branch).
    - Supports `?branch_id=` filtering in `getJourneys` and populates `branch_id` on journey details.
  - [`entryController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/entryController.ts):
    - Inherits `branch_id` from associated trip (`journey_id`) if `branch_id` is omitted.
    - Drives branch sequence allocation and prefix formatting from inherited branch.
    - Preserves company fallback for unbranched operations.
  - [`commercialReportController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/commercialReportController.ts):
    - Added `?branch_id=` filtering with ownership validation to Trip Profitability (`/profitability`), AR Aging (`/aging`), and Tally XML Export (`/export/tally`).
    - Consolidates company-wide data including historical unbranched records when `branch_id` is omitted.
- **Audit Report:** Documented in [`BATCH_G3_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G3_AUDIT_REPORT.md).

### Phase G4: Branch Creation Form Refactoring (`FF-ISSUE-051`)
- **Status:** **Completed & Verified** (`FF-ISSUE-051` Resolved)
- **Refactoring:**
  - Refactored [`BranchManagementPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/settings/BranchManagementPage.tsx) create form.
  - Wrapped form in a bounded, centered `.card` container (`maxWidth: 840px`).
  - Replaced `repeat(3, 1fr)` with responsive 2-column layout organized into semantic sections (Identification, Location & Contact, Numbering Configuration).
  - Applied design system tokens (`.form-group`, `.form-label`, `.form-control`, `.btn-primary`, `.btn-secondary`).
  - Cleanly aligned Cancel and Save buttons at bottom right in dedicated `.card-footer`.
- **Audit Report:** Documented in [`BATCH_G4_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G4_AUDIT_REPORT.md).

### Phase G5: Branch Listing Containment & Action Menus (`FF-ISSUE-052`)
- **Status:** **Completed & Verified** (`FF-ISSUE-052` Resolved)
- **Refactoring:**
  - Wrapped listing cards in design system `.card` containers with `.card-header`, `.card-body`, and `.card-footer`.
  - Implemented **Edit Branch** modal reusing `Modal.tsx` with form pre-population, validation, and `PUT /api/company/branches/:id` integration.
  - Implemented **Deactivate / Activate** toggle button with Head Office protection.
  - Implemented **Delete Branch** button with confirmation modal, gracefully handling HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS` and offering "Deactivate Branch Instead".
  - Added search toolbar (name, code, city, state) and status filter pills (`All`, `Active`, `Inactive`) with live count badges.
- **Audit Report:** Documented in [`BATCH_G5_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G5_AUDIT_REPORT.md).

### Phase G6: Frontend Dispatch & LR Branch Integration (`FF-ISSUE-053`)
- Update [`NewJourneyPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/operations/NewJourneyPage.tsx):
  - Add Branch Selector dropdown; auto-select if single branch exists.
- Update [`LRListPage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/commercial/LRListPage.tsx):
  - Show Branch indicator and allow branch selection during LR generation.

---

## 9. Comprehensive Acceptance Test Plan

When implementation is authorized, a dedicated integration test suite [`backend/src/tests/integration/phase7BatchGRegionalBranches.test.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/tests/integration/) must be created to verify all acceptance criteria:

### 9.1 Explicit Test Scenarios

1. **Concurrent Numbering Race Test:**
   - Trigger 5 concurrent LR creation requests for the same branch simultaneously using `Promise.all()`.
   - Verify all 5 receive unique, monotonic serial numbers (e.g. `BHW-LR-0001` through `BHW-LR-0005`) without duplicate collisions.
2. **Legacy Unbranched Records Test:**
   - Query existing trips and invoices created without `branch_id`.
   - Verify they return HTTP 200 and serialize cleanly with `branch_id: null` or fallback global labels.
3. **Strict Tenant Isolation:**
   - Tenant A attempts to dispatch a trip or issue an LR using a `branch_id` belonging to Tenant B.
   - Verify request is rejected with HTTP 404/403 (Deep Foreign Key Anti-IDOR validation).
4. **Branch Authorization Enforcement:**
   - Verify `dispatcher` and `accountant` cannot create or delete branches (HTTP 403).
   - Verify `dispatcher` can successfully dispatch a trip and create an LR with their assigned branch.
   - Verify fleet vehicles and drivers remain dispatchable across branches.
5. **Single-Branch Frictionless Auto-Defaulting:**
   - In a tenant with exactly 1 branch, POST `/api/journeys` and `/api/entries` without providing `branch_id`.
   - Verify the response automatically attaches the single branch's `_id` and prefixes the LR accordingly.
6. **Multi-Branch Selection & Validation:**
   - In a tenant with multiple branches, verify omitting `branch_id` either flags validation or defaults cleanly to Head Office.
   - Verify specifying a valid `branch_id` correctly associates the trip and applies that branch's specific prefix.
7. **Branch-Filtered Reporting:**
   - Create trips under Mumbai and Delhi branches with varying freight rates.
   - Query `/api/commercial/profitability?branch_id=<MUM_ID>`; verify only Mumbai trips are included.
   - Query `/api/commercial/profitability` without `branch_id`; verify consolidated company-wide results.
8. **Branch Deletion Protection (Referential Integrity):**
   - Attempt to delete Head Office branch; verify HTTP 400.
   - Create a trip referencing a non-head-office branch, then attempt to delete that branch; verify HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS`.
   - Soft deactivation of the branch succeeds (`is_active: false`), and existing trips remain unaffected.

### 9.2 Verification Commands
```bash
# Run existing test baseline (must remain 100% passing)
npm run test:run

# Run targeted Batch G suite upon implementation
npx jest --config jest.backend.config.cjs backend/src/tests/integration/phase7BatchGRegionalBranches.test.ts --runInBand

# Frontend typecheck & production build verification
npm run build
```

---

## 10. Status of Architectural Decisions & Blockers

1. **`DEC-010` Status:** Retains formal **`Agreed`** status. All 6 core principles (Workspace = Company, Branch = Operational Location, Trip Responsibility, Document Prefixing, Single-Branch Default, Hub Distinction) are upheld and reflected in the implementation design.
2. **No Remaining Technical Blockers:** The numbering mechanism (independent branch counters with atomic `$inc`), dispatcher scope (branch-default with company-wide visibility), single-branch auto-defaulting, referential-integrity deletion guards, and test suites are fully defined.
3. **Execution Gate:** Implementation will begin only upon explicit user command/authorization.

---

---

## 12. Batch G Execution & Phased Sign-Off Status

| Phase | Description | Audit Report | Verification / Test Suite | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase G1** | Regional Branch Models, References, Counters & Compound Indexes | [`BATCH_G1_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G1_AUDIT_REPORT.md) | `phase7BatchG1ModelsAndSchemas.test.ts` (14/14) | **PASSED** |
| **Phase G2** | Branch Controller Hardening, Deletion Guards (409) & Atomic Numbering | [`BATCH_G2_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G2_AUDIT_REPORT.md) | `phase7BatchG2ControllerAndNumbering.test.ts` (23/23) | **PASSED** |
| **Phase G3** | Trip Dispatch Branch Attribution, Filtering & Commercial Reports | [`BATCH_G3_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G3_AUDIT_REPORT.md) | `phase7BatchG3TripAndReports.test.ts` (18/18) | **PASSED** |
| **Phase G4** | Frontend Branch Creation Form Refactoring & Design Tokens | [`BATCH_G4_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G4_AUDIT_REPORT.md) | Frontend Build (`tsc -b && vite build`) (0 errors) | **PASSED** |
| **Phase G5** | Frontend Branch Listing UI Containment, Filters & Action Guards | [`BATCH_G5_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G5_AUDIT_REPORT.md) | `phase7BatchG5ListingAndActions.test.ts` (20/20) + Build | **PASSED** |
| **Phase G6** | Operational Frontend Integration (New Journey, Lists, LR & Invoices) | [`BATCH_G6_AUDIT_REPORT.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_G6_AUDIT_REPORT.md) | `phase7BatchG6FrontendOperations.test.ts` (29/29) + Build | **PASSED** |

**Batch G Overall Status:** **FULLY IMPLEMENTED & AUDITED (104/104 automated tests passing across 5 suites, 0 TypeScript/Vite build errors)**


