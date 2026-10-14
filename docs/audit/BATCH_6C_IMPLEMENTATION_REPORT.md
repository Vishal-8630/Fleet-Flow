# Fleet Flow — Batch 6C Final Implementation & Security Verification Report

**Phase:** Phase 6C: OPS-003 Automated Database Backup, Retention Policy & Disaster Recovery  
**Date:** October 14, 2026  
**Status:** Audited, Hardened, Verified & Recommended for PO Acceptance  
**Branch:** `main`  
**Base HEAD:** `d2d0df3128ca4614e4951d8b0f4af0eaab29a14b`  
**Staged Changes:** None (0 files staged in Git index)  
**Authorization:** Authorized for Phase 6C only (`OPS-003`). DEC-003 remains Pending Approval. Phase 6B accepted with documented limitation. Batch 7 is strictly excluded.

---

## 1. Executive Summary & Audit Scope

Phase 6C delivers the automated database backup engine, statutory retention policy, and disaster recovery architecture specified in [`docs/operations/OPS-003-backup-retention-disaster-recovery.md`](../operations/OPS-003-backup-retention-disaster-recovery.md) and [`docs/audit/BATCH_6_PREFLIGHT_REPORT.md`](BATCH_6_PREFLIGHT_REPORT.md).

Following targeted security auditing, the implementation was hardened with **Encrypt-then-MAC (HMAC-SHA256) keyed authenticity protection**, eliminating the vulnerability of standalone unkeyed checksums against deliberate tampering, while maintaining backward compatibility for historical backups.

### Delivered Deliverables:
1. **Automated Backup Engine (`scripts/backup.sh`):**
   - POSIX/Bash utility that dumps MongoDB databases with gzip compression, encrypts archives using OpenSSL AES-256-CBC with PBKDF2 key derivation (100,000 iterations), derives a cryptographically independent 256-bit authentication key via RFC 8018 PBKDF2 domain separation (`salt: "fleetflow-backup-auth-v1"`), computes both an unkeyed SHA-256 bit-rot checksum and an Encrypt-then-MAC keyed HMAC-SHA256 authenticity digest with process-argument shielding, and manages Grandfather-Father-Son (GFS) retention pruning.
2. **Safety-Critical Restoration Engine (`scripts/restore.sh`):**
   - Disaster recovery restore tool requiring an explicit target database connection URI, pre-authenticating HMAC-SHA256 over exact ciphertext bytes before decryption or database modification, shielding secrets from process arguments (`argv`), falling back gracefully to SHA-256 for legacy archives with an explicit security notice, rejecting unauthenticated backups when `--require-hmac` is active, decrypting into ephemeral restricted temporary storage (`chmod 700`) with automatic exit traps, and enforcing strict confirmation tokens before executing destructive collection drops.
3. **Comprehensive Disaster Recovery Runbook (`docs/operations/DISASTER_RECOVERY_RUNBOOK.md`):**
   - Authoritative operational procedures establishing target RPO ($\le$ 1 hour) and target RTO ($\le$ 2 hours), disaster classification matrices, emergency production restoration runbooks, monthly isolated restoration drill procedures, and cryptographic key management practices.
4. **Automated Regression & Security Suite (`backend/src/tests/integration/phase6BackupRestore.test.ts`):**
   - 21 comprehensive integration tests validating backup creation, AES-256-CBC encryption, companion SHA-256 checksums, companion HMAC-SHA256 authentication digests, deliberate tampering aborts, single-bit ciphertext modification rejection, explicit `--hmac-key` handling, PBKDF2 domain separation, wrong-authentication-key rejection, legacy unkeyed archive restoration, `--require-hmac` enforcement (with and without `.sha256`), dry-run validation, GFS retention pruning, malformed filename filtering, temporary directory cleanup traps, and credential sanitization in logs.

---

## 2. Detailed Technical Audit & Hardening Findings

### 2.1. Cryptographic Implementation & Five-Point Security Audit

