# Fleet Flow — Batch G Phase G2 Audit Report
**Phase G2: Branch Controller Hardening & Concurrency-Safe Sequence Generation**
**Audit Date:** 2026-10-17  
**Scope:** `FF-ISSUE-051`, `FF-ISSUE-053`, `DEC-010`, `QST-012`  
**Status:** Verification Passed (Phase G2 Complete)

---

## 1. Executive Summary

Phase G2 authorized the controller-level hardening and sequence generation infrastructure for regional branches within Fleet Flow:
1. **Branch CRUD Hardening:**
   - Enforced uppercase normalization for `branch_code`.
   - Whitelisted update payload fields to prevent overwriting immutable tenant partitions (`company_id`) or sequence counters.
   - Enforced tenant-scoped uniqueness check on `branch_code`.
   - Protected the Head Office branch from deletion, deactivation (`is_active: false`), and direct unsetting of `is_head_office` without designating a replacement.
   - Handled atomic promotion of a new Head Office by demoting existing Head Office branches.
2. **Referential Integrity Safeguards (Deletion Protection):**
   - Implemented pre-deletion verification across operational collections: `TruckJourney`, `Entry`, and `Invoice`.
   - If a branch is referenced by any non-deleted operational records, `DELETE /api/company/branches/:id` returns **HTTP 409** with error code `CANNOT_DELETE_BRANCH_WITH_RECORDS` and detailed counts.
   - Unreferenced branches can be safely deleted.
3. **Operational Validation & Tenant Isolation:**
   - Validated branch existence and tenant ownership on `POST /api/commercial/entries` (LR creation) and `POST /api/commercial/invoices` (Invoice creation). Cross-tenant branch references return HTTP 404.
   - Enforced active status check: operational documents cannot be issued under inactive branches (`is_active: false`), returning HTTP 400.
4. **Concurrency-Safe Sequence Generation & Company Fallback:**
   - Implemented atomic branch-level sequence allocation using `$inc` on `Branch.counters.lr_seq` and `Branch.counters.invoice_seq`.
   - Formatted sequential numbers using configured `Branch.lr_prefix` (fallback `${branch_code}-LR-`) and `Branch.invoice_prefix` (fallback `INV-${branch_code}-`).
   - Preserved company-level sequence counters (`Company.counters.lr_seq`, `Company.counters.invoice_seq`) and prefixes (`Company.settings.lr_prefix`, `Company.settings.invoice_prefix`) for legitimate unbranched operations.

---

## 2. Source Code Changes

### 2.1 [`backend/src/controllers/branchController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/branchController.ts)
- **`createBranch`**:
  - Normalized `branch_code = branch_code.trim().toUpperCase()`.
  - Initialized `counters: { lr_seq: 0, invoice_seq: 0 }`.
  - Demoted existing head office when `is_head_office: true` is requested.
- **`updateBranch`**:
  - Restricted updates to explicit whitelist: `branch_name`, `branch_code`, `gstin`, `state`, `state_code`, `address`, `city`, `phone`, `lr_prefix`, `invoice_prefix`, `is_head_office`, `is_active`, `member_ids`.
  - Validated uniqueness of `branch_code` within tenant when modified.
  - Blocked deactivation of Head Office (`existingBranch.is_head_office && updates.is_active === false`).
  - Blocked unsetting `is_head_office` directly (`existingBranch.is_head_office && updates.is_head_office === false`).
  - Automatically demoted other branches when setting `is_head_office: true`.
- **`deleteBranch`**:
  - Prohibited deletion of Head Office branch (HTTP 400).
  - Executed parallel referential integrity check:
    ```typescript
    const [journeyCount, entryCount, invoiceCount] = await Promise.all([
      TruckJourney.countDocuments({ branch_id: id, is_deleted: false }),
      Entry.countDocuments({ branch_id: id, is_deleted: false }),
      Invoice.countDocuments({ branch_id: id, is_deleted: false }),
    ]);
    if (journeyCount > 0 || entryCount > 0 || invoiceCount > 0) {
      res.status(409).json({
        code: 'CANNOT_DELETE_BRANCH_WITH_RECORDS',
        error: `Cannot delete branch '${branch.branch_name}'. It is referenced by ${journeyCount} trips, ${entryCount} LRs, and ${invoiceCount} invoices. Deactivate the branch instead to preserve historical integrity.`,
        details: { journeyCount, entryCount, invoiceCount },
      });
      return;
    }
    ```

