/**
 * ============================================================================
 * FLEET FLOW — BILLING & SUBSCRIPTION ROUTES (billingRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Declares REST endpoints for plans, checkout, subscription management,
 * and Razorpay webhook events.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, resolveTenantContext, requireRole } from '../middleware/authMiddleware.js';
import {
  getBillingPlans,
  getCompanySubscription,
  calculatePlanChangePreview,
  initializeCheckout,
  verifyPayment,
  changePlan,
  applyScheduledChange,
  cancelScheduledChange,
  toggleAddon,
  handleBillingWebhook,
  getBillingHistory,
  getBillingInvoiceReceipt,
} from '../controllers/billingController.js';

const router = Router();

// Public Webhook receiver for Razorpay payment callbacks
router.post('/webhooks/billing', handleBillingWebhook);

// Plans catalog (accessible to authenticated users or public onboarding)
router.get('/plans', getBillingPlans);

// Protected tenant subscription routes
router.use(requireAuth);
router.use(resolveTenantContext);

router.get('/subscription', getCompanySubscription);
router.get('/history', getBillingHistory);
router.get('/invoices/:id/receipt', getBillingInvoiceReceipt);
router.post('/calculate-change', calculatePlanChangePreview);
router.post('/checkout', initializeCheckout);
router.post('/verify-payment', requireRole(['admin']), verifyPayment);
router.post('/change-plan', requireRole(['admin']), changePlan);
router.post('/apply-scheduled', requireRole(['admin']), applyScheduledChange);
router.post('/cancel-scheduled', requireRole(['admin']), cancelScheduledChange);
router.post('/toggle-addon', requireRole(['admin']), toggleAddon);

export default router;
