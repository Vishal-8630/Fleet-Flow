/**
 * ============================================================================
 * HELP CENTER PAGE (HelpCenterPage.tsx)
 * ============================================================================
 * Public customer documentation, operational workflow guides, and support routing.
 * 
 * Satisfies FF-ISSUE-008:
 * - Decoupled completely from ContactPage.tsx.
 * - Zero duplicated sales forms or lead generation inputs.
 * - Dedicated to operational knowledge, workflow guides, and in-app ticket routing.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import {
  HelpCircle,
  BookOpen,
  FileText,
  Truck,
  Receipt,
  Calculator,
  LifeBuoy,
  Search,
  ArrowRight,
  ExternalLink,
  Activity,
  MapPin,
  CheckCircle,
} from 'lucide-react';

interface GuideCategory {
  title: string;
  icon: React.ReactNode;
  description: string;
  articles: { title: string; summary: string }[];
}

const KNOWLEDGE_CATEGORIES: GuideCategory[] = [
  {
    title: 'Fleet & Vehicle Onboarding',
    icon: <Truck size={22} color="var(--color-primary-600)" />,
    description: 'Managing truck masters, driver KYC compliance, and statutory vehicle document renewals.',
    articles: [
      {
        title: 'Adding Trucks & Managing RC / Fitness Renewals',
        summary: 'Enter vehicle registration numbers, tonnage capacity, fuel tank benchmark, and set automated expiry alerts.',
      },
      {
        title: 'Driver KYC & Aadhaar Masking Invariants',
        summary: 'Upload driver commercial licenses, log emergency contacts, and ensure masked Aadhaar numbers adhere to statutory norms.',
      },
      {
        title: 'Third-Party Transporter & Balance Party Records',
        summary: 'Configure market fleet owners, brokerage rates, advance payment balances, and PAN-based TDS rates.',
      },
    ],
  },
  {
    title: 'Consignments & Trip Dispatch',
    icon: <Receipt size={22} color="var(--color-emerald-600)" />,
    description: 'Generating statutory 3-part Lorry Receipts, multi-stop waypoints, and tracking live telemetry.',
    articles: [
      {
        title: 'Issuing Statutory 3-Part Lorry Receipts (LR)',
        summary: 'Generate Consignor, Consignee, and Driver copies conforming to the Carriage by Road Act with itemized cargo packages.',
      },
      {
        title: 'E-Way Bill Linkage & Multi-Stop Waypoint Routing',
        summary: 'Attach 12-digit E-Way Bill numbers, assign loading origins, transit hubs, and destination unloading points.',
      },
      {
        title: 'Live GPS Tracking & Delay Telemetry',
        summary: 'Monitor AIS-140 GPS pings, identify transit delays, and share public tracking URLs with consignors.',
      },
    ],
  },
  {
    title: 'GST Freight Invoicing',
    icon: <FileText size={22} color="var(--color-amber-600)" />,
    description: 'Creating commercial freight invoices, GST tax calculations, and party balance ledgers.',
    articles: [
      {
        title: 'Forward Charge vs Reverse Charge Mechanism (RCM)',
        summary: 'Configure 5% RCM (Section 9(3)) for registered GTA customers or 12% Forward Charge with Input Tax Credit.',
      },
      {
        title: 'Consolidated Billing & Multiple LR Invoicing',
        summary: 'Combine completed trip consignment notes into a single tax invoice with detention and demurrage line items.',
      },
      {
        title: 'Tracking Accounts Receivable & Aging Buckets',
        summary: 'Audit customer payment aging (0-30, 31-60, 61-90, 90+ days) and log partial bank NEFT/RTGS receipts.',
      },
    ],
  },
  {
    title: 'Driver Trip Settlements',
    icon: <Calculator size={22} color="var(--color-purple-600)" />,
    description: 'Settling driver trip advances, diesel receipts, benchmark mileage, and calculating net balance payouts.',
    articles: [
      {
        title: 'Executing Driver Trip Settlements',
        summary: 'Calculate gross trip earnings, diesel slips, en-route tolls, loading/unloading cash vouchers, and net payouts.',
      },
      {
        title: 'Fuel Benchmark vs Actual Consumption Variance',
        summary: 'Reconcile odometer kilometers against diesel liters issued to identify fuel pilferage or efficiency bonuses.',
      },
      {
        title: 'Settlement Approval & Cash Ledger Posting',
        summary: 'Submit settlements for dual authorization and immediately credit driver savings or issue bank disbursement.',
      },
    ],
  },
];

export const HelpCenterPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = KNOWLEDGE_CATEGORIES.map((cat) => ({
    ...cat,
    articles: cat.articles.filter(
      (art) =>
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.articles.length > 0);

  return (
    <PublicLayout>
      <div style={{ background: 'var(--color-slate-50)', minHeight: '100%', padding: '3.5rem 1.5rem 5rem' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem', maxWidth: 800, margin: '0 auto 3.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 1rem',
                borderRadius: '9999px',
                background: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                color: 'var(--color-primary-700)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginBottom: '1.25rem',
              }}
            >
              <LifeBuoy size={16} /> FLEET FLOW KNOWLEDGE & SUPPORT
            </span>
            <h1
              style={{
                fontSize: 'clamp(2.25rem, 4.5vw, 3.25rem)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.15,
                margin: '0 0 1.25rem',
                letterSpacing: '-0.025em',
              }}
            >
              How can we help your fleet operations today?
            </h1>
            <p
              style={{
                fontSize: '1.125rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: '0 0 2rem',
              }}
            >
              Explore operational tutorials, dispatch workflows, statutory billing guides, and immediate customer assistance options.
            </p>

            {/* Search Input */}
            <div
              style={{
                maxWidth: 580,
                margin: '0 auto',
                position: 'relative',
              }}
            >
              <Search
                size={20}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search operational guides (e.g., Lorry Receipt, GST RCM, Driver Settlement)..."
                value={searchQuery}
                aria-label="Search operational guides"
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem 0.875rem 3rem',
                  fontSize: '1rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Quick Support Action Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem',
              marginBottom: '3.5rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-primary-50)' }}>
                  <HelpCircle size={20} color="var(--color-primary-600)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Customer Support Tickets
                </h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
                Logged-in transport operators can file high-priority tickets directly to engineering and operations teams.
              </p>
              <Link
                to="/support/tickets"
                style={{
                  marginTop: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-primary-600)',
                  textDecoration: 'none',
                }}
              >
                Go to Support Tickets <ArrowRight size={14} />
              </Link>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-emerald-50)' }}>
                  <MapPin size={20} color="var(--color-emerald-600)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Public Consignment Track
                </h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
                Consignors and consignees can view live shipment telemetry without signing into the tenant dashboard.
              </p>
              <Link
                to="/track"
                style={{
                  marginTop: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-emerald-600)',
                  textDecoration: 'none',
                }}
              >
                Track Shipment by LR <ArrowRight size={14} />
              </Link>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-purple-50)' }}>
                  <Activity size={20} color="var(--color-purple-600)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Platform Health & Status
                </h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
                Check real-time operational status for API gateways, GPS ingestion pipelines, and database replication.
              </p>
              <Link
                to="/status"
                style={{
                  marginTop: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-purple-600)',
                  textDecoration: 'none',
                }}
              >
                View System Status <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Operational Workflow Guides Grid */}
          <div style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              Standard Operational Workflow Guides
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
                gap: '1.75rem',
              }}
            >
              {filteredCategories.map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '1rem',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-slate-100)' }}>
                      {cat.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {cat.title}
                      </h3>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                    {cat.description}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {cat.articles.map((art, aIdx) => (
                      <div
                        key={aIdx}
                        style={{
                          padding: '0.875rem',
                          borderRadius: '0.5rem',
                          background: 'var(--color-slate-50)',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {art.title}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {art.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {filteredCategories.length === 0 && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-light)',
                  borderRadius: '1rem',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                <HelpCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                  No guides matched "{searchQuery}"
                </h3>
                <p style={{ margin: '0 0 1rem' }}>
                  Try searching for terms like "Lorry Receipt", "E-Way Bill", "Reverse Charge", or "Trip Settlement".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>

          {/* Differentiating Commercial Contact vs Support */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '1rem',
              padding: '2rem 2.5rem',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                Looking for Commercial Sales or Custom Enterprise Demos?
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                For pricing quotations, sales assistance, and enterprise fleet onboarding demonstrations, speak directly with our commercial logistics consultants.
              </p>
            </div>
            <Link
              to="/contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'var(--color-primary-600)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Contact Sales Team <ArrowRight size={14} />
            </Link>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};
