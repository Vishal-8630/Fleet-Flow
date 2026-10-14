# Duplicate GSTIN Accepted Across Distinct Customer Billing Parties

## Metadata

- **ID:** FF-ISSUE-033
- **Category:** Validation / Compliance
- **Priority:** High
- **Status:** Observed
- **Affected module:** Master Registries (Parties & Customers)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-020)
- **Related issues:** [FF-ISSUE-012](../ui-ux/FF-ISSUE-012-toast-zindex-and-dismissal.md), [FF-ISSUE-034](FF-ISSUE-034-duplicate-driver-aadhaar-mobile.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The application permits creating multiple distinct customer billing parties within the same tenant workspace using the exact same GSTIN (`27AAPFU0939F1ZV`), failing duplicate detection rules.

## 2. Observed behavior

During manual testing, two separate customer entities—"Essar LTD" and "Reliance Retail LTD"—were successfully saved under the same company workspace with the identical 15-character GSTIN `27AAPFU0939F1ZV`. No duplicate warning or rejection occurred.

## 3. Expected behavior

The system must define and enforce GSTIN uniqueness rules:
- Within a single tenant workspace, two customer records should not share the identical 15-character GSTIN unless explicitly designated as distinct physical branch consignees of the same corporate client.
- When an identical GSTIN is submitted, the system should either reject the creation with a clear validation error or prompt the user to link the new address/branch to the existing party record.

## 4. Reproduction steps

1. Navigate to Master Registries > Parties > Add Customer.
2. Create "Customer Alpha" with GSTIN `27AAPFU0939F1ZV` and save.
3. Click Add Customer again.
4. Create "Customer Beta" with the identical GSTIN `27AAPFU0939F1ZV` and save.
5. Observe both records saved successfully in the party list.

## 5. Impact and risk

Corrupts accounting and tax reconciliation. Tax invoices issued to two different customer names sharing the same GSTIN will trigger reconciliation failures during GSTR-1 and e-Way bill statutory filings.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** MongoDB schema for `BillingParty` lacks a compound unique index on `{ company_id: 1, gstin: 1 }`, and the creation controller lacks a pre-save duplication check.

## 7. Investigation required

- Inspect `backend/src/models/BillingParty.ts` and `partyController.ts`.
- Note: A single PAN can have multiple GSTINs across different states, but two different corporate names sharing the exact same state GSTIN within a tenant is invalid.

## 8. Proposed resolution or agreed design

1. Add a partial compound unique index: `BillingPartySchema.index({ company_id: 1, gstin: 1 }, { unique: true, sparse: true })`.
2. In `partyController.ts`, perform a pre-check: if a party with the same GSTIN exists, return `409 Conflict` with message `A party with GSTIN ${gstin} already exists (${existingParty.name})`.

## 9. Acceptance criteria

- [ ] Attempting to create a second party with the same GSTIN under the same tenant returns an actionable error.
- [ ] Users can easily locate the existing party to add branches or update details.
- [ ] Uniqueness is properly scoped per tenant (different tenants can legitimately serve the same client GSTIN).

## 10. Required tests

- Automated integration tests verifying 409 rejection on duplicate GSTIN within the same tenant.
- Test verifying cross-tenant isolation (Tenant B can create a customer with the same GSTIN as Tenant A).

## 11. Dependencies and related issues

- Related to [FF-ISSUE-034](FF-ISSUE-034-duplicate-driver-aadhaar-mobile.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
