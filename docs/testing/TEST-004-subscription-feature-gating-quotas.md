# TEST-004: Subscription Feature Gating, Quota Limits & Webhook Verification

**Test Specification ID:** `TEST-004`  
**Title:** Subscription Tier Feature Gating, Resource Quota Enforcement & Payment Webhook Suite  
**Scope:** SaaS Monetization, Razorpay Signature Verification & Quota Enforcement  
**Priority:** `P1` (High Commercial Gate)  
**Target Coverage:** Complete Subscription Tier Lifecycle  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#6-testing--quality-assurance-register-test-)

---

## 1. Rationale & Problem Statement
SaaS monetization depends on accurate feature gating (preventing unauthorized access to higher-tier features), resource quota enforcement (e.g. max 5 trucks on Starter plan), and bulletproof payment verification (preventing unpaid account upgrades).

---

## 2. Test Matrix to Implement
1. **Quota Enforcement Tests:**
   - Seed a Starter tenant with quota `max_trucks: 5`.
   - Create 5 trucks successfully.
   - Attempt to create 6th truck -> assert HTTP 403 Forbidden (`Resource quota exceeded: Upgrade plan to add more trucks`).
2. **Feature Flag Gating Tests:**
   - Attempt to access an Enterprise-only route (e.g. `MOD_TELEMATICS_API`) as a Starter subscriber -> assert HTTP 403 Forbidden.
   - Upgrade tenant to Enterprise -> assert HTTP 200 Success on the same endpoint.
3. **Cryptographic Payment Verification Tests:**
   - Submit Razorpay checkout verification with a valid HMAC-SHA256 signature -> assert subscription activated.
   - Submit Razorpay checkout verification with a tampered signature -> assert HTTP 400 Bad Request, subscription NOT activated.
   - In production environment, verify that missing API keys reject payments rather than activating dummy subscriptions.

---

## 3. Acceptance Criteria
- [ ] Quota boundaries are strictly enforced without race conditions.
- [ ] Tampered payment signatures are rejected 100% of the time.
- [ ] Subscriptions transition cleanly between `'trial'`, `'active'`, `'past_due'`, and `'cancelled'`.

---

## 4. Definition of Done
1. Subscription test suite committed and passing in CI.
