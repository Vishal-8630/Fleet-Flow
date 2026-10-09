# Issue 13 — Security, Privacy, and Production Operations

## Metadata
- **Severity**: P1 (High) / Launch Blocker
- **Status**: Documented & Ready for Implementation
- **Category**: Infrastructure Security, Data Privacy (Aadhaar), Disaster Recovery, Observability & CI/CD
- **Date**: October 10, 2026

---

## 1. Problem Statement
Before opening Fleet Flow to live freight customers and financial transactions, enterprise security, statutory privacy, and production operational controls must be hardened:
1. **Unchecked File Uploads (MIME Spoofing)**: `documentRoutes.ts` relies on browser-supplied MIME types and file extensions. Attackers could upload malicious executables, SVGs with embedded scripts, or HTML payloads disguised as `.pdf` or `.jpg`.
2. **Unprotected PII & Indian Aadhaar Act Compliance**: Drivers' commercial driving licenses and Aadhaar numbers are stored without field-level encryption or mandated 8-digit masking (`XXXX-XXXX-1234`), creating regulatory compliance vulnerabilities under the Aadhaar Act and Digital Personal Data Protection (DPDP) Act 2023.
3. **No Automated Backups or Recovery Drills**: The database lacks an automated snapshot strategy, point-in-time recovery (PITR) configuration, and documented disaster recovery runbooks.
4. **Missing Observability & Liveness Health Checks**: There are no `/api/health/readiness` probes checking MongoDB connection state or memory thresholds, and logs are unformatted `console.log` statements without request correlation IDs.
5. **Credential Exposure Risk**: Development archives previously contained `.env` files with database credentials and JWT keys. A formal secrets rotation and environment segregation procedure is needed.
6. **No Centralized Automated CI/CD Test Pipeline**: There is no GitHub Actions workflow enforcing linting, type safety, and regression tests prior to deployment.
7. **Uncapped API Pagination & Variable Error Envelopes**: Some listing endpoints accept arbitrary `limit` parameters, posing Denial-of-Service memory risks.

---

## 2. Root Cause Analysis (RCA)
- **Early-Stage File Upload Simplicity**: File uploads accepted local disk storage without inspecting binary magic numbers (file signatures).
- **Console-Centric Logging**: Traditional development used unstructured `console.log` rather than a structured production logging pipeline (e.g. Pino).
- **Absence of Staging vs Production Pipeline**: Deployment scripts were not yet formalized with secrets management (e.g. AWS Secrets Manager or Doppler).

---

## 3. Implementation Solution & Target Architecture

