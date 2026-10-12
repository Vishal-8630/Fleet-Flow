import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createTestTenant } from './helpers.js';

describe('Test Infrastructure Smoke Test', () => {
  it('connects to in-memory mongodb and provisions a tenant', async () => {
    expect(mongoose.connection.readyState).toBe(1);
    const tenant = await createTestTenant({ name: 'Smoke Test Logistics' });
    expect(tenant.company._id).toBeDefined();
    expect(tenant.token).toBeDefined();
  });
});
