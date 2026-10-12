# Fleet Flow — Security & Data Isolation Audit

**Audit Date:** October 2026  
**Auditor:** Principal Security Architect & Lead Security Auditor  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Standardized Taxonomy:** `Confirmed security risk` | `Confirmed defect` | `Incomplete implementation` | `Suspected risk requiring verification`  
**Classification Severities:** `P0` (Critical Vulnerability) | `P1` (High Severity) | `P2` (Moderate Severity) | `P3` (Low Severity)

---

## 1. Executive Summary: Tenant Isolation Architecture

Fleet Flow uses a **shared-database, shared-schema** multi-tenancy model. Isolation between independent transport companies is maintained logically at two layers:
1. **Application Middleware Layer:** Incoming HTTP requests must resolve the tenant identifier (`company_id`), verify the authenticated user's active membership in that company, and store the context in Node.js `AsyncLocalStorage` via [tenantMiddleware.ts](../../backend/src/middleware/authMiddleware.ts).
2. **ODM Data Access Layer:** A custom Mongoose plugin ([tenantPlugin.ts](../../backend/src/plugins/tenantPlugin.ts)) intercepts database queries to automatically append `{ company_id: currentTenantId }` to filters.

**Audit Verdict:** Both isolation layers contain severe architectural flaws, omissions, and bypass vectors. Under production traffic, these deficiencies allow cross-tenant data leakage, unauthorized data mutation, unauthenticated PII exposure, and privilege escalation.

---

## 2. P0 Critical Vulnerability: Missing `resolveTenantContext` in Express Routing

