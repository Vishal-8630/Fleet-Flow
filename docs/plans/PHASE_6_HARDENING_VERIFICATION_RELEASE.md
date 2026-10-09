# Phase 6: Public Tracking, Automation, Hardening & Release

**Phase Objective:** Deliver customer-facing public consignment tracking, multi-channel automated notifications, server-side executive watchlists, comprehensive security hardening, automated test suites, backup restore drills, and production launch runbooks.

---

## 1. Public LR Consignment Milestone Tracking

### 1.1 Dedicated Public Route (`/track/:lrNumber`)
* A clean, mobile-responsive tracking portal accessible to shippers and consignees without requiring authentication.
* **Strict Data Sanitization (Privacy Invariant):**
  * **Allowed Public Fields:** Current Milestone Status (Booked $\rightarrow$ Dispatched $\rightarrow$ In Transit at City $\rightarrow$ Out for Delivery $\rightarrow$ Delivered), Last Known City/Checkpoint, Estimated Delivery Date, Consignment Package Count, and Vehicle Registration Number.
  * **Redacted Internal Fields:** Driver Phone Number, Driver Name, Freight Rate, Advance Cash, Bill Value, and Internal Dispatch Remarks are strictly stripped prior to response transmission.

### 1.2 Brute-Force & Enumeration Protection
* Protected by strict IP-based rate limiting (`express-rate-limit`): maximum 15 tracking lookups per 10 minutes per IP address.
* Non-existent LR numbers return uniform generic responses to prevent database enumeration.

---

## 2. Multi-Channel Notification Automation Engine

### 2.1 WhatsApp Automation Engine (`MOD_WHATSAPP`)
* Decoupled asynchronous worker utilizing the official Meta WhatsApp Business Cloud API (or unified gateway provider like Interakt/AiSensy/Twilio).
* **Automated Business Event Triggers:**
  1. *LR Generation:* Sends downloadable LR PDF link to Shipper and Consignee.
  2. *Trip Dispatch:* Sends route summary and reporting details to assigned Driver.
  3. *Delivery Completion:* Sends delivery confirmation and signed POD link to Customer.
  4. *Settlement Payout:* Sends settlement voucher summary to Driver.
* **Resilience:** Implements retry queues with exponential backoff (1m, 5m, 15m) and persistent delivery status logging (`WhatsAppLog`).

### 2.2 Transactional Email Delivery (Resend / AWS SES)
* Delivers employee invitations with signed tokens, self-service password reset links, platform subscription invoices, and dunning warning notices.

---

## 3. Executive Dashboard & 5 Operational Watchlists

Replaces client-side array calculations with high-performance MongoDB aggregation pipelines:

### 3.1 Aggregation Pipelines (`GET /api/dashboard/summary`)
* Computes active trip count, fleet availability, unbilled LRs, today's revenue, and pending party receivables in a single server-side `$facet` aggregation with sub-50ms execution times.

### 3.2 5 Dedicated Operational Watchlists
1. **Unsettled Journeys Watchlist:** Completed trips with unsettled finances.
2. **Pending Driver Settlements Watchlist:** Drivers with pending payouts filtered by direction ("DRL to Pay" vs "Driver to Pay").
3. **Party Payments Watchlist:** Overdue customer freight balances filtered by aging brackets (0–30, 31–60, 60+ days).
4. **Compliance Alerts Watchlist:** Real-time feed of vehicles with documents expiring in $< 15$ days or already expired.
5. **Operational Activity Feed:** Unified audit stream of dispatches, billings, and payment settlements.

---

## 4. Security Hardening, Audit & Observability

### 4.1 Immutable Operational Audit Trail
* `AuditLog` captures every write, update, delete, and financial state transition:
  * `entity_type`, `entity_id`, `company_id`, `action` (`CREATE` | `UPDATE` | `DELETE` | `STATUS_CHANGE`), `actor_id`, `actor_role`, `ip_address`, `before_snapshot`, `after_snapshot`, `timestamp`.
* Accessible via shared `<HistoryDrawer>` component for compliance dispute resolution.

### 4.2 Application Hardening Checklist
* HTTP security headers enforced via `helmet`.
* Content Security Policy (CSP) blocking unauthorized script injection.
* NoSQL injection prevention via `express-mongo-sanitize`.
* Strict CORS configuration restricting requests to authorized tenant domains.
* Secure cookie attributes: `HttpOnly`, `Secure` (production), `SameSite: strict`.

---

## 5. Comprehensive Test Verification Suite

### 5.1 Automated Test Suites to Execute
1. **Multi-Tenant Penetration Test:**
   * Script authenticates as User A (Company 1) and attempts read/write requests across 25 endpoints using IDs belonging to Company 2. Verifies 100% rejection rate with `404` or `403`.
2. **Financial Math & Rounding Test:**
   * Reconciles 50 simulated journeys with fractional fuel rates and extra charges against pre-computed accounting test vectors. Verifies zero floating-point discrepancies.
3. **ACID Concurrency Stress Test:**
   * Fires 50 parallel requests attempting to settle the same journey simultaneously. Verifies exactly 1 succeeds and 49 receive transaction conflict errors without corrupting ledger balances.
4. **Billing Webhook Idempotency Test:**
   * Fires duplicate payment success events. Verifies period is extended exactly once and single invoice is recorded.

---

## 6. Disaster Recovery, Backups & Release Runbooks

### 6.1 Database Backup & Restore Drill
* **Automated Backups:** Daily automated MongoDB Atlas cloud snapshots with 30-day retention and continuous point-in-time recovery (PITR).
* **Recovery Objectives:** Recovery Point Objective (RPO) $\le$ 1 hour; Recovery Time Objective (RTO) $\le$ 30 minutes.
* **Pre-Launch Drill:** Execute full database restore into staging environment to verify backup integrity prior to production launch.

### 6.2 Zero-Downtime Deployment Runbook
1. Execute database schema migrations (non-invasive additions).
2. Deploy backend service with blue-green rolling restart; run health check (`GET /health`).
3. Deploy frontend static assets to CDN / host.
4. Run automated smoke tests against staging tenant before opening traffic.
