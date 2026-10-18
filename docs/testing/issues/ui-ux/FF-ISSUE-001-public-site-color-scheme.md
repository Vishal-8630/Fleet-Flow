# Inconsistent Public-Site Color Scheme and Dark Gradient Overdecoration

## Metadata

- **ID:** FF-ISSUE-001
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Resolved (Batch H4)
- **Affected module:** Public Marketing Pages & Landing Shell
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-001)
- **Related issues:** [FF-ISSUE-003](FF-ISSUE-003-homepage-content-density.md), [FF-ISSUE-005](FF-ISSUE-005-pricing-page-redesign.md)
- **Related decisions:** None
- **Implementation status:** Implemented (Batch H4)

## 1. Summary

The public marketing pages across Fleet Flow utilize dark, heavy gradient and multi-color background styling that starkly contrasts with the clean, light, professional aesthetic established in the authentication screens (Sign In, Start Free Trial) and the authenticated SaaS dashboard.

## 2. Observed behavior

When navigating the public marketing website, hero sections, cards, and banners feature dark gradient palettes, neon-like accents, and saturated color transitions. Upon navigating to `/login`, `/register`, or the logged-in app dashboard at `/dashboard`, the user experiences a jarring visual transition to a structured, light, clean business application theme.

## 3. Expected behavior

A unified, coherent design system should be shared across the entire public and private platform. Public landing pages should reflect the brand identity, typography, card borders, and restrained color palette found in the authenticated dashboard rather than overdecorated dark gradients.

## 4. Reproduction steps

1. Navigate to the root homepage at `http://localhost:5173/`.
2. Inspect hero banner, feature highlights, and footer visual styling.
3. Click "Sign In" or "Start Free Trial" in the top navigation.
4. Observe the immediate visual disconnect between the public marketing theme and the clean authentication form layout.

## 5. Impact and risk

Creates an unpolished, fragmented brand impression for prospective commercial buyers. Dark gradient overdecoration detracts from enterprise credibility and readability.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Frontend CSS for public marketing routes (`LandingPage.tsx`, `Navbar.tsx`) was developed with isolated standalone CSS or CSS Module styling using dark gradient utility classes, unaligned with the core design token library in `frontend/src/styles/`.

## 7. Investigation required

- Audit public marketing page styles in `frontend/src/pages/public/` and `frontend/src/components/landing/`.
- Check shared tokens in `frontend/src/styles/tokens/` for surface, background, and brand colors.
- Verify whether Tailwind or custom CSS classes are introducing divergent color schemes.

## 8. Proposed resolution or agreed design

Refactor public marketing pages to use Fleet Flow's canonical light-mode design tokens: clean neutral white/slate backgrounds (`#FFFFFF`, `#F8FAFC`), subtle slate borders (`#E2E8F0`), deep navy/slate typography (`#0F172A`), and selective primary accent blue (`#2563EB`).

## 9. Acceptance criteria

- [x] Public marketing pages (Home, Features, Pricing, Security, Contact) share the typography, surface colors, and border radius of the authenticated dashboard.
- [x] Heavy multi-color dark gradients are replaced with clean, high-contrast, modern business surfaces.
- [x] Transition between landing pages, login, and dashboard feels visually continuous and cohesive.

## 10. Required tests

- Frontend visual regression snapshot tests for public routes (`/`, `/features`, `/pricing`, `/security`).
- Responsive layout verification across 375px (mobile), 768px (tablet), and 1440px (desktop).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-003](FF-ISSUE-003-homepage-content-density.md) (Homepage Density).
- Related to [FF-ISSUE-005](FF-ISSUE-005-pricing-page-redesign.md) (Pricing Page Redesign).

## 12. Verification evidence

- Refactored `PublicLayout.tsx`, `HomePage.tsx`, `FeaturesPage.tsx`, and `PricingPage.tsx` to use light-mode tokens (`var(--bg-app)`, `var(--bg-surface)`, `var(--border-light)`, `var(--text-primary)`, `var(--color-slate-50)`).
- Validated via `backend/src/tests/integration/phase8BatchH4PublicAndAuthShell.test.ts`.
- Validated frontend production bundle build (`npm --prefix frontend run build`).
