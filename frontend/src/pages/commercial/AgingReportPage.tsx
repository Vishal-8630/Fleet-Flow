/**
 * ============================================================================
 * AR AGING REPORT PAGE (AgingReportPage.tsx)
 * ============================================================================
 * Accounts Receivable aging dashboard with bucket breakdown (0-30, 31-60,
 * 61-90, 90+ days) and customer-level outstanding balance details.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { TrendingUp, AlertCircle, Clock, RefreshCw, FileDown } from 'lucide-react';
import api from '../../api/client';

interface AgingBucket {
  count: number;
  total_paise: number;
  items: Array<{
    invoice_id: string;
    invoice_no: string;
    party: { party_name: string };
    invoice_date: string;
    outstanding_paise: number;
    age_days: number;
  }>;
}

interface AgingData {
  aging: {
    current_0_30: AgingBucket;
    days_31_60: AgingBucket;
    days_61_90: AgingBucket;
    overdue_90_plus: AgingBucket;
  };
  total_outstanding_paise: number;
  as_of: string;
}

const formatCurrency = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const AgingBucketCard: React.FC<{
  label: string;
  bucket: AgingBucket;
  color: string;
  bgColor: string;
}> = ({ label, bucket, color, bgColor }) => (
  <div style={{
    background: bgColor, borderRadius: 'var(--radius-lg)', padding: '1.25rem',
    border: `2px solid ${color}30`,
  }}>
    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color, marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{formatCurrency(bucket.total_paise)}</div>
    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
      {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
    </div>
  </div>
);

export const AgingReportPage: React.FC = () => {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current_0_30' | 'days_31_60' | 'days_61_90' | 'overdue_90_plus'>('overdue_90_plus');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchAging = async () => {
      try {
        const res = await api.get('/commercial/aging');
        setData(res.data);
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    };
    fetchAging();
  }, []);

  const handleTallyExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/commercial/export/tally', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Tally_Sales_Vouchers.xml';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export Tally XML. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const tabItems = [
    { key: 'overdue_90_plus' as const, label: '90+ Days', color: 'var(--color-danger)', bgColor: '#fef2f2' },
    { key: 'days_61_90' as const, label: '61-90 Days', color: '#dc2626', bgColor: '#fff7ed' },
    { key: 'days_31_60' as const, label: '31-60 Days', color: 'var(--color-warning)', bgColor: '#fffbeb' },
    { key: 'current_0_30' as const, label: '0-30 Days', color: 'var(--color-success-600)', bgColor: '#f0fdf4' },
  ];

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Accounts Receivable Aging"
        subtitle="Outstanding invoice aging analysis by payment delay period"
        actions={
          <button
            onClick={handleTallyExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-600)', color: '#fff',
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            <FileDown size={16} />
            {exporting ? 'Exporting...' : 'Export to Tally XML'}
          </button>
        }
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data ? (
        <>
          {/* Summary Stat Banner */}
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800))',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem 2rem',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>Total Outstanding Receivables</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{formatCurrency(data.total_outstanding_paise)}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.6, marginTop: '0.25rem' }}>
                As of {new Date(data.as_of).toLocaleString('en-IN')}
              </div>
            </div>
            <AlertCircle size={48} style={{ opacity: 0.3 }} />
          </div>

          {/* Aging Bucket Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <AgingBucketCard
              label="Current (0-30 Days)"
              bucket={data.aging.current_0_30}
              color="var(--color-success-600)"
              bgColor="#f0fdf4"
            />
            <AgingBucketCard
              label="31-60 Days"
              bucket={data.aging.days_31_60}
              color="var(--color-warning)"
              bgColor="#fffbeb"
            />
            <AgingBucketCard
              label="61-90 Days"
              bucket={data.aging.days_61_90}
              color="#dc2626"
              bgColor="#fff7ed"
            />
            <AgingBucketCard
              label="> 90 Days (Overdue)"
              bucket={data.aging.overdue_90_plus}
              color="var(--color-danger)"
              bgColor="#fef2f2"
            />
          </div>

          {/* Bucket Detail Table */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', padding: '0 1rem' }}>
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '0.75rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${activeTab === tab.key ? tab.color : 'transparent'}`,
                    color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
                    fontWeight: activeTab === tab.key ? 700 : 500,
                    fontSize: 'var(--font-size-sm)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: activeTab === tab.key ? tab.color : 'var(--bg-subtle)',
                    color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                    borderRadius: '999px', padding: '0 0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 700,
                  }}>
                    {data.aging[tab.key].count}
                  </span>
                </button>
              ))}
            </div>

            {/* Invoice Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Invoice #</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Customer</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Invoice Date</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Age (Days)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aging[activeTab].items.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No invoices in this aging bucket. ✅
                      </td>
                    </tr>
                  ) : (
                    data.aging[activeTab].items.map((item) => (
                      <tr key={item.invoice_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.invoice_no}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-sm)' }}>{item.party?.party_name || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                          {new Date(item.invoice_date).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <span style={{
                            background: item.age_days > 90 ? '#fef2f2' : item.age_days > 60 ? '#fff7ed' : '#fffbeb',
                            color: item.age_days > 90 ? 'var(--color-danger)' : item.age_days > 60 ? '#dc2626' : 'var(--color-warning)',
                            borderRadius: 'var(--radius-full)', padding: '0.125rem 0.5rem',
                            fontSize: 'var(--font-size-xs)', fontWeight: 700,
                          }}>
                            {item.age_days}d
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                          {formatCurrency(item.outstanding_paise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Clock size={32} style={{ marginBottom: '0.5rem' }} />
          <div>Failed to load aging report.</div>
        </div>
      )}
    </div>
  );
};
