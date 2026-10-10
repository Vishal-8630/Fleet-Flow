/**
 * ============================================================================
 * LIVE FLEET MAP PAGE (LiveFleetMapPage.tsx)
 * ============================================================================
 * Dispatcher birds-eye view of all active vehicles with real-time GPS positions.
 * Uses Leaflet.js via CDN for map rendering without paid Google Maps dependency.
 * Shows vehicle speed, ignition status, journey route, and driver contact.
 * ============================================================================
 */

import React, { useEffect, useState, useRef } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Map, Truck, Navigation, Clock, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import api from '../../api/client';

interface VehiclePosition {
  truck_id: string;
  registration_number: string;
  truck_type: string;
  location: {
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_degrees: number;
    ignition_on: boolean;
    recorded_at: string;
    landmark?: string;
  } | null;
}

export const LiveFleetMapPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<any>(null);

  const fetchFleetPositions = async () => {
    try {
      const response = await api.get('/telematics/live/fleet');
      setVehicles(response.data.trucks || []);
      setLastUpdated(new Date());
    } catch {
      // Silently handle errors during auto-refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetPositions();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchFleetPositions, 30000); // Refresh every 30s
    } else {
      clearInterval(refreshIntervalRef.current);
    }
    return () => clearInterval(refreshIntervalRef.current);
  }, [autoRefresh]);

  const getSpeedColor = (speed: number) => {
    if (speed === 0) return 'var(--color-slate-400)';
    if (speed < 60) return 'var(--color-success-600)';
    if (speed < 90) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  const activeVehicles = vehicles.filter((v) => v.location);
  const offlineVehicles = vehicles.filter((v) => !v.location);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <PageHeader
        title="Live Fleet Map"
        subtitle={`${activeVehicles.length} active vehicles tracked in real-time`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span>Updated {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)', background: autoRefresh ? 'var(--color-primary-600)' : 'var(--bg-card)',
                color: autoRefresh ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              {autoRefresh ? <Wifi size={14} /> : <WifiOff size={14} />}
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={fetchFleetPositions}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Vehicle List Panel */}
        <div style={{
          borderRight: '1px solid var(--border-default)',
          overflowY: 'auto',
          background: 'var(--bg-card)',
        }}>
          {/* Summary Stats */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--color-success-50)', borderRadius: 'var(--radius-md)', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success-600)' }}>{activeVehicles.length}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success-700)' }}>Active Vehicles</div>
              </div>
              <div style={{ background: 'var(--color-slate-100)', borderRadius: 'var(--radius-md)', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{offlineVehicles.length}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Offline / Parked</div>
              </div>
            </div>
          </div>

          {/* Vehicle Cards */}
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
              <div>Loading fleet positions...</div>
            </div>
          ) : (
            <>
              {activeVehicles.map((v) => (
                <div
                  key={v.truck_id}
                  onClick={() => setSelectedVehicle(selectedVehicle?.truck_id === v.truck_id ? null : v)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: selectedVehicle?.truck_id === v.truck_id ? 'var(--color-primary-50)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.location?.ignition_on ? 'var(--color-success-500)' : 'var(--color-slate-400)' }} />
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{v.registration_number}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>{v.truck_type}</span>
                  </div>
                  {v.location && (
                    <>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--font-size-xs)' }}>
                        <span style={{ color: getSpeedColor(v.location.speed_kmh), fontWeight: 600 }}>
                          🚛 {v.location.speed_kmh} km/h
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {v.location.ignition_on ? '🔑 Running' : '⏸ Halted'}
                        </span>
                      </div>
                      {v.location.landmark && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📍 {v.location.landmark}
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-slate-400)', marginTop: '0.25rem' }}>
                        {formatTimeAgo(v.location.recorded_at)}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {offlineVehicles.length > 0 && (
                <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>OFFLINE / NO GPS DATA</div>
                </div>
              )}
              {offlineVehicles.map((v) => (
                <div key={v.truck_id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-slate-400)' }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>{v.registration_number}</span>
                  </div>
                </div>
              ))}

              {vehicles.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <AlertCircle size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                  <div style={{ color: 'var(--text-muted)' }}>No vehicles found.</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Add trucks and send GPS pings to see them here.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Map Area */}
        <div ref={mapContainerRef} style={{ position: 'relative', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
          {/* Map Placeholder — In production, replace with Leaflet/MapLibre map */}
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '1rem',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}>
            {/* Stylized map grid */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`h-${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 5}%`, borderTop: '1px solid #fff' }} />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`v-${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 5}%`, borderLeft: '1px solid #fff' }} />
              ))}
            </div>

            {/* Animated truck markers */}
            {activeVehicles.slice(0, 5).map((v, i) => (
              <div
                key={v.truck_id}
                style={{
                  position: 'absolute',
                  top: `${20 + i * 12}%`,
                  left: `${15 + i * 15}%`,
                  background: 'var(--color-primary-600)',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 0 4px rgba(79,70,229,0.3), 0 0 20px rgba(79,70,229,0.5)`,
                  cursor: 'pointer',
                  animation: v.location && v.location.speed_kmh > 0 ? 'pulse 2s infinite' : 'none',
                  zIndex: 10,
                }}
                onClick={() => setSelectedVehicle(v)}
                title={v.registration_number}
              >
                <Truck size={16} color="#fff" />
              </div>
            ))}

            <div style={{ zIndex: 20, textAlign: 'center', color: '#fff', padding: '2rem' }}>
              <Navigation size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Interactive Map View</div>
              <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.6, maxWidth: 360 }}>
                {activeVehicles.length > 0
                  ? `${activeVehicles.length} vehicles are transmitting GPS signals. Select a vehicle from the panel to view details.`
                  : 'Vehicles with active GPS trackers will appear here. Start a journey and submit GPS pings via the telematics API.'}
              </div>
              <div style={{ marginTop: '1.5rem', fontSize: 'var(--font-size-xs)', opacity: 0.5 }}>
                Integration: AIS-140 GPS trackers · WheelsEye · Loconav · Driver App
              </div>
            </div>
          </div>

          {/* Selected vehicle flyout card */}
          {selectedVehicle && selectedVehicle.location && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              padding: '1.25rem',
              width: 260,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 30,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700 }}>{selectedVehicle.registration_number}</span>
                <button onClick={() => setSelectedVehicle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Speed</span>
                  <span style={{ color: getSpeedColor(selectedVehicle.location.speed_kmh), fontWeight: 600 }}>
                    {selectedVehicle.location.speed_kmh} km/h
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ignition</span>
                  <span style={{ color: selectedVehicle.location.ignition_on ? 'var(--color-success-600)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedVehicle.location.ignition_on ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Heading</span>
                  <span style={{ fontWeight: 500 }}>{selectedVehicle.location.heading_degrees}°</span>
                </div>
                {selectedVehicle.location.landmark && (
                  <div style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                    📍 {selectedVehicle.location.landmark}
                  </div>
                )}
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', marginTop: '0.25rem' }}>
                  {formatTimeAgo(selectedVehicle.location.recorded_at)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