#### Point 1: Secret Exposure & CLI Process Argument Shielding
- **Audit Findings on OpenSSL CLI:**
  - Standard OpenSSL CLI tools handle passphrase secrecy unevenly: `openssl enc` supports `-pass env:VAR` and `-pass file:PATH`, shielding passphrases from process tables.
  - However, `openssl dgst -hmac <key>` and `openssl dgst -macopt key:<key>` **only accept strings as command-line arguments**. OpenSSL `dgst` does not support `-pass env:VAR` or `-pass file:PATH` for HMAC operations.
  - Passing keys via CLI arguments directly exposes them to unprivileged local users via the OS process table (`ps -ef`, `top`, `/proc/<pid>/cmdline`), and leaks them into logs if shell tracing (`set -x`) is active.
- **Implemented Shielding Solution:**
  - Fleet Flow guarantees Node.js 22 LTS in all application containers and host environments.
  - In both `scripts/backup.sh` and `scripts/restore.sh`, HMAC generation and validation execute via `compute_archive_hmac()`, which injects the authentication key via a dedicated process environment variable (`BACKUP_INTERNAL_HMAC_SECRET`):
    ```bash
    BACKUP_INTERNAL_HMAC_SECRET="$raw_key" node -e '
      const crypto = require("crypto");
      const fs = require("fs");
      const secret = process.env.BACKUP_INTERNAL_HMAC_SECRET;
      const file = process.argv[1];
      const hmac = crypto.createHmac("sha256", secret);
      const fd = fs.openSync(file, "r");
      const buf = Buffer.alloc(65536);
      let bytesRead;
      while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        hmac.update(buf.subarray(0, bytesRead));
      }
      fs.closeSync(fd);
      process.stdout.write(hmac.digest("hex"));
    ' "$target_file"
    ```
  - **Verification:** Inspection of `/proc/<pid>/cmdline` and `ps` confirms that `argv` contains only `node -e ... <filename>`. The HMAC secret is never visible in process arguments, process listings, shell traces, or error output.

#### Point 2: Key Separation & Domain Derivation
- **Audit Findings:**
  - When an operator supplies only a single `BACKUP_PASSPHRASE`, using the raw passphrase directly as the HMAC key creates cross-algorithm key coupling.
  - Although OpenSSL derives the AES-256 key via PBKDF2 with an ephemeral salt (`Salted__...`), using the raw passphrase for HMAC means authentication relies on the un-derivated human passphrase without domain separation.
- **Implemented Standard Key-Derivation (RFC 8018 PBKDF2):**
  - Without inventing an ad-hoc cryptographic protocol, `derive_hmac_key()` applies standard RFC 8018 PBKDF2 key derivation:
    ```
    HMAC_AUTH_KEY = PBKDF2(passphrase, salt="fleetflow-backup-auth-v1", iter=100000, keylen=32, prf=SHA-256)
    ```
  - Both `scripts/backup.sh` and `scripts/restore.sh` resolve keys identically:
    - If `BACKUP_HMAC_KEY` (or `--hmac-key`) is explicitly configured, it is utilized directly for dual-key isolation.
    - If only `BACKUP_PASSPHRASE` (or `--passphrase` / `--key-file`) is provided, `derive_hmac_key()` computes a 256-bit cryptographically independent authentication key.
  - **Cryptographic Independence:** The derived HMAC key is mathematically distinct from both the raw passphrase and OpenSSL's AES encryption key, guaranteeing rigorous domain separation.

#### Point 3: Authentication Order (Encrypt-then-MAC Verification)
- **Audit Findings:**
  - The restoration workflow strictly adheres to the **Authenticate-then-Decrypt** paradigm (RFC 7366 / Encrypt-then-MAC).
  - In `scripts/restore.sh`, Section 4 ("Authenticity & Checksum Integrity Verification") executes **before**:
    - Section 5 ("Ephemeral Decryption Setup" / `mktemp`)
    - Section 6 ("Decryption" / `openssl enc -d`)
    - Section 7 ("Database Restore" / `mongorestore`)
  - The script computes `ACTUAL_HMAC` across the exact ciphertext bytes on disk and compares it to `EXPECTED_HMAC`.
  - **Tamper Evidence:** Modifying even a single bit in the ciphertext archive or changing the `.hmac` file causes immediate execution termination with exit code 1 (`FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!`). No temporary files are allocated, no decryption is attempted, and the MongoDB database remains completely untouched.

