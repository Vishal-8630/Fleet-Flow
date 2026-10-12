# ISS-017: Local Storage Service Lacks Path Normalization Check

**Specification ID:** `ISS-017`  
**Title:** Local Storage Service Lacks Path Normalization Check (Directory Traversal Risk)  
**Type:** Security / Storage Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Verified (Resolved in Batch 1; Prod S3 Policy Pending DEC-003 Approval)  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-10.md`](./ISSUE-10.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)  
**Requires Decision:** Yes ([`DEC-003`](../decisions/DEC-003-storage-architecture-s3-vs-local.md))

---

## 1. Executive Summary
In [`backend/src/utils/storageService.ts:45-60`](../../backend/src/utils/storageService.ts#L45-L60), when local disk storage is active, file path resolution is performed via `path.join(LOCAL_STORAGE_DIR, key)`. The function does not validate that the resulting resolved path starts with `LOCAL_STORAGE_DIR`. If a malicious actor passes a `key` containing directory traversal sequences (e.g. `../../../../etc/passwd` or `..\..\..\windows\win.ini`), the service may read or write files outside the designated uploads folder.

---

## 2. Current Behavior & Root Cause
- **Confirmed Code Pattern:** In `storageService.ts`:
  ```typescript
  const getLocalFilePath = (key: string): string => {
    return path.join(LOCAL_STORAGE_DIR, key);
  };
  ```
- **Vulnerability Analysis:** `path.join` resolves relative directory tokens (`../`). If `key` is `../../.env`, the resolved path points directly to the server's root environment secrets file.
- **Exposure:** Any endpoint that allows document download by key without strict path prefix assertions is vulnerable to Arbitrary File Read (AFR).

---

## 3. Reproduction Steps
1. Call file retrieval method with `key = '../../.env'`.
2. Inspect resolved file path: Points outside `LOCAL_STORAGE_DIR` to the application root directory.

---

## 4. Universal Security Requirements & Operational Architecture

### 4.1 Security Requirements Common to All Storage Providers
Regardless of whether local disk or cloud object storage is used:
1. **Path Normalization & Strict Jailing**: All keys must be sanitized using `path.normalize` and validated against directory escape attempts (`../`, `..\`, null bytes `%00`). For local disk, the resolved path must strictly start with the designated storage root directory. For object storage, keys must not contain relative path traversal segments.
2. **Unguessable UUID Storage Keys**: Client-provided filenames must never be used directly on the storage filesystem or as object keys. Files must be saved under cryptographically random UUIDs (`uuidv4()`), with extensions restricted to sanitized allowlisted formats (`.pdf`, `.png`, `.jpg`, `.jpeg`).
3. **Strict Multi-Tenant Scoping**: All storage keys must strictly follow the prefix convention: `tenants/${companyId}/${category}/${fileUuid}.${extension}`. Backend controllers must assert that the caller's tenant context matches the key prefix before issuing download streams or signed URLs.
4. **Private by Default**: Storage containers, buckets, and local directories must remain strictly private. Public read ACLs and direct unauthenticated web-root folder exposure are forbidden.
5. **Magic Byte Verification**: Pre-upload magic byte validation (`ISS-016`) is mandatory prior to writing to any storage backend.

### 4.2 Operational Distinctions: Local Dev vs Production
- **Local Development Storage**:
  - Uses a sandboxed local disk directory (`./uploads` or `LOCAL_STORAGE_DIR`) or a local MinIO S3-compatible Docker container.
  - Enables full offline development without requiring AWS credentials or cloud egress.
  - Implements filesystem root containment assertions to ensure local security during development.
- **Production Object Storage**:
  - Exclusively requires S3-compatible cloud object storage (AWS S3, Cloudflare R2, MinIO, or GCS).
  - Local application server disk storage is strictly disallowed in production due to container ephemerality (Docker/Kubernetes pod recycles destroying stored compliance records) and stateless horizontal autoscaling.
  - Mandates Server-Side Encryption at Rest (SSE-S3 / SSE-KMS) and TLS 1.3 in transit.
  - All access is served via short-lived, pre-signed URLs (maximum 15-minute expiration) with `response-content-disposition: attachment`.

---

## 5. Proposed Technical Solution
Update `storageService.ts` to enforce root containment and safe key resolution:
```typescript
import path from 'path';
import { ApiError } from './ApiError';

const LOCAL_STORAGE_DIR = path.resolve(process.env.LOCAL_STORAGE_DIR || './uploads');

export const getLocalFilePath = (key: string): string => {
  if (!key || typeof key !== 'string') {
    throw new ApiError(400, 'Invalid storage key');
  }

  // Reject null bytes and obvious traversal tokens
  if (key.includes('\0') || key.includes('..')) {
    throw new ApiError(403, 'Illegal path traversal sequence detected');
  }

  // Normalize path and assert root containment
  const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolvedPath = path.resolve(LOCAL_STORAGE_DIR, normalizedKey);

  if (!resolvedPath.startsWith(LOCAL_STORAGE_DIR + path.sep) && resolvedPath !== LOCAL_STORAGE_DIR) {
    throw new ApiError(403, 'Access denied: Path escapes storage boundary');
  }

  return resolvedPath;
};
```

---

## 6. Acceptance Criteria
- [x] Attempting to access or store files with keys containing `../`, `..\`, or null bytes throws HTTP 403 Forbidden.
- [x] Resolved file paths are mathematically proven to reside within `LOCAL_STORAGE_DIR`.
- [x] Storage keys strictly enforce the `tenants/{companyId}/` namespace pattern.
- [ ] In production (`NODE_ENV === 'production'`), local disk storage is blocked at startup; S3-compatible storage with pre-signed URLs is enforced (`DEC-003`). *(Pending DEC-003 stakeholder decision)*
- [x] Download streams assert caller tenant authorization before serving file contents.

---

## 7. Definition of Done & Verification Evidence
1. [x] Path containment check, tenant-specific company folder jailing (`uploadTenantFile`), and tenant key sanitization implemented in `storageService.ts`.
2. [x] Unit/integration tests verify traversal defense against Unix and Windows traversal payloads, cross-tenant file writes, and directory escape in `backend/src/tests/integration/fileStorageSecurity.test.ts` (22/22 tests passing).
3. [x] Aligned with [`DEC-003`](../decisions/DEC-003-storage-architecture-s3-vs-local.md) (pending stakeholder approval) and [`ISS-016`](./ISS-016-unmounted-file-security-middleware.md).
