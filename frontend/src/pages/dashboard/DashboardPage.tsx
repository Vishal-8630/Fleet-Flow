import React from 'react';
import { Truck, Navigation, FileSpreadsheet, BadgeCent, ShieldAlert, ArrowUpRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const DashboardPage: React.FC = () => {
  const { company } = useAuthStore();

  return (
    <div>
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

      {/* KPI Stats Grid */}
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
          <div className="kpi-icon-box" style={{ backgroundColor: 'var(--color-info-bg)' }}>
            <FileSpreadsheet size={22} color="var(--color-info)" />
          </div>
          <div>
            <div className="kpi-value">₹8,92,000</div>
            <div className="kpi-label">Unbilled Receivables</div>
          </div>
        </div>
      </div>

      {/* Operational Watchlists & Quick Actions Grid */}
      <div className="grid grid-cols-12" style={{ gap: '1.5rem' }}>
        {/* Active Journeys Watchlist */}
        <div className="col-span-8 card">
          <div className="card-header">
            <h3 className="card-title">Live Dispatches & Transit Progress</h3>
            <button className="btn btn-ghost btn-sm" style={{ gap: '0.25rem' }}>
              <span>View All</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead className="table-header">
                <tr>
                  <th>Truck No</th>
                  <th>Driver</th>
                  <th>Origin / Destination</th>
                  <th>Current Milestone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="table-cell" style={{ fontWeight: 'var(--font-weight-semibold)' }}>MH 12 RN 4589</td>
                  <td className="table-cell">Ramesh Singh</td>
                  <td className="table-cell">Mumbai → Delhi</td>
                  <td className="table-cell">Surat Checkpoint (On Schedule)</td>
                  <td className="table-cell"><span className="badge badge-success">In Transit</span></td>
                </tr>
                <tr className="table-row">
                  <td className="table-cell" style={{ fontWeight: 'var(--font-weight-semibold)' }}>DL 01 AB 9021</td>
                  <td className="table-cell">Gurdeep Singh</td>
                  <td className="table-cell">Delhi → Kolkata</td>
                  <td className="table-cell">Varanasi Hub (Delayed 2h)</td>
                  <td className="table-cell"><span className="badge badge-warning">Delayed</span></td>
                </tr>
                <tr className="table-row">
                  <td className="table-cell" style={{ fontWeight: 'var(--font-weight-semibold)' }}>GJ 06 TT 1144</td>
                  <td className="table-cell">Mohan Lal</td>
                  <td className="table-cell">Ahmedabad → Bangalore</td>
                  <td className="table-cell">Hubli Toll Plaza</td>
                  <td className="table-cell"><span className="badge badge-success">In Transit</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Alerts Panel */}
        <div className="col-span-4 card">
          <div className="card-header">
            <div className="flex items-center" style={{ gap: '0.5rem' }}>
              <ShieldAlert size={18} color="var(--color-danger)" />
              <h3 className="card-title">Compliance Expiry Vault</h3>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.875rem', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger-text)' }}>
                    MH 12 RN 4589
                  </span>
                  <span className="badge badge-danger">Expired</span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)', marginTop: '0.25rem' }}>
                  National Permit expired 2 days ago.
                </div>
              </div>

              <div style={{ padding: '0.875rem', backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', color: 'var(--color-warning-text)' }}>
                    DL 01 AB 9021
                  </span>
                  <span className="badge badge-warning">Expires in 6d</span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', marginTop: '0.25rem' }}>
                  Fitness Certificate due for inspection.
                </div>
              </div>

              <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>
                Manage Compliance Documents
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