#### Point 4: Legacy Compatibility & Security Trade-Offs
- **Policy Enforcement:**
  - **Default Mode (Backwards-Compatible):**
    - If an archive has a companion `.hmac` file, HMAC authentication is mandatory.
    - If no `.hmac` file exists, but a `.sha256` bit-rot checksum exists, `restore.sh` verifies the SHA-256 checksum and logs an explicit security warning:
      ```
      [WARN] NOTICE: No .hmac companion file found. Verifying unkeyed SHA-256 checksum for bit-rot detection only.
      [WARN] Archive authenticity against deliberate tampering cannot be proven without HMAC.
      ```
  - **Strict Compliance Mode (`--require-hmac`):**
    - When `--require-hmac` is passed, `restore.sh` rejects any backup lacking a companion `.hmac` file (whether `.sha256` is present or no companion files exist at all):
      `FATAL: --require-hmac was specified, but no companion .hmac file exists for '<path>'.`
  - **Security Trade-Off Documented:**
    - Unkeyed SHA-256 checksums protect against inadvertent bit-rot and transmission corruption, but cannot protect against deliberate tampering by an adversary with storage write access.
    - For mission-critical environments requiring tamper resistance, automated restore jobs and operational runbooks should always specify `--require-hmac`.

#### Point 5: Regression & Build Verification
- **Automated Test Results:**
  - Focused backup/restore suite: **21 of 21 tests passing** (`phase6BackupRestore.test.ts`, 120.53s).
  - Operational health regression suite: **20 of 20 tests passing** (`phase6OperationalHealth.test.ts`, 5.03s).
  - Backend compilation: `npm run build` (`tsc`) clean (exit code 0).
  - Frontend production bundle: `npm run build` (`vite build`) clean (1,771 modules, exit code 0).
  - Script syntax validation: `bash -n scripts/backup.sh; bash -n scripts/restore.sh` clean (0 syntax errors).

---

### 2.2. Backup Atomicity & Ephemeral Cleanup Traps
- **Pre-Promotion Temp Directory Isolation:**
  - Dumps and encryption execute inside an ephemeral working directory (`.tmp_backup_XXXXXX`) created with `chmod 700` and `umask 077`.
  - The archive is promoted to the destination directory (`backups/${TIER}/`) atomically only after dump, encryption, checksumming, and HMAC generation have all succeeded 100%.
- **Crash & Interrupt Traps (`trap cleanup_temp EXIT INT TERM`):**
  - If `mongodump`, `tar`, `gzip`, `openssl`, or checksum calculation fails, or if execution is terminated (SIGINT / SIGTERM), the cleanup trap wipes all temporary artifacts immediately.
  - Incomplete or corrupted archives are **never** published to the target tier directory.
- **Protection of Existing Valid Backups:**
  - Retention pruning is strictly Step 9 (the final step in `backup.sh`). It executes **only** after a new backup has been verified and committed.
  - A failure during dump, encryption, or authentication will **never** delete or prune existing valid backups.
- **Plaintext Elimination:**
  - As soon as AES-256-CBC encryption completes, the unencrypted dump is purged immediately (`rm -f "$RAW_ARCHIVE"`).
  - During restore, decrypted plaintext is held only in an ephemeral directory (`.tmp_restore_XXXXXX`) that is purged by the exit trap immediately upon completion or error.

