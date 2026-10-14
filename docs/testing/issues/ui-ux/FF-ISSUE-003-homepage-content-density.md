# Homepage Density, Visual Clutter and Unverified Performance Claims

## Metadata

- **ID:** FF-ISSUE-003
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Public Marketing Homepage
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-004)
- **Related issues:** [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md), [FF-ISSUE-002](FF-ISSUE-002-unwanted-fleet-roi-calculator.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The Fleet Flow marketing homepage contains excessive content density, visual clutter, repetitive value proposition blocks, and fabricated operational metrics (e.g. "99.8% on-time delivery", "15M+ km tracked") that lack empirical verification.

## 2. Observed behavior

The homepage features multiple stacked marketing sections containing dense paragraphs, decorative iconography, and stat callouts claiming specific fleet metrics and testimonials that have not been substantiated.

## 3. Expected behavior

The homepage should present a clean, concise, credible narrative focusing on core platform capabilities: multi-tenant fleet management, automated LR/invoice workflows, double-entry financial tracking, and real-time telematics, without unverified claims or cognitive overload.

## 4. Reproduction steps

1. Open `http://localhost:5173/`.
2. Scroll through the page from hero to footer.
3. Review statistic counters, customer logos, and marketing copy claims.

## 5. Impact and risk

Damages platform credibility with experienced fleet managers and logistics enterprises who recognize generic placeholder claims. Overwhelming content length reduces conversion rates.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Generic marketing template sections were filled with placeholder marketing copy and statistics during initial website setup.

## 7. Investigation required

- Review all copy in `frontend/src/pages/public/LandingPage.tsx`.
- Enumerate all statistical metrics and testimonials to identify unverified assertions.

## 8. Proposed resolution or agreed design

Condense homepage into five essential, high-impact sections:
1. Hero with clear B2B value proposition and direct "Start 7-Day Free Trial" call-to-action.
2. Core Capabilities Grid (Fleet, Trips, Invoicing, Ledger).
3. Live Interactive UI Preview / Screenshots.
4. Security & Multi-Tenancy Highlights.
5. Pricing Overview & Final CTA.
Remove fabricated numerical claims.

## 9. Acceptance criteria

- [ ] Homepage content length is reduced by at least 40%.
- [ ] All unverified metrics and claims are removed or replaced with factual software capability statements.
- [ ] Typography and spacing align with the app's clean enterprise design tokens.

## 10. Required tests

- Visual layout and responsiveness audit.
- Lighthouse performance and accessibility audit on `/` route.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md), [FF-ISSUE-002](FF-ISSUE-002-unwanted-fleet-roi-calculator.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
