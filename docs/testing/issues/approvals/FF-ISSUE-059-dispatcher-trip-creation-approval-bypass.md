# Approval Workflow Not Triggered for Dispatcher-Created Trip

## Metadata

- **ID:** FF-ISSUE-059
- **Category:** Workflow
- **Priority:** High
- **Status:** Needs Verification
- **Affected module:** Approvals & Governance / Trip Dispatch
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-035](../trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

A dispatcher user created and dispatched a trip successfully using a dispatch ID without generating an approval request, despite approval rules existing in system settings.

## 2. Observed behavior

Invited dispatcher Suraj Singh created a trip using a dispatch ID and the trip transitioned directly without requiring manager approval. The Pending Approvals queue showed no request generated.

## 3. Expected behavior

If an enabled approval rule is configured for trip creation or dispatch by dispatchers, the trip must enter a "Pending Approval" state, and backend must reject direct dispatch until an authorized manager approves it.

## 4. Reproduction steps

1. Log in as Workspace Admin and verify an approval rule exists for Trip Creation / Dispatch.
1. Log in as Dispatcher (Suraj Singh).
1. Create and submit a new trip dispatch.
1. Observe trip is created/dispatched immediately with no approval request logged.

## 5. Impact and risk

Governance failure: operational trips and financial commitments may be committed without management oversight if approval policies are silently ignored.

## 6. Root-cause status

Requires verification: either no active approval rule matched the specific action/threshold, or the trip controller does not integrate with the `approvalEngine` middleware.

## 7. Investigation required

- Inspect `approvalRule` collection and rules configured in test workspace.
- Audit `tripController.createTrip` and `dispatchTrip` endpoints to check if approval service is called.
- Differentiate between "Trip Creation" rule vs "Trip Dispatch" rule.

## 8. Proposed resolution or agreed design

Verify approval rule engine integration in trip dispatch endpoint. If rule applies, put trip in `PENDING_APPROVAL` status and emit notification to approvers.

## 9. Acceptance criteria

- [ ] If approval rule applies, trip enters PENDING_APPROVAL and blocks operational progress.
- [ ] Approver can approve or reject trip from Pending Approvals dashboard.
- [ ] Backend prevents dispatch until approval token/event is recorded.

## 10. Required tests

- Backend integration test: Dispatcher trip creation triggers approval request when rule is active.
- Authorization test: Dispatch endpoint rejects trip transition if pending approval.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-035](../trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
