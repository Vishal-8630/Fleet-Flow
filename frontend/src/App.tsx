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

export const App: React.FC = () => {
  const { checkAuth } = useAuthStore();

  // Verify session cookie upon application initialization
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/track" element={<PublicTrackingPage />} />
        <Route path="/track/:lrNumber" element={<PublicTrackingPage />} />

        {/* Protected Tenant Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<IndexRedirect />} />
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

          {/* Phase 3: Operations, Dispatch & Vehicle Movements */}
          <Route path="operations/journeys" element={<JourneyListPage />} />
          <Route path="operations/journeys/new" element={<NewJourneyPage />} />
          <Route path="operations/journeys/:id" element={<JourneyDetailPage />} />
          <Route path="journey/all" element={<Navigate to="/operations/journeys" replace />} />
          <Route path="journey/all-journey-entries" element={<Navigate to="/operations/journeys" replace />} />
          <Route path="journey/new-journey" element={<Navigate to="/operations/journeys/new" replace />} />
          <Route path="journey/journey-detail/:id" element={<Navigate to="/operations/journeys/:id" replace />} />
          <Route path="operations/market-entries" element={<VehicleEntryListPage />} />
          <Route path="vehicle-entry/all" element={<Navigate to="/operations/market-entries" replace />} />
          <Route path="vehicle-entry/all-vehicle-entries" element={<Navigate to="/operations/market-entries" replace />} />

          {/* Phase 4: Commercial Engine — LR, Invoicing, Settlements & Ledger */}
          <Route path="bill-entry/all" element={<LRListPage />} />
          <Route path="commercial/entries" element={<LRListPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="commercial/invoices" element={<InvoiceListPage />} />
          <Route path="settlements" element={<SettlementListPage />} />
          <Route path="commercial/settlements" element={<SettlementListPage />} />
          <Route path="ledger" element={<LedgerListPage />} />
          <Route path="commercial/ledger" element={<LedgerListPage />} />

          {/* Phase 5: SaaS Billing, Entitlements & Customization */}
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/custom-fields" element={<CustomFieldsPage />} />
          <Route path="settings/notifications" element={<NotificationLogsPage />} />
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
