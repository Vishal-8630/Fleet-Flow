# Fleet Flow Manual QA Evidence Directory

This directory stores visual evidence (screenshots, network HAR captures, sanitized console logs, and downloaded PDFs) captured during manual testing of the Fleet Flow website and application platform.

---

## 1. Directory Structure Convention

Create a subfolder named after the exact Test Case ID:

```text
docs/testing/evidence/
  ├── README.md
  ├── TRK-001/
  │   ├── TRK-001-20261014-form-filled.png
  │   ├── TRK-001-20261014-save-success.png
  │   └── TRK-001-20261014-detail-view.png
  ├── MKT-003/
  │   ├── MKT-003-20261014-contact-form-500.png
  │   └── MKT-003-20261014-network-payload.png
  └── ...
```

---

## 2. Screenshot File Naming Rules

Always use lowercase filenames following this format:

```text
<TEST-ID>-<YYYYMMDD>-<short-description>.<ext>
```

### Examples
- `TRK-001-20261014-truck-created.png`
- `LR-002-20261014-print-modal.png`
- `INV-004-20261014-duplicate-toast-error.png`
- `MKT-003-20261014-lead-enum-500-error.png`

---

## 3. What to Capture

For each manual test case:
1. **Initial Screen / Form State:** Completed form fields prior to submission.
2. **Action / Transition:** Save/submit button loading spinner or state change.
3. **Outcome / Confirmation:** Success toast, redirect to detail view, or updated table row.
4. **Failure & Error Diagnostics:** If a test fails, capture:
   - Visible error message / toast notification.
   - Browser Developer Tools **Console** tab showing any client-side uncaught exceptions.
   - Browser Developer Tools **Network** tab showing the failing HTTP method, endpoint, status code, and JSON error response.
5. **Redaction Notice:** Never capture or commit production passwords, real Aadhaar numbers, real credit card details, or live client PII. Use the provided synthetic test data.

---

## 4. How to Reference Screenshots in the Master Checklist

In `docs/testing/FLEET_FLOW_COMPLETE_WEBSITE_TEST_CHECKLIST.md`, update the `Screenshot path:` field with a relative Markdown link:

```markdown
- **Screenshot path:** [Evidence Folder](evidence/TRK-001/) | ![Success View](evidence/TRK-001/TRK-001-20261014-truck-created.png)
```
