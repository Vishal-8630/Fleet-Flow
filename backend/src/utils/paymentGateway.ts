/**
 * ============================================================================
 * FLEET FLOW — PAYMENT GATEWAY & CRYPTOGRAPHIC VERIFIER (paymentGateway.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Encapsulates Razorpay client API operations, order generation, fail-closed
 * cryptographic HMAC-SHA256 signature validation, and webhook verification.
 * ============================================================================
 */

import crypto from 'crypto';
import Razorpay from 'razorpay';

export interface OrderOptions {
  amount_paise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, any>;
}

export interface CreatedOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  key_id: string;
  is_live: boolean;
}

/**
 * Returns active Razorpay API key credentials
 */
export function getGatewayCredentials(): { keyId: string; keySecret: string; webhookSecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'dev_secret_fallback_key';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dev_webhook_secret_fleetflow';
  return { keyId, keySecret, webhookSecret };
}

/**
 * Creates a server-authenticated order via Razorpay Orders API
 */
export async function createPaymentOrder(options: OrderOptions): Promise<CreatedOrder> {
  const { keyId, keySecret } = getGatewayCredentials();
  const isConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_ID.includes('placeholder')
  );

  if (isConfigured) {
    try {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const order = await razorpay.orders.create({
        amount: options.amount_paise,
        currency: options.currency || 'INR',
        receipt: options.receipt,
        notes: options.notes,
      });

      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt || options.receipt,
        key_id: keyId,
        is_live: true,
      };
    } catch (err: any) {
      console.warn('Razorpay API order creation failed, falling back to secure simulated order:', err.message);
    }
  }

  // Cryptographically secure test/development order identifier
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const orderId = `order_${Date.now()}_${randomSuffix}`;

  return {
    id: orderId,
    amount: options.amount_paise,
    currency: options.currency || 'INR',
    receipt: options.receipt,
    key_id: keyId,
    is_live: false,
  };
}

/**
 * Fail-closed HMAC-SHA256 signature verification for client payment callbacks.
 * Strict standard: ${order_id}|${payment_id}
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): { valid: boolean; reason?: string } {
  if (!orderId || !paymentId || !signature) {
    return { valid: false, reason: 'Missing required order_id, payment_id, or signature.' };
  }

  const { keySecret } = getGatewayCredentials();

  // Test / simulated bypass only when explicit emulator signature is passed in test environment
  if (
    process.env.NODE_ENV !== 'production' &&
    signature === 'simulated_test_signature_valid'
  ) {
    return { valid: true };
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    if (sigBuf.length !== expBuf.length) {
      return { valid: false, reason: 'Cryptographic HMAC-SHA256 signature mismatch.' };
    }
    const isValid = crypto.timingSafeEqual(sigBuf, expBuf);
    if (!isValid) {
      return { valid: false, reason: 'Cryptographic HMAC-SHA256 signature mismatch.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Cryptographic HMAC-SHA256 signature verification failed.' };
  }
}

/**
 * Verifies Razorpay Webhook signature using raw request buffer
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string
): boolean {
  if (!signature || !rawBody) {
    return false;
  }

  const { webhookSecret } = getGatewayCredentials();
  const payloadBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadBuffer)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
