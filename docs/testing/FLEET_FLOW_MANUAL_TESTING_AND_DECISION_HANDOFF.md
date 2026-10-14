# Fleet Flow — Manual Testing, Findings, Decisions & Handoff
**Document type:** Consolidated testing and product-design handoff  
**Project:** Fleet Flow — Transport Management SaaS  
**Status:** Manual testing paused/completed for this round; fixes and additional testing are pending  
**Last updated:** 15 October 2026  
**Implementation status:** No implementation changes authorized by this document

---

## 1. Purpose and how to use this document

This document consolidates the Fleet Flow work recorded during the current manual-testing round: observed defects, suspected defects, UX issues, unanswered workflow questions, approved design decisions, security concerns, and future implementation requirements.

It is intended to be the handoff/reference document for the next phase. It is **not** a claim that every issue has been reproduced, root-caused, or fixed. The distinction between observed behavior, hypothesis, intended behavior, and verified behavior must be preserved.

### Current status
- The user has finished the current round of manual testing and plans to test again after the recorded issues are addressed.
- The next activity should be to organize and prioritize the issues, then inspect the relevant code/tests before implementation.
- Do not silently begin a new implementation batch, change code, commit, or push. Obtain explicit authorization before implementation.
- Do not treat design decisions in this document as proof that the current code already implements them.
- The audit trail includes some previously reused/conflicting `FF-MT` issue IDs. The final issue register below uses descriptive temporary IDs where necessary; reconcile them with repository/audit documentation before assigning canonical IDs.

---

## 2. Project context and governance

### Product
Fleet Flow is a transport-management SaaS for transport operators, with operational, fleet, trip, commercial, financial, subscription, tenant-administration, and notification features.

### Known technology context
Previously recorded project context indicates:
- Backend: Node.js, TypeScript, Express, MongoDB/Mongoose.
- Frontend: React/TypeScript/Vite in the current app context; Next.js was also mentioned in earlier project context. Confirm the actual active frontend architecture during the later code audit rather than assuming all historical stack references describe the same runtime.
- Automated tests include Vitest, Supertest, MongoDB Memory Server, tenant-isolation tests, file-storage security tests, and financial invariant tests.
- Batch 1 and later batches added security, transactional, accounting and regression protections. Prior reports recorded 135 passing backend tests and successful production builds after Batch 3, but these historic results do not establish that all issues in this document are fixed or that the current checkout is unchanged.

### Governance and approved boundaries
- DEC-003 (production S3/object-storage enforcement) remains **pending approval**.
- Batch 4 scope was previously recorded as not started.
- Batches 1–5 and 6A, 6B, 6C were previously recorded as accepted; retain documented runtime-verification and disaster-recovery limitations.
- Do not start a new batch or make code changes without explicit authorization.
- A future separate task is to ask Antigravity to create a calculation reference `.md` after inspecting actual code and tests. That is not the same as this consolidated manual-testing handoff and has not been performed here.
- The current user request authorizes creation of this Markdown handoff document, not application-code changes.

### Relevant prior architectural/financial work (historical context)
- DEC-001 Fleet Flow pricing/quota matrix was approved on 2026-10-14:
  - Trial: 7 days.
  - Starter: ₹1,999/month and ₹19,990/year; 15 trucks, 1 branch, 2 users.
  - Standard: ₹3,999/month and ₹39,990/year; 30 trucks, 3 branches, 5 users.
  - Pro: ₹8,999/month and ₹89,990/year; unlimited trucks subject to documented policy.
  - Confirm the full approved matrix in its source decision record before implementation; do not reconstruct missing details from this abbreviated summary.
- DEC-002: mandatory replica sets across Dev, CI, Staging and Production, automated `rs0` Docker Compose initialization, in-memory replica sets for tests, and fail-fast behavior on standalone MongoDB instances.
- DEC-003 remains pending as noted above.
- Batch 2 follow-up verified crash-safe idempotency for financial mutations under the reviewed scenario: reservation and business transaction coordinated in a multi-document ACID transaction with `COMMITTED` status; retries were reported idempotent.
- Batch 3 addressed credit-note balance reduction/schema mismatch, one-sided vendor payouts/party-balance reconciliation, missing double-entry accounting invariant tests, and missing Credit Notes frontend route/page. A later review recorded 27 phase-3 financial invariant tests and 135 backend tests passing at that time.
- A GSTIN checksum implementation/specification (Luhn Mod-36) was documented in prior work. Duplicate GSTIN validation is still a separate concern and was not established by that checksum work.

---

## 3. Current testing outcome

The user has finished this manual-testing round and wants to address the issues before testing again.

### What this means
1. The findings below are ready for triage and code-level audit.
2. Do not claim a defect is fixed simply because a UI message or route appears to work.
3. For each issue, later work should capture: reproduction steps, actual result, expected result, root cause, relevant API/model/component, security/financial impact, fix, automated tests, manual verification, and residual limitations.
4. Re-test previously intermittent issues after the other fixes, as requested for the Incognito session/data-loading problem.

---

## 4. Consolidated issue register

### Issue ID reconciliation note
Earlier assistant messages reused some IDs. Original items FF-MT-001 through FF-MT-020 were established first. Subsequent entries sometimes reused FF-MT-021, FF-MT-022, FF-MT-023, FF-MT-024, and FF-MT-026 for different issues. To avoid pretending that the old numbering is reliable, this register uses **descriptive labels**. Reconcile canonical IDs during formal issue triage; preserve links to original notes if available.

