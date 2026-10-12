/**
 * ============================================================================
 * FLEET FLOW — MULTI-TENANT ISOLATION PLUGIN (tenantPlugin.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Implements the core multi-tenant logical database isolation engine for Fleet Flow.
 * In a multi-tenant SaaS application, multiple companies share the same physical
 * MongoDB database. This plugin ensures that no company can EVER view, update,
 * count, or delete another company's records.
 * 
 * SECURITY INVARIANTS:
 * --------------------
 * 1. Every tenant-scoped model automatically receives an indexed `company_id` field.
 * 2. Every Mongoose query automatically injects `{ company_id: currentTenantId }`
 *    from AsyncLocalStorage.
 * 3. Cross-tenant mutation and aggregation attempts are intercepted and rejected.
 * 4. Tenant-scoped database operations FAIL SAFELY when tenant context is missing:
 *    They will NOT silently bypass tenant protection.
 * 5. Privileged platform queries must explicitly declare `{ skipTenantCheck: true }`.
 * ============================================================================
 */

import mongoose, { Schema } from 'mongoose';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Node.js AsyncLocalStorage instance.
 * Stores an isolated execution context (the companyId) for the lifecycle
 * of an asynchronous operation (e.g., an Express HTTP request).
 */
export const tenantStorage = new AsyncLocalStorage<{ companyId: string }>();

/**
 * Helper function to retrieve the active tenant ID from AsyncLocalStorage.
 * Returns undefined if called outside of a tenant-authenticated request.
 */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.companyId;
}

export function getTenantId(req?: any): string | undefined {
  return getCurrentTenantId() || req?.companyId || req?.tenant?.id || req?.company?._id?.toString();
}

/**
 * Validates whether a value is a non-empty, truthy identifier for company_id.
 */
function isValidTenantIdentifier(val: any): boolean {
  if (val === undefined || val === null || val === 'undefined' || val === 'null') {
    return false;
  }
  if (typeof val === 'string' && val.trim().length > 0) return true;
  if (val instanceof mongoose.Types.ObjectId) return true;
  if (typeof val === 'object' && val !== null) return true; // Handles $in, $eq, etc.
  return false;
}

/**
 * Mongoose Plugin applied to all tenant-scoped database models.
 * 
 * @param schema - The Mongoose schema to apply multi-tenancy rules to.
 */
