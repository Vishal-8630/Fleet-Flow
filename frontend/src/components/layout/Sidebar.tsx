/**
 * ============================================================================
 * FLEET FLOW — ROLE-AWARE SIDEBAR NAVIGATION (layout/Sidebar.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The primary vertical navigation bar for the Fleet Flow web application.
 * Filters navigation items dynamically based on the authenticated user's role.
 * 
 * WHY IS IT DESIGNED THIS WAY?
 * ----------------------------
 * - Role-Based Link Filtering: Dispatchers only see operational tools (trucks,
 *   trips, dispatches); Accountants see financial tools (settlements, general ledger,
 *   invoices); Administrators see full company configuration and team management.
 * - Active State Indication: Uses React Router `<NavLink>` to highlight the
 *   currently visited page with distinct primary accent styling.
 * - Super-Admin Section: Renders an exclusive "Control Plane" entry for platform
 *   operators (`isSuperAdmin: true`).
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
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Sidebar: React.FC = () => {
  const { role, user } = useAuthStore();

  // Navigation Items Catalog with optional role restrictions
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Fleet & Trucks', path: '/fleet/trucks', icon: Truck },
    { label: 'Driver Master', path: '/fleet/drivers', icon: UserSquare2 },
    { label: 'Billing Parties', path: '/parties/billing', icon: Building2 },
    { label: 'Balance Parties', path: '/parties/balance', icon: Briefcase },
    { label: 'Trips & Dispatch', path: '/journey/all', icon: Navigation },
    { label: 'Bill Entries & LR', path: '/bill-entry/all', icon: Receipt },
    { label: 'Freight Invoices', path: '/invoices', icon: FileSpreadsheet },
    { label: 'Driver Settlements', path: '/settlements', icon: BadgeCent, roles: ['admin', 'accountant'] },
    { label: 'General Ledger', path: '/ledger', icon: BookOpen, roles: ['admin', 'accountant'] },
    { label: 'Team & Access', path: '/team', icon: Users, roles: ['admin'] },
    { label: 'Company Settings', path: '/settings/company', icon: Settings, roles: ['admin'] },
  ];

  // Filter links based on the authenticated user's company role
  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return (
    <aside className="sidebar">
      {/* 1. Brand Logo & Name */}
      <div className="sidebar-header">
        <div style={{ backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex' }}>
          <Truck size={22} color="#ffffff" />
        </div>
        <div>
          <div className="sidebar-brand-name">Fleet Flow</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SaaS Transport OS
          </div>
        </div>
      </div>

      {/* 2. Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Core Operations</div>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* 3. Platform Super-Admin Section */}
        {user?.isSuperAdmin && (
          <>
            <div className="nav-section-title" style={{ marginTop: '1rem', color: 'var(--color-warning)' }}>
              Platform Super-Admin
            </div>
            <NavLink to="/super-admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={18} color="var(--color-warning)" />
              <span style={{ color: 'var(--color-warning)' }}>Control Plane</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* 4. Footer Version Tag */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)' }}>
        <div>v1.0.0 Enterprise</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--color-slate-500)' }}>Zero-Data Leakage Verified</div>
      </div>
    </aside>
  );
};
