# FEAT-010: Real Vendor Portal End-to-End Implementation

**Feature ID:** `FEAT-010`  
**Title:** Real Vendor Portal End-to-End Implementation (Settlement Slips, Invoices, Payment History)  
**Category:** External Stakeholder Portals & Supplier Experience  
**Priority:** `P1` (High Commercial Requirement)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#4-features-register-feat-)  
**Directly Resolves Defect:** [`ISS-006`](../issues/ISS-006-stakeholder-portals-auth-breakdown.md)

---

## 1. Problem Statement & Target User
In transport operations, a substantial volume of freight is moved using attached trucks and third-party vehicle brokers (vendors). Currently, [`frontend/src/pages/portal/VendorPortalPage.tsx`](../../frontend/src/pages/portal/VendorPortalPage.tsx) is a static dummy screen with hardcoded mock arrays, and the backend explicitly rejects vendor OTP requests with HTTP 400. Market truck owners have zero visibility into trip settlements, diesel slip deductions, toll debits, or net payouts, creating endless telephone arguments and reconciliation disputes with fleet accounts.

---

## 2. Business Value & Intended Outcome
- Empower vehicle vendors with a self-service mobile-friendly portal.
- Real-time access to assigned trips, gate entry slips, diesel slips, and approved payment vouchers.
- Drastically cut administrative overhead and payment dispute calls.

---

## 3. Workflow & Architecture
1. **Vendor Login:** Vendor inputs registered mobile number. System generates SMS OTP via `portalController.ts`.
2. **Dashboard Overview:** Displays:
   - Total Trips Completed
   - Gross Freight Earned
   - Deductions (Advances, Diesel Slips, Penalties, TDS)
   - Net Outstanding Payable Balance
3. **Trip Settlement Slips:** Vendor views detailed settlement breakdown for every truck dispatched, including downloadable PDF settlement vouchers.
4. **Bank Details Update:** Vendor can submit bank account / UPI details for NEFT payouts.

---

## 4. Endpoints & API Contracts
- `POST /api/portal/otp/send` (with `portal_type: 'vendor'`): Sends SMS OTP.
- `POST /api/portal/otp/verify`: Issues vendor JWT.
- `GET /api/portal/vendor/dashboard`: Returns summary stats and balance.
- `GET /api/portal/vendor/trips`: Paginated list of vendor dispatches.
- `GET /api/portal/vendor/ledger`: Statement of accounts with running balance.

---

## 5. Acceptance Criteria
- [ ] Hardcoded mock data completely removed from `VendorPortalPage.tsx`.
- [ ] Vendors can securely log in via OTP and view their real dispatches.
- [ ] Vendor ledger displays real debits (payouts, fuel slips) and credits (freight bills).

---

## 6. Definition of Done
1. Backend vendor endpoints implemented.
2. `VendorPortalPage.tsx` refactored to consume live APIs with loading/error states.
