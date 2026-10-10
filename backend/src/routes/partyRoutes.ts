/**
 * ============================================================================
 * FLEET FLOW — COMMERCIAL PARTIES ROUTER (partyRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines Express REST endpoints for Customer Billing Parties and Supplier/Broker
 * Balance Parties. Protected by tenant authorization and RBAC.
 * ============================================================================
 */

import { Router } from 'express';
import {
  listBillingParties,
  getBillingPartyById,
  createBillingParty,
  updateBillingParty,
  deleteBillingParty,
  listBalanceParties,
  getBalancePartyById,
  createBalanceParty,
  updateBalanceParty,
  deleteBalanceParty,
} from '../controllers/partyController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';

const router = Router();

// Protect all party routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_PARTIES'));

// ----------------------------------------------------------------------------
// Billing Parties (Shippers / Consignors / Invoiced Customers)
// ----------------------------------------------------------------------------
router.get('/billing', listBillingParties);
router.get('/billing/:id', getBillingPartyById);
router.post('/billing', requireRole(['admin', 'dispatcher', 'accountant']), createBillingParty);
router.put('/billing/:id', requireRole(['admin', 'dispatcher', 'accountant']), updateBillingParty);
router.delete('/billing/:id', requireRole(['admin']), deleteBillingParty);

// ----------------------------------------------------------------------------
// Balance Parties (Suppliers / Brokers / Market Owners / Fuel Pumps)
// ----------------------------------------------------------------------------
router.get('/balance', listBalanceParties);
router.get('/balance/:id', getBalancePartyById);
router.post('/balance', requireRole(['admin', 'dispatcher', 'accountant']), createBalanceParty);
router.put('/balance/:id', requireRole(['admin', 'dispatcher', 'accountant']), updateBalanceParty);
router.delete('/balance/:id', requireRole(['admin']), deleteBalanceParty);

export default router;
