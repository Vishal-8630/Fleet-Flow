/**
 * ============================================================================
 * FLEET FLOW — PHASE 5 AUTOMATED VERIFICATION SUITE (verifyPhase5.ts)
 * ============================================================================
 * 
 * EXECUTION:
 * npm run test:phase5  (or npx tsx src/scripts/verifyPhase5.ts)
 * 
 * SCOPE:
 * 1. Webhook Idempotency & Replay Attack Defense
 * 2. Mathematical Second-Precision Proration Calculus
 * 3. Dynamic Custom Field Injection Defense & Dynamic Zod Validation
 * 4. Read-Only Suspension Enforcement (Write blocked, Read allowed)
 * 5. Feature Catalog Dependency & Tier Evaluation Waterfall
 * ============================================================================
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Plan } from '../models/Plan.js';
import { AddOn } from '../models/AddOn.js';
import { Subscription } from '../models/Subscription.js';
import { ProcessedWebhook } from '../models/ProcessedWebhook.js';
import { CustomFieldDefinition } from '../models/CustomFieldDefinition.js';
import { calculateProration } from '../utils/prorationService.js';
import { validateCustomFieldsPayload } from '../utils/customFieldValidator.js';
import { getTenantEntitlements, hasFeatureAccess } from '../utils/entitlementService.js';
import { seedBillingCatalog } from '../utils/billingSeedService.js';
import { validateDependencies } from '../utils/featureCatalog.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow_test';

async function runPhase5Verification() {
  console.log('================================================================');
  console.log('🚀 STARTING PHASE 5 AUTOMATED VERIFICATION SUITE: SAAS BILLING,');
  console.log('   ENTITLEMENTS & WORKSPACE CUSTOMIZATION');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas successfully.\n');

  try {
    // ------------------------------------------------------------------------
    // Step 0: Ensure Catalog Seeding
    // ------------------------------------------------------------------------
    console.log('--- Step 0: Seeding Catalog Plans & Add-Ons ---');
    await seedBillingCatalog();
    const planCount = await Plan.countDocuments();
    const addonCount = await AddOn.countDocuments();
    console.log(`✅ Catalog Ready: ${planCount} Plans, ${addonCount} Add-Ons in database.\n`);

    // ------------------------------------------------------------------------
    // Step 1: Webhook Idempotency & Replay Attack Defense
    // ------------------------------------------------------------------------
    console.log('--- Step 1: Verifying Razorpay Webhook Idempotency ---');
    const testEventId = `evt_test_${Date.now()}`;
    const webhookPayload = {
      event_id: testEventId,
      source: 'razorpay' as const,
      event_type: 'payment.captured',
      payload: { payment: { id: 'pay_test_123', amount: 399900 } },
      status: 'success' as const,
    };

    // First ingestion
    const firstDelivery = await ProcessedWebhook.create(webhookPayload);
    if (!firstDelivery) throw new Error('Initial webhook ingestion failed.');
    console.log(`✅ Webhook [1st Delivery] ingested successfully: event_id=${testEventId}`);

    // Replay attack / Duplicate delivery attempt
    let duplicateCaught = false;
    try {
      await ProcessedWebhook.create(webhookPayload);
    } catch (err: any) {
      if (err.code === 11000) {
        duplicateCaught = true;
      }
    }

    if (!duplicateCaught) {
      throw new Error('❌ FAILED: Duplicate webhook was NOT rejected by unique index constraint.');
    }
    console.log('✅ Webhook [Duplicate Replay] successfully rejected via unique compound index (Code 11000).\n');

    // ------------------------------------------------------------------------
    // Step 2: Mathematical Second-Precision Proration Accuracy
    // ------------------------------------------------------------------------
    console.log('--- Step 2: Verifying Mathematical Proration Calculus ---');
    // Scenario: Starter (₹999/mo = 99,900 paise) to Pro (₹4,999/mo = 499,900 paise)
    // Upgraded at exact mid-cycle (15/30 days = 50% through cycle)
    const startDate = new Date('2026-01-01T00:00:00Z');
    const endDate = new Date('2026-01-31T00:00:00Z'); // 30 days
    const exactMidpoint = new Date('2026-01-16T00:00:00Z'); // 15 days remaining

    const proration = calculateProration(
      99900, // ₹999 in paise
      499900, // ₹4,999 in paise
      startDate,
      endDate,
      exactMidpoint
    );

    console.log(`   Fraction Remaining: ${proration.fraction_remaining * 100}%`);
    console.log(`   Unused Starter Credit: ₹${proration.current_plan_credit_paise / 100}`);
    console.log(`   Prorated Pro Charge:   ₹${proration.new_plan_charge_paise / 100}`);
    console.log(`   Net Upgrade Payable:   ₹${proration.net_payable_rupees}`);

    // At exact 50%, credit = ₹499.50 (floor = ₹499.50/49950), charge = ₹2,499.50 (ceil = 249950)
    // Net = 249950 - 49950 = 200000 paise (₹2,000)
    if (Math.abs(proration.net_payable_rupees - 2000) > 1) {
      throw new Error(`❌ FAILED: Proration calculation inaccurate. Expected ₹2000, got ₹${proration.net_payable_rupees}`);
    }
    console.log('✅ Mathematical proration matches exact theoretical expectation (₹2,000 net difference).\n');

    // ------------------------------------------------------------------------
    // Step 3: Custom Field Injection Defense & Dynamic Zod Validation
    // ------------------------------------------------------------------------
    console.log('--- Step 3: Verifying Dynamic Custom Field Injection Defense ---');
    const testCompanyId = new mongoose.Types.ObjectId();

    // Register a valid custom field for "Truck"
    await CustomFieldDefinition.create({
      company_id: testCompanyId,
      entity: 'Truck',
      field_key: 'fastag_barcode',
      field_label: 'FASTag RFID Barcode',
      field_type: 'text',
      is_required: false,
    });

    // Submitting with registered field -> should pass
    const validResult = await validateCustomFieldsPayload(testCompanyId, 'Truck', {
      fastag_barcode: 'NPCI-67890-IND',
    });

    if (!validResult.success) {
      throw new Error(`❌ Valid custom field was rejected: ${validResult.errors?.join(', ')}`);
    }
    console.log('✅ Valid registered custom field successfully passed dynamic Zod schema.');

    // Submitting malicious / rogue unregistered field -> MUST BE REJECTED
    const maliciousPayload = {
      fastag_barcode: 'NPCI-67890-IND',
      rogue_backdoor_field: 'malicious_code_injection',
    };
    const attackResult = await validateCustomFieldsPayload(testCompanyId, 'Truck', maliciousPayload);

    if (attackResult.success) {
      throw new Error('❌ FAILED: Malicious unregistered custom field was NOT rejected!');
    }
    console.log(`✅ Injection Defense: Malicious input was blocked: "${attackResult.errors?.[0]}"\n`);

    // ------------------------------------------------------------------------
    // Step 4: Read-Only Suspension Evaluation
    // ------------------------------------------------------------------------
    console.log('--- Step 4: Verifying Read-Only Suspension Evaluation ---');
    const mockSuspendedCompany = new Company({
      _id: new mongoose.Types.ObjectId(),
      name: 'Suspended Transporter',
      slug: `suspended-${Date.now()}`,
      email: 'suspended@test.com',
      phone: '9988776655',
      subscription_status: 'suspended',
    });

    const suspendedProfile = await getTenantEntitlements(mockSuspendedCompany);
    if (!suspendedProfile.is_read_only) {
      throw new Error('❌ FAILED: Suspended company was not marked as is_read_only!');
    }
    console.log('✅ Suspended tenant correctly evaluated as is_read_only: true (write locks enforced).\n');

    // ------------------------------------------------------------------------
    // Step 5: Feature Catalog Dependency Evaluation
    // ------------------------------------------------------------------------
    console.log('--- Step 5: Verifying Feature Catalog Dependency Graph ---');
    // MOD_BILLING_INVOICE requires MOD_PARTIES and MOD_LR_ENGINE
    const validModules = ['MOD_PARTIES', 'MOD_LR_ENGINE', 'MOD_BILLING_INVOICE'] as any;
    const depCheckValid = validateDependencies(validModules);
    if (!depCheckValid.valid) {
      throw new Error('❌ Valid dependency set was reported invalid!');
    }

    // Missing dependency: MOD_BILLING_INVOICE without MOD_LR_ENGINE
    const brokenModules = ['MOD_PARTIES', 'MOD_BILLING_INVOICE'] as any;
    const depCheckBroken = validateDependencies(brokenModules);
    if (depCheckBroken.valid || !depCheckBroken.missing.MOD_BILLING_INVOICE) {
      throw new Error('❌ Failed to detect missing dependency for MOD_BILLING_INVOICE!');
    }
    console.log('✅ Feature dependency graph successfully verified (detected missing MOD_LR_ENGINE).\n');

    // Clean up test records
    await ProcessedWebhook.deleteOne({ event_id: testEventId });
    await CustomFieldDefinition.deleteMany({ company_id: testCompanyId });

    console.log('================================================================');
    console.log('🎉 100% OF PHASE 5 BACKEND VERIFICATION CRITERIA PASSED!');
    console.log('   - Webhook Idempotency: Verified');
    console.log('   - Proration Calculus: Verified');
    console.log('   - Dynamic Zod Injection Defense: Verified');
    console.log('   - Read-Only Suspension Gate: Verified');
    console.log('   - Entitlements & Dependency Tree: Verified');
    console.log('================================================================');
  } finally {
    await mongoose.disconnect();
  }
}

runPhase5Verification().catch((err) => {
  console.error('\n❌ PHASE 5 VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
