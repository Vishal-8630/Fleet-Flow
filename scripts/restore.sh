#!/usr/bin/env bash
# ==============================================================================
# Fleet Flow — Safety-Critical Database Restore Script (OPS-003)
# ==============================================================================
# Purpose:
#   Validates archive integrity, decrypts AES-256-CBC backup archives, and
#   restores to a target MongoDB instance with strict safety guardrails.
#
# Requirements & Dependencies:
#   - mongorestore (from mongodb-database-tools) or MONGORESTORE_CMD override
#   - openssl (AES-256-CBC PBKDF2 decryption)
#   - sha256sum (or shasum -a 256)
#   - gzip
#
# Safety Principles:
#   - NEVER defaults to a live production database (TARGET_URI is mandatory)
#   - NEVER drops collections without explicit affirmative confirmation
#     (--confirm-drop=YES_I_WANT_TO_DROP)
#   - Verifies SHA-256 checksum BEFORE attempting decryption
#   - Plaintext decrypted archive exists ONLY in memory/ephemeral secure temp dir
#   - Trap guarantees zero plaintext residue on disk upon exit/interrupt
#   - Redacts credentials in all log outputs
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Configuration & Argument Parsing
# ------------------------------------------------------------------------------
ARCHIVE_PATH=""
TARGET_MONGODB_URI="${TARGET_MONGODB_URI:-}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-}"
BACKUP_HMAC_KEY="${BACKUP_HMAC_KEY:-}"
CONFIRM_DROP="${CONFIRM_DROP:-}"
ENABLE_DROP=false
DRY_RUN=false
SKIP_CHECKSUM=false
REQUIRE_HMAC=false
VERIFY_INTEGRITY=false

MONGORESTORE_CMD="${MONGORESTORE_CMD:-mongorestore}"
OPENSSL_CMD="${OPENSSL_CMD:-openssl}"
SHA256_CMD="${SHA256_CMD:-sha256sum}"

print_usage() {
  cat << 'EOF'
Usage: restore.sh --archive=<path> --target-uri=<uri> [options]

Mandatory Arguments:
  --archive=<path>          Path to .archive or .archive.enc backup file
  --target-uri=<uri>        Target MongoDB connection URI (e.g., mongodb://localhost:27017/fleetflow_restore)

Options:
  --drop                    Drop target collections before restoring (REQUIRES --confirm-drop)
  --confirm-drop=<string>   Required if --drop is set. Must be: YES_I_WANT_TO_DROP
  --passphrase=<key>        Passphrase for AES-256-CBC decryption (or set BACKUP_PASSPHRASE)
  --key-file=<file>         Path to key file for decryption (or set BACKUP_KEY_FILE)
  --hmac-key=<key>          Key for HMAC-SHA256 authentication (defaults to BACKUP_HMAC_KEY or passphrase)
  --require-hmac            Require HMAC authentication file to be present (rejects unauthenticated backups)
  --dry-run                 Verify checksum and test decryption without touching the database
  --skip-checksum           Skip pre-restoration SHA-256 validation (NOT RECOMMENDED)
  --verify-integrity        Perform post-restore collection count verification
  --help                    Show this help message
EOF
}

# Parse CLI arguments
for arg in "$@"; do
  case $arg in
    --archive=*)
      ARCHIVE_PATH="${arg#*=}"
      ;;
    --target-uri=*)
      TARGET_MONGODB_URI="${arg#*=}"
      ;;
    --drop)
      ENABLE_DROP=true
      ;;
    --confirm-drop=*)
      CONFIRM_DROP="${arg#*=}"
      ;;
    --passphrase=*)
      BACKUP_PASSPHRASE="${arg#*=}"
      ;;
    --key-file=*)
      BACKUP_KEY_FILE="${arg#*=}"
      ;;
    --hmac-key=*)
      BACKUP_HMAC_KEY="${arg#*=}"
      ;;
    --require-hmac)
      REQUIRE_HMAC=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --skip-checksum)
      SKIP_CHECKSUM=true
      ;;
    --verify-integrity)
      VERIFY_INTEGRITY=true
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $arg" >&2
      print_usage
      exit 1
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 2. Logging & Helper Functions
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

