# Phase 1: Foundation, Multi-Tenancy & Design System

**Phase Objective:** Establish zero-data-leakage multi-tenant isolation, secure authentication, role-based access control (RBAC), and the generic CSS design system (zero Tailwind) upon which all subsequent modules will be built.

---

## 1. CSS Design System Architecture (Generic & Modular)

### 1.1 Directory Structure
```text
frontend/src/styles/
├── tokens/
│   ├── variables.css       /* Color schemes (Primary Blue, Dark Slate, Accents), Shadows, Radiuses */
│   ├── typography.css      /* Fonts (Inter/Outfit), sizes (xs to 3xl), line heights, weights */
│   └── elevation.css       /* Layers (z-index), box shadows, borders */
├── base/
│   ├── reset.css           /* Box-sizing: border-box reset, margin/padding resets */
│   └── base.css            /* Root body styles, headings, custom scrollbars, text selections */
├── layout/
│   ├── grid.css            /* 12-column responsive grid system (.grid-12, .col-span-4) */
│   ├── flex.css            /* Flexbox utilities (.flex-row, .items-center, .justify-between) */
│   └── container.css       /* .container, .page-wrapper, .page-header, .page-content */
├── components/             /* 100% Generic UI Elements */
│   ├── buttons.css         /* .btn, .btn-primary, .btn-secondary, .btn-danger, .btn-sm, .btn-icon */
│   ├── forms.css           /* .form-group, .form-label, .form-input, .form-select, .form-error */
│   ├── tables.css          /* .data-table, .table-header, .table-row, .table-cell, .table-empty */
│   ├── cards.css           /* .card, .card-header, .card-body, .card-footer, .card-glass */
│   ├── badges.css          /* .badge, .badge-success, .badge-warning, .badge-danger, .badge-neutral */
│   ├── modals.css          /* .modal-backdrop, .modal-dialog, .modal-header, .modal-body, .modal-footer */
│   └── pagination.css      /* .pagination, .page-btn, .page-info */
├── utilities/
│   ├── spacing.css         /* Generic margins/paddings (.m-0, .p-4, .gap-3) */
│   ├── text.css            /* .text-center, .text-truncate, .text-muted, .text-danger */
│   └── animations.css      /* .fade-in, .slide-up, .shimmer-skeleton, .pulse */
└── main.css                /* Master stylesheet importing all tokens and components */
```

### 1.2 Standards Enforced
- **Zero Tailwind CSS:** All styling uses pure standard CSS custom properties (`var(--color-primary-600)`).
- **Generic Class Reusability:** Every screen across all phases uses `.card`, `.btn`, `.form-input`, and `.data-table`.
- **CSS Modules:** Used only for complex bespoke canvases (e.g., printable LR slip).

---

## 2. Multi-Tenant Data Isolation Engine

### 2.1 Mongoose `tenantPlugin.ts`
* Automatically attaches `company_id: { type: ObjectId, ref: 'Company', required: true, index: true }` to schemas.
* Pre-query hooks intercept: `find`, `findOne`, `findOneAndUpdate`, `updateMany`, `countDocuments`.
* Enforces `this.where({ company_id: currentTenantId })` unless explicitly marked for super-admin global queries.
* Automatically creates compound index `{ company_id: 1, created_at: -1 }`.

### 2.2 AsyncLocalStorage Context
* Node.js `AsyncLocalStorage` stores `company_id` per asynchronous request lifecycle, ensuring query filters cannot leak between concurrent requests.

---

## 3. Data Models & Schemas

### 3.1 `Company` Schema (`backend/src/models/Company.ts`)
* Fields: `name`, `slug` (unique), `email`, `phone`, `gstin`, `address`, `settings` (currency, timezone, prefixes), `status` (`trialing` | `active` | `past_due` | `suspended`), `is_deleted`.

### 3.2 `User` Schema (`backend/src/models/User.ts`)
* Fields: `name`, `email` (unique, lowercase), `password_hash` (bcrypt), `phone`, `is_verified`, `is_platform_super_admin`, `avatar_url`.

### 3.3 `CompanyMember` Schema (`backend/src/models/CompanyMember.ts`)
* Fields: `company_id` (ref Company), `user_id` (ref User), `email`, `role` (`admin` | `dispatcher` | `accountant` | `viewer`), `status` (`invited` | `active` | `deactivated`), `invitation_token`, `token_expires_at`, `invited_by`.

---

## 4. Authentication, Sessions & RBAC

### 4.1 Endpoints
* `POST /api/auth/register-company` — Creates Company, User, CompanyMember (admin), sets 14-day trial, issues JWT.
* `POST /api/auth/login` — Verifies credentials, retrieves member role & active company, returns `HttpOnly` JWT cookie.
* `POST /api/auth/logout` — Clears cookies and revokes session.
* `GET /api/auth/me` — Returns authenticated user profile, active company workspace, and permissions.
* `POST /api/company/invitations` — Dispatches invitation email with secure token.
* `POST /api/company/invitations/accept` — Activates employee user account and attaches to company.

### 4.2 Middleware Pipeline
1. `requireAuth`: Verifies JWT cookie signature and expiration.
2. `resolveTenantContext`: Injects `req.tenant` (`id`, `role`, `status`, `allowedModules`).
3. `requireRole(allowedRoles)`: Enforces RBAC permissions (`admin`, `dispatcher`, `accountant`, `viewer`).
4. `requireActiveSubscription`: Restricts suspended or expired tenants to read-only `GET` endpoints.

---

## 5. Frontend Shell & Navigation Architecture

### 5.1 Zustand State Stores
* `authStore`: User profile, active company summary, token state, logout.
* `uiStore`: Sidebar collapse state, active modal state, toast notification queue.

### 5.2 Application Shell Components
* `Sidebar`: Responsive navigation with role-aware and tenant-aware links.
* `Navbar`: Company selector/badge, trial countdown pill, user profile menu, notification bell.
* `ProtectedRoute`: Evaluates authentication, session validity, and RBAC permissions; redirects unauthorized requests.

---

## 6. Phase 1 Verification & Acceptance Criteria
* [x] **Cross-Tenant Isolation Test:** Executed in `backend/src/scripts/verifyPhase1.ts` against live MongoDB Atlas. Verified Tenant A queries strictly return Tenant A data with 0% data leakage.
* [x] **Untrusted Client Parameter Defense:** Validated server relies strictly on verified JWT claims via `AsyncLocalStorage` context; spoofed parameters in requests are rejected.
* [x] **RBAC Restriction Test:** Implemented role checks across `admin`, `dispatcher`, `accountant`, `viewer` roles with forbidden access enforcement.
* [x] **CSS Token & Responsive Test:** Built 100% pure modular CSS design system across desktop, tablet, and mobile with zero Tailwind dependencies.
* [x] **Status:** ✅ Completed & Verified 100%.