### A. Document Security & Magic Byte Validation
- Build `backend/src/middleware/fileSecurityMiddleware.ts`:
  - **Magic Number Inspection**: Reads first 8 bytes of the uploaded file buffer to verify true binary signature:
    - PDF: `25 50 44 46` (`%PDF`)
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47`
    - WebP: `52 49 46 46` ... `57 45 42 50`
  - Rejects mismatched files with HTTP 415 (`Unsupported Media Type: File signature does not match declared extension`).
  - **Private Storage & Authorized Access**: Uploads are never served statically. Files are retrieved through `GET /api/documents/:id/download` with signed temporary URLs or authenticated streaming.
  - **Access Audit Logging**: Logs every view/download event in `DocumentAccessLog`.

### B. Sensitive Data Encryption & Aadhaar Masking (DPDP Act)
- **Aadhaar Masking**:
  - Automatically masks the first 8 digits upon receipt: `1234 5678 9012` → `XXXX-XXXX-9012`.
  - Only the masked version is displayed on driver profiles and printable dispatch cards.
- **AES-256-GCM Field-Level Encryption**:
  - Full Aadhaar and License numbers are encrypted at rest using AES-256-GCM with a dedicated key (`ENCRYPTION_SECRET_KEY`) separate from `JWT_SECRET`.
  - Dedicated immutable audit log for PII access (`actor_id`, `driver_id`, `reason`, `ip_address`).

### C. Backup, Disaster Recovery & RPO/RTO
- **Objectives**:
  - Recovery Point Objective (RPO): < 1 hour
  - Recovery Time Objective (RTO): < 15 minutes
- Automated Backup Strategy:
  - Daily full backup via `mongodump` with automated S3/GCS encrypted archiving.
  - Point-in-Time Recovery (PITR) enabled on MongoDB Atlas production cluster.
  - Documented restore script and validation drill: `backend/src/scripts/disasterRecoveryDrill.ts`.

### D. Observability, Health Checks & Structured Logging
- **Health Probes**:
  - `GET /api/health/liveness`: Fast check returning HTTP 200 `{ status: 'ok', uptime: process.uptime() }`.
  - `GET /api/health/readiness`: Verifies MongoDB database connectivity (`mongoose.connection.readyState === 1`), memory usage, and background worker status.
- **Structured JSON Logging**:
  - Integrated request logger generating structured JSON: `{ level, timestamp, reqId, method, path, statusCode, responseTimeMs, tenantId }`.
  - Unhandled exception alerting hook (Sentry / webhook alert for critical errors).

### E. Secrets Hygiene, Rotation & Environment Segregation
- **Credential Rotation Action Plan**:
  1. Generate new 64-byte random keys: `openssl rand -hex 64` for `JWT_SECRET` and `ENCRYPTION_SECRET_KEY`.
  2. Rotate MongoDB Atlas database user passwords in Atlas console.
  3. Regenerate Razorpay live API keys and webhook secrets.
  4. Ensure `.env` is strictly in `.gitignore`. Provide sanitized `.env.example`.
  5. Invalidate existing user sessions by incrementing `token_version` on all user records.

### F. Automated CI/CD Pipeline (`.github/workflows/ci.yml`)
- GitHub Actions workflow running on all Pull Requests and pushes to `main`:
  1. **Lint & Format**: Checks code consistency.
  2. **Type Check**: Runs `tsc --noEmit` across both `backend` and `frontend`.
  3. **Security Audit**: Runs `npm audit --audit-level=high`.
  4. **Test Suite**: Executes end-to-end integration tests (Auth, Entitlements, Tenant Isolation, Financial Invariants, Payments).
  5. **Build Check**: Executes `npm run build` in frontend.

### G. API Contract Standardization & Pagination Hardening
- Enforce strict pagination capping in `backend/src/middleware/paginationMiddleware.ts`:
  ```ts
  req.pagination = {
    page: Math.max(1, parseInt(req.query.page as string, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20)),
  };
  ```
- Uniform error envelope:
  ```json
  {
    "error": "Human readable message",
    "code": "MACHINE_READABLE_CODE",
    "details": {}
  }
  ```

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/middleware/fileSecurityMiddleware.ts` | Magic byte binary validation and file size restrictions |
| `backend/src/utils/cryptoService.ts` | AES-256-GCM encryption/decryption and Aadhaar masking helper |
| `backend/src/routes/healthRoutes.ts` | Liveness and readiness probe endpoints for orchestrators |
| `backend/src/middleware/requestLogger.ts` | Structured JSON logging with unique correlation request IDs |
| `backend/src/middleware/paginationMiddleware.ts` | Hardened pagination caps (max 100) preventing DoS memory spikes |
| `backend/src/scripts/disasterRecoveryDrill.ts` | Automated backup verification and restore drill script |
| `backend/src/scripts/rotateCredentials.ts` | Script to invalidate old sessions and verify rotated secrets |
| `.github/workflows/ci.yml` | GitHub Actions CI/CD configuration for automated testing and builds |
| `backend/.env.example` | Sanitized environment template with documented security requirements |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Testing Disguised Malicious File Upload Rejection
1. **Prepare a Disguised Test File**:
   - Create a simple text file on your desktop with arbitrary text content (e.g. `test script`).
   - Rename the file extension to `.pdf` (e.g. `fake_fitness_certificate.pdf`). Notice that although the extension says `.pdf`, the internal binary magic bytes are plain ASCII, not `%PDF-1.x`.
2. **Attempt Upload on the Website**:
   - Log in to your workspace at `http://localhost:5173/login`.
   - Go to **Fleet & Trucks** (`/fleet/trucks`), select a truck, and click **"Upload Fitness Certificate"**.
   - Select `fake_fitness_certificate.pdf` and click **"Upload"**.
3. **What You Should See on the Screen**:
   - The upload fails with a red security notification:  
     > 🛡️ *"Upload Rejected: File binary signature does not match valid PDF content. Corrupted or disguised files are rejected for system security."*
   - Now upload a genuine PDF: verify the file uploads cleanly and renders a thumbnail preview.

---

### Test 2: Verifying Aadhaar Masking & Audit Trail (DPDP Compliance)
1. **Inspect Masked Identity Numbers**:
   - In the sidebar, navigate to **Drivers Master** (`/drivers`).
   - Click to view any registered driver's profile.
   - Look at the **"Government Identity (Aadhaar)"** field:
     - Notice it is rendered in masked format: `XXXX-XXXX-4819`.
2. **Trigger Authorized Unmasking**:
   - Click the eye icon **"Reveal Aadhaar"** next to the masked number.
   - A modal prompts: *"Re-enter your account password to view unmasked sensitive personal data"*.
   - Enter your password and click **"Unlock"**.
3. **What You Should See on the Screen**:
   - The field unmasks displaying the full 12 digits: `9842-1102-4819` for 15 seconds with a visual countdown timer, then re-masks automatically.
   - Navigate to **Settings** -> **Audit Logs** (`/settings/audit`):
     - A new audit row is present:  
       > 🔒 *"Sensitive Data Access: User admin@apex.com unmasked Aadhaar for Driver #DRV-102. Action logged with IP timestamp."*

---

### Test 3: Verifying System Health & Readiness Status
1. **Open Health Probe in Browser**:
   - Open a browser tab and visit: `http://localhost:5000/health/ready`.
2. **What You Should See on the Screen**:
   - The browser displays HTTP 200 with structured JSON:  
     `{ "status": "UP", "database": "CONNECTED", "uptime_seconds": 3600 }`.
   - This verifies that container orchestrators and load balancers can monitor server readiness.

