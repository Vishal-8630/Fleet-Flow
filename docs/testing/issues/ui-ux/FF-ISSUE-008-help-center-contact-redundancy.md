# Redundancy and Ambiguous Boundary Between Help Center and Contact Pages

## Metadata

- **ID:** FF-ISSUE-008
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed / Needs Verification
- **Affected module:** Public Navigation & Support Pages
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-009)
- **Related issues:** None
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The public marketing navigation provides separate links for "Help Center" and "Contact", but the content across these two destinations appears largely duplicative and lacks distinct functional boundaries.

## 2. Observed behavior

Both the Help Center page and the Contact Us page present contact inquiry forms, support email addresses, and general help inquiries with significant overlap in copy and purpose.

## 3. Expected behavior

Each public destination should have a distinct, well-defined purpose:
- **Contact Us (`/contact`):** Focused on commercial inquiries, sales demo requests, and corporate headquarters contact details.
- **Help Center (`/help`):** Focused on user guides, FAQ search, troubleshooting documentation, and support ticket submission for registered users.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/contact`.
2. Note the page structure, forms, and contact cards.
3. Navigate to `http://localhost:5173/help` (or Help Center link).
4. Compare content and identify overlapping sections.

## 5. Impact and risk

User confusion regarding where to submit inquiries. Potential loss of inbound commercial sales leads due to diluted messaging.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Both pages were constructed independently using similar boilerplate contact/support components without clear information architecture guidelines.

## 7. Investigation required

- Inspect `frontend/src/pages/public/ContactPage.tsx` and `frontend/src/pages/public/HelpCenterPage.tsx`.
- Conduct section-by-section comparison before making recommendations to merge or differentiate.

## 8. Proposed resolution or agreed design

Differentiate the pages clearly:
- Dedicate `/contact` to sales, enterprise partnership inquiries, and physical office details.
- Dedicate `/help` to knowledge base articles, searchable FAQs, and customer onboarding tutorials.

## 9. Acceptance criteria

- [ ] Clear distinction between commercial sales contact (`/contact`) and customer help/documentation (`/help`).
- [ ] No duplicate inquiry forms or redundant copy between the two pages.

## 10. Required tests

- Navigation flow tests verifying proper routing and form submission targets.

## 11. Dependencies and related issues

- None.

## 12. Verification evidence

- Implementation and verification evidence pending.
