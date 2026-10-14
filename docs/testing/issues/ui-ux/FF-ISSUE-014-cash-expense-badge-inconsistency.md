# Cash Expense Category Badge and Text Presentation Inconsistencies

## Metadata

- **ID:** FF-ISSUE-014
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Observed
- **Affected module:** Fleet Operations (Trip Details & Cash Expenses)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.B, Cash expense category styling)
- **Related issues:** [FF-ISSUE-013](FF-ISSUE-013-category-badge-styling-inconsistency.md), [FF-ISSUE-015](FF-ISSUE-015-payment-mode-badge-inconsistency.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

In the Cash Expenses tab of trip details, expense categories exhibit inconsistent visual styling: "Toll/Fastag" renders as plain text, "Weighbridge" renders as a grey badge, and "Loading Assist" renders as a blue badge.

## 2. Observed behavior

Viewing the recorded expenses table in a trip record reveals arbitrary styling discrepancies between rows:
- Row 1 (Toll/Fastag): Plain unstyled text.
- Row 2 (Weighbridge): Grey rounded badge.
- Row 3 (Loading Assist): Blue rounded badge.

## 3. Expected behavior

Every cash expense category should follow a unified design standard: either all categories render with standardized neutral badges with distinct subtle color coding, or use a consistent badge format across the entire table.

## 4. Reproduction steps

1. Navigate to Fleet Operations > Journeys (`/journeys`).
2. Open an active or completed trip and select the "Cash Expenses" tab.
3. Observe the Category column across different expense entries.

## 5. Impact and risk

Visual disorder in financial operational tables reduces data scanability during dispatch reconciliations.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Expense category cell renderer has missing mappings in its badge variant lookup table, falling back to raw string output for unmapped categories.

## 7. Investigation required

- Inspect `frontend/src/components/trips/TripExpensesTab.tsx` or related table cell renderers.

## 8. Proposed resolution or agreed design

Map all expense category codes to a centralized `EXPENSE_CATEGORY_CONFIG` dictionary providing uniform badge styling, icons, and labels.

## 9. Acceptance criteria

- [ ] All expense categories render inside a consistent badge component.
- [ ] Padding, font size, and border radius are identical across all expense rows.

## 10. Required tests

- Component tests rendering all expense category types to verify badge consistency.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-013](FF-ISSUE-013-category-badge-styling-inconsistency.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
