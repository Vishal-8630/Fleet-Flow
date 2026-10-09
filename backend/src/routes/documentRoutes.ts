/**
 * ============================================================================
 * FLEET FLOW — DOCUMENT VAULT ROUTER (documentRoutes.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Defines API routes for uploading statutory compliance files, retrieving
 * authorized presigned URLs, and streaming local fallback documents.
 * All routes require authenticated tenant context.
 * ============================================================================
 */

import { Router } from 'express';
import {
  uploadDocument,
  documentUploadMiddleware,
  getPresignedUrl,
  serveLocalFile,
} from '../controllers/documentController.js';
import { requireAuth, resolveTenantContext } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all document routes with authentication and tenant isolation
router.use(requireAuth, resolveTenantContext);

// Upload statutory compliance document
router.post('/upload', documentUploadMiddleware, uploadDocument);

// Get presigned URL for secure document view
router.get('/presigned-url', getPresignedUrl);

// Local file stream endpoint (used when AWS S3 credentials are not configured)
router.get('/file', serveLocalFile);

export default router;