Priority meanings:
- **Critical:** plausible direct risk to financial integrity, tenant security, or core operational correctness.
- **High:** core workflow blocked or potentially unsafe/inaccurate.
- **Medium:** material usability, workflow, or clarity issue.
- **Low:** visual consistency or minor usability issue.

Status vocabulary:
- **Observed:** directly reported/shown in manual testing.
- **Suspected:** symptom observed, root cause not proven.
- **Needs verification:** design/workflow is unclear or only partially tested.
- **Design direction agreed:** desired future behavior has been agreed but is not implemented/verified by this note.

### A. Public site, onboarding, subscription and shared UI

#### FF-MT-001 — Inconsistent public-site color scheme
- **Priority:** Medium
- **Observed:** Public pages use dark/gradient/multicolor styling that differs from the preferred Sign In, Start Free Trial and logged-in dashboard UI.
- **Expected:** A coherent design system consistent with the preferred auth/dashboard appearance.
- **Notes:** Avoid overdecorated gradients and inconsistent palettes.

#### FF-MT-002 — Trial duration is inconsistent
- **Priority:** High
- **Observed:** The product decision is a 7-day trial, but homepage/registration and logged-in dashboard displayed “14 Days Free Trial Left”; pricing FAQ reportedly says 7 days.
- **Expected:** One consistent 7-day trial policy across UI, backend trial provisioning, countdowns and tenant records.
- **Needs verification:** Whether the backend also creates 14-day trials or only the UI is wrong. Check date calculations/time zones and existing seeded tenant data.

#### FF-MT-003 — Unwanted Fleet ROI Calculator
- **Priority:** Low
- **Observed/design preference:** User does not want a public-facing Fleet ROI calculator.
- **Expected:** Remove it from public pages if still present, subject to implementation authorization.

#### FF-MT-004 — Homepage too dense and includes unverified claims
- **Priority:** Medium
- **Observed:** Excessive homepage content and metrics/claims that may not be verified.
- **Expected:** Concise, credible marketing content; do not invent metrics or customer claims.

#### FF-MT-005 — Features page too dense
- **Priority:** Medium
- **Observed:** Features page feels overcrowded.
- **Expected:** Better grouping and concise descriptions.

#### FF-MT-006 — Pricing page needs redesign
- **Priority:** Medium
- **Observed:** Pricing visual style is inconsistent with preferred auth/dashboard UI.
- **Expected:** Clear pricing hierarchy, restrained design, transparent limits and terms.

#### FF-MT-007 — Pricing FAQ should be collapsible
- **Priority:** Low
- **Observed/design preference:** Pricing FAQ should use dropdown/collapsible questions.

#### FF-MT-008 — Security page too detailed
- **Priority:** Medium
- **Observed:** Security page is overly detailed for a top-level marketing page.
- **Expected:** Concise overview plus a separate detailed policy; preserve factual accuracy and do not remove legally important information.

#### FF-MT-009 — Help Center and Contact pages may be redundant
- **Priority:** Medium
- **Observed/needs verification:** Pages appear redundant, but no complete section-by-section comparison has been recorded.
- **Expected:** Give each page a clear purpose; confirm content before merging/removing anything.

#### FF-MT-010 — Auth pages lack navbar/footer
- **Priority:** Medium / design decision to review
- **Observed:** Navbar/footer absent on auth pages.
- **Notes:** This was logged as a design question, not necessarily a defect. Decide deliberately based on conversion, distraction and layout consistency.

#### FF-MT-011 — Company-level feature access management unclear
- **Priority:** Medium
- **Observed/needs verification:** User wants a workspace-admin capability to control which features/modules are available to a particular company. Admin panel had not been fully explored at time of original finding.
- **Expected:** Separate subscription entitlements, company configuration and user permissions; do not rely on frontend hiding alone.

#### FF-MT-012 — PRO-locked modules may still be accessible
- **Priority:** High
- **Observed:** Maintenance & Repairs opened its full module despite PRO labeling/lock indication; Tyre Management was also reported to behave similarly, but no destination screenshot was recorded for it.
- **Expected:** If plan does not include the feature, show the intended upgrade/lock experience and enforce entitlement on backend endpoints.
- **Needs verification:** UI-only vs server-side enforcement.

#### FF-MT-013 — Support Ticket creation form layout is poor
- **Priority:** Medium
- **Observed:** Form is poorly aligned/spaced, spans a huge horizontal area, fields look unpolished, and an empty state is visible beneath the form.
- **Expected:** Reusable, compact, responsive form layout with consistent field boundaries, spacing, labels and button alignment.

#### FF-MT-014 — Support Ticket conversation layout is poor
- **Priority:** Medium
- **Observed:** Conversation message bubbles and reply input are pushed far to the right, with excessive empty space.
- **Expected:** Balanced two-pane layout or responsive ticket list/detail layout; conversation and reply composer should use available width appropriately.

#### FF-MT-015 — Deletion confirmation uses native browser confirm
- **Priority:** Medium
- **Observed:** Deleting vehicle `MH29KL23` showed a browser-native confirmation: “localhost:5173 says Are you sure you want to remove vehicle MH29KL23?”
- **Expected:** Consistent in-app confirmation modal, preserving accessible focus behavior and explicit destructive-action confirmation.
- **Needs verification:** `window.confirm()` is a hypothesis, not confirmed.

