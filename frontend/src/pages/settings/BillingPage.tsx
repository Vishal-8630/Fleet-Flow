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
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../../stores/authStore';
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
  Printer,
  Building,
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

interface PaymentTransactionItem {
  _id: string;
  order_id: string;
  payment_id?: string;
  amount_paise: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  payment_method?: string;
  billing_cycle: 'monthly' | 'annual';
  invoice_number: string;
  invoice_date: string;
  created_at: string;
  plan_id?: { _id: string; name: string; code: string };
  tax_breakup?: {
    subtotal_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    total_paise: number;
  };
}

export const BillingPage: React.FC = () => {
  const { user } = useAuthStore();

  // Platform super-admins manage catalog governance and do not have tenant billing contracts
  if (user?.isSuperAdmin) {
    return <Navigate to="/super-admin/plans" replace />;
  }

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

  // Billing History & Invoices
  const [historyTransactions, setHistoryTransactions] = useState<PaymentTransactionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // In-App / Razorpay Checkout Modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [checkoutOrder, setCheckoutOrder] = useState<any>(null);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'netbanking' | 'upi'>('netbanking');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [paymentProcessing, setPaymentProcessing] = useState<boolean>(false);

  // Tax Invoice Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchBillingData();
    fetchBillingHistory();
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

  const fetchBillingHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get('/api/billing/history', { withCredentials: true });
      setHistoryTransactions(res.data.transactions || []);
    } catch (err: any) {
      console.warn('Failed to load billing history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    const currentPlanCode = subscriptionData?.subscription?.plan_id?.code;
    const currentSubCycle = subscriptionData?.subscription?.billing_cycle || 'monthly';
    if (currentPlanCode === plan.code && currentSubCycle === billingCycle) {
      toast.info(`You are already subscribed to ${plan.name} (${billingCycle} billing).`);
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

  const openRazorpayCheckout = (orderData: any) => {
    // If Razorpay SDK is available on window and real live keys are configured:
    if ((window as any).Razorpay && orderData.is_live) {
      try {
        const options = {
          key: orderData.razorpay_key,
          amount: orderData.amount_paise,
          currency: orderData.currency || 'INR',
          name: 'Fleet Flow Logistics OS',
          description: `${orderData.plan.name} (${orderData.billing_cycle}) Subscription`,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            await handleVerifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: orderData.plan.id,
              billing_cycle: orderData.billing_cycle,
              payment_method: 'card',
            });
          },
          modal: {
            ondismiss: () => {
              toast.warning('Payment window closed. Your plan has not been changed.');
              setActionLoading(false);
            },
          },
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          theme: {
            color: '#2563eb',
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      } catch (err) {
        console.warn('Real Razorpay window failed, opening secure in-app checkout modal:', err);
      }
    }

    // Default / Test / Emulator fallback:
    setCheckoutOrder(orderData);
    setCheckoutModalOpen(true);
  };

  const handleCancelCheckout = () => {
    setCheckoutModalOpen(false);
    toast.warning('Payment window closed. Your plan has not been changed.');
    setActionLoading(false);
  };

  const handleVerifyPayment = async (verificationPayload: any) => {
    try {
      const res = await axios.post('/api/billing/verify-payment', verificationPayload, { withCredentials: true });
      toast.success(res.data.message || `Payment verified successfully! Your workspace has been upgraded to ${checkoutOrder?.plan?.name || 'new plan'}.`);
      setProrationModalOpen(false);
      setCheckoutModalOpen(false);
      await Promise.all([fetchBillingData(), fetchBillingHistory(), useAuthStore.getState().checkAuth()]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Payment verification failed.');
      throw err;
    }
  };

  const handleCompleteEmulatorPayment = async () => {
    if (!checkoutOrder) return;
    setPaymentProcessing(true);
    try {
      await handleVerifyPayment({
        razorpay_order_id: checkoutOrder.order_id,
        razorpay_payment_id: `pay_${Date.now()}_test`,
        razorpay_signature: 'simulated_test_signature_valid',
        plan_id: checkoutOrder.plan.id,
        billing_cycle: checkoutOrder.billing_cycle,
        payment_method: selectedMethod,
      });
    } catch (err: any) {
      // toast shown in handleVerifyPayment
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!targetPlan) return;

    const currentSubCycle = subscriptionData?.subscription?.billing_cycle || 'monthly';
    const currentPlan = subscriptionData?.subscription?.plan_id;
    const currentPricePaise = currentPlan
      ? (currentSubCycle === 'annual' ? currentPlan.annual_price_paise : currentPlan.monthly_price_paise)
      : 0;
    const targetPricePaise = billingCycle === 'annual' ? targetPlan.annual_price_paise : targetPlan.monthly_price_paise;
    const isDowngradeTier = currentPricePaise > 0 && targetPricePaise < currentPricePaise;

    const usage = subscriptionData?.usage || { trucks: 0, drivers: 0, users: 0 };
    const quotaExceededTrucks = targetPlan.max_trucks !== -1 && usage.trucks > targetPlan.max_trucks;
    const quotaExceededDrivers = targetPlan.max_drivers !== -1 && usage.drivers > targetPlan.max_drivers;
    const quotaExceededUsers = targetPlan.max_users !== -1 && usage.users > targetPlan.max_users;
    const hasQuotaExceeded = quotaExceededTrucks || quotaExceededDrivers || quotaExceededUsers;

    if (hasQuotaExceeded) {
      toast.error(`Cannot downgrade to ${targetPlan.name}: Fleet resource quota exceeded.`);
      return;
    }

    const status = subscriptionData?.entitlements?.status || 'trialing';

    // If downgrading:
    if (isDowngradeTier && status !== 'trialing') {
      setActionLoading(true);
      try {
        const res = await axios.post(
          '/api/billing/change-plan',
          { target_plan_id: targetPlan._id, billing_cycle: billingCycle, immediate: false },
          { withCredentials: true }
        );
        toast.success(res.data.message || `Downgrade to ${targetPlan.name} scheduled for end of cycle.`);
        setProrationModalOpen(false);
        await fetchBillingData();
        await useAuthStore.getState().checkAuth();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to schedule plan downgrade.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // If in trialing status and switching free trial tier:
    if (status === 'trialing' && !prorationData?.net_payable_rupees) {
      setActionLoading(true);
      try {
        const res = await axios.post(
          '/api/billing/change-plan',
          { target_plan_id: targetPlan._id, billing_cycle: billingCycle, immediate: true },
          { withCredentials: true }
        );
        toast.success(res.data.message || `Switched to ${targetPlan.name} (Trial Active)!`);
        setProrationModalOpen(false);
        await fetchBillingData();
        await useAuthStore.getState().checkAuth();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to update trial plan.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // Upgrading or activating paid plan: Initialize Checkout
    setActionLoading(true);
    try {
      const res = await axios.post(
        '/api/billing/checkout',
        { plan_id: targetPlan._id, billing_cycle: billingCycle },
        { withCredentials: true }
      );
      setProrationModalOpen(false);
      openRazorpayCheckout(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initialize payment checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewReceipt = async (transactionId: string) => {
    setReceiptLoading(true);
    setReceiptModalOpen(true);
    try {
      const res = await axios.get(`/api/billing/invoices/${transactionId}/receipt`, { withCredentials: true });
      setReceiptData(res.data.receipt);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load tax invoice receipt.');
      setReceiptModalOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleApplyScheduled = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(
        '/api/billing/apply-scheduled',
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message || 'Plan applied immediately!');
      await fetchBillingData();
      await useAuthStore.getState().checkAuth();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to apply plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelScheduled = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(
        '/api/billing/cancel-scheduled',
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message || 'Scheduled plan change cancelled.');
      await fetchBillingData();
      await useAuthStore.getState().checkAuth();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel scheduled plan.');
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

      {/* Pending Scheduled Plan Change Alert Banner */}
      {currentSub?.scheduled_change && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            backgroundColor: '#eff6ff',
            borderRadius: '12px',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e3a8a', fontSize: '0.9375rem' }}>
                Pending Downgrade Scheduled
              </div>
              <div style={{ color: '#3b82f6', fontSize: '0.8125rem' }}>
                A plan downgrade is scheduled to take effect on{' '}
                {new Date(currentSub.scheduled_change.effective_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}. You can apply it immediately right now for testing or cancel it.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600 }}
              onClick={handleApplyScheduled}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Apply Immediately'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
              onClick={handleCancelScheduled}
              disabled={actionLoading}
            >
              Cancel Downgrade
            </button>
          </div>
        </div>
      )}

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
          const currentSubCycle = currentSub?.billing_cycle || 'monthly';
          const isCurrent = activePlanCode === plan.code && currentSubCycle === billingCycle;
          const isSamePlanDifferentCycle = activePlanCode === plan.code && currentSubCycle !== billingCycle;
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

              {(() => {
                const currentPricePaise = currentSub?.plan_id
                  ? (currentSubCycle === 'annual' ? currentSub.plan_id.annual_price_paise : currentSub.plan_id.monthly_price_paise)
                  : 0;
                const targetPricePaise = billingCycle === 'annual' ? plan.annual_price_paise : plan.monthly_price_paise;
                const isDowngradeTier = currentPricePaise > 0 && targetPricePaise < currentPricePaise;

                return (
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
                    ) : isSamePlanDifferentCycle ? (
                      billingCycle === 'annual' ? (
                        <>
                          Switch to Annual (Save 17%) <ArrowRight size={14} />
                        </>
                      ) : (
                        `Switch to Monthly`
                      )
                    ) : isDowngradeTier ? (
                      `Downgrade to ${plan.name}`
                    ) : isPro ? (
                      <>
                        Upgrade to Pro <ArrowRight size={14} />
                      </>
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                );
              })()}
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

      {/* 7. Billing History & Tax Invoices Audit Ledger */}
      <div className="billing-history-card">
        <div className="billing-history-header">
          <div>
            <h3 className="billing-history-title">Billing History & Tax Invoices</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Audit ledger of subscription transactions with downloadable GST B2B tax receipts
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchBillingHistory}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
          >
            <RefreshCw size={14} /> Refresh History
          </button>
        </div>

        {historyLoading ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div className="loading-spinner" />
          </div>
        ) : historyTransactions.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No past transactions recorded yet. When you activate or renew a subscription tier, your GST invoices will appear here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="billing-history-table">
              <thead>
                <tr>
                  <th>Invoice Date</th>
                  <th>Invoice #</th>
                  <th>Plan & Cycle</th>
                  <th>Amount</th>
                  <th>Payment Ref</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td>
                      {new Date(tx.invoice_date || tx.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <code>{tx.invoice_number}</code>
                    </td>
                    <td>
                      <strong>{tx.plan_id?.name || 'SaaS Plan'}</strong> ·{' '}
                      <span style={{ textTransform: 'capitalize' }}>{tx.billing_cycle}</span>
                    </td>
                    <td>
                      <strong>
                        ₹{(tx.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>incl. 18% GST</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{tx.payment_id || tx.order_id}</code>
                    </td>
                    <td>
                      {tx.status === 'success' ? (
                        <span className="status-badge-success">
                          <Check size={10} strokeWidth={3} /> PAID
                        </span>
                      ) : tx.status === 'failed' ? (
                        <span className="status-badge-failed">
                          <AlertTriangle size={10} strokeWidth={3} /> FAILED
                        </span>
                      ) : (
                        <span className="status-badge-pending">
                          <Clock size={10} strokeWidth={3} /> PENDING
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleViewReceipt(tx._id)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText size={12} /> View Tax Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Mathematical Proration Modal & Downgrade Headroom Check */}
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

            {/* Downgrade Headroom Validation Block */}
            {(() => {
              const targetTruckLimit = targetPlan?.max_trucks ?? -1;
              const targetDriverLimit = targetPlan?.max_drivers ?? -1;
              const targetUserLimit = targetPlan?.max_users ?? -1;
              const quotaExceededTrucks = Boolean(targetPlan && targetTruckLimit !== -1 && usage.trucks > targetTruckLimit);
              const quotaExceededDrivers = Boolean(targetPlan && targetDriverLimit !== -1 && usage.drivers > targetDriverLimit);
              const quotaExceededUsers = Boolean(targetPlan && targetUserLimit !== -1 && usage.users > targetUserLimit);
              const hasQuotaExceeded = quotaExceededTrucks || quotaExceededDrivers || quotaExceededUsers;

              if (hasQuotaExceeded) {
                return (
                  <div className="downgrade-quota-warning">
                    <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h4>Cannot Downgrade Plan (Quota Exceeded)</h4>
                      <p>
                        {quotaExceededTrucks && `You currently have ${usage.trucks} registered trucks in your fleet, but the ${targetPlan?.name} has a maximum limit of ${targetTruckLimit} trucks. To switch to this plan, please deactivate or delete ${usage.trucks - targetTruckLimit} trucks first in Fleet Management.`}
                        {quotaExceededDrivers && ` You currently have ${usage.drivers} registered drivers, but ${targetPlan?.name} allows a maximum of ${targetDriverLimit}. Please remove ${usage.drivers - targetDriverLimit} drivers first.`}
                        {quotaExceededUsers && ` You currently have ${usage.users} team members, but ${targetPlan?.name} allows a maximum of ${targetUserLimit}.`}
                      </p>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

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
                    {status === 'trialing' ? '₹0 (Free Trial Active)' : `₹${prorationData.net_payable_rupees.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            )}

            {status === 'trialing' && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '0.8125rem',
                }}
              >
                ✓ <strong>Free Trial Plan Switch:</strong> Switching to <strong>{targetPlan?.name}</strong> applies immediately without any payment today. Your trial will continue on the selected plan with its respective feature set and limits.
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
              {(() => {
                const targetTruckLimit = targetPlan?.max_trucks ?? -1;
                const targetDriverLimit = targetPlan?.max_drivers ?? -1;
                const targetUserLimit = targetPlan?.max_users ?? -1;
                const hasQuotaExceeded = Boolean(
                  targetPlan && (
                    (targetTruckLimit !== -1 && usage.trucks > targetTruckLimit) ||
                    (targetDriverLimit !== -1 && usage.drivers > targetDriverLimit) ||
                    (targetUserLimit !== -1 && usage.users > targetUserLimit)
                  )
                );

                const currentSubCycle = currentSub?.billing_cycle || 'monthly';
                const currentPricePaise = currentSub?.plan_id
                  ? (currentSubCycle === 'annual' ? currentSub.plan_id.annual_price_paise : currentSub.plan_id.monthly_price_paise)
                  : 0;
                const targetPricePaise = targetPlan
                  ? (billingCycle === 'annual' ? targetPlan.annual_price_paise : targetPlan.monthly_price_paise)
                  : 0;
                const isDowngradeTier = currentPricePaise > 0 && targetPricePaise < currentPricePaise;
                const isSamePlanDifferentCycle = targetPlan && activePlanCode === targetPlan.code && currentSubCycle !== billingCycle;

                if (hasQuotaExceeded) {
                  return (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    >
                      Confirm Downgrade (Blocked by Quota)
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmPlanChange}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? 'Processing...'
                      : targetPlan
                      ? status === 'trialing' && !prorationData?.net_payable_rupees
                        ? `Switch Trial to ${targetPlan.name} (Free)`
                        : isDowngradeTier
                        ? `Schedule Downgrade to ${targetPlan.name}`
                        : isSamePlanDifferentCycle
                        ? billingCycle === 'annual'
                          ? `Confirm Switch to Annual (${targetPlan.name})`
                          : `Confirm Switch to Monthly (${targetPlan.name})`
                        : `Proceed to Pay & Upgrade to ${targetPlan.name}`
                      : 'Confirm Plan'}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* 9. In-App / Razorpay Checkout Modal */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={handleCancelCheckout}
        title="Razorpay Secure Checkout"
        subtitle="Complete payment to activate subscription tier"
      >
        <div className="checkout-modal-container">
          <div className="checkout-branding-strip">
            <div className="checkout-branding-left">
              <CreditCard size={20} color="#60a5fa" />
              <span className="checkout-branding-title">Razorpay Standard Checkout</span>
            </div>
            <span className="checkout-branding-badge">
              {checkoutOrder?.is_live ? 'LIVE PRODUCTION' : 'TEST MODE'}
            </span>
          </div>

          {checkoutOrder && (
            <div className="checkout-order-summary">
              <div className="checkout-summary-row">
                <span>Plan</span>
                <strong>{checkoutOrder.plan?.name} ({checkoutOrder.billing_cycle})</strong>
              </div>
              <div className="checkout-summary-row">
                <span>Invoice Reference</span>
                <code>{checkoutOrder.invoice_number}</code>
              </div>
              <div className="checkout-summary-row">
                <span>Subtotal (Base Software Price)</span>
                <span>₹{(checkoutOrder.subtotal_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="checkout-summary-row">
                <span>CGST (9%)</span>
                <span>₹{(checkoutOrder.cgst_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="checkout-summary-row">
                <span>SGST (9%)</span>
                <span>₹{(checkoutOrder.sgst_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="checkout-summary-row total">
                <span>Total Amount Payable</span>
                <span style={{ color: '#2563eb' }}>
                  ₹{(checkoutOrder.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="checkout-methods-header">Select Payment Instrument:</div>
            <div className="checkout-method-tabs">
              <button
                type="button"
                className={`checkout-method-tab ${selectedMethod === 'netbanking' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('netbanking')}
              >
                <Building size={18} />
                Netbanking
              </button>
              <button
                type="button"
                className={`checkout-method-tab ${selectedMethod === 'card' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('card')}
              >
                <CreditCard size={18} />
                Card
              </button>
              <button
                type="button"
                className={`checkout-method-tab ${selectedMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('upi')}
              >
                <Zap size={18} />
                UPI
              </button>
            </div>

            {selectedMethod === 'netbanking' && (
              <div className="checkout-bank-grid">
                {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`checkout-bank-btn ${selectedBank === b ? 'selected' : ''}`}
                    onClick={() => setSelectedBank(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            {selectedMethod === 'card' && (
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.8125rem', color: '#64748b' }}>
                Test Card: <code>4111 1111 1111 1111</code> · Expiry: <code>12/28</code> · CVV: <code>123</code>
              </div>
            )}

            {selectedMethod === 'upi' && (
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.8125rem', color: '#64748b' }}>
                Test VPA / UPI ID: <code>success@razorpay</code>
              </div>
            )}
          </div>

          <div className="checkout-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelCheckout}
              disabled={paymentProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="checkout-pay-btn"
              onClick={handleCompleteEmulatorPayment}
              disabled={paymentProcessing}
            >
              {paymentProcessing ? (
                'Authorizing Payment...'
              ) : (
                <>
                  <CheckCircle size={16} /> Pay ₹{(checkoutOrder?.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Now
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* 10. B2B GST Tax Invoice Printable Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="B2B GST Tax Invoice"
        subtitle="Official commercial tax invoice compliant with Indian GST rules"
      >
        {receiptLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Generating tax invoice receipt...</p>
          </div>
        ) : receiptData ? (
          <div className="tax-invoice-container">
            <div className="tax-invoice-header">
              <div className="tax-invoice-brand">
                <h2>{receiptData.supplier?.legal_name}</h2>
                <p>{receiptData.supplier?.address}</p>
                <p><strong>GSTIN:</strong> {receiptData.supplier?.gstin} | <strong>SAC:</strong> {receiptData.supplier?.sac_code}</p>
              </div>
              <div className="tax-invoice-meta">
                <h3>Tax Invoice</h3>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.8125rem' }}><strong>Invoice #:</strong> {receiptData.invoice_number}</p>
                <p style={{ margin: 0, fontSize: '0.8125rem' }}><strong>Date:</strong> {new Date(receiptData.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>Status: PAID</p>
              </div>
            </div>

            <div className="tax-invoice-entities">
              <div className="tax-invoice-entity">
                <h4>Billed To (Customer)</h4>
                <strong>{receiptData.customer?.company_name}</strong>
                <div>GSTIN: {receiptData.customer?.gstin}</div>
                <div>Email: {receiptData.customer?.email}</div>
                <div>Phone: {receiptData.customer?.phone}</div>
              </div>
              <div className="tax-invoice-entity">
                <h4>Payment Settlement</h4>
                <div><strong>Order ID:</strong> {receiptData.order_id}</div>
                <div><strong>Payment ID:</strong> {receiptData.payment_id}</div>
                <div><strong>Method:</strong> {receiptData.payment_method}</div>
              </div>
            </div>

            <table className="tax-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>SAC Code</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.line_items?.map((item: any, i: number) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td><code>{item.sac_code}</code></td>
                    <td style={{ textAlign: 'right' }}>₹{(item.net_taxable_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tax-summary-block">
              <table className="tax-summary-table">
                <tbody>
                  <tr>
                    <td>Taxable Subtotal:</td>
                    <td style={{ textAlign: 'right' }}>₹{(receiptData.tax_summary?.subtotal_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td>CGST (9%):</td>
                    <td style={{ textAlign: 'right' }}>₹{(receiptData.tax_summary?.cgst_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td>SGST (9%):</td>
                    <td style={{ textAlign: 'right' }}>₹{(receiptData.tax_summary?.sgst_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="grand-total">
                    <td>Total Amount (INR):</td>
                    <td style={{ textAlign: 'right' }}>₹{receiptData.tax_summary?.total_amount_inr}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }} className="btn-print-hide">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReceiptModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
