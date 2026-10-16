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

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  MessageSquare,
  Wrench,
  Disc,
  X,
  Map,
  TrendingUp,
  FileDown,
  FileX,
  GitBranch,
  CheckSquare,
  LifeBuoy,
  HelpCircle,
  Sparkles,
  Zap,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Modal } from '../common/Modal';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { role, user, isImpersonation, enabledFeatures = [], planFeatures = [] } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const isSuperAdmin = Boolean(user?.isSuperAdmin) && !isImpersonation;

  const [lockedUpgradeItem, setLockedUpgradeItem] = useState<{
    label: string;
    path: string;
    tier: string;
    feature?: string;
  } | null>(null);

  // Platform Operator Super-Admin Exclusive Navigation Links
  const platformNavItems = [
    { label: 'Control Plane & Tenants', path: '/super-admin', icon: ShieldCheck, end: true },
    { label: 'SaaS Plans & Catalogs', path: '/super-admin/plans', icon: CreditCard, end: true },
  ];

  // Tenant / Company Operational Navigation Links
  const workspaceNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Fleet & Trucks', path: '/fleet/trucks', icon: Truck, feature: 'MOD_FLEET' },
    { label: 'Maintenance & Repairs', path: '/fleet/maintenance', icon: Wrench, feature: 'MOD_MAINTENANCE', tier: 'PRO' },
    { label: 'Tyre Management', path: '/fleet/tyres', icon: Disc, feature: 'MOD_MAINTENANCE', tier: 'PRO' },
    { label: 'Driver Master', path: '/fleet/drivers', icon: UserSquare2, feature: 'MOD_DRIVERS' },
    { label: 'Billing Parties', path: '/parties/billing', icon: Building2, feature: 'MOD_PARTIES' },
    { label: 'Balance Parties', path: '/parties/balance', icon: Briefcase, feature: 'MOD_PARTIES' },
    { label: 'Trip Dispatch', path: '/operations/journeys', icon: Navigation, feature: 'MOD_TRIPS' },
    { label: 'Live Fleet Map', path: '/operations/live-map', icon: Map, feature: 'MOD_GPS_SYNC', tier: 'PRO' },
    { label: 'Market Movements', path: '/operations/market-entries', icon: Layers, feature: 'MOD_MARKET_VEHICLES' },
    { label: 'Bill Entries & LR', path: '/bill-entry/all', icon: Receipt, feature: 'MOD_LR_ENGINE', tier: 'STD' },
    { label: 'Freight Invoices', path: '/invoices', icon: FileSpreadsheet, feature: 'MOD_BILLING_INVOICE', tier: 'STD' },
    { label: 'Credit Notes', path: '/commercial/credit-notes', icon: FileX, roles: ['admin', 'accountant'], feature: 'MOD_BILLING_INVOICE' },
    { label: 'AR Aging Report', path: '/commercial/aging', icon: TrendingUp, roles: ['admin', 'accountant'], feature: 'MOD_REPORTS' },
    { label: 'Driver Settlements', path: '/settlements', icon: BadgeCent, roles: ['admin', 'accountant'], feature: 'MOD_SETTLEMENTS', tier: 'STD' },
    { label: 'General Ledger', path: '/ledger', icon: BookOpen, roles: ['admin', 'accountant'], feature: 'MOD_LEDGERS', tier: 'STD' },
    { label: 'Pending Approvals', path: '/settings/approvals', icon: CheckSquare, roles: ['admin'], feature: 'MOD_WORKFLOW_APPROVALS', tier: 'PRO' },
    { label: 'Team & Access', path: '/team', icon: Users, roles: ['admin'] },
    { label: 'Branches & Hubs', path: '/settings/branches', icon: GitBranch, roles: ['admin'], feature: 'MOD_MULTI_BRANCH', tier: 'PRO' },
    { label: 'Custom Fields', path: '/settings/custom-fields', icon: Sliders, roles: ['admin'], feature: 'MOD_CUSTOM_FIELDS', tier: 'PRO' },
    { label: 'Notification Logs', path: '/settings/notifications', icon: MessageSquare, feature: 'MOD_WHATSAPP', tier: 'STD' },
    { label: 'Billing & Plans', path: '/settings/billing', icon: CreditCard, roles: ['admin'] },
    { label: 'Company Settings', path: '/settings/company', icon: Settings, roles: ['admin'] },
    { label: 'Support Tickets', path: '/support/tickets', icon: LifeBuoy },
    { label: 'Profile & Security', path: '/settings/profile', icon: Lock },
  ];

  const filteredWorkspaceItems = workspaceNavItems.filter((item) => {
    // 1. Role-based filtration
    if (item.roles && (!role || !item.roles.includes(role))) {
      return false;
    }
    // 2. Company preference module disablement:
    // If the module is entitled by the current subscription plan, BUT the Company Admin
    // has disabled it in Workspace Settings, hide it completely from navigation!
    if (item.feature) {
      const isEntitledByPlan = planFeatures.includes(item.feature as any);
      const isEnabled = enabledFeatures.includes(item.feature as any);
      if (isEntitledByPlan && !isEnabled) {
        return false;
      }
    }
    return true;
  });

  const handleLinkClick = () => {
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  const handleItemClick = (e: React.MouseEvent, item: typeof filteredWorkspaceItems[0], isLocked: boolean) => {
    if (isLocked) {
      e.preventDefault();
      e.stopPropagation();
      setLockedUpgradeItem({
        label: item.label,
        path: item.path,
        tier: item.tier || 'PRO',
        feature: item.feature,
      });
      return;
    }
    handleLinkClick();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, item: typeof filteredWorkspaceItems[0], isLocked: boolean) => {
    if (isLocked && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      setLockedUpgradeItem({
        label: item.label,
        path: item.path,
        tier: item.tier || 'PRO',
        feature: item.feature,
      });
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
              const isLocked = Boolean(item.feature && !enabledFeatures.includes(item.feature as any));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={(e) => handleItemClick(e, item, isLocked)}
                  onKeyDown={(e) => handleItemKeyDown(e, item, isLocked)}
                  className={({ isActive }) => `nav-link ${isActive && !isLocked ? 'active' : ''} ${isLocked ? 'locked-nav-item' : ''}`}
                  aria-haspopup={isLocked ? 'dialog' : undefined}
                  aria-disabled={isLocked ? true : undefined}
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

      {/* 4. Locked Feature Upgrade Modal */}
      {lockedUpgradeItem && (
        <Modal
          isOpen={Boolean(lockedUpgradeItem)}
          onClose={() => setLockedUpgradeItem(null)}
          title={`Upgrade to ${lockedUpgradeItem.tier} Plan`}
          subtitle={`Unlock ${lockedUpgradeItem.label} and advanced transport capabilities.`}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setLockedUpgradeItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLockedUpgradeItem(null);
                  if (window.innerWidth <= 1024) setSidebarOpen(false);
                  navigate('/settings/billing');
                }}
              >
                <Zap size={16} />
                <span>View Plans & Upgrade</span>
                <ArrowRight size={16} />
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.75rem 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 8px 24px -4px rgba(124, 58, 237, 0.4)',
                marginBottom: '1.25rem',
              }}
            >
              <Lock size={28} />
            </div>

            <div
              className="badge"
              style={{
                background: 'linear-gradient(135deg, #ede9fe 0%, #fae8ff 100%)',
                color: '#7c3aed',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                marginBottom: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Sparkles size={13} />
              <span>Requires {lockedUpgradeItem.tier} Tier</span>
            </div>

            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lockedUpgradeItem.label} is Locked
            </h4>

            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '420px' }}>
              Your current subscription does not include access to <strong>{lockedUpgradeItem.label}</strong>. Upgrade your workspace to unlock full operational capabilities, preventative maintenance, and automated fleet tracking.
            </p>

            <div
              style={{
                width: '100%',
                background: 'var(--bg-surface-secondary, rgba(248, 250, 252, 0.8))',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <span>Immediate access to {lockedUpgradeItem.label} with zero data loss</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <span>Multi-user RBAC authorization & server-side feature isolation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <span>Seamless proration billing with instant plan activation</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </aside>
  );
};
