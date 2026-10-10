/**
 * ============================================================================
 * CUSTOMER SELF-SERVICE PORTAL (CustomerPortalPage.tsx)
 * ============================================================================
 * Dedicated portal for Billing Parties (Shippers / Consignors).
 * View active consignments, download stamped POD receipts, inspect GST invoices,
 * and review statement of account without contacting dispatchers.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, FileText, Download, CheckCircle, Clock, LogOut, Package, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

interface Consignment {
  _id: string;
  lr_no: string;
  lr_date: string;
  from_location: string;
  to_location: string;
  goods_description: string;
  package_count: number;
  actual_weight_tonnes: number;
  status: string;
  vehicle_number: string;
}

interface InvoiceSummary {
  _id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: string;
}

export const CustomerPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [partyName, setPartyName] = useState('Valued Customer');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'consignments' | 'invoices'>('consignments');

  const fetchDashboard = async () => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      navigate('/portal/login?type=customer');
      return;
    }

    try {
      const res = await api.get('/portal/customer/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConsignments(res.data.consignments || []);
      setInvoices(res.data.invoices || []);
      if (res.data.party?.party_name) {
        setPartyName(res.data.party.party_name);
      }
    } catch {
      toast.error('Session expired. Please log in again.');
      localStorage.removeItem('portal_token');
      navigate('/portal/login?type=customer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    navigate('/portal/login?type=customer');
  };

  const totalOutstanding = invoices.reduce((s, i) => s + (i.balance_amount || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Navigation */}
      <header style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '0.375rem', borderRadius: '0.5rem', display: 'flex' }}>
            <Truck size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.125rem' }}>Fleet Flow Customer Portal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>{partyName}</span>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Shipments</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8', marginTop: '0.375rem' }}>
              {consignments.filter((c) => c.status !== 'invoiced').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>In transit or delivery hub</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Deliveries</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.375rem' }}>
              {consignments.filter((c) => c.status === 'invoiced').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Acknowledged with e-POD</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Invoices</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: totalOutstanding > 0 ? '#f59e0b' : '#10b981', marginTop: '0.375rem' }}>
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Awaiting payment remittance</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('consignments')}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === 'consignments' ? '2px solid #6366f1' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'consignments' ? '#fff' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            My Consignments ({consignments.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === 'invoices' ? '2px solid #6366f1' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'invoices' ? '#fff' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Tax Invoices &amp; Bills ({invoices.length})
          </button>
        </div>

        {/* Content View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.5)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : activeTab === 'consignments' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {consignments.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Package size={36} color="rgba(255,255,255,0.3)" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600 }}>No consignments booked yet</div>
                <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Your transport partner will book and assign LRs to this account.</div>
              </div>
            ) : (
              consignments.map((c) => (
                <div
                  key={c._id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#818cf8' }}>{c.lr_no}</span>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>• {new Date(c.lr_date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                      {c.from_location} → {c.to_location}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)' }}>
                      {c.goods_description} • {c.package_count} pkgs • {c.actual_weight_tonnes} tonnes
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: c.status === 'invoiced' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                          color: c.status === 'invoiced' ? '#10b981' : '#818cf8',
                        }}
                      >
                        {c.status}
                      </span>
                      {c.vehicle_number && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
                          🚛 {c.vehicle_number}
                        </div>
                      )}
                    </div>

                    <a
                      href={`/track/${c.lr_no}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontSize: '0.8125rem',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Track Live
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {invoices.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <FileText size={36} color="rgba(255,255,255,0.3)" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600 }}>No invoices issued yet</div>
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv._id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff' }}>
                      {inv.invoice_number}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
                      Dated: {new Date(inv.invoice_date).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                        ₹{inv.total_amount?.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: inv.balance_amount > 0 ? '#f59e0b' : '#10b981', marginTop: '0.125rem' }}>
                        {inv.balance_amount > 0 ? `Due: ₹${inv.balance_amount.toLocaleString('en-IN')}` : 'Paid in Full'}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '0.25rem 0.625rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: inv.status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: inv.status === 'paid' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default CustomerPortalPage;
