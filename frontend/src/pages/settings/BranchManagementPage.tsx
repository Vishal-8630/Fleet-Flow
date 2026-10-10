/**
 * ============================================================================
 * BRANCH MANAGEMENT PAGE (BranchManagementPage.tsx)
 * ============================================================================
 * Regional branch hub directory with LR prefix, invoice prefix, and GSTIN
 * configuration. Admins can create, edit, and manage multi-location branches.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { GitBranch, Plus, Building2, MapPin, Phone, Tag } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

interface Branch {
  _id: string;
  branch_name: string;
  branch_code: string;
  city?: string;
  state?: string;
  phone?: string;
  lr_prefix: string;
  invoice_prefix: string;
  is_head_office: boolean;
  is_active: boolean;
  gstin?: string;
}

export const BranchManagementPage: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const [form, setForm] = useState({
    branch_name: '',
    branch_code: '',
    city: '',
    state: '',
    phone: '',
    lr_prefix: '',
    invoice_prefix: '',
    gstin: '',
  });

  const fetchBranches = async () => {
    try {
      const res = await api.get('/company/branches');
      setBranches(res.data.branches || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreate = async () => {
    if (!form.branch_name || !form.branch_code) {
      showToast('Branch name and code are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/company/branches', {
        ...form,
        lr_prefix: form.lr_prefix || `${form.branch_code.toUpperCase()}-LR-`,
        invoice_prefix: form.invoice_prefix || `INV-${form.branch_code.toUpperCase()}-`,
      });
      setBranches([...branches, res.data.branch]);
      setShowForm(false);
      setForm({ branch_name: '', branch_code: '', city: '', state: '', phone: '', lr_prefix: '', invoice_prefix: '', gstin: '' });
      showToast('Branch created successfully.', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to create branch.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Branches & Hubs"
        subtitle="Manage regional dispatch hubs with custom LR and invoice numbering"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-600)', color: '#fff',
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            <Plus size={16} />
            Add Regional Branch
          </button>
        }
      />

      {/* Create Form */}
      {showForm && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '1rem' }}>New Regional Branch</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { key: 'branch_name', label: 'Branch Name *', placeholder: 'e.g. Bhiwandi Central Logistics Hub' },
              { key: 'branch_code', label: 'Branch Code *', placeholder: 'e.g. BHW' },
              { key: 'city', label: 'City', placeholder: 'e.g. Bhiwandi' },
              { key: 'state', label: 'State', placeholder: 'e.g. Maharashtra' },
              { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
              { key: 'gstin', label: 'State GSTIN (optional)', placeholder: '27AAACT2727Q1ZW' },
              { key: 'lr_prefix', label: 'LR Prefix', placeholder: 'Auto-generated from code' },
              { key: 'invoice_prefix', label: 'Invoice Prefix', placeholder: 'Auto-generated from code' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</label>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleCreate}
              disabled={submitting}
              style={{ padding: '0.625rem 1.25rem', background: 'var(--color-primary-600)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
            >
              {submitting ? 'Saving...' : 'Save Branch'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: '0.625rem 1.25rem', background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading branches...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {branches.map((branch) => (
            <div
              key={branch._id}
              style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
                border: `2px solid ${branch.is_head_office ? 'var(--color-primary-300)' : 'var(--border-default)'}`,
                padding: '1.25rem',
                position: 'relative',
              }}
            >
              {branch.is_head_office && (
                <div style={{
                  position: 'absolute', top: '0.75rem', right: '0.75rem',
                  background: 'var(--color-primary-100)', color: 'var(--color-primary-700)',
                  borderRadius: 'var(--radius-full)', padding: '0.125rem 0.625rem',
                  fontSize: 'var(--font-size-xs)', fontWeight: 700,
                }}>
                  HEAD OFFICE
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{
                  background: 'var(--color-primary-100)', borderRadius: 'var(--radius-md)',
                  padding: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={20} color="var(--color-primary-600)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{branch.branch_name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Code: <strong>{branch.branch_code}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                {(branch.city || branch.state) && (
                  <div style={{ display: 'flex', gap: '0.375rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                    <MapPin size={13} />
                    <span>{[branch.city, branch.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {branch.phone && (
                  <div style={{ display: 'flex', gap: '0.375rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                    <Phone size={13} />
                    <span>{branch.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <span style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Tag size={10} /> LR: {branch.lr_prefix}
                  </span>
                  <span style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Tag size={10} /> INV: {branch.invoice_prefix}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {branches.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <GitBranch size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600 }}>No branches configured</div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                Add regional hubs to manage multi-location dispatch operations.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
