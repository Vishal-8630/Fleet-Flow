/**
 * ============================================================================
 * FLEET FLOW — DRIVER MASTER ROSTER (pages/fleet/DriverListPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Driver master directory for the transport company. Displays:
 * 1. Personal contact credentials and emergency contact info.
 * 2. KYC credentials with automatic Aadhaar PII masking (`XXXX-XXXX-1234`).
 * 3. Active vehicle allocations.
 * 4. Running financial advance balances.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - PII Protection: Keeps driver Aadhaar numbers safe from general viewing.
 * - Fleet Coordination: Dispatchers can immediately spot unassigned drivers
 *   ready to take on incoming freight trips.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  UserSquare2,
  Plus,
  Search,
  Filter,
  User,
  Truck,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Trash2,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export interface DriverRecord {
  _id: string;
  name: string;
  phone: string;
  emergency_phone?: string;
  license_number: string;
  license_expiry_date?: string;
  aadhaar_number?: string;
  running_advance_balance: number;
  status: 'active' | 'on_leave' | 'terminated';
  current_truck_id?: {
    _id: string;
    truck_no: string;
    make: string;
    model: string;
  };
  created_at: string;
}

export const DriverListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher'].includes(role || '');
  const isAdmin = role === 'admin';

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State for new driver registration
  const initialDriverFormData = {
    name: '',
    phone: '',
    emergency_phone: '',
    license_number: '',
    license_expiry_date: '',
    aadhaar_number: '',
    address: '',
    running_advance_balance: '0',
    status: 'active',
  };

  const [formData, setFormData] = useState(initialDriverFormData);

  // Query drivers list
  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (searchTerm) params.append('q', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/fleet/drivers?${params.toString()}`);
      return res.data;
    },
  });

  const drivers: DriverRecord[] = data?.drivers || [];
  const stats = data?.stats || {
    total: 0,
    active: 0,
    on_leave: 0,
    terminated: 0,
    assigned: 0,
    unassigned: 0,
  };

  const handleCancel = () => {
    setFormData(initialDriverFormData);
    setIsCreateModalOpen(false);
  };

  // Create driver mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/fleet/drivers', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Driver registered successfully.');
      setIsCreateModalOpen(false);
      setFormData(initialDriverFormData);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to register driver.');
    },
  });

  // Delete driver mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/fleet/drivers/${id}`);
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || 'Driver removed from roster.');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete driver.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.license_number) {
      toast.error('Driver name, mobile number, and license number are mandatory.');
      return;
    }

    createMutation.mutate({
      ...formData,
      running_advance_balance: Number(formData.running_advance_balance) || 0,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active Duty</span>;
      case 'on_leave':
        return <span className="badge badge-warning">On Leave</span>;
      case 'terminated':
        return <span className="badge badge-danger">Terminated</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      {/* 1. Header with Breadcrumbs & Action Button */}
      <PageHeader
        title="Driver Master & KYC"
        subtitle="Commercial driver roster, license verifications, masked Aadhaar KYC, and advance balances."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Fleet' },
          { label: 'Drivers' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Onboard Driver
            </button>
          ) : undefined
        }
      />

      {/* 2. Driver Roster KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Total Drivers</span>
            <UserSquare2 size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.active} Active &bull; {stats.on_leave} On Leave
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Assigned to Fleet</span>
            <Truck size={20} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: 'var(--color-success)' }}>
            {stats.assigned}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Operating company vehicles
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Unassigned Pool</span>
            <User size={20} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem', color: stats.unassigned > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {stats.unassigned}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ready for vehicle allocation
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>KYC Verified</span>
            <ShieldCheck size={20} color="var(--color-primary-600)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.5rem' }}>
            {stats.active}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            License & Aadhaar records stored
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by name, phone, license..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ minWidth: '150px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Duty</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Drivers Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Driver Identity</th>
                <th>Commercial License</th>
                <th>Aadhaar KYC</th>
                <th>Assigned Vehicle</th>
                <th>Running Advance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Loading driver directory...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <UserSquare2 size={36} color="var(--color-slate-400)" />
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>No drivers found</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {searchTerm || statusFilter
                          ? 'Try adjusting your search filters.'
                          : 'Onboard your first commercial driver to attach them to fleet vehicles.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-primary-700)',
                            fontWeight: 'var(--font-weight-bold)',
                            fontSize: 'var(--font-size-sm)',
                          }}
                        >
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                            {driver.name}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Phone size={11} /> {driver.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', letterSpacing: '0.05em' }}>
                        {driver.license_number}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {driver.license_expiry_date
                          ? `Exp: ${new Date(driver.license_expiry_date).toLocaleDateString()}`
                          : 'No expiry logged'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {driver.aadhaar_number || 'Unverified'}
                      </span>
                    </td>
                    <td>
                      {driver.current_truck_id ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Truck size={14} color="var(--color-primary-600)" />
                          <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary-700)' }}>
                            {driver.current_truck_id.truck_no}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
                        ₹{(driver.running_advance_balance || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Advance Balance</div>
                    </td>
                    <td>{getStatusBadge(driver.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/fleet/drivers/${driver._id}`)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          Profile <ArrowRight size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            title="Remove driver"
                            onClick={() => {
                              if (confirm(`Remove driver ${driver.name} from active roster?`)) {
                                deleteMutation.mutate(driver._id);
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

      {/* 6. Onboard Driver Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Onboard Commercial Driver"
        subtitle="Register driver contact details and statutory KYC credentials."
        size="lg"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Driver Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Mobile Phone Number <span style={{ color: 'var(--color-danger)' }}>*</span>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Emergency Contact Phone</label>
              <input
                type="tel"
                placeholder="Family / kin contact number"
                className="form-control"
                value={formData.emergency_phone}
                onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Commercial Driving License No <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. MH1220180029381"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">License Expiry Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.license_expiry_date}
                onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">12-Digit Aadhaar Number (PII Protected)</label>
              <input
                type="text"
                placeholder="e.g. 1234 5678 9012"
                className="form-control"
                value={formData.aadhaar_number}
                onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Residential Address</label>
            <input
              type="text"
              placeholder="Driver native village or postal address"
              className="form-control"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Initial Running Advance (₹)</label>
              <input
                type="number"
                placeholder="0"
                className="form-control"
                value={formData.running_advance_balance}
                onChange={(e) => setFormData({ ...formData, running_advance_balance: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Roster Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active Duty</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

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
              {createMutation.isPending ? 'Onboarding...' : 'Onboard Driver'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
