/**
 * ============================================================================
 * FLEET FLOW — DOCUMENT VAULT CONTROLLER (documentController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Handles file uploads and presigned URL access for compliance documents across
 * fleet trucks, drivers, and business parties.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Strict In-Memory Streaming: Uses Multer with memory storage to validate file
 *   signatures before uploading to S3 or secure storage.
 * - MIME Type Whitelist: Accepts only statutory document formats (`pdf`, `jpeg`,
 *   `png`, `webp`) up to 10MB.
 * - Multi-Tenant Authorization: Presigned URLs and file downloads check that the
 *   authenticated tenant ID matches the file path prefix (`tenants/{company_id}/...`).
 * ============================================================================
 */

import { Request, Response } from 'express';
import multer from 'multer';
import {
  generateTenantKey,
  uploadTenantFile,
  getAuthorizedDownloadUrl,
  getLocalFilePath,
} from '../utils/storageService.js';

// Allowed document MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Configure Multer in-memory storage with size and MIME filters
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Megabytes max file size
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, JPEG, PNG, and WebP are allowed.'));
    }
  },
});

export const documentUploadMiddleware = upload.single('file');

/**
 * 1. uploadDocument
 * ----------------------------------------------------------------------------
 * Uploads a document to the tenant's partitioned storage bucket.
 * Expects multipart form-data with `file` and optional `entityType`.
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.tenant?.id;
    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const entityType = (req.body.entityType || 'general') as 'trucks' | 'drivers' | 'parties' | 'general';
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const buffer = req.file.buffer;

    const key = generateTenantKey(companyId, entityType, originalName);
    const result = await uploadTenantFile(buffer, key, mimeType, originalName);

    res.status(201).json({
      message: 'Document uploaded successfully.',
      key: result.key,
      url: result.url,
      originalName: result.originalName,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document.' });
  }
}

/**
 * 2. getPresignedUrl
 * ----------------------------------------------------------------------------
 * Generates an authorized download URL (15 minutes TTL) for an S3 storage key.
 * Enforces cross-tenant authorization checks.
 */
export async function getPresignedUrl(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.tenant?.id;
    const { key } = req.query;

    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'Storage key query parameter is required.' });
      return;
    }

    try {
      const url = await getAuthorizedDownloadUrl(companyId, key);
      res.json({ url, key });
    } catch (authError: any) {
      res.status(403).json({ error: authError.message });
    }
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate document download link.' });
  }
}

/**
 * 3. serveLocalFile (Fallback Handler)
 * ----------------------------------------------------------------------------
 * Serves files stored locally when AWS S3 is not active.
 * Enforces tenant ownership checks before streaming the file.
 */
export function serveLocalFile(req: Request, res: Response): void {
  try {
    const companyId = req.tenant?.id;
    const { key } = req.query;

    if (!companyId) {
      res.status(401).json({ error: 'Tenant context required.' });
      return;
    }

    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'Storage key query parameter is required.' });
      return;
    }

    const filePath = getLocalFilePath(companyId, key);
    res.sendFile(filePath);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      res.status(403).json({ error: 'Unauthorized to access this document.' });
      return;
    }
    res.status(404).json({ error: 'Document not found.' });
  }
}