export function tenantPlugin(schema: Schema) {
  // --------------------------------------------------------------------------
  // STEP 1: Add indexed company_id foreign key
  // --------------------------------------------------------------------------
  schema.add({
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
  });

  // --------------------------------------------------------------------------
  // STEP 2: Automatic Query & Mutation Interception
  // Intercept read, write, update, and delete queries to enforce company scoping.
  // --------------------------------------------------------------------------
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateMany',
    'updateOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
    'findOneAndReplace',
    'distinct',
    'countDocuments',
  ] as const;

  queryMethods.forEach((method) => {
    schema.pre(method as any, function (this: any, next?: (err?: any) => void) {
      const filter = this.getFilter() || {};
      const options = (typeof this.getOptions === 'function' ? this.getOptions() : this.options) || {};
      const currentCompanyId = getCurrentTenantId();

      // Defense-in-depth: Purge skipTenantCheck from query filter so it cannot be abused from client inputs
      if ('skipTenantCheck' in filter) {
        delete filter.skipTenantCheck;
      }

      // Case 1: Explicit privileged bypass requested via query options (.setOptions({ skipTenantCheck: true }))
      if (options.skipTenantCheck === true) {
        if (typeof next === 'function') return next();
        return;
      }

      // Case 2: Active tenant context from AsyncLocalStorage
      if (currentCompanyId) {
        this.where({ company_id: currentCompanyId });
        if (typeof next === 'function') return next();
        return;
      }

      // Case 3: Missing AsyncLocalStorage, but explicit valid company_id provided in query filter
      if (isValidTenantIdentifier(filter.company_id)) {
        if (typeof next === 'function') return next();
        return;
      }

      // Case 4: FAIL SAFELY — Missing tenant context and no explicit bypass!
      // Tenant-scoped database operations must fail safely rather than leaking across tenants.
      const err = new Error(
        `[TenantIsolation] Operation '${method}' rejected: tenant context is missing. ` +
        `Tenant-scoped models require an active tenant session or explicit { skipTenantCheck: true } in query options.`
      );

      // Defense-in-depth: Force filter to match 0 documents
      this.where({ company_id: new mongoose.Types.ObjectId('000000000000000000000000') });

      if (typeof next === 'function') {
        return next(err);
      }
      throw err;
    });
  });

  // Prohibit estimatedDocumentCount on tenant-scoped collections because it counts whole-collection metadata
  schema.pre('estimatedDocumentCount', function (this: any, next?: any) {
    const err = new Error(
      `[TenantIsolation] 'estimatedDocumentCount' is prohibited on tenant-scoped models because it counts across all tenants. Use 'countDocuments()' instead.`
    );
    if (typeof next === 'function') return next(err);
    throw err;
  });

  // --------------------------------------------------------------------------
  // STEP 2B: Bulk Insert Protection (insertMany)
  // Validates that every document bulk-inserted belongs to the active tenant.
  // --------------------------------------------------------------------------
  schema.pre('insertMany', function (this: any, next: (err?: any) => void, docs: any[], options?: any) {
    const currentCompanyId = getCurrentTenantId();
    const opts = options || {};

    if (opts.skipTenantCheck === true) {
      if (typeof next === 'function') return next();
      return;
    }

    if (!currentCompanyId) {
      const err = new Error(
        `[TenantIsolation] Operation 'insertMany' rejected: tenant context is missing. ` +
        `Tenant-scoped models require an active tenant session or explicit { skipTenantCheck: true } in options.`
      );
      if (typeof next === 'function') return next(err);
      throw err;
    }

    const tenantObjectId = new mongoose.Types.ObjectId(currentCompanyId);

    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc) continue;

        // If doc already specifies company_id, it MUST match the active tenant!
        // Do not silently overwrite a conflicting tenant ID.
        if (doc.company_id && isValidTenantIdentifier(doc.company_id)) {
          if (doc.company_id.toString() !== currentCompanyId.toString()) {
            const err = new Error(
              `[TenantIsolation] Operation 'insertMany' rejected: document company_id (${doc.company_id}) ` +
              `does not match active tenant context (${currentCompanyId}). Cross-tenant bulk insert blocked.`
            );
            if (typeof next === 'function') return next(err);
            throw err;
          }
        } else {
          doc.company_id = tenantObjectId;
        }
      }
    }

    if (typeof next === 'function') return next();
  });

  // --------------------------------------------------------------------------
  // STEP 3: Aggregation Pipeline Interception
  // Ensures all aggregation pipelines are strictly scoped to the active tenant.
  // --------------------------------------------------------------------------
  schema.pre('aggregate', function (this: any, next?: (err?: any) => void) {
    const currentCompanyId = getCurrentTenantId();
    const pipeline = this.pipeline();
    const options = this.options || {};

    // Privileged bypass via aggregate options
    if (options.skipTenantCheck === true) {
      if (typeof next === 'function') return next();
      return;
    }

    // Active tenant context
    if (currentCompanyId) {
      const tenantObjectId = new mongoose.Types.ObjectId(currentCompanyId);
      // In MongoDB, $geoNear MUST remain the very first stage if present
      const insertIndex = (pipeline.length > 0 && pipeline[0]?.$geoNear) ? 1 : 0;
      pipeline.splice(insertIndex, 0, {
        $match: { company_id: tenantObjectId },
      });
      if (typeof next === 'function') return next();
      return;
    }

    // Check if stage 0 explicitly has a valid company_id match
    const firstMatch = pipeline[0]?.$match;
    if (firstMatch && isValidTenantIdentifier(firstMatch.company_id)) {
      if (typeof next === 'function') return next();
      return;
    }

    // FAIL SAFELY: Aggregation on tenant model without tenant context
    const err = new Error(
      `[TenantIsolation] Aggregation rejected: tenant context is missing on tenant-scoped model. ` +
      `Provide an active tenant context or explicitly configure { skipTenantCheck: true }.`
    );

    pipeline.unshift({
      $match: { company_id: new mongoose.Types.ObjectId('000000000000000000000000') },
    });

    if (typeof next === 'function') {
      return next(err);
    }
    throw err;
  });

  // --------------------------------------------------------------------------
  // STEP 4: Automatic Pre-Validate & Pre-Save Tenant Attachment & Integrity
  // --------------------------------------------------------------------------
  schema.pre('validate', function (next) {
    const currentCompanyId = getCurrentTenantId();
    if (currentCompanyId) {
      const existingCompanyId = this.get('company_id');
      if (existingCompanyId && isValidTenantIdentifier(existingCompanyId)) {
        if (existingCompanyId.toString() !== currentCompanyId.toString()) {
          const err = new Error(
            `[TenantIsolation] Operation 'validate' rejected: document company_id (${existingCompanyId}) ` +
            `does not match active tenant context (${currentCompanyId}).`
          );
          return next(err);
        }
      } else {
        this.set('company_id', currentCompanyId);
      }
    }
    next();
  });

  schema.pre('save', function (next) {
    const currentCompanyId = getCurrentTenantId();
    if (currentCompanyId) {
      const existingCompanyId = this.get('company_id');
      if (existingCompanyId && isValidTenantIdentifier(existingCompanyId)) {
        if (existingCompanyId.toString() !== currentCompanyId.toString()) {
          const err = new Error(
            `[TenantIsolation] Operation 'save' rejected: document company_id (${existingCompanyId}) ` +
            `does not match active tenant context (${currentCompanyId}).`
          );
          return next(err);
        }
      } else {
        this.set('company_id', currentCompanyId);
      }
    }
    next();
  });

  // --------------------------------------------------------------------------
  // STEP 5: High-Performance Compound Index
  // --------------------------------------------------------------------------
  schema.index({ company_id: 1, created_at: -1 });
}
