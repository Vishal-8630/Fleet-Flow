/**
 * ============================================================================
 * FLEET FLOW — SUPER ADMIN PLANS & CATALOGS PAGE (SuperAdminPlansPage.tsx)
 * ============================================================================
 * 
 * Platform Operator Management Center:
 * - Pricing tiers matrix (Starter, Standard, Pro, Enterprise) with quota editing.
 * - Modular feature entitlements gating per tier (all 20 modules).
 * - Standalone Add-on services catalog pricing.
 * - Platform commercial governance: trial durations, grace periods, GST rates,
 *   and Razorpay gateway environment switching.
 * - Promo code creation & discount lifecycle.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CreditCard,
  Layers,
  Settings,
  Tag,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
  Percent,
  Check,
  Building2,
  Zap,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { CLIENT_MODULES, ModuleKey } from '../../utils/featureCatalog';

interface Plan {
  _id: string;
  name: string;
  code: string;
  description: string;
  monthly_price_paise: number;
  annual_price_paise: number;
  max_trucks: number;
  max_drivers: number;
  max_users: number;
  included_features: string[];
  is_active: boolean;
  is_public: boolean;
}

interface AddOn {
  _id: string;
  name: string;
  code: string;
  description: string;
  type: string;
  feature_key?: string;
  quota_boost?: {
    trucks?: number;
    drivers?: number;
    users?: number;
  };
  monthly_price_paise: number;
  annual_price_paise: number;
  is_active: boolean;
}

interface PlatformSettings {
  trial_days: number;
  grace_period_days: number;
  gst_rate_percent: number;
  currency: string;
  gateway_provider: string;
  gateway_mode: string;
  razorpay_key_id: string;
  support_email: string;
  auto_suspend_overdue: boolean;
}

interface PromoCode {
  _id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_paise';
  discount_value: number;
  times_redeemed: number;
  max_redemptions: number;
  valid_until: string;
  is_active: boolean;
}

export const SuperAdminPlansPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'addons' | 'settings' | 'promos'>('plans');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    trial_days: 14,
    grace_period_days: 7,
    gst_rate_percent: 18,
    currency: 'INR',
    gateway_provider: 'razorpay',
    gateway_mode: 'sandbox',
    razorpay_key_id: 'rzp_test_fleetflow_demo',
    support_email: 'billing@fleetflow.io',
    auto_suspend_overdue: true,
  });
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  // Edit Plan Modal State
  const [editPlanModalOpen, setEditPlanModalOpen] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<{
    name: string;
    description: string;
    monthly_price_rupees: number;
    annual_price_rupees: number;
    max_trucks: number;
    unlimited_trucks: boolean;
    max_drivers: number;
    unlimited_drivers: boolean;
    max_users: number;
    unlimited_users: boolean;
    included_features: string[];
    is_active: boolean;
    is_public: boolean;
  }>({
    name: '',
    description: '',
    monthly_price_rupees: 0,
    annual_price_rupees: 0,
    max_trucks: 5,
    unlimited_trucks: false,
    max_drivers: 5,
    unlimited_drivers: false,
    max_users: 2,
    unlimited_users: false,
    included_features: [],
    is_active: true,
    is_public: true,
  });

  // Edit Addon Modal State
  const [editAddonModalOpen, setEditAddonModalOpen] = useState<boolean>(false);
  const [selectedAddon, setSelectedAddon] = useState<AddOn | null>(null);
  const [addonForm, setAddonForm] = useState<{
    name: string;
    description: string;
    monthly_price_rupees: number;
    annual_price_rupees: number;
    trucks_boost: number;
    drivers_boost: number;
    users_boost: number;
    is_active: boolean;
  }>({
    name: '',
    description: '',
    monthly_price_rupees: 0,
    annual_price_rupees: 0,
    trucks_boost: 0,
    drivers_boost: 0,
    users_boost: 0,
    is_active: true,
  });

  // Create Promo Code Modal State
  const [createPromoModalOpen, setCreatePromoModalOpen] = useState<boolean>(false);
  const [promoForm, setPromoForm] = useState<{
    code: string;
    discount_type: 'percentage' | 'fixed_paise';
    discount_value: number;
    valid_until: string;
    max_redemptions: number;
  }>({
    code: '',
    discount_type: 'percentage',
    discount_value: 20,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_redemptions: 100,
  });

  const [savingAction, setSavingAction] = useState<boolean>(false);

  useEffect(() => {
    fetchCatalogData();
  }, []);

  const fetchCatalogData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/super-admin/plans-catalog', { withCredentials: true });
      setPlans(res.data.plans || []);
      setAddons(res.data.addons || []);
      if (res.data.settings) {
        setSettings(res.data.settings);
      }
      setPromoCodes(res.data.promoCodes || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load platform catalog.');
    } finally {
      setLoading(false);
    }
  };

  // Open Plan Editor
  const handleOpenPlanEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description,
      monthly_price_rupees: Math.round(plan.monthly_price_paise / 100),
      annual_price_rupees: Math.round(plan.annual_price_paise / 100),
      max_trucks: plan.max_trucks === -1 ? 100 : plan.max_trucks,
      unlimited_trucks: plan.max_trucks === -1,
      max_drivers: plan.max_drivers === -1 ? 100 : plan.max_drivers,
      unlimited_drivers: plan.max_drivers === -1,
      max_users: plan.max_users === -1 ? 50 : plan.max_users,
      unlimited_users: plan.max_users === -1,
      included_features: [...plan.included_features],
      is_active: plan.is_active,
      is_public: plan.is_public,
    });
    setEditPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!selectedPlan) return;
    try {
      setSavingAction(true);
      const payload = {
        name: planForm.name,
        description: planForm.description,
        monthly_price_paise: Math.round(planForm.monthly_price_rupees * 100),
        annual_price_paise: Math.round(planForm.annual_price_rupees * 100),
        max_trucks: planForm.unlimited_trucks ? -1 : Number(planForm.max_trucks),
        max_drivers: planForm.unlimited_drivers ? -1 : Number(planForm.max_drivers),
        max_users: planForm.unlimited_users ? -1 : Number(planForm.max_users),
        included_features: planForm.included_features,
        is_active: planForm.is_active,
        is_public: planForm.is_public,
      };

      const res = await axios.put(`/api/super-admin/plans/${selectedPlan._id}`, payload, { withCredentials: true });
      toast.success(res.data.message || `Plan ${planForm.name} updated!`);
      setEditPlanModalOpen(false);
      fetchCatalogData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update plan.');
    } finally {
      setSavingAction(false);
    }
  };

  const toggleFeatureInPlan = (key: string) => {
    setPlanForm((prev) => {
      const exists = prev.included_features.includes(key);
      const updated = exists
        ? prev.included_features.filter((f) => f !== key)
        : [...prev.included_features, key];
      return { ...prev, included_features: updated };
    });
  };

  // Open Addon Editor
  const handleOpenAddonEdit = (addon: AddOn) => {
    setSelectedAddon(addon);
    setAddonForm({
      name: addon.name,
      description: addon.description,
      monthly_price_rupees: Math.round(addon.monthly_price_paise / 100),
      annual_price_rupees: Math.round(addon.annual_price_paise / 100),
      trucks_boost: addon.quota_boost?.trucks || 0,
      drivers_boost: addon.quota_boost?.drivers || 0,
      users_boost: addon.quota_boost?.users || 0,
      is_active: addon.is_active,
    });
    setEditAddonModalOpen(true);
  };

  const handleSaveAddon = async () => {
    if (!selectedAddon) return;
    try {
      setSavingAction(true);
      const payload: any = {
        name: addonForm.name,
        description: addonForm.description,
        monthly_price_paise: Math.round(addonForm.monthly_price_rupees * 100),
        annual_price_paise: Math.round(addonForm.annual_price_rupees * 100),
        is_active: addonForm.is_active,
      };

      if (selectedAddon.type === 'quota_booster') {
        payload.quota_boost = {
          trucks: Number(addonForm.trucks_boost),
          drivers: Number(addonForm.drivers_boost),
          users: Number(addonForm.users_boost),
        };
      }

      const res = await axios.put(`/api/super-admin/addons/${selectedAddon._id}`, payload, { withCredentials: true });
      toast.success(res.data.message || 'Add-on updated.');
      setEditAddonModalOpen(false);
      fetchCatalogData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update add-on.');
    } finally {
      setSavingAction(false);
    }
  };

  // Save Platform Commercial Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAction(true);
      const res = await axios.put('/api/super-admin/settings', settings, { withCredentials: true });
      toast.success(res.data.message || 'Platform commercial settings updated.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update settings.');
    } finally {
      setSavingAction(false);
    }
  };

  // Create Promo Code
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAction(true);
      const payload = {
        code: promoForm.code.toUpperCase(),
        discount_type: promoForm.discount_type,
        discount_value: Number(promoForm.discount_value),
        valid_until: promoForm.valid_until,
        max_redemptions: Number(promoForm.max_redemptions),
      };

      const res = await axios.post('/api/super-admin/promo-codes', payload, { withCredentials: true });
      toast.success(`Promo code ${res.data.promo.code} created!`);
      setCreatePromoModalOpen(false);
      setPromoForm({
        code: '',
        discount_type: 'percentage',
        discount_value: 20,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        max_redemptions: 100,
      });
      fetchCatalogData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create promo code.');
    } finally {
      setSavingAction(false);
    }
  };

  // Toggle Promo Code Active
  const handleTogglePromo = async (id: string) => {
    try {
      const res = await axios.patch(`/api/super-admin/promo-codes/${id}/toggle`, {}, { withCredentials: true });
      toast.success(res.data.message || 'Promo code status updated.');
      fetchCatalogData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle promo code.');
    }
  };

  return (
    <div className="saplans-container">
      {/* 1. Header & Navigation */}
      <div className="saplans-header-section">
        <div className="saplans-breadcrumb">
          <span>Platform Super-Admin</span>
          <span>/</span>
          <span>SaaS Plans & Catalogs</span>
        </div>
        <div className="saplans-header-row">
          <div>
            <h1 className="saplans-title">SaaS Plans & Commercial Catalog</h1>
            <p className="saplans-subtitle">
              Manage tier pricing, resource quotas, feature entitlements, add-on modules, and platform billing rules.
            </p>
          </div>
          <div className="saplans-header-actions">
            <button
              className="saplans-btn-secondary"
              onClick={fetchCatalogData}
              disabled={loading}
              title="Refresh Catalog"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Sync</span>
            </button>
            {activeTab === 'promos' && (
              <button
                className="saplans-btn-primary"
                onClick={() => setCreatePromoModalOpen(true)}
              >
                <Plus size={16} />
                <span>New Promo Code</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Quick Metrics Strip */}
      <div className="saplans-stats-grid">
        <div className="saplans-stat-card">
          <div className="saplans-stat-icon blue">
            <CreditCard size={22} />
          </div>
          <div className="saplans-stat-info">
            <div className="saplans-stat-label">Configured Tiers</div>
            <div className="saplans-stat-value">{plans.length} Plans</div>
            <div className="saplans-stat-subtext">Starter to Custom Enterprise</div>
          </div>
        </div>

        <div className="saplans-stat-card">
          <div className="saplans-stat-icon emerald">
            <Layers size={22} />
          </div>
          <div className="saplans-stat-info">
            <div className="saplans-stat-label">Modular Add-Ons</div>
            <div className="saplans-stat-value">{addons.length} Add-Ons</div>
            <div className="saplans-stat-subtext">WhatsApp, Telematics & Boosters</div>
          </div>
        </div>

        <div className="saplans-stat-card">
          <div className="saplans-stat-icon amber">
            <Clock size={22} />
          </div>
          <div className="saplans-stat-info">
            <div className="saplans-stat-label">Trial Policy</div>
            <div className="saplans-stat-value">{settings.trial_days} Days</div>
            <div className="saplans-stat-subtext">{settings.grace_period_days} days grace before suspension</div>
          </div>
        </div>

        <div className="saplans-stat-card">
          <div className="saplans-stat-icon indigo">
            <ShieldCheck size={22} />
          </div>
          <div className="saplans-stat-info">
            <div className="saplans-stat-label">Tax & Gateway</div>
            <div className="saplans-stat-value">{settings.gst_rate_percent}% GST</div>
            <div className="saplans-stat-subtext">
              {settings.gateway_provider.toUpperCase()} ({settings.gateway_mode.toUpperCase()})
            </div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="saplans-tabs-bar">
        <button
          className={`saplans-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <CreditCard size={16} />
          <span>Subscription Plans & Entitlements ({plans.length})</span>
        </button>
        <button
          className={`saplans-tab-btn ${activeTab === 'addons' ? 'active' : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          <Layers size={16} />
          <span>Modular Add-Ons ({addons.length})</span>
        </button>
        <button
          className={`saplans-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          <span>Platform Commercial Settings</span>
        </button>
        <button
          className={`saplans-tab-btn ${activeTab === 'promos' ? 'active' : ''}`}
          onClick={() => setActiveTab('promos')}
        >
          <Tag size={16} />
          <span>Promo Codes ({promoCodes.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Subscription Plans Matrix */}
      {activeTab === 'plans' && (
        <div className="saplans-tier-grid">
          {plans.map((plan) => {
            const isFeatured = plan.code === 'pro';
            const annualDiscountPercent = Math.round(
              (1 - plan.annual_price_paise / 12 / plan.monthly_price_paise) * 100
            );

            return (
              <div
                key={plan._id}
                className={`saplans-tier-card ${isFeatured ? 'featured' : ''}`}
              >
                <div className="saplans-tier-header">
                  <span className={`saplans-tier-badge ${plan.code}`}>{plan.code} tier</span>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {plan.is_active && (
                      <span className="saplans-tier-badge starter">Active</span>
                    )}
                    {plan.is_public && (
                      <span className="saplans-tier-badge standard">Public</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="saplans-tier-name">{plan.name}</h3>
                  <p className="saplans-tier-desc">{plan.description}</p>
                </div>

                {/* Pricing Box */}
                <div className="saplans-price-box">
                  <div className="saplans-price-row">
                    <div className="saplans-price-val">
                      ₹{(plan.monthly_price_paise / 100).toLocaleString('en-IN')}
                      <span> / month</span>
                    </div>
                  </div>
                  <div className="saplans-annual-val">
                    <span>
                      Annual: ₹{(plan.annual_price_paise / 100).toLocaleString('en-IN')} / yr
                    </span>
                    {annualDiscountPercent > 0 && (
                      <span style={{ color: 'var(--color-emerald-600)', fontWeight: 600 }}>
                        Save {annualDiscountPercent}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Quotas Box */}
                <div className="saplans-quotas-box">
                  <div className="saplans-quota-pill">
                    <span className="saplans-quota-num">
                      {plan.max_trucks === -1 ? 'Unlimited' : plan.max_trucks}
                    </span>
                    <span className="saplans-quota-lbl">Trucks</span>
                  </div>
                  <div className="saplans-quota-pill">
                    <span className="saplans-quota-num">
                      {plan.max_drivers === -1 ? 'Unlimited' : plan.max_drivers}
                    </span>
                    <span className="saplans-quota-lbl">Drivers</span>
                  </div>
                  <div className="saplans-quota-pill">
                    <span className="saplans-quota-num">
                      {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                    </span>
                    <span className="saplans-quota-lbl">Team Seats</span>
                  </div>
                </div>

                {/* Features Count & Tags */}
                <div className="saplans-features-box">
                  <div className="saplans-features-head">
                    <span>Entitlements</span>
                    <span>
                      {plan.included_features.length} / {Object.keys(CLIENT_MODULES).length} Modules
                    </span>
                  </div>
                  <div className="saplans-features-tags">
                    {plan.included_features.slice(0, 5).map((fKey) => {
                      const mod = CLIENT_MODULES[fKey as ModuleKey];
                      return (
                        <span key={fKey} className="saplans-feature-tag">
                          {mod ? mod.name.split(' ')[0] : fKey.replace('MOD_', '')}
                        </span>
                      );
                    })}
                    {plan.included_features.length > 5 && (
                      <span className="saplans-feature-tag">
                        +{plan.included_features.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <button
                  className="saplans-btn-primary"
                  onClick={() => handleOpenPlanEdit(plan)}
                >
                  <Edit2 size={16} />
                  <span>Configure Tier & Quotas</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Tab 2: Modular Add-Ons Studio */}
      {activeTab === 'addons' && (
        <div className="saplans-addons-grid">
          {addons.map((addon) => {
            return (
              <div key={addon._id} className="saplans-addon-card">
                <div className="saplans-addon-header">
                  <div className="saplans-addon-icon">
                    {addon.type === 'quota_booster' ? <Truck size={22} /> : <Zap size={22} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="saplans-tier-badge starter">
                        {addon.type === 'quota_booster' ? 'Quota Booster' : 'Feature Module'}
                      </span>
                      <span className={`saplans-tier-badge ${addon.is_active ? 'standard' : 'starter'}`}>
                        {addon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0.375rem 0 0 0', color: 'var(--text-primary)' }}>
                      {addon.name}
                    </h3>
                  </div>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {addon.description}
                </p>

                {addon.type === 'quota_booster' && addon.quota_boost && (
                  <div className="saplans-quotas-box">
                    <div className="saplans-quota-pill">
                      <span className="saplans-quota-num">+{addon.quota_boost.trucks || 0}</span>
                      <span className="saplans-quota-lbl">Trucks</span>
                    </div>
                    <div className="saplans-quota-pill">
                      <span className="saplans-quota-num">+{addon.quota_boost.drivers || 0}</span>
                      <span className="saplans-quota-lbl">Drivers</span>
                    </div>
                    <div className="saplans-quota-pill">
                      <span className="saplans-quota-num">+{addon.quota_boost.users || 0}</span>
                      <span className="saplans-quota-lbl">Seats</span>
                    </div>
                  </div>
                )}

                <div className="saplans-price-box">
                  <div className="saplans-price-row">
                    <div className="saplans-price-val">
                      ₹{(addon.monthly_price_paise / 100).toLocaleString('en-IN')}
                      <span> / month</span>
                    </div>
                  </div>
                  <div className="saplans-annual-val">
                    <span>Annual: ₹{(addon.annual_price_paise / 100).toLocaleString('en-IN')} / yr</span>
                  </div>
                </div>

                <button
                  className="saplans-btn-secondary"
                  onClick={() => handleOpenAddonEdit(addon)}
                >
                  <Edit2 size={16} />
                  <span>Edit Add-On Settings</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Tab 3: Platform Commercial & Settings */}
      {activeTab === 'settings' && (
        <div className="saplans-settings-wrapper">
          <form className="saplans-settings-form" onSubmit={handleSaveSettings}>
            <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Platform Commercial Policies & Payment Gateway
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                Configure global SaaS lifecycle parameters, Indian GST compliance, and payment gateway environments.
              </p>
            </div>

            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Free Trial Period (Days)
                  <span className="saplans-form-hint">Default for newly registered tenants</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="saplans-input"
                  value={settings.trial_days}
                  onChange={(e) => setSettings({ ...settings, trial_days: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Dunning Grace Period (Days)
                  <span className="saplans-form-hint">Days before account is suspended after payment failure</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  className="saplans-input"
                  value={settings.grace_period_days}
                  onChange={(e) => setSettings({ ...settings, grace_period_days: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Applicable GST Rate (%)
                  <span className="saplans-form-hint">Standard Indian B2B SaaS GST rate</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  className="saplans-input"
                  value={settings.gst_rate_percent}
                  onChange={(e) => setSettings({ ...settings, gst_rate_percent: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Default Currency
                  <span className="saplans-form-hint">Base currency symbol & paise denomination</span>
                </label>
                <select
                  className="saplans-select"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                </select>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Payment Gateway Provider
                  <span className="saplans-form-hint">Integrated tokenized checkout system</span>
                </label>
                <select
                  className="saplans-select"
                  value={settings.gateway_provider}
                  onChange={(e) => setSettings({ ...settings, gateway_provider: e.target.value })}
                >
                  <option value="razorpay">Razorpay Subscriptions & UPI</option>
                  <option value="stripe">Stripe Billing</option>
                </select>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Gateway Environment Mode
                  <span className="saplans-form-hint">Sandbox test transactions or production live cards</span>
                </label>
                <select
                  className="saplans-select"
                  value={settings.gateway_mode}
                  onChange={(e) => setSettings({ ...settings, gateway_mode: e.target.value })}
                >
                  <option value="sandbox">Sandbox Test Mode (rzp_test_...)</option>
                  <option value="live">Production Live Mode (rzp_live_...)</option>
                </select>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Gateway Key Identifier
                  <span className="saplans-form-hint">Public client key used in browser checkout</span>
                </label>
                <input
                  type="text"
                  className="saplans-input"
                  value={settings.razorpay_key_id}
                  onChange={(e) => setSettings({ ...settings, razorpay_key_id: e.target.value })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Billing Inquiries Support Email
                  <span className="saplans-form-hint">Displayed on tenant invoices and receipts</span>
                </label>
                <input
                  type="email"
                  className="saplans-input"
                  value={settings.support_email}
                  onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ paddingTop: '0.5rem' }}>
              <label className="saplans-checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.auto_suspend_overdue}
                  onChange={(e) => setSettings({ ...settings, auto_suspend_overdue: e.target.checked })}
                />
                <span>Automatically suspend workspaces when trial or billing dunning period expires</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="submit"
                className="saplans-btn-primary"
                disabled={savingAction}
              >
                <CheckCircle2 size={16} />
                <span>{savingAction ? 'Saving...' : 'Save Platform Commercial Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Tab 4: Promo Codes & Discounts */}
      {activeTab === 'promos' && (
        <div className="saplans-table-card">
          <div className="saplans-table-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Promotional Campaign Codes ({promoCodes.length})
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Active coupon codes available for checkout discounts.
              </p>
            </div>
            <button
              className="saplans-btn-primary"
              onClick={() => setCreatePromoModalOpen(true)}
            >
              <Plus size={16} />
              <span>Add Promo Code</span>
            </button>
          </div>

          <table className="saplans-table">
            <thead>
              <tr>
                <th>Coupon Code</th>
                <th>Discount Value</th>
                <th>Redemptions</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No promo codes created yet. Click "Add Promo Code" above to launch a campaign discount.
                  </td>
                </tr>
              ) : (
                promoCodes.map((promo) => (
                  <tr key={promo._id}>
                    <td>
                      <span className="saplans-code-pill">{promo.code}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {promo.discount_type === 'percentage'
                        ? `${promo.discount_value}% Off`
                        : `₹${(promo.discount_value / 100).toLocaleString('en-IN')} Off`}
                    </td>
                    <td>
                      {promo.times_redeemed} / {promo.max_redemptions}
                    </td>
                    <td>{new Date(promo.valid_until).toLocaleDateString()}</td>
                    <td>
                      <span className={`saplans-tier-badge ${promo.is_active ? 'standard' : 'starter'}`}>
                        {promo.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="saplans-btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleTogglePromo(promo._id)}
                      >
                        {promo.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: EDIT PLAN TIER
         ========================================================================= */}
      {editPlanModalOpen && selectedPlan && (
        <Modal
          isOpen={editPlanModalOpen}
          onClose={() => setEditPlanModalOpen(false)}
          title={`Configure Plan Tier: ${selectedPlan.name}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">Plan Display Name</label>
                <input
                  type="text"
                  className="saplans-input"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">Tier Code (Read-Only)</label>
                <input
                  type="text"
                  className="saplans-input"
                  value={selectedPlan.code}
                  disabled
                  style={{ background: 'var(--color-slate-100)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div className="saplans-form-group">
              <label className="saplans-form-label">Description</label>
              <input
                type="text"
                className="saplans-input"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                required
              />
            </div>

            {/* Pricing Inputs */}
            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Monthly Price (₹ INR)
                  <span className="saplans-form-hint">Billed per month</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="saplans-input"
                  value={planForm.monthly_price_rupees}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, monthly_price_rupees: Number(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Annual Price (₹ INR)
                  <span className="saplans-form-hint">Billed upfront annually</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="saplans-input"
                  value={planForm.annual_price_rupees}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, annual_price_rupees: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            {/* Quota Limits */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="saplans-form-group">
                <label className="saplans-form-label">Trucks Capacity</label>
                <input
                  type="number"
                  min="1"
                  className="saplans-input"
                  value={planForm.unlimited_trucks ? '' : planForm.max_trucks}
                  disabled={planForm.unlimited_trucks}
                  placeholder={planForm.unlimited_trucks ? 'Unlimited (∞)' : '5'}
                  onChange={(e) => setPlanForm({ ...planForm, max_trucks: Number(e.target.value) })}
                />
                <label className="saplans-checkbox-label" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={planForm.unlimited_trucks}
                    onChange={(e) => setPlanForm({ ...planForm, unlimited_trucks: e.target.checked })}
                  />
                  <span>Unlimited (∞)</span>
                </label>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">Drivers Capacity</label>
                <input
                  type="number"
                  min="1"
                  className="saplans-input"
                  value={planForm.unlimited_drivers ? '' : planForm.max_drivers}
                  disabled={planForm.unlimited_drivers}
                  placeholder={planForm.unlimited_drivers ? 'Unlimited (∞)' : '5'}
                  onChange={(e) => setPlanForm({ ...planForm, max_drivers: Number(e.target.value) })}
                />
                <label className="saplans-checkbox-label" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={planForm.unlimited_drivers}
                    onChange={(e) => setPlanForm({ ...planForm, unlimited_drivers: e.target.checked })}
                  />
                  <span>Unlimited (∞)</span>
                </label>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">Team Accounts</label>
                <input
                  type="number"
                  min="1"
                  className="saplans-input"
                  value={planForm.unlimited_users ? '' : planForm.max_users}
                  disabled={planForm.unlimited_users}
                  placeholder={planForm.unlimited_users ? 'Unlimited (∞)' : '2'}
                  onChange={(e) => setPlanForm({ ...planForm, max_users: Number(e.target.value) })}
                />
                <label className="saplans-checkbox-label" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={planForm.unlimited_users}
                    onChange={(e) => setPlanForm({ ...planForm, unlimited_users: e.target.checked })}
                  />
                  <span>Unlimited (∞)</span>
                </label>
              </div>
            </div>

            {/* Feature Entitlements Multi-Selector */}
            <div className="saplans-form-group">
              <label className="saplans-form-label">
                Included Modular Feature Entitlements
                <span className="saplans-form-hint">
                  {planForm.included_features.length} of {Object.keys(CLIENT_MODULES).length} modules enabled
                </span>
              </label>
              <div className="saplans-module-checkboxes">
                {Object.values(CLIENT_MODULES).map((mod) => {
                  const isChecked = planForm.included_features.includes(mod.key);
                  return (
                    <label key={mod.key} className="saplans-module-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFeatureInPlan(mod.key)}
                      />
                      <div className="saplans-module-info">
                        <span className="saplans-module-name">{mod.name}</span>
                        <span className="saplans-module-desc">{mod.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Visibility Toggles */}
            <div style={{ display: 'flex', gap: '2rem', paddingTop: '0.5rem' }}>
              <label className="saplans-checkbox-label">
                <input
                  type="checkbox"
                  checked={planForm.is_active}
                  onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                />
                <span>Active for Workspace Upgrades</span>
              </label>
              <label className="saplans-checkbox-label">
                <input
                  type="checkbox"
                  checked={planForm.is_public}
                  onChange={(e) => setPlanForm({ ...planForm, is_public: e.target.checked })}
                />
                <span>Publicly Visible in Pricing Table</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="saplans-btn-secondary"
                onClick={() => setEditPlanModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="saplans-btn-primary"
                onClick={handleSavePlan}
                disabled={savingAction}
              >
                {savingAction ? 'Saving Changes...' : 'Save Plan Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: EDIT ADD-ON
         ========================================================================= */}
      {editAddonModalOpen && selectedAddon && (
        <Modal
          isOpen={editAddonModalOpen}
          onClose={() => setEditAddonModalOpen(false)}
          title={`Edit Add-On: ${selectedAddon.name}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="saplans-form-group">
              <label className="saplans-form-label">Add-On Name</label>
              <input
                type="text"
                className="saplans-input"
                value={addonForm.name}
                onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                required
              />
            </div>

            <div className="saplans-form-group">
              <label className="saplans-form-label">Description</label>
              <input
                type="text"
                className="saplans-input"
                value={addonForm.description}
                onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                required
              />
            </div>

            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">Monthly Price (₹ INR)</label>
                <input
                  type="number"
                  min="0"
                  className="saplans-input"
                  value={addonForm.monthly_price_rupees}
                  onChange={(e) =>
                    setAddonForm({ ...addonForm, monthly_price_rupees: Number(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">Annual Price (₹ INR)</label>
                <input
                  type="number"
                  min="0"
                  className="saplans-input"
                  value={addonForm.annual_price_rupees}
                  onChange={(e) =>
                    setAddonForm({ ...addonForm, annual_price_rupees: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            {selectedAddon.type === 'quota_booster' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div className="saplans-form-group">
                  <label className="saplans-form-label">Trucks Increment</label>
                  <input
                    type="number"
                    min="0"
                    className="saplans-input"
                    value={addonForm.trucks_boost}
                    onChange={(e) =>
                      setAddonForm({ ...addonForm, trucks_boost: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="saplans-form-group">
                  <label className="saplans-form-label">Drivers Increment</label>
                  <input
                    type="number"
                    min="0"
                    className="saplans-input"
                    value={addonForm.drivers_boost}
                    onChange={(e) =>
                      setAddonForm({ ...addonForm, drivers_boost: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="saplans-form-group">
                  <label className="saplans-form-label">Seats Increment</label>
                  <input
                    type="number"
                    min="0"
                    className="saplans-input"
                    value={addonForm.users_boost}
                    onChange={(e) =>
                      setAddonForm({ ...addonForm, users_boost: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            <label className="saplans-checkbox-label">
              <input
                type="checkbox"
                checked={addonForm.is_active}
                onChange={(e) => setAddonForm({ ...addonForm, is_active: e.target.checked })}
              />
              <span>Active for tenant subscriptions</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="saplans-btn-secondary"
                onClick={() => setEditAddonModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="saplans-btn-primary"
                onClick={handleSaveAddon}
                disabled={savingAction}
              >
                {savingAction ? 'Saving...' : 'Save Add-On'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 3: CREATE PROMO CODE
         ========================================================================= */}
      {createPromoModalOpen && (
        <Modal
          isOpen={createPromoModalOpen}
          onClose={() => setCreatePromoModalOpen(false)}
          title="Create New Promotional Coupon Code"
          size="md"
        >
          <form onSubmit={handleCreatePromo} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="saplans-form-group">
              <label className="saplans-form-label">Coupon Code (Uppercase)</label>
              <input
                type="text"
                className="saplans-input"
                placeholder="e.g. DIWALI30 or LAUNCH50"
                value={promoForm.code}
                onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">Discount Type</label>
                <select
                  className="saplans-select"
                  value={promoForm.discount_type}
                  onChange={(e: any) => setPromoForm({ ...promoForm, discount_type: e.target.value })}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_paise">Fixed Amount (₹)</option>
                </select>
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">
                  Discount Value {promoForm.discount_type === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input
                  type="number"
                  min="1"
                  className="saplans-input"
                  value={promoForm.discount_value}
                  onChange={(e) => setPromoForm({ ...promoForm, discount_value: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="saplans-form-grid">
              <div className="saplans-form-group">
                <label className="saplans-form-label">Expiration Date</label>
                <input
                  type="date"
                  className="saplans-input"
                  value={promoForm.valid_until}
                  onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })}
                  required
                />
              </div>

              <div className="saplans-form-group">
                <label className="saplans-form-label">Max Redemptions</label>
                <input
                  type="number"
                  min="1"
                  className="saplans-input"
                  value={promoForm.max_redemptions}
                  onChange={(e) => setPromoForm({ ...promoForm, max_redemptions: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="saplans-btn-secondary"
                onClick={() => setCreatePromoModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="saplans-btn-primary"
                disabled={savingAction}
              >
                {savingAction ? 'Creating...' : 'Create Promo Code'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
