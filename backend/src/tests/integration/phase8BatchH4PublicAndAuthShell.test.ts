/**
 * ============================================================================
 * PHASE H4 TEST SUITE: PUBLIC LANDING PAGES, AUTH SHELL & RESPONSIVE HIERARCHY
 * (phase8BatchH4PublicAndAuthShell.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch H Phase H4:
 * 1. FF-ISSUE-001 — Public Site Color Scheme & Design System Alignment:
 *    - Replaces harsh dark gradient overdecoration with clean enterprise light-mode tokens.
 *    - PublicLayout header & footer adhere to var(--border-light) and enterprise slate palettes.
 * 
 * 2. FF-ISSUE-003 — Removal of Unsubstantiated Marketing Claims:
 *    - Eliminates fake statistics ("99.8% on-time", "15M+ km tracked", "500+ operators", "₹120Cr+ freight").
 *    - Replaces with factual enterprise capabilities (ACID ledgers, DPDP Act 2023, multi-tenant boundaries).
 * 
 * 3. FF-ISSUE-004 — Features Page Domain-Based Categorization:
 *    - Categorizes capabilities into operational domains (Fleet, Dispatch, Commercial, Ledger, Portals).
 *    - Implements interactive category filter tabs without advertising unimplemented features.
 * 
 * 4. FF-ISSUE-005 & FF-ISSUE-006 — Pricing Page Token Alignment & Accessible FAQ:
 *    - Strictly preserves DEC-001 pricing (Starter ₹1,999, Standard ₹3,999, Pro ₹8,999) and 7-day trial.
 *    - Implements interactive, keyboard-accessible collapsible FAQ accordion with aria-expanded and chevrons.
 * 
 * 5. FF-ISSUE-007 — Executive Security & Trust Overview:
 *    - Decouples /security route from PrivacyPage.
 *    - Implements 4 executive trust pillars: Encryption, Multi-Tenant Isolation, Availability, Statutory Governance.
 * 
 * 6. FF-ISSUE-008 — Distinct Help Center Experience:
 *    - Decouples /help route from ContactPage.
 *    - Provides operational workflow guides and distinct support ticket routing (/support/tickets, /track).
 * 
 * 7. FF-ISSUE-009 — Authentication Pages Shell:
 *    - AuthLayout provides a consistent top header with brand logo linking to '/'.
 *    - Provides a minimal legal footer linking to /privacy, /terms, /refund-policy, and /contact.
 *    - Wraps LoginPage and RegisterPage while preserving validation, sessions, and mutations.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase H4: Public Landing Pages, Auth Shell & Responsive Hierarchy', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const authLayoutPath = path.join(rootDir, 'frontend/src/components/layout/AuthLayout.tsx');
  const publicLayoutPath = path.join(rootDir, 'frontend/src/components/layout/PublicLayout.tsx');
  const loginPagePath = path.join(rootDir, 'frontend/src/pages/auth/LoginPage.tsx');
  const registerPagePath = path.join(rootDir, 'frontend/src/pages/auth/RegisterPage.tsx');
  const homePagePath = path.join(rootDir, 'frontend/src/pages/marketing/HomePage.tsx');
  const featuresPagePath = path.join(rootDir, 'frontend/src/pages/marketing/FeaturesPage.tsx');
  const pricingPagePath = path.join(rootDir, 'frontend/src/pages/marketing/PricingPage.tsx');
  const securityPagePath = path.join(rootDir, 'frontend/src/pages/marketing/SecurityPage.tsx');
  const helpCenterPagePath = path.join(rootDir, 'frontend/src/pages/marketing/HelpCenterPage.tsx');
  const appPath = path.join(rootDir, 'frontend/src/App.tsx');

  describe('1. Authentication Shell Layout (FF-ISSUE-009)', () => {
    it('creates AuthLayout component with brand header linking to / and legal footer', () => {
      expect(fs.existsSync(authLayoutPath)).toBe(true);
      const content = fs.readFileSync(authLayoutPath, 'utf8');

      // Brand link back to '/'
      expect(content).toContain('to="/"');
      expect(content).toContain('Fleet Flow');

      // Legal footer links
      expect(content).toContain('to="/privacy"');
      expect(content).toContain('to="/terms"');
      expect(content).toContain('to="/refund-policy"');
      expect(content).toContain('to="/contact"');
    });

    it('wraps LoginPage with AuthLayout while preserving form and auth logic', () => {
      const content = fs.readFileSync(loginPagePath, 'utf8');
      expect(content).toContain("import { AuthLayout } from '../../components/layout/AuthLayout'");
      expect(content).toContain('<AuthLayout');
      expect(content).toContain('</AuthLayout>');
      expect(content).toContain('handleSubmit');
      expect(content).toContain('login(');
      expect(content).toContain('isRateLimited');
    });

    it('wraps RegisterPage with AuthLayout while preserving company registration flow', () => {
      const content = fs.readFileSync(registerPagePath, 'utf8');
      expect(content).toContain("import { AuthLayout } from '../../components/layout/AuthLayout'");
      expect(content).toContain('<AuthLayout');
      expect(content).toContain('</AuthLayout>');
      expect(content).toContain('register(');
      expect(content).toContain('handleCompanyNameChange');
    });
  });

  describe('2. Public Site Visual Scheme & Factual Content (FF-ISSUE-001 & FF-ISSUE-003)', () => {
    it('adheres to light-mode enterprise tokens in PublicLayout', () => {
      const content = fs.readFileSync(publicLayoutPath, 'utf8');
      expect(content).toContain('rgba(255, 255, 255, 0.96)');
      expect(content).toContain('var(--border-light)');
      expect(content).toContain('var(--text-primary)');
      expect(content).toContain('var(--color-slate-50)');
    });

    it('removes unsubstantiated marketing statistics from HomePage', () => {
      const content = fs.readFileSync(homePagePath, 'utf8');

      // Must not contain fabricated marketing metrics
      expect(content).not.toContain('99.8%');
      expect(content).not.toContain('15M+');
      expect(content).not.toContain('₹120Cr+');

      // Must contain factual enterprise architecture capabilities
      expect(content).toContain('Multi-Tenant Isolation');
      expect(content).toContain('Statutory GST & LR Compliance');
      expect(content).toContain('ACID Financial Payouts');
      expect(content).toContain('DPDP Act 2023 Readiness');
    });
  });

  describe('3. Features Categorization & Domain Architecture (FF-ISSUE-004)', () => {
    it('implements domain-based categorization filter tabs on FeaturesPage', () => {
      const content = fs.readFileSync(featuresPagePath, 'utf8');

      // Domain categories
      expect(content).toContain('All Capabilities');
      expect(content).toContain('Fleet & Compliance');
      expect(content).toContain('Dispatch & Operations');
      expect(content).toContain('Commercial & Invoicing');
      expect(content).toContain('Ledger & Settlements');
      expect(content).toContain('Portals & Security');

      // State handling for filtering
      expect(content).toContain('activeCategory');
      expect(content).toContain('setActiveCategory');
      expect(content).toContain('filteredModules');
    });
  });

  describe('4. Pricing Plan Safeguards & Accessible FAQ Accordion (FF-ISSUE-005 & FF-ISSUE-006)', () => {
    it('strictly preserves approved DEC-001 pricing and trial duration', () => {
      const content = fs.readFileSync(pricingPagePath, 'utf8');

      // Starter: ₹1,999/mo
      expect(content).toContain('1,999');
      // Standard: ₹3,999/mo
      expect(content).toContain('3,999');
      // Pro: ₹8,999/mo
      expect(content).toContain('8,999');
      // Annual equivalents
      expect(content).toContain('19,990');
      expect(content).toContain('39,990');
      expect(content).toContain('89,990');
      // 7-day trial invariant
      expect(content).toContain('7-calendar-day trial');
    });

    it('implements keyboard-accessible collapsible FAQ accordion', () => {
      const content = fs.readFileSync(pricingPagePath, 'utf8');

      expect(content).toContain('openFaqIndex');
      expect(content).toContain('setOpenFaqIndex');
      expect(content).toContain('toggleFaq');
      expect(content).toContain('aria-expanded');
      expect(content).toContain('aria-controls');
      expect(content).toContain('onKeyDown');
      expect(content).toContain("e.key === 'Enter'");
      expect(content).toContain("e.key === ' '");
      expect(content).toContain('ChevronDown');
    });
  });

  describe('5. Dedicated Security Trust Page (FF-ISSUE-007)', () => {
    it('creates dedicated SecurityPage with 4 executive trust pillars', () => {
      expect(fs.existsSync(securityPagePath)).toBe(true);
      const content = fs.readFileSync(securityPagePath, 'utf8');

      expect(content).toContain('Data Protection & Encryption');
      expect(content).toContain('Multi-Tenant Logical Isolation');
      expect(content).toContain('Availability & Disaster Recovery');
      expect(content).toContain('Compliance & Statutory Governance');
      expect(content).toContain('TLS 1.3');
      expect(content).toContain('AES-256');
    });

    it('wires /security route to SecurityPage in App.tsx', () => {
      const content = fs.readFileSync(appPath, 'utf8');
      expect(content).toContain("import { SecurityPage } from './pages/marketing/SecurityPage'");
      expect(content).toContain('<Route path="/security" element={<SecurityPage />} />');
    });
  });

  describe('6. Distinct Help Center Experience (FF-ISSUE-008)', () => {
    it('creates dedicated HelpCenterPage with operational workflow guides', () => {
      expect(fs.existsSync(helpCenterPagePath)).toBe(true);
      const content = fs.readFileSync(helpCenterPagePath, 'utf8');

      expect(content).toContain('Fleet & Vehicle Onboarding');
      expect(content).toContain('Consignments & Trip Dispatch');
      expect(content).toContain('GST Freight Invoicing');
      expect(content).toContain('Driver Trip Settlements');
      expect(content).toContain('to="/support/tickets"');
      expect(content).toContain('to="/track"');
      expect(content).toContain('to="/status"');
      expect(content).toContain('to="/contact"');
    });

    it('wires /help route to HelpCenterPage in App.tsx', () => {
      const content = fs.readFileSync(appPath, 'utf8');
      expect(content).toContain("import { HelpCenterPage } from './pages/marketing/HelpCenterPage'");
      expect(content).toContain('<Route path="/help" element={<HelpCenterPage />} />');
    });
  });
});
