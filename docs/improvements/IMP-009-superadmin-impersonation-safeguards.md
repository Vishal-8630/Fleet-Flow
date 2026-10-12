# IMP-009: Platform Super-Admin Impersonation Banner, Session Safeguards & Exit Flow

**Improvement ID:** `IMP-009`  
**Title:** Platform Super-Admin Impersonation Banner, Session Safeguards and One-Click Exit Flow  
**Category:** Platform Governance, Security & User Experience  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`superAdminController.ts:388-446`](../../backend/src/controllers/superAdminController.ts#L388-L446), a platform super-administrator can initiate a support impersonation session into any customer's tenant workspace to troubleshoot billing or dispatch bugs. However, when the superadmin navigates the customer's workspace, the user interface does not display a persistent warning banner indicating that an active support session is running, and there is no visible floating "Exit Impersonation" action. The superadmin can easily confuse customer accounts with standard accounts or forget to exit, leaving the session open.

---

## 2. Business Value & Intended Outcome
- Comply with SOC 2 / ISO 27001 customer privacy and access transparency standards.
- Prevent accidental administrative modifications while diagnosing customer issues.
- Provide a persistent, unmistakable floating warning banner with a 1-click "Exit to Control Plane" button.

---

## 3. UI/UX & Technical Specifications
1. **Persistent Global Banner (`ImpersonationBanner.tsx`):**
   - Renders at the very top of `AppLayout.tsx` whenever `useAuthStore.getState().isImpersonation === true`.
   - Styled with high-contrast amber/yellow stripes:
     `⚠️ SUPPORT IMPERSONATION ACTIVE: You are viewing "${company.name}" as an auditor. Session expires in XX minutes.`
   - Contains a prominent red button: **"Exit Support Session"**.
2. **One-Click Exit Action:**
   - Clicking "Exit Support Session" calls `POST /api/super-admin/exit-impersonation`.
   - Backend restores the original superadmin JWT cookie.
   - Frontend navigates immediately back to `/super-admin`.
3. **Read-Only Safety Option:**
   - Add a checkbox on the impersonation modal: `[x] Read-Only Mode (Disable all POST/PUT/DELETE mutations during this support session)`.

---

## 4. Acceptance Criteria
- [ ] Active impersonation displays the persistent top banner across all pages.
- [ ] Clicking "Exit Support Session" terminates the impersonated session and restores superadmin access in under 1 second.
- [ ] Every mutation performed during impersonation is stamped with `impersonated_by: superadmin@fleetflow.io` in audit logs.

---

## 5. Definition of Done
1. `ImpersonationBanner.tsx` mounted in `AppLayout.tsx`.
2. Verified in end-to-end impersonation walkthrough.
