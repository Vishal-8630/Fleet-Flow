# Category and Party Badge Visual Styling Inconsistency Across Modules

## Metadata

- **ID:** FF-ISSUE-013
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Resolved (Batch H1)
- **Affected module:** Master Registries (Parties, Vendors, Customers)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.B, Category/badge styling)
- **Related issues:** [FF-ISSUE-014](FF-ISSUE-014-cash-expense-badge-inconsistency.md), [FF-ISSUE-015](FF-ISSUE-015-payment-mode-badge-inconsistency.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch H1

## 1. Summary

Entity category tags across party listings display inconsistent visual styling: some categories render with rounded color badges, while others render as uncontained plain text.

## 2. Observed behavior

In the Billing Parties and Vendor lists, a party with category "Vehicle Broker" rendered with a styled orange pill badge, whereas a party with category "Truck Supplier" rendered as plain unstyled text without a container or background.

## 3. Expected behavior

All category identifiers across master registries and operational tables should render using a standardized, consistent `<Badge />` component with semantic color tokens.

## 4. Reproduction steps

1. Navigate to Master Registries > Parties (`/parties`).
2. Compare the Category column between different party types (e.g. Broker vs Supplier).
3. Observe badge container on some rows and plain text on others.

## 5. Impact and risk

Visual inconsistency diminishes perceived application quality and makes scanning entity categories difficult.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Table cell renderer contains an incomplete switch statement or conditional that only wraps certain enum values in a badge component, defaulting others to raw string rendering.

## 7. Investigation required

- Inspect party table component in `frontend/src/pages/parties/` or `frontend/src/components/parties/`.
- Check category enum values and badge color mapping dictionary.

## 8. Proposed resolution or agreed design

Define a comprehensive category badge mapper dictionary that maps every valid entity category enum to a designated badge color variant (e.g. Customer = Blue, Supplier = Purple, Broker = Orange, Vendor = Amber), with a graceful neutral badge fallback.

## 9. Acceptance criteria

- [x] Every party category value renders inside a standardized badge component.
- [x] No category value renders as uncontained plain text.
- [x] Badge sizing, padding, and font weight are uniform across the table.

## 10. Required tests

- Component tests asserting badge rendering for every valid party category enum: Completed in `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts` (14 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-014](FF-ISSUE-014-cash-expense-badge-inconsistency.md).

## 12. Verification evidence

- Implemented `.badge-primary` in `frontend/src/styles/components/badges.css` using `--color-primary-bg`, `--color-primary-border`, and `--color-primary-text` defined in `variables.css`.
- Fixed Truck Supplier category badge in `BalancePartyListPage.tsx` which was already coded with `badge badge-primary`.
- Documented in [`docs/testing/audit/BATCH_H1_AUDIT_REPORT.md`](../../audit/BATCH_H1_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts`.
