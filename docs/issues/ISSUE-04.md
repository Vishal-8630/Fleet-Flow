# Issue 04 — Verify and Enforce Tenant Isolation Across the Entire API

## Metadata
- **Severity**: P0 (Critical)
- **Status**: Documented & Ready for Implementation
- **Category**: Multi-Tenant Isolation, IDOR Prevention, Concurrency & Security
- **Date**: October 10, 2026

---

## 1. Problem Statement
In a multi-tenant transport SaaS platform, guaranteeing strict zero-leakage tenant boundaries is paramount. Several isolation, foreign-key binding, and tenancy management gaps exist:
1. **Unvalidated Cross-Tenant Foreign Key Bindings (IDOR via Relations)**: When creating or updating complex operational records (e.g. creating a `TruckJourney`, `LR / Entry`, `Invoice`, or `Settlement`), foreign ID references (`truck_id`, `driver_id`, `billing_party_id`, `lr_ids`) are stored without explicitly validating that every referenced entity belongs to the requesting tenant's `company_id`. An attacker could attach Tenant B's vehicle or customer to Tenant A's trip or invoice.
2. **Arbitrary Workspace Selection (Missing Workspace Switcher)**: `resolveTenantContext` performs `CompanyMember.findOne({ user_id, status: 'active' })`. If a contractor, auditor, or fleet manager belongs to multiple transport companies, the server arbitrarily selects the first document returned by MongoDB rather than honoring an explicit, cryptographically verified `x-company-id` header or session selection.
3. **Concurrency Race Conditions in Unique Numbering**: Auto-incremented sequence numbering for Lorry Receipts (`LR-0001`) and Freight Invoices (`INV-0001`) lacks atomic `$inc` counters and compound unique database indexes (`{ company_id: 1, lr_number: 1 }`), risking duplicate numbering under concurrent dispatch loads.
4. **Super-Admin Impersonation Without Reason or UI Banner**: Support impersonation (`POST /api/super-admin/tenants/:id/impersonate`) does not mandate an audited ticket/reason string, and the frontend lacks a persistent high-contrast "SUPPORT IMPERSONATION SESSION ACTIVE" indicator with an immediate "Exit Support Session" trigger.
5. **Absence of Automated Cross-Tenant Negative Test Suite**: The codebase lacks a full automated test matrix that attempts cross-tenant reads, updates, deletes, and exports to programmatically guarantee 404/403 isolation across every route.

---

## 2. Root Cause Analysis (RCA)
- **Shallow Scoping**: While `tenantPlugin.ts` automatically attaches `{ company_id }` to top-level collection queries, it does not validate the internal ownership of secondary ID references passed in request bodies (`req.body.truck_id`, `req.body.billing_party_id`).
- **Implicit First-Match Tenancy**: `CompanyMember` model supported multi-workspace membership, but the backend lacked a `/workspaces` listing endpoint, a `/switch-company` endpoint, and header-based context switching.
- **In-Memory Numbering Math**: Sequence formatting calculated numbering by querying `countDocuments() + 1` instead of using atomic MongoDB findAndModify counters.

---

## 3. Implementation Solution & Target Architecture

### A. Deep Foreign Key Ownership Validation
Create a reusable ownership validator utility in `backend/src/utils/ownershipValidator.ts`:
```ts
export async function validateTenantOwnership(companyId: string, references: {
  truck_id?: string;
  driver_id?: string;
  billing_party_id?: string;
  balance_party_id?: string;
  journey_id?: string;
  lr_ids?: string[];
}): Promise<void>
```
- Ensures every referenced entity exists AND matches `company_id`.
- Throws HTTP 403 / 404 (`Invalid entity reference: Resource does not belong to your workspace`) before creating records.
- Mount validation on:
  - `POST /api/journeys` (validates `truck_id`, `driver_id`)
  - `POST /api/entries` (validates `truck_id`, `driver_id`, `billing_party_id`)
  - `POST /api/invoices` (validates `billing_party_id`, all `entry_ids`)
  - `POST /api/settlements` (validates `driver_id`, `journey_id`)
  - `POST /api/parties/balance` / `billing`

### B. Multi-Tenant Workspace Switching Flow
- **Endpoints**:
  - `GET /api/auth/workspaces`: Lists all active company memberships for `req.user._id` (company ID, name, slug, role, status).
  - `POST /api/auth/switch-company`: Takes `{ company_id }`, verifies `CompanyMember.findOne({ user_id: req.user._id, company_id, status: 'active' })`, and re-issues an updated session token containing the selected `companyId`.
- **Tenant Resolver Enhancement (`authMiddleware.ts`)**:
  - Checks `req.headers['x-company-id']` or JWT `decoded.companyId`.
  - Verifies the user actually has an active membership for that specific company before entering AsyncLocalStorage tenant context.

### C. Concurrency-Safe Atomic Sequence Numbering
- **Database Schema (`Company.ts`)**:
  - Add atomic counters:
    ```ts
    counters: {
      lr_seq: { type: Number, default: 0 },
      invoice_seq: { type: Number, default: 0 },
      journey_seq: { type: Number, default: 0 }
    }
    ```
- **Atomic Generation**: Use `Company.findOneAndUpdate({ _id: companyId }, { $inc: { 'counters.lr_seq': 1 } }, { new: true })`.
- **Database Compound Unique Indexes**:
  - `EntrySchema.index({ company_id: 1, lr_number: 1 }, { unique: true })`
  - `InvoiceSchema.index({ company_id: 1, invoice_number: 1 }, { unique: true })`

