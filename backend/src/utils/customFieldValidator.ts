/**
 * ============================================================================
 * FLEET FLOW — DYNAMIC CUSTOM FIELDS VALIDATOR (customFieldValidator.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Compiles a dynamic Zod validation schema on-the-fly for custom fields based on
 * the definitions stored in the database for a given entity and company.
 * 
 * WHY IS THIS CRITICAL?
 * ---------------------
 * Custom fields can become a security attack surface (payload injection, arbitrary
 * key pollution, database bloat). By compiling dynamic Zod validators with
 * strict key validation, rogue unregistered properties are rejected with
 * 400 Bad Request before ever reaching Mongoose or MongoDB.
 * ============================================================================
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { CustomFieldDefinition, CustomFieldTargetEntity, ICustomFieldDefinition } from '../models/CustomFieldDefinition.js';

/**
 * Validates an incoming `custom_fields` object against registered definitions for an entity.
 */
export async function validateCustomFieldsPayload(
  companyId: string | Types.ObjectId,
  entity: CustomFieldTargetEntity,
  payload: Record<string, any> = {}
): Promise<{ success: boolean; data?: Record<string, any>; errors?: string[] }> {
  // If no fields provided, return empty object
  if (!payload || typeof payload !== 'object') {
    return { success: true, data: {} };
  }

  // Fetch active registered fields for this tenant & entity
  const definitions = await CustomFieldDefinition.find({
    company_id: companyId,
    entity,
    is_archived: false,
  });

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  const registeredKeys = new Set(definitions.map((d) => d.field_key));

  for (const def of definitions) {
    let fieldSchema: z.ZodTypeAny;

    switch (def.field_type) {
      case 'number':
        fieldSchema = z.coerce.number();
        break;
      case 'boolean':
        fieldSchema = z.coerce.boolean();
        break;
      case 'date':
        fieldSchema = z.coerce.date();
        break;
      case 'dropdown':
        if (def.options && def.options.length > 0) {
          fieldSchema = z.enum(def.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      case 'multi_select':
        fieldSchema = z.array(z.string());
        break;
      case 'url':
        fieldSchema = z.string().url();
        break;
      case 'text':
      default:
        fieldSchema = z.string();
        break;
    }

    if (!def.is_required) {
      fieldSchema = fieldSchema.optional().nullable();
    }

    schemaShape[def.field_key] = fieldSchema;
  }

  // Check for rogue unregistered keys
  const rogueKeys = Object.keys(payload).filter((k) => !registeredKeys.has(k));
  if (rogueKeys.length > 0) {
    return {
      success: false,
      errors: [`Unregistered custom field(s) detected: ${rogueKeys.join(', ')}. Please register them before saving.`],
    };
  }

  // Dynamic Zod Schema compilation
  const dynamicSchema = z.object(schemaShape);
  const result = dynamicSchema.safeParse(payload);

  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return { success: false, errors: errorMessages };
  }

  return { success: true, data: result.data };
}
