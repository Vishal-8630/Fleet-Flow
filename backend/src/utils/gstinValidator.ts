/**
 * ============================================================================
 * FLEET FLOW — STATUTORY GSTIN & PAN VALIDATOR (gstinValidator.ts)
 * ============================================================================
 *
 * Implements authoritative structural and checksum validation for Indian GSTIN
 * and Income Tax PAN numbers.
 *
 * Standards:
 * - GSTIN: 15-character alphanumeric format under Section 22/25 of CGST Act.
 * - Luhn mod-36 checksum verification for the 15th character.
 * - Census 2011 state code verification (01-38, 97).
 * - PAN: 10-character alphanumeric structure (5 letters, 4 digits, 1 letter).
 * ============================================================================
 */

export const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

export const PAN_ENTITY_TYPES: Record<string, string> = {
  C: 'Company',
  P: 'Individual / Person',
  H: 'Hindu Undivided Family (HUF)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
};

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  stateName?: string;
  pan?: string;
}

/**
 * Validates a 10-character Permanent Account Number (PAN).
 * Format: 5 uppercase letters, 4 digits, 1 uppercase letter.
 * The 4th character denotes entity type (e.g. C, P, F, H).
 */
export function validatePAN(pan: string | undefined | null): ValidationResult {
  if (!pan || typeof pan !== 'string') {
    return { isValid: false, error: 'PAN is required.' };
  }

  const clean = pan.trim().toUpperCase();
  if (clean.length !== 10) {
    return { isValid: false, error: `PAN must be exactly 10 characters (received ${clean.length}).` };
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(clean)) {
    return { isValid: false, error: 'Invalid PAN structure. Must be 5 letters, 4 numbers, and 1 letter (e.g., AAPFU0939F).' };
  }

  const entityChar = clean[3];
  if (!PAN_ENTITY_TYPES[entityChar]) {
    return {
      isValid: false,
      error: `Invalid 4th character '${entityChar}' in PAN. Must be a valid entity code (e.g. C, P, F, H, T).`,
    };
  }

  return { isValid: true, pan: clean };
}

/**
 * Computes the 15th character checksum for the first 14 characters of a GSTIN
 * using the authoritative Luhn mod-36 algorithm.
 */
export function calculateGSTINChecksum(gstin14: string): string {
  if (!gstin14 || gstin14.length !== 14) {
    throw new Error(`GSTIN input must be exactly 14 characters to calculate checksum (received ${gstin14?.length || 0}).`);
  }

  const clean = gstin14.trim().toUpperCase();
  let total = 0;

  for (let i = 0; i < 14; i++) {
    const char = clean[i];
    const charIndex = GSTIN_CHARS.indexOf(char);
    if (charIndex === -1) {
      throw new Error(`Invalid character '${char}' in GSTIN at position ${i + 1}.`);
    }

    const multiplier = i % 2 === 1 ? 2 : 1;
    const product = charIndex * multiplier;
    total += Math.floor(product / 36) + (product % 36);
  }

  const remainder = total % 36;
  const checkCode = (36 - remainder) % 36;
  return GSTIN_CHARS[checkCode];
}

/**
 * Validates a 15-character Indian Goods and Services Tax Identification Number (GSTIN).
 * Checks:
 * 1. Length and base structure regex.
 * 2. State code against official GST state directory.
 * 3. Embedded 10-digit PAN validity.
 * 4. Default 14th character 'Z'.
 * 5. Luhn mod-36 checksum of the 15th character.
 */
export function validateGSTIN(gstin: string | undefined | null): ValidationResult {
  if (!gstin || typeof gstin !== 'string') {
    return { isValid: false, error: 'GSTIN is required.' };
  }

  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) {
    return { isValid: false, error: `GSTIN must be exactly 15 characters (received ${clean.length}).` };
  }

  // Structural Regex
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(clean)) {
    return { isValid: false, error: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5.' };
  }

  // State Code Check
  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) {
    return { isValid: false, error: `Invalid GSTIN state code '${stateCode}'. Must be between 01 and 38, or 97.` };
  }

  // PAN Check
  const embeddedPan = clean.substring(2, 12);
  const panValidation = validatePAN(embeddedPan);
  if (!panValidation.isValid) {
    return { isValid: false, error: `Invalid PAN portion in GSTIN: ${panValidation.error}` };
  }

  // Checksum Check
  const expectedChecksum = calculateGSTINChecksum(clean.substring(0, 14));
  const actualChecksum = clean[14];
  if (actualChecksum !== expectedChecksum) {
    return {
      isValid: false,
      error: `Invalid GSTIN checksum digit. Expected '${expectedChecksum}', but found '${actualChecksum}'.`,
    };
  }

  return {
    isValid: true,
    stateName,
    pan: embeddedPan,
  };
}
