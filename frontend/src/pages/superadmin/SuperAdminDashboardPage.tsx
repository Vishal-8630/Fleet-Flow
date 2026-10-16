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
  ShieldAlert,
  Send,
  AlertTriangle,
  XCircle,
  Check,
  Lock,
  FileText,
  ChevronDown,
  ChevronRight,
  Filter,
  ExternalLink,
  Eye,
  History,
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

  // Main Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'tenants' | 'support_sessions' | 'audit_logs'>('tenants');

  // Platform Support Access Authorizations State
  const [allSupportSessions, setAllSupportSessions] = useState<any[]>([]);
  const [loadingAllSessions, setLoadingAllSessions] = useState<boolean>(false);
  const [supportStatusFilter, setSupportStatusFilter] = useState<string>('');
  const [supportSearch, setSupportSearch] = useState<string>('');

  // Platform Audit Trail State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  // DEC-012 Support Access State (for tenant modal)
  const [supportSessions, setSupportSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [supportScope, setSupportScope] = useState<'diagnostics_readonly' | 'config_write'>('diagnostics_readonly');
  const [supportDuration, setSupportDuration] = useState<number>(30);
  const [supportActiveTab, setSupportActiveTab] = useState<'request' | 'emergency'>('request');
  const [emergencyReason, setEmergencyReason] = useState<string>('');

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

  const fetchAllSupportSessions = async () => {
    try {
      setLoadingAllSessions(true);
      const res = await axios.get('/api/super-admin/support-access', { withCredentials: true });
      setAllSupportSessions(res.data.sessions || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load support sessions.');
    } finally {
      setLoadingAllSessions(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const res = await axios.get('/api/super-admin/audit-logs', { withCredentials: true });
      setAuditLogs(res.data.logs || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load platform audit logs.');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTelemetry(),
      fetchTenants(),
      fetchAllSupportSessions(),
      fetchAuditLogs(),
    ]);
    setRefreshing(false);
    toast.success('Telemetry, tenant directory, support authorizations, and audit logs synced.');
  };

  useEffect(() => {
    fetchTelemetry();
    fetchTenants();
    fetchAllSupportSessions();
    fetchAuditLogs();
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

  const fetchTenantSupportSessions = async (companyId: string) => {
    try {
      setLoadingSessions(true);
      const res = await axios.get(`/api/super-admin/support-access?company_id=${companyId}`, { withCredentials: true });
      setSupportSessions(res.data.sessions || []);
    } catch (err: any) {
      console.warn('Failed to load support sessions:', err.message);
      setSupportSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleOpenImpersonate = (tenant: TenantProfile) => {
    setSelectedTenant(tenant);
    setImpersonateReason('Customer support & troubleshooting session');
    setEmergencyReason('');
    setSupportActiveTab('request');
    setSupportDuration(30);
    setSupportScope('diagnostics_readonly');
    setImpersonateModalOpen(true);
    fetchTenantSupportSessions(tenant.id);
  };

  const handleSendAccessRequest = async () => {
    if (!selectedTenant) return;
    if (!impersonateReason.trim()) {
      toast.warning('A support justification reason is strictly required.');
      return;
    }
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        '/api/super-admin/support-access/request',
        {
          company_id: selectedTenant.id,
          justification: impersonateReason.trim(),
          duration_minutes: supportDuration,
          scope: supportScope,
        },
        { withCredentials: true }
      );
      toast.success(res.data.message || `Support access request sent to ${selectedTenant.name} administrator.`);
      await fetchTenantSupportSessions(selectedTenant.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send support access request.');
    } finally {
      setIsSubmittingImpersonation(false);
    }
  };

  const handleActivateApprovedSession = async (sessionId: string) => {
    if (!selectedTenant) return;
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        `/api/super-admin/support-access/${sessionId}/activate`,
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message || `Entering ${selectedTenant.name} workspace...`);
      localStorage.setItem('active_company_id', selectedTenant.id);
      setImpersonateModalOpen(false);
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to activate approved support session.');
      setIsSubmittingImpersonation(false);
    }
  };

  const handleResumeActiveSession = () => {
    if (!selectedTenant) return;
    localStorage.setItem('active_company_id', selectedTenant.id);
    setImpersonateModalOpen(false);
    window.location.href = '/dashboard';
  };

  const handleRevokeSession = async (sessionId: string) => {
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        `/api/super-admin/support-access/${sessionId}/revoke`,
        { reason: 'Session closed by platform super administrator' },
        { withCredentials: true }
      );
      toast.success(res.data.message || 'Support session revoked.');
      if (selectedTenant) {
        await fetchTenantSupportSessions(selectedTenant.id);
      }
      await fetchAllSupportSessions();
      await fetchAuditLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to revoke support session.');
    } finally {
      setIsSubmittingImpersonation(false);
    }
  };

  const handleActivateApprovedSessionFromList = async (session: any) => {
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        `/api/super-admin/support-access/${session._id}/activate`,
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message || 'Support session activated. Entering workspace...');
      const targetCompanyId = session.company_id?._id || session.company_id;
      if (targetCompanyId) {
        localStorage.setItem('active_company_id', targetCompanyId);
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to activate approved support session.');
      setIsSubmittingImpersonation(false);
    }
  };

  const handleResumeSessionFromList = (session: any) => {
    const targetCompanyId = session.company_id?._id || session.company_id;
    if (targetCompanyId) {
      localStorage.setItem('active_company_id', targetCompanyId);
    }
    window.location.href = '/dashboard';
  };

  const handleEmergencyAccess = async () => {
    if (!selectedTenant) return;
    if (emergencyReason.trim().length < 20) {
      toast.warning('Emergency justification must be at least 20 characters.');
      return;
    }
    setIsSubmittingImpersonation(true);
    try {
      const res = await axios.post(
        '/api/super-admin/support-access/emergency-access',
        {
          company_id: selectedTenant.id,
          justification: emergencyReason.trim(),
        },
        { withCredentials: true }
      );
      toast.success(res.data.message || `Emergency access activated for ${selectedTenant.name}.`);
      localStorage.setItem('active_company_id', selectedTenant.id);
      setImpersonateModalOpen(false);
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to activate emergency access.');
      setIsSubmittingImpersonation(false);
    }
  };

  const calculateDaysRemaining = (expiryDateStr: string) => {
    if (!expiryDateStr) return 0;
    const diff = new Date(expiryDateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const filteredSupportSessions = allSupportSessions.filter((s) => {
    if (supportStatusFilter && s.status !== supportStatusFilter) return false;
    if (supportSearch.trim()) {
      const q = supportSearch.toLowerCase().trim();
      const companyName = (s.company_id?.name || '').toLowerCase();
      const companySlug = (s.company_id?.slug || '').toLowerCase();
      const reqEmail = (s.requested_by?.email || '').toLowerCase();
      const reqName = (s.requested_by?.name || '').toLowerCase();
      const ticketNo = (s.ticket_id?.ticket_no || '').toLowerCase();
      const justification = (s.justification || '').toLowerCase();
      const reason = (s.revocation_reason || '').toLowerCase();
      if (
        !companyName.includes(q) &&
        !companySlug.includes(q) &&
        !reqEmail.includes(q) &&
        !reqName.includes(q) &&
        !ticketNo.includes(q) &&
        !justification.includes(q) &&
        !reason.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditActionFilter) {
      if (auditActionFilter === 'support_all') {
        if (!log.action?.startsWith('support_') && log.action !== 'emergency_support_activated') {
          return false;
        }
      } else if (log.action !== auditActionFilter) {
        return false;
      }
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase().trim();
      const actorEmail = (log.actor_email || '').toLowerCase();
      const targetComp = (log.target_company_name || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const ip = (log.ip_address || '').toLowerCase();
      const detailsStr = JSON.stringify(log.details || {}).toLowerCase();
      if (
        !actorEmail.includes(q) &&
        !targetComp.includes(q) &&
        !action.includes(q) &&
        !ip.includes(q) &&
        !detailsStr.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'support_access_requested':
        return <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Support Requested</span>;
      case 'support_access_approved':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Support Approved</span>;
      case 'support_access_rejected':
        return <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> Support Rejected</span>;
      case 'support_access_activated':
        return <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LogIn size={12} /> Session Activated</span>;
      case 'support_access_revoked':
        return <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Session Revoked</span>;
      case 'support_access_expired':
        return <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Session Expired</span>;
      case 'emergency_support_activated':
        return <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#dc2626', color: '#fff' }}><ShieldAlert size={12} /> 🚨 Break-Glass Activated</span>;
      case 'quota_override':
        return <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Sliders size={12} /> Quota Override</span>;
      case 'trial_extension':
        return <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> Trial Extended</span>;
      case 'subscription_status_override':
        return <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Status Override</span>;
      default:
        return <span className="badge badge-neutral">{action.replace(/_/g, ' ')}</span>;
    }
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

      {/* 3. Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.375rem',
          background: 'var(--bg-subtle, #f1f5f9)',
          borderRadius: 'var(--radius-lg, 10px)',
          padding: '0.375rem',
          width: 'fit-content',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveMainTab('tenants')}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            cursor: 'pointer',
            background: activeMainTab === 'tenants' ? 'var(--bg-card, #ffffff)' : 'transparent',
            color: activeMainTab === 'tenants' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeMainTab === 'tenants' ? 600 : 500,
            fontSize: 'var(--font-size-sm, 13px)',
            boxShadow: activeMainTab === 'tenants' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Building size={15} />
          Registered Tenants ({tenants.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab('support_sessions');
            fetchAllSupportSessions();
          }}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            cursor: 'pointer',
            background: activeMainTab === 'support_sessions' ? 'var(--bg-card, #ffffff)' : 'transparent',
            color: activeMainTab === 'support_sessions' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeMainTab === 'support_sessions' ? 600 : 500,
            fontSize: 'var(--font-size-sm, 13px)',
            boxShadow: activeMainTab === 'support_sessions' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={15} />
          Support Access Authorizations ({allSupportSessions.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab('audit_logs');
            fetchAuditLogs();
          }}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            cursor: 'pointer',
            background: activeMainTab === 'audit_logs' ? 'var(--bg-card, #ffffff)' : 'transparent',
            color: activeMainTab === 'audit_logs' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeMainTab === 'audit_logs' ? 600 : 500,
            fontSize: 'var(--font-size-sm, 13px)',
            boxShadow: activeMainTab === 'audit_logs' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Clock size={15} />
          Platform Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* 4. Tab 1: Registered Tenant Directory Card */}
      {activeMainTab === 'tenants' && (
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
      )}

      {/* 5. Tab 2: Support Access Authorizations & History */}
      {activeMainTab === 'support_sessions' && (
        <div className="tenant-table-card">
          <div className="tenant-table-header">
            <div className="tenant-table-title">
              <ShieldCheck size={18} color="var(--color-primary-600)" />
              <h3>Support Access Authorizations & Diagnostic Sessions</h3>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                {filteredSupportSessions.length} Records
              </span>
            </div>

            <div className="tenant-search-toolbar">
              <div className="tenant-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search workspace, ticket, or reason..."
                  value={supportSearch}
                  onChange={(e) => setSupportSearch(e.target.value)}
                />
              </div>

              <select
                className="tenant-filter-select"
                value={supportStatusFilter}
                onChange={(e) => setSupportStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="active">Active Sessions</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>

              <button
                type="button"
                onClick={fetchAllSupportSessions}
                className="btn btn-outline btn-sm"
                title="Refresh sessions"
                disabled={loadingAllSessions}
              >
                <RefreshCw size={13} className={loadingAllSessions ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loadingAllSessions ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ margin: 0 }}>Syncing support access sessions...</p>
            </div>
          ) : filteredSupportSessions.length === 0 ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldCheck size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 'var(--font-weight-semibold)' }}>No support sessions found</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>Try clearing your search query or status filter.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Target Workspace</th>
                    <th>Operator</th>
                    <th>Scope & Duration</th>
                    <th>Status</th>
                    <th>Justification & Reason</th>
                    <th>Timeline</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupportSessions.map((session) => {
                    const isLive = session.status === 'active' && (!session.expires_at || new Date(session.expires_at).getTime() > Date.now());
                    const minsRemaining = session.expires_at
                      ? Math.max(1, Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60000))
                      : session.duration_minutes;

                    return (
                      <tr key={session._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {session.company_id?.name || 'Workspace'}
                            {session.is_emergency && (
                              <span className="badge badge-danger" style={{ fontSize: '10px', marginLeft: '6px' }}>
                                🚨 Break-Glass
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {session.company_id?.slug || ''}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '12px' }}>
                            {session.requested_by?.name || 'Platform Operator'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {session.requested_by?.email || 'operator@platform.fleetflow.io'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>
                            {session.scope === 'diagnostics_readonly' ? 'Read-Only Diagnostics' : 'Configuration'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {session.duration_minutes} minutes
                            {session.ticket_id?.ticket_no && ` • ${session.ticket_id.ticket_no}`}
                          </div>
                        </td>
                        <td>
                          {session.status === 'pending' && <span className="badge badge-warning">Pending Approval</span>}
                          {session.status === 'approved' && <span className="badge badge-success">Approved (Ready)</span>}
                          {session.status === 'active' && isLive && (
                            <span className="badge badge-info">Active ({minsRemaining}m left)</span>
                          )}
                          {session.status === 'active' && !isLive && (
                            <span className="badge badge-neutral">Expired</span>
                          )}
                          {session.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                          {session.status === 'expired' && <span className="badge badge-neutral">Expired</span>}
                          {session.status === 'revoked' && <span className="badge badge-neutral">Revoked</span>}
                        </td>
                        <td style={{ maxWidth: '280px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            "{session.justification}"
                          </div>
                          {session.revocation_reason && (
                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', fontWeight: 500 }}>
                              Decision Note: "{session.revocation_reason}"
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Req: {new Date(session.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                          {session.approved_by && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Approved by: {session.approved_by.name || session.approved_by.email}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {session.status === 'approved' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleActivateApprovedSessionFromList(session)}
                                disabled={isSubmittingImpersonation}
                                style={{ backgroundColor: '#059669', borderColor: '#059669', fontSize: '11px', padding: '3px 8px' }}
                              >
                                <LogIn size={12} style={{ marginRight: '3px' }} />
                                Enter Workspace
                              </button>
                            )}
                            {session.status === 'active' && isLive && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleResumeSessionFromList(session)}
                                  style={{ backgroundColor: '#2563eb', fontSize: '11px', padding: '3px 8px' }}
                                >
                                  <LogIn size={12} style={{ marginRight: '3px' }} />
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleRevokeSession(session._id)}
                                  disabled={isSubmittingImpersonation}
                                  style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '11px', padding: '3px 8px' }}
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                            {session.status === 'pending' && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleRevokeSession(session._id)}
                                disabled={isSubmittingImpersonation}
                                style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '11px', padding: '3px 8px' }}
                              >
                                Cancel
                              </button>
                            )}
                            {session.status === 'rejected' && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  const t = tenants.find((x) => x.id === (session.company_id?._id || session.company_id));
                                  if (t) handleOpenImpersonate(t);
                                }}
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                New Request
                              </button>
                            )}
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
      )}

      {/* 6. Tab 3: Platform Forensic Audit Trail */}
      {activeMainTab === 'audit_logs' && (
        <div className="tenant-table-card">
          <div className="tenant-table-header">
            <div className="tenant-table-title">
              <Clock size={18} color="var(--color-primary-600)" />
              <h3>Platform Forensic Audit Trail</h3>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                {filteredAuditLogs.length} Events
              </span>
            </div>

            <div className="tenant-search-toolbar">
              <div className="tenant-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search actor, workspace, action, IP..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                />
              </div>

              <select
                className="tenant-filter-select"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="">All Action Types</option>
                <option value="support_all">All Support Access Events</option>
                <option value="support_access_requested">Support Requested</option>
                <option value="support_access_approved">Support Approved</option>
                <option value="support_access_rejected">Support Rejected</option>
                <option value="support_access_activated">Session Activated</option>
                <option value="support_access_revoked">Session Revoked</option>
                <option value="support_access_expired">Session Expired</option>
                <option value="emergency_support_activated">🚨 Break-Glass Emergency</option>
                <option value="quota_override">Quota Overrides</option>
                <option value="trial_extension">Trial Extensions</option>
                <option value="subscription_status_override">Subscription Overrides</option>
              </select>

              <button
                type="button"
                onClick={fetchAuditLogs}
                className="btn btn-outline btn-sm"
                title="Refresh logs"
                disabled={loadingAuditLogs}
              >
                <RefreshCw size={13} className={loadingAuditLogs ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loadingAuditLogs ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ margin: 0 }}>Syncing platform audit trail...</p>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 'var(--font-weight-semibold)' }}>No audit events found</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>Try clearing your search query or filter.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor (Operator)</th>
                    <th>Target Workspace</th>
                    <th>IP Address</th>
                    <th>Details / Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => {
                    const isExpanded = expandedAuditLogId === log._id;
                    return (
                      <React.Fragment key={log._id}>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                            <div style={{ fontWeight: 500 }}>
                              {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                            </div>
                          </td>
                          <td>
                            {getActionBadge(log.action)}
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: 500 }}>
                              {log.actor_email}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {log.target_company_name || 'Platform-wide'}
                            </div>
                          </td>
                          <td style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {log.ip_address || '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.details?.reason || log.details?.justification || (log.details?.scope ? `Scope: ${log.details.scope} (${log.details.duration_minutes || ''}m)` : JSON.stringify(log.details || {}))}
                              </div>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedAuditLogId(isExpanded ? null : log._id)}
                                  className="btn btn-outline btn-xs"
                                  style={{ padding: '2px 6px', fontSize: '10px' }}
                                >
                                  {isExpanded ? 'Hide' : 'Details'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
                            <td colSpan={6} style={{ padding: '0.75rem 1.5rem' }}>
                              <div style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      {/* Controlled Support Access Modal (DEC-012 Policy) */}
      <Modal
        isOpen={impersonateModalOpen}
        onClose={() => !isSubmittingImpersonation && setImpersonateModalOpen(false)}
        title="Tenant Support Access Control"
        subtitle={`DEC-012 Policy Protected • Target Workspace: ${selectedTenant?.name}`}
      >
        {(() => {
          const activeSession = supportSessions.find(
            (s) => s.status === 'active' && s.expires_at && new Date(s.expires_at).getTime() > Date.now()
          );
          const approvedSession = supportSessions.find((s) => s.status === 'approved');
          const pendingSession = supportSessions.find((s) => s.status === 'pending');
          const recentRejectedSession = supportSessions.find((s) => s.status === 'rejected');

          return (
            <div style={{ marginBottom: '1.25rem' }}>
              {/* Target Workspace Meta Card */}
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div><strong>Target Workspace:</strong> {selectedTenant?.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
                    Slug: <code>{selectedTenant?.slug}</code> • Admin: <strong>{selectedTenant?.email}</strong>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  DEC-012 Policy Enforced
                </span>
              </div>

              {loadingSessions ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Checking authorization status with workspace registry...</div>
                </div>
              ) : activeSession ? (
                /* STATE A: ACTIVE SUPPORT SESSION RUNNING */
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #3b82f6',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#1d4ed8' }}>
                    <ShieldCheck size={20} />
                    <strong style={{ fontSize: '15px' }}>Active Support Session In Progress</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: '#1e3a8a', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                    You currently hold an active, audited support session for this tenant. Every mutation performed inside this workspace is tagged to your operator identity.
                  </p>
                  <div style={{ fontSize: '12px', color: '#1e40af', background: '#dbeafe', padding: '0.625rem 0.875rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                    <div><strong>Session Type:</strong> {activeSession.is_emergency ? '🚨 Single-Admin Emergency Break-Glass' : '✅ Workspace-Admin Approved Session'}</div>
                    <div><strong>Scope:</strong> <code>{activeSession.scope}</code></div>
                    <div><strong>Expires At:</strong> {new Date(activeSession.expires_at).toLocaleTimeString()} ({Math.max(1, Math.round((new Date(activeSession.expires_at).getTime() - Date.now()) / 60000))} minutes remaining)</div>
                    <div><strong>Justification:</strong> {activeSession.justification}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={() => handleRevokeSession(activeSession._id)}
                      disabled={isSubmittingImpersonation}
                    >
                      <XCircle size={14} style={{ marginRight: '4px' }} />
                      Revoke Session
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleResumeActiveSession}
                      disabled={isSubmittingImpersonation}
                      style={{ backgroundColor: '#2563eb' }}
                    >
                      <LogIn size={14} style={{ marginRight: '4px' }} />
                      Enter Workspace (Resume Session)
                    </button>
                  </div>
                </div>
              ) : approvedSession ? (
                /* STATE B: APPROVED BY WORKSPACE ADMIN -> READY TO ENTER */
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #10b981',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#047857' }}>
                    <CheckCircle size={20} />
                    <strong style={{ fontSize: '15px' }}>Authorization Granted by Workspace Administrator!</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: '#065f46', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                    The company administrator has approved your support access request. Clicking below will atomically activate your constrained support token.
                  </p>
                  <div style={{ fontSize: '12px', color: '#047857', background: '#d1fae5', padding: '0.625rem 0.875rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                    <div><strong>Approved Duration:</strong> {approvedSession.duration_minutes} minutes</div>
                    <div><strong>Approved Scope:</strong> <code>{approvedSession.scope}</code></div>
                    <div><strong>Approved By:</strong> {approvedSession.approved_by?.email || selectedTenant?.email}</div>
                    <div><strong>Justification:</strong> {approvedSession.justification}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
                      onClick={() => handleActivateApprovedSession(approvedSession._id)}
                      disabled={isSubmittingImpersonation}
                      style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                    >
                      <LogIn size={14} style={{ marginRight: '4px' }} />
                      {isSubmittingImpersonation ? 'Entering Workspace...' : 'Enter Workspace (Activate Approved Session)'}
                    </button>
                  </div>
                </div>
              ) : (
                /* STATE C: REQUEST FORM OR EMERGENCY BREAK-GLASS */
                <div>
                  {pendingSession && (
                    <div
                      style={{
                        padding: '0.875rem 1rem',
                        borderRadius: '6px',
                        backgroundColor: '#fffbeb',
                        border: '1.5px solid #f59e0b',
                        marginBottom: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 600 }}>
                          <Clock size={16} />
                          <span>Request Pending Workspace Admin Approval</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => selectedTenant && fetchTenantSupportSessions(selectedTenant.id)}
                          disabled={loadingSessions}
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                        >
                          <RefreshCw size={11} className={loadingSessions ? 'animate-spin' : ''} style={{ marginRight: '3px' }} />
                          Check Status
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: 1.4 }}>
                        A support access request was dispatched on <strong>{new Date(pendingSession.created_at).toLocaleTimeString()}</strong>. Awaiting authorization from <strong>{selectedTenant?.email}</strong>.
                      </p>
                      <div style={{ fontSize: '11px', color: '#78350f', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>
                        Justification: "{pendingSession.justification}"
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => handleRevokeSession(pendingSession._id)}
                          disabled={isSubmittingImpersonation}
                        >
                          Cancel Pending Request
                        </button>
                      </div>
                    </div>
                  )}

                  {!pendingSession && recentRejectedSession && (
                    <div
                      style={{
                        padding: '0.875rem 1rem',
                        borderRadius: '6px',
                        backgroundColor: '#fef2f2',
                        border: '1.5px solid #f87171',
                        marginBottom: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontWeight: 600 }}>
                        <XCircle size={16} />
                        <span>Previous Access Request Was Rejected by Workspace Admin</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d' }}>
                        <strong>Decision Reason:</strong> "{recentRejectedSession.revocation_reason || 'Rejected by tenant administrator'}"
                        <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                          · {new Date(recentRejectedSession.updated_at || recentRejectedSession.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                        You may submit a revised support access request below with clarified justification.
                      </div>
                    </div>
                  )}

                  {/* Tabs: Standard Support Request vs Emergency Break-Glass */}
                  <div
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--color-border, #e2e8f0)',
                      marginBottom: '1rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSupportActiveTab('request')}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderBottom: supportActiveTab === 'request' ? '2px solid #2563eb' : '2px solid transparent',
                        color: supportActiveTab === 'request' ? '#2563eb' : 'var(--color-text-secondary, #64748b)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Send size={14} />
                      Request Access from Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupportActiveTab('emergency')}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderBottom: supportActiveTab === 'emergency' ? '2px solid #dc2626' : '2px solid transparent',
                        color: supportActiveTab === 'emergency' ? '#dc2626' : 'var(--color-text-secondary, #64748b)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <ShieldAlert size={14} />
                      Emergency Break-Glass (15m)
                    </button>
                  </div>

                  {supportActiveTab === 'request' ? (
                    <div>
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          color: '#475569',
                          lineHeight: 1.4,
                          marginBottom: '1rem',
                        }}
                      >
                        <strong>How this works:</strong> Under DEC-012 policy, clicking <em>"Send Request to Workspace Admin"</em> creates a ticket and sends an approval request to <strong>{selectedTenant?.email}</strong>. Once approved by the workspace administrator, you will be able to enter the workspace.
                      </div>

                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label" htmlFor="impersonateReason" style={{ marginBottom: '0.375rem', display: 'block', fontWeight: 600 }}>
                          Support Justification / Context <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                        </label>
                        <textarea
                          id="impersonateReason"
                          className="form-control"
                          rows={3}
                          placeholder="e.g. Investigating freight discrepancy in trip freight calculation reported by customer"
                          value={impersonateReason}
                          onChange={(e) => setImpersonateReason(e.target.value)}
                          autoFocus
                          required
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <label className="form-label" style={{ marginBottom: '0.375rem', display: 'block', fontWeight: 600 }}>
                            Access Duration
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[15, 30, 60].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                className={`btn btn-sm ${supportDuration === mins ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setSupportDuration(mins)}
                                style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '12px' }}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="form-label" style={{ marginBottom: '0.375rem', display: 'block', fontWeight: 600 }}>
                            Access Scope
                          </label>
                          <select
                            className="form-control"
                            value={supportScope}
                            onChange={(e) => setSupportScope(e.target.value as any)}
                            style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '12px', height: '34px' }}
                          >
                            <option value="diagnostics_readonly">Diagnostics (Read-Only)</option>
                            <option value="config_write">Configuration & Data Repair</option>
                          </select>
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
                          onClick={handleSendAccessRequest}
                          disabled={isSubmittingImpersonation || !impersonateReason.trim()}
                          style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Send size={14} />
                          {isSubmittingImpersonation ? 'Sending Request...' : 'Send Request to Workspace Admin'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          fontSize: '12px',
                          color: '#991b1b',
                          lineHeight: 1.4,
                          marginBottom: '1rem',
                        }}
                      >
                        <strong>🚨 Critical Incident / Customer Lockout Policy:</strong> Emergency break-glass access should only be used when the customer administrator is unreachable. Access is strictly limited to <strong>15 minutes</strong> in <strong>read-only diagnostics mode</strong>. High-frequency alerts and immediate outbox notifications are dispatched synchronously.
                      </div>

                      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label" htmlFor="emergencyReason" style={{ marginBottom: '0.375rem', display: 'block', fontWeight: 600, color: '#991b1b' }}>
                          Emergency Incident Justification (Min 20 characters) <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                        </label>
                        <textarea
                          id="emergencyReason"
                          className="form-control"
                          rows={3}
                          placeholder="e.g. Critical customer lockout: Admin credentials compromised, tenant services failing to process invoices. Verified via telecom out-of-band."
                          value={emergencyReason}
                          onChange={(e) => setEmergencyReason(e.target.value)}
                          required
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '0.25rem' }}>
                          <span style={{ color: emergencyReason.trim().length >= 20 ? '#16a34a' : '#dc2626' }}>
                            {emergencyReason.trim().length} / 20 minimum characters
                          </span>
                          <span style={{ color: '#64748b' }}>Permanently audited in PlatformSecurityAlert</span>
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
                          onClick={handleEmergencyAccess}
                          disabled={isSubmittingImpersonation || emergencyReason.trim().length < 20}
                          style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <ShieldAlert size={14} />
                          {isSubmittingImpersonation ? 'Activating Emergency Access...' : 'Activate Emergency Break-Glass (15m)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Workspace Authorization History */}
              {supportSessions.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Recent Authorization History for {selectedTenant?.name}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {supportSessions.length} total records
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {supportSessions.map((s) => (
                      <div
                        key={s._id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          border: '1px solid var(--border-subtle, #f1f5f9)',
                          fontSize: '11px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {s.scope === 'diagnostics_readonly' ? 'Read-Only Diagnostics' : 'Configuration'} ({s.duration_minutes}m)
                            <span style={{ marginLeft: '6px', fontWeight: 400, color: 'var(--text-muted)' }}>
                              • {new Date(s.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Justification: <em>"{s.justification}"</em>
                          </div>
                          {s.revocation_reason && (
                            <div style={{ color: '#dc2626', marginTop: '2px', fontWeight: 500 }}>
                              Note: <em>"{s.revocation_reason}"</em>
                            </div>
                          )}
                        </div>
                        <div>
                          {s.status === 'pending' && <span className="badge badge-warning">Pending</span>}
                          {s.status === 'approved' && <span className="badge badge-success">Approved</span>}
                          {s.status === 'active' && <span className="badge badge-info">Active</span>}
                          {s.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                          {s.status === 'expired' && <span className="badge badge-neutral">Expired</span>}
                          {s.status === 'revoked' && <span className="badge badge-neutral">Revoked</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
