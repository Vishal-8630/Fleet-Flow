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
import { Building2, LogOut, Clock, UserCheck, Menu } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

export const Navbar: React.FC = () => {
  const { user, company, role, logout } = useAuthStore();
  const { toggleSidebar } = useUiStore();

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
      {/* 1. Left Side: Hamburger Toggle + Active Workspace Badge & Trial Indicator */}
      <div className="navbar-left">
        <button
          type="button"
          className="navbar-menu-btn"
          onClick={toggleSidebar}
          aria-label="Toggle navigation drawer"
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div className="navbar-brand-pill">
          <Building2 size={16} color="var(--color-primary-600)" style={{ flexShrink: 0 }} />
          <span className="navbar-brand-title">
            {user?.isSuperAdmin ? 'FleetFlow Global Operator' : company?.name || 'My Transport Co.'}
          </span>
          <span className={`badge ${user?.isSuperAdmin ? 'badge-warning' : 'badge-info'}`} style={{ textTransform: 'uppercase', fontSize: '10px', flexShrink: 0 }}>
            {user?.isSuperAdmin ? 'Admin' : company?.status || 'Active'}
          </span>
        </div>

        {/* Dynamic Free Trial Countdown Pill */}
        {!user?.isSuperAdmin && company?.status === 'trialing' && (
          <div className="badge badge-warning" style={{ gap: '0.375rem', flexShrink: 0 }}>
            <Clock size={12} />
            <span className="trial-pill-text-long">{daysLeft} Days Free Trial Left</span>
            <span className="trial-pill-text-short" style={{ display: 'none' }}>{daysLeft}d Trial</span>
          </div>
        )}
      </div>

      {/* 2. Right Side: User Profile (Links to Profile & Security) & Logout Action */}
      <div className="navbar-right">
        <Link
          to="/settings/profile"
          className="navbar-user-link"
          title="Profile & Security"
        >
          <div className="navbar-user-avatar">
            <UserCheck size={16} color="var(--color-primary-600)" />
          </div>
          <div className="navbar-user-info">
            <div className="navbar-user-name">
              {user?.name}
            </div>
            <div className="navbar-user-role">
              {user?.isSuperAdmin ? 'Super-Admin' : role}
            </div>
          </div>
        </Link>

        <button
          onClick={() => logout()}
          className="btn btn-ghost btn-sm navbar-logout-btn"
          title="Sign out of workspace"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
