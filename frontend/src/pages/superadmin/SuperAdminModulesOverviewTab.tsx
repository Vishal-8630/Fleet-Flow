/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN COMPANY MODULES OVERVIEW (SuperAdminModulesOverviewTab.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Platform-wide read-only governance portal for Super Admins to inspect company
 * subscription plans, eligible modules, saved preferences, and effective access.
 * 
 * INVARIANTS:
 * -----------
 * 1. Read-Only for Module Assignments: Never provides Super Admin toggle overrides
 *    or tenant mutation endpoints (FF-ISSUE-024).
 * 2. Honest Telemetry: Accurately displays "Not tracked" when the backend reports
 *    `usage_not_tracked`. Never invents synthetic usage numbers.
 * 3. Transparent Governance: Clearly distinguishes commercial plan ceiling, saved
 *    company preferences, and effective enabled features.
 * 4. Super Admin Protected: Guarded by platform Super Admin authorization.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Building,
  ShieldCheck,
  Calendar,
  Filter,
  Check,
  X,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import { api } from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { CLIENT_MODULES, ModuleKey } from '../../utils/featureCatalog';

interface TenantModuleOverviewItem {
  company_id: string;
  company_name: string;
  slug: string;
  subscription_plan: { code: string; name: string };
  subscription_status: string;
  trial_ends_at?: string;
  is_read_only: boolean;
  is_customized: boolean;
  eligible_modules: ModuleKey[];
  saved_preferences: ModuleKey[] | null;
  effective_modules: ModuleKey[];
  usage: {
    is_instrumented: boolean;
    status: string;
    note: string;
  };
}

interface ModulesOverviewResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  tenants: TenantModuleOverviewItem[];
}

