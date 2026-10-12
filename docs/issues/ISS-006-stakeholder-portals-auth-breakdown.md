# ISS-006: Stakeholder Portals Authentication & Data Breakdown

**Specification ID:** `ISS-006`  
**Title:** Stakeholder Portals Authentication & Data Breakdown  
**Type:** Authentication / Portals Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Defect  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-11.md`](./ISSUE-11.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
The external customer and vendor portal workflows are non-functional:
1. In [`portalController.ts:47`](../../backend/src/controllers/portalController.ts#L47), customer OTP login queries `BillingParty.findOne({ company_id, contact_phone: phone })`. In [`BillingParty.ts`](../../backend/src/models/BillingParty.ts), the phone attribute is `phone`, not `contact_phone`. 100% of customer OTP requests fail with HTTP 404.
2. In `portalController.ts:60-63`, OTP requests for `portal_type === 'vendor'` are explicitly rejected with HTTP 400 (`Unsupported portal_type`).
3. In [`VendorPortalPage.tsx:43-66`](../../frontend/src/pages/portal/VendorPortalPage.tsx#L43-L66), the vendor portal view renders static in-memory mock arrays with zero backend API connectivity.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact 1 (Customer Schema Mismatch):**  
  `portalController.ts` expects `contact_phone`:
  ```typescript
  const party = await BillingParty.findOne({ company_id, contact_phone: phone });
  ```
  `BillingParty.ts` defines:
  ```typescript
  phone: { type: String, required: true }
  ```
  Because `contact_phone` does not exist on any `BillingParty` document, every customer login fails with `Customer not found with this mobile number`.
- **Confirmed Fact 2 (Vendor OTP Disabled):**  
  ```typescript
  if (portal_type === 'vendor') {
    return res.status(400).json({ success: false, message: 'Unsupported portal_type' });
  }
  ```
- **Confirmed Fact 3 (Frontend Mock Facade):**  
  `VendorPortalPage.tsx` defines:
  ```typescript
  const mockTrips = [ { id: 'TRP-101', vehicle: 'NL-01-AB-1234', ... } ];
  ```
  No network call is dispatched.

---

## 3. Reproduction Steps
1. Navigate to `/portal/customer`.
2. Enter valid company code and the registered customer's mobile number.
3. Click "Send OTP".
4. Observe error toast: "Customer not found with this mobile number" (HTTP 404).
5. Navigate to `/portal/vendor`. Observe static dummy data rendered regardless of authentication.

---

## 4. Expected Behavior
1. Customer OTP request must query `{ phone }` on `BillingParty`.
2. Vendor OTP request must support `portal_type: 'vendor'` by querying registered vendors in `Vendor.ts` by phone number.
3. Upon OTP verification, a portal-scoped JWT should be issued containing `{ portal_type, party_id, company_id }`.
4. `VendorPortalPage.tsx` must fetch real trips, settlement vouchers, and balances from `/api/portal/vendor/trips` and `/api/portal/vendor/ledger`.

---

## 5. Proposed Technical Solution
1. Update `portalController.ts`:
   ```typescript
   if (portal_type === 'customer') {
     party = await BillingParty.findOne({ company_id, phone });
   } else if (portal_type === 'vendor') {
     party = await Vendor.findOne({ company_id, phone });
   }
   if (!party) throw new ApiError(404, 'Party not found with this mobile number');
   ```
2. Implement backend endpoints:
   - `GET /api/portal/vendor/trips`
   - `GET /api/portal/vendor/settlements`
3. Refactor `VendorPortalPage.tsx` to consume the real endpoints via Axios API client.

---

## 6. Acceptance Criteria
- [ ] Customers can request and receive OTP using their registered `phone`.
- [ ] Vendors can request and receive OTP using their registered vendor mobile number.
- [ ] `VendorPortalPage.tsx` displays dynamic trip and payout records retrieved from the database.
- [ ] Hardcoded mock data arrays are removed from frontend portal views.

---

## 7. Definition of Done
1. `portalController.ts` fixed and vendor routes implemented.
2. `VendorPortalPage.tsx` connected to live API.
3. Verified via integration test in [`TEST-001`](../testing/TEST-001-automated-http-integration-suite.md) and full vendor portal spec in [`FEAT-010`](../features/FEAT-010-vendor-portal-end-to-end.md).
