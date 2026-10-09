/**
 * ============================================================================
 * FLEET FLOW — PUBLIC TRACKING ROUTES (trackingRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Declares public REST routes for public shipment & consignment milestone tracking.
 * Rate-limited to prevent brute-force enumeration and denial-of-service scraping.
 * ============================================================================
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { trackConsignmentPublic } from '../controllers/trackingController.js';

const router = Router();

// Strict IP-based rate limiter: Maximum 30 lookups per 10 minutes per IP
const trackingRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  message: {
    error: 'Too many tracking requests from this IP. Please wait 10 minutes before checking again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/public/track/:lrNumber
router.get('/:lrNumber', trackingRateLimiter, trackConsignmentPublic);

export default router;
