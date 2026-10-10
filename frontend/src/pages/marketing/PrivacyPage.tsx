/**
 * ============================================================================
 * PRIVACY POLICY PAGE (PrivacyPage.tsx)
 * ============================================================================
 * Enforceable statutory privacy disclosures complying with the Digital Personal
 * Data Protection (DPDP) Act 2023, Aadhaar Act, and Indian IT Rules.
 * ============================================================================
 */

import React from 'react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { ShieldCheck, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.375rem 1rem',
              borderRadius: '9999px',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            INDIAN DPDP ACT 2023 & AADHAAR COMPLIANCE
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 1rem 0' }}>
            Privacy Policy & Data Protection
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', marginBottom: '3rem' }}>
            Last Updated: October 10, 2026 • Effective for all Fleet Flow Multi-Tenant SaaS accounts.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', lineHeight: 1.7, fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)' }}>
            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <ShieldCheck size={22} color="#10b981" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>1. Introduction & Scope</h2>
              </div>
              <p style={{ margin: 0 }}>
                Fleet Flow operates as a Data Fiduciary and Processor under the Indian Digital Personal Data Protection (DPDP) Act 2023. We provide cloud infrastructure for transport enterprises, fleet managers, consignors, and drivers. This document discloses how operational freight telemetry, financial ledger records, driver identification documents, and business tax identifiers are collected, processed, and safeguarded.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Lock size={22} color="#6366f1" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>2. Biometric & Aadhaar Masking Invariants</h2>
              </div>
              <p style={{ margin: '0 0 1rem 0' }}>
                In strict compliance with Supreme Court of India directives and the Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><strong>Automated 8-Digit Masking:</strong> The platform automatically converts any 12-digit biometric Aadhaar number into masked format (<code>XXXX-XXXX-1234</code>) upon receipt.</li>
                <li><strong>Role-Based PII Visibility:</strong> Only authenticated users holding verified <code>admin</code> or <code>accountant</code> roles can access unmasked records for statutory tax filings. Viewers and dispatchers cannot inspect raw numbers.</li>
                <li><strong>Field-Level Encryption at Rest:</strong> Sensitive identity credentials and commercial driving license numbers are encrypted using AES-256-GCM cryptographic keys isolated from standard session secrets.</li>
              </ul>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Eye size={22} color="#f59e0b" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>3. Public Consignment Tracking Data Stripping</h2>
              </div>
              <p style={{ margin: 0 }}>
                When consignees or shippers track goods via public links (<code>/track/:lrNumber</code>), our zero-leakage API sanitizer guarantees that confidential commercial terms (freight rates, cash advances, carrier margins, driver phone numbers, driver Aadhaar numbers, internal dispatcher memos) are strictly stripped from the HTTP response payload before transmission.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <FileText size={22} color="#8b5cf6" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>4. Data Portability & Statutory 7-Year GST Retention</h2>
              </div>
              <p style={{ margin: 0 }}>
                Under Indian Central Goods and Services Tax (CGST) Section 36, registered taxpayers must retain books of accounts and documents for a minimum of 72 months (6 years). Fleet Flow guarantees data portability, providing one-click JSON/Excel export archives upon subscription closure, while maintaining tamper-proof financial ledger snapshots for the statutory period.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
export default PrivacyPage;
