/**
 * ============================================================================
 * TRACKING ROUTES (trackingRoutes.ts)
 * ============================================================================
 * GPS telemetry ingestion and public consignment tracking endpoints.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext } from '../middleware/authMiddleware.js';
import { publicTrackingLimiter } from '../middleware/securityMiddleware.js';
import {
  ingestGpsPing,
  getLiveTruckLocation,
  getFleetLiveMap,
  reportTripIncident,
  publicTrackConsignment,
} from '../controllers/trackingController.js';

const router = Router();

// Public tracking — no auth required, rate-limited against scraping (ISS-005, ISS-020)
router.get('/', publicTrackingLimiter, publicTrackConsignment);
router.get('/:lrNumber', publicTrackingLimiter, publicTrackConsignment);

// Authenticated telematics routes
router.post('/ping', requireAuth, resolveTenantContext, ingestGpsPing);
router.get('/live/fleet', requireAuth, resolveTenantContext, getFleetLiveMap);
router.get('/live/:truckId', requireAuth, resolveTenantContext, getLiveTruckLocation);
router.post('/incident', requireAuth, resolveTenantContext, reportTripIncident);

export default router;
