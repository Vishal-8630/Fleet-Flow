/**
 * ============================================================================
 * FLEET FLOW — OPERATIONAL INTELLIGENCE DASHBOARD (pages/dashboard/DashboardPage.tsx)
 * ============================================================================
 * 
 * Aggregates high-performance server-side MongoDB `$facet` aggregation pipelines
 * and renders 5 dedicated real-time operational watchlists:
 * 1. Unsettled Journeys Watchlist
 * 2. Pending Driver Settlements Watchlist
 * 3. Party Payments Aging Watchlist (0–30, 31–60, 60+ days)
 * 4. Compliance Alerts Watchlist (< 15 days or expired)
 * 5. Operational Activity Audit Stream
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  Truck,
  Navigation,
  FileSpreadsheet,
  BadgeCent,
  ShieldAlert,
  Clock,
  AlertTriangle,
  History,
  TrendingUp,
  Receipt,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import { HistoryDrawer } from '../../components/common/HistoryDrawer';

interface DashboardSummary {
  active_trips: number;
  completed_trips: number;
  unsettled_trips: number;
  total_trucks: number;
  available_trucks: number;
  on_trip_trucks: number;
  fleet_availability_ratio: number;
  unbilled_lrs: number;
  unbilled_freight_value: number;
  today_revenue: number;
  pending_receivables: number;
  overdue_invoices_count: number;
  pending_settlements_count: number;
  pending_settlements_amount: number;
  pending_recovery_amount: number;
}

interface WatchlistsData {
  unsettled_journeys: any[];
  pending_driver_settlements: any[];
  party_payments: {
    aging_brackets: {
      '0_30_days': number;
      '31_60_days': number;
      '60_plus_days': number;
      total_overdue: number;
    };
    invoices: any[];
  };
  compliance_alerts: any[];
  operational_activity_feed: any[];
}

export const DashboardPage: React.FC = () => {
  const { company } = useAuthStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [watchlists, setWatchlists] = useState<WatchlistsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journeys' | 'settlements' | 'aging' | 'compliance' | 'activity'>('journeys');

  // History Drawer State
  const [historyDrawer, setHistoryDrawer] = useState<{
    isOpen: boolean;
    entityType: string;
    entityId: string;
    entityTitle: string;
  }>({
    isOpen: false,
    entityType: '',
    entityId: '',
    entityTitle: '',
  });

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, watchlistsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/watchlists'),
      ]);
      setSummary(summaryRes.data?.summary || null);
      setWatchlists(watchlistsRes.data?.watchlists || null);
    } catch (err) {
      console.error('Failed to load executive dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const openAuditHistory = (type: string, id: string, title: string) => {
    setHistoryDrawer({
      isOpen: true,
      entityType: type,
      entityId: id,
      entityTitle: title,
    });
  };

  return (
    <div>
      {/* 1. Header & Live Indicator */}
      <div className="flex items-center justify-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <h1 className="page-header-title" style={{ margin: 0 }}>Operational Intelligence</h1>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
              Live Server-Sync
            </span>
          </div>
          <p className="page-header-subtitle" style={{ margin: '0.35rem 0 0 0' }}>
            Real-time fleet operations, financial aging & statutory command center for <strong>{company?.name || 'Workspace'}</strong>
          </p>
        </div>

        <div className="flex items-center" style={{ gap: '0.75rem' }}>
          <Link to="/operations/journeys" className="btn btn-outline btn-sm">
            <Navigation size={15} />
            <span>Active Journeys</span>
          </Link>
          <Link to="/commercial/entries" className="btn btn-primary btn-sm">
            <Receipt size={15} />
            <span>Issue Bilty (LR)</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Executive KPI Summary Grid */}
      <div className="grid grid-cols-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
        {/* KPI 1: Active Journeys */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-primary-100)' }}>
            <Navigation size={22} color="var(--color-primary-600)" />
          </div>
          <div>
            <div className="kpi-value">{loading ? '...' : summary?.active_trips || 0}</div>
            <div className="kpi-label">Active Journeys</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {summary?.completed_trips || 0} completed
            </div>
          </div>
        </div>

        {/* KPI 2: Fleet Available */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-success-bg)' }}>
            <Truck size={22} color="var(--color-success)" />
          </div>
          <div>
            <div className="kpi-value">
              {loading ? '...' : `${summary?.available_trucks || 0} / ${summary?.total_trucks || 0}`}
            </div>
            <div className="kpi-label">Fleet Available</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', marginTop: '0.15rem' }}>
              {summary?.fleet_availability_ratio || 0}% ready in yard
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Settlements */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
            <BadgeCent size={22} color="var(--color-warning)" />
          </div>
          <div>
            <div className="kpi-value">
              {loading ? '...' : `₹${(summary?.pending_settlements_amount || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="kpi-label">Pending Settlements</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {summary?.pending_settlements_count || 0} drivers awaiting payout
            </div>
          </div>
        </div>

        {/* KPI 4: Outstanding Receivables */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-primary-50)' }}>
            <FileSpreadsheet size={22} color="var(--color-primary-700)" />
          </div>
          <div>
            <div className="kpi-value">
              {loading ? '...' : `₹${(summary?.pending_receivables || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="kpi-label">Receivables Balance</div>
            <div style={{ fontSize: '0.7rem', color: (summary?.overdue_invoices_count || 0) > 0 ? 'var(--color-danger-text)' : 'var(--text-muted)', marginTop: '0.15rem' }}>
              {summary?.overdue_invoices_count || 0} overdue invoices
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Watchlists & Command Center */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        {/* Watchlist Tab Navigation Header */}
        <div className="card-header flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="flex items-center" style={{ gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('journeys')}
              className={`btn btn-sm ${activeTab === 'journeys' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <Navigation size={14} />
              <span>Unsettled Trips ({watchlists?.unsettled_journeys?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`btn btn-sm ${activeTab === 'settlements' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <BadgeCent size={14} />
              <span>Driver Payouts ({watchlists?.pending_driver_settlements?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('aging')}
              className={`btn btn-sm ${activeTab === 'aging' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <TrendingUp size={14} />
              <span>Customer Aging ({watchlists?.party_payments?.invoices?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`btn btn-sm ${activeTab === 'compliance' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <ShieldAlert size={14} />
              <span>Compliance Alerts ({watchlists?.compliance_alerts?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`btn btn-sm ${activeTab === 'activity' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <History size={14} />
              <span>Activity Stream</span>
            </button>
          </div>

          <button onClick={fetchDashboardData} className="btn btn-ghost btn-sm" title="Refresh Live Feeds">
            <Clock size={14} />
            <span>Sync</span>
          </button>
        </div>

        {/* Tab 1: Unsettled Journeys Watchlist */}
        {activeTab === 'journeys' && (
          <div className="card-body" style={{ padding: 0 }}>
            {(!watchlists?.unsettled_journeys || watchlists.unsettled_journeys.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>All completed journeys are fully settled!</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                  No pending trips requiring driver account reconciliation.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trip #</th>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Route</th>
                      <th>Delivered Date</th>
                      <th>Starting Cash</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlists.unsettled_journeys.map((j) => (
                      <tr key={j._id}>
                        <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{j.journey_number}</td>
                        <td>{j.truck_id?.truck_no || '—'}</td>
                        <td>{j.driver_id?.name || '—'}</td>
                        <td>{j.from_location?.city} → {j.to_location?.city}</td>
                        <td>{j.actual_end_date ? new Date(j.actual_end_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td>₹{(j.starting_cash_advance || 0).toLocaleString('en-IN')}</td>
                        <td>
                          <div className="flex items-center" style={{ gap: '0.5rem' }}>
                            <Link to="/commercial/settlements" className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                              Settle
                            </Link>
                            <button
                              onClick={() => openAuditHistory('journey', j._id, `Trip ${j.journey_number}`)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0.2rem 0.4rem' }}
                              title="Audit Trail"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pending Driver Settlements Watchlist */}
        {activeTab === 'settlements' && (
          <div className="card-body" style={{ padding: 0 }}>
            {(!watchlists?.pending_driver_settlements || watchlists.pending_driver_settlements.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>Zero outstanding driver payouts</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                  All confirmed settlements have been disbursed to driver accounts.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Settlement #</th>
                      <th>Driver Name</th>
                      <th>Settlement Date</th>
                      <th>Direction</th>
                      <th>Net Payable</th>
                      <th>Total KMs</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlists.pending_driver_settlements.map((s) => (
                      <tr key={s._id}>
                        <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{s.settlement_number}</td>
                        <td>{s.driver_snapshot?.name || '—'}</td>
                        <td>{new Date(s.settlement_date).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`badge ${s.settlement_type === 'payable_to_driver' ? 'badge-warning' : 'badge-danger'}`}>
                            {s.settlement_type === 'payable_to_driver' ? 'DRL to Pay Driver' : 'Driver to Return'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'var(--font-weight-bold)' }}>
                          ₹{Math.abs(s.net_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td>{s.total_kms || 0} km</td>
                        <td>
                          <div className="flex items-center" style={{ gap: '0.5rem' }}>
                            <Link to="/commercial/settlements" className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                              Disburse
                            </Link>
                            <button
                              onClick={() => openAuditHistory('settlement', s._id, `Settlement ${s.settlement_number}`)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0.2rem 0.4rem' }}
                              title="Audit Trail"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Party Payments Aging Watchlist */}
        {activeTab === 'aging' && (
          <div className="card-body">
            {/* Aging Bracket Summary Cards */}
            <div className="grid grid-cols-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--color-slate-50)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>0–30 Days Overdue</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  ₹{(watchlists?.party_payments?.aging_brackets?.['0_30_days'] || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)' }}>31–60 Days Overdue</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning-text)', marginTop: '0.25rem' }}>
                  ₹{(watchlists?.party_payments?.aging_brackets?.['31_60_days'] || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger-border)', backgroundColor: 'var(--color-danger-bg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)' }}>60+ Days (Critical)</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-danger-text)', marginTop: '0.25rem' }}>
                  ₹{(watchlists?.party_payments?.aging_brackets?.['60_plus_days'] || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--color-primary-50)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-700)' }}>Total Overdue Debt</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)', marginTop: '0.25rem' }}>
                  ₹{(watchlists?.party_payments?.aging_brackets?.total_overdue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Overdue Invoices Table */}
            {(!watchlists?.party_payments?.invoices || watchlists.party_payments.invoices.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>No overdue customer balances</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                  All customer freight invoices are within agreed credit terms.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Billing Party (Shipper)</th>
                      <th>Due Date</th>
                      <th>Aging Bracket</th>
                      <th>Balance Due</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlists.party_payments.invoices.map((inv) => (
                      <tr key={inv._id}>
                        <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{inv.invoice_number}</td>
                        <td>{inv.billing_party_snapshot?.name || '—'}</td>
                        <td>{new Date(inv.due_date).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`badge ${
                            inv.aging_bracket === '60+'
                              ? 'badge-danger'
                              : inv.aging_bracket === '31-60'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}>
                            {inv.days_overdue > 0 ? `${inv.days_overdue}d Overdue` : 'Current Due'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-danger-text)' }}>
                          ₹{(inv.balance_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <div className="flex items-center" style={{ gap: '0.5rem' }}>
                            <Link to="/commercial/invoices" className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                              Collect
                            </Link>
                            <button
                              onClick={() => openAuditHistory('invoice', inv._id, `Invoice ${inv.invoice_number}`)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0.2rem 0.4rem' }}
                              title="Audit Trail"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Statutory Compliance Alerts Watchlist */}
        {activeTab === 'compliance' && (
          <div className="card-body">
            {(!watchlists?.compliance_alerts || watchlists.compliance_alerts.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>All statutory certificates are valid!</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                  Fitness, insurance, national permits, and PUCs across all fleet vehicles are fully compliant.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {watchlists.compliance_alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${
                        alert.urgency === 'CRITICAL'
                          ? 'var(--color-danger-border)'
                          : alert.urgency === 'HIGH'
                          ? 'var(--color-warning-border)'
                          : 'var(--border-light)'
                      }`,
                      backgroundColor:
                        alert.urgency === 'CRITICAL'
                          ? 'var(--color-danger-bg)'
                          : alert.urgency === 'HIGH'
                          ? 'var(--color-warning-bg)'
                          : 'var(--color-slate-50)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div className="flex items-center" style={{ gap: '0.75rem' }}>
                      <AlertTriangle
                        size={20}
                        color={
                          alert.urgency === 'CRITICAL'
                            ? 'var(--color-danger)'
                            : alert.urgency === 'HIGH'
                            ? 'var(--color-warning)'
                            : 'var(--color-primary-600)'
                        }
                      />
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)' }}>
                          {alert.truck_no} • {alert.document_type}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Expiry: {new Date(alert.expiry_date).toLocaleDateString('en-IN')} (
                          {alert.is_expired ? `Expired ${Math.abs(alert.days_remaining)} days ago` : `Expires in ${alert.days_remaining} days`}
                          )
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center" style={{ gap: '0.75rem' }}>
                      <span className={`badge ${
                        alert.urgency === 'CRITICAL'
                          ? 'badge-danger'
                          : alert.urgency === 'HIGH'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}>
                        {alert.urgency}
                      </span>
                      <Link to="/fleet/trucks" className="btn btn-outline btn-sm" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                        <span>Renew Doc</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Unified Operational Activity Stream */}
        {activeTab === 'activity' && (
          <div className="card-body">
            {(!watchlists?.operational_activity_feed || watchlists.operational_activity_feed.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>Activity stream is clear</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                  New dispatches, bilty generation, and driver settlements will appear here.
                </p>
              </div>
            ) : (
              <div className="drawer-timeline" style={{ paddingLeft: '1.25rem' }}>
                {watchlists.operational_activity_feed.map((feed, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                          {feed.entity_type} {feed.action ? `• ${feed.action}` : ''}
                        </span>
                        <span className="timeline-time">
                          {new Date(feed.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: '0.3rem 0' }}>
                        {feed.entity_identifier || 'Action Item'} — <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>by {feed.actor_name || 'System Dispatcher'}</span>
                      </div>
                      <p className="timeline-desc">{feed.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. History Drawer for Audit Inspection */}
      <HistoryDrawer
        isOpen={historyDrawer.isOpen}
        onClose={() => setHistoryDrawer((prev) => ({ ...prev, isOpen: false }))}
        entityType={historyDrawer.entityType}
        entityId={historyDrawer.entityId}
        entityTitle={historyDrawer.entityTitle}
      />
    </div>
  );
};