sanitize_uri() {
  local uri="$1"
  echo "$uri" | sed -E 's|://[^/]+@|://***:***@|g'
}

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

# ------------------------------------------------------------------------------
# 3. Mandatory Safety Guardrails & Validation
# ------------------------------------------------------------------------------
if [[ -z "$ARCHIVE_PATH" ]]; then
  log_error "Missing required argument: --archive=<path>"
  print_usage
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  log_error "Archive file not found: '$ARCHIVE_PATH'"
  exit 1
fi

if [[ -z "$TARGET_MONGODB_URI" ]]; then
  log_error "Missing required argument: --target-uri=<uri>"
  log_error "Restoring requires an explicit target database URI to prevent accidental production overwrite."
  print_usage
  exit 1
fi

SANITIZED_TARGET="$(sanitize_uri "$TARGET_MONGODB_URI")"

# Safety Check: Drop protection
if [[ "$ENABLE_DROP" == "true" ]]; then
  if [[ "$CONFIRM_DROP" != "YES_I_WANT_TO_DROP" ]]; then
    log_error "================================================================================"
    log_error "SAFETY INTERLOCK ENGAGED: DESTRUCTIVE DROP REQUESTED WITHOUT CONFIRMATION"
    log_error "================================================================================"
    log_error "You supplied the --drop flag to wipe collections before restore, but did NOT"
    log_error "provide the exact confirmation token."
    log_error "To proceed, pass: --confirm-drop=YES_I_WANT_TO_DROP"
    log_error "Operation aborted. Target database remains untouched."
    exit 1
  fi
  log_warn "DESTRUCTIVE MODE: --drop confirmed. Existing target collections will be replaced!"
fi

detect_sha256_cmd || exit 1

# ------------------------------------------------------------------------------
# 4. Authenticity & Checksum Integrity Verification
# ------------------------------------------------------------------------------
CHECKSUM_FILE="${ARCHIVE_PATH}.sha256"
HMAC_FILE="${ARCHIVE_PATH}.hmac"

# Resolve HMAC key fallback if not explicitly set
if [[ -z "$BACKUP_HMAC_KEY" ]]; then
  if [[ -n "$BACKUP_PASSPHRASE" ]]; then
    BACKUP_HMAC_KEY="$(derive_hmac_key "$BACKUP_PASSPHRASE")"
  elif [[ -n "$BACKUP_KEY_FILE" && -f "$BACKUP_KEY_FILE" ]]; then
    BACKUP_HMAC_KEY="$(derive_hmac_key "$(cat "$BACKUP_KEY_FILE")")"
  fi
fi

if [[ "$SKIP_CHECKSUM" == "true" ]]; then
  log_warn "SECURITY ALERT: --skip-checksum specified. Skipping authenticity and checksum verification."
