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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useUiStore, Toast } from '../../stores/uiStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Individual Toast Item with auto-dismiss timer, hover pause/resume, and dismissal action
 */
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [, setIsPaused] = useState(false);
  const remainingTimeRef = useRef<number>(toast.duration ?? 4500);
  const startTimeRef = useRef<number>(Date.now());
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCurrentTimer = useCallback(() => {
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const startTimer = useCallback((durationMs: number) => {
    clearCurrentTimer();
    if (durationMs <= 0) {
      onDismiss(toast.id);
      return;
    }
    startTimeRef.current = Date.now();
    timerIdRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, durationMs);
  }, [clearCurrentTimer, onDismiss, toast.id]);

  // Mount & initial timer start
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      startTimer(remainingTimeRef.current);
    }
    return () => clearCurrentTimer();
  }, [toast.id, toast.duration, startTimer, clearCurrentTimer]);

  const handlePointerEnter = () => {
    if (!toast.duration || toast.duration <= 0) return;
    clearCurrentTimer();
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  };

  const handlePointerLeave = () => {
    if (!toast.duration || toast.duration <= 0) return;
    setIsPaused(false);
    startTimer(remainingTimeRef.current);
  };

  const handleManualDismiss = () => {
    clearCurrentTimer();
    onDismiss(toast.id);
  };

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
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="toast-icon">{renderIcon()}</div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        type="button"
        className="toast-close-btn"
        onClick={handleManualDismiss}
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

/**
 * Fixed container rendered via Portal into document.body that iterates through active toasts.
 * Escapes any parent stacking context or overflow clipping in the application shell.
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  const content = (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(content, document.body);
  }
  return content;
};

