# Journey Status Display Inconsistency Between Plain Text and Badges

## Metadata

- **ID:** FF-ISSUE-016
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Resolved (Batch H1)
- **Affected module:** Fleet Operations (Journeys List)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.C, Trip-status badge inconsistency)
- **Related issues:** [FF-ISSUE-035](../trip-lifecycle/FF-ISSUE-035-draft-trip-operational-actions-exposure.md), [FF-ISSUE-036](../trip-lifecycle/FF-ISSUE-036-completed-trip-unrestricted-actions.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch H1

## 1. Summary

In the master Journey list, different trip lifecycle statuses are displayed with inconsistent UI treatments: "Completed" renders as a green rounded badge, while "In Transit" appears as an icon with plain text.

## 2. Observed behavior

In the Journey table at `/journeys`, a trip with status `Completed` renders inside a green badge component, while an adjacent trip with status `In Transit` renders as a truck icon followed by plain uncontained text.

## 3. Expected behavior

All lifecycle statuses (Draft, Dispatched, In Transit, Delivered, Completed, Cancelled) should render using a consistent `<StatusBadge />` component with unified dimensions, font weight, and semantic background colors.

## 4. Reproduction steps

1. Navigate to Fleet Operations > Journeys (`/journeys`).
2. Review the Status column across trips with different states.

## 5. Impact and risk

Visual disorder in primary operations list. Inconsistent badge boundaries make rapid status scanning difficult for dispatchers managing large fleets.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Status cell formatter uses fragmented rendering logic where certain statuses return badges and others return custom icon-text combinations.

## 7. Investigation required

- Inspect `frontend/src/pages/journeys/JourneyListPage.tsx` and `JourneyStatusBadge.tsx`.

## 8. Proposed resolution or agreed design

Standardize all journey states into `<JourneyStatusBadge status={status} />`:
- `draft`: Slate / Grey.
- `dispatched` / `in_transit`: Blue.
- `delivered`: Amber.
- `completed`: Emerald / Green.
- `cancelled`: Red.

## 9. Acceptance criteria

- [x] Every journey lifecycle status renders in a uniform badge format.
- [x] No status renders as orphan plain text.

## 10. Required tests

- Component tests verifying badge output for all journey status enums: Completed in `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts` (14 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-038](../trip-lifecycle/FF-ISSUE-038-server-side-trip-state-validation.md).

## 12. Verification evidence

- Implemented `.badge-primary` in `frontend/src/styles/components/badges.css` using `--color-primary-bg`, `--color-primary-border`, and `--color-primary-text` defined in `variables.css`.
- Fixed In Transit journey status badge in `JourneyListPage.tsx` which was already coded with `badge badge-primary`.
- Documented in [`docs/testing/audit/BATCH_H1_AUDIT_REPORT.md`](../../audit/BATCH_H1_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts`.
