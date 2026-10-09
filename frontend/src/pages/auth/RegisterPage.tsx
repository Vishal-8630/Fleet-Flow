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
      // Error in authStore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-slate-100)', padding: '2rem 1.5rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '38rem', boxShadow: 'var(--shadow-xl)', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-body" style={{ padding: '2.5rem' }}>
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

          {error && (
            <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} color="var(--color-danger)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)', fontWeight: 'var(--font-weight-medium)' }}>
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              1. Transport Business Profile
            </div>

            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Transport / Fleet Name</label>
                <div className="input-icon-wrapper">
                  <Building2 size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Apex Roadlines Pvt Ltd"
                    value={formData.companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Workspace Identifier</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="apex-roadlines"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN (Optional)</label>
              <div className="input-icon-wrapper">
                <FileText size={16} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="27AABCU9603R1ZM"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.75rem 0' }}>
              2. Administrator Account
            </div>

            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-icon-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Rajesh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="input-icon-wrapper">
                  <Phone size={16} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="rajesh@apexroadlines.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-icon-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem', padding: '0.875rem' }}
              disabled={loading}
            >
              {loading ? 'Setting Up Workspace...' : 'Launch Company Workspace'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            Already have an active workspace?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary-600)', fontWeight: 'var(--font-weight-semibold)' }}>
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
