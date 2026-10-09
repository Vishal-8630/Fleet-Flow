import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
            Loading FleetFlow Workspace...
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

export const App: React.FC = () => {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Tenant Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="fleet/trucks" element={<div className="page-header-title">Truck Registry (Phase 2)</div>} />
          <Route path="fleet/drivers" element={<div className="page-header-title">Driver Master (Phase 2)</div>} />
          <Route path="journey/all" element={<div className="page-header-title">Trips & Dispatch (Phase 3)</div>} />
          <Route path="bill-entry/all" element={<div className="page-header-title">Bill Entries & LR (Phase 4)</div>} />
          <Route path="invoices" element={<div className="page-header-title">Freight Invoices (Phase 4)</div>} />
          <Route path="settlements" element={<div className="page-header-title">Driver Settlements (Phase 4)</div>} />
          <Route path="ledger" element={<div className="page-header-title">General Ledger (Phase 4)</div>} />
          <Route path="settings/company" element={<div className="page-header-title">Company Settings (Phase 5)</div>} />
          <Route path="super-admin" element={<div className="page-header-title">Super-Admin Control Plane (Phase 5)</div>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
