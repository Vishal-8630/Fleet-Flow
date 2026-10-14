# Intermittent Incognito Session Data Blanking and Immediate Logout on Refresh

## Metadata

- **ID:** FF-ISSUE-058
- **Category:** Bug / Authentication
- **Priority:** High / Intermittent
- **Status:** Observed / Needs Verification (RETEST LAST)
- **Affected module:** Authentication, JWT Sessions & Tenant Context Initialization
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.H, Incognito workspace data/session issue)
- **Related issues:** None
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

In Chrome/Edge Incognito windows, newly logged-in users intermittently experience an empty data state (zero records visible), and refreshing the browser immediately terminates the session and redirects to `/login`, while standard browser sessions remain stable.

## 2. Observed behavior

Invited dispatcher Suraj Singh logged in via an Incognito window:
1. Upon login, the dashboard and master registries rendered completely blank (no trucks, no journeys).
2. Pressing F5 / browser reload immediately logged the user out.
3. Repeating the login with Admin credentials in Incognito exhibited the same logout behavior on refresh.
4. However, after subsequent attempts, both accounts began functioning normally in Incognito without dropping sessions.

## 3. Expected behavior

Authentication sessions in Incognito mode must be completely stable:
- Session cookies (`token`, `refreshToken`) must persist across browser refreshes within the Incognito window lifetime.
- Data fetching on initial route mount must reliably resolve tenant context without race conditions.

## 4. Reproduction steps

1. Open a clean Incognito / Private browser window.
2. Navigate to `http://localhost:5173/login` and log in.
3. Observe whether data loads immediately or appears empty.
4. Refresh the page (F5) and observe whether the session persists or redirects to `/login`.
*Note: Per explicit user instruction, this bug must be retested last after other system fixes.*

## 5. Impact and risk

High user friction and perceived instability. Users testing or working on private/shared terminals can be locked out or experience confusing data loading failures.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Hypotheses include:
  1. Incognito third-party cookie blocking or strict partition settings affecting `HttpOnly` cookies on `localhost`.
  2. A race condition between `authStore` rehydration and initial API calls before tenant context is bound.
  3. Token refresh endpoint failing during the initial window mount.

## 7. Investigation required

- Inspect cookie settings in `backend/src/utils/jwtHelper.ts` (`SameSite`, `Secure`, `Domain`, `Path`).
- Inspect `frontend/src/store/authStore.ts` initialization and Axios response interceptors for 401 redirect logic.

## 8. Proposed resolution or agreed design

1. Audit and harden cookie configuration: ensure `SameSite: 'lax'` for local dev and strict secure flags for production.
2. In Axios interceptors, avoid eager logout on initial transient 401 if a silent token refresh is in progress.
3. Ensure tenant store rehydrates before firing global registry queries.

## 9. Acceptance criteria

- [ ] Logging in via Incognito mode consistently loads tenant data on initial render.
- [ ] Refreshing any page in Incognito mode maintains the active session without redirecting to login.
- [ ] Retest confirmed across Admin and Dispatcher roles.

## 10. Required tests

- Automated Playwright/Cypress end-to-end tests verifying session persistence across page reloads in private browsing mode.

## 11. Dependencies and related issues

- Must be retested **last** after all other functional fixes.

## 12. Verification evidence

- Implementation and verification evidence pending.