#### FF-MT-016 — Dropdown UI looks inconsistent/native
- **Priority:** Medium
- **Observed:** Dropdown such as “SELECT COMMERCIAL DRIVER” looks unstyled/inconsistent.
- **Expected:** Consistent accessible dropdowns, keyboard navigation, focus states and mobile behavior.
- **Needs verification:** Native `<select>` is a hypothesis, not confirmed.

#### FF-MT-017 — Assignment data does not refresh automatically
- **Priority:** High
- **Observed:** After assigning a driver to a truck, list/detail remained Unassigned until browser refresh. Similar stale display occurred on driver page.
- **Expected:** Mutations should update/invalidate client state and refetch relevant data so the UI reflects the saved state without a hard reload.
- **Root cause unconfirmed:** Could be cache/state/refetch issue.

#### FF-MT-018 — Old and new driver both appear assigned to same truck
- **Priority:** Critical
- **Observed:** Sameer Khan and Rahul Singh detail pages both showed `MH29KL23` as current assignment / “Currently Driving.” Truck audit showed Rahul assigned active on 2026-10-14 and Sameer assigned then unassigned that date. MongoDB record was reported to show Sameer `unassigned_at: 2026-10-14T16:37:43.425Z`, Rahul active, and `current_driver_id` Rahul.
- **Expected:** One authoritative active driver assignment per truck where that is the domain rule; ended assignments must not appear as current.
- **Needs verification:** Whether driver detail uses stale data or ignores ended assignments. Treat as serious operational misrepresentation until resolved.

#### FF-MT-019 — Error toast hidden behind modal / disappears too quickly
- **Priority:** High
- **Observed:** GSTIN validation toast appeared behind a modal (z-index is a hypothesis) and disappeared quickly. User wants hover over a toast to keep it visible until pointer leaves.
- **Expected:** Notifications visible above dialogs, appropriate lifetime, pause-on-hover, keyboard/accessibility support and clear validation errors. Avoid relying only on transient toast for important form errors.

#### FF-MT-020 — Duplicate GSTIN accepted for separate billing parties
- **Priority:** High
- **Observed:** Two customer records (Essar LTD and Reliance Retail LTD) were created with the same GSTIN `27AAPFU0939F1ZV`.
- **Expected:** Define and enforce GSTIN uniqueness at the correct tenant/entity scope, with backend validation and useful UI errors.
- **Caution:** The sample GSTIN used in testing was not verified as an active real GSTIN. Same PAN may legitimately have multiple GSTINs across states; uniqueness policy must account for that. Do not conflate checksum validation with duplicate validation.

### B. Validation, financial balances, stale state and editing

#### Driver duplicate identifier validation
- **Priority:** High
- **Observed:** Multiple driver records accepted the same Aadhaar number and mobile number.
- **Expected:** Define uniqueness and normalization rules per tenant and entity. Aadhaar is sensitive personal data: minimize collection, protect it and avoid exposing it unnecessarily. Mobile-number uniqueness may require policy nuance (shared family/company numbers can exist).
- **Needs verification:** Backend uniqueness and race-condition behavior.

#### Category/badge styling inconsistency
- **Priority:** Low
- **Observed:** Vehicle Broker category had an orange badge, while Truck Supplier appeared as plain text.
- **Expected:** Shared, consistent category badge design across the app.
- **Related:** cash expense categories, payment modes, trip statuses, Market Movement statuses.

#### Opening balance edit not reflected in current balance
- **Priority:** High
- **Observed:** User edited the opening balance for Divyanshi Road Lines; the form displayed ₹26,000 despite the user's intended value being described as ₹25,000, and the list still showed ₹0 current balance.
- **Expected:** Clearly distinguish opening balance, current balance and ledger-derived balance; saved values should refresh correctly.
- **Needs verification:** Exact entered value, persistence, calculation and display semantics.

#### Estimated Transit Days input cannot clear zero
- **Priority:** Medium
- **Observed:** In Create Truck Dispatch, the numeric input defaults to zero and user cannot delete the zero; arrow controls work. Other fields work.
- **Expected:** Numeric inputs should allow editing/clearing intermediate values without trapping users at zero, while validation happens on blur/submit.

#### Draft trip still exposes operational actions
- **Priority:** High
- **Observed:** Saving a trip as Draft Plan hides primary action buttons, but tabs still offer Record Diesel Stop, Milestones, Cash Expenses and POD actions.
- **Expected:** Draft trips should not permit routine operational events that require dispatch/active status. Clearly disable or explain ineligible actions; backend must enforce lifecycle rules.

#### Vehicle status stale after dispatch
- **Priority:** High
- **Observed:** After dispatching a truck, vehicle list continued to show Available until browser refresh.
- **Expected:** UI should immediately reflect On Trip/Unavailable after successful dispatch; server state is authoritative.
- **Related:** stale assignment issue and checkpoint refresh issue.

#### Checkpoint missing until browser refresh
- **Priority:** High
- **Observed:** Adding a checkpoint from the trip list, then opening the record, showed the checkpoint missing until page refresh.
- **Expected:** Correct mutation response/state update or refetch invalidation after adding a checkpoint.

#### Cash expense category styling inconsistent
- **Priority:** Low
- **Observed:** Toll/Fastag plain text, Weighbridge grey badge, Loading Assist blue badge.
- **Expected:** Shared category style.

