# Issue 12 — Support, Customer Onboarding & Offboarding Lifecycle

## Metadata
- **Severity**: P1 (High)
- **Status**: ✅ Resolved & Verified
- **Category**: Customer Success, CSV/Excel Migration, Data Portability & Offboarding
- **Date**: October 10, 2026

---

## 1. Problem Statement
The SaaS currently drops newly registered users onto an empty dashboard without structured guidance or migration tools, creating friction and churn during the 14-day free trial:
1. **Empty-State Friction on First Login**: A newly registered transporter sees zero metrics, blank tables, and no visual prompt on what action to take first.
2. **No Bulk CSV / Excel Import Tools**: Established transport operators managing 10 to 50+ trucks and hundreds of drivers and GST customers cannot manually type each vehicle or customer. The application lacks bulk CSV/Excel import templates, format validation, and error reporting.
3. **No Interactive Demo Data Seeding**: Prospective customers evaluating Fleet Flow cannot explore dispatch workflows, invoices, or settlements without spending hours entering fake records. There is no one-click "Load Sample Fleet Data" toggle.
4. **Missing In-App Support & Help Center**: Users experiencing issues have no built-in ticketing or help desk to submit bug reports, ask billing questions, or attach screenshots.
5. **No Onboarding Progress Checklist**: Operators have no clear visual progress indicator guiding them through initial setup (e.g. Set GSTIN → Add 1st Truck → Add 1st Driver → Book 1st Trip).
6. **No Compliant Data Export & Offboarding Process**: Customers who choose to leave have no one-click "Export Entire Workspace" archive to download all LRs, invoices, and ledger books. There is no formalized 7-year GST data retention policy or safe account deletion workflow.

---

## 2. Root Cause Analysis (RCA)
- **Developer-Centric Setup**: Past testing relied on developer seed scripts (`billingSeedService.ts`) rather than self-service UI onboarding tools designed for non-technical fleet owners.
- **Absence of Batch File Parsing**: No file streaming or Excel parsing library (`xlsx` / `csv-parser`) was integrated for bulk entity ingestion.

---

## 3. Implementation Solution & Target Architecture

### A. First-Login Setup Wizard Stepper
- When `company.is_onboarding_completed !== true`, routes the user to `/onboarding/setup`:
  - **Step 1: Business Profile**: Enterprise name, state GSTIN, registered office, official phone.
  - **Step 2: Operational Preferences**: Base currency, LR prefix (`LR-`), Invoice prefix (`INV-`), default tax charge type (RCM vs Forward Charge).
  - **Step 3: Fleet Seeding**: Option to upload CSV, add 1 truck, or click **"Load Demo Fleet & Trips"**.
  - **Step 4: Team Collaboration**: Invite co-workers (dispatchers, accountants) via email.
  - Marks `is_onboarding_completed: true` upon completion.

### B. Interactive Demo Fleet Generator & Cleaner
- Endpoint `POST /api/company/demo-data/seed`:
  - Seeds 3 realistic commercial trucks (Tata Signa 4825.TK, BharatBenz 3528C, Eicher Pro 3019).
  - Seeds 3 drivers with KYC documents and commercial licenses.
  - Seeds 2 billing customer parties (e.g. Reliance Retail Logistics, Tata Consumer Products).
  - Seeds 2 active journeys with live milestone checkpoints and 3 LRs.
- Endpoint `DELETE /api/company/demo-data/clear`:
  - One-click deletion of all records flagged `is_demo_record: true` when the customer is ready to input live freight.

### C. Bulk CSV / Excel Import Engine with Detailed Validation
- Build `backend/src/utils/bulkImportService.ts`:
  - Downloadable starter templates:
    - `fleet_trucks_template.xlsx`
    - `driver_roster_template.xlsx`
    - `parties_customers_template.xlsx`
  - Upload endpoints:
    - `POST /api/fleet/trucks/bulk-import`
    - `POST /api/fleet/drivers/bulk-import`
    - `POST /api/parties/bulk-import`
  - Validation & Error Reporting:
    - Parses files row by row.
    - Validates regex formats (Vehicle registration format `^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$`, GSTIN format).
    - If errors exist, returns `{ success_count: 14, error_count: 2, errors: [{ row: 5, field: 'gstin', message: 'Invalid checksum' }] }` and generates a downloadable annotated error Excel file.

### D. Dismissible Onboarding Checklist Widget
- Persistent dashboard card on `/dashboard`:
  - [x] Register Company Profile
  - [x] Add Fleet Trucks (1/5)
  - [ ] Add Commercial Driver
  - [ ] Generate 1st Lorry Receipt (LR)
  - [ ] Issue 1st Freight Invoice
- Displays dynamic progress bar (e.g. "40% Completed"). Can be dismissed once all steps are checked.

### E. In-App Support Desk & Ticket Tracking
- Model `SupportTicket.ts`:
  - `company_id`, `ticket_no` (`TICK-2026-0001`), `created_by`, `subject`, `category` (`billing`, `dispatch`, `compliance`, `bug`), `priority`, `status` (`open`, `in_review`, `resolved`), `messages` array, `attachments`.
- UI modal accessible via header help icon:
  - Submit query with screenshot upload.
  - View real-time status and replies from platform super-administrators.

