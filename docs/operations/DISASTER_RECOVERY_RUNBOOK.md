# Fleet Flow — Production Disaster Recovery (DR) Runbook

**Operational Requirement:** `OPS-003` (Automated Database Backup, Retention Policy & Disaster Recovery)  
**Classification:** Safety-Critical SRE Runbook  
**Last Updated:** October 14, 2026  
**System Status:** Production Standard  

---

## 1. Disaster Recovery Objectives & SLA

Fleet Flow manages legally binding freight records, GST e-Way bills, multi-party ledger balances, and vehicle compliance. High-integrity data durability and business continuity are mission-critical.

| Metric | Target SLA | Description |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **$\le$ 1 Hour** | Maximum tolerable data loss window in the event of an unrecoverable disaster. Daily automated snapshots combined with replica set oplog provide continuous recovery. |
| **Recovery Time Objective (RTO)** | **$\le$ 2 Hours** | Total elapsed time from disaster declaration to service restoration, integrity verification, and traffic resumption. |

---

## 2. Disaster Classifications & Response Matrix

| Class | Scenario | Immediate Triage Action | Recovery Strategy |
| :--- | :--- | :--- | :--- |
| **Tier 1: Catastrophic Host / Storage Failure** | Server disk failure, hardware crash, or cloud host termination. | 1. Isolate broken host.<br>2. Provision new host/container instance. | Restore newest backup archive (`daily/` or `weekly/`) to new instance using `restore.sh`. |
| **Tier 2: Accidental Drop or Data Corruption** | Human operator error (`dropDatabase`), ransomware attack, or malicious data injection. | 1. Halt API traffic (`docker compose stop backend`).<br>2. Freeze database state. | 1. Provision isolated test database.<br>2. Restore latest pre-corruption snapshot.<br>3. Verify checksums and ledger balances.<br>4. Re-point application to restored database. |
| **Tier 3: Software Migration Defect** | Faulty schema migration corrupts active document structures. | 1. Rollback backend container version.<br>2. Inspect migration error logs. | Restore targeted collections or execute full point-in-time snapshot restore into staging. |

---

## 3. Backup Architecture & Grandfather-Father-Son (GFS) Retention

### 3.1. Retention Rules
Fleet Flow enforces a statutory Grandfather-Father-Son retention scheme satisfying the **Indian Companies Act, 2013** and **GST Law (7-year books of accounts retention rule)**:

- **Daily (Son):** 30 rolling daily snapshots.
- **Weekly (Father):** 12 rolling weekly snapshots (retained for 3 months).
- **Annual (Grandfather):** 7 statutory annual snapshots (retained for 7 years).

### 3.2. Overlapping Retention Period Resolution
To prevent the daily retention pruning window (30 days) from prematurely purging weekly backups (84 days) or annual backups (2,555 days), backups are stored in isolated tier directories:
```
backups/
├── daily/
│   ├── fleetflow_daily_20261014_000000Z.archive.enc
│   └── fleetflow_daily_20261014_000000Z.archive.enc.sha256
├── weekly/
│   ├── fleetflow_weekly_20261011_000000Z.archive.enc
│   └── fleetflow_weekly_20261011_000000Z.archive.enc.sha256
└── annual/
    ├── fleetflow_annual_20260101_000000Z.archive.enc
    └── fleetflow_annual_20260101_000000Z.archive.enc.sha256
```
- **Pruning Isolation:** The backup script runs `prune_tier_backups` strictly against the specific tier directory for the current snapshot.
- Pruning `daily/` past 30 archives evaluates **only** files in `backups/daily/`.
- Weekly snapshots in `backups/weekly/` and annual snapshots in `backups/annual/` reside in distinct directories and are unaffected by daily pruning cycles.

### 3.3. DEC-003 Cloud Storage Notice
- **Status:** `DEC-003` (AWS S3 Object Storage) remains **Pending Infrastructure & Security Approval**.
- **Current Behavior:** Backups are written to the local persistent directory (`LOCAL_BACKUP_DIR`).
- **Limitation Warning:** *Local disk backups do NOT protect against whole-host physical disk failure or site-wide datacenter outages. Off-site disaster recovery requires configuring `BACKUP_S3_BUCKET` once S3 credentials and decision records are approved.*

---

## 4. Cryptographic Security & Safety Guardrails

1. **AES-256-CBC Encryption:**
   - All archives are encrypted using OpenSSL with PBKDF2 key derivation (100,000 iterations):
     ```bash
     openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt
     ```
   - Unencrypted backups are rejected by default unless `ALLOW_UNENCRYPTED_BACKUP=true` is explicitly passed.
