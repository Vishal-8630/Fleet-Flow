/**
 * ============================================================================
 * FLEET FLOW — INVITATION ONBOARDING PAGE (pages/auth/AcceptInvitePage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The onboarding screen for invited employees (operators, dispatchers, accountants).
 * When an admin invites a team member, an activation link with a crypto token
 * is generated (e.g., `/accept-invite?token=xyz...`).
 * 
 * FLOW:
 * -----
 * 1. Reads `token` parameter from URL query string.
 * 2. On mount: Calls `GET /api/company/invitations/verify?token=xyz`.
 *    - Valid: Displays company name, assigned role, and pre-fills email (read-only).
 *    - Expired/Invalid: Displays prominent error card with return-to-login button.
 * 3. User inputs full name, creates a password (min 6 chars), and submits.
 * 4. Submits to `POST /api/company/invitations/accept`.
 * 5. Calls `setAuth()`, storing the session in `authStore`, and redirects to `/dashboard`.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';
import { Truck, CheckCircle2, AlertCircle } from 'lucide-react';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [loadingVerify, setLoadingVerify] = useState(true);
  const [inviteData, setInviteData] = useState<{
    valid: boolean;
    email: string;
    role: string;
    company_name: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate the invitation token against backend upon component mount
  useEffect(() => {
    if (!token) {
      setVerifyError('Missing invitation token in URL.');
      setLoadingVerify(false);
      return;
    }

    api
      .get(`/company/invitations/verify?token=${token}`)
      .then((res: any) => {
        setInviteData(res.data);
        setLoadingVerify(false);
      })
      .catch((err: any) => {
        setVerifyError(err.response?.data?.error || 'Invitation is invalid or has expired.');
        setLoadingVerify(false);
      });
  }, [token]);

  // Handle invitation acceptance and account activation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast.error('Please enter and confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/company/invitations/accept', {
        token,
        name,
        password,
      });

      // Update client session store and enter workspace
      setAuth(res.data.user, res.data.company, res.data.company?.role);
      toast.success(`Welcome to ${res.data.company.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-slate-50)',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '28rem',
          width: '100%',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-light)',
          padding: '2rem',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-primary-600)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px -4px rgba(2, 132, 199, 0.3)',
              marginBottom: '1rem',
            }}
          >
            <Truck size={26} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', margin: 0 }}>
            Join Workspace
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Complete your profile to join your fleet management workspace.
          </p>
        </div>

        {/* State 1: Verifying token */}
        {loadingVerify ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                border: '3px solid var(--color-primary-200)',
                borderTopColor: 'var(--color-primary-600)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1rem',
              }}
            />
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Verifying invitation link...
            </div>
          </div>
        ) : verifyError ? (
          /* State 2: Invalid or expired token */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ color: 'var(--color-rose-600)', marginBottom: '1rem' }}>
              <AlertCircle size={44} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', marginBottom: '0.5rem' }}>
              Invalid Invitation
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {verifyError}
            </p>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          /* State 3: Valid token — Onboarding Form */
          <div>
            <div
              style={{
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-100)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
                marginBottom: '1.5rem',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-primary-900)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <CheckCircle2 size={18} color="var(--color-primary-600)" />
              <div>
                Invited to <strong>{inviteData?.company_name}</strong> as{' '}
                <strong style={{ textTransform: 'capitalize' }}>{inviteData?.role}</strong>.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={inviteData?.email || ''}
                  disabled
                  style={{ backgroundColor: 'var(--color-slate-100)' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Full Name <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Create Password <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm Password <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={submitting}
              >
                {submitting ? 'Setting up Workspace...' : 'Accept & Join Workspace'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
