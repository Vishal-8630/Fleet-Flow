# DEC-009 — Decoupled Lorry Receipt (LR) and Trip Workflow Architecture

## Metadata

- **Decision ID:** DEC-009
- **Title:** Decoupled Lorry Receipt (LR) and Trip Workflow Architecture
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md)

---

## 1. Context and Problem Statement

In freight operations, a single truck journey often transports goods under multiple Lorry Receipts (consignments for different shippers), and LRs are frequently prepared before vehicle dispatch.

## 2. Decision Statement

The relationship between Lorry Receipts (LR / Bilty) and Trips is formally decoupled:
1. **Generate LR from Trip:** Operators can generate one or more LRs from an active or planned trip, pre-filling vehicle, driver, and route details.
2. **Multiple LRs per Trip:** A single trip can link to multiple distinct LRs (consolidated / multi-consignor freight).
3. **Standalone LR Creation:** Operators can create standalone LRs before a vehicle or trip is scheduled.
4. **Independent Lifecycle:** LR status (Draft, Issued, In Transit, Delivered), Trip status (Draft, Dispatched, Completed), and Invoicing status are decoupled. Creating an LR does NOT automatically dispatch a trip.

## 3. Alternatives Considered and Trade-Offs

Strict 1:1 binding between Trip and LR was rejected because real transport operations regularly consolidate multiple shipments on a single truck.

## 4. Consequences

Data model must support 1:N relationship from Trip to LR, with LRs maintaining foreign key `trip_id` (nullable).

## 5. Implementation Implications

Trip detail page displays linked LRs table with download/print actions. LR list allows filtering unassigned LRs and assigning them to trips.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Trip detail includes "Generate LR" button that pre-populates trip details.
- [ ] Trip view displays all associated LRs with individual consignment weights and values.
- [ ] Creating an LR does not mutate trip status to Dispatched.
- [ ] Standalone LR can be created and later linked to an available trip.

## 7. Explicit Scope Boundaries

Governs consignment documentation (LR / Bilty) generation and linkage to vehicle trips.

## 8. What is Not Yet Implemented or Verified

Multi-LR consolidation per trip and decoupled lifecycle handlers are not yet implemented.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
