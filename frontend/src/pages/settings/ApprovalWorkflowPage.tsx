/**
 * ============================================================================
 * APPROVAL WORKFLOWS PAGE (ApprovalWorkflowPage.tsx)
 * ============================================================================
 * Configure threshold-based multi-step approval rules for high-value financial
 * operations. View and process pending approval requests.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { CheckSquare, Plus, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

interface ApprovalRule {
  _id: string;
  name: string;
  entity_type: string;
  threshold_amount_paise: number;
  required_approver_roles: string[];
  escalation_timeout_hours: number;
  is_active: boolean;
}

interface ApprovalRequest {
  _id: string;
  entity_type: string;
  amount_paise: number;
  requester_name: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
}

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN')}`;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  settlement: 'Driver Settlement',
  driver_advance: 'Driver Advance',
  credit_note: 'Credit Note',
  invoice_void: 'Invoice Void',
  payment_receipt: 'Payment Receipt',
};

export const ApprovalWorkflowPage: React.FC = () => {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'pending'>('pending');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const [newRule, setNewRule] = useState({
    name: '',
    entity_type: 'settlement',
    threshold_amount: '',
    escalation_timeout_hours: 24,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rulesRes, pendingRes] = await Promise.all([
          api.get('/approvals/rules'),
          api.get('/approvals/pending'),
        ]);
        setRules(rulesRes.data.rules || []);
        setPending(pendingRes.data.approvals || []);
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateRule = async () => {
    if (!newRule.name || !newRule.threshold_amount) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    try {
      const res = await api.post('/approvals/rules', {
        name: newRule.name,
        entity_type: newRule.entity_type,
        threshold_amount_paise: Math.round(parseFloat(newRule.threshold_amount) * 100),
        required_approver_roles: ['admin'],
        escalation_timeout_hours: newRule.escalation_timeout_hours,
      });
      setRules([...rules, res.data.rule]);
      setShowCreateForm(false);
      setNewRule({ name: '', entity_type: 'settlement', threshold_amount: '', escalation_timeout_hours: 24 });
      showToast('Approval rule created successfully.', 'success');
    } catch {
      showToast('Failed to create approval rule.', 'error');
    }
  };

  const handleProcessApproval = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      await api.post(`/approvals/${id}/process`, { action });
      setPending(pending.filter((p) => p._id !== id));
      showToast(`Request ${action}d successfully.`, 'success');
    } catch {
      showToast('Failed to process approval.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure threshold rules and process pending authorization requests"
        actions={
          activeTab === 'rules' ? (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-600)', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
              }}
            >
              <Plus size={16} />
              Create Rule
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', padding: '0.25rem', width: 'fit-content' }}>
        {(['pending', 'rules'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab ? 600 : 500,
              fontSize: 'var(--font-size-sm)',
              boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {tab === 'pending' ? <Clock size={14} /> : <CheckSquare size={14} />}
            {tab === 'pending' ? `Pending (${pending.length})` : 'Approval Rules'}
          </button>
        ))}
      </div>

      {/* Create Rule Form */}
      {showCreateForm && activeTab === 'rules' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '1rem' }}>New Approval Rule</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Rule Name *</label>
              <input
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g. Large Driver Settlement Approval"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Entity Type *</label>
              <select
                value={newRule.entity_type}
                onChange={(e) => setNewRule({ ...newRule, entity_type: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Threshold Amount (₹) *</label>
              <input
                type="number"
                value={newRule.threshold_amount}
                onChange={(e) => setNewRule({ ...newRule, threshold_amount: e.target.value })}
                placeholder="e.g. 20000"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.25rem' }}>Escalation Timeout (hours)</label>
              <input
                type="number"
                value={newRule.escalation_timeout_hours}
                onChange={(e) => setNewRule({ ...newRule, escalation_timeout_hours: Number(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleCreateRule} style={{ padding: '0.625rem 1.25rem', background: 'var(--color-primary-600)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>
              Save Workflow
            </button>
            <button onClick={() => setShowCreateForm(false)} style={{ padding: '0.625rem 1.25rem', background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading...</div>
      ) : activeTab === 'pending' ? (
        /* Pending Approvals List */
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <CheckCircle size={40} style={{ marginBottom: '1rem', color: 'var(--color-success-500)' }} />
              <div style={{ fontWeight: 600 }}>All caught up!</div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>No pending approval requests.</div>
            </div>
          ) : (
            pending.map((req) => (
              <div key={req._id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <AlertTriangle size={20} color="var(--color-warning)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {ENTITY_TYPE_LABELS[req.entity_type] || req.entity_type}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Requested by {req.requester_name} · {new Date(req.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: '1.125rem' }}>
                  {formatCurrency(req.amount_paise)}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleProcessApproval(req._id, 'approve')}
                    disabled={processingId === req._id}
                    style={{ padding: '0.5rem 1rem', background: 'var(--color-success-600)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-sm)' }}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleProcessApproval(req._id, 'reject')}
                    disabled={processingId === req._id}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-subtle)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-sm)' }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Rules List */
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
          {rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <CheckSquare size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600 }}>No approval rules configured</div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>Create a rule to start requiring approvals for high-value operations.</div>
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule._id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{rule.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {ENTITY_TYPE_LABELS[rule.entity_type]} · Threshold: {formatCurrency(rule.threshold_amount_paise)} · Escalation: {rule.escalation_timeout_hours}h
                  </div>
                </div>
                <span style={{
                  background: rule.is_active ? 'var(--color-success-50)' : 'var(--bg-subtle)',
                  color: rule.is_active ? 'var(--color-success-700)' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-full)', padding: '0.25rem 0.75rem',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                }}>
                  {rule.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
