import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuthStore } from '../../stores/authStore';
import { AlertTriangle } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { company } = useAuthStore();
  const isSuspended = ['suspended', 'cancelled', 'expired'].includes(company?.status || '');

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content-wrapper">
        <Navbar />

        {isSuspended && (
          <div style={{ backgroundColor: 'var(--color-danger-bg)', borderBottom: '1px solid var(--color-danger-border)', padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--color-danger)" />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-danger-text)', fontWeight: 'var(--font-weight-medium)' }}>
              Your workspace is currently in <strong>Read-Only Mode</strong> due to an inactive subscription. Creating or modifying records is disabled until plan renewal.
            </span>
          </div>
        )}

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
