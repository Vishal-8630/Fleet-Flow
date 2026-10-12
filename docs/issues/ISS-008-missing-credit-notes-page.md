# ISS-008: Missing Frontend Credit Notes Route and Page Component

**Specification ID:** `ISS-008`  
**Title:** Missing Frontend Credit Notes Route and Page Component (Dead Sidebar Link)  
**Type:** Frontend / Navigation Defect  
**Severity:** `P1` (High)  
**Priority:** `P1` (High)  
**Status:** Confirmed Integration Mismatch  
**Date:** October 2026  
**Related Legacy Documents:** Preserves and supersedes [`docs/issues/ISSUE-03.md`](./ISSUE-03.md)  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#2-issues--defects-register-iss-)

---

## 1. Executive Summary
In [`frontend/src/components/layout/Sidebar.tsx:81`](../../frontend/src/components/layout/Sidebar.tsx#L81), the navigation menu exposes a prominent link to `/commercial/credit-notes`. However, [`frontend/src/App.tsx`](../../frontend/src/App.tsx) defines no route matching `/commercial/credit-notes`, and no `CreditNotesPage.tsx` component exists in the codebase. When users click "Credit Notes", the client router falls back to the catch-all redirect and returns users to `/dashboard`, making it impossible to manage or view credit notes in the user interface.

---

## 2. Current Behavior & Root Cause
- **Confirmed Fact 1 (Sidebar Link Exists):**  
  In `Sidebar.tsx`, the Commercial section includes:
  ```typescript
  { name: 'Credit Notes', href: '/commercial/credit-notes', icon: FileText }
  ```
- **Confirmed Fact 2 (Missing Route & Component):**  
  In `App.tsx`, routes under `/commercial/` only register:
  - `/commercial/invoices` (`InvoicesPage`)
  - `/commercial/invoices/new` (`CreateInvoicePage`)
  - `/commercial/aging` (`AgingReportPage`)
  - `/commercial/profitability` (`ProfitabilityPage`)
  There is no route for `/commercial/credit-notes`.
  A scan of `frontend/src/pages/` confirms `CreditNotesPage.tsx` does not exist.
- **User Impact:** Clicking the link causes a jarring redirect to `/dashboard`. Issued credit notes cannot be listed, searched, or downloaded.

---

## 3. Reproduction Steps
1. Log into the web application as any user.
2. In the left-hand navigation sidebar, expand the "Commercial" menu.
3. Click "Credit Notes".
4. Observe: The browser URL changes momentarily to `/commercial/credit-notes` and is immediately bounced back to `/dashboard`.

---

## 4. Expected Behavior
1. Navigating to `/commercial/credit-notes` renders a dedicated `CreditNotesPage.tsx`.
2. The page lists all issued credit notes for the active tenant, displaying Credit Note Number, Original Invoice Number, Party Name, Adjustment Amount, Reason, Issue Date, and a PDF Download action.
3. A button "Issue Credit Note" opens a modal permitting authorized users to create a credit note against an existing invoice.

---

## 5. Proposed Technical Solution
1. Create `frontend/src/pages/commercial/CreditNotesPage.tsx` with data table, search filter, and issue modal.
2. Register the route in `frontend/src/App.tsx`:
   ```tsx
   <Route path="/commercial/credit-notes" element={<CreditNotesPage />} />
   ```
3. Connect the page to `GET /api/commercial/credit-notes` and `POST /api/commercial/credit-notes`.

---

## 6. Acceptance Criteria
- [ ] Clicking "Credit Notes" in the sidebar smoothly navigates to `/commercial/credit-notes`.
- [ ] The Credit Notes table renders issued credit notes with accurate formatting (₹ amounts).
- [ ] Users can issue new credit notes against selected invoices directly from the UI.
- [ ] No unwanted redirects to `/dashboard` occur.

---

## 7. Definition of Done
1. `CreditNotesPage.tsx` implemented and integrated into `App.tsx`.
2. Manual and component tests passing.
