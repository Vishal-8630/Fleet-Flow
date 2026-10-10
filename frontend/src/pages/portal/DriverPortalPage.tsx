/**
 * ============================================================================
 * DRIVER MOBILE WORKFLOW PORTAL (DriverPortalPage.tsx)
 * ============================================================================
 * Touch-optimized Progressive Web App (PWA) interface for commercial truck drivers.
 * Displays assigned trip route, cash advances, en-route incident reporting,
 * and an on-screen touch signature canvas for instant e-POD completion.
 * ============================================================================
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Navigation, CheckCircle2, AlertTriangle, PenTool, LogOut, RefreshCw, DollarSign } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

interface ActiveTrip {
  journey_id: string;
  journey_number: string;
  from_location: { city: string; state?: string };
  to_location: { city: string; state?: string };
  truck: { truck_no: string; make: string; model: string };
  start_date: string;
  status: string;
  driver_advances?: number;
}

export const DriverPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPodModal, setShowPodModal] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [submittingPod, setSubmittingPod] = useState(false);
  const [podCompleted, setPodCompleted] = useState(false);

  // Digital Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const fetchTrip = async () => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      navigate('/portal/login?type=driver');
      return;
    }

    try {
      const res = await api.get('/portal/driver/trip', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrip(res.data.trip || null);
    } catch {
      toast.error('Session expired. Please log in again.');
      localStorage.removeItem('portal_token');
      navigate('/portal/login?type=driver');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrip();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    navigate('/portal/login?type=driver');
  };

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleEpodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName) {
      toast.error('Please enter the receiver / consignee name.');
      return;
    }
    const canvas = canvasRef.current;
    const signatureDataUrl = canvas?.toDataURL() || '';

    setSubmittingPod(true);
    const token = localStorage.getItem('portal_token');

    try {
      await api.post(
        '/portal/driver/epod',
        {
          journey_id: trip?.journey_id,
          recipient_name: recipientName,
          signature_data_url: signatureDataUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPodCompleted(true);
      setShowPodModal(false);
      toast.success('e-POD submitted successfully! Delivery marked complete.');
      fetchTrip();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit e-POD.');
    } finally {
      setSubmittingPod(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 520,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mobile App Header */}
      <header
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '0.375rem', borderRadius: '0.5rem', display: 'flex' }}>
            <Truck size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>Driver Trip Deck</div>
            <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)' }}>Fleet Flow Mobile e-POD</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '0.375rem',
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <LogOut size={13} />
          <span>Exit</span>
        </button>
      </header>

      {/* Main Body */}
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.5)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : !trip ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '1.25rem',
              border: '1px solid rgba(255,255,255,0.08)',
              marginTop: '2rem',
            }}
          >
            <CheckCircle2 size={42} color="#10b981" style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>No Active Trips Dispatched</div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              You are currently in the unassigned driver pool. Your dispatcher will assign your next journey route shortly.
            </p>
          </div>
        ) : (
          <>
            {/* Active Trip Route Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '1.25rem',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818cf8', letterSpacing: '0.05em' }}>
                  ACTIVE JOURNEY #{trip.journey_number}
                </span>
                <span style={{ padding: '0.25rem 0.625rem', borderRadius: '9999px', background: 'rgba(16,185,129,0.2)', color: '#34d399', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {trip.status}
                </span>
              </div>

              {/* Corridor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Origin Hub</div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#fff' }}>{trip.from_location?.city}</div>
                </div>
                <div style={{ color: '#818cf8', fontWeight: 800 }}>➔</div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Destination</div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#fff' }}>{trip.to_location?.city}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)' }}>
                <span>🚛 {trip.truck?.truck_no}</span>
                <span>📅 {new Date(trip.start_date).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Cash Advance Indicator */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(245,158,11,0.15)' }}>
                  <DollarSign size={20} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Cash Advance Handover</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Enroute diesel &amp; toll budget</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#f59e0b' }}>
                ₹{(trip.driver_advances || 15000).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Primary Action Button: Digital e-POD */}
            <button
              onClick={() => setShowPodModal(true)}
              style={{
                marginTop: 'auto',
                padding: '1.125rem',
                borderRadius: '0.875rem',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                boxShadow: '0 0 25px rgba(16,185,129,0.3)',
              }}
            >
              <PenTool size={20} />
              <span>Capture Consignee Signature (e-POD)</span>
            </button>
          </>
        )}

        {/* e-POD Signature Modal */}
        {showPodModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                background: '#141416',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '1.25rem',
                padding: '1.5rem',
                width: '100%',
                maxWidth: 420,
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Capture Proof of Delivery</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', margin: '0 0 1.25rem 0' }}>
                Consignee signs on-screen to confirm safe cargo receipt.
              </p>

              <form onSubmit={handleEpodSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Receiver Name *</label>
                  <input
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Warehouse Manager Suresh Patil"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Touch Signature Pad *</label>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={370}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      width: '100%',
                      height: 160,
                      borderRadius: '0.5rem',
                      border: '1px dashed rgba(255,255,255,0.25)',
                      background: '#1a1a1f',
                      touchAction: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowPodModal(false)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPod}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {submittingPod ? 'Submitting...' : 'Confirm Delivery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default DriverPortalPage;
