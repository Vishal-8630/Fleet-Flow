/**
 * ============================================================================
 * FLEET FLOW — GST FREIGHT INVOICING ROUTES (invoiceRoutes.ts)
 * ============================================================================
 */

import { Router } from 'express';
import {
  getInvoices,
  getInvoiceMetrics,
  getInvoiceById,
  createInvoice,
  recordInvoicePayment,
  cancelInvoice,
} from '../controllers/invoiceController.js';
import { requireAuth, resolveTenantContext, requireRole, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { requireStrictIdempotency, requireIdempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

// Protect all invoice routes with authentication, tenant context, subscription status, and module entitlement
router.use(requireAuth, resolveTenantContext, requireActiveSubscription, requireFeature('MOD_BILLING_INVOICE'));

router.get('/metrics', getInvoiceMetrics);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', requireRole(['admin', 'accountant']), createInvoice);
router.post('/:id/payments', requireRole(['admin', 'accountant']), requireStrictIdempotency, recordInvoicePayment);
router.put('/:id/cancel', requireRole(['admin', 'accountant']), requireStrictIdempotency, cancelInvoice);
router.post('/:id/cancel', requireRole(['admin', 'accountant']), requireStrictIdempotency, cancelInvoice);

export default router;
