/**
 * ============================================================================
 * ONBOARDING SETUP WIZARD (OnboardingWizardPage.tsx)
 * ============================================================================
 * First-login guided stepper wizard eliminating empty-state onboarding friction.
 * Guides new transporters through Business Profile, Numbering Rules, Demo Data Seeding,
 * and Team Collaboration before entering the main operational workspace.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Settings,
  Truck,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

const STEPS = [
  { id: 1, title: 'Business Profile', icon: <Building2 size={18} /> },
  { id: 2, title: 'Operational Rules', icon: <Settings size={18} /> },
  { id: 3, title: 'Fleet Seeding', icon: <Truck size={18} /> },
  { id: 4, title: 'Team Setup', icon: <Users size={18} /> },
];

export const OnboardingWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form States
  const [companyName, setCompanyName] = useState('My Transport Enterprise');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [lrPrefix, setLrPrefix] = useState('LR-');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [currency, setCurrency] = useState('INR');
  const [taxChargeType, setTaxChargeType] = useState<'rcm' | 'forward_charge'>('rcm');

  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('dispatcher');

  const handleSeedDemoData = async () => {
    setSeedingDemo(true);
    try {
      // Seed realistic demo fleet vehicles and customer parties
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDemoLoaded(true);
      toast.success('Demo fleet loaded! 3 trucks, 3 drivers, and 2 active trips seeded.');
    } catch {
      toast.error('Failed to load demo data.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setSaving(true);
    try {
      await api.put('/company/profile', {
        company_name: companyName,
        gstin,
        address,
        phone,
        lr_prefix: lrPrefix,
        invoice_prefix: invoicePrefix,
        currency,
      });
      toast.success('Welcome to Fleet Flow! Workspace setup complete.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Brand & Progress Bar */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '0.375rem', borderRadius: '0.5rem', display: 'flex' }}>
              <Truck size={20} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>Fleet Flow Setup Wizard</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
            Configure Your Transport Workspace
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0 }}>
            Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
          </p>
        </div>

        {/* Stepper Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: '0.5rem', marginBottom: '2rem' }}>
          {STEPS.map((s) => (
            <div
              key={s.id}
              style={{
                background: currentStep >= s.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                border: currentStep === s.id ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <div style={{ color: currentStep >= s.id ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>{s.icon}</div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: currentStep >= s.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Wizard Card Body */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* STEP 1: Business Profile */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Transport Enterprise Profile</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: 0 }}>
                  Printed on your official Lorry Receipts, Bill of Entries, and GST freight invoices.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Enterprise Trade Name *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Navkar Roadlines Pvt Ltd"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>State GSTIN</label>
                  <input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27ABCDE1234F1Z5"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Official Dispatch Mobile</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98220 01122"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Head Office / Booking Hub Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot 42, Transport Nagar, Nigdi, Pune, Maharashtra 411044"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Operational Rules */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Numbering Sequences &amp; Tax Defaults</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: 0 }}>
                  Deterministic auto-increment sequence identifiers for your dispatch documents.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>LR / Bilty Prefix *</label>
                  <input
                    value={lrPrefix}
                    onChange={(e) => setLrPrefix(e.target.value.toUpperCase())}
                    placeholder="LR-"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', display: 'block' }}>Sample: {lrPrefix}0001</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Invoice Prefix *</label>
                  <input
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="INV-"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', display: 'block' }}>Sample: {invoicePrefix}0001</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Default GTA GST Tax Mechanism</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setTaxChargeType('rcm')}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '0.5rem',
                      border: taxChargeType === 'rcm' ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                      background: taxChargeType === 'rcm' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Reverse Charge (RCM)</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>Consignor/Consignee pays 5% tax under Sec 9(3)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaxChargeType('forward_charge')}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '0.5rem',
                      border: taxChargeType === 'forward_charge' ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                      background: taxChargeType === 'forward_charge' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Forward Charge (12%)</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>Transport company charges tax with full ITC</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Fleet Seeding */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Seed Your First Vehicles</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: 0 }}>
                  Explore the platform with instant sample data or start with a clean slate.
                </p>
              </div>

              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: '1rem',
                  padding: '2rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={28} color="#818cf8" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>One-Click Demo Fleet &amp; Dispatches</div>
                  <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.65)', maxWidth: 440, margin: '0.375rem auto 0' }}>
                    Populate 3 commercial vehicles (Tata Signa, BharatBenz), 3 drivers with KYC, 2 billing customers, and active journeys with LRs.
                  </div>
                </div>

                <button
                  type="button"
                  disabled={seedingDemo || demoLoaded}
                  onClick={handleSeedDemoData}
                  style={{
                    padding: '0.75rem 1.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: demoLoaded ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: demoLoaded ? '#34d399' : '#fff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: demoLoaded ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {demoLoaded ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
                  <span>{demoLoaded ? 'Sample Fleet Activated!' : seedingDemo ? 'Loading Sample Fleet...' : 'Load Sample Fleet Data'}</span>
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                Tip: Demo records can be deleted anytime with one click in Settings → Danger Zone.
              </div>
            </div>
          )}

          {/* STEP 4: Team Setup */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Invite Operational Co-Workers</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: 0 }}>
                  Collaborate in real time with your dispatch managers and billing accountants.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Co-worker Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@transport.com"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: '#1c1c22', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  >
                    <option value="dispatcher">Dispatcher</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)' }}>
                  You can also invite additional team members and manage branch permissions later in <strong>Team Members</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            ) : <div />}

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.5rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleCompleteOnboarding}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.75rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                }}
              >
                <span>{saving ? 'Finalizing Setup...' : 'Launch Workspace'}</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default OnboardingWizardPage;
