/**
 * ============================================================================
 * FLEET FLOW — COMPANY & TEAM ROUTER (companyRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Declares the REST routing table for company settings and team member management.
 * 
 * SECURITY ARCHITECTURE:
 * ----------------------
 * 1. Public Routes:
 *    - `GET  /api/company/invitations/verify` (Token validation)
 *    - `POST /api/company/invitations/accept` (Account onboarding)
 * 2. Protected Routes:
 *    - All routes below line 24 automatically inherit `requireAuth` (JWT check)
 *      and `resolveTenantContext` (AsyncLocalStorage tenant isolation).
 * 3. Role-Based Access Control:
 *    - Settings mutations and member administration are guarded by `requireRole(['admin'])`.
 * ============================================================================
 */

import { Router } from 'express';
import {
  getCompanyProfile,
  updateCompanyProfile,
  listCompanyMembers,
  inviteCompanyMember,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
  verifyInvitationToken,
  acceptInvitation,
} from '../controllers/companyController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// ----------------------------------------------------------------------------
// Public Invitation Endpoints (Accessible before authentication)
// ----------------------------------------------------------------------------
router.get('/invitations/verify', verifyInvitationToken);
router.post('/invitations/accept', acceptInvitation);

// ----------------------------------------------------------------------------
// Tenant-Scoped Authenticated Endpoints
// Every downstream route requires valid login and resolves active company context
// ----------------------------------------------------------------------------
router.use(requireAuth);
router.use(resolveTenantContext);

// Company Profile & Operational Formatting
router.get('/profile', getCompanyProfile);
router.put('/profile', requireRole(['admin']), updateCompanyProfile);

// Team Members & Access Permissions
router.get('/members', listCompanyMembers);
router.post('/members/invite', requireRole(['admin']), inviteCompanyMember);
router.patch('/members/:id/role', requireRole(['admin']), updateMemberRole);
router.patch('/members/:id/status', requireRole(['admin']), updateMemberStatus);
router.delete('/members/:id', requireRole(['admin']), removeMember);

export default router;
