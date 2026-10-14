/**
 * ============================================================================
 * PRICING PAGE (PricingPage.tsx)
 * ============================================================================
 * Dynamic SaaS pricing matrix backed by GET /api/billing/plans.
 * Supports monthly/annual billing toggle, live catalog quotas, modular add-ons,
 * loading skeletons, retry error states, and DEC-001 approved trial terms.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import api from '../../api/client';

interface BackendPlan {
  _id: string;
  name: string;
  code: string;
  description: string;
  monthly_price_paise: number;
  annual_price_paise: number;
  max_trucks: number;
  max_drivers: number;
  max_users: number;
  max_branches: number;
  storage_limit_mb: number;
  is_active: boolean;
  is_public: boolean;
  features?: string[];
}

interface BackendAddon {
  _id: string;
  name: string;
  code: string;
  description: string;
  monthly_price_paise: number;
  billing_type: 'flat' | 'per_truck' | 'per_user' | 'usage';
}

const DEFAULT_PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Digital Compliance Vault (15 trucks)',
    'Single & Multi-Drop Trip Dispatch',
    '3-Part Printable LR / Bilty Generation (MOD_LR_ENGINE)',
    'Standard Cash Advance & Trip Settlement',
    'GST Invoicing Engine (MOD_BILLING_INVOICE)',
    '1 Branch Office & 2 Team Seats',
    'Email Support (48h SLA)',
  ],
  standard: [
    'Everything in Starter Fleet, plus:',
    'Fleet up to 30 trucks & 35 drivers',
    '3 Branch Offices & 5 Team Seats',
    'Automated Driver Settlements & Advance Rollover',
    'Balanced Double-Entry General Ledger',
    'Accounts Receivable Aging (0-90+ days)',
    'Tally Prime XML Sales Voucher Export',
    'Customer & Consignee WhatsApp Notifications',
    'Priority Support (12h SLA)',
  ],
  pro: [
    'Everything in Standard Commercial, plus:',
    'Unlimited Fleet (Fair-Use Policy)',
    'Threshold-Based Financial Approval Workflows',
    'Driver Mobile Web App for e-POD Signatures',
    'Customer Self-Service Invoicing Portal',
    'Fleet Cost Per KM (CPK) & Tyre Lifecycle Studio',
    'Dedicated Customer Success Manager (4h SLA)',
  ],
  enterprise: [
    'Unlimited vehicles, branches & team seats',
    'Multi-Branch Enterprise Hub Hierarchy',
    'Custom ERP & SAP database integrations',
    'Direct AIS-140 GPS telematics streaming',
    'Custom E-Way Bill & E-Invoicing (IRN) GSP API',
    'Dedicated private cloud VPC deployment option',
    '24/7 Phone & WhatsApp hotline (1h SLA)',
  ],
};

const FAQS = [
  {
    q: 'How does the free trial work?',
    a: 'When you register your transport enterprise, you receive a free 7-calendar-day trial with 5 trucks, 1 branch, and 2 users (Starter-level access). No credit card is required upfront.',
  },
  {
    q: 'Are these prices GST-inclusive?',
    a: 'Yes, all displayed prices for Starter (₹1,999/mo), Standard (₹3,999/mo), and Pro (₹8,999/mo) are GST-inclusive. A compliant GST tax invoice is generated automatically for full input tax credit (ITC) claims.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Annual billing provides 12 months of service for the price of 10 months (a 16.7% discount). Starter is ₹19,990/year, Standard is ₹39,990/year, and Pro is ₹89,990/year, billed annually in advance.',
  },
  {
    q: 'Can I change plans as my fleet grows?',
    a: 'Yes. You can upgrade or change tiers directly from Settings → Subscription. Upgrades take effect immediately with pro-rated billing calculation.',
  },
  {
    q: 'What is the Pro plan Fair-Use Policy for trucks?',
    a: 'The Pro plan offers unlimited vehicles subject to normal commercial fleet operations under our approved Fair-Use Policy (FUP).',
  },
];

export const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(true);
  const [plans, setPlans] = useState<BackendPlan[]>([]);
  const [addons, setAddons] = useState<BackendAddon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/billing/plans');
      if (res.data?.plans && Array.isArray(res.data.plans)) {
        setPlans(res.data.plans);
        if (res.data.addons && Array.isArray(res.data.addons)) {
          setAddons(res.data.addons);
        }
      } else {
        throw new Error('Malformed catalog response received from server.');
      }
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      setError(err.message || 'Unable to load subscription plans at this time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.375rem 1rem',
                borderRadius: '9999px',
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#818cf8',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                marginBottom: '1rem',
              }}
            >
              TRANSPARENT COMMERCIAL PRICING • GST INCLUSIVE
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              Predictable Pricing Built for <br />
              <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Transport Operators of Any Size
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.125rem', maxWidth: 650, margin: '1.25rem auto 0', lineHeight: 1.6 }}>
              All plans include complete LR management, compliance vault, and GST invoicing. Choose the tier matching your vehicle & branch footprint.
            </p>

            {/* Billing Toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginTop: '2.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.375rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: !isAnnual ? 'var(--color-primary-600, #6366f1)' : 'transparent',
                  color: !isAnnual ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: isAnnual ? 'var(--color-primary-600, #6366f1)' : 'transparent',
                  color: isAnnual ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Annual Billing</span>
                <span style={{ fontSize: '0.6875rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.125rem 0.375rem', borderRadius: '9999px', fontWeight: 700 }}>
                  2 MONTHS FREE (SAVE 16.7%)
                </span>
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div
              style={{
                maxWidth: 600,
                margin: '0 auto 3rem auto',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', fontSize: '0.875rem' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={fetchCatalog}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#fff',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.25rem',
                    padding: '2rem 1.5rem',
                    height: 480,
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          )}

          {/* Dynamic Pricing Grid */}
          {!loading && plans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
              {plans.map((plan) => {
                const isPopular = plan.code === 'standard';
                const monthlyPrice = plan.monthly_price_paise ? plan.monthly_price_paise / 100 : null;
                const annualTotal = plan.annual_price_paise ? plan.annual_price_paise / 100 : null;
                const effectiveMonthlyPrice = annualTotal ? Math.round(annualTotal / 12) : monthlyPrice;
                const displayPrice = isAnnual ? effectiveMonthlyPrice : monthlyPrice;

                const truckLabel = plan.max_trucks === -1 ? 'Unlimited Trucks (FUP)' : `${plan.max_trucks} Trucks`;
                const branchLabel = plan.max_branches === -1 ? 'Unlimited Branches' : `${plan.max_branches} ${plan.max_branches === 1 ? 'Branch' : 'Branches'}`;
                const userLabel = plan.max_users === -1 ? 'Unlimited Seats' : `${plan.max_users} Users`;
                const features = DEFAULT_PLAN_FEATURES[plan.code] || [
                  `${truckLabel} capacity`,
                  `${branchLabel} included`,
                  `${userLabel} included`,
                  'Full core transport workflow',
                ];

                const isEnterprise = plan.code === 'enterprise';
                const ctaLink = isEnterprise
                  ? '/contact?type=enterprise'
                  : `/register?plan=${plan.code}`;
                const ctaText = isEnterprise
                  ? 'Contact Sales'
                  : 'Start 7-Day Free Trial';

                return (
                  <div
                    key={plan._id || plan.code}
                    style={{
                      background: isPopular ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                      border: isPopular ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '1.25rem',
                      padding: '2rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: isPopular ? '0 0 35px rgba(99,102,241,0.2)' : 'none',
                    }}
                  >
                    {isPopular && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                          padding: '0.25rem 0.875rem',
                          borderRadius: '9999px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          color: '#fff',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Sparkles size={12} />
                        MOST POPULAR
                      </div>
                    )}

                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#fff' }}>
                        {plan.name}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', margin: 0, minHeight: 36, lineHeight: 1.5 }}>
                        {plan.description}
                      </p>
                    </div>

                    <div style={{ margin: '1.5rem 0 1rem 0' }}>
                      {displayPrice !== null ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff' }}>
                              ₹{displayPrice.toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>/ month</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 600 }}>
                            {isAnnual
                              ? `Billed annually at ₹${(annualTotal || 0).toLocaleString('en-IN')}/yr (GST incl.)`
                              : 'Billed monthly (GST incl.)'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Custom Quote</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Tailored enterprise rollout</div>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Fleet Quota:</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{truckLabel}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Branches & Users:</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{branchLabel} • {userLabel}</span>
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.75rem' }}>
                      {features.map((feat, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)' }}>
                          <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <Link
                      to={ctaLink}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.625rem',
                        textAlign: 'center',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        background: isPopular
                          ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                          : 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        border: isPopular ? 'none' : '1px solid rgba(255,255,255,0.15)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {ctaText}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modular Add-ons */}
          <div style={{ marginTop: '5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Modular Platform Add-Ons</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', margin: 0 }}>Add specialized enterprise modules or capacity to your active plan.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {addons.length > 0 ? (
                addons.map((addon) => {
                  const priceStr = addon.monthly_price_paise
                    ? `₹${(addon.monthly_price_paise / 100).toLocaleString('en-IN')} / mo`
                    : 'Contact Sales';
                  return (
                    <div key={addon._id || addon.code} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{addon.name}</div>
                        <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9375rem' }}>{priceStr}</div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{addon.description}</p>
                    </div>
                  );
                })
              ) : (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>WhatsApp Business Gateway</div>
                      <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9375rem' }}>₹999 / mo</div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Automated dispatch alerts, consignee tracking links, and PDF LR delivery.</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>GPS Telematics Integration</div>
                      <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9375rem' }}>₹149 / truck / mo</div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Live AIS-140 GPS telematics streaming, ignition status, and geo-fencing alerts.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* FAQ Accordion */}
          <div style={{ marginTop: '5rem', maxWidth: 800, margin: '5rem auto 0' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>Frequently Asked Questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem 1.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff', marginBottom: '0.5rem' }}>{faq.q}</div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default PricingPage;

