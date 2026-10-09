# Phase 2: Master Data Registries & Compliance Vault

**Phase Objective:** Build secure, multi-tenant master data registries for fleet assets, drivers, compliance documents, customers, and vendors, backed by AWS S3 presigned storage, PII masking, and server-side paginated queries.

---

## 1. Fleet & Truck Master Registry (`MOD_FLEET`)

### 1.1 Data Model (`backend/src/models/Truck.ts`)
* **Core Specs:** `truck_no` (unique per tenant, trimmed, uppercase), `make`, `model`, `year`, `body_type` (Open, Container, Trailer, Tanker), `tonnage_capacity`, `cbm_capacity`.
* **Maintenance Tracking:** `last_service_kms`, `service_interval_kms` (default: 10,000 km), `next_service_due_kms`.
* **Assignment History:** `driver_assignments: [{ driver_id, assigned_at, unassigned_at, notes }]`.
* **Active Status:** `status` (`available` | `on_trip` | `in_maintenance` | `decommissioned`), `is_deleted` (soft-delete).
* **Tenant Scoped:** Managed by `tenantPlugin`.

### 1.2 Digital Compliance Vault
Every truck includes 6 mandatory statutory documents:
1. `fitness_doc`: URL, expiry_date, certificate_number
2. `insurance_doc`: URL, expiry_date, policy_number, insurer_name
3. `national_permit_doc`: URL, expiry_date, permit_number
4. `state_permit_doc`: URL, expiry_date, permit_number
5. `road_tax_doc`: URL, expiry_date, receipt_number
6. `puc_doc` (Pollution): URL, expiry_date, certificate_number

* **Computed Compliance Indicator:** Virtual property `compliance_status` returns:
  * `EXPIRED` if any document expiry < today.
  * `EXPIRING_SOON` if any document expiry is within 15 days.
  * `COMPLIANT` if all documents are valid beyond 15 days.

---

## 2. Driver Master Registry & Identity KYC (`MOD_DRIVERS`)

### 2.1 Data Model (`backend/src/models/Driver.ts`)
* **Personal & Contact:** `name`, `photo_url`, `phone` (10–15 digits), `emergency_phone`, `address`, `date_of_birth`.
* **Credentials & PII Vault:**
  * `license_number` (unique per tenant), `license_expiry_date`, `license_front_url`, `license_back_url`.
  * `aadhaar_number` (encrypted/masked, e.g., `XXXX-XXXX-1234`), `aadhaar_front_url`, `aadhaar_back_url`.
* **Financial Ledger Balances:**
  * `running_advance_balance` (decimal-safe numeric representation in paise).
  * `amount_company_owes_driver` / `amount_driver_owes_company`.
  * `last_settlement_date`, `last_settlement_id`.
* **Vehicle Assignment:** `current_truck_id`, `assignment_history: [{ truck_id, assigned_at, unassigned_at }]`.
* **Status:** `status` (`active` | `on_leave` | `terminated`), `is_deleted`.

### 2.2 Security & PII Protection
* Aadhaar numbers are never returned in full plaintext via generic list APIs.
* Full numbers and document images are accessible exclusively to users with `admin` or `accountant` roles.

---

## 3. Commercial Partners: Billing & Balance Parties (`MOD_PARTIES`)

### 3.1 Billing Parties (`backend/src/models/BillingParty.ts`)
* Shippers, consignors, and consignees invoiced for freight services.
* Fields: `name`, `trade_name`, `gstin` (validated against Indian GST regex), `pan_number`, `billing_address` (street, city, state, postal_code, state_code), `payment_terms_days` (default 30), `credit_limit`.
* Tracks aggregate outstanding receivables.

### 3.2 Balance Parties (`backend/src/models/BalanceParty.ts`)
* Market truck suppliers, vehicle brokers, and sub-contracted transport providers.
* Fields: `party_name`, `contact_person`, `phone`, `pan_number`, `bank_details` (account_number, ifsc_code, bank_name), `opening_balance`.
* Tracks sub-contracted freight payables and commission balances.

---

## 4. Secure File Storage & S3 Upload Pipeline (`MOD_DOC_VAULT`)

### 4.1 Tenant-Partitioned Storage Path
$$\text{s3://bucket/tenants/}\{\text{company\_id}\}/\{\text{entity\_type}\}/\{\text{year\_month}\}/\{\text{uuid}\}.\{\text{ext}\}$$

### 4.2 Multer Streaming Middleware
* Validates MIME types strictly: `application/pdf`, `image/jpeg`, `image/png`. Max file size: 10 MB.
* Buffers are uploaded directly to S3 via `@aws-sdk/client-s3` without persisting unencrypted temporary files to server disks.

### 4.3 Authorized Presigned URL Dispatcher
* Endpoint `GET /api/documents/presigned-url?key=...`:
  1. Verifies that the requested key starts with `tenants/{req.tenant.id}/`.
  2. Issues an AWS S3 presigned GET URL with a 15-minute TTL.
  3. Rejects cross-tenant key requests with `403 Forbidden`.

---

## 5. UI Views & Server-Side Paginated Architecture

### 5.1 Reusable Paginated Table Hook (`useServerTable`)
* Automatically syncs pagination (`page=1`, `limit=25`), sort column (`sort=truck_no`, `order=asc`), and search query (`q=MH12`) with the browser URL query string.
* TanStack Query caches responses per query key: `['trucks', tenantId, { page, limit, q, filter }]`.

### 5.2 Screens Built in Phase 2
1. `/fleet/trucks` — Fleet roster with compliance status badges (`COMPLIANT`, `EXPIRING_SOON`, `EXPIRED`) and quick filters.
2. `/fleet/trucks/:id` — Truck detail, compliance vault preview, download actions, driver assignment history, and edit modal.
3. `/fleet/drivers` — Driver roster, masked credentials, current truck assignment, advance balances.
4. `/fleet/drivers/:id` — Driver KYC profile, license/Aadhaar document drawer, payment history.
5. `/parties/billing` — Customer billing parties directory with GST verification tags.
6. `/parties/balance` — Vendor balance parties directory with payable summaries.

---

## 6. Phase 2 Verification & Acceptance Criteria

1. **Compliance Expiry Alert Accuracy:** Insert truck documents with expiries in 5 days, 30 days, and past dates; verify dashboard and list statuses accurately calculate `EXPIRING_SOON` and `EXPIRED`.
2. **Aadhaar Masking Test:** Inspect network response of `GET /api/driver`; verify Aadhaar numbers display as `XXXX-XXXX-1234` without leaking full digits.
3. **S3 Presigned Access Boundary:** Attempt to access an S3 key owned by Company B via Company A's presigned URL endpoint; verify rejection with `403 Forbidden`.
4. **Soft-Delete Integrity:** Soft-delete a truck; verify it is omitted from active dispatch dropdowns but remains intact in historical journey records.
