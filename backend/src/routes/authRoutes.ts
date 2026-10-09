/**
 * ============================================================================
 * FLEET FLOW — AUTHENTICATION ROUTER (authRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines the public and session REST endpoints for user authentication,
 * registration, session checks, and team invitations.
 * 
 * ROUTES EXPOSED:
 * ---------------
 * - POST /api/auth/register-company  → Public: Create company workspace + admin account.
 * - POST /api/auth/login             → Public: Verify credentials and issue HttpOnly JWT.
 * - POST /api/auth/logout            → Public: Clear HttpOnly session cookie.
 * - GET  /api/auth/me                → Authenticated: Retrieve current user, company, and role.
 * - POST /api/auth/invitations       → Admin Only: Send an invitation to a team member.
 * ============================================================================
 */

import { Router } from 'express';
import { registerCompany, login, logout, getMe, inviteMember } from '../controllers/authController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// ----------------------------------------------------------------------------
// Public Authentication Endpoints (Unprotected)
// ----------------------------------------------------------------------------
router.post('/register-company', registerCompany);
router.post('/login', login);
router.post('/logout', logout);

// ----------------------------------------------------------------------------
// Authenticated Session Endpoints
// ----------------------------------------------------------------------------
// Hydrates the frontend on app start with current user & company context
router.get('/me', requireAuth, resolveTenantContext, getMe);

// Creates team invitation (Restricted strictly to company administrators)
router.post('/invitations', requireAuth, resolveTenantContext, requireRole(['admin']), inviteMember);

export default router;
