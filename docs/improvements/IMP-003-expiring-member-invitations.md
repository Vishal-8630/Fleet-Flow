# IMP-003: Expiring Member Invitation Flow & Acceptance State Machine

**Improvement ID:** `IMP-003`  
**Title:** Expiring Member Invitation Flow & Acceptance State Machine  
**Category:** User Onboarding & Tenant Administration  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`tenantController.ts`](../../backend/src/controllers/companyController.ts), inviting a new team member directly creates a `CompanyMember` record or logs a placeholder invite string to stdout without managing an invitation lifecycle. There is no invitation token, no expiration window (e.g. 48 hours), no accept/reject state machine, and no resend mechanism.

---

## 2. Business Value & Intended Outcome
- Streamlined team onboarding for growing fleet operations.
- Security against unauthorized team member additions and stale invitations.
- Clear visibility into Pending vs Active team members on [`MembersPage.tsx`](../../frontend/src/pages/team/TeamMembersPage.tsx).

---

## 3. Workflow & Technical Specification
1. **Model Addition:** Add `CompanyInvitation.ts`:
   - `company_id`, `email`, `role`, `branch_id`, `token_hash`, `expires_at`, `status: ['pending', 'accepted', 'expired', 'revoked']`.
2. **API Endpoints:**
   - `POST /api/tenants/invitations`: Admin sends invite (generates 48-hour secure token, dispatches email via SMTP).
   - `GET /api/tenants/invitations/verify?token=...`: Recipient opens invite link.
   - `POST /api/tenants/invitations/accept`: Recipient sets password and joins tenant.
   - `POST /api/tenants/invitations/:id/resend`: Admin resends email.
   - `DELETE /api/tenants/invitations/:id`: Admin revokes invite.

---

## 4. Acceptance Criteria
- [ ] Invitations expire after 48 hours and cannot be accepted post-expiry.
- [ ] Tenant admin can view, resend, and revoke pending invitations from the UI.
- [ ] Users accepting an invitation are automatically bound to the inviting company with their designated role.

---

## 5. Definition of Done
1. `CompanyInvitation` schema and endpoints implemented.
2. UI updated on `MembersPage.tsx` and invite acceptance page added to router.
