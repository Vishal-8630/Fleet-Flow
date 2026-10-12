# IMP-002: Granular Role-Based Access Control (RBAC) Permission Matrix

**Improvement ID:** `IMP-002`  
**Title:** Granular Role-Based Access Control (RBAC) Permission Matrix & Custom Tenant Roles  
**Category:** Identity & Access Management / Security  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
Currently, user permissions in Fleet Flow rely on hardcoded static strings (`'admin'`, `'manager'`, `'operator'`, `'viewer'`) checked via `requireRole(['admin'])` in [`roleMiddleware.ts`](../../backend/src/middleware/authMiddleware.ts). Transport enterprises have specialized organizational roles (e.g. Branch Cashier who can create diesel slips but cannot view corporate profit margins, or Dispatcher who can book LRs but cannot issue tax invoices). The current system offers no fine-grained permission control.

---

## 2. Current Behavior & Limitations
- All `operator` members have broad write access across operations.
- Permissions cannot be toggled per branch or module.
- Tenant administrators cannot create custom roles tailored to their organization.

---

## 3. Business Value & Intended Outcome
- Enable enterprise transport companies to enforce least-privilege security.
- Prevent internal fraud by separating billing approvals from cash payouts.
- Increase willingness to pay for Standard and Pro subscription tiers.

---

## 4. Scope & Feature Design
1. **Granular Permission Atoms:**
   - `lr:create`, `lr:read`, `lr:update`, `lr:delete`, `lr:print`
   - `invoice:create`, `invoice:read`, `invoice:cancel`
   - `ledger:payout`, `ledger:view_balance`
   - `fleet:truck_manage`, `fleet:document_upload`
   - `telematics:live_track`
2. **Permission Check Middleware:**
   ```typescript
   export const requirePermission = (permission: string) => { ... };
   ```
3. **UI Matrix:** Add a visual permissions checkbox matrix under [`MembersPage.tsx`](../../frontend/src/pages/team/TeamMembersPage.tsx) allowing tenant admins to customize member permissions.

---

## 5. Acceptance Criteria
- [ ] Users assigned a role lacking `invoice:create` receive HTTP 403 when attempting to generate invoices.
- [ ] Tenant admins can customize permissions for standard roles.
- [ ] System admins retain full override capabilities.

---

## 6. Definition of Done
1. Middleware updated and permission matrix persisted in `Role.ts` and `CompanyMember.ts`.
2. Verified in integration tests.
