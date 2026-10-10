/**
 * ============================================================================
 * FLEET FLOW — FLEET MAINTENANCE DASHBOARD (MaintenanceDashboardPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * The comprehensive command center for commercial fleet maintenance, garage job
 * cards, preventative service intervals, Cost per KM (CPK), and vehicle P&L.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  AlertTriangle,
  Clock,
  TrendingDown,
  CheckCircle2,
  Plus,
  Search,
  Truck,
  DollarSign,
  Calendar,
  Layers,
  FileText,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';

export const MaintenanceDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'orders' | 'schedules' | 'profitability'>('orders');

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form State: Create Work Order
  const [formData, setFormData] = useState({
    truck_id: '',
    vendor_name: '',
    vendor_invoice_no: '',
    order_type: 'preventative_service',
    priority: 'medium',
    status: 'in_progress',
    odometer_kms_at_service: '',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<Array<{ description: string; part_cost: string; labor_cost: string; tax_amount: string }>>([
    { description: 'Engine Oil & Filter Replacement', part_cost: '6500', labor_cost: '1200', tax_amount: '0' },
  ]);

  // Form State: Complete Work Order
  const [completeData, setCompleteData] = useState({
    vendor_invoice_no: '',
    completed_date: new Date().toISOString().split('T')[0],
    next_service_due_kms: '',
    post_to_ledger: true,
  });

  // 1. Fetch Analytics & KPIs
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['maintenance-analytics'],
    queryFn: async () => {
      const res = await api.get('/fleet/maintenance/analytics');
      return res.data?.analytics;
    },
  });

  // 2. Fetch Work Orders
  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['maintenance-orders', statusFilter, typeFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('order_type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      const res = await api.get(`/fleet/maintenance/work-orders?${params.toString()}`);
      return res.data;
    },
  });

  // 3. Fetch Registered Fleet Trucks for Selector
  const { data: trucksData } = useQuery({
    queryKey: ['fleet-trucks-select'],
    queryFn: async () => {
      const res = await api.get('/fleet/trucks?limit=100');
      return res.data?.trucks || [];
    },
  });

  // 4. Fetch Vehicle Profitability
  const { data: profitabilityData, isLoading: isProfitLoading } = useQuery({
    queryKey: ['vehicle-profitability'],
    queryFn: async () => {
      const res = await api.get('/fleet/maintenance/profitability');
      return res.data?.profitability || [];
    },
    enabled: activeTab === 'profitability',
  });

  // Calculations for Line Items
  const partSubtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.part_cost) || 0), 0);
  const laborSubtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.labor_cost) || 0), 0);
  const taxSubtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0);
  const grandTotal = partSubtotal + laborSubtotal + taxSubtotal;

  // Handle Truck Selection in Create Modal
  const handleTruckChange = (truckId: string) => {
    const matched = (trucksData || []).find((t: any) => t._id === truckId);
    setFormData((prev) => ({
      ...prev,
      truck_id: truckId,
      odometer_kms_at_service: matched ? String(matched.current_odometer_kms || '') : prev.odometer_kms_at_service,
    }));
  };

  // Add / Remove Line Items
  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', part_cost: '0', labor_cost: '0', tax_amount: '0' }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleLineItemChange = (index: number, field: string, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  // Create Work Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/fleet/maintenance/work-orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Work Order created successfully.');
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['maintenance-orders'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-trucks-select'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to create work order.');
    },
  });

  // Complete Work Order Mutation
  const completeOrderMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: string; payload: any }) => {
      const res = await api.post(`/fleet/maintenance/work-orders/${orderId}/complete`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Work Order completed successfully.');
      setIsCompleteModalOpen(false);
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ['maintenance-orders'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-trucks-select'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to complete work order.');
    },
  });

  // Cancel Work Order Mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post(`/fleet/maintenance/work-orders/${orderId}/cancel`, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Work Order cancelled.');
      queryClient.invalidateQueries({ queryKey: ['maintenance-orders'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-trucks-select'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to cancel work order.');
    },
  });

  const handleOpenCompleteModal = (order: any) => {
    setSelectedOrder(order);
    const truckCurrentOdo = order.odometer_kms_at_service || order.truck_id?.current_odometer_kms || 0;
    setCompleteData({
      vendor_invoice_no: order.vendor_invoice_no || '',
      completed_date: new Date().toISOString().split('T')[0],
      next_service_due_kms: String(truckCurrentOdo + 10000),
      post_to_ledger: true,
    });
    setIsCompleteModalOpen(true);
  };

  const handleOpenDetailModal = (order: any) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.truck_id || !formData.vendor_name) {
      toast.error('Please select a vehicle and specify the service vendor.');
      return;
    }

    const payload = {
      ...formData,
      odometer_kms_at_service: parseFloat(formData.odometer_kms_at_service) || 0,
      line_items: lineItems.map((item) => ({
        description: item.description,
        part_cost: parseFloat(item.part_cost) || 0,
        labor_cost: parseFloat(item.labor_cost) || 0,
        tax_amount: parseFloat(item.tax_amount) || 0,
        total: (parseFloat(item.part_cost) || 0) + (parseFloat(item.labor_cost) || 0) + (parseFloat(item.tax_amount) || 0),
      })),
    };

    createOrderMutation.mutate(payload);
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    completeOrderMutation.mutate({
      orderId: selectedOrder._id,
      payload: {
        vendor_invoice_no: completeData.vendor_invoice_no,
        completed_date: completeData.completed_date,
        next_service_due_kms: parseFloat(completeData.next_service_due_kms) || undefined,
        post_to_ledger: completeData.post_to_ledger,
      },
    });
  };

  const openServiceForTruck = (truck: any) => {
    setFormData({
      truck_id: truck.truck_id || truck._id,
      vendor_name: '',
      vendor_invoice_no: '',
      order_type: 'preventative_service',
      priority: truck.alert_level === 'DUE_NOW' ? 'high' : 'medium',
      status: 'in_progress',
      odometer_kms_at_service: String(truck.current_odometer_kms || ''),
      notes: `Scheduled preventative service. Current odo: ${truck.current_odometer_kms} km`,
    });
    setIsCreateModalOpen(true);
  };

  return (
    <div className="maintenance-container">
      {/* 1. Header */}
      <PageHeader
        title="Fleet Maintenance & Work Orders"
        subtitle="Manage garage work orders, preventative service intervals, downtime tracking, and Cost per KM (CPK) metrics."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormData({
                truck_id: '',
                vendor_name: '',
                vendor_invoice_no: '',
                order_type: 'preventative_service',
                priority: 'medium',
                status: 'in_progress',
                odometer_kms_at_service: '',
                notes: '',
              });
              setLineItems([{ description: 'General Service & Inspection', part_cost: '0', labor_cost: '0', tax_amount: '0' }]);
              setIsCreateModalOpen(true);
            }}
          >
            <Plus size={16} /> Create Work Order
          </button>
        }
      />

      {/* 2. KPI Metrics Ribbon */}
      <div className="maintenance-kpi-grid">
        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-icon" style={{ backgroundColor: 'var(--color-primary-100)', color: 'var(--color-primary-600)' }}>
            <Wrench size={24} />
          </div>
          <div className="maintenance-kpi-content">
            <span className="maintenance-kpi-label">Active Work Orders</span>
            <span className="maintenance-kpi-val">{analyticsData?.active_work_orders_count ?? 0}</span>
            <span className="maintenance-kpi-sub">{analyticsData?.completed_work_orders_count ?? 0} completed all-time</span>
          </div>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-icon" style={{ backgroundColor: 'var(--color-warning-100)', color: 'var(--color-warning-600)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="maintenance-kpi-content">
            <span className="maintenance-kpi-label">Downed Vehicles</span>
            <span className="maintenance-kpi-val" style={{ color: (analyticsData?.downed_trucks_count || 0) > 0 ? 'var(--color-warning-600)' : 'var(--text-main)' }}>
              {analyticsData?.downed_trucks_count ?? 0}
            </span>
            <span className="maintenance-kpi-sub">{analyticsData?.total_downtime_hours ?? 0} hrs total downtime</span>
          </div>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-icon" style={{ backgroundColor: 'var(--color-success-100)', color: 'var(--color-success-600)' }}>
            <TrendingDown size={24} />
          </div>
          <div className="maintenance-kpi-content">
            <span className="maintenance-kpi-label">Fleet Maintenance CPK</span>
            <span className="maintenance-kpi-val">₹{analyticsData?.fleet_cpk?.toFixed(2) ?? '0.00'}</span>
            <span className="maintenance-kpi-sub">Cost per vehicle kilometre</span>
          </div>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-icon" style={{ backgroundColor: 'var(--color-indigo-100, #e0e7ff)', color: 'var(--color-indigo-600, #4f46e5)' }}>
            <DollarSign size={24} />
          </div>
          <div className="maintenance-kpi-content">
            <span className="maintenance-kpi-label">Maintenance Spend</span>
            <span className="maintenance-kpi-val">₹{analyticsData?.total_maintenance_spend?.toLocaleString('en-IN') ?? '0'}</span>
            <span className="maintenance-kpi-sub">Posted to General Ledger</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="maintenance-tabs">
        <button
          type="button"
          className={`maintenance-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <FileText size={16} /> Work Orders ({ordersData?.pagination?.total ?? 0})
        </button>
        <button
          type="button"
          className={`maintenance-tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <Clock size={16} /> Preventative Schedules
          {(analyticsData?.urgent_services_count || 0) > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 6px' }}>
              {analyticsData?.urgent_services_count} Due
            </span>
          )}
        </button>
        <button
          type="button"
          className={`maintenance-tab-btn ${activeTab === 'profitability' ? 'active' : ''}`}
          onClick={() => setActiveTab('profitability')}
        >
          <DollarSign size={16} /> Vehicle Profitability (P&L)
        </button>
      </div>

      {/* 4. Tab 1: Work Orders Table */}
      {activeTab === 'orders' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search Work Order #, Vendor, or Invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select className="form-control" style={{ width: 'auto' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="preventative_service">Preventative Service</option>
              <option value="breakdown_repair">Breakdown Repair</option>
              <option value="tyre_replacement">Tyre Replacement</option>
              <option value="accidental">Accidental</option>
              <option value="statutory_fitness">Statutory Fitness</option>
            </select>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Vehicle</th>
                  <th>Vendor Workshop</th>
                  <th>Category</th>
                  <th>Odometer</th>
                  <th>Total Cost</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isOrdersLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading work orders...
                    </td>
                  </tr>
                ) : (ordersData?.data?.length || 0) === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Wrench size={40} color="var(--color-slate-400)" style={{ margin: '0 auto 0.75rem auto' }} />
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>No Work Orders Found</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Create a new service work order to track repairs and garage costs.
                      </div>
                    </td>
                  </tr>
                ) : (
                  ordersData?.data?.map((order: any) => {
                    const statusClass =
                      order.status === 'completed'
                        ? 'badge-success'
                        : order.status === 'in_progress'
                        ? 'badge-warning'
                        : order.status === 'scheduled'
                        ? 'badge-primary'
                        : 'badge-neutral';

                    return (
                      <tr key={order._id}>
                        <td style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          <span style={{ color: 'var(--color-primary-600)', cursor: 'pointer' }} onClick={() => handleOpenDetailModal(order)}>
                            {order.work_order_no}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-neutral" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                              {order.truck_id?.truck_no || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{order.vendor_name}</div>
                          {order.vendor_invoice_no && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Inv: {order.vendor_invoice_no}</div>
                          )}
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize', fontSize: 'var(--font-size-sm)' }}>
                            {order.order_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{order.odometer_kms_at_service?.toLocaleString()} km</td>
                        <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-slate-900)' }}>
                          ₹{order.total_amount?.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              order.priority === 'critical'
                                ? 'badge-danger'
                                : order.priority === 'high'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                            style={{ textTransform: 'uppercase', fontSize: '10px' }}
                          >
                            {order.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${statusClass}`} style={{ textTransform: 'capitalize' }}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                title="Complete Work Order & Post to Ledger"
                                onClick={() => handleOpenCompleteModal(order)}
                              >
                                <CheckCircle2 size={14} /> Complete
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              title="View Details"
                              onClick={() => handleOpenDetailModal(order)}
                            >
                              <FileText size={14} />
                            </button>
                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                title="Cancel Order"
                                onClick={() => {
                                  if (confirm(`Cancel Work Order ${order.work_order_no}?`)) {
                                    cancelOrderMutation.mutate(order._id);
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
      )}

      {/* 5. Tab 2: Preventative Service Schedules */}
      {activeTab === 'schedules' && (
        <div className="service-schedule-grid">
          {(analyticsData?.service_schedules || []).map((schedule: any) => {
            const isDueNow = schedule.alert_level === 'DUE_NOW';
            const isDueSoon = schedule.alert_level === 'DUE_SOON';
            const progressPct = schedule.next_service_due_kms > 0
              ? Math.min(100, Math.round((schedule.current_odometer_kms / schedule.next_service_due_kms) * 100))
              : 0;

            return (
              <div key={schedule.truck_id} className="service-schedule-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-neutral" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)' }}>
                      {schedule.truck_no}
                    </span>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {schedule.make} {schedule.model}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      isDueNow ? 'badge-danger' : isDueSoon ? 'badge-warning' : 'badge-success'
                    }`}
                  >
                    {isDueNow ? 'Service Due Now' : isDueSoon ? 'Service Due Soon' : 'Healthy'}
                  </span>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>Current: {schedule.current_odometer_kms?.toLocaleString()} km</span>
                    <span>Target: {schedule.next_service_due_kms?.toLocaleString()} km</span>
                  </div>
                  <div className="service-progress-track">
                    <div
                      className="service-progress-bar"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: isDueNow ? 'var(--color-danger)' : isDueSoon ? 'var(--color-warning)' : 'var(--color-success)',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: '0.375rem', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {schedule.remaining_kms <= 0
                      ? `Overdue by ${Math.abs(schedule.remaining_kms).toLocaleString()} km`
                      : `${schedule.remaining_kms.toLocaleString()} km remaining before overhaul`}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    Status: {schedule.status?.replace('_', ' ')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => openServiceForTruck(schedule)}
                  >
                    <Wrench size={12} /> Schedule Service
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Tab 3: Vehicle Profitability (P&L) */}
      {activeTab === 'profitability' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
              Commercial Asset Profit & Loss (P&L)
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Compares gross freight income against running diesel expenses, driver trip advances/tolls, and maintenance overhaul spend.
            </p>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Trips</th>
                  <th>Total Kms</th>
                  <th>Gross Freight</th>
                  <th>Diesel Spend</th>
                  <th>Tolls & Driver</th>
                  <th>Maintenance Spend</th>
                  <th>Net Asset Profit</th>
                  <th>Fuel Economy</th>
                  <th>Maintenance CPK</th>
                </tr>
              </thead>
              <tbody>
                {isProfitLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                      Calculating asset profitability...
                    </td>
                  </tr>
                ) : profitabilityData?.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                      No trip or maintenance records found for registered fleet vehicles.
                    </td>
                  </tr>
                ) : (
                  profitabilityData?.map((item: any) => (
                    <tr key={item.truck_id}>
                      <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{item.truck_no}</td>
                      <td>{item.completed_trips_count}</td>
                      <td>{item.total_trip_kms?.toLocaleString()} km</td>
                      <td style={{ color: 'var(--color-success-700)', fontWeight: 'var(--font-weight-semibold)' }}>
                        ₹{item.gross_revenue?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ color: 'var(--color-danger-700)' }}>
                        ₹{item.diesel_spend?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ color: 'var(--color-slate-600)' }}>
                        ₹{item.tolls_and_driver_costs?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ color: 'var(--color-warning-700)' }}>
                        ₹{item.maintenance_spend?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontWeight: 'var(--font-weight-bold)', color: item.net_profit >= 0 ? 'var(--color-success-700)' : 'var(--color-danger-700)' }}>
                        ₹{item.net_profit?.toLocaleString('en-IN')} ({item.profit_margin_pct}%)
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {item.fuel_economy_km_per_l > 0 ? `${item.fuel_economy_km_per_l} km/L` : '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        ₹{item.maintenance_cpk?.toFixed(2)}/km
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Modal: Create Work Order */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Issue Maintenance Work Order"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Vehicle Registration *</label>
              <select
                className="form-control"
                required
                value={formData.truck_id}
                onChange={(e) => handleTruckChange(e.target.value)}
              >
                <option value="">Select vehicle...</option>
                {(trucksData || []).map((t: any) => (
                  <option key={t._id} value={t._id}>
                    {t.truck_no} ({t.make} {t.model})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Current Odometer (KM) *</label>
              <input
                type="number"
                className="form-control"
                required
                value={formData.odometer_kms_at_service}
                onChange={(e) => setFormData({ ...formData, odometer_kms_at_service: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Service Vendor / Workshop *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Star Diesel Services & Spares"
                required
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Invoice Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. INV-STAR-9022"
                value={formData.vendor_invoice_no}
                onChange={(e) => setFormData({ ...formData, vendor_invoice_no: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Service Category</label>
              <select
                className="form-control"
                value={formData.order_type}
                onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
              >
                <option value="preventative_service">Preventative Service</option>
                <option value="breakdown_repair">Breakdown Repair</option>
                <option value="tyre_replacement">Tyre Replacement</option>
                <option value="accidental">Accidental Overhaul</option>
                <option value="statutory_fitness">Statutory Fitness Overhaul</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical (Downed)</option>
              </select>
            </div>
          </div>

          {/* Line Items Section */}
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 'var(--font-weight-bold)' }}>
                Parts & Labor Line Items
              </label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLineItem}>
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {lineItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1.5fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Description (e.g. Engine Oil 15L)"
                    required
                    value={item.description}
                    onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Part ₹"
                    value={item.part_cost}
                    onChange={(e) => handleLineItemChange(index, 'part_cost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Labor ₹"
                    value={item.labor_cost}
                    onChange={(e) => handleLineItemChange(index, 'labor_cost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Tax ₹"
                    value={item.tax_amount}
                    onChange={(e) => handleLineItemChange(index, 'tax_amount', e.target.value)}
                  />
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveLineItem(index)}
                      style={{ padding: '0.375rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total Banner */}
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-primary-50)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-primary-800)',
              }}
            >
              <span>Total Estimated Work Order Amount:</span>
              <span style={{ fontSize: 'var(--font-size-lg)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes & Diagnosis</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Observation notes, driver feedback, or mechanical diagnosis..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? 'Creating...' : 'Submit Work Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Modal: Complete Work Order */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title={`Complete Work Order: ${selectedOrder?.work_order_no}`}
      >
        <form onSubmit={handleCompleteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Vehicle:</span>
              <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedOrder?.truck_id?.truck_no}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Vendor:</span>
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{selectedOrder?.vendor_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Cost:</span>
              <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>
                ₹{selectedOrder?.total_amount?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Vendor Final Invoice Number *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. INV-STAR-9022"
              value={completeData.vendor_invoice_no}
              onChange={(e) => setCompleteData({ ...completeData, vendor_invoice_no: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Completion Date</label>
              <input
                type="date"
                className="form-control"
                value={completeData.completed_date}
                onChange={(e) => setCompleteData({ ...completeData, completed_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Next Service Due (KM)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 134500"
                value={completeData.next_service_due_kms}
                onChange={(e) => setCompleteData({ ...completeData, next_service_due_kms: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="post_to_ledger"
              checked={completeData.post_to_ledger}
              onChange={(e) => setCompleteData({ ...completeData, post_to_ledger: e.target.checked })}
            />
            <label htmlFor="post_to_ledger" style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
              Post ₹{selectedOrder?.total_amount?.toLocaleString('en-IN')} directly to General Ledger under <strong>Vehicle Maintenance</strong>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCompleteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={completeOrderMutation.isPending}>
              {completeOrderMutation.isPending ? 'Completing...' : 'Save & Close Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Modal: Work Order Details View */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Work Order Summary: ${selectedOrder?.work_order_no}`}
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Vehicle:</span>
                <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedOrder.truck_id?.truck_no}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Status:</span>
                <div>
                  <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Vendor Workshop:</span>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{selectedOrder.vendor_name}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Odometer at Service:</span>
                <div>{selectedOrder.odometer_kms_at_service?.toLocaleString()} km</div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', marginBottom: '0.5rem' }}>
                Itemized Line Items
              </h4>
              <table className="table" style={{ fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Parts (₹)</th>
                    <th>Labor (₹)</th>
                    <th>Tax (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.line_items || []).map((line: any, i: number) => (
                    <tr key={i}>
                      <td>{line.description}</td>
                      <td>₹{line.part_cost?.toLocaleString('en-IN')}</td>
                      <td>₹{line.labor_cost?.toLocaleString('en-IN')}</td>
                      <td>₹{line.tax_amount?.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-bold)' }}>
                        ₹{line.total?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '0.75rem', fontWeight: 'var(--font-weight-bold)' }}>
              <span>Grand Total:</span>
              <span style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-primary-700)' }}>
                ₹{selectedOrder.total_amount?.toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