2. **Keyed Authenticity (Encrypt-then-MAC with HMAC-SHA256):**
   - In addition to standard bit-rot detection, backups enforce cryptographic authenticity against deliberate tampering using standard RFC 2104 HMAC-SHA256:
     ```bash
     openssl dgst -sha256 -hmac "$BACKUP_HMAC_KEY" "$ARCHIVE_FILE"
     ```
   - Output digest is written to companion file `${ARCHIVE_FILE}.hmac`.
   - Before any decryption or restore, `restore.sh` authenticates the ciphertext against `${ARCHIVE_FILE}.hmac`. Any deliberate modification to the archive or companion metadata causes immediate termination.
   - **Key Source & Separation:** `BACKUP_HMAC_KEY` defaults to `BACKUP_PASSPHRASE` (or `--key-file`), providing immediate out-of-the-box authenticity. It can alternatively be configured as an independent authentication secret (`BACKUP_HMAC_KEY`) for dual-key isolation.
   - **Backward Compatibility:** Historical archives lacking a `.hmac` file can still be restored using unkeyed SHA-256 verification (with an explicit operator security notice). Strict environments can enforce `--require-hmac` to reject unauthenticated archives.
3. **Key & Passphrase Handling:**
   - Passphrase must be provided via `BACKUP_PASSPHRASE` environment variable or `--key-file=/path/to/key.secret`.
   - Keys are **never** passed as command-line arguments that would appear in `ps` process tables.
4. **Secret Redaction:**
   - All script logs sanitize MongoDB connection strings:
     `mongodb://admin:secret123@mongo:27017/fleetflow` $\rightarrow$ `mongodb://***:***@mongo:27017/fleetflow`.
5. **Atomic Tempfile Isolation & Cleanup Trap:**
   - Dumps and decryption occur in isolated `chmod 700` temporary directories (`.tmp_backup_XXXXXX` / `.tmp_restore_XXXXXX`).
   - Strict POSIX `trap cleanup EXIT INT TERM` removes all decrypted plaintext files upon any exit, crash, or interrupt.
6. **Drop Protection Interlock:**
   - Restoring with `--drop` requires the explicit confirmation token `--confirm-drop=YES_I_WANT_TO_DROP`.
   - Any restore invocation omitting this token aborts immediately before modifying the target database.

---

## 5. Step-by-Step Restoration Runbook

### Scenario A: Emergency Production Restore (Host Available)

1. **Stop Incoming Traffic:**
   ```bash
   docker compose stop backend
   ```

2. **Locate Latest Verified Backup Archive:**
   ```bash
   # Identify newest daily or weekly archive
   ls -la backups/daily/
   ```

3. **Verify Archive Integrity (Dry-Run):**
   ```bash
   ./scripts/restore.sh \
     --archive=backups/daily/fleetflow_daily_YYYYMMDD_HHMMSSZ.archive.enc \
     --target-uri="mongodb://localhost:27017/fleetflow" \
     --passphrase="$BACKUP_PASSPHRASE" \
     --dry-run
   ```
   *Verify exit code is 0 and SHA-256 checksum matches.*

4. **Execute Confirmed Restore:**
   ```bash
   ./scripts/restore.sh \
     --archive=backups/daily/fleetflow_daily_YYYYMMDD_HHMMSSZ.archive.enc \
     --target-uri="mongodb://localhost:27017/fleetflow" \
     --passphrase="$BACKUP_PASSPHRASE" \
     --drop \
     --confirm-drop=YES_I_WANT_TO_DROP \
     --verify-integrity
   ```

5. **Restart Application Services & Verify Health:**
   ```bash
   docker compose up -d backend
   curl -f http://localhost:5000/health/ready
   ```

---

### Scenario B: Safe Isolated Restoration Drill (Monthly Procedure)

To verify backup durability without impacting active production data:

1. **Provision an Isolated Test Target Database (`fleetflow_drill`):**
   ```bash
   DRILL_URI="mongodb://localhost:27017/fleetflow_drill"
   ```

2. **Run Restore into Isolated Database:**
   ```bash
   ./scripts/restore.sh \
     --archive=backups/daily/fleetflow_daily_YYYYMMDD_HHMMSSZ.archive.enc \
     --target-uri="$DRILL_URI" \
     --passphrase="$BACKUP_PASSPHRASE" \
     --drop \
     --confirm-drop=YES_I_WANT_TO_DROP \
     --verify-integrity
   ```

3. **Assert Core Collection Invariants:**
   Verify document counts in key business collections:
   - `companies` > 0
   - `users` > 0
   - `trucks` $\ge$ 0
   - `entries` $\ge$ 0
   - `ledgers` balances match debit/credit sums.

4. **Drop Isolated Drill Database:**
   ```bash
   mongosh "$DRILL_URI" --eval 'db.dropDatabase()'
   ```

---

## 6. Verification and Audit Log Record

All backup and restoration events must log:
- Timestamp (UTC ISO 8601)
- Operator / Automated Service Account
- Backup Tier (`daily`, `weekly`, `annual`)
- Archive Filename and SHA-256 Checksum
- Success / Failure Status
- Target Host and Database (redacted)
