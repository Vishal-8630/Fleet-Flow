# Issue 06 — Real Notifications and Background Jobs

## Metadata
- **Severity**: P1 (High)
- **Status**: Documented & Ready for Implementation
- **Category**: Asynchronous Jobs, Communications, WhatsApp Business API & Webhooks
- **Date**: October 10, 2026

---

## 1. Problem Statement
The multi-channel notification service currently mocks delivery:
1. **Mock Message IDs & Fake Delivery**: In `notificationService.ts`, `dispatchNotification` generates a fake random string `wamid.${crypto.randomBytes(12)}`, immediately flags the record as `status: 'sent'`, and outputs to `console.log`. No real WhatsApp Business API or SMTP/Resend API request is dispatched.
2. **Hardcoded Localhost Tracking URL**: `notifyLRGenerated` hardcodes `http://localhost:5173/track/${entry.lr_no}` instead of dynamically resolving the production domain from environment variables (`APP_BASE_URL` / `PUBLIC_URL`).
3. **Absence of Background Job Queue & Retries**: Notifications are executed in fire-and-forget synchronous promises. If the provider API times out or experiences rate limits (HTTP 429), the notification is permanently lost without persistent retry or exponential backoff.
4. **Missing Provider Status Webhooks**: There is no webhook endpoint to ingest Meta WhatsApp or email status updates (`sent` → `delivered` → `read` → `failed`). Delivery failures (e.g. invalid phone number, unregistered WhatsApp user) are never reflected in the audit log.
5. **No Customer Consent / Opt-Out Handling**: Transport customers (consignors, consignees, drivers) have no way to opt out of automated messaging, risking Meta WhatsApp Business Account bans for spam.
6. **No Notification Audit Screen in UI**: Workspace administrators cannot view a delivery log screen to inspect dispatch history, delivery receipts, failure reasons, and costs.

---

## 2. Root Cause Analysis (RCA)
- **Simulated Cloud Gateway**: Meta WhatsApp Cloud API requires pre-approved HSM (Highly Structured Message) templates and API tokens, so mock delivery was used during initial feature development.
- **In-Process Dispatch**: Background workers (e.g. BullMQ / Redis or MongoDB job queue) were deferred.
- **Hardcoded Development Host**: `APP_BASE_URL` was not read from `process.env`.

---

## 3. Implementation Solution & Target Architecture

### A. Real WhatsApp Cloud API Integration
- Build a dedicated WhatsApp client in `backend/src/utils/whatsappClient.ts`:
  - Interacts with Meta Graph API: `POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`
  - Headers: `Authorization: Bearer {WHATSAPP_API_TOKEN}`
  - Pre-approved HSM Templates:
    - `lr_booking_consignor` (LR Number, Origin, Destination, Tracking URL)
    - `lr_in_transit_consignee` (Vehicle Number, ETA, Tracking Link)
    - `pod_delivered_receipt` (Delivery Time, Receiver Signature URL)
    - `driver_advance_disbursement` (Trip ID, Amount, Payment Mode)
  - Supports configurable tenant credentials or centralized platform gateway.

### B. Persistent Asynchronous Job Queue with Exponential Backoff
- Create a persistent `NotificationJob` queue in MongoDB (or BullMQ):
  - Fields: `job_id`, `company_id`, `channel`, `payload`, `attempts`, `max_attempts: 5`, `next_run_at`, `status` (`pending`, `processing`, `delivered`, `failed`).
  - Worker processor with exponential backoff: retry after 1m, 5m, 15m, 1h upon provider errors (HTTP 429, 500).
  - Dead-Letter Queue (DLQ) state for unrecoverable failures (e.g. phone number not on WhatsApp).

### C. Meta Webhook Receiver (`POST /api/webhooks/whatsapp`)
- Handlers:
  - `GET /api/webhooks/whatsapp`: Hub challenge verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
  - `POST /api/webhooks/whatsapp`: Ingests delivery receipts (`statuses[].status` = `delivered` | `read` | `failed`), updates `NotificationLog`, records error codes.
  - Opt-Out ingestion: If incoming message text matches `"STOP"` or `"UNSUBSCRIBE"`, automatically flags recipient in `OptOutRegistry`.

