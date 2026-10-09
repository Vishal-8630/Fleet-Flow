/**
 * ============================================================================
 * FLEET FLOW — OPERATIONAL INTELLIGENCE DASHBOARD (pages/dashboard/DashboardPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * The default landing dashboard when an operator, dispatcher, or executive logs in.
 * Aggregates high-priority metrics across the four core modules:
 * 1. Fleet movements & dispatch watchlist.
 * 2. Available vs in-transit vehicle capacity.
 * 3. Pending driver expense settlements.
 * 4. Regulatory compliance document alerts (expiring fitness, insurance, permits).
 * 
 * WHY IS IT DESIGNED THIS WAY?
 * ----------------------------
 * Fleet operators need instant operational situational awareness. Placing the
 * active journey watchlist and the compliance expiry vault side-by-side allows
 * dispatchers to prevent assigning non-compliant trucks before vehicles leave the yard.
 * ============================================================================
 */

import React from 'react';
import { Truck, Navigation, FileSpreadsheet, BadgeCent, ShieldAlert, ArrowUpRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const DashboardPage: React.FC = () => {
  const { company } = useAuthStore();

  return (
    <div>
      {/* 1. Header & Actions */}
      <div className="flex items-center justify-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-header-title">Operational Intelligence</h1>
          <p className="page-header-subtitle">
            Live fleet dispatch and financial command center for <strong>{company?.name}</strong>
          </p>
        </div>

        <div className="flex" style={{ gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm">
            <span>Export Summary</span>
          </button>
          <button className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>New Journey Dispatch</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Summary Grid */}
      <div className="grid grid-cols-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-primary-100)' }}>
            <Navigation size={22} color="var(--color-primary-600)" />
          </div>
          <div>
            <div className="kpi-value">12</div>
            <div className="kpi-label">Active Journeys</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-success-bg)' }}>
            <Truck size={22} color="var(--color-success)" />
          </div>
          <div>
            <div className="kpi-value">28 / 35</div>
            <div className="kpi-label">Fleet Available</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
            <BadgeCent size={22} color="var(--color-warning)" />
          </div>
          <div>
            <div className="kpi-value">₹1,84,500</div>
            <div className="kpi-label">Pending Settlements</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-primary-50)' }}>
            <FileSpreadsheet size={22} color="var(--color-primary-700)" />
          </div>
          <div>
            <div className="kpi-value">₹6,42,000</div>
            <div className="kpi-label">Outstanding Invoices</div>
          </div>
        </div>
      </div>

      {/* 3. Operational Dispatch Watchlist & Compliance Vault Preview */}
      <div className="grid grid-cols-3" style={{ gap: '1.5rem' }}>
        {/* Active Journey Watchlist Table */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header flex items-center justify-between">
            <div className="card-title">Live Dispatch Watchlist</div>
            <button className="btn btn-ghost btn-sm">
              <span>View All Trips</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Trip No</th>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Route</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>TRP-2026-089</td>
                    <td>MH-12-RN-4821</td>
                    <td>Ramesh Yadav</td>
                    <td>Mumbai → Pune</td>
                    <td><span className="badge badge-info">In Transit</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>TRP-2026-088</td>
                    <td>NL-01-K-9012</td>
                    <td>Sukhvinder Singh</td>
                    <td>Delhi → Jaipur</td>
                    <td><span className="badge badge-warning">Loading</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>TRP-2026-085</td>
                    <td>KA-04-B-3310</td>
                    <td>Anand Gowda</td>
                    <td>Bangalore → Chennai</td>
                    <td><span className="badge badge-success">Completed</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Digital Compliance Vault Alerts */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} color="var(--color-warning)" />
              <span>Compliance Vault</span>
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Statutory documents requiring immediate renewal:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger-border)', backgroundColor: 'var(--color-danger-bg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-danger-text)' }}>
                  MH-12-RN-4821 • National Permit
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)', marginTop: '0.25rem' }}>
                  Expired 2 days ago
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning-text)' }}>
                  NL-01-K-9012 • Fitness Certificate
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', marginTop: '0.25rem' }}>
                  Expires in 6 days
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning-text)' }}>
                  KA-04-B-3310 • Commercial Insurance
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', marginTop: '0.25rem' }}>
                  Expires in 11 days
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
