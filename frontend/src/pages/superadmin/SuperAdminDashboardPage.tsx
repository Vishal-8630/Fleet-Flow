/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN CONTROL PLANE PAGE (SuperAdminDashboardPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Central command center accessible only to platform operators with
 * `is_platform_super_admin: true`.
 * 
 * CAPABILITIES:
 * -------------
 * - Executive SaaS Telemetry (MRR, ARR, active fleet under management, active ratio).
 * - Multi-tenant directory with live search and status filters.
 * - 1-Click Trial Extensions (+7, +14, +30 days).
 * - Resource Quota Overrides (custom fleet caps).
 * - Audited 1-Hour Support Impersonation Sessions.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  Building,
  Truck,
  Users,
  Clock,
  Sliders,
  LogIn,
  Search,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: string;
  trial_ends_at: string;
  created_at: string;
  plan: { name: string; code: string } | null;
  usage: {
    trucks: number;
    drivers: number;
    users: number;
  };
  quota_overrides?: {
    max_trucks?: number;
    max_drivers?: number;
    max_users?: number;
  };
}

export const SuperAdminDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [selectedTenant, setSelectedTenant] = useState<TenantProfile | null>(null);
  const [trialModalOpen, setTrialModalOpen] = useState<boolean>(false);
  const [quotaModalOpen, setQuotaModalOpen] = useState<boolean>(false);
  const [impersonateModalOpen, setImpersonateModalOpen] = useState<boolean>(false);
  const [impersonateReason, setImpersonateReason] = useState<string>('Customer support & troubleshooting session');
  const [isSubmittingImpersonation, setIsSubmittingImpersonation] = useState<boolean>(false);
  const [additionalDays, setAdditionalDays] = useState<number>(14);
  const [quotaForm, setQuotaForm] = useState({
    max_trucks: 20,
    max_drivers: 25,
    max_users: 5,
  });

  const fetchTelemetry = async () => {
    try {
      const res = await axios.get('/api/super-admin/kpis', { withCredentials: true });
      setMetrics(res.data.metrics);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load platform telemetry.');
    }
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      let url = '/api/super-admin/tenants?limit=50';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await axios.get(url, { withCredentials: true });
      setTenants(res.data.tenants || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load tenant directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchTelemetry(), fetchTenants()]);
    setRefreshing(false);
    toast.success('Telemetry and tenant directory synced.');
  };

  useEffect(() => {
    fetchTelemetry();
    fetchTenants();
  }, [statusFilter]);

  const handleExtendTrial = async () => {
    if (!selectedTenant) return;
    try {
      const res = await axios.patch(
        `/api/super-admin/tenants/${selectedTenant.id}/extend-trial`,
        { additional_days: additionalDays },
        { withCredentials: true }
      );
      toast.success(res.data.message);
      setTrialModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to extend trial.');
    }
  };

  const handleOverrideQuotas = async () => {
    if (!selectedTenant) return;
    try {
      const res = await axios.patch(
        `/api/super-admin/tenants/${selectedTenant.id}/override`,
        quotaForm,
        { withCredentials: true }
      );
      toast.success(res.data.message);
      setQuotaModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to override quotas.');
    }
  };

  const handleToggleStatus = async (tenant: TenantProfile, newStatus: string) => {
    try {
      const res = await axios.patch(
        `/api/super-admin/tenants/${tenant.id}/status`,
        { status: newStatus },
        { withCredentials: true }
      );
      toast.success(res.data.message);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update tenant status.');
    }
  };

  const handleOpenImpersonate = (tenant: TenantProfile) => {
    setSelectedTenant(tenant);
    setImpersonateReason('Customer support & troubleshooting session');
    setImpersonateModalOpen(true);
  };

  const handleConfirmImpersonate = async () => {
    if (!selectedTenant) return;
    if (!impersonateReason.trim()) {
      toast.warning('A support justification reason is strictly required.');
      return;
    }
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        `/api/super-admin/tenants/${selectedTenant.id}/impersonate`,
        { reason: impersonateReason.trim() },
        { withCredentials: true }
      );
      toast.success(res.data.message || `Entering ${selectedTenant.name} workspace...`);
      localStorage.setItem('active_company_id', selectedTenant.id);
      setImpersonateModalOpen(false);
      // Seamlessly redirect into tenant dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate impersonation session.');
      setIsSubmittingImpersonation(false);
    }
  };

  const calculateDaysRemaining = (expiryDateStr: string) => {
    if (!expiryDateStr) return 0;
    const diff = new Date(expiryDateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      {/* 1. Executive Control Plane Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <h1 className="page-header-title" style={{ margin: 0 }}>Platform Control Plane</h1>
            <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={13} />
              SaaS Engine Root
            </span>
          </div>
          <p className="page-header-subtitle" style={{ margin: '0.35rem 0 0 0' }}>
            Multi-Tenant SaaS Telemetry, Financial Run Rates & Tenant Quota Governance
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          className="btn btn-outline btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
        </button>
      </div>

      {/* 2. Macro Telemetry KPI Cards */}
      {metrics && (
        <div className="superadmin-kpis-grid">
          {/* Card 1: Monthly Run Rate */}
          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon revenue">
              <TrendingUp size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Monthly Run Rate (MRR)</div>
              <div className="superadmin-kpi-value">₹{metrics.mrr_rupees.toLocaleString('en-IN')}</div>
              <div className="superadmin-kpi-subtext">Active subscription revenue</div>
            </div>
          </div>

          {/* Card 2: Annual Run Rate */}
          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon arr">
              <ArrowUpRight size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Annualized Run Rate (ARR)</div>
              <div className="superadmin-kpi-value">₹{metrics.arr_rupees.toLocaleString('en-IN')}</div>
              <div className="superadmin-kpi-subtext">Projected 12-month ARR</div>
            </div>
          </div>

          {/* Card 3: Active Transporters */}
          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon tenants">
              <Building size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Active Transporters</div>
              <div className="superadmin-kpi-value">{metrics.active_tenants} / {metrics.total_tenants}</div>
              <div className="superadmin-kpi-subtext">
                {metrics.total_tenants > 0
                  ? `${Math.round((metrics.active_tenants / metrics.total_tenants) * 100)}% conversion rate`
                  : '0% conversion'}
              </div>
            </div>
          </div>

          {/* Card 4: Fleet Under Management */}
          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon fleet">
              <Truck size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Fleet Under Management</div>
              <div className="superadmin-kpi-value">{metrics.fleet_trucks_managed} Trucks</div>
              <div className="superadmin-kpi-subtext">Across all tenant registries</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Registered Tenant Directory Card */}
      <div className="tenant-table-card">
        <div className="tenant-table-header">
          <div className="tenant-table-title">
            <Building size={18} color="var(--color-primary-600)" />
            <h3>Registered Tenant Directory</h3>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {tenants.length} Workspaces
            </span>
          </div>

          <div className="tenant-search-toolbar">
            <div className="tenant-search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search enterprise, slug, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTenants()}
              />
            </div>

            <select
              className="tenant-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
            <p style={{ margin: 0 }}>Syncing tenant directory...</p>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <p style={{ margin: 0, fontWeight: 'var(--font-weight-semibold)' }}>No tenants matching your filters</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>Try clearing your search query or status filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Enterprise Tenant</th>
                  <th>Plan Tier</th>
                  <th>Status</th>
                  <th>Fleet Utilization</th>
                  <th>Trial Expiry</th>
                  <th style={{ textAlign: 'right' }}>Admin Governance</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const daysRemaining = calculateDaysRemaining(tenant.trial_ends_at);
                  const isExpired = daysRemaining < 0;

                  return (
                    <tr key={tenant.id}>
                      {/* Enterprise Tenant */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building size={16} color="var(--color-primary-600)" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
                              {tenant.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              <span style={{ fontFamily: 'monospace' }}>{tenant.slug}</span> • {tenant.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Tier */}
                      <td>
                        <span className={`tenant-plan-pill ${tenant.plan?.code || 'starter'}`}>
                          {tenant.plan?.name || 'Starter Trial'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${
                          tenant.status === 'active'
                            ? 'badge-success'
                            : tenant.status === 'suspended'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}>
                          {tenant.status}
                        </span>
                      </td>

                      {/* Fleet Utilization */}
                      <td>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                          {tenant.usage.trucks} Trucks • {tenant.usage.drivers} Drivers
                        </div>
                        {tenant.quota_overrides?.max_trucks && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-primary-600)', marginTop: '0.15rem' }}>
                            Quota Override: {tenant.quota_overrides.max_trucks} Max Trucks
                          </div>
                        )}
                      </td>

                      {/* Trial Expiry */}
                      <td>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)' }}>
                          {new Date(tenant.trial_ends_at).toLocaleDateString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isExpired ? 'var(--color-danger)' : 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {isExpired ? 'Expired' : `${daysRemaining} days left`}
                        </div>
                      </td>

                      {/* Governance Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="tenant-actions-group">
                          {/* +Trial Button */}
                          <button
                            type="button"
                            className="tenant-action-btn"
                            title="Extend Trial Days"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setTrialModalOpen(true);
                            }}
                          >
                            <Clock size={13} />
                            <span>+Trial</span>
                          </button>

                          {/* Quota Override Button */}
                          <button
                            type="button"
                            className="tenant-action-btn"
                            title="Configure Quota Limits"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setQuotaForm({
                                max_trucks: tenant.quota_overrides?.max_trucks || 25,
                                max_drivers: tenant.quota_overrides?.max_drivers || 30,
                                max_users: tenant.quota_overrides?.max_users || 10,
                              });
                              setQuotaModalOpen(true);
                            }}
                          >
                            <Sliders size={13} />
                            <span>Quotas</span>
                          </button>

                          {/* Suspend / Activate Toggle */}
                          <button
                            type="button"
                            className={`tenant-action-btn ${tenant.status === 'suspended' ? 'activate' : 'danger'}`}
                            title={tenant.status === 'suspended' ? 'Reactivate Tenant' : 'Suspend Tenant'}
                            onClick={() => handleToggleStatus(tenant, tenant.status === 'suspended' ? 'active' : 'suspended')}
                          >
                            {tenant.status === 'suspended' ? <CheckCircle size={13} /> : <AlertOctagon size={13} />}
                            <span>{tenant.status === 'suspended' ? 'Activate' : 'Suspend'}</span>
                          </button>

                          {/* Impersonation Button */}
                          <button
                            type="button"
                            className="tenant-action-btn impersonate"
                            title="1-Hour Support Impersonation"
                            onClick={() => handleOpenImpersonate(tenant)}
                          >
                            <LogIn size={13} />
                            <span>Access</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Extend Trial Modal */}
      <Modal
        isOpen={trialModalOpen}
        onClose={() => setTrialModalOpen(false)}
        title="Extend Company Trial Period"
        subtitle={`Grant extra trial days to ${selectedTenant?.name}`}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Extension Duration</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                className={`btn ${additionalDays === days ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '0.6rem 0.5rem' }}
                onClick={() => setAdditionalDays(days)}
              >
                +{days} Days
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setTrialModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExtendTrial}>
            Apply Extension
          </button>
        </div>
      </Modal>

      {/* Quota Override Modal */}
      <Modal
        isOpen={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        title="Custom Resource Quota Overrides"
        subtitle={`Set custom fleet and user capacity caps for ${selectedTenant?.name}`}
      >
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Maximum Fleet Trucks (-1 for unlimited)</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_trucks}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_trucks: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Maximum Commercial Drivers (-1 for unlimited)</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_drivers}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_drivers: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Maximum Team Accounts</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_users}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_users: parseInt(e.target.value, 10) })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setQuotaModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOverrideQuotas}>
            Save Quotas
          </button>
        </div>
      </Modal>

      {/* Audited Support Impersonation Modal */}
      <Modal
        isOpen={impersonateModalOpen}
        onClose={() => !isSubmittingImpersonation && setImpersonateModalOpen(false)}
        title="Audited Support Impersonation"
        subtitle={`Access ${selectedTenant?.name} workspace with temporary operator privileges`}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              padding: '0.875rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary-50, #eff6ff)',
              border: '1px solid var(--color-primary-200, #bfdbfe)',
              marginBottom: '1rem',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--color-primary-900, #1e3a8a)',
            }}
          >
            <div><strong>Target Workspace:</strong> {selectedTenant?.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
              Slug: <code>{selectedTenant?.slug}</code> • Contact: {selectedTenant?.email}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="impersonateReason" style={{ marginBottom: '0.375rem', display: 'block', fontWeight: 600 }}>
              Support Justification / Ticket ID <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <textarea
              id="impersonateReason"
              className="form-control"
              rows={3}
              placeholder="e.g. TICKET-4482: Customer reported discrepancy in trip freight calculation"
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              autoFocus
              required
              style={{ width: '100%', resize: 'vertical' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', marginTop: '0.25rem', display: 'block' }}>
              Required by platform compliance. Stored permanently in the Platform Security Audit Log.
            </span>
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: '12px',
              color: '#92400e',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span>
              <strong>Platform Notice:</strong> You will temporarily enter this tenant's workspace for up to 1 hour. An amber <strong>Impersonation Banner</strong> will be pinned to the top of all screens with an <em>[Exit Impersonation]</em> button to safely return here at any time.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setImpersonateModalOpen(false)}
            disabled={isSubmittingImpersonation}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmImpersonate}
            disabled={isSubmittingImpersonation || !impersonateReason.trim()}
            style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' }}
          >
            {isSubmittingImpersonation ? 'Entering Workspace...' : 'Enter Workspace'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
