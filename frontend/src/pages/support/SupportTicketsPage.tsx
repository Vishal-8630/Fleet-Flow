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
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
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

export const SupportTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
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

  useEffect(() => { fetchTickets(); }, []);

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

      {/* Create Ticket Form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Submit a Support Request</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Subject *</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of your issue" style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Message *</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Describe your issue in detail..." style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleCreate} disabled={submitting} style={{ padding: '0.625rem 1.25rem', background: 'var(--color-primary-600)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '0.625rem 1.25rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Ticket List */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <LifeBuoy size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600 }}>No support tickets yet</div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>Click "New Ticket" to get help from our team.</div>
            </div>
          ) : tickets.map((ticket) => (
            <div
              key={ticket._id}
              onClick={() => setSelectedTicket(selectedTicket?._id === ticket._id ? null : ticket)}
              style={{
                padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                background: selectedTicket?._id === ticket._id ? 'var(--color-primary-50)' : 'transparent',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              }}
            >
              <div style={{ marginTop: '2px' }}>{STATUS_ICONS[ticket.status] || <AlertCircle size={14} />}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{ticket.subject}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{ticket.ticket_no}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{CATEGORY_LABELS[ticket.category]}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: PRIORITY_COLORS[ticket.priority], fontWeight: 600 }}>{ticket.priority.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket Detail / Messages */}
        {selectedTicket && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ fontWeight: 700 }}>{selectedTicket.subject}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {selectedTicket.ticket_no} · {CATEGORY_LABELS[selectedTicket.category]}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 400 }}>
              {selectedTicket.messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.sender_role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-lg)',
                    background: msg.sender_role === 'user' ? 'var(--color-primary-600)' : 'var(--bg-subtle)',
                    color: msg.sender_role === 'user' ? '#fff' : 'var(--text-primary)',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7, marginBottom: '0.25rem' }}>{msg.sender_name}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)' }}>{msg.message}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '0.5rem' }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <button onClick={handleReply} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary-600)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <MessageSquare size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
