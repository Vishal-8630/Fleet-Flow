/**
 * ============================================================================
 * FLEET FLOW — RESET PASSWORD PAGE (pages/auth/ResetPasswordPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Self-service password completion screen.
 * Consumes the cryptographically secure reset token from the URL query params,
 * validates candidate password strength interactively, and submits to
 * `POST /api/auth/reset-password`.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Truck, Lock, Check, X, ArrowRight, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password criteria evaluations
  const criteria = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      hasUpper: /[A-Z]/.test(newPassword),
      hasLower: /[a-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
      matches: Boolean(newPassword && confirmPassword && newPassword === confirmPassword),
    };
  }, [newPassword, confirmPassword]);

  const isStrong =
    criteria.length &&
    criteria.hasUpper &&
    criteria.hasLower &&
    criteria.hasNumber &&
    criteria.hasSymbol;

  const score = [
    criteria.length,
    criteria.hasUpper,
    criteria.hasLower,
    criteria.hasNumber,
    criteria.hasSymbol,
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Missing password reset token. Please request a new recovery link.');
      return;
    }

    if (!isStrong) {
      setErrorMessage('Password must contain at least 8 characters, including uppercase, lowercase, numbers, and symbols.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. The link may have expired.');
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
          maxWidth: '30rem',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div className="card-body" style={{ padding: '2.5rem' }}>
          {/* Brand Header */}
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
              Set New Password
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
              }}
            >
              Create a secure password for your workspace account
            </p>
          </div>

          {/* Missing Token Alert */}
          {!token && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <AlertCircle size={20} color="var(--color-danger)" style={{ marginTop: '0.125rem' }} />
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-danger-text)' }}>
                  Invalid or Missing Reset Token
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)', marginTop: '0.25rem' }}>
                  This recovery link is invalid or incomplete.{' '}
                  <Link to="/forgot-password" style={{ color: 'var(--color-primary-600)', fontWeight: 'bold' }}>
                    Request a new password reset link
                  </Link>
                  .
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} color="var(--color-danger)" />
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-danger-text)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                {errorMessage}
              </span>
            </div>
          )}

          {/* Success Banner */}
          {success ? (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                textAlign: 'center',
                animation: 'fadeIn 0.3s ease-in-out',
              }}
            >
              <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 0.75rem' }} />
              <div
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: '#065f46',
                  marginBottom: '0.5rem',
                }}
              >
                Password Reset Successful!
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: '#047857' }}>
                Your password has been successfully reset! Redirecting to login...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* New Password Input */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">New Password</label>
                <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Create a strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={!token}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-muted, #f8fafc)',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.875rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  {/* Strength Bar */}
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          backgroundColor:
                            score >= lvl
                              ? isStrong
                                ? '#10b981'
                                : lvl <= 2
                                ? '#ef4444'
                                : '#f59e0b'
                              : '#e2e8f0',
                          transition: 'background-color 0.2s',
                        }}
                      />
                    ))}
                  </div>

                  {/* Strength Status Message */}
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: isStrong ? '#059669' : '#d97706',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    {isStrong ? (
                      <>
                        <span>🟢 Strong: Contains 8+ characters, uppercase, lowercase, numbers, and symbols.</span>
                      </>
                    ) : (
                      <>
                        <span>🟡 Requirements:</span>
                      </>
                    )}
                  </div>

                  {/* Checklist */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: criteria.length ? '#059669' : 'var(--text-muted)' }}>
                      {criteria.length ? <Check size={12} /> : <X size={12} />} 8+ Characters
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: criteria.hasUpper ? '#059669' : 'var(--text-muted)' }}>
                      {criteria.hasUpper ? <Check size={12} /> : <X size={12} />} Uppercase (A-Z)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: criteria.hasLower ? '#059669' : 'var(--text-muted)' }}>
                      {criteria.hasLower ? <Check size={12} /> : <X size={12} />} Lowercase (a-z)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: criteria.hasNumber ? '#059669' : 'var(--text-muted)' }}>
                      {criteria.hasNumber ? <Check size={12} /> : <X size={12} />} Number (0-9)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: criteria.hasSymbol ? '#059669' : 'var(--text-muted)', gridColumn: 'span 2' }}>
                      {criteria.hasSymbol ? <Check size={12} /> : <X size={12} />} Special symbol (!@#$%^&*)
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Password Input */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Confirm New Password</label>
                <div className="input-icon-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={!token}
                  />
                </div>
                {confirmPassword && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      marginTop: '0.25rem',
                      color: criteria.matches ? '#059669' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {criteria.matches ? <Check size={12} /> : <X size={12} />}
                    {criteria.matches ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading || !token || !isStrong || !criteria.matches}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Set New Password</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: '1.75rem',
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '1.25rem',
                }}
              >
                <Link
                  to="/login"
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-primary-600)',
                    fontWeight: 'var(--font-weight-medium)',
                    textDecoration: 'none',
                  }}
                >
                  Cancel and Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
