# Public Security Page Content Overload for Top-Level Marketing

## Metadata

- **ID:** FF-ISSUE-007
- **Category:** UI-UX
- **Priority:** Medium
- **Status:** Observed
- **Affected module:** Public Security Page
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-008)
- **Related issues:** [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The public Security page (`/security`) contains excessive technical, cryptographic, and operational details on the top-level marketing page, overwhelming commercial prospects while obscuring core compliance highlights.

## 2. Observed behavior

The Security page displays exhaustive paragraphs covering database connection strings, cipher suites, container isolation mechanics, and low-level internal configurations in a single long scroll.

## 3. Expected behavior

The top-level Security marketing page should provide a concise, reassuring executive overview (SOC2 readiness, 256-bit TLS encryption, strict multi-tenant isolation, automated hourly backups, Indian data residency) while providing downloadable or dedicated sub-pages for granular technical and legal policies.

## 4. Reproduction steps

1. Navigate to `http://localhost:5173/security`.
2. Inspect the volume of low-level technical documentation presented.

## 5. Impact and risk

High cognitive load for business decision-makers. Potential unintentional leakage of specific infrastructure topology details while failing to clearly communicate high-level trust assurances.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** Engineering architecture documentation was placed directly into the marketing `SecurityPage.tsx` view without content editing for commercial buyers.

## 7. Investigation required

- Inspect `frontend/src/pages/public/SecurityPage.tsx`.
- Cross-reference with legal and compliance commitments to ensure legally required disclosures remain accessible.

## 8. Proposed resolution or agreed design

Restructure `SecurityPage.tsx` into four executive trust pillars:
1. Data Protection & Encryption (At rest via AES-256, in transit via TLS 1.3).
2. Multi-Tenant Logical Isolation (Strict company boundary enforcement).
3. Availability & Disaster Recovery (Continuous replication, automated backups).
4. Compliance & Statutory Governance (Indian data privacy, GST audit trails).
Link out to a separate detailed Security Whitepaper or Policy document if required.

## 9. Acceptance criteria

- [ ] Top-level security page is concise, structured, and easily readable by commercial buyers.
- [ ] No confidential infrastructure topology details are unnecessarily exposed.
- [ ] Factual security and compliance commitments are preserved without distortion.

## 10. Required tests

- Responsive layout and visual scanability review.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-001](FF-ISSUE-001-public-site-color-scheme.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
