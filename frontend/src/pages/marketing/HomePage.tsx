/**
 * ============================================================================
 * HOME PAGE — MARKETING LANDING PAGE (HomePage.tsx)
 * ============================================================================
 * Modern SaaS landing page for Fleet Flow targeting Indian road transporters.
 * Features: Hero, Value Pillars, ROI Calculator, Social Proof, CTA.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import {
  Truck, Map, Receipt, FileSpreadsheet, BadgeCent, ShieldCheck, ArrowRight,
  CheckCircle, Star, Zap, TrendingUp, Users, Globe
} from 'lucide-react';

const VALUE_PILLARS = [
  {
    icon: <Receipt size={28} color="#818cf8" />,
    title: '3-Part Lorry Receipts',
    desc: 'Generate GST-compliant LRs instantly. WhatsApp PDF delivery in seconds. Print-ready consignment notes.',
    badge: 'Starter',
  },
  {
    icon: <Map size={28} color="#34d399" />,
    title: 'Live GPS Fleet Tracking',
    desc: 'AIS-140 compatible. Real-time truck positions, speed monitoring, and intelligent ETA calculation.',
    badge: 'Pro',
  },
  {
    icon: <FileSpreadsheet size={28} color="#f59e0b" />,
    title: 'GST Freight Invoicing',
    desc: 'Forward Charge & RCM invoices. E-Way Bill integration. Automatic TDS deduction ledger.',
    badge: 'Standard',
  },
  {
    icon: <BadgeCent size={28} color="#fb923c" />,
    title: 'Driver Settlement Engine',
    desc: 'End fuel leakage and advance disputes. Transparent per-trip P&L with full expense audit.',
    badge: 'Standard',
  },
  {
    icon: <ShieldCheck size={28} color="#a78bfa" />,
    title: 'Digital Compliance Vault',
    desc: 'Never miss an RTO renewal. Automated alerts for RC, Fitness, Insurance, and PUC expiry.',
    badge: 'Starter',
  },
  {
    icon: <TrendingUp size={28} color="#38bdf8" />,
    title: 'Profit Intelligence',
    desc: 'Trip-level P&L margins, AR aging analysis, customer profitability rankings, and Tally ERP sync.',
    badge: 'Pro',
  },
];

const PLAN_BADGES: Record<string, string> = {
  Starter: '#6366f1', Standard: '#10b981', Pro: '#f59e0b',
};

export const HomePage: React.FC = () => {
  const [fleetSize, setFleetSize] = useState(10);

  // Simple ROI calculator
  const hoursPerTruckPerMonth = 4; // billing hours saved
  const hourlyRate = 500; // ₹/hr
  const fuelSavingPerTruck = 3000; // ₹/month from leakage reduction
  const totalSavings = fleetSize * (hoursPerTruckPerMonth * hourlyRate + fuelSavingPerTruck);

  return (
    <PublicLayout>
      {/* ================================================================
          HERO SECTION
      ================================================================ */}
      <section style={{
        background: 'linear-gradient(135deg, #09090b 0%, #0f0f23 50%, #0c0c1e 100%)',
        padding: '6rem 1.5rem 4rem',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '999px', padding: '0.375rem 1rem', marginBottom: '1.5rem' }}>
            <Zap size={13} color="#818cf8" />
            <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>AIS-140 Compliant · GST Ready · DPDP Act Certified</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            The Modern Operating System<br />
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for Indian Fleet Operators
            </span>
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 600, margin: '0 auto 2.5rem' }}>
            Unified dispatch, consignment lorry receipts, GST billing, live GPS tracking and driver settlements. Built from the ground up for Indian road freight.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/register"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.625rem', textDecoration: 'none',
                fontWeight: 700, fontSize: '1rem', color: '#fff',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                boxShadow: '0 0 40px rgba(99,102,241,0.5)',
              }}
            >
              Start Free 14-Day Trial <ArrowRight size={18} />
            </Link>
            <Link
              to="/demo"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.625rem', textDecoration: 'none',
                fontWeight: 600, fontSize: '1rem', color: '#fff',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Book a Demo
            </Link>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {['No credit card required', '14-day free trial', 'Cancel anytime'].map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                <CheckCircle size={13} color="#34d399" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          STATS BAR
      ================================================================ */}
      <section style={{ background: 'rgba(99,102,241,0.05)', borderTop: '1px solid rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.1)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
          {[
            { value: '500+', label: 'Fleet Operators', icon: <Users size={18} color="#818cf8" /> },
            { value: '2.5L+', label: 'LRs Generated', icon: <Receipt size={18} color="#34d399" /> },
            { value: '₹120Cr+', label: 'Freight Processed', icon: <TrendingUp size={18} color="#f59e0b" /> },
            { value: '18 States', label: 'Active Across India', icon: <Globe size={18} color="#38bdf8" /> },
          ].map(({ value, label, icon }) => (
            <div key={label} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
                {icon}
                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{value}</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          VALUE PILLARS
      ================================================================ */}
      <section style={{ padding: '5rem 1.5rem', background: '#09090b' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#fff', marginBottom: '0.75rem' }}>
              Everything your transport business needs
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>
              From booking LRs to closing the books — Fleet Flow covers your entire freight operations.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {VALUE_PILLARS.map(({ icon, title, desc, badge }) => (
              <div
                key={title}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '1rem',
                  padding: '1.75rem',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.625rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.625rem', display: 'flex' }}>{icon}</div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, background: `${PLAN_BADGES[badge]}20`,
                    color: PLAN_BADGES[badge], borderRadius: '999px', padding: '0.125rem 0.5rem', border: `1px solid ${PLAN_BADGES[badge]}40`,
                  }}>
                    {badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          ROI CALCULATOR
      ================================================================ */}
      <section style={{ padding: '5rem 1.5rem', background: 'linear-gradient(135deg, #0f0a2e, #0a1628)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.75rem' }}>
            Fleet ROI Calculator
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem' }}>
            Drag the slider to see your estimated monthly savings with Fleet Flow.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Your Fleet Size</span>
                <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{fleetSize} Trucks</span>
              </div>
              <input
                type="range" min={1} max={100} value={fleetSize}
                onChange={(e) => setFleetSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                <span>1</span><span>100+</span>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(52,211,153,0.1))', borderRadius: '0.75rem', padding: '1.5rem', marginTop: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Estimated Monthly Savings</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#34d399' }}>
                ₹{totalSavings.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
                From billing automation (₹{(fleetSize * hoursPerTruckPerMonth * hourlyRate).toLocaleString('en-IN')}) + fuel leakage reduction (₹{(fleetSize * fuelSavingPerTruck).toLocaleString('en-IN')})
              </div>
            </div>

            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem',
              padding: '0.875rem 2rem', borderRadius: '0.625rem', textDecoration: 'none',
              fontWeight: 700, fontSize: '1rem', color: '#fff',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 0 30px rgba(99,102,241,0.4)',
            }}>
              Start Saving Now <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA SECTION
      ================================================================ */}
      <section style={{ padding: '5rem 1.5rem', background: '#09090b', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginBottom: '1rem' }}>
            {[1,2,3,4,5].map((s) => <Star key={s} size={18} color="#f59e0b" fill="#f59e0b" />)}
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.75rem' }}>
            Join 500+ fleet operators across India
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem', lineHeight: 1.7 }}>
            From single-truck owner-operators in Gujarat to 100-truck enterprises in Maharashtra — Fleet Flow scales with your business.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/register" style={{ padding: '0.875rem 2rem', borderRadius: '0.625rem', textDecoration: 'none', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}>
              Start Free Trial
            </Link>
            <Link to="/pricing" style={{ padding: '0.875rem 2rem', borderRadius: '0.625rem', textDecoration: 'none', fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
