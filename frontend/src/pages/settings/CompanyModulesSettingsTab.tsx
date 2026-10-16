/**
 * ============================================================================
 * FLEET FLOW — WORKSPACE MODULE CONFIGURATION (CompanyModulesSettingsTab.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Powers tenant-level module activation and deactivation for company workspaces (FF-ISSUE-024).
 * 
 * OWNERSHIP & SECURITY INVARIANTS:
 * --------------------------------
 * 1. Plan Ceiling Defense: Modules locked by the company's subscription plan cannot
 *    be enabled from the client. The backend rejects unentitled activations with UNENTITLED_MODULE.
 * 2. Full Admin Flexibility: Company Admins have complete discretion to toggle ANY entitled
 *    module in their plan, including foundational modules (Fleet, Drivers, Trips), provided
 *    domain dependencies are satisfied.
 * 3. Commercial Clarity: Explicitly clarifies that deactivating modules does NOT alter plan
 *    pricing, discount billing, or cancel subscriptions.
 * 4. RBAC: Restricted to Admin role; non-admins view configurations in read-only mode.
 * 5. State Synchronization: Upon saving, synchronizes the global authStore so that navigation
 *    and direct route guards update immediately without requiring manual browser reloads.
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Sliders,
  CheckCircle2,
  Lock,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  ShieldAlert,
  Info,
  Check,
  Search,
  Zap,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';
import { ModuleKey } from '../../utils/featureCatalog';

interface ModuleItem {
  key: ModuleKey;
  name: string;
  description: string;
  category: 'core' | 'commercial' | 'intelligence' | 'integrations' | 'enterprise';
  default_tier: 'starter' | 'standard' | 'pro' | 'enterprise';
  dependencies: ModuleKey[];
  is_entitled: boolean;
  is_enabled: boolean;
  status: 'enabled' | 'disabled_by_company' | 'plan_locked';
}

interface CompanyModulesResponse {
  success: boolean;
  plan: { code: string; name: string };
  plan_features: ModuleKey[];
  enabled_modules: ModuleKey[];
  effective_features: ModuleKey[];
  is_customized: boolean;
  modules: ModuleItem[];
}

export const CompanyModulesSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { role, refreshEntitlements } = useAuthStore();
  const isAdmin = role === 'admin';

  // Search & category filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'locked'>('all');

  // Draft selected modules state
  const [selectedKeys, setSelectedKeys] = useState<ModuleKey[]>([]);
  const [initialKeys, setInitialKeys] = useState<ModuleKey[]>([]);
  const [isCustomized, setIsCustomized] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 1. Fetch Module Entitlements & Preferences
  const { data, isLoading, isError, error, refetch } = useQuery<CompanyModulesResponse>({
    queryKey: ['company-modules'],
    queryFn: async () => {
      const res = await api.get('/company/modules');
      return res.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Sync draft state with server data
  useEffect(() => {
    if (data) {
      const currentEnabled = data.enabled_modules || [];
      setSelectedKeys(currentEnabled);
      setInitialKeys(currentEnabled);
      setIsCustomized(Boolean(data.is_customized));
      setValidationError(null);
    }
  }, [data]);

  // Determine if draft differs from saved server state
  const isDirty = useMemo(() => {
    if (selectedKeys.length !== initialKeys.length) return true;
    const initialSet = new Set(initialKeys);
    return selectedKeys.some((k) => !initialSet.has(k));
  }, [selectedKeys, initialKeys]);

  // Lookup map for fast module item inspection
  const moduleMap = useMemo(() => {
    const map = new Map<ModuleKey, ModuleItem>();
    (data?.modules || []).forEach((m) => map.set(m.key, m));
    return map;
  }, [data]);

  // 2. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (modulesToSave: ModuleKey[]) => {
      const res = await api.put('/company/modules', {
        enabled_modules: modulesToSave,
      });
      return res.data;
    },
    onSuccess: async (resData) => {
      toast.success(resData.message || 'Workspace module preferences saved successfully.');
      setValidationError(null);
      await queryClient.invalidateQueries({ queryKey: ['company-modules'] });
      // Refresh global auth store so sidebar and route guards reflect changes immediately
      await refreshEntitlements();
    },
    onError: (err: any) => {
      const errorData = err.response?.data;
      if (errorData?.code === 'DEPENDENCY_MISSING') {
        setValidationError(errorData.error || 'Module dependency check failed.');
      } else if (errorData?.code === 'UNENTITLED_MODULE') {
        setValidationError(errorData.error || 'Selected modules require a subscription plan upgrade.');
      } else {
        setValidationError(errorData?.error || err.message || 'Failed to update company modules.');
      }
      toast.error(errorData?.error || 'Failed to save module preferences.');
    },
  });

  // Toggle handler
  const handleToggleModule = (mod: ModuleItem) => {
    if (!isAdmin || !mod.is_entitled) return;

    setValidationError(null);
    const key = mod.key;
    const currentlyActive = selectedKeys.includes(key);

    if (currentlyActive) {
      // Deactivating module: remove from selected list
      setSelectedKeys((prev) => prev.filter((k) => k !== key));
    } else {
      // Activating module: add to selected list
      setSelectedKeys((prev) => [...prev, key]);
    }
  };

  // Revert draft changes
  const handleRevert = () => {
    setSelectedKeys(initialKeys);
    setValidationError(null);
  };

  // Save handler
  const handleSave = () => {
    if (!isAdmin) {
      toast.error('Only workspace administrators can update module preferences.');
      return;
    }
    saveMutation.mutate(selectedKeys);
  };

  // Filtered module list
  const filteredModules = useMemo(() => {
    if (!data?.modules) return [];
    return data.modules.filter((mod) => {
      // Category filter
      if (selectedCategory !== 'all' && mod.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === 'enabled') {
        if (!selectedKeys.includes(mod.key)) return false;
      } else if (statusFilter === 'disabled') {
        if (!mod.is_entitled || selectedKeys.includes(mod.key)) return false;
      } else if (statusFilter === 'locked') {
        if (mod.is_entitled) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesKey = mod.key.toLowerCase().includes(q);
        const matchesDesc = mod.description.toLowerCase().includes(q);
        if (!matchesName && !matchesKey && !matchesDesc) return false;
      }

      return true;
    });
  }, [data?.modules, selectedCategory, statusFilter, searchQuery, selectedKeys]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            border: '3px solid var(--color-primary-200)',
            borderTopColor: 'var(--color-primary-600)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Loading workspace module configurations...
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !data) {
    return (
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
        <AlertCircle size={32} style={{ margin: '0 auto 0.75rem' }} />
        <h3 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Failed to Load Workspace Modules</h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: 'var(--font-size-sm)' }}>
          {(error as any)?.response?.data?.error || (error as any)?.message || 'Unable to retrieve company module preferences.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="btn btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={15} /> Try Again
        </button>
      </div>
    );
  }

  const entitledCount = data.plan_features.length;
  const activeCount = selectedKeys.filter((k) => data.plan_features.includes(k)).length;
  const deactivatedCount = entitledCount - activeCount;

  return (
    <div>
      {/* 1. Header & Informational Context */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={20} className="text-primary-600" />
            Workspace Module Configuration
          </h2>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', maxWidth: '750px' }}>
            Tailor Fleet Flow to your company's operational workflow. Deactivating modules simplifies your team's navigation and interface without affecting plan pricing or subscription status.
          </p>
        </div>

        {/* Plan summary badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.875rem',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-light, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 10px)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Current Plan:</div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', color: 'var(--color-primary-700)' }}>
            {data.plan.name}
          </div>
          <span style={{ color: 'var(--border-light, #cbd5e1)' }}>|</span>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{activeCount}</strong> of {entitledCount} Active
          </div>
        </div>
      </div>

      {/* 2. Advisory Banners */}
      {!isAdmin && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: 'var(--color-amber-50, #fffbeb)',
            border: '1px solid var(--color-amber-200, #fde68a)',
            borderRadius: 'var(--radius-lg, 10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-amber-900, #78350f)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldAlert size={20} />
          <div>
            <strong>Read-Only Mode:</strong> Only users with the <strong>Admin</strong> role can modify workspace module preferences.
          </div>
        </div>
      )}

      {!isCustomized && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: 'var(--color-primary-50, #eff6ff)',
            border: '1px solid var(--color-primary-200, #bfdbfe)',
            borderRadius: 'var(--radius-lg, 10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-primary-900, #1e3a8a)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.25rem',
          }}
        >
          <Info size={20} />
          <div>
            <strong>Default Plan Inheritance:</strong> Your workspace is currently inheriting all entitled modules from your {data.plan.name} plan. Saving custom preferences will activate explicit company-level settings.
          </div>
        </div>
      )}

      {/* Commercial Notice */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs)',
          marginBottom: '1.5rem',
        }}
      >
        <Sparkles size={16} color="var(--color-primary-600)" />
        <div>
          <strong>Billing & Commercial Guarantee:</strong> Disabling modules only hides operational features for your team. It does not cancel your subscription, change your recurring invoice, or alter your subscription tier pricing.
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--color-danger-50, #fef2f2)',
            border: '1px solid var(--color-danger-300, #fca5a5)',
            borderRadius: 'var(--radius-lg, 10px)',
            color: 'var(--color-danger-900, #7f1d1d)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Module Validation Failed:</strong>
            {validationError}
          </div>
        </div>
      )}

      {/* 3. Action Toolbar & Dirty State Notice */}
      {isAdmin && isDirty && (
        <div
          style={{
            position: 'sticky',
            top: '1rem',
            zIndex: 20,
            padding: '0.875rem 1.25rem',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--color-primary-300, #93c5fd)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-amber-500, #f59e0b)',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              You have unsaved module preference modifications.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleRevert}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              disabled={saveMutation.isPending}
            >
              <RotateCcw size={14} /> Revert
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              disabled={saveMutation.isPending}
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving...' : 'Save Module Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
          <Search
            size={16}
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
            placeholder="Search module name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem', fontSize: 'var(--font-size-sm)' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'core', label: 'Core Operations' },
            { id: 'commercial', label: 'Commercial & Invoicing' },
            { id: 'intelligence', label: 'Intelligence & Approvals' },
            { id: 'integrations', label: 'Integrations & Enterprise' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: 'var(--radius-full, 9999px)',
                border: '1px solid',
                borderColor: selectedCategory === cat.id ? 'var(--color-primary-600)' : 'var(--border-light, #e2e8f0)',
                background: selectedCategory === cat.id ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                color: selectedCategory === cat.id ? 'var(--color-primary-700)' : 'var(--text-muted)',
                fontWeight: selectedCategory === cat.id ? 600 : 500,
                fontSize: 'var(--font-size-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: 'var(--font-size-sm)' }}
          value={statusFilter}
          onChange={(e: any) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Modules ({data.modules.length})</option>
          <option value="enabled">Active ({activeCount})</option>
          <option value="disabled">Deactivated ({deactivatedCount})</option>
          <option value="locked">Plan Locked ({data.modules.length - entitledCount})</option>
        </select>
      </div>

      {/* 5. Modules Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {filteredModules.map((mod) => {
          const isEntitled = mod.is_entitled;
          const isSelected = selectedKeys.includes(mod.key);

          // Evaluate unmet dependencies based on draft selection
          const unmetDependencies = mod.dependencies.filter((depKey) => !selectedKeys.includes(depKey));
          const hasMissingDeps = isSelected && unmetDependencies.length > 0;

          // Foundational module flag
          const isFoundational = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_TRIPS', 'MOD_PARTIES'].includes(mod.key);

          return (
            <div
              key={mod.key}
              style={{
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid',
                borderColor: hasMissingDeps
                  ? 'var(--color-danger-300, #fca5a5)'
                  : isSelected
                  ? 'var(--color-primary-300, #bfdbfe)'
                  : 'var(--border-light, #e2e8f0)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isSelected ? 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))' : 'none',
                opacity: !isEntitled ? 0.75 : 1,
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Card Header: Category & Tier Badges */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm, 4px)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {mod.category}
                    </span>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm, 4px)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        backgroundColor: !isEntitled
                          ? 'var(--color-slate-100, #f1f5f9)'
                          : 'var(--color-primary-50, #eff6ff)',
                        color: !isEntitled ? 'var(--color-slate-600, #475569)' : 'var(--color-primary-700)',
                      }}
                    >
                      {mod.default_tier}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {!isEntitled ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-slate-100, #f1f5f9)',
                        color: 'var(--color-slate-600, #475569)',
                      }}
                    >
                      <Lock size={11} /> Plan Locked
                    </span>
                  ) : isSelected ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-success-50, #f0fdf4)',
                        color: 'var(--color-success-700, #15803d)',
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
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-amber-50, #fffbeb)',
                        color: 'var(--color-amber-700, #b45309)',
                      }}
                    >
                      <AlertCircle size={12} /> Deactivated
                    </span>
                  )}
                </div>

                {/* Module Title */}
                <h4 style={{ margin: '0 0 0.375rem', fontSize: 'var(--font-size-base, 14px)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {mod.name}
                </h4>

                {/* Code identifier */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                  {mod.key}
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {mod.description}
                </p>
              </div>

              {/* Card Footer: Dependencies & Toggle Control */}
              <div>
                {/* Dependencies breakdown */}
                {mod.dependencies.length > 0 && (
                  <div
                    style={{
                      padding: '0.5rem 0.625rem',
                      borderRadius: 'var(--radius-md, 8px)',
                      backgroundColor: hasMissingDeps ? 'var(--color-danger-50, #fef2f2)' : 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid',
                      borderColor: hasMissingDeps ? 'var(--color-danger-200, #fecaca)' : 'var(--border-light, #e2e8f0)',
                      fontSize: '11px',
                      color: hasMissingDeps ? 'var(--color-danger-800, #991b1b)' : 'var(--text-muted)',
                      marginBottom: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      {hasMissingDeps ? '⚠️ Missing Prerequisites:' : 'Prerequisites:'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {mod.dependencies.map((depKey) => {
                        const depDef = moduleMap.get(depKey);
                        const isDepActive = selectedKeys.includes(depKey);
                        return (
                          <span
                            key={depKey}
                            style={{
                              padding: '0.125rem 0.375rem',
                              borderRadius: 'var(--radius-sm, 4px)',
                              backgroundColor: isDepActive ? 'var(--color-success-50, #f0fdf4)' : 'var(--color-danger-100, #fee2e2)',
                              color: isDepActive ? 'var(--color-success-700, #15803d)' : 'var(--color-danger-700, #b91c1c)',
                              fontWeight: 500,
                            }}
                          >
                            {depDef?.name || depKey}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Toggle / Upgrade CTA */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-light, #e2e8f0)',
                  }}
                >
                  {!isEntitled ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Requires {mod.default_tier.toUpperCase()} plan
                      </span>
                      <Link
                        to="/settings/billing"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '11px', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Zap size={12} /> Upgrade
                      </Link>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: isSelected ? 'var(--color-primary-700)' : 'var(--text-muted)' }}>
                        {isSelected ? 'Enabled in Workspace' : 'Disabled for Team'}
                      </span>

                      {/* Accessible Custom Toggle Switch */}
                      <label
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '44px',
                          height: '24px',
                          cursor: isAdmin ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleModule(mod)}
                          disabled={!isAdmin || saveMutation.isPending}
                          style={{ opacity: 0, width: 0, height: 0 }}
                          aria-label={`Toggle ${mod.name}`}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            cursor: isAdmin ? 'pointer' : 'not-allowed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: isSelected ? 'var(--color-primary-600)' : 'var(--color-slate-300, #cbd5e1)',
                            borderRadius: '24px',
                            transition: '0.2s',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              content: '""',
                              height: '18px',
                              width: '18px',
                              left: isSelected ? '23px' : '3px',
                              bottom: '3px',
                              backgroundColor: '#ffffff',
                              borderRadius: '50%',
                              transition: '0.2s',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            }}
                          />
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Bottom Sticky Save Bar for Quick Access */}
      {isAdmin && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-light, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              Ready to apply module preferences?
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Changes take effect immediately across all active sessions in your company.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleRevert}
              className="btn btn-outline"
              disabled={!isDirty || saveMutation.isPending}
            >
              Revert
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary"
              disabled={!isDirty || saveMutation.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Save size={16} />
              {saveMutation.isPending ? 'Saving Preferences...' : 'Save Module Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
