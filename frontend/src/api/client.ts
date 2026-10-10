/**
 * ============================================================================
 * FLEET FLOW — AXIOS HTTP CLIENT (api/client.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Central Axios HTTP instance used for all data fetching and mutation requests
 * across the React application.
 * 
 * WHY IS IT CONFIGURED THIS WAY?
 * ------------------------------
 * 1. `withCredentials: true`: Automatically includes browser session cookies
 *    (including the secure HttpOnly JWT token) with every cross-origin request.
 * 2. `baseURL: '/api'`: Proxied in development by Vite to `http://localhost:5000`
 *    and forwarded in production by Nginx / cloud reverse proxy.
 * 3. Unified Error Interceptor: Unpacks server error JSON envelopes (`res.data.error`
 *    or `res.data.message`) into a standard Error object so that TanStack Query
 *    `onError` handlers and UI toasts receive human-friendly error messages automatically.
 * 4. Session Revocation Detection: Detects 401 session expiration due to token_version
 *    invalidation and routes cleanly to `/login` with explanatory security advisory.
 * ============================================================================
 */

import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept responses to unwrap error messages uniformly & handle session revocation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';

    // Check for global session invalidation (e.g. password changed on another device)
    if (error.response?.status === 401 && message.includes('Session expired due to security updates')) {
      sessionStorage.setItem('auth_expired_reason', message);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
