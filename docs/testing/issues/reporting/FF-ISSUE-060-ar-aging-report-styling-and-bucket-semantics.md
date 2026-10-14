# Accounts Receivable (AR) Aging Report Visual Styling and Aging Bucket Semantics

## Metadata

- **ID:** FF-ISSUE-060
- **Category:** Financial
- **Priority:** Medium
- **Status:** Needs Verification
- **Affected module:** Reporting & Analytics / AR Aging
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `N/A`
- **Related issues:** [FF-ISSUE-001](../ui-ux/FF-ISSUE-001-public-site-color-inconsistency.md), [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- **Related decisions:** N/A
- **Implementation status:** Not implemented

## 1. Summary

The AR Aging Report features bright colorful summary boxes and a prominent blue banner that clash with Fleet Flow's clean dashboard design, and aging bucket calculation semantics require audit.

## 2. Observed behavior

In manual testing, the AR Aging Report page rendered with vibrant saturated colored boxes and an intrusive blue header banner, differing sharply from the neutral, polished aesthetics of the main dashboard. Additionally, the bucket criteria (due date vs invoice date) were not documented.

## 3. Expected behavior

The AR Aging Report should adopt sleek, neutral metric cards with subtle borders and semantic status colors. Aging buckets (Current, 1-30, 31-60, 61-90, 90+ days) must clearly define whether aging is computed from Invoice Date or Invoice Due Date, correctly factoring partial payments and credit notes.

## 4. Reproduction steps

1. Navigate to Reports > AR Aging Report.
1. Observe visual styling of header banner and summary cards.
1. Inspect invoice breakdown across aging buckets.

## 5. Impact and risk

Visual inconsistency disrupts professional SaaS experience, while unclear aging bucket criteria can lead to misinterpretation of customer credit delinquency.

## 6. Root-cause status

Report page was built with ad-hoc styling outside the core design system tokens, and aging logic lacks documented calculation rules.

## 7. Investigation required

- Inspect `ARAgingReport` view component and CSS styling.
- Audit `reportService.getARAgingReport` backend query to verify whether bucket criteria use `invoice.issue_date` or `invoice.due_date`.
- Verify credit note deduction and partial receipt allocation in bucket totals.

## 8. Proposed resolution or agreed design

Restyle AR Aging Report to match dashboard design tokens, and document aging calculation policy in UI helper text (aging from Due Date).

## 9. Acceptance criteria

- [ ] AR Aging cards adhere to design system neutral cards and subtle borders.
- [ ] Aging buckets clearly indicate calculation baseline (e.g., Days Past Due).
- [ ] Bucket totals accurately reflect unpaid balances after partial payments and credit notes.

## 10. Required tests

- Reporting unit test: Verify invoices fall into correct aging bucket based on due date.
- Visual test: AR Aging cards match dashboard component styles.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-001](../ui-ux/FF-ISSUE-001-public-site-color-inconsistency.md), [FF-ISSUE-045](../financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- Related Decisions: N/A

## 12. Verification evidence

*Implementation and verification evidence are pending. No fixes have been applied in this documentation phase.*
