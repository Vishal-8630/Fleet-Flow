/**
 * ============================================================================
 * TERMS OF SERVICE PAGE (TermsPage.tsx)
 * ============================================================================
 * Standard SaaS agreement governing workspace usage, multi-tenancy rules,
 * Carriage by Road Act consignment responsibilities, and billing terms.
 * ============================================================================
 */

import React from 'react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { BookOpen, Shield, AlertTriangle, Scale } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
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
            ENTERPRISE SAAS MASTER SERVICE AGREEMENT
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 1rem 0' }}>
            Terms of Service
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', marginBottom: '3rem' }}>
            Effective Date: October 10, 2026 • Governed by the Laws of the Republic of India.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', lineHeight: 1.7, fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)' }}>
            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <BookOpen size={22} color="#6366f1" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>1. Service Provisioning & Multi-Tenant Isolation</h2>
              </div>
              <p style={{ margin: 0 }}>
                Fleet Flow delivers cloud-based transport management software on a multi-tenant shared infrastructure model. Each customer entity ("Company") is provisioned an isolated workspace secured by kernel-level AsyncLocalStorage and MongoDB compound indices. Cross-tenant data access, unauthorized probing, or penetration testing without explicit prior written authorization is strictly prohibited.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Scale size={22} color="#10b981" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>2. Consignment Legal Status (Carriage by Road Act)</h2>
              </div>
              <p style={{ margin: 0 }}>
                Electronic Lorry Receipts (e-LRs) generated on the platform reflect transport contracts governed by the Indian Carriage by Road Act, 2007. The Customer acknowledges that it bears sole responsibility for the commercial accuracy of declared goods, values, HSN codes, and GSTIN representations entered into LR and Invoice modules.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Shield size={22} color="#f59e0b" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>3. Subscription Entitlements & Fair Use</h2>
              </div>
              <p style={{ margin: 0 }}>
                Each tier grants specific quotas (active vehicles, driver profiles, team member logins). Operating vehicles in excess of allocated plan thresholds requires an immediate tier upgrade or purchase of Capacity Booster packs. Automated rate limiting guards platform APIs against excessive automated polling or denial-of-service abuse.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <AlertTriangle size={22} color="#ec4899" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>4. Limitation of Liability & Dispute Jurisdiction</h2>
              </div>
              <p style={{ margin: 0 }}>
                Fleet Flow shall not be held liable for physical en-route cargo loss, RTO vehicle seizures, fuel theft, or road accidents. The platform functions strictly as an operational recordkeeping and telematics coordination utility. All disputes arising under this agreement are subject to the exclusive jurisdiction of the competent courts in Mumbai, Maharashtra.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
export default TermsPage;
