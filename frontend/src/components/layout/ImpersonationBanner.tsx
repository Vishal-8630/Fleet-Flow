/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN IMPERSONATION BANNER (ImpersonationBanner.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * A prominent, persistent high-contrast banner displayed at the very top of
 * the application shell whenever a Platform Super Administrator is viewing a
 * tenant workspace in support impersonation mode.
 * 
 * WHY IS THIS CRITICAL?
 * ----------------------
 * 1. Security & Forensics: Clearly notifies the operator that every mutation
 *    performed is tagged to their super-admin actor email in PlatformAuditLog.
 * 2. Instant Context Exit: Provides a 1-click "Exit Support Session" button that
 *    cleanly terminates the support token and restores their platform control plane.
 * ============================================================================
 */

import React, { useState } from 'react';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonation, company, impersonationActorEmail, exitImpersonation } = useAuthStore();
  const [exiting, setExiting] = useState(false);

  if (!isImpersonation) {
    return null;
  }

  const handleExit = async () => {
    try {
      setExiting(true);
      await exitImpersonation();
    } catch (err) {
      console.error('Failed to exit impersonation:', err);
      setExiting(false);
    }
  };

  return (
    <aside
      aria-label="Platform Impersonation Mode Active"
      style={{
        backgroundColor: '#7c2d12',
        color: '#fef3c7',
        borderBottom: '2px solid #b45309',
        padding: '0.625rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        zIndex: 1000,
        position: 'sticky',
        top: 0,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <ShieldAlert size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span>
          <strong>Support Impersonation Mode Active:</strong> Viewing workspace as{' '}
          <strong style={{ color: '#fff' }}>{company?.name || 'Tenant Workspace'}</strong>.
          {impersonationActorEmail && (
            <span style={{ opacity: 0.9, marginLeft: '0.5rem' }}>
              (Audit Actor: <code>{impersonationActorEmail}</code>)
            </span>
          )}
        </span>
      </div>

      <button
        onClick={handleExit}
        disabled={exiting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          backgroundColor: '#fbbf24',
          color: '#78350f',
          border: 'none',
          borderRadius: '4px',
          padding: '0.375rem 0.875rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: exiting ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!exiting) e.currentTarget.style.backgroundColor = '#f59e0b';
        }}
        onMouseLeave={(e) => {
          if (!exiting) e.currentTarget.style.backgroundColor = '#fbbf24';
        }}
      >
        {exiting ? (
          <>
            <Loader2 size={14} className="spin-animation" />
            <span>Exiting...</span>
          </>
        ) : (
          <>
            <LogOut size={14} />
            <span>Exit Support Session</span>
          </>
        )}
      </button>
    </aside>
  );
};
