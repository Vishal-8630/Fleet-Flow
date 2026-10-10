/**
 * ============================================================================
 * FEATURES PAGE (FeaturesPage.tsx)
 * ============================================================================
 * Comprehensive capability catalog of the Fleet Flow platform for prospective
 * fleet operators, logistics companies, and corporate supply chain directors.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  FileText,
  CreditCard,
  ShieldCheck,
  MapPin,
  Users,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Receipt,
  Smartphone,
  Building2,
  Lock,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

const MODULES = [
  {
    icon: <Truck size={28} color="#6366f1" />,
    tag: 'ASSET ENGINEERING',
    title: 'Fleet & Digital Compliance Vault',
    desc: 'Centralized registry for owned and market vehicles. Never miss an RTO fitness, national permit, road tax, or insurance renewal with automated countdown alerts.',
    features: [
      '6-document digital compliance tracking (Fitness, Tax, PUC, Insurance, Permits)',
      'Odometer-based preventative maintenance schedules',
      'Tyre lifecycle tracking across 10 chassis axle positions',
      'Direct vehicle-to-driver binding and historical handover logs',
    ],
  },
  {
    icon: <MapPin size={28} color="#10b981" />,
    tag: 'OPERATIONS & DISPATCH',
    title: 'Trip Management & En-Route Progress',
    desc: 'Plan, dispatch, and track single-vehicle journeys and multi-drop routes with real-time waypoint logging, enroute delay alerts, and diesel expense slips.',
    features: [
      'Multi-drop route planning with intermediate hub milestones',
      'En-route diesel consumption logging and real-world fuel economy (km/L)',
      'Driver cash advance disbursements with ledger balance limits',
      'Trip incident reporting (breakdowns, punctures, RTO inspections)',
    ],
  },
  {
    icon: <FileText size={28} color="#f59e0b" />,
    tag: 'LEGAL CONSIGNMENT',
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
    icon: <Receipt size={28} color="#8b5cf6" />,
    tag: 'FINANCIAL ACCURACY',
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
    icon: <CreditCard size={28} color="#ec4899" />,
    tag: 'ACCOUNTING SOUNDNESS',
    title: 'Driver Trip Settlements & Double-Entry Ledger',
    desc: 'End driver payment disputes and fuel leakage. Mathematical round-half-up precision with balanced debits and credits and automatic advance rollover accounting.',
    features: [
      'Balanced Double-Entry General Ledger (Debits = Credits invariant)',
      'Multi-document ACID transactions guarding all financial payouts',
      'Fuel variance penalty calculations comparing budgeted vs actual litres',
      'Driver advance recovery with negative rollover balances',
    ],
  },
  {
    icon: <Smartphone size={28} color="#06b6d4" />,
    tag: 'EXTERNAL ENGAGEMENT',
    title: 'Self-Service Portals for Drivers & Customers',
    desc: 'Eliminate WhatsApp status inquiries. Provide external shippers, drivers, and fleet brokers with secure mobile portals scoped strictly to their own data.',
    features: [
      'OTP/magic-link authentication (zero password fatigue for external users)',
      'Customer consignment tracking and one-click stamped POD downloads',
      'Driver mobile app for digital e-POD signatures and expense uploads',
      'Market supplier payables and TDS deduction statements',
    ],
  },
];

export const FeaturesPage: React.FC = () => {
  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
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
              COMPLETE SAAS PLATFORM
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              Engineered Specifically for <br />
              <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Indian Road Transport
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.125rem', maxWidth: 680, margin: '1.25rem auto 0', lineHeight: 1.6 }}>
              Every feature was designed from the ground up to solve the real operational challenges faced by fleet owners, dispatchers, and commercial accountants across India.
            </p>
          </div>

          {/* Module Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
            {MODULES.map((mod, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '1rem',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {mod.icon}
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em' }}>
                    {mod.tag}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#fff' }}>
                    {mod.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>
                    {mod.desc}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {mod.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)' }}>
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA Banner */}
          <div
            style={{
              marginTop: '5rem',
              borderRadius: '1.5rem',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.15))',
              border: '1px solid rgba(99,102,241,0.3)',
              padding: '3.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Ready to Modernize Your Fleet Operations?</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', maxWidth: 540, margin: '1rem auto 2rem' }}>
              Start with our 14-day free trial on the Standard Commercial plan. No credit card required. Cancel anytime.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Link
                to="/register"
                style={{
                  padding: '0.875rem 2rem',
                  borderRadius: '0.625rem',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 0 25px rgba(99,102,241,0.4)',
                }}
              >
                <span>Start Free 14-Day Trial</span>
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/contact"
                style={{
                  padding: '0.875rem 2rem',
                  borderRadius: '0.625rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
export default FeaturesPage;
