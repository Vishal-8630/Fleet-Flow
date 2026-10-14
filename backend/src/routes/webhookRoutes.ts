/**
 * ============================================================================
 * FLEET FLOW — WEBHOOK ROUTES (webhookRoutes.ts)
 * ============================================================================
 * Unauthenticated endpoints dedicated to receiving asynchronous webhook
 * callbacks from payment gateways and communication platforms (Meta WhatsApp).
 * ============================================================================
 */

import { Router } from 'express';
import { verifyWhatsAppWebhook, handleWhatsAppWebhook } from '../controllers/webhookController.js';
import { handleBillingWebhook } from '../controllers/billingController.js';

const router = Router();

// Razorpay billing webhooks
router.post('/billing', handleBillingWebhook);

// Meta WhatsApp Cloud API webhooks
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

export default router;
