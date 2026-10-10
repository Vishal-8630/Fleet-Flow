/**
 * ============================================================================
 * CRYPTO SERVICE (cryptoService.ts)
 * ============================================================================
 * AES-256-GCM field-level encryption for PII (Aadhaar, DL numbers).
 * Aadhaar masking per Indian DPDP Act 2023 (shows only last 4 digits).
 * Magic-byte file validation to prevent MIME-type spoofing attacks.
 * ============================================================================
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256-bit
const IV_LENGTH = 12;  // 96-bit for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derives a consistent 32-byte key from the environment secret.
 */
function getDerivedKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET_KEY || process.env.JWT_SECRET || 'insecure_dev_key_replace_in_prod';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted field.
 * Input format: iv:authTag:ciphertext (all hex)
 */
export function decryptField(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[DECRYPTION_ERROR]';
  }
}

/**
 * Masks Aadhaar number for display per DPDP Act 2023.
 * Input:  "1234 5678 9012" or "123456789012"
 * Output: "XXXX-XXXX-9012"
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return aadhaar;
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${digits.slice(8)}`;
}

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Generates a secure random token for magic links (32 bytes = 64 hex chars).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Magic-byte file validation: verifies a file buffer matches its claimed type.
 * Returns null if valid, or an error string if the file is mismatched/invalid.
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  declaredMimeType: string
): string | null {
  if (!buffer || buffer.length < 8) {
    return 'File buffer is empty or too small to validate.';
  }

  const SIGNATURES: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/jpg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP)
    'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a/GIF89a
  };

  const expectedSignatures = SIGNATURES[declaredMimeType.toLowerCase()];
  if (!expectedSignatures) {
    // If MIME not in our list, allow through (unknown type) but warn
    return null;
  }

  const isValid = expectedSignatures.some((sig) =>
    sig.every((byte, idx) => buffer[idx] === byte)
  );

  if (!isValid) {
    return `File binary signature does not match declared type (${declaredMimeType}). Disguised or corrupted files are rejected.`;
  }

  return null; // valid
}

/**
 * Generates a HMAC-SHA256 hash for idempotency key validation.
 */
export function hmacSign(data: string, secret?: string): string {
  const key = secret || (process.env.JWT_SECRET || 'fallback');
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}