#### Cash expenses cannot be edited to add/replace receipt voucher
- **Priority:** Medium
- **Observed:** No edit action was visible for saved cash expenses; user wants to add/replace voucher later.
- **Expected:** Authorized edit/correction with audit trail, attachment safety, recalculation and appropriate lifecycle restrictions.

#### Fuel stops and milestones cannot be edited
- **Priority:** Medium
- **Observed:** Fuel table had no edit action; user also wants milestone records editable.
- **Expected:** Authorized correction workflow that preserves history, reasons and audit trail rather than silently overwriting operational records.

#### Payment-mode badge inconsistency
- **Priority:** Low
- **Observed:** “Cash Advance” rendered as a green badge, “Fleet Fuel Card” as plain text.
- **Expected:** Consistent payment-mode presentation.

#### Driver cash advance may not be reduced by fuel purchase
- **Priority:** High
- **Observed:** User recorded a ₹10,000 driver advance and a 100L × ₹90 fuel purchase (₹9,000) using Driver Cash Advance. Displayed cash expenses were ₹3,360 and driver cash balance ₹6,640 (₹10,000 − ₹3,360), suggesting the fuel purchase may not be included in advance reconciliation.
- **Expected:** Fuel transactions funded from driver cash advance should deduct exactly once from that advance ledger/balance, with no omission or double-counting.
- **Needs verification:** Ledger semantics, whether the fuel transaction should be part of cash-expense total, and whether the displayed ₹3,360 represented a separate category.

#### Fuel payment mode functional behavior unclear
- **Priority:** High
- **Observed/question:** Modes include Fuel Card (HPCL/BPCL DriveTrack), Pump Vendor Credit (Ledger Slip), Driver Cash Advance. User asked whether selection is only a label or affects financial logic.
- **Expected semantics to verify:**
  - Fuel card: post/reconcile against the appropriate fuel-card ledger/account.
  - Pump vendor credit: create/update supplier payable.
  - Driver cash advance: reduce the driver's available advance.
- **Required:** Each mode must route to the appropriate accounting behavior, preserve references, and avoid duplicate posting. Do not implement formulas until actual ledger rules are audited.

#### Customer/Shipper Billing Party field purpose unclear
- **Priority:** Medium
- **Observed/question:** Optional Customer/Shipper Billing Party field appears on trip creation.
- **Expected:** Clearly define whether it determines invoice customer/receivable, reporting attribution, or other downstream behavior. Ensure it links correctly to freight invoices and customer balances.

#### Driver assignment inconsistency after creating trip
- **Priority:** High
- **Observed:** Trip created using an unassigned vehicle and unassigned driver. Vehicle detail showed Manish Sonar assigned and vehicle On Trip, but driver detail showed the driver in unallocated pool with no assignment history.
- **Expected:** Clearly distinguish a trip-specific driver assignment from a permanent/current vehicle assignment; all views should agree with the chosen domain semantics and history.
- **Needs verification:** Whether this is a display defect or different concepts are being mixed.

### C. Trip lifecycle, driver swaps and operational controls

#### Completed trip remains editable through routine actions
- **Priority:** High
- **Observed:** Trip `JRN-0001` was Completed and signed POD recorded, yet Add Check-In Location, Add Fuel Stop and Cash Expense actions remained available.
- **Expected:** Completed trips should be read-only for routine operations. Authorized late entry/correction should require a reason and leave an audit trail. Backend must enforce this lifecycle state.

#### Trip-status badge inconsistency
- **Priority:** Low
- **Observed:** Completed displayed as a green rounded badge while In Transit appeared as icon/plain text in the journey list.
- **Expected:** Consistent status components with semantic colors and labels.

#### FF-MT-036 — Driver swap safeguards unclear
- **Priority:** High
- **Observed:** Swap Driver button was visible for a vehicle marked On Trip.
- **Design direction:** A legitimate mid-trip handover may be allowed, but direct assignment of a driver who is already on another active trip must be blocked by default unless a dedicated, validated handover workflow is used.
- **Required handover evidence:** time, location, odometer, reason, outgoing/incoming driver, and assignment history. Enforce conflicts on backend.

#### Draft/completed trip state enforcement
- **Priority:** High
- **Summary:** Validate all action endpoints against trip state, not just the visible buttons. Cover Draft, Dispatched/In Transit, Delivered/POD Received, Completed, Cancelled and any other actual states found in code. Avoid inventing statuses without auditing the existing state machine.

### D. Market Vehicle Movement, settlement and accounting clarity

#### FF-MT-039 — Market Vehicle Movement purpose overlaps Trip Dispatch
- **Priority:** Medium
- **Observed/question:** Market Movement is intended for externally hired/broker trucks, distinct from owned-fleet trip dispatch, but UI overlaps with journey/trip functionality.
- **Design intent:** Support third-party/hired trucks with distinct supplier payable settlement from customer receivables.
- **Expected:** Clear explanation and a single coherent lifecycle; avoid duplicate journey/financial records.

#### FF-MT-040 — Market Movement status unclear after POD
- **Priority:** Medium
- **Observed:** POD Status was Received while movement status remained PENDING.
- **Possible intended meaning:** Delivery is complete but supplier settlement is pending.
- **Expected:** Separate delivery/POD status from settlement lifecycle and label them explicitly (e.g. pending settlement, partial settlement, settled) where supported by actual business rules.

#### FF-MT-041 — Market Movement list overcrowded
- **Priority:** Medium
- **Observed:** Too many columns and horizontal clipping; inconsistent status badges.
- **Expected:** Focused list plus detail page with vehicle/driver, supplier, POD, freight, advances/deductions and settlement history.

