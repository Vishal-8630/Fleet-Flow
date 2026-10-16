# Vehicle Operational Status Stale in Fleet List After Dispatch Action

## Metadata

- **ID:** FF-ISSUE-032
- **Category:** Bug
- **Priority:** High
- **Status:** Resolved
- **Affected module:** Fleet Management / Vehicle List
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-028](FF-ISSUE-028-vehicle-current-driver-stale-display.md)
- **Related decisions:** N/A
- **Implementation status:** Implemented (Batch C — Commit 79d8a30)

## 1. Summary

After dispatching a truck on a trip, the vehicle listing page continues to show the vehicle status as "Available" until browser refresh.

## 2. Observed behavior

User dispatched a truck on a journey. Navigating back to the vehicle listing, the dispatched vehicle still rendered with status "Available". Only upon forcing a browser reload did the status change to "On Trip" / "Unavailable".

## 3. Expected behavior

Upon successful dispatch mutation, client-side queries must be invalidated so the vehicle list immediately reflects "On Trip" without requiring a page refresh.

## 4. Reproduction steps

1. Dispatch an available vehicle from trip creation or trip detail.
1. Navigate to Vehicle List view.
1. Observe vehicle still displays status "Available" until manual page refresh.

## 5. Impact and risk

Dispatchers may attempt to dispatch the same vehicle on another journey, causing dispatch conflicts or workflow errors.

## 6. Root-cause status

Missing React Query / state cache invalidation for the vehicles list query following a trip dispatch mutation.

## 7. Investigation required

- Check trip dispatch mutation onSuccess handlers.
- Verify whether query keys for vehicle lists are included in cache invalidation.
- Verify if dispatch endpoint returns updated vehicle state.

## 8. Proposed resolution or agreed design

Add `queryClient.invalidateQueries({ queryKey: ['vehicles'] })` to the trip dispatch mutation success callback.

## 9. Acceptance criteria

- [x] Vehicle status updates from "Available" to "On Trip" immediately upon dispatch.
- [x] No manual browser refresh required.
- [x] Vehicle list query refetches or receives optimistic update.

## 10. Required tests

- E2E test: Dispatch vehicle and verify vehicle list shows "On Trip" immediately.
- Component test verifying dispatch action invalidates vehicle list cache.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-028](FF-ISSUE-028-vehicle-current-driver-stale-display.md)
- Related Decisions: N/A

## 12. Verification evidence

- **Resolved in Commit:** `79d8a30` (Batch C)
- **Controller & Service Implementation:** `backend/src/controllers/journeyController.ts` (`dispatchJourney`, `startJourney`), `backend/src/controllers/vehicleController.ts`
- **Integration Test Suite:** `backend/src/tests/integration/journeyLifecycleState.test.ts` (Vehicle and driver operational status synchronized immediately upon dispatch).

