# Fleet Flow — Finance & Subscription Audit

**Audit Date:** October 2026  
**Auditor:** Principal Financial Systems Auditor & SaaS Monetization Specialist  
**Repository:** `Vishal-8630/Fleet-Flow`  
**Standardized Taxonomy:** `Confirmed defect` | `Confirmed integration mismatch` | `Mocked or simulated behavior` | `Incomplete implementation`  
**Classification Severities:** `P0` (Critical Financial / Accounting Invariant Failure) | `P1` (High / Commercial Drift) | `P2` (Moderate / Reporting Inaccuracy) | `P3` (Low / Cosmetic)

---

## 1. Executive Summary: Financial & Monetization Core

A transport management system serves as the single source of truth for freight receivables, market truck vendor payables, driver trip advances, diesel consumption liabilities, and GST tax compliance.

**Audit Verdict:** Fleet Flow's financial and subscription engines suffer from severe data drift, broken accounting invariants, and pricing contradictions. Critical operations—such as credit note issuance and vendor payment recording—fail to update underlying balances or violate double-entry bookkeeping rules. Concurrently, the SaaS monetization layer exhibits gross discrepancies between customer-facing pricing and backend database seed definitions.

---

## 2. P0 Critical Defect: Broken Vendor Reconciliation & One-Sided General Ledger Postings

### 2.1 One-Sided Journal Postings: [ledgerController.ts:504-522](../../backend/src/controllers/ledgerController.ts#L504-L522)
When recording a payout to a freight vendor or truck supplier (`recordPartyPayout`), the controller executes:
```typescript
const voucher = new JournalEntry({
  company_id,
  party_name: party_name,
  party_type: 'vendor',
  voucher_type: 'payment',
  debit_amount: amount,
  credit_amount: 0,
  description: remarks || `Vendor payout recorded`,
  date: new Date(),
});
await voucher.save();
```
- **Violation of Double-Entry Invariant:** A financial transaction must consist of balanced debit and credit entries ($\sum \text{Debits} = \sum \text{Credits}$). Here, a single debit leg is posted. There is no corresponding credit leg to a Cash or Bank ledger account (`Bank / Cash Account`), and no unifying `journal_id` or transaction group is assigned.
- **Audit Impact:** Any trial balance or balance sheet report generated from this ledger will be mathematically unbalanced, failing financial compliance audits.

### 2.2 Omission of Payouts in Vendor Balance Aggregations: [ledgerController.ts:393-436](../../backend/src/controllers/ledgerController.ts#L393-L436)
In `getPartyBalances`, party balances are computed by aggregating freight movements:
```typescript
// Queries exclusively VehicleEntry / Entry model
const partySummary = await Entry.aggregate([
  { $match: { company_id: new Types.ObjectId(companyId) } },
  {
    $group: {
      _id: '$party_name',
      total_freight: { $sum: '$freight_amount' },
      total_advance: { $sum: '$advance_amount' },
      balance_payable: { $sum: '$balance_amount' }
    }
  }
]);
```
- **Root Cause & Impact:** The balance calculation **never queries or joins** the `JournalEntry` records created by `recordPartyPayout`.
- **Direct Business Consequence:** When an accountant records a payout of ₹50,000 to a vendor, the payout is saved to `JournalEntry`, but the vendor's `balance_payable` in `PartyBalancesPage.tsx` remains completely unchanged. Transport operators have no accurate view of outstanding liabilities and risk overpaying vendors.

---

## 3. P0 Critical Defect: Credit Note Balance Reduction Failure & Schema Mismatch

### 3.1 Code Inspection: [commercialReportController.ts:298-301](../../backend/src/controllers/commercialReportController.ts#L298-L301)
When issuing a credit note against an existing GST tax invoice:
```typescript
await Invoice.updateOne(
  { _id: original_invoice_id },
  { $inc: { amount_paid_paise: total_adjustment_paise } }
);
```

