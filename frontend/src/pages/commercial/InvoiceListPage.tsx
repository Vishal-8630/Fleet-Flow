/**
 * ============================================================================
 * FLEET FLOW — GST FREIGHT TAX INVOICING (InvoiceListPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS tokens and component classes.
 * Features:
 * - KPI Metrics Ribbon (Invoiced, Collected, Outstanding, RCM Count, Overdue)
 * - Create GST Invoice Modal (RCM vs Forward Charge, LR line-item aggregation)
 * - Record Payment Collections with TDS & auto-posting to General Ledger
 * - Printable GST Freight Tax Invoice stationary with statutory tax table
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
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Printer,
  CreditCard,
  Ban,
  Building2,
  ArrowRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';

export const InvoiceListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role, enabledFeatures = [] } = useAuthStore();
  const isUnlocked = enabledFeatures.includes('MOD_BILLING_INVOICE');
  const canEdit = role === 'admin' || role === 'accountant';

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [rcmFilter, setRcmFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Form State (Create Invoice)
  const initialInvoiceForm = {
    billing_party_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    selected_lr_ids: [] as string[],
    extra_charges: [] as { charge_type: string; description: string; amount: number }[],
    tax_type: 'rcm' as 'rcm' | 'forward_charge',
    gst_rate: 5,
    place_of_supply: '',
    notes: '',
    terms_and_conditions: '1. Payment due within 15 days of presentation.\n2. Goods transported under Carriage by Road Act 2007.',
  };
  const [invoiceForm, setInvoiceForm] = useState(initialInvoiceForm);

  // Form State (Payment Collection)
  const initialPaymentForm = {
    amount: '',
    tds_amount: '0',
    payment_mode: 'bank_transfer',
    reference_number: '',
    notes: '',
  };
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);

  // Queries
  const { data: metricsData } = useQuery({
    queryKey: ['invoice-metrics'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/commercial/invoices/metrics');
      return res.data?.metrics;
    },
  });

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoice-list', page, statusFilter, rcmFilter, searchQuery],
    enabled: isUnlocked,
    queryFn: async () => {
      const params: any = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      if (rcmFilter) params.is_rcm = rcmFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/commercial/invoices', { params });
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

  // Query unbilled LRs for selected billing party
  const { data: unbilledLrsData } = useQuery({
    queryKey: ['unbilled-lrs', invoiceForm.billing_party_id],
    queryFn: async () => {
      if (!invoiceForm.billing_party_id) return [];
      const res = await api.get('/commercial/entries', {
        params: { billing_party_id: invoiceForm.billing_party_id, status: 'active', limit: 100 },
      });
      return res.data?.entries || [];
    },
    enabled: isUnlocked && Boolean(invoiceForm.billing_party_id),
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/commercial/invoices', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('GST Freight Invoice created successfully.');
      queryClient.invalidateQueries({ queryKey: ['invoice-list'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['lr-list'] });
      setIsCreateModalOpen(false);
      setInvoiceForm(initialInvoiceForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create invoice.');
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.post(`/commercial/invoices/${id}/payments`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Payment collection recorded and posted to Ledger.');
      queryClient.invalidateQueries({ queryKey: ['invoice-list'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-list'] });
      setIsPaymentModalOpen(false);
      setPaymentForm(initialPaymentForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record payment.');
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/commercial/invoices/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Invoice cancelled and linked LRs released.');
      queryClient.invalidateQueries({ queryKey: ['invoice-list'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel invoice.');
    },
  });

  // Calculations for Create Modal
  const selectedLrs = (unbilledLrsData || []).filter((lr: any) =>
    invoiceForm.selected_lr_ids.includes(lr._id)
  );
  const itemsSubtotal = selectedLrs.reduce((sum: number, lr: any) => sum + (Number(lr.freight_amount) || 0), 0);
  const extrasSubtotal = invoiceForm.extra_charges.reduce((sum: number, ec: any) => sum + (Number(ec.amount) || 0), 0);
  const invoiceSubtotal = itemsSubtotal + extrasSubtotal;

  const isRcm = invoiceForm.tax_type === 'rcm';
  const taxRate = isRcm ? 0 : Number(invoiceForm.gst_rate) || 5;
  const calculatedTax = isRcm ? 0 : Math.round(((invoiceSubtotal * taxRate) / 100) * 100) / 100;
  const calculatedGrandTotal = invoiceSubtotal + calculatedTax;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.billing_party_id) {
      toast.error('Please select a Billing Party customer.');
      return;
    }
    if (invoiceForm.selected_lr_ids.length === 0) {
      toast.error('Please select at least one Lorry Receipt to invoice.');
      return;
    }

    const payload = {
      billing_party_id: invoiceForm.billing_party_id,
      invoice_date: invoiceForm.invoice_date,
      due_date: invoiceForm.due_date,
      lr_ids: invoiceForm.selected_lr_ids,
      extra_charges: invoiceForm.extra_charges,
      tax_type: invoiceForm.tax_type,
      is_rcm: isRcm,
      gst_rate: invoiceForm.gst_rate,
      place_of_supply: invoiceForm.place_of_supply || undefined,
      notes: invoiceForm.notes,
      terms_and_conditions: invoiceForm.terms_and_conditions,
    };

    createInvoiceMutation.mutate(payload);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amountVal = Number(paymentForm.amount);
    if (!amountVal || amountVal <= 0) {
      toast.error('Valid payment collection amount is required.');
      return;
    }

    recordPaymentMutation.mutate({
      id: selectedInvoice._id,
      payload: {
        amount: amountVal,
        tds_amount: Number(paymentForm.tds_amount) || 0,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number,
        notes: paymentForm.notes,
      },
    });
  };

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="GST Freight Invoicing"
          subtitle="GTA Freight Tax Invoices complying with Indian GST laws, Section 9(3) RCM, and line item collections"
          breadcrumbs={[
            { label: 'Commercial OS', href: '/invoices' },
            { label: 'Tax Invoices' },
          ]}
        />
        <FeatureGate
          feature="MOD_BILLING_INVOICE"
          pageMode={true}
          titleOverride="GST Tax Invoicing is Locked"
          descOverride="Generating Section 9(3) RCM vs Forward Charge GST tax invoices, recording collections, and ledger posting require the Standard Commercial or Pro Enterprise tier."
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
        title="GST Freight Invoicing"
        subtitle="GTA Freight Tax Invoices complying with Indian GST laws, Section 9(3) RCM, and line item collections"
        breadcrumbs={[
          { label: 'Commercial OS', href: '/invoices' },
          { label: 'Tax Invoices' },
        ]}
        actions={
          canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>Create GST Invoice</span>
            </button>
          )
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="commercial-metrics-grid">
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_invoiced || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Invoiced Value</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_collected || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Collections</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_outstanding || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Receivables Outstanding</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Percent size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.rcm_invoices_count || 0}</div>
            <div className="commercial-metric-label">RCM Reverse Charge Invoices</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: '1 1 300px', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search Invoice #, Customer name, GSTIN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="">All Statuses</option>
              <option value="issued">Issued / Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="form-control"
              value={rcmFilter}
              onChange={(e) => {
                setRcmFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '130px' }}
            >
              <option value="">All Tax Types</option>
              <option value="true">RCM Invoices</option>
              <option value="false">Forward Charge</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Invoices Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Billed Customer</th>
                <th>Date & Due</th>
                <th>Tax Category</th>
                <th>Total Invoiced</th>
                <th>Paid Amount</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Loading Freight Invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : invoicesData?.invoices?.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No freight invoices found matching current criteria.
                  </td>
                </tr>
              ) : (
                invoicesData?.invoices?.map((inv: any) => (
                  <tr key={inv._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                        {inv.invoice_number}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {inv.lr_ids?.length || 0} Linked LR(s)
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>
                        {inv.billing_party_snapshot?.name || 'Customer'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        GSTIN: {inv.billing_party_snapshot?.gstin || 'Unregistered'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-xs)' }}>
                        Issued: {new Date(inv.invoice_date).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: new Date(inv.due_date) < new Date() && inv.balance_amount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                        Due: {new Date(inv.due_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      {inv.is_rcm ? (
                        <span className="badge badge-primary" title="Recipient pays GST under RCM Section 9(3)">
                          RCM (5%)
                        </span>
                      ) : (
                        <span className="badge badge-warning" title="Carrier collects and deposits GST">
                          Forward Charge ({inv.is_interstate ? `IGST ${inv.igst_rate}%` : `CGST+SGST`})
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 'var(--font-weight-bold)' }}>
                      ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: '#059669', fontWeight: 'var(--font-weight-medium)' }}>
                      ₹{Number(inv.paid_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 'var(--font-weight-bold)', color: inv.balance_amount > 0 ? '#dc2626' : '#059669' }}>
                      ₹{Number(inv.balance_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'partially_paid' ? 'badge-warning' : inv.status === 'issued' ? 'badge-primary' : 'badge-danger'}`}>
                        {inv.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsPrintModalOpen(true);
                          }}
                          title="Print GST Invoice"
                        >
                          <Printer size={14} />
                          <span>Print</span>
                        </button>
                        {canEdit && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentForm({
                                ...initialPaymentForm,
                                amount: String(inv.balance_amount || ''),
                              });
                              setIsPaymentModalOpen(true);
                            }}
                            title="Record Payment"
                          >
                            <CreditCard size={14} />
                            <span>Collect</span>
                          </button>
                        )}
                        {canEdit && inv.paid_amount === 0 && inv.status !== 'cancelled' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`Cancel invoice ${inv.invoice_number}? Linked LRs will be released back to active.`)) {
                                cancelInvoiceMutation.mutate(inv._id);
                              }
                            }}
                            title="Cancel Invoice"
                          >
                            <Ban size={14} />
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
        {invoicesData?.pagination && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              currentPage={page}
              totalPages={invoicesData.pagination.pages}
              totalItems={invoicesData.pagination.total}
              pageSize={12}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* 5. Create Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate GST Freight Invoice"
        subtitle="Aggregate active LRs, configure RCM / Forward Charge tax math, and apply extra charges"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setInvoiceForm(initialInvoiceForm); // Reset explicitly on Cancel
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={createInvoiceMutation.isPending}
            >
              {createInvoiceMutation.isPending ? 'Generating...' : 'Issue GST Invoice'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Billing Party (Customer / Shipper) *</label>
              <select
                className="form-control"
                value={invoiceForm.billing_party_id}
                onChange={(e) => {
                  setInvoiceForm({
                    ...invoiceForm,
                    billing_party_id: e.target.value,
                    selected_lr_ids: [],
                  });
                }}
                required
              >
                <option value="">Select Customer</option>
                {partiesData?.map((p: any) => (
                  <option key={p._id} value={p._id}>
                    {p.name} {p.gstin ? `(${p.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Place of Supply (State)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Gujarat, Maharashtra"
                value={invoiceForm.place_of_supply}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, place_of_supply: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Invoice Date</label>
              <input
                type="date"
                className="form-control"
                value={invoiceForm.invoice_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Due Date</label>
              <input
                type="date"
                className="form-control"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* LRs Selection Section */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Select Active LRs to Bill ({invoiceForm.selected_lr_ids.length} selected)</span>
              {unbilledLrsData && unbilledLrsData.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (invoiceForm.selected_lr_ids.length === unbilledLrsData.length) {
                      setInvoiceForm({ ...invoiceForm, selected_lr_ids: [] });
                    } else {
                      setInvoiceForm({ ...invoiceForm, selected_lr_ids: unbilledLrsData.map((e: any) => e._id) });
                    }
                  }}
                >
                  {invoiceForm.selected_lr_ids.length === unbilledLrsData.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </label>

            {!invoiceForm.billing_party_id ? (
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Please select a Billing Party to load active Lorry Receipts.
              </div>
            ) : unbilledLrsData?.length === 0 ? (
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                No active unbilled LRs found for this customer.
              </div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)' }}>
                {unbilledLrsData?.map((lr: any) => {
                  const isChecked = invoiceForm.selected_lr_ids.includes(lr._id);
                  return (
                    <div
                      key={lr._id}
                      onClick={() => {
                        const newSelection = isChecked
                          ? invoiceForm.selected_lr_ids.filter((id) => id !== lr._id)
                          : [...invoiceForm.selected_lr_ids, lr._id];
                        setInvoiceForm({ ...invoiceForm, selected_lr_ids: newSelection });
                      }}
                      style={{
                        padding: '0.6rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                            {lr.lr_no} • {lr.vehicle_number}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {lr.from_location} → {lr.to_location} ({lr.chargeable_weight_tonnes || lr.actual_weight_tonnes}T)
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)' }}>
                        ₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tax Configuration */}
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem' }}>
              GST Tax Structure
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="radio"
                  name="tax_type"
                  checked={invoiceForm.tax_type === 'rcm'}
                  onChange={() => setInvoiceForm({ ...invoiceForm, tax_type: 'rcm' })}
                />
                <span><strong>RCM (Reverse Charge)</strong> — Recipient pays 5% tax directly to government</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="radio"
                  name="tax_type"
                  checked={invoiceForm.tax_type === 'forward_charge'}
                  onChange={() => setInvoiceForm({ ...invoiceForm, tax_type: 'forward_charge' })}
                />
                <span><strong>Forward Charge</strong> — Transporter collects & remits GST</span>
              </label>
            </div>

            {invoiceForm.tax_type === 'forward_charge' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label className="form-label" style={{ margin: 0 }}>GST Rate (%):</label>
                <select
                  className="form-control"
                  style={{ width: 'auto' }}
                  value={invoiceForm.gst_rate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, gst_rate: Number(e.target.value) })}
                >
                  <option value={5}>5% (Standard GTA Freight)</option>
                  <option value={12}>12% (Full ITC Forward Charge)</option>
                  <option value={18}>18% (Commercial/Logistics Warehousing)</option>
                </select>
              </div>
            )}
          </div>

          {/* Real-Time Calculation Ribbon */}
          <div className="invoice-totals-box" style={{ width: '100%', maxWidth: 'none', margin: '0 0 1rem 0' }}>
            <div className="invoice-totals-row">
              <span>LR Freight Line Items Subtotal:</span>
              <span>₹{itemsSubtotal.toLocaleString('en-IN')}</span>
            </div>
            {extrasSubtotal > 0 && (
              <div className="invoice-totals-row">
                <span>Extra Charges Subtotal:</span>
                <span>₹{extrasSubtotal.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="invoice-totals-row" style={{ fontWeight: 600 }}>
              <span>Invoice Subtotal:</span>
              <span>₹{invoiceSubtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="invoice-totals-row">
              <span>{isRcm ? 'GST (Under RCM by recipient):' : `GST Tax (${taxRate}%):`}</span>
              <span>{isRcm ? '₹0.00 (RCM)' : `₹${calculatedTax.toLocaleString('en-IN')}`}</span>
            </div>
            <div className="invoice-totals-row grand-total">
              <span>Total Invoice Payable:</span>
              <span>₹{calculatedGrandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment Collection: ${selectedInvoice?.invoice_number}`}
        subtitle={`Total Invoiced: ₹${selectedInvoice?.total_amount} • Balance Due: ₹${selectedInvoice?.balance_amount}`}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsPaymentModalOpen(false);
                setPaymentForm(initialPaymentForm);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePaymentSubmit}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment & Post to Ledger'}
            </button>
          </div>
        }
      >
        <form onSubmit={handlePaymentSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              placeholder="e.g. 25000"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">TDS Deducted (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 500"
                value={paymentForm.tds_amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, tds_amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={paymentForm.payment_mode}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
              >
                <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Bank Reference / UTR / Cheque #</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. UTR-99881122"
              value={paymentForm.reference_number}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Remarks</label>
            <input
              type="text"
              className="form-control"
              placeholder="Optional remarks"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* 7. Printable GST Tax Invoice Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Print Tax Invoice: ${selectedInvoice?.invoice_number}`}
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
              <span>Print Invoice</span>
            </button>
          </div>
        }
      >
        {selectedInvoice && (
          <div className="invoice-sheet">
            <div className="invoice-header-row">
              <div>
                <div className="invoice-company-brand">FLEET FLOW LOGISTICS</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Goods Transport Agency (GTA) Freight Tax Invoice
                </div>
              </div>
              <div className="invoice-number-badge">
                <h2>{selectedInvoice.invoice_number}</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Date: {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                  <br />
                  Due Date: {new Date(selectedInvoice.due_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            {selectedInvoice.is_rcm && (
              <div className="rcm-callout-banner">
                ⚠️ TAX PAYABLE UNDER REVERSE CHARGE MECHANISM (RCM): In terms of Notification No. 13/2017-Central Tax (Rate), GST is payable by the recipient of the GTA services.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
              <div className="invoice-party-box">
                <strong>BILLED TO (RECIPIENT):</strong>
                <br />
                {selectedInvoice.billing_party_snapshot?.name}
                <br />
                {selectedInvoice.billing_party_snapshot?.address}
                <br />
                {selectedInvoice.billing_party_snapshot?.city}, {selectedInvoice.billing_party_snapshot?.state}
                <br />
                <strong>GSTIN:</strong> {selectedInvoice.billing_party_snapshot?.gstin || 'Unregistered'}
              </div>

              <div className="invoice-party-box">
                <strong>DISPATCH & SUPPLY COORDINATES:</strong>
                <br />
                <strong>Place of Supply:</strong> {selectedInvoice.place_of_supply}
                <br />
                <strong>Supply Type:</strong> {selectedInvoice.is_interstate ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
                <br />
                <strong>Status:</strong> {selectedInvoice.status?.toUpperCase()}
              </div>
            </div>

            <table className="lr-table-grid" style={{ margin: '1rem 0' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Consignment / LR #</th>
                  <th>Vehicle #</th>
                  <th>Route Corridor</th>
                  <th>Cargo / Weight</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items?.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td><strong>{it.lr_no}</strong></td>
                    <td>{it.vehicle_no}</td>
                    <td>{it.from_location} → {it.to_location}</td>
                    <td>{it.goods_description} ({it.chargeable_weight}T)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{Number(it.amount || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-totals-box">
              <div className="invoice-totals-row">
                <span>Subtotal (Taxable Freight):</span>
                <span>₹{Number(selectedInvoice.subtotal || 0).toLocaleString('en-IN')}</span>
              </div>
              {!selectedInvoice.is_rcm && (
                <div className="invoice-totals-row">
                  <span>GST ({selectedInvoice.is_interstate ? `IGST ${selectedInvoice.igst_rate}%` : `CGST ${selectedInvoice.cgst_rate}% + SGST ${selectedInvoice.sgst_rate}%`}):</span>
                  <span>₹{Number(selectedInvoice.total_tax || 0).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="invoice-totals-row grand-total">
                <span>Grand Total:</span>
                <span>₹{Number(selectedInvoice.total_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="invoice-totals-row" style={{ color: '#059669' }}>
                <span>Paid / Collected:</span>
                <span>₹{Number(selectedInvoice.paid_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="invoice-totals-row" style={{ fontWeight: 700, color: '#dc2626' }}>
                <span>Balance Due:</span>
                <span>₹{Number(selectedInvoice.balance_amount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default InvoiceListPage;
