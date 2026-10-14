# Features Page Layout Density and Lack of Module Categorization

## Metadata

- **ID:** FF-ISSUE-004
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Public Marketing Features Page
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-005)
- **Related issues:** [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md), [FF-ISSUE-003](FF-ISSUE-003-homepage-content-density.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The dedicated Features page (`/features`) is visually overcrowded with an unorganized collection of feature cards, making it difficult for prospective customers to understand the functional depth of individual operational modules.

## 2. Observed behavior

Visiting `/features` presents a continuous grid of dense cards displaying feature bullet points without clear logical grouping between Fleet Operations, Commercial Billing, Accounting/Ledgers, and Enterprise Administration.

## 3. Expected behavior

The Features page should group capabilities into distinct, tabbed or segmented operational domains:
- Fleet & Driver Registries
- Trip Dispatch & Live Telematics
- Commercial Engine (LRs, Invoices, Settlements)
- Double-Entry General Ledger
- Multi-Branch & Security Architecture
Descriptions should be concise and focused on operational benefits.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/features`.
2. Inspect the presentation and organization of listed features.

## 5. Impact and risk

Prospects cannot quickly evaluate whether Fleet Flow satisfies specific operational requirements (e.g. GST compliance, vendor payouts, driver settlements).

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Features page renders a flat map of feature objects without domain-level categorization or whitespace rhythm.

## 7. Investigation required

- Inspect `frontend/src/pages/public/FeaturesPage.tsx`.
- Check feature data structure in frontend constants or component state.

## 8. Proposed resolution or agreed design

Re-architect `FeaturesPage.tsx` with a domain-based segmented navigation bar (e.g. Fleet, Operations, Finance, Governance) allowing users to switch views or scroll smoothly between structured sections.

## 9. Acceptance criteria

- [ ] Features are organized into clear domain sections with concise copy.
- [ ] Card spacing and typography adhere to design tokens with adequate whitespace.
- [ ] Each domain highlights 3-4 key workflows with clear visual hierarchy.

## 10. Required tests

- Component tests for domain switching or section scrolling.
- Cross-browser responsive rendering tests.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
