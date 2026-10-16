/**
 * ============================================================================
 * FLEET FLOW — CREDIT LIMIT WARNING & OVERRIDE MODAL (DEC-007 OPTION B)
 * ============================================================================
 * Implements DEC-007 Option B:
 * - Soft warning when customer credit exposure exceeds configured limit.
 * - Displays complete exposure arithmetic breakdown (current + new = projected vs limit).
 * - Mandatory Company Admin authorization: Non-admins cannot bypass.
 * - Meaningful justification requirement: Minimum 10 characters required.
 * - Immutable audit log persistence via backend.
 * ============================================================================
 */

import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useAuthStore } from '../../stores/authStore';

export interface CreditExposureData {
  customer_name?: string;
  credit_limit: number;
  current_exposure: number;
  order_amount: number;
  projected_exposure: number;
  excess_amount: number;
}

interface CreditLimitWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  exposure: CreditExposureData | null;
  errorMessage?: string;
  onAuthorizeOverride: (reason: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const CreditLimitWarningModal: React.FC<CreditLimitWarningModalProps> = ({
  isOpen,
  onClose,
  exposure,
  errorMessage,
  onAuthorizeOverride,
  isSubmitting = false,
}) => {
  const { role } = useAuthStore();
  const isAdmin = role === 'admin';
  const [overrideReason, setOverrideReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setValidationError('Only Company Administrators can authorize credit limit overrides.');
      return;
    }

    const trimmed = overrideReason.trim();
    if (trimmed.length < 10) {
      setValidationError('Please provide a meaningful justification (at least 10 characters).');
      return;
    }

    setValidationError('');
    await onAuthorizeOverride(trimmed);
  };

  if (!exposure && !errorMessage) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Credit Limit Warning — Commercial Compliance"
      subtitle="Policy DEC-007: Customer credit exposure limit exceeded"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Warning Alert Banner */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: 'var(--color-amber-50)',
            border: '1px solid var(--color-amber-200)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-amber-900)',
          }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--color-amber-600)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
              Credit Limit Warning Triggered
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', marginTop: '0.25rem', lineHeight: '1.4' }}>
              {errorMessage || 'This operation would cause the customer to exceed their configured credit limit.'}
            </div>
          </div>
        </div>

        {/* Exposure Arithmetic Breakdown Table */}
        {exposure && (
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: 'var(--color-slate-50)',
            }}
          >
            <div
              style={{
                padding: '0.6rem 0.85rem',
                backgroundColor: 'var(--color-slate-100)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-bold)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              Exposure Calculation Details
            </div>
            <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
              {exposure.customer_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer Account:</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{exposure.customer_name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Configured Credit Limit:</span>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>₹{(exposure.credit_limit || 0).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Exposure (Unpaid Invoices + Active Dispatches):</span>
                <span>₹{(exposure.current_exposure || 0).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>New Order / Dispatch Value:</span>
                <span>+ ₹{(exposure.order_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed var(--border-color)',
                  fontWeight: 'var(--font-weight-bold)',
                }}
              >
                <span>Projected Exposure:</span>
                <span style={{ color: 'var(--color-danger)' }}>₹{(exposure.projected_exposure || 0).toLocaleString('en-IN')}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-danger)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                <span>Excess Limit Breach:</span>
                <span>₹{(exposure.excess_amount || (exposure.projected_exposure - exposure.credit_limit)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* DEC-007 Option B Role-Gated Action Form */}
        {isAdmin ? (
          <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-primary-700)',
                backgroundColor: 'var(--color-primary-50)',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <ShieldCheck size={16} />
              <span>Company Administrator verified: You are authorized to grant an override under DEC-007 Option B.</span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                Override Justification <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="State the business rationale for exceeding the credit limit (e.g. payment confirmed by client via RTGS, approval by Managing Director)..."
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  if (validationError) setValidationError('');
                }}
                required
              />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Minimum 10 characters. This reason is permanently recorded in the immutable audit ledger.
              </div>
              {validationError && (
                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertCircle size={14} /> {validationError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--color-amber-600)', borderColor: 'var(--color-amber-600)' }}
                disabled={isSubmitting || overrideReason.trim().length < 10}
              >
                {isSubmitting ? 'Recording Override...' : 'Authorize & Proceed (Override Limit)'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.85rem',
                backgroundColor: 'var(--color-rose-50)',
                border: '1px solid var(--color-rose-200)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-rose-800)',
                fontSize: 'var(--font-size-xs)',
                lineHeight: '1.4',
              }}
            >
              <ShieldAlert size={20} style={{ color: 'var(--color-rose-600)', flexShrink: 0 }} />
              <div>
                <strong>Administrator Authorization Required:</strong> Policy DEC-007 Option B prohibits dispatches exceeding credit limits without Company Admin authorization. Please request a Company Administrator to override.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
