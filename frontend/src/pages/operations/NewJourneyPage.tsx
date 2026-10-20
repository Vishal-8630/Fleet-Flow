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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  Building2,
  FileText,
  CheckCircle2,
  Info,
  Layers,
  Wrench,
} from 'lucide-react';

export const NewJourneyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Ingest selected LR IDs from navigation state or URL query params
  const initialLrIds: string[] = (() => {
    if (Array.isArray(location.state?.lr_ids) && location.state.lr_ids.length > 0) {
      return location.state.lr_ids;
    }
    const queryParam = searchParams.get('lr_ids');
    if (queryParam) {
      return queryParam.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
    return [];
  })();

  const [selectedLrIds, setSelectedLrIds] = useState<string[]>(initialLrIds);
  const [journeyType, setJourneyType] = useState<'commercial' | 'internal_repositioning' | 'maintenance'>(
    initialLrIds.length > 0 ? 'commercial' : 'internal_repositioning'
  );

  // Form State
  const [formData, setFormData] = useState({
    branch_id: '',
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
    estimated_duration_days: 2 as number | string,
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

  // 4. Fetch company branches for operational attribution (DEC-010)
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['company-branches'],
    queryFn: async () => {
      const res = await api.get('/company/branches');
      return res.data?.branches || [];
    },
  });

  const activeBranches = Array.isArray(branchesData)
    ? branchesData.filter((b: any) => b.is_active)
    : [];

  // Default branch assignment rules (DEC-010 / G3)
  useEffect(() => {
    if (activeBranches.length === 1 && !formData.branch_id) {
      // Single active branch: frictionless auto-selection
      setFormData((prev) => ({ ...prev, branch_id: activeBranches[0]._id }));
    } else if (activeBranches.length > 1 && !formData.branch_id) {
      // Multi-branch: default to Head Office if available
      const headOffice = activeBranches.find((b: any) => b.is_head_office);
      if (headOffice) {
        setFormData((prev) => ({ ...prev, branch_id: headOffice._id }));
      }
    }
  }, [activeBranches]);

  const isCommercialWithLrs = journeyType === 'commercial' && selectedLrIds.length > 0;

  // Automatically pre-fill odometer when a truck is selected
  useEffect(() => {
    if (formData.truck_id && trucksData?.trucks) {
      const selectedTruck = trucksData.trucks.find((t: any) => t._id === formData.truck_id);
      if (selectedTruck && typeof selectedTruck.current_odometer_kms === 'number') {
        setFormData((prev) => ({
          ...prev,
          start_odometer_kms: selectedTruck.current_odometer_kms.toString(),
          // If truck has an assigned driver and not commercial mode with LRs, optionally pre-select
          driver_id: isCommercialWithLrs
            ? prev.driver_id
            : (prev.driver_id || (selectedTruck.current_driver_id?._id || selectedTruck.current_driver_id || '')),
        }));
      }
    }
  }, [formData.truck_id, trucksData, isCommercialWithLrs]);

  // 4.5. Fetch attached LRs details when LRs are selected
  const { data: selectedLrsData, isLoading: selectedLrsLoading } = useQuery({
    queryKey: ['selected-lrs-detail', selectedLrIds],
    queryFn: async () => {
      if (!selectedLrIds || selectedLrIds.length === 0) return [];
      const results = await Promise.all(
        selectedLrIds.map(async (id) => {
          try {
            const res = await api.get(`/commercial/entries/${id}`);
            return res.data?.entry || null;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },
    enabled: selectedLrIds.length > 0,
  });

  // LR Asset Consistency & Derivation Helpers
  const lrValidationState = React.useMemo(() => {
    if (!selectedLrsData || selectedLrsData.length === 0 || journeyType !== 'commercial') {
      return {
        hasMissingAssetRef: false,
        missingAssetLrs: [] as string[],
        hasTruckMismatch: false,
        conflictingTrucks: [] as string[],
        hasDriverMismatch: false,
        conflictingDrivers: [] as string[],
        derivedTruckId: '',
        derivedDriverId: '',
        derivedVehicleNumber: '',
        derivedDriverName: '',
        distinctParties: [] as Array<{ id: string; name: string; gstin?: string; lrCount: number }>,
        isSingleParty: false,
        isMultiParty: false,
      };
    }

    const lrs = selectedLrsData;
    const missing = lrs.filter((l: any) => !l.truck_id || !l.driver_id);
    const missingLrs = missing.map((l: any) => l.lr_no || 'Unknown');

    const firstTruckId = lrs[0]?.truck_id?._id || lrs[0]?.truck_id;
    const firstDriverId = lrs[0]?.driver_id?._id || lrs[0]?.driver_id;
    const firstVehicleNo = lrs[0]?.truck_id?.truck_no || lrs[0]?.vehicle_number || '';
    const firstDriverName = lrs[0]?.driver_id?.name || lrs[0]?.driver_name || '';

    const conflictingTrucks: string[] = [];
    const conflictingDrivers: string[] = [];

    lrs.forEach((l: any) => {
      const tId = l.truck_id?._id || l.truck_id;
      const vNo = l.truck_id?.truck_no || l.vehicle_number || 'Unknown';
      if (firstTruckId && tId && String(tId) !== String(firstTruckId)) {
        if (!conflictingTrucks.includes(vNo)) conflictingTrucks.push(vNo);
      }

      const dId = l.driver_id?._id || l.driver_id;
      const dName = l.driver_id?.name || l.driver_name || 'Unknown';
      if (firstDriverId && dId && String(dId) !== String(firstDriverId)) {
        if (!conflictingDrivers.includes(dName)) conflictingDrivers.push(dName);
      }
    });

    const hasTruckMismatch = conflictingTrucks.length > 0;
    const hasDriverMismatch = conflictingDrivers.length > 0;
    const hasMissingAssetRef = missing.length > 0;

    // Collect distinct registered Billing Parties across selected LRs
    const partiesMap = new Map<string, { id: string; name: string; gstin?: string; lrCount: number }>();
    lrs.forEach((l: any) => {
      const p = l.billing_party_id;
      const pId = p?._id || (typeof p === 'string' ? p : null);
      if (pId) {
        const idStr = String(pId);
        const name = p?.name || l.billing_party_name || `Party (${idStr.slice(-6)})`;
        const gstin = p?.gstin || '';
        const existing = partiesMap.get(idStr);
        if (existing) {
          existing.lrCount += 1;
        } else {
          partiesMap.set(idStr, { id: idStr, name, gstin, lrCount: 1 });
        }
      }
    });

    const distinctParties = Array.from(partiesMap.values());
    const isSingleParty = distinctParties.length === 1;
    const isMultiParty = distinctParties.length > 1;

    return {
      hasMissingAssetRef,
      missingAssetLrs: missingLrs,
      hasTruckMismatch,
      conflictingTrucks: [firstVehicleNo, ...conflictingTrucks].filter(Boolean),
      hasDriverMismatch,
      conflictingDrivers: [firstDriverName, ...conflictingDrivers].filter(Boolean),
      derivedTruckId: (!hasMissingAssetRef && !hasTruckMismatch && firstTruckId) ? String(firstTruckId) : '',
      derivedDriverId: (!hasMissingAssetRef && !hasDriverMismatch && firstDriverId) ? String(firstDriverId) : '',
      derivedVehicleNumber: firstVehicleNo,
      derivedDriverName: firstDriverName,
      distinctParties,
      isSingleParty,
      isMultiParty,
    };
  }, [selectedLrsData, journeyType]);

  // Auto-prefill or clear supported cargo, weights, volume, corridor, customer, truck, driver, and branch when selected LRs change
  useEffect(() => {
    if (selectedLrsData && selectedLrsData.length > 0) {
      const lrs = selectedLrsData;

      // Check for stale or already assigned/invoiced LRs
      const staleLrs = lrs.filter((l: any) => l.journey_id || l.status !== 'active');
      if (staleLrs.length > 0) {
        toast.error(`Warning: Consignment ${staleLrs.map((l: any) => l.lr_no).join(', ')} is already assigned or ineligible for new dispatch.`);
      }

      // 1. Customer derivation:
      // Multi-Billing-Party support: If all LRs belong to a single party, preserve that party ID for backward compat.
      // If LRs belong to different parties, do not pick an arbitrary customer.
      const distinctPartyIds = Array.from(
        new Set(
          lrs.map((l: any) => l.billing_party_id?._id || (typeof l.billing_party_id === 'string' ? l.billing_party_id : null)).filter(Boolean)
        )
      );
      const derivedPartyId = distinctPartyIds.length === 1 ? String(distinctPartyIds[0]) : '';

      // 2. Asset derivation and validation
      const missingAssetLrs = lrs.filter((l: any) => !l.truck_id || !l.driver_id);
      const hasMissingAssetRef = missingAssetLrs.length > 0;

      const firstTruck = lrs[0]?.truck_id?._id || lrs[0]?.truck_id;
      const firstDriver = lrs[0]?.driver_id?._id || lrs[0]?.driver_id;

      const hasTruckMismatch = lrs.some((l: any) => {
        const tId = l.truck_id?._id || l.truck_id;
        return String(tId) !== String(firstTruck);
      });

      const hasDriverMismatch = lrs.some((l: any) => {
        const dId = l.driver_id?._id || l.driver_id;
        return String(dId) !== String(firstDriver);
      });

      if (hasMissingAssetRef) {
        toast.error(`One or more selected historical LRs (${missingAssetLrs.map((l: any) => l.lr_no).join(', ')}) lack registered vehicle or driver references.`);
      } else if (hasTruckMismatch) {
        toast.error('Selected LRs reference different vehicles (TRUCK_MISMATCH). All consignments on a journey must share the same physical vehicle.');
      } else if (hasDriverMismatch) {
        toast.error('Selected LRs reference different drivers (DRIVER_MISMATCH). All consignments on a journey must share the same operating driver.');
      }

      const derivedTruckId = (!hasMissingAssetRef && !hasTruckMismatch && firstTruck) ? String(firstTruck) : '';
      const derivedDriverId = (!hasMissingAssetRef && !hasDriverMismatch && firstDriver) ? String(firstDriver) : '';

      // 3. Branch derivation
      const firstBranch = lrs[0]?.branch_id?._id || lrs[0]?.branch_id;

      // 4. Totals
      const totalWeight = lrs.reduce((acc: number, l: any) => acc + (Number(l.actual_weight_tonnes) || 0), 0);
      const totalVolume = lrs.reduce((acc: number, l: any) => acc + (Number(l.cbm_volume) || 0), 0);
      const totalFreight = lrs.reduce((acc: number, l: any) => acc + (Number(l.freight_amount) || 0), 0);
      const cargoDescs = Array.from(new Set(lrs.map((l: any) => l.goods_description).filter(Boolean))).join(', ');

      setFormData((prev) => ({
        ...prev,
        truck_id: derivedTruckId,
        driver_id: derivedDriverId,
        billing_party_id: derivedPartyId,
        branch_id: firstBranch ? String(firstBranch) : prev.branch_id,
        from_city: lrs[0]?.from_location || '',
        to_city: lrs[0]?.to_location || '',
        cargo_description: cargoDescs || '',
        loaded_weight_tonnes: totalWeight > 0 ? totalWeight.toFixed(2) : '',
        cbm_volume: totalVolume > 0 ? totalVolume.toFixed(2) : '',
        freight_rate: totalFreight > 0 ? String(totalFreight) : '',
      }));
    } else if (selectedLrIds.length === 0 && journeyType === 'commercial') {
      // When all LRs are removed in commercial mode, clear derived values so stale data is not retained
      setFormData((prev) => ({
        ...prev,
        truck_id: '',
        driver_id: '',
        start_odometer_kms: '',
        billing_party_id: '',
        from_city: '',
        to_city: '',
        cargo_description: '',
        loaded_weight_tonnes: '',
        cbm_volume: '',
        freight_rate: '',
      }));
    }
  }, [selectedLrsData, selectedLrIds.length, journeyType]);

  // Remove individual selected LR handler
  const handleRemoveLr = (lrId: string) => {
    setSelectedLrIds((prev) => prev.filter((id) => id !== lrId));
  };

  // Switch journey type handler
  const handleJourneyTypeChange = (newType: 'commercial' | 'internal_repositioning' | 'maintenance') => {
    setJourneyType(newType);
    if (newType !== 'commercial') {
      setFormData((prev) => ({ ...prev, billing_party_id: '' }));
    }
  };

  // Selected vehicle & driver conflict helpers
  const selectedTruck = trucksData?.trucks?.find((t: any) => t._id === formData.truck_id);
  const selectedDriver = driversData?.drivers?.find((d: any) => d._id === formData.driver_id);

  const isTruckBusy = selectedTruck && selectedTruck.status === 'on_trip';
  const isTruckExpired = selectedTruck && selectedTruck.compliance_status === 'EXPIRED';
  const isDriverBusy = selectedDriver && selectedDriver.status !== 'active';

  // 5. Create Journey Mutation
  const createMutation = useMutation({
    mutationFn: async (dispatchImmediately: boolean) => {
      const payload: any = {
        journey_type: journeyType,
        branch_id: formData.branch_id || undefined,
        truck_id: formData.truck_id,
        driver_id: formData.driver_id,
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
        estimated_duration_days: Math.max(1, parseInt(String(formData.estimated_duration_days), 10) || 1),
        start_odometer_kms: Number(formData.start_odometer_kms) || 0,
        loaded_weight_tonnes: Number(formData.loaded_weight_tonnes) || 0,
        cbm_volume: Number(formData.cbm_volume) || 0,
        cargo_description: formData.cargo_description,
        freight_rate: Number(formData.freight_rate) || 0,
        starting_cash_advance: Number(formData.starting_cash_advance) || 0,
        status: dispatchImmediately ? 'active' : 'draft',
      };

      if (journeyType === 'commercial') {
        const distinctPartyIds = Array.from(
          new Set(
            selectedLrsData
              ?.map((l: any) => l.billing_party_id?._id || (typeof l.billing_party_id === 'string' ? l.billing_party_id : null))
              .filter(Boolean)
          )
        );
        // Retain journey-level billing_party_id only if exactly 1 customer exists (backward compat).
        // If mixed-party consignments are bundled, leave journey-level party undefined.
        payload.billing_party_id = distinctPartyIds.length === 1 ? distinctPartyIds[0] : undefined;
        payload.lr_ids = selectedLrIds;
      } else {
        payload.billing_party_id = undefined;
        payload.lr_ids = [];
      }

      const res = await api.post('/operations/journeys', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Journey created successfully.');
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
      queryClient.invalidateQueries({ queryKey: ['journey-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['available-trucks'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['active-drivers'] });
      navigate(`/operations/journeys/${data.journey._id}`);
    },
    onError: (err: any) => {
      const serverCode = err.response?.data?.code;
      const serverError = err.response?.data?.error;
      if (serverCode === 'LR_ALREADY_ASSIGNED') {
        toast.error(serverError || 'One or more selected Lorry Receipts are already assigned to another journey.');
      } else if (serverCode === 'TRUCK_MISMATCH') {
        toast.error(serverError || 'Vehicle mismatch: All consignments on a commercial journey must share the same physical vehicle.');
      } else if (serverCode === 'DRIVER_MISMATCH') {
        toast.error(serverError || 'Driver mismatch: All consignments on a commercial journey must share the same operating driver.');
      } else if (serverCode === 'TRUCK_CONFLICT_WITH_LRS') {
        toast.error(serverError || 'Vehicle conflict: The supplied vehicle does not match the vehicle assigned to the selected Lorry Receipts.');
      } else if (serverCode === 'DRIVER_CONFLICT_WITH_LRS') {
        toast.error(serverError || 'Driver conflict: The supplied driver does not match the driver assigned to the selected Lorry Receipts.');
      } else if (serverCode === 'LR_MISSING_ASSET_REFERENCE') {
        toast.error(serverError || 'Historical consignment missing asset reference: Selected LRs must reference registered vehicle and driver master records.');
      } else if (serverCode === 'CUSTOMER_MISMATCH') {
        toast.error(serverError || 'Customer mismatch: All Lorry Receipts on a journey must belong to the same Billing Party customer.');
      } else if (serverCode === 'BRANCH_MISMATCH') {
        toast.error(serverError || 'Branch mismatch: All Lorry Receipts must originate from the selected branch.');
      } else if (serverCode === 'INVOICED_LR_INELIGIBLE') {
        toast.error(serverError || 'One or more selected Lorry Receipts have already been invoiced and cannot be dispatched on a new journey.');
      } else if (serverCode === 'LR_REQUIRED_FOR_BILLING_PARTY_JOURNEY' || serverCode === 'COMMERCIAL_JOURNEY_REQUIRES_LRS') {
        toast.error(serverError || 'A commercial Billing Party journey requires at least one eligible Lorry Receipt.');
      } else if (serverCode === 'INTERNAL_JOURNEY_CANNOT_HAVE_BILLING_PARTY') {
        toast.error(serverError || 'Internal repositioning and maintenance journeys cannot have a Billing Party customer.');
      } else {
        toast.error(serverError || err.message || 'Failed to create journey.');
      }
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

    // Mandatory LR rule enforcement for commercial journeys
    if (journeyType === 'commercial') {
      if (selectedLrIds.length === 0) {
        toast.error('A Billing Party commercial journey must contain one or more eligible Lorry Receipts.');
        return;
      }
      if (lrValidationState.hasMissingAssetRef) {
        toast.error(`Cannot dispatch journey: Selected historical LR(s) (${lrValidationState.missingAssetLrs.join(', ')}) lack registered vehicle or driver references (LR_MISSING_ASSET_REFERENCE). Update LRs before proceeding.`);
        return;
      }
      if (lrValidationState.hasTruckMismatch) {
        toast.error('Cannot dispatch journey: Selected LRs reference different vehicles (TRUCK_MISMATCH). All consignments on a journey must share the same physical vehicle.');
        return;
      }
      if (lrValidationState.hasDriverMismatch) {
        toast.error('Cannot dispatch journey: Selected LRs reference different drivers (DRIVER_MISMATCH). All consignments on a journey must share the same operating driver.');
        return;
      }
      const ineligible = selectedLrsData?.filter((l: any) => l.journey_id || l.status !== 'active');
      if (ineligible && ineligible.length > 0) {
        toast.error(`Cannot submit: LR ${ineligible.map((l: any) => l.lr_no).join(', ')} is already assigned or ineligible for dispatch.`);
        return;
      }
    }

    if (journeyType !== 'commercial' && formData.billing_party_id) {
      toast.error('Internal repositioning and maintenance journeys cannot be linked to a Billing Party customer.');
      return;
    }

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

    if (activeBranches.length > 1 && !formData.branch_id) {
      toast.error('Please select the originating regional branch for this trip.');
      return;
    }

    const transitDays = parseInt(String(formData.estimated_duration_days), 10);
    if (formData.estimated_duration_days === '' || isNaN(transitDays) || transitDays < 1) {
      toast.error('Estimated Transit Days must be at least 1 day.');
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
        {/* SECTION 0: MOVEMENT CLASSIFICATION & JOURNEY TYPE */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <Layers size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              Movement Classification & Journey Type
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem' }}>
            {/* Commercial Option */}
            <div
              onClick={() => handleJourneyTypeChange('commercial')}
              style={{
                cursor: 'pointer',
                border: journeyType === 'commercial' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-color)',
                backgroundColor: journeyType === 'commercial' ? 'var(--color-primary-50)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: journeyType === 'commercial' ? 'var(--color-primary-900)' : 'var(--text-primary)' }}>
                  Commercial Customer Journey
                </span>
                {journeyType === 'commercial' && <CheckCircle2 size={16} color="var(--color-primary-600)" />}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Commercial transport carrying customer consignments. <strong>Requires one or more eligible LRs.</strong>
              </p>
            </div>

            {/* Repositioning Option */}
            <div
              onClick={() => handleJourneyTypeChange('internal_repositioning')}
              style={{
                cursor: 'pointer',
                border: journeyType === 'internal_repositioning' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-color)',
                backgroundColor: journeyType === 'internal_repositioning' ? 'var(--color-primary-50)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: journeyType === 'internal_repositioning' ? 'var(--color-primary-900)' : 'var(--text-primary)' }}>
                  Internal Repositioning
                </span>
                {journeyType === 'internal_repositioning' && <CheckCircle2 size={16} color="var(--color-primary-600)" />}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Empty truck balancing or inter-branch asset transfer. No customer billing party or LRs.
              </p>
            </div>

            {/* Maintenance Option */}
            <div
              onClick={() => handleJourneyTypeChange('maintenance')}
              style={{
                cursor: 'pointer',
                border: journeyType === 'maintenance' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-color)',
                backgroundColor: journeyType === 'maintenance' ? 'var(--color-primary-50)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: journeyType === 'maintenance' ? 'var(--color-primary-900)' : 'var(--text-primary)' }}>
                  Maintenance & Garage Run
                </span>
                {journeyType === 'maintenance' && <CheckCircle2 size={16} color="var(--color-primary-600)" />}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Transit to workshop, garage, fitness inspection, or bodybuilder. No commercial cargo.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 1: RESOURCE ALLOCATION */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <TruckIcon size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              1. Commercial Resource Assignment
            </h3>
          </div>

          {/* Asset Consistency & Incompatibility Error Callouts */}
          {isCommercialWithLrs && lrValidationState.hasMissingAssetRef && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>
                <strong style={{ color: 'var(--color-danger)', display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-sm)' }}>
                  Missing Historical Asset References (LR_MISSING_ASSET_REFERENCE)
                </strong>
                Consignment(s) <strong>{lrValidationState.missingAssetLrs.join(', ')}</strong> were issued without registered vehicle or driver references. Historical LRs cannot enter a commercial journey until they are explicitly updated with registered master fleet assets.
              </div>
            </div>
          )}

          {isCommercialWithLrs && lrValidationState.hasTruckMismatch && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>
                <strong style={{ color: 'var(--color-danger)', display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-sm)' }}>
                  Vehicle Mismatch (TRUCK_MISMATCH)
                </strong>
                The selected Lorry Receipts reference different physical vehicles (<strong>{lrValidationState.conflictingTrucks.join(' vs ')}</strong>). All consignments on a commercial journey must share the same physical vehicle.
              </div>
            </div>
          )}

          {isCommercialWithLrs && lrValidationState.hasDriverMismatch && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>
                <strong style={{ color: 'var(--color-danger)', display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-sm)' }}>
                  Driver Mismatch (DRIVER_MISMATCH)
                </strong>
                The selected Lorry Receipts reference different operating drivers (<strong>{lrValidationState.conflictingDrivers.join(' vs ')}</strong>). All consignments on a commercial journey must share the same operating driver.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Vehicle Selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Assigned Fleet Vehicle <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                {isCommercialWithLrs && (
                  <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                    Inherited from Consignments
                  </span>
                )}
              </div>
              <select
                className="form-control"
                value={formData.truck_id}
                onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
                disabled={isCommercialWithLrs}
                required
                style={{ backgroundColor: isCommercialWithLrs ? 'var(--bg-disabled)' : undefined }}
              >
                <option value="">-- Choose Commercial Truck --</option>
                {trucksData?.trucks?.map((t: any) => (
                  <option key={t._id} value={t._id}>
                    {t.truck_no} — {t.make} {t.model} ({t.tonnage_capacity}T) [{t.status?.toUpperCase()}]
                  </option>
                ))}
              </select>
              {isCommercialWithLrs && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Assigned vehicle is inherited from attached Lorry Receipts ({selectedLrIds.length} LR{selectedLrIds.length !== 1 ? 's' : ''}).
                </div>
              )}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Assigned Professional Driver <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                {isCommercialWithLrs && (
                  <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                    Inherited from Consignments
                  </span>
                )}
              </div>
              <select
                className="form-control"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                disabled={isCommercialWithLrs}
                required
                style={{ backgroundColor: isCommercialWithLrs ? 'var(--bg-disabled)' : undefined }}
              >
                <option value="">-- Choose Driver --</option>
                {driversData?.drivers?.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.phone}) — Lic: {d.license_number}
                  </option>
                ))}
              </select>
              {isCommercialWithLrs && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Operating driver is inherited from attached Lorry Receipts ({selectedLrIds.length} LR{selectedLrIds.length !== 1 ? 's' : ''}).
                </div>
              )}
              {isDriverBusy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-warning-600)', fontSize: 'var(--font-size-xs)', marginTop: '0.375rem' }}>
                  <AlertTriangle size={14} /> Driver status is currently {selectedDriver?.status}.
                </div>
              )}
            </div>
          </div>

          {/* Regional Dispatch Branch Selection (DEC-010) */}
          <div className="form-group" style={{ marginTop: '1.25rem', marginBottom: 0, borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <Building2 size={16} color="var(--color-primary-600)" />
                Originating Regional Branch
                {activeBranches.length > 1 && <span style={{ color: 'var(--color-danger)' }}>*</span>}
              </label>
              {activeBranches.length === 1 && (
                <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                  Auto-selected: Primary Branch
                </span>
              )}
              {activeBranches.length === 0 && (
                <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                  Company Direct / Unbranched
                </span>
              )}
            </div>

            {branchesLoading ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Loading branch configuration...</div>
            ) : activeBranches.length === 0 ? (
              <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                No regional branches configured. Trip will be attributed company-wide to Head Office direct.
              </div>
            ) : (
              <>
                <select
                  className="form-control"
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required={activeBranches.length > 1}
                >
                  {activeBranches.length > 1 && <option value="">-- Choose Originating Regional Branch --</option>}
                  {activeBranches.map((b: any) => (
                    <option key={b._id} value={b._id}>
                      {b.branch_name} ({b.branch_code}) {b.is_head_office ? '★ Head Office' : ''} — {[b.city, b.state].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                  Originating dispatch branch responsible for trip accounting, LR generation sequence, and commercial profitability attribution.
                </div>
              </>
            )}
          </div>
        </div>

        {/* SECTION 2: FREIGHT ROUTE & SHIPPER DETAILS */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <MapPin size={20} color="var(--color-primary-600)" />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--text-main)' }}>
              2. Freight Route & Shipper Details
            </h3>
          </div>

          {/* Attached Consignments Card (for Commercial Journeys) */}
          {journeyType === 'commercial' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <FileText size={16} color="var(--color-primary-600)" />
                  Attached Consignments (Lorry Receipts) <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/bill-entry/all')}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  Browse Lorry Receipts
                </button>
              </div>

              {selectedLrIds.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    border: '1.5px dashed var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <AlertTriangle size={24} color="var(--color-danger)" />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                    No Lorry Receipts Attached
                  </div>
                  <p style={{ margin: '0.375rem 0 1rem 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Every Billing Party commercial journey must contain one or more eligible Lorry Receipts. Direct dispatches without LRs are restricted to internal repositioning and maintenance.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/bill-entry/all')}
                  >
                    Select LRs from Registry
                  </button>
                </div>
              ) : selectedLrsLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Loading attached consignment details...
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead style={{ backgroundColor: 'var(--color-slate-50)' }}>
                        <tr>
                          <th>LR #</th>
                          <th>Billing Party</th>
                          <th>Parties (Consignor → Consignee)</th>
                          <th>Cargo & Specs</th>
                          <th>Weight / Volume</th>
                          <th>Freight Amount</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLrsData?.map((lr: any) => {
                          const isLRIneligible = Boolean(lr.journey_id || lr.status !== 'active');
                          return (
                            <tr key={lr._id} style={{ backgroundColor: isLRIneligible ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--color-primary-600)' }}>{lr.lr_no}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                  {new Date(lr.lr_date).toLocaleDateString()}
                                </div>
                                {isLRIneligible && (
                                  <span className="badge badge-danger" style={{ fontSize: '0.625rem', marginTop: '0.25rem' }}>
                                    {lr.journey_id ? 'Already Assigned' : lr.status === 'invoiced' ? 'Invoiced' : 'Cancelled'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {lr.billing_party_id?.name || lr.billing_party_name || '—'}
                                </div>
                                {lr.billing_party_id?.gstin && (
                                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                    GSTIN: {lr.billing_party_id.gstin}
                                  </div>
                                )}
                              </td>
                            <td>
                              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                From: {lr.consignor?.name || '—'}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                To: {lr.consignee?.name || '—'}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 'var(--font-size-xs)' }}>
                                {lr.package_count} {lr.packaging_type} • {lr.goods_description}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                {lr.actual_weight_tonnes || 0} Tonnes
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                {lr.cbm_volume ? `${lr.cbm_volume} CBM` : ''}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                ₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}
                              </div>
                              <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>
                                {lr.freight_terms?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleRemoveLr(lr._id)}
                                title="Remove LR from this journey"
                                style={{ color: 'var(--color-danger)' }}
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '0.625rem 1rem', backgroundColor: 'var(--color-slate-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Total {selectedLrsData?.length} LR(s) attached. Cargo, route, and weight are prefilled from these consignments.
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate('/bill-entry/all')}
                    >
                      + Add More LRs
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Internal Movement Notice Banner */}
          {journeyType !== 'commercial' && (
            <div
              style={{
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Info size={20} color="var(--color-primary-600)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <strong>{journeyType === 'internal_repositioning' ? 'Internal Fleet Repositioning' : 'Maintenance Transit'}:</strong>{' '}
                This movement is for internal operational purposes only. No customer Billing Party or consignments will be billed. To create a journey for a customer, switch to <strong>Commercial Customer Journey</strong> and select Lorry Receipts.
              </div>
            </div>
          )}

          {/* Customer / Billing Party */}
          {journeyType === 'commercial' ? (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 600 }}>
                  Customer / Billing Party Attribution
                </label>
                {lrValidationState.isSingleParty && (
                  <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                    Derived from Attached LRs (Single Customer)
                  </span>
                )}
                {lrValidationState.isMultiParty && (
                  <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>
                    Multi-Billing-Party Journey ({lrValidationState.distinctParties.length} Customers)
                  </span>
                )}
              </div>

              {selectedLrIds.length === 0 ? (
                <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Attach one or more eligible Lorry Receipts above. The journey's customer billing parties will be derived automatically from the attached consignments.
                </div>
              ) : lrValidationState.isSingleParty ? (
                <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-main)' }}>
                        {lrValidationState.distinctParties[0]?.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        {lrValidationState.distinctParties[0]?.gstin ? `GSTIN: ${lrValidationState.distinctParties[0].gstin}` : 'GST: Unregistered / Exempt'}
                      </div>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                      All {selectedLrIds.length} Consignment{selectedLrIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: 'var(--color-primary-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Info size={16} color="var(--color-primary-600)" />
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-900)' }}>
                      Multi-Party Consolidated Commercial Movement
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    This journey consolidates consignments belonging to <strong>{lrValidationState.distinctParties.length} distinct registered Billing Parties</strong> on a single truck and driver route. Commercial invoices are created separately for each customer and their LRs through the independent invoicing workflow. Invoicing is eligible after delivery/POD by default, with authorized early invoicing permitted.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {lrValidationState.distinctParties.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: 'var(--shadow-xs)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-main)' }}>
                            {p.name}
                          </div>
                          {p.gstin && (
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                              GSTIN: {p.gstin}
                            </div>
                          )}
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>
                          {p.lrCount} LR{p.lrCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ color: 'var(--text-muted)' }}>Customer Billing Party</label>
              <input
                type="text"
                className="form-control"
                disabled
                value="N/A — Non-Commercial Internal Dispatch"
                style={{ backgroundColor: 'var(--bg-disabled)', color: 'var(--text-muted)' }}
              />
            </div>
          )}

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
                onChange={(e) => setFormData({ ...formData, estimated_duration_days: e.target.value })}
                onBlur={() => {
                  if (formData.estimated_duration_days === '') {
                    setFormData((prev) => ({ ...prev, estimated_duration_days: 1 }));
                  } else {
                    const parsed = parseInt(String(formData.estimated_duration_days), 10);
                    if (isNaN(parsed) || parsed < 1) {
                      setFormData((prev) => ({ ...prev, estimated_duration_days: 1 }));
                    } else {
                      setFormData((prev) => ({ ...prev, estimated_duration_days: parsed }));
                    }
                  }
                }}
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
            disabled={createMutation.isPending || (journeyType === 'commercial' && selectedLrIds.length === 0)}
            title={journeyType === 'commercial' && selectedLrIds.length === 0 ? 'Commercial journeys require at least one eligible Lorry Receipt' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} /> Save as Draft Plan
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => handleSubmit(e, true)}
            disabled={createMutation.isPending || isTruckBusy || isTruckExpired || (journeyType === 'commercial' && selectedLrIds.length === 0)}
            title={journeyType === 'commercial' && selectedLrIds.length === 0 ? 'Commercial journeys require at least one eligible Lorry Receipt' : undefined}
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
