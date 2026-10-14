# Driver Assignment History and Unallocated Pool State Discrepancy After Trip Creation

## Metadata

- **ID:** FF-ISSUE-031
- **Category:** Bug
- **Priority:** High
- **Status:** Observed
- **Affected module:** Fleet Management / Driver Profiles
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-028](FF-ISSUE-028-vehicle-current-driver-stale-display.md), [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

When a trip was created using an unassigned vehicle and unassigned driver (Manish Sonar), the vehicle detail showed Manish Sonar assigned and vehicle On Trip, but driver detail showed Manish Sonar in unallocated pool with no assignment history.

## 2. Observed behavior

After creating a trip with Manish Sonar, vehicle detail properly showed Manish Sonar assigned and truck status "On Trip". However, Manish Sonar's driver profile remained in the "unallocated pool" with empty assignment history, showing zero record of the current trip or vehicle.

## 3. Expected behavior

Creating a trip with a driver must atomically update the driver status to "On Trip" (or assigned) and record the assignment in the driver's assignment history table.

## 4. Reproduction steps

1. Pick an unassigned vehicle and an unassigned driver (e.g. Manish Sonar).
1. Create and save a trip assigning that driver and vehicle.
1. Inspect vehicle profile (shows driver assigned and On Trip).
1. Inspect driver profile (shows unallocated pool with no assignment history).

## 5. Impact and risk

Driver records fail to reflect active trips and assignments, making driver utilization tracking, availability checks, and payroll history unreliable.

## 6. Root-cause status

Trip creation updates vehicle `current_driver_id` and vehicle status, but fails to mutate driver record status or append an assignment history entry.

## 7. Investigation required

- Inspect `tripService.createTrip` or trip creation controller.
- Verify if driver document update is part of the trip creation transaction.
- Check driver assignment history collection or schema structure.

## 8. Proposed resolution or agreed design

Include driver status update (`status: 'ON_TRIP'`) and assignment history creation within the multi-document ACID transaction for trip creation.

## 9. Acceptance criteria

- [ ] Trip creation updates driver status to On Trip.
- [ ] Driver detail view displays current trip ID, assigned vehicle number, and assignment history entry.
- [ ] Driver is removed from unallocated pool while trip is active.

## 10. Required tests

- Transactional integration test: Trip creation updates Trip, Vehicle, and Driver collections in single ACID transaction.
- Driver pool test: Driver with active trip is excluded from unallocated driver query.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-028](FF-ISSUE-028-vehicle-current-driver-stale-display.md), [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
