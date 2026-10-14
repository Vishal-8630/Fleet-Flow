# Authentication Pages Omit Navigation Bar and Footer

## Metadata

- **ID:** FF-ISSUE-009
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed / Needs Verification
- **Affected module:** Authentication Pages (Login, Register, Password Reset)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-010)
- **Related issues:** [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The user authentication pages (`/login`, `/register`, `/forgot-password`) are completely isolated without a header navigation bar or a footer, which prevents users from navigating back to the public website or accessing legal/privacy links.

## 2. Observed behavior

Visiting `/login` or `/register` renders a centered card layout on a blank background. There is no top bar with the Fleet Flow logo linking home, and no footer providing links to Terms of Service, Privacy Policy, or Contact.

## 3. Expected behavior

A deliberate design decision must be established:
- While distraction-free login pages are a recognized SaaS design pattern, a minimal header (logo linking to `/`) and a minimal footer (Privacy Policy, Terms of Service, Copyright) are industry standard to maintain brand context and legal compliance.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/login`.
2. Observe the complete absence of a top navigation bar or bottom footer.
3. Note that the only way to return to the marketing site is using the browser back button.

## 5. Impact and risk

Prospects who click "Sign In" cannot easily navigate back to marketing pages to read about pricing or features. Legal privacy policies are inaccessible during account registration.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Auth routes are rendered under an unadorned auth layout route that omits `<Navbar />` and `<Footer />`.

## 7. Investigation required

- Inspect `frontend/src/layouts/AuthLayout.tsx` and `frontend/src/App.tsx` route hierarchy.

## 8. Proposed resolution or agreed design

Implement a clean `AuthHeader` (Fleet Flow brand logo linking to `/`, and a subtle "New to Fleet Flow? Start Trial" link) and a minimal `AuthFooter` (Terms of Service, Privacy Policy, Copyright notice) within `AuthLayout.tsx`.

## 9. Acceptance criteria

- [ ] Auth pages include a minimal, distraction-free header with a clickable logo returning to `/`.
- [ ] Auth pages include a minimal footer with links to Terms of Service and Privacy Policy.
- [ ] Layout remains responsive on mobile screens without pushing form inputs off-screen.

## 10. Required tests

- Snapshot tests of `/login` and `/register` with header/footer present.
- Mobile viewport validation to verify virtual keyboard visibility.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
