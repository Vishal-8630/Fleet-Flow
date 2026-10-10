# Issue 09 — Complete Commercial and Accounting Operations

## Metadata
- **Severity**: P1 (High)
- **Status**: ✅ Resolved & Verified
- **Category**: Commercial Operations, Indian GST, E-Way Bill, E-Invoicing (IRN), Tally Sync & AR/AP Aging
- **Date**: October 10, 2026

---

## 1. Problem Statement
The commercial billing and accounting engine covers basic 3-part LRs and GST invoices, but lacks essential Indian transport compliance features and enterprise accounting workflows:
1. **Missing E-Way Bill Integration**: Transporters in India are legally mandated to generate and update E-Way Bills (Part-A and Part-B vehicle updates) for consignments exceeding ₹50,000. Transshipment (vehicle breakdown requiring truck change) currently has no Part-B vehicle update flow.
2. **Missing E-Invoicing & IRN (Invoice Registration Number)**: B2B freight invoices above turnover thresholds require real-time Invoice Registration Portal (IRP) validation, producing a 64-character IRN hash and a digitally signed QR code.
3. **No Credit Notes / Debit Notes**: If freight charges are disputed, cargo is damaged, or fuel price escalation is applied, there is no mechanism to issue formal GST-compliant Credit/Debit Notes referencing the original invoice.
4. **No Customer Payment Aging (DSO) & Vendor Statements**: Finance teams cannot view aged receivables (0-30, 31-60, 61-90, 90+ days) or generate itemized Statements of Account (SOA) for shippers and fuel pump vendors.
5. **Absence of Tally ERP / Accounting Export**: Indian logistics enterprises rely on Tally Prime for year-end statutory books. The system does not generate standard Tally XML/JSON import vouchers for sales, receipts, and payments.
6. **Rigid Document Templates & No Barcode/QR Printing**: LR and Invoice printouts lack configurable company letterhead formatting, Code-128 barcodes for warehouse scanners, dynamic UPI collection QR codes, and document reprint audit tracking.
7. **Missing P&L & Profitability Reports**: Operators cannot view trip profitability margins, customer profit rankings, or fleet fuel consumption benchmarks.

---

## 2. Root Cause Analysis (RCA)
- **Basic CRUD Invoicing**: Early phases focused on entering freight weights and rates without integrating government GSP (GST Suvidha Provider) APIs.
- **Single Invoice Lifecycle**: Invoices transitioned only between draft and paid without accommodating accounting adjustments (Credit Notes, TDS reconciliation certificates).

---

## 3. Implementation Solution & Target Architecture

### A. E-Way Bill & E-Invoicing Engine (`ewayBillService.ts`)
- GSP API integration (supporting NIC Sandbox / ClearTax / MastersIndia):
  - **Generate E-Way Bill**: Sends consignor/consignee GSTIN, HSN Code (9965 for GTA), invoice value, vehicle registration number. Stores 12-digit E-Way Bill Number and validity timestamp.
  - **Part-B Vehicle Updation**: When a truck is changed on an active trip due to breakdown or transshipment hub transfer, automatically pushes updated vehicle registration number to the NIC portal.
  - **IRN Generation**: Submits B2B freight invoice schema (e-Invoice JSON Schema 1.1) to IRP; retrieves and stores IRN hash, Ack No, and digitally signed QR code image.

### B. Credit Notes, Debit Notes & Adjustments (`CreditNote.ts`)
- Schema:
  - `credit_note_no`, `original_invoice_id`, `company_id`, `party_id`, `type` (`credit_note` | `debit_note`), `reason` (`rate_difference`, `shortage_damage`, `discount`, `cancellation`).
  - Itemized adjustments with CGST, SGST, IGST recalculation.
  - Auto-posts adjusting entries to General Ledger and reduces customer outstanding receivables.

### C. Accounts Receivable (AR) Aging & Statements of Account (SOA)
- Endpoint `GET /api/commercial/aging`:
  - Groups unpaid and partially paid invoices by aging buckets:
    - **Current**: 0–30 days
    - **Bucket 1**: 31–60 days
    - **Bucket 2**: 61–90 days
    - **Delinquent**: 90+ days
  - Calculates Days Sales Outstanding (DSO) metric per customer.
- Endpoint `GET /api/parties/:id/statement-pdf`:
  - Produces official PDF Statement of Account showing Opening Balance, all LRs billed, Invoices issued, Bank/UPI receipts, TDS deductions, and Net Closing Payable.

### D. Tally ERP Prime XML Export (`tallyExportService.ts`)
- Endpoint `GET /api/commercial/export/tally?from=&to=&type=sales`:
  - Formats standard Tally XML schema `<ENVELOPE><BODY><IMPORTDATA>...`:
    - **Sales Voucher**: Freight revenue credited to Freight Income Ledger, customer account debited.
    - **Receipt Voucher**: Bank/Cash debited, customer account credited with TDS deduction.
    - **Payment Voucher**: Driver trip settlements and fuel pump payments.
  - Allows one-click XML download and direct import into Tally Prime without manual data re-entry.

### E. Professional Print Engine with Barcode & UPI Dynamic QR
- Enhanced Printable Documents (`entryController.ts`, `invoiceController.ts`):
  - Embeds Code-128 barcode of LR number for fast optical scanner processing at loading docks.
  - Generates dynamic Indian UPI payment QR code (`upi://pay?pa=...&am=...&tn=Invoice_INV-001`) on invoices for instant mobile payment collection.
  - Watermark stamp for "ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER", and "TRIPLICATE FOR CONSIGNOR".
  - Audit trail tracking every document reprint (user, timestamp, IP).

