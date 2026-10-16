# DEC-008 — Completed Trip Operational Locks and Reason-Audited Late Corrections

## Metadata

- **Decision ID:** DEC-008
- **Title:** Completed Trip Operational Locks and Reason-Audited Late Corrections
- **Status:** Implemented (Batch C — Commit 79d8a30)
- **Date:** October 2026
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Related Issues:** [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-037](../issues/trip-lifecycle/FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-038](../issues/trip-lifecycle/FF-ISSUE-038-fuel-stops-milestones-edit-missing.md), [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)

---

## 1. Context and Problem Statement

Completed trips with verified Proof of Delivery (POD) and finalized driver payroll settlements are currently exposed to unauthorized modifications in the UI and API. Unrestricted edits corrupt historical freight billing, double-entry general ledgers, and tax compliance records.

---

## 2. Decision Statement & Implemented Policy

> [!NOTE]
> **Current Status: IMPLEMENTED (Batch C — Commit 79d8a30)**  
> **Implemented Policy:** Company Admin approval is required for every post-completion trip correction, regardless of amount.  
> - **Routine Operational Actions Locked:** Routine operational actions (Add Check-In, Add Fuel Stop, Record Driver Expense, Swap Driver) remain restricted and read-only once a trip achieves `completed` status.  
> - **Company Admin Approval Required:** Every post-completion modification, late entry, or financial correction requires explicit **Company Admin** approval, regardless of transaction amount.  
> - **No Threshold or Role Exceptions:** Do **NOT** introduce an Accountant exception or an amount-based threshold (e.g., no autonomous approvals under ₹2,000 or ₹5,000).  
> - **Mandatory Reason & Immutable Audit Trail:** Every late correction must capture a mandatory justification reason, user ID, timestamp, before/after values, and an auditable record.

### Proposed Workflow Rules
1. **Routine Action Immutability:** When a trip achieves `completed` status (or verified delivery closeout), all routine operational buttons become disabled/read-only on the frontend, and backend endpoints reject routine PUT/POST operational requests with HTTP 409 Conflict.
2. **Authorized Late Correction Workflow:**
   - Any late fuel slip, toll receipt, en-route expense, or odometer correction must be submitted as a **Late Trip Adjustment Request**.
   - Requires explicit approval by a user holding the **Company Admin** role.
   - Requires a mandatory textual justification reason.
   - Produces an immutable audit trail entry capturing user identity, timestamp, field altered, previous value, new value, and justification.
   - If the trip has already been invoiced or included in a finalized driver settlement, adjusting journal entries must be generated rather than directly mutating closed ledger entries.

---

## 3. Alternatives Considered and Trade-Offs

1. **Complete Lock Without Adjustment Capability:** Rejected because real-world freight slips (highway tolls, delayed fuel receipts) frequently arrive days after a vehicle returns to depot.
2. **Accountant Autonomous Approval Below Threshold:** Evaluated in audit planning (e.g., permitting accountants to approve small adjustments under ₹5,000). **REJECTED BY PRODUCT OWNER.** All adjustments, regardless of amount, modify closed operational records and must require Company Admin approval to prevent payroll leakages.
3. **Company Admin Approval for All Adjustments (Proposed Policy):** Selected because it enforces strict governance, ensures management oversight over completed contracts, and maintains accounting integrity.

---

## 4. Consequences

- Routine mutation endpoints (`addMilestone`, `addDieselStop`, `addDriverExpense`) must assert `journey.status !== 'completed'`.
- A dedicated late adjustment endpoint (`POST /api/operations/journeys/:id/adjustments`) and approval mechanism must be developed.
- Audit logging must record complete diffs with reason codes.

---

## 5. Implementation Implications (When Authorized)

- Add state machine precondition check in `journeyController.ts`.
- Build Late Adjustment Request schema and UI modal requiring Company Admin credentials and justification text.
- Integrate with `ApprovalRequest` workflow or dedicated adjustment audit trail.

---

## 6. Acceptance Criteria and Verification Requirements

- [x] Decision status is documented as **IMPLEMENTED (Batch C)**.
- [x] Trip detail page displays completed trips as read-only for routine operational actions.
- [x] Backend rejects routine operational mutations on completed trips with HTTP 409 Conflict.
- [x] Post-completion corrections require Company Admin approval, regardless of amount.
- [x] No Accountant autonomous threshold is permitted.
- [x] All adjustments require a mandatory reason and are logged to the audit trail.
- [x] Verified via automated integration tests in `journeyCorrections.test.ts` and `completedTripAdjustments.test.ts`.

---

## 7. Explicit Scope Boundaries

Applies to completed trips and verified commercial dispatches. Does not restrict active trips in transit or draft journeys prior to departure.

---

## 8. Implementation and Verification Status

This policy is **IMPLEMENTED** in Batch C (Commit `79d8a30`). Routine operations on completed journeys are rejected at backend level, and authorized adjustments require reason justification and audit logging in `backend/src/controllers/journeyController.ts`. Validated via integration tests `backend/src/tests/integration/journeyCorrections.test.ts` and `backend/src/tests/integration/completedTripAdjustments.test.ts`.

---

## 9. Related Issues and Artifacts

- Related Issues: [FF-ISSUE-035](../issues/trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md), [FF-ISSUE-037](../issues/trip-lifecycle/FF-ISSUE-037-completed-trip-operational-actions-editable.md), [FF-ISSUE-038](../issues/trip-lifecycle/FF-ISSUE-038-fuel-stops-milestones-edit-missing.md), [FF-ISSUE-039](../issues/trip-lifecycle/FF-ISSUE-039-cash-expenses-edit-voucher-missing.md)
- Audit Question: [OPN-008](../audit/AUDIT_OPEN_QUESTIONS.md#opn-008-authorization-threshold-for-completed-trip-corrections-dec-008-qst-013)
- Implementation Batch: [Batch C](../audit/IMPLEMENTATION_BATCH_PLAN.md#batch-c-core-fleet-assignments-driver-handover--trip-state-machine-locks)
- Source Document: `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
