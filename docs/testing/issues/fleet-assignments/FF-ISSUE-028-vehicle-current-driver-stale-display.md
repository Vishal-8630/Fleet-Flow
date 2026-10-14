# Vehicle Current Driver Display Stale or Inconsistent After Assignment Mutation

## Metadata

- **ID:** FF-ISSUE-028
- **Category:** Bug
- **Priority:** High
- **Status:** Observed
- **Affected module:** Fleet Management / Vehicle Profiles
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-017`
- **Related issues:** [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md), [FF-ISSUE-032](FF-ISSUE-032-vehicle-status-stale-after-dispatch.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

When a commercial driver is assigned to a vehicle, the vehicle list and vehicle detail pages continue to show "Unassigned" until a manual browser hard refresh is performed.

## 2. Observed behavior

In manual testing, after completing the driver assignment action for a vehicle, the vehicle list and detail page did not automatically reflect the newly assigned driver. The UI remained showing "Unassigned". Only upon forcing a browser page refresh did the updated driver assignment appear.

## 3. Expected behavior

Upon completing driver assignment, the client application should immediately invalidate cached vehicle data and update the active state so the vehicle list and detail reflect the newly assigned driver without requiring a manual page refresh.

## 4. Reproduction steps

1. Navigate to Fleet Management > Vehicles.
1. Select a vehicle currently marked as Unassigned.
1. Execute driver assignment and confirm the action.
1. Observe that vehicle list/detail display still shows Unassigned until browser refresh.

## 5. Impact and risk

Dispatchers and fleet managers risk making duplicate driver assignments, dispatching unassigned trucks, or assuming system mutation failure, leading to confusion and operational errors.

## 6. Root-cause status

Suspected client-side state caching or missing query invalidation in React Query / SWR / local state hooks following the assignment mutation.

## 7. Investigation required

- Inspect the frontend driver assignment hook/mutation handler.
- Check if query invalidation is triggered for vehicle queries upon assignment success.
- Verify whether websocket/SSE or optimistic UI updates are expected or if refetch is failing.

## 8. Proposed resolution or agreed design

Ensure all assignment mutations trigger query invalidation for `['vehicle', id]` and `['vehicles']` queries upon resolution.

## 9. Acceptance criteria

- [ ] Driver assignment immediately updates the vehicle record in UI upon API success.
- [ ] No manual browser refresh required to observe updated driver name.
- [ ] Network inspection shows cache invalidation / re-fetch occurring automatically.

## 10. Required tests

- Frontend component test verifying cache invalidation upon driver assignment.
- E2E test verifying driver assignment immediately reflects on vehicle detail without page reload.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md), [FF-ISSUE-032](FF-ISSUE-032-vehicle-status-stale-after-dispatch.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
