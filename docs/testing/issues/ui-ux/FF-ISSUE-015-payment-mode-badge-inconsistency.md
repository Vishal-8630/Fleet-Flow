# Fuel Payment Mode Badge Presentation Inconsistency

## Metadata

- **ID:** FF-ISSUE-015
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Resolved (Batch H1)
- **Affected module:** Fleet Operations (Fuel Stops & Log Sheets)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.B, Payment-mode badge inconsistency)
- **Related issues:** [FF-ISSUE-013](FF-ISSUE-013-category-badge-styling-inconsistency.md), [FF-ISSUE-044](../financial-accounting/FF-ISSUE-044-fuel-payment-mode-ledger-semantics.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch H1

## 1. Summary

In the Fuel Entries table, payment mode values display inconsistent styling: "Cash Advance" renders as a green badge, whereas "Fleet Fuel Card" renders as plain uncontained text.

## 2. Observed behavior

Viewing the Diesel Stops tab for a journey displays payment modes with mixed presentation: one payment mode is styled as an emerald green pill badge, while another is displayed as unstyled text.

## 3. Expected behavior

All payment modes (Fleet Fuel Card, Pump Vendor Credit, Driver Cash Advance) should render using a standardized, consistent badge component with distinct semantic colors.

## 4. Reproduction steps

1. Navigate to Fleet Operations > Journeys > select a journey record.
2. Open the "Fuel Stops" / "Diesel" tab.
3. Compare payment mode values across recorded fuel stops.

## 5. Impact and risk

Inconsistent visual styling makes auditing payment methods across multi-stop journeys prone to oversight.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Missing case in payment mode switch-statement in fuel table cell renderer.

## 7. Investigation required

- Inspect `frontend/src/components/trips/TripFuelTab.tsx`.

## 8. Proposed resolution or agreed design

Implement a uniform payment mode badge formatter:
- `cash_advance`: Blue / Indigo badge.
- `fuel_card`: Purple / Violet badge.
- `vendor_credit`: Amber / Orange badge.

## 9. Acceptance criteria

- [x] All fuel payment modes render in uniform badges across the fuel ledger table.
- [x] No payment mode value renders as uncontained plain text.

## 10. Required tests

- Component tests for fuel stop table rendering all payment mode options: Completed in `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts` (14 passing).
- Production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-044](../financial-accounting/FF-ISSUE-044-fuel-payment-mode-ledger-semantics.md).

## 12. Verification evidence

- Implemented `.badge-primary` in `frontend/src/styles/components/badges.css` using `--color-primary-bg`, `--color-primary-border`, and `--color-primary-text` defined in `variables.css`.
- Fixed Fleet Fuel Card payment mode badge in `JourneyDetailPage.tsx` which was already coded with `badge badge-primary`.
- Documented in [`docs/testing/audit/BATCH_H1_AUDIT_REPORT.md`](../../audit/BATCH_H1_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase8BatchH1PrimitivesAndAccessibility.test.ts`.
