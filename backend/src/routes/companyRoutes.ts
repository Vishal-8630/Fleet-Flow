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

// Public Invitation Endpoints
router.get('/invitations/verify', verifyInvitationToken);
router.post('/invitations/accept', acceptInvitation);

// Authenticated & Tenant Scoped Endpoints
router.use(requireAuth);
router.use(resolveTenantContext);

// Company Profile & Settings
router.get('/profile', getCompanyProfile);
router.put('/profile', requireRole(['admin']), updateCompanyProfile);

// Team Member Management
router.get('/members', listCompanyMembers);
router.post('/members/invite', requireRole(['admin']), inviteCompanyMember);
router.patch('/members/:id/role', requireRole(['admin']), updateMemberRole);
router.patch('/members/:id/status', requireRole(['admin']), updateMemberStatus);
router.delete('/members/:id', requireRole(['admin']), removeMember);

export default router;
