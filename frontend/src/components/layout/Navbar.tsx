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

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LogOut, Clock, UserCheck, Menu, ChevronDown, Check, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore, toast } from '../../stores/uiStore';
import { Modal } from '../common/Modal';

export const Navbar: React.FC = () => {
  const { user, company, role, isImpersonation, logout, workspaces, loadWorkspaces, switchWorkspace, createWorkspace } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // In-app workspace creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  useEffect(() => {
    if (user && (!user.isSuperAdmin || isImpersonation)) {
      loadWorkspaces();
    }
  }, [user, isImpersonation, loadWorkspaces]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Calculates remaining days of the 14-day free trial from trialEndsAt timestamp
   */
  const calculateDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return 14;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysRemaining(company?.trialEndsAt);
  const canSwitchOrManage = !user?.isSuperAdmin || isImpersonation;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.warning('Company name is required.');
      return;
    }
    setIsCreatingWorkspace(true);
    try {
      await createWorkspace({
        companyName: newCompanyName.trim(),
        phone: newPhone.trim() || user?.phone || '',
        gstin: newGstin.trim(),
      });
      toast.success(`Workspace "${newCompanyName.trim()}" created successfully!`);
      setShowCreateModal(false);
      setNewCompanyName('');
      setNewPhone('');
      setNewGstin('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  return (
    <>
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

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div
              className="navbar-brand-pill"
              onClick={() => canSwitchOrManage && setDropdownOpen(!dropdownOpen)}
              style={{
                cursor: canSwitchOrManage ? 'pointer' : 'default',
                userSelect: 'none',
              }}
              title={canSwitchOrManage ? 'Click to switch or create company workspace' : undefined}
            >
              <Building2 size={16} color="var(--color-primary-600)" style={{ flexShrink: 0 }} />
              <span className="navbar-brand-title">
                {user?.isSuperAdmin && !isImpersonation ? 'FleetFlow Global Operator' : company?.name || 'My Transport Co.'}
              </span>
              <span className={`badge ${user?.isSuperAdmin && !isImpersonation ? 'badge-warning' : 'badge-info'}`} style={{ textTransform: 'uppercase', fontSize: '10px', flexShrink: 0 }}>
                {user?.isSuperAdmin && !isImpersonation ? 'Admin' : company?.status || 'Active'}
              </span>
              {canSwitchOrManage && (
                <ChevronDown
                  size={14}
                  style={{
                    marginLeft: '2px',
                    opacity: 0.7,
                    transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              )}
            </div>

            {/* Workspace Switcher & Creator Dropdown */}
            {dropdownOpen && canSwitchOrManage && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  minWidth: '260px',
                  zIndex: 100,
                  padding: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary, #64748b)',
                    borderBottom: '1px solid var(--color-border, #e2e8f0)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Workspaces ({workspaces.length})</span>
                  <span style={{ fontSize: '10px', textTransform: 'none', opacity: 0.8 }}>Switch or Add</span>
                </div>

                {workspaces.map((ws) => {
                  const isActive = ws.company_id === company?.id;
                  return (
                    <div
                      key={ws.company_id}
                      onClick={() => {
                        if (!isActive) {
                          switchWorkspace(ws.company_id);
                          setDropdownOpen(false);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: isActive ? 'default' : 'pointer',
                        backgroundColor: isActive ? 'var(--color-primary-50, #f0fdf4)' : 'transparent',
                        color: isActive ? 'var(--color-primary-700, #15803d)' : 'var(--color-text-primary, #1e293b)',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, #f8fafc)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{ws.name}</span>
                        <span style={{ fontSize: '11px', opacity: 0.7, textTransform: 'capitalize' }}>
                          Role: {ws.role}
                        </span>
                      </div>
                      {isActive && <Check size={16} color="var(--color-primary-600, #16a34a)" />}
                    </div>
                  );
                })}

                <div style={{ height: '1px', backgroundColor: 'var(--color-border, #e2e8f0)', margin: '6px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowCreateModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px dashed var(--color-primary-400, #3b82f6)',
                    backgroundColor: 'var(--color-primary-50, #eff6ff)',
                    color: 'var(--color-primary-700, #1d4ed8)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-100, #dbeafe)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-50, #eff6ff)';
                  }}
                >
                  <Plus size={15} />
                  <span>Create New Workspace</span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Free Trial Countdown Pill */}
          {(!user?.isSuperAdmin || isImpersonation) && company?.status === 'trialing' && (
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
                {user?.isSuperAdmin && !isImpersonation ? 'Super-Admin' : role || 'Admin'}
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

      {/* In-App Create Workspace Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => !isCreatingWorkspace && setShowCreateModal(false)}
        title="Create New Workspace"
        subtitle="Set up another transport company workspace. You can seamlessly switch between workspaces anytime."
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreatingWorkspace}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateWorkspace}
              disabled={isCreatingWorkspace || !newCompanyName.trim()}
            >
              {isCreatingWorkspace ? 'Creating Workspace...' : 'Create & Switch'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateWorkspace}>
          <div className="form-group">
            <label className="form-label" htmlFor="newCompanyName">
              Transport Company Name <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <input
              id="newCompanyName"
              type="text"
              className="form-input"
              placeholder="e.g. Gujarat Express Logistics"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newPhone">
              Contact Phone Number
            </label>
            <input
              id="newPhone"
              type="tel"
              className="form-input"
              placeholder="e.g. 9876543210"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newGstin">
              GSTIN (Optional)
            </label>
            <input
              id="newGstin"
              type="text"
              className="form-input"
              placeholder="e.g. 24AAACH7409R1ZZ"
              value={newGstin}
              onChange={(e) => setNewGstin(e.target.value.toUpperCase())}
            />
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--color-slate-50, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '12px',
              color: 'var(--color-text-secondary, #64748b)',
              lineHeight: 1.5,
            }}
          >
            ℹ️ You will be registered as <strong>Administrator</strong> of this new workspace with an instant 14-day free trial. Your existing company workspace data remains completely isolated and intact.
          </div>
        </form>
      </Modal>
    </>
  );
};
