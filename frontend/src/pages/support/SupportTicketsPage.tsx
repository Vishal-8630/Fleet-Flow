/**
 * ============================================================================
 * SUPPORT TICKETS PAGE (SupportTicketsPage.tsx)
 * ============================================================================
 * In-app customer support desk. Submit bug reports, billing queries, and
 * compliance questions. View ticket status and message thread replies.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle, AlertCircle, ShieldAlert, X, ArrowLeft } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

interface Ticket {
  _id: string;
  ticket_no: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  messages: Array<{ sender_name: string; sender_role: string; message: string; sent_at: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Billing & Plans', dispatch: 'Operations & Dispatch',
  compliance: 'GST & Compliance', bug: 'Bug Report', feature_request: 'Feature Request', other: 'General',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--color-success-600)', medium: 'var(--color-warning)',
  high: '#dc2626', critical: 'var(--color-danger)',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <AlertCircle size={14} color="var(--color-warning)" />,
  in_review: <Clock size={14} color="var(--color-primary-600)" />,
  resolved: <CheckCircle size={14} color="var(--color-success-600)" />,
  closed: <CheckCircle size={14} color="var(--text-muted)" />,
};

const SUPPORT_SCOPE_LABELS: Record<string, string> = {
  diagnostics_readonly: 'Read-Only Diagnostics',
  maintenance_readwrite: 'Operational Support (Read & Write)',
  emergency_breakglass: 'Emergency Diagnostics',
};

const getScopeLabel = (scope?: string) => {
  if (!scope) return 'Standard Diagnostics';
  return SUPPORT_SCOPE_LABELS[scope] || scope.replace(/_/g, ' ');
};

export const SupportTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [supportSessions, setSupportSessions] = useState<any[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const [form, setForm] = useState({ subject: '', category: 'bug', priority: 'medium', message: '' });

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support/tickets');
      setTickets(res.data.tickets || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportSessions = async () => {
    try {
      const res = await api.get('/support/sessions');
      setSupportSessions(res.data.sessions || []);
    } catch {
      //
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchSupportSessions();
  }, []);

  const handleApproveSupportSession = async (sessionId: string) => {
    try {
      await api.post(`/support/sessions/${sessionId}/approve`);
      showToast('Support access request approved. Platform operator can now access for the approved duration.', 'success');
      fetchSupportSessions();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to approve support access.', 'error');
    }
  };

  const handleRejectSupportSession = async (sessionId: string) => {
    try {
      await api.post(`/support/sessions/${sessionId}/reject`, { reason: 'Rejected by workspace administrator' });
      showToast('Support access request rejected.', 'info');
      fetchSupportSessions();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reject support access.', 'error');
    }
  };

  const handleRevokeSupportSession = async (sessionId: string) => {
    try {
      await api.post(`/support/sessions/${sessionId}/revoke`, { reason: 'Revoked by workspace administrator' });
      showToast('Support access session revoked immediately.', 'info');
      fetchSupportSessions();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to revoke support access.', 'error');
    }
  };

  const handleCreate = async () => {
    if (!form.subject || !form.message) {
      showToast('Subject and message are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/support/tickets', form);
      setTickets([res.data.ticket, ...tickets]);
      setShowCreate(false);
      setForm({ subject: '', category: 'bug', priority: 'medium', message: '' });
      showToast('Support ticket submitted successfully.', 'success');
    } catch {
      showToast('Failed to submit ticket.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      const res = await api.post(`/support/tickets/${selectedTicket._id}/reply`, { message: replyText });
      setSelectedTicket(res.data.ticket);
      setReplyText('');
      showToast('Reply sent.', 'success');
    } catch {
      showToast('Failed to send reply.', 'error');
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Support Tickets"
        subtitle="Submit and track your support requests and platform queries"
        actions={
          <button onClick={() => setShowCreate(!showCreate)} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem',
            borderRadius: 'var(--radius-md)', background: 'var(--color-primary-600)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
          }}>
            <Plus size={16} /> New Ticket
          </button>
        }
      />

      {/* DEC-012 Platform Support Access Authorizations */}
      {supportSessions.some((s) => ['pending', 'active'].includes(s.status)) && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.875rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} color="var(--color-primary-600)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Platform Support Access Requests
              </span>
            </div>
            <span className="badge badge-neutral">
              {supportSessions.filter((s) => ['pending', 'active'].includes(s.status)).length} Pending
            </span>
          </div>

          <div>
            {supportSessions
              .filter((s) => ['pending', 'active'].includes(s.status))
              .map((session, idx, arr) => (
                <div
                  key={session._id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: session.status === 'pending' ? 'var(--color-warning-50, #fffbeb)' : 'var(--color-primary-50, #eff6ff)',
                        color: session.status === 'pending' ? 'var(--color-warning, #d97706)' : 'var(--color-primary-600, #2563eb)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {session.status === 'pending' ? <Clock size={18} /> : <ShieldAlert size={18} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          Support Request: {session.requested_by?.name || 'Platform Super-Admin'}
                        </span>
                        <span className={`badge ${session.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>
                          {session.status === 'pending' ? 'Pending Approval' : 'Active Session'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong>Operator:</strong> {session.requested_by?.email || 'Platform Super-Admin'} •{' '}
                        <strong>Access Scope:</strong>{' '}
                        <span style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>
                          {getScopeLabel(session.scope)}
                        </span>{' '}
                        • <strong>Duration:</strong> {session.duration_minutes}m
                      </div>
                      {session.justification && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                          Reason: "{session.justification}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {session.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleRejectSupportSession(session._id)}
                          className="btn btn-outline btn-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveSupportSession(session._id)}
                          className="btn btn-primary btn-sm"
                        >
                          Approve ({session.duration_minutes}m)
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRevokeSupportSession(session._id)}
                        className="btn btn-danger btn-sm"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* View Switch: Create Ticket Form OR Ticket List/Detail View */}
      {showCreate ? (
        <div className="card" style={{ maxWidth: '720px', margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: '1.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Submit a Support Request</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Describe your issue or inquiry and our platform operations team will assist you.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ gridColumn: '1 / -1' }} className="form-group">
              <label className="form-label">Subject *</label>
              <input
                className="form-control"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of your issue"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }} className="form-group">
              <label className="form-label">Message *</label>
              <textarea
                className="form-control"
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your issue or inquiry in detail..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="support-tickets-container"
          style={{
            display: 'grid',
            gridTemplateColumns: selectedTicket ? 'minmax(300px, 360px) 1fr' : '1fr',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* Ticket List */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>Support Tickets</span>
              <span className="badge badge-neutral">{tickets.length} Total</span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                <LifeBuoy size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No support tickets yet</div>
                <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>Click "New Ticket" to get help from our team.</div>
              </div>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {tickets.map((ticket) => (
                  <div
                    key={ticket._id}
                    onClick={() => setSelectedTicket(selectedTicket?._id === ticket._id ? null : ticket)}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selectedTicket?._id === ticket._id ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <div style={{ marginTop: '2px', flexShrink: 0 }}>{STATUS_ICONS[ticket.status] || <AlertCircle size={14} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.subject}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {ticket.ticket_no}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: PRIORITY_COLORS[ticket.priority] || 'var(--text-muted)', fontWeight: 600 }}>
                          {ticket.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Detail / Conversation Thread */}
          {selectedTicket && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Thread Header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)' }}>
                <div style={{ minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedTicket.subject}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{selectedTicket.ticket_no}</span>
                    <span>•</span>
                    <span>{CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}</span>
                    <span>•</span>
                    <span style={{ color: PRIORITY_COLORS[selectedTicket.priority] || 'inherit', fontWeight: 600 }}>
                      Priority: {selectedTicket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.375rem 0.625rem', fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}
                  title="Close conversation"
                >
                  <X size={14} /> Close
                </button>
              </div>

              {/* Messages Stream */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', minHeight: '220px' }}>
                {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                  selectedTicket.messages.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: msg.sender_role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-lg)',
                          background: msg.sender_role === 'user' ? 'var(--color-primary-600)' : 'var(--bg-subtle)',
                          color: msg.sender_role === 'user' ? '#ffffff' : 'var(--text-primary)',
                          border: msg.sender_role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                          wordBreak: 'break-word',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, opacity: 0.85, marginBottom: '0.25rem' }}>
                          {msg.sender_name} {msg.sender_role !== 'user' && `(${msg.sender_role || 'Support'})`}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </div>
                        {msg.sent_at && (
                          <div style={{ fontSize: '10px', opacity: 0.65, marginTop: '0.375rem', textAlign: 'right' }}>
                            {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    No messages in this ticket yet.
                  </div>
                )}
              </div>

              {/* Reply Composer */}
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '0.625rem', background: 'var(--bg-card)' }}>
                <input
                  className="form-control"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleReply}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.625rem 1rem', gap: '0.375rem' }}
                  title="Send Reply"
                >
                  <MessageSquare size={16} /> Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
