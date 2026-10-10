/**
 * ============================================================================
 * EXTERNAL STAKEHOLDER PORTAL LOGIN (PortalLoginPage.tsx)
 * ============================================================================
 * Passwordless mobile OTP authentication for Shippers (Customers), Drivers,
 * and Fleet Suppliers (Vendors). Scoped strictly to their designated entity.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Smartphone, KeyRound, Truck, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

export const PortalLoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const defaultType = (searchParams.get('type') as 'customer' | 'driver' | 'vendor') || 'customer';
  const initialCompany = searchParams.get('company_id') || '';

  const [portalType, setPortalType] = useState<'customer' | 'driver' | 'vendor'>(defaultType);
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState(initialCompany);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!companyId) {
      toast.error('Company ID is required. Please check your invitation or tracking link.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/portal/send-otp', {
        portal_type: portalType,
        phone: phone.trim(),
        company_id: companyId.trim(),
      });
      setStep('otp');
      toast.success(res.data.message || 'OTP sent successfully!');
      if (res.data.dev_otp) {
        setDevOtp(res.data.dev_otp);
        setOtp(res.data.dev_otp);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/portal/verify-otp', {
        portal_type: portalType,
        phone: phone.trim(),
        company_id: companyId.trim(),
        otp: otp.trim(),
      });
      const token = res.data.token;
      localStorage.setItem('portal_token', token);
      localStorage.setItem('portal_type', portalType);
      localStorage.setItem('portal_company_id', companyId);

      toast.success('Authentication successful!');
      if (portalType === 'customer') {
        navigate('/portal/customer');
      } else if (portalType === 'driver') {
        navigate('/portal/driver');
      } else {
        navigate('/portal/vendor');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Banner */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', marginBottom: '1.25rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '0.625rem', padding: '0.5rem', display: 'flex' }}>
              <Truck size={24} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.35rem', color: '#fff' }}>Fleet Flow</span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>External Stakeholder Portal</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0 }}>
            Secure passwordless mobile verification
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Portal Type Toggle */}
          {step === 'phone' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.375rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '0.625rem', marginBottom: '1.5rem' }}>
              {(['customer', 'driver', 'vendor'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPortalType(t)}
                  style={{
                    padding: '0.5rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    background: portalType === t ? 'var(--color-primary-600, #6366f1)' : 'transparent',
                    color: portalType === t ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>
                  Registered Mobile Number *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', padding: '0 0.875rem' }}>
                  <Smartphone size={16} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', margin: '0 0.5rem' }}>+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98220 01122"
                    style={{
                      flex: 1,
                      padding: '0.625rem 0',
                      border: 'none',
                      background: 'transparent',
                      color: '#fff',
                      fontSize: '0.9375rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>
                  Company Identifier (Workspace ID) *
                </label>
                <input
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="Enter Transport Company ID"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.625rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                }}
              >
                <span>{loading ? 'Sending OTP...' : 'Send Verification OTP'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <KeyRound size={24} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>Enter 6-Digit Code</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: 0 }}>
                  Sent to +91 {phone}
                </p>
                {devOtp && (
                  <div style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: 700 }}>
                    DEV OTP: {devOtp}
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    textAlign: 'center',
                    letterSpacing: '0.5em',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.625rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                }}
              >
                <span>{loading ? 'Verifying...' : 'Access Portal'}</span>
                <UserCheck size={16} />
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Change Phone Number
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>
          Internal employee? <Link to="/login" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>Login with Password</Link>
        </div>
      </div>
    </div>
  );
};
export default PortalLoginPage;
