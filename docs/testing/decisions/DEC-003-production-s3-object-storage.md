# DEC-003 — Production S3 and Object Storage Enforcement

## Metadata

- **Decision ID:** DEC-003
- **Title:** Production S3 and Object Storage Enforcement
- **Status:** Pending Review
- **Date:** October 2026
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)

---

## 1. Context and Problem Statement

Uploaded documents (PODs, fuel receipts, expense vouchers, vehicle RC/insurance) are currently handled via local disk or preliminary storage adapters. In production containerized environments, file persistence and multi-tenant security require a clear storage architecture.

## 2. Decision Statement & Proposed Position

> [!IMPORTANT]
> **Current Status: PROPOSED — PENDING REVIEW (No Decision Yet)**  
> Production storage requirements must be thoroughly reviewed before choosing the final architectural approach.  
> - **Do not assume AWS S3 is approved.**  
> - **Do not assume local-disk fallback is approved.**  
> - The existing decision status remains **Pending Review** until infrastructure, compliance, hosting models, and cost requirements are fully reviewed and explicit stakeholder approval is provided.  
> - **This policy is NOT implemented and NOT authorized for implementation at this stage.**

### Historical Draft Proposal (Under Active Review)
Enforce production-grade cloud object storage (AWS S3 or compatible S3 API) with pre-signed upload URLs, tenant-scoped object key paths (`tenants/{tenantId}/{module}/{year}/{month}/{fileId}`), server-side encryption (SSE-S3 or SSE-KMS), and restricted public bucket access. Local file storage would be prohibited in production and staging environments.

## 3. Alternatives Considered and Trade-Offs

1. **Option A (Cloud S3 / Compatible Object Storage):** High durability, horizontal scaling, pre-signed upload URLs, but introduces cloud infrastructure cost and external provider credentials.
2. **Option B (Secured Local Disk / Network Attached Storage):** Simpler local deployment, but vulnerable to container ephemerality in Kubernetes/Docker environments and scaling bottlenecks across multi-node setups.
3. **Option C (Dual Mode / Hybrid):** Local disk jailed storage for offline dev/single-node on-premise, S3 for production cloud.

All options remain subject to formal review before a binding decision is reached.

## 4. Consequences

Requires formal stakeholder review of infrastructure topology, operational hosting models (cloud SaaS vs self-hosted on-premise), and security compliance requirements.

## 5. Implementation Implications

No implementation changes are authorized. Storage adapter interface remains in its current state until explicit approval is granted.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Decision status remains **PENDING REVIEW**. No implementation changes authorized until formal approval.
- [ ] Review production hosting model, S3 credential availability, and multi-tenant compliance needs.
- [ ] Record final binding decision upon explicit product-owner authorization.

## 7. Explicit Scope Boundaries

Covers file attachments and documents (PODs, fuel receipts, expense vouchers). Does not authorize code changes or cloud provisioning.

## 8. What is Not Yet Implemented or Verified

DEC-003 is NOT APPROVED. Storage currently uses local filesystem or transitional mock adapter. Neither S3 nor local disk fallback is assumed approved for production.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- Audit Question: [OPN-002](../audit/AUDIT_OPEN_QUESTIONS.md#opn-002-production-s3--object-storage-enforcement-dec-003)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
