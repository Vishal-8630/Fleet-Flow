/**
 * ============================================================================
 * FLEET FLOW — TOAST CONTAINER & TOAST ITEM (common/ToastContainer.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Renders floating notification cards in the lower-right corner of the viewport.
 * Consumes the `toasts` array from `uiStore`.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Portaled at Root: Mounted once in `App.tsx` so any page or modal can emit toasts
 *   without affecting local layout flow.
 * - Auto-Dismissal: `ToastItem` runs an isolated `setTimeout` hook tied to the
 *   configured toast duration (default 4.5s) and clears itself on unmount.
 * - Screen Reader Accessibility: Uses `aria-live="polite"` and `role="alert"` so
 *   assistive technologies announce status changes cleanly.
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { useUiStore, Toast } from '../../stores/uiStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Individual Toast Item with auto-dismiss timer and dismissal action
 */
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  // Auto-dismiss countdown timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  // Icon mapping according to alert severity
  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'info':
      default:
        return <Info size={18} />;
    }
  };

  return (
    <div className={`toast toast-${toast.type}`} role="alert">
      <div className="toast-icon">{renderIcon()}</div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        type="button"
        className="toast-close-btn"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

/**
 * Fixed container rendered in App.tsx that iterates through active toasts
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};
