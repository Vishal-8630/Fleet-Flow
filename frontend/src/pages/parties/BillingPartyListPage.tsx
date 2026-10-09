/**
 * ============================================================================
 * FLEET FLOW — CUSTOMER BILLING PARTIES (pages/parties/BillingPartyListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Directory of freight shippers, consignors, and consignees who contract transport
 * services. Manages GSTIN identifiers, payment terms (e.g. 30 days), credit limits,
 * and outstanding receivables.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  Filter,
  CreditCard,
  CheckCircle2,
  FileText,
  Trash2,
  Edit,
  Phone,
  Mail,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export interface BillingPartyRecord {
  _id: string;
  name: string;
  trade_name?: string;
  gstin?: string;
  pan_number?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  billing_address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  payment_terms_days: number;
  credit_limit: number;
  outstanding_receivables: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export const BillingPartyListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher', 'accountant'].includes(role || '');
  const isAdmin = role === 'admin';

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<BillingPartyRecord | null>(null);

  const initialFormData = {
    name: '',
    trade_name: '',
    gstin: '',
    pan_number: '',
    contact_person: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    payment_terms_days: '30',
    credit_limit: '0',
    status: 'active',
  };

  const [formData, setFormData] = useState(initialFormData);

  // Query billing parties
  const { data, isLoading } = useQuery({
    queryKey: ['billing-parties', page, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (searchTerm) params.append('q', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/parties/billing?${params.toString()}`);
      return res.data;
    },
  });

  const parties: BillingPartyRecord[] = data?.parties || [];
  const stats = data?.stats || { total: 0, active: 0, total_outstanding: 0 };

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingParty) {
        const res = await api.put(`/parties/billing/${editingParty._id}`, payload);
        return res.data;
      }
      const res = await api.post('/parties/billing', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Customer saved successfully.');
      setIsModalOpen(false);
      setEditingParty(null);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['billing-parties'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save customer.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/parties/billing/${id}`);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Customer removed.');
      queryClient.invalidateQueries({ queryKey: ['billing-parties'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove customer.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Legal company name is mandatory.');
      return;
    }

    saveMutation.mutate({
      name: formData.name,
      trade_name: formData.trade_name,
      gstin: formData.gstin ? formData.gstin.toUpperCase() : undefined,
      pan_number: formData.pan_number ? formData.pan_number.toUpperCase() : undefined,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      billing_address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
      },
      payment_terms_days: Number(formData.payment_terms_days) || 30,
      credit_limit: Number(formData.credit_limit) || 0,
      status: formData.status,
    });
  };

  const openCreateModal = () => {
    // If previously editing a specific customer, reset to draft
    if (editingParty) {
      setEditingParty(null);
      setFormData(initialFormData);
    }
    // Retain whatever the user typed for new customer until they click Cancel
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setEditingParty(null);
    setFormData(initialFormData);
    setIsModalOpen(false);
  };

  const openEditModal = (party: BillingPartyRecord) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      trade_name: party.trade_name || '',
      gstin: party.gstin || '',
      pan_number: party.pan_number || '',
      contact_person: party.contact_person || '',
      phone: party.phone || '',
      email: party.email || '',
      street: party.billing_address?.street || '',
      city: party.billing_address?.city || '',
      state: party.billing_address?.state || '',
      postal_code: party.billing_address?.postal_code || '',
      payment_terms_days: party.payment_terms_days?.toString() || '30',
      credit_limit: party.credit_limit?.toString() || '0',
      status: party.status,
    });
    setIsModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Customer Billing Parties"
        subtitle="Shippers, consignors, and corporate freight clients invoiced under Lorry Receipts."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Parties' },
          { label: 'Billing Parties' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Add Customer
            </button>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Total Customers</span>
            <Building2 size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.active} Active accounts
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>GST Verified Shippers</span>
            <CheckCircle2 size={20} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-success)' }}>
            {stats.active}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Eligible for automatic E-Way Bills
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Outstanding Receivables</span>
            <CreditCard size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-primary-700)' }}>
            ₹{(stats.total_outstanding || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Aggregated unsettled freight dues
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by customer name, GSTIN..."
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ minWidth: '140px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Customer Legal Name</th>
                <th>GSTIN / PAN</th>
                <th>Contact Person</th>
                <th>Payment Terms</th>
                <th>Credit Limit</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Loading billing parties...
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Building2 size={36} color="var(--color-slate-400)" />
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>No customers found</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        Add shippers and corporate consignors to start billing freight journeys.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                parties.map((party) => (
                  <tr key={party._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>{party.name}</div>
                      {party.trade_name && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{party.trade_name}</div>
                      )}
                    </td>
                    <td>
                      {party.gstin ? (
                        <span className="badge badge-success" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                          {party.gstin}
                        </span>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Unregistered</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-sm)' }}>{party.contact_person || 'N/A'}</div>
                      {party.phone && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{party.phone}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{party.payment_terms_days} Days</span>
                    </td>
                    <td>₹{(party.credit_limit || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ fontWeight: 'var(--font-weight-semibold)', color: party.outstanding_receivables > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        ₹{(party.outstanding_receivables || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${party.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {party.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(party)}
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`Remove customer ${party.name}?`)) {
                                deleteMutation.mutate(party._id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={data?.page || 1}
          totalPages={data?.totalPages || 1}
          totalItems={data?.total || 0}
          pageSize={15}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingParty ? 'Edit Customer' : 'Add Customer Billing Party'}
        subtitle="Manage freight consignor tax numbers and billing coordinates."
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Company Legal Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Reliance Retail Ltd"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trade / Brand Name</label>
              <input
                type="text"
                placeholder="e.g. JioMart Logistics"
                className="form-control"
                value={formData.trade_name}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">15-Digit GSTIN</label>
              <input
                type="text"
                placeholder="27ABCDE1234F1Z5"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">PAN Number</label>
              <input
                type="text"
                placeholder="ABCDE1234F"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                placeholder="Logistics Manager Name"
                className="form-control"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="tel"
                placeholder="Official Phone / Mobile"
                className="form-control"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mumbai"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Postal Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="400001"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Payment Terms (Days)</label>
              <input
                type="number"
                className="form-control"
                value={formData.payment_terms_days}
                onChange={(e) => setFormData({ ...formData, payment_terms_days: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Credit Limit (₹)</label>
              <input
                type="number"
                className="form-control"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editingParty ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