### D. Audited Super-Admin Impersonation Banner
- **Backend Mandate**: Require `reason` in `POST /api/super-admin/tenants/:id/impersonate`. Store `reason`, `ip_address`, and `actor_email` in `PlatformAuditLog`.
- **JWT Flag**: Encodes `isImpersonation: true`, `actorEmail: req.user.email`, `expiresIn: '1h'`.
- **Frontend Indicator**:
  - Mount global sticky banner in `AppLayout.tsx`:
    > ⚠️ **Platform Impersonation Mode Active**: Viewing workspace as **[Company Name]** (Support session expires in 42m). [Exit Impersonation]
  - Clicking "Exit Impersonation" revokes token and restores the super-admin session.

### E. Automated Cross-Tenant Isolation Test Matrix
Create `backend/src/scripts/verifyTenantIsolation.ts`:
- Spawns Tenant Alpha and Tenant Beta.
- Attempts cross-tenant operations:
  1. Alpha attempts to `GET`, `PUT`, `DELETE` Beta's trucks, drivers, journeys, and invoices.
  2. Alpha attempts to create a journey referencing Beta's truck ID (verifies foreign-key ownership rejection).
  3. Alpha attempts to download Beta's document vault uploads.
  4. Tests concurrent LR creations to verify sequence counter uniqueness.
- Asserts 100% pass rate with zero cross-tenant contamination.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/utils/ownershipValidator.ts` | Deep foreign key tenant ownership validator |
| `backend/src/controllers/journeyController.ts` | Validate truck and driver ownership on creation/updates |
| `backend/src/controllers/entryController.ts` | Validate party, truck, and driver ownership on LR creation |
| `backend/src/controllers/invoiceController.ts` | Validate party and LR entries ownership on invoice generation |
| `backend/src/controllers/settlementController.ts` | Validate driver and trip ownership on settlements |
| `backend/src/models/Company.ts` | Atomic sequence counters and unique compound index definitions |
| `backend/src/routes/authRoutes.ts` | Add `/workspaces` and `/switch-company` endpoints |
| `backend/src/controllers/authController.ts` | Workspace listing and verified switching handlers |
| `backend/src/controllers/superAdminController.ts` | Enforce mandatory reason on support impersonation |
| `frontend/src/components/layout/ImpersonationBanner.tsx` | Global persistent warning banner during support sessions |
| `backend/src/scripts/verifyTenantIsolation.ts` | Automated end-to-end cross-tenant boundary verification test |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Testing Multi-Tenant Fleet & Record Isolation
1. **Open Two Independent Workspaces in Parallel**:
   - Open standard browser window: Log in as Tenant A (e.g. *Patel Roadways*).
   - Open an incognito browser window: Log in as Tenant B (e.g. *Singhania Freight*).
2. **Create Operational Records in Tenant A**:
   - In Tenant A's window, navigate to **Fleet & Trucks** (`/fleet/trucks`).
   - Click **"+ Add Truck"**, fill in Registration Number `MH04XY1122`, Model `Tata Prima 4018`, and click **"Save Truck"**.
   - Navigate to **Consignments / LR** (`/consignments`) and create LR `#LR-2026-9001`.
3. **Verify Complete Absence in Tenant B**:
   - Switch to Tenant B's incognito window.
   - Navigate to **Fleet & Trucks** (`/fleet/trucks`): search for `MH04XY1122`.
   - **What you should see**: The vehicle does **not** appear anywhere in Tenant B's table. Search shows *"No matching vehicles found"*.
   - Navigate to **Consignments** (`/consignments`): search for `9001`.
   - **What you should see**: Zero records returned. Tenant A's customer names, rates, and trucks are completely invisible.

---

### Test 2: Switching Workspaces via the Top Navigation Bar
1. **Open Workspace Switcher**:
   - Log in with a user email associated with multiple company accounts.
   - Look at the top-left navigation bar next to the company logo: click on the company name dropdown.
2. **Select Another Company Workspace**:
   - A dropdown menu opens listing your accessible workspaces:
     - *Patel Roadways Logistics (Owner)*
     - *Gujarat Express Cargo (Dispatcher)*
   - Click on *Gujarat Express Cargo*.
3. **What You Should See on the Screen**:
   - The workspace switches instantly with a smooth transition.
   - The company brand logo and name in the header update to *Gujarat Express Cargo*.
   - Navigating to **Fleet** or **Trips** now displays only Gujarat Express Cargo's records.
   - Navigating to **Billing** reflects the specific tier and payment details of Gujarat Express Cargo.

---

### Test 3: Testing Super-Admin Impersonation Banner & Exit Flow
1. **Initiate Impersonation from Super-Admin**:
   - Open browser and log in as Super Admin (`http://localhost:5173/login`).
   - In the sidebar, navigate to **Control Plane & Tenants** (`/super-admin`).
   - Find *Singhania Freight* in the company table and click the **"Impersonate Workspace"** icon.
2. **Fill Mandatory Support Ticket Reason**:
   - A modal prompt appears: *"Enter ticket reference or justification for accessing client workspace"*.
   - Enter `TICKET-4482: Assisting customer with GST E-way bill sync error`.
   - Click **"Enter Workspace"**.
3. **What You Should See on the Screen**:
   - The view changes to *Singhania Freight*'s internal dashboard.
   - A bright amber, sticky banner is fixed at the very top of every screen:  
     > ⚠️ **Platform Impersonation Mode Active**: Viewing workspace as **Singhania Freight** (Session expires in 59m).  
     > Button: **[Exit Impersonation]**
4. **Exit Impersonation**:
   - Click the **"Exit Impersonation"** button in the top banner.
   - **What you should see**: You are cleanly returned to the Super-Admin panel (`/super-admin`), and client workspace access is securely closed.

