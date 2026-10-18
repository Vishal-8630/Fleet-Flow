/**
 * ============================================================================
 * SECURITY & TRUST PAGE (SecurityPage.tsx)
 * ============================================================================
 * Executive security overview for Fleet Flow enterprise freight platform.
 * 
 * Satisfies FF-ISSUE-007:
 * - Structured around four executive trust pillars:
 *   1. Data Protection & Encryption
 *   2. Multi-Tenant Logical Isolation
 *   3. Availability & Disaster Recovery
 *   4. Compliance & Statutory Governance
 * - Avoids raw infrastructure leakage while highlighting verified platform guarantees.
 * - Adheres to Fleet Flow enterprise design tokens and responsive layout.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import {
  ShieldCheck,
  Lock,
  Layers,
  Server,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Database,
  Building,
} from 'lucide-react';

interface SecurityPillar {
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  points: string[];
}

const SECURITY_PILLARS: SecurityPillar[] = [
  {
    title: 'Data Protection & Encryption',
    badge: 'Cryptography',
    icon: <Lock size={26} color="var(--color-primary-600)" />,
    description:
      'Rigorous end-to-end cryptographic protection safeguarding operational freight telemetry, customer credentials, and commercial ledgers.',
    points: [
      'TLS 1.3 encryption in transit with strict HTTP Strict Transport Security (HSTS).',
      'AES-256 cryptographic standards for data at rest across databases and volume stores.',
      'Salted Bcrypt password hashing and time-bounded JWT token authorization.',
      'Automated sanitization and Aadhaar masking on driver identification documents.',
    ],
  },
  {
    title: 'Multi-Tenant Logical Isolation',
    badge: 'Boundary Defense',
    icon: <Layers size={26} color="var(--color-emerald-600)" />,
    description:
      'Architectural separation ensuring absolute isolation between enterprise transport operators, consignors, and third-party vendors.',
    points: [
      'Strict company-scoped query isolation enforced at API controller and repository tiers.',
      'Granular Role-Based Access Control (RBAC) across dispatch, accounting, and fleet operations.',
      'Independent audit logging per tenant preventing cross-organization visibility.',
      'Zero inter-tenant data contamination guaranteed by software-defined query filters.',
    ],
  },
  {
    title: 'Availability & Disaster Recovery',
    badge: 'Resilience',
    icon: <Server size={26} color="var(--color-amber-600)" />,
    description:
      'High-availability cloud architecture designed to keep transport dispatches moving without operational interruptions.',
    points: [
      'Continuous health checks and automated service monitoring across critical endpoints.',
      'Automated daily database backups with point-in-time recovery and snapshot archives.',
      'Resilient database connection pooling with graceful transaction rollback guarantees.',
      'Zero data loss architecture on critical freight documents (LRs, Invoices, Settlements).',
    ],
  },
  {
    title: 'Compliance & Statutory Governance',
    badge: 'Regulatory',
    icon: <FileCheck2 size={26} color="var(--color-purple-600)" />,
    description:
      'Fully aligned with Indian transport regulations, Goods and Services Tax (GST) frameworks, and digital privacy mandates.',
    points: [
      'DPDP Act 2023 alignment with documented data fiduciary and processor workflows.',
      'Immutable statutory audit logs for Carriage by Road Act consignment notes.',
      'GST Rule compliance for Forward Charge & Reverse Charge Mechanism (RCM Section 9(3)).',
      'Exclusive cloud data residency hosted within Indian sovereign data center regions.',
    ],
  },
];

export const SecurityPage: React.FC = () => {
  return (
    <PublicLayout>
      <div style={{ background: 'var(--color-slate-50)', minHeight: '100%', padding: '3.5rem 1.5rem 5rem' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          
          {/* Hero Header */}
          <div style={{ textAlign: 'center', marginBottom: '4rem', maxWidth: 840, margin: '0 auto 4rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 1rem',
                borderRadius: '9999px',
                background: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                color: 'var(--color-primary-700)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginBottom: '1.25rem',
              }}
            >
              <ShieldCheck size={16} /> ENTERPRISE TRUST & DATA PROTECTION
            </span>
            <h1
              style={{
                fontSize: 'clamp(2.25rem, 4.5vw, 3.25rem)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.15,
                margin: '0 0 1.25rem',
                letterSpacing: '-0.025em',
              }}
            >
              Security Built for Heavy-Haul Operations
            </h1>
            <p
              style={{
                fontSize: '1.125rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Fleet Flow safeguards mission-critical dispatch operations, driver disbursements, and statutory GST records with multi-layered tenant isolation and sovereign Indian data residency.
            </p>
          </div>

          {/* 4 Security Pillars Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '1.75rem',
              marginBottom: '4rem',
            }}
          >
            {SECURITY_PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '1rem',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '0.75rem',
                      background: 'var(--color-slate-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pillar.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.625rem',
                      borderRadius: '9999px',
                      background: 'var(--color-slate-100)',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {pillar.badge}
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: '1.3125rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 0.75rem',
                  }}
                >
                  {pillar.title}
                </h2>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                    marginBottom: '1.5rem',
                  }}
                >
                  {pillar.description}
                </p>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pillar.points.map((pt, pIdx) => (
                      <li key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        <CheckCircle2 size={16} color="var(--color-emerald-600)" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Compliance & Policy Links Banner */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '1rem',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <KeyRound size={20} color="var(--color-primary-600)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Statutory Policies & Data Governance
                </h3>
              </div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Fleet Flow operates in strict adherence to Indian legal mandates. Review our binding contractual disclosures, data handling terms, and uptime commitments.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
              <Link
                to="/privacy"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.125rem',
                  borderRadius: '0.5rem',
                  background: 'var(--color-slate-100)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Privacy Policy <ArrowRight size={14} />
              </Link>
              <Link
                to="/terms"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.125rem',
                  borderRadius: '0.5rem',
                  background: 'var(--color-slate-100)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Terms of Service <ArrowRight size={14} />
              </Link>
              <Link
                to="/contact"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.125rem',
                  borderRadius: '0.5rem',
                  background: 'var(--color-primary-600)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Contact Security Officer <ArrowRight size={14} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};
