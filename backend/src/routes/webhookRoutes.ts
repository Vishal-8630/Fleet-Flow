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

const router = Router();

// Meta WhatsApp Cloud API webhooks
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

export default router;
