# DEC-004 — Freight Invoice Eligibility Post Delivery and POD by Default

## Metadata

- **Decision ID:** DEC-004
- **Title:** Freight Invoice Eligibility Post Delivery and POD by Default
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-048](../issues/market-movements/FF-ISSUE-048-market-movement-status-ambiguity-pod.md)

---

## 1. Context and Problem Statement

Creating freight invoices before cargo delivery or before obtaining signed Proof of Delivery (POD) leads to billing disputes and credit note adjustments if transit discrepancies occur.

## 2. Decision Statement

A trip or market vehicle movement is eligible for customer freight invoicing only after delivery is recorded and a signed POD is uploaded and verified by default. Early or pre-delivery invoicing is restricted and requires explicit authorization with an entered business justification.

## 3. Alternatives Considered and Trade-Offs

Allowing unconstrained invoice creation at dispatch was rejected to prevent unearned revenue recognition and invoicing disputes.

## 4. Consequences

Invoice generation endpoints must validate trip delivery and POD verification status before generating a freight invoice unless the user possesses authorized override permissions.

## 5. Implementation Implications

Trip state machine must track `pod_status === 'VERIFIED'`. Invoice generation UI disables "Generate Invoice" button for in-transit trips with explanatory tooltip.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Trip detail hides or disables routine "Generate Invoice" action while trip is In Transit.
- [ ] Once POD is uploaded and verified, "Generate Invoice" action becomes active.
- [ ] Authorized billing manager can perform early invoice creation with mandatory justification reason.

## 7. Explicit Scope Boundaries

Applies to customer freight invoicing. Does not prevent supplier advances or driver trip advances during transit.

## 8. What is Not Yet Implemented or Verified

Backend invoice eligibility validation and early-invoice authorization override workflow are not yet verified.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-048](../issues/market-movements/FF-ISSUE-048-market-movement-status-ambiguity-pod.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
