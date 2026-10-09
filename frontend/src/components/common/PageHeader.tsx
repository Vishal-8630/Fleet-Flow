/**
 * ============================================================================
 * FLEET FLOW — STANDARDIZED PAGE HEADER (common/PageHeader.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Reusable header rendered at the top of every major workspace screen.
 * Displays:
 * 1. Optional breadcrumb navigation hierarchy.
 * 2. Primary page title (`<h1>`) and optional subtitle.
 * 3. Status badges (e.g., active status, plan indicators).
 * 4. Action button slot (e.g., "+ Add Truck", "+ New Trip", "+ Invite Member").
 * 
 * WHY IS IT DESIGNED THIS WAY?
 * ----------------------------
 * Enforces visual consistency across all modules. Built using responsive flex
 * properties so on narrow screens (smartphones/tablets), action buttons wrap
 * neatly below the title without horizontal scrolling or layout shifts.
 * ============================================================================
 */

import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs,
}) => {
  return (
    <div className="page-header" style={{ marginBottom: '1.75rem' }}>
      {/* 1. Breadcrumbs Navigation Trail */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
          }}
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  style={{
                    color: 'var(--text-main)',
                    fontWeight: 'var(--font-weight-semibold)',
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* 2. Title & Action Buttons Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-main)',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
                marginBottom: 0,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* 3. Action Buttons Slot */}
        {actions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