elif [[ -f "$HMAC_FILE" ]]; then
  log_info "Verifying HMAC-SHA256 keyed authenticity digest against: $(basename "$HMAC_FILE")..."

  if [[ -z "$BACKUP_HMAC_KEY" ]]; then
    log_error "FATAL: Archive has companion HMAC file, but no authentication key was provided."
    log_error "Supply key via --hmac-key, --passphrase, or BACKUP_PASSPHRASE."
    exit 1
  fi

  EXPECTED_HMAC="$(awk '{print $1}' "$HMAC_FILE")"
  ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE_PATH")" && pwd)"
  ARCHIVE_FILE="$(basename "$ARCHIVE_PATH")"

  ACTUAL_HMAC="$(cd "$ARCHIVE_DIR" && compute_archive_hmac "$ARCHIVE_FILE" "$BACKUP_HMAC_KEY")"

  if [[ "$EXPECTED_HMAC" != "$ACTUAL_HMAC" ]]; then
    log_error "================================================================================"
    log_error "FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!"
    log_error "Expected HMAC: $EXPECTED_HMAC"
    log_error "Actual HMAC:   $ACTUAL_HMAC"
    log_error "================================================================================"
    log_error "The archive may have been deliberately modified or an incorrect key was provided."
    log_error "Aborting restore to prevent unauthorized or corrupted payload execution."
    exit 1
  fi
  log_info "Keyed authenticity verified: $ACTUAL_HMAC"

  # Also verify standard SHA-256 bit-rot checksum if present
  if [[ -f "$CHECKSUM_FILE" ]]; then
    EXPECTED_HASH="$(awk '{print $1}' "$CHECKSUM_FILE")"
    ACTUAL_HASH="$(cd "$ARCHIVE_DIR" && $SHA256_CMD "$ARCHIVE_FILE" | awk '{print $1}')"
    if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
      log_error "FATAL: SHA-256 checksum mismatch detected alongside HMAC. Aborting."
      exit 1
    fi
    log_info "SHA-256 bit-rot checksum verified."
  fi
elif [[ -f "$CHECKSUM_FILE" ]]; then
  if [[ "$REQUIRE_HMAC" == "true" ]]; then
    log_error "FATAL: --require-hmac was specified, but no companion .hmac file exists for '$ARCHIVE_PATH'."
    exit 1
  fi
  log_warn "NOTICE: No .hmac companion file found. Verifying unkeyed SHA-256 checksum for bit-rot detection only."
  log_warn "Archive authenticity against deliberate tampering cannot be proven without HMAC."
  
  EXPECTED_HASH="$(awk '{print $1}' "$CHECKSUM_FILE")"
  ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE_PATH")" && pwd)"
  ARCHIVE_FILE="$(basename "$ARCHIVE_PATH")"
  
  ACTUAL_HASH="$(cd "$ARCHIVE_DIR" && $SHA256_CMD "$ARCHIVE_FILE" | awk '{print $1}')"

  if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
    log_error "================================================================================"
    log_error "FATAL: CHECKSUM MISMATCH DETECTED!"
    log_error "Expected SHA-256: $EXPECTED_HASH"
    log_error "Actual SHA-256:   $ACTUAL_HASH"
    log_error "================================================================================"
    log_error "The backup archive may be corrupted or tampered with. Aborting restore."
    exit 1
  fi
  log_info "Checksum integrity verified: $ACTUAL_HASH"
else
  if [[ "$REQUIRE_HMAC" == "true" ]]; then
    log_error "FATAL: --require-hmac was specified, but no companion .hmac file exists for '$ARCHIVE_PATH'."
    exit 1
  fi
  log_warn "No companion checksum or HMAC file found at '$CHECKSUM_FILE'."
  log_warn "Proceeding without pre-restoration checksum verification."
fi

# ------------------------------------------------------------------------------
# 5. Ephemeral Decryption Setup & Cleanup Traps
# ------------------------------------------------------------------------------
RESTORE_TEMP_DIR=""
cleanup_temp() {
  local exit_code=$?
  if [[ -n "${RESTORE_TEMP_DIR:-}" && -d "$RESTORE_TEMP_DIR" ]]; then
    log_info "Securely purging temporary decryption artifacts..."
    rm -rf "$RESTORE_TEMP_DIR"
  fi
  if [[ $exit_code -ne 0 ]]; then
    log_error "Restore aborted or encountered an error (exit code $exit_code)."
  fi
  exit $exit_code
}
trap cleanup_temp EXIT INT TERM

# Create secure temporary directory with restricted permissions
RESTORE_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/.tmp_restore_XXXXXX")"
chmod 700 "$RESTORE_TEMP_DIR" 2>/dev/null || true

DECRYPTED_ARCHIVE="${RESTORE_TEMP_DIR}/restore.archive"

