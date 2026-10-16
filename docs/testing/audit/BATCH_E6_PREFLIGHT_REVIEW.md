# Fleet Flow — Batch E6 Preflight Review: UI-UX Scope Cleanup & Toast Stacking Hardening

**Document Type:** Technical Governance Pre-Implementation Review  
**Phase Identifier:** `PHASE-E6` (Preflight Review & Architectural Plan)  
**Target Canonical Issues:**  
- [`FF-ISSUE-002`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/ui-ux/FF-ISSUE-002-unwanted-fleet-roi-calculator.md) — Unwanted Public Fleet ROI Calculator Component  
- [`FF-ISSUE-012`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/issues/ui-ux/FF-ISSUE-012-toast-zindex-and-dismissal.md) — Validation Error Toast Renders Behind Active Modal and Auto-Dismisses Too Rapidly  
**Authoritative Baseline Roadmap:** [`BATCH_E_PREFLIGHT_REVIEW.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_E_PREFLIGHT_REVIEW.md) (Section 6, Phase E6)  
**Execution Posture:** Strictly Read-Only Technical Preflight (No Application Code Modified)  
**Baseline Git Commit:** Current working tree on branch `main` (preserving completed Batches E1–E5)  
**Preflight Recommendation:** **`ACCEPT` (Approved for Implementation Upon Product Owner Authorization)**

---

## 1. Executive Summary & Purpose

This preflight audit inspects the remaining issues assigned to Batch E in [`BATCH_E_PREFLIGHT_REVIEW.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/audit/BATCH_E_PREFLIGHT_REVIEW.md) (line 31 and lines 425–429):

