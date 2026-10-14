# QST-010 — GSTIN, Aadhaar, and Mobile Number Duplicate Validation Policy and Tenant Scoping

## Metadata

- **Question ID:** QST-010
- **Title:** GSTIN, Aadhaar, and Mobile Number Duplicate Validation Policy and Tenant Scoping
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Data Validation / Identity Security
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q10)`
- **Related Issues:** [FF-ISSUE-020](../ui-ux/FF-ISSUE-020-duplicate-gstin-accepted.md), [FF-ISSUE-033](../data-validation/FF-ISSUE-033-duplicate-gstin-billing-parties.md), [FF-ISSUE-034](../data-validation/FF-ISSUE-034-duplicate-driver-aadhaar-mobile.md)
- **Related Decisions:** N/A
- **Expected Owner / Phase:** Data Architect / Security Engineer / Evaluate database schema unique compound indexes and privacy compliance in Phase 2.

---

## 1. Core Question

What are the required uniqueness scopes and database index rules for GSTIN, Aadhaar, and mobile numbers, balancing tenant privacy, legal multi-state GSTINs, and shared driver contacts?

## 2. Background and Testing Context

System accepted duplicate GSTINs across customers and duplicate Aadhaar/mobile across drivers. Defining uniqueness requires distinguishing per-tenant vs global scope and respecting Aadhaar privacy laws.

## 3. Evidence Required to Resolve

- [ ] Audit MongoDB indexes on `parties` and `drivers` collections.
- [ ] Review business requirements: can one company have multiple customer parties with same GSTIN under different branch branches?
- [ ] Check Aadhaar hashing/masking and legal compliance requirements.

## 4. Planned Investigation Activity

Evaluate database schema unique compound indexes and privacy compliance in Phase 2.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-020](../ui-ux/FF-ISSUE-020-duplicate-gstin-accepted.md), [FF-ISSUE-033](../data-validation/FF-ISSUE-033-duplicate-gstin-billing-parties.md), [FF-ISSUE-034](../data-validation/FF-ISSUE-034-duplicate-driver-aadhaar-mobile.md)
- Related Decisions: N/A
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
