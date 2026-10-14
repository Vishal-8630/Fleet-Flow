# Company Workspace Module Access Configuration Control Missing

## Metadata

- **ID:** FF-ISSUE-024
- **Category:** Workflow / Configuration
- **Priority:** Medium
- **Status:** Observed / Needs Verification
- **Affected module:** Company Workspace Settings & Entitlements
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-011)
- **Related issues:** [FF-ISSUE-025](FF-ISSUE-025-pro-module-lock-bypass.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

Workspace administrators lack a clear administrative capability to toggle or configure which operational modules (e.g. Maintenance, Tyre Management, Driver PWA, Market Movements) are active for their specific company, conflating subscription tier entitlements with company-level operational preferences.

## 2. Observed behavior

In the workspace settings (`/settings`), there is no granular module management panel. Operators who only run owned fleets cannot disable Market Vehicle Movement; operators who do not manage in-house workshops cannot disable Tyre Management.

## 3. Expected behavior

A clear separation of concerns:
1. **Subscription Entitlements:** Server-enforced tier boundaries based on the subscribed plan (Starter, Standard, Pro).
2. **Company Configuration:** Workspace Admins can enable or disable permitted modules within their subscribed tier to streamline their sidebar and operational forms.

## 4. Reproduction steps

1. Log in as Company Admin.
2. Navigate to Settings (`/settings`).
3. Search for feature or module activation controls.
4. Observe absence of module toggle preferences.

## 5. Impact and risk

Cluttered navigation for small operators who do not utilize complex modules. Confusion between feature gating (upsell) and voluntary operational scoping.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Company schema lacks an `enabled_modules` array, or the frontend settings UI has not exposed an interface to configure company feature preferences.

## 7. Investigation required

- Inspect `backend/src/models/Company.ts` settings schema.
- Check `frontend/src/pages/settings/` for module configuration views.

## 8. Proposed resolution or agreed design

Add an `enabled_modules` field to `Company.settings` allowing workspace admins to toggle non-core features that their plan entitles them to use, dynamically adjusting the sidebar navigation.

## 9. Acceptance criteria

- [ ] Workspace Admins can enable/disable eligible modules in Company Settings.
- [ ] Sidebar dynamically shows/hides modules based on the company's active selection.
- [ ] Disabling a module does not delete historical data associated with it.

## 10. Required tests

- Integration tests verifying company settings update `enabled_modules`.
- Frontend tests verifying sidebar links respond to `enabled_modules` state.

## 11. Dependencies and related issues

- Related to [FF-ISSUE-025](FF-ISSUE-025-pro-module-lock-bypass.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
