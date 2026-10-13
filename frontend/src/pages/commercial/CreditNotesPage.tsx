/**
 * ============================================================================
 * FLEET FLOW — GST CREDIT & DEBIT NOTES (CreditNotesPage.tsx)
 * ============================================================================
 * GST Section 34 compliant credit note ledger and issuance interface.
 * Allows finance teams to adjust freight invoices for rate differences,
 * cargo damage shortage, and discounts with automatic General Ledger posting.
 * ============================================================================
 */

import React, { useState, useEffect, useId } from 'react';
import {
  FileX,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import api from '../../api/client';

interface ICreditNote {
  _id: string;
  credit_note_no: string;
  original_invoice_id: any;
  party_id: any;
  type: 'credit_note' | 'debit_note';
  reason: 'rate_difference' | 'shortage_damage' | 'discount' | 'cancellation' | 'other';
  reason_description?: string;
  adjustment_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_adjustment_paise: number;
  is_interstate: boolean;
  gst_rate_percent: number;
  status: 'draft' | 'issued' | 'cancelled';
  issued_at?: string;
  created_at: string;
}

interface IInvoiceOption {
  _id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  credited_amount?: number;
  balance_amount: number;
  billing_party_snapshot?: { name: string };
  is_interstate?: boolean;
}

const REASON_LABELS: Record<string, string> = {
  rate_difference: 'Rate Difference',
  shortage_damage: 'Shortage / Cargo Damage',
  discount: 'Volume / Commercial Discount',
  cancellation: 'Invoice Cancellation',
  other: 'Other Allowance',
};

export const CreditNotesPage: React.FC = () => {
  const [creditNotes, setCreditNotes] = useState<ICreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [invoices, setInvoices] = useState<IInvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [type, setType] = useState<'credit_note' | 'debit_note'>('credit_note');
  const [reason, setReason] = useState<ICreditNote['reason']>('rate_difference');
  const [reasonDescription, setReasonDescription] = useState('');
  const [adjustmentRupees, setAdjustmentRupees] = useState<string>('');
  const [isInterstate, setIsInterstate] = useState(false);
  const [gstRatePercent, setGstRatePercent] = useState<number>(5);

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/commercial/credit-notes');
      setCreditNotes(res.data.credit_notes || []);
    } catch (err: any) {
      console.error('Failed to load credit notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const res = await api.get('/invoices', { params: { limit: 100 } });
      const rawInvoices = res.data.invoices || [];
      const eligible = rawInvoices.filter((inv: IInvoiceOption) => inv.balance_amount > 0);
      setInvoices(eligible);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedInvoiceId('');
    setAdjustmentRupees('');
    setReasonDescription('');
    setReason('rate_difference');
    fetchInvoices();
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const chosen = invoices.find((i) => i._id === invId);
    if (chosen) {
      setIsInterstate(Boolean(chosen.is_interstate));
    }
  };

  // Live GST & Total Calculations
  const adjRupeesNum = Math.max(0, parseFloat(adjustmentRupees) || 0);
  const adjPaise = Math.round(adjRupeesNum * 100);
  const gstPaise = Math.round(adjPaise * (gstRatePercent / 100));
  const totalAdjPaise = adjPaise + gstPaise;
  const totalAdjRupees = totalAdjPaise / 100;

  const selectedInvoice = invoices.find((i) => i._id === selectedInvoiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedInvoiceId) {
      setErrorMsg('Please select an original invoice.');
      return;
    }
    if (adjRupeesNum <= 0) {
      setErrorMsg('Please enter a valid adjustment amount greater than zero.');
      return;
    }
    if (selectedInvoice && totalAdjRupees > selectedInvoice.balance_amount) {
      setErrorMsg(
        `Total credit note adjustment (₹${totalAdjRupees.toFixed(2)}) exceeds eligible invoice balance (₹${selectedInvoice.balance_amount.toFixed(2)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `cn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await api.post(
        '/commercial/credit-notes',
        {
          original_invoice_id: selectedInvoiceId,
          type,
          reason,
          reason_description: reasonDescription.trim(),
          adjustment_amount_paise: adjPaise,
          is_interstate: isInterstate,
          gst_rate_percent: gstRatePercent,
        },
        {
          headers: {
            'X-Idempotency-Key': idempotencyKey,
          },
        }
      );

      setSuccessMsg('Credit note issued and posted to General Ledger.');
      await fetchCreditNotes();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to issue credit note.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List
  const filtered = creditNotes.filter((cn) => {
    const q = search.toLowerCase();
    return (
      cn.credit_note_no.toLowerCase().includes(q) ||
      (cn.reason_description && cn.reason_description.toLowerCase().includes(q)) ||
      (REASON_LABELS[cn.reason] && REASON_LABELS[cn.reason].toLowerCase().includes(q))
    );
  });

  const totalCreditedPaise = creditNotes.reduce((sum, cn) => sum + (cn.total_adjustment_paise || 0), 0);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Credit & Debit Notes"
        subtitle="GST Section 34 adjustments, cargo damage claims, and rate allowances"
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={fetchCreditNotes}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleOpenModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary-600)',
                color: '#ffffff',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              <span>Issue Credit Note</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Credit Notes
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
            {creditNotes.length}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Issued commercial adjustments
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Credited Amount
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-danger)' }}>
            ₹{(totalCreditedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Receivables reduced via Section 34
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Accounting Status
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--color-success-600)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={20} />
            <span>General Ledger Synced</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Double-entry journals balanced
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--bg-surface)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Search size={18} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by Credit Note # or Reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-main)',
          }}
        />
      </div>

      {/* Credit Notes Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading credit notes...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <FileX size={48} color="var(--color-slate-400)" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-main)' }}>
              No Credit Notes Found
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Create a credit note against an unpaid or partially paid invoice to record rate differences or damage claims.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Credit Note #</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Issued Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Type & Reason</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Net Adj (₹)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>GST (₹)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Total Adjustment</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cn) => {
                  const netAdj = (cn.adjustment_amount_paise || 0) / 100;
                  const gst = ((cn.cgst_paise || 0) + (cn.sgst_paise || 0) + (cn.igst_paise || 0)) / 100;
                  const total = (cn.total_adjustment_paise || 0) / 100;

                  return (
                    <tr key={cn._id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        {cn.credit_note_no}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {new Date(cn.issued_at || cn.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {REASON_LABELS[cn.reason] || cn.reason}
                        </div>
                        {cn.reason_description && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            {cn.reason_description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>
                        ₹{netAdj.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        ₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({cn.gst_rate_percent}%)
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)' }}>
                        ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            background: '#f0fdf4',
                            color: 'var(--color-success-600)',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.25rem 0.625rem',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {cn.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Credit Note Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Issue Credit Note
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  GST Section 34 compliant freight invoice adjustment
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {errorMsg && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--font-size-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: 'var(--color-success-600)',
                    fontSize: 'var(--font-size-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Invoice Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Original Invoice *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <option value="">-- Select an unpaid or partially paid invoice --</option>
                  {invoices.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.invoice_number} ({inv.billing_party_snapshot?.name || 'Customer'}) — Bal: ₹{inv.balance_amount.toFixed(2)}
                    </option>
                  ))}
                </select>
                {selectedInvoice && (
                  <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Customer: <strong>{selectedInvoice.billing_party_snapshot?.name || 'Customer'}</strong> |
                    Invoice Total: <strong>₹{selectedInvoice.total_amount.toFixed(2)}</strong> |
                    Eligible Balance: <strong style={{ color: 'var(--color-primary-600)' }}>₹{selectedInvoice.balance_amount.toFixed(2)}</strong>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Adjustment Reason *
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <option value="rate_difference">Rate Difference</option>
                    <option value="shortage_damage">Shortage / Damage</option>
                    <option value="discount">Commercial Discount</option>
                    <option value="cancellation">Invoice Cancellation</option>
                    <option value="other">Other Allowance</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    GST Rate
                  </label>
                  <select
                    value={gstRatePercent}
                    onChange={(e) => setGstRatePercent(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <option value={0}>0% (Exempt / RCM)</option>
                    <option value={5}>5% (Standard GTA)</option>
                    <option value={12}>12% (Forward GTA)</option>
                    <option value={18}>18% (Commercial Services)</option>
                  </select>
                </div>
              </div>

              {/* Adjustment Amount */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Base Adjustment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 2500"
                  value={adjustmentRupees}
                  onChange={(e) => setAdjustmentRupees(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                />
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  background: 'var(--bg-app)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Base Adjustment:</span>
                  <span>₹{adjRupeesNum.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>GST ({gstRatePercent}%):</span>
                  <span>₹{(gstPaise / 100).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border-subtle)',
                    color: 'var(--color-danger)',
                  }}
                >
                  <span>Total Credit Note Value:</span>
                  <span>₹{totalAdjRupees.toFixed(2)}</span>
                </div>
              </div>

              {/* Reason Description */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Reason Description / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Agreed 5% volume rebate as per commercial agreement"
                  value={reasonDescription}
                  onChange={(e) => setReasonDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: 'var(--font-size-sm)',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.625rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--color-primary-600)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Issuing...' : 'Issue & Post Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
