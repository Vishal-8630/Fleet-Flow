# Issue 03 — Harden Authentication and Account Recovery

## Metadata
- **Severity**: P0 (Critical)
- **Status**: Documented & Ready for Implementation
- **Category**: Security, Authentication, Account Recovery & System Hardening
- **Date**: October 10, 2026

---

## 1. Problem Statement
The application's identity and authentication architecture currently lacks critical industry-standard security features and recovery mechanisms:
1. **Missing Password Reset Flows**: There are no endpoints or workflows for `POST /api/auth/forgot-password` or `POST /api/auth/reset-password`. Users who forget their passwords have no self-service recovery mechanism.
2. **No Real Email Delivery**: Team invitations (`/api/auth/invitations`) and onboarding currently generate invitation links without sending actual transactional emails. In production, users cannot receive invitation links or recovery tokens.
3. **Absence of Rate Limiting**: Sensitive authentication endpoints (`/login`, `/register-company`, `/invitations`, password reset) lack brute-force and DDoS rate limiters, leaving the platform vulnerable to credential stuffing and automated abuse.
4. **No Password Change or Session Revocation**: Authenticated users have no `POST /api/auth/change-password` endpoint. Furthermore, if a user changes their password or an employee is terminated, there is no session token invalidation strategy (e.g. `token_version` on `User` schema).
5. **Permissive Fallback JWT Secret in Production**: `getJwtSecret()` falls back to `'dev_secret_fallback_key'`. In production, this allows attackers to forge valid tokens if `JWT_SECRET` is omitted.
6. **Non-Transactional Company Registration**: `registerCompany` performs consecutive writes (`User.create`, `Company.create`, `CompanyMember.create`, `Subscription.create`) without a MongoDB multi-document transaction (`mongoose.startSession()`). A failure midway leaves orphaned users or orphaned companies without memberships.

---

## 2. Root Cause Analysis (RCA)
- **Phase 1 Prototyping Defaults**: Early development focused on core happy-path login and tenant isolation, deferring email transport, rate limiting, and password reset flows.
- **In-Memory / Console Logging Instead of SMTP/Resend**: Invitations printed invite tokens directly to console or response payloads.
- **Absence of Environment Strictness Guard**: Environment loading lacked a strict runtime assertion enforcing `JWT_SECRET` presence before server boot in production mode.

---

## 3. Implementation Solution & Target Architecture

### A. Password Reset & Account Recovery Flow
- **Model Enhancements (`User.ts`)**:
  - `reset_password_token`: SHA-256 hash of random token.
  - `reset_password_expires`: Timestamp (strictly 15-minute validity).
  - `token_version`: Integer incremented upon password change or logout-all to invalidate existing JWTs.
- **Endpoints**:
  - `POST /api/auth/forgot-password`: Generates cryptographically secure token (`crypto.randomBytes(32)`), stores hash, and dispatches reset email. Returns standard 200 message regardless of whether email exists (prevents account enumeration).
  - `POST /api/auth/reset-password`: Validates token hash, checks expiration, hashes new password via bcrypt, invalidates token, and increments `token_version`.
  - `POST /api/auth/change-password` (Authenticated): Validates old password, applies new password, revokes existing sessions.

### B. Transactional Email Delivery Service
- Build `backend/src/utils/emailService.ts`:
  - Supports configurable SMTP (Nodemailer) or transactional providers (Resend / SendGrid / AWS SES).
  - Provides fallback console logger in development with clickable links.
  - Generates HTML templates for:
    - **Team Workspace Invitation**: Sender company name, inviter name, role, acceptance link.
    - **Password Reset**: Single-use 15-minute link with security advisory.
    - **Security Alert**: Account password changed notification.

### C. Tiered Rate Limiting (`securityMiddleware.ts`)
- Use `express-rate-limit`:
  - `authLimiter`: Max 5 login attempts per 15 minutes per IP.
  - `registerLimiter`: Max 3 company registrations per hour per IP.
  - `passwordResetLimiter`: Max 3 password reset requests per hour per email/IP.
  - `invitationLimiter`: Max 10 invites per minute per company.

### D. Production Environment Guard & Strict JWT Enforcement
- In `backend/src/server.ts` boot sequence:
  - Assert required production variables: `JWT_SECRET`, `MONGODB_URI`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
  - Fail fast with process exit if `NODE_ENV === 'production'` and `JWT_SECRET` is missing or uses the default fallback key.

