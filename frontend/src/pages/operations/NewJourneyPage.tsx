/**
 * ============================================================================
 * FLEET FLOW — PLAN & DISPATCH NEW JOURNEY (NewJourneyPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Interactive journey creation portal providing pre-dispatch conflict detection,
 * truck odometer pre-fill, multi-stop route checkpoint configuration, and
 * driver cash advance provisioning.
 * 
 * CORE ARCHITECTURAL SAFEGUARDS:
 * ------------------------------
 * 1. Live Resource Conflict Detection:
 *    - Real-time client & server validation verifying that the selected Truck
 *      and Driver are available and not double-booked on concurrent active trips.
 * 2. Compliance Gating:
 *    - Flags visual warnings if vehicle compliance certificates are expired.
 * 3. Atomic Odometer Sync:
 *    - Automatically pre-populates initial trip odometer from the vehicle asset.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { toast } from '../../stores/uiStore';
import {
  Truck as TruckIcon,
  User,
  MapPin,
  Calendar,
  IndianRupee,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRight,
  Send,
  Save,
  ArrowLeft,
  Package,
} from 'lucide-react';

export const NewJourneyPage: React.FC = () => {
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    truck_id: '',
    driver_id: '',
    billing_party_id: '',
    from_city: '',
    from_state: '',
    from_hub: '',
    to_city: '',
    to_state: '',
    to_hub: '',
    start_date: new Date().toISOString().split('T')[0],
    estimated_duration_days: 2,
    start_odometer_kms: '',
    loaded_weight_tonnes: '',
    cbm_volume: '',
    cargo_description: '',
    freight_rate: '',
    starting_cash_advance: '',
  });

  // Dynamic Route Checkpoints
  const [checkpoints, setCheckpoints] = useState<Array<{ city: string; state?: string }>>([]);
  const [newCheckpointCity, setNewCheckpointCity] = useState('');

  // 1. Fetch available trucks
  const { data: trucksData } = useQuery({
    queryKey: ['available-trucks'],
    queryFn: async () => {
      const res = await api.get('/fleet/trucks?limit=100');
      return res.data;
    },
  });

  // 2. Fetch active drivers
  const { data: driversData } = useQuery({
    queryKey: ['active-drivers'],
    queryFn: async () => {
      const res = await api.get('/fleet/drivers?limit=100');
      return res.data;
    },
  });

  // 3. Fetch customer billing parties
  const { data: partiesData } = useQuery({
    queryKey: ['billing-parties-select'],
    queryFn: async () => {
      const res = await api.get('/parties/billing?limit=100');
      return res.data;
    },
  });

  // Automatically pre-fill odometer when a truck is selected
  useEffect(() => {
    if (formData.truck_id && trucksData?.trucks) {
      const selectedTruck = trucksData.trucks.find((t: any) => t._id === formData.truck_id);
      if (selectedTruck && typeof selectedTruck.current_odometer_kms === 'number') {
        setFormData((prev) => ({
          ...prev,
          start_odometer_kms: selectedTruck.current_odometer_kms.toString(),
          // If truck has an assigned driver, optionally pre-select
          driver_id: prev.driver_id || (selectedTruck.current_driver_id?._id || selectedTruck.current_driver_id || ''),
        }));
      }
    }
  }, [formData.truck_id, trucksData]);

  // Selected vehicle & driver conflict helpers
  const selectedTruck = trucksData?.trucks?.find((t: any) => t._id === formData.truck_id);
  const selectedDriver = driversData?.drivers?.find((d: any) => d._id === formData.driver_id);

  const isTruckBusy = selectedTruck && selectedTruck.status === 'on_trip';
  const isTruckExpired = selectedTruck && selectedTruck.compliance_status === 'EXPIRED';
  const isDriverBusy = selectedDriver && selectedDriver.status !== 'active';

  // 4. Create Journey Mutation
  const createMutation = useMutation({
    mutationFn: async (dispatchImmediately: boolean) => {
      const payload = {
        truck_id: formData.truck_id,
        driver_id: formData.driver_id,
        billing_party_id: formData.billing_party_id || undefined,
        from_location: {
          city: formData.from_city,
          state: formData.from_state || undefined,
          hub_name: formData.from_hub || undefined,
        },
        to_location: {
          city: formData.to_city,
          state: formData.to_state || undefined,
          hub_name: formData.to_hub || undefined,
        },
        route_checkpoints: checkpoints.map((c) => ({
          city: c.city,
          state: c.state,
          status: 'pending',
        })),
        start_date: formData.start_date,
        estimated_duration_days: Number(formData.estimated_duration_days) || 2,
        start_odometer_kms: Number(formData.start_odometer_kms) || 0,
        loaded_weight_tonnes: Number(formData.loaded_weight_tonnes) || 0,
        cbm_volume: Number(formData.cbm_volume) || 0,
        cargo_description: formData.cargo_description,
        freight_rate: Number(formData.freight_rate) || 0,
        starting_cash_advance: Number(formData.starting_cash_advance) || 0,
        status: dispatchImmediately ? 'active' : 'draft',
      };

      const res = await api.post('/operations/journeys', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Journey created successfully.');
      navigate(`/operations/journeys/${data.journey._id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to create journey.');
    },
  });

  const handleAddCheckpoint = () => {
    if (!newCheckpointCity.trim()) return;
    setCheckpoints([...checkpoints, { city: newCheckpointCity.trim() }]);
    setNewCheckpointCity('');
  };

  const handleRemoveCheckpoint = (index: number) => {
    setCheckpoints(checkpoints.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent, dispatchImmediately: boolean) => {
    e.preventDefault();
    if (!formData.truck_id || !formData.driver_id || !formData.from_city || !formData.to_city) {
      toast.error('Please fill in vehicle, driver, origin city, and destination city.');
      return;
    }

    if (dispatchImmediately && isTruckBusy) {
      toast.error(`Vehicle ${selectedTruck?.truck_no} is already on an active trip.`);
      return;
    }

    if (dispatchImmediately && isTruckExpired) {
      toast.error(`Vehicle ${selectedTruck?.truck_no} has expired compliance certificates.`);
      return;
    }

    createMutation.mutate(dispatchImmediately);
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <PageHeader
        title="Plan & Dispatch Journey"
        subtitle="Schedule freight movements, allocate conflict-checked vehicles, and provision driver advances."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations', href: '/operations/journeys' },
          { label: 'Plan Journey' },
        ]}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/operations/journeys')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} /> Back to Roster
          </button>
        }
      />

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* SECTION 1: RESOURCE ALLOCATION */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <TruckIcon size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              1. Commercial Resource Assignment
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Vehicle Selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Assigned Fleet Vehicle <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.truck_id}
                onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
                required
              >
                <option value="">-- Choose Commercial Truck --</option>
                {trucksData?.trucks?.map((t: any) => (
                  <option key={t._id} value={t._id}>
                    {t.truck_no} — {t.make} {t.model} ({t.tonnage_capacity}T) [{t.status?.toUpperCase()}]
                  </option>
                ))}
              </select>
              {isTruckBusy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-warning-600)', fontSize: 'var(--font-size-xs)', marginTop: '0.375rem' }}>
                  <AlertTriangle size={14} /> Warning: Vehicle is currently marked On Trip.
                </div>
              )}
              {isTruckExpired && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', marginTop: '0.375rem' }}>
                  <AlertTriangle size={14} /> Alert: Statutory certificates are EXPIRED. Renew before dispatch.
                </div>
              )}
            </div>

            {/* Driver Selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Assigned Professional Driver <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                required
              >
                <option value="">-- Choose Driver --</option>
                {driversData?.drivers?.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.phone}) — Lic: {d.license_number}
                  </option>
                ))}
              </select>
              {isDriverBusy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-warning-600)', fontSize: 'var(--font-size-xs)', marginTop: '0.375rem' }}>
                  <AlertTriangle size={14} /> Driver status is currently {selectedDriver?.status}.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: FREIGHT ROUTE & CUSTOMER */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <MapPin size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              2. Freight Route & Shipper Details
            </h3>
          </div>

          {/* Customer / Billing Party */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Customer / Shipper Billing Party</label>
            <select
              className="form-control"
              value={formData.billing_party_id}
              onChange={(e) => setFormData({ ...formData, billing_party_id: e.target.value })}
            >
              <option value="">-- Optional: Link Shippers / Consignor --</option>
              {partiesData?.parties?.map((p: any) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.gstin ? `(GSTIN: ${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Origin Details */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Origin City <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                className="form-control"
                value={formData.from_city}
                onChange={(e) => setFormData({ ...formData, from_city: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Origin State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                className="form-control"
                value={formData.from_state}
                onChange={(e) => setFormData({ ...formData, from_state: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Loading Hub / Port Facility</label>
              <input
                type="text"
                placeholder="e.g. Nhava Sheva Terminal 2"
                className="form-control"
                value={formData.from_hub}
                onChange={(e) => setFormData({ ...formData, from_hub: e.target.value })}
              />
            </div>
          </div>

          {/* Destination Details */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Destination City <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Delhi NCR"
                className="form-control"
                value={formData.to_city}
                onChange={(e) => setFormData({ ...formData, to_city: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination State</label>
              <input
                type="text"
                placeholder="e.g. Delhi"
                className="form-control"
                value={formData.to_state}
                onChange={(e) => setFormData({ ...formData, to_state: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination Warehouse / Depot</label>
              <input
                type="text"
                placeholder="e.g. Okhla Logistics Center"
                className="form-control"
                value={formData.to_hub}
                onChange={(e) => setFormData({ ...formData, to_hub: e.target.value })}
              />
            </div>
          </div>

          {/* Intermediate Checkpoints */}
          <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>En-Route Transit Checkpoints (Optional)</label>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Add intermediate town / highway stop (e.g. Surat, Ahmedabad)"
                className="form-control"
                value={newCheckpointCity}
                onChange={(e) => setNewCheckpointCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCheckpoint();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddCheckpoint}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
              >
                <Plus size={16} /> Add Stop
              </button>
            </div>

            {checkpoints.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {checkpoints.map((cp, idx) => (
                  <span
                    key={idx}
                    className="badge badge-neutral"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.625rem' }}
                  >
                    <span>{idx + 1}. {cp.city}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCheckpoint(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: CARGO, ODOMETER & TRIP CASH ADVANCE */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <Package size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              3. Cargo Specifications, Odometer & Trip Cash Advance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Departure Odometer (KM) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 10450"
                className="form-control"
                value={formData.start_odometer_kms}
                onChange={(e) => setFormData({ ...formData, start_odometer_kms: e.target.value })}
                required
              />
              <span className="form-hint">Synced from vehicle master odometer.</span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Loaded Weight (Tonnes)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 32.5"
                className="form-control"
                value={formData.loaded_weight_tonnes}
                onChange={(e) => setFormData({ ...formData, loaded_weight_tonnes: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Volume (CBM / Cubic Meters)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 45.0"
                className="form-control"
                value={formData.cbm_volume}
                onChange={(e) => setFormData({ ...formData, cbm_volume: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Cargo Description / Commodity Details</label>
            <input
              type="text"
              placeholder="e.g. Heavy Steel Coils / FMCG Packaged Cartons"
              className="form-control"
              value={formData.cargo_description}
              onChange={(e) => setFormData({ ...formData, cargo_description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Agreed Freight Contract Rate (₹)</label>
              <input
                type="number"
                placeholder="e.g. 75000"
                className="form-control"
                value={formData.freight_rate}
                onChange={(e) => setFormData({ ...formData, freight_rate: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Starting Cash Advance to Driver (₹)</label>
              <input
                type="number"
                placeholder="e.g. 15000"
                className="form-control"
                value={formData.starting_cash_advance}
                onChange={(e) => setFormData({ ...formData, starting_cash_advance: e.target.value })}
              />
              <span className="form-hint">En-route toll and food cash.</span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Planned Departure Date <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Estimated Transit Days</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 3"
                className="form-control"
                value={formData.estimated_duration_days}
                onChange={(e) => setFormData({ ...formData, estimated_duration_days: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* SUBMIT ACTIONS BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', marginBottom: '3rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/operations/journeys')}
            disabled={createMutation.isPending}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-secondary"
            disabled={createMutation.isPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} /> Save as Draft Plan
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => handleSubmit(e, true)}
            disabled={createMutation.isPending || isTruckBusy || isTruckExpired}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Send size={16} />
            {createMutation.isPending ? 'Dispatching...' : 'Dispatch Vehicle Now'}
          </button>
        </div>
      </form>
    </div>
  );
};
