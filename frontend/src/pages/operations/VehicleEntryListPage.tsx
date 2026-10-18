/**
 * ============================================================================
 * FLEET FLOW — MARKET VEHICLE MOVEMENTS & BROKERAGE (VehicleEntryListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Ledger and dispatch registry for third-party hired/brokerage vehicles ("Market Trucks"):
 * 1. Financial Settlement Equation:
 *    Net Due = Freight - Cash Advance - Diesel Advance - Dala - Commission + Halting
 * 2. Balance Party Vendor Accounts:
 *    Maintains live payable balances with vehicle suppliers, brokers, and petrol pumps.
 * 3. Proof of Delivery (POD) Stocking:
 *    Tracks receipt of physical consignment notes before releasing final freight balance.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { CreditLimitWarningModal, CreditExposureData } from '../../components/common/CreditLimitWarningModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import {
  Truck,
  Plus,
  Search,
  ArrowRight,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Layers,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
} from 'lucide-react';

export const VehicleEntryListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = role === 'admin' || role === 'dispatcher' || role === 'accountant';

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View Financial Breakdown Modal State
  const [viewEntry, setViewEntry] = useState<any>(null);

  // Delete Confirmation Dialog State (FF-ISSUE-049 & FF-ISSUE-010)
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<{ id: string; entryNumber: string } | null>(null);

  // Credit Limit Warning Modal State (DEC-007 Option B)
  const [isCreditWarningOpen, setIsCreditWarningOpen] = useState(false);
  const [creditExposureData, setCreditExposureData] = useState<CreditExposureData | null>(null);
  const [creditErrorMessage, setCreditErrorMessage] = useState('');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    from_location: '',
    to_location: '',
    balance_party_id: '',
    billing_party_id: '',
    material_description: '',
    weight_tonnes: '',
    freight_amount: '',
    driver_cash_advance: '',
    diesel_advance_amount: '',
    dala_charges: '',
    kamisan_amount: '',
    halting_amount: '',
    pod_received: false,
    notes: '',
  });

  // POD Update Modal State
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [podSlipUrl, setPodSlipUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch Metrics
  const { data: metrics } = useQuery({
    queryKey: ['vehicle-entry-metrics'],
    queryFn: async () => {
      const res = await api.get('/operations/vehicle-entries/metrics');
      return res.data;
    },
  });

  // 2. Fetch Entries List
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['vehicle-entries', page, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        status: statusFilter,
        search: searchQuery,
      });
      const res = await api.get(`/operations/vehicle-entries?${params.toString()}`);
      return res.data;
    },
  });

  // 3. Fetch Vendors (Balance Parties)
  const { data: vendorsData } = useQuery({
    queryKey: ['balance-parties-select'],
    queryFn: async () => {
      const res = await api.get('/parties/balance?limit=100');
      return res.data;
    },
  });

  // 4. Fetch Customers (Billing Parties)
  const { data: customersData } = useQuery({
    queryKey: ['billing-parties-select'],
    queryFn: async () => {
      const res = await api.get('/parties/billing?limit=100');
      return res.data;
    },
  });

  // 5. Create Entry Mutation
  const createMutation = useMutation({
    mutationFn: async (overrideData?: { credit_override?: boolean; override_reason?: string }) => {
      const payload = {
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        driver_phone: formData.driver_phone,
        from_location: formData.from_location,
        to_location: formData.to_location,
        balance_party_id: formData.balance_party_id,
        billing_party_id: formData.billing_party_id || undefined,
        material_description: formData.material_description,
        weight_tonnes: Number(formData.weight_tonnes) || 0,
        freight_amount: Number(formData.freight_amount) || 0,
        driver_cash_advance: Number(formData.driver_cash_advance) || 0,
        diesel_advance_amount: Number(formData.diesel_advance_amount) || 0,
        dala_charges: Number(formData.dala_charges) || 0,
        kamisan_amount: Number(formData.kamisan_amount) || 0,
        halting_amount: Number(formData.halting_amount) || 0,
        pod_received: formData.pod_received,
        notes: formData.notes,
        credit_override: overrideData?.credit_override,
        override_reason: overrideData?.override_reason,
      };
      const res = await api.post('/operations/vehicle-entries', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Market vehicle movement recorded.');
      setIsCreditWarningOpen(false);
      setCreditExposureData(null);
      handleCancelCreate();
      queryClient.invalidateQueries({ queryKey: ['vehicle-entries'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-entry-metrics'] });
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && err.response?.data?.code === 'CREDIT_LIMIT_EXCEEDED') {
        setCreditExposureData(err.response?.data?.exposure || null);
        setCreditErrorMessage(err.response?.data?.error || 'Customer credit limit exceeded.');
        setIsCreditWarningOpen(true);
      } else {
        toast.error(err.response?.data?.error || err.message || 'Failed to record entry.');
      }
    },
  });

  // 6. Update POD Mutation
  const podMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntryId) return;
      const res = await api.put(`/operations/vehicle-entries/${selectedEntryId}/pod`, {
        pod_received: true,
        pod_stock_date: new Date(),
        pod_document_url: podSlipUrl || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('POD receipt documented successfully.');
      setIsPodModalOpen(false);
      setSelectedEntryId(null);
      setPodSlipUrl('');
      queryClient.invalidateQueries({ queryKey: ['vehicle-entries'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-entry-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to update POD.');
    },
  });

  // 7. Delete Entry Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/operations/vehicle-entries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Market vehicle entry deleted.');
      queryClient.invalidateQueries({ queryKey: ['vehicle-entries'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-entry-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to delete entry.');
    },
  });

  const handleCancelCreate = () => {
    setFormData({
      vehicle_number: '',
      driver_name: '',
      driver_phone: '',
      from_location: '',
      to_location: '',
      balance_party_id: '',
      billing_party_id: '',
      material_description: '',
      weight_tonnes: '',
      freight_amount: '',
      driver_cash_advance: '',
      diesel_advance_amount: '',
      dala_charges: '',
      kamisan_amount: '',
      halting_amount: '',
      pod_received: false,
      notes: '',
    });
    setIsCreateModalOpen(false);
  };

  // Live Net Balance Calculator
  const calcNetBalance = () => {
    const freight = Number(formData.freight_amount) || 0;
    const cash = Number(formData.driver_cash_advance) || 0;
    const diesel = Number(formData.diesel_advance_amount) || 0;
    const dala = Number(formData.dala_charges) || 0;
    const kamisan = Number(formData.kamisan_amount) || 0;
    const halting = Number(formData.halting_amount) || 0;
    return Math.max(0, freight - cash - diesel - dala - kamisan + halting);
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity_type', 'pod');
      const res = await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setPodSlipUrl(res.data.url);
        toast.success('POD receipt uploaded.');
      }
    } catch (err: any) {
      toast.error('Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      {/* 1. Header */}
      <PageHeader
        title="Market Vehicle Movements"
        subtitle="Manage hired third-party trucks, broker balance ledger entries, and POD receipts."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Market Movements' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Record Market Vehicle Move
            </button>
          ) : undefined
        }
      />

      {/* 2. Top Operational KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Total Hired Movements</span>
            <Layers size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--text-main)' }}>
            {metrics?.totalEntries || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Brokerage movements logged
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Freight Booked</span>
            <IndianRupee size={20} color="var(--color-indigo-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--text-main)' }}>
            ₹{(metrics?.totalFreightBooked || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total contracted gross freight
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Advances Given</span>
            <Clock size={20} color="var(--color-amber-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-amber-600)' }}>
            ₹{(metrics?.totalAdvancesGiven || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Cash advances & diesel slips
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Net Balance Due</span>
            <AlertCircle size={20} color="var(--color-rose-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-rose-600)' }}>
            ₹{(metrics?.totalBalanceDue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Pending payable to suppliers
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Tab Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'all', label: 'All Moves' },
              { id: 'pending', label: 'Pending Settlement' },
              { id: 'partially_paid', label: 'Partially Paid' },
              { id: 'paid', label: 'Settled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`btn ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 'var(--font-size-xs)', padding: '0.375rem 0.75rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '280px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search Vehicle #, Vendor, Route..."
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Entry #</th>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ whiteSpace: 'nowrap' }}>Hired Vehicle & Driver</th>
                <th style={{ whiteSpace: 'nowrap' }}>Supplier (Balance Party)</th>
                <th style={{ whiteSpace: 'nowrap' }}>Route</th>
                <th style={{ whiteSpace: 'nowrap' }}>Agreed Freight</th>
                <th style={{ whiteSpace: 'nowrap' }}>Advances</th>
                <th style={{ whiteSpace: 'nowrap' }}>Net Balance Due</th>
                <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading market movements...
                  </td>
                </tr>
              ) : !entriesData?.entries || entriesData.entries.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No market vehicle movements found.
                  </td>
                </tr>
              ) : (
                entriesData.entries.map((entry: any) => (
                  <tr key={entry._id}>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                        {entry.entry_number}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(entry.entry_date).toLocaleDateString()}</td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {entry.vehicle_number}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {entry.driver_name || 'Driver unassigned'} {entry.driver_phone ? `(${entry.driver_phone})` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>
                        {entry.balance_party_id?.party_name || 'N/A'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {entry.balance_party_id?.party_type?.toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'var(--font-weight-semibold)' }}>
                        <span>{entry.from_location}</span>
                        <ArrowRight size={12} color="var(--text-muted)" />
                        <span>{entry.to_location}</span>
                      </div>
                      {entry.material_description && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {entry.material_description} ({entry.weight_tonnes || 0}T)
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 'var(--font-weight-semibold)', whiteSpace: 'nowrap' }}>
                      ₹{entry.freight_amount?.toLocaleString('en-IN')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div>₹{(entry.driver_cash_advance + entry.diesel_advance_amount)?.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        Cash: ₹{entry.driver_cash_advance} | Fuel: ₹{entry.diesel_advance_amount}
                      </div>
                    </td>
                    <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-rose-600)', whiteSpace: 'nowrap' }}>
                      ₹{entry.net_balance_due?.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        <span className={`badge ${entry.status === 'paid' ? 'badge-success' : entry.status === 'partially_paid' ? 'badge-primary' : 'badge-neutral'}`}>
                          {entry.status?.toUpperCase()}
                        </span>
                        {entry.pod_received ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '10px' }}>
                            <CheckCircle2 size={10} /> POD Recv
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '10px' }}>
                            <Clock size={10} /> POD Pend
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.375rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                          onClick={() => setViewEntry(entry)}
                          title="View Financial Breakdown & Arithmetic"
                        >
                          <Eye size={14} />
                        </button>
                        {!entry.pod_received && canEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.375rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                            onClick={() => {
                              setSelectedEntryId(entry._id);
                              setIsPodModalOpen(true);
                            }}
                            title="Acknowledge POD Receipt"
                          >
                            <FileCheck size={14} />
                          </button>
                        )}

                        {role === 'admin' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.375rem 0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}
                            onClick={() => {
                              setDeleteConfirmEntry({
                                id: entry._id,
                                entryNumber: entry.entry_number,
                              });
                            }}
                            title="Delete Entry"
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

        {/* 5. Pagination */}
        <Pagination
          currentPage={entriesData?.page || 1}
          totalPages={entriesData?.totalPages || 1}
          totalItems={entriesData?.total || 0}
          pageSize={15}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* MODAL: RECORD MARKET VEHICLE MOVEMENT */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Market Vehicle Movement"
        subtitle="Log hired third-party truck freight agreement, advances, deductions, and balance."
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          {/* Section A: Vehicle & Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Hired Vehicle No <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. NL01A9876"
                className="form-control"
                style={{ textTransform: 'uppercase' }}
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Supplier / Broker (Balance Party) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.balance_party_id}
                onChange={(e) => setFormData({ ...formData, balance_party_id: e.target.value })}
                required
              >
                <option value="">-- Choose Supplier / Broker --</option>
                {vendorsData?.parties?.map((v: any) => (
                  <option key={v._id} value={v._id}>
                    {v.party_name} ({v.party_type?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Shipper Customer (Optional)</label>
              <select
                className="form-control"
                value={formData.billing_party_id}
                onChange={(e) => setFormData({ ...formData, billing_party_id: e.target.value })}
              >
                <option value="">-- Optional: Link Customer --</option>
                {customersData?.parties?.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section B: Driver & Route */}
          <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Driver Name</label>
              <input
                type="text"
                placeholder="e.g. Joginder Singh"
                className="form-control"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Driver Phone</label>
              <input
                type="tel"
                placeholder="e.g. 9811223344"
                className="form-control"
                value={formData.driver_phone}
                onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Origin <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Vapi, Gujarat"
                className="form-control"
                value={formData.from_location}
                onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Destination <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ludhiana, Punjab"
                className="form-control"
                value={formData.to_location}
                onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Section C: Financial Breakdown */}
          <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Financial Breakdown & Settlement Equation
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Agreed Freight (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  className="form-control"
                  value={formData.freight_amount}
                  onChange={(e) => setFormData({ ...formData, freight_amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Driver Cash Advance (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  className="form-control"
                  value={formData.driver_cash_advance}
                  onChange={(e) => setFormData({ ...formData, driver_cash_advance: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Diesel Advance (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  className="form-control"
                  value={formData.diesel_advance_amount}
                  onChange={(e) => setFormData({ ...formData, diesel_advance_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Dala / Loading Deduction (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  className="form-control"
                  value={formData.dala_charges}
                  onChange={(e) => setFormData({ ...formData, dala_charges: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Commission (Kamisan) Deduction (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 2000"
                  className="form-control"
                  value={formData.kamisan_amount}
                  onChange={(e) => setFormData({ ...formData, kamisan_amount: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Halting / Demurrage Addition (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  className="form-control"
                  value={formData.halting_amount}
                  onChange={(e) => setFormData({ ...formData, halting_amount: e.target.value })}
                />
              </div>
            </div>

            {/* Net Calculated Output */}
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Net Equation: Freight − Cash − Diesel − Dala − Commission + Halting
              </div>
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-rose-600)' }}>
                Computed Net Balance Due: ₹{calcNetBalance().toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelCreate}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Recording...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DOCUMENT POD RECEIPT */}
      <Modal
        isOpen={isPodModalOpen}
        onClose={() => setIsPodModalOpen(false)}
        title="Document Proof of Delivery (POD)"
        subtitle="Acknowledge signed physical receipt and upload digital slip."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            podMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">Upload Consignment POD Slip</label>
            <input
              type="file"
              className="form-control"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
              disabled={isUploading}
            />
            {podSlipUrl && (
              <div style={{ marginTop: '0.375rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-emerald-600)' }}>
                ✓ Document uploaded and ready to attach.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsPodModalOpen(false);
                setSelectedEntryId(null);
                setPodSlipUrl('');
              }}
              disabled={podMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={podMutation.isPending || isUploading}>
              {podMutation.isPending ? 'Saving...' : 'Acknowledge POD'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VIEW FINANCIAL BREAKDOWN & DEDUCTION ARITHMETIC */}
      <Modal
        isOpen={Boolean(viewEntry)}
        onClose={() => setViewEntry(null)}
        title={`Movement Financial Breakdown — ${viewEntry?.entry_number || ''}`}
        subtitle="Transparent line-by-line settlement arithmetic payable to vehicle supplier."
      >
        {viewEntry && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Vehicle & Driver:</span>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{viewEntry.vehicle_number} ({viewEntry.driver_name || 'Unassigned'})</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Supplier (Balance Party):</span>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{viewEntry.balance_party_id?.party_name || 'N/A'}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Route:</span>
                <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{viewEntry.from_location} → {viewEntry.to_location}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Date:</span>
                <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{new Date(viewEntry.entry_date).toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table className="table" style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'var(--font-weight-medium)' }}>Agreed Total Freight</td>
                    <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                      ₹{viewEntry.freight_amount?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--color-rose-600)' }}>− Driver Cash Advance</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-rose-600)' }}>
                      − ₹{(viewEntry.driver_cash_advance || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--color-rose-600)' }}>− Diesel Fuel Advance</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-rose-600)' }}>
                      − ₹{(viewEntry.diesel_advance_amount || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--color-amber-700)' }}>− Dala / Loading Charges</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-amber-700)' }}>
                      − ₹{(viewEntry.dala_charges || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--color-amber-700)' }}>− Brokerage Commission (Kamisan)</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-amber-700)' }}>
                      − ₹{(viewEntry.kamisan_amount || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {Boolean(viewEntry.halting_amount) && (
                    <tr>
                      <td style={{ color: 'var(--color-emerald-600)' }}>+ Halting / Demurrage Compensation</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-emerald-600)' }}>
                        + ₹{(viewEntry.halting_amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                  <tr style={{ backgroundColor: 'var(--color-slate-100)', borderTop: '2px solid var(--border-light)' }}>
                    <td style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)' }}>
                      = Net Balance Due to Supplier
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)', color: 'var(--color-rose-600)' }}>
                      ₹{viewEntry.net_balance_due?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setViewEntry(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DEC-007 OPTION B CREDIT LIMIT WARNING & OVERRIDE MODAL */}
      <CreditLimitWarningModal
        isOpen={isCreditWarningOpen}
        onClose={() => setIsCreditWarningOpen(false)}
        exposure={creditExposureData}
        errorMessage={creditErrorMessage}
        onAuthorizeOverride={async (reason) => {
          await createMutation.mutateAsync({ credit_override: true, override_reason: reason });
        }}
        isSubmitting={createMutation.isPending}
      />

      {/* FF-ISSUE-010 / FF-ISSUE-049 ACCESSIBLE DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmEntry)}
        onClose={() => setDeleteConfirmEntry(null)}
        onConfirm={async () => {
          if (deleteConfirmEntry) {
            await deleteMutation.mutateAsync(deleteConfirmEntry.id);
            setDeleteConfirmEntry(null);
          }
        }}
        title="Delete Market Vehicle Movement"
        message={
          <span>
            Are you sure you want to delete movement <strong>{deleteConfirmEntry?.entryNumber}</strong>? This action will permanently remove the movement ledger entry.
          </span>
        }
        confirmText="Delete Movement"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