### E. Transactional Company Registration
- Refactor `registerCompany` in `authController.ts`:
  - Wrap workspace creation in a MongoDB transaction:
    ```ts
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. Create User
      // 2. Create Company
      // 3. Create CompanyMember (admin role)
      // 4. Create Trial Subscription
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    ```

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/models/User.ts` | Add `reset_password_token`, `reset_password_expires`, `token_version` |
| `backend/src/utils/emailService.ts` | Transactional email sender with templates for invites and password resets |
| `backend/src/middleware/securityMiddleware.ts` | Rate limiters for auth, password resets, and registrations |
| `backend/src/controllers/authController.ts` | Add `forgotPassword`, `resetPassword`, `changePassword`, and transactional registration |
| `backend/src/routes/authRoutes.ts` | Mount password reset endpoints and apply rate limiters |
| `backend/src/server.ts` | Add strict startup environment verification guard |
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | UI page for requesting password reset link |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | UI page for submitting new password with reset token |
| `frontend/src/App.tsx` | Register `/forgot-password` and `/reset-password` routes |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Requesting a Password Reset from the Login Screen
1. **Navigate to Login**:
   - Open your browser at `http://localhost:5173/login`.
   - Below the password input field, click the **"Forgot Password?"** link.
2. **Submit Reset Request**:
   - The browser navigates to `/forgot-password`.
   - Enter your registered email address (e.g. `rohit@patellogistics.com`).
   - Click the **"Send Recovery Link"** button.
3. **What You Should See on the Screen**:
   - The button shows a brief loading spinner.
   - A green confirmation box appears:  
     > ✉️ *"If an active workspace account exists with this email address, a password recovery link has been dispatched. Please check your inbox or spam folder."*
   - A convenient button **"Back to Sign In"** allows returning to the login form.

---

### Test 2: Submitting a New Password via Reset Page
1. **Open the Reset URL**:
   - Open the reset link in your browser: `http://localhost:5173/reset-password?token=sample_valid_token_123`.
2. **Type New Password & Verify Strength Meter**:
   - In the **"New Password"** field, type `StrongP@ss2026!`.
   - Observe the interactive password strength meter turn green:  
     > 🟢 *"Strong: Contains 8+ characters, uppercase, lowercase, numbers, and symbols."*
   - Re-type the identical password in the **"Confirm New Password"** field.
   - Click the **"Set New Password"** button.
3. **What You Should See on the Screen**:
   - A success notification appears:  
     > ✅ *"Your password has been successfully reset! Redirecting to login..."*
   - The browser automatically navigates to `/login` after 2 seconds.
   - Enter your email and the **old password**: verify a red error appears: *"Invalid email or password"*.
   - Enter your email and the **new password**: verify you are logged in and redirected to the main dashboard.

---

### Test 3: Testing Login Rate Limiting (Brute-Force Lockout)
1. **Trigger Failed Logins**:
   - On `http://localhost:5173/login`, enter your email and an intentionally incorrect password (e.g. `wrongpass1`).
   - Click **"Sign In"** 6 times in rapid succession.
2. **What You Should See on the Screen**:
   - For the first 5 attempts, you see: *"Invalid email or password"*.
   - On the 6th attempt, a red warning alert banner appears:  
     > 🛑 *"Too many failed login attempts. For security reasons, please wait 15 minutes before trying again or use Forgot Password."*
   - The "Sign In" button is temporarily disabled to prevent automated brute-force attacks.

---

### Test 4: In-App Password Change & Other Session Logout
1. **Change Password from Profile**:
   - Log in to your account and click your user profile avatar in the top-right navbar.
   - Select **"Profile & Security"** (`/settings/profile`).
   - Under the "Security & Password" section, enter:
     - Current Password
     - New Password
     - Confirm New Password
   - Click **"Save Changes"**.
2. **Verify Global Session Invalidation**:
   - A green toast notification confirms: *"Password updated successfully. Other active device sessions have been revoked."*
   - Open another browser window or incognito tab where this user was previously logged in.
   - Refresh that page or click any menu item.
   - **What you should see**: You are immediately logged out and redirected to `/login` with the message: *"Session expired due to security updates. Please log in again."*

