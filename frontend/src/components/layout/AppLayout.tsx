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

import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import api from '../../api/client';

export const AppLayout: React.FC = () => {
  const { company, user, role, isImpersonation } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const location = useLocation();
  const isSuspended = ['suspended', 'cancelled', 'expired'].includes(company?.status || '');
  const [pendingSupportSessions, setPendingSupportSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.isSuperAdmin || isImpersonation || role !== 'admin') {
      return;
    }
    const checkSupport = async () => {
      try {
        const res = await api.get('/support/sessions');
        const pending = (res.data.sessions || []).filter((s: any) => s.status === 'pending');
        setPendingSupportSessions(pending);
      } catch {
        // Silently catch
      }
    };
    checkSupport();
    const interval = setInterval(checkSupport, 15000);
    return () => clearInterval(interval);
  }, [user, isImpersonation, role, location.pathname]);

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
        <ImpersonationBanner />
        <Navbar />

        {/* DEC-012 Pending Support Access Banner for Workspace Admin */}
        {pendingSupportSessions.length > 0 && location.pathname !== '/settings/approvals' && (
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderBottom: '1px solid var(--border-default, #e2e8f0)',
              padding: '0.625rem 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
              zIndex: 40,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-50, #eff6ff)',
                  color: 'var(--color-primary-600, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={16} />
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
              >
                <strong>Platform Super-Admin</strong> has requested diagnostic support access to this workspace ({pendingSupportSessions.length} pending request{pendingSupportSessions.length > 1 ? 's' : ''}).
              </span>
            </div>
            <Link
              to="/settings/approvals"
              className="btn btn-primary btn-sm"
            >
              Review Request →
            </Link>
          </div>
        )}

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
