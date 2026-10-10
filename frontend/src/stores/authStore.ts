/**
 * ============================================================================
 * FLEET FLOW — CLIENT AUTHENTICATION STORE (stores/authStore.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Global state store using Zustand to track the user's active session, profile,
 * active company workspace, and role permissions.
 * 
 * WHY USE ZUSTAND FOR AUTH?
 * -------------------------
 * - Zero Boilerplate: Zustand provides a lightweight, reactive hook (`useAuthStore`)
 *   without requiring nested Context providers or prop drilling.
 * - Reactive UI Updates: When a user logs in, switches companies, or updates their
 *   profile, all UI components (Navbar, Sidebar, ProtectedRoute) re-render instantly.
 * 
 * STATE FLOW:
 * -----------
 * 1. `checkAuth()`: Invoked when `App.tsx` mounts. Calls `GET /api/auth/me`.
 *    - If session cookie is valid: Sets `isAuthenticated: true`, populates `user`, `company`, `role`.
 *    - If no session exists: Sets `isAuthenticated: false` and redirects to `/login`.
 * 2. `login(credentials)`: Submits credentials to `POST /api/auth/login`.
 * 3. `register(data)`: Submits company registration wizard to `POST /api/auth/register-company`.
 * 4. `logout()`: Clears session cookie via `POST /api/auth/logout` and resets state to null.
 * 5. `setAuth()`: Directly sets authenticated state when onboarding from invitation links.
 * ============================================================================
 */

import { create } from 'zustand';
import { api } from '../api/client';
import { ModuleKey } from '../utils/featureCatalog';

export type UserRole = 'admin' | 'dispatcher' | 'accountant' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isSuperAdmin?: boolean;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  trialEndsAt?: string;
  plan?: {
    code: string;
    name: string;
  };
  settings?: {
    currency: string;
    timezone: string;
    lr_prefix: string;
    invoice_prefix: string;
    date_format: string;
  };
}

export interface ResourceLimits {
  max_trucks: number;
  max_drivers: number;
  max_users: number;
}

export interface WorkspaceItem {
  company_id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  is_current: boolean;
}

interface AuthState {
  user: User | null;
  company: Company | null;
  role: UserRole | null;
  enabledFeatures: ModuleKey[];
  limits: ResourceLimits | null;
  isReadOnly: boolean;
  isImpersonation: boolean;
  impersonationActorEmail: string | null;
  workspaces: WorkspaceItem[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  switchWorkspace: (companyId: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: {
    companyName: string;
    slug?: string;
    name: string;
    email: string;
    password: string;
    phone: string;
    gstin?: string;
  }) => Promise<void>;
  createWorkspace: (data: {
    companyName: string;
    slug?: string;
    phone?: string;
    gstin?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (user: User, company: Company, role?: UserRole, enabledFeatures?: ModuleKey[], limits?: ResourceLimits | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  company: null,
  role: null,
  enabledFeatures: [],
  limits: null,
  isReadOnly: false,
  isImpersonation: false,
  impersonationActorEmail: null,
  workspaces: [],
  isAuthenticated: false,
  isLoading: true,
  error: null,

  /**
   * Hydrates authentication state upon initial application load
   */
  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.get('/auth/me');
      set({
        user: res.data.user,
        company: res.data.company,
        role: res.data.role,
        enabledFeatures: res.data.enabledFeatures || [],
        limits: res.data.limits || null,
        isReadOnly: Boolean(res.data.isReadOnly),
        isImpersonation: Boolean(res.data.isImpersonation),
        impersonationActorEmail: res.data.impersonationActorEmail || null,
        isAuthenticated: true,
        isLoading: false,
      });
      if (res.data.company?.id) {
        localStorage.setItem('active_company_id', res.data.company.id);
      }
      get().loadWorkspaces();
    } catch {
      set({
        user: null,
        company: null,
        role: null,
        enabledFeatures: [],
        limits: null,
        isReadOnly: false,
        isImpersonation: false,
        impersonationActorEmail: null,
        workspaces: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * Logs in an existing user and populates active workspace metadata
   */
  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/login', credentials);
      set({
        user: res.data.user,
        company: res.data.company,
        role: res.data.role,
        enabledFeatures: res.data.enabledFeatures || [],
        limits: res.data.limits || null,
        isReadOnly: Boolean(res.data.isReadOnly),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Registers a brand new company workspace and logs in the creator as admin
   */
  register: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/register-company', data);
      set({
        user: res.data.user,
        company: res.data.company,
        role: 'admin',
        enabledFeatures: res.data.enabledFeatures || [],
        limits: res.data.limits || null,
        isReadOnly: false,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Provisions a brand new company workspace for the authenticated user and switches to it
   */
  createWorkspace: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/create-workspace', data);
      if (res.data.company?.id) {
        localStorage.setItem('active_company_id', res.data.company.id);
      }
      set({
        company: res.data.company,
        role: 'admin',
        enabledFeatures: res.data.enabledFeatures || [],
        limits: res.data.limits || null,
        isReadOnly: false,
        isLoading: false,
      });
      await get().loadWorkspaces();
      window.location.reload();
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Loads all workspaces belonging to the authenticated user
   */
  loadWorkspaces: async () => {
    try {
      const res = await api.get('/auth/workspaces');
      set({ workspaces: res.data.workspaces || [] });
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
    }
  },

  /**
   * Switches active tenant workspace
   */
  switchWorkspace: async (companyId: string) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/switch-company', { company_id: companyId });
      localStorage.setItem('active_company_id', companyId);
      set({
        company: res.data.company,
        role: res.data.role,
        enabledFeatures: res.data.enabledFeatures || [],
        limits: res.data.limits || null,
        isLoading: false,
      });
      window.location.reload();
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Exits support impersonation session and returns to super admin plane
   */
  exitImpersonation: async () => {
    try {
      set({ isLoading: true });
      await api.post('/super-admin/exit-impersonation');
      localStorage.removeItem('active_company_id');
      window.location.href = '/super-admin';
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  /**
   * Logs out the user and clears all credentials
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('active_company_id');
      set({
        user: null,
        company: null,
        role: null,
        enabledFeatures: [],
        limits: null,
        isReadOnly: false,
        isImpersonation: false,
        impersonationActorEmail: null,
        workspaces: [],
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  /**
   * Helper to set authenticated state directly (used during invitation acceptance)
   */
  setAuth: (user, company, role = 'dispatcher', enabledFeatures = [], limits = null) => {
    set({
      user,
      company,
      role,
      enabledFeatures,
      limits,
      isReadOnly: false,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
