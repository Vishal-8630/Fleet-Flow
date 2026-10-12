import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { getLocalFilePath, generateTenantKey, uploadTenantFile } from '../../utils/storageService.js';

describe('ISS-016 & ISS-017: File Security & Local Storage Path Traversal Defense', () => {
  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Transporters' });
  });

  describe('1. ISS-016: Upload Magic Byte Validation & MIME Spoofing Defense', () => {
    it('accepts legitimate PDF uploads with valid binary signature', async () => {
      // Legitimate %PDF- signature
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', validPdfBuffer, { filename: 'certificate.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.key).toBeDefined();
      expect(res.body.key).toContain(`tenants/${tenantA.company._id.toString()}`);
    });

    it('rejects disguised shell scripts / HTML disguised with Content-Type: application/pdf (HTTP 415)', async () => {
      // Disguised script payload
      const maliciousScript = Buffer.from('#!/bin/bash\necho "Malicious Script Execution"');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', maliciousScript, { filename: 'exploit.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('rejects HTML/XSS payloads disguised as PNG images', async () => {
      const xssPayload = Buffer.from('<script>alert("XSS")</script>');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', xssPayload, { filename: 'receipt.png', contentType: 'image/png' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('accepts legitimate PNG image uploads with valid magic bytes', async () => {
      // Legitimate PNG magic bytes: \x89PNG\r\n\x1a\n
      const validPngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', validPngHeader, { filename: 'truck_photo.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.key).toBeDefined();
    });

    it('accepts legitimate JPEG image uploads with valid magic bytes', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', validJpeg, { filename: 'truck_photo.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.key).toBeDefined();
    });

    it('accepts legitimate WebP uploads with complete 12-byte header (RIFF + WEBP - M-03)', async () => {
      // RIFF (4) + file size (4) + WEBP (4) + VP8_ (4)
      const validWebp = Buffer.from([
        0x52, 0x49, 0x46, 0x46,
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
        0x56, 0x50, 0x38, 0x20,
      ]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', validWebp, { filename: 'truck_inspection.webp', contentType: 'image/webp' });

      expect(res.status).toBe(201);
      expect(res.body.key).toBeDefined();
    });

    it('rejects non-WebP RIFF file disguised as WebP (e.g. WAV audio header - M-03)', async () => {
      // RIFF (4) + size (4) + WAVE (4) -> NOT WEBP!
      const wavRiff = Buffer.from([
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45,
        0x66, 0x6d, 0x74, 0x20,
      ]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', wavRiff, { filename: 'fake_image.webp', contentType: 'image/webp' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('rejects truncated WebP file shorter than 12 bytes (M-03)', async () => {
      const truncatedWebp = Buffer.from([0x52, 0x49, 0x46, 0x46]); // only 4 bytes RIFF

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', truncatedWebp, { filename: 'truncated.webp', contentType: 'image/webp' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('rejects empty file buffer (0 bytes - M-03)', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', emptyBuffer, { filename: 'empty.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('rejects unsupported or unmapped MIME types (fail-closed - M-03)', async () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .attach('file', zipBuffer, { filename: 'payload.zip', contentType: 'application/zip' });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
    });
  });

  describe('2. ISS-017 & M-01: Local Storage Path Traversal Defense & Tenant Jailing', () => {
    it('getLocalFilePath rejects directory traversal sequences attempting boundary escape', () => {
      const companyId = tenantA.company._id.toString();
      const traversalKey = `tenants/${companyId}/../../../../etc/passwd`;

      expect(() => getLocalFilePath(companyId, traversalKey)).toThrow(/FORBIDDEN/i);
    });

    it('getLocalFilePath rejects Windows-style backslash traversal sequences', () => {
      const companyId = tenantA.company._id.toString();
      const traversalKey = `tenants/${companyId}\\..\\..\\..\\Windows\\win.ini`;

      expect(() => getLocalFilePath(companyId, traversalKey)).toThrow(/FORBIDDEN/i);
    });

    it('getLocalFilePath rejects null byte injection payloads', () => {
      const companyId = tenantA.company._id.toString();
      const nullByteKey = `tenants/${companyId}/document.pdf\0.png`;

      expect(() => getLocalFilePath(companyId, nullByteKey)).toThrow(/FORBIDDEN/i);
    });

    it('getLocalFilePath rejects keys targeting another tenant', () => {
      const companyAId = tenantA.company._id.toString();
      const companyBId = tenantB.company._id.toString();
      const targetBKey = `tenants/${companyBId}/trucks/2026_10/doc.pdf`;

      expect(() => getLocalFilePath(companyAId, targetBKey)).toThrow(/FORBIDDEN/i);
    });

    it('uploadTenantFile enforces storage inside company-specific folder (M-01)', async () => {
      const companyAId = tenantA.company._id.toString();
      const legitimateKey = `tenants/${companyAId}/general/test_doc.pdf`;
      const pdfBuffer = Buffer.from('%PDF-1.4 sample content');

      const result = await uploadTenantFile(companyAId, pdfBuffer, legitimateKey, 'application/pdf', 'test_doc.pdf');
      expect(result.key).toBe(legitimateKey);
      expect(result.sizeBytes).toBe(pdfBuffer.length);
    });

    it('uploadTenantFile rejects storage key belonging to a different tenant (M-01)', async () => {
      const companyAId = tenantA.company._id.toString();
      const companyBId = tenantB.company._id.toString();
      const targetBKey = `tenants/${companyBId}/general/cross_doc.pdf`;
      const pdfBuffer = Buffer.from('%PDF-1.4 cross test');

      await expect(
        uploadTenantFile(companyAId, pdfBuffer, targetBKey, 'application/pdf', 'cross_doc.pdf')
      ).rejects.toThrow(/FORBIDDEN.*authorized tenant/i);
    });

    it('uploadTenantFile rejects path traversal attempting cross-tenant escape (M-01)', async () => {
      const companyAId = tenantA.company._id.toString();
      const companyBId = tenantB.company._id.toString();
      const traversalKey = `tenants/${companyAId}/../${companyBId}/injected.pdf`;
      const pdfBuffer = Buffer.from('%PDF-1.4 traversal test');

      await expect(
        uploadTenantFile(companyAId, pdfBuffer, traversalKey, 'application/pdf', 'injected.pdf')
      ).rejects.toThrow(/FORBIDDEN/i);
    });

    it('uploadTenantFile rejects calls without companyId (M-01)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 no company');

      await expect(
        uploadTenantFile('', pdfBuffer, 'tenants/123/doc.pdf', 'application/pdf', 'doc.pdf')
      ).rejects.toThrow(/FORBIDDEN.*Company ID is required/i);
    });

    it('HTTP GET /api/documents/file rejects path traversal attempts with 403 Forbidden', async () => {
      const companyId = tenantA.company._id.toString();
      const traversalKey = `tenants/${companyId}/../../../../package.json`;

      const res = await request(app)
        .get(`/api/documents/file?key=${encodeURIComponent(traversalKey)}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(403);
    });

    it('HTTP GET /api/documents/presigned-url rejects cross-tenant key requests with 403 Forbidden', async () => {
      const companyBId = tenantB.company._id.toString();
      const keyB = `tenants/${companyBId}/trucks/2026_10/fitness.pdf`;

      const res = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(keyB)}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. DEC-003: Tenant Scoped Partitioning Verification', () => {
    it('generateTenantKey strictly partitions keys under tenants/{company_id}/', () => {
      const companyId = tenantA.company._id.toString();
      const key = generateTenantKey(companyId, 'trucks', 'rc_book.pdf');

      expect(key.startsWith(`tenants/${companyId}/trucks/`)).toBe(true);
      expect(key.endsWith('.pdf')).toBe(true);
    });

    it('generateTenantKey neutralizes dangerous file extensions to .bin', () => {
      const companyId = tenantA.company._id.toString();
      const dangerousKey = generateTenantKey(companyId, 'general', 'exploit.sh');

      expect(dangerousKey.endsWith('.bin')).toBe(true);
    });
  });
});
