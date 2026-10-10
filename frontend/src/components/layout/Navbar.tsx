/**
 * ============================================================================
 * FLEET FLOW — TOP APPLICATION NAVBAR (layout/Navbar.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The horizontal navigation bar situated at the top of the main viewport.
 * Displays:
 * 1. Current workspace name and active subscription badge.
 * 2. 14-day free trial countdown pill (if status is 'trialing').
 * 3. Logged-in user's name and assigned role (clickable link to `/settings/profile`).
 * 4. Sign-out button triggering `logout()` in `authStore`.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, LogOut, Clock, UserCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Navbar: React.FC = () => {
  const { user, company, role, logout } = useAuthStore();

  /**
   * Calculates remaining days of the 14-day free trial from trialEndsAt timestamp
   */
  const calculateDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return 14;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysRemaining(company?.trialEndsAt);

  return (
    <header className="top-navbar">
      {/* 1. Left Side: Active Workspace Badge & Trial Indicator */}
      <div className="flex items-center" style={{ gap: '1rem' }}>
        <div className="flex items-center" style={{ gap: '0.5rem', backgroundColor: 'var(--color-slate-100)', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
          <Building2 size={16} color="var(--color-primary-600)" />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
            {user?.isSuperAdmin ? 'FleetFlow Global Operator' : company?.name || 'My Transport Co.'}
          </span>
          <span className={`badge ${user?.isSuperAdmin ? 'badge-warning' : 'badge-info'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
            {user?.isSuperAdmin ? 'Super-Admin' : company?.status || 'Active'}
          </span>
        </div>

        {/* Dynamic Free Trial Countdown Pill */}
        {!user?.isSuperAdmin && company?.status === 'trialing' && (
          <div className="badge badge-warning" style={{ gap: '0.375rem' }}>
            <Clock size={12} />
            <span>{daysLeft} Days Free Trial Left</span>
          </div>
        )}
      </div>

      {/* 2. Right Side: User Profile (Links to Profile & Security) & Logout Action */}
      <div className="flex items-center" style={{ gap: '1.25rem' }}>
        <Link
          to="/settings/profile"
          className="flex items-center"
          style={{
            gap: '0.625rem',
            textDecoration: 'none',
            color: 'inherit',
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
          title="Profile & Security"
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserCheck size={16} color="var(--color-primary-600)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1.1 }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              Role: {user?.isSuperAdmin ? 'Platform Super-Admin' : role}
            </div>
          </div>
        </Link>

        <button
          onClick={() => logout()}
          className="btn btn-ghost btn-sm"
          title="Sign out of workspace"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
