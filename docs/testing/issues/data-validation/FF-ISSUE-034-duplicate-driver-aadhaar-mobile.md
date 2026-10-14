# Multiple Commercial Driver Profiles Accept Duplicate Aadhaar and Mobile Numbers

## Metadata

- **ID:** FF-ISSUE-034
- **Category:** Validation / Compliance
- **Priority:** High
- **Status:** Observed
- **Affected module:** Master Registries (Commercial Drivers)
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.B, Driver duplicate identifier validation)
- **Related issues:** [FF-ISSUE-033](FF-ISSUE-033-duplicate-gstin-billing-parties.md)
- **Related decisions:** None
- **Implementation status:** Not implemented

## 1. Summary

The driver registration module permits creating multiple driver profiles with the exact same 12-digit Aadhaar number and the exact same 10-digit mobile number within the same company workspace.

## 2. Observed behavior

Multiple commercial driver profiles were registered using identical Aadhaar numbers and mobile contact numbers. The backend accepted both records without validation errors or conflict warnings.

## 3. Expected behavior

- **Aadhaar Number:** Must be strictly unique per driver within the tenant workspace. (Aadhaar is sensitive personal data: it must be validated, masked in UI, and protected).
- **Mobile Number:** Should be unique per active driver by default, with clear operational duplicate warnings if family/fleet sharing is permitted by policy.

## 4. Reproduction steps

1. Navigate to Master Registries > Drivers > Add Driver.
2. Create Driver A with Aadhaar `9999 8888 7777` and Mobile `9876543210`.
3. Create Driver B with the identical Aadhaar and Mobile.
4. Observe both drivers saved as active in the registry.

## 5. Impact and risk

Operational chaos and compliance liability. Two drivers sharing identity numbers prevents accurate driver verification, corrupts trip wage settlements, and causes mobile OTP delivery collisions in the Driver PWA.

## 6. Root-cause status

- **Status:** Confirmed
- **Analysis:** `Driver.ts` model schema has no unique compound indexes on `{ company_id: 1, aadhaar_number: 1 }` or `{ company_id: 1, phone: 1 }`.

## 7. Investigation required

- Inspect `backend/src/models/Driver.ts` and `driverController.ts`.
- Check Aadhaar masking rules (`XXXX-XXXX-1234`) to comply with Indian data privacy standards.

## 8. Proposed resolution or agreed design

1. Enforce normalized 12-digit format and Luhn-Verhoeff algorithm validation on Aadhaar numbers.
2. Add unique compound index on `{ company_id: 1, aadhaar_number: 1 }` (sparse).
3. Validate mobile number normalization and reject duplicate phone numbers on driver creation.

## 9. Acceptance criteria

- [ ] Attempting to save a driver with a duplicate Aadhaar number within the workspace is rejected with an inline error.
- [ ] Duplicate mobile numbers trigger a validation rejection or explicit manager confirmation.
- [ ] Aadhaar numbers are stored securely and masked in list views.

## 10. Required tests

- Integration test asserting 409 rejection on duplicate driver Aadhaar in the same tenant.
- Verification that different tenants can register drivers independently.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-033](FF-ISSUE-033-duplicate-gstin-billing-parties.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
