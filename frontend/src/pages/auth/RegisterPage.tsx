/**
 * ============================================================================
 * FLEET FLOW — COMPANY REGISTRATION WIZARD (pages/auth/RegisterPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The onboarding registration screen where a transport company owner registers
 * their business.
 * 
 * FLOW:
 * -----
 * 1. Collects company name, auto-generates a clean URL slug, business email,
 *    admin full name, phone number, password, and optional GSTIN.
 * 2. Invokes `register()` in `authStore.ts` -> `POST /api/auth/register-company`.
 * 3. Backend creates the company, provisions a 14-day trial, sets the creator as
 *    Admin, sets the HttpOnly cookie, and returns the workspace session.
 * 4. Navigates directly into `/dashboard`.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Building2, Mail, Lock, User, Phone, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    slug: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    gstin: '',
  });
  const [loading, setLoading] = useState(false);
  const { register, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  /**
   * Automatically converts company name into a kebab-case slug
   * Example: "Patel Roadways Logistics" -> "patel-roadways-logistics"
   */
  const handleCompanyNameChange = (val: string) => {
    const slugified = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    setFormData((prev) => ({ ...prev, companyName: val, slug: slugified }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch {
      // Error message is stored in authStore and displayed in the alert box
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-slate-100)', padding: '2rem 1.5rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '38rem', boxShadow: 'var(--shadow-xl)', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-body" style={{ padding: '2.5rem' }}>
          {/* Header & Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-lg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
              <Truck size={30} color="#ffffff" />
            </div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
              Create Company Workspace
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Full operational access with a 14-day free trial. No credit card required.
            </p>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} color="var(--color-danger)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)', fontWeight: 'var(--font-weight-medium)' }}>
                {error}
              </span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Transport Company Name</label>
                <div className="input-icon-wrapper">
                  <Building2 size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Apex Freight Logistics"
                    value={formData.companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Workspace Identifier (URL Slug)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="apex-freight-logistics"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  required
                />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Used as your permanent unique workspace identifier.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Your Full Name</label>
                <div className="input-icon-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <div className="input-icon-wrapper">
                  <Phone size={16} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Business Email</label>
                <div className="input-icon-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="rajesh@apexlogistics.com"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Password</label>
                <div className="input-icon-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">GSTIN (Optional)</label>
                <div className="input-icon-wrapper">
                  <FileText size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gstin: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: '1.5rem', width: '100%' }}
            >
              <span>{loading ? 'Setting up Workspace...' : 'Create Workspace & Start Trial'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Login Navigation Link */}
          <div style={{ textAlign: 'center', marginTop: '1.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
            </span>
            <Link to="/login" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-600)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
