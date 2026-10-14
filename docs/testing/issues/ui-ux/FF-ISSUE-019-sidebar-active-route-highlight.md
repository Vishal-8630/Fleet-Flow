# Sidebar Active Menu Item Highlight Missing on Nested Navigation Routes

## Metadata

- **ID:** FF-ISSUE-019
- **Category:** UI-UX
- **Priority:** Low
- **Status:** Observed
- **Affected module:** App Shell & Navigation Sidebar
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.D, Sidebar active state missing)
- **Related issues:** None
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

Navigating to nested or action-driven sub-routes (such as clicking "Disburse" from Dashboard > Driver Payouts to reach Driver Settlements) causes the sidebar to lose its active menu highlight, disorienting the user.

## 2. Observed behavior

From Dashboard > Driver Payouts, clicking the "Disburse" button correctly navigates to the Driver Settlements page (`/settlements/new` or `/settlements`), but the left navigation sidebar highlights no active item, leaving the user with no visual cue of their current workspace location.

## 3. Expected behavior

The navigation sidebar should maintain active state highlighting for the parent or corresponding module whenever the user is on any child route, creation modal, or nested detail page.

## 4. Reproduction steps

1. Navigate to Executive Dashboard (`/dashboard`).
2. Scroll to the Driver Payouts widget.
3. Click "Disburse" on any driver row.
4. Arrive at Driver Settlements and observe the left sidebar: no menu link is highlighted.

## 5. Impact and risk

Degrades spatial orientation within the application. Users lose context of where they are in the multi-tier hierarchy.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Sidebar active link matching uses exact pathname matching (`location.pathname === item.path`) rather than prefix or route pattern matching (`location.pathname.startsWith(item.path)`).

## 7. Investigation required

- Inspect `frontend/src/components/layout/Sidebar.tsx` route matching logic.

## 8. Proposed resolution or agreed design

Update sidebar active state matcher to support prefix matching:
`const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);`

## 9. Acceptance criteria

- [ ] Navigating to `/settlements`, `/settlements/new`, or `/settlements/:id` highlights the "Settlements" sidebar link.
- [ ] Child routes across all modules (Trips, Invoices, Trucks, Drivers) maintain active parent sidebar highlighting.

## 10. Required tests

- Unit tests for Sidebar active state matching across nested paths.

## 11. Dependencies and related issues

- None.

## 12. Verification evidence

- Implementation and verification evidence pending.
