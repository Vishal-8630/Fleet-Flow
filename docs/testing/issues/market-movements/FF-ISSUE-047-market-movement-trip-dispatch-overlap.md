# Market Vehicle Movement Purpose Overlaps Owned-Fleet Trip Dispatch

## Metadata

- **ID:** FF-ISSUE-047
- **Category:** Workflow
- **Priority:** Medium
- **Status:** Needs Verification
- **Affected module:** Market Movements / Commercial Fleet
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-039`
- **Related issues:** [FF-ISSUE-048](FF-ISSUE-048-market-movement-status-ambiguity-pod.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

Market Movement is intended for externally hired/broker trucks, distinct from owned-fleet trip dispatch, but UI and workflow overlap with regular trip dispatch.

## 2. Observed behavior

In manual testing, the distinction between a standard Trip Dispatch and a Market Vehicle Movement was blurred in the navigation and workflow. Both manage journeys, routes, and PODs, leading to confusion over when to use which module.

## 3. Expected behavior

Market Movement must have a clearly articulated business model: managing third-party hired trucks/brokers with distinct supplier payables settlement (hire freight minus TDS/brokerage/advances) alongside customer freight billing, avoiding duplicate journey entries.

## 4. Reproduction steps

1. Compare navigation flow between Dispatch Trip and Market Vehicle Movement.
1. Observe overlapping fields for vehicle, driver, route, and cargo.
1. Observe lack of clear guidance on owned vs market fleet routing.

## 5. Impact and risk

Users may record external broker trucks as internal fleet or vice versa, distorting owned-fleet utilization metrics and creating accounting classification errors.

## 6. Root-cause status

Market Movement was modeled as a parallel journey module without unified dispatch routing or clear UI taxonomy.

## 7. Investigation required

- Audit `MarketMovement` model vs `Trip` model.
- Determine whether Market Movement should be a specialized trip type (`trip_type: 'MARKET'`) or a standalone commercial contract.
- Examine supplier payable workflows vs driver wage workflows.

## 8. Proposed resolution or agreed design

Clarify UI taxonomy and navigation: designate Market Movement specifically for "Hired Truck / Broker Freight", explaining distinct supplier settlement vs owned-fleet dispatch.

## 9. Acceptance criteria

- [ ] Market Movement clearly explains its role for third-party/broker truck hire.
- [ ] Navigation and dashboards distinguish owned-fleet trips from market vehicle movements.
- [ ] Supplier payable lifecycle is integrated into Market Movement detail.

## 10. Required tests

- Documentation test: Clear workflow documentation in app.
- Navigation test: Clear distinct routes and labels for Owned Fleet vs Market Fleet.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-048](FF-ISSUE-048-market-movement-status-ambiguity-pod.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
