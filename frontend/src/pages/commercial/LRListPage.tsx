/**
 * ============================================================================
 * FLEET FLOW — LORRY RECEIPT (LR / BILTY) MANAGEMENT (LRListPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS tokens and component classes.
 * Features:
 * - KPI Metrics Ribbon (Total, Active, Invoiced, To-Be-Billed Freight Value)
 * - Multi-criteria search and status/terms filtering
 * - New LR Modal (retains form state on backdrop dismiss until Cancel)
 * - Printable 3-part vector consignment note stationary (Consignor, Consignee, Transporter)
 * ============================================================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { FeatureGate } from '../../components/common/FeatureGate';
import { useTableColumnVisibility } from '../../hooks/useTableColumnVisibility';
import { TableColumnVisibilityMenu } from '../../components/common/TableColumnVisibilityMenu';
import { ITableColumnConfig } from '../../types/table';
import {
  Receipt,
  FileCheck2,
  FileText,
  Clock,
  Plus,
  Search,
  Printer,
  XCircle,
  Truck,
  MapPin,
  ArrowRight,
  User,
  Shield,
  Layers,
  Building2,
  AlertTriangle,
} from 'lucide-react';

const LR_TABLE_COLUMNS: ITableColumnConfig[] = [
  { id: 'select', label: 'Select', isDefaultVisible: true, isRequired: true, description: 'Selection checkbox for journey bundling' },
  { id: 'lr_details', label: 'LR Details', isDefaultVisible: true, isRequired: true, description: 'Consignment number, date, billing ref, and linked trip' },
  { id: 'branch', label: 'Branch', isDefaultVisible: false, isRequired: false, description: 'Originating regional branch code and name' },
  { id: 'vehicle_driver', label: 'Vehicle & Driver', isDefaultVisible: true, isRequired: false, description: 'Assigned truck registration number and operating driver' },
  { id: 'route', label: 'Route Corridor', isDefaultVisible: true, isRequired: false, description: 'Origin and destination dispatch corridor' },
  { id: 'parties', label: 'Consignor & Consignee', isDefaultVisible: true, isRequired: false, description: 'Shipper and consignee business party names' },
  { id: 'cargo_weight', label: 'Cargo & Weight', isDefaultVisible: false, isRequired: false, description: 'Commodity description, package count, and weight in tonnes' },
  { id: 'freight_terms', label: 'Freight & Terms', isDefaultVisible: false, isRequired: false, description: 'Total freight amount and billing payment terms' },
  { id: 'status', label: 'Status', isDefaultVisible: true, isRequired: true, description: 'Consignment lifecycle status' },
  { id: 'actions', label: 'Actions', isDefaultVisible: true, isRequired: true, description: 'Operational actions (Create Journey, Print, Cancel)' },
];

export const LRListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, enabledFeatures = [] } = useAuthStore();
  const isUnlocked = enabledFeatures.includes('MOD_LR_ENGINE');
  const canEdit = role === 'admin' || role === 'dispatcher' || role === 'accountant';

  // Table Column Visibility hook
  const columnVisibility = useTableColumnVisibility('lr_list', LR_TABLE_COLUMNS, user?.id);

  // State
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [termsFilter, setTermsFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLrIds, setSelectedLrIds] = useState<string[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedLrForPrint, setSelectedLrForPrint] = useState<any | null>(null);

  // Form state (persists until Cancel or Submit)
  const initialForm = {
    branch_id: '',
    truck_id: '',
    driver_id: '',
    lr_no: '',
    bill_no: '',
    lr_date: new Date().toISOString().split('T')[0],
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    from_location: '',
    to_location: '',
    billing_party_id: '',
    consignor_name: '',
    consignor_address: '',
    consignor_gstin: '',
    consignee_name: '',
    consignee_address: '',
    consignee_gstin: '',
    package_count: 1,
    packaging_type: 'Bundles',
    goods_description: 'Commercial Freight Goods',
    declared_value: 0,
    risk_type: 'carrier_risk',
    actual_weight_tonnes: 0,
    chargeable_weight_tonnes: 0,
    rate_per_tonne: 0,
    freight_amount: 0,
    freight_terms: 'to_be_billed',
    eway_bill_number: '',
    container_number: '',
    be_number: '',
    remarks: '',
  };

  const [formData, setFormData] = useState(initialForm);

  // Queries
  const { data: metricsData } = useQuery({
    queryKey: ['lr-metrics'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/commercial/entries/metrics');
      return res.data?.metrics;
    },
  });

  // Branch configuration for regional numbering & attribution (DEC-010)
  const { data: branchesData } = useQuery({
    queryKey: ['company-branches'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/company/branches');
      return res.data?.branches || [];
    },
  });

  const activeBranches = React.useMemo(() => {
    return Array.isArray(branchesData)
      ? branchesData.filter((b: any) => b.is_active)
      : [];
  }, [branchesData]);

  const { data: lrsData, isLoading } = useQuery({
    queryKey: ['lr-list', page, statusFilter, termsFilter, branchFilter, assignmentFilter, searchQuery],
    enabled: isUnlocked,
    queryFn: async () => {
      const params: any = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      if (termsFilter) params.freight_terms = termsFilter;
      if (branchFilter) params.branch_id = branchFilter;
      if (assignmentFilter === 'unassigned') params.unassigned = 'true';
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/commercial/entries', { params });
      return res.data;
    },
  });

  const { data: partiesData } = useQuery({
    queryKey: ['billing-parties-lookup'],
    enabled: isUnlocked,
    queryFn: async () => {
      const res = await api.get('/parties/billing', { params: { limit: 100 } });
      return res.data?.parties || [];
    },
  });

  // Registered fleet trucks for asset selector
  const { data: trucksData, isLoading: trucksLoading } = useQuery({
    queryKey: ['available-trucks-lookup'],
    enabled: isUnlocked && isCreateModalOpen,
    queryFn: async () => {
      const res = await api.get('/fleet/trucks?limit=100');
      return res.data?.trucks || [];
    },
  });

  // Registered professional drivers for asset selector
  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['active-drivers-lookup'],
    enabled: isUnlocked && isCreateModalOpen,
    queryFn: async () => {
      const res = await api.get('/fleet/drivers?limit=100');
      return res.data?.drivers || [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/commercial/entries', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Lorry Receipt generated successfully.');
      queryClient.invalidateQueries({ queryKey: ['lr-list'] });
      queryClient.invalidateQueries({ queryKey: ['lr-metrics'] });
      setIsCreateModalOpen(false);
      setFormData(initialForm);
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to create Lorry Receipt.';
      toast.error(errorMsg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/commercial/entries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Lorry Receipt cancelled.');
      queryClient.invalidateQueries({ queryKey: ['lr-list'] });
      queryClient.invalidateQueries({ queryKey: ['lr-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel LR.');
    },
  });


  const availableTrucks: any[] = Array.isArray(trucksData)
    ? trucksData
    : (trucksData as any)?.trucks || [];
  const registeredDrivers: any[] = Array.isArray(driversData)
    ? driversData
    : (driversData as any)?.drivers || [];

  // Filter out deleted, decommissioned, or otherwise ineligible trucks for new LRs
  const eligibleTrucks = availableTrucks.filter((t: any) => {
    if (t.is_deleted) return false;
    if (t.status === 'decommissioned') return false;
    return true;
  });

  // Filter out deleted, terminated, or on-leave drivers
  const eligibleDrivers = registeredDrivers.filter((d: any) => {
    if (d.is_deleted) return false;
    if (d.status === 'terminated' || d.status === 'on_leave') return false;
    return true;
  });

  const selectedBranch = activeBranches.find((b: any) => b._id === formData.branch_id);
  const displayTrucks = eligibleTrucks;
  const displayDrivers = eligibleDrivers;

  const selectedTruck = availableTrucks.find((t: any) => String(t._id) === String(formData.truck_id)) || null;
  const selectedDriver = registeredDrivers.find((d: any) => String(d._id) === String(formData.driver_id)) || null;
  const selectedTruckComplianceExpired = Boolean(
    selectedTruck && (selectedTruck.compliance_status === 'EXPIRED' || selectedTruck.is_compliant === false)
  );

  const previewPrefix = selectedBranch
    ? (selectedBranch.lr_prefix || `${selectedBranch.branch_code}-LR-`)
    : 'LR-';

  const handleTruckChange = (truckId: string) => {
    const truck = availableTrucks.find((t: any) => String(t._id) === String(truckId));
    if (!truck) {
      setFormData((prev) => ({
        ...prev,
        truck_id: '',
        vehicle_number: '',
      }));
      return;
    }

    setFormData((prev) => {
      let newDriverId = prev.driver_id;
      let newDriverName = prev.driver_name;
      let newDriverPhone = prev.driver_phone;

      // Default Driver Convenience: If truck has a registered current driver and no driver has yet been selected
      const assignedDriverId = truck.current_driver_id?._id || truck.current_driver_id;
      if (!prev.driver_id && assignedDriverId) {
        const assignedDriver = registeredDrivers.find((d: any) => String(d._id) === String(assignedDriverId));
        if (assignedDriver && assignedDriver.status === 'active' && !assignedDriver.is_deleted) {
          newDriverId = String(assignedDriver._id);
          newDriverName = assignedDriver.name || '';
          newDriverPhone = assignedDriver.phone || '';
        }
      }

      return {
        ...prev,
        truck_id: String(truck._id),
        vehicle_number: truck.truck_no || '',
        driver_id: newDriverId,
        driver_name: newDriverName,
        driver_phone: newDriverPhone,
      };
    });
  };

  const handleDriverChange = (driverId: string) => {
    const driver = registeredDrivers.find((d: any) => String(d._id) === String(driverId));
    if (!driver) {
      setFormData((prev) => ({
        ...prev,
        driver_id: '',
        driver_name: '',
        driver_phone: '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      driver_id: String(driver._id),
      driver_name: driver.name || '',
      driver_phone: driver.phone || '',
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.billing_party_id) {
      toast.error('A registered Billing Party is mandatory to issue a Lorry Receipt.');
      return;
    }
    if (!formData.truck_id || !formData.driver_id) {
      toast.error('Registered Commercial Vehicle and Professional Driver are mandatory.');
      return;
    }
    if (!formData.from_location || !formData.to_location) {
      toast.error('Vehicle number, from location, and to location are required.');
      return;
    }
    if (!formData.consignor_name || !formData.consignee_name) {
      toast.error('Consignor and Consignee names are required.');
      return;
    }

    const payload = {
      branch_id: formData.branch_id || undefined,
      truck_id: formData.truck_id,
      driver_id: formData.driver_id,
      lr_no: formData.lr_no || undefined,
      bill_no: formData.bill_no || undefined,
      lr_date: new Date(formData.lr_date),
      vehicle_number: formData.vehicle_number,
      driver_name: formData.driver_name,
      driver_phone: formData.driver_phone,
      from_location: formData.from_location,
      to_location: formData.to_location,
      billing_party_id: formData.billing_party_id,
      consignor: {
        name: formData.consignor_name,
        address: formData.consignor_address,
        gstin: formData.consignor_gstin,
      },
      consignee: {
        name: formData.consignee_name,
        address: formData.consignee_address,
        gstin: formData.consignee_gstin,
      },
      package_count: Number(formData.package_count) || 1,
      packaging_type: formData.packaging_type,
      goods_description: formData.goods_description,
      declared_value: Number(formData.declared_value) || 0,
      risk_type: formData.risk_type,
      actual_weight_tonnes: Number(formData.actual_weight_tonnes) || 0,
      chargeable_weight_tonnes: Number(formData.chargeable_weight_tonnes) || 0,
      rate_per_tonne: Number(formData.rate_per_tonne) || 0,
      freight_amount: Number(formData.freight_amount) || 0,
      freight_terms: formData.freight_terms,
      eway_bill_number: formData.eway_bill_number,
      container_number: formData.container_number,
      be_number: formData.be_number,
      remarks: formData.remarks,
    };

    createMutation.mutate(payload);
  };

  const handlePrintLR = async (lrId: string, fallbackLr?: any) => {
    try {
      const res = await api.get(`/commercial/entries/${lrId}/printable`);
      setSelectedLrForPrint(res.data);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      if (fallbackLr) {
        setSelectedLrForPrint({ lr: fallbackLr, company: null });
        setIsPrintModalOpen(true);
      } else {
        toast.error(err.message || 'Failed to load printable LR.');
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Lorry Receipts (LR / Bilty)"
          subtitle="Manage official 3-part consignment notes, freight billing terms, and dispatch manifests"
          breadcrumbs={[
            { label: 'Commercial OS', href: '/bill-entry/all' },
            { label: 'Lorry Receipts' },
          ]}
        />
        <FeatureGate
          feature="MOD_LR_ENGINE"
          pageMode={true}
          titleOverride="Lorry Receipt (LR) Engine is Locked"
          descOverride="Official 3-part consignment notes, freight billing terms, and dispatch manifests require the Standard Commercial or Pro Enterprise tier."
        >
          {null}
        </FeatureGate>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* 1. Header */}
      <PageHeader
        title="Lorry Receipts (LR / Bilty)"
        subtitle="Manage official 3-part consignment notes, freight billing terms, and dispatch manifests"
        breadcrumbs={[
          { label: 'Commercial OS', href: '/bill-entry/all' },
          { label: 'Lorry Receipts' },
        ]}
        actions={
          canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>New Lorry Receipt</span>
            </button>
          )
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="commercial-metrics-grid">
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Receipt size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.total_lrs || 0}</div>
            <div className="commercial-metric-label">Total Consignments</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <FileCheck2 size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.active_lrs || 0}</div>
            <div className="commercial-metric-label">Active (Unbilled)</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <FileText size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{metricsData?.invoiced_lrs || 0}</div>
            <div className="commercial-metric-label">Invoiced Consignments</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">₹{(metricsData?.total_freight_value || 0).toLocaleString('en-IN')}</div>
            <div className="commercial-metric-label">Total Freight Booked</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', overflow: 'visible', position: 'relative', zIndex: 20 }}>
        <div className="filter-toolbar">
          <div className="filter-toolbar-left">
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search LR #, Vehicle #, Consignor, Destination..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="filter-toolbar-right">
            {activeBranches.length > 0 && (
              <select
                className="form-control"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: 'auto', minWidth: '150px' }}
              >
                <option value="">All Branches</option>
                {activeBranches.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.branch_name} ({b.branch_code})
                  </option>
                ))}
              </select>
            )}

            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '130px' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active (Unbilled)</option>
              <option value="invoiced">Invoiced</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="form-control"
              value={termsFilter}
              onChange={(e) => {
                setTermsFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="">All Freight Terms</option>
              <option value="to_be_billed">To Be Billed</option>
              <option value="paid">Paid</option>
              <option value="to_pay">To Pay</option>
            </select>

            <select
              className="form-control"
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="">All Consignments</option>
              <option value="unassigned">Unassigned (Ready for Trip)</option>
            </select>

            <TableColumnVisibilityMenu
              columns={LR_TABLE_COLUMNS}
              visibleColumns={columnVisibility.visibleColumns}
              isVisible={columnVisibility.isVisible}
              toggleColumn={columnVisibility.toggleColumn}
              resetToDefaults={columnVisibility.resetToDefaults}
              showAllColumns={columnVisibility.showAllColumns}
            />
          </div>
        </div>
      </div>

      {/* 3.5. LR Multi-Select Action Ribbon */}
      {selectedLrIds.length > 0 && (
        <div
          className="commercial-selection-ribbon"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-primary-50)',
            border: '1.5px solid var(--color-primary-300)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1.25rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-sm)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                backgroundColor: 'var(--color-primary-600)',
                color: '#ffffff',
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
            >
              {selectedLrIds.length}
            </span>
            <div>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary-900)' }}>
                {selectedLrIds.length === 1 ? '1 Consignment (LR) selected' : `${selectedLrIds.length} Consignments (LRs) selected`}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                — Ready to bundle into a commercial customer journey
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedLrIds([])}
            >
              Clear Selection
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                navigate('/operations/journeys/new', {
                  state: { lr_ids: selectedLrIds },
                })
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}
            >
              <Truck size={15} />
              <span>Create Journey with Selected ({selectedLrIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. LR Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                {columnVisibility.isVisible('select') && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all eligible LRs"
                      checked={
                        (lrsData?.entries || []).filter((lr: any) => lr.status === 'active' && !lr.journey_id).length > 0 &&
                        (lrsData?.entries || [])
                          .filter((lr: any) => lr.status === 'active' && !lr.journey_id)
                          .every((lr: any) => selectedLrIds.includes(lr._id))
                      }
                      disabled={
                        (lrsData?.entries || []).filter((lr: any) => lr.status === 'active' && !lr.journey_id).length === 0
                      }
                      onChange={() => {
                        const eligibleEntries = (lrsData?.entries || []).filter(
                          (lr: any) => lr.status === 'active' && !lr.journey_id
                        );
                        const allSelected =
                          eligibleEntries.length > 0 &&
                          eligibleEntries.every((lr: any) => selectedLrIds.includes(lr._id));
                        if (allSelected) {
                          const eligibleIdSet = new Set(eligibleEntries.map((l: any) => l._id));
                          setSelectedLrIds((prev) => prev.filter((id) => !eligibleIdSet.has(id)));
                        } else {
                          const newSet = new Set([...selectedLrIds, ...eligibleEntries.map((l: any) => l._id)]);
                          setSelectedLrIds(Array.from(newSet));
                        }
                      }}
                    />
                  </th>
                )}
                {columnVisibility.isVisible('lr_details') && <th>LR Details</th>}
                {columnVisibility.isVisible('branch') && <th>Branch</th>}
                {columnVisibility.isVisible('vehicle_driver') && <th>Vehicle & Driver</th>}
                {columnVisibility.isVisible('route') && <th>Route Corridor</th>}
                {columnVisibility.isVisible('parties') && <th>Consignor & Consignee</th>}
                {columnVisibility.isVisible('cargo_weight') && <th>Cargo & Weight</th>}
                {columnVisibility.isVisible('freight_terms') && <th>Freight & Terms</th>}
                {columnVisibility.isVisible('status') && <th>Status</th>}
                {columnVisibility.isVisible('actions') && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columnVisibility.visibleCount || 7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Loading Lorry Receipts...</span>
                    </div>
                  </td>
                </tr>
              ) : lrsData?.entries?.length === 0 ? (
                <tr>
                  <td colSpan={columnVisibility.visibleCount || 7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No Lorry Receipts found matching current filters.
                  </td>
                </tr>
              ) : (
                lrsData?.entries?.map((lr: any) => {
                  const isEligible = lr.status === 'active' && !lr.journey_id;
                  const isSelected = selectedLrIds.includes(lr._id);

                  return (
                    <tr key={lr._id} style={{ backgroundColor: isSelected ? 'var(--color-primary-50)' : undefined }}>
                      {columnVisibility.isVisible('select') && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            aria-label={`Select LR ${lr.lr_no}`}
                            checked={isSelected}
                            disabled={!isEligible}
                            title={
                              !isEligible
                                ? lr.journey_id
                                  ? 'Already assigned to a journey'
                                  : lr.status === 'invoiced'
                                  ? 'Invoiced LRs cannot be assigned to a new journey'
                                  : 'Only active unassigned LRs can be assigned'
                                : 'Select LR to bundle into a journey'
                            }
                            onChange={() => {
                              if (!isEligible) return;
                              setSelectedLrIds((prev) =>
                                prev.includes(lr._id) ? prev.filter((id) => id !== lr._id) : [...prev, lr._id]
                              );
                            }}
                          />
                        </td>
                      )}
                      {columnVisibility.isVisible('lr_details') && (
                        <td>
                          <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-600)' }}>
                            {lr.lr_no}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {new Date(lr.lr_date).toLocaleDateString()} • {lr.bill_no}
                          </div>
                          {lr.journey_id && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                className="badge badge-info"
                                style={{
                                  fontSize: '0.6875rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const jId = lr.journey_id?._id || lr.journey_id;
                                  navigate(`/operations/journeys/${jId}`);
                                }}
                                title="View linked journey details"
                              >
                                <Truck size={10} />
                                <span>Trip: {lr.journey_id.journey_number || 'Linked'}</span>
                              </span>
                            </div>
                          )}
                        </td>
                      )}
                      {columnVisibility.isVisible('branch') && (
                        <td>
                          {lr.branch_id ? (
                            <div>
                              <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                                {lr.branch_id.branch_code}
                              </span>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                {lr.branch_id.branch_name}
                              </div>
                            </div>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                              Company Direct
                            </span>
                          )}
                        </td>
                      )}
                      {columnVisibility.isVisible('vehicle_driver') && (
                        <td>
                          <div style={{ fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Truck size={14} color="var(--text-muted)" />
                            {lr.vehicle_number}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {lr.driver_name || 'Driver Not Assigned'}
                          </div>
                        </td>
                      )}
                      {columnVisibility.isVisible('route') && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-sm)' }}>
                            <span>{lr.from_location}</span>
                            <ArrowRight size={12} color="var(--text-muted)" />
                            <span>{lr.to_location}</span>
                          </div>
                        </td>
                      )}
                      {columnVisibility.isVisible('parties') && (
                        <td>
                          <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-xs)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>From:</span> {lr.consignor?.name}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            <span>To:</span> {lr.consignee?.name}
                          </div>
                        </td>
                      )}
                      {columnVisibility.isVisible('cargo_weight') && (
                        <td>
                          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>
                            {lr.package_count} {lr.packaging_type} • {lr.goods_description}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {lr.chargeable_weight_tonnes ? `${lr.chargeable_weight_tonnes} Tonnes` : `${lr.actual_weight_tonnes} Tonnes`}
                          </div>
                        </td>
                      )}
                      {columnVisibility.isVisible('freight_terms') && (
                        <td>
                          <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
                            ₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}
                          </div>
                          <span className={`badge ${lr.freight_terms === 'paid' ? 'badge-success' : lr.freight_terms === 'to_pay' ? 'badge-warning' : 'badge-primary'}`}>
                            {lr.freight_terms?.replace(/_/g, ' ')}
                          </span>
                        </td>
                      )}
                      {columnVisibility.isVisible('status') && (
                        <td>
                          <span className={`badge ${lr.status === 'active' ? 'badge-primary' : lr.status === 'invoiced' ? 'badge-success' : 'badge-danger'}`}>
                            {lr.status}
                          </span>
                        </td>
                      )}
                      {columnVisibility.isVisible('actions') && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            {canEdit && isEligible && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  navigate('/operations/journeys/new', {
                                    state: { lr_ids: [lr._id] },
                                  })
                                }
                                title="Create Journey with this LR"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Truck size={13} />
                                <span>Create Journey</span>
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePrintLR(lr._id, lr)}
                              title="Print 3-Part Stationary"
                            >
                              <Printer size={14} />
                              <span>Print</span>
                            </button>
                            {canEdit && lr.status === 'active' && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to cancel LR ${lr.lr_no}?`)) {
                                    cancelMutation.mutate(lr._id);
                                  }
                                }}
                                title="Cancel LR"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lrsData?.pagination && (
          <Pagination
            currentPage={page}
            totalPages={lrsData.pagination.pages}
            totalItems={lrsData.pagination.total}
            pageSize={12}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* 5. New Lorry Receipt Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate New Lorry Receipt (Bilty)"
        subtitle="Create official consignment note with consignor, consignee, route, and commercial freight terms"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData(initialForm); // Reset explicitly on Cancel
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Generating LR...' : 'Generate & Issue LR'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          {/* Operational Linkage & Regional Attribution Card (DEC-010) */}
          <div style={{ backgroundColor: 'var(--color-slate-50)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Building2 size={16} color="var(--color-primary-600)" />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                Operational Linkage & Regional Sequence
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {/* Responsible Branch Selector */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: '0.25rem' }}>
                  Responsible Regional Branch
                </label>
                <select
                  className="form-control"
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  style={{ fontSize: 'var(--font-size-xs)', height: '38px' }}
                >
                  <option value="">Company Direct / Head Office Sequence (LR-)</option>
                  {activeBranches.map((b: any) => (
                    <option key={b._id} value={b._id}>
                      {b.branch_name} ({b.branch_code}) {b.is_head_office ? '★ Head Office' : ''} — Prefix: {b.lr_prefix || `${b.branch_code}-LR-`}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Branch determines the autonomous sequence counter and audit attribution.
                </div>
              </div>
            </div>

            {/* Sequence Prefix Preview Banner */}
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <strong>Sequence Prefix:</strong>{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary-600)', backgroundColor: 'var(--color-primary-50)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-sm)' }}>
                  {previewPrefix}
                </span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                  (Allocated atomically upon issuance)
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Leave LR Number blank below for next sequential counter.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">LR Number (Optional / Auto-Gen)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. LR-0001 (Blank for next)"
                value={formData.lr_no}
                onChange={(e) => setFormData({ ...formData, lr_no: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                LR Date <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formData.lr_date}
                onChange={(e) => setFormData({ ...formData, lr_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Assigned Fleet Vehicle & Professional Driver Card */}
          <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={16} color="var(--color-primary-600)" />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>
                  Assigned Fleet Vehicle & Professional Driver
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Truck Selector */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 0 }}>
                    Assigned Commercial Vehicle <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  {selectedTruck?.compliance_status === 'COMPLIANT' && (
                    <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>
                      COMPLIANT
                    </span>
                  )}
                  {selectedTruckComplianceExpired && (
                    <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>
                      COMPLIANCE_EXPIRED
                    </span>
                  )}
                </div>
                <select
                  className="form-control"
                  value={formData.truck_id}
                  onChange={(e) => handleTruckChange(e.target.value)}
                  disabled={trucksLoading}
                  required
                  style={{ fontSize: 'var(--font-size-xs)', height: '38px' }}
                >
                  <option value="">{trucksLoading ? 'Loading fleet vehicles...' : '-- Choose Registered Vehicle --'}</option>
                  {displayTrucks.map((t: any) => {
                    const compBadge = t.compliance_status || (t.is_compliant ? 'COMPLIANT' : 'UNKNOWN');
                    const specs = [t.make, t.model].filter(Boolean).join(' ');
                    const bodyInfo = [t.body_type, t.tonnage_capacity ? `${t.tonnage_capacity}T` : null].filter(Boolean).join(', ');
                    return (
                      <option key={t._id} value={t._id}>
                        {t.truck_no} — {specs} {bodyInfo ? `(${bodyInfo})` : ''} [{compBadge}]
                      </option>
                    );
                  })}
                </select>
                {selectedTruckComplianceExpired && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', color: '#b45309', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', padding: '0.5rem 0.625rem', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', marginTop: '0.375rem' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      <strong>Advisory (COMPLIANCE_EXPIRED):</strong> Statutory certificates for {selectedTruck?.truck_no} have expired. Advance LR booking is permitted; renewal required prior to physical dispatch.
                    </span>
                  </div>
                )}
              </div>

              {/* Driver Selector */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 0 }}>
                    Assigned Professional Driver <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  {selectedDriver?.status && (
                    <span className={`badge ${selectedDriver.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.625rem' }}>
                      {selectedDriver.status.toUpperCase()}
                    </span>
                  )}
                </div>
                <select
                  className="form-control"
                  value={formData.driver_id}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  disabled={driversLoading}
                  required
                  style={{ fontSize: 'var(--font-size-xs)', height: '38px' }}
                >
                  <option value="">{driversLoading ? 'Loading registered drivers...' : '-- Choose Professional Driver --'}</option>
                  {displayDrivers.map((d: any) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.phone || 'No Phone'}) {d.license_number ? `— Lic: ${d.license_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">From Location (Origin)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mumbai, Maharashtra"
                value={formData.from_location}
                onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">To Location (Destination)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ahmedabad, Gujarat"
                value={formData.to_location}
                onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Billing Party / Customer *</label>
            <select
              className="form-control"
              value={formData.billing_party_id}
              onChange={(e) => setFormData({ ...formData, billing_party_id: e.target.value })}
              required
            >
              <option value="">Select Billing Party *</option>
              {partiesData?.map((p: any) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem', color: 'var(--color-primary-600)' }}>
                Consignor (Shipper)
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor Company Name *"
                  value={formData.consignor_name}
                  onChange={(e) => setFormData({ ...formData, consignor_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor Address"
                  value={formData.consignor_address}
                  onChange={(e) => setFormData({ ...formData, consignor_address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignor GSTIN"
                  value={formData.consignor_gstin}
                  onChange={(e) => setFormData({ ...formData, consignor_gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem', color: 'var(--color-primary-600)' }}>
                Consignee (Receiver)
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee Company Name *"
                  value={formData.consignee_name}
                  onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee Address"
                  value={formData.consignee_address}
                  onChange={(e) => setFormData({ ...formData, consignee_address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Consignee GSTIN"
                  value={formData.consignee_gstin}
                  onChange={(e) => setFormData({ ...formData, consignee_gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Package Count</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={formData.package_count || ''}
                onChange={(e) => setFormData({ ...formData, package_count: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Packaging Type</label>
              <select
                className="form-control"
                value={formData.packaging_type}
                onChange={(e) => setFormData({ ...formData, packaging_type: e.target.value })}
              >
                <option value="Bundles">Bundles</option>
                <option value="Boxes">Boxes</option>
                <option value="Bags">Bags</option>
                <option value="Drums">Drums</option>
                <option value="Pallets">Pallets</option>
                <option value="Loose">Loose</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Goods Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Steel Coils / FMCG"
                value={formData.goods_description}
                onChange={(e) => setFormData({ ...formData, goods_description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Actual Weight (Tonnes)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 24.5"
                value={formData.actual_weight_tonnes || ''}
                onChange={(e) => {
                  const actual = Number(e.target.value);
                  const chargeable = formData.chargeable_weight_tonnes === 0 ? actual : formData.chargeable_weight_tonnes;
                  const rate = formData.rate_per_tonne;
                  setFormData({
                    ...formData,
                    actual_weight_tonnes: actual,
                    chargeable_weight_tonnes: chargeable,
                    freight_amount: rate > 0 ? Math.round(chargeable * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Chargeable Weight (Tonnes)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 25.0"
                value={formData.chargeable_weight_tonnes || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const rate = formData.rate_per_tonne;
                  setFormData({
                    ...formData,
                    chargeable_weight_tonnes: val,
                    freight_amount: rate > 0 ? Math.round(val * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Rate Per Tonne (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 1800"
                value={formData.rate_per_tonne || ''}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  const tonnes = formData.chargeable_weight_tonnes;
                  setFormData({
                    ...formData,
                    rate_per_tonne: rate,
                    freight_amount: tonnes > 0 ? Math.round(tonnes * rate) : formData.freight_amount,
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Freight Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 45000"
                value={formData.freight_amount || ''}
                onChange={(e) => setFormData({ ...formData, freight_amount: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Freight Terms</label>
              <select
                className="form-control"
                value={formData.freight_terms}
                onChange={(e) => setFormData({ ...formData, freight_terms: e.target.value })}
              >
                <option value="to_be_billed">To Be Billed</option>
                <option value="paid">Paid</option>
                <option value="to_pay">To Pay</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Declared Value (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 1500000"
                value={formData.declared_value || ''}
                onChange={(e) => setFormData({ ...formData, declared_value: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Risk Type</label>
              <select
                className="form-control"
                value={formData.risk_type}
                onChange={(e) => setFormData({ ...formData, risk_type: e.target.value as any })}
              >
                <option value="owner_risk">Owner Risk (O.R.)</option>
                <option value="carrier_risk">Carrier Risk (C.R.)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">E-Way Bill Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="12-digit E-Way Bill"
                value={formData.eway_bill_number}
                onChange={(e) => setFormData({ ...formData, eway_bill_number: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Printable 3-Part Stationary Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Print Consignment Note: ${selectedLrForPrint?.lr?.lr_no}`}
        subtitle="Standard 3-part layout (Consignor Copy, Consignee Copy, Transporter Copy)"
        size="xl"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPrintModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Printer size={16} />
              <span>Print Stationary</span>
            </button>
          </div>
        }
      >
        {selectedLrForPrint && (
          <div className="lr-print-container">
            {['CONSIGNOR COPY', 'CONSIGNEE COPY', 'TRANSPORTER COPY'].map((partName, idx) => (
              <React.Fragment key={partName}>
                {idx > 0 && <div className="lr-tear-line" />}
                <div className="lr-part-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="lr-part-header-tag">{partName}</span>
                      <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>{selectedLrForPrint.company?.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        GSTIN: {selectedLrForPrint.company?.gstin || 'N/A'} • Phone: {selectedLrForPrint.company?.phone || 'N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>
                        LR NO: {selectedLrForPrint.lr?.lr_no}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Date: {new Date(selectedLrForPrint.lr?.lr_date).toLocaleDateString()} • Bill #{' '}
                        {selectedLrForPrint.lr?.bill_no}
                      </div>
                    </div>
                  </div>

                  <table className="lr-table-grid">
                    <tbody>
                      <tr>
                        <td style={{ width: '50%' }}>
                          <strong>CONSIGNOR:</strong>
                          <br />
                          {selectedLrForPrint.lr?.consignor?.name}
                          <br />
                          {selectedLrForPrint.lr?.consignor?.address}
                          <br />
                          GSTIN: {selectedLrForPrint.lr?.consignor?.gstin || 'Unregistered'}
                        </td>
                        <td style={{ width: '50%' }}>
                          <strong>CONSIGNEE:</strong>
                          <br />
                          {selectedLrForPrint.lr?.consignee?.name}
                          <br />
                          {selectedLrForPrint.lr?.consignee?.address}
                          <br />
                          GSTIN: {selectedLrForPrint.lr?.consignee?.gstin || 'Unregistered'}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>TRANSIT CORRIDOR:</strong>
                          <br />
                          From: {selectedLrForPrint.lr?.from_location}
                          <br />
                          To: {selectedLrForPrint.lr?.to_location}
                        </td>
                        <td>
                          <strong>VEHICLE DETAILS:</strong>
                          <br />
                          Truck #: {selectedLrForPrint.lr?.vehicle_number}
                          <br />
                          Driver: {selectedLrForPrint.lr?.driver_name || 'Assigned Driver'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="lr-table-grid">
                    <thead>
                      <tr>
                        <th>Packages</th>
                        <th>Description of Goods</th>
                        <th>Actual Wt (T)</th>
                        <th>Charged Wt (T)</th>
                        <th>Rate / Tonne</th>
                        <th>Freight Terms</th>
                        <th>Total Freight</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          {selectedLrForPrint.lr?.package_count} {selectedLrForPrint.lr?.packaging_type}
                        </td>
                        <td>{selectedLrForPrint.lr?.goods_description}</td>
                        <td>{selectedLrForPrint.lr?.actual_weight_tonnes || '-'}</td>
                        <td>{selectedLrForPrint.lr?.chargeable_weight_tonnes || '-'}</td>
                        <td>₹{selectedLrForPrint.lr?.rate_per_tonne || '-'}</td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                            {selectedLrForPrint.lr?.freight_terms?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                          ₹{Number(selectedLrForPrint.lr?.freight_amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {selectedLrForPrint.lr?.eway_bill_number && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                      <strong>E-Way Bill:</strong> {selectedLrForPrint.lr.eway_bill_number}
                    </div>
                  )}

                  <div className="lr-sign-grid">
                    <div className="lr-sign-box">Consignor Signature</div>
                    <div className="lr-sign-box">Driver / Carrier Signature</div>
                    <div className="lr-sign-box">Consignee Receiving Stamp</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
export default LRListPage;
