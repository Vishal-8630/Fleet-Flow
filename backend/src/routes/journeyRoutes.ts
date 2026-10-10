/**
 * ============================================================================
 * FLEET FLOW — TRUCK JOURNEY & TRIP ROUTER (journeyRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS ROUTER?
 * --------------------
 * Defines Express REST endpoints for managing fleet dispatch journeys, daily
 * milestones, delay logging, fuel stops, and POD delivery completion.
 * Protected by multi-tenant authentication and role-based permissions.
 * ============================================================================
 */

import { Router } from 'express';
import {
  getJourneys,
  getJourneyMetrics,
  getJourneyById,
  createJourney,
  dispatchJourney,
  addMilestone,
  recordDelay,
  addDieselStop,
  addDriverExpense,
  completeDeliveryAndPOD,
  cancelJourney,
} from '../controllers/journeyController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';

const router = Router();

// Protect all journey endpoints with tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_TRIPS'));

// Read listings and operational metrics
router.get('/', getJourneys);
router.get('/metrics', getJourneyMetrics);
router.get('/:id', getJourneyById);

// Journey creation & dispatch operations (admin, dispatcher)
router.post('/', requireRole(['admin', 'dispatcher']), createJourney);
router.put('/:id/dispatch', requireRole(['admin', 'dispatcher']), dispatchJourney);

// Milestone & issue logging (admin, dispatcher)
router.post('/:id/milestones', requireRole(['admin', 'dispatcher']), addMilestone);
router.post('/:id/delays', requireRole(['admin', 'dispatcher']), recordDelay);

// En-route expenses (admin, dispatcher, accountant)
router.post('/:id/diesel', requireRole(['admin', 'dispatcher', 'accountant']), addDieselStop);
router.post('/:id/expenses', requireRole(['admin', 'dispatcher', 'accountant']), addDriverExpense);

// Proof of Delivery & Closeout
router.post('/:id/pod', requireRole(['admin', 'dispatcher']), completeDeliveryAndPOD);

// Cancellation
router.put('/:id/cancel', requireRole(['admin', 'dispatcher']), cancelJourney);

export default router;
