# Phase 5: SaaS Billing, Entitlements & Workspace Customization

**Phase Objective:** Build the commercial multi-tenant engine—dynamic feature entitlements with dependency rules, Razorpay recurring subscription billing with cryptographic webhooks, mathematical proration, dunning, company customization studio, and the platform super-admin control plane.

---

## 1. Feature Catalog & Gating Architecture

### 1.1 Central Catalog Definition (`MOD_CATALOG`)
* Registers all 20 canonical modules (`MOD_FLEET`, `MOD_DRIVERS`, `MOD_TRIPS`, `MOD_LR_ENGINE`, `MOD_BILLING_INVOICE`, `MOD_SETTLEMENTS`, `MOD_LEDGERS`, `MOD_GPS_SYNC`, `MOD_FLEET_IQ`, `MOD_WHATSAPP`, `MOD_MAINTENANCE`, `MOD_TALLY_SYNC`, etc.).
* Stores hard dependencies (e.g., `MOD_BILLING_INVOICE` requires `MOD_PARTIES` and `MOD_LR_ENGINE`).

### 1.2 Entitlement Evaluation Waterfall
* Evaluates access in descending precedence:
  1. System Suspension / Expiry $\rightarrow$ Denies write operations (Read-Only).
  2. Super-Admin Explicit Overrides $\rightarrow$ Respects manual grants/revocations.
  3. Active Paid Add-Ons $\rightarrow$ Grants feature.
  4. Active Subscription Plan $\rightarrow$ Grants feature.
  5. Active 14-Day Free Trial $\rightarrow$ Grants base + standard modules.
  6. Default $\rightarrow$ Denies access.

### 1.3 Backend & Frontend Gates
* Backend: `requireFeature('MOD_...')` and `requireAllFeatures([...])` Express middlewares.
* Frontend: `<FeatureGate feature="MOD_..." showUpgradePrompt={true}>` component.
* Dynamic Sidebar: Filters menu navigation items using `getAuthorizedNavItems()`.

---

## 2. Dynamic Pricing, Subscriptions & Razorpay Billing

### 2.1 Catalog Data Models
* `Plan`: Dynamic plans (Starter, Standard, Pro, Custom Enterprise), monthly/annual prices in paise, included modules, and resource quotas.
* `AddOn`: Standalone monetized modules (WhatsApp Suite, Fleet IQ, Maintenance Manager) and capacity booster packs.
* `Subscription`: Active plan reference, grandfathered `locked_pricing`, active add-on array, status (`trialing` | `active` | `past_due` | `suspended`), and renewal timestamps.
* `PromoCode`: Percentage or fixed discounts with redemption counters and plan filters.

### 2.2 Payment Gateway Integration & Webhook Security
* Backend initiates Razorpay Subscription Order via official SDK.
* Client opens standard Razorpay checkout modal (Card, UPI, NetBanking).
* **Cryptographic Webhook Ingestion:**
  * Endpoint `POST /api/webhooks/billing` validates `x-razorpay-signature` using HMAC-SHA256 against raw body buffer.
  * Checks `ProcessedWebhook` collection by `event_id` to guarantee idempotent execution.
  * Runs updates inside MongoDB ACID transaction.

### 2.3 Mathematical Proration & Dunning Lifecycle
* **Mid-Cycle Upgrades:** Automatically computes unused current plan credit vs. new plan charge down to the second; charges the difference immediately and upgrades quotas.
* **Downgrades:** Scheduled for execution at the end of the current billing period (`scheduled_change`) to allow operators time to retire excess fleet assets.
* **7-Day Dunning Process:** Failed renewals trigger `PAST_DUE` state, persistent alert banners, and 3 automated retries (Days 1, 3, 5). On Day 7, workspace gracefully transitions to read-only `SUSPENDED` mode. Data is never deleted.

---

## 3. Company Customization & Custom Fields Studio

### 3.1 Company Settings Engine (`/settings/company`)
* Regional settings: Date formats (`DD/MM/YYYY`), number formatting (Indian Lakhs/Crores vs International), currency, decimal precision.
* Numbering series: Auto-sequencing prefixes and zero-padding for LRs (`LR-26-01001`), Invoices, and Settlements.
* Custom operational expense categories with driver reimbursement rules.

### 3.2 Custom Fields Studio (`/settings/custom-fields`)
* Supported entities: `Truck`, `Driver`, `TruckJourney`, `BillingParty`, `BalanceParty`, `Entry`.
* Field types: `text`, `number`, `date`, `boolean`, `dropdown`, `multi_select`, `lookup`, `url`.
* **Storage:** Hybrid Typed Map (`custom_fields: { [key]: value }`) with wildcard indexing (`custom_fields.$**`).
* **Validation:** Backend dynamically compiles Zod schemas on-the-fly with `.strict()` mode to automatically reject unregistered client inputs.
* **Soft-Deprecation:** Fields with existing stored data cannot be hard-deleted; administrators archive them, keeping historical data intact.

### 3.3 Workflow Approval Engine (`/settings/workflows`)
* Multi-step approval pipelines for Trip Dispatch, Expense Reimbursements (> ₹5,000 threshold), and Invoices.
* Approval history and state embedded directly on operational records.

---

## 4. Platform Super-Admin Control Plane (`/super-admin`)

Accessible exclusively to `is_platform_super_admin`:
* **SaaS Health Metrics:** MRR, ARR, active tenant count, churn rate, fleet trucks under management.
* **Tenant Directory:** Search companies, view active quotas vs usage, extend trials by 7/14/30 days, override quotas, and freeze abusive accounts.
* **Audited Impersonation:** 1-hour secure support session into any tenant workspace; logs actor and actions in `PlatformAuditLog`.
* **Plan & Add-On Studio:** Create, edit, and retire pricing tiers without redeploying code.

---

## 5. Phase 5 Verification & Acceptance Criteria

1. **Webhook Idempotency Test:** Deliver duplicate Razorpay payment webhooks; verify system acknowledges `200 OK` without creating duplicate invoices or extending subscription periods twice.
2. **Proration Accuracy Test:** Upgrade Starter (₹999) to Pro (₹4,999) at exact mid-cycle (15/30 days); verify net charged amount equals ₹2,000 + GST.
3. **Custom Field Injection Defense:** Post payload containing `{ custom_fields: { rogue_key: 'malicious' } }`; verify dynamic Zod validator strips or rejects the payload.
4. **Read-Only Suspension Test:** Set tenant status to `suspended`; verify user can read and export existing data, but `POST /api/journey` returns `403 SUBSCRIPTION_SUSPENDED`.
