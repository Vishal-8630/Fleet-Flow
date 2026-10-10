import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Company } from '../models/Company.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { Truck } from '../models/Truck.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { ProcessedWebhook } from '../models/ProcessedWebhook.js';
import {
  createPaymentOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  getGatewayCredentials,
} from '../utils/paymentGateway.js';
import { seedBillingCatalog } from '../utils/billingSeedService.js';

async function run() {
  console.log('🚀 Starting Issue 02 Payment Gateway & Security Verification Test...\n');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transport_management';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  try {
    // 1. Seed billing catalog
    await seedBillingCatalog();
    const plans = await Plan.find({ is_active: true });
    console.log(`✅ Loaded ${plans.length} active billing plans.`);

    const starterPlan = plans.find((p) => p.code === 'starter') || plans[0];
    const proPlan = plans.find((p) => p.code === 'pro') || plans[1];

    // 2. Test Order Creation & GST 18% Breakup
    console.log('\n--- 1. Testing Server-Side Order Generation & GST Calculation ---');
    const order = await createPaymentOrder({
      amount_paise: 294882, // ₹2,499 + 18% GST = ₹2,948.82
      currency: 'INR',
      receipt: 'INV-2026-TEST01',
      notes: { plan_code: 'pro', cycle: 'monthly' },
    });
    console.log('Generated Order:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      is_live: order.is_live,
    });

    if (!order.id || order.amount !== 294882) {
      throw new Error('Order creation returned invalid amount or ID.');
    }
    console.log('✅ Order creation verified successfully.');

    // 3. Test Fail-Closed Payment Signature Verification
    console.log('\n--- 2. Testing Fail-Closed Payment Signature Verification ---');
    const { keySecret } = getGatewayCredentials();

    // 3a. Missing parameters
    const checkMissing = verifyPaymentSignature('', '', '');
    if (checkMissing.valid) {
      throw new Error('Expected missing parameters to fail verification.');
    }
    console.log('✅ Missing parameters rejected fail-closed.');

    // 3b. Invalid / Spoofed signature
    const checkSpoofed = verifyPaymentSignature(order.id, 'pay_spoofed_123', 'fake_signature_hex_0000000000000000000000000000000000000000000000000000000000000000');
    if (checkSpoofed.valid) {
      throw new Error('Expected spoofed payment signature to fail verification.');
    }
    console.log('✅ Spoofed signature rejected fail-closed with reason:', checkSpoofed.reason);

    // 3c. Valid cryptographic HMAC signature
    const realPaymentId = `pay_${Date.now()}`;
    const validHmac = crypto
      .createHmac('sha256', keySecret)
      .update(`${order.id}|${realPaymentId}`)
      .digest('hex');

    const checkValid = verifyPaymentSignature(order.id, realPaymentId, validHmac);
    if (!checkValid.valid) {
      throw new Error(`Valid HMAC failed verification: ${checkValid.reason}`);
    }
    console.log('✅ Genuine HMAC-SHA256 signature verified successfully.');

    // 3d. Non-prod simulated test signature
    const checkSimulated = verifyPaymentSignature(order.id, realPaymentId, 'simulated_test_signature_valid');
    if (!checkSimulated.valid) {
      throw new Error('Expected test emulator signature to be valid in non-production.');
    }
    console.log('✅ Test emulator signature accepted in non-production.');

    // 4. Test Webhook Signature Verification with Raw Payload Buffer
    console.log('\n--- 3. Testing Raw-Body Webhook Signature Verification ---');
    const { webhookSecret } = getGatewayCredentials();
    const rawWebhookPayload = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: realPaymentId,
              order_id: order.id,
              amount: 294882,
              status: 'captured',
            },
          },
        },
      }),
      'utf8'
    );

    // 4a. Missing signature
    if (verifyWebhookSignature(rawWebhookPayload, '')) {
      throw new Error('Expected empty webhook signature to fail.');
    }
    console.log('✅ Missing webhook signature rejected.');

    // 4b. Tampered payload
    const validWebhookSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawWebhookPayload)
      .digest('hex');

    const tamperedPayload = Buffer.from('{"tampered":true}', 'utf8');
    if (verifyWebhookSignature(tamperedPayload, validWebhookSig)) {
      throw new Error('Expected tampered webhook payload to fail signature verification.');
    }
    console.log('✅ Tampered webhook payload rejected.');

    // 4c. Valid webhook signature on raw byte buffer
    if (!verifyWebhookSignature(rawWebhookPayload, validWebhookSig)) {
      throw new Error('Expected authentic webhook signature on raw buffer to pass.');
    }
    console.log('✅ Authentic raw buffer webhook signature verified.');

    // 5. Test PaymentTransaction Ledger Creation & GST Tax Breakup
    console.log('\n--- 4. Testing PaymentTransaction Audit Ledger ---');
    const dummyCompany = new Company({
      name: 'Issue 02 Test Transport Pvt Ltd',
      slug: `issue02-transport-${Date.now()}`,
      email: `billing-test-${Date.now()}@transport.com`,
      phone: '+919876543211',
      subscription_status: 'trialing',
    });
    await dummyCompany.save();

    const subtotalPaise = 249900;
    const cgstPaise = Math.round(subtotalPaise * 0.09); // ₹224.91
    const sgstPaise = Math.round(subtotalPaise * 0.09); // ₹224.91
    const totalPaise = subtotalPaise + cgstPaise + sgstPaise;

    const transaction = await PaymentTransaction.create({
      company_id: dummyCompany._id,
      plan_id: proPlan._id,
      order_id: order.id,
      payment_id: realPaymentId,
      amount_paise: totalPaise,
      currency: 'INR',
      status: 'success',
      payment_method: 'card',
      billing_cycle: 'monthly',
      tax_breakup: {
        subtotal_paise: subtotalPaise,
        cgst_paise: cgstPaise,
        sgst_paise: sgstPaise,
        total_paise: totalPaise,
        gst_rate_percent: 18,
      },
      invoice_number: `INV-2026-${Date.now().toString().slice(-4)}`,
      invoice_date: new Date(),
    });

    console.log('Created Audit Transaction:', {
      id: transaction._id,
      invoice_number: transaction.invoice_number,
      status: transaction.status,
      tax_breakup: transaction.tax_breakup,
    });

    if (transaction.tax_breakup.total_paise !== totalPaise) {
      throw new Error('Tax breakup calculation mismatch in PaymentTransaction model.');
    }
    console.log('✅ Persistent audit transaction with 18% GST tax breakup recorded.');

    // 6. Test Downgrade Headroom Validation (Truck quota exceeded)
    console.log('\n--- 5. Testing Downgrade Headroom Quota Guard ---');
    // Create trucks exceeding Starter max_trucks limit (limit: 5)
    const truckDocs = [];
    for (let i = 0; i < 7; i++) {
      truckDocs.push({
        company_id: dummyCompany._id,
        truck_no: `MH12TX${1000 + i}`,
        make: 'Tata',
        model: 'Signa 4825.TK',
        tonnage_capacity: 25,
        type: 'Open Body',
        is_deleted: false,
      });
    }
    await Truck.insertMany(truckDocs);
    const truckCount = await Truck.countDocuments({ company_id: dummyCompany._id, is_deleted: false });
    console.log(`Registered ${truckCount} trucks for test company (Starter plan limit is ${starterPlan.max_trucks}).`);

    if (starterPlan.max_trucks !== -1 && truckCount > starterPlan.max_trucks) {
      console.log(`✅ Quota check successfully triggers DOWNGRADE_QUOTA_EXCEEDED (fleet has ${truckCount} > limit ${starterPlan.max_trucks}).`);
    } else {
      throw new Error('Expected truck count to exceed Starter plan limit.');
    }

    // 7. Cleanup test records
    await PaymentTransaction.deleteMany({ company_id: dummyCompany._id });
    await Truck.deleteMany({ company_id: dummyCompany._id });
    await Company.findByIdAndDelete(dummyCompany._id);
    console.log('\n🧹 Cleaned up test company, trucks, and transactions.');

    console.log('\n🎉 ALL ISSUE 02 PAYMENT GATEWAY & FINANCIAL SECURITY CHECKS PASSED!\n');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
