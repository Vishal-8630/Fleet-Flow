# Fuel Stops and Milestones Cannot Be Edited or Corrected After Submission

## Metadata

- **ID:** FF-ISSUE-038
- **Category:** Workflow
- **Priority:** Medium
- **Status:** Resolved
- **Affected module:** Trip Lifecycle / Fuel & Milestones
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-037](FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-039](FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- **Related decisions:** DEC-008
- **Implementation status:** Implemented (Batch C — Commit 79d8a30)

## 1. Summary

The fuel table and milestone records provide no Edit action, preventing operators from correcting typos in liters, pump names, or odometer readings.

## 2. Observed behavior

The fuel table in trip details had no edit action visible. Milestones similarly lacked an edit mechanism. Users who made data entry mistakes had no path to correct entries without manual database intervention.

## 3. Expected behavior

Authorized users should be able to edit fuel stops and milestone entries while the trip is active, with all modifications logged in an audit trail capturing previous values, new values, user ID, and timestamp (DEC-008).

## 4. Reproduction steps

1. Open an active trip with existing fuel stops and milestones.
1. Inspect row actions in fuel stop table and milestone list.
1. Observe no Edit action is available.

## 5. Impact and risk

Data entry errors in fuel quantity, rate, or odometer readings cannot be fixed, leading to incorrect fuel economy calculations and inaccurate pump vendor ledger balances.

## 6. Root-cause status

Edit endpoints and UI edit modals for individual fuel stop and milestone sub-documents were never implemented.

## 7. Investigation required

- Check if `PUT /api/trips/:id/fuel-stops/:stopId` or similar endpoint exists.
- Examine schema of fuel stops and milestones (embedded arrays vs separate collections).
- Assess recalculation triggers when fuel stop liters or cost is edited.

## 8. Proposed resolution or agreed design

Provide an authorized Edit modal for fuel stops and milestones while trip is active, recalculating trip fuel totals and logging previous values to audit history.

## 9. Acceptance criteria

- [x] Authorized user can edit fuel stop quantity, rate, vendor, and odometer.
- [x] Milestone location and timestamp can be updated with audit logging.
- [x] Trip total fuel cost recalculates upon edit.

## 10. Required tests

- Backend integration test: Editing fuel stop recalculates trip total fuel expense.
- Audit test: Editing fuel stop logs old and new values with author ID.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-037](FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-039](FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- Related Decisions: DEC-008

## 12. Verification evidence

- **Resolved in Commit:** `79d8a30` (Batch C)
- **Controller & Service Implementation:** `backend/src/controllers/journeyController.ts` (`updateFuelStop`, `updateMilestone`, `correctJourney`), audit logging, recalculation of fuel expenses and ledger sync under ACID transaction.
- **Integration Test Suite:** `backend/src/tests/integration/journeyCorrections.test.ts` (Validates fuel stop update, audit log generation, and total recalculations).

