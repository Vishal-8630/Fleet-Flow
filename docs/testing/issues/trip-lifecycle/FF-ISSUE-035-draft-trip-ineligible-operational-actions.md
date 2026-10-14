# Draft Trip Exposes Ineligible Routine Operational Action Tabs

## Metadata

- **ID:** FF-ISSUE-035
- **Category:** Workflow
- **Priority:** High
- **Status:** Observed
- **Affected module:** Trip Lifecycle / Trip Details
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-037](FF-ISSUE-037-completed-trip-operational-actions-editable.md)
- **Related decisions:** DEC-008
- **Implementation status:** Not implemented

## 1. Summary

Saving a trip as Draft Plan correctly hides primary action buttons, but tabs still expose actions to record diesel stops, milestones, cash expenses, and POD upload.

## 2. Observed behavior

On a trip saved with status Draft Plan, primary action buttons were hidden, but secondary tabs allowed users to record diesel purchases, log milestones, submit cash expenses, and upload POD documents before the trip was dispatched.

## 3. Expected behavior

Draft trips must not permit routine operational events that require active transit status. Ineligible actions must be disabled or hidden in UI, and the backend must reject operational mutations on draft trips.

## 4. Reproduction steps

1. Create a new trip and save as Draft Plan.
1. Open the saved draft trip details.
1. Navigate to Diesel, Milestones, Cash Expenses, or POD tabs.
1. Observe actions to record expenses and milestones are clickable and accessible.

## 5. Impact and risk

Users can record expenses, fuel entries, and proof of delivery against planned trips that have not yet occurred or might be cancelled, corrupting trip accounting.

## 6. Root-cause status

Frontend tab action components do not guard operations based on `trip.status === 'IN_TRANSIT'`, and backend endpoints lack state precondition assertions.

## 7. Investigation required

- Inspect `tripController` expense and milestone endpoints for status checks.
- Inspect trip detail tab components (`TripFuelTab`, `TripExpensesTab`, `TripMilestonesTab`, `TripPodTab`).
- Verify backend state machine assertions on trip sub-resource mutations.

## 8. Proposed resolution or agreed design

Implement backend validation rejecting operational mutations when trip status is DRAFT (`400 Bad Request: Operational events cannot be recorded on Draft trips`), and disable operational tabs in UI with explanatory tooltip.

## 9. Acceptance criteria

- [ ] Draft trips disable or hide Add Fuel, Add Expense, Add Milestone, and Upload POD.
- [ ] Direct API calls to record expenses on Draft trips are rejected with HTTP 400/422.
- [ ] Draft trip clearly indicates that dispatch is required before recording operational events.

## 10. Required tests

- Backend status precondition test: Recording fuel/expense/milestone on Draft trip returns HTTP 400.
- Frontend tab UI test: Action buttons disabled with appropriate tooltips when trip.status is DRAFT.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-037](FF-ISSUE-037-completed-trip-operational-actions-editable.md)
- Related Decisions: DEC-008

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
