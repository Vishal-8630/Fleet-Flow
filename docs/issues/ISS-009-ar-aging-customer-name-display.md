# ISS-009: AR Aging Report Table Displays Missing Customer Names

**Specification ID:** `ISS-009`  
**Title:** AR Aging Report Table Displays Missing Customer Names (`"—"`)  
**Type:** Frontend / Commercial Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Integration Mismatch  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-13.md`](./ISSUE-13.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`frontend/src/pages/commercial/AgingReportPage.tsx:115-125`](../../frontend/src/pages/commercial/AgingReportPage.tsx#L115-L125), the table cell for Customer Name evaluates `{item.party?.party_name || '—'}`. However, the backend aggregation in [`commercialReportController.ts:80-95`](../../backend/src/controllers/commercialReportController.ts#L80-L95) returns `party` as a flat string containing the party's name. In JavaScript, evaluating `"Customer Name"?.party_name` yields `undefined`, falling back to `'—'` for every row in the report.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact (Backend Contract):**  
  In `commercialReportController.ts`:
  ```typescript
  // Aging grouping projects party as string:
  {
    party: 'Tata Steel Logistics',
    current_paise: 5000000,
    days_30_paise: 2000000,
    ...
  }
  ```
- **Confirmed Fact (Frontend Expectation):**  
  In `AgingReportPage.tsx`:
  ```tsx
  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
    {item.party?.party_name || '—'}
  </td>
  ```
- **Result:** Because `item.party` is a string primitive, `item.party.party_name` evaluates to `undefined`. The UI displays `"—"` across the entire column. Collections personnel cannot determine which debtor owes which amount.

---

## 3. Reproduction Steps
1. Create overdue invoices for multiple billing parties ("Ultratech Cement", "Reliance Petro").
2. Navigate to `/commercial/aging`.
3. Inspect the "Customer / Debtor" column.
4. Observe: Every single row displays `"—"`, even though amounts and aging buckets contain valid figures.

---

## 4. Expected Behavior
The Customer / Debtor column must render the actual customer name (e.g. "Ultratech Cement").

---

## 5. Proposed Technical Solution
Update `AgingReportPage.tsx` to handle either an object or a direct string:
```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
  {typeof item.party === 'object' && item.party !== null
    ? item.party.party_name || item.party.name || '—'
    : item.party || '—'}
</td>
```
Alternatively, ensure the backend DTO explicitly standardizes on `{ party: string }` and align the frontend TypeScript interface:
```typescript
interface AgingItem {
  party: string;
  current_paise: number;
  days_30_paise: number;
  days_60_paise: number;
  days_90_paise: number;
  days_90_plus_paise: number;
  total_paise: number;
}
```

---

## 6. Acceptance Criteria
- [ ] Navigating to `/commercial/aging` displays the correct debtor company name for each row.
- [ ] No customer rows display `"—"` unless the party name was genuinely empty in the database.

---

## 7. Definition of Done
1. Frontend template and TypeScript types updated in `AgingReportPage.tsx`.
2. Verified in browser and component test.