### 2.3. Grandfather-Father-Son (GFS) Retention & Tier Overlap Resolution
- **Statutory Retention Rules:**
  - **Daily Snapshots (Son):** 30 rolling daily backups.
  - **Weekly Snapshots (Father):** 12 rolling weekly backups (quarterly operational compliance).
  - **Annual Snapshots (Grandfather):** 7 statutory annual backups (fulfilling Section 128 of the Indian Companies Act, 2013 and Section 36 of the Central Goods and Services Tax Act, 2017).
- **Tier Namespace Isolation:**
  - Backups reside in separate tier directories:
    - `${LOCAL_BACKUP_DIR}/daily/`
    - `${LOCAL_BACKUP_DIR}/weekly/`
    - `${LOCAL_BACKUP_DIR}/annual/`
  - Pruning operates strictly within each tier directory. Deleting daily archives older than 30 days will **never** touch weekly or annual archives.
- **Robust Snapshot Selection:**
  - Filename format: `fleetflow_${tier}_YYYYMMDD_HHMMSSZ.archive.enc`.
  - Pruning uses ISO-8601 lexicographical reverse sorting (`sort -r` on `fleetflow_${tier}_*.archive*`), ensuring strict chronological ordering that is invariant under file copying or timestamp modification.
  - Extraneous files (e.g. `notes.txt`, temporary files) are ignored and do not distort retention counts.
  - Pruning automatically deletes companion `.sha256` and `.hmac` files alongside the archive.

### 2.4. Restore Safety & Drop Protection Interlock
- **Mandatory Target URI:**
  - Restoring requires an explicit `--target-uri` (or `TARGET_MONGODB_URI`). The script never defaults to a live production database.
- **Drop Confirmation Safety Interlock:**
  - If `--drop` is passed to wipe collections prior to restoration, the caller **must** explicitly supply `--confirm-drop=YES_I_WANT_TO_DROP`.
  - Omitting this token terminates execution with exit code 1 without touching the database.
- **Non-Destructive Dry-Run Mode:**
  - `--dry-run` validates HMAC authenticity, SHA-256 checksums, and AES-256-CBC decryption without connecting to or modifying the target database.
- **Pre-Restoration Abort on Failure:**
  - Checksum and HMAC verification occur **before** any database connection or decryption takes place. Tampered archives abort immediately.
  - An invalid passphrase causes immediate abort at the authentication step without touching the database.

---

## 3. DEC-003 Cloud Storage Notice & Operational Limitations

### 3.1. DEC-003 Decision Guardrail
- `DEC-003` (AWS S3 Object Storage Migration) remains **Pending Infrastructure & Security Approval**.
- S3 upload is strictly **optional**.
- If `BACKUP_S3_BUCKET` is unconfigured, backups are persisted locally to `LOCAL_BACKUP_DIR` and emit an explicit notice:
  ```
  [NOTICE] Local backup mode active.
  Storage limitations: Backup archive is persisted strictly to local disk.
  Offsite disaster recovery is NOT achieved without external S3 replication.
  DEC-003 remains Pending Infrastructure & Security Approval.
  ```

### 3.2. Operational Claims & Verification Honesty
- **Local Storage Risk:** Local backups protect against accidental collection drops, malicious tenant tampering, or faulty software migrations on the same host. They do **NOT** protect against total server hardware failure, storage disk loss, or datacenter destruction until offsite cloud storage (`DEC-003`) is provisioned.
- **Target SLA Objectives vs. Measured Times:**
  - **RPO Target:** $\le$ 1 hour (acceptable data loss window).
  - **RTO Target:** $\le$ 2 hours (system restored and traffic accepted post-disaster).
  - These values are explicitly documented as **target design SLA objectives**, not measured production results. A production restore time can only be measured during an authorized staging/production drill on live multi-node clusters.

---

## 4. Deliverables Register

