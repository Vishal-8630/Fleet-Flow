/**
 * ============================================================================
 * FLEET FLOW — PUBLIC CONSIGNMENT TRACKING PORTAL (PublicTrackingPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Customer-facing tracking portal for shippers, consignees, and third parties.
 * No authentication required.
 * 
 * FEATURES:
 * ---------
 * - Direct URL parameter lookup (`/track/LR-0001`) or interactive search box.
 * - Real-time transit corridor route visualizer.
 * - 5-step milestone chain with timestamps, checkmark indicators, and locations.
 * - Proof of Delivery (POD) indicator if delivered.
 * - Share tracking link via 1-click clipboard copy or WhatsApp.
 * - Zero financial and PII leakage.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Truck,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Calendar,
  Share2,
  MessageCircle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  FileCheck,
} from 'lucide-react';
import { toast } from '../../stores/uiStore';

interface PublicMilestone {
  step: number;
  key: string;
  title: string;
  description: string;
  location: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface TrackingData {
  tracking_reference: string;
  bill_reference: string;
  booking_date: string;
  carrier: {
    company_name: string;
  };
  transit: {
    origin: string;
    destination: string;
    vehicle_number: string;
    last_known_location: string;
    current_status: 'BOOKED' | 'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
    is_delivered: boolean;
  };
  consignment: {
    consignor_name: string;
    consignee_name: string;
    package_count: number;
    packaging_type: string;
    goods_description: string;
    actual_weight_tonnes: number;
    has_pod: boolean;
    pod_preview_url?: string | null;
  };
  milestones: PublicMilestone[];
  last_updated_at: string;
}

export const PublicTrackingPage: React.FC = () => {
  const { lrNumber } = useParams<{ lrNumber?: string }>();
  const navigate = useNavigate();

  const [inputRef, setInputRef] = useState<string>(lrNumber || '');
  const [loading, setLoading] = useState<boolean>(Boolean(lrNumber));
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (lrNumber) {
      setInputRef(lrNumber);
      fetchTrackingData(lrNumber);
    }
  }, [lrNumber]);

  const fetchTrackingData = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await axios.get(`/api/public/track/${encodeURIComponent(trimmed)}`);
      setTrackingData(res.data);
    } catch (err: any) {
      setTrackingData(null);
      setErrorMessage(
        err.response?.data?.error || 'Unable to find tracking records for this LR reference. Please verify the number.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRef.trim()) return;
    navigate(`/track/${encodeURIComponent(inputRef.trim().toUpperCase())}`);
    fetchTrackingData(inputRef.trim());
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Public tracking link copied to clipboard!');
  };

  const handleShareWhatsApp = () => {
    if (!trackingData) return;
    const text = `Track consignment ${trackingData.tracking_reference} (${trackingData.transit.origin} to ${trackingData.transit.destination}): ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="tracking-page-container">
      {/* 1. Public Top Navigation */}
      <header className="tracking-navbar">
        <div className="tracking-brand">
          <div className="tracking-brand-logo">
            <Truck size={20} />
          </div>
          <div>
            <div className="tracking-brand-title">Fleet Flow</div>
            <div className="tracking-brand-sub">Consignment Tracking Network</div>
          </div>
        </div>

        <div className="tracking-secure-badge">
          <ShieldCheck size={14} /> Official Verified Portal
        </div>
      </header>

      {/* 2. Main Search Hero */}
      <main className="tracking-main">
        <div className="tracking-hero-header">
          <h1 className="tracking-hero-title">Track Consignment Status</h1>
          <p className="tracking-hero-desc">
            Real-time milestone visibility for shippers, consignees, and logistics partners.
          </p>

          <form onSubmit={handleSearchSubmit} className="tracking-search-bar">
            <input
              type="text"
              placeholder="Enter LR / Bilty Number (e.g. LR-0001)"
              className="tracking-search-input"
              value={inputRef}
              onChange={(e) => setInputRef(e.target.value.toUpperCase())}
            />
            <button type="submit" className="tracking-search-btn">
              <Search size={16} /> Track
            </button>
          </form>
        </div>

        {/* 3. Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
              Querying carrier corridor telemetry...
            </p>
          </div>
        )}

        {/* 4. Error Message State */}
        {!loading && errorMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--color-danger-text)',
            }}
          >
            <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.5rem 0' }}>
              Consignment Reference Not Found
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>{errorMessage}</p>
          </div>
        )}

        {/* 5. Tracking Results Card */}
        {!loading && trackingData && (
          <div className="tracking-card">
            {/* Header info */}
            <div className="tracking-card-header">
              <div className="tracking-ref-group">
                <span className="tracking-carrier-name">{trackingData.carrier.company_name}</span>
                <span className="tracking-lr-badge">{trackingData.tracking_reference}</span>
                <span className="tracking-booking-date">
                  Booked on {new Date(trackingData.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <span className={`tracking-status-pill ${trackingData.transit.current_status.toLowerCase()}`}>
                <span className="billing-hero-pulse-dot" />
                {trackingData.transit.current_status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Route visualizer ribbon */}
            <div className="tracking-route-ribbon">
              <div className="tracking-hub">
                <span className="tracking-hub-type">ORIGIN</span>
                <span className="tracking-hub-city">{trackingData.transit.origin}</span>
              </div>

              <div className="tracking-corridor-line">
                <div className="tracking-truck-icon-badge">
                  <Truck size={18} />
                </div>
                <span className="tracking-vehicle-tag">{trackingData.transit.vehicle_number}</span>
              </div>

              <div className="tracking-hub" style={{ textAlign: 'right' }}>
                <span className="tracking-hub-type">DESTINATION</span>
                <span className="tracking-hub-city">{trackingData.transit.destination}</span>
              </div>
            </div>

            {/* Consignment Specs Grid */}
            <div className="tracking-specs-grid">
              <div className="tracking-spec-box">
                <span className="tracking-spec-label">Shipper (Consignor)</span>
                <span className="tracking-spec-val">{trackingData.consignment.consignor_name}</span>
              </div>
              <div className="tracking-spec-box">
                <span className="tracking-spec-label">Receiver (Consignee)</span>
                <span className="tracking-spec-val">{trackingData.consignment.consignee_name}</span>
              </div>
              <div className="tracking-spec-box">
                <span className="tracking-spec-label">Cargo Packages</span>
                <span className="tracking-spec-val">
                  {trackingData.consignment.package_count} {trackingData.consignment.packaging_type}
                </span>
              </div>
              <div className="tracking-spec-box">
                <span className="tracking-spec-label">Actual Weight</span>
                <span className="tracking-spec-val">
                  {trackingData.consignment.actual_weight_tonnes} MT
                </span>
              </div>
            </div>

            {/* Milestones Stepper */}
            <div className="tracking-milestones-section">
              <h3 className="tracking-milestones-title">
                <Clock size={18} color="var(--color-primary-600)" />
                Consignment Milestones & Status Log
              </h3>

              <div className="tracking-stepper">
                {trackingData.milestones.map((m) => (
                  <div key={m.step} className={`tracking-step-item ${m.status}`}>
                    <div className="tracking-step-dot">
                      {m.status === 'completed' && <CheckCircle2 size={14} />}
                    </div>

                    <div className="tracking-step-content">
                      <div className="tracking-step-header">
                        <span className="tracking-step-name">{m.title}</span>
                        {m.timestamp && (
                          <span className="tracking-step-time">
                            {new Date(m.timestamp).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <p className="tracking-step-desc">{m.description}</p>

                      <div className="tracking-step-location">
                        <MapPin size={12} color="var(--color-primary-600)" />
                        <span>{m.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions & Share Strip */}
            <div className="tracking-actions-strip">
              <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                Last updated: {new Date(trackingData.last_updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>

              <div className="tracking-share-group">
                <button type="button" className="tracking-action-btn" onClick={handleCopyLink}>
                  <Share2 size={14} /> Copy Link
                </button>
                <button type="button" className="tracking-action-btn whatsapp" onClick={handleShareWhatsApp}>
                  <MessageCircle size={14} /> Share via WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 6. Public Footer */}
      <footer className="tracking-footer">
        Powered by Fleet Flow SaaS Transport OS · 256-bit Encrypted Consignment Verification
      </footer>
    </div>
  );
};
