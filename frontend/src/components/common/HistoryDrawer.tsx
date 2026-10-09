/**
 * ============================================================================
 * FLEET FLOW — IMMUTABLE AUDIT TIMELINE DRAWER (HistoryDrawer.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * A slide-over drawer displaying an immutable regulatory audit timeline for any
 * operational record (Journeys, Lorry Receipts, Settlements, Invoices).
 * 
 * FEATURES:
 * ---------
 * - Fetches real-time audit logs from `GET /api/dashboard/audit/:entityType/:entityId`.
 * - Displays actor identification, timestamp, action type badges, and state snapshots.
 * - Pure vanilla CSS adhering to zero-Tailwind guidelines.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { X, Clock, User, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';

interface AuditLogItem {
  _id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  actor_name: string;
  actor_role?: string;
  ip_address?: string;
  description: string;
  before_snapshot?: Record<string, any>;
  after_snapshot?: Record<string, any>;
  created_at: string;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityTitle: string;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entityId) return;

    const fetchAudit = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/dashboard/audit/${entityType}/${entityId}`);
        setLogs(res.data?.audit_trail || []);
      } catch (err) {
        console.error('Failed to load audit trail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [isOpen, entityType, entityId]);

  if (!isOpen) return null;

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'badge badge-success';
      case 'STATUS_CHANGE':
        return 'badge badge-info';
      case 'UPDATE':
        return 'badge badge-warning';
      case 'DELETE':
        return 'badge badge-danger';
      default:
        return 'badge';
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div className="flex items-center" style={{ gap: '0.5rem' }}>
              <ShieldCheck size={18} color="var(--color-primary-600)" />
              <h3 className="drawer-title">Audit History</h3>
            </div>
            <p className="drawer-subtitle">
              {entityTitle} • Immutable System Trail
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              Loading audit timeline...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 'var(--font-weight-medium)' }}>No historical revisions yet</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--font-size-xs)' }}>
                State modifications will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="drawer-timeline">
              {logs.map((log) => {
                const isExpanded = expandedId === log._id;
                const hasSnapshot = Boolean(log.before_snapshot || log.after_snapshot);

                return (
                  <div key={log._id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className={getActionBadgeClass(log.action)}>
                          {log.action}
                        </span>
                        <span className="timeline-time">
                          {new Date(log.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center" style={{ gap: '0.35rem', margin: '0.35rem 0' }}>
                        <User size={13} color="var(--text-muted)" />
                        <span className="timeline-actor">{log.actor_name}</span>
                        {log.actor_role && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            ({log.actor_role})
                          </span>
                        )}
                      </div>

                      <p className="timeline-desc">{log.description}</p>

                      {hasSnapshot && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log._id)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.7rem',
                              color: 'var(--color-primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>{isExpanded ? 'Hide Snapshot Data' : 'Inspect Snapshot Data'}</span>
                          </button>

                          {isExpanded && (
                            <pre className="timeline-diff">
                              {JSON.stringify(
                                log.after_snapshot || log.before_snapshot,
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
