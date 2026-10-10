/**
 * ============================================================================
 * FLEET FLOW — APPLICATION SHELL LAYOUT (layout/AppLayout.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The top-level layout wrapper for all authenticated pages in the workspace.
 * Renders:
 * 1. Persistent navigation `Sidebar` (left).
 * 2. Top utility `Navbar` (brand selector, trial countdown, user profile).
 * 3. Subscription warning banner (if workspace is suspended or expired).
 * 4. `<Outlet />` viewport rendering active route views.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Consistent Shell: Ensures navigation, layout grids, and headers remain
 *   smoothly fixed while route transitions occur within `<Outlet />`.
 * - Workspace Warning Banner: Gives operators clear, immediate feedback if their
 *   subscription has lapsed so they understand why create/edit buttons are blocked
 *   before attempting mutations.
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { AlertTriangle } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { company } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const location = useLocation();
  const isSuspended = ['suspended', 'cancelled', 'expired'].includes(company?.status || '');

  // Automatically close mobile sidebar upon navigating to a new route
  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname, setSidebarOpen]);

  return (
    <div className="app-layout">
      {/* Mobile Drawer Dim Backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Main Viewport & Navbar */}
      <div className="main-content-wrapper">
        <Navbar />

        {/* 3. Subscription Status Alert Banner */}
        {isSuspended && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              borderBottom: '1px solid var(--color-danger-border)',
              padding: '0.75rem 2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertTriangle size={18} color="var(--color-danger)" />
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-danger-text)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              Your workspace is currently in <strong>Read-Only Mode</strong> due to an inactive subscription. Creating or modifying records is disabled until plan renewal.
            </span>
          </div>
        )}

        {/* 4. Routed Page Content */}
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
