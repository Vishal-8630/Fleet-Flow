# Market Movement List View Overcrowded and Visually Clipped

## Metadata

- **ID:** FF-ISSUE-049
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Market Movements / Movement Listing
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-041`
- **Related issues:** [FF-ISSUE-048](FF-ISSUE-048-market-movement-status-ambiguity-pod.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

Market Movement list view suffers from excessive columns, horizontal text clipping, and inconsistent status badge styling.

## 2. Observed behavior

The Market Movement table displays too many data columns crammed into a single view, resulting in clipped text, horizontal scrolling issues, and inconsistent status badges across rows.

## 3. Expected behavior

A clean, scannable table focusing on primary operational identifiers (Movement ID, Truck/Broker, Route, Dates, Delivery & Settlement Status, Actions) with a comprehensive detail view for financial breakdowns and settlement history.

## 4. Reproduction steps

1. Navigate to Commercial > Market Movements.
1. Inspect table layout on standard 1080p and smaller screens.
1. Observe text truncation, crowded columns, and horizontal overflow.

## 5. Impact and risk

Poor readability and navigation friction; operators struggle to view critical movement details quickly.

## 6. Root-cause status

Table component attempts to render all financial and transit fields in one flat table without column prioritization or responsive container styling.

## 7. Investigation required

- Inspect `MarketMovementTable` component columns.
- Identify essential vs secondary columns.
- Check badge component consistency.

## 8. Proposed resolution or agreed design

Streamline table columns to core essentials, standardize status badges, and provide quick slide-over or dedicated detail view for full financial settlement data.

## 9. Acceptance criteria

- [ ] Table fits cleanly without awkward truncation on standard desktop resolutions.
- [ ] Columns prioritize Movement ID, Broker/Truck, Route, Delivery Status, Settlement Status, and Net Due.
- [ ] Status badges use shared design tokens.

## 10. Required tests

- Responsive UI test: Table renders cleanly across screen widths.
- Visual regression test: Badges conform to shared palette.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-048](FF-ISSUE-048-market-movement-status-ambiguity-pod.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
