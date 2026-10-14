# Support Ticket Message Thread and Reply Composer Horizontal Clipping

## Metadata

- **ID:** FF-ISSUE-021
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Help & Customer Support Module
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-014)
- **Related issues:** [FF-ISSUE-020](FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-022](FF-ISSUE-022-central-support-inbox-missing.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

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

- [ ] Conversation thread and reply composer occupy appropriate, readable width.
- [ ] Left pane clearly displays ticket metadata, status, and SLA timers.
- [ ] Input composer remains pinned or easily accessible at the base of the thread.

## 10. Required tests

- Visual snapshot tests across tablet and desktop screen widths.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-020](FF-ISSUE-020-support-ticket-form-layout.md), [FF-ISSUE-022](FF-ISSUE-022-central-support-inbox-missing.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
