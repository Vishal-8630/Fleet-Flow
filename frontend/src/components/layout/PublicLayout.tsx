/**
 * ============================================================================
 * PUBLIC LAYOUT (PublicLayout.tsx)
 * ============================================================================
 * Lightweight responsive marketing shell with brand header and corporate footer.
 * Used as the wrapper for all public-facing marketing and legal pages.
 * ============================================================================
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Truck, ArrowRight } from 'lucide-react';
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Outfit', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10, 10, 10, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', height: 64, gap: '2rem' }}>
          {/* Brand */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '0.5rem', padding: '0.375rem', display: 'flex' }}>
              <Truck size={20} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.125rem', color: '#fff', letterSpacing: '-0.01em' }}>Fleet Flow</span>
          </Link>

          {/* Nav Links */}
          <nav style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  color: location.pathname === link.path ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: location.pathname === link.path ? 'rgba(255,255,255,0.1)' : 'transparent',
                  fontWeight: location.pathname === link.path ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                style={{
                  padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none',
                  fontSize: '0.875rem', color: '#fff', fontWeight: 600,
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                }}
              >
                Go to Workspace <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 500, transition: 'all 0.15s ease' }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none',
                    fontSize: '0.875rem', color: '#fff', fontWeight: 600,
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                  }}
                >
                  Start Free Trial <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ background: '#09090b', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '3rem 1.5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Brand Column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '0.5rem', padding: '0.375rem', display: 'flex' }}>
                  <Truck size={18} color="#fff" />
                </div>
                <span style={{ fontWeight: 800, color: '#fff' }}>Fleet Flow</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', maxWidth: 280, lineHeight: 1.6 }}>
                The modern operating system for Indian fleet & transport operators. GST compliant. AIS-140 ready.
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                🇮🇳 Made for Indian Transporters · DPDP Act 2023 Compliant
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {links.map((link) => (
                    <Link key={link.path} to={link.path} style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.15s ease' }}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
              © {new Date().getFullYear()} Fleet Flow Technologies Pvt Ltd. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/privacy" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Privacy</Link>
              <Link to="/terms" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Terms</Link>
              <Link to="/refund-policy" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