### F. Full Workspace Export & Safe Offboarding
- Endpoint `POST /api/company/export-all`:
  - Asynchronously compiles a complete, password-protected ZIP archive:
    - `trucks.xlsx`
    - `drivers.xlsx`
    - `parties.xlsx`
    - `journeys.xlsx`
    - `lorry_receipts.xlsx`
    - `invoices.xlsx`
    - `general_ledger.xlsx`
    - All uploaded statutory PDF compliance documents from vault.
- Account Deletion & Retention Policy:
  - Two-factor confirmed deletion request (`POST /api/company/delete-request`).
  - Initiates 30-day grace period with read-only data access.
  - Compliance with Indian GST Rule 56(16): Retains encrypted financial audit logs for statutory 72-month period before permanent hard-deletion.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/SupportTicket.ts` | Schema for customer support requests, priority, and chat messages |
| `backend/src/utils/bulkImportService.ts` | Multi-entity CSV/Excel parsing, validation, and error reporting engine |
| `backend/src/utils/demoDataSeeder.ts` | One-click demo fleet generator and cleanup utility |
| `backend/src/controllers/supportController.ts` | Support ticket submission, message threads, and super-admin triage |
| `backend/src/controllers/importExportController.ts` | Bulk imports and full workspace ZIP archive data exporter |
| `backend/src/routes/supportRoutes.ts` | Mount `/api/support/tickets` and `/api/company/export-all` |
| `frontend/src/pages/onboarding/SetupWizardPage.tsx` | 4-step first-login setup wizard with interactive guidance |
| `frontend/src/components/dashboard/OnboardingChecklistCard.tsx` | Interactive progress checklist card on main dashboard |
| `frontend/src/components/common/BulkImportModal.tsx` | Modal with downloadable sample templates and drag-and-drop file upload |
| `frontend/src/pages/support/SupportTicketsPage.tsx` | Customer support ticket inbox and submission studio |
| `backend/src/scripts/verifyOnboardingFlows.ts` | Test script verifying demo seeding, cleanup, bulk import, and full ZIP export |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Testing the First-Login Setup Wizard
1. **Trigger Setup Wizard**:
   - Register a fresh tenant account or open `http://localhost:5173/onboarding/setup`.
2. **Step Through the 4-Step Stepper**:
   - Step 1 (Company Details): Enter Name `Apex Roadways Pvt Ltd`, GSTIN `27AABCA1234B1Z5`, and State `Maharashtra`. Click **"Next Step"**.
   - Step 2 (Primary Hub): Enter Hub Name `Bhiwandi Central Branch`. Click **"Next Step"**.
   - Step 3 (Operating Model): Select `Full Truckload (FTL) + Market Fleet`. Click **"Next Step"**.
   - Step 4 (Finish): Click **"Launch Workspace"**.
3. **What You Should See on the Screen**:
   - You land on the main dashboard with confetti animation.
   - An interactive onboarding checklist widget is pinned to the dashboard showing *2 of 5 Steps Completed*.
   - Company details and branches reflect the configured values immediately.

---

### Test 2: One-Click Demo Fleet Seeder & One-Click Cleanup
1. **Load Sample Data**:
   - On the dashboard onboarding checklist, click the button: **"Explore with Sample Fleet Data"**.
   - In the modal dialog, click **"Load Demo Data"**.
2. **Verify Demo Records Created**:
   - In the sidebar, visit **Fleet & Trucks** (`/fleet/trucks`): 5 realistic demo vehicles appear with registration numbers, mileage, and documents.
   - Visit **Consignments** (`/consignments`): 10 sample LRs appear with routes and statuses.
   - A top persistent banner displays:  
     > 💡 *You are viewing sample demo data.* [Clear Sample Data]
3. **One-Click Cleanup**:
   - Click the **"Clear Sample Data"** button in the banner.
   - Confirm by clicking **"Delete Demo Records"**.
   - **What you should see**: All demo trucks, drivers, and LRs are purged cleanly. Zero demo debris is left behind.

---

### Test 3: Bulk Excel Import with Validation Error Highlighting
1. **Download Template & Upload File**:
   - Navigate to **Fleet & Trucks** (`/fleet/trucks`).
   - Click the **"Bulk Import"** button in the top action toolbar.
   - Click **"Download Sample Excel (.xlsx)"** to save the pre-formatted template.
   - Drag and drop an Excel file containing 3 valid vehicle rows and 1 invalid row (e.g. invalid registration number format `INVALID-TRUCK`).
   - Click **"Validate File"**.
2. **What You Should See on the Screen**:
   - A visual pre-import preview displays:
     - 🟢 *3 Rows Valid*
     - 🔴 *Row 4 Error: Invalid Indian vehicle registration format (Expected e.g. MH12AB1234)*
   - Click **"Import 3 Valid Vehicles"**.
   - The 3 valid trucks are immediately created in your fleet, and the modal displays a green completion summary.

---

### Test 4: Full Workspace Export & Safe Offboarding
1. **Request Complete Data Export**:
   - In the sidebar, navigate to **Settings** -> **Data Export & Privacy** (`/settings/export`).
   - Under "Complete Workspace Data Archive", click **"Export All Data (ZIP)"**.
   - Type your account password to confirm identity.
   - Click **"Generate Archive"**.
2. **What You Should See on the Screen**:
   - A progress bar appears: *"Packaging fleet, trips, invoices, and documents..."*
   - Browser downloads a file named `Apex_Roadways_Full_Backup.zip`.
   - Unzip the archive: verify structured JSON and CSV spreadsheets for `trucks/`, `drivers/`, `trips/`, `consignments/`, `invoices/`, and `ledger/`.

