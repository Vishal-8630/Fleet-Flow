/**
 * ============================================================================
 * FLEET FLOW — LORRY RECEIPT (LR / BILTY) MANAGEMENT (LRListPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS tokens and component classes.
 * Features:
 * - KPI Metrics Ribbon (Total, Active, Invoiced, To-Be-Billed Freight Value)
 * - Multi-criteria search and status/terms filtering
 * - New LR Modal (retains form state on backdrop dismiss until Cancel)
 * - Printable 3-part vector consignment note stationary (Consignor, Consignee, Transporter)
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
import { FeatureGate } from '../../components/common/FeatureGate';
import {
  Receipt,
  FileCheck2,
  FileText,
  Clock,
  Plus,
  Search,
  Printer,
  XCircle,
  Truck,
  MapPin,
  ArrowRight,
  User,
  Shield,
  Layers,
} from 'lucide-react';

export const LRListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role, enabledFeatures = [] } = useAuthStore();
  const isUnlocked = enabledFeatures.includes('MOD_LR_ENGINE');
  const canEdit = role === 'admin' || role === 'dispatcher' || role === 'accountant';

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [termsFilter, setTermsFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedLrForPrint, setSelectedLrForPrint] = useState<any | null>(null);

  // Form state (persists until Cancel or Submit)
  const initialForm = {
    lr_no: '',
    bill_no: '',
    lr_date: new Date().toISOString().split('T')[0],
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    from_location: '',
    to_location: '',
    billing_party_id: '',
    consignor_name: '',
    consignor_address: '',
    consignor_gstin: '',
    consignee_name: '',
    consignee_address: '',
    consignee_gstin: '',
    package_count: 1,
    packaging_type: 'Bundles',
    goods_description: 'Commercial Freight Goods',
    declared_value: 0,
    risk_type: 'carrier_risk',
    actual_weight_tonnes: 0,
    chargeable_weight_tonnes: 0,
    rate_per_tonne: 0,
    freight_amount: 0,
    freight_terms: 'to_be_billed',
    eway_bill_number: '',
    container_number: '',
    be_number: '',
    remarks: '',
  };

  const [formData, setFormData] = useState(initialForm);

  // Queries
  const { data: metricsData } = useQuery({
    queryKey: ['lr-metrics'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/commercial/entries/metrics');
      return res.data?.metrics;
    },
  });

  const { data: lrsData, isLoading } = useQuery({
    queryKey: ['lr-list', page, statusFilter, termsFilter, searchQuery],
    enabled: isUnlocked,
    queryFn: async () => {
      const params: any = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      if (termsFilter) params.freight_terms = termsFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/commercial/entries', { params });
      return res.data;
    },
  });

  const { data: partiesData } = useQuery({
    queryKey: ['billing-parties-lookup'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/parties/billing', { params: { limit: 100 } });
      return res.data?.parties || [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/commercial/entries', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Lorry Receipt generated successfully.');
      queryClient.invalidateQueries({ queryKey: ['lr-list'] });
      queryClient.invalidateQueries({ queryKey: ['lr-metrics'] });
      setIsCreateModalOpen(false);
      setFormData(initialForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create Lorry Receipt.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/commercial/entries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Lorry Receipt cancelled.');
      queryClient.invalidateQueries({ queryKey: ['lr-list'] });
      queryClient.invalidateQueries({ queryKey: ['lr-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel LR.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_number || !formData.from_location || !formData.to_location) {
      toast.error('Vehicle number, from location, and to location are required.');
      return;
    }
    if (!formData.consignor_name || !formData.consignee_name) {
      toast.error('Consignor and Consignee names are required.');
      return;
    }

    const payload = {
      lr_no: formData.lr_no || undefined,
      bill_no: formData.bill_no || undefined,
      lr_date: new Date(formData.lr_date),
      vehicle_number: formData.vehicle_number,
      driver_name: formData.driver_name,
      driver_phone: formData.driver_phone,
      from_location: formData.from_location,
      to_location: formData.to_location,
      billing_party_id: formData.billing_party_id || undefined,
      consignor: {
        name: formData.consignor_name,
        address: formData.consignor_address,
        gstin: formData.consignor_gstin,
      },
      consignee: {
        name: formData.consignee_name,
        address: formData.consignee_address,
        gstin: formData.consignee_gstin,
      },
      package_count: Number(formData.package_count) || 1,
      packaging_type: formData.packaging_type,
      goods_description: formData.goods_description,
      declared_value: Number(formData.declared_value) || 0,
      risk_type: formData.risk_type,
      actual_weight_tonnes: Number(formData.actual_weight_tonnes) || 0,
      chargeable_weight_tonnes: Number(formData.chargeable_weight_tonnes) || 0,
      rate_per_tonne: Number(formData.rate_per_tonne) || 0,
      freight_amount: Number(formData.freight_amount) || 0,
      freight_terms: formData.freight_terms,
      eway_bill_number: formData.eway_bill_number,
      container_number: formData.container_number,
      be_number: formData.be_number,
      remarks: formData.remarks,
    };

    createMutation.mutate(payload);
  };

  const handlePrintLR = async (lrId: string, fallbackLr?: any) => {
    try {
      const res = await api.get(`/commercial/entries/${lrId}/printable`);
      setSelectedLrForPrint(res.data);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      if (fallbackLr) {
        setSelectedLrForPrint({ lr: fallbackLr, company: null });
        setIsPrintModalOpen(true);
      } else {
        toast.error(err.message || 'Failed to load printable LR.');
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Lorry Receipts (LR / Bilty)"
          subtitle="Manage official 3-part consignment notes, freight billing terms, and dispatch manifests"
          breadcrumbs={[
            { label: 'Commercial OS', href: '/bill-entry/all' },
            { label: 'Lorry Receipts' },
          ]}
        />
        <FeatureGate
          feature="MOD_LR_ENGINE"
          pageMode={true}
          titleOverride="Lorry Receipt (LR) Engine is Locked"
          descOverride="Official 3-part consignment notes, freight billing terms, and dispatch manifests require the Standard Commercial or Pro Enterprise tier."
        >
          {null}
        </FeatureGate>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* 1. Header */}
      <PageHeader
        title="Lorry Receipts (LR / Bilty)"
        subtitle="Manage official 3-part consignment notes, freight billing terms, and dispatch manifests"
        breadcrumbs={[
          { label: 'Commercial OS', href: '/bill-entry/all' },
          { label: 'Lorry Receipts' },
        ]}
        actions={
          canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>New Lorry Receipt</span>
            </button>
          )
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="commercial-metrics-grid">
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Receipt size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.total_lrs || 0}</div>
            <div className="commercial-metric-label">Total Consignments</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <FileCheck2 size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.active_lrs || 0}</div>
            <div className="commercial-metric-label">Active (Unbilled)</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <FileText size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.invoiced_lrs || 0}</div>
            <div className="commercial-metric-label">Invoiced Consignments</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_freight_value || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Freight Booked</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="filter-toolbar">
          <div className="filter-toolbar-left">
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search LR #, Vehicle #, Consignor, Destination..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="filter-toolbar-right">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '130px' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active (Unbilled)</option>
              <option value="invoiced">Invoiced</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="form-control"
              value={termsFilter}
              onChange={(e) => {
                setTermsFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="">All Freight Terms</option>
              <option value="to_be_billed">To Be Billed</option>
              <option value="paid">Paid</option>
              <option value="to_pay">To Pay</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. LR Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>LR Details</th>
                <th>Vehicle & Driver</th>
                <th>Route Corridor</th>
                <th>Consignor & Consignee</th>
                <th>Cargo & Weight</th>
                <th>Freight & Terms</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Loading Lorry Receipts...</span>
                    </div>
                  </td>
                </tr>
              ) : lrsData?.entries?.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No Lorry Receipts found matching current filters.
                  </td>
                </tr>
              ) : (
                lrsData?.entries?.map((lr: any) => (
                  <tr key={lr._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                        {lr.lr_no}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {new Date(lr.lr_date).toLocaleDateString()} • {lr.bill_no}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Truck size={14} color="var(--text-muted)" />
                        {lr.vehicle_number}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {lr.driver_name || 'Driver Not Assigned'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-sm)' }}>
                        <span>{lr.from_location}</span>
                        <ArrowRight size={12} color="var(--text-muted)" />
                        <span>{lr.to_location}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-xs)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>From:</span> {lr.consignor?.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        <span>To:</span> {lr.consignee?.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>
                        {lr.package_count} {lr.packaging_type} • {lr.goods_description}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {lr.chargeable_weight_tonnes ? `${lr.chargeable_weight_tonnes} Tonnes` : `${lr.actual_weight_tonnes} Tonnes`}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
                        ₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span className={`badge ${lr.freight_terms === 'paid' ? 'badge-success' : lr.freight_terms === 'to_pay' ? 'badge-warning' : 'badge-primary'}`}>
                        {lr.freight_terms?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${lr.status === 'active' ? 'badge-primary' : lr.status === 'invoiced' ? 'badge-success' : 'badge-danger'}`}>
                        {lr.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePrintLR(lr._id, lr)}
                          title="Print 3-Part Stationary"
                        >
                          <Printer size={14} />
                          <span>Print</span>
                        </button>
                        {canEdit && lr.status === 'active' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to cancel LR ${lr.lr_no}?`)) {
                                cancelMutation.mutate(lr._id);
                              }
                            }}
                            title="Cancel LR"
                          >
                            <XCircle size={14} />
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

        {/* Pagination */}
        {lrsData?.pagination && (
          <Pagination
            currentPage={page}
            totalPages={lrsData.pagination.pages}
            totalItems={lrsData.pagination.total}
            pageSize={12}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* 5. New Lorry Receipt Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate New Lorry Receipt (Bilty)"
        subtitle="Create official consignment note with consignor, consignee, route, and commercial freight terms"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData(initialForm); // Reset explicitly on Cancel
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Generating LR...' : 'Generate & Issue LR'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">LR Number (Optional / Auto-Gen)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. LR-0001 (Blank for next)"
                value={formData.lr_no}
                onChange={(e) => setFormData({ ...formData, lr_no: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">LR Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.lr_date}
                onChange={(e) => setFormData({ ...formData, lr_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MH-12-AB-1234"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Name & Phone</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Rameshwar (9876543210)"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">From Location (Origin)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mumbai, Maharashtra"
                value={formData.from_location}
                onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">To Location (Destination)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ahmedabad, Gujarat"
                value={formData.to_location}
                onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Billing Party / Customer (Optional for Invoicing)</label>
            <select
              className="form-control"
              value={formData.billing_party_id}
              onChange={(e) => setFormData({ ...formData, billing_party_id: e.target.value })}
            >
              <option value="">Select Customer / Shipper</option>
              {partiesData?.map((p: any) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem', color: 'var(--color-primary-600)' }}>
                Consignor (Shipper)
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor Company Name *"
                  value={formData.consignor_name}
                  onChange={(e) => setFormData({ ...formData, consignor_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor Address"
                  value={formData.consignor_address}
                  onChange={(e) => setFormData({ ...formData, consignor_address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor GSTIN"
                  value={formData.consignor_gstin}
                  onChange={(e) => setFormData({ ...formData, consignor_gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem', color: 'var(--color-primary-600)' }}>
                Consignee (Receiver)
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee Company Name *"
                  value={formData.consignee_name}
                  onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee Address"
                  value={formData.consignee_address}
                  onChange={(e) => setFormData({ ...formData, consignee_address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee GSTIN"
                  value={formData.consignee_gstin}
                  onChange={(e) => setFormData({ ...formData, consignee_gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Package Count</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={formData.package_count || ''}
                onChange={(e) => setFormData({ ...formData, package_count: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Packaging Type</label>
              <select
                className="form-control"
                value={formData.packaging_type}
                onChange={(e) => setFormData({ ...formData, packaging_type: e.target.value })}
              >
                <option value="Bundles">Bundles</option>
                <option value="Boxes">Boxes</option>
                <option value="Bags">Bags</option>
                <option value="Drums">Drums</option>
                <option value="Pallets">Pallets</option>
                <option value="Loose">Loose</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Goods Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Steel Coils / FMCG"
                value={formData.goods_description}
                onChange={(e) => setFormData({ ...formData, goods_description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Actual Weight (Tonnes)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 24.5"
                value={formData.actual_weight_tonnes || ''}
                onChange={(e) => {
                  const actual = Number(e.target.value);
                  const chargeable = formData.chargeable_weight_tonnes === 0 ? actual : formData.chargeable_weight_tonnes;
                  const rate = formData.rate_per_tonne;
                  setFormData({
                    ...formData,
                    actual_weight_tonnes: actual,
                    chargeable_weight_tonnes: chargeable,
                    freight_amount: rate > 0 ? Math.round(chargeable * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Chargeable Weight (Tonnes)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 25.0"
                value={formData.chargeable_weight_tonnes || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const rate = formData.rate_per_tonne;
                  setFormData({
                    ...formData,
                    chargeable_weight_tonnes: val,
                    freight_amount: rate > 0 ? Math.round(val * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Rate Per Tonne (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 1800"
                value={formData.rate_per_tonne || ''}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  const tonnes = formData.chargeable_weight_tonnes;
                  setFormData({
                    ...formData,
                    rate_per_tonne: rate,
                    freight_amount: tonnes > 0 ? Math.round(tonnes * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Freight Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 45000"
                value={formData.freight_amount || ''}
                onChange={(e) => setFormData({ ...formData, freight_amount: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Freight Terms</label>
              <select
                className="form-control"
                value={formData.freight_terms}
                onChange={(e) => setFormData({ ...formData, freight_terms: e.target.value })}
              >
                <option value="to_be_billed">To Be Billed</option>
                <option value="paid">Paid</option>
                <option value="to_pay">To Pay</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Declared Value (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 1500000"
                value={formData.declared_value || ''}
                onChange={(e) => setFormData({ ...formData, declared_value: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Risk Type</label>
              <select
                className="form-control"
                value={formData.risk_type}
                onChange={(e) => setFormData({ ...formData, risk_type: e.target.value as any })}
              >
                <option value="owner_risk">Owner Risk (O.R.)</option>
                <option value="carrier_risk">Carrier Risk (C.R.)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">E-Way Bill Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="12-digit E-Way Bill"
                value={formData.eway_bill_number}
                onChange={(e) => setFormData({ ...formData, eway_bill_number: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Printable 3-Part Stationary Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Print Consignment Note: ${selectedLrForPrint?.lr?.lr_no}`}
        subtitle="Standard 3-part layout (Consignor Copy, Consignee Copy, Transporter Copy)"
        size="xl"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPrintModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Printer size={16} />
              <span>Print Stationary</span>
            </button>
          </div>
        }
      >
        {selectedLrForPrint && (
          <div className="lr-print-container">
            {['CONSIGNOR COPY', 'CONSIGNEE COPY', 'TRANSPORTER COPY'].map((partName, idx) => (
              <React.Fragment key={partName}>
                {idx > 0 && <div className="lr-tear-line" />}
                <div className="lr-part-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="lr-part-header-tag">{partName}</span>
                      <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>{selectedLrForPrint.company?.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        GSTIN: {selectedLrForPrint.company?.gstin || 'N/A'} • Phone: {selectedLrForPrint.company?.phone || 'N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>
                        LR NO: {selectedLrForPrint.lr?.lr_no}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Date: {new Date(selectedLrForPrint.lr?.lr_date).toLocaleDateString()} • Bill #{' '}
                        {selectedLrForPrint.lr?.bill_no}
                      </div>
                    </div>
                  </div>

                  <table className="lr-table-grid">
                    <tbody>
                      <tr>
                        <td style={{ width: '50%' }}>
                          <strong>CONSIGNOR:</strong>
                          <br />
                          {selectedLrForPrint.lr?.consignor?.name}
                          <br />
                          {selectedLrForPrint.lr?.consignor?.address}
                          <br />
                          GSTIN: {selectedLrForPrint.lr?.consignor?.gstin || 'Unregistered'}
                        </td>
                        <td style={{ width: '50%' }}>
                          <strong>CONSIGNEE:</strong>
                          <br />
                          {selectedLrForPrint.lr?.consignee?.name}
                          <br />
                          {selectedLrForPrint.lr?.consignee?.address}
                          <br />
                          GSTIN: {selectedLrForPrint.lr?.consignee?.gstin || 'Unregistered'}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>TRANSIT CORRIDOR:</strong>
                          <br />
                          From: {selectedLrForPrint.lr?.from_location}
                          <br />
                          To: {selectedLrForPrint.lr?.to_location}
                        </td>
                        <td>
                          <strong>VEHICLE DETAILS:</strong>
                          <br />
                          Truck #: {selectedLrForPrint.lr?.vehicle_number}
                          <br />
                          Driver: {selectedLrForPrint.lr?.driver_name || 'Assigned Driver'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="lr-table-grid">
                    <thead>
                      <tr>
                        <th>Packages</th>
                        <th>Description of Goods</th>
                        <th>Actual Wt (T)</th>
                        <th>Charged Wt (T)</th>
                        <th>Rate / Tonne</th>
                        <th>Freight Terms</th>
                        <th>Total Freight</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          {selectedLrForPrint.lr?.package_count} {selectedLrForPrint.lr?.packaging_type}
                        </td>
                        <td>{selectedLrForPrint.lr?.goods_description}</td>
                        <td>{selectedLrForPrint.lr?.actual_weight_tonnes || '-'}</td>
                        <td>{selectedLrForPrint.lr?.chargeable_weight_tonnes || '-'}</td>
                        <td>₹{selectedLrForPrint.lr?.rate_per_tonne || '-'}</td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                            {selectedLrForPrint.lr?.freight_terms?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                          ₹{Number(selectedLrForPrint.lr?.freight_amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {selectedLrForPrint.lr?.eway_bill_number && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                      <strong>E-Way Bill:</strong> {selectedLrForPrint.lr.eway_bill_number}
                    </div>
                  )}

                  <div className="lr-sign-grid">
                    <div className="lr-sign-box">Consignor Signature</div>
                    <div className="lr-sign-box">Driver / Carrier Signature</div>
                    <div className="lr-sign-box">Consignee Receiving Stamp</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
export default LRListPage;
