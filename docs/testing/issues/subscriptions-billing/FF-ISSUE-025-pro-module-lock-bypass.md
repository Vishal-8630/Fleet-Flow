# PRO-Locked Modules Remain Accessible Despite UI Lock Badges

## Metadata

- **ID:** FF-ISSUE-025
- **Category:** Security / Subscriptions
- **Priority:** High
- **Status:** Observed / Needs Verification
- **Affected module:** Feature Gating & Entitlements Middleware
- **Source:** `docs/testing/FLEET_FLOW_MANUAL_TESTING_AND_DECISION_HANDOFF.md` (Section 4.A, FF-MT-012)
- **Related issues:** [FF-ISSUE-024](FF-ISSUE-024-company-module-access-control.md)
- **Related decisions:** [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md)
- **Implementation status:** Not implemented

## 1. Summary

Operational modules designated as "PRO" tier (such as Maintenance & Repairs and Tyre Management) display a lock icon or "PRO" badge in navigation, yet clicking them successfully opens the full functional module, indicating a failure of client-side and server-side feature gating.

## 2. Observed behavior

While logged into a Starter or Standard tier company workspace, clicking on "Maintenance & Repairs" (which displays a lock icon indicating it is reserved for the Pro tier) directly navigates to `/maintenance` and loads the entire maintenance order creation and inventory interface. A similar bypass was reported for Tyre Management.

## 3. Expected behavior

When a company's active subscription tier does not include a feature:
1. Client-side navigation should display a dedicated upgrade modal or locked feature banner explaining the feature and linking to `/settings/billing`.
2. Backend API routes (`/api/maintenance/*`, `/api/tyres/*`) must return `HTTP 403 Forbidden` with `FEATURE_NOT_ENTITLED` error code to prevent direct API access.

## 4. Reproduction steps

1. Log in to a company on Starter tier.
2. Inspect the sidebar: note "Maintenance & Repairs" has a lock/PRO badge.
3. Click the "Maintenance & Repairs" link.
4. Observe the full operational page loading without an upgrade prompt.

## 5. Impact and risk

High commercial revenue leakage. Customers have no incentive to upgrade to higher tiers (Standard or Pro) if premium modules are fully functional on basic or trial plans.

## 6. Root-cause status

- **Status:** Suspected
- **Analysis:** Feature gating is partially implemented as a visual-only badge on the sidebar, without route guard protection in `App.tsx` and without entitlement middleware (`checkFeatureEntitlement`) on the backend maintenance controllers.

## 7. Investigation required

- Inspect backend routes in `backend/src/routes/maintenanceRoutes.ts` for subscription entitlement middleware.
- Inspect frontend route definitions in `frontend/src/App.tsx` for subscription guards.

## 8. Proposed resolution or agreed design

1. Implement backend middleware `requireFeature('maintenance_management')` that checks the tenant's active plan entitlements and rejects unauthorized requests with 403.
2. Implement frontend route wrapper `<FeatureGate feature="maintenance_management">` that renders an upgrade preview card instead of the operational page.

## 9. Acceptance criteria

- [ ] Unauthorized users cannot access Maintenance or Tyre Management pages.
- [ ] Clicking a locked feature displays a clean Upgrade Plan call-to-action.
- [ ] Direct API requests to locked endpoints without proper tier entitlement return `403 Forbidden`.

## 10. Required tests

- Backend integration tests verifying `403 Forbidden` when Starter tenant calls maintenance APIs.
- Frontend tests asserting upgrade modal rendering for locked features.

## 11. Dependencies and related issues

- Governed by [DEC-001](../../decisions/DEC-001-subscription-pricing-and-entitlements.md).

## 12. Verification evidence

- Implementation and verification evidence pending.
