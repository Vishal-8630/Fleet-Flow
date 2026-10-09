/**
 * ============================================================================
 * FLEET FLOW — TRIP DISPATCH & JOURNEYS ROSTER (JourneyListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Central operational dispatch command center displaying all active, planned,
 * delayed, and completed commercial trips.
 * 
 * KEY CAPABILITIES:
 * -----------------
 * 1. Operational Fleet KPIs: Real-time active convoys, delayed vehicles,
 *    monthly delivery completions, and fleet fuel economy (km/L).
 * 2. Multi-Criteria Status Tabs: All, Active, Delayed, Draft, Completed.
 * 3. Search & Route Filtering: Filter by Journey #, Origin, Destination, Vehicle.
 * 4. Quick Dispatch & Milestone Modals: Update location milestones directly
 *    from the roster without leaving the page.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  ArrowRight,
  MapPin,
  Eye,
  Send,
  Fuel,
  FileCheck,
  XCircle,
} from 'lucide-react';

export const JourneyListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = role === 'admin' || role === 'dispatcher';

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Milestone Modal state
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [milestoneLocation, setMilestoneLocation] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  // 1. Fetch Journey Metrics
  const { data: metrics } = useQuery({
    queryKey: ['journey-metrics'],
    queryFn: async () => {
      const res = await api.get('/operations/journeys/metrics');
      return res.data;
    },
  });

  // 2. Fetch Journeys List
  const { data: journeysData, isLoading } = useQuery({
    queryKey: ['journeys', page, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        status: statusFilter,
        search: searchQuery,
      });
      const res = await api.get(`/operations/journeys?${params.toString()}`);
      return res.data;
    },
  });

  // 3. Quick Dispatch Mutation
  const dispatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/operations/journeys/${id}/dispatch`, {
        note: 'Dispatched via quick roster action.',
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Vehicle dispatched successfully.');
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
      queryClient.invalidateQueries({ queryKey: ['journey-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Dispatch failed.');
    },
  });

  // 4. Quick Milestone Mutation
  const milestoneMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJourneyId) return;
      const res = await api.post(`/operations/journeys/${selectedJourneyId}/milestones`, {
        current_location: milestoneLocation,
        transit_notes: milestoneNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Location milestone logged successfully.');
      setIsMilestoneModalOpen(false);
      setMilestoneLocation('');
      setMilestoneNotes('');
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to log milestone.');
    },
  });

  const handleOpenMilestoneModal = (journey: any) => {
    setSelectedJourneyId(journey._id);
    setIsMilestoneModalOpen(true);
  };

  const handleCancelMilestone = () => {
    setMilestoneLocation('');
    setMilestoneNotes('');
    setIsMilestoneModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Navigation size={12} /> In Transit
          </span>
        );
      case 'delayed':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> Delayed
          </span>
        );
      case 'draft':
        return <span className="badge badge-neutral">Draft Plan</span>;
      case 'completed':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      {/* 1. Header */}
      <PageHeader
        title="Trip Dispatch & Operations"
        subtitle="Live convoy coordination, en-route milestone logging, fuel auditing, and delivery closeouts."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Trip Dispatch' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/operations/journeys/new')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Plan New Journey
            </button>
          ) : undefined
        }
      />

      {/* 2. Operational KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>In-Transit Fleet</span>
            <Navigation size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--text-main)' }}>
            {metrics?.activeJourneys || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Actively dispatched on highway
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Transit Delays</span>
            <Clock size={20} color="var(--color-amber-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-amber-600)' }}>
            {metrics?.delayedJourneys || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Reported traffic, breakdown or RTO hold
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Delivered This Month</span>
            <CheckCircle2 size={20} color="var(--color-emerald-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-emerald-600)' }}>
            {metrics?.completedThisMonth || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Signed POD acknowledged
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Fleet Fuel Economy</span>
            <Fuel size={20} color="var(--color-indigo-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--text-main)' }}>
            {metrics?.averageMileageKmPerLitre || 0} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal' }}>km/L</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {metrics?.totalDieselLitres?.toLocaleString() || 0} L diesel consumed
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Tab Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Journeys' },
              { id: 'active', label: 'In Transit' },
              { id: 'delayed', label: 'Delayed' },
              { id: 'draft', label: 'Draft Plans' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
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
              placeholder="Search by Journey #, Route, Cargo..."
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

      {/* 4. Journeys Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Journey ID</th>
                <th>Commercial Asset</th>
                <th>Assigned Driver</th>
                <th>Freight Route</th>
                <th>Departure / Duration</th>
                <th>Status</th>
                <th>Last Checkpoint</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading dispatch roster...
                  </td>
                </tr>
              ) : !journeysData?.journeys || journeysData.journeys.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No trips match your current filter criteria.
                  </td>
                </tr>
              ) : (
                journeysData.journeys.map((j: any) => (
                  <tr key={j._id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/operations/journeys/${j._id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary-600)',
                          fontWeight: 'var(--font-weight-bold)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-sm)',
                          textAlign: 'left',
                        }}
                      >
                        {j.journey_number}
                      </button>
                      {j.billing_party_id?.name && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {j.billing_party_id.name}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                        {j.truck_id?.truck_no || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {j.truck_id ? `${j.truck_id.make} ${j.truck_id.model}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>
                        {j.driver_id?.name || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {j.driver_id?.phone || ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 'var(--font-weight-semibold)' }}>
                        <span>{j.from_location?.city}</span>
                        <ArrowRight size={14} color="var(--text-muted)" />
                        <span>{j.to_location?.city}</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {j.cargo_description || `${j.loaded_weight_tonnes || 0} tonnes`}
                      </div>
                    </td>
                    <td>
                      <div>{new Date(j.start_date).toLocaleDateString()}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        Est. {j.estimated_duration_days} days
                      </div>
                    </td>
                    <td>{getStatusBadge(j.status)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-xs)' }}>
                        <MapPin size={12} color="var(--color-primary-600)" />
                        <span>{j.last_known_location || 'Pending departure'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.375rem 0.625rem', fontSize: 'var(--font-size-xs)' }}
                          onClick={() => navigate(`/operations/journeys/${j._id}`)}
                          title="View Journey Details"
                        >
                          <Eye size={14} />
                        </button>

                        {canEdit && j.status === 'draft' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.375rem 0.625rem', fontSize: 'var(--font-size-xs)' }}
                            onClick={() => dispatchMutation.mutate(j._id)}
                            disabled={dispatchMutation.isPending}
                            title="Dispatch Vehicle Now"
                          >
                            <Send size={14} />
                          </button>
                        )}

                        {canEdit && (j.status === 'active' || j.status === 'delayed') && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.375rem 0.625rem', fontSize: 'var(--font-size-xs)' }}
                            onClick={() => handleOpenMilestoneModal(j)}
                            title="Log Location Milestone"
                          >
                            <MapPin size={14} />
                          </button>
                        )}

                        {j.status === 'completed' && j.pod_slip_url && (
                          <span title="POD Available" style={{ color: 'var(--color-emerald-600)' }}>
                            <FileCheck size={16} />
                          </span>
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
          currentPage={journeysData?.page || 1}
          totalPages={journeysData?.totalPages || 1}
          totalItems={journeysData?.total || 0}
          pageSize={15}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* 6. Quick Milestone Update Modal */}
      <Modal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        title="Log Transit Milestone"
        subtitle="Record the real-time physical checkpoint or highway location of the convoy."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            milestoneMutation.mutate();
          }}
        >
          <div className="form-group">
            <label className="form-label">
              Current Location / Checkpoint <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Surat Ring Road Toll, Gujarat"
              value={milestoneLocation}
              onChange={(e) => setMilestoneLocation(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Transit Observations / Driver Notes</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Fuel replenished at highway plaza. Cargo intact."
              value={milestoneNotes}
              onChange={(e) => setMilestoneNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelMilestone}
              disabled={milestoneMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={milestoneMutation.isPending}
            >
              {milestoneMutation.isPending ? 'Saving...' : 'Record Milestone'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
