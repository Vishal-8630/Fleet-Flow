# DEC-006 — Manual and Automatic Payment Allocation to Invoices

## Metadata

- **Decision ID:** DEC-006
- **Title:** Manual and Automatic Payment Allocation to Invoices
- **Status:** Approved
- **Date:** Approved design direction
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md), [FF-ISSUE-060](../issues/reporting/FF-ISSUE-060-ar-aging-report-styling-and-bucket-semantics.md)

---

## 1. Context and Problem Statement

When customers remit lump-sum payments or partial settlements, transport operators need flexible allocation methods to reconcile outstanding receivables against specific invoices.

## 2. Decision Statement

Fleet Flow supports both manual and automatic allocation of customer receipts and vendor payments to open invoices:
1. **Automatic FIFO Allocation:** Default allocation applies received funds to the oldest unpaid invoice first (FIFO by invoice due date).
2. **Manual Allocation:** Users can explicitly specify exact payment amounts against individual selected invoices, accommodating disputed line items or specific bill payments.
3. **Unallocated Balance:** Any excess receipt remains as unallocated customer credit on account.

## 3. Alternatives Considered and Trade-Offs

Enforcing strictly manual or strictly automatic allocation was rejected due to common freight industry practices of disputed or selective bill clearances.

## 4. Consequences

Payment receipt records must track allocated amounts per invoice and maintain an unallocated balance field. Invoices track `paid_amount` and `balance_due`.

## 5. Implementation Implications

Implement `paymentAllocationService` supporting FIFO auto-allocation and explicit manual allocation splits within an ACID transaction.

## 6. Acceptance Criteria and Verification Requirements

- [ ] Recording customer payment offers "Auto-allocate (Oldest First)" and "Manual Allocation" options.
- [ ] Manual allocation validates that sum of allocated amounts does not exceed total payment receipt.
- [ ] Allocations update invoice `balance_due` and transition status to `PARTIALLY_PAID` or `PAID`.
- [ ] Unallocated surplus appears as open customer credit.

## 7. Explicit Scope Boundaries

Applies to customer receipts and vendor payment allocation. Does not govern bank reconciliation file imports.

## 8. What is Not Yet Implemented or Verified

Payment allocation UI and backend FIFO engine require verification and testing.

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md), [FF-ISSUE-060](../issues/reporting/FF-ISSUE-060-ar-aging-report-styling-and-bucket-semantics.md)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
