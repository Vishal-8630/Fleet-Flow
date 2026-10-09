/**
 * ============================================================================
 * FLEET FLOW — MODERN SAAS BILLING & SUBSCRIPTIONS PAGE (BillingPage.tsx)
 * ============================================================================
 * 
 * Commercial subscription management center:
 * - Active plan status banner with real-time countdown.
 * - Resource meters (Fleet trucks, drivers, operator seats).
 * - High-contrast Monthly vs Annual billing switch (17% discount).
 * - Elevated 4-column pricing plans matrix with distinctive active & featured states.
 * - Standalone modular add-ons studio with feature bullets.
 * - Down-to-the-second proration upgrade modal.
 * - Enterprise security and GST compliance trust strip.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Truck,
  Users,
  UserCheck,
  Check,
  FileText,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';

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
}

interface AddOn {
  _id: string;
  name: string;
  code: string;
  description: string;
  type: string;
  monthly_price_paise: number;
  annual_price_paise: number;
}

export const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Proration Modal State
  const [prorationModalOpen, setProrationModalOpen] = useState<boolean>(false);
  const [targetPlan, setTargetPlan] = useState<Plan | null>(null);
  const [prorationData, setProrationData] = useState<any>(null);
  const [calculatingProration, setCalculatingProration] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        axios.get('/api/billing/plans', { withCredentials: true }),
        axios.get('/api/billing/subscription', { withCredentials: true }),
      ]);

      setPlans(plansRes.data.plans || []);
      setAddons(plansRes.data.addons || []);
      setSubscriptionData(subRes.data);
      if (subRes.data?.subscription?.billing_cycle) {
        setBillingCycle(subRes.data.subscription.billing_cycle);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    const currentPlanCode = subscriptionData?.subscription?.plan_id?.code;
    if (currentPlanCode === plan.code) {
      toast.info('You are already subscribed to this plan.');
      return;
    }

    setTargetPlan(plan);
    setProrationModalOpen(true);
    setCalculatingProration(true);

    try {
      const res = await axios.post(
        '/api/billing/calculate-change',
        { target_plan_id: plan._id, billing_cycle: billingCycle },
        { withCredentials: true }
      );
      setProrationData(res.data.proration);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to compute proration calculus.');
      setProrationModalOpen(false);
    } finally {
      setCalculatingProration(false);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!targetPlan) return;
    setActionLoading(true);
    try {
      const res = await axios.post(
        '/api/billing/change-plan',
        { target_plan_id: targetPlan._id, billing_cycle: billingCycle },
        { withCredentials: true }
      );

      toast.success(res.data.message || 'Subscription updated successfully!');
      setProrationModalOpen(false);
      fetchBillingData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAddon = async (addonCode: string, currentlyActive: boolean) => {
    try {
      const res = await axios.post(
        '/api/billing/toggle-addon',
        { addon_code: addonCode, enabled: !currentlyActive },
        { withCredentials: true }
      );
      toast.success(res.data.message);
      fetchBillingData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update add-on.');
    }
  };

  if (loading) {
    return (
      <div className="shell-container billing-container">
        <PageHeader title="SaaS Billing & Subscriptions" subtitle="Manage your transport operating system plan" />
        <div className="card" style={{ padding: '80px', textAlign: 'center' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Loading platform subscription catalog...
          </p>
        </div>
      </div>
    );
  }

  const currentSub = subscriptionData?.subscription;
  const usage = subscriptionData?.usage || { trucks: 0, drivers: 0, users: 0 };
  const entitlements = subscriptionData?.entitlements;
  const status = entitlements?.status || 'trialing';
  const limits = entitlements?.limits || { max_trucks: 5, max_drivers: 5, max_users: 2 };
  const activePlanCode = currentSub?.plan_id?.code || 'standard';

  const trucksPercent = limits.max_trucks === -1 ? 15 : Math.min(100, Math.round((usage.trucks / limits.max_trucks) * 100));
  const driversPercent = limits.max_drivers === -1 ? 15 : Math.min(100, Math.round((usage.drivers / limits.max_drivers) * 100));
  const usersPercent = limits.max_users === -1 ? 15 : Math.min(100, Math.round((usage.users / limits.max_users) * 100));

  return (
    <div className="shell-container billing-container">
      <PageHeader
        title="SaaS Billing & Subscriptions"
        subtitle="Manage your platform tier, fleet resource limits, and commercial add-ons"
      />

      {/* 1. Hero Workspace Status Card */}
      <div className={`billing-hero-card ${status}`}>
        <div className="billing-hero-left">
          <div className="billing-hero-icon-box">
            {status === 'active' ? (
              <ShieldCheck size={28} color="#10b981" />
            ) : status === 'past_due' ? (
              <AlertTriangle size={28} color="#f59e0b" />
            ) : status === 'suspended' ? (
              <AlertTriangle size={28} color="#ef4444" />
            ) : (
              <Clock size={28} color="#2563eb" />
            )}
          </div>
          <div className="billing-hero-body">
            <div className="billing-hero-badges">
              <span className={`billing-hero-status-pill ${status}`}>
                <span className="billing-hero-pulse-dot" />
                {status === 'active' && 'Active Subscription'}
                {status === 'trialing' && `14-Day Free Trial (${entitlements?.days_remaining_in_trial ?? 14} days remaining)`}
                {status === 'past_due' && '7-Day Grace Dunning Active'}
                {status === 'suspended' && 'Suspended (Read-Only Mode)'}
              </span>
              <span className="billing-hero-tier-tag">
                {currentSub?.plan_id?.name || 'Standard Commercial'}
              </span>
            </div>

            <h3 className="billing-hero-title">
              {status === 'active' && 'Commercial Workspace in Good Standing'}
              {status === 'trialing' && 'Full Commercial Features Unlocked in Free Trial'}
              {status === 'past_due' && 'Action Required: Renewal Payment Pending'}
              {status === 'suspended' && 'Workspace Locked in Read-Only Mode'}
            </h3>

            <p className="billing-hero-desc">
              {status === 'active' &&
                `Your next billing renewal is scheduled for ${new Date(currentSub?.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. All modules and quota headroom are operating normally.`}
              {status === 'trialing' &&
                'You have unrestricted access to all 20 modules including Freight Invoicing, Trips, and Ledger Settlements. Select a plan anytime to ensure zero downtime.'}
              {status === 'past_due' &&
                'Your latest renewal attempt was unsuccessful. Please confirm your payment details within 7 days to prevent operational lockdown.'}
              {status === 'suspended' &&
                'Your account is in read-only mode. Reactivate your plan to resume editing LRs, dispatches, and driver settlements.'}
            </p>
          </div>
        </div>

        <div className="billing-hero-right">
          <div className="billing-hero-meta-item">
            <span className="billing-hero-meta-label">Current Cycle</span>
            <span className="billing-hero-meta-value" style={{ textTransform: 'capitalize' }}>
              {billingCycle} Billing
            </span>
          </div>
          <div className="billing-hero-meta-item">
            <span className="billing-hero-meta-label">Valid Through</span>
            <span className="billing-hero-meta-value">
              {currentSub?.current_period_end
                ? new Date(currentSub.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '14 Days Free'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Real-Time Resource Meters (Elevated KPI Grid) */}
      <div className="usage-meters-grid">
        {/* Metric 1: Trucks */}
        <div className="usage-meter-card">
          <div className="usage-meter-header">
            <div className="usage-meter-title-wrap">
              <div className="usage-meter-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <Truck size={18} />
              </div>
              <div className="usage-meter-label-group">
                <span className="usage-meter-label">Fleet Trucks</span>
                <span className="usage-meter-sublabel">Registered vehicles</span>
              </div>
            </div>
            <span className={`usage-meter-badge ${trucksPercent >= 90 ? 'danger' : trucksPercent >= 75 ? 'warning' : ''}`}>
              {limits.max_trucks === -1 ? 'Unlimited' : `${trucksPercent}% Used`}
            </span>
          </div>

          <div className="usage-meter-value-wrap">
            <span className="usage-meter-current">{usage.trucks}</span>
            <span className="usage-meter-max">
              / {limits.max_trucks === -1 ? '∞' : limits.max_trucks}
            </span>
            <span className="usage-meter-unit">trucks</span>
          </div>

          <div className="usage-progress-track">
            <div
              className={`usage-progress-bar primary ${trucksPercent >= 90 ? 'danger' : trucksPercent >= 75 ? 'warning' : ''}`}
              style={{ width: `${trucksPercent}%` }}
            />
          </div>

          <div className="usage-meter-footer">
            <span>
              {limits.max_trucks === -1 ? 'Unlimited enterprise capacity' : `${Math.max(0, limits.max_trucks - usage.trucks)} slots remaining`}
            </span>
            <span style={{ fontWeight: 600 }}>
              {limits.max_trucks === -1 ? 'Tier: Pro' : 'Cap: Standard'}
            </span>
          </div>
        </div>

        {/* Metric 2: Drivers */}
        <div className="usage-meter-card">
          <div className="usage-meter-header">
            <div className="usage-meter-title-wrap">
              <div className="usage-meter-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                <Users size={18} />
              </div>
              <div className="usage-meter-label-group">
                <span className="usage-meter-label">Active Drivers</span>
                <span className="usage-meter-sublabel">Verified commercial drivers</span>
              </div>
            </div>
            <span className={`usage-meter-badge ${driversPercent >= 90 ? 'danger' : driversPercent >= 75 ? 'warning' : ''}`}>
              {limits.max_drivers === -1 ? 'Unlimited' : `${driversPercent}% Used`}
            </span>
          </div>

          <div className="usage-meter-value-wrap">
            <span className="usage-meter-current">{usage.drivers}</span>
            <span className="usage-meter-max">
              / {limits.max_drivers === -1 ? '∞' : limits.max_drivers}
            </span>
            <span className="usage-meter-unit">drivers</span>
          </div>

          <div className="usage-progress-track">
            <div
              className={`usage-progress-bar emerald ${driversPercent >= 90 ? 'danger' : driversPercent >= 75 ? 'warning' : ''}`}
              style={{ width: `${driversPercent}%` }}
            />
          </div>

          <div className="usage-meter-footer">
            <span>
              {limits.max_drivers === -1 ? 'Unlimited driver roster' : `${Math.max(0, limits.max_drivers - usage.drivers)} slots open`}
            </span>
            <span style={{ fontWeight: 600 }}>
              KYC Enabled
            </span>
          </div>
        </div>

        {/* Metric 3: Team Seats */}
        <div className="usage-meter-card">
          <div className="usage-meter-header">
            <div className="usage-meter-title-wrap">
              <div className="usage-meter-icon" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                <UserCheck size={18} />
              </div>
              <div className="usage-meter-label-group">
                <span className="usage-meter-label">Team Accounts</span>
                <span className="usage-meter-sublabel">Staff & dispatchers</span>
              </div>
            </div>
            <span className={`usage-meter-badge ${usersPercent >= 90 ? 'danger' : usersPercent >= 75 ? 'warning' : ''}`}>
              {limits.max_users === -1 ? 'Unlimited' : `${usersPercent}% Used`}
            </span>
          </div>

          <div className="usage-meter-value-wrap">
            <span className="usage-meter-current">{usage.users}</span>
            <span className="usage-meter-max">
              / {limits.max_users === -1 ? '∞' : limits.max_users}
            </span>
            <span className="usage-meter-unit">seats</span>
          </div>

          <div className="usage-progress-track">
            <div
              className={`usage-progress-bar purple ${usersPercent >= 90 ? 'danger' : usersPercent >= 75 ? 'warning' : ''}`}
              style={{ width: `${usersPercent}%` }}
            />
          </div>

          <div className="usage-meter-footer">
            <span>
              {limits.max_users === -1 ? 'Unlimited team seats' : `${Math.max(0, limits.max_users - usage.users)} seats available`}
            </span>
            <span style={{ fontWeight: 600 }}>
              Role-Based Access
            </span>
          </div>
        </div>
      </div>

      {/* 3. High-Contrast Billing Cycle Segmented Control */}
      <div className="billing-cycle-switch-section">
        <div className="billing-cycle-switch">
          <button
            type="button"
            className={`cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`cycle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            Annual Billing
            <span className="cycle-discount-badge">Save 17% (2 Mo Free)</span>
          </button>
        </div>
        <p className="billing-cycle-subtext">
          {billingCycle === 'annual'
            ? 'Annual plans billed upfront with a 17% discount · Save up to ₹17,998/year'
            : 'Monthly flexibility with zero long-term commitments · Switch to Annual anytime'}
        </p>
      </div>

      {/* 4. Pricing Plans Matrix (4 Columns) */}
      <div className="plans-grid">
        {plans.map((plan) => {
          const isCurrent = activePlanCode === plan.code;
          const isPro = plan.code === 'pro';
          const isEnterprise = plan.code === 'enterprise';
          const pricePaise = billingCycle === 'annual' ? plan.annual_price_paise : plan.monthly_price_paise;
          const displayPrice = billingCycle === 'annual' ? Math.round(pricePaise / 1200) : pricePaise / 100;

          return (
            <div
              key={plan._id}
              className={`plan-card ${isPro ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}
            >
              {isPro && (
                <div className="plan-featured-pill">
                  ★ Most Popular
                </div>
              )}

              {isCurrent && (
                <div className="plan-current-badge">
                  <Check size={12} strokeWidth={3} /> Current Plan
                </div>
              )}

              <div className="plan-header">
                <div className="plan-tier-label">
                  {isEnterprise ? 'ENTERPRISE TIER' : isPro ? 'GROWTH TIER' : 'STANDARD TIER'}
                </div>
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>
              </div>

              <div className="plan-pricing-box">
                <span className="plan-price-currency">₹</span>
                <span className="plan-price-amount">{displayPrice.toLocaleString('en-IN')}</span>
                <span className="plan-price-frequency">/month</span>
              </div>

              {billingCycle === 'annual' && (
                <div className="plan-billed-yearly-note">
                  Billed annually at ₹{Math.round(pricePaise / 100).toLocaleString('en-IN')}/yr
                </div>
              )}

              <ul className="plan-features-list">
                <li className="plan-feature-item">
                  <div className="plan-feature-icon-box">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>{plan.max_trucks === -1 ? 'Unlimited' : plan.max_trucks}</strong> Fleet Trucks
                  </span>
                </li>
                <li className="plan-feature-item">
                  <div className="plan-feature-icon-box">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>{plan.max_drivers === -1 ? 'Unlimited' : plan.max_drivers}</strong> Drivers
                  </span>
                </li>
                <li className="plan-feature-item">
                  <div className="plan-feature-icon-box">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>{plan.max_users === -1 ? 'Unlimited' : plan.max_users}</strong> Team Accounts
                  </span>
                </li>
                <li className="plan-feature-item">
                  <div className="plan-feature-icon-box">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>{plan.included_features.length}</strong> Operational Modules
                  </span>
                </li>
                {isPro && (
                  <li className="plan-feature-item">
                    <div className="plan-feature-icon-box">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span>
                      <strong>Priority</strong> Driver Settlement Engine
                    </span>
                  </li>
                )}
                {isEnterprise && (
                  <li className="plan-feature-item">
                    <div className="plan-feature-icon-box">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span>
                      <strong>Dedicated</strong> Account SLA & Telematics
                    </span>
                  </li>
                )}
              </ul>

              <button
                type="button"
                className={`plan-cta-btn ${isCurrent ? 'current' : isPro ? 'primary' : 'outline'}`}
                disabled={isCurrent}
                onClick={() => handleSelectPlan(plan)}
              >
                {isCurrent ? (
                  <>
                    <Check size={14} /> Active Plan
                  </>
                ) : isPro ? (
                  <>
                    Upgrade to Pro <ArrowRight size={14} />
                  </>
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 5. Standalone Modular Add-Ons Studio */}
      <div className="addons-section-card">
        <div className="addons-header">
          <div>
            <h3 className="addons-header-title">Modular Commercial Add-Ons</h3>
            <p className="addons-header-desc">
              Enhance your transport OS with standalone capabilities without moving between tiers.
            </p>
          </div>
        </div>

        <div className="addons-grid">
          {addons.map((addon) => {
            const isActive = currentSub?.active_addons?.some((a: any) => a.code === addon.code);
            const price = billingCycle === 'annual' ? addon.annual_price_paise / 1200 : addon.monthly_price_paise / 100;

            const isWhatsApp = addon.code.includes('whatsapp');
            const isIQ = addon.code.includes('iq');
            const isBooster = addon.code.includes('boost') || addon.code.includes('capacity');

            return (
              <div key={addon._id} className={`addon-card ${isActive ? 'active' : ''}`}>
                <div className="addon-top">
                  <div
                    className="addon-icon-box"
                    style={{
                      backgroundColor: isWhatsApp ? '#ecfdf5' : isIQ ? '#eff6ff' : '#fef3c7',
                      color: isWhatsApp ? '#10b981' : isIQ ? '#2563eb' : '#d97706',
                    }}
                  >
                    {isWhatsApp ? <Zap size={20} /> : isIQ ? <Sparkles size={20} /> : <Truck size={20} />}
                  </div>

                  <div className="addon-details">
                    <span className="addon-badge">
                      {isWhatsApp ? 'COMMUNICATION' : isIQ ? 'AI ANALYTICS' : 'FLEET CAPACITY'}
                    </span>
                    <h4 className="addon-title">{addon.name}</h4>
                    <p className="addon-desc">{addon.description}</p>

                    <div className="addon-features-mini">
                      {isWhatsApp && (
                        <>
                          <div className="addon-feature-item">
                            <Check size={12} color="#10b981" /> Instant PDF LR Delivery via WhatsApp
                          </div>
                          <div className="addon-feature-item">
                            <Check size={12} color="#10b981" /> Automated Driver Advance & Settlement Receipts
                          </div>
                        </>
                      )}
                      {isIQ && (
                        <>
                          <div className="addon-feature-item">
                            <Check size={12} color="#2563eb" /> AI Diesel Variance & Route Audit
                          </div>
                          <div className="addon-feature-item">
                            <Check size={12} color="#2563eb" /> Predictive Maintenance & Risk Profiling
                          </div>
                        </>
                      )}
                      {isBooster && (
                        <>
                          <div className="addon-feature-item">
                            <Check size={12} color="#d97706" /> +10 Extra Fleet Vehicle Slots
                          </div>
                          <div className="addon-feature-item">
                            <Check size={12} color="#d97706" /> +10 Commercial Driver Profiles
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="addon-footer">
                  <div className="addon-price-group">
                    <span className="addon-price">₹{price.toLocaleString('en-IN')}</span>
                    <span className="addon-price-period">/month per workspace</span>
                  </div>

                  <button
                    type="button"
                    className={`addon-btn ${isActive ? 'active' : 'add'}`}
                    onClick={() => handleToggleAddon(addon.code, isActive)}
                  >
                    {isActive ? '✓ Active' : '+ Add to Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Trust & Enterprise Badges Section */}
      <div className="billing-trust-strip">
        <div className="billing-trust-item">
          <Lock size={20} className="billing-trust-icon" />
          <div>
            <h4 className="billing-trust-title">Bank-Grade 256-Bit SSL</h4>
            <p className="billing-trust-desc">All payment processing is tokenized and secured via Razorpay.</p>
          </div>
        </div>

        <div className="billing-trust-item">
          <FileText size={20} className="billing-trust-icon" />
          <div>
            <h4 className="billing-trust-title">GST Tax Invoices</h4>
            <p className="billing-trust-desc">Automated GST B2B tax invoices generated with instant ITC credit.</p>
          </div>
        </div>

        <div className="billing-trust-item">
          <RefreshCw size={20} className="billing-trust-icon" />
          <div>
            <h4 className="billing-trust-title">Exact Prorated Billing</h4>
            <p className="billing-trust-desc">Upgrade or switch tiers anytime with second-by-second credit offset.</p>
          </div>
        </div>

        <div className="billing-trust-item">
          <ShieldCheck size={20} className="billing-trust-icon" />
          <div>
            <h4 className="billing-trust-title">Cancel or Pause Anytime</h4>
            <p className="billing-trust-desc">Zero lock-ins or cancellation penalties. Your data remains exportable.</p>
          </div>
        </div>
      </div>

      {/* 7. Mathematical Proration Modal */}
      <Modal
        isOpen={prorationModalOpen}
        onClose={() => setProrationModalOpen(false)}
        title="Confirm Subscription Change"
        subtitle="Review your down-to-the-second prorated billing summary"
      >
        {calculatingProration ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Calculating exact proration calculus...</p>
          </div>
        ) : (
          <div>
            <div className="proration-comparison-header">
              <div className="proration-plan-badge">
                <span className="proration-plan-type">CURRENT PLAN</span>
                <span className="proration-plan-name">{currentSub?.plan_id?.name || 'Standard Plan'}</span>
              </div>
              <ArrowRight size={22} className="proration-arrow" />
              <div className="proration-plan-badge">
                <span className="proration-plan-type">NEW TARGET PLAN</span>
                <span className="proration-plan-name" style={{ color: 'var(--color-primary-600)' }}>
                  {targetPlan?.name}
                </span>
              </div>
            </div>

            {prorationData && (
              <div className="proration-summary-box">
                <div className="proration-row">
                  <span>Billing Cycle</span>
                  <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{billingCycle}</span>
                </div>
                <div className="proration-row">
                  <span>Cycle Remaining</span>
                  <span>{Math.round(prorationData.fraction_remaining * 100)}%</span>
                </div>
                <div className="proration-row">
                  <span>Unused Current Plan Credit</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    -₹{(prorationData.current_plan_credit_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="proration-row">
                  <span>New Plan Prorated Charge</span>
                  <span style={{ fontWeight: 600 }}>
                    ₹{(prorationData.new_plan_charge_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="proration-row total">
                  <span>Net Amount Due Today</span>
                  <span className="proration-due-amount">
                    ₹{prorationData.net_payable_rupees.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProrationModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmPlanChange}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Confirm & Apply Plan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