#### FF-MT-042 — Credit limit, outstanding and current balance semantics unclear
- **Priority:** High
- **Observed/question:** Customer Billing Parties show credit limit/outstanding; Vendor/Balance Parties show current balance. Need to define accounting meaning and how Market Movement changes customer receivables and supplier payables.
- **Arithmetic concern:** A Market Movement example showed freight ₹50,000, driver advances ₹5,000, brokerage ₹1,000 and net due ₹41,000. Simple arithmetic gives ₹44,000, leaving an unexplained ₹3,000 deduction or a potential calculation/display error.
- **Do not label as confirmed calculation bug until verified:** inspect source, other deductions, ledger postings and calculation reference.

#### AR Aging Report visual design and semantics
- **Priority:** Medium
- **Observed:** Colorful summary boxes and blue banner differ from Fleet Flow's preferred style.
- **Expected:** Clean cards, subtle borders and consistent semantic status badges.
- **Functional verification:** Confirm invoice due-date vs invoice-age buckets, payment and credit-note effects, and customer outstanding totals.

#### Driver Settlement numeric inputs cannot clear zero
- **Priority:** Medium
- **Observed:** Wage calculator numeric fields (Driver Wage Rate, Benchmark Mileage, Diesel Price, Other Deductions) cannot clear zero/default values.
- **Expected:** Editable numeric inputs that support intermediate empty state and validate at suitable points.

#### Sidebar active state missing
- **Priority:** Low
- **Observed:** From Dashboard > Driver Payouts, clicking Disburse navigated to Driver Settlements but sidebar did not highlight the active route.
- **Expected:** Sidebar active state should reflect the current route consistently.

#### General Ledger calculation reference document — future task
- **Status:** Not started.
- **Requested future task:** Ask Antigravity to create a Markdown reference (suggested path `docs/CALCULATIONS_REFERENCE.md`) after inspecting the actual source code and tests.
- **Scope should cover:** General Ledger debit/credit, Market Movement formulas, driver settlement wage/mileage/fuel variance/advances/reimbursements, trip fuel/mileage/cash, freight invoices/GST/RCM/charges/payments/outstanding, credit/debit notes, customer/vendor balances, dashboards/reports, and other discovered calculations.
- **For each calculation:** formula, input fields, units, rounding, worked example, source/database fields, trigger events, ledger entries, tests, and whether frontend/backend agree.
- **Rule:** distinguish verified implemented formulas from intended business rules and unresolved discrepancies. Do not invent formulas or modify application code as part of that documentation task.

### E. Branches & Hubs

#### Regional Branch creation form UI
- **Priority:** Medium
- **Observed:** New Regional Branch form is spread over three columns with excessive whitespace; inputs look like plain text due to weak boundaries; actions are not visually integrated. Similar to Support Ticket form.
- **Expected:** Compact responsive form container, consistent input borders/heights/focus, logical grouping and aligned actions.

#### Regional Branch listing UI
- **Priority:** Medium
- **Observed:** After creation, branch appears as mostly uncontained text on a large empty page. Name/code/contact/location/prefix details lack strong grouping. No Edit/Delete action visible in screenshot; absence from entire page is not confirmed.
- **Expected:** Clean cards/table rows with branch name, code, city/state, contact, LR/invoice prefix and explicit actions. Search/filter if many branches.

#### Branches & Hubs — agreed product direction
- **Workspace = company** and its subscription/data context.
- **Branch = operational location within the same company**, not a separate workspace or legal entity by default.
- **Trip dispatch:** each trip should record the branch responsible for managing it.
- **LR/invoice numbering:** support branch-specific sequences where configured.
- **Reporting:** company-wide and branch-wise reporting.
- **Staff permissions:** optional branch-level access restrictions.
- **Single-branch company:** default branch should be selected automatically to avoid unnecessary friction.
- **Hub:** a physical transfer/sorting location may need a separate model if the product supports hub-to-hub logistics; do not assume every branch is a hub.
- **Important:** This is a design direction agreed with the user, not a claim that the current app already supports these integrations.
- **Legal/tax distinction:** Branch-specific document numbering does not itself mean separate legal entity or GST registration.

### F. Notification Delivery Logs

#### Notification Delivery Logs needs functional work
- **Priority:** High
- **Observed screenshot:** Four rows showed WhatsApp events (trip dispatch and settlement payout) with status Sent; summary showed Total Dispatched 4, Delivered Ratio 0%, Failed Deliveries 0, Skipped 0.
- **What is proven:** Current displayed records are marked Sent; summary reports zero deliveries. This alone does not prove provider delivery tracking is broken.
- **Potential explanations:** Test records without delivery receipts, missing/delayed webhooks, metric calculation issue, or provider configuration.
- **Design scope agreed/locked for future work (not implementation authorization):**
  1. Clear lifecycle statuses: Queued, Sending, Sent, Delivered, Failed, Skipped, with provider-specific states mapped carefully.
  2. Provider acknowledgements, delivery/read receipts where supported, delayed/duplicate/out-of-order webhook safety.
  3. Failure codes/reasons, bounded retry/backoff for transient failures, no retries for permanent failures/opt-outs, safe manual retry where authorized, full attempt history.
  4. Complete audit detail: recipient, channel, related business record, event, message preview, status timeline, provider message ID, attempt count, safe error detail, timestamps.
  5. Accurate counters and documented denominator/time range; do not count Sent as Delivered; do not inflate metrics on retries.
  6. Secure/authenticated webhook handling, idempotency, tenant isolation and safe logging.
  7. UI: date range, pagination, detail/attempt view, consistent badges, loading/empty/error states, useful refresh feedback.