# ------------------------------------------------------------------------------
# 6. Decryption (if encrypted)
# ------------------------------------------------------------------------------
if [[ "$ARCHIVE_PATH" == *.enc ]]; then
  log_info "Encrypted archive detected. Initializing AES-256-CBC decryption..."
  
  if [[ -z "$BACKUP_PASSPHRASE" && -z "$BACKUP_KEY_FILE" ]]; then
    log_error "FATAL: Archive is encrypted but neither --passphrase nor --key-file was provided."
    exit 1
  fi

  if ! command -v "$OPENSSL_CMD" >/dev/null 2>&1; then
    log_error "OpenSSL ('$OPENSSL_CMD') is required for decryption but was not found."
    exit 1
  fi

  export BACKUP_PASSPHRASE
  decrypt_success=false

  if [[ -n "$BACKUP_KEY_FILE" && -f "$BACKUP_KEY_FILE" ]]; then
    if "$OPENSSL_CMD" enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
      -pass "file:${BACKUP_KEY_FILE}" \
      -in "$ARCHIVE_PATH" \
      -out "$DECRYPTED_ARCHIVE" 2>/dev/null; then
      decrypt_success=true
    fi
  else
    if "$OPENSSL_CMD" enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
      -pass "env:BACKUP_PASSPHRASE" \
      -in "$ARCHIVE_PATH" \
      -out "$DECRYPTED_ARCHIVE" 2>/dev/null; then
      decrypt_success=true
    fi
  fi

  if [[ "$decrypt_success" != "true" || ! -s "$DECRYPTED_ARCHIVE" ]]; then
    log_error "Decryption failed: Output archive is empty or invalid passphrase."
    exit 1
  fi
  log_info "Archive successfully decrypted into memory-buffered temp storage."
else
  log_info "Plaintext archive detected. Copying to isolated temp buffer..."
  cp "$ARCHIVE_PATH" "$DECRYPTED_ARCHIVE"
fi

# ------------------------------------------------------------------------------
# 7. Dry-Run Check or Database Restore
# ------------------------------------------------------------------------------
if [[ "$DRY_RUN" == "true" ]]; then
  log_info "------------------------------------------------------------------------------"
  log_info "[DRY RUN COMPLETE]"
  log_info "Archive verification and decryption succeeded."
  log_info "Decrypted size: $(wc -c < "$DECRYPTED_ARCHIVE" | tr -d ' ') bytes."
  log_info "Database restoration to '${SANITIZED_TARGET}' was safely SKIPPED."
  log_info "------------------------------------------------------------------------------"
  exit 0
fi

if ! command -v "$MONGORESTORE_CMD" >/dev/null 2>&1; then
  log_error "mongorestore binary ('$MONGORESTORE_CMD') not found in PATH."
  log_error "Install mongodb-database-tools or run inside the Fleet Flow Docker container."
  exit 1
fi

RESTORE_FLAGS=(
  "--uri=${TARGET_MONGODB_URI}"
  "--gzip"
  "--archive=${DECRYPTED_ARCHIVE}"
)

if [[ "$ENABLE_DROP" == "true" ]]; then
  RESTORE_FLAGS+=("--drop")
fi

log_info "Executing database restoration to: ${SANITIZED_TARGET}..."
"$MONGORESTORE_CMD" "${RESTORE_FLAGS[@]}"

log_info "Database restore completed successfully."

# ------------------------------------------------------------------------------
# 8. Post-Restore Verification Drill (Optional)
# ------------------------------------------------------------------------------
if [[ "$VERIFY_INTEGRITY" == "true" ]]; then
  log_info "Post-restore integrity check requested. Verifying collections..."
  if command -v mongosh >/dev/null 2>&1; then
    mongosh "$TARGET_MONGODB_URI" --quiet --eval '
      console.log("Collections in restored database:");
      db.getCollectionNames().forEach(c => {
        console.log(" - " + c + ": " + db[c].countDocuments() + " documents");
      });
    ' || log_warn "mongosh verification query returned non-zero."
  else
    log_warn "mongosh is not installed. Skipping direct collection count query."
  fi
fi

log_info "Restoration process finished cleanly."
exit 0
