# DEC-005 — Freight Invoice Creation Dual Access Paths

## Metadata

- **Decision ID:** DEC-005
- **Title:** Freight Invoice Creation Dual Access Paths
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md)

---

## 1. Context and Problem Statement

Billing personnel need flexibility: dispatchers prefer generating invoices directly from a completed trip detail view, while centralized accounting teams prefer billing from a central Invoices dashboard.

## 2. Decision Statement

Fleet Flow supports dual access paths for generating freight invoices:
1. **Trip Context:** Direct "Create Invoice" action on eligible trip and market movement detail views, pre-filling vehicle, driver, customer, route, and freight contract amounts.
2. **Central Invoices Page:** A central "Create Invoice" modal/page where accounting staff can select unbilled completed trips for a given customer or consolidate multiple trips into a single billing invoice.

## 3. Alternatives Considered and Trade-Offs

Restricting invoice creation to only trip details or only accounting module was rejected as too restrictive for varied fleet sizes.

## 4. Consequences

Both UI entry points must invoke a common, robust invoice creation domain service to ensure consistent pricing, tax, and ledger logic.

## 5. Implementation Implications

Create shared `createInvoiceFromTrip(tripId, billingDetails)` service. Central invoice page includes an "Unbilled Trips" selector filtered by customer party.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Trip detail page displays "Create Invoice" button when eligible under DEC-004.
- [ ] Central Invoices page features "New Invoice" flow allowing selection of unbilled completed trips.
- [ ] Both creation paths invoke the same backend invoice service and generate identical ledger entries.

## 7. Explicit Scope Boundaries

Governs UI entry points and aggregation workflows for invoice creation.

## 8. What is Not Yet Implemented or Verified

Consolidated multi-trip invoicing from the central invoices page is not yet implemented.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
