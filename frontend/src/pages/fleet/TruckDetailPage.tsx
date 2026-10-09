/**
 * ============================================================================
 * FLEET FLOW — TRUCK DETAIL & COMPLIANCE VAULT (pages/fleet/TruckDetailPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Deep-dive profile for an individual fleet vehicle asset. Hosts:
 * 1. Mechanical specifications, odometer status, and maintenance service gauges.
 * 2. The 6-document Digital Compliance Vault (Fitness, Insurance, National Permit,
 *    State Permit, Road Tax, PUC) with relative expiration countdowns, direct file
 *    uploads, and presigned S3 downloads.
 * 3. Driver assignment history and real-time driver binding actions.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * Statutory compliance is the #1 operational risk in interstate transport.
 * Dispatchers must verify active road permits and insurances before releasing
 * a vehicle on a multi-day trip.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Upload,
  FileText,
  ExternalLink,
  User,
  Gauge,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Edit,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/uiStore';

export const TruckDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const canEdit = ['admin', 'dispatcher'].includes(role || '');

  // Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeDocKey, setActiveDocKey] = useState<string>('');
  const [activeDocLabel, setActiveDocLabel] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docExpiryDate, setDocExpiryDate] = useState<string>('');
  const [docNumber, setDocNumber] = useState<string>('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    current_odometer_kms: '',
    service_interval_kms: '',
    status: '',
  });

  // Fetch truck detail
  const { data: truckData, isLoading: isTruckLoading } = useQuery({
    queryKey: ['truck', id],
    queryFn: async () => {
      const res = await api.get(`/fleet/trucks/${id}`);
      return res.data?.truck;
    },
    enabled: Boolean(id),
  });

  // Fetch active drivers list for driver assignment dropdown
  const { data: driversData } = useQuery({
    queryKey: ['drivers-active-select'],
    queryFn: async () => {
      const res = await api.get('/fleet/drivers?limit=100&status=active');
      return res.data?.drivers || [];
    },
    enabled: isAssignModalOpen,
  });

  const truck = truckData;

  // Driver Assignment Mutation
  const assignDriverMutation = useMutation({
    mutationFn: async (payload: { driverId: string; notes?: string }) => {
      const res = await api.post(`/fleet/trucks/${id}/assign-driver`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Driver assigned successfully.');
      setIsAssignModalOpen(false);
      setSelectedDriverId('');
      setAssignmentNotes('');
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to assign driver.');
    },
  });

  // Driver Unassign Mutation
  const unassignDriverMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/fleet/trucks/${id}/unassign-driver`, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Driver detached.');
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.error || 'Failed to unassign driver.');
    },
  });

  // Update Truck Specs Mutation
  const updateTruckMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put(`/fleet/trucks/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Vehicle specifications updated.');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update vehicle.');
    },
  });

  // Upload Compliance Document Mutation
  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Please select a document file.');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entityType', 'trucks');

      // 1. Upload to storage vault
      const uploadRes = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { key, url } = uploadRes.data;

      // 2. Attach to truck record
      const docPayload: any = {
        key,
        url,
        document_number: docNumber,
        expiry_date: docExpiryDate ? new Date(docExpiryDate) : undefined,
      };

      await api.put(`/fleet/trucks/${id}`, {
        [activeDocKey]: docPayload,
      });
    },
    onSuccess: () => {
      toast.success(`${activeDocLabel} uploaded and verified.`);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setDocExpiryDate('');
      setDocNumber('');
      queryClient.invalidateQueries({ queryKey: ['truck', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload document.');
    },
  });

  const handleCancelUpload = () => {
    setUploadFile(null);
    setDocExpiryDate('');
    setDocNumber('');
    setIsUploadModalOpen(false);
  };

  const handleCancelAssign = () => {
    setSelectedDriverId('');
    setAssignmentNotes('');
    setIsAssignModalOpen(false);
  };

  const handleCancelEdit = () => {
    if (truck) {
      setEditFormData({
        current_odometer_kms: truck.current_odometer_kms?.toString() || '0',
        service_interval_kms: truck.service_interval_kms?.toString() || '10000',
        status: truck.status,
      });
    }
    setIsEditModalOpen(false);
  };

  // Handle viewing a document using presigned URL
  const handleViewDocument = async (key?: string, fallbackUrl?: string) => {
    try {
      if (key) {
        const res = await api.get(`/documents/presigned-url?key=${encodeURIComponent(key)}`);
        if (res.data?.url) {
          window.open(res.data.url, '_blank', 'noopener,noreferrer');
          return;
        }
      }
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('No document file attached.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open document.');
    }
  };

  const getDocStatusBadge = (expiryDate?: string) => {
    if (!expiryDate) {
      return <span className="badge badge-neutral">Not Uploaded</span>;
    }
    const exp = new Date(expiryDate);
    const now = new Date();
    const daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <ShieldAlert size={12} /> Expired {Math.abs(daysRemaining)}d ago
        </span>
      );
    }
    if (daysRemaining <= 15) {
      return (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <AlertTriangle size={12} /> Expires in {daysRemaining}d
        </span>
      );
    }
    return (
      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <CheckCircle2 size={12} /> Valid ({daysRemaining}d)
      </span>
    );
  };

  if (isTruckLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading vehicle details...</div>;
  }

  if (!truck) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Vehicle Asset Not Found</div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/fleet/trucks')}>
          <ArrowLeft size={16} /> Return to Fleet
        </button>
      </div>
    );
  }

  // The 6 Statutory Documents
  const statutoryDocs = [
    { key: 'fitness_doc', label: 'Fitness Certificate', data: truck.fitness_doc, icon: ShieldCheck },
    { key: 'insurance_doc', label: 'Commercial Insurance Policy', data: truck.insurance_doc, icon: ShieldCheck },
    { key: 'national_permit_doc', label: 'National Goods Permit', data: truck.national_permit_doc, icon: FileText },
    { key: 'state_permit_doc', label: 'State Transport Permit', data: truck.state_permit_doc, icon: FileText },
    { key: 'road_tax_doc', label: 'Road Tax Receipt', data: truck.road_tax_doc, icon: Calendar },
    { key: 'puc_doc', label: 'PUC Pollution Certificate', data: truck.puc_doc, icon: CheckCircle2 },
  ];

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title={truck.truck_no}
        subtitle={`${truck.make} ${truck.model} &bull; ${truck.body_type} &bull; ${truck.tonnage_capacity} MT Capacity`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Fleet', href: '/fleet/trucks' },
          { label: truck.truck_no },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/fleet/trucks')}>
              <ArrowLeft size={16} /> Back to Fleet
            </button>
            {canEdit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!editFormData.status && truck) {
                    setEditFormData({
                      current_odometer_kms: truck.current_odometer_kms?.toString() || '0',
                      service_interval_kms: truck.service_interval_kms?.toString() || '10000',
                      status: truck.status,
                    });
                  }
                  setIsEditModalOpen(true);
                }}
              >
                <Edit size={16} /> Edit Vehicle
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* 2. Left Column: Mechanical Specifications & Maintenance Gauge */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gauge size={18} color="var(--color-primary-600)" /> Mechanical & Odometer
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Registration No:</span>
              <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>{truck.truck_no}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Make & Model:</span>
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{truck.make} {truck.model}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Body Type:</span>
              <span className="badge badge-neutral">{truck.body_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Tonnage Capacity:</span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{truck.tonnage_capacity} Metric Tonnes</span>
            </div>
            {truck.cbm_capacity > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Volumetric (CBM):</span>
                <span>{truck.cbm_capacity} m³</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Current Odometer:</span>
              <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{truck.current_odometer_kms.toLocaleString()} km</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Next Service Due:</span>
              <span style={{ color: truck.current_odometer_kms >= truck.next_service_due_kms ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
                {truck.next_service_due_kms.toLocaleString()} km
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Operational Status:</span>
              <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{truck.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* 3. Middle Column: Active Driver Binding */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} color="var(--color-primary-600)" /> Current Assigned Driver
          </h3>

          {truck.current_driver_id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary-700)',
                    fontWeight: 'var(--font-weight-bold)',
                    fontSize: 'var(--font-size-lg)',
                  }}
                >
                  <User size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)' }}>
                    {truck.current_driver_id.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                    Phone: {truck.current_driver_id.phone}
                  </div>
                  {truck.current_driver_id.license_number && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      License: {truck.current_driver_id.license_number}
                    </div>
                  )}
                </div>
              </div>

              {canEdit && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setIsAssignModalOpen(true)}
                  >
                    <UserCheck size={14} /> Swap Driver
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm(`Unassign driver ${truck.current_driver_id.name} from this vehicle?`)) {
                        unassignDriverMutation.mutate();
                      }
                    }}
                  >
                    <UserX size={14} /> Unassign
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <User size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 0.5rem auto' }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No driver currently attached to this vehicle.</div>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '1rem' }}
                  onClick={() => setIsAssignModalOpen(true)}
                >
                  <UserCheck size={14} /> Assign Driver
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Right Column: Compliance Health Summary */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--color-primary-600)" /> Statutory Compliance
          </h3>

          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor:
                truck.compliance_status === 'COMPLIANT'
                  ? 'var(--color-success-50)'
                  : truck.compliance_status === 'EXPIRING_SOON'
                  ? 'var(--color-warning-50)'
                  : 'var(--color-danger-50)',
              border: `1px solid ${
                truck.compliance_status === 'COMPLIANT'
                  ? 'var(--color-success-200)'
                  : truck.compliance_status === 'EXPIRING_SOON'
                  ? 'var(--color-warning-200)'
                  : 'var(--color-danger-200)'
              }`,
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'var(--font-weight-bold)' }}>
              {truck.compliance_status === 'COMPLIANT' ? (
                <>
                  <CheckCircle2 size={18} color="var(--color-success)" />
                  <span style={{ color: 'var(--color-success-800)' }}>100% Legally Compliant</span>
                </>
              ) : truck.compliance_status === 'EXPIRING_SOON' ? (
                <>
                  <AlertTriangle size={18} color="var(--color-warning)" />
                  <span style={{ color: 'var(--color-warning-800)' }}>Renewal Attention Needed</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={18} color="var(--color-danger)" />
                  <span style={{ color: 'var(--color-danger-800)' }}>Ground Vehicle: Expired Docs</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Commercial compliance is evaluated across 6 statutory transport certificates required by Indian motor vehicle law.
            </div>
          </div>
        </div>
      </div>

      {/* 5. The 6 Mandatory Statutory Compliance Documents Vault */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
              Digital Compliance Vault (6 Statutory Documents)
            </h3>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Statutory documents, insurance policies, and interstate road permits with encrypted S3 storage.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '1rem' }}>
          {statutoryDocs.map((doc) => {
            const hasDoc = Boolean(doc.data?.url || doc.data?.key);
            const expiry = doc.data?.expiry_date;
            const docNum = doc.data?.document_number || doc.data?.policy_number || doc.data?.permit_number || doc.data?.certificate_number;

            return (
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>{doc.label}</div>
                    {getDocStatusBadge(expiry)}
                  </div>

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Doc / Policy No:{' '}
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>
                      {docNum || 'Not Specified'}
                    </span>
                  </div>

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Expiry Date:{' '}
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-main)' }}>
                      {expiry ? new Date(expiry).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  {hasDoc && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                      onClick={() => handleViewDocument(doc.data?.key, doc.data?.url)}
                    >
                      <ExternalLink size={14} /> View
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className={`btn ${hasDoc ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                      onClick={() => {
                        setActiveDocKey(doc.key);
                        setActiveDocLabel(doc.label);
                        setDocNumber(docNum || '');
                        setDocExpiryDate(expiry ? expiry.split('T')[0] : '');
                        setIsUploadModalOpen(true);
                      }}
                    >
                      <Upload size={14} /> {hasDoc ? 'Replace' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Driver Assignment History */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: '1rem' }}>
          Driver Assignment Audit History
        </h3>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Contact Phone</th>
                <th>Assigned Date</th>
                <th>Unassigned Date</th>
                <th>Notes / Dispatch Reason</th>
              </tr>
            </thead>
            <tbody>
              {!truck.driver_assignments || truck.driver_assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No assignment records logged yet.
                  </td>
                </tr>
              ) : (
                truck.driver_assignments
                  .slice()
                  .reverse()
                  .map((assignment: any, idx: number) => {
                    const driver = assignment.driver_id;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'var(--font-weight-medium)' }}>{driver?.name || 'Unknown Driver'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{driver?.phone || 'N/A'}</td>
                        <td style={{ fontSize: 'var(--font-size-sm)' }}>
                          {new Date(assignment.assigned_at).toLocaleDateString()}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-sm)' }}>
                          {assignment.unassigned_at ? (
                            new Date(assignment.unassigned_at).toLocaleDateString()
                          ) : (
                            <span className="badge badge-success">Currently Active</span>
                          )}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {assignment.notes || 'Routine allocation'}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Compliance Document Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={`Upload ${activeDocLabel}`}
        subtitle="Upload statutory certificate copy and specify valid expiry date."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadDocMutation.mutate();
          }}
        >
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">
              Certificate / Policy Number <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. MH/TAX/2026/88921"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">
              Statutory Expiry Date <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={docExpiryDate}
              onChange={(e) => setDocExpiryDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">
              Select Document File (PDF, JPEG, PNG - Max 10MB) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="form-control"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancelUpload}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploadDocMutation.isPending}>
              {uploadDocMutation.isPending ? 'Uploading & Encrypting...' : 'Save Document to Vault'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Driver Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Driver to Vehicle"
        subtitle={`Select a commercial driver to allocate to ${truck.truck_no}.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedDriverId) {
              toast.error('Please choose a driver.');
              return;
            }
            assignDriverMutation.mutate({ driverId: selectedDriverId, notes: assignmentNotes });
          }}
        >
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">
              Select Commercial Driver <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              className="form-control"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              required
            >
              <option value="">-- Choose active driver --</option>
              {driversData?.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.phone}) {d.current_truck_id ? `[Currently on ${d.current_truck_id.truck_no}]` : '[Unassigned]'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Assignment Notes (Optional)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Assigned for Western corridor multi-axle freight"
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancelAssign}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={assignDriverMutation.isPending}>
              {assignDriverMutation.isPending ? 'Allocating...' : 'Confirm Driver Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Vehicle Specs Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Update Vehicle Details"
        subtitle={`Modify odometer and status for ${truck.truck_no}.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateTruckMutation.mutate({
              current_odometer_kms: Number(editFormData.current_odometer_kms),
              service_interval_kms: Number(editFormData.service_interval_kms),
              status: editFormData.status,
            });
          }}
        >
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Current Odometer (KM)</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.current_odometer_kms}
              onChange={(e) => setEditFormData({ ...editFormData, current_odometer_kms: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Service Interval (KM)</label>
            <input
              type="number"
              className="form-control"
              value={editFormData.service_interval_kms}
              onChange={(e) => setEditFormData({ ...editFormData, service_interval_kms: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Operational Status</label>
            <select
              className="form-control"
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
            >
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="in_maintenance">In Maintenance</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={updateTruckMutation.isPending}>
              {updateTruckMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
