# DEC-003 — Production S3 and Object Storage Enforcement

## Metadata

- **Decision ID:** DEC-003
- **Title:** Production S3 and Object Storage Enforcement
- **Status:** Pending Approval
- **Date:** Pending
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)

---

## 1. Context and Problem Statement

Uploaded documents (PODs, fuel receipts, expense vouchers, vehicle RC/insurance) are currently handled via local disk or preliminary storage adapters.

## 2. Decision Statement

Enforce production-grade cloud object storage (AWS S3 or compatible S3 API) with pre-signed upload URLs, tenant-scoped object key paths (`tenants/{tenantId}/{module}/{year}/{month}/{fileId}`), server-side encryption (SSE-S3 or SSE-KMS), and restricted public bucket access. Local file storage will be prohibited in production and staging environments.

## 3. Alternatives Considered and Trade-Offs

Database GridFS storage or persistent NFS volumes were evaluated; object storage provides superior scalability, durability, and pre-signed security.

## 4. Consequences

Requires AWS S3 / MinIO infrastructure setup and credential management. Local development will use MinIO or simulated storage adapter.

## 5. Implementation Implications

Storage adapter interface must be implemented with S3 provider and MinIO support. API endpoints must switch to pre-signed URL generation for direct client uploads.

## 6. Acceptance Criteria and Verification Requirements

- [ ] DEC-003 remains PENDING APPROVAL. No implementation changes authorized until formal approval.
- [ ] Upon future approval: POD and expense file uploads must use pre-signed URLs with tenant isolation.
- [ ] Direct public access to storage bucket is disabled; access requires signed temporary URLs.

## 7. Explicit Scope Boundaries

Covers file attachments and documents. Does not apply to structured document exports or database backups.

## 8. What is Not Yet Implemented or Verified

DEC-003 is NOT APPROVED. Storage currently uses local filesystem or transitional mock adapter.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
