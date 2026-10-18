/**
 * ============================================================================
 * FLEET FLOW — AUTHENTICATION SHELL LAYOUT (layout/AuthLayout.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * A clean, distraction-free authentication shell providing a minimal header
 * with brand logo linking back to '/' and a minimal legal footer linking to
 * Privacy Policy and Terms of Service.
 * 
 * Satisfies FF-ISSUE-009 acceptance criteria.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  headerAction?: {
    label: string;
    linkText: string;
    to: string;
  };
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, headerAction }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-slate-100)',
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
      }}
    >
      {/* 1. Minimal Header */}
      <header
        style={{
          height: '4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            textDecoration: 'none',
          }}
          title="Return to Fleet Flow Home"
        >
          <div
            style={{
              width: '2.25rem',
              height: '2.25rem',
              backgroundColor: 'var(--color-primary-600)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <Truck size={18} color="#ffffff" />
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: '1.125rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Fleet Flow
          </span>
        </Link>

        {headerAction && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            <span>{headerAction.label} </span>
            <Link
              to={headerAction.to}
              style={{
                color: 'var(--color-primary-600)',
                fontWeight: 'var(--font-weight-semibold)',
                textDecoration: 'none',
              }}
            >
              {headerAction.linkText}
            </Link>
          </div>
        )}
      </header>

      {/* 2. Main Content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
        }}
      >
        {children}
      </main>

      {/* 3. Minimal Legal Footer */}
      <footer
        style={{
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-surface)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        <div>
          © {new Date().getFullYear()} Fleet Flow Technologies Pvt Ltd. All rights reserved.
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <Link
            to="/privacy"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Terms of Service
          </Link>
          <Link
            to="/refund-policy"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Refund Policy
          </Link>
          <Link
            to="/contact"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Contact
          </Link>
        </div>
      </footer>
    </div>
  );
};
