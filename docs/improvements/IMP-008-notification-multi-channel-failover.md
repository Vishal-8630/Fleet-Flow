# IMP-008: Multi-Channel Notification Failover (WhatsApp -> SMS -> Email)

**Improvement ID:** `IMP-008`  
**Title:** Multi-Channel Notification Failover (WhatsApp -> SMS -> Email) with Strict Opt-Out Compliance  
**Category:** Communications & Reliability Engineering  
**Priority:** `P2` (Moderate)  
**Proposed Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#3-improvements-register-imp-)

---

## 1. Problem Statement & Target User
In [`backend/src/workers/notificationWorker.ts`](../../backend/src/workers/notificationWorker.ts) and [`notificationController.ts`](../../backend/src/controllers/notificationController.ts), notifications (e.g. LR dispatch alerts, payment receipts, document expiry warnings) prioritize the Meta WhatsApp Cloud API (`MOD_WHATSAPP`). If a recipient's mobile number is not registered on WhatsApp or if Meta returns API rate limiting / template rejection (e.g. error code 131026), the notification is marked `failed` and discarded. There is no automated fallback to transactional SMS (via Twilio / MSG91) or transactional Email (via SendGrid / AWS SES).

---

## 2. Business Value & Intended Outcome
- Guarantee 99.9% delivery rate for mission-critical freight updates (e.g. truck dispatch, payment receipts, breakdown notices).
- Provide transparent multi-channel delivery trails in [`NotificationLogsPage.tsx`](../../frontend/src/pages/settings/NotificationLogsPage.tsx).
- Respect statutory DND (Do Not Disturb) and user opt-out preferences across all channels.

---

## 3. Workflow & Technical Specification
1. **Cascade Pipeline:**
   - Attempt Channel 1 (WhatsApp Template).
   - If delivery callback reports failed or times out after 120 seconds -> Auto-dispatch Channel 2 (Transactional SMS).
   - If SMS fails and recipient email exists -> Auto-dispatch Channel 3 (Transactional Email).
2. **Opt-Out Check:** Before sending on any channel, query `NotificationOptOut` table. If recipient has opted out, suppress the alert and mark status as `opted_out_suppressed`.
3. **Log History:** Store all delivery attempt records in `NotificationLog` with channel tag and provider message ID.

---

## 4. Acceptance Criteria
- [ ] Simulating a WhatsApp API failure automatically triggers an SMS dispatch within 60 seconds.
- [ ] Customers who sent "STOP" or toggled opt-out never receive promotional or automated messages.
- [ ] `NotificationLogsPage.tsx` shows exact delivery status (`delivered`, `read`, `failed_fallback_sms_sent`).

---

## 5. Definition of Done
1. Multi-channel failover cascade implemented in `notificationWorker.ts`.
2. Verified in communication tests.
