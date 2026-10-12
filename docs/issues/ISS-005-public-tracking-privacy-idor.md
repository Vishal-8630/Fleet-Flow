# ISS-005: IDOR & Unauthenticated PII Exposure in Public Tracking

**Specification ID:** `ISS-005`  
**Title:** Insecure Direct Object Reference (IDOR) & Unauthenticated PII Exposure in Public Tracking  
**Type:** Security / Privacy Defect  
**Severity:** `P0` (Critical Blocker)  
**Priority:** `P0` (Immediate)  
**Status:** Confirmed Security Risk  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-05.md`](./ISSUE-05.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`trackingController.ts:201-240`](../../backend/src/controllers/trackingController.ts#L201-L240), the public tracking endpoint (`publicTrackConsignment`) queries shipments using `Entry.findOne({ $or: [{ lr_no }, { bill_no }] })` without tenant scoping (`company_id`). Because LR numbers frequently repeat across independent transport companies, querying a standard LR number (e.g., `LR-001`) exposes shipments belonging to competing tenants. The endpoint has no rate limiting and exposes sensitive Personally Identifiable Information (PII)—including consignor/consignee names, addresses, driver phone numbers, vehicle registrations, and real-time GPS coordinates.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact:** In [`trackingController.ts:201`](../../backend/src/controllers/trackingController.ts#L201):
  ```typescript
  export const publicTrackConsignment = async (req: Request, res: Response) => {
    const { lr_no, bill_no } = req.query;
    // ...
    const entry = await Entry.findOne({
      $or: [{ lr_no }, { bill_no }],
    }).populate('truck_id driver_id');
    // Returns full customer names, driver phone numbers, and live GPS coordinates!
  ```
- **Vulnerability Mechanism:**
  1. `lr_no` is only unique **per company** (`{ company_id: 1, lr_no: 1 }`).
  2. If Company A and Company B both issue `LR-1001`, an unauthenticated user tracking `LR-1001` receives whichever document MongoDB returns first.
  3. No authentication, token, or tracking secret is required.
  4. No rate limiting is mounted on `/api/tracking/public` in [`trackingRoutes.ts`](../../backend/src/routes/trackingRoutes.ts).
  5. An attacker can write an automated scraper iterating sequential numbers to map an entire transport company's customer list, routes, and fleet coordinates.

---

## 3. Reproduction Steps
1. Create a shipment in Company 1 with `lr_no: 'LR-1001'` (Consignor: "Apple India", Driver Phone: "9876543210").
2. Create a shipment in Company 2 with `lr_no: 'LR-1001'` (Consignor: "Samsung India", Driver Phone: "9123456789").
3. Send an unauthenticated HTTP GET request: `GET /api/tracking/public?lr_no=LR-1001`.
4. Observe: The response returns one of the tenant's private shipment details with driver mobile number and live location coordinates.

---

## 4. Reconciled Public Tracking Contract & Expected Behavior

1. **Dual Access Strategy (Privacy & Enumeration Defense)**:
   - **Primary Workflow (Secure Token)**: Consignments generate an unguessable 128-bit cryptographically secure tracking token (`tracking_token`, e.g. `trk_a8f92b7c4d1e0f3a`) during LR creation. Transactional notifications (WhatsApp / SMS) link directly to `/track?token=${tracking_token}`. Token lookup requires zero credentials and allows zero enumeration.
   - **Secondary Workflow (LR Number + Multi-Factor Verification)**: If a customer visits the tracking page manually with only an LR number, the system requires a 3-factor lookup: `Company Code` + `LR Number` + `Consignor/Consignee Phone Number` (or 4-digit SMS OTP). Direct sequential querying of raw `lr_no` alone is strictly rejected to prevent cross-tenant IDOR and competitor shipment enumeration.
2. **Strict Data Redaction Contract**:
   - The response must strictly strip: Driver personal mobile number, driver name, vehicle chassis/engine details, raw GPS coordinates (latitude/longitude), freight rate, payment balance, and commercial party financial terms.
   - Permitted fields: Consignment status, origin city/hub, destination city/hub, estimated delivery timestamp, and chronological milestone events (e.g., "Dispatched from Mumbai", "Arrived at Pune Hub").
3. **Frontend & Backend Schema Synchronization**:
   Backend controller response and frontend tracking page state must adhere to an identical contract:
   ```typescript
   export interface PublicShipmentTrackingDTO {
     tracking_token: string;
     lr_number_masked: string;       // e.g. "MH-***892"
     status: 'booked' | 'dispatched' | 'in_transit' | 'out_for_delivery' | 'delivered';
     origin_hub: string;             // City / Hub name only
     destination_hub: string;        // City / Hub name only
     estimated_delivery: string | null;
     last_milestone: string;
     events: Array<{
       event_name: string;
       hub_name: string;
       timestamp: string;
       remarks?: string;
     }>;
   }
   ```
4. **Abuse Protection**:
   - Strict IP rate limiting (20 requests per minute per IP via `express-rate-limit`).

---

## 5. Proposed Technical Solution
1. Update `Entry` and `LR` schemas to include indexed `tracking_token`:
   ```typescript
   tracking_token: { 
     type: String, 
     unique: true, 
     index: true, 
     default: () => `trk_${crypto.randomBytes(12).toString('hex')}` 
   }
   ```
2. Refactor `publicTrackConsignment` in `trackingController.ts`:
   ```typescript
   export const publicTrackConsignment = async (req: Request, res: Response) => {
     const { token, company_code, lr_no, phone } = req.query;

     let entry = null;
     if (token && typeof token === 'string') {
       entry = await Entry.findOne({ tracking_token: token })
         .select('tracking_token lr_no status origin destination estimated_arrival events');
     } else if (company_code && lr_no && phone) {
       // Disambiguated multi-tenant verified query
       const company = await Company.findOne({ code: company_code });
       if (!company) throw new ApiError(404, 'Invalid company tracking reference');
       
       entry = await Entry.findOne({
         company_id: company._id,
         lr_no: lr_no,
         $or: [{ 'consignor.phone': phone }, { 'consignee.phone': phone }]
       }).select('tracking_token lr_no status origin destination estimated_arrival events');
     } else {
       throw new ApiError(400, 'Valid tracking token or verified LR query credentials required.');
     }

     if (!entry) throw new ApiError(404, 'Shipment not found or phone number verification failed.');

     const payload: PublicShipmentTrackingDTO = {
       tracking_token: entry.tracking_token,
       lr_number_masked: `***${entry.lr_no.slice(-4)}`,
       status: entry.status,
       origin_hub: entry.origin?.city || 'Origin Hub',
       destination_hub: entry.destination?.city || 'Destination Hub',
       estimated_delivery: entry.estimated_arrival ? entry.estimated_arrival.toISOString() : null,
       last_milestone: entry.events?.length ? entry.events[entry.events.length - 1].status : 'Booked',
       events: (entry.events || []).map(ev => ({
         event_name: ev.status,
         hub_name: ev.location || '',
         timestamp: ev.timestamp.toISOString(),
         remarks: ev.remarks
       }))
     };

     return res.json({ status: 'success', data: payload });
   };
   ```
3. Mount `publicTrackingRateLimiter` (20 req/min) in `trackingRoutes.ts`.

---

## 6. Acceptance Criteria
- [ ] Querying `/api/tracking/public?lr_no=LR-001` without company code and phone verification returns HTTP 400.
- [ ] Querying via `tracking_token` returns HTTP 200 with sanitized `PublicShipmentTrackingDTO`.
- [ ] Response payload contains zero driver phone numbers, zero freight charges, and zero raw GPS coordinates.
- [ ] Repeated requests exceeding 20 per minute from a single IP return HTTP 429 Too Many Requests.
- [ ] Cross-tenant collision is completely eliminated; Company A's `LR-001` cannot be viewed by querying Company B.

---

## 7. Definition of Done
1. `trackingController.ts` and `trackingRoutes.ts` updated with token and verified lookup.
2. Frontend `PublicTrackingPage.tsx` updated to consume `PublicShipmentTrackingDTO`.
3. Verified in automated test suite [`TEST-002`](../testing/TEST-002-cross-tenant-isolation-suite.md).
