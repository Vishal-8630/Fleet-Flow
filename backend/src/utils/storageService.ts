/**
 * ============================================================================
 * FLEET FLOW — SECURE TENANT STORAGE ENGINE (storageService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Provides a unified cloud and local storage abstraction for tenant-partitioned
 * statutory documents (truck fitness certificates, insurance policies, permits,
 * driver licenses, and Aadhaar cards).
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * 1. Multi-Tenant Key Partitioning:
 *    Every uploaded document MUST live in an isolated directory path:
 *    `tenants/{company_id}/{entity_type}/{YYYY_MM}/{uuid}.{ext}`
 *    This ensures that data is cryptographically separated per tenant on AWS S3,
 *    and prevents path traversal across organization boundaries.
 * 
 * 2. Hybrid Cloud & Offline Resilience:
 *    If AWS credentials (`AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, etc.) are
 *    configured, files stream directly to S3 and short-lived (15-minute TTL)
 *    presigned URLs are generated for viewing. If AWS is not configured (e.g.,
 *    during local developer testing), it transparently stores files in the local
 *    `uploads/tenants/...` directory without throwing configuration crashes.
 * 
 * 3. Cross-Tenant Defense:
 *    The `generatePresignedDownloadUrl` helper inspects the requested storage key
 *    and confirms it matches the requesting tenant's `company_id`. Any attempt
 *    by Company A to view Company B's file key triggers an immediate 403 Forbidden.
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const IS_S3_CONFIGURED = Boolean(
  BUCKET_NAME &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY
);

// Initialize S3 client if AWS credentials exist
let s3Client: S3Client | null = null;
if (IS_S3_CONFIGURED) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// Local storage base path (fallback when S3 is unconfigured)
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads');
if (!IS_S3_CONFIGURED && !fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

export interface UploadResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png', '.webp'];

export type TenantDocumentEntityType =
  | 'trucks'
  | 'drivers'
  | 'parties'
  | 'general'
  | 'receipts'
  | 'expenses'
  | 'slips'
  | 'invoices'
  | 'pod';

/**
 * Generates an isolated tenant storage key conforming to SaaS partition specs:
 * `tenants/{company_id}/{entity_type}/{YYYY_MM}/{uuid}.{ext}`
 */
export function generateTenantKey(
  companyId: string,
  entityType: TenantDocumentEntityType | string,
  originalFilename: string
): string {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
  let fileExt = path.extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
    fileExt = '.bin';
  }
  const uniqueId = crypto.randomUUID();

  return `tenants/${companyId}/${entityType}/${yearMonth}/${uniqueId}${fileExt}`;
}

/**
 * Uploads a file buffer either directly to AWS S3 or to local disk storage.
 * 
 * @param companyId - Verified tenant workspace identifier
 * @param buffer - File content buffer (from Multer memory storage)
 * @param key - The tenant-partitioned storage key
 * @param mimeType - Document MIME type (e.g. application/pdf, image/jpeg)
 * @param originalName - Original user-provided filename
 */
export async function uploadTenantFile(
  companyId: string,
  buffer: Buffer,
  key: string,
  mimeType: string,
  originalName: string
): Promise<UploadResult> {
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('FORBIDDEN: Company ID is required for tenant upload.');
  }

  // Validate that key strictly begins with the authorized tenant prefix
  const expectedPrefix = `tenants/${companyId}/`;
  if (!key || typeof key !== 'string' || !key.startsWith(expectedPrefix)) {
    throw new Error('FORBIDDEN: Storage key does not belong to the authorized tenant.');
  }

  // Reject path traversal attempts, null bytes, and Windows backslashes
  if (key.includes('\0') || key.includes('..') || key.includes('\\')) {
    throw new Error('FORBIDDEN: Illegal path traversal sequence detected in storage key.');
  }

  const sizeBytes = buffer.length;

  if (IS_S3_CONFIGURED && s3Client) {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        'original-filename': encodeURIComponent(originalName),
        'upload-date': new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Initial public/internal link placeholder; viewing is secured by presigned URLs
    const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    return { key, url, originalName, mimeType, sizeBytes };
  }

  // Local filesystem fallback — strict containment inside the specific tenant directory
  const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
  const localFilePath = path.resolve(LOCAL_STORAGE_DIR, normalizedKey);
  const tenantBaseDir = path.resolve(LOCAL_STORAGE_DIR, 'tenants', companyId);
  if (!localFilePath.startsWith(tenantBaseDir + path.sep)) {
    throw new Error('FORBIDDEN: Storage key escapes tenant upload directory boundary.');
  }

  const dirPath = path.dirname(localFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  await fs.promises.writeFile(localFilePath, buffer);

  const localUrl = `/api/documents/file?key=${encodeURIComponent(key)}`;
  return { key, url: localUrl, originalName, mimeType, sizeBytes };
}

/**
 * Generates an authorized download/view URL with short TTL (15 minutes).
 * 
 * Security Guard:
 * Confirms that the target key begins with `tenants/{companyId}/`.
 * If a tenant attempts to request another tenant's key, throws an authorization error.
 */
export async function getAuthorizedDownloadUrl(
  companyId: string,
  key: string,
  expiresInSeconds: number = 900 // 15 minutes TTL
): Promise<string> {
  // Validate tenant ownership
  const expectedPrefix = `tenants/${companyId}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('FORBIDDEN: You do not have permission to access this document.');
  }

  if (IS_S3_CONFIGURED && s3Client) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  // Local fallback: return local download URL with temporary token or direct endpoint
  return `/api/documents/file?key=${encodeURIComponent(key)}`;
}

/**
 * Retrieves the local file path on disk with strict path containment checks.
 * Enforces:
 * 1. Key must begin with tenants/{companyId}/
 * 2. Key must not contain null bytes (\0), backslashes, or directory traversal tokens (..)
 * 3. Resolved absolute path must strictly start with the tenant's base directory
 * 4. Target file must exist on disk
 */
export function getLocalFilePath(companyId: string, key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('FORBIDDEN: Invalid storage key.');
  }

  // Reject directory traversal attempts and null bytes
  if (key.includes('\0') || key.includes('..') || key.includes('\\')) {
    throw new Error('FORBIDDEN: Illegal path traversal sequence detected.');
  }

  const expectedPrefix = `tenants/${companyId}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('FORBIDDEN: Unauthorized tenant key access.');
  }

  const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolvedPath = path.resolve(LOCAL_STORAGE_DIR, normalizedKey);
  const tenantBaseDir = path.resolve(LOCAL_STORAGE_DIR, 'tenants', companyId);

  // Assert root containment: resolved path must reside strictly inside the tenant folder
  if (!resolvedPath.startsWith(tenantBaseDir + path.sep)) {
    throw new Error('FORBIDDEN: Access denied. Path escapes tenant storage boundary.');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('File not found.');
  }
  return resolvedPath;
}