export const SuperAdminModulesOverviewTab: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<TenantModuleOverviewItem | null>(null);

  // Fetch overview from backend API
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ModulesOverviewResponse>({
    queryKey: ['super-admin-modules-overview', page, limit, search, statusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/tenants/modules-overview', {
        params: {
          page,
          limit,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        },
      });
      return res.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const tenants = data?.tenants || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* 1. Header & Context */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              margin: '0 0 0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-primary)',
            }}
          >
            <Layers size={18} style={{ color: 'var(--color-primary-600)' }} />
            Company Module Configuration & Access Directory
          </h3>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs, 12px)', color: 'var(--text-muted)', maxWidth: '780px' }}>
            Multi-tenant governance view. Inspect commercial plan entitlements, saved company operational preferences, and effective module access across all customer workspaces. Module toggling is company-managed under their subscription ceiling.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="btn btn-outline btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          disabled={isFetching}
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Refreshing...' : 'Refresh Directory'}
        </button>
      </div>

      {/* 2. Read-Only Governance Statement */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs, 12px)',
          marginBottom: '1.25rem',
        }}
      >
        <ShieldCheck size={18} style={{ color: 'var(--color-primary-600)', flexShrink: 0 }} />
        <div>
          <strong>Read-Only Platform Governance:</strong> This overview inspects tenant configuration for operational auditing and customer support. Company Admins decide which entitled modules to activate. Super Admin retains subscription plan assignment and quota administration.
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search company name, slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '2.25rem', fontSize: 'var(--font-size-sm, 13px)' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: 'var(--font-size-sm, 13px)' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Subscription Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="expired">Expired</option>
            <option value="past_due">Past Due</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* 4. Table or Loading / Error States */}
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div
            style={{
              width: '2rem',
              height: '2rem',
              border: '3px solid var(--color-primary-200)',
              borderTopColor: 'var(--color-primary-600)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Loading multi-tenant module overview...
          </div>
        </div>
      ) : isError ? (
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'var(--color-danger-50, #fef2f2)',
            border: '1px solid var(--color-danger-200, #fecaca)',
            borderRadius: 'var(--radius-lg, 12px)',
            color: 'var(--color-danger-800, #991b1b)',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={28} style={{ margin: '0 auto 0.5rem' }} />
          <h4 style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>Failed to Load Modules Overview</h4>
          <p style={{ margin: '0 0 1rem', fontSize: 'var(--font-size-xs)' }}>
            {(error as any)?.response?.data?.error || (error as any)?.message || 'Super Admin authorization required.'}
          </p>
          <button type="button" onClick={() => refetch()} className="btn btn-outline btn-sm">
            Retry
          </button>
        </div>
      ) : tenants.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px dashed var(--border-light, #cbd5e1)',
          }}
        >
          <Building size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
          <h4 style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>No Transporters Found</h4>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            No company workspaces match the active search query or status filter.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-card, #ffffff)', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border-light, #e2e8f0)' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs, 12px)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light, #e2e8f0)', backgroundColor: 'var(--bg-subtle, #f8fafc)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Company / Workspace</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subscription Plan</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Governance Mode</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Eligible Modules</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Effective Access</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Usage Telemetry</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const eligibleCount = t.eligible_modules.length;
                const effectiveCount = t.effective_modules.length;
                const disabledCount = eligibleCount - effectiveCount;

                return (
                  <tr
                    key={t.company_id}
                    style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)', transition: 'background-color 0.15s ease' }}
                    className="hover:bg-slate-50"
                  >
                    {/* Company */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{t.company_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>{t.slug}</div>
                      {t.trial_ends_at && t.subscription_status === 'trialing' && (
                        <div style={{ fontSize: '10px', color: 'var(--color-primary-600)', marginTop: '2px' }}>
                          Trial ends {formatDate(t.trial_ends_at)}
                        </div>
                      )}
                    </td>

                    {/* Subscription */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm, 4px)',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor:
                            t.subscription_plan?.code === 'pro'
                              ? 'var(--color-primary-50, #eff6ff)'
                              : t.subscription_plan?.code === 'standard'
                              ? 'var(--color-indigo-50, #eef2ff)'
                              : 'var(--bg-subtle, #f1f5f9)',
                          color:
                            t.subscription_plan?.code === 'pro'
                              ? 'var(--color-primary-700)'
                              : t.subscription_plan?.code === 'standard'
                              ? '#4338ca'
                              : 'var(--text-muted)',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {t.subscription_plan?.name || t.subscription_plan?.code || 'Starter'}
                      </span>
                      <div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            color:
                              t.subscription_status === 'active'
                                ? 'var(--color-success-700, #15803d)'
                                : t.subscription_status === 'trialing'
                                ? 'var(--color-primary-600)'
                                : 'var(--color-danger-700, #b91c1c)',
                          }}
                        >
                          ● {t.subscription_status}
                        </span>
                      </div>
                    </td>

                    {/* Governance Mode */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {t.is_customized ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-full, 9999px)',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'var(--color-amber-50, #fffbeb)',
                            color: 'var(--color-amber-800, #92400e)',
                            border: '1px solid var(--color-amber-200, #fde68a)',
                          }}
                        >
                          <Sliders size={11} /> Custom Preferences
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-full, 9999px)',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-light, #e2e8f0)',
                          }}
                        >
                          Default Inheritance
                        </span>
                      )}
                    </td>

                    {/* Eligible Modules */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600 }}>{eligibleCount}</span> of 20 modules
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Permitted by plan ceiling</div>
                    </td>

                    {/* Effective Access */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>
                        <strong style={{ color: 'var(--color-success-700, #15803d)' }}>{effectiveCount}</strong> enabled
                      </div>
                      {disabledCount > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-amber-700, #b45309)' }}>
                          {disabledCount} disabled by company
                        </div>
                      )}
                    </td>

                    {/* Usage Telemetry */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm, 4px)',
                          fontSize: '10px',
                          fontWeight: 500,
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          color: 'var(--text-muted)',
                        }}
                        title={t.usage?.note || 'Operational telemetry not instrumented'}
                      >
                        Not tracked
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(t)}
                        className="btn btn-outline btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '11px', padding: '0.25rem 0.625rem' }}
                      >
                        <Eye size={12} /> Inspect Modules
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 5. Pagination Bar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-light, #e2e8f0)',
              fontSize: 'var(--font-size-xs, 12px)',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Showing {tenants.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
              {Math.min(page * limit, total)} of {total} companies
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Detail Modal: Tenant Module Access Audit */}
      {selectedTenant && (
        <Modal
          isOpen={Boolean(selectedTenant)}
          onClose={() => setSelectedTenant(null)}
          title={`Module Access Audit: ${selectedTenant.company_name}`}
          subtitle={`Plan: ${selectedTenant.subscription_plan?.name} (${selectedTenant.subscription_status}) • Read-Only Inspection`}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn btn-primary" onClick={() => setSelectedTenant(null)}>
                Close Audit View
              </button>
            </div>
          }
        >
          <div>
            {/* Modal Advisory */}
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '1rem',
              }}
            >
              <strong>Super Admin Invariant:</strong> This inspection view is strictly read-only. Platform administrators cannot override tenant preferences from this screen. Module toggling is company-managed under their subscription ceiling.
            </div>

            {/* Customization Status Banner */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                backgroundColor: selectedTenant.is_customized ? 'var(--color-amber-50, #fffbeb)' : 'var(--color-primary-50, #eff6ff)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid',
                borderColor: selectedTenant.is_customized ? 'var(--color-amber-200, #fde68a)' : 'var(--color-primary-200, #bfdbfe)',
                fontSize: '12px',
              }}
            >
              <div>
                <strong>Governance State:</strong>{' '}
                {selectedTenant.is_customized ? (
                  <span style={{ color: 'var(--color-amber-900, #78350f)' }}>
                    Explicit Company Preferences ({selectedTenant.saved_preferences?.length || 0} modules specified)
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-primary-900, #1e3a8a)' }}>
                    Default Plan Inheritance (100% of plan-entitled modules enabled)
                  </span>
                )}
              </div>
            </div>

            {/* Modules Breakdown Table */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: 'var(--radius-md, 8px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light, #e2e8f0)', backgroundColor: 'var(--bg-subtle, #f8fafc)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Module</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Plan Ceiling</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Saved Preference</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Effective Access</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(CLIENT_MODULES) as ModuleKey[]).map((key) => {
                    const def = CLIENT_MODULES[key];
                    const isEligible = selectedTenant.eligible_modules.includes(key);
                    const isEffective = selectedTenant.effective_modules.includes(key);

                    let preferenceText = 'Inherited Default';
                    let preferenceColor = 'var(--text-muted)';
                    if (selectedTenant.is_customized) {
                      if (selectedTenant.saved_preferences?.includes(key)) {
                        preferenceText = 'Saved: Enabled';
                        preferenceColor = 'var(--color-success-700, #15803d)';
                      } else {
                        preferenceText = 'Saved: Disabled';
                        preferenceColor = 'var(--color-amber-700, #b45309)';
                      }
                    }

                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{def?.name || key}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{key}</div>
                        </td>

                        {/* Plan Ceiling */}
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {isEligible ? (
                            <span style={{ color: 'var(--color-success-700, #15803d)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Check size={13} /> Eligible
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Lock size={12} /> Plan Locked
                            </span>
                          )}
                        </td>

                        {/* Saved Preference */}
                        <td style={{ padding: '0.5rem 0.75rem', color: preferenceColor }}>
                          {preferenceText}
                        </td>

                        {/* Effective Access */}
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {isEffective ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: 'var(--radius-sm, 4px)',
                                backgroundColor: 'var(--color-success-50, #f0fdf4)',
                                color: 'var(--color-success-700, #15803d)',
                                fontWeight: 600,
                                fontSize: '11px',
                              }}
                            >
                              <CheckCircle2 size={12} /> Active
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: 'var(--radius-sm, 4px)',
                                backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                              }}
                            >
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </td>

                        {/* Usage */}
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Not tracked</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
