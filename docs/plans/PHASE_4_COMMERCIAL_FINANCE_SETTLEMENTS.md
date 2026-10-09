# Phase 4: Commercial Engine — LR, Invoicing, Settlements & Ledger

**Phase Objective:** Build the commercial and accounting backbone—3-part printable Lorry Receipts, GST-compliant freight tax invoicing with client-side PDF rendering, ACID-transactional driver settlements with diesel variance math, and a 17-category double-entry general ledger.

---

## 1. Lorry Receipt (LR / Bilty) Engine (`MOD_LR_ENGINE`)

### 1.1 Data Model (`backend/src/models/Entry.ts`)
* **Identifiers:** `bill_no` (auto-sequenced), `bill_date`, `lr_no` (unique per company, auto-sequenced or manual), `lr_date`.
* **Parties:** `billing_party_id` (Ref BillingParty), `consignor: { name, address, gstin }`, `consignee: { name, address, gstin }`.
* **Consignment Details:**
  * `vehicle_number`, `from_location`, `to_location`.
  * `package_count`, `packaging_type` (Bags, Drums, Pallets, Cartons).
  * `goods_description`, `declared_value`, `risk_type` (`owner_risk` | `carrier_risk`).
  * `actual_weight_tonnes`, `chargeable_weight_tonnes`, `cbm_volume`.
  * `be_number`, `be_date` (Bill of Entry for customs).
  * `container_number`, `invoice_number`, `eway_bill_number`.
  * `empty_yard_name`, `clerk_name`, `remarks`.
* **Freight Terms:** `freight_terms` (`to_be_billed` | `paid` | `to_pay`).
* **Linked Journey:** `journey_id` (optional association with fleet journey).

### 1.2 3-Part Vector Printable LR Template
* Rendered via CSS print engine (`react-to-print`) and `jsPDF`.
* Formatted to industry-standard 3-tier continuous stationary:
  1. **Consignor Copy (Sender)**
  2. **Consignee Copy (Receiver)**
  3. **Driver / POD Copy (Carrier)**
* Features company header logo, transport GSTIN, conditions of carriage, and receiver signature block.
* Accessible via `/bill-entry/lrcopy?lr_no=...` and blank template via `/bill-entry/empty-lr`.

---

## 2. GST Freight Invoicing Engine (`MOD_BILLING_INVOICE`, `MOD_GST_CONFIG`)

### 2.1 Commercial Calculations & Repeatable Extra Charges
* **Base Freight:** Charged as `fixed_rate` or $\text{weight} \times \text{rate\_per\_tonne}$.
* **Repeatable Extra Charges Array:**
  * `extra_charges: [{ charge_type: ('loading' | 'unloading' | 'halting' | 'multi_drop' | 'toll' | 'other'), rate, amount }]`.
* **Tax Engine & Reverse Charge Mechanism (RCM):**
  * Evaluates if transaction is subject to RCM (5% GST paid by consignee/shipper under Goods Transport Agency provisions).
  * If forward charge: computes `subtotal`, automatically derives state-of-supply (Intra-state $\rightarrow$ CGST + SGST; Inter-state $\rightarrow$ IGST).
  * All amounts stored as decimal-safe numbers (in paise / cents).

### 2.2 Instant Client-Side PDF Generation
* **Primary:** `jsPDF` + CSS print engine renders invoices instantly on any mobile phone or laptop browser without round-tripping to backend servers.
* **Secondary:** Headless backend Puppeteer endpoint (`/api/invoice/generate-pdf`) generates PDF binaries asynchronously strictly for automated WhatsApp or email message attachments.

---

## 3. Driver Trip Settlement Engine (`MOD_SETTLEMENTS`)

Reconciles all journeys completed by a driver across a billing period.

