/**
 * ============================================================================
 * PRICING PAGE (PricingPage.tsx)
 * ============================================================================
 * Transparent 4-tier SaaS pricing matrix with monthly/annual billing toggle,
 * quota breakdown, modular add-ons catalog, and FAQ accordion.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter Fleet',
    desc: 'For owner-operators and small fleets managing local or regional routes.',
    monthlyPrice: 1999,
    annualPrice: 1659,
    popular: false,
    truckQuota: 5,
    driverQuota: 5,
    seatQuota: 2,
    features: [
      'Digital Compliance Vault (5 trucks)',
      'Single & Multi-Drop Trip Dispatch',
      '3-Part Printable LR / Bilty Generation',
      'Standard Cash Advance & Expense Tracking',
      'Basic PDF GST Invoicing',
      'Email Support (48h SLA)',
    ],
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/register?plan=starter',
  },
  {
    id: 'standard',
    name: 'Standard Commercial',
    desc: 'For growing transport carriers operating inter-state highway corridors.',
    monthlyPrice: 4999,
    annualPrice: 4149,
    popular: true,
    truckQuota: 20,
    driverQuota: 25,
    seatQuota: 5,
    features: [
      'Everything in Starter Fleet, plus:',
      'Fleet up to 20 trucks & 25 drivers',
      'Automated Driver Settlements & Advance Rollover',
      'Balanced Double-Entry General Ledger',
      'Reverse Charge (RCM) & Forward GST Engine',
      'Accounts Receivable Aging (0-90+ days)',
      'Tally Prime XML Sales Voucher Export',
      'Customer & Consignee WhatsApp Notifications',
      'Priority Email & Chat Support (12h SLA)',
    ],
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/register?plan=standard',
  },
  {
    id: 'pro',
    name: 'Pro Enterprise',
    desc: 'For multi-branch logistics enterprises with dedicated dispatch & billing teams.',
    monthlyPrice: 9999,
    annualPrice: 8299,
    popular: false,
    truckQuota: 60,
    driverQuota: 75,
    seatQuota: 15,
    features: [
      'Everything in Standard Commercial, plus:',
      'Fleet up to 60 trucks & 75 drivers',
      'Multi-Branch & Regional Hub Management',
      'Threshold-Based Financial Approval Workflows',
      'Driver Mobile Web App for e-POD Signatures',
      'Customer Self-Service Invoicing Portal',
      'Fleet Cost Per KM (CPK) & Tyre Lifecycle Studio',
      'Dedicated Customer Success Manager (4h SLA)',
    ],
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/register?plan=pro',
  },
  {
    id: 'custom',
    name: 'Custom Enterprise',
    desc: 'For large 3PLs and corporate freight networks exceeding 100+ vehicles.',
    monthlyPrice: null,
    annualPrice: null,
    popular: false,
    truckQuota: 'Unlimited',
    driverQuota: 'Unlimited',
    seatQuota: 'Unlimited',
    features: [
      'Unlimited vehicles, drivers & team seats',
      'Custom ERP & SAP database integrations',
      'Direct AIS-140 GPS telematics streaming',
      'Custom E-Way Bill & E-Invoicing (IRN) GSP API',
      'Dedicated private cloud VPC deployment option',
      '24/7 Phone & WhatsApp hotline (1h SLA)',
    ],
    ctaText: 'Contact Sales',
    ctaLink: '/contact?type=enterprise',
  },
];

const ADDONS = [
  { name: 'WhatsApp Business Pro Pack', price: '₹999 / mo', desc: '5,000 automated milestone alerts & PDF consignment dispatches per month.' },
  { name: 'Fleet IQ Telematics Sync', price: '₹149 / truck / mo', desc: 'Live AIS-140 GPS map, corridor deviation alerts, and live speed telematics.' },
  { name: 'Additional 10 Truck Capacity Booster', price: '₹1,499 / mo', desc: 'Expand your vehicle and driver roster quota without upgrading tiers.' },
];

const FAQS = [
  {
    q: 'How does the 14-day free trial work?',
    a: 'When you register your transport enterprise, you receive instant, unrestricted access to the Standard Commercial tier for 14 days. No credit card or advance payment is required upfront.',
  },
  {
    q: 'Can I change plans as my fleet grows?',
    a: 'Yes. You can upgrade, downgrade, or add capacity boosters at any time directly from Settings → Subscription. Upgrades take effect immediately with pro-rated billing.',
  },
  {
    q: 'Is there a setup fee or contract lock-in?',
    a: 'Zero setup fees. Monthly plans can be cancelled at any time without penalty. Annual plans offer a 17% discount and are billed annually in advance.',
  },
  {
    q: 'Is GST tax included in these prices?',
    a: 'Prices are exclusive of 18% Indian GST. A compliant GST tax invoice with your company GSTIN is generated automatically for full input tax credit (ITC) claims.',
  },
];

export const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(true);

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
              TRANSPARENT COMMERCIAL PRICING
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              Predictable Pricing Built for <br />
              <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Fleets of Any Size
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.125rem', maxWidth: 600, margin: '1.25rem auto 0', lineHeight: 1.6 }}>
              Choose the tier that matches your active vehicle count. No hidden implementation charges.
            </p>

            {/* Billing Toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginTop: '2.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.375rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
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
                  SAVE 17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: plan.popular ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                  border: plan.popular ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '1.25rem',
                  padding: '2rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: plan.popular ? '0 0 35px rgba(99,102,241,0.2)' : 'none',
                }}
              >
                {plan.popular && (
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
                    {plan.desc}
                  </p>
                </div>

                <div style={{ margin: '1.5rem 0 1rem 0' }}>
                  {plan.monthlyPrice !== null ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                      <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff' }}>
                        ₹{isAnnual ? plan.annualPrice?.toLocaleString('en-IN') : plan.monthlyPrice?.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>/ month</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Custom Quote</div>
                  )}
                  {isAnnual && plan.monthlyPrice !== null && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 600 }}>
                      Billed annually (₹{((plan.annualPrice || 0) * 12).toLocaleString('en-IN')} / yr)
                    </div>
                  )}
                </div>

                <div style={{ padding: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Roster Quota</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{plan.truckQuota} Trucks • {plan.seatQuota} Seats</span>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.75rem' }}>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)' }}>
                      <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={plan.ctaLink}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.625rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    background: plan.popular
                      ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                      : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {plan.ctaText}
                </Link>
              </div>
            ))}
          </div>

          {/* Modular Add-ons */}
          <div style={{ marginTop: '5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Modular Platform Add-Ons</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', margin: 0 }}>Add specific capabilities to any active subscription tier.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {ADDONS.map((addon, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{addon.name}</div>
                    <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9375rem' }}>{addon.price}</div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{addon.desc}</p>
                </div>
              ))}
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
