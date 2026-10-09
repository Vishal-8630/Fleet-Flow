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
    lr_zero_pad: 5,
    invoice_prefix: 'INV-',
    invoice_zero_pad: 5,
    settlement_prefix: 'SET-',
    settlement_zero_pad: 5,
    date_format: 'DD/MM/YYYY',
    number_system: 'indian_lakhs',
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
        lr_zero_pad: data.settings?.lr_zero_pad ?? 5,
        invoice_prefix: data.settings?.invoice_prefix || 'INV-',
        invoice_zero_pad: data.settings?.invoice_zero_pad ?? 5,
        settlement_prefix: data.settings?.settlement_prefix || 'SET-',
        settlement_zero_pad: data.settings?.settlement_zero_pad ?? 5,
        date_format: data.settings?.date_format || 'DD/MM/YYYY',
        number_system: data.settings?.number_system || 'indian_lakhs',
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
          lr_zero_pad: Number(formData.lr_zero_pad),
          invoice_prefix: formData.invoice_prefix,
          invoice_zero_pad: Number(formData.invoice_zero_pad),
          settlement_prefix: formData.settlement_prefix,
          settlement_zero_pad: Number(formData.settlement_zero_pad),
          date_format: formData.date_format,
          number_system: formData.number_system,
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
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
                Legal Business Information
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Primary identity and registered physical establishment details of your enterprise.
              </p>
            </div>

            {/* Row 1: Company Name & Official Business Email */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="name">
                  Company Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Patel Roadways Logistics"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="email">
                  Official Business Email <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-control"
                  placeholder="e.g. rohit@patellogistics.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                  required
                />
              </div>
            </div>

            {/* Row 2: Phone / Contact Number & GSTIN */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="phone">
                  Phone / Contact Number <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="gstin">
                  GSTIN (Goods and Services Tax ID)
                </label>
                <input
                  id="gstin"
                  name="gstin"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>

            {/* Row 3: Street Address */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="street">
                Registered Office Street Address
              </label>
              <input
                id="street"
                name="street"
                type="text"
                className="form-control"
                placeholder="e.g. 104, Logistics Hub, Ring Road"
                value={formData.street}
                onChange={handleChange}
                disabled={!isAdmin || isLoading}
              />
            </div>

            {/* Row 4: City, State, PIN */}
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mumbai"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="state">
                  State / Province
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Maharashtra"
                  value={formData.state}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="postal_code">
                  Postal / PIN Code
                </label>
                <input
                  id="postal_code"
                  name="postal_code"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 400001"
                  value={formData.postal_code}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
                Operational Defaults & Numbering Formats
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Standardize transactional documents, bilty numbering, currencies, and calendar displays.
              </p>
            </div>

            {/* Row 1: Operating Currency & System Timezone */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="currency">
                  Operating Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  className="form-control"
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="AED">AED (د.إ) — UAE Dirham</option>
                </select>
                <span className="form-hint">Applied across freight rates, advances, and ledger calculations.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="timezone">
                  System Timezone
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  className="form-control"
                  value={formData.timezone}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                  <option value="UTC">UTC (+0:00)</option>
                </select>
                <span className="form-hint">Used to timestamp loading receipts, logs, and system events.</span>
              </div>
            </div>

            {/* Row 2: Numbering Series & Zero-Padding */}
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="lr_prefix">
                  LR Prefix & Zero-Pad
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="lr_prefix"
                    name="lr_prefix"
                    type="text"
                    className="form-control"
                    placeholder="LR-"
                    style={{ flex: 2 }}
                    value={formData.lr_prefix}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                  <input
                    id="lr_zero_pad"
                    name="lr_zero_pad"
                    type="number"
                    min="3"
                    max="8"
                    className="form-control"
                    placeholder="5"
                    style={{ flex: 1 }}
                    value={formData.lr_zero_pad}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
                <span className="form-hint">e.g. {formData.lr_prefix}{'0'.repeat(Math.max(1, (formData.lr_zero_pad || 5) - 1))}1</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="invoice_prefix">
                  Invoice Prefix & Zero-Pad
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="invoice_prefix"
                    name="invoice_prefix"
                    type="text"
                    className="form-control"
                    placeholder="INV-"
                    style={{ flex: 2 }}
                    value={formData.invoice_prefix}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                  <input
                    id="invoice_zero_pad"
                    name="invoice_zero_pad"
                    type="number"
                    min="3"
                    max="8"
                    className="form-control"
                    placeholder="5"
                    style={{ flex: 1 }}
                    value={formData.invoice_zero_pad}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
                <span className="form-hint">e.g. {formData.invoice_prefix}{'0'.repeat(Math.max(1, (formData.invoice_zero_pad || 5) - 1))}1</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="settlement_prefix">
                  Settlement Prefix & Pad
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="settlement_prefix"
                    name="settlement_prefix"
                    type="text"
                    className="form-control"
                    placeholder="SET-"
                    style={{ flex: 2 }}
                    value={formData.settlement_prefix}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                  <input
                    id="settlement_zero_pad"
                    name="settlement_zero_pad"
                    type="number"
                    min="3"
                    max="8"
                    className="form-control"
                    placeholder="5"
                    style={{ flex: 1 }}
                    value={formData.settlement_zero_pad}
                    onChange={handleChange}
                    disabled={!isAdmin || isLoading}
                  />
                </div>
                <span className="form-hint">e.g. {formData.settlement_prefix}{'0'.repeat(Math.max(1, (formData.settlement_zero_pad || 5) - 1))}1</span>
              </div>
            </div>

            {/* Row 3: Regional Number Formatting & Date Format */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="number_system">
                  Regional Number System
                </label>
                <select
                  id="number_system"
                  name="number_system"
                  className="form-control"
                  value={formData.number_system}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                >
                  <option value="indian_lakhs">Indian Lakhs & Crores (₹1,00,000 / ₹1,00,00,000)</option>
                  <option value="international_millions">International Millions ($100,000 / $10,000,000)</option>
                </select>
                <span className="form-hint">Governs commas and digit grouping across financial ledger reports.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="date_format">
                  Display Date Format
                </label>
                <select
                  id="date_format"
                  name="date_format"
                  className="form-control"
                  value={formData.date_format}
                  onChange={handleChange}
                  disabled={!isAdmin || isLoading}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 10/10/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-10)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/10/2026)</option>
                </select>
                <span className="form-hint">Governs how dates render across tables, printouts, and reports.</span>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
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
