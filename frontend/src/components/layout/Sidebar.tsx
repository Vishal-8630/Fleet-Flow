/**
 * ============================================================================
 * FLEET FLOW — ROLE-AWARE SIDEBAR NAVIGATION (layout/Sidebar.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The primary vertical navigation bar for the Fleet Flow web application.
 * 
 * FEATURES:
 * ---------
 * - Super-Admin Mode Switcher: For platform operators (`isSuperAdmin: true`),
 *   allows toggling between:
 *   1. "Platform Control Plane" (Platform KPIs, MRR, Tenant Directory, Global Plans)
 *   2. "Company Workspace" (Standard trucking operations for inspecting tenant data)
 * - Role-Based Link Filtering: Hides financial or administrative links from viewers/dispatchers.
 * - Active State Indication: Highlights active route cleanly.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  ToggleLeft,
  ToggleRight,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Sidebar: React.FC = () => {
  const { role, user, company } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Mode state for platform super-administrators
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const [mode, setMode] = useState<'platform' | 'workspace'>(() => {
    if (!isSuperAdmin) return 'workspace';
    return location.pathname.startsWith('/super-admin') ? 'platform' : 'workspace';
  });

  // Keep mode in sync with route navigation
  useEffect(() => {
    if (isSuperAdmin) {
      if (location.pathname.startsWith('/super-admin')) {
        setMode('platform');
      }
    }
  }, [location.pathname, isSuperAdmin]);

  // Tenant / Company Operational Navigation Links
  const workspaceNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Fleet & Trucks', path: '/fleet/trucks', icon: Truck },
    { label: 'Driver Master', path: '/fleet/drivers', icon: UserSquare2 },
    { label: 'Billing Parties', path: '/parties/billing', icon: Building2 },
    { label: 'Balance Parties', path: '/parties/balance', icon: Briefcase },
    { label: 'Trip Dispatch', path: '/operations/journeys', icon: Navigation },
    { label: 'Market Movements', path: '/operations/market-entries', icon: Layers },
    { label: 'Bill Entries & LR', path: '/bill-entry/all', icon: Receipt },
    { label: 'Freight Invoices', path: '/invoices', icon: FileSpreadsheet },
    { label: 'Driver Settlements', path: '/settlements', icon: BadgeCent, roles: ['admin', 'accountant'] },
    { label: 'General Ledger', path: '/ledger', icon: BookOpen, roles: ['admin', 'accountant'] },
    { label: 'Team & Access', path: '/team', icon: Users, roles: ['admin'] },
    { label: 'Custom Fields', path: '/settings/custom-fields', icon: Sliders, roles: ['admin'] },
    { label: 'Billing & Plans', path: '/settings/billing', icon: CreditCard, roles: ['admin'] },
    { label: 'Company Settings', path: '/settings/company', icon: Settings, roles: ['admin'] },
  ];

  // Platform Operator Super-Admin Navigation Links
  const platformNavItems = [
    { label: 'Control Plane & MRR', path: '/super-admin', icon: ShieldCheck },
    { label: 'SaaS Plans & Catalogs', path: '/settings/billing', icon: CreditCard },
    { label: 'Custom Fields Studio', path: '/settings/custom-fields', icon: Sliders },
    { label: 'Company Settings', path: '/settings/company', icon: Settings },
  ];

  const filteredWorkspaceItems = workspaceNavItems.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  const toggleMode = (targetMode: 'platform' | 'workspace') => {
    setMode(targetMode);
    if (targetMode === 'platform') {
      navigate('/super-admin');
    } else {
      navigate('/dashboard');
    }
  };

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
            {isSuperAdmin && mode === 'platform' ? 'Platform Super-Admin' : 'SaaS Transport OS'}
          </div>
        </div>
      </div>

      {/* 2. Super-Admin Mode Switcher Pill */}
      {isSuperAdmin && (
        <div style={{ padding: '0 1rem 0.75rem 1rem' }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              display: 'flex',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => toggleMode('platform')}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: mode === 'platform' ? 700 : 500,
                color: mode === 'platform' ? '#ffffff' : 'var(--color-slate-400)',
                backgroundColor: mode === 'platform' ? 'var(--color-primary-600)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
            >
              <ShieldCheck size={13} />
              Platform
            </button>
            <button
              type="button"
              onClick={() => toggleMode('workspace')}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: mode === 'workspace' ? 700 : 500,
                color: mode === 'workspace' ? '#ffffff' : 'var(--color-slate-400)',
                backgroundColor: mode === 'workspace' ? 'var(--color-primary-600)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
            >
              <Building2 size={13} />
              Workspace
            </button>
          </div>
        </div>
      )}

      {/* 3. Navigation Links */}
      <nav className="sidebar-nav">
        {isSuperAdmin && mode === 'platform' ? (
          <>
            <div className="nav-section-title" style={{ color: 'var(--color-warning)' }}>
              SaaS Administration
            </div>
            {platformNavItems.map((item) => {
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

            <div style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-slate-400)', marginBottom: '6px' }}>
                Active Inspection Workspace:
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                {company?.name || 'Patel Roadways'}
              </div>
              <button
                type="button"
                onClick={() => toggleMode('workspace')}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <ArrowRightLeft size={12} />
                Open Company Operations
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nav-section-title">
              {isSuperAdmin ? 'Company Workspace' : 'Core Operations'}
            </div>
            {filteredWorkspaceItems.map((item) => {
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

            {isSuperAdmin && (
              <div style={{ padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => toggleMode('platform')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--color-warning)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldCheck size={14} />
                  ← Return to Control Plane
                </button>
              </div>
            )}
          </>
        )}
      </nav>

      {/* 4. Footer Version Tag */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)' }}>
        <div>v1.0.0 Enterprise</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--color-slate-500)' }}>
          {isSuperAdmin ? 'Platform Operator Root' : 'Zero-Data Leakage Verified'}
        </div>
      </div>
    </aside>
  );
};
