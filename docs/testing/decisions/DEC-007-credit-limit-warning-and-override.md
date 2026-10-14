# DEC-007 — Customer Credit Limit Exceeded Warning and Authorized Override

## Metadata

- **Decision ID:** DEC-007
- **Title:** Customer Credit Limit Exceeded Warning and Authorized Override
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)

---

## 1. Context and Problem Statement

Operating trips for customers who have exceeded their credit terms risks bad debt, but rigid hard blocks can paralyze critical freight dispatches during emergency operations.

## 2. Decision Statement

When a new trip dispatch or freight booking will cause a customer's outstanding balance (open invoices + pending unbilled freight) to exceed their configured Credit Limit:
1. The system displays a prominent visual Warning Modal detailing current outstanding, planned freight, credit limit, and overage amount.
2. Dispatch is blocked for standard dispatchers.
3. An authorized manager (Admin or Commercial Manager) can execute an Authorized Override by entering a mandatory justification reason, which is permanently logged in the audit trail.

## 3. Alternatives Considered and Trade-Offs

Hard stop without override was rejected as commercially impractical for urgent shipments; unconstrained credit without warnings was rejected due to credit risk.

## 4. Consequences

Customer records must configure `credit_limit` and track current exposure. Trip dispatch endpoint must evaluate credit exposure before confirming dispatch.

## 5. Implementation Implications

Add credit limit calculation helper: `currentExposure = sum(openInvoices) + sum(dispatchedUnbilledTrips)`. Integrate authorization check in dispatch controller.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Attempting dispatch for customer exceeding credit limit raises warning modal.
- [ ] Standard dispatchers cannot bypass warning without authorized manager credential/approval.
- [ ] Override requires mandatory justification reason and creates immutable audit record.
- [ ] Customer profile displays credit limit, current exposure, and available credit headroom.

## 7. Explicit Scope Boundaries

Governs trip dispatch and order confirmation against customer credit limits.

## 8. What is Not Yet Implemented or Verified

Credit limit warning modal and manager override backend workflow are not yet implemented.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
