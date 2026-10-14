# QST-014 — Incognito Workspace Authentication, Session State, and Invalidation (Retest LAST)

## Metadata

- **Question ID:** QST-014
- **Title:** Incognito Workspace Authentication, Session State, and Invalidation (Retest LAST)
- **Priority:** High
- **Status:** Investigation Required
- **Affected Module:** Authentication & Session Management
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md (Section 9, Q14)`
- **Related Issues:** [FF-ISSUE-058](../authentication-session/FF-ISSUE-058-incognito-session-instability.md)
- **Related Decisions:** N/A
- **Expected Owner / Phase:** Security & Auth Engineer / Inspect auth headers, token rotation, and cookie policies during Phase 1 code audit. Retest in browser strictly as the FINAL activity.

---

## 1. Core Question

What underlying mechanism causes intermittent empty workspace data and unexpected logout on page refresh in Incognito browser windows, and why does it stabilize after multiple attempts?

## 2. Background and Testing Context

Suraj Singh (dispatcher) and Admin logged in via Incognito, saw no data, and were logged out upon refresh. Later, the issue resolved itself. The user explicitly requested to keep this bug for the LAST re-test.

## 3. Evidence Required to Resolve

- [ ] Inspect cookie configuration (`SameSite`, `Secure`, `HttpOnly`, `Domain`) in auth middleware.
- [ ] Inspect client-side token storage (localStorage vs in-memory vs cookies) and refresh token rotation.
- [ ] Check tenant context initialization and race conditions between auth check and data fetching.

## 4. Planned Investigation Activity

Inspect auth headers, token rotation, and cookie policies during Phase 1 code audit. Retest in browser strictly as the FINAL activity.

## 5. Potential Outcomes and Architectural Impact

- **If Verified Working As Intended:** Document configuration and domain semantics in system documentation.
- **If Verified Defective:** File specific implementation ticket and implement targeted fix with regression tests.

## 6. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-058](../authentication-session/FF-ISSUE-058-incognito-session-instability.md)
- Related Decisions: N/A
- Master Source: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
