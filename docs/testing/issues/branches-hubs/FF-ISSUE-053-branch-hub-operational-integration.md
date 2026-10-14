# Branches & Hubs Operational Integration Missing (Trips, Sequences, Staff Scope)

## Metadata

- **ID:** FF-ISSUE-053
- **Category:** Workflow / Architecture
- **Priority:** High
- **Status:** Agreed Future Behavior / Not Implemented
- **Affected module:** Regional Branches & Enterprise Operations
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.E, Branches & Hubs agreed product direction)
- **Related issues:** [FF-ISSUE-051](FF-ISSUE-051-branch-creation-form-ui.md), [FF-ISSUE-052](FF-ISSUE-052-branch-listing-ui-layout.md)
- **Related decisions:** [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md)
- **Implementation status:** Not implemented

## 1. Summary

While branch records can be created in settings, the branch concept is not functionally connected to operational workflows: trips do not record dispatching branches, document numbering sequences ignore branch prefixes, and staff cannot be scoped to specific regional locations.

## 2. Observed behavior

Creating trips, LRs, and invoices does not associate records with a regional branch. Single-branch companies are forced to think about multi-location setup, while multi-branch companies have no way to isolate regional operations or view branch-wise profit and loss.

## 3. Expected behavior

Per approved product decision [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md):
- **Workspace = Company** (billing & tenant boundary).
- **Branch = Operational Location** within the company.
- **Trips:** Every dispatch records the originating/responsible branch.
- **Sequences:** LRs and Invoices can use branch-specific prefixes (e.g. `MUM-LR-001`).
- **Reporting:** Support both company-wide and branch-wise financial reporting.
- **Single-Branch Default:** Single-branch operators default to their primary location automatically without friction.

## 4. Reproduction steps

1. Create two regional branches (e.g. Mumbai Hub and Delhi Depot).
2. Create a new trip dispatch at `/journeys/new`.
3. Observe absence of any branch selection field.
4. Generate an LR: observe no branch prefix applied.

## 5. Impact and risk

Multi-branch logistics companies cannot use Fleet Flow for distributed operations across regional hubs.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Data models for `TruckJourney`, `Entry`, and `Invoice` omit `branch_id` references, and numbering counters are strictly company-global.

## 7. Investigation required

- Inspect `backend/src/models/TruckJourney.ts`, `Entry.ts`, and `Branch.ts`.
- Review [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md) for full implementation blueprint.

## 8. Proposed resolution or agreed design

1. Add optional `branch_id` to `TruckJourney`, `Entry`, and `Invoice` models.
2. Update trip creation form with auto-defaulting Branch Selector.
3. Support branch-specific sequence counters in `companyController.ts`.

## 9. Acceptance criteria

- [ ] Trips, LRs, and Invoices store the responsible `branch_id`.
- [ ] Document numbering uses branch prefixes when configured.
- [ ] Single-branch tenants experience zero workflow friction (auto-selected).

## 10. Required tests

- Integration tests for branch-assigned trip creation and branch-specific LR numbering.

## 11. Dependencies and related issues

- Governed by [DEC-010](../../decisions/DEC-010-branches-and-hubs-tenancy-model.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