### F. Enterprise Commercial Intelligence Reports
- `GET /api/reports/trip-profitability`:
  $$\text{Margin \%} = \frac{\text{LR Freight Revenue} - (\text{Trip Diesel} + \text{Toll} + \text{Driver Settlement} + \text{Brokerage})}{\text{LR Freight Revenue}} \times 100$$
- `GET /api/reports/customer-profitability`:
  - Ranks customers by gross revenue, volume moved (MT), profit margin %, and average payment delay days.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/CreditNote.ts` | Schema for GST Section 34 Credit and Debit notes |
| `backend/src/models/Invoice.ts` | Add IRN, signed QR code, E-Way Bill numbers, and Credit Note references |
| `backend/src/models/Entry.ts` | Add E-Way Bill Part-A and Part-B fields and expiry timestamps |
| `backend/src/utils/ewayBillService.ts` | E-Way Bill generation and vehicle transshipment updater |
| `backend/src/utils/tallyExportService.ts` | Tally XML voucher generator for Sales, Receipts, and Payments |
| `backend/src/controllers/commercialReportController.ts` | AR Aging matrix, customer SOA, and trip profitability reporting |
| `backend/src/routes/commercialReportRoutes.ts` | Mount commercial reporting, aging, and Tally export endpoints |
| `frontend/src/pages/commercial/AgingReportPage.tsx` | UI Accounts Receivable aging dashboard with customer DSO filters |
| `frontend/src/pages/commercial/CreditNoteListPage.tsx` | Credit/Debit note creation and management studio |
| `backend/src/scripts/verifyCommercialAccounting.ts` | Test script verifying GST tax math, aging calculations, and Tally XML schema |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Creating a GST Freight Invoice with E-Way Bill & QR Code
1. **Navigate to Invoicing**:
   - Log in as Billing Executive or Admin at `http://localhost:5173/login`.
   - In the sidebar, navigate to **Commercial & Billing** -> **Invoices** (`/commercial/invoices`).
2. **Generate New Invoice**:
   - Click the **"+ New Invoice"** button.
   - Select Customer: `Tata Motors Logistics Ltd` (GSTIN: `27AAACT2727Q1ZW`).
   - In the "Select Unbilled LRs" table, check the boxes for:
     - `LR-2026-9041` (Freight: `₹18,000`)
     - `LR-2026-9042` (Freight: `₹22,000`)
   - Notice Subtotal updates to `₹40,000.00`.
   - Select GST Rate: `5% GTA Forward Charge`.
   - Enter E-Way Bill Number: `181029485721`.
   - Click **"Generate & Finalize Invoice"**.
3. **What You Should See on the Screen**:
   - Invoice is created with sequence `INV-2026-0084`.
   - Click the **"Print / Preview PDF"** button.
   - The rendered tax invoice displays:
     - Proper SAC Code `996511` (Goods transport services by road).
     - Accurate tax computation: Subtotal `₹40,000`, CGST (2.5%) `₹1,000`, SGST (2.5%) `₹1,000`, Grand Total `₹42,000.00`.
     - Valid 12-digit E-Way Bill number printed prominently.
     - Scannable dynamic B2B QR code on the top-right corner.

---

### Test 2: Issuing a Credit Note for Freight Adjustment
1. **Issue Credit Note from Invoice**:
   - Open Invoice `INV-2026-0084` from the invoice table.
   - In the top action bar, click **"Issue Credit Note"**.
2. **Fill Adjustment Details**:
   - Select Reason: `Rate difference / post-delivery volume discount`.
   - Freight Adjustment Amount: `2000`.
   - Click **"Create Credit Note"**.
3. **What You Should See on the Screen**:
   - Credit Note `#CN-2026-0012` is generated and linked to the parent invoice.
   - GST adjustment is computed automatically (`₹100` tax credit).
   - On the invoice card, the net collectible balance immediately reduces from `₹42,000` to `₹39,900.00`.

---

### Test 3: Inspecting Accounts Receivable (AR) Aging Dashboard
1. **Open Aging Report**:
   - In the sidebar, click **Financials** -> **AR Aging Report** (`/financials/aging`).
2. **What You Should See on the Screen**:
   - Aging bucket summary cards across the top:
     - `Current (0-30 Days)`
     - `31-60 Days`
     - `61-90 Days`
     - `>90 Days Overdue` (highlighted in red)
   - The customer table displays outstanding balances per bucket.
   - Locate `Tata Motors Logistics Ltd`: click **"Download Statement of Account (SOA)"** to verify complete customer ledger export.

---

### Test 4: Exporting Accounting Vouchers to Tally XML
1. **Trigger Tally Export**:
   - Navigate to `/commercial/invoices`.
   - Click the **"Export to Tally (XML)"** button in the table toolbar.
   - Select Date Range: `Current Month`. Click **"Download XML"**.
2. **What You Should See on the Screen**:
   - A file named `Tally_Sales_Vouchers.xml` downloads to your computer.
   - Open the file in a browser or text editor: verify standard `<ENVELOPE>`, `<TALLYMESSAGE>`, and `<VOUCHER VCHTYPE="Sales">` XML tags ready for direct import into TallyPrime.

