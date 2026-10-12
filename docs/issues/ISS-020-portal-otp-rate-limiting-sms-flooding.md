# ISS-020: Unthrottled Portal OTP Endpoints Vulnerable to SMS Flooding & Toll Fraud

**Specification ID:** `ISS-020`  
**Title:** Unthrottled Portal OTP Endpoints Vulnerable to SMS Flooding and Toll Fraud  
**Type:** Security / Abuse Vulnerability  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Security Risk  
**Date:** October 2026  
**Related Documents:** [`ISS-006`](./ISS-006-stakeholder-portals-auth-breakdown.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`backend/src/routes/portalRoutes.ts:22-24`](../../backend/src/routes/portalRoutes.ts#L22-L24), the OTP generation route (`POST /api/portal/send-otp`) and verification route (`POST /api/portal/verify-otp`) are mounted completely unauthenticated and without any rate limiting middleware. An attacker can dispatch automated scripts requesting thousands of SMS OTPs per minute, exhausting company SMS gateway account credits (SMS Toll Fraud / Telephony Denial of Service) and harassing mobile recipients. Furthermore, `verify-otp` has no IP-level throttling, allowing distributed brute-force attacks against the 6-digit OTP space.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In `portalRoutes.ts`:
  ```typescript
  // Public OTP auth endpoints (no authentication and NO rate limiter!)
  router.post('/send-otp', sendPortalOtp);
  router.post('/verify-otp', verifyPortalOtp);
  ```
- **Vulnerability Mechanism:**
  1. An attacker sends 1,000 requests in 10 seconds to `POST /api/portal/send-otp` targeting target phone numbers.
  2. The server processes all 1,000 requests, invoking the downstream SMS/WhatsApp gateway for each request.
  3. The enterprise incurs immediate financial loss from SMS telephony fees, and phone numbers are spammed.
  4. While `PortalSession` limits attempts to 5 per session, an attacker can trigger infinite new sessions because `findOneAndUpdate` with `{ upsert: true }` resets attempts on each new OTP dispatch.

---

## 3. Reproduction Steps
1. Run a loop sending 50 rapid POST requests to `/api/portal/send-otp` for a single mobile number within 5 seconds.
2. Observe: All 50 requests succeed with HTTP 200 OK. The server triggers 50 OTP generation events without restriction.

---

## 4. Expected Behavior
1. **Cooldown Window:** Enforce a strict 60-second cooldown per phone number before allowing a resend.
2. **Per-IP Rate Limiting:** Enforce maximum 5 OTP dispatch requests per IP address per 15 minutes using `express-rate-limit`.
3. **Daily Cap:** Enforce a maximum of 5 OTP dispatches per phone number per 24 hours.
4. **Verification Throttling:** Throttle `verify-otp` to maximum 5 attempts per IP per minute.

---

## 5. Proposed Technical Solution
Implement dedicated rate limiters in `backend/src/middleware/rateLimiter.ts`:
```typescript
import rateLimit from 'express-rate-limit';

export const portalOtpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per IP
  message: { error: 'Too many OTP requests from this network. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const portalOtpVerifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many OTP verification attempts. Please wait 1 minute.' },
});
```
Mount limiters on `portalRoutes.ts`:
```typescript
router.post('/send-otp', portalOtpSendLimiter, sendPortalOtp);
router.post('/verify-otp', portalOtpVerifyLimiter, verifyPortalOtp);
```
In `portalController.ts`, check `last_otp_sent_at` and reject requests within 60 seconds with HTTP 429 (`Please wait 60 seconds before requesting another OTP`).

---

## 6. Acceptance Criteria
- [ ] Attempting to request a second OTP within 60 seconds returns HTTP 429.
- [ ] More than 5 OTP requests from the same IP within 15 minutes are blocked with HTTP 429.
- [ ] Failed OTP attempts lock the session for 15 minutes.

---

## 7. Definition of Done
1. Rate limiters and cooldown logic implemented and verified via automated test in [`TEST-002`](../testing/TEST-002-cross-tenant-isolation-suite.md).
