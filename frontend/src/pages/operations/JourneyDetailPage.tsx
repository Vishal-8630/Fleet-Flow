/**
 * ============================================================================
 * FLEET FLOW — TRIP COMMAND CENTER & DETAIL VIEW (JourneyDetailPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Operational mission control for a single freight journey:
 * 1. Live transit progress visualizer and milestone timeline.
 * 2. High-precision diesel fuel logging with automatic mileage (km/L) calculus.
 * 3. Driver en-route cash expenditures (tolls, weighbridges, emergency repairs).
 * 4. Delay & incident reporting.
 * 5. Delivery closeout, final odometer verification, and POD slip viewer.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Fuel,
  FileCheck,
  Send,
  Plus,
  Truck,
  User,
  Package,
  Calendar,
  XCircle,
  ExternalLink,
  Receipt,
  Upload,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Phone,
  CreditCard,
  Wallet,
} from 'lucide-react';

export const JourneyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = role === 'admin' || role === 'dispatcher';

  // Active Tab: 'overview' | 'milestones' | 'diesel' | 'expenses' | 'pod'
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'diesel' | 'expenses' | 'pod'>('overview');

  // Modal States
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isDieselModalOpen, setIsDieselModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);

  // Modal Form States
  const [milestoneForm, setMilestoneForm] = useState({ location: '', notes: '' });
  const [dieselForm, setDieselForm] = useState({
    pump_name: '',
    slip_number: '',
    litres: '',
    rate: '',
    payment_mode: 'fuel_card',
    slip_url: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    expense_type: 'toll',
    amount: '',
    notes: '',
    receipt_url: '',
  });
  const [delayForm, setDelayForm] = useState({
    location: '',
    delay_hours: '2',
    reason: 'traffic',
    notes: '',
  });
  const [podForm, setPodForm] = useState({
    contact_name: '',
    end_odometer_kms: '',
    pod_slip_url: '',
    notes: '',
  });

  // Uploading file state
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch Journey Details
  const { data, isLoading } = useQuery({
    queryKey: ['journey-detail', id],
    queryFn: async () => {
      const res = await api.get(`/operations/journeys/${id}`);
      return res.data?.journey;
    },
    enabled: !!id,
  });

  const journey = data;

  // 2. Dispatch Mutation
  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/operations/journeys/${id}/dispatch`, {
        note: 'Vehicle flagged active from trip command center.',
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Vehicle successfully dispatched.');
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Dispatch failed.');
    },
  });

  // 3. Milestone Mutation
  const milestoneMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/journeys/${id}/milestones`, {
        current_location: milestoneForm.location,
        transit_notes: milestoneForm.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Milestone checkpoint logged.');
      setIsMilestoneModalOpen(false);
      setMilestoneForm({ location: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to log milestone.');
    },
  });

  // 4. Diesel Stop Mutation
  const dieselMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/journeys/${id}/diesel`, {
        petrol_pump_name: dieselForm.pump_name,
        slip_number: dieselForm.slip_number,
        fuel_quantity_litres: Number(dieselForm.litres),
        rate_per_litre: Number(dieselForm.rate),
        payment_mode: dieselForm.payment_mode,
        slip_image_url: dieselForm.slip_url,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Diesel fuel stop recorded.');
      setIsDieselModalOpen(false);
      setDieselForm({
        pump_name: '',
        slip_number: '',
        litres: '',
        rate: '',
        payment_mode: 'fuel_card',
        slip_url: '',
      });
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to record fuel stop.');
    },
  });

  // 5. Driver Expense Mutation
  const expenseMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/journeys/${id}/expenses`, {
        expense_type: expenseForm.expense_type,
        amount: Number(expenseForm.amount),
        notes: expenseForm.notes,
        receipt_url: expenseForm.receipt_url,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Driver expense logged.');
      setIsExpenseModalOpen(false);
      setExpenseForm({ expense_type: 'toll', amount: '', notes: '', receipt_url: '' });
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to log expense.');
    },
  });

  // 6. Delay Mutation
  const delayMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/journeys/${id}/delays`, {
        location: delayForm.location,
        delay_hours: Number(delayForm.delay_hours),
        reason: delayForm.reason,
        notes: delayForm.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Transit delay recorded.');
      setIsDelayModalOpen(false);
      setDelayForm({ location: '', delay_hours: '2', reason: 'traffic', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to record delay.');
    },
  });

  // 7. POD Closeout Mutation
  const podMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/operations/journeys/${id}/pod`, {
        contact_name: podForm.contact_name,
        end_odometer_kms: podForm.end_odometer_kms ? Number(podForm.end_odometer_kms) : undefined,
        pod_slip_url: podForm.pod_slip_url,
        notes: podForm.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Delivery acknowledged and journey closed out!');
      setIsPodModalOpen(false);
      setPodForm({ contact_name: '', end_odometer_kms: '', pod_slip_url: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['journey-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to close out journey.');
    },
  });

  // File Upload Helper (Uploads to /api/documents/upload)
  const handleFileUpload = async (file: File, targetForm: 'diesel' | 'expense' | 'pod') => {
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity_type', targetForm === 'pod' ? 'pod' : 'expenses');

      const res = await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.url) {
        if (targetForm === 'diesel') setDieselForm((prev) => ({ ...prev, slip_url: res.data.url }));
        if (targetForm === 'expense') setExpenseForm((prev) => ({ ...prev, receipt_url: res.data.url }));
        if (targetForm === 'pod') setPodForm((prev) => ({ ...prev, pod_slip_url: res.data.url }));
        toast.success('Receipt document uploaded.');
      }
    } catch (err: any) {
      toast.error('Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDoc = async (url?: string) => {
    if (!url) {
      toast.error('No document uploaded.');
      return;
    }
    if (url.includes('tenants/')) {
      try {
        const res = await api.get(`/documents/presigned-url?key=${encodeURIComponent(url)}`);
        if (res.data?.url) {
          window.open(res.data.url, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (e) {
        // Fallback
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading mission data...</div>;
  }

  if (!journey) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Journey Not Found</div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/operations/journeys')}>
          Return to Dispatch Roster
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-primary"><Navigation size={12} /> In Transit</span>;
      case 'delayed':
        return <span className="badge badge-warning"><AlertTriangle size={12} /> Delayed</span>;
      case 'draft':
        return <span className="badge badge-neutral">Draft Plan</span>;
      case 'completed':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Completed</span>;
      case 'cancelled':
        return <span className="badge badge-danger"><XCircle size={12} /> Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  // Aggregated Operational & Financial Totals
  const totalFuelCost =
    journey?.diesel_expenses?.reduce((sum: number, d: any) => sum + (d.total_cost || 0), 0) || 0;
  const avgDieselRate =
    journey?.total_diesel_litres && totalFuelCost > 0
      ? (totalFuelCost / journey.total_diesel_litres).toFixed(2)
      : '—';
  const totalDriverExpenses =
    journey?.total_driver_expenses ??
    (journey?.driver_expenses?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0);
  const startingAdvance = journey?.starting_cash_advance || 0;
  const driverCashBalance = startingAdvance - totalDriverExpenses;
  const totalDelayHours =
    journey?.delays?.reduce((sum: number, dl: any) => sum + (Number(dl.delay_hours) || 0), 0) || 0;

  const getExpenseTypeBadge = (type: string) => {
    switch (type) {
      case 'toll':
        return <span className="badge badge-primary">Toll / Fastag</span>;
      case 'weighbridge':
        return <span className="badge badge-neutral">Weighbridge</span>;
      case 'loading':
        return <span className="badge badge-info">Loading Assist</span>;
      case 'unloading':
        return <span className="badge badge-info">Unloading Tip</span>;
      case 'minor_repair':
        return <span className="badge badge-warning">Minor Repair</span>;
      case 'food_allowance':
        return <span className="badge badge-success">Food Allowance</span>;
      case 'rto_border':
        return <span className="badge badge-danger">RTO Border Entry</span>;
      default:
        return <span className="badge badge-neutral">{type?.toUpperCase() || 'Other'}</span>;
    }
  };

  const getPaymentModeBadge = (mode: string) => {
    switch (mode) {
      case 'fuel_card':
        return <span className="badge badge-primary">Fleet Fuel Card</span>;
      case 'credit':
        return <span className="badge badge-warning">Vendor Credit Slip</span>;
      case 'cash':
        return <span className="badge badge-success">Cash Advance</span>;
      default:
        return <span className="badge badge-neutral">{mode?.toUpperCase() || 'Other'}</span>;
    }
  };

  const getDelayReasonBadge = (reason: string) => {
    switch (reason) {
      case 'breakdown':
        return <span className="badge badge-danger"><AlertTriangle size={12} /> Mechanical Breakdown</span>;
      case 'traffic':
        return <span className="badge badge-warning"><Clock size={12} /> Highway Traffic</span>;
      case 'weather':
        return <span className="badge badge-info"><AlertCircle size={12} /> Adverse Weather</span>;
      case 'rto_check':
        return <span className="badge badge-danger"><ShieldCheck size={12} /> RTO / Border Hold</span>;
      default:
        return <span className="badge badge-neutral">{reason?.toUpperCase() || 'Transit Incident'}</span>;
    }
  };

  // Unified Chronological Timeline Events
  const timelineEvents = [
    ...(journey?.daily_progress || []).map((dp: any, idx: number) => ({
      id: `milestone-${idx}`,
      type: 'milestone' as const,
      date: new Date(dp.date),
      dayNumber: dp.day_number,
      location: dp.current_location,
      notes: dp.transit_notes,
    })),
    ...(journey?.delays || []).map((dl: any, idx: number) => ({
      id: `delay-${idx}`,
      type: 'delay' as const,
      date: new Date(dl.date),
      delayHours: dl.delay_hours,
      reason: dl.reason,
      location: dl.location,
      notes: dl.notes,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div>
      {/* 1. Header with Breadcrumbs & Action Toolbar */}
      <PageHeader
        title={`${journey.journey_number} — ${journey.from_location?.city} → ${journey.to_location?.city}`}
        subtitle={`Dispatched on ${new Date(journey.start_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })} • Vehicle: ${journey.truck_id?.truck_no || 'N/A'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations', href: '/operations/journeys' },
          { label: journey.journey_number },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canEdit && journey.status === 'draft' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dispatchMutation.mutate()}
                disabled={dispatchMutation.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Send size={16} /> Dispatch Vehicle
              </button>
            )}

            {canEdit && (journey.status === 'active' || journey.status === 'delayed') && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsMilestoneModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <MapPin size={14} /> Log Milestone
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDieselModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <Fuel size={14} /> Add Fuel Stop
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsExpenseModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <Receipt size={14} /> Cash Expense
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDelayModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <Clock size={14} /> Report Delay
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setPodForm((prev) => ({
                      ...prev,
                      end_odometer_kms: journey.end_odometer_kms?.toString() || '',
                    }));
                    setIsPodModalOpen(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <FileCheck size={14} /> Closeout & POD
                </button>
              </>
            )}
          </div>
        }
      />

      {/* 2. Top Metric KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--font-weight-medium)' }}>
            Current Status
          </div>
          <div style={{ marginTop: '0.5rem' }}>{getStatusBadge(journey.status)}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <MapPin size={13} color="var(--color-primary-600)" />
            <span>{journey.last_known_location || 'Origin Terminal Depot'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--font-weight-medium)' }}>
            Transit Distance
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.25rem', color: 'var(--text-main)' }}>
            {(journey.total_distance_kms || 0).toLocaleString('en-IN')} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--text-muted)' }}>KM</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Odo: {journey.start_odometer_kms?.toLocaleString('en-IN')} → {journey.end_odometer_kms ? journey.end_odometer_kms.toLocaleString('en-IN') : 'In Transit'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--font-weight-medium)' }}>
            Diesel Consumed & Economy
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.25rem', color: 'var(--text-main)' }}>
            {journey.total_diesel_litres || 0} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--text-muted)' }}>L</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-600)', fontWeight: 'var(--font-weight-semibold)', marginTop: '0.25rem' }}>
            {journey.actual_mileage_km_per_litre ? `${journey.actual_mileage_km_per_litre} km/L Verified` : 'Calculating mileage...'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--font-weight-medium)' }}>
            Starting Advance / Balance
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.25rem', color: 'var(--text-main)' }}>
            ₹{(journey.starting_cash_advance || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: driverCashBalance >= 0 ? 'var(--color-emerald-600)' : 'var(--color-danger)', fontWeight: 'var(--font-weight-semibold)', marginTop: '0.25rem' }}>
            {driverCashBalance >= 0 ? `₹${driverCashBalance.toLocaleString('en-IN')} In Hand` : `₹${Math.abs(driverCashBalance).toLocaleString('en-IN')} Advance Exceeded`}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="nav-tab-list">
        {[
          { id: 'overview', label: 'Trip Overview', icon: Navigation, count: null },
          {
            id: 'milestones',
            label: 'Milestones & Delays',
            icon: MapPin,
            count: (journey.daily_progress?.length || 0) + (journey.delays?.length || 0),
          },
          { id: 'diesel', label: 'Fuel Tracking', icon: Fuel, count: journey.diesel_expenses?.length || 0 },
          { id: 'expenses', label: 'Cash Expenses', icon: Receipt, count: journey.driver_expenses?.length || 0 },
          { id: 'pod', label: 'Proof of Delivery (POD)', icon: FileCheck, count: journey.pod_slip_url ? 1 : null },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.count !== null && <span className="nav-tab-badge">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & RESOURCES */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.5rem' }}>
          {/* Allocated Commercial Assets Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Allocated Commercial Assets</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Prime mover vehicle and primary commercial driver assigned to this manifest.
                </p>
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Truck Asset Tile */}
              <div className="operational-asset-tile">
                <div className="asset-icon-box" style={{ backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}>
                  <Truck size={24} color="var(--color-primary-600)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
                      <span style={{ backgroundColor: 'var(--color-primary-600)', color: '#ffffff', padding: '0.125rem 0.375rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em' }}>IND</span>
                      <span style={{ padding: '0.125rem 0.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-slate-900)', fontSize: 'var(--font-size-sm)' }}>
                        {journey.truck_id?.truck_no || 'N/A'}
                      </span>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>Assigned Rig</span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span><strong>Spec:</strong> {journey.truck_id?.make || 'Commercial'} {journey.truck_id?.model || ''}</span>
                    <span><strong>Body:</strong> {journey.truck_id?.body_type || 'Rigid / Trailer'}</span>
                    <span><strong>Start Odo:</strong> {journey.start_odometer_kms?.toLocaleString('en-IN')} KM</span>
                  </div>
                </div>
                {journey.truck_id?._id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/fleet/trucks/${journey.truck_id?._id}`)}
                    style={{ flexShrink: 0 }}
                  >
                    <ExternalLink size={13} /> Inspect Vehicle
                  </button>
                )}
              </div>

              {/* Driver Asset Tile */}
              <div className="operational-asset-tile">
                <div className="asset-icon-box" style={{ backgroundColor: 'var(--color-emerald-50)', border: '1px solid var(--color-emerald-200)' }}>
                  <User size={24} color="var(--color-emerald-600)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', fontSize: 'var(--font-size-base)' }}>
                      {journey.driver_id?.name || 'Unassigned Driver'}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>Verified Pilot</span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
                    <span><strong>Phone:</strong> {journey.driver_id?.phone || '—'}</span>
                    <span><strong>License:</strong> {journey.driver_id?.license_number || '—'}</span>
                  </div>
                </div>
                {journey.driver_id?._id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/fleet/drivers/${journey.driver_id?._id}`)}
                    style={{ flexShrink: 0 }}
                  >
                    <ExternalLink size={13} /> Driver Dossier
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Route & Cargo Manifest Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Route & Cargo Manifest</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Waybill corridor routing, terminal depots, and verified cargo weight.
                </p>
              </div>
            </div>

            <div className="card-body">
              {/* Route Corridor Visualizer */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Origin Terminal
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', marginTop: '0.125rem' }}>
                    {journey.from_location?.city}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-600)', marginTop: '0.25rem' }}>
                    {journey.from_location?.hub_name ? `📍 ${journey.from_location.hub_name}` : 'Main Origin Depot'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0.5rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-primary-600)', backgroundColor: 'var(--color-primary-50)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-primary-200)', marginBottom: '0.25rem' }}>
                    {journey.total_distance_kms ? `${journey.total_distance_kms} KM Corridor` : 'Direct Freight Route'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-primary-600)' }}>
                    <div style={{ width: '2rem', height: '2px', backgroundColor: 'var(--color-primary-300)' }} />
                    <ArrowRight size={18} />
                  </div>
                </div>

                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Destination Depot
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', marginTop: '0.125rem' }}>
                    {journey.to_location?.city}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-600)', marginTop: '0.25rem' }}>
                    {journey.to_location?.hub_name ? `📍 ${journey.to_location.hub_name}` : 'Main Destination Terminal'}
                  </div>
                </div>
              </div>

              {/* Cargo & Commercial Specifications Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '0.75rem' }}>
                <div className="metric-tile">
                  <div className="metric-tile-label">Commodity</div>
                  <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={journey.cargo_description || 'General Cargo'}>
                    {journey.cargo_description || 'General Cargo'}
                  </div>
                </div>

                <div className="metric-tile">
                  <div className="metric-tile-label">Payload Weight</div>
                  <div className="metric-tile-value">
                    {journey.loaded_weight_tonnes || 0} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'normal' }}>Tonnes</span>
                  </div>
                </div>

                <div className="metric-tile">
                  <div className="metric-tile-label">Volume CBM</div>
                  <div className="metric-tile-value">
                    {journey.cbm_volume ? `${journey.cbm_volume}` : '—'} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'normal' }}>{journey.cbm_volume ? 'CBM' : ''}</span>
                  </div>
                </div>

                <div className="metric-tile" style={{ backgroundColor: 'var(--color-emerald-50)', borderColor: 'var(--color-emerald-200)' }}>
                  <div className="metric-tile-label" style={{ color: 'var(--color-emerald-700)' }}>Agreed Freight</div>
                  <div className="metric-tile-value" style={{ color: 'var(--color-emerald-700)' }}>
                    ₹{(journey.freight_rate || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONES & DELAYS */}
      {activeTab === 'milestones' && (
        <div className="journey-timeline-grid">
          {/* Left Column: Chronological Transit Timeline */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Chronological Transit Milestones & Issue Logs</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Driver check-ins, highway toll crossings, and en-route incident records.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsMilestoneModalOpen(true)}
                >
                  <Plus size={14} /> Check-In Location
                </button>
              )}
            </div>

            <div className="card-body">
              {timelineEvents.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MapPin size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>No Transit Milestones Logged</div>
                  <p style={{ fontSize: 'var(--font-size-xs)', margin: '0.25rem 0 1rem 0' }}>
                    Track highway toll crossings, en-route checkpoints, and transit delays as the vehicle travels.
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsMilestoneModalOpen(true)}
                    >
                      Log First Checkpoint Now
                    </button>
                  )}
                </div>
              ) : (
                <div className="timeline-track">
                  {timelineEvents.map((event) => {
                    if (event.type === 'milestone') {
                      return (
                        <div key={event.id} className="timeline-card" style={{ position: 'relative' }}>
                          <div className="timeline-dot" style={{ backgroundColor: 'var(--color-primary-600)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span className="badge badge-primary">Day {event.dayNumber} Checkpoint</span>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              {event.date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={16} color="var(--color-primary-600)" />
                            {event.location}
                          </div>
                          {event.notes && (
                            <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-slate-50)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                              <strong>Driver Notes:</strong> {event.notes}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div key={event.id} className="timeline-card-delay" style={{ position: 'relative' }}>
                          <div className="timeline-dot" style={{ backgroundColor: 'var(--color-warning-500)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className="badge badge-warning">
                                <AlertTriangle size={12} /> Delay: {event.delayHours} Hours
                              </span>
                              {getDelayReasonBadge(event.reason || '')}
                            </div>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)' }}>
                              {event.date.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                            Incident Location: {event.location}
                          </div>
                          {event.notes && (
                            <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)' }}>
                              <strong>Technician / Driver Action:</strong> {event.notes}
                            </div>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Route Corridor Status & Incident Console */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Live Transit Corridor Status Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Navigation size={18} color="var(--color-primary-600)" />
                  Corridor Status & Position
                </h3>
              </div>
              <div className="card-body">
                <div style={{ backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Known Active Checkpoint
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-900)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <MapPin size={16} />
                    {journey.last_known_location || 'Origin Hub Terminal'}
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div className="metric-tile">
                    <div className="metric-tile-label">Milestones Logged</div>
                    <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                      {journey.daily_progress?.length || 0}
                    </div>
                  </div>

                  <div className="metric-tile">
                    <div className="metric-tile-label">Delays Logged</div>
                    <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)', color: totalDelayHours > 0 ? 'var(--color-warning-600)' : 'var(--text-main)' }}>
                      {journey.delays?.length || 0}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setIsMilestoneModalOpen(true)}
                      style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                    >
                      <MapPin size={14} /> + Checkpoint
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsDelayModalOpen(true)}
                      style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                    >
                      <Clock size={14} /> + Report Delay
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Delay & SLA Impact Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--color-warning-600)" />
                  Transit Impact & SLA Health
                </h3>
              </div>
              <div className="card-body">
                {totalDelayHours > 0 ? (
                  <div style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning-text)' }}>
                      <AlertTriangle size={16} /> Total Delay Incurred: {totalDelayHours} Hours
                    </div>
                    <p style={{ margin: '0.375rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', lineHeight: 1.5 }}>
                      Shipment timetable has experienced holding delays. Consignee notifications recommended if arrival exceeds buffer hours.
                    </p>
                  </div>
                ) : (
                  <div style={{ backgroundColor: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success-text)' }}>
                      <CheckCircle2 size={16} /> Zero Highway Delays
                    </div>
                    <p style={{ margin: '0.375rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-success-text)' }}>
                      Transit is proceeding without reported mechanical or road congestion holds.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DIESEL FUEL STOPS */}
      {activeTab === 'diesel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Diesel KPI Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Total Diesel Filled</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                {journey.total_diesel_litres || 0} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--text-muted)' }}>Litres</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Across {journey.diesel_expenses?.length || 0} highway fuel stops
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Total Fuel Expense</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                ₹{totalFuelCost.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Total pump slip settlements
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Average Diesel Rate</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                ₹{avgDieselRate} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--text-muted)' }}>/ L</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Highway fuel station weighted avg
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Trip Fuel Economy</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-primary-600)' }}>
                {journey.actual_mileage_km_per_litre ? `${journey.actual_mileage_km_per_litre} km/L` : 'In Progress'}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Based on {journey.total_distance_kms || 0} KM covered
              </div>
            </div>
          </div>

          {/* En-Route Diesel Table Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">En-Route Diesel Fuel Replenishment</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Highway fuel card swipes, pump slips, and commercial rate audits.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsDieselModalOpen(true)}
                >
                  <Plus size={14} /> Record Diesel Stop
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Filling Date</th>
                    <th>Petrol Pump Station</th>
                    <th>Slip #</th>
                    <th>Quantity (L)</th>
                    <th>Rate / Litre</th>
                    <th>Total Cost</th>
                    <th>Payment Mode</th>
                    <th>Slip Image</th>
                  </tr>
                </thead>
                <tbody>
                  {!journey.diesel_expenses || journey.diesel_expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                        <Fuel size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 0.75rem auto' }} />
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>No Diesel Fuel Stops Logged</div>
                        <p style={{ fontSize: 'var(--font-size-xs)', margin: '0.25rem 0 1rem 0' }}>
                          Log highway fuel card transactions, diesel slips, and quantity in liters to monitor fleet mileage.
                        </p>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsDieselModalOpen(true)}
                          >
                            Record First Fuel Stop Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    journey.diesel_expenses.map((d: any, idx: number) => (
                      <tr key={idx}>
                        <td>{new Date(d.filling_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                        <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Fuel size={14} color="var(--color-primary-600)" />
                            {d.petrol_pump_name}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-slate-100)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-xs)' }}>
                            {d.slip_number || 'N/A'}
                          </span>
                        </td>
                        <td><strong>{d.fuel_quantity_litres} L</strong></td>
                        <td>₹{d.rate_per_litre}</td>
                        <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                          ₹{d.total_cost?.toLocaleString('en-IN')}
                        </td>
                        <td>{getPaymentModeBadge(d.payment_mode)}</td>
                        <td>
                          {d.slip_image_url ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                              onClick={() => handleViewDoc(d.slip_image_url)}
                            >
                              <ExternalLink size={12} /> View Slip
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CASH EXPENSES */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Cash Advance Reconciliation Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Starting Cash Advance</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                ₹{startingAdvance.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Issued to driver at departure depot
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="metric-tile-label">Total Logged Expenses</div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                ₹{totalDriverExpenses.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Tolls, weighbridges, tipping & repairs
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: driverCashBalance >= 0 ? 'var(--color-emerald-50)' : 'var(--color-rose-50)', borderColor: driverCashBalance >= 0 ? 'var(--color-emerald-200)' : 'var(--color-rose-200)' }}>
              <div className="metric-tile-label" style={{ color: driverCashBalance >= 0 ? 'var(--color-emerald-700)' : 'var(--color-rose-700)' }}>
                Driver Cash Balance in Hand
              </div>
              <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-xl)', color: driverCashBalance >= 0 ? 'var(--color-emerald-700)' : 'var(--color-rose-700)' }}>
                ₹{driverCashBalance.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: driverCashBalance >= 0 ? 'var(--color-emerald-600)' : 'var(--color-rose-600)', marginTop: '0.25rem', fontWeight: 'var(--font-weight-medium)' }}>
                {driverCashBalance >= 0 ? '✓ Advance surplus to return at depot' : '⚠️ Deficit — driver reimbursement due'}
              </div>
            </div>
          </div>

          {/* Driver Cash Expense Ledger Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Driver Cash Expenditures & Toll Vouchers</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Fastag recharges, weighbridge slips, port entry, and en-route emergency repair receipts.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsExpenseModalOpen(true)}
                >
                  <Plus size={14} /> Log Cash Expense
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Expense Category</th>
                    <th>Amount</th>
                    <th>Observations / Notes</th>
                    <th>Receipt Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {!journey.driver_expenses || journey.driver_expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                        <Receipt size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 0.75rem auto' }} />
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>No Driver Expenses Logged</div>
                        <p style={{ fontSize: 'var(--font-size-xs)', margin: '0.25rem 0 1rem 0' }}>
                          Log highway tolls, Dharam Kanta weighbridge slips, and maintenance vouchers to reconcile driver cash advances.
                        </p>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsExpenseModalOpen(true)}
                          >
                            Log First Cash Expense Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    journey.driver_expenses.map((exp: any, idx: number) => (
                      <tr key={idx}>
                        <td>{new Date(exp.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                        <td>{getExpenseTypeBadge(exp.expense_type)}</td>
                        <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                          ₹{exp.amount?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ color: exp.notes ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {exp.notes || '—'}
                        </td>
                        <td>
                          {exp.receipt_url ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                              onClick={() => handleViewDoc(exp.receipt_url)}
                            >
                              <ExternalLink size={12} /> View Voucher
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROOF OF DELIVERY (POD) */}
      {activeTab === 'pod' && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.5rem', alignItems: 'stretch' }}>
          {/* Consignee Handover & Odometer Verification Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Consignee Handover & Closeout Audit</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Destination receiver details, final odometer verification, and cargo condition.
                </p>
              </div>
              {canEdit && journey.status !== 'completed' && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsPodModalOpen(true)}
                >
                  <FileCheck size={14} /> Closeout Trip
                </button>
              )}
            </div>

            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Delivery Status Banner */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: journey.delivery_status === 'delivered' ? 'var(--color-success-bg)' : 'var(--color-primary-50)',
                  border: `1px solid ${journey.delivery_status === 'delivered' ? 'var(--color-success-border)' : 'var(--color-primary-200)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                {journey.delivery_status === 'delivered' ? (
                  <>
                    <CheckCircle2 size={24} color="var(--color-emerald-600)" />
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-emerald-700)' }}>
                        Delivery Completed & Acknowledged
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-emerald-600)' }}>
                        Cargo handed over to consignee and voyage marked complete.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock size={24} color="var(--color-primary-600)" />
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>
                        Awaiting Destination Consignee Handover
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-600)' }}>
                        Trip is in transit. Upload consignee-stamped POD slip upon arrival to close out voyage.
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Consignee Receiver Details */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
                <div className="metric-tile">
                  <div className="metric-tile-label">Consignee Contact Name</div>
                  <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {journey.delivered_to?.contact_name || 'Pending Acknowledgment'}
                  </div>
                </div>

                <div className="metric-tile">
                  <div className="metric-tile-label">Delivery Timestamp</div>
                  <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {journey.delivered_to?.delivery_timestamp
                      ? new Date(journey.delivered_to.delivery_timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                      : 'Pending Arrival'}
                  </div>
                </div>
              </div>

              {/* Delivery Observations */}
              {journey.delivered_to?.notes && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-slate-50)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-muted)' }}>
                    Consignee Observations:
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {journey.delivered_to.notes}
                  </div>
                </div>
              )}

              {/* Odometer Reconciliation Grid */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                  Odometer Journey Audit
                </div>
                <div className="grid grid-cols-3" style={{ gap: '0.75rem' }}>
                  <div className="metric-tile">
                    <div className="metric-tile-label">Start Odo</div>
                    <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {journey.start_odometer_kms?.toLocaleString('en-IN')} KM
                    </div>
                  </div>
                  <div className="metric-tile">
                    <div className="metric-tile-label">Arrival Odo</div>
                    <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {journey.end_odometer_kms ? `${journey.end_odometer_kms.toLocaleString('en-IN')} KM` : 'In Transit'}
                    </div>
                  </div>
                  <div className="metric-tile" style={{ backgroundColor: 'var(--color-primary-50)', borderColor: 'var(--color-primary-200)' }}>
                    <div className="metric-tile-label" style={{ color: 'var(--color-primary-700)' }}>Transit Dist.</div>
                    <div className="metric-tile-value" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-700)' }}>
                      {journey.total_distance_kms ? `${journey.total_distance_kms.toLocaleString('en-IN')} KM` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Digital Proof of Delivery (POD) Document Vault */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3 className="card-title">Digital POD Document Verification</h3>
            </div>

            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {journey.pod_slip_url ? (
                <div
                  style={{
                    backgroundColor: 'var(--color-emerald-50)',
                    border: '1.5px solid var(--color-emerald-200)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '4rem',
                      height: '4rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-emerald-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.25rem auto',
                    }}
                  >
                    <FileCheck size={36} color="var(--color-emerald-600)" />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-emerald-900)' }}>
                    Signed Physical POD Document on File
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-emerald-700)', maxWidth: '28rem', margin: '0.5rem auto 1.5rem auto', lineHeight: 1.5 }}>
                    The consignee acknowledgment has been verified and securely archived in tenant cloud vault.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleViewDoc(journey.pod_slip_url)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <ExternalLink size={16} /> Inspect Signed POD Document
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '4rem',
                      height: '4rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-slate-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.25rem auto',
                    }}
                  >
                    <FileCheck size={36} color="var(--color-slate-500)" />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                    POD Slip Awaiting Upload
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', maxWidth: '26rem', margin: '0.5rem auto 1.5rem auto', lineHeight: 1.5 }}>
                    Once vehicle unloads at {journey.to_location?.city}, obtain consignee stamp and signature, then complete closeout to release vehicle and driver.
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setIsPodModalOpen(true)}
                    >
                      Complete Delivery & Upload POD Slip
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* MODAL 1: LOG MILESTONE */}
      <Modal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        title="Record Transit Milestone"
        subtitle="Log current highway checkpoint and transit progress notes."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            milestoneMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">
              Current Location / Toll Checkpoint <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Surat Ring Road Toll, Gujarat"
              className="form-control"
              value={milestoneForm.location}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, location: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Observations / Notes</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Traffic clear. Target arrival tomorrow morning."
              value={milestoneForm.notes}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setMilestoneForm({ location: '', notes: '' });
                setIsMilestoneModalOpen(false);
              }}
              disabled={milestoneMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={milestoneMutation.isPending}>
              {milestoneMutation.isPending ? 'Saving...' : 'Record Milestone'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD DIESEL FUEL STOP */}
      <Modal
        isOpen={isDieselModalOpen}
        onClose={() => setIsDieselModalOpen(false)}
        title="Record Diesel Fuel Stop"
        subtitle="Log fuel pump slip details, liters, and rate."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dieselMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">
              Petrol Pump / Fuel Station Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. HPCL Highway Fuel Stop, Surat"
              className="form-control"
              value={dieselForm.pump_name}
              onChange={(e) => setDieselForm({ ...dieselForm, pump_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fuel Slip / Bill Number</label>
              <input
                type="text"
                placeholder="e.g. SLIP-10294"
                className="form-control"
                value={dieselForm.slip_number}
                onChange={(e) => setDieselForm({ ...dieselForm, slip_number: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={dieselForm.payment_mode}
                onChange={(e) => setDieselForm({ ...dieselForm, payment_mode: e.target.value })}
              >
                <option value="fuel_card">Fuel Card (HPCL/BPCL DriveTrack)</option>
                <option value="credit">Pump Vendor Credit (Ledger Slip)</option>
                <option value="cash">Driver Cash Advance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Fuel Quantity (Litres) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 120.5"
                className="form-control"
                value={dieselForm.litres}
                onChange={(e) => setDieselForm({ ...dieselForm, litres: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Rate Per Litre (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 91.50"
                className="form-control"
                value={dieselForm.rate}
                onChange={(e) => setDieselForm({ ...dieselForm, rate: e.target.value })}
                required
              />
            </div>
          </div>

          {dieselForm.litres && dieselForm.rate && (
            <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: 'var(--font-size-xs)' }}>
              Total Fuel Cost: <strong>₹{(Number(dieselForm.litres) * Number(dieselForm.rate)).toFixed(2)}</strong>
            </div>
          )}

          {/* Upload Slip Document */}
          <div className="form-group">
            <label className="form-label">Upload Pump Receipt Slip (Optional)</label>
            <input
              type="file"
              className="form-control"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'diesel');
              }}
              disabled={isUploading}
            />
            {isUploading && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-600)' }}>Uploading voucher...</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDieselForm({ pump_name: '', slip_number: '', litres: '', rate: '', payment_mode: 'fuel_card', slip_url: '' });
                setIsDieselModalOpen(false);
              }}
              disabled={dieselMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={dieselMutation.isPending || isUploading}>
              {dieselMutation.isPending ? 'Saving...' : 'Record Fuel Stop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: LOG CASH EXPENSE */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Driver Cash Expense"
        subtitle="Log en-route tolls, weighbridge, repairs, and driver vouchers."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            expenseMutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Expense Category</label>
              <select
                className="form-control"
                value={expenseForm.expense_type}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
              >
                <option value="toll">Highway Toll / Fastag</option>
                <option value="weighbridge">Weighbridge (Dharam Kanta)</option>
                <option value="loading">Loading Assistance</option>
                <option value="unloading">Unloading Tipping</option>
                <option value="minor_repair">Minor Mechanical Repair / Puncture</option>
                <option value="food_allowance">Driver Food Allowance</option>
                <option value="rto_border">RTO Border Tax Entry</option>
                <option value="other">Other Operational Expense</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Amount (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                className="form-control"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observations / Notes</label>
            <input
              type="text"
              placeholder="e.g. Fastag blacklisted emergency toll cash"
              className="form-control"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Upload Receipt Voucher (Optional)</label>
            <input
              type="file"
              className="form-control"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'expense');
              }}
              disabled={isUploading}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setExpenseForm({ expense_type: 'toll', amount: '', notes: '', receipt_url: '' });
                setIsExpenseModalOpen(false);
              }}
              disabled={expenseMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={expenseMutation.isPending || isUploading}>
              {expenseMutation.isPending ? 'Saving...' : 'Log Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: REPORT DELAY */}
      <Modal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        title="Report Transit Delay"
        subtitle="Document en-route slowdowns, breakdown holds, or weather incidents."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            delayMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">
              Incident Location <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Kotputli Highway Bypass"
              className="form-control"
              value={delayForm.location}
              onChange={(e) => setDelayForm({ ...delayForm, location: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Estimated Delay (Hours)</label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 3.5"
                className="form-control"
                value={delayForm.delay_hours}
                onChange={(e) => setDelayForm({ ...delayForm, delay_hours: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Primary Cause</label>
              <select
                className="form-control"
                value={delayForm.reason}
                onChange={(e) => setDelayForm({ ...delayForm, reason: e.target.value })}
              >
                <option value="traffic">Traffic Gridlock</option>
                <option value="breakdown">Mechanical Breakdown</option>
                <option value="weather">Severe Weather / Rain</option>
                <option value="rto_check">RTO / Border Checkpoint Hold</option>
                <option value="other">Other Unforeseen Delay</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Details & Driver Action Taken</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Radiator leak attended by highway technician. Resuming in 2 hours."
              value={delayForm.notes}
              onChange={(e) => setDelayForm({ ...delayForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDelayForm({ location: '', delay_hours: '2', reason: 'traffic', notes: '' });
                setIsDelayModalOpen(false);
              }}
              disabled={delayMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={delayMutation.isPending}>
              {delayMutation.isPending ? 'Logging Delay...' : 'Record Delay Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: COMPLETE DELIVERY & POD */}
      <Modal
        isOpen={isPodModalOpen}
        onClose={() => setIsPodModalOpen(false)}
        title="Complete Delivery & Upload POD"
        subtitle="Confirm arrival at destination, verify final odometer, and upload signed POD slip."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            podMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">Consignee Receiver / Contact Name</label>
            <input
              type="text"
              placeholder="e.g. Anil Sharma (Warehouse Manager)"
              className="form-control"
              value={podForm.contact_name}
              onChange={(e) => setPodForm({ ...podForm, contact_name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Arrival Final Odometer (KM) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="number"
              placeholder={`Must be ≥ start odometer (${journey.start_odometer_kms} km)`}
              className="form-control"
              value={podForm.end_odometer_kms}
              onChange={(e) => setPodForm({ ...podForm, end_odometer_kms: e.target.value })}
              required
            />
            <span className="form-hint">Vehicle master odometer will automatically update to this reading.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Upload Signed Proof of Delivery (POD) Slip</label>
            <input
              type="file"
              className="form-control"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'pod');
              }}
              disabled={isUploading}
            />
            {podForm.pod_slip_url && (
              <div style={{ marginTop: '0.375rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-emerald-600)' }}>
                ✓ Document uploaded successfully.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Delivery Observations / Cargo Condition</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Received intact without shortages or damages."
              value={podForm.notes}
              onChange={(e) => setPodForm({ ...podForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPodForm({ contact_name: '', end_odometer_kms: '', pod_slip_url: '', notes: '' });
                setIsPodModalOpen(false);
              }}
              disabled={podMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={podMutation.isPending || isUploading}>
              {podMutation.isPending ? 'Completing...' : 'Confirm Delivery & Close Trip'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
