/**
 * ============================================================================
 * BATCH H FOLLOW-UP TEST SUITE: RESPONSIVE SHELL, SIDEBAR & INVOICE GATE
 * (phase8BatchHFollowup.test.ts)
 * ============================================================================
 * 
 * Verifies the implementation of the 5 authorized Batch H follow-up fixes:
 * 1. BQA-PUB-001, BQA-PRC-001, BQA-SEC-001:
 *    - PublicLayout responsive header with accessible mobile navigation drawer
 *    - Hamburger menu toggle with aria-expanded and aria-label
 *    - Auto-dismiss mobile drawer on route navigation
 *    - Prevention of horizontal viewport overflow without layout distortion
 *    - Responsive flex-wrap on PricingPage billing toggle
 *    - Responsive minmax card sizing on SecurityPage 4 pillars grid
 * 
 * 2. BQA-SUP-001:
 *    - Adaptive sidebarOpen initialization in uiStore.ts (closed on <= 1024px)
 *    - Pointer-events: none and visibility: hidden on collapsed mobile sidebar in shell.css
 *    - Dim backdrop hidden and non-interactive when inactive
 * 
 * 3. BQA-NAV-003:
 *    - FeatureGate wrapping /invoices and /commercial/invoices in App.tsx
 *    - pageMode={true} with explanatory messaging when MOD_BILLING_INVOICE is deactivated
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Batch H Follow-Up: Responsive Shell, Mobile Drawer & Invoice FeatureGate', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const publicLayoutPath = path.join(rootDir, 'frontend/src/components/layout/PublicLayout.tsx');
  const pricingPagePath = path.join(rootDir, 'frontend/src/pages/marketing/PricingPage.tsx');
  const securityPagePath = path.join(rootDir, 'frontend/src/pages/marketing/SecurityPage.tsx');
  const shellCssPath = path.join(rootDir, 'frontend/src/styles/components/shell.css');
  const uiStorePath = path.join(rootDir, 'frontend/src/stores/uiStore.ts');
  const appPath = path.join(rootDir, 'frontend/src/App.tsx');

  describe('1. Responsive Public Header & Mobile Drawer (BQA-PUB-001, BQA-PRC-001, BQA-SEC-001)', () => {
    it('implements responsive mobile menu toggle and collapsible drawer in PublicLayout', () => {
      const content = fs.readFileSync(publicLayoutPath, 'utf8');

      // State and route navigation listener
      expect(content).toContain('mobileMenuOpen');
      expect(content).toContain('setMobileMenuOpen');
      expect(content).toContain('location.pathname');

      // Hamburger button accessibility
      expect(content).toContain('public-mobile-toggle');
      expect(content).toContain('aria-label');
      expect(content).toContain('aria-expanded={mobileMenuOpen}');

      // Mobile drawer links
      expect(content).toContain('public-mobile-drawer');
      expect(content).toContain('public-mobile-links');
      expect(content).toContain('public-mobile-link');
      expect(content).toContain('overflowX: \'hidden\'');
    });

    it('contains responsive media query rules in shell.css for public header', () => {
      const content = fs.readFileSync(shellCssPath, 'utf8');

      expect(content).toContain('.public-header');
      expect(content).toContain('.public-header-inner');
      expect(content).toContain('.public-nav-desktop');
      expect(content).toContain('.public-mobile-toggle');
      expect(content).toContain('.public-mobile-drawer');
      expect(content).toContain('@media (max-width: 768px)');
      expect(content).toContain('.public-nav-desktop {\n    display: none !important;\n  }');
    });

    it('implements responsive flex-wrapping on PricingPage billing toggle (BQA-PRC-001)', () => {
      const content = fs.readFileSync(pricingPagePath, 'utf8');

      expect(content).toContain('flexWrap: \'wrap\'');
      expect(content).toContain('maxWidth: \'100%\'');
      expect(content).toContain('2 Months Free (16.7% off)');
    });

    it('implements flexible grid minmax constraints on SecurityPage trust pillars (BQA-SEC-001)', () => {
      const content = fs.readFileSync(securityPagePath, 'utf8');

      expect(content).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 280px), 1fr))\'');
    });
  });

  describe('2. Mobile Sidebar Overlay & Pointer Interaction Safety (BQA-SUP-001)', () => {
    it('initializes sidebarOpen adaptively in uiStore based on window width', () => {
      const content = fs.readFileSync(uiStorePath, 'utf8');

      expect(content).toContain("sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 1024 : false");
    });

    it('enforces pointer-events: none and visibility: hidden on collapsed sidebar in shell.css', () => {
      const content = fs.readFileSync(shellCssPath, 'utf8');

      // Collapsed sidebar on mobile
      expect(content).toContain('pointer-events: none;');
      expect(content).toContain('visibility: hidden;');

      // Opened sidebar
      expect(content).toContain('.sidebar.mobile-open {');
      expect(content).toContain('visibility: visible;');

      // Inactive backdrop
      expect(content).toContain('.sidebar-backdrop {\n    display: none;\n    pointer-events: none;\n  }');
    });
  });

  describe('3. Invoices Route FeatureGate Protection (BQA-NAV-003)', () => {
    it('wraps /invoices and /commercial/invoices routes with FeatureGate in App.tsx', () => {
      const content = fs.readFileSync(appPath, 'utf8');

      expect(content).toContain('<Route\n            path="invoices"\n            element={\n              <FeatureGate\n                feature="MOD_BILLING_INVOICE"\n                pageMode={true}');

      expect(content).toContain('<Route\n            path="commercial/invoices"\n            element={\n              <FeatureGate\n                feature="MOD_BILLING_INVOICE"\n                pageMode={true}');
    });
  });
});