| File Path | Action | Description |
| :--- | :--- | :--- |
| `scripts/backup.sh` | Hardened | MongoDB dump, gzip, AES-256-CBC PBKDF2 encryption, PBKDF2 HMAC domain separation, CLI-shielded HMAC-SHA256, and GFS retention pruning |
| `scripts/restore.sh` | Hardened | Restore tool with CLI-shielded HMAC-SHA256 pre-authentication, PBKDF2 domain separation, `--require-hmac` enforcement, drop interlock (`--confirm-drop`), and cleanup traps |
| `docs/operations/DISASTER_RECOVERY_RUNBOOK.md` | Updated | DR Runbook documenting RPO/RTO targets, triage matrices, Encrypt-then-MAC security, emergency restore, and isolated drill procedures |
| `backend/src/tests/integration/phase6BackupRestore.test.ts` | Updated | 21 automated integration tests verifying backup, restore, HMAC authenticity, single-bit tampering, PBKDF2 domain separation, GFS retention, and cleanup |
| `docs/audit/BATCH_6C_IMPLEMENTATION_REPORT.md` | Updated | Authoritative Phase 6C final implementation, five-point cryptographic audit, and operational verification report |

---

## 5. Verification Gate Results Summary

| Verification Target | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Phase 6C Integration Suite** | `npm test -- src/tests/integration/phase6BackupRestore.test.ts` | **PASSED** | 21 of 21 tests passed (120.53s) |
| **Phase 6A/6B Regression Suite** | `npm test -- src/tests/integration/phase6OperationalHealth.test.ts` | **PASSED** | 20 of 20 tests passed (5.03s) |
| **Backend TypeScript Build** | `npm run build` (in `backend/`) | **PASSED** | Exit code 0 (`tsc` clean) |
| **Frontend Production Build** | `npm run build` (in `frontend/`) | **PASSED** | Exit code 0 (1,771 modules transformed into `dist/`, 2.73s) |
| **Script Syntax Validation** | `bash -n scripts/backup.sh; bash -n scripts/restore.sh` | **PASSED** | Exit code 0 (0 syntax errors) |

---

## 6. Scope Controls & Safeguard Attestation

- **Current Git Branch:** `main`
- **Current HEAD Commit:** `d2d0df3128ca4614e4951d8b0f4af0eaab29a14b`
- **Commits / Pushes Executed:** None (0 commits, 0 pushes).
- **Staged Changes:** None (0 files staged in Git index).
- **Preservation of Phase 6A and 6B Changes:**
  - Phase 6A controller maintenance enum fix, deep health check routes, and 20 integration tests remain preserved in the working tree.
  - Phase 6B Dockerfiles, `.dockerignore` files, Nginx configuration, and multi-environment Compose files remain preserved in the working tree.
- **Architectural Safeguards:**
  - `DEC-003` remains `Pending Infrastructure & Security Approval`.
  - Batch 7 (and beyond) has **not** been started.
  - Out-of-scope features (`OPS-002` BullMQ, `OPS-004` Sentry APM) were **not** introduced.

---

## 7. Product Owner Acceptance Recommendation

Phase 6C (`OPS-003`) is complete, hardened, and verified against all cryptographic, security, and operational criteria:
- **CLI Secret Exposure Shielded:** Node.js child-process environment variable injection prevents encryption and HMAC passphrases from ever appearing in process tables (`argv`), shell traces, or error output.
- **Domain-Separated Cryptographic Independence:** RFC 8018 PBKDF2 derivation with static domain salt (`fleetflow-backup-auth-v1`) guarantees mathematical independence between encryption and authentication keys when a single passphrase is provided, while honoring explicit independent keys.
- **Strict Authenticate-then-Decrypt Order:** HMAC-SHA256 digests over the exact ciphertext bytes are verified prior to decryption or database access; single-bit corruptions abort immediately.
- **Enforced Legacy Compatibility:** Historical archives without HMAC require explicit warning logs or are rejected when `--require-hmac` is active.
- **21 Automated Integration Tests Passing:** 100% green test suite execution.
- **Zero Git Commits, Pushes, or Staged Diffs:** Clean working-tree preservation across Phases 6A, 6B, and 6C.

**Recommendation:** Phase 6C is fully verified and recommended for Product Owner formal acceptance. Work is halted awaiting PO authorization before any subsequent batch begins.
