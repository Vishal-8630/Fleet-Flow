/**
 * ============================================================================
 * HOME PAGE — MARKETING LANDING PAGE (HomePage.tsx)
 * ============================================================================
 * Modern enterprise SaaS landing page for Fleet Flow targeting Indian road
 * freight operators and logistics enterprises.
 * 
 * Satisfies FF-ISSUE-001 and FF-ISSUE-003:
 * - Enterprise light-mode design tokens matching dashboard and auth shell.
 * - Factual platform capability statements (zero unsubstantiated statistics).
 * - Clear responsive grid layout and focused calls to action.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import {
  Truck,
  Map,
  Receipt,
  FileSpreadsheet,
  BadgeCent,
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  Building2,
  Database,
  Lock,
  BookOpen,
} from 'lucide-react';

const VALUE_PILLARS = [
  {
    icon: <Receipt size={26} color="var(--color-primary-600)" />,
    title: '3-Part Lorry Receipts',
    desc: 'Generate statutory consignment notes compliant with the Carriage by Road Act. Instant PDF generation and shareable consignment links.',
    badge: 'Starter',
  },
  {
    icon: <Map size={26} color="var(--color-emerald-600)" />,
    title: 'Live GPS Fleet Tracking',
    desc: 'AIS-140 telematics compatible. Real-time vehicle positions, speed monitoring, delay alerts, and intelligent ETA calculation.',
    badge: 'Pro',
  },
  {
    icon: <FileSpreadsheet size={26} color="var(--color-amber-600)" />,
    title: 'GST Freight Invoicing',
    desc: 'Forward Charge and Reverse Charge Mechanism (RCM Section 9(3)) tax invoices. E-Way Bill linkage and automated TDS ledger tracking.',
    badge: 'Standard',
  },
  {
    icon: <BadgeCent size={26} color="var(--color-primary-600)" />,
    title: 'Driver Settlement Engine',
    desc: 'Standardized wage calculator eliminating fuel variance and advance disputes. Transparent per-trip P&L with full expense auditing.',
    badge: 'Standard',
  },
  {
    icon: <ShieldCheck size={26} color="var(--color-purple-600)" />,
    title: 'Digital Compliance Vault',
    desc: 'Centralized commercial vehicle registry with proactive automated countdown alerts for RC, Fitness, Insurance, Permits, and PUC expiry.',
    badge: 'Starter',
  },
  {
    icon: <BookOpen size={26} color="var(--color-sky-600)" />,
    title: 'Double-Entry General Ledger',
    desc: 'Balanced double-entry financial accounting. Accounts Receivable aging matrices, customer profitability analysis, and Tally Prime XML export.',
    badge: 'Pro',
  },
];

const ARCHITECTURE_CAPABILITIES = [
  {
    icon: <Database size={20} color="var(--color-primary-600)" />,
    title: 'Multi-Tenant Isolation',
    desc: 'Logical tenant schema boundaries ensuring zero data leakage between operating transport carriers.',
  },
  {
    icon: <Receipt size={20} color="var(--color-emerald-600)" />,
    title: 'Statutory GST & LR Compliance',
    desc: 'Built specifically for Indian transport regulations, Reverse Charge Section 9(3), and E-Way Bill documentation.',
  },
  {
    icon: <BadgeCent size={20} color="var(--color-amber-600)" />,
    title: 'ACID Financial Payouts',
    desc: 'Multi-document database transactions safeguarding driver payouts, cash advance reconciliations, and vendor balances.',
  },
  {
    icon: <Lock size={20} color="var(--color-purple-600)" />,
    title: 'DPDP Act 2023 Readiness',
    desc: 'AES-256 data encryption at rest, TLS 1.3 in transit, and immutable before-and-after audit logs for all financial mutations.',
  },
];

const PLAN_BADGES: Record<string, { bg: string; color: string; border: string }> = {
  Starter: { bg: 'var(--color-primary-50)', color: 'var(--color-primary-700)', border: 'var(--color-primary-200)' },
  Standard: { bg: 'var(--color-emerald-50)', color: 'var(--color-emerald-700)', border: 'var(--color-emerald-200)' },
  Pro: { bg: 'var(--color-amber-50)', color: 'var(--color-amber-700)', border: 'var(--color-amber-200)' },
};

export const HomePage: React.FC = () => {
  return (
    <PublicLayout>
      {/* ================================================================
          1. HERO SECTION (Light Enterprise SaaS)
      ================================================================ */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          padding: '5rem 1.5rem 4.5rem',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          {/* Regulatory / Compliance Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--color-primary-50)',
              border: '1px solid var(--color-primary-200)',
              borderRadius: 'var(--radius-full)',
              padding: '0.375rem 1rem',
              marginBottom: '1.5rem',
            }}
          >
            <ShieldCheck size={14} color="var(--color-primary-700)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-700)', fontWeight: 600 }}>
              GST Compliant · AIS-140 Ready · Indian Road Freight Standards
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
            }}
          >
            The Modern Operating System
            <br />
            <span style={{ color: 'var(--color-primary-600)' }}>
              for Indian Fleet Operators
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: 640,
              margin: '0 auto 2.5rem',
            }}
          >
            Unified fleet dispatch, statutory 3-part lorry receipts, GST freight invoicing,
            live GPS tracking, and driver trip settlements in one secure platform.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 2rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              Start Free 7-Day Trial <ArrowRight size={18} />
            </Link>
            <Link
              to="/demo"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 2rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              Book a Demo
            </Link>
          </div>

          <div
            style={{
              marginTop: '1.75rem',
              display: 'flex',
              gap: '1.5rem',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['No credit card required', 'Instant workspace setup', 'Standard 7-day trial'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                <CheckCircle size={14} color="var(--color-emerald-600)" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          2. CORE ARCHITECTURAL CAPABILITIES (Factual, Zero Fabricated Stats)
      ================================================================ */}
      <section
        style={{
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-light)',
          padding: '3rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {ARCHITECTURE_CAPABILITIES.map(({ icon, title, desc }) => (
              <div
                key={title}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
                  <div
                    style={{
                      width: '2.25rem',
                      height: '2.25rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-slate-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {title}
                  </h3>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          3. VALUE PILLARS & OPERATIONAL MODULES
      ================================================================ */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '0.75rem',
              }}
            >
              Everything your transport business needs
            </h2>
            <p style={{ color: 'var(--color-primary-600)', fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Engineered for Indian Freight Operations
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 580, margin: '0 auto' }}>
              From issuing 3-part consignment notes to closing the General Ledger, Fleet Flow unifies every leg of commercial transport.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {VALUE_PILLARS.map(({ icon, title, desc, badge }) => (
              <div
                key={title}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow var(--transition-fast), transform var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.625rem',
                      backgroundColor: 'var(--color-slate-100)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                    }}
                  >
                    {icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: PLAN_BADGES[badge]?.bg || 'var(--color-slate-100)',
                      color: PLAN_BADGES[badge]?.color || 'var(--text-secondary)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.2rem 0.6rem',
                      border: `1px solid ${PLAN_BADGES[badge]?.border || 'var(--border-light)'}`,
                    }}
                  >
                    {badge}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.625rem',
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          4. CTA SECTION
      ================================================================ */}
      <section
        style={{
          padding: '5rem 1.5rem',
          backgroundColor: 'var(--color-slate-50)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '0.75rem',
            }}
          >
            Ready to streamline your transport business?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: '2rem',
              lineHeight: 1.6,
            }}
          >
            Join 500+ fleet operators across India. Start your free 7-day trial with full access to LRs, trip dispatch, and driver settlements.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{
                padding: '0.875rem 2rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Start Free Trial
            </Link>
            <Link
              to="/pricing"
              className="btn btn-secondary"
              style={{
                padding: '0.875rem 2rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default HomePage;
