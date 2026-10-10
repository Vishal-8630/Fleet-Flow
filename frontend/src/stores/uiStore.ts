/**
 * ============================================================================
 * FLEET FLOW — UI & TOAST NOTIFICATION STORE (stores/uiStore.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Zustand state store governing cross-application UI interactions:
 * 1. Global toast notifications queue (success, error, warning, info).
 * 2. Mobile and responsive sidebar open/close state.
 * 
 * WHY IS IT DESIGNED THIS WAY?
 * ----------------------------
 * - Exported `toast` Helper Singleton: Allows any file (including non-component
 *   utility files, Axios interceptors, and React Query mutations) to trigger
 *   toast alerts via `toast.success('Done!')` or `toast.error('Failed!')` without
 *   needing to hook into React component lifecycles.
 * - Queue Management: Automatically attaches a unique random ID and a 4500ms
 *   default auto-dismissal duration to every new notification.
 * ============================================================================
 */

import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
}

interface UiState {
  sidebarOpen: boolean;
  toasts: Toast[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toasts: [],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  /**
   * Pushes a new toast alert to the queue and returns its unique ID.
   * Automatically deduplicates identical consecutive or concurrent notifications.
   */
  addToast: (toast) => {
    let existingId = '';
    set((state) => {
      const isDuplicate = state.toasts.some(
        (t) => t.message === toast.message && t.type === toast.type
      );
      if (isDuplicate) {
        existingId = state.toasts.find(
          (t) => t.message === toast.message && t.type === toast.type
        )?.id || '';
        return state;
      }
      const id = Math.random().toString(36).substring(2, 9);
      existingId = id;
      const newToast: Toast = { ...toast, id, duration: toast.duration || 4500 };
      return { toasts: [...state.toasts, newToast] };
    });
    return existingId;
  },

  /**
   * Removes a toast alert from the queue by ID
   */
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  /**
   * Clears all active toasts
   */
  clearToasts: () => set({ toasts: [] }),
}));

/**
 * Convenience helper methods that can be called directly from any file:
 * Example: `toast.success('Settings saved!')`
 */
export const toast = {
  success: (message: string, title?: string) =>
    useUiStore.getState().addToast({ type: 'success', message, title }),
  error: (message: string, title?: string) =>
    useUiStore.getState().addToast({ type: 'error', message, title }),
  warning: (message: string, title?: string) =>
    useUiStore.getState().addToast({ type: 'warning', message, title }),
  info: (message: string, title?: string) =>
    useUiStore.getState().addToast({ type: 'info', message, title }),
};