- **Acceptance criteria:** test successful delivery, pending receipt, permanent failure, transient failure/retry, duplicate webhook, opt-out, metric accuracy, tenant security, supported event/channel coverage and automated regression tests.
- **Implementation order:** audit existing integration → reliability and idempotency → visibility/metrics → security → controlled provider-backed verification.
- **Out of scope initially:** marketing campaign system, general-purpose messaging inbox, new channels.
- **Current status:** scope locked; implementation not started. No code changes authorized.

### G. Super-Admin, tenant privacy and support impersonation

#### Platform-wide support inbox may be missing
- **Priority:** High / needs verification
- **Observed:** Super-Admin portal sidebar displayed Control Plane & Tenants and SaaS Plans & Catalogs; no central Support Tickets option visible.
- **Observed later:** Clicking Access opens an “Audited Support Impersonation” modal requiring a justification/Ticket ID text, then permits Enter Workspace. Within impersonation, the tenant Support Tickets page shows `TICK-2026-0001` (“Testing ticket”) and conversation messages from Rohit Kumar and Vishal Super Admin; the UI confirmed “Reply sent.”
- **What is confirmed:** Tenant-side ticket interface and at least a partial conversation/reply flow exist. A central cross-tenant platform support inbox has not been located.
- **Expected design:** One shared ticket record/conversation visible to the customer and authorized support team. Central inbox should show tickets across tenants with role controls, status, assignment, priority, response timeline and audit history.
- **Need to verify:** tenant linkage, central inbox, two-way sync, status management (Open/In Progress/Waiting for Customer/Resolved), notifications, tenant isolation.

#### Super-Admin workspace access / impersonation
- **Priority:** High (security design)
- **Observed:** Super-Admin clicked Access, saw an “Audited Support Impersonation” modal with target workspace Farma Logistics, justification field prefilled “Customer support & troubleshooting session,” notice saying temporary access up to 1 hour and amber banner, then entered workspace. Banner stated “Support Impersonation Mode Active: Viewing workspace as Farma Logistics (Audit Actor: …)” and provided Exit Support Session.
- **User concern:** Once inside, Super-Admin can see broad tenant data (trucks, money flow and other business records). User wants protection and workspace-admin control over what Super-Admin can see/do.
- **Agreed design direction:**
  - Customer owns/controls business data; SaaS operator manages platform.
  - Platform Super-Admin gets platform metadata and aggregate telemetry by default, not automatic access to customer business records.
  - Workspace Admin controls and authorizes support access to business data.
  - Support sessions are ticket-linked, scoped, time-limited, revocable and audited.
  - Read-only by default; writes need separately authorized permissions.
  - Sensitive financial data, private documents and personal data require explicit scope/permission, not blanket support access.
  - No self-approval by requesting operator.
  - Backend must enforce authorization on every relevant endpoint; hiding UI is insufficient.
  - Audit request, approver, tenant, justification/ticket, scope, start/end, actions and revocation.
  - If approval is unavailable, ordinary support access remains blocked. If an emergency-break-glass process is later needed, it must be separately designed with independent safeguards and audit.
  - Platform-level actions (subscription, quotas, tenant suspension/reactivation, platform health, security telemetry) remain possible without granting access to business records.
- **Caution:** This observation does not prove that one customer can access another customer's data. It is a separate concern about excessive platform-operator privileges. Previously tested tenant-isolation scenarios passed in some cases; complete coverage remains unproven.
- **Needed audit:** enumerate Super-Admin APIs, inspect read/write endpoints, verify direct API calls cannot bypass UI, inspect file/download paths, tenant filters, session/token invalidation and cross-module authorization tests.
- **Status:** Design direction recorded; implementation not authorized.

#### Access should require workspace-admin approval
- **Priority:** High
- **Observed:** The current Access flow allows the Super-Admin to provide a justification and then enter the tenant workspace. No separate workspace-admin approval was observed in that flow.
- **Expected:** Request → workspace admin reviews tenant, operator, support ticket, requested permissions/duration → approve/reject → time-limited scoped session if approved. Admin can revoke session.
- **Backend requirements:** Bind approval to exact tenant/operator/ticket/scope/expiry; prevent self-approval; reject expired/reused sessions; audit all actions; protect old tokens and direct APIs.
- **Needs verification:** Whether a separate approval mechanism exists elsewhere; screenshot alone does not prove global absence.

### H. Intermittent Incognito authentication/data loading

#### Incognito workspace data/session issue — retest LAST
- **Priority:** High / intermittent
- **Observed sequence:** Invited dispatcher Suraj Singh logged in Incognito and initially saw no data; refresh logged out. Admin also logged out on refresh in Incognito, while normal browser session remained stable. No cookie warning; same `localhost:5173` URL.
- **Later observation:** After additional attempts, both accounts in Incognito could see data and refreshing no longer logged them out.
- **Status:** Intermittent, not consistently reproducible.
- **User explicitly requested:** Keep this bug for the last test.
- **Do not claim root cause.** Possible areas for later investigation include cookie/session handling, token persistence, tenant context initialization, data-fetch race conditions, but these are hypotheses.
- **Retest plan:** After other issues are addressed, test admin and dispatcher in clean Incognito sessions; login, reload each key route, open new tabs, switch workspace if applicable, wait for session refresh, logout/relogin, and check console/network responses. Verify cookie SameSite/Secure/domain settings and backend authentication responses only during authorized code audit.

