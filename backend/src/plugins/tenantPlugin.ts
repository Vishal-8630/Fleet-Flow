import mongoose, { Schema } from 'mongoose';
import { AsyncLocalStorage } from 'async_hooks';

// Async Local Storage for tenant context preservation across async invocations
export const tenantStorage = new AsyncLocalStorage<{ companyId: string }>();

export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.companyId;
}

export function tenantPlugin(schema: Schema) {
  // 1. Add company_id to the schema
  schema.add({
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
  });

  // 2. Pre-query hook to automatically scope queries by company_id
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
      if (currentCompanyId && !this.getFilter().skipTenantCheck) {
        this.where({ company_id: currentCompanyId });
      }
      next();
    });
  });

  // 3. Pre-save hook to ensure company_id is populated
  schema.pre('save', function (next) {
    const currentCompanyId = getCurrentTenantId();
    if (currentCompanyId && !this.get('company_id')) {
      this.set('company_id', currentCompanyId);
    }
    next();
  });

  // 4. Compound index for high-speed multi-tenant queries
  schema.index({ company_id: 1, created_at: -1 });
}
