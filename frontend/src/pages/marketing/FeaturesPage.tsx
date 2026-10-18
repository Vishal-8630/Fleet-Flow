/**
 * ============================================================================
 * FEATURES PAGE (FeaturesPage.tsx)
 * ============================================================================
 * Structured capability catalog of the Fleet Flow platform.
 * 
 * Satisfies FF-ISSUE-004:
 * - Domain-based categorization across operational modules.
 * - Interactive category filtering allowing operators to explore specific domains.
 * - Enterprise light-mode design tokens matching dashboard styling.
 * - Factual feature representations based strictly on implemented features.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  FileText,
  CreditCard,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Smartphone,
  BookOpen,
  Layers,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

interface FeatureModule {
  category: 'fleet' | 'operations' | 'commercial' | 'financial' | 'portals';
  categoryLabel: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  desc: string;
  features: string[];
}

const MODULES: FeatureModule[] = [
  {
    category: 'fleet',
    categoryLabel: 'Fleet & Compliance',
    icon: <Truck size={26} color="var(--color-primary-600)" />,
    tag: 'ASSET REGISTRY',
    title: 'Fleet & Digital Compliance Vault',
    desc: 'Centralized registry for owned and market vehicles. Never miss an RTO fitness, national permit, road tax, or insurance renewal with automated countdown alerts.',
    features: [
      '6-document digital compliance tracking (Fitness, Tax, PUC, Insurance, Permits)',
      'Odometer-based preventative maintenance schedules and service logs',
      'Tyre lifecycle tracking across chassis axle positions',
      'Direct vehicle-to-driver binding and historical handover logs',
    ],
  },
  {
    category: 'operations',
    categoryLabel: 'Dispatch & Operations',
    icon: <MapPin size={26} color="var(--color-emerald-600)" />,
    tag: 'TRIP DISPATCH',
    title: 'Trip Management & En-Route Progress',
    desc: 'Plan, dispatch, and track single-vehicle journeys and multi-drop routes with real-time waypoint logging, enroute delay alerts, and diesel expense slips.',
    features: [
      'Multi-drop route planning with intermediate hub milestones',
      'En-route diesel consumption logging and real-world fuel economy (km/L)',
      'Driver cash advance disbursements with running balance limits',
      'Trip incident reporting (breakdowns, punctures, RTO inspections)',
    ],
  },
  {
    category: 'commercial',
    categoryLabel: 'Commercial & Invoicing',
    icon: <FileText size={26} color="var(--color-amber-600)" />,
    tag: 'CONSIGNMENT ENGINE',
    title: '3-Part Lorry Receipts (LR / Bilty) Engine',
    desc: 'Generate statutory consignment notes compliant with the Carriage by Road Act. WhatsApp instant copies to consignors, consignees, and drivers with one tap.',
    features: [
      'Standard 3-part printing (Consignor, Consignee, Driver/POD copy)',
      'Multi-package itemization (packaging type, actual vs chargeable weight, CBM volume)',
      'Port/Customs reference linkage (Bill of Entry, Container #, E-Way Bill)',
      'Commercial payment terms (To Be Billed, Paid, To Pay) with agreed freight rates',
    ],
  },
  {
    category: 'commercial',
    categoryLabel: 'Commercial & Invoicing',
    icon: <Receipt size={26} color="var(--color-primary-600)" />,
    tag: 'GST INVOICING',
    title: 'GST Freight Tax Invoicing & E-Invoicing',
    desc: 'Full Indian Goods and Services Tax compliance. Automatically segregates Reverse Charge Mechanism (RCM Section 9(3)) from Forward Charge with CGST, SGST, and IGST calculations.',
    features: [
      'Reverse Charge (RCM) vs Forward Charge dynamic tax evaluation',
      'Batch invoice generation consolidating multiple LRs onto one bill',
      'Configurable extra charges (halting, loading/unloading, toll, detention)',
      'Accounts Receivable (AR) aging matrix (0-30, 31-60, 61-90, 90+ days)',
      'One-click Tally Prime XML sales voucher export',
    ],
  },
  {
    category: 'financial',
    categoryLabel: 'Ledger & Settlements',
    icon: <CreditCard size={26} color="var(--color-purple-600)" />,
    tag: 'FINANCIAL SOUNDNESS',
    title: 'Driver Trip Settlements & Double-Entry Ledger',
    desc: 'End driver payment disputes and fuel leakage. Mathematical round-half-up precision with balanced debits and credits and automatic advance rollover accounting.',
    features: [
      'Balanced Double-Entry General Ledger (Debits = Credits invariant)',
      'Multi-document ACID transactions guarding all financial payouts',
      'Fuel variance penalty calculations comparing benchmark vs actual consumption',
      'Driver advance recovery with negative rollover balances',
    ],
  },
  {
    category: 'portals',
    categoryLabel: 'Portals & Security',
    icon: <Smartphone size={26} color="var(--color-sky-600)" />,
    tag: 'EXTERNAL ENGAGEMENT',
    title: 'Self-Service Portals for Drivers & Customers',
    desc: 'Provide external shippers, drivers, and fleet partners with secure mobile portals scoped strictly to their own data via OTP and magic-link authentication.',
    features: [
      'OTP/magic-link authentication (zero password fatigue for external users)',
      'Customer consignment tracking and one-click stamped POD downloads',
      'Driver mobile portal for digital e-POD signatures and expense uploads',
      'Strict tenant isolation ensuring zero data leakage across companies',
    ],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Capabilities' },
  { id: 'fleet', label: 'Fleet & Compliance' },
  { id: 'operations', label: 'Dispatch & Operations' },
  { id: 'commercial', label: 'Commercial & Invoicing' },
  { id: 'financial', label: 'Ledger & Settlements' },
  { id: 'portals', label: 'Portals & Security' },
];

export const FeaturesPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredModules = activeCategory === 'all'
    ? MODULES
    : MODULES.filter((m) => m.category === activeCategory);

  return (
    <PublicLayout>
      {/* Header */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          padding: '4.5rem 1.5rem 3.5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--color-primary-50)',
              border: '1px solid var(--color-primary-200)',
              borderRadius: 'var(--radius-full)',
              padding: '0.375rem 1rem',
              marginBottom: '1.25rem',
            }}
          >
            <Layers size={14} color="var(--color-primary-700)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-700)', fontWeight: 600 }}>
              End-to-End Transport Logistics Architecture
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
            }}
          >
            Capabilities Engineered for Freight Mobility
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 620,
              margin: '0 auto 2.5rem',
            }}
          >
            Explore Fleet Flow by operational domain: from roadside vehicle dispatch to audited double-entry accounting.
          </p>

          {/* Domain Category Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              backgroundColor: 'var(--color-slate-100)',
              padding: '0.375rem',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 'fit-content',
              margin: '0 auto',
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: activeCategory === cat.id ? 700 : 500,
                  color: activeCategory === cat.id ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  backgroundColor: activeCategory === cat.id ? 'var(--bg-surface)' : 'transparent',
                  boxShadow: activeCategory === cat.id ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section style={{ padding: '4.5rem 1.5rem', backgroundColor: 'var(--bg-app)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '2rem',
            }}
          >
            {filteredModules.map((mod) => (
              <div
                key={mod.title}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2.25rem',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      padding: '0.625rem',
                      backgroundColor: 'var(--color-slate-100)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                    }}
                  >
                    {mod.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--color-slate-100)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.25rem 0.625rem',
                      border: '1px solid var(--border-light)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {mod.tag}
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {mod.title}
                </h2>

                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '1.5rem',
                  }}
                >
                  {mod.desc}
                </p>

                <div
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '1.25rem',
                    marginTop: 'auto',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Key Capabilities Included
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {mod.features.map((feat) => (
                      <li
                        key={feat}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          fontSize: '0.8125rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.45,
                        }}
                      >
                        <CheckCircle2 size={15} color="var(--color-emerald-600)" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          padding: '4rem 1.5rem',
          backgroundColor: 'var(--color-slate-50)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Ready to experience these capabilities in action?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9375rem' }}>
            Set up your company workspace in under 2 minutes with a 7-day complimentary trial.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem', textDecoration: 'none' }}>
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <Link to="/pricing" className="btn btn-secondary" style={{ padding: '0.75rem 1.75rem', textDecoration: 'none' }}>
              Compare Plans
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default FeaturesPage;
