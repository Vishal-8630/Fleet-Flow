/**
 * ============================================================================
 * FLEET FLOW — ACCESSIBLE CONFIRMATION DIALOG (common/ConfirmDialog.tsx)
 * ============================================================================
 * 
 * Reusable, accessible, design-system-aligned confirmation dialog component.
 * Replaces native browser window.confirm() dialogs with full keyboard trap,
 * auto-focus on cancel, loading states, and explicit destructive consequences.
 * 
 * Satisfies FF-ISSUE-010 acceptance criteria.
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management: store previous active element and auto-focus Cancel button on open
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      // Small timeout to allow DOM mounting
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Return focus to trigger element on dismiss
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Trap focus within the dialog while open
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && containerRef.current) {
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const isDestructive = variant === 'danger';

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger-text)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>
        );
      case 'warning':
        return (
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-warning-text)',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={22} />
          </div>
        );
      default:
        return (
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary-600)',
              flexShrink: 0,
            }}
          >
            <Info size={22} />
          </div>
        );
    }
  };

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
      <button
        ref={cancelBtnRef}
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        {cancelText}
      </button>
      <button
        type="button"
        className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
        onClick={onConfirm}
        disabled={isLoading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        {isLoading && <Loader2 size={16} className="animate-spin" />}
        {isLoading ? 'Processing...' : confirmText}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) {
          onClose();
        }
      }}
      title={title}
      size="sm"
      footer={footer}
    >
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
      >
        {getIcon()}
        <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
    </Modal>
  );
};