### D. Dynamic Production Domain Configuration
- Replace `http://localhost:5173` with:
  ```ts
  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://fleetflow.io';
  const trackingUrl = `${baseUrl}/track/${entry.lr_no}`;
  ```

### E. Notification Logs Screen in Frontend
- Backend endpoint: `GET /api/notifications/logs` (paginated, filter by channel, status, date).
- Frontend UI: Under Company Settings or Operations, an interactive "Notification Delivery Log" table:
  - Recipient Name & Phone/Email
  - Event Type (LR Booking, Trip Dispatch, POD, Advance)
  - Channel (WhatsApp / Email)
  - Delivery Status (Queued, Sent, Delivered, Read, Failed with error tooltip)
  - "Resend Notification" action button.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `backend/src/utils/whatsappClient.ts` | Meta WhatsApp Cloud API client with approved template payload builders |
| `backend/src/models/NotificationJob.ts` | Persistent job queue model with retry counters and backoff timing |
| `backend/src/workers/notificationWorker.ts` | Background runner processing pending notification queue items |
| `backend/src/routes/webhookRoutes.ts` | Meta WhatsApp webhook verification and status callback handler |
| `backend/src/utils/notificationService.ts` | Refactor to queue jobs and use dynamic `APP_BASE_URL` |
| `backend/src/controllers/notificationController.ts` | Endpoints to fetch logs, opt-outs, and trigger manual resends |
| `frontend/src/pages/settings/NotificationLogsPage.tsx` | UI table displaying real-time delivery statuses, failure logs, and resend buttons |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Triggering a Dispatch Alert & Checking Notification Logs
1. **Create and Dispatch a Consignment**:
   - Log in as Dispatcher or Admin at `http://localhost:5173/login`.
   - In the sidebar, navigate to **Consignments (LR)** (`/consignments`).
   - Click the **"+ New Consignment"** button.
   - Enter party details:
     - Consignor: `Reliance Industries Ltd` (Mobile: `9876543210`)
     - Destination: `Delhi Hub`
     - Cargo: `500 Corrugated Boxes`
   - Click **"Create & Dispatch LR"**.
2. **Inspect Delivery Log Screen**:
   - In the sidebar, click **Settings** -> **Notification Logs** (`/settings/notifications`).
3. **What You Should See on the Screen**:
   - A row is immediately created at the top of the log table:
     - Channel: WhatsApp icon (`WhatsApp Meta Cloud API`)
     - Recipient: `+91 98765 43210`
     - Template Name: `consignment_dispatched_v1`
     - Status: `QUEUED` -> changes dynamically to `SENT` or `DELIVERED` with double checkmarks.
   - Click the **"Preview Message"** button in the row:
     - A modal displays the exact text sent:  
       *"Dear Customer, your consignment #LR-2026-9042 has been dispatched. Track live at: http://localhost:5173/track/LR-2026-9042"*
     - Notice the tracking link uses the active website domain, never a hardcoded `localhost:3000` string.

---

### Test 2: Testing Failed Delivery Retry & Manual Resend
1. **Locate a Failed Message**:
   - On `/settings/notifications`, filter the status dropdown by **"Failed"**.
   - Inspect a row showing status `FAILED` (e.g. `Invalid Phone Format` or `Network Timeout`).
2. **Trigger Resend**:
   - Click the **"Resend Message"** button in the action column.
3. **What You Should See on the Screen**:
   - A spinner shows briefly on the button.
   - Toast notification appears:  
     > 🔄 *"Notification re-queued for background delivery."*
   - The status badge changes from red `FAILED` to blue `QUEUED` and updates its timestamp.

---

### Test 3: Party WhatsApp Notification Preferences (Opt-Out)
1. **Disable WhatsApp Alerts for a Specific Party**:
   - In the sidebar, navigate to **Parties Master** (`/parties`).
   - Click **"Edit"** on a customer party.
   - Scroll to **"Notification Preferences"** and toggle OFF the switch: **"Enable Automated WhatsApp Tracking Alerts"**.
   - Click **"Save Changes"**.
2. **Create New LR for this Customer**:
   - Create and dispatch a new LR for this customer.
   - Return to `/settings/notifications`.
3. **What You Should See on the Screen**:
   - A row appears showing status `SKIPPED (DND / Opted-Out)` in neutral grey.
   - Zero billable WhatsApp messages are dispatched, respecting recipient preferences.