### 2.1 Threat Vector & Root Cause
In Express, middleware executes sequentially in the order registered on each `Router` instance. Across five major route definition files, developers mounted `authenticate` (validating the user's JWT) but omitted `resolveTenantContext`:

| Route File | Unprotected Endpoints | Consequence |
|---|---|---|
| [branchRoutes.ts](../../backend/src/routes/branchRoutes.ts#L10-L15) | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | Branch creation and queries execute with `req.tenant === undefined`. |
| [approvalRoutes.ts](../../backend/src/routes/approvalRoutes.ts#L10-L20) | `GET /`, `POST /`, `POST /:id/action` | `requireRole(['admin'])` fails with 403 or runs queries with `company_id: undefined`. |
| [commercialReportRoutes.ts](../../backend/src/routes/commercialReportRoutes.ts#L10-L22) | `GET /aging`, `GET /profitability`, `POST /credit-notes` | Aging reports, profitability data, and credit note issuance fail or leak data. |
| [supportRoutes.ts](../../backend/src/routes/supportRoutes.ts#L10-L15) | `GET /tickets`, `POST /tickets`, `PUT /tickets/:id` | Support tickets created without tenant association. |
| [trackingRoutes.ts](../../backend/src/routes/trackingRoutes.ts#L25-L35) | `POST /ping`, `GET /live/fleet`, `GET /live/:truckId`, `POST /incident` | Telematics pings and live fleet positions processed without tenant binding. |

### 2.2 Mechanism of Failure
1. **AsyncLocalStorage Starvation:** Because `tenantStorage.run()` in `resolveTenantContext` is never called, `getCurrentTenantId()` in `tenantPlugin.ts` returns `undefined`.
2. **Authorization Breakdown:** Subsequent middleware checks such as `requireRole(['admin'])` attempt to read `req.member.role`. Since `req.member` is populated only by `resolveTenantContext`, it evaluates to `undefined`, rejecting legitimate tenant admins with a 403 Forbidden.
3. **Un-scoped Database Queries:** When controllers attempt fallback queries using `req.company?._id` or `req.user?.company_id`, if the JWT does not carry the active tenant ID (such as when switching companies), queries execute with `{ company_id: undefined }`. In MongoDB, `{ company_id: undefined }` matches documents where `company_id` is missing or null, exposing un-isolated system records.

---

## 3. P0 Critical Vulnerability: Incomplete Mongoose Plugin Interception

### 3.1 Code Inspection: [tenantPlugin.ts](../../backend/src/plugins/tenantPlugin.ts#L79-L88)
The plugin registers query hooks as follows:
```typescript
const queryMethods = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateMany',
  'countDocuments',
  'estimatedDocumentCount',
] as const;

queryMethods.forEach((method) => {
  schema.pre(method, function () {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    this.where({ company_id: tenantId });
  });
});
```

### 3.2 Omitted Mutation & Query Operations
The plugin fails to intercept the following Mongoose query and document methods:
1. `updateOne`: Used extensively across controllers (e.g., [commercialReportController.ts:298](../../backend/src/controllers/commercialReportController.ts#L298)).
2. `deleteOne` and `deleteMany`: Any deletion initiated with `{ _id }` without explicitly passing `company_id` can delete another tenant's records if an ID is guessed or forged.
3. `findOneAndDelete` and `findByIdAndDelete`: Can delete arbitrary tenant records across the database.
4. `distinct`: Allows enumeration of unique values (e.g., party names, phone numbers) across all tenants.
5. `aggregate`: MongoDB aggregation pipelines bypass all Mongoose query middleware entirely. Aggregations in [entryController.ts](../../backend/src/controllers/entryController.ts#L93) and [journeyController.ts](../../backend/src/controllers/journeyController.ts#L127) must manually enforce `{ $match: { company_id: ObjectId } }`. If a developer forgets manual filtering, the entire aggregation runs globally across all tenants.

---

## 4. P0 Critical Vulnerability: Insecure Direct Object Reference (IDOR) & PII Leakage in Public Tracking

### 4.1 Code Inspection: [trackingController.ts](../../backend/src/controllers/trackingController.ts#L201-L240)
```typescript
export const publicTrackConsignment = async (req: Request, res: Response) => {
  const { lr_no, bill_no } = req.query;
  // ...
  const entry = await Entry.findOne({
    $or: [{ lr_no }, { bill_no }],
  }).populate('truck_id driver_id');
  // ...
  return res.json({
    status: 'success',
    data: {
      consignor: entry.consignor_name,
      consignee: entry.consignee_name,
      origin: entry.origin,
      destination: entry.destination,
      current_location: entry.last_known_location,
      driver_name: entry.driver_id?.name,
      driver_phone: entry.driver_id?.phone,
      vehicle_no: entry.truck_id?.truck_no,
    }
  });
};
```

### 4.2 Impact & Exploitation Analysis
1. **Multi-Tenant Collisions:** In transport logistics, LR numbers frequently reset annually or follow predictable serials (`LR-0001`, `LR-0002`). Because this query has **no tenant scoping**, querying `?lr_no=LR-0001` returns the first matching document in the database, indiscriminately leaking shipments from competing transport companies.
2. **Unauthenticated PII Harvest:** The endpoint is completely unauthenticated and **lacks rate limiting**. An external attacker can enumerate integer sequences (`1` to `100000`) and harvest:
   - Full names and physical transit routes of commercial consignors and consignees.
   - Live GPS coordinates of active trucks.
   - Driver identities, mobile phone numbers, and vehicle registration numbers.

---

## 5. P1 High Severity: File Upload Security & Directory Traversal Risks

### 5.1 Dead / Unmounted Security Middleware: [fileSecurityMiddleware.ts](../../backend/src/middleware/fileSecurityMiddleware.ts)
- An anti-malware and MIME spoofing utility `validateFileMagicBytes` was implemented to inspect file buffers against known magic headers (PDF `%PDF-`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`).
- **Grep Verification:** `fileSecurityMiddleware` is **never imported or mounted** in [documentRoutes.ts](../../backend/src/routes/documentRoutes.ts) or any other route file.
- **Vulnerability:** Attackers can upload arbitrary executable scripts or malicious HTML files masked as `.pdf` or `.jpg`. If served with standard MIME headers, this exposes tenants to Cross-Site Scripting (XSS) or remote code execution.

### 5.2 Directory Traversal Vulnerability in Local Storage Service: [storageService.ts](../../backend/src/utils/storageService.ts#L45-L60)
- In `storageService.ts`, when local disk storage is active, file retrieval implements:
  ```typescript
  const getLocalFilePath = (key: string): string => {
    return path.join(LOCAL_STORAGE_DIR, key);
  };
  ```
- **Vulnerability:** `key` is taken directly from user-influenced database records or query parameters without verifying that the resolved path starts with `LOCAL_STORAGE_DIR`. An attacker supplying keys containing `../../` can traverse outside the uploads folder and read system files.

---

## 6. P1 High Severity: Stakeholder Portal Authentication Deficiencies

### 6.1 Customer Portal Phone Lookup Mismatch
- In [portalController.ts:47](../../backend/src/controllers/portalController.ts#L47), the OTP dispatch logic performs:
  ```typescript
  const party = await BillingParty.findOne({ company_id, contact_phone: phone });
  ```
- The [BillingParty.ts](../../backend/src/models/BillingParty.ts) schema defines the phone attribute as `phone: { type: String, required: true }`.
- Because `contact_phone` does not exist, the query returns `null`, and every OTP request fails with 404.

### 6.2 Hardcoded Mock Data in Vendor Portal
- In [VendorPortalPage.tsx:43-66](../../frontend/src/pages/portal/VendorPortalPage.tsx#L43-L66), the vendor portal does not communicate with the backend. It renders hardcoded dummy data for freight rates, trips, and ledger balances.
- If deployed to vendors, vendors cannot access real payment data, and no real authentication or scoping takes place.

---

## 7. Authentication, Session & Token Management Audit

| Security Control | Implementation Status | Finding / Risk |
|---|---|---|
| **JWT Secret Strength** | Configured via `JWT_SECRET` | Defaults to insecure hardcoded string if environment variable is missing in development. |
| **Token Expiry** | 15 minutes access token, 7 days refresh | Compliant with standard security hygiene. |
| **Refresh Token Revocation** | Model `RefreshToken.ts` in MongoDB | Refresh tokens are deleted upon logout, preventing replay attacks. |
| **Password Hashing** | `bcryptjs` with salt round 12 | Secure and computationally robust. |
| **CORS Policy** | `cors()` middleware in `app.ts` | Configured to reflect origin or accept wildcard `*` if `FRONTEND_URL` is omitted. Must be locked down in production. |
| **Security Headers** | `helmet()` mounted in `app.ts` | Enforces CSP, HSTS, frameguard, and X-Content-Type-Options. |

---

## 8. Summary of Security & Isolation Findings

```
+-----------------------------------------------------------------------------------+
| Severity | Category                      | Finding Description                    |
+-----------------------------------------------------------------------------------+
| P0       | Tenant Isolation Bypass       | Missing resolveTenantContext in 5      |
|          |                               | major route files                      |
| P0       | Tenant Data Leakage / Write   | tenantPlugin missing updateOne,        |
|          |                               | deleteOne, aggregate, distinct         |
| P0       | IDOR / PII Data Harvesting    | publicTrackConsignment un-scoped,      |
|          |                               | unauthenticated, unthrottled           |
| P0       | Broken Portal Authentication  | Customer OTP lookup schema mismatch    |
| P1       | File Spoofing / Malicious Exec| Dead fileSecurityMiddleware magic byte |
|          |                               | validation                             |
| P1       | Directory Traversal           | storageService getLocalFilePath lacks  |
|          |                               | path normalization check               |
| P1       | Mocked Vendor Portal          | VendorPortalPage renders mock data     |
| P2       | Weak Dev Fallback Secrets     | Insecure JWT secret fallbacks          |
+-----------------------------------------------------------------------------------+
```
