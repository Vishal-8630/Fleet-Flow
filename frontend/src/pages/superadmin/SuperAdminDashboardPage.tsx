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
 * - Executive SaaS Telemetry (MRR, ARR, active fleet under management, churn).
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
  ShieldAlert,
  Sliders,
  LogIn,
  Search,
  CheckCircle,
  AlertOctagon,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
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
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [selectedTenant, setSelectedTenant] = useState<TenantProfile | null>(null);
  const [trialModalOpen, setTrialModalOpen] = useState<boolean>(false);
  const [quotaModalOpen, setQuotaModalOpen] = useState<boolean>(false);
  const [additionalDays, setAdditionalDays] = useState<number>(14);
  const [quotaForm, setQuotaForm] = useState({
    max_trucks: 20,
    max_drivers: 25,
    max_users: 5,
  });

  useEffect(() => {
    fetchTelemetry();
    fetchTenants();
  }, [statusFilter]);

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
      let url = '/api/super-admin/tenants?limit=30';
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

  const handleImpersonate = async (tenant: TenantProfile) => {
    try {
      const res = await axios.post(
        `/api/super-admin/tenants/${tenant.id}/impersonate`,
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate impersonation session.');
    }
  };

  return (
    <div className="shell-container">
      <PageHeader
        title="Platform Super-Admin Control Plane"
        subtitle="Multi-Tenant SaaS Health, Telemetry, and Tenant Quota Governance"
      />

      {/* 1. Macro Health Telemetry KPIs */}
      {metrics && (
        <div className="superadmin-kpis-grid">
          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon revenue">
              <TrendingUp size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Monthly Run Rate (MRR)</div>
              <div className="superadmin-kpi-value">₹{metrics.mrr_rupees.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon revenue">
              <TrendingUp size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Annual Run Rate (ARR)</div>
              <div className="superadmin-kpi-value">₹{metrics.arr_rupees.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon tenants">
              <Building size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Active Transporters</div>
              <div className="superadmin-kpi-value">{metrics.active_tenants} / {metrics.total_tenants}</div>
            </div>
          </div>

          <div className="superadmin-kpi-card">
            <div className="superadmin-kpi-icon fleet">
              <Truck size={24} />
            </div>
            <div className="superadmin-kpi-content">
              <div className="superadmin-kpi-label">Fleet Under Management</div>
              <div className="superadmin-kpi-value">{metrics.fleet_trucks_managed} Trucks</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Tenant Directory & Controls */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
            Registered Tenant Directory ({tenants.length})
          </h3>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search company or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTenants()}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '160px' }}
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
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading tenant directory...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Plan Tier</th>
                  <th>Status</th>
                  <th>Fleet Utilization</th>
                  <th>Trial Expiry</th>
                  <th style={{ textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <strong>{tenant.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {tenant.slug} • {tenant.email}
                      </div>
                    </td>
                    <td>
                      <span className={`tenant-plan-pill ${tenant.plan?.code || 'starter'}`}>
                        {tenant.plan?.name || 'Starter Trial'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tenant.status === 'active' ? 'badge-success' : tenant.status === 'suspended' ? 'badge-danger' : 'badge-warning'}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        {tenant.usage.trucks} Trucks • {tenant.usage.drivers} Drivers
                      </div>
                      {tenant.quota_overrides?.max_trucks && (
                        <small style={{ color: 'var(--color-primary)' }}>
                          (Override: {tenant.quota_overrides.max_trucks} max)
                        </small>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        {new Date(tenant.trial_ends_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          title="Extend Trial"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setTrialModalOpen(true);
                          }}
                        >
                          <Clock size={14} />
                          +Trial
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          title="Override Quotas"
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
                          <Sliders size={14} />
                          Quotas
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: tenant.status === 'suspended' ? '#10b981' : '#ef4444' }}
                          title={tenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
                          onClick={() => handleToggleStatus(tenant, tenant.status === 'suspended' ? 'active' : 'suspended')}
                        >
                          {tenant.status === 'suspended' ? <CheckCircle size={14} /> : <AlertOctagon size={14} />}
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          title="1-Hour Support Impersonation"
                          onClick={() => handleImpersonate(tenant)}
                        >
                          <LogIn size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Extension Duration</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                className={`btn ${additionalDays === days ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAdditionalDays(days)}
              >
                +{days} Days
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
        title="Custom Quota Overrides"
        subtitle={`Set custom fleet and user caps for ${selectedTenant?.name}`}
      >
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label">Maximum Fleet Trucks (-1 for unlimited)</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_trucks}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_trucks: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label">Maximum Commercial Drivers (-1 for unlimited)</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_drivers}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_drivers: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">Maximum Team Accounts</label>
          <input
            type="number"
            className="form-control"
            value={quotaForm.max_users}
            onChange={(e) => setQuotaForm({ ...quotaForm, max_users: parseInt(e.target.value, 10) })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setQuotaModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOverrideQuotas}>
            Save Overrides
          </button>
        </div>
      </Modal>
    </div>
  );
};