### 3.1 Mathematical Settlement Model
```
┌────────────────────────────────────────────────────────────────────────┐
│                        DRIVER SETTLEMENT FORMULA                       │
├────────────────────────────────────────────────────────────────────────┤
│  Driver Total Earnings =                                               │
│    (Total Kilometers Traveled × Rate per KM)                           │
│  + Approved En-Route Reimbursements                                    │
│                                                                        │
│  Driver Total Deductions =                                             │
│    Starting Cash Advances Distributed                                  │
│  + Additional Cash Advances Issued During Transit                      │
│  + (Diesel Quantity Variance Penalty, if actual km/L < benchmark km/L) │
│                                                                        │
│  Net Payable / Receivable =                                            │
│    Driver Total Earnings - Driver Total Deductions                     │
│                                                                        │
│  If Net > 0: "Company owes Driver (DRL to Pay)"                        │
│  If Net < 0: "Driver owes Company (Driver to Pay)"                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 ACID Transaction Multi-Entity Mutation
Confirmation of a settlement (`POST /api/settlements/confirm`) executes inside `mongoose.startSession()`:
1. Validates that selected journeys are not already flagged `is_settled: true`.
2. Creates immutable `Settlement` record with snapshot calculations and idempotency key.
3. Updates selected `TruckJourney` records: sets `is_settled: true`, links `settlement_ref`.
4. Updates `Driver` record: resets `running_advance_balance` to 0; updates `last_settlement_date`.
5. Inserts automated double-entry records in `Ledger`:
   * Debit: `Driver Settlement Expense`
   * Credit: `Bank / Cash Account` (or Driver Outstanding Receivable)
6. Writes audit snapshot in `AuditLog`.
7. Commits transaction. If any step fails, entire operation rolls back cleanly.

---

## 4. Double-Entry Financial General Ledger (`MOD_LEDGERS`)

### 4.1 Data Model (`backend/src/models/Ledger.ts`)
* **Core Info:** `transaction_date`, `category` (17 categories: Freight Income, Diesel Expense, Driver Advance, Driver Settlement, Halting, Tolls, Vehicle Maintenance, Repair, Office Expense, Payment Received, Payment Made, Bank Transfer, Cash Transfer, etc.).
* **Type & Balance:** `transaction_type` (`journey` | `vehicle_entry` | `settlement` | `manual_adjustment` | `payment_receipt` | `expense`), `balance_type` (`debit` | `credit`), `amount` (numeric paise).
* **Payment Instrument:** `payment_mode` (`cash` | `bank` | `upi` | `cheque` | `credit`), `reference_number` (UTR, Cheque number, Voucher number).
* **Entity Links:** Optional references to `journey_id`, `truck_id`, `driver_id`, `billing_party_id`, `settlement_id`, `vehicle_entry_id`.
* **Accounting Invariant:** Ledger entries generated by settlements or bill payments are flagged `is_auto_generated: true` and locked against direct edits. Adjustments require explicit reversal journal entries.

---

## 5. Party Balance Reconciliation (`MOD_PARTY_BALANCE`)

* Aggregates freight payables, driver cash advances, commissions, and halting fees for sub-contracted market vehicle owners (`BalanceParty`).
* One-click statement generation with date filtering and Excel spreadsheet download via `xlsx`.

---

## 6. Phase 4 Verification & Acceptance Criteria

1. **LR Vector Print Consistency:** Generate LR copy; print in browser; verify Consignor, Consignee, and POD copies align to printable boundaries without visual distortion.
2. **ACID Settlement Concurrency Test:** Fire two concurrent `confirm` requests for the same settlement ID; verify transaction lock permits exactly one execution, returning `409 Conflict` for the second without duplicate ledger entries.
3. **Decimal Arithmetic Precision:** Run settlement with 10 trips containing mixed decimal expenses; verify calculated net balance matches manual accounting spreadsheet to within ₹0.00.
4. **Ledger Immutability Test:** Attempt `DELETE /api/ledger/:id` on an auto-generated settlement ledger entry; verify API rejects with `403 Forbidden: Auto-generated accounting entries must be reversed, not deleted`.
