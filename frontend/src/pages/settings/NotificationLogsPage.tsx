/**
 * ============================================================================
 * FLEET FLOW — NOTIFICATION AUDIT LOGS & DELIVERY MONITOR (NotificationLogsPage.tsx)
 * ============================================================================
 * Zero Tailwind CSS — Pure CSS design tokens and component classes.
 * Features:
 * - Real-time WhatsApp Cloud API and Email delivery audit logs
 * - Visual status badges (Queued, Sent, Delivered, Read, Failed, Skipped/DND)
 * - Message preview dialog with template parameters & Meta message ID
 * - Manual one-click resend action for failed or stalled deliveries
 * - Channel delivery ratios & failure KPI ribbons
 * ============================================================================
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { FeatureGate } from '../../components/common/FeatureGate';
import {
  MessageSquare,
  Mail,
  Search,
  RotateCcw,
  CheckCheck,
  Check,
  Clock,
  AlertTriangle,
  Eye,
  Send,
  Slash,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const NotificationLogsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { role, enabledFeatures = [] } = useAuthStore();
  const isUnlocked = enabledFeatures.includes('MOD_WHATSAPP');
  const canManage = role === 'admin' || role === 'dispatcher' || role === 'accountant';

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  // Selected Log for Message Preview Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Query Notification Logs & Stats
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notification-logs', page, search, channelFilter, statusFilter, eventFilter],
    enabled: isUnlocked,
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (channelFilter) params.channel = channelFilter;
      if (statusFilter) params.status = statusFilter;
      if (eventFilter) params.event_type = eventFilter;
      const res = await api.get('/notifications/logs', { params });
      return res.data;
    },
  });

  // Resend Mutation
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/notifications/logs/${id}/resend`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Notification re-queued for delivery.');
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to resend notification.');
    },
  });

  if (!isUnlocked) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Notification Delivery Logs"
          subtitle="Real-time multi-channel delivery audit logs, WhatsApp Cloud API webhooks, and retry management"
          breadcrumbs={[
            { label: 'Settings', href: '/settings/company' },
            { label: 'Notification Logs' },
          ]}
        />
        <FeatureGate
          feature="MOD_WHATSAPP"
          pageMode={true}
          titleOverride="WhatsApp & Multi-Channel Communications Locked"
          descOverride="Real-time WhatsApp tracking dispatch, automated milestone alerts, and delivery audit logs require the Pro Enterprise or WhatsApp Communication add-on."
        >
          {null}
        </FeatureGate>
      </div>
    );
  }

  const stats = data?.stats || { total: 0, delivered: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };
  const deliveredPercentage = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  return (
    <div className="page-shell">
      {/* 1. Header */}
      <PageHeader
        title="Notification Delivery Logs"
        subtitle="Real-time multi-channel delivery audit logs, WhatsApp Cloud API webhooks, and retry management"
        breadcrumbs={[
          { label: 'Settings', href: '/settings/company' },
          { label: 'Notification Logs' },
        ]}
        actions={
          <button
            className="btn btn-secondary"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['notification-logs'] })}
            disabled={isFetching}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={15} className={isFetching ? 'spin' : ''} />
            <span>Refresh Feed</span>
          </button>
        }
      />

      {/* 2. Top KPI Delivery Ribbon */}
      <div className="commercial-metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Send size={22} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val">{stats.total}</div>
            <div className="commercial-metric-label">Total Dispatched</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCheck size={22} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val" style={{ color: '#059669' }}>
              {deliveredPercentage}%
            </div>
            <div className="commercial-metric-label">Delivered Ratio ({stats.delivered})</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val" style={{ color: stats.failed > 0 ? '#dc2626' : 'var(--text-primary)' }}>
              {stats.failed}
            </div>
            <div className="commercial-metric-label">Failed Deliveries</div>
          </div>
        </div>

        <div className="commercial-metric-card">
          <div className="commercial-metric-icon" style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }}>
            <Slash size={22} />
          </div>
          <div className="commercial-metric-content">
            <div className="commercial-metric-val" style={{ color: 'var(--text-muted)' }}>
              {stats.skipped}
            </div>
            <div className="commercial-metric-label">Skipped (Opt-Out / DND)</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="filter-toolbar">
          <div className="filter-toolbar-left">
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search recipient name, phone, email, LR #, or message text..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="filter-toolbar-right">
            <select
              className="form-control"
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '130px' }}
            >
              <option value="">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>

            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '130px' }}
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped (DND)</option>
            </select>

            <select
              className="form-control"
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: 'auto', minWidth: '160px' }}
            >
              <option value="">All Events</option>
              <option value="LR_GENERATED">LR Generated</option>
              <option value="TRIP_DISPATCHED">Trip Dispatched</option>
              <option value="DELIVERY_COMPLETED">Delivery Completed</option>
              <option value="SETTLEMENT_PAYOUT">Settlement Payout</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Notification Audit Logs Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Event Type</th>
                <th>Message Preview</th>
                <th>Status</th>
                <th>Date / Time</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid var(--color-primary-300)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Loading Notification History...</span>
                    </div>
                  </td>
                </tr>
              ) : data?.logs?.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    No notification dispatches found matching current filters.
                  </td>
                </tr>
              ) : (
                data?.logs?.map((log: any) => (
                  <tr key={log._id}>
                    {/* Channel */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        {log.channel === 'whatsapp' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a' }}>
                            <MessageSquare size={16} />
                            <span>WhatsApp</span>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb' }}>
                            <Mail size={16} />
                            <span>Email</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Recipient */}
                    <td>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                        {log.recipient_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.recipient_phone ? `+${log.recipient_phone}` : log.recipient_email}
                      </div>
                    </td>

                    {/* Event Type */}
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-slate-100)',
                          color: 'var(--color-slate-700)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {log.event_type.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Message Preview */}
                    <td style={{ maxWidth: '320px' }}>
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={log.message_preview}
                      >
                        {log.message_preview}
                      </div>
                      {log.provider_message_id && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                          ID: {log.provider_message_id.substring(0, 16)}...
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td>
                      {log.status === 'delivered' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCheck size={12} />
                          <span>Delivered</span>
                        </span>
                      ) : log.status === 'read' ? (
                        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                          <CheckCheck size={12} color="#0284c7" />
                          <span>Read</span>
                        </span>
                      ) : log.status === 'sent' ? (
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={12} />
                          <span>Sent</span>
                        </span>
                      ) : log.status === 'queued' ? (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={12} />
                          <span>Queued</span>
                        </span>
                      ) : log.status === 'failed' ? (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title={log.error_message}>
                          <AlertTriangle size={12} />
                          <span>Failed</span>
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title="Opted out via DND">
                          <Slash size={12} />
                          <span>Skipped</span>
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                        {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedLog(log)}
                          title="View Message Payload & Delivery Details"
                          style={{ padding: '0.35rem 0.5rem' }}
                        >
                          <Eye size={14} />
                        </button>

                        {canManage && (log.status === 'failed' || log.status === 'queued') && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => resendMutation.mutate(log._id)}
                            disabled={resendMutation.isPending}
                            title="Resend Notification Now"
                            style={{ padding: '0.35rem 0.6rem' }}
                          >
                            <RotateCcw size={13} />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && (
          <Pagination
            currentPage={page}
            totalPages={data.pagination.pages}
            totalItems={data.pagination.total}
            pageSize={15}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* 5. Message Detail & Payload Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Notification Delivery Audit Record"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipient</div>
                <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>{selectedLog.recipient_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>+{selectedLog.recipient_phone || selectedLog.recipient_email}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Status</div>
                <span className={`badge ${selectedLog.status === 'delivered' ? 'badge-success' : selectedLog.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                  {selectedLog.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Full Message Body
              </label>
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {selectedLog.message_preview}
              </div>
            </div>

            {selectedLog.provider_message_id && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Provider Message ID (Meta Graph API)
                </label>
                <code style={{ display: 'block', padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#0f172a' }}>
                  {selectedLog.provider_message_id}
                </code>
              </div>
            )}

            {selectedLog.error_message && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: 'var(--font-size-sm)' }}>
                <strong>Delivery Error:</strong> {selectedLog.error_message}
              </div>
            )}

            {selectedLog.delivered_at && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Confirmed Delivery Timestamp: <strong>{new Date(selectedLog.delivered_at).toLocaleString('en-IN')}</strong>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
              {canManage && (selectedLog.status === 'failed' || selectedLog.status === 'queued') && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    resendMutation.mutate(selectedLog._id);
                    setSelectedLog(null);
                  }}
                  disabled={resendMutation.isPending}
                >
                  <RotateCcw size={14} style={{ marginRight: '0.35rem' }} />
                  <span>Resend Notification</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
