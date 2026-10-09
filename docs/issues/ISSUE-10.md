# Issue 10 — Customer, Driver, and Vendor Self-Service Portals

## Metadata
- **Severity**: P1 (High)
- **Status**: Documented & Ready for Implementation
- **Category**: External Stakeholder Portals, Role Scoping, PII Sanitization & Self-Service
- **Date**: October 10, 2026

---

## 1. Problem Statement
The application currently only provides an internal employee/admin workspace dashboard (`/dashboard`). There are no isolated self-service portals for external logistics stakeholders:
1. **Risk of Internal Workspace Overexposure**: If a customer, driver, or fleet broker requires access to invoices or documents, granting them an internal user account risks exposing sensitive enterprise data (internal freight profit margins, driver settlements, other customer rates, and company general ledgers).
2. **Missing Customer Self-Service**: Shippers (Billing Parties) cannot log in to view their active consignments, download PDF tax invoices, review statement balances, or download delivery POD receipts without emailing or calling dispatchers.
3. **Missing Driver Self-Service**: Drivers cannot check their assigned route orders, submit enroute expense receipts (toll/diesel slips), upload signed PODs from their phones, or review detailed settlement deductions.
4. **Missing Vendor & Fleet Supplier Self-Service**: Attached market truck owners and fuel pump vendors cannot verify dispatched loads, upload vehicle compliance renewals, or track outstanding payables and TDS deductions.
5. **PII and Financial Leakage Risks in Public Tracking**: Public tracking endpoints (`/api/public/track/:lrNumber`) must guarantee that confidential financial details (freight amounts, advances, carrier margin) and personal identification information (full phone numbers, Aadhaar numbers) are completely stripped from responses.

---

## 2. Root Cause Analysis (RCA)
- **Monolithic User Role Model**: RBAC supported `admin`, `dispatcher`, `accountant`, `viewer`, but had no external entity principal types (`customer_contact`, `driver_principal`, `vendor_principal`).
- **Absence of OTP / Magic-Link Flow**: External stakeholders typically do not maintain enterprise passwords; they require lightweight mobile phone SMS/WhatsApp OTP or cryptographic magic links.

---

## 3. Implementation Solution & Target Architecture

### A. Scoped External Principal Architecture
Create an external authentication and session mechanism in `backend/src/middleware/externalPortalAuth.ts`:
- Token payload: `{ portalType: 'customer' | 'driver' | 'vendor', entityId: string, companyId: string }`.
- Scoping rule: Downstream handlers strictly bind queries to `entityId` and `companyId`, making it impossible to query unauthorized records.

### B. Customer Self-Service Portal (`/portal/customer`)
- **Authentication**: Phone or Email OTP verification matching `BillingParty.contact_person_phone`.
- **Capabilities**:
  - Live Consignment Tracking: View all in-transit and delivered LRs linked to `billing_party_id`.
  - Document Downloads: Stamped delivery receipts, weight slips, and e-PODs.
  - Invoices & Statements: View issued freight invoices, payment status (`paid`, `partially_paid`, `unpaid`), TDS deducted, and download Statements of Account (SOA).
  - Rate Request: Submit a new dispatch load booking inquiry.
- **Data Protection**: Strips internal carrier costs, truck broker commission, and driver wage payouts.

### C. Driver Self-Service Portal (`/portal/driver`)
- **Authentication**: Phone OTP matching `Driver.phone`.
- **Capabilities**:
  - Assigned Trips: Route origin, destination checkpoints, consignee contact numbers.
  - Expense Slip Upload: Take mobile photos of diesel receipts, toll receipts, and repair bills.
  - Delivery Execution & e-POD: Capture consignee on-screen touch signature and camera photo of physical stamped LR.
  - Settlement Statement: View transparent itemized statement (Trip allowance + Approved expenses - Advances - Deductions = Net payout).

### D. Vendor & Supplier Portal (`/portal/vendor`)
- **Authentication**: Phone or Email OTP matching `BalanceParty.contact_phone`.
- **Capabilities**:
  - Market Truck Suppliers: View attached market vehicle trips, submit invoice for balance freight, upload updated vehicle insurance/fitness documents.
  - Fuel Pump Vendors: View diesel slips issued to drivers, audit literage and rates against pump logs, review payment remittances.

