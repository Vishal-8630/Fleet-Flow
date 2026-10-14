# Regional Branch Listing UI Lacks Card Containment and Action Buttons

## Metadata

- **ID:** FF-ISSUE-052
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Regional Branches & Hubs
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.E, Regional Branch listing UI)
- **Related issues:** [FF-ISSUE-051](FF-ISSUE-051-branch-creation-form-ui.md), [FF-ISSUE-053](FF-ISSUE-053-branch-hub-operational-integration.md)
- **Related decisions:** [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md)
- **Implementation status:** Not implemented

## 1. Summary

The Regional Branches listing page displays created branches as uncontained, floating text blocks across a large empty canvas, with no visible Edit or Delete actions on the branch entries.

## 2. Observed behavior

After creating a branch, the listing page displays branch details (name, code, contact, city, prefixes) with minimal visual containment, resembling raw text on an empty page. No action menu (Edit, Deactivate, Delete) was visible.

## 3. Expected behavior

Branches should be listed in a structured data table or responsive card grid featuring:
- Branch Name & Unique Branch Code (e.g. `BR-MUM-01`).
- Location (City, State), Manager Contact, Operating Truck Count.
- Configured document prefixes (LR, Invoice, Trip sequences).
- Action buttons: Edit Branch, Manage Staff, Deactivate.

## 4. Reproduction steps

1. Navigate to Settings > Branches & Hubs (`/branches`).
2. Review the presentation of configured branch records.
3. Observe absence of structured table/cards and missing action buttons.

## 5. Impact and risk

Admins cannot effectively manage or edit existing regional branches once created.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** `BranchListPage.tsx` renders raw unstyled `<div>` elements without wrapping in standard table or card components.

## 7. Investigation required

- Inspect `frontend/src/pages/branches/BranchListPage.tsx`.

## 8. Proposed resolution or agreed design

Replace flat div rendering with Fleet Flow's standard `<DataTable />` or `<BranchCard />` grid with clear action dropdowns.

## 9. Acceptance criteria

- [ ] Branches are rendered in clean, structured cards or table rows.
- [ ] Each branch displays explicit Edit and Deactivate action triggers.
- [ ] Search and status filters are present for multi-branch companies.

## 10. Required tests

- Component tests for branch list rendering and action trigger handlers.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-051](FF-ISSUE-051-branch-creation-form-ui.md), [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
