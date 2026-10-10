/**
 * ============================================================================
 * PORTAL ROUTES (portalRoutes.ts)
 * ============================================================================
 * External stakeholder portal endpoints (customer/driver/vendor self-service).
 * OTP auth + scoped JWT access for external users without internal accounts.
 * ============================================================================
 */

import { Router } from 'express';
import { externalPortalAuth } from '../middleware/externalPortalAuth.js';
import {
  sendPortalOtp,
  verifyPortalOtp,
  getCustomerDashboard,
  getDriverCurrentTrip,
  submitEpod,
} from '../controllers/portalController.js';

const router = Router();

// Public OTP auth endpoints (no authentication required)
router.post('/send-otp', sendPortalOtp);
router.post('/verify-otp', verifyPortalOtp);

// Customer portal routes (requires portal JWT)
router.get('/customer/dashboard', externalPortalAuth, getCustomerDashboard);

// Driver portal routes (requires portal JWT)
router.get('/driver/trip', externalPortalAuth, getDriverCurrentTrip);
router.post('/driver/epod', externalPortalAuth, submitEpod);

export default router;
