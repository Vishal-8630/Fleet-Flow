/**
 * ============================================================================
 * FLEET FLOW — ROLE-AWARE SIDEBAR NAVIGATION (layout/Sidebar.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The primary vertical navigation bar for the Fleet Flow web application.
 * 
 * NAVIGATION SEGREGATION:
 * -----------------------
 * - Platform Super-Admin (`isSuperAdmin: true`): Exclusively sees platform-level
 *   control plane routes (Control Plane & MRR, SaaS Plans, Custom Fields, Company Config).
 *   Company operational tabs (Fleet & Trucks, Drivers, Dispatches, Bills) are NOT visible.
 * - Company Workspace (`isSuperAdmin: false`): Sees day-to-day fleet transport
 *   operations filtered by role (admin, dispatcher, accountant, viewer).
 * ============================================================================
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  UserSquare2,
  Users,
  Navigation,
  Receipt,
  FileSpreadsheet,
  BadgeCent,
  BookOpen,
  Settings,
  ShieldCheck,
  Building2,
  Briefcase,
  Layers,
  Sliders,
  CreditCard,
  Lock,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

export const Sidebar: React.FC = () => {
  const { role, user, isImpersonation, enabledFeatures = [] } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const isSuperAdmin = Boolean(user?.isSuperAdmin) && !isImpersonation;

  // Platform Operator Super-Admin Exclusive Navigation Links
  const platformNavItems = [
    { label: 'Control Plane & Tenants', path: '/super-admin', icon: ShieldCheck, end: true },
    { label: 'SaaS Plans & Catalogs', path: '/super-admin/plans', icon: CreditCard, end: true },
  ];

  // Tenant / Company Operational Navigation Links
  const workspaceNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Fleet & Trucks', path: '/fleet/trucks', icon: Truck },
    { label: 'Driver Master', path: '/fleet/drivers', icon: UserSquare2 },
    { label: 'Billing Parties', path: '/parties/billing', icon: Building2 },
    { label: 'Balance Parties', path: '/parties/balance', icon: Briefcase },
    { label: 'Trip Dispatch', path: '/operations/journeys', icon: Navigation },
    { label: 'Market Movements', path: '/operations/market-entries', icon: Layers },
    { label: 'Bill Entries & LR', path: '/bill-entry/all', icon: Receipt, feature: 'MOD_LR_ENGINE', tier: 'STD' },
    { label: 'Freight Invoices', path: '/invoices', icon: FileSpreadsheet, feature: 'MOD_BILLING_INVOICE', tier: 'STD' },
    { label: 'Driver Settlements', path: '/settlements', icon: BadgeCent, roles: ['admin', 'accountant'], feature: 'MOD_SETTLEMENTS', tier: 'STD' },
    { label: 'General Ledger', path: '/ledger', icon: BookOpen, roles: ['admin', 'accountant'], feature: 'MOD_LEDGERS', tier: 'STD' },
    { label: 'Team & Access', path: '/team', icon: Users, roles: ['admin'] },
    { label: 'Custom Fields', path: '/settings/custom-fields', icon: Sliders, roles: ['admin'], feature: 'MOD_CUSTOM_FIELDS', tier: 'PRO' },
    { label: 'Billing & Plans', path: '/settings/billing', icon: CreditCard, roles: ['admin'] },
    { label: 'Company Settings', path: '/settings/company', icon: Settings, roles: ['admin'] },
    { label: 'Profile & Security', path: '/settings/profile', icon: Lock },
  ];

  const filteredWorkspaceItems = workspaceNavItems.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  const handleLinkClick = () => {
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
      {/* 1. Brand Logo & Name + Mobile Close Button */}
      <div className="sidebar-header">
        <div className="sidebar-brand-group">
          <div style={{ backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex' }}>
            {isSuperAdmin ? <ShieldCheck size={22} color="#ffffff" /> : <Truck size={22} color="#ffffff" />}
          </div>
          <div>
            <div className="sidebar-brand-name">Fleet Flow</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isSuperAdmin ? 'Platform Control Plane' : 'SaaS Transport OS'}
            </div>
          </div>
        </div>

        {/* Mobile Drawer Close Button */}
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation drawer"
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. Navigation Links */}
      <nav className="sidebar-nav">
        {isSuperAdmin ? (
          <>
            <div className="nav-section-title" style={{ color: 'var(--color-warning)' }}>
              Platform Super-Admin
            </div>
            {platformNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={handleLinkClick}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </>
        ) : (
          <>
            <div className="nav-section-title">
              Core Operations
            </div>
            {filteredWorkspaceItems.map((item) => {
              const Icon = item.icon;
              const isLocked = item.feature && !enabledFeatures.includes(item.feature as any);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={handleLinkClick}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isLocked && (
                    <span className="sidebar-lock-badge" title={`Requires ${item.tier} plan`}>
                      <Lock size={10} />
                      <span>{item.tier}</span>
                    </span>
                  )}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* 3. Footer Version Tag */}
      <div className="sidebar-footer">
        <div>v1.0.0 Enterprise</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--color-slate-500)' }}>
          {isSuperAdmin ? 'Platform Operator Root' : 'Zero-Data Leakage Verified'}
        </div>
      </div>
    </aside>
  );
};
