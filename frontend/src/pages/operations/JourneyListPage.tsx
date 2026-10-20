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
import { useTableColumnVisibility } from '../../hooks/useTableColumnVisibility';
import { TableColumnVisibilityMenu } from '../../components/common/TableColumnVisibilityMenu';
import { ITableColumnConfig } from '../../types/table';

const JOURNEY_TABLE_COLUMNS: ITableColumnConfig[] = [
  { id: 'journey_id', label: 'Journey ID', isDefaultVisible: true, isRequired: true, description: 'Trip sequence number and commercial customer tag' },
  { id: 'origin_branch', label: 'Origin Branch', isDefaultVisible: true, isRequired: false, description: 'Originating regional branch assignment' },
  { id: 'commercial_asset', label: 'Commercial Asset', isDefaultVisible: true, isRequired: false, description: 'Assigned transport rig and vehicle specs' },
  { id: 'driver', label: 'Assigned Driver', isDefaultVisible: true, isRequired: false, description: 'Professional driver identity and contact phone' },
  { id: 'route', label: 'Freight Route', isDefaultVisible: true, isRequired: false, description: 'Origin to destination corridor' },
  { id: 'departure', label: 'Departure / Duration', isDefaultVisible: true, isRequired: false, description: 'Dispatch timestamp and transit duration' },
  { id: 'status', label: 'Status', isDefaultVisible: true, isRequired: true, description: 'Real-time transit lifecycle status' },
  { id: 'checkpoint', label: 'Last Checkpoint', isDefaultVisible: false, isRequired: false, description: 'Most recent milestone check-in' },
  { id: 'actions', label: 'Actions', isDefaultVisible: true, isRequired: true, description: 'Trip inspection and dispatch actions' },
];

