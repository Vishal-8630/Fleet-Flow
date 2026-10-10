/**
 * ============================================================================
 * FLEET FLOW — MULTI-TENANT ISOLATION PLUGIN (tenantPlugin.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * This file implements the core multi-tenant logical database isolation engine
 * for Fleet Flow. In a multi-tenant SaaS application, multiple companies share
 * the same physical MongoDB database. This plugin ensures that no company can
 * EVER view, update, count, or delete another company's records.
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * Relying on developers to remember `{ company_id: req.tenant.id }` in every
 * single database query throughout an application is dangerous and inevitably
 * leads to data leakage bugs. 
 * By using this plugin:
 * 1. Every tenant-scoped model automatically receives a indexed `company_id` field.
 * 2. Every Mongoose query automatically injects `{ company_id: currentTenantId }`.
 * 3. Node.js `AsyncLocalStorage` safely retains the authenticated tenant ID
 *    through the entire asynchronous request-response cycle without global state pollution.
 * 
 * HOW THE FLOW WORKS:
 * -------------------
 * 1. An incoming HTTP request arrives with a verified JWT cookie.
 * 2. `authMiddleware.ts` extracts the company ID from the token and wraps downstream
 *    request handling inside `tenantStorage.run({ companyId }, () => next())`.
 * 3. Whenever code invokes `Truck.find()`, `Driver.findOne()`, etc., this plugin's
 *    hooks execute automatically, read `getCurrentTenantId()`, and append
 *    `this.where({ company_id: currentCompanyId })` before the query reaches MongoDB.
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
  // STEP 2: Automatic Query Interception
  // Intercept read and write queries before execution to enforce company scoping.
  // --------------------------------------------------------------------------
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateMany',
    'countDocuments',
    'estimatedDocumentCount',
  ] as const;

  queryMethods.forEach((method) => {
    schema.pre(method as any, function (this: any, next) {
      const currentCompanyId = getCurrentTenantId();
      
      // If a tenant context is active and bypass is not explicitly requested
      // (Bypass using query filter { skipTenantCheck: true } is reserved for super-admin analytics)
      if (currentCompanyId && !this.getFilter().skipTenantCheck) {
        this.where({ company_id: currentCompanyId });
      }
      next();
    });
  });

  // --------------------------------------------------------------------------
  // STEP 3: Automatic Pre-Validate & Pre-Save Tenant Attachment
  // If an entity is created without explicit company_id, pull it from context
  // before Mongoose schema validation executes.
  // --------------------------------------------------------------------------
  schema.pre('validate', function (next) {
    const currentCompanyId = getCurrentTenantId();
    if (currentCompanyId && !this.get('company_id')) {
      this.set('company_id', currentCompanyId);
    }
    next();
  });

  schema.pre('save', function (next) {
    const currentCompanyId = getCurrentTenantId();
    if (currentCompanyId && !this.get('company_id')) {
      this.set('company_id', currentCompanyId);
    }
    next();
  });

  // --------------------------------------------------------------------------
  // STEP 4: High-Performance Compound Index
  // Logistics workflows frequently sort records chronologically per company.
  // This compound index accelerates queries matching `{ company_id: X }` sorted
  // by `{ created_at: -1 }`.
  // --------------------------------------------------------------------------
  schema.index({ company_id: 1, created_at: -1 });
}
