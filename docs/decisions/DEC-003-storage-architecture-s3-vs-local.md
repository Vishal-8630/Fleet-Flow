# DEC-003: File Storage Architecture: Cloud S3 Object Storage vs Secured Local Disk

**Decision ID:** `DEC-003`  
**Title:** File Storage Architecture: Cloud S3 Object Storage vs Secured Local Disk  
**Category:** Infrastructure Security & Storage Strategy  
**Status:** Pending Infrastructure & Security Approval  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#7-product--architectural-decisions-register-dec-)  
**Directly Resolves Issue:** [`ISS-017`](../issues/ISS-017-local-storage-path-traversal.md)

---

## 1. Context & Security Risk
In [`backend/src/utils/storageService.ts`](../../backend/src/utils/storageService.ts), Fleet Flow supports both local disk storage and cloud storage (AWS S3 / Cloudinary). Storing customer-uploaded documents (driving licenses, RC certificates, GST bills, signed POD photos) on local application server disks in production presents serious vulnerabilities:
1. **Directory Traversal Risk:** Local file path resolution risks path traversal attacks if keys are manipulated ([`ISS-017`](../issues/ISS-017-local-storage-path-traversal.md)).
2. **Ephemeral Disk Loss:** Modern containerized clouds (AWS ECS, Kubernetes, Heroku) run ephemeral filesystems. Any container restart or redeployment wipes locally stored files.
3. **Stateless Horizontal Scaling:** Multiple backend nodes cannot share a local filesystem without complex network file systems (NFS/EFS).

---

## 2. Decision Options & Architecture Profiles

### Option A: Standardized Cloud Object Storage in Production with Local Sandboxed Fallback for Dev (Recommended)
- **Universal Security Invariants (Enforced Across All Environments)**:
  - Strict path normalization and root jail boundary assertion (`ISS-017`).
  - Unguessable UUID storage keys (`uuidv4()`); raw client filenames strictly disallowed.
  - Mandatory tenant path scoping: `tenants/${companyId}/${category}/${uuid}.${ext}`.
  - Zero public buckets or publicly exposed directories; all access mediated via authenticated routes or short-lived pre-signed URLs.
  - Mandatory pre-upload magic byte inspection (`ISS-016`).
- **Operational Differences by Environment**:
  - **Local Development**: Allows local sandboxed disk storage (`LOCAL_STORAGE_DIR`) or local containerized MinIO via `docker-compose.dev.yml` to preserve offline developer productivity.
  - **Production & Staging**: Strictly mandates S3-compatible cloud object storage (AWS S3, Cloudflare R2, or dedicated MinIO cluster) with Server-Side Encryption (SSE-S3/KMS). Serving files from local disk in production is strictly prohibited due to container filesystem ephemerality and multi-node horizontal scaling.
  - **Download Delivery**: Production exclusively issues expiring pre-signed S3 URLs (15-minute validity). Local dev streams files through an authenticated backend proxy route that validates tenant session boundaries.

### Option B: Permanent Local Application Server Disk Storage in Production (REJECTED)
- **Why Rejected**: Containers (Docker, Kubernetes) recycle ephemeral storage on every deploy or crash, causing permanent loss of customer compliance files (RCs, licenses, POD photos). Furthermore, horizontal scaling across multiple web nodes cannot share a local filesystem without fragile NFS/CIFS network mounts.

---

## 3. Recommended Architectural Decision
**Adopt Option A:**
1. **Production Requirement**: When `NODE_ENV === 'production'`, the server asserts S3 configuration credentials (`AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). If missing or pointing to local disk, the server halts at startup with a configuration error.
2. **Local Development Convenience**: When `NODE_ENV === 'development'`, local disk storage is permitted within the strictly jailed `LOCAL_STORAGE_DIR`, or developers may launch the MinIO service defined in `docker-compose.dev.yml`.
3. **Pre-Signed URL Security**: All file access in production is executed via signed S3 URLs generated with a 15-minute TTL and forced attachment download disposition headers.
4. **Tenant Access Boundaries**: Endpoints requesting signed URLs must assert caller authentication and tenant ownership before signing the key.

---

## 4. Sign-Off & Next Steps
- [ ] Infrastructure & Security Architect approves production S3-only requirement and local development sandboxing. *(Pending Decision Approval)*
- [ ] MinIO service definition verified in `docker-compose.dev.yml` (`OPS-001`). *(Scheduled for Batch 6)*
- [x] `storageService.ts` updated with path jailing (`ISS-017`), strict extension allowlist, null byte & traversal sequence rejection, and tenant directory containment (Implemented and verified in Batch 1).
- [x] Pre-upload magic byte middleware mounted on upload routes (`ISS-016`) (Mounted in `documentRoutes.ts` and verified in Batch 1).
