# Support Ticket Message Thread and Reply Composer Horizontal Clipping

## Metadata

- **ID:** FF-ISSUE-021
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H5)
- **Affected module:** Help & Customer Support Module
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-014)
- **Related issues:** [FF-ISSUE-020](FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-022](FF-ISSUE-022-central-support-inbox-missing.md)
- **Related decisions:** None
- **Implementation status:** Implemented and verified in Batch H Phase H5

## 1. Summary

In the Support Ticket conversation detail view, message bubbles and the reply composer input are forced far to the right edge of the screen, leaving vast awkward whitespace on the left.

## 2. Observed behavior

When opening ticket `TICK-2026-0001`, conversation messages from Rohit Kumar and Vishal Super Admin, along with the reply textarea, are horizontally cramped against the right border. The left ~60% of the main content pane is completely empty.

## 3. Expected behavior

A balanced, professional two-pane or single-pane layout:
- Left pane (or top summary card): Ticket metadata, ID, status badge, priority, creator, creation date, assigned agent.
- Right pane (or central stream): Natural-width chat thread with distinct incoming vs outgoing message bubbles, timestamp headers, and an integrated bottom composer taking appropriate width.

## 4. Reproduction steps

1. Navigate to Support Tickets (`/support`).
2. Open an existing ticket with conversation replies (e.g. `TICK-2026-0001`).
3. Observe the message bubbles and reply input compressed against the right margin.

## 5. Impact and risk

Severe usability friction when reading multi-turn support threads. Makes communication between operators and clients look unpolished and buggy.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Missing or broken flex/grid layout properties on the ticket detail container, likely an unclosed column or misconfigured `justify-end` / `ml-auto` class.

## 7. Investigation required

- Inspect `frontend/src/pages/support/TicketDetailPage.tsx` or `TicketConversationView.tsx`.

## 8. Proposed resolution or agreed design

Re-structure into standard layout: `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`, allocating 1 column to ticket summary and 2 columns to the conversation stream.

## 9. Acceptance criteria

- [x] Conversation thread and reply composer occupy appropriate, readable width.
- [x] Left pane clearly displays ticket metadata, status, and SLA timers.
- [x] Input composer remains pinned or easily accessible at the base of the thread.

## 10. Required tests

- Component tests for responsive conversation pane and composer: `backend/src/tests/integration/phase8BatchH5FormsAndReporting.test.ts` (14 passing).
- Frontend production build verification: `npm --prefix frontend run build` (Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-020](FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-022](FF-ISSUE-022-central-support-inbox-missing.md).

## 12. Verification evidence

- Implemented responsive two-pane layout using `gridTemplateColumns: selectedTicket ? 'minmax(300px, 360px) 1fr' : '1fr'` in `frontend/src/pages/support/SupportTicketsPage.tsx`.
- Formatted message bubbles with natural readable max-width (`maxWidth: '75%'`), distinct user vs support backgrounds, and timestamps.
- Reply composer styled with standard `.form-control` and `.btn .btn-primary` pinned at thread base.
- Preserved `replyText` in component state across ticket selection and detail closure so unsent drafts are not lost.
- Automated tests passing: `phase8BatchH5FormsAndReporting.test.ts` (14/14).
- Production build passing: `tsc -b && vite build` built in 2.64s.
