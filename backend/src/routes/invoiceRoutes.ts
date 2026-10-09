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
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all invoice routes with authentication and tenant context
router.use(requireAuth, resolveTenantContext);

router.get('/metrics', getInvoiceMetrics);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', requireRole(['admin', 'accountant']), createInvoice);
router.post('/:id/payments', requireRole(['admin', 'accountant']), recordInvoicePayment);
router.put('/:id/cancel', requireRole(['admin', 'accountant']), cancelInvoice);

export default router;
