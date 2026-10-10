/**
 * ============================================================================
 * FLEET FLOW — FORGOT PASSWORD PAGE (pages/auth/ForgotPasswordPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Self-service password recovery initiation screen.
 * Allows users to submit their registered email to receive a single-use
 * 15-minute cryptographically secure recovery link.
 * 
 * SECURITY BEST PRACTICES:
 * ------------------------
 * - Zero User Enumeration: Displays the identical affirmative message whether
 *   the email exists in the database or not.
 * - Tiered Rate Limiting: Protected against brute-force spamming.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data?.dev_reset_url) {
        setDevResetUrl(res.data.dev_reset_url);
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to submit recovery request. Please try again.');
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
              Recover Account
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
              }}
            >
              Enter your registered workspace email address
            </p>
          </div>

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

          {submitted ? (
            /* Success Confirmation Box */
            <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-in-out' }}>
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <CheckCircle2 size={32} color="#059669" />
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: '#065f46',
                    lineHeight: '1.5',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  ✉️ If an active workspace account exists with this email address, a password recovery link
                  has been dispatched. Please check your inbox or spam folder.
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: '#047857' }}>
                  The single-use recovery link remains valid for <strong>15 minutes</strong>.
                </div>

                {devResetUrl && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.875rem',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#1d4ed8',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        marginBottom: '0.25rem',
                      }}
                    >
                      🛠️ Development Quick Link (No SMTP Configured)
                    </div>
                    <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                      In local development without SMTP, emails are printed to the terminal console. You can also click below directly:
                    </div>
                    <a
                      href={devResetUrl}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '12px',
                        color: '#2563eb',
                        fontWeight: '600',
                        textDecoration: 'underline',
                      }}
                    >
                      Open Password Reset Screen &rarr;
                    </a>
                  </div>
                )}
              </div>

              <Link
                to="/login"
                className="btn btn-outline btn-block"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Sign In</span>
              </Link>
            </div>
          ) : (
            /* Forgot Password Request Form */
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@transport.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading || !email}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending Recovery Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery Link</span>
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
