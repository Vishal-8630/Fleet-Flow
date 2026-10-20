/**
 * ============================================================================
 * FLEET FLOW — GENERAL FINANCIAL LEDGER & VENDOR BALANCES (LedgerListPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS tokens and component classes.
 * Features:
 * - General Ledger double-entry transactions across 17 accounting categories
 * - Financial summary KPI ribbon & net cash position
 * - Counter-balancing journal entry reversal (`REV-xxxx`)
 * - Sub-contracted market vendor (`BalanceParty`) balance reconciliation & statement
 * - Vendor payout recording with auto-posting debit entry
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
import { useTableColumnVisibility } from '../../hooks/useTableColumnVisibility';
import { TableColumnVisibilityMenu } from '../../components/common/TableColumnVisibilityMenu';
import { ITableColumnConfig } from '../../types/table';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Layers,
  Search,
  Plus,
  RotateCcw,
  CreditCard,
  FileText,
  Briefcase,
  Building2,
  Calendar,
  Wallet,
  CheckCircle2,
} from 'lucide-react';

const LEDGER_TABLE_COLUMNS: ITableColumnConfig[] = [
  { id: 'txn_no', label: 'TXN #', isDefaultVisible: true, isRequired: true, description: 'Accounting transaction journal reference number' },
  { id: 'date', label: 'Date', isDefaultVisible: true, isRequired: false, description: 'Transaction posting date' },
  { id: 'category', label: 'Category', isDefaultVisible: true, isRequired: false, description: 'Double-entry accounting category' },
  { id: 'type', label: 'Type', isDefaultVisible: true, isRequired: false, description: 'Debit or credit journal classification' },
  { id: 'amount', label: 'Amount', isDefaultVisible: true, isRequired: true, description: 'Financial ledger transaction value' },
  { id: 'mode', label: 'Mode', isDefaultVisible: true, isRequired: false, description: 'Payment settlement channel' },
  { id: 'party_name', label: 'Party Name', isDefaultVisible: true, isRequired: false, description: 'Customer, vendor, or driver entity name' },
  { id: 'description', label: 'Description', isDefaultVisible: true, isRequired: false, description: 'Ledger transaction narrative summary' },
  { id: 'actions', label: 'Actions', isDefaultVisible: true, isRequired: true, description: 'Reversal and audit actions' },
];

export const LedgerListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, role, enabledFeatures = [] } = useAuthStore();
  const columnVisibility = useTableColumnVisibility('ledger_list', LEDGER_TABLE_COLUMNS, user?.id);
  const isUnlocked = enabledFeatures.includes('MOD_LEDGERS');
  const canEdit = role === 'admin' || role === 'accountant';

  // State
  const [activeTab, setActiveTab] = useState<'ledger' | 'vendors'>('ledger');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Form State (Manual Journal Entry)
  const initialManualForm = {
    transaction_date: new Date().toISOString().split('T')[0],
    category: 'other_adjustment',
    balance_type: 'debit' as 'debit' | 'credit',
    amount: '',
    payment_mode: 'bank',
    reference_number: '',
    party_name: '',
    description: '',
  };
  const [manualForm, setManualForm] = useState(initialManualForm);

  // Form State (Vendor Payout)
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    payment_mode: 'bank',
    reference_number: '',
    notes: '',
  });

  // Queries
  const { data: summaryData } = useQuery({
    queryKey: ['ledger-summary'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/commercial/ledger/summary');
      return res.data?.summary;
    },
  });

  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['ledger-entries', page, categoryFilter, balanceTypeFilter, searchQuery],
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (categoryFilter) params.category = categoryFilter;
      if (balanceTypeFilter) params.balance_type = balanceTypeFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/commercial/ledger', { params });
      return res.data;
    },
    enabled: isUnlocked && activeTab === 'ledger',
  });

  const { data: vendorBalancesData, isLoading: isVendorsLoading } = useQuery({
    queryKey: ['vendor-balances'],
    queryFn: async () => {
      const res = await api.get('/commercial/ledger/party-balances');
      return res.data?.party_balances || [];
    },
    enabled: isUnlocked && activeTab === 'vendors',
  });

  // Query single vendor statement
  const { data: vendorStatementData, isLoading: isStatementLoading } = useQuery({
    queryKey: ['vendor-statement', selectedParty?._id],
    queryFn: async () => {
      if (!selectedParty?._id) return null;
      const res = await api.get(`/commercial/ledger/party-statements/${selectedParty._id}`);
      return res.data;
    },
    enabled: Boolean(selectedParty?._id && isStatementModalOpen),
  });

  // Mutations
  const createManualMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/commercial/ledger/manual', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Manual journal entry recorded.');
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-summary'] });
      setIsManualModalOpen(false);
      setManualForm(initialManualForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create entry.');
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async ({ id, reversal_reason }: { id: string; reversal_reason: string }) => {
      const res = await api.post(`/commercial/ledger/${id}/reverse`, { reversal_reason });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Journal entry reversed with counter-balancing posting.');
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-summary'] });
      setIsReverseModalOpen(false);
      setReversalReason('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reverse entry.');
    },
  });

  const recordPayoutMutation = useMutation({
    mutationFn: async ({ partyId, payload }: { partyId: string; payload: any }) => {
      const res = await api.post(`/commercial/ledger/parties/${partyId}/payout`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Vendor payout recorded and posted to General Ledger.');
      queryClient.invalidateQueries({ queryKey: ['vendor-balances'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-summary'] });
      setIsPayoutModalOpen(false);
      setPayoutForm({ amount: '', payment_mode: 'bank', reference_number: '', notes: '' });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record payout.');
    },
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.amount || Number(manualForm.amount) <= 0) {
      toast.error('Valid transaction amount is required.');
      return;
    }

    createManualMutation.mutate({
      ...manualForm,
      amount: Number(manualForm.amount),
    });
  };

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    if (!payoutForm.amount || Number(payoutForm.amount) <= 0) {
      toast.error('Valid payout amount is required.');
      return;
    }

    recordPayoutMutation.mutate({
      partyId: selectedParty._id,
      payload: {
        amount: Number(payoutForm.amount),
        payment_mode: payoutForm.payment_mode,
        reference_number: payoutForm.reference_number,
        notes: payoutForm.notes,
      },
    });
  };

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="General Ledger & Accounts"
          subtitle="Double-entry journal accounting across 17 commercial categories with sub-contractor fleet reconciliation"
          breadcrumbs={[
            { label: 'Commercial OS', href: '/ledger' },
            { label: 'Financial Ledger' },
          ]}
        />
        <FeatureGate
          feature="MOD_LEDGERS"
          pageMode={true}
          titleOverride="Double-Entry General Ledger is Locked"
          descOverride="Double-entry journal accounting across 17 categories, counter-balancing reversals, and vendor reconciliation require the Standard Commercial or Pro Enterprise tier."
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
        title="General Ledger & Accounts"
        subtitle="Double-entry journal accounting across 17 commercial categories with sub-contractor fleet reconciliation"
        breadcrumbs={[
          { label: 'Commercial OS', href: '/ledger' },
          { label: 'Financial Ledger' },
        ]}
        actions={
          canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setIsManualModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>New Journal Entry</span>
            </button>
          )
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="commercial-metrics-grid">
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(summaryData?.total_credits || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Credits (Inflow)</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <TrendingDown size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(summaryData?.total_debits || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Debits (Outflow)</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Wallet size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val" style={{ color: (summaryData?.net_cash_position || 0) >= 0 ? '#059669' : '#dc2626' }}>
              {(summaryData?.net_cash_position || 0) >= 0 ? '+' : ''}₹{(summaryData?.net_cash_position || 0).toLocaleString('en-IN')}
            </div>
            <div className="commercial-metric-label">Net Financial Position</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <BookOpen size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{summaryData?.transaction_count || 0}</div>
            <div className="commercial-metric-label">Journal Audit Records</div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="tab-bar-scroll" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', width: '100%' }}>
        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            color: activeTab === 'ledger' ? 'var(--color-primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'ledger' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <BookOpen size={16} />
          <span>General Financial Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vendors' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            color: activeTab === 'vendors' ? 'var(--color-primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'vendors' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Briefcase size={16} />
          <span>Market Vendor Balances (Sub-contracted Fleet)</span>
        </button>
      </div>

      {/* TAB 1: GENERAL FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <>
          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', overflow: 'visible', position: 'relative', zIndex: 20 }}>
            <div className="filter-toolbar">
              <div className="filter-toolbar-left">
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
                  <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search TXN #, Description, Party name, Reference..."
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
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 'auto', minWidth: '160px' }}
                >
                  <option value="">All 17 Categories</option>
                  <option value="freight_income">Freight Income</option>
                  <option value="diesel_expense">Diesel Expense</option>
                  <option value="driver_advance">Driver Advance</option>
                  <option value="driver_settlement">Driver Settlement</option>
                  <option value="toll_fastag">Toll / Fastag</option>
                  <option value="vehicle_maintenance">Vehicle Maintenance</option>
                  <option value="payment_received">Payment Received</option>
                  <option value="payment_made">Payment Made</option>
                  <option value="other_adjustment">Other Adjustment</option>
                </select>

                <select
                  className="form-control"
                  value={balanceTypeFilter}
                  onChange={(e) => {
                    setBalanceTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 'auto', minWidth: '130px' }}
                >
                  <option value="">All Types</option>
                  <option value="credit">Credits (Income / Inflow)</option>
                  <option value="debit">Debits (Expense / Outflow)</option>
                </select>

                <TableColumnVisibilityMenu
                  columns={LEDGER_TABLE_COLUMNS}
                  visibleColumns={columnVisibility.visibleColumns}
                  isVisible={columnVisibility.isVisible}
                  toggleColumn={columnVisibility.toggleColumn}
                  resetToDefaults={columnVisibility.resetToDefaults}
                  showAllColumns={columnVisibility.showAllColumns}
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="card">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    {columnVisibility.isVisible('txn_no') && <th>TXN #</th>}
                    {columnVisibility.isVisible('date') && <th>Date</th>}
                    {columnVisibility.isVisible('category') && <th>Category</th>}
                    {columnVisibility.isVisible('type') && <th>Type</th>}
                    {columnVisibility.isVisible('amount') && <th>Amount</th>}
                    {columnVisibility.isVisible('mode') && <th>Mode</th>}
                    {columnVisibility.isVisible('party_name') && <th>Party Name</th>}
                    {columnVisibility.isVisible('description') && <th>Description</th>}
                    {columnVisibility.isVisible('actions') && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLedgerLoading ? (
                    <tr>
                      <td colSpan={columnVisibility.visibleCount || 9} style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          <span style={{ color: 'var(--text-muted)' }}>Loading Financial Journal...</span>
                        </div>
                      </td>
                    </tr>
                  ) : ledgerData?.entries?.length === 0 ? (
                    <tr>
                      <td colSpan={columnVisibility.visibleCount || 9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No ledger transactions found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    ledgerData?.entries?.map((txn: any) => (
                      <tr key={txn._id} style={{ opacity: txn.is_reversal ? 0.75 : 1 }}>
                        {columnVisibility.isVisible('txn_no') && (
                          <td>
                            <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                              {txn.transaction_number}
                            </div>
                            {txn.is_reversal && (
                              <span className="ledger-reversed-pill">
                                <RotateCcw size={10} />
                                Reversed
                              </span>
                            )}
                          </td>
                        )}
                        {columnVisibility.isVisible('date') && (
                          <td style={{ fontSize: 'var(--font-size-xs)' }}>
                            {new Date(txn.transaction_date).toLocaleDateString()}
                          </td>
                        )}
                        {columnVisibility.isVisible('category') && (
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', textTransform: 'capitalize' }}>
                              {txn.category?.replace(/_/g, ' ')}
                            </span>
                          </td>
                        )}
                        {columnVisibility.isVisible('type') && (
                          <td>
                            <span className={`ledger-type-badge ${txn.balance_type}`}>
                              {txn.balance_type === 'credit' ? '+ Credit' : '- Debit'}
                            </span>
                          </td>
                        )}
                        {columnVisibility.isVisible('amount') && (
                          <td style={{ fontWeight: 'var(--font-weight-bold)', color: txn.balance_type === 'credit' ? '#059669' : '#dc2626' }}>
                            ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                          </td>
                        )}
                        {columnVisibility.isVisible('mode') && (
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {txn.payment_mode}
                            </span>
                          </td>
                        )}
                        {columnVisibility.isVisible('party_name') && (
                          <td>
                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>
                              {txn.party_name || '-'}
                            </div>
                          </td>
                        )}
                        {columnVisibility.isVisible('description') && (
                          <td>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {txn.description}
                            </div>
                          </td>
                        )}
                        {columnVisibility.isVisible('actions') && (
                          <td style={{ textAlign: 'right' }}>
                            {canEdit && !txn.is_reversal && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedEntry(txn);
                                  setReversalReason('');
                                  setIsReverseModalOpen(true);
                                }}
                                title="Counter-Balance Reversal"
                              >
                                <RotateCcw size={13} />
                                <span>Reverse</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {ledgerData?.pagination && (
              <Pagination
                currentPage={page}
                totalPages={ledgerData.pagination.pages}
                totalItems={ledgerData.pagination.total}
                pageSize={15}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      {/* TAB 2: MARKET TRUCK VENDOR BALANCES */}
      {activeTab === 'vendors' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor / Transporter</th>
                  <th>Hired Trips</th>
                  <th>Total Freight</th>
                  <th>Driver Advances</th>
                  <th>Brokerage (Kamisan)</th>
                  <th>Net Due</th>
                  <th>Current Balance</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isVendorsLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Loading Vendor Balances...</span>
                      </div>
                    </td>
                  </tr>
                ) : vendorBalancesData?.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No sub-contracted vendors found in workspace.
                    </td>
                  </tr>
                ) : (
                  vendorBalancesData?.map((v: any) => (
                    <tr key={v._id}>
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{v.party_name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {v.phone} • PAN: {v.pan_number || 'N/A'}
                        </div>
                      </td>
                      <td>{v.totalMovements} trip(s)</td>
                      <td>₹{Number(v.totalFreight || 0).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#dc2626' }}>₹{Number(v.totalAdvances || 0).toLocaleString('en-IN')}</td>
                      <td>₹{Number(v.totalKamisan || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-bold)', color: '#dc2626' }}>
                          ₹{Number(v.netBalancePayable || 0).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-bold)', color: v.totalOutstanding > 0 ? '#dc2626' : '#059669' }}>
                          ₹{Number(v.totalOutstanding || 0).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedParty(v);
                              setIsStatementModalOpen(true);
                            }}
                            title="View Statement"
                          >
                            <FileText size={14} />
                            <span>Statement</span>
                          </button>
                          {canEdit && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedParty(v);
                                setPayoutForm({
                                  amount: String(v.totalOutstanding > 0 ? v.totalOutstanding : ''),
                                  payment_mode: 'bank',
                                  reference_number: '',
                                  notes: '',
                                });
                                setIsPayoutModalOpen(true);
                              }}
                              title="Record Payout"
                            >
                              <CreditCard size={14} />
                              <span>Payout</span>
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
        </div>
      )}

      {/* 4. New Manual Entry Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Add Manual Ledger Journal Entry"
        subtitle="Post direct debit or credit adjustments to the general financial ledger"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsManualModalOpen(false);
                setManualForm(initialManualForm);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleManualSubmit}
              disabled={createManualMutation.isPending}
            >
              {createManualMutation.isPending ? 'Recording...' : 'Post Journal Entry'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleManualSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Transaction Date</label>
              <input
                type="date"
                className="form-control"
                value={manualForm.transaction_date}
                onChange={(e) => setManualForm({ ...manualForm, transaction_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Balance Type *</label>
              <select
                className="form-control"
                value={manualForm.balance_type}
                onChange={(e) => setManualForm({ ...manualForm, balance_type: e.target.value as any })}
                required
              >
                <option value="debit">Debit (Expense / Cash Out)</option>
                <option value="credit">Credit (Income / Cash In)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Accounting Category *</label>
              <select
                className="form-control"
                value={manualForm.category}
                onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                required
              >
                <option value="freight_income">Freight Income</option>
                <option value="diesel_expense">Diesel Expense</option>
                <option value="driver_advance">Driver Advance</option>
                <option value="driver_settlement">Driver Settlement</option>
                <option value="toll_fastag">Toll / Fastag</option>
                <option value="vehicle_maintenance">Vehicle Maintenance</option>
                <option value="tyre_expense">Tyre Expense</option>
                <option value="rto_border_tax">RTO Border Tax</option>
                <option value="office_expense">Office Expense</option>
                <option value="payment_received">Payment Received</option>
                <option value="payment_made">Payment Made</option>
                <option value="other_adjustment">Other Adjustment</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 5000"
                value={manualForm.amount}
                onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={manualForm.payment_mode}
                onChange={(e) => setManualForm({ ...manualForm, payment_mode: e.target.value })}
              >
                <option value="bank">Bank / NEFT / RTGS</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="fuel_card">Fuel Card</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reference #</label>
              <input
                type="text"
                className="form-control"
                placeholder="Cheque # / UTR"
                value={manualForm.reference_number}
                onChange={(e) => setManualForm({ ...manualForm, reference_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Associated Party Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Pump Name / Vendor / Customer"
              value={manualForm.party_name}
              onChange={(e) => setManualForm({ ...manualForm, party_name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Remarks *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Detailed reason for journal entry"
              value={manualForm.description}
              onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>

      {/* 5. Counter-Balancing Reversal Modal */}
      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        title={`Reverse Journal Entry: ${selectedEntry?.transaction_number}`}
        subtitle={`Amount: ₹${selectedEntry?.amount} (${selectedEntry?.balance_type?.toUpperCase()}) • Category: ${selectedEntry?.category}`}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReverseModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (!reversalReason.trim()) {
                  toast.error('Reversal reason is mandatory for accounting compliance.');
                  return;
                }
                reverseMutation.mutate({
                  id: selectedEntry._id,
                  reversal_reason: reversalReason,
                });
              }}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending ? 'Reversing...' : 'Execute Counter-Balancing Reversal'}
            </button>
          </div>
        }
      >
        <div style={{ marginBottom: '1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          Under GAAP double-entry rules, journal entries are immutable. Executing this will lock the original transaction and create an opposite, counter-balancing journal entry (<code>REV-xxxx</code>) to neutralize the balance.
        </div>
        <div className="form-group">
          <label className="form-label">Mandatory Reversal Audit Reason *</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Duplicate receipt entry / Inadvertent double payment"
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* 6. Vendor Statement Slip Modal */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={`Vendor Statement: ${selectedParty?.party_name}`}
        size="xl"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsStatementModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
            >
              Print Statement
            </button>
          </div>
        }
      >
        {vendorStatementData && (
          <div className="invoice-sheet" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>SUB-CONTRACTOR FLEET STATEMENT</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Vendor: {selectedParty?.party_name} • Phone: {selectedParty?.phone}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>
                  Net Balance Due: ₹{(vendorStatementData.summary?.total_net_balance || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <table className="lr-table-grid">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Vehicle #</th>
                  <th>Route Corridor</th>
                  <th>Freight</th>
                  <th>Advances</th>
                  <th>Kamisan</th>
                  <th>Halting</th>
                  <th>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {vendorStatementData.movements?.map((m: any, idx: number) => (
                  <tr key={idx}>
                    <td><strong>{m.entry_number}</strong></td>
                    <td>{m.vehicle_number}</td>
                    <td>{m.from_location} → {m.to_location}</td>
                    <td>₹{Number(m.freight_amount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: '#dc2626' }}>₹{Number(m.driver_cash_advance || 0).toLocaleString('en-IN')}</td>
                    <td>₹{Number(m.kamisan_amount || 0).toLocaleString('en-IN')}</td>
                    <td>₹{Number(m.halting_amount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>
                      ₹{Number(m.net_balance_due || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* 7. Record Vendor Payout Modal */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title={`Record Payout: ${selectedParty?.party_name}`}
        subtitle="Disburse freight balance payout to vendor and post debit entry to General Ledger"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPayoutModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePayoutSubmit}
              disabled={recordPayoutMutation.isPending}
            >
              {recordPayoutMutation.isPending ? 'Recording...' : 'Confirm Vendor Payout'}
            </button>
          </div>
        }
      >
        <form onSubmit={handlePayoutSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Payout Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              placeholder="e.g. 15000"
              value={payoutForm.amount}
              onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={payoutForm.payment_mode}
                onChange={(e) => setPayoutForm({ ...payoutForm, payment_mode: e.target.value })}
              >
                <option value="bank">Bank / NEFT / RTGS</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bank Reference / UTR #</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. UTR-88776655"
                value={payoutForm.reference_number}
                onChange={(e) => setPayoutForm({ ...payoutForm, reference_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Remarks</label>
            <input
              type="text"
              className="form-control"
              placeholder="Settlement notes"
              value={payoutForm.notes}
              onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default LedgerListPage;