### 3.2 Schema Comparison: [Invoice.ts](../../backend/src/models/Invoice.ts#L28-L55)
In the `Invoice` Mongoose schema, financial values are tracked in rupees:
```typescript
{
  total_amount: { type: Number, required: true },
  tax_amount: { type: Number, default: 0 },
  paid_amount: { type: Number, default: 0 },
  balance_amount: { type: Number, required: true },
  status: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'cancelled'] }
}
```
- **Defect Analysis:**
  1. The field `amount_paid_paise` does **not exist** on the `Invoice` schema. Mongoose silently sets this un-schematized property in MongoDB.
  2. The legitimate fields `paid_amount` and `balance_amount` are never modified.
  3. The invoice's status is never updated from `unpaid` to `partially_paid` or `paid`.
- **Financial Consequence:** When a credit note is issued to settle a billing dispute or rate reduction, the customer's invoice still shows the full original balance. The customer will be pursued for payments they were already credited for.

---

## 4. P1 High Severity: Trip Profitability Report Calculation Failure

### 4.1 Code Inspection: [commercialReportController.ts:128-135](../../backend/src/controllers/commercialReportController.ts#L128-L135)
```typescript
const report = journeys.map((journey) => {
  const freight = (journey.total_freight_paise || 0) / 100;
  const diesel = (journey.diesel_expense_paise || 0) / 100;
  const toll = (journey.toll_expense_paise || 0) / 100;
  const expenses = diesel + toll;
  const netMargin = freight - expenses;
  return { ... };
});
```

### 4.2 Schema Reality: [TruckJourney.ts](../../backend/src/models/TruckJourney.ts#L25-L60)
The `TruckJourney` schema tracks expenses in standard rupee numbers:
- `freight_rate`: Number
- `total_diesel_cost`: Number
- `total_driver_expenses`: Number
- `other_expenses`: Number
- **Defect Analysis:** None of the `_paise` properties exist on `TruckJourney`. Every mapped variable evaluates to `0`.
- **Result:** Every single trip in the profitability dashboard displays `₹0.00 Revenue`, `₹0.00 Expenses`, and `₹0.00 Margin`. The core operational business intelligence tool for fleet managers is completely non-functional.

---

## 5. Indian GST & Tax Compliance Engine Audit

### 5.1 Goods Transport Agency (GTA) Taxation Rules
In Indian tax law, transport logistics services by a GTA fall under two distinct tax regimes:
1. **5% GTA Rate under Reverse Charge Mechanism (RCM):** Service recipient pays GST directly under reverse charge; GTA cannot claim Input Tax Credit (ITC).
2. **12% GTA Rate under Forward Charge:** GTA charges GST directly on the invoice and is entitled to claim ITC.

### 5.2 Implementation Audit in [invoiceController.ts](../../backend/src/controllers/invoiceController.ts#L70-L115)
- **State Code Matching:** The system correctly splits tax into CGST (half rate) and SGST (half rate) if `company.gstin.substring(0, 2) === customer.gstin.substring(0, 2)`, and IGST (full rate) for inter-state movements.
- **RCM Handling:** If `is_rcm === true`, the system sets tax amounts to 0 on the invoice total payable, with a mandatory disclaimer string added to the PDF.
- **Identified Defect / Missing Rule:** The system does not enforce GSTIN format validation (`^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`) on customer or company registration, permitting malformed state prefixes that corrupt tax bifurcation.
- **Missing Regulatory Feature:** No support for Tax Deducted at Source (TDS) under Section 194C of the Income Tax Act (1% for individuals/proprietorships, 2% for companies), nor PAN non-furnishing declaration handling (exemption certificates).

---

## 6. SaaS Subscription Monetization & Quota Engine

