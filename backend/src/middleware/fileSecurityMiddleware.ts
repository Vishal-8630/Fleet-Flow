/**
 * ============================================================================
 * FILE SECURITY MIDDLEWARE (fileSecurityMiddleware.ts)
 * ============================================================================
 * Validates uploaded file binary signatures (magic bytes) to prevent MIME
 * spoofing attacks. Ensures that a renamed .exe or .html cannot masquerade
 * as a .pdf or .jpg file.
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { validateFileMagicBytes } from '../utils/cryptoService.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Middleware to validate that uploaded files match their declared MIME types.
 * Must be used after multer processes the file upload.
 * Compatible with both single and multiple file uploads (req.file / req.files).
 */
export function fileSecurityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const filesToCheck: Express.Multer.File[] = [];

  if (req.file) {
    filesToCheck.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToCheck.push(...req.files);
    } else {
      Object.values(req.files).forEach((fieldFiles) => {
        if (Array.isArray(fieldFiles)) {
          filesToCheck.push(...fieldFiles);
        }
      });
    }
  }

  if (filesToCheck.length === 0) {
    return next();
  }

  for (const file of filesToCheck) {
    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      res.status(413).json({
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
        code: 'FILE_TOO_LARGE',
      });
      return;
    }

    // Validate magic bytes
    const error = validateFileMagicBytes(file.buffer, file.mimetype);
    if (error) {
      res.status(415).json({
        error: `🛡️ Upload Rejected: ${error}`,
        code: 'INVALID_FILE_SIGNATURE',
      });
      return;
    }
  }

  next();
}
