# Support Ticket Creation Form Spacing, Field Boundaries, and Layout Distortion

## Metadata

- **ID:** FF-ISSUE-020
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H5)
- **Affected module:** Help & Customer Support Module
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-013)
- **Related issues:** [FF-ISSUE-021](FF-ISSUE-021-support-ticket-thread-layout.md), [FF-ISSUE-022](FF-ISSUE-022-central-support-inbox-missing.md)
- **Related decisions:** None
- **Implementation status:** Implemented and verified in Batch H Phase H5

## 1. Summary

The New Support Ticket creation form suffers from severe layout distortion: fields stretch across excessive horizontal space in a three-column grid, input borders lack definition, and an empty-state illustration erroneously renders directly below the active form.

## 2. Observed behavior

When opening the Support Ticket creation screen, the form elements (Subject, Category, Priority, Description) are spread across three wide columns with excessive whitespace. Text inputs lack clear border boundaries, appearing like floating text. Directly beneath the unsubmitted form, an "Empty Ticket List" placeholder illustration remains visible simultaneously.

## 3. Expected behavior

The ticket creation form should render in a focused, compact, centered card or standard two-column layout with:
- Crisp input boundaries (`#CBD5E1` border), distinct focus rings, and clear labels.
- Logical vertical form hierarchy (Subject, Category/Priority selector, Message/Description textarea, Attachment dropzone).
- Proper view switching: opening the form should hide the empty ticket list view.

## 4. Reproduction steps

1. In the authenticated SaaS dashboard, navigate to Support / Help Tickets (`/support`).
2. Click "Create Ticket" or "New Ticket".
3. Observe horizontal field stretching and the presence of the empty-state graphic beneath the active form.

## 5. Impact and risk

Poor visual polish in customer-facing support workflows. Degrades confidence when customers are already experiencing issues and seeking assistance.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Support page layout fails to conditionally unmount the ticket list/empty-state container when `isCreating` is true, and applies an unrestrained `grid grid-cols-3` layout class across full screen width.

## 7. Investigation required

- Inspect `frontend/src/pages/support/SupportTicketsPage.tsx` and `CreateTicketForm.tsx`.

## 8. Proposed resolution or agreed design

Wrap ticket creation in a dedicated container or modal with `max-w-2xl mx-auto`, standard form input classes, and strict conditional rendering: `{isCreating ? <CreateTicketForm /> : <TicketList />}`.

## 9. Acceptance criteria

- [x] Support ticket creation form renders in a clean, compact container with consistent input styling.
- [x] Empty state graphic is completely hidden while the creation form is active.
- [x] Form is fully responsive on mobile and desktop viewports.

## 10. Required tests

- Component tests for Support page in viewing vs creating state: `backend/src/tests/integration/phase8BatchH5FormsAndReporting.test.ts` (14 passing).
- Frontend production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-021](FF-ISSUE-021-support-ticket-thread-layout.md).

## 12. Verification evidence

- Implemented strict conditional view switching `{showCreate ? <CreateForm /> : <TicketListingAndDetail />}` in `frontend/src/pages/support/SupportTicketsPage.tsx`, completely eliminating co-rendering of empty state graphics with unsubmitted forms.
- Re-aligned the form grid from an asymmetrical 3-column layout into an auto-fit 2-column balanced grid with `maxWidth: 720px` card container.
- Applied `.form-control` classes to Subject, Category, Priority, and Message inputs.
- Automated tests passing: `phase8BatchH5FormsAndReporting.test.ts` (14/14).
- Production build passing: `tsc -b && vite build` built in 2.64s.
