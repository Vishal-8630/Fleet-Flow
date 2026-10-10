/**
 * ============================================================================
 * FLEET FLOW — DRIVER TRIP SETTLEMENTS (SettlementListPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS tokens and component classes.
 * Features:
 * - KPI Metrics Ribbon (Settled This Month, Total Paid Out, Outstanding, Unpaid Count)
 * - Real-Time Trip Settlement Calculator (wage rate/km, advance deduction, fuel variance penalty)
 * - Multi-trip selection from driver's completed unsettled journeys
 * - ACID Transactional Settlement Confirmation with Journey Locking
 * - Settlement payout disbursement recording
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
  BadgeCent,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Printer,
  Fuel,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  User,
  AlertTriangle,
} from 'lucide-react';

export const SettlementListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role, enabledFeatures = [] } = useAuthStore();
  const isUnlocked = enabledFeatures.includes('MOD_SETTLEMENTS');
  const canEdit = role === 'admin' || role === 'accountant';

  // State
  const [page, setPage] = useState(1);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);

  // Form State (New Settlement Calculator)
  const initialSettlementForm = {
    driver_id: '',
    selected_journey_ids: [] as string[],
    rate_per_km: 4.5,
    benchmark_mileage: 4.0,
    diesel_price_per_litre: 92.0,
    other_deductions: 0,
    other_deductions_notes: '',
    notes: '',
  };
  const [settlementForm, setSettlementForm] = useState(initialSettlementForm);

  // Form State (Disburse)
  const [disburseForm, setDisburseForm] = useState({
    payment_mode: 'bank_transfer',
    payment_ref: '',
  });

  // Queries
  const { data: metricsData } = useQuery({
    queryKey: ['settlement-metrics'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/commercial/settlements/metrics');
      return res.data?.metrics;
    },
  });

  const { data: settlementsData, isLoading } = useQuery({
    queryKey: ['settlements-list', page, paymentStatusFilter, searchQuery],
    enabled: isUnlocked,
    queryFn: async () => {
      const params: any = { page, limit: 12 };
      if (paymentStatusFilter) params.payment_status = paymentStatusFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/commercial/settlements', { params });
      return res.data;
    },
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-lookup'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/fleet/drivers', { params: { limit: 100 } });
      return res.data?.drivers || [];
    },
  });

  // Fetch pending completed trips for selected driver
  const { data: pendingTripsData, isLoading: isPendingTripsLoading } = useQuery({
    queryKey: ['driver-pending-trips', settlementForm.driver_id],
    queryFn: async () => {
      if (!settlementForm.driver_id) return null;
      const res = await api.get(`/commercial/settlements/driver/${settlementForm.driver_id}/pending-trips`);
      return res.data;
    },
    enabled: isUnlocked && Boolean(settlementForm.driver_id),
  });

  // Mutations
  const confirmSettlementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/commercial/settlements/confirm', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Trip settlement confirmed and locked successfully.');
      queryClient.invalidateQueries({ queryKey: ['settlements-list'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['driver-pending-trips'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-list'] });
      setIsCreateModalOpen(false);
      setSettlementForm(initialSettlementForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to confirm settlement.');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.post(`/commercial/settlements/${id}/mark-paid`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Settlement marked as paid and disbursed.');
      queryClient.invalidateQueries({ queryKey: ['settlements-list'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-metrics'] });
      setIsDisburseModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to disburse settlement.');
    },
  });

  // Math for Settlement Calculator
  const trips = pendingTripsData?.journeys || [];
  const selectedTrips = trips.filter((j: any) =>
    settlementForm.selected_journey_ids.includes(j._id)
  );

  const totalDistanceKms = selectedTrips.reduce((sum: number, j: any) => sum + (j.total_distance_kms || 0), 0);
  const totalAdvances = selectedTrips.reduce((sum: number, j: any) => sum + (j.starting_cash_advance || 0), 0);
  const totalReimbursements = selectedTrips.reduce((sum: number, j: any) => sum + (j.total_driver_expenses || 0), 0);
  const totalDieselLitres = selectedTrips.reduce((sum: number, j: any) => sum + (j.total_diesel_litres || 0), 0);

  const baseEarnings = Math.round(totalDistanceKms * Number(settlementForm.rate_per_km) * 100) / 100;
  const grossEarnings = Math.round((baseEarnings + totalReimbursements) * 100) / 100;

  let fuelVariancePenalty = 0;
  if (totalDistanceKms > 0 && settlementForm.benchmark_mileage > 0) {
    const allowedLitres = totalDistanceKms / Number(settlementForm.benchmark_mileage);
    if (totalDieselLitres > allowedLitres) {
      const excess = totalDieselLitres - allowedLitres;
      fuelVariancePenalty = Math.round(excess * Number(settlementForm.diesel_price_per_litre) * 100) / 100;
    }
  }

  const totalDeductions = Math.round((totalAdvances + fuelVariancePenalty + Number(settlementForm.other_deductions)) * 100) / 100;
  const netAmount = Math.round((grossEarnings - totalDeductions) * 100) / 100;
  const isPayable = netAmount >= 0;

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementForm.driver_id) {
      toast.error('Please select a Driver to settle.');
      return;
    }
    if (settlementForm.selected_journey_ids.length === 0) {
      toast.error('Please select at least one completed trip to reconcile.');
      return;
    }

    const payload = {
      driver_id: settlementForm.driver_id,
      journey_ids: settlementForm.selected_journey_ids,
      rate_per_km: settlementForm.rate_per_km,
      benchmark_mileage: settlementForm.benchmark_mileage,
      diesel_price_per_litre: settlementForm.diesel_price_per_litre,
      other_deductions: settlementForm.other_deductions,
      other_deductions_notes: settlementForm.other_deductions_notes,
      notes: settlementForm.notes,
    };

    confirmSettlementMutation.mutate(payload);
  };

  const handleDisburseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettlement) return;

    markPaidMutation.mutate({
      id: selectedSettlement._id,
      payload: disburseForm,
    });
  };

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Driver Trip Settlements"
          subtitle="Perform ACID-transactional driver wage reconciliation, diesel mileage variance audits, and advance deductions"
          breadcrumbs={[
            { label: 'Commercial OS', href: '/settlements' },
            { label: 'Driver Settlements' },
          ]}
        />
        <FeatureGate
          feature="MOD_SETTLEMENTS"
          pageMode={true}
          titleOverride="Driver Trip Settlements is Locked"
          descOverride="Driver trip settlement calculations, mileage variance penalties, payout vouchers, and advance deductions require the Standard Commercial or Pro Enterprise tier."
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
        title="Driver Trip Settlements"
        subtitle="Perform ACID-transactional driver wage reconciliation, diesel mileage variance audits, and advance deductions"
        breadcrumbs={[
          { label: 'Commercial OS', href: '/settlements' },
          { label: 'Driver Settlements' },
        ]}
        actions={
          canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>New Trip Settlement</span>
            </button>
          )
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="commercial-metrics-grid">
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <BadgeCent size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.settled_this_month || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Settled This Month</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_paid_out || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Disbursed</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_payable_outstanding || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Payable Outstanding</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.unpaid_settlements_count || 0}</div>
            <div className="commercial-metric-label">Unpaid Payout Slips</div>
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
              placeholder="Search Settlement #, Driver name, Phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select
              className="form-control"
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="">All Payment States</option>
              <option value="unpaid">Unpaid / Pending</option>
              <option value="paid">Disbursed (Paid)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Settlements Roster Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Settlement #</th>
                <th>Driver</th>
                <th>Settlement Date</th>
                <th>Total Kms</th>
                <th>Gross Earnings</th>
                <th>Advances</th>
                <th>Fuel Penalty</th>
                <th>Net Settlement</th>
                <th>Payment Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Loading Settlements...</span>
                    </div>
                  </td>
                </tr>
              ) : settlementsData?.settlements?.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No settlements found matching current filters.
                  </td>
                </tr>
              ) : (
                settlementsData?.settlements?.map((s: any) => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                        {s.settlement_number}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {s.journey_ids?.length || 0} Journey(s)
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>
                        {s.driver_snapshot?.name || 'Driver'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {s.driver_snapshot?.phone}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-xs)' }}>
                        {new Date(s.settlement_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td>{s.total_kms} km</td>
                    <td>₹{Number(s.gross_earnings || 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: '#dc2626' }}>₹{Number(s.total_advances || 0).toLocaleString('en-IN')}</td>
                    <td>
                      {s.fuel_variance_penalty > 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          -₹{Number(s.fuel_variance_penalty).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span style={{ color: '#059669' }}>₹0</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: s.net_amount >= 0 ? '#059669' : '#d97706' }}>
                        {s.net_amount >= 0 ? `+₹${s.net_amount.toLocaleString('en-IN')}` : `-₹${Math.abs(s.net_amount).toLocaleString('en-IN')}`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {s.settlement_type === 'payable_to_driver' ? 'Payable to Driver' : s.settlement_type === 'receivable_from_driver' ? 'Driver Owes Co.' : 'Even'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedSettlement(s);
                            setIsStatementModalOpen(true);
                          }}
                          title="View Statement Slip"
                        >
                          <Printer size={14} />
                          <span>Slip</span>
                        </button>
                        {canEdit && s.payment_status === 'unpaid' && (
                          <button
                            className={`btn btn-sm ${s.settlement_type === 'payable_to_driver' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                              setSelectedSettlement(s);
                              setDisburseForm({ payment_mode: 'bank_transfer', payment_ref: '' });
                              setIsDisburseModalOpen(true);
                            }}
                            title={s.settlement_type === 'payable_to_driver' ? 'Disburse Payout to Driver' : 'Record Collection from Driver'}
                          >
                            <CreditCard size={14} />
                            <span>{s.settlement_type === 'payable_to_driver' ? 'Pay' : 'Collect'}</span>
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
        {settlementsData?.pagination && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              currentPage={page}
              totalPages={settlementsData.pagination.pages}
              totalItems={settlementsData.pagination.total}
              pageSize={12}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* 5. New Trip Settlement Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Driver Wage & Trip Reconciliation Calculator"
        subtitle="Select completed unsettled journeys, calculate mileage earnings, and audit diesel variance penalties"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setSettlementForm(initialSettlementForm); // Reset explicitly on Cancel
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmSubmit}
              disabled={confirmSettlementMutation.isPending}
            >
              {confirmSettlementMutation.isPending ? 'Confirming...' : 'Confirm & Lock Settlement'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleConfirmSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Select Driver *</label>
            <select
              className="form-control"
              value={settlementForm.driver_id}
              onChange={(e) => {
                setSettlementForm({
                  ...settlementForm,
                  driver_id: e.target.value,
                  selected_journey_ids: [],
                });
              }}
              required
            >
              <option value="">Select Professional Driver</option>
              {driversData?.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.phone}) • Advance Balance: ₹{d.running_advance_balance || 0}
                </option>
              ))}
            </select>
          </div>

          {/* Pending Journeys Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Completed Unsettled Journeys ({settlementForm.selected_journey_ids.length} selected)</span>
              {trips.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (settlementForm.selected_journey_ids.length === trips.length) {
                      setSettlementForm({ ...settlementForm, selected_journey_ids: [] });
                    } else {
                      setSettlementForm({ ...settlementForm, selected_journey_ids: trips.map((j: any) => j._id) });
                    }
                  }}
                >
                  {settlementForm.selected_journey_ids.length === trips.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </label>

            {!settlementForm.driver_id ? (
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Please select a driver to inspect completed unsettled journeys.
              </div>
            ) : trips.length === 0 ? (
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                All trips for this driver are already settled in full.
              </div>
            ) : (
              <div className="settlement-trip-selector">
                {trips.map((j: any) => {
                  const isChecked = settlementForm.selected_journey_ids.includes(j._id);
                  return (
                    <div
                      key={j._id}
                      onClick={() => {
                        const newSelection = isChecked
                          ? settlementForm.selected_journey_ids.filter((id) => id !== j._id)
                          : [...settlementForm.selected_journey_ids, j._id];
                        setSettlementForm({ ...settlementForm, selected_journey_ids: newSelection });
                      }}
                      style={{
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-xs)' }}>
                            {j.journey_number} • {j.from_location?.city} → {j.to_location?.city}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {j.total_distance_kms} km • Advance: ₹{j.starting_cash_advance} • Diesel: {j.total_diesel_litres} L ({j.actual_mileage_km_per_litre || 0} km/L)
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                        {j.total_distance_kms} km
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calculator Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div className="form-group">
              <label className="form-label">Driver Wage Rate (₹ / km)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={settlementForm.rate_per_km}
                onChange={(e) => setSettlementForm({ ...settlementForm, rate_per_km: Number(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Benchmark Mileage (km / L)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={settlementForm.benchmark_mileage}
                onChange={(e) => setSettlementForm({ ...settlementForm, benchmark_mileage: Number(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Diesel Price / Litre (₹)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={settlementForm.diesel_price_per_litre}
                onChange={(e) => setSettlementForm({ ...settlementForm, diesel_price_per_litre: Number(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Other Deductions (₹)</label>
              <input
                type="number"
                className="form-control"
                value={settlementForm.other_deductions}
                onChange={(e) => setSettlementForm({ ...settlementForm, other_deductions: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Real-time Math Breakdown Ribbon */}
          <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-surface)' }}>
            <div className="settlement-calc-summary-row">
              <span>Selected Total Distance:</span>
              <span><strong>{totalDistanceKms} km</strong> @ ₹{settlementForm.rate_per_km}/km = ₹{baseEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div className="settlement-calc-summary-row">
              <span>Driver Expenses Reimbursements:</span>
              <span style={{ color: '#059669' }}>+₹{totalReimbursements.toLocaleString('en-IN')}</span>
            </div>
            <div className="settlement-calc-summary-row" style={{ fontWeight: 600 }}>
              <span>Gross Earnings:</span>
              <span>₹{grossEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div className="settlement-calc-summary-row">
              <span>Cash Advances Received:</span>
              <span style={{ color: '#dc2626' }}>-₹{totalAdvances.toLocaleString('en-IN')}</span>
            </div>
            {fuelVariancePenalty > 0 ? (
              <div className="settlement-calc-summary-row">
                <span>Diesel Mileage Variance Penalty:</span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>-₹{fuelVariancePenalty.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="settlement-calc-summary-row">
                <span>Diesel Mileage Variance:</span>
                <span style={{ color: '#059669' }}>Within benchmark (₹0 penalty)</span>
              </div>
            )}
            {Number(settlementForm.other_deductions) > 0 && (
              <div className="settlement-calc-summary-row">
                <span>Other Deductions:</span>
                <span style={{ color: '#dc2626' }}>-₹{Number(settlementForm.other_deductions).toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className={`settlement-calc-net-banner ${isPayable ? 'payable' : 'receivable'}`}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {isPayable ? `NET PAYABLE TO DRIVER: ₹${netAmount.toLocaleString('en-IN')}` : `NET RECEIVABLE FROM DRIVER: ₹${Math.abs(netAmount).toLocaleString('en-IN')}`}
                </div>
                <div style={{ fontSize: '0.75rem' }}>
                  {isPayable ? 'Company will disburse wage payout to driver' : 'Driver running cash advances exceeded earned trip wages'}
                </div>
              </div>
              <div>
                {isPayable ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Disburse Modal */}
      <Modal
        isOpen={isDisburseModalOpen}
        onClose={() => setIsDisburseModalOpen(false)}
        title={
          selectedSettlement?.settlement_type === 'payable_to_driver'
            ? `Disburse Settlement Payout: ${selectedSettlement?.settlement_number}`
            : `Record Driver Settlement Recovery: ${selectedSettlement?.settlement_number}`
        }
        subtitle={
          selectedSettlement?.settlement_type === 'payable_to_driver'
            ? `Driver: ${selectedSettlement?.driver_snapshot?.name} • Net Payable: ₹${selectedSettlement?.net_amount?.toLocaleString('en-IN')}`
            : `Driver: ${selectedSettlement?.driver_snapshot?.name} • Recoverable from Driver: ₹${Math.abs(selectedSettlement?.net_amount || 0).toLocaleString('en-IN')}`
        }
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDisburseModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDisburseSubmit}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending
                ? 'Processing...'
                : selectedSettlement?.settlement_type === 'payable_to_driver'
                ? 'Confirm Payout Disbursement'
                : 'Confirm Driver Recovery'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleDisburseSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Payment Mode</label>
            <select
              className="form-control"
              value={disburseForm.payment_mode}
              onChange={(e) => setDisburseForm({ ...disburseForm, payment_mode: e.target.value })}
            >
              <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="cash">Cash in Hand</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Bank Reference / UTR Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. UTR-55443322"
              value={disburseForm.payment_ref}
              onChange={(e) => setDisburseForm({ ...disburseForm, payment_ref: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>

      {/* 7. Printable Statement Slip Modal */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={`Trip Settlement Slip: ${selectedSettlement?.settlement_number}`}
        size="lg"
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Printer size={16} />
              <span>Print Slip</span>
            </button>
          </div>
        }
      >
        {selectedSettlement && (
          <div className="invoice-sheet" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>DRIVER TRIP SETTLEMENT SLIP</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Settlement #{selectedSettlement.settlement_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>
                  Date: {new Date(selectedSettlement.settlement_date).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Status: {selectedSettlement.payment_status?.toUpperCase()}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <strong>Driver:</strong> {selectedSettlement.driver_snapshot?.name} • <strong>Phone:</strong> {selectedSettlement.driver_snapshot?.phone} • <strong>License:</strong> {selectedSettlement.driver_snapshot?.license_number}
            </div>

            <table className="lr-table-grid">
              <thead>
                <tr>
                  <th>Journey #</th>
                  <th>Route Corridor</th>
                  <th>Distance</th>
                  <th>Advances</th>
                  <th>Reimbursements</th>
                  <th>Diesel Litres</th>
                </tr>
              </thead>
              <tbody>
                {selectedSettlement.journey_breakdowns?.map((jb: any, idx: number) => (
                  <tr key={idx}>
                    <td><strong>{jb.journey_number}</strong></td>
                    <td>{jb.from_city} → {jb.to_city}</td>
                    <td>{jb.distance_kms} km</td>
                    <td>₹{jb.advances_received}</td>
                    <td>₹{jb.reimbursements_claimed}</td>
                    <td>{jb.actual_diesel_litres} L</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-totals-box" style={{ maxWidth: '400px' }}>
              <div className="invoice-totals-row">
                <span>Total Distance ({selectedSettlement.total_kms} km):</span>
                <span>₹{Number(selectedSettlement.base_earnings || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="invoice-totals-row">
                <span>Expenses Claimed:</span>
                <span>₹{Number(selectedSettlement.total_reimbursements || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="invoice-totals-row">
                <span>Advances Deducted:</span>
                <span>-₹{Number(selectedSettlement.total_advances || 0).toLocaleString('en-IN')}</span>
              </div>
              {selectedSettlement.fuel_variance_penalty > 0 && (
                <div className="invoice-totals-row" style={{ color: '#dc2626' }}>
                  <span>Diesel Variance Penalty:</span>
                  <span>-₹{Number(selectedSettlement.fuel_variance_penalty).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="invoice-totals-row grand-total">
                <span>Net {selectedSettlement.net_amount >= 0 ? 'Payable' : 'Receivable'}:</span>
                <span>₹{Math.abs(selectedSettlement.net_amount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default SettlementListPage;
