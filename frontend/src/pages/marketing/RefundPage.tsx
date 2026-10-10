/**
 * ============================================================================
 * REFUND & CANCELLATION POLICY PAGE (RefundPage.tsx)
 * ============================================================================
 * Statutory consumer payment disclosures for Razorpay and commercial cards:
 * 14-day trial conditions, subscription cancellation rights, and refund rules.
 * ============================================================================
 */

import React from 'react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { RefreshCw, CheckCircle, Clock, HelpCircle } from 'lucide-react';

export const RefundPage: React.FC = () => {
  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.375rem 1rem',
              borderRadius: '9999px',
              background: 'rgba(236,72,153,0.15)',
              border: '1px solid rgba(236,72,153,0.3)',
              color: '#f472b6',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            COMMERCIAL PAYMENT POLICIES
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 1rem 0' }}>
            Subscription Cancellation & Refund Policy
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', marginBottom: '3rem' }}>
            Effective Date: October 10, 2026 • Applicable to all Indian NetBanking, UPI, and Corporate Card payments.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', lineHeight: 1.7, fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)' }}>
            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <CheckCircle size={22} color="#10b981" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>1. 14-Day Free Trial Policy</h2>
              </div>
              <p style={{ margin: 0 }}>
                Every newly registered company is granted a 14-day free trial on the Standard Commercial plan. No payment information or credit card is collected during signup. If you decide not to continue, your account automatically expires at the conclusion of the 14 days without any bill or unwanted charge.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Clock size={22} color="#6366f1" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>2. One-Click Cancellation Anytime</h2>
              </div>
              <p style={{ margin: 0 }}>
                You may cancel your paid subscription at any moment by navigating to <strong>Settings → Subscription & Billing → Cancel Subscription</strong>. Upon cancellation, your workspace remains fully active until the end of the current paid billing cycle, after which it transitions to read-only archival mode.
              </p>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <RefreshCw size={22} color="#f59e0b" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>3. 7-Day Money-Back Guarantee</h2>
              </div>
              <p style={{ margin: 0 }}>
                If you are unsatisfied with Fleet Flow within 7 calendar days of your initial paid renewal or initial plan activation, you may request a 100% refund by emailing <code>billing@fleetflow.io</code>. Approved refunds are credited back to the original payment source (UPI / Bank Account / Credit Card) within 5 to 7 business days via Razorpay.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
export default RefundPage;
