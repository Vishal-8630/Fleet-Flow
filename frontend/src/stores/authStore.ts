import { create } from 'zustand';
import { api } from '../api/client';

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
  settings?: {
    currency: string;
    timezone: string;
    lr_prefix: string;
    invoice_prefix: string;
    date_format: string;
  };
}

interface AuthState {
  user: User | null;
  company: Company | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
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
  logout: () => Promise<void>;
  setAuth: (user: User, company: Company, role?: UserRole) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.get('/auth/me');
      set({
        user: res.data.user,
        company: res.data.company,
        role: res.data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        company: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/login', credentials);
      set({
        user: res.data.user,
        company: res.data.company,
        role: res.data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  register: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.post('/auth/register-company', data);
      set({
        user: res.data.user,
        company: res.data.company,
        role: 'admin',
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({
        user: null,
        company: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  setAuth: (user, company, role = 'dispatcher') => {
    set({
      user,
      company,
      role,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
