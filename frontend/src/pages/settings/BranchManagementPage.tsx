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
import { Modal } from '../../components/common/Modal';
import { GitBranch, Plus, Building2, MapPin, Phone, Tag, X, Search, Pencil, Power, Trash2, AlertTriangle, FileText } from 'lucide-react';
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Edit branch state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState({
    branch_name: '',
    branch_code: '',
    city: '',
    state: '',
    phone: '',
    lr_prefix: '',
    invoice_prefix: '',
    gstin: '',
    is_head_office: false,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const initialFormState = {
    branch_name: '',
    branch_code: '',
    city: '',
    state: '',
    phone: '',
    lr_prefix: '',
    invoice_prefix: '',
    gstin: '',
    is_head_office: false,
  };

  const [form, setForm] = useState(initialFormState);

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
    const trimmedName = form.branch_name.trim();
    const trimmedCode = form.branch_code.trim().toUpperCase();

    if (!trimmedName || !trimmedCode) {
      showToast('Branch name and code are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/company/branches', {
        ...form,
        branch_name: trimmedName,
        branch_code: trimmedCode,
        lr_prefix: form.lr_prefix.trim() || `${trimmedCode}-LR-`,
        invoice_prefix: form.invoice_prefix.trim() || `INV-${trimmedCode}-`,
      });
      setBranches([...branches, res.data.branch]);
      setShowForm(false);
      setForm(initialFormState);
      showToast('Branch created successfully.', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to create branch.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setEditForm({
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      city: branch.city || '',
      state: branch.state || '',
      phone: branch.phone || '',
      lr_prefix: branch.lr_prefix,
      invoice_prefix: branch.invoice_prefix,
      gstin: branch.gstin || '',
      is_head_office: branch.is_head_office,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBranch) return;
    const trimmedName = editForm.branch_name.trim();
    const trimmedCode = editForm.branch_code.trim().toUpperCase();

    if (!trimmedName || !trimmedCode) {
      showToast('Branch name and code are required.', 'error');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await api.put(`/company/branches/${editingBranch._id}`, {
        ...editForm,
        branch_name: trimmedName,
        branch_code: trimmedCode,
        lr_prefix: editForm.lr_prefix.trim() || `${trimmedCode}-LR-`,
        invoice_prefix: editForm.invoice_prefix.trim() || `INV-${trimmedCode}-`,
      });
      const updated = res.data.branch;
      setBranches(
        branches.map((b) => {
          if (b._id === updated._id) return updated;
          if (updated.is_head_office && b.is_head_office) {
            return { ...b, is_head_office: false };
          }
          return b;
        })
      );
      setEditingBranch(null);
      showToast('Branch updated successfully.', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to update branch.', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async (branch: Branch) => {
    if (branch.is_head_office && branch.is_active) {
      showToast('Cannot deactivate the head office branch.', 'error');
      return;
    }
    const nextStatus = !branch.is_active;
    try {
      const res = await api.put(`/company/branches/${branch._id}`, {
        is_active: nextStatus,
      });
      const updated = res.data.branch;
      setBranches(branches.map((b) => (b._id === branch._id ? updated : b)));
      showToast(`Branch ${nextStatus ? 'activated' : 'deactivated'} successfully.`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error || `Failed to ${nextStatus ? 'activate' : 'deactivate'} branch.`, 'error');
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    setDeleteSubmitting(true);
    setDeleteErrorMessage(null);
    try {
      await api.delete(`/company/branches/${deletingBranch._id}`);
      setBranches(branches.filter((b) => b._id !== deletingBranch._id));
      setDeletingBranch(null);
      showToast('Branch deleted successfully.', 'success');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const errMsg =
          e.response.data?.error ||
          `Cannot delete branch '${deletingBranch.branch_name}' because operational records reference it. Deactivate the branch instead to preserve historical integrity.`;
        setDeleteErrorMessage(errMsg);
      } else {
        showToast(e?.response?.data?.error || 'Failed to delete branch.', 'error');
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredBranches = branches.filter((branch) => {
    if (statusFilter === 'active' && !branch.is_active) return false;
    if (statusFilter === 'inactive' && branch.is_active) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = branch.branch_name?.toLowerCase().includes(q);
      const codeMatch = branch.branch_code?.toLowerCase().includes(q);
      const cityMatch = branch.city?.toLowerCase().includes(q);
      const stateMatch = branch.state?.toLowerCase().includes(q);
      return nameMatch || codeMatch || cityMatch || stateMatch;
    }
    return true;
  });

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

      {/* Create Form Container (Bounded & Centered per FF-ISSUE-051) */}
      {showForm && (
        <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%' }}>
          <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-light)' }}>
            <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={20} color="var(--color-primary-600)" />
                  <h3 className="card-title" style={{ fontSize: '1.125rem', fontWeight: 700 }}>New Regional Branch</h3>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Configure a regional operational hub with custom LR/invoice numbering and dispatch identity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-slate-400)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close Form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
              <div className="card-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Section 1: Branch Identification */}
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Building2 size={14} /> Branch Identification
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_name">Branch Name *</label>
                      <input
                        id="branch_name"
                        className="form-control"
                        value={form.branch_name}
                        onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                        placeholder="e.g. Bhiwandi Central Logistics Hub"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_code">Branch Code *</label>
                      <input
                        id="branch_code"
                        className="form-control"
                        value={form.branch_code}
                        onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
                        placeholder="e.g. BHW"
                        maxLength={10}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        required
                      />
                      <span className="form-hint">Unique 2-6 character identifier</span>
                    </div>
                  </div>

                  {/* Head Office designation checkbox */}
                  <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="is_head_office"
                      checked={form.is_head_office}
                      onChange={(e) => setForm({ ...form, is_head_office: e.target.checked })}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--color-primary-600)' }}
                    />
                    <label htmlFor="is_head_office" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                      Designate as Primary Head Office for this workspace
                    </label>
                  </div>
                </div>

                {/* Section 2: Physical Location & Contact */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <MapPin size={14} /> Physical Location & Contact
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_city">City</label>
                      <input
                        id="branch_city"
                        className="form-control"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="e.g. Bhiwandi"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_state">State</label>
                      <input
                        id="branch_state"
                        className="form-control"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        placeholder="e.g. Maharashtra"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_phone">Phone</label>
                      <input
                        id="branch_phone"
                        className="form-control"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="branch_gstin">State GSTIN (Optional)</label>
                      <input
                        id="branch_gstin"
                        className="form-control"
                        value={form.gstin}
                        onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                        placeholder="27AAACT2727Q1ZW"
                        maxLength={15}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <span className="form-hint">State GSTIN for branch-specific tax invoices</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Document Sequence Numbering Configuration (DEC-010) */}
                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Tag size={14} /> Document Numbering Prefixes
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="lr_prefix">LR / Bilty Prefix</label>
                      <input
                        id="lr_prefix"
                        className="form-control"
                        value={form.lr_prefix}
                        onChange={(e) => setForm({ ...form, lr_prefix: e.target.value.toUpperCase() })}
                        placeholder={form.branch_code ? `${form.branch_code.toUpperCase()}-LR-` : 'e.g. BHW-LR-'}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <span className="form-hint">
                        Default: {form.branch_code ? `${form.branch_code.toUpperCase()}-LR-` : 'BRANCH-LR-'} (followed by 4-digit sequence)
                      </span>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" htmlFor="invoice_prefix">Invoice Prefix</label>
                      <input
                        id="invoice_prefix"
                        className="form-control"
                        value={form.invoice_prefix}
                        onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value.toUpperCase() })}
                        placeholder={form.branch_code ? `INV-${form.branch_code.toUpperCase()}-` : 'e.g. INV-BHW-'}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <span className="form-hint">
                        Default: {form.branch_code ? `INV-${form.branch_code.toUpperCase()}-` : 'INV-BRANCH-'} (followed by 4-digit sequence)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer: Right-aligned Save/Cancel Actions */}
              <div className="card-footer" style={{ padding: '1rem 1.5rem', background: 'var(--color-slate-50)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving Branch...' : 'Save Regional Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="search-input-wrapper" style={{ maxWidth: '360px', minWidth: '240px', flex: 1 }}>
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, code, city, state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.375rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          {(['all', 'active', 'inactive'] as const).map((tab) => {
            const count =
              tab === 'all'
                ? branches.length
                : tab === 'active'
                  ? branches.filter((b) => b.is_active).length
                  : branches.filter((b) => !b.is_active).length;
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  background: isActive ? 'var(--bg-surface)' : 'transparent',
                  color: isActive ? 'var(--color-primary-600)' : 'var(--text-muted)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                <span
                  style={{
                    background: isActive ? 'var(--color-primary-100)' : 'var(--color-slate-200)',
                    color: isActive ? 'var(--color-primary-700)' : 'var(--color-slate-600)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '10px',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Branch Listing */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading branches...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredBranches.map((branch) => (
            <div
              key={branch._id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: branch.is_head_office ? '2px solid var(--color-primary-400)' : '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                opacity: branch.is_active ? 1 : 0.85,
              }}
            >
              {/* Card Header */}
              <div
                className="card-header"
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      background: branch.is_head_office ? 'var(--color-primary-100)' : 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: branch.is_head_office ? 'var(--color-primary-600)' : 'var(--text-muted)',
                    }}
                  >
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {branch.branch_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-subtle)',
                          padding: '0.125rem 0.375rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {branch.branch_code}
                      </span>
                      {branch.is_head_office && (
                        <span className="badge badge-info" style={{ fontSize: '10px', padding: '0.125rem 0.5rem' }}>
                          HEAD OFFICE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={branch.is_active ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '11px' }}>
                  {branch.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Card Body */}
              <div
                className="card-body"
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {(branch.city || branch.state) && (
                  <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <MapPin size={14} style={{ flexShrink: 0, color: 'var(--color-slate-400)' }} />
                    <span>{[branch.city, branch.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {branch.phone && (
                  <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <Phone size={14} style={{ flexShrink: 0, color: 'var(--color-slate-400)' }} />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.gstin && (
                  <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <FileText size={14} style={{ flexShrink: 0, color: 'var(--color-slate-400)' }} />
                    <span style={{ fontSize: 'var(--font-size-xs)' }}>
                      GSTIN: <strong>{branch.gstin}</strong>
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginTop: '0.25rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--border-light)',
                  }}
                >
                  <span
                    style={{
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      fontSize: 'var(--font-size-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Tag size={11} /> LR: <strong>{branch.lr_prefix}</strong>
                  </span>
                  <span
                    style={{
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      fontSize: 'var(--font-size-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Tag size={11} /> INV: <strong>{branch.invoice_prefix}</strong>
                  </span>
                </div>
              </div>

              {/* Card Footer: Action Buttons */}
              <div
                className="card-footer"
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'var(--color-slate-50)',
                  borderTop: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => handleOpenEdit(branch)}
                  title="Edit branch details, contact, and numbering"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleToggleStatus(branch)}
                  disabled={branch.is_head_office && branch.is_active}
                  title={
                    branch.is_head_office
                      ? 'Head Office cannot be deactivated'
                      : branch.is_active
                        ? 'Deactivate this branch'
                        : 'Activate this branch'
                  }
                >
                  <Power size={12} />
                  {branch.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setDeletingBranch(branch);
                    setDeleteErrorMessage(null);
                  }}
                  disabled={branch.is_head_office}
                  title={branch.is_head_office ? 'Head Office cannot be deleted' : 'Delete branch'}
                  style={{
                    color: branch.is_head_office ? 'var(--text-muted)' : 'var(--color-danger)',
                    borderColor: branch.is_head_office ? 'var(--border-light)' : 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {filteredBranches.length === 0 && (
            <div
              style={{
                gridColumn: '1/-1',
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-default)',
              }}
            >
              <GitBranch size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                {branches.length === 0 ? 'No regional branches configured' : 'No branches match your filters'}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                {branches.length === 0
                  ? 'Click "Add Regional Branch" above to configure your physical hubs.'
                  : 'Try adjusting your search keywords or switching status filter tabs.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <Modal
          isOpen={!!editingBranch}
          onClose={() => !editSubmitting && setEditingBranch(null)}
          title="Edit Regional Branch"
          subtitle={`Update ${editingBranch.branch_name} (${editingBranch.branch_code})`}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingBranch(null)}
                disabled={editSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_branch_name">Branch Name *</label>
                <input
                  id="edit_branch_name"
                  className="form-control"
                  value={editForm.branch_name}
                  onChange={(e) => setEditForm({ ...editForm, branch_name: e.target.value })}
                  placeholder="e.g. Bhiwandi Central Logistics Hub"
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_branch_code">Branch Code *</label>
                <input
                  id="edit_branch_code"
                  className="form-control"
                  value={editForm.branch_code}
                  onChange={(e) => setEditForm({ ...editForm, branch_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. BHW"
                  maxLength={10}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  required
                />
                <span className="form-hint">Unique identifier for this workspace</span>
              </div>
            </div>

            {/* Head Office designation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="edit_is_head_office"
                checked={editForm.is_head_office}
                onChange={(e) => setEditForm({ ...editForm, is_head_office: e.target.checked })}
                disabled={editingBranch.is_head_office} // Cannot unset directly if already Head Office without promoting another
                style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: 'var(--color-primary-600)' }}
              />
              <label htmlFor="edit_is_head_office" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                {editingBranch.is_head_office
                  ? 'Designated Primary Head Office (promote another branch to change)'
                  : 'Designate as Primary Head Office for this workspace'}
              </label>
            </div>

            {/* Location & Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_city">City</label>
                <input
                  id="edit_city"
                  className="form-control"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="e.g. Bhiwandi"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_state">State</label>
                <input
                  id="edit_state"
                  className="form-control"
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_phone">Phone</label>
                <input
                  id="edit_phone"
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_gstin">State GSTIN (Optional)</label>
                <input
                  id="edit_gstin"
                  className="form-control"
                  value={editForm.gstin}
                  onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="27AAACT2727Q1ZW"
                  maxLength={15}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>

            {/* Prefixes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_lr_prefix">LR / Bilty Prefix</label>
                <input
                  id="edit_lr_prefix"
                  className="form-control"
                  value={editForm.lr_prefix}
                  onChange={(e) => setEditForm({ ...editForm, lr_prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. BHW-LR-"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="edit_invoice_prefix">Invoice Prefix</label>
                <input
                  id="edit_invoice_prefix"
                  className="form-control"
                  value={editForm.invoice_prefix}
                  onChange={(e) => setEditForm({ ...editForm, invoice_prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. INV-BHW-"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <Modal
          isOpen={!!deletingBranch}
          onClose={() => !deleteSubmitting && setDeletingBranch(null)}
          title={`Delete Branch: ${deletingBranch.branch_name}`}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingBranch(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              {!deleteErrorMessage && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteBranch}
                  disabled={deleteSubmitting}
                >
                  {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              )}
            </>
          }
        >
          {deleteErrorMessage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-primary)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  background: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger-border)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <AlertTriangle size={24} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>Cannot Delete Branch With Records</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                    {deleteErrorMessage}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                To preserve historical and financial audit integrity, branches referenced by existing trips, LRs, or invoices cannot be permanently deleted. You can deactivate this branch instead to prevent any future dispatch or billing operations.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const target = deletingBranch;
                    setDeletingBranch(null);
                    setDeleteErrorMessage(null);
                    handleToggleStatus(target);
                  }}
                >
                  Deactivate Branch Instead
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                Are you sure you want to permanently delete branch <strong>{deletingBranch.branch_name}</strong> (<code>{deletingBranch.branch_code}</code>)?
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                This action is permanent and cannot be undone. If this branch has any associated trips, LRs, or invoices, deletion will be blocked by referential integrity rules.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
