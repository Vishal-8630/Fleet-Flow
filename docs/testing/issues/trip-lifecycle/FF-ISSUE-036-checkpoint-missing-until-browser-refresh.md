# Trip Checkpoint Added From List Missing in Record Until Browser Refresh

## Metadata

- **ID:** FF-ISSUE-036
- **Category:** Bug
- **Priority:** High
- **Status:** Observed
- **Affected module:** Trip Lifecycle / Checkpoints & Milestones
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

When a checkpoint is logged from the trip list action menu, opening the trip record immediately afterwards shows the checkpoint missing until page refresh.

## 2. Observed behavior

User added a checkpoint to an active trip directly from the trip listing quick-action menu. Opening the trip details immediately showed the checkpoint timeline missing the newly added checkpoint. Only upon manual page refresh did the checkpoint appear.

## 3. Expected behavior

Adding a checkpoint must update or invalidate cached trip details so opening the record immediately displays the new checkpoint without a page reload.

## 4. Reproduction steps

1. Navigate to Trip List.
1. Use quick-action menu to add a checkpoint with timestamp and location.
1. Click to open the trip detail page.
1. Observe newly added checkpoint is missing from timeline until manual browser refresh.

## 5. Impact and risk

Operators believe checkpoint submission failed and re-enter duplicate checkpoints, causing distorted transit tracking.

## 6. Root-cause status

Quick-action modal does not invalidate the specific trip detail query key (`['trip', tripId]`), only mutating the list or local modal state.

## 7. Investigation required

- Inspect Add Checkpoint modal mutation callback.
- Check query invalidation keys in `useAddCheckpoint` or equivalent hook.
- Verify if trip details hook fetches stale cache or relies on stale React Query state.

## 8. Proposed resolution or agreed design

Invalidate both `['trips']` and `['trip', tripId]` query keys upon successful checkpoint submission.

## 9. Acceptance criteria

- [ ] Added checkpoint appears immediately in trip detail timeline upon opening record.
- [ ] No manual browser refresh required.
- [ ] Cache invalidation triggered on mutation success.

## 10. Required tests

- Component test: Submitting checkpoint invalidates trip detail query.
- E2E test: Add checkpoint from list, open trip detail, verify checkpoint renders immediately.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
