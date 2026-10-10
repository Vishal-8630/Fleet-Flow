/**
 * ============================================================================
 * FLEET FLOW — USER LOGIN PAGE (pages/auth/LoginPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The primary authentication login portal for Fleet Flow workspace users.
 * 
 * FLOW:
 * -----
 * 1. Collects email and password with client-side validation.
 * 2. Invokes `login()` in `authStore.ts`, sending credentials to `POST /api/auth/login`.
 * 3. On success: Backend sets secure HttpOnly JWT cookie; frontend navigates to `/dashboard`.
 * 4. On failure: Renders error alert banner, handles brute-force lockout, and retains input state.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Lock, Mail, ArrowRight, AlertCircle, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const { login, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user was redirected due to session revocation / password change
    const expiredReason = sessionStorage.getItem('auth_expired_reason');
    if (expiredReason) {
      setSessionNotice(expiredReason);
      sessionStorage.removeItem('auth_expired_reason');
    }
  }, []);

  const isRateLimited = Boolean(
    error && (error.includes('Too many failed login attempts') || error.includes('15 minutes'))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSessionNotice(null);
    setLoading(true);
    try {
      await login({ email, password });
      const loggedUser = useAuthStore.getState().user;
      if (loggedUser?.isSuperAdmin) {
        navigate('/super-admin');
      } else {
        navigate('/dashboard');
      }
    } catch {
      // Error message is set in authStore and displayed in the alert box
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-slate-100)',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '28rem',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div className="card-body" style={{ padding: '2.5rem' }}>
          {/* Header & Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                backgroundColor: 'var(--color-primary-600)',
                borderRadius: 'var(--radius-lg)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              }}
            >
              <Truck size={30} color="#ffffff" />
            </div>
            <h2
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
              }}
            >
              Welcome back
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
              }}
            >
              Sign in to your transport company workspace
            </p>
          </div>

          {/* Session Revocation / Security Notice */}
          {sessionNotice && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d',
                padding: '0.875rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={18} color="#d97706" style={{ marginTop: '0.125rem', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: '#92400e',
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: '1.4',
                }}
              >
                {sessionNotice}
              </span>
            </div>
          )}

          {/* Error Alert Box / Rate Limit Warning */}
          {error && (
            <div
              style={{
                backgroundColor: isRateLimited ? '#fef2f2' : 'var(--color-danger-bg)',
                border: isRateLimited ? '1px solid #fecaca' : '1px solid var(--color-danger-border)',
                padding: '0.875rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              {isRateLimited ? (
                <ShieldAlert size={18} color="#dc2626" style={{ marginTop: '0.125rem', flexShrink: 0 }} />
              ) : (
                <AlertCircle size={16} color="var(--color-danger)" style={{ marginTop: '0.125rem', flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isRateLimited ? '#991b1b' : 'var(--color-danger-text)',
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: '1.4',
                }}
              >
                {isRateLimited ? (
                  <>
                    <strong>🛑 Security Lockout:</strong> {error}
                  </>
                ) : (
                  error
                )}
              </span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@transport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isRateLimited}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label">Password</label>
              <div className="input-icon-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isRateLimited}
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary-600)',
                  textDecoration: 'none',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || isRateLimited}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                opacity: isRateLimited ? 0.6 : 1,
                cursor: isRateLimited ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{loading ? 'Signing in...' : isRateLimited ? 'Sign In Locked (15m)' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Registration Navigation Link */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '1.75rem',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '1.25rem',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Starting a new transport business?{' '}
            </span>
            <Link
              to="/register"
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary-600)',
                fontWeight: 'var(--font-weight-semibold)',
                textDecoration: 'none',
              }}
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
