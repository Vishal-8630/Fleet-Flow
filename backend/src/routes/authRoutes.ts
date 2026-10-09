import { Router } from 'express';
import { registerCompany, login, logout, getMe, inviteMember } from '../controllers/authController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register-company', registerCompany);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated Endpoints
router.get('/me', requireAuth, resolveTenantContext, getMe);
router.post('/invitations', requireAuth, resolveTenantContext, requireRole(['admin']), inviteMember);

export default router;
