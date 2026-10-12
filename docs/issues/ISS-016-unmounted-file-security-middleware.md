# ISS-016: Unmounted File Security Magic Byte Middleware on Uploads

**Specification ID:** `ISS-016`  
**Title:** Unmounted File Security Magic Byte Middleware on Uploads  
**Type:** Security / File Upload Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Security Risk  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-09.md`](./ISSUE-09.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
A dedicated file security utility ([`backend/src/middleware/fileSecurityMiddleware.ts`](../../backend/src/middleware/fileSecurityMiddleware.ts)) was implemented to inspect file binary buffers and validate magic byte headers against spoofed MIME extensions (e.g. validating `%PDF-` for PDFs, `\x89PNG` for PNGs). However, a codebase search confirms that `fileSecurityMiddleware` is **never imported or mounted** in [`documentRoutes.ts`](../../backend/src/routes/documentRoutes.ts) or any other file upload route. The upload pipeline relies solely on client-supplied `file.mimetype`, exposing the application to malicious script execution and stored Cross-Site Scripting (XSS).

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In [`documentRoutes.ts`](../../backend/src/routes/documentRoutes.ts):
  ```typescript
  router.post('/upload', upload.single('file'), uploadDocument);
  ```
- **Confirmed Fact:** `grep` for `validateFileMagicBytes` or `fileSecurityMiddleware` across `backend/src/routes/` returns 0 matches.
- **Security Vulnerability:** An attacker can upload an HTML file containing malicious `<script>` tags or an executable `.js`/`.sh` payload with the filename `receipt.pdf` and header `Content-Type: application/pdf`. Multer accepts the upload without verifying binary file headers. If the file is stored locally or served directly, users downloading or opening documents in the browser can execute arbitrary code.

---

## 3. Reproduction Steps
1. Create a text file containing `<script>alert(document.cookie)</script>`.
2. Name the file `exploit.pdf` and upload it via `POST /api/documents/upload`.
3. Observe: The upload succeeds with HTTP 201 Created. The server accepts and stores the malicious payload as a legitimate PDF.

---

## 4. Expected Behavior
All file upload endpoints must mount `validateFileMagicBytes` immediately after Multer buffer extraction. If the binary file header does not match known signatures for PDF, PNG, JPEG, or WEBP, the request must be aborted immediately with HTTP 400 Bad Request (`Invalid or spoofed file type detected`).

---

## 5. Proposed Technical Solution
Mount the middleware in `documentRoutes.ts`:
```typescript
import { validateFileMagicBytes } from '../middleware/fileSecurityMiddleware';

router.post(
  '/upload',
  authenticate,
  resolveTenantContext,
  upload.single('file'),
  validateFileMagicBytes,
  uploadDocument
);
```
Ensure `validateFileMagicBytes` handles memory storage buffers and temporary disk paths.

---

## 6. Acceptance Criteria
- [ ] Uploading genuine PDFs and images succeeds.
- [ ] Uploading executable scripts masked with `.pdf` or `.png` extensions is rejected with HTTP 400.
- [ ] Empty or truncated file buffers are rejected.

---

## 7. Definition of Done
1. `fileSecurityMiddleware` mounted in all upload routes.
2. Verified via automated security test.
