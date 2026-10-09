/**
 * ============================================================================
 * FLEET FLOW — COMPANY SETTINGS & OPERATIONAL DEFAULTS (CompanySettingsPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The organization preferences configuration portal for company administrators.
 * Manages:
 * 1. Business Profile: Registered name, contact email, phone, GSTIN, and physical address.
 * 2. Operational Formatting: Operating currency (INR, USD, AED), timezone (Asia/Kolkata),
 *    Lorry Receipt (LR) bill prefix, Invoice prefix, and date format.
 * 
 * RBAC SAFEGUARD:
 * ---------------
 * - If logged-in user is `admin`: Full editing capabilities and save button.
 * - If non-admin (`dispatcher`, `accountant`, `viewer`): Renders form fields in
 *   `disabled` state with a yellow alert banner explaining read-only access.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { Building2, Settings2, Save, ShieldAlert } from 'lucide-react';

export const CompanySettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<'profile' | 'operations'>('profile');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    lr_prefix: 'LR-',
    invoice_prefix: 'INV-',
    date_format: 'DD/MM/YYYY',
  });

  // Fetch company profile
  const { data, isLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      const res = await api.get('/company/profile');
      return res.data.company;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        gstin: data.gstin || '',
        street: data.address?.street || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        postal_code: data.address?.postal_code || '',
        country: data.address?.country || 'India',
        currency: data.settings?.currency || 'INR',
        timezone: data.settings?.timezone || 'Asia/Kolkata',
        lr_prefix: data.settings?.lr_prefix || 'LR-',
        invoice_prefix: data.settings?.invoice_prefix || 'INV-',
        date_format: data.settings?.date_format || 'DD/MM/YYYY',
      });
    }
  }, [data]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        gstin: formData.gstin,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country,
        },
        settings: {
          currency: formData.currency,
          timezone: formData.timezone,
          lr_prefix: formData.lr_prefix,
          invoice_prefix: formData.invoice_prefix,
          date_format: formData.date_format,
        },
      };
      const res = await api.put('/company/profile', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Company settings saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to save settings.');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only company administrators can modify company settings.');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Company Settings"
        subtitle="Configure business identifiers, tax numbers, and operational formatting."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      {!isAdmin && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--color-amber-50)',
            border: '1px solid var(--color-amber-200)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-amber-800)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: '1.5rem',
          }}
        >
          <ShieldAlert size={20} />
          <div>
            <strong>Read-Only Mode:</strong> Only users with the <strong>Admin</strong> role can modify company configurations.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            color: activeTab === 'profile' ? 'var(--color-primary-700)' : 'var(--text-muted)',
            fontWeight: activeTab === 'profile' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <Building2 size={16} />
          Business Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'operations' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            color: activeTab === 'operations' ? 'var(--color-primary-700)' : 'var(--text-muted)',
            fontWeight: activeTab === 'operations' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <Settings2 size={16} />
          Operational Formatting
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'profile' && (
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', marginBottom: '1.25rem' }}>
              Legal Business Information
            </h3>

            <div className="grid-12">
              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Company Name <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                    required
                  />
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Official Business Email <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                    required
                  />
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">
                    Phone / Contact Number <span style={{ color: 'var(--color-rose-500)' }}>*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                    required
                  />
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="gstin">
                    GSTIN (Goods and Services Tax ID)
                  </label>
                  <input
                    id="gstin"
                    name="gstin"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="street">
                    Registered Office Street Address
                  </label>
                  <input
                    id="street"
                    name="street"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 104, Logistics Hub, Ring Road"
                    value={formData.street}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-4 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    className="form-input"
                    value={formData.city}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-4 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="state">
                    State / Province
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    className="form-input"
                    value={formData.state}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-4 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="postal_code">
                    Postal / PIN Code
                  </label>
                  <input
                    id="postal_code"
                    name="postal_code"
                    type="text"
                    className="form-input"
                    value={formData.postal_code}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', marginBottom: '1.25rem' }}>
              Operational Defaults & Numbering Formats
            </h3>

            <div className="grid-12">
              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="currency">
                    Operating Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    className="form-select"
                    value={formData.currency}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  >
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="AED">AED (د.إ) — UAE Dirham</option>
                  </select>
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="timezone">
                    System Timezone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    className="form-select"
                    value={formData.timezone}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                    <option value="UTC">UTC (+0:00)</option>
                  </select>
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="lr_prefix">
                    LR (Lorry Receipt / Bilty) Prefix
                  </label>
                  <input
                    id="lr_prefix"
                    name="lr_prefix"
                    type="text"
                    className="form-input"
                    placeholder="e.g. LR-"
                    value={formData.lr_prefix}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="invoice_prefix">
                    Tax Invoice Prefix
                  </label>
                  <input
                    id="invoice_prefix"
                    name="invoice_prefix"
                    type="text"
                    className="form-input"
                    placeholder="e.g. INV-"
                    value={formData.invoice_prefix}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
              </div>

              <div className="col-span-6 col-span-md-12">
                <div className="form-group">
                  <label className="form-label" htmlFor="date_format">
                    Display Date Format
                  </label>
                  <select
                    id="date_format"
                    name="date_format"
                    className="form-select"
                    value={formData.date_format}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 09/10/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-09)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/09/2026)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateMutation.isPending || isLoading}
            >
              <Save size={16} />
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
