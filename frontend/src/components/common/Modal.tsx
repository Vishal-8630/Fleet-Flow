/**
 * ============================================================================
 * FLEET FLOW — REUSABLE MODAL DIALOG (common/Modal.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * An accessible, responsive modal dialog window supporting flexible header,
 * body content, action footers, and responsive size variants (`sm`, `md`, `lg`, `xl`).
 * 
 * WHY IS IT DESIGNED THIS WAY?
 * ----------------------------
 * 1. Body Scroll Lock: When open, it prevents the underlying page from scrolling
 *    (`document.body.style.overflow = 'hidden'`), restoring scroll on unmount.
 * 2. Escape Key Dismissal: Registers a global `keydown` event listener for `Escape`.
 * 3. Backdrop Click-to-Dismiss: Clicking outside the modal closes it; clicking
 *    inside uses `e.stopPropagation()` so interacting with form fields never triggers close.
 * 4. Pure CSS Styling: Adheres strictly to Fleet Flow design tokens (`modals.css`).
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}) => {
  // Lock body scroll and attach Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-dialog modal-${size}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking within the modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="modal-title" className="modal-title">
              {title}
            </h3>
            {subtitle && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
