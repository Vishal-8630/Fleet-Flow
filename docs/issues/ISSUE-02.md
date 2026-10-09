# Issue 02 — Complete and Secure Real Subscription Payments

## Metadata
- **Severity**: P0 (Critical)
- **Status**: Documented & Ready for Implementation
- **Category**: Commercial Billing, Payment Gateway Security, Financial Integrity
- **Date**: October 10, 2026

---

## 1. Problem Statement
The SaaS billing and payment architecture currently contains critical security and functional vulnerabilities that prevent safe production operation:
1. **Simulated Orders in Checkout**: `initializeCheckout` generates mock order IDs (`order_${Date.now()}_${random}`) on the server instead of interacting with the payment provider (Razorpay Orders API) to create an authenticated, tamper-proof payment order with verified server-side amounts.
2. **Insecure Signature Verification**: In `verifyPayment`, HMAC signature verification is bypassed if `RAZORPAY_KEY_SECRET` or signature fields are absent. The system fails open instead of failing closed, allowing arbitrary payment spoofing.
3. **Free Immediate Upgrades via `changePlan`**: The `POST /api/billing/change-plan` endpoint immediately upgrades a company's tier and marks their subscription `active` without verifying or executing a payment transaction.
4. **Fragile Webhook Signature Verification**: Webhooks verify signatures against `JSON.stringify(req.body)` instead of the provider's exact raw request payload buffer. Any JSON key re-ordering causes signature verification to fail or falsely pass.
5. **Missing Payment History & Invoices**: There is no audit ledger recording transaction attempts, Razorpay payment IDs, invoices, receipts, and refund events.
6. **Unsafe Plan Downgrades**: Downgrades do not validate if the tenant's current resource usage (trucks, drivers, team members) exceeds the lower tier's quota limits.

---

## 2. Root Cause Analysis (RCA)
- **Stubbed Gateway Integration**: The checkout flow was prototyped with client-side simulation stubs rather than a true SDK instance of `razorpay` (`new Razorpay({ key_id, key_secret })`).
- **Permissive Fallback Logic**: Security guards in `verifyPayment` used `if (secret && signature)` conditions without an `else { throw 401 }` fail-closed branch.
- **Missing State Machine for Plan Changes**: Plan changes were implemented as direct document updates rather than an atomic two-phase process:
  1. Proration / preview quote calculation.
  2. Payment order creation & authorization.
  3. Fulfillment upon verified signature or webhook.

---

## 3. Implementation Solution & Target Architecture

### A. Real Provider Integration (`Razorpay` SDK)
- Configure an official Razorpay client wrapper in `backend/src/utils/paymentGateway.ts`:
  - Dynamically reads credentials from environment variables or `PlatformSetting`.
  - In `initializeCheckout`:
    - Validates target plan and calculated amount in integer paise on the server.
    - Applies validated promo codes against database constraints (`PromoCode.ts`).
    - Calls `razorpay.orders.create({ amount: finalPayablePaise, currency: 'INR', receipt: 'rcpt_...', notes: { company_id, plan_id, billing_cycle } })`.
    - Returns real Razorpay `order_id` and public `key_id`.

### B. Fail-Closed Signature Verification
- In `verifyPayment`:
  - `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` are **strictly required**.
  - If `RAZORPAY_KEY_SECRET` is missing, the endpoint throws HTTP 500 (`Payment gateway misconfigured`).
  - Verifies HMAC SHA-256 signature against `${razorpay_order_id}|${razorpay_payment_id}`.
  - If signatures mismatch, rejects immediately with HTTP 400 (`Invalid payment signature. Verification failed.`).

### C. Raw Request Body for Webhooks
- In `backend/src/server.ts`:
  - Configure `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } })` or a dedicated raw route for `/api/billing/webhooks/billing`.
  - In `handleBillingWebhook`:
    - Verifies `x-razorpay-signature` against `req.rawBody` using `crypto.createHmac('sha256', webhookSecret)`.
    - If signature does not match, rejects with HTTP 400.
    - Idempotency maintained via `ProcessedWebhook` model.

### D. Webhook Lifecycle Events & Dunning
Support standard Razorpay webhook events:
- `payment.captured` & `subscription.charged`: Sets subscription status to `active`, records payment history, resets dunning attempts, extends `current_period_end`.
- `payment.failed`: Records failed payment, starts 7-day grace period, sends notification, marks status `past_due`.
- `subscription.cancelled` & `subscription.halted`: Transitions status to `suspended` (read-only mode).
- `refund.processed`: Records refund event in payment history.

### E. Payment History & Invoicing Ledger
- Create a `PaymentTransaction` schema:
  - `company_id`, `subscription_id`, `order_id`, `payment_id`, `amount_paise`, `currency`, `status` (`success`, `failed`, `refunded`), `method` (`card`, `upi`, `netbanking`), `invoice_url`, `created_at`.
- Provide a `GET /api/billing/history` endpoint to allow tenant admins to view and download past billing receipts.

