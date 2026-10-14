# Market Movement Status Remains "Pending" After POD Received

## Metadata

- **ID:** FF-ISSUE-048
- **Category:** Workflow
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Market Movements / Settlement Lifecycle
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-040`
- **Related issues:** [FF-ISSUE-047](FF-ISSUE-047-market-movement-trip-dispatch-overlap.md)
- **Related decisions:** DEC-004
- **Implementation status:** Not implemented

## 1. Summary

In Market Movement records, POD Status was marked "Received" while overall movement status remained "PENDING", creating lifecycle status confusion.

## 2. Observed behavior

A market movement record showed POD Status as Received, but the primary movement status badge still displayed "PENDING". It was unclear whether PENDING meant delivery pending, settlement pending, or invoice pending.

## 3. Expected behavior

The system must explicitly separate operational delivery lifecycle from financial settlement lifecycle. When POD is received, delivery status should indicate "Delivered / POD Received", while financial status should indicate "Pending Supplier Settlement" or "Settled".

## 4. Reproduction steps

1. Open a Market Movement record.
1. Upload and confirm Proof of Delivery (POD).
1. Observe POD status updates to Received, but movement status remains PENDING.

## 5. Impact and risk

Operators cannot tell from movement lists whether cargo is still in transit or if delivery completed and only supplier billing remains outstanding.

## 6. Root-cause status

Single `status` field overloaded with both transit and settlement state, or missing state transition handler upon POD verification.

## 7. Investigation required

- Inspect `MarketMovement` schema for `status`, `delivery_status`, and `settlement_status`.
- Check `uploadPod` mutation handler for Market Movements.
- Review status badge mapping in `MarketMovementList` component.

## 8. Proposed resolution or agreed design

Separate `delivery_status` (Draft, Dispatched, In Transit, Delivered/POD Verified) from `settlement_status` (Pending Settlement, Partially Settled, Fully Settled) and display both badges clearly in list and detail views.

## 9. Acceptance criteria

- [ ] POD receipt transitions delivery status to Delivered / POD Verified.
- [ ] Movement displays distinct Settlement Status badge (e.g. Pending Settlement).
- [ ] List view columns clearly distinguish Delivery vs Settlement.

## 10. Required tests

- State transition test: Uploading POD transitions delivery status without corrupting settlement status.
- UI component test: Renders both delivery and settlement status badges.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-047](FF-ISSUE-047-market-movement-trip-dispatch-overlap.md)
- Related Decisions: DEC-004

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
