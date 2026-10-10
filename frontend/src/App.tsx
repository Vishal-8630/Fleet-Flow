/**
 * ============================================================================
 * FLEET FLOW — ROOT ROUTER & APPLICATION SHELL (App.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * The root React application component. Sets up React Router (`BrowserRouter`),
 * route protection (`ProtectedRoute`), session hydration on startup, and
 * mounts the global floating toast container.
 * 
 * ROUTING STRUCTURE:
 * ------------------
 * 1. Public Routes:
 *    - `/login`: User login screen.
 *    - `/register`: Company registration wizard.
 *    - `/accept-invite`: Employee onboarding & password creation.
 * 2. Protected Workspace Routes (wrapped in `ProtectedRoute` and `AppLayout`):
 *    - `/dashboard`: Primary operational and KPI overview.
 *    - `/team`: Workspace members and RBAC directory.
 *    - `/settings/company`: Business profile and numbering configurations.
 *    - Future Phase Routes: Fleet, Drivers, Trips, LR, Invoices, Settlements, Ledger.
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TeamMembersPage } from './pages/team/TeamMembersPage';
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage';
import { ProfileSecurityPage } from './pages/settings/ProfileSecurityPage';
import { TruckListPage } from './pages/fleet/TruckListPage';
import { TruckDetailPage } from './pages/fleet/TruckDetailPage';
import { DriverListPage } from './pages/fleet/DriverListPage';
import { DriverDetailPage } from './pages/fleet/DriverDetailPage';
import { BillingPartyListPage } from './pages/parties/BillingPartyListPage';
import { BalancePartyListPage } from './pages/parties/BalancePartyListPage';
import { JourneyListPage } from './pages/operations/JourneyListPage';
import { NewJourneyPage } from './pages/operations/NewJourneyPage';
import { JourneyDetailPage } from './pages/operations/JourneyDetailPage';
import { VehicleEntryListPage } from './pages/operations/VehicleEntryListPage';
import { LRListPage } from './pages/commercial/LRListPage';
import { InvoiceListPage } from './pages/commercial/InvoiceListPage';
import { SettlementListPage } from './pages/commercial/SettlementListPage';
import { LedgerListPage } from './pages/commercial/LedgerListPage';
import { BillingPage } from './pages/settings/BillingPage';
import { CustomFieldsPage } from './pages/settings/CustomFieldsPage';
import { NotificationLogsPage } from './pages/settings/NotificationLogsPage';
import { SuperAdminDashboardPage } from './pages/superadmin/SuperAdminDashboardPage';
import { SuperAdminPlansPage } from './pages/superadmin/SuperAdminPlansPage';
import { PublicTrackingPage } from './pages/public/PublicTrackingPage';
import { MaintenanceDashboardPage } from './pages/fleet/MaintenanceDashboardPage';
import { TyreManagementPage } from './pages/fleet/TyreManagementPage';
import { LiveFleetMapPage } from './pages/operations/LiveFleetMapPage';
import { AgingReportPage } from './pages/commercial/AgingReportPage';
import { ApprovalWorkflowPage } from './pages/settings/ApprovalWorkflowPage';
import { BranchManagementPage } from './pages/settings/BranchManagementPage';
import { SupportTicketsPage } from './pages/support/SupportTicketsPage';
import { OnboardingWizardPage } from './pages/onboarding/OnboardingWizardPage';

// External Stakeholder Portals
import { PortalLoginPage } from './pages/portal/PortalLoginPage';
import { CustomerPortalPage } from './pages/portal/CustomerPortalPage';
import { DriverPortalPage } from './pages/portal/DriverPortalPage';
import { VendorPortalPage } from './pages/portal/VendorPortalPage';

// Public Marketing Website
import { HomePage } from './pages/marketing/HomePage';
import { FeaturesPage } from './pages/marketing/FeaturesPage';
import { PricingPage } from './pages/marketing/PricingPage';
import { ContactPage } from './pages/marketing/ContactPage';
import { PrivacyPage } from './pages/marketing/PrivacyPage';
import { TermsPage } from './pages/marketing/TermsPage';
import { RefundPage } from './pages/marketing/RefundPage';
import { StatusPage } from './pages/marketing/StatusPage';

import { ToastContainer } from './components/common/ToastContainer';

/**
 * Route Guard Component:
 * - Shows branded loading spinner while session hydration check is in-flight.
 * - Redirects unauthenticated visitors to `/login`.
 * - Renders protected children if session is verified.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
            Loading Fleet Flow Workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const DashboardRoute: React.FC = () => {
  const { user, isImpersonation } = useAuthStore();
  if (user?.isSuperAdmin && !isImpersonation) {
    return <Navigate to="/super-admin" replace />;
  }
  return <DashboardPage />;
};

const IndexRedirect: React.FC = () => {
  const { user, isImpersonation } = useAuthStore();
  if (user?.isSuperAdmin && !isImpersonation) {
    return <Navigate to="/super-admin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', color: '#fff' }}>
        Loading Fleet Flow...
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <HomePage />;
};

export const App: React.FC = () => {
  const { checkAuth } = useAuthStore();

  // Verify session cookie upon application initialization
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Marketing Website */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/demo" element={<ContactPage />} />
        <Route path="/security" element={<PrivacyPage />} />
        <Route path="/help" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/refund-policy" element={<RefundPage />} />
        <Route path="/status" element={<StatusPage />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/track" element={<PublicTrackingPage />} />
        <Route path="/track/:lrNumber" element={<PublicTrackingPage />} />

        {/* External Portals */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/customer" element={<CustomerPortalPage />} />
        <Route path="/portal/driver" element={<DriverPortalPage />} />
        <Route path="/portal/vendor" element={<VendorPortalPage />} />

        {/* First-Time Onboarding Wizard */}
        <Route
          path="/onboarding/setup"
          element={
            <ProtectedRoute>
              <OnboardingWizardPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Tenant Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardRoute />} />
          <Route path="team" element={<TeamMembersPage />} />
          <Route path="settings/company" element={<CompanySettingsPage />} />
          <Route path="settings/profile" element={<ProfileSecurityPage />} />

          {/* Phase 2: Master Data Registries & Fleet Engineering */}
          <Route path="fleet/trucks" element={<TruckListPage />} />
          <Route path="fleet/trucks/:id" element={<TruckDetailPage />} />
          <Route path="fleet/maintenance" element={<MaintenanceDashboardPage />} />
          <Route path="fleet/tyres" element={<TyreManagementPage />} />
          <Route path="fleet/drivers" element={<DriverListPage />} />
          <Route path="fleet/drivers/:id" element={<DriverDetailPage />} />
          <Route path="parties/billing" element={<BillingPartyListPage />} />
          <Route path="parties/balance" element={<BalancePartyListPage />} />

          {/* Phase 3 & Issue 08: Operations, Dispatch, Live Map & Vehicle Movements */}
          <Route path="operations/journeys" element={<JourneyListPage />} />
          <Route path="operations/journeys/new" element={<NewJourneyPage />} />
          <Route path="operations/journeys/:id" element={<JourneyDetailPage />} />
          <Route path="operations/live-map" element={<LiveFleetMapPage />} />
          <Route path="journey/all" element={<Navigate to="/operations/journeys" replace />} />
          <Route path="journey/all-journey-entries" element={<Navigate to="/operations/journeys" replace />} />
          <Route path="journey/new-journey" element={<Navigate to="/operations/journeys/new" replace />} />
          <Route path="journey/journey-detail/:id" element={<Navigate to="/operations/journeys/:id" replace />} />
          <Route path="operations/market-entries" element={<VehicleEntryListPage />} />
          <Route path="vehicle-entry/all" element={<Navigate to="/operations/market-entries" replace />} />
          <Route path="vehicle-entry/all-vehicle-entries" element={<Navigate to="/operations/market-entries" replace />} />

          {/* Phase 4 & Issue 09: Commercial Engine — LR, Invoicing, AR Aging, Settlements & Ledger */}
          <Route path="bill-entry/all" element={<LRListPage />} />
          <Route path="commercial/entries" element={<LRListPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="commercial/invoices" element={<InvoiceListPage />} />
          <Route path="commercial/aging" element={<AgingReportPage />} />
          <Route path="financials/aging" element={<Navigate to="/commercial/aging" replace />} />
          <Route path="settlements" element={<SettlementListPage />} />
          <Route path="commercial/settlements" element={<SettlementListPage />} />
          <Route path="ledger" element={<LedgerListPage />} />
          <Route path="commercial/ledger" element={<LedgerListPage />} />

          {/* Phase 5, Issue 11 & Issue 12: SaaS Billing, Customization, Branches, Approvals & Support */}
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/custom-fields" element={<CustomFieldsPage />} />
          <Route path="settings/notifications" element={<NotificationLogsPage />} />
          <Route path="settings/approvals" element={<ApprovalWorkflowPage />} />
          <Route path="approvals" element={<Navigate to="/settings/approvals" replace />} />
          <Route path="settings/branches" element={<BranchManagementPage />} />
          <Route path="branches" element={<Navigate to="/settings/branches" replace />} />
          <Route path="support/tickets" element={<SupportTicketsPage />} />
          <Route path="support" element={<Navigate to="/support/tickets" replace />} />
          <Route path="super-admin" element={<SuperAdminDashboardPage />} />
          <Route path="super-admin/plans" element={<SuperAdminPlansPage />} />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Floating Toast Alerts */}
      <ToastContainer />
    </BrowserRouter>
  );
};

export default App;
