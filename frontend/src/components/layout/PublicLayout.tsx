/**
 * ============================================================================
 * PUBLIC LAYOUT (PublicLayout.tsx)
 * ============================================================================
 * Lightweight responsive marketing shell with brand header and corporate footer.
 * Used as the wrapper for all public-facing marketing and legal pages.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Truck, ArrowRight, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const NAV_LINKS = [
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Security', path: '/security' },
  { label: 'Help Center', path: '/help' },
  { label: 'Contact', path: '/contact' },
];

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Security & Trust', path: '/security' },
    { label: 'System Status', path: '/status' },
  ],
  Company: [
    { label: 'About Fleet Flow', path: '/contact' },
    { label: 'Book a Demo', path: '/demo' },
    { label: 'Help Center', path: '/help' },
    { label: 'Support Tickets', path: '/login' },
  ],
  Legal: [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
    { label: 'Refund Policy', path: '/refund-policy' },
  ],
};

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer upon route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', fontFamily: "'Inter', 'Outfit', system-ui, sans-serif", overflowX: 'hidden', width: '100%' }}>
      {/* Responsive Header */}
      <header
        className="public-header"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div className="public-header-inner">
          {/* Brand */}
          <Link to="/" className="public-header-brand" aria-label="Fleet Flow Home">
            <div style={{ backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-md)', padding: '0.375rem', display: 'flex', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}>
              <Truck size={20} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Fleet Flow</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="public-nav-desktop" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  color: location.pathname === link.path ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  backgroundColor: location.pathname === link.path ? 'var(--color-primary-50)' : 'transparent',
                  fontWeight: location.pathname === link.path ? 600 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Header Actions / CTAs */}
          <div className="public-header-actions">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="public-header-cta-primary"
                style={{
                  padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                  fontSize: '0.875rem', color: '#fff', fontWeight: 600,
                  backgroundColor: 'var(--color-primary-600)',
                  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                }}
              >
                <span>Go to Workspace</span> <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="public-header-cta-secondary"
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                    fontSize: '0.875rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)', fontWeight: 500, transition: 'all 0.15s ease',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="public-header-cta-primary"
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                    fontSize: '0.875rem', color: '#fff', fontWeight: 600,
                    backgroundColor: 'var(--color-primary-600)',
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                  }}
                >
                  <span>Start Free Trial</span> <ArrowRight size={14} />
                </Link>
              </>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="public-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="public-mobile-drawer" aria-label="Mobile Navigation Drawer">
            <div className="public-mobile-links">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`public-mobile-link ${location.pathname === link.path ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="public-mobile-link public-mobile-signin"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--color-slate-50)', borderTop: '1px solid var(--border-light)', padding: '3.5rem 1.5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
            {/* Brand Column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ backgroundColor: 'var(--color-primary-600)', borderRadius: 'var(--radius-md)', padding: '0.375rem', display: 'flex' }}>
                  <Truck size={18} color="#fff" />
                </div>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>Fleet Flow</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                The modern operating system for Indian fleet & transport operators. GST compliant. AIS-140 ready.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                🇮🇳 Made for Indian Transporters · DPDP Act 2023 Compliant
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {links.map((link) => (
                    <Link key={link.path} to={link.path} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s ease' }}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} Fleet Flow Technologies Pvt Ltd. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <Link to="/privacy" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
              <Link to="/terms" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
              <Link to="/refund-policy" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