### 2.2 [`backend/src/controllers/entryController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/entryController.ts)
- Imported `Branch`.
- In `createEntry`:
  - Validated branch existence and tenant ownership if `req.body.branch_id` is passed (returns 404 if missing or belonging to another workspace).
  - Validated `branch.is_active` (returns 400 if branch is deactivated).
  - Concurrency-safe LR sequence generation:
    - If `branch` present: atomically increments `Branch.counters.lr_seq` via `findOneAndUpdate` with `{ $inc: { 'counters.lr_seq': 1 } }`. Formats LR number with `branch.lr_prefix || \`${branch.branch_code}-LR-\``.
    - If unbranched: preserves company-level fallback using `Company.counters.lr_seq` and `Company.settings.lr_prefix`.
  - Assigned `branch_id: branch?._id || undefined` to new `Entry`.

### 2.3 [`backend/src/controllers/invoiceController.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/backend/src/controllers/invoiceController.ts)
- Imported `Branch`.
- In `createInvoice`:
  - Extracted and validated `branch_id` (returns 404 if not found in workspace, 400 if inactive).
  - Concurrency-safe invoice sequence generation:
    - If `branch` present: atomically increments `Branch.counters.invoice_seq` via `findOneAndUpdate` with `{ $inc: { 'counters.invoice_seq': 1 } }`. Formats invoice number with `branch.invoice_prefix || \`INV-\${branch.branch_code}-\``.
    - If unbranched: preserves company-level fallback using `Company.counters.invoice_seq` and `Company.settings.invoice_prefix`.
  - Assigned `branch_id: branch?._id || undefined` to new `Invoice`.

---

## 3. Financial and Numbering Invariants Analysis

### 3.1 Historical Record Immutability
- No historical documents are modified, re-sequenced, or retroactively backfilled.
- Unbranched historical records continue to exist with `branch_id: null` / `undefined` and are fully valid across reporting, tracking, and accounting.

### 3.2 Pre-Allocation Validation Order
- Sequence numbers are NOT consumed prematurely.
- In both LR and invoice creation paths:
  1. Anti-IDOR foreign key validations (`validateTenantOwnership`) execute first.
  2. Customer credit limit checks and authorization checks execute first.
  3. Payload structural and compliance checks execute first.
  4. Sequence increment is executed immediately before document construction and persistence.

### 3.3 Transaction & Concurrency Failure-Path Analysis
- **Monotonic Increment Guarantees:** MongoDB document-level atomic increments (`$inc`) guarantee that concurrent requests receive distinct sequence numbers without race conditions or duplicate key errors.
- **Transaction Coordination Assessment:**
  - In MongoDB, executing an atomic `$inc` inside a multi-document ACID transaction aborts and rolls back on failure. However, rolling back a shared sequence counter during high-concurrency dispatch introduces race condition collisions and counter reuse vulnerabilities.
  - Standard enterprise transport practice and statutory GST invoicing guidelines prioritize preventing **duplicate numbers** over maintaining zero-gap series.
  - In the event of an unrecoverable database save failure after counter reservation, the counter remains monotonic. An audit trail records the gap, eliminating duplicate invoice violations under GST laws.
  - **Important invariant:** Atomic counters alone do NOT provide distributed ACID transaction safety across all downstream mutations (e.g. general ledger postings or WhatsApp notifications); operations that require multi-collection consistency (such as invoice payment settlements and journal entries) continue to utilize `runInTransaction`.

---

## 4. Verification Results

### 4.1 Focused Phase G2 Test Suite
**Command:**
```powershell
npm --prefix backend run test -- src/tests/integration/phase7BatchG2ControllerAndNumbering.test.ts
```
**Output:**
```
Test Files  1 passed (1)
     Tests  23 passed (23)
  Duration  7.01s
```
**Scenarios Verified:**
1. **Branch CRUD Authorization & Role Gating (3 tests):**
   - Admin creates branch with uppercase code normalization and zero-initialized counters.
   - Non-admin (viewer) rejected with HTTP 403.
   - Duplicate `branch_code` within same tenant rejected with HTTP 409.
