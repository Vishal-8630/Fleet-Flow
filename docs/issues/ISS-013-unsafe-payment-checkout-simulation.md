# ISS-013: Unsafe Payment Checkout Simulation Mode in Production

**Specification ID:** `ISS-013`  
**Title:** Unsafe Payment Checkout Simulation Mode in Production  
**Type:** Security / Billing Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Security Risk  
**Date:** October 2026  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`backend/src/controllers/billingController.ts:110-145`](../../backend/src/controllers/billingController.ts#L110-L145), the subscription checkout flow contains an automated sandbox fallback when Razorpay API credentials are missing or set to dummy values. In this fallback mode, sending arbitrary mock tokens causes the backend to immediately activate paid subscription tiers, extend validity by 30 days, and grant elevated resource quotas without verifying digital signatures. The code lacks an environment guard (`process.env.NODE_ENV !== 'production'`), allowing tenants to self-activate premium enterprise subscriptions for free if production API keys fail to load.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In `billingController.ts:110-145`:
  ```typescript
  export const verifyPayment = async (req: Request, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Fallback simulation when Razorpay keys are not configured or test mode
    if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'test_secret') {
      // Bypasses crypto HMAC-SHA256 signature check!
      await activateSubscription(company_id, plan_id);
      return res.json({ success: true, message: 'Simulated payment verified' });
    }
  ```
- **Security Vulnerability:** If the production deployment is started with an unconfigured or misspelled `.env` variable (e.g. `RAZORPAY_SECRET` instead of `RAZORPAY_KEY_SECRET`), the server silently defaults to simulation mode. Any tenant sending mock payloads can upgrade to the highest Enterprise tier without paying.

---

## 3. Reproduction Steps
1. Start backend with `RAZORPAY_KEY_SECRET=test_secret` or empty string.
2. Send `POST /api/billing/verify` with `{ razorpay_order_id: 'mock_1', razorpay_signature: 'dummy' }`.
3. Check company subscription: The tenant is upgraded to Pro Tier with 60 trucks and validity extended by 30 days.

---

## 4. Expected Behavior
1. In `production` environment (`NODE_ENV === 'production'`), payment simulation must be **strictly prohibited**. Missing Razorpay credentials must cause the server startup to fail or reject payment verification with HTTP 500 Configuration Error.
2. In development/staging, simulation must require an explicit developer flag `ENABLE_PAYMENT_SIMULATION=true`.
3. All production payments must enforce cryptographic verification:
   ```typescript
   const expectedSignature = crypto
     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
     .update(`${razorpay_order_id}|${razorpay_payment_id}`)
     .digest('hex');
   if (expectedSignature !== razorpay_signature) throw new ApiError(400, 'Invalid payment signature');
   ```

---

## 5. Acceptance Criteria
- [ ] In production, any attempt to verify payments with missing or invalid Razorpay credentials throws an unhandled error and never activates a subscription.
- [ ] Forged or invalid HMAC signatures are rejected with HTTP 400.
- [ ] Subscription activation is only triggered upon successful HMAC signature validation or verified Razorpay webhook payload.

---

## 6. Definition of Done
1. `billingController.ts` patched with strict environment and signature checks.
2. Verified in [`TEST-004`](../testing/TEST-004-subscription-feature-gating-quotas.md).
