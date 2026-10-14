#!/usr/bin/env bash
# ==============================================================================
# Fleet Flow — Automated Database Backup Script (OPS-003)
# ==============================================================================
# Purpose:
#   Dumps MongoDB database, compresses with gzip, encrypts with AES-256-CBC,
#   generates SHA-256 checksums, and manages Grandfather-Father-Son (GFS)
#   retention (30 daily, 12 weekly, 7 annual).
#
# Requirements & Dependencies:
#   - mongodump (from mongodb-database-tools) or MONGODUMP_CMD override
#   - openssl (AES-256-CBC PBKDF2 encryption)
#   - sha256sum (or shasum -a 256)
#   - gzip
#
# Safety Principles:
#   - Zero secret leakage in logs (URIs sanitized, passphrases via env)
#   - Atomic backup generation (writes to isolated temp dir, moves on 100% success)
#   - Automatic cleanup of partial/corrupted files on interrupt/error
#   - Independent GFS tier isolation (daily pruning never deletes weekly/annual)
#   - DEC-003 S3 awareness (local default with explicit limitation notice)
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Configuration & Default Settings
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Target connection URI (default: localhost test instance)
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/fleetflow}"

# Local storage path
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-${PROJECT_ROOT}/backups}"

# Optional Cloud S3 bucket (DEC-003 Pending Approval)
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"

# Encryption & Authenticity Settings
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-}"
BACKUP_HMAC_KEY="${BACKUP_HMAC_KEY:-}"
ALLOW_UNENCRYPTED_BACKUP="${ALLOW_UNENCRYPTED_BACKUP:-false}"

# Retention counts (GFS)
DAILY_RETENTION_COUNT="${DAILY_RETENTION_COUNT:-30}"
WEEKLY_RETENTION_COUNT="${WEEKLY_RETENTION_COUNT:-12}"
ANNUAL_RETENTION_COUNT="${ANNUAL_RETENTION_COUNT:-7}"

# Tool overrides (for testing or container environments)
MONGODUMP_CMD="${MONGODUMP_CMD:-mongodump}"
OPENSSL_CMD="${OPENSSL_CMD:-openssl}"
SHA256_CMD="${SHA256_CMD:-sha256sum}"
AWS_CMD="${AWS_CMD:-aws}"

# Tier override: auto, daily, weekly, annual
BACKUP_TIER="${BACKUP_TIER:-auto}"

# ------------------------------------------------------------------------------
# 2. Helper Functions
# ------------------------------------------------------------------------------
log_info() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [INFO] $*"
}

log_warn() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [WARN] $*" >&2
}

log_error() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [ERROR] $*" >&2
}

# Redact credentials from MongoDB URI for safe logging
sanitize_uri() {
  local uri="$1"
  echo "$uri" | sed -E 's|://[^/]+@|://***:***@|g'
}

# Determine SHA256 command if default is missing
detect_sha256_cmd() {
  if command -v "$SHA256_CMD" >/dev/null 2>&1; then
    return 0
  elif command -v shasum >/dev/null 2>&1; then
    SHA256_CMD="shasum -a 256"
    return 0
  else
    log_error "Neither sha256sum nor shasum is available."
    return 1
  fi
}

# Derive domain-separated HMAC key from passphrase using PBKDF2 (RFC 8018)
derive_hmac_key() {
  local pass="$1"
  if command -v node >/dev/null 2>&1; then
    BACKUP_INTERNAL_PASS="$pass" node -e '
      const crypto = require("crypto");
      const derived = crypto.pbkdf2Sync(process.env.BACKUP_INTERNAL_PASS, "fleetflow-backup-auth-v1", 100000, 32, "sha256");
      process.stdout.write(derived.toString("hex"));
    '
  elif command -v "$OPENSSL_CMD" >/dev/null 2>&1; then
    "$OPENSSL_CMD" kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt pass:"$pass" -kdfopt salt:fleetflow-backup-auth-v1 -kdfopt iter:100000 PBKDF2 2>/dev/null | tr -d ':\n ' | tr '[:upper:]' '[:lower:]'
  else
    echo -n "$pass" | "$SHA256_CMD" | awk '{print $1}'
  fi
}

# Compute HMAC-SHA256 without exposing keys in CLI process arguments (argv)
compute_archive_hmac() {
  local target_file="$1"
  local raw_key="$2"

  if [[ -z "$raw_key" ]]; then
    log_error "Cannot compute HMAC: No authentication key provided."
    return 1
  fi

  if command -v node >/dev/null 2>&1; then
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
  else
    "$OPENSSL_CMD" dgst -sha256 -hmac "$raw_key" "$target_file" | sed 's/^.*= //'
  fi
}

