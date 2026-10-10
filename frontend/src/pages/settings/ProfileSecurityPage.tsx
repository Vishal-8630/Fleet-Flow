/**
 * ============================================================================
 * FLEET FLOW — USER PROFILE & SECURITY (pages/settings/ProfileSecurityPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * User account settings and security management portal.
 * Features:
 * 1. Personal Identity & Active Workspace Membership Details.
 * 2. Security & Password Update:
 *    - Validates current password.
 *    - Enforces strict password complexity with visual strength meter.
 *    - Submits to `POST /api/auth/change-password`.
 *    - Triggers global session invalidation across other devices via `token_version`.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';
import { api } from '../../api/client';
import {
  User,
  Shield,
  Lock,
  Save,
  Check,
  X,
  Mail,
  Building,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const ProfileSecurityPage: React.FC = () => {
  const { user, company, role } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Criteria for new password
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!currentPassword) {
      setErrorBanner('Please enter your current password.');
      return;
    }

    if (!isStrong) {
      setErrorBanner(
        'New password must contain at least 8 characters, including uppercase, lowercase, numbers, and symbols.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorBanner('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      toast.success(
        res.data.message ||
          'Password updated successfully. Other active device sessions have been revoked.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.message || 'Failed to update password.';
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '56rem', margin: '0 auto' }}>
      <PageHeader
        title="Profile & Security"
        subtitle="Manage your personal user account identity and authentication credentials"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* User Identity Overview Card */}
        <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div
            className="card-header"
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <Shield size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
              Account Profile
            </h3>
          </div>
          <div className="card-body" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Full Name
                </label>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                  {user?.name || '—'}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Email Address
                </label>
                <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Mail size={14} color="var(--text-muted)" />
                  <span>{user?.email || '—'}</span>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Active Workspace
                </label>
                <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Building size={14} color="var(--text-muted)" />
                  <span>{company?.name || 'Personal Workspace'}</span>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Workspace Role
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '11px' }}>
                    {user?.isSuperAdmin ? 'Super-Admin' : role || 'Member'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Password Card */}
        <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div
            className="card-header"
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <KeyRound size={20} color="var(--color-primary-600)" />
              <div>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
                  Security & Password
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>
                  Changing your password invalidates all other active sessions across browsers and devices.
                </p>
              </div>
            </div>
          </div>

          <div className="card-body" style={{ padding: '1.5rem' }}>
            {errorBanner && (
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
                  {errorBanner}
                </span>
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div style={{ maxWidth: '32rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Current Password */}
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
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
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter a strong new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
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
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    }}
                  >
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

                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: isStrong ? '#059669' : '#d97706',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {isStrong ? (
                        <span>🟢 Strong: Contains 8+ characters, uppercase, lowercase, numbers, and symbols.</span>
                      ) : (
                        <span>🟡 Requirements:</span>
                      )}
                    </div>

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

                {/* Confirm New Password */}
                <div className="form-group">
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
                <div style={{ paddingTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      loading ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      !isStrong ||
                      !criteria.matches
                    }
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSecurityPage;
