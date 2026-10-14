# Completed Trip Remains Editable Through Routine Operational Actions

## Metadata

- **ID:** FF-ISSUE-037
- **Category:** Workflow
- **Priority:** High
- **Status:** Observed
- **Affected module:** Trip Lifecycle / Completed Trips
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-035](FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- **Related decisions:** DEC-008
- **Implementation status:** Not implemented

## 1. Summary

Trip JRN-0001 had Completed status and signed POD recorded, yet Add Check-In Location, Add Fuel Stop, and Cash Expense actions remained accessible and usable.

## 2. Observed behavior

In manual testing of trip JRN-0001 (status: Completed, POD received), actions to Add Check-In Location, Add Fuel Stop, and submit Cash Expenses remained fully visible and interactive. Backend did not lock operational mutations on completed journeys.

## 3. Expected behavior

Completed trips must be read-only for routine operational entries. Any late entry or correction must follow an authorized correction workflow requiring reason justification and generating an audit trail (DEC-008). Routine buttons must be disabled.

## 4. Reproduction steps

1. Open trip JRN-0001 with status Completed and POD verified.
1. Observe buttons for Add Check-In Location, Add Fuel Stop, and Record Cash Expense.
1. Click action and observe modal opens allowing data submission.

## 5. Impact and risk

Operators can alter completed trips post-delivery, retroactively changing trip costs, corrupting completed freight invoices and driver settlement calculations.

## 6. Root-cause status

Frontend does not disable operational actions based on terminal trip statuses, and backend endpoints lack state precondition guards (`if (trip.status === 'COMPLETED') throw ...`).

## 7. Investigation required

- Check backend trip mutation endpoints for terminal state checks.
- Inspect `TripDetailHeader`, `TripFuelTab`, and `TripExpensesTab` for disabled states on completed trips.
- Align with DEC-008 regarding authorized post-completion adjustments.

## 8. Proposed resolution or agreed design

Enforce read-only state for routine actions on COMPLETED trips on both frontend and backend. Implement DEC-008 for authorized corrections.

## 9. Acceptance criteria

- [ ] Routine operational actions are disabled or hidden on Completed trips.
- [ ] Backend returns HTTP 409/422 if routine mutation is attempted on a Completed trip.
- [ ] Late adjustments require authorized correction flow with mandatory reason.

## 10. Required tests

- Backend state machine test: Mutating expenses or fuel on Completed trip returns 409 Conflict.
- Frontend test: Completed trip detail renders actions as disabled with lock indication.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-035](FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- Related Decisions: DEC-008

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
