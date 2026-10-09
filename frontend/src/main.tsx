/**
 * ============================================================================
 * FLEET FLOW — REACT CLIENT ENTRYPOINT (main.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * The root JavaScript/TypeScript bootstrap file that mounts the React 19 tree
 * into the DOM element `#root`.
 * 
 * WHY IS IT CONFIGURED THIS WAY?
 * ------------------------------
 * 1. TanStack Query (`QueryClientProvider`):
 *    - `staleTime: 5 * 60 * 1000` (5 minutes): Minimizes unnecessary network requests
 *      for static directories (e.g. truck lists, team lists) during active navigation.
 *    - `refetchOnWindowFocus: false`: Prevents jarring table reloads when a user
 *      clicks back into the browser window while filling out dispatch forms.
 *    - `retry: 1`: Safely retries idempotent network hiccups once before failing.
 * 2. `styles/main.css`: Master pure CSS stylesheet loaded once at the root.
 * ============================================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/main.css';

// Configure TanStack Query global caching and retry policies
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