1. **`FF-ISSUE-002` (Unwanted Fleet ROI Calculator):** The public landing homepage ([`HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx)) contains an interactive ROI calculator section with stateful slider inputs and hardcoded financial claims (e.g. ₹3,000/truck fuel savings, ₹500/hr billing savings). The Product Owner previously reviewed this component and mandated its complete removal to streamline the marketing layout and prevent speculative mathematical claims from being shown to prospective customers.
2. **`FF-ISSUE-012` (Toast Z-Index Stacking & Rapid Dismissal):** Global notification toasts render behind modal backdrops during form validation failures (e.g., GSTIN validation errors or credit limit warnings inside modal dialogs), and vanish within 4.5 seconds before users can read the error message. Furthermore, toasts currently lack mouse hover pause/resume behavior, resulting in alerts dismissing while users attempt to read or copy error text.

### Current Issue Status in Master Registry ([`docs/testing/ISSUE_INDEX.md`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/docs/testing/ISSUE_INDEX.md))
- **`FF-ISSUE-002`:** Line 73 — Status: `Observed / Approved for Future Design` (Priority: `Low`, Module: `Public Marketing Pages`). **Status in code: UNRESOLVED.**
- **`FF-ISSUE-012`:** Line 83 — Status: `Observed` (Priority: `High`, Module: `Global Toast Notifications & Modal Dialogs`). **Status in code: UNRESOLVED.**

---

## 2. Current Git Branch and Working-Tree Status

- **Current Branch:** `main` (up to date with `origin/main`).
- **Working-Tree Preservation:**
  - All pre-existing working-tree changes from completed Batches E1–E4 (pricing, trial duration, feature gating, payment idempotency) and Batch E5 (company module preferences, Super Admin overview, `BATCH_E5_AUDIT_REPORT.md`) are preserved intact.
  - No files have been staged, committed, pushed, reset, stashed, cleaned, or reverted.
  - Zero modifications to application source code or tests were made during this preflight.

---

## 3. Authoritative Scope & Issue Analysis

### 3.1 `FF-ISSUE-002`: Public Fleet ROI Calculator Removal
- **Goal:** Completely remove the interactive "Fleet ROI Calculator" widget from [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx).
- **Scope Boundaries:**
  - Remove only the calculator-specific state, constants, and `<section>` markup.
  - Preserve all surrounding landing page sections: Hero section (with "Start Free 7-Day Trial" CTA), Value Pillars grid, Social Proof section ("Join 500+ fleet operators across India"), Primary CTA section, and [`PublicLayout`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/layout/PublicLayout.tsx) wrapper.
  - Ensure zero broken navigation anchor links or orphan styles.

### 3.2 `FF-ISSUE-012`: Toast Z-Index Portal, Duration & Hover Pause
- **Goal:** Harden the global toast notification system across styling, store defaults, and component lifecycles.
- **Scope Boundaries:**
  1. **Z-Index Stacking & Stacking Context Isolation:**
     - Elevate `.toast-container` z-index so it unconditionally outranks modal backdrops (`z-index: 1100`), drawers (`z-index: 1000`), mobile navigation (`z-index: 1050`), and overlays (`z-index: 1040`).
     - Render `ToastContainer` via `ReactDOM.createPortal(..., document.body)` to escape any potential ancestor stacking contexts or overflow containment in `#root`.
  2. **Differentiated Dismissal Durations:**
     - Error toasts (`type === 'error'`) must default to **6000ms** (6.0 seconds), giving users adequate time to read validation and API error details.
     - Non-error toasts (`success`, `warning`, `info`) preserve existing default duration (**4500ms**).
     - Explicit duration overrides passed by callers (e.g. `duration: 10000`) must continue to be respected.
  3. **Hover Pause / Resume Mechanism:**
     - Hovering (`onMouseEnter`) over an active toast must immediately pause the auto-dismiss timer.
     - Moving the cursor away (`onMouseLeave`) must resume the timer with the **exact remaining time**, rather than resetting the clock or prematurely dismissing the toast.
     - Component unmount or explicit dismissal click (`X`) must cleanly clear any pending timer instances.

---

## 4. Source-Code Findings with Exact Locations

| File Path | Component / Layer | Relevant Lines | Observation & Evidence |
| :--- | :--- | :--- | :--- |
| [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx) | Page / Marketing Landing | Lines 10, 62–69, 204–253 | `useState(10)` hook for `fleetSize`, hardcoded savings math (`hoursPerTruckPerMonth = 4`, `hourlyRate = 500`, `fuelSavingPerTruck = 3000`), and dedicated `<section>` containing the slider and savings display. |
| [`frontend/src/styles/components/toasts.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/toasts.css) | Stylesheet / Toasts | Line 12 | `.toast-container { z-index: var(--z-toast, 1000); }`. Falls back to `1000` because `--z-toast` is undefined in design tokens. |
| [`frontend/src/styles/components/modals.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/modals.css) | Stylesheet / Modals | Line 16 | `.modal-backdrop { z-index: 1100; }`. Since `1100 > 1000`, active modals completely obscure toasts. |
| [`frontend/src/styles/tokens/variables.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/tokens/variables.css) | Design Tokens / Master CSS | Lines 104–124 | Lacks a token definition for `--z-toast`. |
| [`frontend/src/stores/uiStore.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/stores/uiStore.ts) | State Store / Toast Queue | Line 67, Lines 89–98 | `addToast` sets `duration: toast.duration || 4500` uniformly for all toast types. Error toasts do not receive extended visibility. |
| [`frontend/src/components/common/ToastContainer.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/ToastContainer.tsx) | Component / Toast Renderer | Lines 33–41, Lines 80–92 | `ToastItem` uses a static `useEffect` with `setTimeout(..., toast.duration)`. Has no `onMouseEnter` / `onMouseLeave` listeners. `ToastContainer` renders in-DOM without `createPortal`. |
| [`frontend/src/App.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/App.tsx) | App Root / Router | Line 291 | `<ToastContainer />` is rendered directly inside `<BrowserRouter>` under `#root`. |

---

## 5. Root-Cause Analysis Supported by Code Evidence

### 5.1 Root Cause of `FF-ISSUE-002` (ROI Calculator Present)
During initial promotional landing page design, an interactive slider was embedded into `HomePage.tsx` to simulate operational savings. In production governance reviews, transport operations experts noted that fuel savings and billing hours vary dramatically between fleet types (e.g. bulk tankers vs parcel express vs container haulage), rendering the generic calculation mathematically speculative. The section was retained in code awaiting cleanup under Batch E.

### 5.2 Root Cause of `FF-ISSUE-012` (Toast Z-Index & Dismissal Flaws)
1. **Z-Index Inversion:**
   - In `toasts.css` (line 12), `.toast-container` declares `z-index: var(--z-toast, 1000)`.
   - In `modals.css` (line 16), `.modal-backdrop` declares `z-index: 1100`.
   - In `shell.css` (line 144, 317), mobile drawer overlays declare `z-index: 1040` and `z-index: 1050`.
   - Because `1000 < 1040 < 1050 < 1100`, any modal or mobile drawer automatically renders above the toast container.
2. **Stacking Context Vulnerability:**
   - `<ToastContainer />` currently mounts inside `<BrowserRouter>` in `App.tsx` within the standard DOM tree under `#root`. If an ancestor container utilizes CSS `transform`, `filter`, or `perspective`, a local stacking context is created that traps fixed children. Portaling to `document.body` is required to ensure top-level viewport rendering.
3. **Hardcoded Uniform Dismissal:**
   - In `uiStore.ts` (line 67), `duration: toast.duration || 4500` applies to all toasts. Detailed validation messages (such as multi-party GSTIN errors or credit limit warnings) require at least 6 seconds to read.
4. **Lack of Timer Interactivity:**
   - In `ToastContainer.tsx` (lines 33–41), the timer is launched immediately on mount and cannot be paused. When a user hovers over the notification to read complex error text, the timer expires and destroys the toast component under their cursor.

---

## 6. Proposed Implementation Phases

### Phase E6.1 — Remove Fleet ROI Calculator from Homepage (`FF-ISSUE-002`)
- **Target File:** [`frontend/src/pages/marketing/HomePage.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/pages/marketing/HomePage.tsx)
- **Modifications:**
  1. Remove state variable `const [fleetSize, setFleetSize] = useState(10);` (line 62).
  2. Remove calculator constants: `hoursPerTruckPerMonth`, `hourlyRate`, `fuelSavingPerTruck`, and `totalSavings` (lines 64–69).
  3. Remove the entire `ROI CALCULATOR` `<section>` block (lines 204–253).
  4. Remove `useState` from the `react` import if not required by other sections.
  5. Retain `ArrowRight` in `lucide-react` imports (it remains in use in the Hero CTA button).
  6. Confirm that the transition between the Value Pillars section and the Social Proof section is visually seamless.

### Phase E6.2 — Fix Toast Z-Index & Portal Stacking Context (`FF-ISSUE-012`)
- **Target Files:**
  - [`frontend/src/styles/tokens/variables.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/tokens/variables.css)
  - [`frontend/src/styles/components/toasts.css`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/styles/components/toasts.css)
  - [`frontend/src/components/common/ToastContainer.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/ToastContainer.tsx)
- **Modifications:**
  1. In `variables.css`, add explicit z-index token:
     ```css
     --z-toast: 9999;
     ```
  2. In `toasts.css`, ensure `.toast-container` utilizes the token with a fail-safe fallback:
     ```css
     .toast-container {
       position: fixed;
       bottom: 1.5rem;
       right: 1.5rem;
       display: flex;
       flex-direction: column;
       gap: 0.75rem;
       z-index: var(--z-toast, 9999);
       pointer-events: none;
       max-width: 26rem;
       width: calc(100vw - 3rem);
     }
     ```
  3. In `ToastContainer.tsx`, wrap the rendered container with `ReactDOM.createPortal(..., document.body)`:
     ```tsx
     import ReactDOM from 'react-dom';
     
     export const ToastContainer: React.FC = () => {
       const { toasts, removeToast } = useUiStore();
       if (toasts.length === 0) return null;
       
       return ReactDOM.createPortal(
         <div className="toast-container" aria-live="polite">
           {toasts.map((toast) => (
             <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
           ))}
         </div>,
         document.body
       );
     };
     ```
     This completely isolates the toast notifications from `#root` and ensures they render at the root of `document.body` above all modals (`z-index: 1100`).

### Phase E6.3 — Fix Error Toast Duration & Hover Pause/Resume (`FF-ISSUE-012`)
- **Target Files:**
  - [`frontend/src/stores/uiStore.ts`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/stores/uiStore.ts)
  - [`frontend/src/components/common/ToastContainer.tsx`](file:///c:/Users/vishh/OneDrive/Desktop/Work/TransportManagement/frontend/src/components/common/ToastContainer.tsx)
- **Modifications:**
  1. In `uiStore.ts`, update `addToast` default duration calculation:
     ```typescript
     const defaultDuration = toast.type === 'error' ? 6000 : 4500;
     const newToast: Toast = { ...toast, id, duration: toast.duration || defaultDuration };
     ```
     Preserve custom caller-provided `toast.duration` overrides when provided.
  2. In `ToastContainer.tsx`, update `ToastItem` to maintain remaining duration on hover:
     ```tsx
     const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({
       toast,
       onDismiss,
     }) => {
       const [isPaused, setIsPaused] = React.useState(false);
       const remainingTimeRef = React.useRef(toast.duration || 4500);
       const startTimeRef = React.useRef<number>(Date.now());
       const timerIdRef = React.useRef<NodeJS.Timeout | null>(null);

       const clearCurrentTimer = () => {
         if (timerIdRef.current) {
           clearTimeout(timerIdRef.current);
           timerIdRef.current = null;
         }
       };

       const startTimer = (durationMs: number) => {
         clearCurrentTimer();
         if (durationMs <= 0) {
           onDismiss(toast.id);
           return;
         }
         startTimeRef.current = Date.now();
         timerIdRef.current = setTimeout(() => {
           onDismiss(toast.id);
         }, durationMs);
       };

       // Mount & initial timer start
       React.useEffect(() => {
         if (toast.duration && toast.duration > 0) {
           startTimer(remainingTimeRef.current);
         }
         return () => clearCurrentTimer();
       }, [toast.id, onDismiss]);

       const handleMouseEnter = () => {
         if (!toast.duration || toast.duration <= 0) return;
         clearCurrentTimer();
         const elapsed = Date.now() - startTimeRef.current;
         remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
         setIsPaused(true);
       };

       const handleMouseLeave = () => {
         if (!toast.duration || toast.duration <= 0) return;
         setIsPaused(false);
         startTimer(remainingTimeRef.current);
       };

       return (
         <div
           className={`toast toast-${toast.type}`}
           role="alert"
           onMouseEnter={handleMouseEnter}
           onMouseLeave={handleMouseLeave}
           style={{ cursor: isPaused ? 'default' : undefined }}
         >
           {/* icon, content, close button */}
         </div>
       );
     };
     ```
  3. Ensure that clicking the manual close button (`X`) triggers `clearCurrentTimer()` and `onDismiss(toast.id)`.

### Phase E6.4 — Automated Verification, Builds & Documentation Updates
- **Tasks:**
  1. Execute frontend production build: `npm --prefix frontend run build` (`tsc -b && vite build`).
  2. Execute backend typecheck: `npx tsc --noEmit`.
  3. Execute cumulative regression test suites across Batches E1–E5 (109 tests).
  4. Create `docs/testing/audit/BATCH_E6_AUDIT_REPORT.md` documenting the acceptance audit.
  5. Update `docs/testing/ISSUE_INDEX.md` marking `FF-ISSUE-002` and `FF-ISSUE-012` as resolved under Batch E6.

---

## 7. Explicit Acceptance Criteria for Each Issue

### Acceptance Criteria for `FF-ISSUE-002` (ROI Calculator Removal)
- [ ] Fleet ROI Calculator component, slider input, and savings display are completely removed from `frontend/src/pages/marketing/HomePage.tsx`.
- [ ] `fleetSize` state and calculation constants are removed with zero unreferenced variables or linter warnings.
- [ ] All surrounding landing page sections (Hero, Value Pillars, Social Proof, CTA) render without visual distortion or gap defects.
- [ ] No broken anchor links (e.g. `#calculator`, `#roi`) exist in the header, navbar, or footer.

### Acceptance Criteria for `FF-ISSUE-012` (Toast Z-Index & Hover Pause)
- [ ] `.toast-container` has a z-index of `9999` (or `var(--z-toast, 9999)`), strictly higher than `.modal-backdrop` (`1100`) and all navigation shell elements (`1040/1050`).
- [ ] `ToastContainer` renders in `document.body` via `createPortal`, avoiding any ancestor stacking context trapping.
- [ ] When a validation error occurs inside an open modal dialog, the toast notification displays visibly and fully clickable above the modal backdrop.
- [ ] Error toasts (`type === 'error'`) remain visible for at least 6000ms by default before auto-dismissing.
- [ ] Non-error toasts (`success`, `warning`, `info`) preserve their default 4500ms duration.
- [ ] Explicit duration overrides passed by callers continue to be respected.
- [ ] Hovering the mouse cursor over any toast immediately pauses the countdown.
- [ ] Moving the mouse cursor away resumes the countdown with the exact remaining time.
- [ ] Manual dismissal via the close button (`X`) dismisses the toast immediately and cleans up memory timers.

---

## 8. Regression-Test Strategy and Manual Browser Acceptance Checklist

### 8.1 Build & Automated Regression Strategy
1. **Frontend Compilation & Bundle Integrity:**
   - Execute `npm --prefix frontend run build` to verify zero TypeScript errors and clean Vite chunk generation.
2. **Backend Integrity:**
   - Execute `npx tsc --noEmit` in `backend` to ensure backend routes and middleware remain untouched.
3. **Cumulative Regression Suites:**
   - Run Vitest suites for Batches E1–E5:
     ```powershell
     npx vitest run src/tests/integration/phase5BatchE1TrialSecurity.test.ts src/tests/integration/phase5BatchE2FeatureGating.test.ts src/tests/integration/phase5BatchE3PaymentIdempotency.test.ts src/tests/integration/phase5BatchE4PricingGstSecurity.test.ts src/tests/integration/phase5SubscriptionGating.test.ts src/tests/integration/phase5BatchE5CompanyModules.test.ts
     ```
     Target: All 109 cumulative tests must continue passing (100%).

### 8.2 Manual Browser Acceptance Checklist (Human QA)
Because headless Playwright driver binaries are restricted in this environment, interactive browser validation will be performed against the running Vite dev server (`http://localhost:5173`):

1. **Homepage Check (`FF-ISSUE-002`):**
   - [ ] Navigate to `http://localhost:5173/`.
   - [ ] Scroll down from Hero section through Value Pillars ("3-Part Lorry Receipts", "Live GPS Tracking", etc.).
   - [ ] Confirm the "Fleet ROI Calculator" slider section is completely gone.
   - [ ] Confirm the page flows smoothly into the Social Proof ("Join 500+ fleet operators across India") and CTA sections.
2. **Modal Toast Stacking Check (`FF-ISSUE-012`):**
   - [ ] Log in as a Company Admin (`vishh8630@gmail.com`).
   - [ ] Navigate to Master Registries > Parties (`/parties/billing-parties`).
   - [ ] Click "Add Customer" to open the customer modal dialog.
   - [ ] Enter an invalid GSTIN or trigger a required field validation error.
   - [ ] Verify the error toast alert appears **in front of** the modal backdrop and is completely unobscured.
3. **Toast Duration & Hover Pause Check (`FF-ISSUE-012`):**
   - [ ] Verify an error toast remains visible for approximately 6 seconds without user intervention.
   - [ ] Trigger an error toast and immediately place the mouse cursor over the toast card.
   - [ ] Keep the cursor hovered for >10 seconds; verify the toast does NOT auto-dismiss while hovered.
   - [ ] Move the cursor off the toast; verify the toast resumes counting down and dismisses smoothly after the remaining duration expires.
   - [ ] Trigger a success toast (e.g. updating profile or saving a setting); verify it dismisses after ~4.5 seconds.
   - [ ] Click the `X` button on any toast; verify it dismisses immediately.

---

## 9. Risks, Dependencies, and Compatibility Concerns

1. **Portaling in React 19:**
   - Fleet Flow utilizes React 19 (`"react": "^19.0.0"` in `frontend/package.json`). `ReactDOM.createPortal` requires `react-dom`. We must ensure standard portal rendering is SSR/hydration-safe by verifying `typeof document !== 'undefined'`.
2. **Timer Drift & Component Unmounting:**
   - If a toast is paused, remaining time must be calculated using high-resolution timestamp arithmetic (`Date.now()`). Timers must be stored in `useRef` to avoid memory leaks or stale closure bugs when toasts are rapidly added or cleared.
3. **Preservation of E1–E5 Shared Components:**
   - Batches E1–E5 modified `BillingPage.tsx`, `Sidebar.tsx`, `FeatureGate.tsx`, `CompanySettingsPage.tsx`, and `SuperAdminDashboardPage.tsx`. Changes in E6 are strictly confined to `HomePage.tsx`, `toasts.css`, `variables.css`, `ToastContainer.tsx`, and `uiStore.ts`. Zero overlap with previous batch logic.

---

## 10. Out-of-Scope Items and Stop Conditions

### Explicitly Out of Scope for Batch E6
- Do not modify backend billing controllers, plans, or subscription models.
- Do not modify company module preferences (`Company.settings.enabled_modules`) or Super Admin overview (completed in E5).
- Do not modify unrelated public marketing pages (`FeaturesPage.tsx`, `PricingPage.tsx`, `SecurityPage.tsx`).
- Do not modify existing modal components (`Modal.tsx`, `CreditLimitWarningModal.tsx`) beyond standard CSS inheritance.
- Do not alter the 5-driver trial cap (remains unresolved per preflight reviews).

### Stop Condition
This preflight review is **strictly documentation-only**. No application source code, styling, or tests have been modified in this step. Await explicit authorization from the Product Owner before proceeding with Phase E6 implementation.

---

## 11. Final Recommendation & Authorization Gate

### Preflight Recommendation: **`ACCEPT`**
The root causes and technical implementations for `FF-ISSUE-002` and `FF-ISSUE-012` are forensically isolated and fully specified. Implementing Batch E6 will resolve all remaining issues assigned to canonical Batch E.

**Awaiting explicit Product Owner authorization to proceed with Batch E6 implementation.**
