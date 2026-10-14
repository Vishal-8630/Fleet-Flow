# QST-008 — Vehicle, Driver, and Checkpoint Stale State Causes and Invalidation Triggers

## Metadata

- **Question ID:** QST-008
- **Title:** Vehicle, Driver, and Checkpoint Stale State Causes and Invalidation Triggers
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Frontend State Architecture / Real-time Sync
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q8)`
- **Related Issues:** [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-028](../fleet-assignments/FF-ISSUE-028-vehicle-current-driver-stale-display.md), [FF-ISSUE-032](../fleet-assignments/FF-ISSUE-032-vehicle-status-stale-after-dispatch.md), [FF-ISSUE-036](../trip-lifecycle/FF-ISSUE-036-checkpoint-missing-until-browser-refresh.md)
- **Related Decisions:** N/A
- **Expected Owner / Phase:** Frontend Architect / Audit global query client configuration and mutation callbacks during Phase 3.

---

## 1. Core Question

What architectural root causes lead to vehicle, driver, and checkpoint mutations remaining stale until manual browser refresh across multiple operational views?

## 2. Background and Testing Context

Multiple independent workflows (driver assignment, vehicle dispatch, checkpoint logging) fail to refresh client views without hard browser reloads.

## 3. Evidence Required to Resolve

- [ ] Inspect client state library (React Query, RTK Query, SWR, or Context).
- [ ] Check whether mutations invoke `invalidateQueries` with exact matching query keys.
- [ ] Check if websocket or Server-Sent Events (SSE) subscriptions exist or are disconnected.

## 4. Planned Investigation Activity

Audit global query client configuration and mutation callbacks during Phase 3.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-017](../ui-ux/FF-ISSUE-017-driver-assignment-stale-state.md), [FF-ISSUE-028](../fleet-assignments/FF-ISSUE-028-vehicle-current-driver-stale-display.md), [FF-ISSUE-032](../fleet-assignments/FF-ISSUE-032-vehicle-status-stale-after-dispatch.md), [FF-ISSUE-036](../trip-lifecycle/FF-ISSUE-036-checkpoint-missing-until-browser-refresh.md)
- Related Decisions: N/A
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
