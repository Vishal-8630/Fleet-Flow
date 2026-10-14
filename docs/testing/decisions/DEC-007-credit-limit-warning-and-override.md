# DEC-007 — Customer Credit Limit Exceeded Warning and Authorized Override

## Metadata

- **Decision ID:** DEC-007
- **Title:** Customer Credit Limit Exceeded Warning and Authorized Override
- **Status:** Proposed — Pending Review
- **Date:** October 2026
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)

---

## 1. Context and Problem Statement

Operating trips and generating consignment Lorry Receipts (LRs) for customers who have exceeded their credit terms risks bad debt. However, a rigid, unconditional hard stop can paralyze urgent freight dispatches during mission-critical or emergency carrier operations.

---

## 2. Decision Statement & Proposed Policy

> [!IMPORTANT]
> **Current Status: PROPOSED — PENDING REVIEW**  
> **Proposed Policy:** Soft warning with authorized Admin override.  
> - Warn users with a prominent advisory modal when a customer's credit limit is exceeded.  
> - Permit an override **only by an appropriately authorized Company Admin**.  
> - Record the override and its mandatory justification reason in the immutable audit trail, consistent with the approved security and governance architecture.  
> - **DO NOT IMPLEMENT THIS POLICY YET.** This policy represents the product owner's proposed position and is awaiting formal architectural review and implementation authorization.

### Proposed Workflow Details
When a new trip dispatch or freight booking causes a customer's total exposure (open unpaid invoices + dispatched unbilled freight) to exceed their configured `credit_limit`:
1. **Prominent Visual Warning:** The system displays a detailed Warning Modal displaying:
   - Current outstanding balance (issued invoices).
   - Planned freight contract amount.
   - Configured credit limit.
   - Net overage amount.
2. **Standard Dispatcher Restriction:** Dispatch is blocked for standard `dispatcher` and operational staff without override privileges.
3. **Authorized Admin Override:** An authorized **Company Admin** can execute an override by entering a mandatory business justification reason.
4. **Audit Logging:** The override event, Admin user identity, timestamp, overage value, and justification reason are permanently logged to the tenant audit trail.

---

## 3. Alternatives Considered and Trade-Offs

1. **Unconditional Hard Block (No Override):** Rejected as commercially impractical; prevents carriers from handling emergency shipments for long-standing enterprise clients.
2. **Unconstrained Credit (No Warnings):** Rejected due to unacceptable financial exposure and bad debt risk.
3. **Soft Warning with Authorized Admin Override (Proposed Policy):** Selected because it provides operational agility while preserving governance, segregation of duties, and accountability.

---

## 4. Consequences

- Customer profile records must configure `credit_limit` and track current exposure.
- Trip dispatch and LR issuance endpoints must evaluate exposure against the credit limit.
- Audit logging infrastructure must record override justifications.

---

## 5. Implementation Implications (When Authorized)

- Add credit exposure evaluation helper:
  $$\text{Current Exposure} = \sum(\text{Open Invoices}) + \sum(\text{Dispatched Unbilled Trips})$$
- Integrate authorization check in dispatch controller (`journeyController.ts`) and LR controller (`entryController.ts`).
- Modal UI component displaying exposure details and override justification input.

---

## 6. Acceptance Criteria and Verification Requirements

- [ ] Decision status is documented as **PROPOSED — PENDING REVIEW**.
- [ ] Attempting dispatch for a customer exceeding their credit limit displays an advisory warning modal.
- [ ] Standard dispatchers cannot bypass the warning without an authorized Admin credential/action.
- [ ] Company Admin override requires a mandatory justification string and generates an immutable audit log record.
- [ ] No application code changes are made until explicit implementation authorization is granted.

---

## 7. Explicit Scope Boundaries

Governs trip dispatch, consignment LR creation, and order confirmation against customer credit limits. Does not alter invoice generation or payment collection workflows.

---

## 8. What is Not Yet Implemented or Verified

This policy is **NOT YET IMPLEMENTED**. Currently, `credit_limit` is stored on `BillingParty` but is completely unenforced during dispatch and invoicing ([FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)).

---

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-041](../issues/trip-lifecycle/FF-ISSUE-041-customer-billing-party-field-linkage-unclear.md), [FF-ISSUE-045](../issues/financial-accounting/FF-ISSUE-045-credit-limit-balance-semantics.md)
- Audit Question: [OPN-007](../audit/AUDIT_OPEN_QUESTIONS.md#opn-007-credit-limit-warning-vs-hard-stop-enforcement-policy-dec-007-ff-issue-045)
- Implementation Batch: [Batch B](../audit/IMPLEMENTATION_BATCH_PLAN.md#batch-b-financial-invariants--accounting-balance-integrity)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
