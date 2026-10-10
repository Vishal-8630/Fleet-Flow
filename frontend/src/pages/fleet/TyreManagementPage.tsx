/**
 * ============================================================================
 * FLEET FLOW — TYRE MANAGEMENT & AXLE BLUEPRINT (TyreManagementPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Interactive tyre lifecycle studio: visual chassis axle blueprint, tread wear
 * inspection logging, retreading cycles, and spare parts inventory.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Disc,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Gauge,
  Sliders,
  Eye,
  Activity,
  Layers,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';

export const TyreManagementPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Selected Truck for Chassis Visualizer
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');

  // Filters for Inventory Table
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [selectedTyre, setSelectedTyre] = useState<any>(null);
  const [targetSlot, setTargetSlot] = useState<string>('');

  // Form: Register Tyre
  const [registerForm, setRegisterForm] = useState({
    serial_number: '',
    brand: 'Apollo',
    model_name: 'EnduRace HD',
    size: '295/90 R20',
    initial_tread_depth_mm: '15.0',
    purchase_cost: '22000',
    status: 'in_store',
    notes: '',
  });

  // Form: Mount Tyre
  const [mountForm, setMountForm] = useState({
    tyre_id: '',
    truck_id: '',
    axle_position: 'FL1',
    odometer_kms: '',
  });

  // Form: Inspect Tread
  const [inspectForm, setInspectForm] = useState({
    tread_depth_mm: '',
    odometer_kms: '',
    inspected_by: 'Fleet Maintenance Bay',
    notes: '',
  });

  // 1. Fetch Registered Trucks
  const { data: trucksData } = useQuery({
    queryKey: ['fleet-trucks-tyres'],
    queryFn: async () => {
      const res = await api.get('/fleet/trucks?limit=100');
      const list = res.data?.trucks || [];
      if (list.length > 0 && !selectedTruckId) {
        setSelectedTruckId(list[0]._id);
      }
      return list;
    },
  });

  // 2. Fetch Tyres
  const { data: tyresData, isLoading: isTyresLoading } = useQuery({
    queryKey: ['tyre-records', statusFilter, brandFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (brandFilter !== 'all') params.append('brand', brandFilter);
      if (searchTerm) params.append('search', searchTerm);
      const res = await api.get(`/fleet/maintenance/tyres?${params.toString()}`);
      return res.data?.tyres || [];
    },
  });

  // Selected Truck Object
  const currentTruck = (trucksData || []).find((t: any) => t._id === selectedTruckId);

  // Tyres mounted on current truck
  const mountedTyres = (tyresData || []).filter((tyre: any) => {
    const truckRef = tyre.current_truck_id?._id || tyre.current_truck_id;
    return truckRef && truckRef.toString() === selectedTruckId && tyre.status === 'fitted';
  });

  // Map of Axle Position -> Tyre
  const slotMap: Record<string, any> = {};
  for (const tyre of mountedTyres) {
    if (tyre.axle_position) {
      slotMap[tyre.axle_position] = tyre;
    }
  }

  // Register Mutation
  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/fleet/maintenance/tyres', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tyre registered in warehouse.');
      setIsRegisterModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tyre-records'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to register tyre.');
    },
  });

  // Mount Mutation
  const mountMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/fleet/maintenance/tyres/mount', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tyre mounted successfully.');
      setIsMountModalOpen(false);
      setSelectedTyre(null);
      queryClient.invalidateQueries({ queryKey: ['tyre-records'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to mount tyre.');
    },
  });

  // Inspect Mutation
  const inspectMutation = useMutation({
    mutationFn: async ({ tyreId, payload }: { tyreId: string; payload: any }) => {
      const res = await api.post(`/fleet/maintenance/tyres/${tyreId}/inspect`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tread depth inspection logged.');
      setIsInspectModalOpen(false);
      setSelectedTyre(null);
      queryClient.invalidateQueries({ queryKey: ['tyre-records'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to log inspection.');
    },
  });

  // Retread Mutation
  const retreadMutation = useMutation({
    mutationFn: async (tyreId: string) => {
      const res = await api.post(`/fleet/maintenance/tyres/${tyreId}/retread`, { new_tread_depth_mm: 14.0 });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tyre marked as Retread.');
      queryClient.invalidateQueries({ queryKey: ['tyre-records'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to mark retread.');
    },
  });

  // Scrap Mutation
  const scrapMutation = useMutation({
    mutationFn: async (tyreId: string) => {
      const res = await api.post(`/fleet/maintenance/tyres/${tyreId}/scrap`, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Tyre marked as Scrapped.');
      queryClient.invalidateQueries({ queryKey: ['tyre-records'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to scrap tyre.');
    },
  });

  // Slot Click Handler
  const handleSlotClick = (slotKey: string) => {
    const existing = slotMap[slotKey];
    if (existing) {
      // Open inspection modal
      setSelectedTyre(existing);
      setInspectForm({
        tread_depth_mm: String(existing.current_tread_depth_mm || '12.0'),
        odometer_kms: String(currentTruck?.current_odometer_kms || ''),
        inspected_by: 'Fleet Maintenance Bay',
        notes: '',
      });
      setIsInspectModalOpen(true);
    } else {
      // Open mount modal
      setTargetSlot(slotKey);
      setMountForm({
        tyre_id: '',
        truck_id: selectedTruckId,
        axle_position: slotKey,
        odometer_kms: String(currentTruck?.current_odometer_kms || ''),
      });
      setIsMountModalOpen(true);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({
      ...registerForm,
      initial_tread_depth_mm: parseFloat(registerForm.initial_tread_depth_mm) || 15.0,
      purchase_cost: parseFloat(registerForm.purchase_cost) || 0,
    });
  };

  const handleMountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mountForm.tyre_id || !mountForm.truck_id) {
      toast.error('Please select both a tyre and vehicle.');
      return;
    }
    mountMutation.mutate({
      ...mountForm,
      odometer_kms: parseFloat(mountForm.odometer_kms) || undefined,
    });
  };

  const handleInspectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTyre) return;
    inspectMutation.mutate({
      tyreId: selectedTyre._id,
      payload: {
        tread_depth_mm: parseFloat(inspectForm.tread_depth_mm) || 0,
        odometer_kms: parseFloat(inspectForm.odometer_kms) || undefined,
        inspected_by: inspectForm.inspected_by,
        notes: inspectForm.notes,
      },
    });
  };

  // Helper to render wheel slot
  const renderWheelSlot = (code: string, label: string) => {
    const tyre = slotMap[code];
    let statusClass = '';
    let treadColor = 'var(--color-slate-400)';

    if (tyre) {
      statusClass = 'mounted';
      if (tyre.current_tread_depth_mm <= 4.0) {
        statusClass += ' critical';
        treadColor = 'var(--color-danger)';
      } else if (tyre.current_tread_depth_mm <= 7.0) {
        statusClass += ' warning';
        treadColor = 'var(--color-warning)';
      } else {
        statusClass += ' good';
        treadColor = 'var(--color-success)';
      }
    }

    return (
      <div
        key={code}
        className={`tyre-slot ${statusClass}`}
        onClick={() => handleSlotClick(code)}
        title={tyre ? `${tyre.serial_number} (${tyre.brand}) - ${tyre.current_tread_depth_mm}mm tread. Click to inspect.` : `Slot ${code} Empty. Click to mount tyre.`}
      >
        <span className="tyre-slot-code">{label}</span>
        {tyre ? (
          <>
            <div className="tyre-slot-serial">{tyre.serial_number}</div>
            <div className="tyre-slot-tread" style={{ color: treadColor }}>
              {tyre.current_tread_depth_mm}mm
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--color-slate-500)', fontSize: '10px', marginTop: '0.25rem' }}>
            + Mount
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="maintenance-container">
      {/* 1. Header */}
      <PageHeader
        title="Tyre Management & Axle Blueprint"
        subtitle="Visual chassis mounting, millimeter-precise tread wear tracking, retread cycles, and scrap retirement."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            <Plus size={16} /> Register New Tyre
          </button>
        }
      />

      {/* 2. Truck Selector Ribbon */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Truck size={20} color="var(--color-primary-600)" />
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            Inspect Vehicle Chassis:
          </span>
          <select
            className="form-control"
            style={{ width: 'auto', fontWeight: 'var(--font-weight-bold)' }}
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
          >
            {(trucksData || []).map((t: any) => (
              <option key={t._id} value={t._id}>
                {t.truck_no} ({t.make} {t.model} - {t.tonnage_capacity}T)
              </option>
            ))}
          </select>
        </div>

        {currentTruck && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            <span>Odometer: <strong>{currentTruck.current_odometer_kms?.toLocaleString()} km</strong></span>
            <span>Mounted Tyres: <strong>{mountedTyres.length} / 10</strong></span>
            <span>Status: <strong style={{ textTransform: 'capitalize' }}>{currentTruck.status?.replace('_', ' ')}</strong></span>
          </div>
        )}
      </div>

      {/* 3. Visual 10-Wheeler Chassis Blueprint */}
      <div className="chassis-visualizer-container">
        <div className="chassis-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'var(--font-weight-bold)', color: '#ffffff' }}>
            <Activity size={18} color="var(--color-primary-400)" />
            {currentTruck?.truck_no || 'Chassis Blueprint'} — 10-Wheeler Commercial Axle Map
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--font-size-xs)' }}>
            <span style={{ color: 'var(--color-success)' }}>● Good (&ge; 8mm)</span>
            <span style={{ color: 'var(--color-warning)' }}>● Moderate (4–8mm)</span>
            <span style={{ color: 'var(--color-danger)' }}>● Critical (&le; 4mm)</span>
          </div>
        </div>

        <div className="chassis-blueprint">
          {/* Cabin Indicator */}
          <div className="chassis-cabin">
            ▲ Front Driver Cabin ▲
          </div>

          {/* Axle 1: Front Steer Axle */}
          <div className="chassis-axle-row">
            <div className="chassis-axle-beam" />
            <div className="chassis-wheel-group">
              {renderWheelSlot('FL1', 'Steer FL1')}
            </div>
            <div style={{ color: 'var(--color-slate-400)', fontSize: '11px', zIndex: 2, background: 'var(--color-slate-900)', padding: '2px 8px', borderRadius: '4px' }}>
              Steer Axle
            </div>
            <div className="chassis-wheel-group">
              {renderWheelSlot('FR1', 'Steer FR1')}
            </div>
          </div>

          {/* Axle 2: Drive Axle 1 (Dual Wheels) */}
          <div className="chassis-axle-row">
            <div className="chassis-axle-beam" />
            <div className="chassis-wheel-group">
              {renderWheelSlot('RL1_OUTER', 'RL1 Out')}
              {renderWheelSlot('RL1_INNER', 'RL1 In')}
            </div>
            <div style={{ color: 'var(--color-slate-400)', fontSize: '11px', zIndex: 2, background: 'var(--color-slate-900)', padding: '2px 8px', borderRadius: '4px' }}>
              Drive Axle 1
            </div>
            <div className="chassis-wheel-group">
              {renderWheelSlot('RR1_INNER', 'RR1 In')}
              {renderWheelSlot('RR1_OUTER', 'RR1 Out')}
            </div>
          </div>

          {/* Axle 3: Drive Axle 2 (Dual Wheels) */}
          <div className="chassis-axle-row">
            <div className="chassis-axle-beam" />
            <div className="chassis-wheel-group">
              {renderWheelSlot('RL2_OUTER', 'RL2 Out')}
              {renderWheelSlot('RL2_INNER', 'RL2 In')}
            </div>
            <div style={{ color: 'var(--color-slate-400)', fontSize: '11px', zIndex: 2, background: 'var(--color-slate-900)', padding: '2px 8px', borderRadius: '4px' }}>
              Drive Axle 2
            </div>
            <div className="chassis-wheel-group">
              {renderWheelSlot('RR2_INNER', 'RR2 In')}
              {renderWheelSlot('RR2_OUTER', 'RR2 Out')}
            </div>
          </div>

          {/* Spare Wheel */}
          <div className="spare-wheel-row">
            {renderWheelSlot('SPARE', 'Spare Wheel')}
          </div>
        </div>
      </div>

      {/* 4. Tyre Inventory Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2rem' }}
              placeholder="Search Tyre Serial # or Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="fitted">Fitted on Vehicle</option>
            <option value="in_store">In Warehouse Store</option>
            <option value="retread">Retreading</option>
            <option value="scrapped">Scrapped</option>
          </select>

          <select className="form-control" style={{ width: 'auto' }} value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">All Brands</option>
            <option value="Apollo">Apollo</option>
            <option value="MRF">MRF</option>
            <option value="JK Tyre">JK Tyre</option>
            <option value="Bridgestone">Bridgestone</option>
            <option value="Ceat">Ceat</option>
            <option value="Michelin">Michelin</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>Brand & Model</th>
                <th>Size</th>
                <th>Status</th>
                <th>Vehicle & Axle</th>
                <th>Tread Depth</th>
                <th>Retread #</th>
                <th>Purchase Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isTyresLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading tyre records...
                  </td>
                </tr>
              ) : (tyresData?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <Disc size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 0.5rem auto' }} />
                    <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>No Tyres in Registry</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Register new tyres to track tread depth and commercial axle wear.
                    </div>
                  </td>
                </tr>
              ) : (
                tyresData?.map((tyre: any) => {
                  const statusBadgeClass =
                    tyre.status === 'fitted'
                      ? 'badge-success'
                      : tyre.status === 'in_store'
                      ? 'badge-primary'
                      : tyre.status === 'retread'
                      ? 'badge-warning'
                      : 'badge-neutral';

                  const isCritical = tyre.current_tread_depth_mm <= 4.0;

                  return (
                    <tr key={tyre._id}>
                      <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{tyre.serial_number}</td>
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{tyre.brand}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{tyre.model_name || 'Standard'}</div>
                      </td>
                      <td>{tyre.size}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass}`} style={{ textTransform: 'capitalize' }}>
                          {tyre.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {tyre.current_truck_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span className="badge badge-neutral" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                              {tyre.current_truck_id?.truck_no || 'Truck'}
                            </span>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              [{tyre.axle_position}]
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>Warehouse</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 'var(--font-weight-bold)',
                            color: isCritical ? 'var(--color-danger)' : tyre.current_tread_depth_mm <= 7.0 ? 'var(--color-warning-600)' : 'var(--color-success-700)',
                          }}
                        >
                          {tyre.current_tread_depth_mm} mm
                        </span>
                        {isCritical && (
                          <span className="badge badge-danger" style={{ marginLeft: '0.375rem', fontSize: '9px', padding: '1px 4px' }}>
                            Worn Out
                          </span>
                        )}
                      </td>
                      <td>{tyre.retread_count || 0}</td>
                      <td>₹{tyre.purchase_cost?.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            title="Inspect Tread Depth"
                            onClick={() => {
                              setSelectedTyre(tyre);
                              setInspectForm({
                                tread_depth_mm: String(tyre.current_tread_depth_mm),
                                odometer_kms: '',
                                inspected_by: 'Fleet Maintenance Bay',
                                notes: '',
                              });
                              setIsInspectModalOpen(true);
                            }}
                          >
                            <Gauge size={14} /> Inspect
                          </button>
                          {tyre.status !== 'retread' && tyre.status !== 'scrapped' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-warning"
                              title="Send for Retreading"
                              onClick={() => {
                                if (confirm(`Send tyre ${tyre.serial_number} for retreading?`)) {
                                  retreadMutation.mutate(tyre._id);
                                }
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          {tyre.status !== 'scrapped' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              title="Scrap Tyre"
                              onClick={() => {
                                if (confirm(`Retire and scrap tyre ${tyre.serial_number}?`)) {
                                  scrapMutation.mutate(tyre._id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal: Register Tyre */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Tyre Asset"
      >
        <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Tyre Serial Number *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. APOLLO-ENDURACE-881"
                required
                value={registerForm.serial_number}
                onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brand *</label>
              <select
                className="form-control"
                value={registerForm.brand}
                onChange={(e) => setRegisterForm({ ...registerForm, brand: e.target.value })}
              >
                <option value="Apollo">Apollo</option>
                <option value="MRF">MRF</option>
                <option value="JK Tyre">JK Tyre</option>
                <option value="Bridgestone">Bridgestone</option>
                <option value="Ceat">Ceat</option>
                <option value="Michelin">Michelin</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Model Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. EnduRace HD"
                value={registerForm.model_name}
                onChange={(e) => setRegisterForm({ ...registerForm, model_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Size Specification</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 295/90 R20"
                value={registerForm.size}
                onChange={(e) => setRegisterForm({ ...registerForm, size: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Initial Tread Depth (mm) *</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                required
                value={registerForm.initial_tread_depth_mm}
                onChange={(e) => setRegisterForm({ ...registerForm, initial_tread_depth_mm: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Cost (₹)</label>
              <input
                type="number"
                className="form-control"
                value={registerForm.purchase_cost}
                onChange={(e) => setRegisterForm({ ...registerForm, purchase_cost: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Registering...' : 'Save to Warehouse'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. Modal: Mount Tyre */}
      <Modal
        isOpen={isMountModalOpen}
        onClose={() => setIsMountModalOpen(false)}
        title={`Mount Tyre to Position: ${targetSlot}`}
      >
        <form onSubmit={handleMountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Select Warehouse Tyre *</label>
            <select
              className="form-control"
              required
              value={mountForm.tyre_id}
              onChange={(e) => setMountForm({ ...mountForm, tyre_id: e.target.value })}
            >
              <option value="">Select unmounted tyre...</option>
              {(tyresData || [])
                .filter((t: any) => t.status === 'in_store' || t.status === 'retread')
                .map((t: any) => (
                  <option key={t._id} value={t._id}>
                    {t.serial_number} — {t.brand} ({t.current_tread_depth_mm}mm tread) [{t.status}]
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Vehicle Odometer at Installation (KM)</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g. 124500"
              value={mountForm.odometer_kms}
              onChange={(e) => setMountForm({ ...mountForm, odometer_kms: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsMountModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={mountMutation.isPending}>
              {mountMutation.isPending ? 'Mounting...' : 'Mount Tyre'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Inspect Tread Depth */}
      <Modal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        title={`Inspect Tread Wear: ${selectedTyre?.serial_number}`}
      >
        <form onSubmit={handleInspectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Brand & Size:</span>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{selectedTyre?.brand} ({selectedTyre?.size})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Previous Logged Tread:</span>
              <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedTyre?.current_tread_depth_mm} mm</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Measured Tread Depth (mm) *</label>
            <input
              type="number"
              step="0.1"
              className="form-control"
              required
              placeholder="e.g. 11.5"
              value={inspectForm.tread_depth_mm}
              onChange={(e) => setInspectForm({ ...inspectForm, tread_depth_mm: e.target.value })}
            />
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Statutory threshold is &ge; 4.0 mm for interstate commercial transit.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Current Vehicle Odometer (KM)</label>
            <input
              type="number"
              className="form-control"
              value={inspectForm.odometer_kms}
              onChange={(e) => setInspectForm({ ...inspectForm, odometer_kms: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Inspector Name</label>
            <input
              type="text"
              className="form-control"
              value={inspectForm.inspected_by}
              onChange={(e) => setInspectForm({ ...inspectForm, inspected_by: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsInspectModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={inspectMutation.isPending}>
              {inspectMutation.isPending ? 'Logging...' : 'Save Inspection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
