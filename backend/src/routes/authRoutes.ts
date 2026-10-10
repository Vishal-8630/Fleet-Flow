/**
 * ============================================================================
 * FLEET FLOW — AUTHENTICATION ROUTER (authRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines the public and session REST endpoints for user authentication,
 * registration, account recovery, session checks, and team invitations.
 * 
 * ROUTES EXPOSED:
 * ---------------
 * - POST /api/auth/register-company  → Public (Rate Limited): Create company workspace + admin account.
 * - POST /api/auth/login             → Public (Rate Limited): Verify credentials and issue HttpOnly JWT.
 * - POST /api/auth/logout            → Public: Clear HttpOnly session cookie.
 * - POST /api/auth/forgot-password   → Public (Rate Limited): Send 15-minute password reset link.
 * - POST /api/auth/reset-password    → Public (Rate Limited): Submit new password with reset token.
 * - POST /api/auth/change-password   → Authenticated: Update password and revoke other device sessions.
 * - GET  /api/auth/me                → Authenticated: Retrieve current user, company, and role.
 * - POST /api/auth/invitations       → Admin Only (Rate Limited): Send an invitation to a team member.
 * ============================================================================
 */

import { Router } from 'express';
import {
  registerCompany,
  login,
  logout,
  getMe,
  inviteMember,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/authController.js';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';
import {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  invitationLimiter,
} from '../middleware/securityMiddleware.js';

const router = Router();

// ----------------------------------------------------------------------------
// Public Authentication & Recovery Endpoints (Rate Limited)
// ----------------------------------------------------------------------------
router.post('/register-company', registerLimiter, registerCompany);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// ----------------------------------------------------------------------------
// Authenticated Session & Security Endpoints
// ----------------------------------------------------------------------------
// In-app password update (invalidates all other sessions via token_version)
router.post('/change-password', requireAuth, changePassword);

// Hydrates the frontend on app start with current user & company context
router.get('/me', requireAuth, resolveTenantContext, getMe);

// Creates team invitation (Restricted strictly to company administrators)
router.post(
  '/invitations',
  requireAuth,
  resolveTenantContext,
  requireRole(['admin']),
  invitationLimiter,
  inviteMember
);

export default router;
