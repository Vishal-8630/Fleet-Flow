# FEAT-011: Complete Tenant Data Export & Compliant Offboarding Archival Engine

**Feature ID:** `FEAT-011`  
**Title:** Complete Tenant Data Export and Compliant Offboarding Archival Engine  
**Category:** Data Governance, Legal Compliance & Portability  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)

---

## 1. Problem Statement & Target User
Enterprise transport clients must have the contractual ability to export their entire operational and financial dataset upon subscription termination, and to request compliant data decommissioning (offboarding / Right to be Forgotten). Fleet Flow currently has no bulk data export engine and no structured tenant offboarding lifecycle. If an enterprise leaves the platform, engineers have to perform risky manual MongoDB queries to extract records, and dormant tenant data remains unpurged in production databases indefinitely.
- **Target User:** Company Administrators, Chartered Accountants, and Legal Compliance Officers.

---

## 2. Business Value & Intended Outcome
- Eliminate enterprise vendor lock-in concerns during enterprise sales procurement.
- Comply with Indian Digital Personal Data Protection Act (DPDP Act 2023) and GDPR data portability mandates.
- Provide a self-service "Export All Company Data" button generating a password-protected ZIP archive containing clean CSV/Excel spreadsheets of all LRs, invoices, trips, ledger journals, and document attachments.
- Provide a structured 30-day soft-delete grace period followed by cryptographic data purging.

---

## 3. Workflow & Architecture
1. **Initiate Export:** Tenant Admin navigates to `/settings/company` -> "Data Portability & Export".
2. **Asynchronous Packaging (BullMQ Task):**
   - The backend worker queries all records matching `{ company_id: currentTenant }`:
     - `lorry_receipts.csv`
     - `tax_invoices.csv`
     - `trip_settlements.csv`
     - `general_ledger_journal.csv`
     - `fleet_vehicles.csv`
     - `drivers.csv`
     - `parties.csv`
   - Bundles documents into a compressed ZIP file encrypted with a user-supplied passphrase.
   - Generates an expiring S3 pre-signed download URL (valid 24 hours).
3. **Tenant Offboarding & Decommissioning:**
   - Admin requests account cancellation.
   - Status transitions to `'decommission_pending'`. All write access is immediately locked.
   - 30-day statutory grace period: Read-only access permitted for export.
   - Day 30+: An automated job purges PII, de-identifies financial ledger history, and hard-deletes uploaded media from S3.

---

## 4. API Endpoints & Contracts
- `POST /api/company/export/initiate`: Queues bulk export background job.
- `GET /api/company/export/status`: Returns job progress percentage and download URL upon completion.
- `POST /api/company/decommission/request`: Initiates 30-day offboarding countdown (requires admin password).
- `POST /api/company/decommission/cancel`: Aborts pending decommissioning.

---

## 5. Acceptance Criteria
- [ ] Exporting data generates a complete, uncorrupted ZIP archive containing all operational and accounting records.
- [ ] Decommissioned companies cannot create new records or dispatches.
- [ ] Expired offboarded tenant data is permanently purged in compliance with data privacy policies.

---

## 6. Definition of Done
1. Background export worker and endpoints implemented.
2. Verified in end-to-end data export and decommissioning drill.