### I. Approval workflow not triggered for dispatcher-created trip

- **Priority:** High / needs verification
- **Observed:** Dispatcher created a trip using a dispatch ID successfully without an approval request.
- **Expected if configured:** When an enabled approval rule applies to that actor/action, the action should remain pending until approval, with backend enforcement.
- **Needs verification:** Check Pending Approvals → Approval Rules; confirm whether a trip creation/dispatch rule exists, is enabled, applies to dispatcher role and the actual action tested. Trip creation and trip dispatch may be separate actions. Do not call it a confirmed defect until rule applicability is established.

### J. Subscription plan changes blocked

#### Subscription plan-change request fails
- **Priority:** High
- **Observed screenshot:** On `/settings/billing`, clicking plan-change actions produced two toasts:
  1. `x-idempotency-key header is required for this financial mutation`
  2. `Payment window closed. Your plan has not been changed.`
- **Expected:** Valid plan changes should initiate the correct checkout/payment flow; idempotency must be handled correctly; failed attempts must leave current plan unchanged and explain the next step. Local/test billing needs a defined sandbox path if applicable.
- **Root causes unconfirmed:** The first message suggests a missing idempotency header or request construction problem; the second suggests a closed/expired payment window or billing-state restriction. Could be sequential/independent validation errors.
- **Audit tasks:** inspect frontend request construction, backend idempotency middleware, payment-session lifecycle, environment configuration, plan-change transaction and authorization, retry behavior, quota/entitlement updates, downgrade rules, trial-to-paid transitions.
- **Test both upgrade and downgrade** across valid/invalid payment states and repeated requests; ensure no duplicate billing or partial subscription updates.

---

## 5. Approved design decisions (DEC register)

### DEC-001 — Pricing/quota matrix
- **Status:** Approved 2026-10-14.
- Trial 7 days; Starter ₹1,999/month and ₹19,990/year (15 trucks/1 branch/2 users); Standard ₹3,999/month and ₹39,990/year (30 trucks/3 branches/5 users); Pro ₹8,999/month and ₹89,990/year, unlimited trucks subject to documented policy.
- Verify complete canonical decision record for exact details not included in this summary.

### DEC-002 — Replica set requirements
- **Status:** Approved.
- Mandatory replica sets in Dev, CI, Staging, Production; automated `rs0` Docker Compose initialization; in-memory replica sets for tests; fail fast on standalone MongoDB instances.

### DEC-003 — Production S3/object-storage enforcement
- **Status:** Pending approval. Do not implement by implication.

### DEC-004 — Invoice eligibility
- **Status:** Approved design direction.
- Invoice eligible after delivery/POD by default, with authorized early invoicing.

### DEC-005 — Invoice creation paths
- **Status:** Approved design direction.
- Support invoice creation from trip details and from a central Invoices page.

### DEC-006 — Payment allocation
- **Status:** Approved design direction.
- Support both manual and automatic allocation of receipts/payments to invoices.

### DEC-007 — Credit limit
- **Status:** Approved design direction.
- Warn when a credit limit is exceeded; allow an authorized override.

### DEC-008 — Completed-trip corrections
- **Status:** Approved design direction.
- Routine operations become read-only after completion/POD; authorized corrections/late entries require a reason and audit trail.

### DEC-009 — LR ↔ Trip workflow
- **Status:** Approved design direction, implementation not started.
- Generate LR from a trip with available vehicle/driver/route/customer details prefilled.
- Allow multiple LRs per trip.
- Keep standalone LR creation when no trip is assigned yet.
- Separate LR, trip dispatch and delivery/POD statuses.
- Trip detail should show linked LRs and allow opening/downloading.
- Creating an LR must not dispatch the truck automatically.

### DEC-010 — Branches & Hubs product model
- **Status:** Agreed design direction.
- Workspace = company/subscription context; branch = operating location within that company.
- Trip records responsible branch; branch-specific LR/invoice numbering where configured; branch-wise and company-wide reporting; optional branch-level staff permissions.
- Single-branch companies default to their branch.
- Hubs may need separate model for goods transfer/sorting.
- Branch does not imply separate legal entity/GST registration.
- Implementation not authorized by the design agreement alone.

### DEC-011 — Notification Delivery Logs reliability scope
- **Status:** Scope locked; implementation not authorized.
- See Section 4.F for complete scope and acceptance criteria.

### DEC-012 — Tenant privacy and support access
- **Status:** Design direction locked; implementation not authorized.
- Restrict platform Super-Admin access to customer business records by default; workspace-admin-controlled scoped support access; backend enforcement, expiry, revocation and auditing. See Section 4.G.

---

## 6. Cross-cutting design principles

