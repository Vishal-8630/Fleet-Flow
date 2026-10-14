# DEC-010 — Branches and Regional Hubs Organizational and Operational Model

## Metadata

- **Decision ID:** DEC-010
- **Title:** Branches and Regional Hubs Organizational and Operational Model
- **Status:** Agreed
- **Date:** Agreed design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-051](../issues/branches-hubs/FF-ISSUE-051-branch-creation-form-ui.md), [FF-ISSUE-052](../issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md), [FF-ISSUE-053](../issues/branches-hubs/FF-ISSUE-053-branch-hub-operational-integration.md)

---

## 1. Context and Problem Statement

Confusion existed regarding the domain distinction between a SaaS Workspace, a Regional Branch, and an operational Hub.

## 2. Decision Statement

The following organizational and operational taxonomy is established:
1. **Workspace = Company:** A Workspace represents the top-level customer company and its subscription/tenant billing context.
2. **Branch = Operational Location:** A Branch represents a physical regional operating office within the company. A branch is NOT a separate legal entity or separate workspace by default.
3. **Trip Responsibility:** Every trip records the specific branch responsible for managing and executing it.
4. **Document Numbering:** Branches support branch-specific document numbering sequences (LR prefix, invoice prefix) where configured.
5. **Single-Branch Default:** Companies with a single branch have that branch selected automatically across all forms to minimize operational friction.
6. **Hub Distinction:** A Hub represents a physical goods transfer, transshipment, or sorting terminal. Hubs may require separate modeling in future hub-and-spoke logistics phases; not every branch is a hub.

## 3. Alternatives Considered and Trade-Offs

Treating each branch as a separate SaaS tenant was rejected because transport companies share fleet vehicles, drivers, and corporate financials across branches.

## 4. Consequences

Branch records belong to a Workspace. Trip, LR, and Invoice models include `branch_id`. Reporting supports both company-wide consolidation and branch-wise breakdown.

## 5. Implementation Implications

Schema includes `branch_id` on operational models. UI includes branch switcher and branch default assignment.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Workspace represents the company; branches are created under the workspace.
- [ ] Trip creation includes branch selection (auto-selected if only 1 branch exists).
- [ ] Branch configuration supports distinct document prefixes (e.g. MUM-LR-, DEL-LR-).
- [ ] Reports allow filtering by individual branch or consolidating company-wide.

## 7. Explicit Scope Boundaries

Governs operational branch modeling within a tenant. Does not imply separate GSTIN registration per branch unless explicitly configured.

## 8. What is Not Yet Implemented or Verified

Operational binding of branches to trip dispatch, custom numbering prefixes, and branch reporting filters are pending implementation (FF-ISSUE-053).

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-051](../issues/branches-hubs/FF-ISSUE-051-branch-creation-form-ui.md), [FF-ISSUE-052](../issues/branches-hubs/FF-ISSUE-052-branch-listing-ui-layout.md), [FF-ISSUE-053](../issues/branches-hubs/FF-ISSUE-053-branch-hub-operational-integration.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
