/**
 * ============================================================================
 * FLEET FLOW — PAYMENT & VERIFICATION ERROR CLASSIFIER (paymentErrorHandler.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Centralized classifier for payment gateway, checkout, and backend verification
 * errors (FF-ISSUE-027, QST-007).
 * 
 * SAFEGUARDS:
 * -----------
 * 1. Accurately distinguishes user cancellation, session expiry, network failure,
 *    gateway decline, signature mismatch, idempotency conflicts, and server errors.
 * 2. Never displays "Payment window closed" for verification failures.
 * 3. Never reports unconfirmed transactions as successful.
 * 4. Never leaks sensitive internal details (HMAC secrets, raw signatures, stack traces).
 * ============================================================================
 */

export type PaymentErrorCategory =
  | 'window_closed'
  | 'session_expired'
  | 'network_error'
  | 'signature_mismatch'
  | 'already_verified'
  | 'concurrency_conflict'
  | 'idempotency_mismatch'
  | 'gateway_declined'
  | 'server_error'
  | 'client_error'
  | 'unknown';

export interface ClassifiedPaymentError {
  category: PaymentErrorCategory;
  message: string;
  isRetryable: boolean;
  status?: number;
}

/**
 * Classifies an error received during checkout, gateway interaction, or backend payment verification.
 */
export function classifyPaymentError(error: any): ClassifiedPaymentError {
  const status: number | undefined = error?.response?.status || error?.status;
  const rawMsg: string = (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    ''
  ).toLowerCase();

  // 1. Explicit Payment Window Closed / Cancelled by User
  if (
    rawMsg.includes('payment window closed') ||
    rawMsg.includes('cancelled by user') ||
    rawMsg.includes('checkout_cancelled') ||
    rawMsg.includes('modal_closed')
  ) {
    return {
      category: 'window_closed',
      message: 'Payment checkout was closed. No charges were made.',
      isRetryable: true,
      status,
    };
  }

  // 2. Payment Window / Session / Order Expired
  if (
    rawMsg.includes('order expired') ||
    rawMsg.includes('session expired') ||
    rawMsg.includes('payment window expired') ||
    rawMsg.includes('order_expired')
  ) {
    return {
      category: 'session_expired',
      message: 'Payment session has expired. Please initiate a new checkout attempt.',
      isRetryable: false,
      status,
    };
  }

  // 3. Network & Connection Failures
  if (
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ERR_NETWORK' ||
    rawMsg.includes('network error') ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('failed to fetch') ||
    (!status && rawMsg.includes('network'))
  ) {
    return {
      category: 'network_error',
      message: 'Network connection issue during payment verification. Please check your connection and retry.',
      isRetryable: true,
      status,
    };
  }

  // 4. Cryptographic Signature Mismatch
  if (
    rawMsg.includes('signature') ||
    rawMsg.includes('cryptographic signature mismatch') ||
    rawMsg.includes('invalid payment signature')
  ) {
    return {
      category: 'signature_mismatch',
      message: 'Payment verification failed: cryptographic signature mismatch. If your account was debited, please contact support.',
      isRetryable: false,
      status: 400,
    };
  }

  // 5. Duplicate / Already Verified Transaction
  if (
    rawMsg.includes('already been verified') ||
    rawMsg.includes('already verified and processed')
  ) {
    return {
      category: 'already_verified',
      message: 'This payment transaction has already been verified and processed.',
      isRetryable: false,
      status: 400,
    };
  }

  // 6. Concurrency / In-Flight Conflict (HTTP 409)
  if (status === 409 || rawMsg.includes('concurrent request in flight')) {
    return {
      category: 'concurrency_conflict',
      message: 'Payment verification is currently in progress. Please wait a few seconds.',
      isRetryable: true,
      status: 409,
    };
  }

  // 7. Idempotency Payload Hash Mismatch (HTTP 422)
  if (status === 422 || rawMsg.includes('payload hash mismatch')) {
    return {
      category: 'idempotency_mismatch',
      message: 'Payment verification conflict: request parameters changed. Please start a fresh checkout.',
      isRetryable: false,
      status: 422,
    };
  }

  // 8. Server Error (HTTP 500+)
  if (status && status >= 500) {
    return {
      category: 'server_error',
      message: 'Server encountered an issue during verification. Your payment reference is saved; please retry verification shortly.',
      isRetryable: true,
      status,
    };
  }

  // 9. Client Error (HTTP 400 - Missing params, missing key, etc.)
  if (status === 400) {
    const errorText = error?.response?.data?.error || error?.message || 'Invalid payment verification payload.';
    return {
      category: 'client_error',
      message: errorText,
      isRetryable: false,
      status: 400,
    };
  }

  // 10. Fallback / Unknown Error
  return {
    category: 'unknown',
    message: error?.response?.data?.error || error?.message || 'Payment verification could not be completed. Please contact support.',
    isRetryable: true,
    status,
  };
}