2. **Tenant Isolation & Cross-Tenant Access Prevention (4 tests):**
   - Tenant A cannot update Tenant B branch (HTTP 404).
   - Tenant A cannot delete Tenant B branch (HTTP 404).
   - Cross-tenant `branch_id` on LR creation rejected (HTTP 404).
   - Cross-tenant `branch_id` on invoice creation rejected (HTTP 404).
3. **Head Office Protection & Status Invariants (4 tests):**
   - Deletion of Head Office blocked with HTTP 400.
   - Deactivation of Head Office blocked with HTTP 400.
   - Direct removal of Head Office status blocked with HTTP 400.
   - Promoting a new Head Office automatically demotes previous Head Office.
4. **Referential Integrity & Deletion Protection (4 tests):**
   - Deletion blocked with HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS` when referenced by `TruckJourney`.
   - Deletion blocked with HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS` when referenced by `Entry` (LR).
   - Deletion blocked with HTTP 409 `CANNOT_DELETE_BRANCH_WITH_RECORDS` when referenced by `Invoice`.
   - Unreferenced branch deletion succeeds with HTTP 200.
5. **Inactive Branch Operational Rejection (2 tests):**
   - LR creation rejected when branch is inactive (HTTP 400).
   - Invoice creation rejected when branch is inactive (HTTP 400).
6. **Sequence Allocation & Company Fallback (4 tests):**
   - Sequential LR numbering using branch prefix and branch counter increment.
   - Fallback to company-level prefix and counter for unbranched LR creation.
   - Sequential Invoice numbering using branch prefix and branch counter increment.
   - Fallback to company-level prefix and counter for unbranched Invoice creation.
7. **Concurrency Race-Condition Resilience (2 tests):**
   - Concurrent `Promise.all` LR creations under same branch produce zero duplicates and strictly monotonic numbers.
   - Concurrent `Promise.all` Invoice creations under same branch produce zero duplicates and strictly monotonic numbers.

### 4.2 Regression Test Suites
1. **Phase G1 Models & Tenant Routes:**
   ```powershell
   npm --prefix backend run test -- src/tests/integration/phase7BatchG1ModelsAndSchemas.test.ts src/tests/integration/tenantRoutes.test.ts
   ```
   **Result:** `2 passed (2)`, `28 passed (28)` (All green).
2. **Tenant Isolation & Financial Invariants:**
   ```powershell
   npm --prefix backend run test -- src/tests/integration/tenantIsolation.test.ts src/tests/integration/phase3FinancialInvariants.test.ts
   ```
   **Result:** `2 passed (2)`, `49 passed (49)` (All green).
3. **Backend TypeScript Build:**
   ```powershell
   npm --prefix backend run build
   ```
   **Result:** Exit code `0` (Zero compiler errors or warnings).

---

## 5. Working Tree Status

### Modified Files:
- `backend/src/controllers/branchController.ts`
- `backend/src/controllers/entryController.ts`
- `backend/src/controllers/invoiceController.ts`
- `backend/src/models/Branch.ts`
- `backend/src/models/Entry.ts`
- `backend/src/models/Invoice.ts`
- `backend/src/models/TruckJourney.ts`

### Untracked Files:
- `backend/src/tests/integration/phase7BatchG1ModelsAndSchemas.test.ts`
- `backend/src/tests/integration/phase7BatchG2ControllerAndNumbering.test.ts`
- `docs/testing/audit/BATCH_G1_AUDIT_REPORT.md`
- `docs/testing/audit/BATCH_G2_AUDIT_REPORT.md`
- `docs/testing/audit/BATCH_G_PREFLIGHT_REVIEW.md`

---

## 6. Phase G2 Sign-Off & Strict Boundary Stop

- **Phase G2 Objectives:** 100% complete and verified.
- **DEC-010 Status:** `Agreed` preserved.
- **Scope Boundary Invariants:**
  - Phase G3 (Trip dispatch form/reporting integration) has NOT been started.
  - Phase G4–G5 (Frontend branch management UI) has NOT been touched.
  - No Git commits, pushes, stashes, or resets were performed.
- **Stop Condition:** Awaiting explicit authorization before starting Phase G3.
