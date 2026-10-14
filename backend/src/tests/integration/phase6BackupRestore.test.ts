/**
 * ============================================================================
 * PHASE 6C INTEGRATION SUITE: DATABASE BACKUP, RETENTION & DR (OPS-003)
 * ============================================================================
 * 
 * Verifies:
 * - Safety-critical restore guardrails (drop interlock, explicit URI required)
 * - Encryption requirement (enforces AES-256-CBC PBKDF2; prevents plaintext leakage)
 * - SHA-256 pre-verification & tamper detection (rejects modified archives)
 * - Grandfather-Father-Son (GFS) tier isolation & overlap resolution
 *   (daily pruning never deletes weekly or annual statutory snapshots)
 * - Atomic execution & temporary directory cleanup traps
 * - Dry-run validation mode
 * - Isolated restoration drill behavior
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
const BACKUP_SCRIPT = path.join(SCRIPTS_DIR, 'backup.sh');
const RESTORE_SCRIPT = path.join(SCRIPTS_DIR, 'restore.sh');

// Locate bash executable (supports Windows Git Bash and native Linux/Unix)
const BASH_EXECUTABLE = (() => {
  const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (process.platform === 'win32' && fs.existsSync(gitBashPath)) {
    return gitBashPath;
  }
  return 'bash';
})();

describe('Phase 6C: Automated Database Backup & Disaster Recovery (OPS-003)', () => {
  let tempFixtureDir: string;
  let mockBinDir: string;

  beforeEach(() => {
    tempFixtureDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.tmp_test_fixture_'));
    mockBinDir = path.join(tempFixtureDir, 'mock_bin');
    fs.mkdirSync(mockBinDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempFixtureDir)) {
      fs.rmSync(tempFixtureDir, { recursive: true, force: true });
    }
  });

  // Helper to run bash scripts with controlled environment
  function runBash(scriptPath: string, args: string[] = [], envOverrides: Record<string, string> = {}) {
    const defaultEnv = {
      ...process.env,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH}`,
      LOCAL_BACKUP_DIR: path.join(tempFixtureDir, 'backups'),
      ...envOverrides,
    };

    return spawnSync(BASH_EXECUTABLE, [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      env: defaultEnv,
      encoding: 'utf-8',
    });
  }

  // ==========================================================================
  // SUITE 1: Safety Interlocks & Argument Validation
  // ==========================================================================
  describe('1. Safety Interlocks & Validation Guardrails', () => {
    it('restore.sh: aborts if --archive is not provided', () => {
      const res = runBash(RESTORE_SCRIPT, ['--target-uri=mongodb://localhost:27017/test_db']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Missing required argument: --archive');
    });

    it('restore.sh: aborts if --target-uri is not provided', () => {
      const dummyFile = path.join(tempFixtureDir, 'test.archive');
      fs.writeFileSync(dummyFile, 'dummy content');

      const res = runBash(RESTORE_SCRIPT, [`--archive=${dummyFile}`]);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Missing required argument: --target-uri');
    });

    it('restore.sh: aborts with fatal error if --drop is passed without --confirm-drop token', () => {
      const dummyFile = path.join(tempFixtureDir, 'test.archive');
      fs.writeFileSync(dummyFile, 'dummy content');

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${dummyFile}`,
        '--target-uri=mongodb://localhost:27017/prod_like_db',
        '--drop',
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('SAFETY INTERLOCK ENGAGED: DESTRUCTIVE DROP REQUESTED WITHOUT CONFIRMATION');
      expect(res.stderr).toContain('--confirm-drop=YES_I_WANT_TO_DROP');
    });

    it('backup.sh: aborts if neither BACKUP_PASSPHRASE nor BACKUP_KEY_FILE is provided', () => {
      const res = runBash(BACKUP_SCRIPT, [], {
        BACKUP_PASSPHRASE: '',
        BACKUP_KEY_FILE: '',
        ALLOW_UNENCRYPTED_BACKUP: 'false',
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Neither BACKUP_PASSPHRASE nor BACKUP_KEY_FILE was provided');
    });

    it('backup.sh: aborts if an invalid backup tier is supplied', () => {
      const res = runBash(BACKUP_SCRIPT, [], {
        BACKUP_PASSPHRASE: 'TestPassphrase123!',
        BACKUP_TIER: 'invalid_quarterly',
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("Invalid backup tier: 'invalid_quarterly'");
    });
  });

  // ==========================================================================
  // SUITE 2: End-to-End Backup Creation, Encryption & Checksumming
  // ==========================================================================
  describe('2. Backup Creation, Encryption & Integrity Checksumming', () => {
    it('creates an AES-256-CBC encrypted archive with valid SHA-256 companion checksum', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');

      // Create a mock mongodump script that writes a valid gzip stream
      const mockMongodump = path.join(mockBinDir, 'mongodump');
      const mockMongodumpContent = `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*)
      ARCHIVE_PATH="\${arg#*=}"
      ;;
  esac
done
echo "FLEET_FLOW_TEST_MONGODB_PAYLOAD_DATA" | gzip > "$ARCHIVE_PATH"
exit 0
`;
      fs.writeFileSync(mockMongodump, mockMongodumpContent, { mode: 0o755 });

      const res = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: 'SecretKey2026!#Strong',
        MONGODUMP_CMD: mockMongodump,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("Initiating MongoDB database dump for tier 'daily'");
      expect(res.stdout).toContain('Encrypting archive with AES-256-CBC');
      expect(res.stdout).toContain('Computing SHA-256 integrity checksum');
      expect(res.stdout).toContain('Computing HMAC-SHA256 keyed authenticity digest');
      expect(res.stdout).toContain('[NOTICE] Local backup mode active');

      // Verify destination files exist in backups/daily/
      const dailyDir = path.join(backupDir, 'daily');
      expect(fs.existsSync(dailyDir)).toBe(true);

      const files = fs.readdirSync(dailyDir);
      const encFiles = files.filter(f => f.endsWith('.archive.enc'));
      const shaFiles = files.filter(f => f.endsWith('.archive.enc.sha256'));
      const hmacFiles = files.filter(f => f.endsWith('.archive.enc.hmac'));

      expect(encFiles.length).toBe(1);
      expect(shaFiles.length).toBe(1);
      expect(hmacFiles.length).toBe(1);

      // Verify SHA-256 companion checksum accurately hashes the encrypted file
      const encFilePath = path.join(dailyDir, encFiles[0]);
      const shaFilePath = path.join(dailyDir, shaFiles[0]);
      const hmacFilePath = path.join(dailyDir, hmacFiles[0]);

      const expectedShaContent = fs.readFileSync(shaFilePath, 'utf-8').trim();
      const actualFileBuffer = fs.readFileSync(encFilePath);
      const computedSha = crypto.createHash('sha256').update(actualFileBuffer).digest('hex');
      expect(expectedShaContent).toContain(computedSha);

      // Verify HMAC-SHA256 companion accurately authenticates the encrypted file with the secret key
      const expectedHmacContent = fs.readFileSync(hmacFilePath, 'utf-8').trim();
      const derivedKey = crypto.pbkdf2Sync('SecretKey2026!#Strong', 'fleetflow-backup-auth-v1', 100000, 32, 'sha256').toString('hex');
      const computedHmac = crypto.createHmac('sha256', derivedKey).update(actualFileBuffer).digest('hex');
      expect(expectedHmacContent).toContain(computedHmac);
    });
  });

  // ==========================================================================
  // SUITE 3: Tamper Detection & Keyed Authenticity Verification
  // ==========================================================================
  describe('3. Tamper Detection & Authenticity Pre-Verification', () => {
    it('restore.sh: detects deliberate tampering via HMAC-SHA256 mismatch and aborts', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_tamper.archive.enc');
      const shaFile = path.join(dailyDir, 'fleetflow_daily_tamper.archive.enc.sha256');
      const hmacFile = path.join(dailyDir, 'fleetflow_daily_tamper.archive.enc.hmac');

      const passphrase = 'IntegritySecretKey2026!';
      const genuineContent = Buffer.from('GENUINE_ENCRYPTED_BACKUP_PAYLOAD_2026');
      fs.writeFileSync(archiveFile, genuineContent);

      const derivedKey = crypto.pbkdf2Sync(passphrase, 'fleetflow-backup-auth-v1', 100000, 32, 'sha256').toString('hex');
      const genuineHmac = crypto.createHmac('sha256', derivedKey).update(genuineContent).digest('hex');
      fs.writeFileSync(hmacFile, `${genuineHmac}  fleetflow_daily_tamper.archive.enc\n`);

      // Attacker tampers with archive and recomputes the unkeyed SHA256 checksum
      const tamperedContent = Buffer.from('TAMPERED_ENCRYPTED_BACKUP_PAYLOAD_2026');
      fs.writeFileSync(archiveFile, tamperedContent);
      const attackerSha = crypto.createHash('sha256').update(tamperedContent).digest('hex');
      fs.writeFileSync(shaFile, `${attackerSha}  fleetflow_daily_tamper.archive.enc\n`);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        `--passphrase=${passphrase}`,
        '--dry-run',
      ]);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!');
      expect(res.stderr).toContain('The archive may have been deliberately modified or an incorrect key was provided.');
    });

    it('restore.sh: aborts when incorrect HMAC authentication key is supplied', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_valid.archive.enc');
      const hmacFile = path.join(dailyDir, 'fleetflow_daily_valid.archive.enc.hmac');

      const content = Buffer.from('VALID_ENCRYPTED_BACKUP_PAYLOAD');
      fs.writeFileSync(archiveFile, content);
      const derivedKey = crypto.pbkdf2Sync('CorrectKey123!', 'fleetflow-backup-auth-v1', 100000, 32, 'sha256').toString('hex');
      const genuineHmac = crypto.createHmac('sha256', derivedKey).update(content).digest('hex');
      fs.writeFileSync(hmacFile, `${genuineHmac}  fleetflow_daily_valid.archive.enc\n`);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        '--passphrase=WrongAuthenticationKey!',
        '--dry-run',
      ]);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!');
    });

    it('restore.sh: verifies pre-authentication with explicit independent --hmac-key', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_explicit.archive');
      const hmacFile = path.join(dailyDir, 'fleetflow_daily_explicit.archive.hmac');

      const content = Buffer.from('EXPLICIT_HMAC_PAYLOAD');
      fs.writeFileSync(archiveFile, content);
      const explicitHmacSecret = 'DiscreteAutonomousHmacSecret2026!';
      const genuineHmac = crypto.createHmac('sha256', explicitHmacSecret).update(content).digest('hex');
      fs.writeFileSync(hmacFile, `${genuineHmac}  fleetflow_daily_explicit.archive\n`);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        `--hmac-key=${explicitHmacSecret}`,
        '--dry-run',
      ]);

      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Keyed authenticity verified');
    });

    it('restore.sh: rejects restore if archive ciphertext is tampered by a single byte before decryption', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_byte_flip.archive.enc');
      const hmacFile = path.join(dailyDir, 'fleetflow_daily_byte_flip.archive.enc.hmac');

      const passphrase = 'ByteFlipProtectionKey2026!';
      const originalPayload = Buffer.from('ORIGINAL_ENCRYPTED_BACKUP_CIPHERTEXT_STREAM');
      fs.writeFileSync(archiveFile, originalPayload);

      const derivedKey = crypto.pbkdf2Sync(passphrase, 'fleetflow-backup-auth-v1', 100000, 32, 'sha256').toString('hex');
      const genuineHmac = crypto.createHmac('sha256', derivedKey).update(originalPayload).digest('hex');
      fs.writeFileSync(hmacFile, `${genuineHmac}  fleetflow_daily_byte_flip.archive.enc\n`);

      // Modify exactly 1 byte in the archive ciphertext
      const tamperedBytes = Buffer.from(originalPayload);
      tamperedBytes[tamperedBytes.length - 1] ^= 0x01; // flip single bit
      fs.writeFileSync(archiveFile, tamperedBytes);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        `--passphrase=${passphrase}`,
        '--dry-run',
      ]);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!');
    });

    it('restore.sh: allows restoring legacy unkeyed archive with .sha256 and logs security warning', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_legacy.archive');
      const shaFile = path.join(dailyDir, 'fleetflow_daily_legacy.archive.sha256');

      const content = Buffer.from('LEGACY_PLAINTEXT_BACKUP_PAYLOAD');
      fs.writeFileSync(archiveFile, content);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      fs.writeFileSync(shaFile, `${sha}  fleetflow_daily_legacy.archive\n`);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        '--dry-run',
      ]);

      expect(res.status).toBe(0);
      expect(res.stderr).toContain('NOTICE: No .hmac companion file found. Verifying unkeyed SHA-256 checksum for bit-rot detection only.');
      expect(res.stdout).toContain('Checksum integrity verified');
      expect(res.stdout).toContain('[DRY RUN COMPLETE]');
    });

    it('restore.sh: rejects unauthenticated legacy archive with .sha256 when --require-hmac is passed', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_legacy.archive');
      const shaFile = path.join(dailyDir, 'fleetflow_daily_legacy.archive.sha256');

      const content = Buffer.from('LEGACY_PAYLOAD');
      fs.writeFileSync(archiveFile, content);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      fs.writeFileSync(shaFile, `${sha}  fleetflow_daily_legacy.archive\n`);

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        '--require-hmac',
        '--dry-run',
      ]);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: --require-hmac was specified, but no companion .hmac file exists');
    });

    it('restore.sh: rejects unauthenticated archive with no companion files at all when --require-hmac is passed', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      const archiveFile = path.join(dailyDir, 'fleetflow_daily_naked.archive');
      fs.writeFileSync(archiveFile, Buffer.from('NAKED_PAYLOAD_NO_COMPANIONS'));

      const res = runBash(RESTORE_SCRIPT, [
        `--archive=${archiveFile}`,
        '--target-uri=mongodb://localhost:27017/test_isolated',
        '--require-hmac',
        '--dry-run',
      ]);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: --require-hmac was specified, but no companion .hmac file exists');
    });
  });

  // ==========================================================================
  // SUITE 4: Decryption & Dry-Run Mode
  // ==========================================================================
  describe('4. Decryption Round-Trip & Dry-Run Validation', () => {
    it('restore.sh --dry-run: successfully decrypts valid archive and validates size without modifying database', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');

      // Create mock mongodump
      const mockMongodump = path.join(mockBinDir, 'mongodump');
      const payload = 'SECRET_ENTERPRISE_INVOICES_AND_LEDGERS';
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "${payload}" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      const passphrase = 'MySuperSecurePassphrase2026!';
      const backupRes = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: passphrase,
        MONGODUMP_CMD: mockMongodump,
      });
      expect(backupRes.status).toBe(0);

      const dailyDir = path.join(backupDir, 'daily');
      const archiveName = fs.readdirSync(dailyDir).find(f => f.endsWith('.archive.enc'))!;
      const archivePath = path.join(dailyDir, archiveName);

      // Run restore in dry-run mode
      const restoreRes = runBash(RESTORE_SCRIPT, [
        `--archive=${archivePath}`,
        '--target-uri=mongodb://localhost:27017/isolated_dry_run_db',
        `--passphrase=${passphrase}`,
        '--dry-run',
      ]);

      expect(restoreRes.status).toBe(0);
      expect(restoreRes.stdout).toContain('Keyed authenticity verified');
      expect(restoreRes.stdout).toContain('SHA-256 bit-rot checksum verified');
      expect(restoreRes.stdout).toContain('Archive successfully decrypted');
      expect(restoreRes.stdout).toContain('[DRY RUN COMPLETE]');
      expect(restoreRes.stdout).toContain('Database restoration to \'mongodb://localhost:27017/isolated_dry_run_db\' was safely SKIPPED');
    });

    it('restore.sh: aborts at authenticity verification if incorrect passphrase is provided', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');

      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "PAYLOAD" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: 'CorrectPassphrase123!',
        MONGODUMP_CMD: mockMongodump,
      });

      const dailyDir = path.join(backupDir, 'daily');
      const archiveName = fs.readdirSync(dailyDir).find(f => f.endsWith('.archive.enc'))!;
      const archivePath = path.join(dailyDir, archiveName);

      // Attempt restore with wrong passphrase (HMAC pre-verification fails before decryption)
      const restoreRes = runBash(RESTORE_SCRIPT, [
        `--archive=${archivePath}`,
        '--target-uri=mongodb://localhost:27017/test_db',
        '--passphrase=CompletelyWrongPassword!',
        '--dry-run',
      ]);

      expect(restoreRes.status).toBe(1);
      expect(restoreRes.stderr).toContain('FATAL: AUTHENTICATION FAILED! HMAC-SHA256 MISMATCH DETECTED!');
    });

    it('restore.sh: aborts during decryption when incorrect passphrase is provided without HMAC companion file', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');

      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "PAYLOAD" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: 'CorrectPassphrase123!',
        MONGODUMP_CMD: mockMongodump,
      });

      const dailyDir = path.join(backupDir, 'daily');
      const archiveName = fs.readdirSync(dailyDir).find(f => f.endsWith('.archive.enc'))!;
      const archivePath = path.join(dailyDir, archiveName);

      // Remove .hmac file to test direct decryption failure handling
      const hmacPath = `${archivePath}.hmac`;
      if (fs.existsSync(hmacPath)) {
        fs.unlinkSync(hmacPath);
      }

      // Attempt restore with wrong passphrase and skip-checksum
      const restoreRes = runBash(RESTORE_SCRIPT, [
        `--archive=${archivePath}`,
        '--target-uri=mongodb://localhost:27017/test_db',
        '--passphrase=CompletelyWrongPassword!',
        '--skip-checksum',
        '--dry-run',
      ]);

      expect(restoreRes.status).toBe(1);
      expect(restoreRes.stderr).toContain('Decryption failed');
    });
  });

  // ==========================================================================
  // SUITE 5: GFS Retention Policy & Tier Overlap Resolution
  // ==========================================================================
  describe('5. Grandfather-Father-Son (GFS) Retention & Tier Overlap Resolution', () => {
    it('prunes daily backups to 30 without deleting weekly or annual statutory archives', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      const weeklyDir = path.join(backupDir, 'weekly');
      const annualDir = path.join(backupDir, 'annual');

      fs.mkdirSync(dailyDir, { recursive: true });
      fs.mkdirSync(weeklyDir, { recursive: true });
      fs.mkdirSync(annualDir, { recursive: true });

      // Create 35 simulated daily archives with staggered mtimes
      for (let i = 1; i <= 35; i++) {
        const pad = String(i).padStart(2, '0');
        const filename = `fleetflow_daily_202609${pad}_000000Z.archive.enc`;
        const filePath = path.join(dailyDir, filename);
        fs.writeFileSync(filePath, `daily backup ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash${i} ${filename}\n`);

        // Set modification time (older for smaller i)
        const time = new Date(2026, 8, i).getTime() / 1000;
        fs.utimesSync(filePath, time, time);
      }

      // Create 15 weekly archives
      for (let i = 1; i <= 15; i++) {
        const pad = String(i).padStart(2, '0');
        const filename = `fleetflow_weekly_2026${pad}_000000Z.archive.enc`;
        const filePath = path.join(weeklyDir, filename);
        fs.writeFileSync(filePath, `weekly backup ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash${i} ${filename}\n`);
      }

      // Create 10 annual archives
      for (let i = 1; i <= 10; i++) {
        const filename = `fleetflow_annual_20${15 + i}0101_000000Z.archive.enc`;
        const filePath = path.join(annualDir, filename);
        fs.writeFileSync(filePath, `annual backup ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash${i} ${filename}\n`);
      }

      // Mock mongodump
      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "DUMP" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      // Run daily backup with DAILY_RETENTION_COUNT=30
      // 35 existing + 1 new = 36 total daily -> should prune oldest 6 -> leave exactly 30
      const resDaily = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        DAILY_RETENTION_COUNT: '30',
        BACKUP_PASSPHRASE: 'RetentionKey123!',
        MONGODUMP_CMD: mockMongodump,
      });

      expect(resDaily.status).toBe(0);
      expect(resDaily.stdout).toContain("Pruning 6 expired archives from 'daily'");

      // Verify daily directory has exactly 30 archives (+ 30 checksums)
      const dailyFiles = fs.readdirSync(dailyDir).filter(f => f.endsWith('.archive.enc'));
      expect(dailyFiles.length).toBe(30);

      // CRITICAL ASSERTION: Weekly and Annual archives must remain 100% untouched!
      const weeklyFiles = fs.readdirSync(weeklyDir).filter(f => f.endsWith('.archive.enc'));
      const annualFiles = fs.readdirSync(annualDir).filter(f => f.endsWith('.archive.enc'));

      expect(weeklyFiles.length).toBe(15);
      expect(annualFiles.length).toBe(10);
    });

    it('prunes weekly and annual tiers independently according to their configured limits', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const weeklyDir = path.join(backupDir, 'weekly');
      const annualDir = path.join(backupDir, 'annual');
      fs.mkdirSync(weeklyDir, { recursive: true });
      fs.mkdirSync(annualDir, { recursive: true });

      // Seed 14 weekly archives
      for (let i = 1; i <= 14; i++) {
        const pad = String(i).padStart(2, '0');
        const filename = `fleetflow_weekly_2026W${pad}_000000Z.archive.enc`;
        const filePath = path.join(weeklyDir, filename);
        fs.writeFileSync(filePath, `weekly ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash ${filename}`);
        const time = new Date(2026, 0, i * 7).getTime() / 1000;
        fs.utimesSync(filePath, time, time);
      }

      // Seed 9 annual archives
      for (let i = 1; i <= 9; i++) {
        const filename = `fleetflow_annual_20${15 + i}0101_000000Z.archive.enc`;
        const filePath = path.join(annualDir, filename);
        fs.writeFileSync(filePath, `annual ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash ${filename}`);
        const time = new Date(2015 + i, 0, 1).getTime() / 1000;
        fs.utimesSync(filePath, time, time);
      }

      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "DUMP" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      // Run weekly backup: 14 + 1 = 15 total, prune to WEEKLY_RETENTION_COUNT=12 (prunes 3)
      const resWeekly = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'weekly',
        WEEKLY_RETENTION_COUNT: '12',
        BACKUP_PASSPHRASE: 'RetentionKey123!',
        MONGODUMP_CMD: mockMongodump,
      });
      expect(resWeekly.status).toBe(0);
      expect(fs.readdirSync(weeklyDir).filter(f => f.endsWith('.archive.enc')).length).toBe(12);

      // Run annual backup: 9 + 1 = 10 total, prune to ANNUAL_RETENTION_COUNT=7 (prunes 3)
      const resAnnual = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'annual',
        ANNUAL_RETENTION_COUNT: '7',
        BACKUP_PASSPHRASE: 'RetentionKey123!',
        MONGODUMP_CMD: mockMongodump,
      });
      expect(resAnnual.status).toBe(0);
      expect(fs.readdirSync(annualDir).filter(f => f.endsWith('.archive.enc')).length).toBe(7);
    });

    it('ignores malformed filenames and extraneous files without corrupting retention pruning', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');
      const dailyDir = path.join(backupDir, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });

      // Create extraneous/malformed files that must NOT be counted as backups
      fs.writeFileSync(path.join(dailyDir, 'notes.txt'), 'do not delete');
      fs.writeFileSync(path.join(dailyDir, 'temp.archive.enc.tmp'), 'incomplete');
      fs.writeFileSync(path.join(dailyDir, 'other_random_file.archive'), 'random');

      // Create 4 valid daily archives
      for (let i = 1; i <= 4; i++) {
        const pad = String(i).padStart(2, '0');
        const filename = `fleetflow_daily_202610${pad}_000000Z.archive.enc`;
        const filePath = path.join(dailyDir, filename);
        fs.writeFileSync(filePath, `daily ${i}`);
        fs.writeFileSync(`${filePath}.sha256`, `hash ${filename}`);
        fs.writeFileSync(`${filePath}.hmac`, `hmac ${filename}`);
      }

      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "DUMP" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      // Run daily backup: 4 existing + 1 new = 5 total. DAILY_RETENTION_COUNT=3 -> prunes 2 oldest
      const res = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        DAILY_RETENTION_COUNT: '3',
        BACKUP_PASSPHRASE: 'RetentionKey123!',
        MONGODUMP_CMD: mockMongodump,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("Tier 'daily': 5 valid archives found.");
      expect(res.stdout).toContain("Pruning 2 expired archives from 'daily'");

      // Valid archives pruned to exactly 3
      const validArchives = fs.readdirSync(dailyDir).filter(f => f.startsWith('fleetflow_daily_') && f.endsWith('.archive.enc'));
      expect(validArchives.length).toBe(3);

      // Extraneous files remain completely untouched
      expect(fs.existsSync(path.join(dailyDir, 'notes.txt'))).toBe(true);
      expect(fs.existsSync(path.join(dailyDir, 'temp.archive.enc.tmp'))).toBe(true);
      expect(fs.existsSync(path.join(dailyDir, 'other_random_file.archive'))).toBe(true);
    });
  });

  // ==========================================================================
  // SUITE 6: Tempfile Cleanup Traps & Secret Redaction
  // ==========================================================================
  describe('6. Tempfile Cleanup Traps & Secret Redaction', () => {
    it('cleans up temporary working directories upon unexpected failure', () => {
      const backupDir = path.join(tempFixtureDir, 'backups');

      // Mock a mongodump that crashes midway
      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
echo "Simulating sudden mongodump crash..." >&2
exit 137
`, { mode: 0o755 });

      const res = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: backupDir,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: 'CrashKey123!',
        MONGODUMP_CMD: mockMongodump,
      });

      expect(res.status).not.toBe(0);
      expect(res.stdout).toContain('Cleaning up temporary working directory');

      // Assert that no .tmp_backup_* directories remain in backupDir
      if (fs.existsSync(backupDir)) {
        const remainingTempDirs = fs.readdirSync(backupDir).filter(f => f.startsWith('.tmp_backup_'));
        expect(remainingTempDirs.length).toBe(0);
      }
    });

    it('redacts credentials from MongoDB URIs in log output', () => {
      const mockMongodump = path.join(mockBinDir, 'mongodump');
      fs.writeFileSync(mockMongodump, `#!/usr/bin/env bash
for arg in "$@"; do
  case $arg in
    --archive=*) ARCHIVE_PATH="\${arg#*=}" ;;
  esac
done
echo "DUMP" | gzip > "$ARCHIVE_PATH"
exit 0
`, { mode: 0o755 });

      const sensitiveUri = 'mongodb://super_admin:P@ssw0rd!Secret99@prod-mongo.internal:27017/fleetflow_prod';
      const res = runBash(BACKUP_SCRIPT, [], {
        LOCAL_BACKUP_DIR: path.join(tempFixtureDir, 'backups'),
        MONGODB_URI: sensitiveUri,
        BACKUP_TIER: 'daily',
        BACKUP_PASSPHRASE: 'TestKey123!',
        MONGODUMP_CMD: mockMongodump,
      });

      expect(res.status).toBe(0);
      // Ensure plain password does NOT appear anywhere in stdout or stderr
      expect(res.stdout).not.toContain('P@ssw0rd!Secret99');
      expect(res.stderr).not.toContain('P@ssw0rd!Secret99');
      // Ensure sanitized URI was logged
      expect(res.stdout).toContain('mongodb://***:***@prod-mongo.internal:27017/fleetflow_prod');
    });
  });
});
