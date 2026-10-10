/**
 * ============================================================================
 * SUPPORT ROUTES (supportRoutes.ts)
 * ============================================================================
 * Customer support ticket submission and management.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createTicket, listTickets, getTicket, replyToTicket } from '../controllers/supportController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);

export default router;
