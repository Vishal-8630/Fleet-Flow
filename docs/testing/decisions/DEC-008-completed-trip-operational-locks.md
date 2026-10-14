# DEC-008 — Completed Trip Operational Locks and Reason-Audited Late Corrections

## Metadata

- **Decision ID:** DEC-008
- **Title:** Completed Trip Operational Locks and Reason-Audited Late Corrections
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-037](../issues/trip-lifecycle/FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-038](../issues/trip-lifecycle/FF-ISSUE-038-fuel-stops-milestones-edit-missing.md), [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)

---

## 1. Context and Problem Statement

Completed trips with verified PODs and closed settlements are frequently subjected to unauthorized modifications, corrupting historical freight billing and driver payroll calculations.

## 2. Decision Statement

1. Once a trip achieves `COMPLETED` status (or signed POD is verified), all routine operational action buttons (Add Check-In, Add Fuel Stop, Record Expense, Swap Driver) become read-only and locked.
2. Any post-completion modification, late entry, or financial correction requires an Authorized Correction workflow:
   - Restricted to authorized roles (Admin or Operations Manager).
   - Requires a mandatory justification reason.
   - Generates an immutable audit trail capturing user ID, timestamp, field changed, previous value, new value, and justification.
   - If the trip has already been invoiced or settled, adjustment journal entries must be generated rather than directly mutating finalized records.

## 3. Alternatives Considered and Trade-Offs

Completely locking trips with zero adjustment capability was rejected because real-world fuel slips or toll receipts frequently arrive days after trip completion.

## 4. Consequences

Backend must reject routine PUT/POST operational endpoints when trip is COMPLETED. An adjustment endpoint (`POST /api/trips/:id/adjustments`) must be provided for audited late entries.

## 5. Implementation Implications

State machine enforcement on all trip sub-resources. Audit log collection stores structured diffs with reason codes.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Trip detail page locks routine operational inputs when trip status is Completed.
- [ ] Backend endpoints reject routine operational mutations on Completed trips with HTTP 409 Conflict.
- [ ] Authorized Late Entry modal requires justification reason and authorization credentials.
- [ ] Audit log records all post-completion edits with complete before/after snapshots.

## 7. Explicit Scope Boundaries

Applies to completed trips and verified market movements.

## 8. What is Not Yet Implemented or Verified

Backend lock enforcement on completed trips (FF-ISSUE-037) and late entry audit workflow are not yet implemented.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-037](../issues/trip-lifecycle/FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-038](../issues/trip-lifecycle/FF-ISSUE-038-fuel-stops-milestones-edit-missing.md), [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