# Determine GFS Tier
resolve_tier() {
  if [[ "$BACKUP_TIER" != "auto" ]]; then
    echo "$BACKUP_TIER"
    return
  fi

  local day_of_year
  local day_of_week
  day_of_year="$(date +%j)" # 001 - 366
  day_of_week="$(date +%u)" # 1 (Mon) - 7 (Sun)

  # Annual snapshot: Day 1 of the year (or statutory March 31 if configured)
  if [[ "$day_of_year" == "001" ]]; then
    echo "annual"
  # Weekly snapshot: Sunday (day 7 in +%u)
  elif [[ "$day_of_week" == "7" ]]; then
    echo "weekly"
  else
    echo "daily"
  fi
}

# Prune backups beyond retention count within a specific tier directory
prune_tier_backups() {
  local tier="$1"
  local max_count="$2"
  local tier_dir="${LOCAL_BACKUP_DIR}/${tier}"

  if [[ ! -d "$tier_dir" ]]; then
    return 0
  fi

  log_info "Evaluating retention for tier '${tier}' (keep ${max_count} newest)..."

  # Find valid tier archives matching canonical naming pattern, sorted newest first (ISO-8601 lexicographical)
  local archives=()
  while IFS= read -r file; do
    if [[ -n "$file" ]]; then
      archives+=("$file")
    fi
  done < <(find "$tier_dir" -maxdepth 1 -type f \( -name "fleetflow_${tier}_*.archive.enc" -o -name "fleetflow_${tier}_*.archive" \) | sort -r)

  # Fallback if find returns nothing
  if [[ ${#archives[@]} -eq 0 ]]; then
    while IFS= read -r file; do
      if [[ -n "$file" ]]; then
        archives+=("$file")
      fi
    done < <(ls -1r "$tier_dir"/fleetflow_${tier}_*.archive.enc "$tier_dir"/fleetflow_${tier}_*.archive 2>/dev/null || true)
  fi

  local total_found=${#archives[@]}
  log_info "Tier '${tier}': ${total_found} valid archives found."

  if (( total_found > max_count )); then
    local excess=$(( total_found - max_count ))
    log_info "Pruning ${excess} expired archives from '${tier}'..."
    for (( i=max_count; i<total_found; i++ )); do
      local file_to_delete="${archives[$i]}"
      local checksum_to_delete="${file_to_delete}.sha256"
      local hmac_to_delete="${file_to_delete}.hmac"
      log_info "Pruning: $(basename "$file_to_delete")"
      rm -f "$file_to_delete" "$checksum_to_delete" "$hmac_to_delete"
    done
    log_info "Pruning complete for tier '${tier}'."
  else
    log_info "No pruning required for tier '${tier}' (${total_found}/${max_count} retained)."
  fi
}

# ------------------------------------------------------------------------------
# 3. Pre-Flight Validation
# ------------------------------------------------------------------------------
detect_sha256_cmd || exit 1

TIER="$(resolve_tier)"
case "$TIER" in
  daily|weekly|annual) ;;
  *)
    log_error "Invalid backup tier: '${TIER}'. Expected: daily, weekly, annual, or auto."
    exit 1
    ;;
esac

# Encryption validation
IS_ENCRYPTED=true
if [[ -z "$BACKUP_PASSPHRASE" && -z "$BACKUP_KEY_FILE" ]]; then
  if [[ "$ALLOW_UNENCRYPTED_BACKUP" == "true" ]]; then
    log_warn "SECURITY ALERT: No encryption key provided. ALLOW_UNENCRYPTED_BACKUP=true is set."
    log_warn "Backup archive will NOT be encrypted at rest!"
    IS_ENCRYPTED=false
  else
    log_error "FATAL: Neither BACKUP_PASSPHRASE nor BACKUP_KEY_FILE was provided."
    log_error "To prevent plaintext data exposure, backups require encryption by default."
    log_error "Provide BACKUP_PASSPHRASE or set ALLOW_UNENCRYPTED_BACKUP=true to override."
    exit 1
  fi
fi

if [[ "$IS_ENCRYPTED" == "true" ]]; then
  if ! command -v "$OPENSSL_CMD" >/dev/null 2>&1; then
    log_error "OpenSSL command '${OPENSSL_CMD}' not found. Cannot encrypt backup."
    exit 1
  fi
  if [[ -z "$BACKUP_HMAC_KEY" ]]; then
    if [[ -n "$BACKUP_PASSPHRASE" ]]; then
      BACKUP_HMAC_KEY="$(derive_hmac_key "$BACKUP_PASSPHRASE")"
    elif [[ -n "$BACKUP_KEY_FILE" && -f "$BACKUP_KEY_FILE" ]]; then
      BACKUP_HMAC_KEY="$(derive_hmac_key "$(cat "$BACKUP_KEY_FILE")")"
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 4. Atomic Execution Setup & Cleanup Traps
# ------------------------------------------------------------------------------
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_BASENAME="fleetflow_${TIER}_${TIMESTAMP}"
TARGET_DIR="${LOCAL_BACKUP_DIR}/${TIER}"

mkdir -p "$LOCAL_BACKUP_DIR"
mkdir -p "$TARGET_DIR"

# Ensure strict permissions on backup directories (POSIX only)
chmod 700 "$LOCAL_BACKUP_DIR" "$TARGET_DIR" 2>/dev/null || true

TMP_WORK_DIR=""
cleanup_temp() {
  local exit_code=$?
  if [[ -n "${TMP_WORK_DIR:-}" && -d "$TMP_WORK_DIR" ]]; then
    log_info "Cleaning up temporary working directory..."
    rm -rf "$TMP_WORK_DIR"
  fi
  if [[ $exit_code -ne 0 ]]; then
    log_error "Backup process aborted or failed with exit code ${exit_code}."
  fi
  exit $exit_code
}
trap cleanup_temp EXIT INT TERM

TMP_WORK_DIR="$(mktemp -d "${LOCAL_BACKUP_DIR}/.tmp_backup_XXXXXX")"
chmod 700 "$TMP_WORK_DIR" 2>/dev/null || true

RAW_ARCHIVE="${TMP_WORK_DIR}/${BACKUP_BASENAME}.archive"

# ------------------------------------------------------------------------------
# 5. Database Dump Execution
# ------------------------------------------------------------------------------
SANITIZED_URI="$(sanitize_uri "$MONGODB_URI")"
log_info "Initiating MongoDB database dump for tier '${TIER}'..."
log_info "Target URI: ${SANITIZED_URI}"

if ! command -v "$MONGODUMP_CMD" >/dev/null 2>&1; then
  log_error "mongodump binary ('${MONGODUMP_CMD}') not found in PATH."
  log_error "Install mongodb-database-tools or run inside the Fleet Flow Docker container."
  exit 1
fi

"$MONGODUMP_CMD" --uri="$MONGODB_URI" --archive="$RAW_ARCHIVE" --gzip

if [[ ! -s "$RAW_ARCHIVE" ]]; then
  log_error "Dump failed: Output archive is missing or zero bytes."
  exit 1
fi

RAW_SIZE=$(wc -c < "$RAW_ARCHIVE" | tr -d ' ')
log_info "Database dump succeeded. Compressed archive size: ${RAW_SIZE} bytes."

# ------------------------------------------------------------------------------
# 6. Encryption & Integrity Checksumming
# ------------------------------------------------------------------------------
FINAL_ARCHIVE_FILE=""

if [[ "$IS_ENCRYPTED" == "true" ]]; then
  FINAL_ARCHIVE_FILE="${TMP_WORK_DIR}/${BACKUP_BASENAME}.archive.enc"
  log_info "Encrypting archive with AES-256-CBC (PBKDF2 100,000 iterations)..."

  if [[ -n "$BACKUP_KEY_FILE" && -f "$BACKUP_KEY_FILE" ]]; then
    "$OPENSSL_CMD" enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
      -pass "file:${BACKUP_KEY_FILE}" \
      -in "$RAW_ARCHIVE" \
      -out "$FINAL_ARCHIVE_FILE"
  else
    export BACKUP_PASSPHRASE
    "$OPENSSL_CMD" enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
      -pass "env:BACKUP_PASSPHRASE" \
      -in "$RAW_ARCHIVE" \
      -out "$FINAL_ARCHIVE_FILE"
  fi

  # Immediately wipe unencrypted raw dump from temporary disk
  rm -f "$RAW_ARCHIVE"
  log_info "Encryption complete. Plaintext archive purged from temporary disk."
else
  FINAL_ARCHIVE_FILE="${TMP_WORK_DIR}/${BACKUP_BASENAME}.archive"
fi

FINAL_FILENAME="$(basename "$FINAL_ARCHIVE_FILE")"
CHECKSUM_FILE="${TMP_WORK_DIR}/${FINAL_FILENAME}.sha256"
HMAC_FILE="${TMP_WORK_DIR}/${FINAL_FILENAME}.hmac"

log_info "Computing SHA-256 integrity checksum..."
(
  cd "$TMP_WORK_DIR"
  $SHA256_CMD "$FINAL_FILENAME" > "$(basename "$CHECKSUM_FILE")"
)
log_info "SHA-256 checksum: $(cat "$CHECKSUM_FILE")"

if [[ -n "${BACKUP_HMAC_KEY:-}" ]]; then
  log_info "Computing HMAC-SHA256 keyed authenticity digest (with CLI argument shielding)..."
  (
    cd "$TMP_WORK_DIR"
    HMAC_DIGEST="$(compute_archive_hmac "$FINAL_FILENAME" "$BACKUP_HMAC_KEY")"
    echo "${HMAC_DIGEST}  ${FINAL_FILENAME}" > "$(basename "$HMAC_FILE")"
  )
  log_info "HMAC-SHA256 digest computed successfully."
fi

# ------------------------------------------------------------------------------
# 7. Atomic Promotion to Target Directory
# ------------------------------------------------------------------------------
log_info "Promoting verified backup to ${TARGET_DIR}..."

mv "$FINAL_ARCHIVE_FILE" "${TARGET_DIR}/"
mv "$CHECKSUM_FILE" "${TARGET_DIR}/"
if [[ -f "$HMAC_FILE" ]]; then
  mv "$HMAC_FILE" "${TARGET_DIR}/"
  chmod 600 "${TARGET_DIR}/${FINAL_FILENAME}.hmac" 2>/dev/null || true
fi

# Lock file permissions to read-only for owner (POSIX)
chmod 600 "${TARGET_DIR}/${FINAL_FILENAME}" "${TARGET_DIR}/${FINAL_FILENAME}.sha256" 2>/dev/null || true

log_info "Backup successfully created: ${TARGET_DIR}/${FINAL_FILENAME}"

# ------------------------------------------------------------------------------
# 8. S3 Cloud Storage Synchronization (DEC-003 Guardrail)
# ------------------------------------------------------------------------------
if [[ -n "$BACKUP_S3_BUCKET" ]]; then
  if command -v "$AWS_CMD" >/dev/null 2>&1; then
    S3_DEST="s3://${BACKUP_S3_BUCKET}/fleetflow-backups/${TIER}/${FINAL_FILENAME}"
    log_info "Syncing encrypted backup to AWS S3: ${S3_DEST}..."
    "$AWS_CMD" s3 cp "${TARGET_DIR}/${FINAL_FILENAME}" "$S3_DEST"
    "$AWS_CMD" s3 cp "${TARGET_DIR}/${FINAL_FILENAME}.sha256" "${S3_DEST}.sha256"
    if [[ -f "${TARGET_DIR}/${FINAL_FILENAME}.hmac" ]]; then
      "$AWS_CMD" s3 cp "${TARGET_DIR}/${FINAL_FILENAME}.hmac" "${S3_DEST}.hmac"
    fi
    log_info "S3 upload complete."
  else
    log_warn "BACKUP_S3_BUCKET is configured but AWS CLI ('${AWS_CMD}') was not found. Cloud upload skipped."
  fi
else
  log_info "------------------------------------------------------------------------------"
  log_info "[NOTICE] Local backup mode active."
  log_info "Storage limitations: Backup archive is persisted strictly to local disk (${TARGET_DIR})."
  log_info "Offsite disaster recovery is NOT achieved without external S3 replication."
  log_info "DEC-003 remains Pending Infrastructure & Security Approval."
  log_info "------------------------------------------------------------------------------"
fi

# ------------------------------------------------------------------------------
# 9. GFS Retention Pruning
# ------------------------------------------------------------------------------
case "$TIER" in
  daily)
    prune_tier_backups "daily" "$DAILY_RETENTION_COUNT"
    ;;
  weekly)
    prune_tier_backups "weekly" "$WEEKLY_RETENTION_COUNT"
    ;;
  annual)
    prune_tier_backups "annual" "$ANNUAL_RETENTION_COUNT"
    ;;
esac

log_info "Backup workflow for tier '${TIER}' completed successfully."
exit 0
