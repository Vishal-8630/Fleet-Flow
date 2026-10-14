# Simultaneous Active Vehicle Assignment Display Across Multiple Driver Records

## Metadata

- **ID:** FF-ISSUE-029
- **Category:** Bug
- **Priority:** Critical
- **Status:** Observed
- **Affected module:** Fleet Management / Driver Profiles
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-018`
- **Related issues:** [FF-ISSUE-018](../ui-ux/FF-ISSUE-018-dual-driver-assignment-anomaly.md), [FF-ISSUE-030](FF-ISSUE-030-driver-vehicle-concurrency-safeguards.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

Both previous driver (Sameer Khan) and newly assigned driver (Rahul Singh) displayed vehicle MH29KL23 as currently driving on their individual profile views despite vehicle audit showing previous driver was unassigned.

## 2. Observed behavior

Driver detail pages for Sameer Khan and Rahul Singh both displayed "Currently Driving MH29KL23". In MongoDB, the truck record properly reflected Rahul Singh as active and Sameer Khan unassigned with `unassigned_at: 2026-10-14T16:37:43.425Z`. However, the driver view displayed ended historical assignments as currently active.

## 3. Expected behavior

A vehicle must have at most one active driver assigned at any time. When an assignment ends, the previous driver's profile must show ended/historical status, never "Currently Driving".

## 4. Reproduction steps

1. Assign Driver A to Vehicle V.
1. Unassign Driver A and assign Driver B to Vehicle V.
1. Navigate to Driver A's profile and inspect active assignment status.
1. Observe both Driver A and Driver B display "Currently Driving Vehicle V".

## 5. Impact and risk

Critical operational misrepresentation: dispatchers cannot reliably determine who is driving which truck, creating legal, compliance, and dispatch hazards.

## 6. Root-cause status

Driver profile endpoint or frontend component likely queries driver assignment records without filtering `unassigned_at: null` or `is_active: true`.

## 7. Investigation required

- Audit driver profile API controller and MongoDB aggregation pipelines for driver vehicle assignments.
- Verify if driver document stores a stale embedded `current_vehicle` field that is not cleared when unassignment occurs on the vehicle record.
- Examine bidirectional data synchronization between Driver and Vehicle models.

## 8. Proposed resolution or agreed design

Ensure driver assignment query explicitly filters for active unassigned_at IS NULL, or synchronize driver-level embedded fields atomically in vehicle assignment transaction.

## 9. Acceptance criteria

- [ ] Driver profile only shows "Currently Driving" if assignment has no unassigned_at timestamp.
- [ ] Historical assignments appear strictly in assignment history table with start and end dates.
- [ ] Unassignment atomically updates both vehicle and driver queries.

## 10. Required tests

- Backend integration test: Reassigning vehicle updates driver A to historical and driver B to active.
- Database invariant test: No two drivers can have an active assignment to the same vehicle simultaneously.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-018](../ui-ux/FF-ISSUE-018-dual-driver-assignment-anomaly.md), [FF-ISSUE-030](FF-ISSUE-030-driver-vehicle-concurrency-safeguards.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