### F. Transaction-Safe Upgrades & Downgrade Headroom Validation
- **Upgrades**: Calling `change-plan` creates a checkout order for the prorated differential amount. Plan is only switched upon successful payment verification.
- **Downgrades**:
  - When a customer requests a downgrade (e.g. Pro → Starter), evaluate current usage:
    - Active trucks count vs target plan `max_trucks`.
    - Active drivers count vs target plan `max_drivers`.
    - Active users count vs target plan `max_users`.
  - If current usage exceeds target quotas, reject downgrade with HTTP 422:
    ```json
    {
      "code": "DOWNGRADE_QUOTA_EXCEEDED",
      "error": "Cannot schedule downgrade to Starter Plan. You currently have 12 trucks, but Starter Plan limit is 5 trucks. Please decommission excess trucks before downgrading."
    }
    ```
  - If quotas fit, schedule downgrade for execution at the end of the current billing cycle (`subscription.scheduled_change`).

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/utils/paymentGateway.ts` | Razorpay SDK initialization, order creation, and signature validation |
| `backend/src/models/PaymentTransaction.ts` | Schema for recording all payment transactions and receipts |
| `backend/src/controllers/billingController.ts` | Complete real checkout, fail-closed signature check, downgrade headroom check |
| `backend/src/server.ts` | Add raw body buffer retention for webhook signature validation |
| `backend/src/scripts/verifyPaymentSecurity.ts` | End-to-end security test script verifying signature rejections and checkout order creation |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Upgrading Subscription via In-App Checkout Modal
1. **Navigate to Billing Page**:
   - Open your browser and log in as a Tenant Admin at `http://localhost:5173/login`.
   - In the sidebar navigation, click **Settings** -> **Billing & Plans** (`/settings/billing`).
2. **Select an Upgrade Plan**:
   - On the pricing tier comparison cards, locate the **Professional Enterprise** card.
   - Click the blue **"Upgrade to Pro"** button.
3. **Complete Checkout in the Payment Modal**:
   - The Razorpay checkout dialog will pop up displaying the order breakdown (₹2,499/month + 18% GST).
   - In test mode, choose **Netbanking** (select any test bank like *HDFC Bank*) or **UPI / Test Card**.
   - Click the green **"Pay Now"** button. Select **"Success"** when prompted by the test payment emulator.
4. **What You Should See on the Screen**:
   - The payment dialog closes automatically.
   - A green success toast notification appears:  
     > ✅ *"Payment verified successfully! Your workspace has been upgraded to Professional Plan."*
   - The page re-renders: the "Current Plan" badge changes from `Starter` to `Professional`, and the new renewal expiry date displays 30 days into the future.
   - Any previously locked features (such as Bulk Invoicing) now show unlocked status.

---

### Test 2: Handling Payment Cancellation or Failure Gracefully
1. **Trigger Payment and Cancel**:
   - From `/settings/billing`, click the **"Upgrade Plan"** button on another plan tier.
   - When the Razorpay payment window opens, click the **"X" (Close)** icon in the top-right corner of the modal.
2. **What You Should See on the Screen**:
   - The modal closes without crashing or hanging the page.
   - An informative amber toast appears:  
     > ⚠️ *"Payment window closed. Your plan has not been changed."*
   - Verify that your subscription status, features, and wallet balance remain strictly unaffected.

---

### Test 3: Testing Downgrade Headroom Quota Block in the UI
1. **Pre-condition**:
   - Make sure your fleet currently has 10 registered trucks under **Fleet & Trucks** (`/fleet/trucks`).
2. **Attempt to Downgrade to Starter Tier (Limit: 5 Trucks)**:
   - Navigate to `/settings/billing`.
   - Under the **Starter Plan** card, click **"Downgrade to Starter"**.
3. **What You Should See on the Screen**:
   - A modal dialog appears with a warning badge:
     > ⚠️ **Cannot Downgrade Plan (Quota Exceeded)**  
     > *You currently have 10 registered trucks in your fleet, but the Starter Plan has a maximum limit of 5 trucks.*  
     > *To switch to this plan, please deactivate or delete 5 trucks first in Fleet Management.*
   - The "Confirm Downgrade" button is disabled or blocked, protecting your existing operational records from orphan status.

---

### Test 4: Viewing Payment History & Downloading GST Invoice PDF
1. **Inspect Invoice History Table**:
   - On `/settings/billing`, scroll down to the **"Billing History & Invoices"** table.
2. **What You Should See on the Screen**:
   - A new row appears corresponding to the transaction completed in Test 1.
   - The table displays: Date, Invoice Number (e.g. `INV-2026-0012`), Amount (`₹2,948.82 incl. GST`), and Status badge (`PAID` in green).
3. **Download Invoice**:
   - Click the **"Download Invoice (PDF)"** icon button in the action column.
   - A PDF file downloads to your browser. Open it and verify that it contains:
     - Company Name and GSTIN.
     - HSN/SAC Code `998313` (SaaS / Cloud Software Services).
     - Proper 9% CGST + 9% SGST tax breakup.

