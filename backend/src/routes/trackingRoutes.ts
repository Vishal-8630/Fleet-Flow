/**
 * ============================================================================
 * TRACKING ROUTES (trackingRoutes.ts)
 * ============================================================================
 * GPS telemetry ingestion and public consignment tracking endpoints.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  ingestGpsPing,
  getLiveTruckLocation,
  getFleetLiveMap,
  reportTripIncident,
  publicTrackConsignment,
} from '../controllers/trackingController.js';

const router = Router();

// Public tracking — no auth required
router.get('/:lrNumber', publicTrackConsignment);

// Authenticated telematics routes
router.post('/ping', requireAuth, ingestGpsPing);
router.get('/live/fleet', requireAuth, getFleetLiveMap);
router.get('/live/:truckId', requireAuth, getLiveTruckLocation);
router.post('/incident', requireAuth, reportTripIncident);

export default router;