1. **Backend authorization is authoritative.** UI hiding/locking is not security.
2. **Tenant isolation everywhere.** Apply and test tenant scoping on reads, writes, searches, exports, reports, file uploads/downloads, webhooks and background jobs.
3. **Audit sensitive financial and operational changes.** Prefer correction entries and reasons over silent overwrites.
4. **One authoritative state.** Avoid stale or contradictory driver/vehicle/trip assignment data.
5. **Explicit lifecycle rules.** Draft, active, delivered and completed trips should have clear allowed actions, enforced server-side.
6. **No duplicate financial posting.** Idempotency and accounting invariants must cover retries, webhook duplication and concurrent requests.
7. **Accurate status language.** “Sent” is not “Delivered”; “POD Received” is not necessarily “Settlement Complete.”
8. **Consistent UX.** Shared form layouts, inputs, status badges, modals, toasts, loading states and empty states should be used across modules.
9. **Do not invent business formulas.** Inspect actual code, tests and ledger semantics before deciding whether a discrepancy is a bug.
10. **Sensitive data minimization.** Restrict driver identity information, private documents, bank-related information and support-session exposure to the minimum required scope.

---

## 7. Suggested next-phase workflow

The user has paused testing to address issues. The following is a suggested sequence for a separately authorized implementation phase—not permission to begin automatically.

### Phase 1 — Triage and source audit
- Reconcile issue IDs.
- Map each issue to frontend component, API route/controller, model/service and tests.
- Classify each item as confirmed defect, UX defect, product decision, configuration issue, or unresolved hypothesis.
- Establish severity and dependencies.

### Phase 2 — Security and financial correctness
Prioritize:
- Super-Admin/support impersonation access controls and tenant privacy.
- Cross-tenant isolation and authorization.
- Duplicate GSTIN/driver identifier validation policy.
- Driver/vehicle assignment consistency.
- Trip lifecycle enforcement for drafts/completed trips.
- Driver cash advance/fuel posting and Market Movement accounting discrepancies.
- Subscription plan-change idempotency/payment flow.

### Phase 3 — Core workflows and data refresh
- Assignment/vehicle/checkpoint stale UI.
- Branch selection integration, if in authorized scope.
- Approval rule trigger and backend enforcement.
- Editing/correction flows for fuel stops, milestones and cash expenses with audit trails.
- Invoice/receipt/payment allocation workflows as governed by DEC-004–008.

### Phase 4 — Notification reliability and support operations
- Notification delivery tracking, webhooks, retries, metrics, audit and tenant isolation.
- Central support ticket inbox and shared ticket/conversation linkage.
- Workspace-admin approval and revocation for support access.

### Phase 5 — UI consistency
- Public marketing pages.
- Support ticket form/conversation.
- Branch create/list pages.
- Dropdowns, modals, toasts, badges, AR aging, sidebar active states and responsive layouts.

### Phase 6 — Regression and return to manual testing
- Add automated tests for each fixed defect.
- Run full regression, production builds and security/financial invariants.
- Document limitations and evidence.
- Resume manual testing, with the Incognito issue retested last as explicitly requested.

The order may be adjusted after code audit reveals dependencies. Do not bundle unrelated fixes into a batch without approval.

---

## 8. Evidence and confidence rules for the handoff

For every item:
- **Observed** means the user reported or screenshot showed it.
- **Suspected** means symptoms suggest a cause but code/log evidence is missing.
- **Needs verification** means intended behavior or rule applicability is unclear.
- **Approved design direction** means the user agreed to the desired behavior; it does not mean it exists in code.
- **Verified fixed** must only be used after relevant tests and manual confirmation.

Do not infer a source-code defect from a screenshot alone when configuration, data state, provider delivery, authorization rules or stale test fixtures could explain the symptom.

---

## 9. Known open questions to answer during audit

1. Does the trial backend actually provision 7 or 14 days?
2. Are PRO module locks enforced on backend APIs?
3. Which exact endpoints expose Super-Admin access to tenant data, and can access be scoped?
4. Is there a platform-wide support inbox anywhere, and do ticket messages share a single record across tenant/support views?
5. Does an enabled approval rule apply to dispatcher trip creation/dispatch?
6. Why are delivery receipts absent from Notification Delivery Logs, and are summary metrics correct?
7. Why do plan-change requests lack `x-idempotency-key`, and why is the payment window closed?
8. Why are vehicle/driver/checkpoint updates stale until refresh?
9. What are the exact ledger semantics for fuel payment modes, driver advances and Market Movement deductions?
10. What are the correct uniqueness rules for GSTIN, Aadhaar and mobile number, including tenant scope and privacy constraints?
11. What is the exact state machine for trip draft, dispatch, POD and completion?
12. Does branch data currently connect to trips, LR/invoice numbering, reporting and permissions?
13. Can completed trip records be corrected with reason/audit trail, or are operational actions simply left enabled?
14. Is the Incognito auth/data issue a cookie/session issue, tenant-context race, or another cause? Retest last.

---

## 10. Final handoff summary

Fleet Flow's current manual-testing round identified issues across:
- Public pages and subscription messaging.
- Forms, lists, badges, dropdowns, modals and toasts.
- Stale client data and assignment consistency.
- Trip lifecycle and driver handover.
- Billing-party balances, fuel funding, Market Movement and accounting clarity.
- Branches & Hubs scope and integration.
- Notification delivery reliability.
- Platform support ticket management.
- Super-Admin access to customer data and impersonation approval.
- Intermittent Incognito authentication/data loading.
- Subscription plan changes blocked by idempotency/payment-window errors.

Several key product directions are now agreed: branch vs workspace semantics, controlled support impersonation, restricted Super-Admin access, notification reliability scope, invoice/payment policies, LR/trip relationships and completed-trip correction rules.

**Nothing in this document means fixes have been implemented.** The next authorized step should be source-code audit and issue triage, followed by explicitly approved implementation batches with tests and verification evidence.
