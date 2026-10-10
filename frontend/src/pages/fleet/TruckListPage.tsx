/**
 * ============================================================================
 * FLEET FLOW — FLEET & TRUCKS ROSTER (pages/fleet/TruckListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * The primary fleet asset registry. Lists all company vehicles with live status,
 * active driver bindings, mechanical capacities, and real-time statutory compliance
 * health badges (COMPLIANT, EXPIRING SOON, EXPIRED).
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Compliance At-a-Glance: Logistics managers can instantly identify trucks
 *   with expired or soon-to-expire documents (Fitness, Road Tax, Insurance, Permits)
 *   before dispatching them on trips, preventing RTO challans and highway impounds.
 * - Server-Side Filtering: Debounced text search, status filters, and pagination.
 * - Quick Creation Modal: Allows registering new vehicles with instant form validation.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  User,
  ArrowRight,
  Trash2,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { CustomFieldsRenderer } from '../../components/common/CustomFieldsRenderer';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export interface TruckRecord {
  _id: string;
  truck_no: string;
  make: string;
  model: string;
  year?: number;
  body_type: string;
  tonnage_capacity: number;
  cbm_capacity?: number;
  current_odometer_kms: number;
  service_interval_kms: number;
  next_service_due_kms: number;
  status: 'available' | 'on_trip' | 'in_maintenance' | 'decommissioned';
  compliance_status: 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED';
  current_driver_id?: {
    _id: string;
    name: string;
    phone: string;
    photo_url?: string;
  };
  custom_fields?: Record<string, any>;
  created_at: string;
}

export const TruckListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher'].includes(role || '');
  const isAdmin = role === 'admin';

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State for new vehicle registration
  const initialTruckFormData = {
    truck_no: '',
    make: 'Tata',
    model: '',
    year: new Date().getFullYear(),
    body_type: 'Container',
    tonnage_capacity: '',
    cbm_capacity: '',
    current_odometer_kms: '0',
    service_interval_kms: '10000',
    status: 'available',
  };

  const [formData, setFormData] = useState(initialTruckFormData);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Query trucks list
  const { data, isLoading } = useQuery({
    queryKey: ['trucks', page, searchTerm, statusFilter, complianceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (searchTerm) params.append('q', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (complianceFilter) params.append('compliance', complianceFilter);

      const res = await api.get(`/fleet/trucks?${params.toString()}`);
      return res.data;
    },
  });

  const trucks: TruckRecord[] = data?.trucks || [];
  const stats = data?.stats || {
    total: 0,
    available: 0,
    on_trip: 0,
    in_maintenance: 0,
    compliant: 0,
    expiring_soon: 0,
    expired: 0,
  };

  const handleCancel = () => {
    setFormData(initialTruckFormData);
    setCustomFields({});
    setIsCreateModalOpen(false);
  };

  // Create truck mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/fleet/trucks', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Vehicle registered successfully.');
      setIsCreateModalOpen(false);
      setFormData(initialTruckFormData);
      setCustomFields({});
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to create vehicle.');
    },
  });

  // Delete truck mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/fleet/trucks/${id}`);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Vehicle removed from fleet.');
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to delete vehicle.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.truck_no || !formData.make || !formData.model || !formData.tonnage_capacity) {
      toast.error('Registration number, make, model, and tonnage capacity are mandatory.');
      return;
    }

    createMutation.mutate({
      ...formData,
      tonnage_capacity: Number(formData.tonnage_capacity),
      cbm_capacity: formData.cbm_capacity ? Number(formData.cbm_capacity) : 0,
      current_odometer_kms: Number(formData.current_odometer_kms) || 0,
      service_interval_kms: Number(formData.service_interval_kms) || 10000,
      custom_fields: customFields,
    });
  };

  const getComplianceBadge = (status: 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED') => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={12} /> Compliant
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> Expiring Soon
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldAlert size={12} /> Expired
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge badge-success">Available</span>;
      case 'on_trip':
        return <span className="badge badge-primary">On Trip</span>;
      case 'in_maintenance':
        return <span className="badge badge-warning">Maintenance</span>;
      case 'decommissioned':
        return <span className="badge badge-neutral">Decommissioned</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      {/* 1. Header with Breadcrumbs & Action Button */}
      <PageHeader
        title="Fleet & Vehicles"
        subtitle="Real-time asset registry, statutory compliance vault monitors, and driver bindings."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Fleet' },
          { label: 'Vehicles' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Register Vehicle
            </button>
          ) : undefined
        }
      />

      {/* 2. Operational & Compliance KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Total Fleet Assets</span>
            <Truck size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.available} Available &bull; {stats.on_trip} Dispatched
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>In Maintenance</span>
            <Gauge size={20} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: stats.in_maintenance > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {stats.in_maintenance}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Vehicles in workshop or servicing
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Statutory Compliant</span>
            <ShieldCheck size={20} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-success)' }}>
            {stats.compliant}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            All 6 documents verified & valid
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Compliance Alerts</span>
            <ShieldAlert size={20} color={stats.expired > 0 ? 'var(--color-danger)' : 'var(--color-warning)'} />
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              marginTop: '0.5rem',
              color: stats.expired > 0 ? 'var(--color-danger)' : stats.expiring_soon > 0 ? 'var(--color-warning)' : 'inherit',
            }}
          >
            {stats.expired + stats.expiring_soon}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.expired} Expired &bull; {stats.expiring_soon} Expiring within 15 days
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
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
                placeholder="Search by truck no, make, model..."
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
                style={{ minWidth: '140px' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="on_trip">On Trip</option>
                <option value="in_maintenance">Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>

            <select
              className="form-control"
              style={{ minWidth: '160px' }}
              value={complianceFilter}
              onChange={(e) => {
                setComplianceFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Compliance</option>
              <option value="COMPLIANT">Compliant Only</option>
              <option value="EXPIRING_SOON">Expiring Soon (15d)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Fleet Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Registration No.</th>
                <th>Make & Model</th>
                <th>Body & Capacity</th>
                <th>Assigned Driver</th>
                <th>Odometer</th>
                <th>Compliance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Loading vehicle assets...
                  </td>
                </tr>
              ) : trucks.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Truck size={36} color="var(--color-slate-400)" />
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>No vehicles found</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {searchTerm || statusFilter || complianceFilter
                          ? 'Try adjusting your search criteria.'
                          : 'Register your first transport truck to begin dispatching trips.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                trucks.map((truck) => (
                  <tr key={truck._id}>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)', letterSpacing: '0.05em' }}>
                        {truck.truck_no}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        Year: {truck.year || 'N/A'}
                      </div>
                      {truck.custom_fields && Object.keys(truck.custom_fields).length > 0 && (
                        <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {Object.entries(truck.custom_fields).map(([k, v]) => (
                            <span
                              key={k}
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--color-primary-50)',
                                color: 'var(--color-primary-800)',
                                border: '1px solid var(--color-primary-200)',
                                fontWeight: 600,
                              }}
                            >
                              {k.replace(/_/g, ' ').toUpperCase()}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>{truck.make}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{truck.model}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-sm)' }}>
                        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{truck.tonnage_capacity} MT</span>
                        {truck.cbm_capacity ? ` / ${truck.cbm_capacity} CBM` : ''}
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '10px', marginTop: '0.25rem' }}>
                        {truck.body_type}
                      </span>
                    </td>
                    <td>
                      {truck.current_driver_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-primary-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-primary-700)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 'var(--font-weight-bold)',
                            }}
                          >
                            <User size={14} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                              {truck.current_driver_id.name}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              {truck.current_driver_id.phone}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {truck.current_odometer_kms.toLocaleString()} km
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        Next due: {truck.next_service_due_kms.toLocaleString()} km
                      </div>
                    </td>
                    <td>{getComplianceBadge(truck.compliance_status)}</td>
                    <td>{getStatusBadge(truck.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/fleet/trucks/${truck._id}`)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          Details <ArrowRight size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            title="Remove vehicle"
                            onClick={() => {
                              if (confirm(`Are you sure you want to remove vehicle ${truck.truck_no}?`)) {
                                deleteMutation.mutate(truck._id);
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

        {/* 5. Pagination */}
        <Pagination
          currentPage={data?.page || 1}
          totalPages={data?.totalPages || 1}
          totalItems={data?.total || 0}
          pageSize={15}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* 6. Register Vehicle Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Vehicle Asset"
        subtitle="Add a new commercial vehicle to your transport fleet roster."
        size="lg"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Registration / Truck No <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. MH12AB1234"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                value={formData.truck_no}
                onChange={(e) => setFormData({ ...formData, truck_no: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Make / Manufacturer <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                required
              >
                <option value="Tata">Tata Motors</option>
                <option value="Ashok Leyland">Ashok Leyland</option>
                <option value="BharatBenz">BharatBenz</option>
                <option value="Eicher">Eicher Motors</option>
                <option value="Mahindra">Mahindra</option>
                <option value="Volvo">Volvo Trucks</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Model Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Prima 5530.S"
                className="form-control"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Model Year</label>
              <input
                type="number"
                placeholder="2024"
                className="form-control"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Body Type</label>
              <select
                className="form-control"
                value={formData.body_type}
                onChange={(e) => setFormData({ ...formData, body_type: e.target.value })}
              >
                <option value="Open">Open Body</option>
                <option value="Container">Closed Container</option>
                <option value="Trailer">Trailer</option>
                <option value="Tanker">Tanker</option>
                <option value="Flatbed">Flatbed</option>
                <option value="Tipper">Tipper</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Tonnage Capacity (Metric Tonnes) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 25.5"
                className="form-control"
                value={formData.tonnage_capacity}
                onChange={(e) => setFormData({ ...formData, tonnage_capacity: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">CBM Capacity (Cubic Meters)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 60.0"
                className="form-control"
                value={formData.cbm_capacity}
                onChange={(e) => setFormData({ ...formData, cbm_capacity: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Current Odometer (KM)</label>
              <input
                type="number"
                placeholder="0"
                className="form-control"
                value={formData.current_odometer_kms}
                onChange={(e) => setFormData({ ...formData, current_odometer_kms: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Service Interval (KM)</label>
              <input
                type="number"
                placeholder="10000"
                className="form-control"
                value={formData.service_interval_kms}
                onChange={(e) => setFormData({ ...formData, service_interval_kms: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Operational Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="available">Available for Dispatch</option>
                <option value="in_maintenance">In Maintenance</option>
              </select>
            </div>
          </div>

          {/* Dynamic Workspace Custom Fields */}
          <CustomFieldsRenderer
            entity="Truck"
            values={customFields}
            onChange={setCustomFields}
            disabled={createMutation.isPending}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Registering...' : 'Register Vehicle Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