export const JourneyListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuthStore();
  const canEdit = role === 'admin' || role === 'dispatcher';

  // Table Column Visibility hook
  const columnVisibility = useTableColumnVisibility('journey_list', JOURNEY_TABLE_COLUMNS, user?.id);

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('');
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

  // 1.5 Fetch company branches for operational filtering (DEC-010)
  const { data: branchesData } = useQuery({
    queryKey: ['company-branches'],
    queryFn: async () => {
      const res = await api.get('/company/branches');
      return res.data?.branches || [];
    },
  });

  const activeBranches = Array.isArray(branchesData)
    ? branchesData.filter((b: any) => b.is_active)
    : [];

  // 2. Fetch Journeys List
  const { data: journeysData, isLoading } = useQuery({
    queryKey: ['journeys', page, statusFilter, searchQuery, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        status: statusFilter,
        search: searchQuery,
      });
      if (branchFilter) {
        params.append('branch_id', branchFilter);
      }
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
      queryClient.invalidateQueries({ queryKey: ['available-trucks'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['active-drivers'] });
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
      queryClient.invalidateQueries({ queryKey: ['journey-metrics'] });
      if (selectedJourneyId) {
        queryClient.invalidateQueries({ queryKey: ['journey-detail', selectedJourneyId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to log milestone.');
    },
  });

  const handleOpenMilestoneModal = (journey: any) => {
    if (journey.status !== 'active' && journey.status !== 'delayed') {
      toast.error(`Cannot log milestone: Journey is ${journey.status}.`);
      return;
    }
    if (journey.is_settled) {
      toast.error('Cannot log milestone: Journey has already been settled.');
      return;
    }
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
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', overflow: 'visible', position: 'relative', zIndex: 20 }}>
        <div className="filter-toolbar">
          {/* Status Tabs */}
          <div className="tab-bar-scroll" style={{ flex: 1, minWidth: 0 }}>
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
                style={{ fontSize: 'var(--font-size-xs)', padding: '0.375rem 0.75rem', whiteSpace: 'nowrap' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Branch & Search Controls */}
          <div className="filter-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {activeBranches.length > 0 && (
              <select
                className="form-control"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                style={{ fontSize: 'var(--font-size-xs)', height: '38px', minWidth: '160px', padding: '0.375rem 0.75rem' }}
              >
                <option value="">All Branches</option>
                {activeBranches.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.branch_name} ({b.branch_code})
                  </option>
                ))}
              </select>
            )}

            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by Journey #, Route, Cargo..."
                className="form-control"
                style={{ paddingLeft: '2.25rem', width: '100%' }}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <TableColumnVisibilityMenu
              columns={JOURNEY_TABLE_COLUMNS}
              visibleColumns={columnVisibility.visibleColumns}
              isVisible={columnVisibility.isVisible}
              toggleColumn={columnVisibility.toggleColumn}
              resetToDefaults={columnVisibility.resetToDefaults}
              showAllColumns={columnVisibility.showAllColumns}
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
                {columnVisibility.isVisible('journey_id') && <th>Journey ID</th>}
                {columnVisibility.isVisible('origin_branch') && <th>Origin Branch</th>}
                {columnVisibility.isVisible('commercial_asset') && <th>Commercial Asset</th>}
                {columnVisibility.isVisible('driver') && <th>Assigned Driver</th>}
                {columnVisibility.isVisible('route') && <th>Freight Route</th>}
                {columnVisibility.isVisible('departure') && <th>Departure / Duration</th>}
                {columnVisibility.isVisible('status') && <th>Status</th>}
                {columnVisibility.isVisible('checkpoint') && <th>Last Checkpoint</th>}
                {columnVisibility.isVisible('actions') && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columnVisibility.visibleCount || 9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading dispatch roster...
                  </td>
                </tr>
              ) : !journeysData?.journeys || journeysData.journeys.length === 0 ? (
                <tr>
                  <td colSpan={columnVisibility.visibleCount || 9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No trips match your current filter criteria.
                  </td>
                </tr>
              ) : (
                journeysData.journeys.map((j: any) => (
                  <tr key={j._id}>
                    {columnVisibility.isVisible('journey_id') && (
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
                        {(() => {
                          if (j.billing_party_id?.name) {
                            return (
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                {j.billing_party_id.name}
                              </div>
                            );
                          }

                          // Multi-Billing-Party or derived from attached LRs
                          const distinctParties: string[] = Array.from(
                            new Set<string>(
                              (j.lr_ids || [])
                                .map((lr: any) => (lr?.billing_party_id?.name || lr?.billing_party_name || '') as string)
                                .filter(Boolean)
                            )
                          );

                          if (distinctParties.length > 1) {
                            return (
                              <div style={{ marginTop: '0.25rem' }}>
                                <span
                                  className="badge badge-info"
                                  style={{ fontSize: '0.6875rem' }}
                                  title={`Carrying consignments for: ${distinctParties.join(', ')}`}
                                >
                                  Multi-Customer ({distinctParties.length} Parties)
                                </span>
                                <div
                                  style={{
                                    fontSize: '0.6875rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '0.125rem',
                                    maxWidth: '180px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={distinctParties.join(', ')}
                                >
                                  {distinctParties.join(', ')}
                                </div>
                              </div>
                            );
                          }

                          if (distinctParties.length === 1) {
                            return (
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                {String(distinctParties[0])}
                              </div>
                            );
                          }

                          if (j.journey_type === 'commercial' && j.lr_ids?.length > 0) {
                            return (
                              <span className="badge badge-info" style={{ fontSize: '0.6875rem', marginTop: '0.25rem' }}>
                                Multi-Customer Journey
                              </span>
                            );
                          }

                          return null;
                        })()}
                      </td>
                    )}
                    {columnVisibility.isVisible('origin_branch') && (
                      <td>
                        {j.branch_id ? (
                          <div>
                            <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                              {j.branch_id.branch_code}
                            </span>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                              {j.branch_id.branch_name}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                            Company Direct
                          </span>
                        )}
                      </td>
                    )}
                    {columnVisibility.isVisible('commercial_asset') && (
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                          {j.truck_id?.truck_no || 'Unassigned'}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {j.truck_id ? `${j.truck_id.make} ${j.truck_id.model}` : ''}
                        </div>
                      </td>
                    )}
                    {columnVisibility.isVisible('driver') && (
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>
                          {j.driver_id?.name || 'Unassigned'}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {j.driver_id?.phone || ''}
                        </div>
                      </td>
                    )}
                    {columnVisibility.isVisible('route') && (
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
                    )}
                    {columnVisibility.isVisible('departure') && (
                      <td>
                        <div>{new Date(j.start_date).toLocaleDateString()}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          Est. {j.estimated_duration_days} days
                        </div>
                      </td>
                    )}
                    {columnVisibility.isVisible('status') && (
                      <td>{getStatusBadge(j.status)}</td>
                    )}
                    {columnVisibility.isVisible('checkpoint') && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-xs)' }}>
                          <MapPin size={12} color="var(--color-primary-600)" />
                          <span>{j.last_known_location || 'Pending departure'}</span>
                        </div>
                      </td>
                    )}
                    {columnVisibility.isVisible('actions') && (
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

                          {canEdit && (j.status === 'active' || j.status === 'delayed') && !j.is_settled && (
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
                    )}
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
