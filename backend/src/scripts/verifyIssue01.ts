import 'dotenv/config';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { Truck } from '../models/Truck.js';
import { validateModuleDependencies, resolveModuleDependencies } from '../utils/featureCatalog.js';
import { getTenantEntitlements, hasFeatureAccess } from '../utils/entitlementService.js';

async function run() {
  console.log('🚀 Starting Issue 01 Entitlement & Subscription Verification Test...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transport_management';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  try {
    // 1. Test Feature Catalog Dependency Helper Functions
    console.log('\n--- 1. Testing Feature Catalog Dependency Engine ---');
    const testDeps = validateModuleDependencies(['MOD_TRIPS']);
    console.log('Dependency Check for MOD_TRIPS:', testDeps);
    if (testDeps.valid) {
      throw new Error('Expected MOD_TRIPS alone to be invalid due to missing dependencies.');
    }
    const resolved = resolveModuleDependencies(['MOD_TRIPS']);
    console.log('Resolved Dependencies for MOD_TRIPS:', resolved);
    if (!resolved.includes('MOD_FLEET') || !resolved.includes('MOD_DRIVERS')) {
      throw new Error('Expected resolved dependencies to include MOD_FLEET and MOD_DRIVERS.');
    }
    console.log('✅ Feature Catalog Dependency Engine passed.');

    // 2. Test Plan & Entitlements on a Dummy Company
    console.log('\n--- 2. Testing Tenant Entitlement Profiler ---');
    const dummyCompany = new Company({
      name: 'Test Entitlement Transport Ltd',
      slug: `test-entitlements-${Date.now()}`,
      email: `test-${Date.now()}@transport.com`,
      phone: '+919876543210',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    await dummyCompany.save();

    const entitlements = await getTenantEntitlements(dummyCompany);
    console.log('Entitlements for new trial company:', {
      status: entitlements.status,
      plan: entitlements.plan,
      is_read_only: entitlements.is_read_only,
      features_count: entitlements.enabled_features.length,
      limits: entitlements.limits,
    });

    if (entitlements.is_read_only !== false) {
      throw new Error('Trialing company should not be read-only.');
    }
    if (!entitlements.enabled_features.includes('MOD_FLEET')) {
      throw new Error('Standard trial should include MOD_FLEET.');
    }

    // 3. Test Suspended Company Status
    console.log('\n--- 3. Testing Suspended Status Entitlement Profile ---');
    dummyCompany.subscription_status = 'suspended';
    await dummyCompany.save();

    const suspendedEntitlements = await getTenantEntitlements(dummyCompany);
    console.log('Suspended Entitlements is_read_only:', suspendedEntitlements.is_read_only);
    if (suspendedEntitlements.is_read_only !== true) {
      throw new Error('Suspended company must have is_read_only: true.');
    }
    console.log('✅ Suspended status properly triggers read-only mode.');

    // 4. Test Expired Trial Company Status
    console.log('\n--- 4. Testing Expired Trial Status ---');
    dummyCompany.subscription_status = 'expired';
    await dummyCompany.save();

    const expiredEntitlements = await getTenantEntitlements(dummyCompany);
    console.log('Expired Entitlements is_read_only:', expiredEntitlements.is_read_only);
    if (expiredEntitlements.is_read_only !== true) {
      throw new Error('Expired company must have is_read_only: true.');
    }
    console.log('✅ Expired status properly triggers read-only mode.');

    // Cleanup dummy test company
    await Company.findByIdAndDelete(dummyCompany._id);
    console.log('🧹 Cleaned up temporary test company.');

    console.log('\n🎉 ALL ISSUE 01 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
