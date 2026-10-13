/**
 * ============================================================================
 * PORTAL ROUTES (portalRoutes.ts)
 * ============================================================================
 * External stakeholder portal endpoints (customer/driver/vendor self-service).
 * OTP auth + scoped JWT access for external users without internal accounts.
 * Protected with rate limiting against SMS toll fraud and brute-force (ISS-020).
 * ============================================================================
 */

import { Router } from 'express';
import { externalPortalAuth } from '../middleware/externalPortalAuth.js';
import {
  portalOtpSendLimiter,
  portalOtpVerifyLimiter,
} from '../middleware/securityMiddleware.js';
import {
  sendPortalOtp,
  verifyPortalOtp,
  getCustomerDashboard,
  getDriverCurrentTrip,
  getVendorDashboard,
  submitEpod,
} from '../controllers/portalController.js';

const router = Router();

// Public OTP auth endpoints (rate-limited against SMS flooding & brute-force)
router.post('/send-otp', portalOtpSendLimiter, sendPortalOtp);
router.post('/verify-otp', portalOtpVerifyLimiter, verifyPortalOtp);

// Customer portal routes (requires customer-scoped portal JWT)
router.get('/customer/dashboard', externalPortalAuth, getCustomerDashboard);

// Driver portal routes (requires driver-scoped portal JWT)
router.get('/driver/trip', externalPortalAuth, getDriverCurrentTrip);
router.post('/driver/epod', externalPortalAuth, submitEpod);

// Vendor portal routes (requires vendor-scoped portal JWT - ISS-006)
router.get('/vendor/dashboard', externalPortalAuth, getVendorDashboard);

export default router;
