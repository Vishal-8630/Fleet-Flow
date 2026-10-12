/**
 * ============================================================================
 * FLEET FLOW — CUSTOM FIELD KEY VALIDATOR (customFieldKeyValidator.ts)
 * ============================================================================
 * 
 * Strict sanitization and validation for custom field definition keys (ISS-021).
 * Prevents prototype pollution, MongoDB operator injection, and schema attribute collisions.
 * ============================================================================
 */

export const RESERVED_PROPERTY_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tolocalestring',
  'company_id',
  '_id',
  'id',
  'created_at',
  'updated_at',
  'createdat',
  'updatedat',
  'is_deleted',
]);

export const CUSTOM_FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{1,31}$/;

/**
 * Validates a custom field definition key to prevent prototype pollution and MongoDB operator injection (ISS-021).
 */
export function validateCustomFieldKey(fieldKey: unknown): { isValid: boolean; error?: string } {
  if (typeof fieldKey !== 'string') {
    return { isValid: false, error: 'Field key must be a string.' };
  }

  // Reject Mongo operator or path characters
  if (fieldKey.includes('$') || fieldKey.includes('.')) {
    return { isValid: false, error: 'Field key cannot contain "$" or "." characters.' };
  }

  // Reject reserved names (case-insensitive)
  if (RESERVED_PROPERTY_NAMES.has(fieldKey.toLowerCase())) {
    return { isValid: false, error: `Field key cannot use reserved property name "${fieldKey}".` };
  }

  // Check strict regex format (must start with a-z, lower snake_case, 2-32 chars, no spaces or uppercase)
  if (!CUSTOM_FIELD_KEY_REGEX.test(fieldKey)) {
    return {
      isValid: false,
      error: 'Field key must start with a lowercase letter, contain only lowercase letters, numbers, and underscores, and be between 2 and 32 characters long.',
    };
  }

  return { isValid: true };
}
