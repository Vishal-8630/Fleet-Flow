# ISS-021: Custom Field Key Injection & Prototype Pollution Risk in Dynamic Entity Schemas

**Specification ID:** `ISS-021`  
**Title:** Custom Field Key Injection and Prototype Pollution Risk in Dynamic Entity Schemas  
**Type:** Security / Input Validation Vulnerability  
**Severity:** `P2` (Moderate)  
**Priority:** `P2` (Moderate)  
**Status:** Resolved & Verified (Batch 2)  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`backend/src/controllers/customFieldController.ts`](../../backend/src/controllers/customFieldController.ts), tenant administrators can create custom fields for operational entities (`truck`, `driver`, `journey`, `invoice`, `lr`). The field name/key creation handler does not sanitize or restrict field names against reserved JavaScript object keys (e.g. `__proto__`, `constructor`, `prototype`) or MongoDB operator prefixes (`$where`, `$regex`, `$gt`). If an administrator or compromised account creates a field with a dangerous key, subsequent dynamic document assignment (`entity.custom_fields[field_key] = value`) can cause prototype pollution or corrupt MongoDB BSON serialization.

---

## 2. Current Behavior & Root Cause
- **Confirmed Code Pattern:** In `customFieldController.ts`:
  ```typescript
  const { entity_type, field_label, field_key, field_type } = req.body;
  // field_key is accepted without strict regex or reserved key blacklist!
  const customField = await CustomField.create({
    company_id,
    entity_type,
    field_label,
    field_key: field_key || toSnakeCase(field_label),
    field_type,
  });
  ```
- **Vulnerability Mechanism:**
  1. Submitting `field_key: '__proto__'` creates a custom field with prototype key.
  2. When an operator fills this field on a truck, `truck.custom_fields['__proto__'] = payload` pollutes the object prototype.
  3. Submitting keys containing dots (`address.city`) or dollar signs (`$ref`) corrupts MongoDB document indexing.

---

## 3. Reproduction Steps
1. Send `POST /api/settings/custom-fields` with:
   `{ entity_type: 'truck', field_label: 'Prototype Exploit', field_key: '__proto__', field_type: 'text' }`.
2. Observe: The server accepts the key with HTTP 201 Created and saves it to MongoDB.

---

## 4. Expected Behavior
1. `field_key` must be strictly validated against regex `^[a-z][a-z0-9_]{1,30}$`.
2. Blacklist all reserved property names: `['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'is_deleted', 'company_id', '_id']`.
3. Disallow leading dollar signs (`$`) and periods (`.`).

---

## 5. Proposed Technical Solution
Update validation in `customFieldController.ts`:
```typescript
const RESERVED_KEYS = new Set([
  '__proto__', 'constructor', 'prototype', 'toString', 'valueOf',
  'company_id', '_id', 'created_at', 'updated_at', 'is_deleted',
]);

const KEY_REGEX = /^[a-z][a-z0-9_]{1,31}$/;

export function sanitizeFieldKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (!KEY_REGEX.test(normalized)) {
    throw new ApiError(400, 'Custom field key must start with a lowercase letter and contain only lowercase alphanumeric characters and underscores (2-32 chars).');
  }
  if (RESERVED_KEYS.has(normalized)) {
    throw new ApiError(400, `"${normalized}" is a reserved system keyword and cannot be used as a custom field key.`);
  }
  return normalized;
}
```

---

## 6. Acceptance Criteria
- [x] Attempting to create a custom field with `__proto__`, `constructor`, or `$where` is rejected with HTTP 400.
- [x] Valid snake_case keys (e.g. `chassis_color`, `toll_fastag_bank`) are accepted.
- [x] Keys containing uppercase, spaces, dots (`.`), or leading dollar signs (`$`) are rejected with HTTP 400.
- [x] Schema-level Mongoose validation blocks reserved keys on direct model operations.
- [x] Dynamic values validation (`validateCustomFieldValues`) enforces strict regex and reserved key checks.

---

## 7. Definition of Done
1. [x] Sanitization function implemented in `backend/src/utils/customFieldKeyValidator.ts` and integrated in `CustomFieldDefinition.ts` and `customFieldController.ts`.
2. [x] Tested and verified in `backend/src/tests/integration/phase21Hardening.test.ts`.

---

## 8. Verification Evidence (Batch 2)
- **Automated Test Suite:** `backend/src/tests/integration/phase21Hardening.test.ts` (7/7 tests passing).
- **Test Scenarios Verified:**
  1. Prototype Pollution Defense: Rejects `__proto__`, `constructor`, `prototype` with HTTP 400.
  2. MongoDB Operator Injection: Rejects `$where`, `$regex`, `$gt`, and keys with dots (`foo.bar`) with HTTP 400.
  3. Format Validation: Rejects spaces, uppercase letters, invalid lengths (<2, >32) with HTTP 400.
  4. Legitimate Keys: Accepts valid snake_case keys (`chassis_number`, `gps_imei`) with HTTP 201.
  5. Multi-Tenant Isolation: Custom field definitions are strictly isolated per tenant.
