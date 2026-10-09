import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  Navigation,
  Receipt,
  FileSpreadsheet,
  BadgeCent,
  BookOpen,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Sidebar: React.FC = () => {
  const { role, user } = useAuthStore();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Fleet & Trucks', path: '/fleet/trucks', icon: Truck },
    { label: 'Driver Master', path: '/fleet/drivers', icon: Users },
    { label: 'Trips & Dispatch', path: '/journey/all', icon: Navigation },
    { label: 'Bill Entries & LR', path: '/bill-entry/all', icon: Receipt },
    { label: 'Freight Invoices', path: '/invoices', icon: FileSpreadsheet },
    { label: 'Driver Settlements', path: '/settlements', icon: BadgeCent, roles: ['admin', 'accountant'] },
    { label: 'General Ledger', path: '/ledger', icon: BookOpen, roles: ['admin', 'accountant'] },
    { label: 'Company Settings', path: '/settings/company', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex' }}>
          <Truck size={22} color="#ffffff" />
        </div>
        <div>
          <div className="sidebar-brand-name">FleetFlow</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SaaS Transport OS
          </div>
        </div>
      </div>

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

      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)' }}>
        <div>v1.0.0 Enterprise</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--color-slate-500)' }}>Zero-Data Leakage Verified</div>
      </div>
    </aside>
  );
};
