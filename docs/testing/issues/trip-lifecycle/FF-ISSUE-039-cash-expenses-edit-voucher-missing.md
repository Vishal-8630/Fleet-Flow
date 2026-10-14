# Cash Expenses Cannot Be Edited to Add or Replace Receipt Voucher

## Metadata

- **ID:** FF-ISSUE-039
- **Category:** Workflow
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Trip Lifecycle / Cash Expenses
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- **Related decisions:** DEC-008
- **Implementation status:** Not implemented

## 1. Summary

Saved trip cash expenses provide no edit action, preventing operators from attaching or replacing receipt vouchers after initial expense submission.

## 2. Observed behavior

In manual testing, saved cash expense items showed no edit action. Operators wanting to attach receipt photos or vouchers received later could not do so.

## 3. Expected behavior

Operators should have an authorized edit action to update expense details or upload/replace receipt vouchers while the trip is active or within authorized grace period, preserving audit history.

## 4. Reproduction steps

1. Record a cash expense without an attachment during transit.
1. Navigate back to trip Cash Expenses tab.
1. Attempt to edit the expense to upload a receipt voucher.
1. Observe no edit or attach voucher action exists on the saved record.

## 5. Impact and risk

Trip expenses lack supporting proof documents, creating compliance gaps, tax deduction audit issues, and disputes during driver settlement reconciliation.

## 6. Root-cause status

Expense sub-resource only supports create and delete, lacking update/attachment replacement handler and UI modal.

## 7. Investigation required

- Check `tripExpenses` schema and endpoints for update capabilities.
- Inspect file upload integration for expense receipt vouchers.
- Verify authorization rules for expense editing.

## 8. Proposed resolution or agreed design

Implement an edit expense modal allowing voucher file upload and amount correction with audit trail.

## 9. Acceptance criteria

- [ ] Saved cash expenses have an Edit action in the trip expenses table.
- [ ] Operators can attach or replace receipt voucher files.
- [ ] File uploads are validated, stored securely, and audit logged.

## 10. Required tests

- Backend test: Updating expense attachment persists file URL and updates audit timestamp.
- Frontend component test: Edit modal supports file picker and preview.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-038](FF-ISSUE-038-fuel-stops-milestones-edit-missing.md)
- Related Decisions: DEC-008

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