### 6.1 Marketing vs Backend Seed Discrepancies
A direct audit comparison between [PricingPage.tsx](../../frontend/src/pages/marketing/PricingPage.tsx#L35-L95) and [billingSeedService.ts](../../backend/src/utils/billingSeedService.ts#L25-L90) reveals major contradictions:

| Plan Tier | Marketing Claim (`PricingPage.tsx`) | Backend Reality (`billingSeedService.ts`) | Variance / Business Impact |
|---|---|---|---|
| **Starter** | **₹1,999 / month**<br>Quota: 5 Trucks<br>Features: 3-Part LR, Basic Invoicing | **₹1,499 / month** (`149900` paise)<br>Quota: 5 Trucks<br>Features: Core Fleet ONLY | Price discrepancy (₹500/mo).<br>**Critical:** LRs & Invoices blocked (403)! |
| **Standard**| **₹3,999 / month**<br>Quota: 15 Trucks<br>Features: Advanced Billing, Trips | **₹4,999 / month** (`499900` paise)<br>Quota: 20 Trucks<br>Features: LR Engine, Invoicing | Price discrepancy (₹1,000/mo).<br>Truck quota mismatch (15 vs 20). |
| **Pro / Ent**| **₹8,999 / month**<br>Quota: **Unlimited Trucks**<br>Features: Full ERP, Telematics | **₹9,999 / month** (`999900` paise)<br>Quota: **60 Trucks**<br>Features: All Modules | Price discrepancy (₹1,000/mo).<br>**Quota mismatch:** 60 cap vs "Unlimited". |

### 6.2 Entitlement Trap: Starter Plan Blocked from Core Logistics Operations
In [featureCatalog.ts](../../backend/src/utils/featureCatalog.ts), `MOD_LR_ENGINE` and `MOD_BILLING_INVOICE` are restricted to `standard` and `pro` tiers.
- A user subscribing to the Starter plan based on marketing promises will immediately receive `403 Forbidden` errors whenever they attempt to create a Lorry Receipt (`/api/lrs`) or generate a GST invoice (`/api/invoices`).
- This constitutes a severe commercial entitlement trap that would lead to immediate customer disputes and payment chargebacks.

### 6.3 Razorpay Payment Bypass & Sandbox Simulation
In [billingController.ts:110-145](../../backend/src/controllers/billingController.ts#L110-L145):
- The controller contains an automated fallback when Razorpay credentials are invalid or in test mode.
- If payment verification fails or test tokens are sent, the code updates the tenant's `CompanySubscription` status to `'active'`, grants full tier quotas, and extends the validity date by 30 days without verifying Razorpay HMAC-SHA256 webhook signatures.
- **Risk:** Lacks environment protection (`process.env.NODE_ENV !== 'production'`). If API keys are misconfigured in production, tenants can self-activate premium plans for free.

---

## 7. Financial & Subscription Audit Matrix

```
+-----------------------------------------------------------------------------------+
| Severity | Subsystem                     | Issue Description                      |
+-----------------------------------------------------------------------------------+
| P0       | General Ledger                | recordPartyPayout posts one-sided      |
|          |                               | debit leg; breaks double-entry balance |
| P0       | Vendor Reconciliation         | getPartyBalances omits recorded vendor |
|          |                               | payouts from Entry aggregation         |
| P0       | Accounts Receivable           | Credit notes update non-existent       |
|          |                               | amount_paid_paise; balances unchanged  |
| P1       | Trip Analytics                | Profitability report references non-   |
|          |                               | existent _paise fields; returns all 0  |
| P1       | SaaS Pricing & Quotas         | PricingPage claims contradict backend  |
|          |                               | seed prices and quotas                 |
| P1       | Subscription Entitlements     | Starter plan users blocked from LR and |
|          |                               | Invoicing features (403 Forbidden)     |
| P1       | Payment Gateway               | Unsafe payment simulation mode can     |
|          |                               | activate plans without payment capture |
| P2       | GST Engine                    | Missing GSTIN format regex validation  |
| P2       | Income Tax Compliance         | Missing Section 194C TDS deductions    |
+-----------------------------------------------------------------------------------+
```
