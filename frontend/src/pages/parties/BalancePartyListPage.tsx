/**
 * ============================================================================
 * FLEET FLOW — VENDOR & BROKER BALANCE PARTIES (pages/parties/BalancePartyListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Directory of external supply-side partners: market truck owners, fleet brokers,
 * sub-contract transport companies, and contracted petrol pumps.
 * Manages banking coordinates, PAN numbers, and current balance ledgers.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  CreditCard,
  Building,
  Trash2,
  Edit,
  Phone,
  Fuel,
  Truck,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export interface BalancePartyRecord {
  _id: string;
  party_name: string;
  party_type: 'supplier' | 'broker' | 'transporter' | 'petrol_pump' | 'other';
  contact_person?: string;
  phone: string;
  email?: string;
  pan_number?: string;
  bank_details?: {
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    account_holder_name?: string;
  };
  opening_balance: number;
  current_balance: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export const BalancePartyListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher', 'accountant'].includes(role || '');
  const isAdmin = role === 'admin';

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<BalancePartyRecord | null>(null);

  const initialBalancePartyFormData = {
    party_name: '',
    party_type: 'supplier',
    contact_person: '',
    phone: '',
    email: '',
    pan_number: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    account_holder_name: '',
    opening_balance: '0',
    status: 'active',
  };

  const [formData, setFormData] = useState(initialBalancePartyFormData);

  // Query balance parties
  const { data, isLoading } = useQuery({
    queryKey: ['balance-parties', page, searchTerm, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (searchTerm) params.append('q', searchTerm);
      if (typeFilter) params.append('party_type', typeFilter);

      const res = await api.get(`/parties/balance?${params.toString()}`);
      return res.data;
    },
  });

  const parties: BalancePartyRecord[] = data?.parties || [];
  const stats = data?.stats || {
    total: 0,
    total_balance: 0,
    suppliers: 0,
    brokers: 0,
    transporters: 0,
  };

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingParty) {
        const res = await api.put(`/parties/balance/${editingParty._id}`, payload);
        return res.data;
      }
      const res = await api.post('/parties/balance', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Vendor saved successfully.');
      setIsModalOpen(false);
      setEditingParty(null);
      setFormData(initialBalancePartyFormData);
      queryClient.invalidateQueries({ queryKey: ['balance-parties'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save vendor.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/parties/balance/${id}`);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Vendor removed.');
      queryClient.invalidateQueries({ queryKey: ['balance-parties'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete vendor.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.party_name || !formData.phone) {
      toast.error('Vendor legal name and mobile number are mandatory.');
      return;
    }

    saveMutation.mutate({
      party_name: formData.party_name,
      party_type: formData.party_type,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      pan_number: formData.pan_number ? formData.pan_number.toUpperCase() : undefined,
      bank_details: {
        account_number: formData.account_number,
        ifsc_code: formData.ifsc_code ? formData.ifsc_code.toUpperCase() : undefined,
        bank_name: formData.bank_name,
        account_holder_name: formData.account_holder_name,
      },
      opening_balance: Number(formData.opening_balance) || 0,
      status: formData.status,
    });
  };

  const openCreateModal = () => {
    if (editingParty) {
      setEditingParty(null);
      setFormData(initialBalancePartyFormData);
    }
    // Retain whatever the user typed for new vendor until they click Cancel
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setEditingParty(null);
    setFormData(initialBalancePartyFormData);
    setIsModalOpen(false);
  };

  const openEditModal = (party: BalancePartyRecord) => {
    setEditingParty(party);
    setFormData({
      party_name: party.party_name,
      party_type: party.party_type,
      contact_person: party.contact_person || '',
      phone: party.phone || '',
      email: party.email || '',
      pan_number: party.pan_number || '',
      account_number: party.bank_details?.account_number || '',
      ifsc_code: party.bank_details?.ifsc_code || '',
      bank_name: party.bank_details?.bank_name || '',
      account_holder_name: party.bank_details?.account_holder_name || '',
      opening_balance: party.opening_balance?.toString() || '0',
      status: party.status,
    });
    setIsModalOpen(true);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'broker':
        return <span className="badge badge-warning">Vehicle Broker</span>;
      case 'supplier':
        return <span className="badge badge-primary">Truck Supplier</span>;
      case 'transporter':
        return <span className="badge badge-success">Sub-Contractor</span>;
      case 'petrol_pump':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Fuel size={12} /> Diesel Pump
          </span>
        );
      default:
        return <span className="badge badge-neutral">{type}</span>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Vendor & Balance Parties"
        subtitle="Market truck suppliers, vehicle brokers, transport contractors, and petrol pumps."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Parties' },
          { label: 'Balance Parties' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Add Vendor / Broker
            </button>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Total Vendors</span>
            <Briefcase size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Registered supply partners
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Fleet Brokers</span>
            <Truck size={20} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-warning)' }}>
            {stats.brokers}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Market vehicle intermediaries
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Truck Suppliers</span>
            <Building size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.suppliers}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Direct transport operators
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Payable Balances</span>
            <CreditCard size={20} color="var(--color-danger)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: stats.total_balance > 0 ? 'var(--color-danger)' : 'inherit' }}>
            ₹{(stats.total_balance || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total outstanding payables
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div className="filter-toolbar">
          <div className="filter-toolbar-left">
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by vendor name, contact..."
                className="form-control"
                style={{ paddingLeft: '2.25rem' }}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="filter-toolbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="form-control"
                style={{ minWidth: '160px' }}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Partner Types</option>
                <option value="supplier">Truck Supplier</option>
                <option value="broker">Vehicle Broker</option>
                <option value="transporter">Sub-Contractor</option>
                <option value="petrol_pump">Diesel Pump</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Partner Legal Name</th>
                <th>Category</th>
                <th>Contact Info</th>
                <th>PAN</th>
                <th>Bank Settlement Coordinates</th>
                <th>Current Balance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Loading balance parties...
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Briefcase size={36} color="var(--color-slate-400)" />
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>No vendors or brokers found</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        Add market vehicle suppliers and petrol pumps to settle freight slips.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                parties.map((party) => (
                  <tr key={party._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                        {party.party_name}
                      </div>
                    </td>
                    <td>{getTypeBadge(party.party_type)}</td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-sm)' }}>{party.contact_person || 'N/A'}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{party.phone}</div>
                    </td>
                    <td>
                      {party.pan_number ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 'var(--font-weight-medium)' }}>
                          {party.pan_number}
                        </span>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>
                    <td>
                      {party.bank_details?.account_number ? (
                        <div>
                          <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }}>
                            A/C: {party.bank_details.account_number}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {party.bank_details.ifsc_code} &bull; {party.bank_details.bank_name || 'Bank'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>No bank logged</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 'var(--font-weight-bold)', color: party.current_balance > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        ₹{(party.current_balance || 0).toLocaleString()}
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
                              if (confirm(`Remove partner ${party.party_name}?`)) {
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingParty ? 'Edit Vendor Partner' : 'Add Balance Party / Supplier'}
        subtitle="Manage market truck owners, fleet brokers, and fuel pump settlement profiles."
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Partner / Business Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Royal Transport Brokerage"
                className="form-control"
                value={formData.party_name}
                onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Partner Category</label>
              <select
                className="form-control"
                value={formData.party_type}
                onChange={(e) => setFormData({ ...formData, party_type: e.target.value as any })}
              >
                <option value="supplier">Truck Supplier (Vehicle Owner)</option>
                <option value="broker">Vehicle Broker / Agent</option>
                <option value="transporter">Sub-Contracted Transporter</option>
                <option value="petrol_pump">Diesel / Petrol Pump</option>
                <option value="other">Other Supply Vendor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                placeholder="Manager Name"
                className="form-control"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Mobile / Phone <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                className="form-control"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
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

          <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', marginTop: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-primary-700)' }}>
            Bank Settlement Coordinates (NEFT / RTGS)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Bank Account Number</label>
              <input
                type="text"
                placeholder="e.g. 50200012345678"
                className="form-control"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input
                type="text"
                placeholder="e.g. HDFC0001234"
                className="form-control"
                style={{ textTransform: 'uppercase' }}
                value={formData.ifsc_code}
                onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank Ltd"
                className="form-control"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Holder Name</label>
              <input
                type="text"
                placeholder="Name as registered on passbook"
                className="form-control"
                value={formData.account_holder_name}
                onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Opening Balance (₹)</label>
              <input
                type="number"
                className="form-control"
                value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
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
              {saveMutation.isPending ? 'Saving...' : editingParty ? 'Save Changes' : 'Create Vendor Partner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
