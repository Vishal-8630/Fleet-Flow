# Validation Error Toast Renders Behind Active Modal and Auto-Dismisses Too Rapidly

## Metadata

- **ID:** FF-ISSUE-012
- **Category:** UI-UX
- **Priority:** High
- **Status:** Resolved (Batch E6)
- **Affected module:** Global Toast Notifications & Modal Dialogs
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-019)
- **Related issues:** [FF-ISSUE-033](../data-validation/FF-ISSUE-033-duplicate-gstin-billing-parties.md)
- **Related decisions:** None
- **Implementation status:** Implemented & Verified in Batch E6

## 1. Summary

Error toast notifications (such as GSTIN validation errors) render beneath active modal backdrops due to improper z-index stacking, and auto-dismiss too rapidly before users can read the error message.

## 2. Observed behavior

When triggering a validation error inside a modal dialog (e.g. Create Billing Party modal), the error toast appears partially or completely obscured behind the modal backdrop. Furthermore, the toast vanishes within ~2-3 seconds, leaving the user unaware of why their submission failed.

## 3. Expected behavior

- Global toast notifications must render in a top-level portal with a z-index higher than all modal dialogs and backdrops (`z-index: 9999`).
- Error toasts should remain visible for at least 5-6 seconds.
- Hovering over a toast must pause the auto-dismiss timer until the cursor leaves.
- Critical form validation errors should also be displayed inline directly below the offending input field.

## 4. Reproduction steps

1. Open Master Registries > Parties > Add Customer.
2. Enter an invalid GSTIN string in the modal form and submit.
3. Observe the error toast rendering behind the modal dialog and disappearing quickly.

## 5. Impact and risk

Users cannot diagnose why form submissions fail. They may repeatedly click submit, generating duplicate requests or abandoning workflows.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Toast container has a lower z-index (e.g. `z-50`) than the modal backdrop container (e.g. `z-[100]`), and toast timeout is hardcoded to ~2500ms without `onMouseEnter` timer pause listeners.

## 7. Investigation required

- Inspect toast provider component in `frontend/src/context/ToastContext.tsx` or `frontend/src/components/common/Toast.tsx`.
- Check z-index stacking contexts between modal portals and toast containers.

## 8. Proposed resolution or agreed design

1. Update Toast container to use `z-index: 99999` rendered via `createPortal` into `document.body`.
2. Configure error toasts with 6000ms duration and warning/info toasts with 4000ms duration.
3. Add mouse enter / mouse leave handlers to pause and resume the dismissal timeout.
4. Add close button (`×`) to all toasts.

## 9. Acceptance criteria

- [x] Toast notifications render strictly above all modal dialogs, backdrops, and sidebars (`z-index: 9999` portaled to `document.body`).
- [x] Error toasts remain visible for at least 6 seconds (6000ms) unless manually closed.
- [x] Non-error toasts preserve default 4500ms duration.
- [x] Hovering over a toast pauses the auto-dismiss countdown.
- [x] Leaving hover resumes countdown with exact remaining duration.
- [x] Toast is accessible via keyboard and screen readers (`aria-live="polite"`, `role="alert"`).

## 10. Required tests

- Unit & integration tests verifying z-index hierarchy, portal mounting, duration defaults, and remaining-time hover pause/resume logic: Completed in `backend/src/tests/integration/phase5BatchE6UiAndToastHardening.test.ts` (16 passing).
- Frontend production build verification (`tsc -b && vite build`: Exit Code 0).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-033](../data-validation/FF-ISSUE-033-duplicate-gstin-billing-parties.md).

## 12. Verification evidence

- Documented in [`docs/testing/audit/BATCH_E6_AUDIT_REPORT.md`](../../audit/BATCH_E6_AUDIT_REPORT.md).
- Automated test suite: `backend/src/tests/integration/phase5BatchE6UiAndToastHardening.test.ts` (16 passing).
- Cumulative regression test suite: 125/125 passing across all 7 test files.
- Production build verified with zero errors.