### E. Public Consignment Tracking Data Sanitization
Enforce strict zero-leakage payload sanitizer on `GET /api/public/track/:lrNumber`:
- **Allowed Attributes**: Consignment LR Number, Booking Date, Origin City, Destination City, Cargo Package Count & Description, Public Milestone Timeline, Vehicle Type (masked registration, e.g. `MH12****45`).
- **Forbidden / Stripped**: Freight Amount, Advance Paid, Balance Amount, Billing Party Name/GSTIN, Driver Phone Number, Driver Aadhaar Number, Internal Operational Notes.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/PortalSession.ts` | Schema for temporary OTPs and external portal JWT sessions |
| `backend/src/middleware/externalPortalAuth.ts` | Guard enforcing strict entity-level boundary scoping |
| `backend/src/controllers/customerPortalController.ts` | Handlers for customer consignment tracking and invoice downloads |
| `backend/src/controllers/driverPortalController.ts` | Handlers for driver trip updates, expense uploads, and e-POD |
| `backend/src/controllers/vendorPortalController.ts` | Handlers for vendor load tracking, bill submissions, and payables |
| `backend/src/routes/portalRoutes.ts` | Mount `/api/portal/customer`, `/api/portal/driver`, `/api/portal/vendor` |
| `backend/src/controllers/trackingController.ts` | Strict PII and financial data sanitization on public tracking responses |
| `frontend/src/pages/portal/CustomerPortalPage.tsx` | Clean self-service portal for shippers and freight customers |
| `frontend/src/pages/portal/DriverPortalPage.tsx` | Mobile-optimized driver trip, expense, and settlement interface |
| `frontend/src/pages/portal/VendorPortalPage.tsx` | Supplier dashboard for attached truck owners and fuel vendors |
| `backend/src/scripts/verifyPortalSecurity.ts` | Automated test suite validating that external tokens cannot read unauthorized records or internal finances |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Customer Self-Service Portal Login via Mobile OTP
1. **Open Customer Portal**:
   - In an incognito browser window, navigate to: `http://localhost:5173/portal/customer`.
   - Enter registered mobile number: `9876543210` (Party: *Tata Motors Logistics*).
   - Click **"Send Verification Code"**.
2. **Verify OTP & Access Consignments**:
   - Enter the test OTP code: `123456`.
   - Click **"Log In to Portal"**.
3. **What You Should See on the Screen**:
   - The customer portal dashboard opens displaying: *Welcome, Tata Motors Logistics*.
   - Consignment tracking tab shows all active and past shipments booked by Tata Motors.
   - Click on any consignment to download the official delivery receipt and signed POD copy.
   - **Isolation Check**: Transporter profit margins, internal driver wages, and other companies' cargo are 100% hidden.

---

### Test 2: Customer Invoices & Ledger Statement Review
1. **Navigate to Customer Invoices**:
   - In the Customer Portal navigation, click **"Invoices & Payments"**.
2. **What You Should See on the Screen**:
   - Clean view of all invoices billed to Tata Motors (e.g. `INV-2026-0084`).
   - Payment status badge shows `PENDING` with outstanding amount `₹39,900.00`.
   - Click **"Download Tax Invoice"**: downloads authorized PDF invoice.
   - Click **"Download Statement of Account"**: downloads customer balance statement.

---

### Test 3: Vendor / Attached Truck Supplier Portal
1. **Open Vendor Portal**:
   - Navigate to: `http://localhost:5173/portal/vendor`.
   - Enter vendor mobile number: `9822001122` (Vendor: *Shree Ram Fleet Owners*).
   - Verify OTP `123456`.
2. **Inspect Assigned Loads & Payables**:
   - The dashboard opens showing loads assigned to Shree Ram's market vehicles.
   - Payables summary shows: *Gross Agreed Freight, Advances Received, Pending Balance*.
   - Click **"Submit Expense Slip"**: vendor can upload diesel receipts or toll slips directly from the browser.
   - The end-customer selling rate is strictly confidential and absent from the vendor screen.

