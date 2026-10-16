# Mid-Trip Driver Handover and Concurrent Assignment Safeguards Unclear

## Metadata

- **ID:** FF-ISSUE-030
- **Category:** Workflow
- **Priority:** High
- **Status:** Resolved
- **Affected module:** Fleet Management / Dispatch Operations
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md`
- **Legacy ID:** `FF-MT-036`
- **Related issues:** [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md), [FF-ISSUE-035](../trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md)
- **Related decisions:** DEC-008, OPN-003
- **Implementation status:** Implemented (Batch C — Commit `79d8a30`)

## 1. Summary

The "Swap Driver" action is exposed on vehicles marked "On Trip", but system lacks safeguards to prevent assigning drivers already on another active trip and lacks formal handover logging.

## 2. Observed behavior

Manual testing noted a Swap Driver button available for vehicles marked On Trip. There was no explicit validation preventing selection of a driver who is already on another active dispatch, nor was there a formal handover workflow capturing odometer, location, and reason.

## 3. Expected behavior

Mid-trip driver handover must enforce safeguards: direct reassignment of a driver engaged in another active trip must be rejected by backend. A dedicated handover record should capture handover timestamp, location, odometer reading, incoming/outgoing drivers, and handover reason.

## 4. Reproduction steps

1. Navigate to active vehicle marked "On Trip".
1. Click "Swap Driver" button.
1. Observe available driver list allows selecting drivers who may already be on active trips.
1. Observe swap occurs without capturing mandatory handover audit details (odometer, reason, location).

## 5. Impact and risk

Potential ghost-driver assignments, conflicting trip allocations, inaccurate wage/settlement calculations, and inability to determine driver custody during transit incidents.

## 6. Root-cause status

UI exposes direct driver assignment update endpoint without dedicated mid-trip handover domain service and backend validation.

## 7. Investigation required

- Inspect vehicle controller driver swap endpoint.
- Check if backend checks driver availability status (`driver.status === 'AVAILABLE'`) prior to swap.
- Check if a `DriverHandover` domain model or event exists.

## 8. Proposed resolution or agreed design

Implement a structured Driver Handover workflow with backend validation rejecting drivers with active trip status, logging odometer, reason, and timestamp in trip audit trail.

## 9. Acceptance criteria

- [x] Backend rejects driver swap if selected driver is currently on an active trip.
- [x] Driver swap on active trip requires reason, location, and odometer reading.
- [x] Both drivers' trip timelines and vehicle histories reflect exact handover timestamp.

## 10. Required tests

- Backend validation test: Driver swap fails with 409 Conflict if candidate driver is on another trip.
- Audit log test: Driver handover creates immutable audit event on trip.

## 11. Dependencies and related issues

- Related Issues: [FF-ISSUE-029](FF-ISSUE-029-driver-historical-vehicle-assignment-sync.md), [FF-ISSUE-035](../trip-lifecycle/FF-ISSUE-035-draft-trip-ineligible-operational-actions.md)
- Related Decisions: DEC-008

## 12. Verification evidence

- **Resolved in Commit:** `79d8a30` (Batch C)
- **Controller & Service Implementation:** `backend/src/controllers/journeyController.ts` (`swapDriver`), `backend/src/controllers/vehicleController.ts`
- **Integration Test Suite:** `backend/src/tests/integration/driverLifecycleAndSwap.test.ts` (Driver swap concurrency, availability validations, and audit trail).

