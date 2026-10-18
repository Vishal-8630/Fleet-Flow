/**
 * ============================================================================
 * PRICING PAGE (PricingPage.tsx)
 * ============================================================================
 * Dynamic SaaS pricing matrix backed by GET /api/billing/plans.
 * 
 * Satisfies:
 * - FF-ISSUE-005: Enterprise light-mode card styling matching app design system.
 * - FF-ISSUE-006: Accessible interactive FAQ accordion with chevron indicators,
 *   keyboard toggling (Enter/Space), and aria-expanded state.
 * - DEC-001: Preserves canonical pricing (Starter ₹1,999, Standard ₹3,999, Pro ₹8,999)
 *   and 7-day complimentary trial terms.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, AlertCircle, RefreshCw, ChevronDown, ShieldCheck } from 'lucide-react';
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <PublicLayout>
      <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', padding: '4.5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.375rem 1rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                color: 'var(--color-primary-700)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                marginBottom: '1rem',
              }}
            >
              TRANSPARENT COMMERCIAL PRICING • GST INCLUSIVE
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15, color: 'var(--text-primary)' }}>
              Predictable Pricing Built for <br />
              <span style={{ color: 'var(--color-primary-600)' }}>
                Transport Operators of Any Size
              </span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: 650, margin: '1.25rem auto 0', lineHeight: 1.6 }}>
              All plans include complete LR management, compliance vault, and GST invoicing. Choose the tier matching your vehicle & branch footprint.
            </p>

            {/* Billing Toggle */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                maxWidth: '100%',
                gap: '0.5rem',
                marginTop: '2.5rem',
                backgroundColor: 'var(--color-slate-100)',
                padding: '0.375rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: !isAnnual ? 'var(--color-primary-600)' : 'transparent',
                  color: !isAnnual ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isAnnual ? 'var(--color-primary-600)' : 'transparent',
                  color: isAnnual ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span>Annual Billing</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: isAnnual ? 'rgba(255,255,255,0.25)' : 'var(--color-emerald-100)',
                    color: isAnnual ? '#fff' : 'var(--color-emerald-800)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  2 Months Free (16.7% off)
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '2rem',
                    height: '24rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ height: '1.5rem', width: '60%', backgroundColor: 'var(--color-slate-200)', borderRadius: 'var(--radius-sm)' }} />
                    <div style={{ height: '1rem', width: '80%', backgroundColor: 'var(--color-slate-100)', borderRadius: 'var(--radius-sm)' }} />
                    <div style={{ height: '2.5rem', width: '50%', backgroundColor: 'var(--color-slate-200)', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                  <div style={{ height: '2.5rem', width: '100%', backgroundColor: 'var(--color-slate-200)', borderRadius: 'var(--radius-md)' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                textAlign: 'center',
                maxWidth: '30rem',
                margin: '0 auto',
              }}
            >
              <AlertCircle size={32} color="var(--color-danger-text)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                Catalog Service Unavailable
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                {error}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={fetchCatalog}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
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
                      backgroundColor: 'var(--bg-surface)',
                      border: isPopular ? '2px solid var(--color-primary-600)' : '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '2.25rem 1.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: isPopular ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                    }}
                  >
                    {isPopular && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: 'var(--color-primary-600)',
                          padding: '0.25rem 0.875rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          color: '#fff',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                        }}
                      >
                        <Sparkles size={12} />
                        MOST POPULAR
                      </div>
                    )}

                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                        {plan.name}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, minHeight: 36, lineHeight: 1.5 }}>
                        {plan.description}
                      </p>
                    </div>

                    <div style={{ margin: '1.5rem 0 1rem 0' }}>
                      {displayPrice !== null ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              ₹{displayPrice.toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>/ month</span>
                          </div>
                          {isAnnual && annualTotal && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald-700)', fontWeight: 600, marginTop: '0.25rem' }}>
                              Billed annually at ₹{annualTotal.toLocaleString('en-IN')}/yr
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.5rem 0' }}>
                          Custom Quote
                        </div>
                      )}
                    </div>

                    <div style={{ margin: '1rem 0 1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                        Entitlements & Features
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {features.map((feat, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            <Check size={14} color="var(--color-emerald-600)" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      to={ctaLink}
                      className={isPopular ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'center',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                      }}
                    >
                      {ctaText}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add-ons Catalog */}
          <div style={{ marginTop: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Modular Enterprise Add-ons
            </h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9375rem', maxWidth: 500, margin: '0 auto 2.5rem' }}>
              Scale specific operational modules without jumping subscription tiers.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {addons.length > 0 ? (
                addons.map((addon) => {
                  const priceStr = addon.monthly_price_paise
                    ? `₹${(addon.monthly_price_paise / 100).toLocaleString('en-IN')} / mo`
                    : 'Contact Sales';
                  return (
                    <div
                      key={addon._id || addon.code}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>{addon.name}</div>
                        <div style={{ fontWeight: 800, color: 'var(--color-primary-600)', fontSize: '0.9375rem' }}>{priceStr}</div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{addon.description}</p>
                    </div>
                  );
                })
              ) : (
                <>
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>WhatsApp Business Gateway</div>
                      <div style={{ fontWeight: 800, color: 'var(--color-primary-600)', fontSize: '0.9375rem' }}>₹999 / mo</div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Automated dispatch alerts, consignee tracking links, and PDF LR delivery.
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>GPS Telematics Integration</div>
                      <div style={{ fontWeight: 800, color: 'var(--color-primary-600)', fontSize: '0.9375rem' }}>₹149 / truck / mo</div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Live AIS-140 GPS telematics streaming, ignition status, and geo-fencing alerts.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* FAQ Accordion (FF-ISSUE-006) */}
          <div style={{ marginTop: '5rem', maxWidth: 800, margin: '5rem auto 0' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', marginBottom: '2rem', color: 'var(--text-primary)' }}>
              Frequently Asked Questions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {FAQS.map((faq, i) => {
                const isOpen = openFaqIndex === i;
                return (
                  <div
                    key={i}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFaq(i);
                        }
                      }}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${i}`}
                      id={`faq-question-${i}`}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1.25rem 1.5rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {faq.q}
                      </span>
                      <ChevronDown
                        size={18}
                        color="var(--text-muted)"
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform var(--transition-fast)',
                          flexShrink: 0,
                          marginLeft: '1rem',
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-answer-${i}`}
                        role="region"
                        aria-labelledby={`faq-question-${i}`}
                        style={{
                          padding: '0 1.5rem 1.25rem',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                        }}
                      >
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default PricingPage;
