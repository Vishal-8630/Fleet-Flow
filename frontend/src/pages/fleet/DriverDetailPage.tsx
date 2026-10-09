/**
 * ============================================================================
 * FLEET FLOW — DRIVER PROFILE & KYC VAULT (pages/fleet/DriverDetailPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Complete KYC and operational profile for a commercial driver.
 * Includes:
 * 1. Personal credentials & emergency contact.
 * 2. KYC Document Vault (Driving License & Aadhaar card copies with S3 storage).
 * 3. Vehicle Assignment Audit History.
 * 4. Running Financial Advance Ledger balance.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  ArrowLeft,
  Phone,
  ShieldCheck,
  CreditCard,
  Truck,
  Upload,
  ExternalLink,
  Edit,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export const DriverDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher'].includes(role || '');

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDocKey, setUploadDocKey] = useState<'license_front_url' | 'license_back_url' | 'aadhaar_front_url' | 'aadhaar_back_url'>('license_front_url');
  const [uploadDocLabel, setUploadDocLabel] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    emergency_phone: '',
    address: '',
    license_number: '',
    license_expiry_date: '',
    aadhaar_number: '',
    status: '',
    running_advance_balance: '',
  });

  // Query driver details
  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: async () => {
      const res = await api.get(`/fleet/drivers/${id}`);
      return res.data?.driver;
    },
    enabled: Boolean(id),
  });

  // Update Driver Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/fleet/drivers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Driver profile updated.');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['driver', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update driver profile.');
    },
  });

  // Upload KYC Document Mutation
  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Please select a file.');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'drivers');

      const uploadRes = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { url } = uploadRes.data;

      await api.put(`/fleet/drivers/${id}`, {
        [uploadDocKey]: url,
      });
    },
    onSuccess: () => {
      toast.success(`${uploadDocLabel} uploaded successfully.`);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['driver', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload document.');
    },
  });

  const handleCancelEdit = () => {
    if (driver) {
      setEditFormData({
        name: driver.name,
        phone: driver.phone,
        emergency_phone: driver.emergency_phone || '',
        address: driver.address || '',
        license_number: driver.license_number,
        license_expiry_date: driver.license_expiry_date ? driver.license_expiry_date.split('T')[0] : '',
        aadhaar_number: driver.aadhaar_number || '',
        status: driver.status,
        running_advance_balance: driver.running_advance_balance?.toString() || '0',
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setIsUploadModalOpen(false);
  };

  const handleViewDoc = async (url?: string) => {
    if (!url) {
      toast.error('No document uploaded.');
      return;
    }
    // If S3 key path, get presigned URL
    if (url.includes('tenants/')) {
      try {
        const res = await api.get(`/documents/presigned-url?key=${encodeURIComponent(url)}`);
        if (res.data?.url) {
          window.open(res.data.url, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (e) {
        // Fallback to opening direct url
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading driver profile...</div>;
  }

  if (!driver) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Driver Profile Not Found</div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/fleet/drivers')}>
          <ArrowLeft size={16} /> Return to Roster
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title={driver.name}
        subtitle={`Commercial License: ${driver.license_number} &bull; Aadhaar: ${driver.aadhaar_number || 'Unverified'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Drivers', href: '/fleet/drivers' },
          { label: driver.name },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/fleet/drivers')}>
              <ArrowLeft size={16} /> Back to Roster
            </button>
            {canEdit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!editFormData.name && driver) {
                    setEditFormData({
                      name: driver.name,
                      phone: driver.phone,
                      emergency_phone: driver.emergency_phone || '',
                      address: driver.address || '',
                      license_number: driver.license_number,
                      license_expiry_date: driver.license_expiry_date ? driver.license_expiry_date.split('T')[0] : '',
                      aadhaar_number: driver.aadhaar_number || '',
                      status: driver.status,
                      running_advance_balance: driver.running_advance_balance?.toString() || '0',
                    });
                  }
                  setIsEditModalOpen(true);
                }}
              >
                <Edit size={16} /> Edit Driver
              </button>
            )}
          </div>
        }
      />

      {/* 2. Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Personal & Contact Credentials */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} color="var(--color-primary-600)" /> Personal & Contact Info
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Full Name:</span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{driver.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Primary Mobile:</span>
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{driver.phone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Emergency Phone:</span>
              <span>{driver.emergency_phone || 'None recorded'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Address:</span>
              <span style={{ textAlign: 'right', maxWidth: '180px' }}>{driver.address || 'Not specified'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Roster Status:</span>
              <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>{driver.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Financial Advance Ledger */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={18} color="var(--color-primary-600)" /> Driver Financial Balances
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Running Trip Advance Balance</div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)', marginTop: '0.25rem' }}>
                ₹{(driver.running_advance_balance || 0).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Amount Company Owes Driver:</span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                ₹{(driver.amount_company_owes_driver || 0).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Amount Driver Owes Company:</span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-danger)' }}>
                ₹{(driver.amount_driver_owes_company || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Current Vehicle Assignment */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} color="var(--color-primary-600)" /> Current Vehicle Assignment
          </h3>

          {driver.current_truck_id ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Truck size={28} color="var(--color-primary-600)" />
                <div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>
                    {driver.current_truck_id.truck_no}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {driver.current_truck_id.make} {driver.current_truck_id.model} &bull; {driver.current_truck_id.body_type}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={() => navigate(`/fleet/trucks/${driver.current_truck_id._id}`)}
              >
                Inspect Vehicle Details
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <Truck size={32} color="var(--color-slate-400)" style={{ margin: '0 auto 0.5rem auto' }} />
              <div>Driver is currently in the unallocated pool.</div>
            </div>
          )}
        </div>
      </div>

      {/* 3. KYC Document Vault */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: '1rem' }}>
          Driver Identity & KYC Documents Vault
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: '1rem' }}>
          {[
            { key: 'license_front_url', label: 'Driving License (Front)', url: driver.license_front_url },
            { key: 'license_back_url', label: 'Driving License (Back)', url: driver.license_back_url },
            { key: 'aadhaar_front_url', label: 'Aadhaar Card (Front)', url: driver.aadhaar_front_url },
            { key: 'aadhaar_back_url', label: 'Aadhaar Card (Back)', url: driver.aadhaar_back_url },
          ].map((doc) => (
            <div
              key={doc.key}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem' }}>
                  {doc.label}
                </div>
                <span className={`badge ${doc.url ? 'badge-success' : 'badge-neutral'}`}>
                  {doc.url ? 'Verified & Stored' : 'Missing Document'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                {doc.url && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                    onClick={() => handleViewDoc(doc.url)}
                  >
                    <ExternalLink size={14} /> View
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className={`btn ${doc.url ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                    onClick={() => {
                      setUploadDocKey(doc.key as any);
                      setUploadDocLabel(doc.label);
                      setIsUploadModalOpen(true);
                    }}
                  >
                    <Upload size={14} /> {doc.url ? 'Replace' : 'Upload'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Vehicle Assignment History */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: '1rem' }}>
          Vehicle Assignment History
        </h3>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Vehicle Registration</th>
                <th>Make & Model</th>
                <th>Assigned Date</th>
                <th>Detached Date</th>
              </tr>
            </thead>
            <tbody>
              {!driver.assignment_history || driver.assignment_history.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No vehicle assignments logged yet.
                  </td>
                </tr>
              ) : (
                driver.assignment_history
                  .slice()
                  .reverse()
                  .map((item: any, idx: number) => {
                    const truck = item.truck_id;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary-700)' }}>
                          {truck?.truck_no || 'Unknown Vehicle'}
                        </td>
                        <td>{truck ? `${truck.make} ${truck.model}` : 'N/A'}</td>
                        <td>{new Date(item.assigned_at).toLocaleDateString()}</td>
                        <td>
                          {item.unassigned_at ? (
                            new Date(item.unassigned_at).toLocaleDateString()
                          ) : (
                            <span className="badge badge-success">Currently Driving</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Driver Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Driver Profile"
        subtitle={`Update contact credentials and status for ${driver.name}.`}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({
              ...editFormData,
              running_advance_balance: Number(editFormData.running_advance_balance) || 0,
            });
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Emergency Phone</label>
              <input
                type="tel"
                className="form-control"
                value={editFormData.emergency_phone}
                onChange={(e) => setEditFormData({ ...editFormData, emergency_phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driving License Number</label>
              <input
                type="text"
                className="form-control"
                value={editFormData.license_number}
                onChange={(e) => setEditFormData({ ...editFormData, license_number: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Running Advance (₹)</label>
              <input
                type="number"
                className="form-control"
                value={editFormData.running_advance_balance}
                onChange={(e) => setEditFormData({ ...editFormData, running_advance_balance: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Roster Status</label>
              <select
                className="form-control"
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              >
                <option value="active">Active Duty</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload KYC Document Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={`Upload ${uploadDocLabel}`}
        subtitle={`Select scan/photo of driver's ${uploadDocLabel}.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadDocMutation.mutate();
          }}
        >
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Select Document (PDF, JPEG, PNG)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="form-control"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancelUpload}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploadDocMutation.isPending}>
              {uploadDocMutation.isPending ? 'Uploading...' : 'Save Document'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
