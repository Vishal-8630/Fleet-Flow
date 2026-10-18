/**
 * ============================================================================
 * PHASE H1 TEST SUITE: DESIGN SYSTEM PRIMITIVES, BADGES & BUTTON ACCESSIBILITY
 * (phase8BatchH1PrimitivesAndAccessibility.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch H Phase H1:
 * 1. FF-ISSUE-013, FF-ISSUE-014, FF-ISSUE-015, FF-ISSUE-016:
 *    - Definition of primary status semantic tokens in variables.css:
 *      --color-primary-bg, --color-primary-border, --color-primary-text.
 *    - Definition of .badge-primary in badges.css matching existing pill styling.
 *    - Verification of .badge-primary usage across all production contexts:
 *      * In Transit journey status (JourneyListPage.tsx)
 *      * Truck Supplier party category (BalancePartyListPage.tsx)
 *      * Toll / Fastag cash expenses (JourneyDetailPage.tsx)
 *      * Fleet Fuel Card payment mode (JourneyDetailPage.tsx)
 *      * Additional production usages (VehicleEntryListPage, TeamMembersPage, etc.)
 * 2. FF-ISSUE-011 & Button Accessibility:
 *    - Keyboard focus visibility via :focus-visible across .btn and all variants
 *      (.btn-primary, .btn-secondary, .btn-outline, .btn-danger, .btn-ghost, .nav-tab-item).
 *    - Form control focus visibility via :focus-visible across .form-control, .form-select.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase H1: Design System Primitives, Badges & Focus Accessibility', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const variablesCssPath = path.join(rootDir, 'frontend/src/styles/tokens/variables.css');
  const badgesCssPath = path.join(rootDir, 'frontend/src/styles/components/badges.css');
  const buttonsCssPath = path.join(rootDir, 'frontend/src/styles/components/buttons.css');
  const formsCssPath = path.join(rootDir, 'frontend/src/styles/components/forms.css');

  // Affected production components
  const journeyListPagePath = path.join(rootDir, 'frontend/src/pages/operations/JourneyListPage.tsx');
  const balancePartyListPagePath = path.join(rootDir, 'frontend/src/pages/parties/BalancePartyListPage.tsx');
  const journeyDetailPagePath = path.join(rootDir, 'frontend/src/pages/operations/JourneyDetailPage.tsx');
  const vehicleEntryListPagePath = path.join(rootDir, 'frontend/src/pages/operations/VehicleEntryListPage.tsx');
  const teamMembersPagePath = path.join(rootDir, 'frontend/src/pages/team/TeamMembersPage.tsx');

  describe('1. Semantic Status Color Tokens (variables.css)', () => {
    it('defines primary semantic status tokens in variables.css', () => {
      const content = fs.readFileSync(variablesCssPath, 'utf8');

      expect(content).toContain('--color-primary-bg: #eff6ff;');
      expect(content).toContain('--color-primary-border: #bfdbfe;');
      expect(content).toContain('--color-primary-text: #1d4ed8;');
    });

    it('preserves existing semantic status tokens in variables.css', () => {
      const content = fs.readFileSync(variablesCssPath, 'utf8');

      expect(content).toContain('--color-success-bg: #ecfdf5;');
      expect(content).toContain('--color-warning-bg: #fffbeb;');
      expect(content).toContain('--color-danger-bg: #fef2f2;');
      expect(content).toContain('--color-info-bg: #eff6ff;');
    });
  });

  describe('2. Primary Badge Token & System Architecture (badges.css)', () => {
    it('defines .badge-primary using semantic primary tokens', () => {
      const content = fs.readFileSync(badgesCssPath, 'utf8');

      expect(content).toContain('.badge-primary {');
      expect(content).toContain('background-color: var(--color-primary-bg);');
      expect(content).toContain('border-color: var(--color-primary-border);');
      expect(content).toContain('color: var(--color-primary-text);');
    });

    it('preserves identical layout metrics across all badge variants in badges.css', () => {
      const content = fs.readFileSync(badgesCssPath, 'utf8');

      // Base badge class must retain standard dimensions
      expect(content).toContain('display: inline-flex;');
      expect(content).toContain('padding: 0.25rem 0.625rem;');
      expect(content).toContain('font-size: var(--font-size-xs);');
      expect(content).toContain('font-weight: var(--font-weight-semibold);');
      expect(content).toContain('border-radius: var(--radius-full);');

      // Existing badge variants must remain defined
      expect(content).toContain('.badge-success {');
      expect(content).toContain('.badge-warning {');
      expect(content).toContain('.badge-danger {');
      expect(content).toContain('.badge-info {');
      expect(content).toContain('.badge-neutral {');
    });
  });

  describe('3. Production Badge Context Verification', () => {
    it('verifies In Transit journey badge uses badge-primary (JourneyListPage.tsx - FF-ISSUE-016)', () => {
      const content = fs.readFileSync(journeyListPagePath, 'utf8');

      // In Transit status badge must use badge-primary
      expect(content).toMatch(/case\s+'active':[\s\S]*?badge\s+badge-primary[\s\S]*?In\s+Transit/);
    });

    it('verifies Truck Supplier party category badge uses badge-primary (BalancePartyListPage.tsx - FF-ISSUE-013)', () => {
      const content = fs.readFileSync(balancePartyListPagePath, 'utf8');

      // Truck Supplier category must use badge-primary
      expect(content).toMatch(/case\s+'supplier':[\s\S]*?badge\s+badge-primary[\s\S]*?Truck\s+Supplier/);
    });

    it('verifies Toll / Fastag cash expense badge uses badge-primary (JourneyDetailPage.tsx - FF-ISSUE-014)', () => {
      const content = fs.readFileSync(journeyDetailPagePath, 'utf8');

      // Toll expense must use badge-primary
      expect(content).toMatch(/case\s+'toll':[\s\S]*?badge\s+badge-primary[\s\S]*?Toll\s+\/\s+Fastag/);
    });

    it('verifies Fleet Fuel Card payment mode badge uses badge-primary (JourneyDetailPage.tsx - FF-ISSUE-015)', () => {
      const content = fs.readFileSync(journeyDetailPagePath, 'utf8');

      // Fuel card payment mode must use badge-primary
      expect(content).toMatch(/case\s+'fuel_card':[\s\S]*?badge\s+badge-primary[\s\S]*?Fleet\s+Fuel\s+Card/);
    });

    it('verifies additional production components benefit from badge-primary', () => {
      const vehicleEntryContent = fs.readFileSync(vehicleEntryListPagePath, 'utf8');
      const teamMembersContent = fs.readFileSync(teamMembersPagePath, 'utf8');

      expect(vehicleEntryContent).toContain('badge-primary');
      expect(teamMembersContent).toContain('badge-primary');
    });
  });

  describe('4. Button Focus-Visible Keyboard Accessibility (buttons.css - FF-ISSUE-011)', () => {
    it('defines accessible :focus-visible outlines for .btn and variants', () => {
      const content = fs.readFileSync(buttonsCssPath, 'utf8');

      // Base button focus-visible
      expect(content).toContain('.btn:focus-visible {');
      expect(content).toContain('outline: 2px solid var(--color-primary-600);');
      expect(content).toContain('outline-offset: 2px;');

      // Variant focus-visible overrides
      expect(content).toContain('.btn-primary:focus-visible {');
      expect(content).toContain('.btn-secondary:focus-visible {');
      expect(content).toContain('.btn-outline:focus-visible {');
      expect(content).toContain('.btn-danger:focus-visible {');
      expect(content).toContain('.btn-ghost:focus-visible {');
    });

    it('defines accessible :focus-visible for navigation tab items', () => {
      const content = fs.readFileSync(buttonsCssPath, 'utf8');

      expect(content).toContain('.nav-tab-item:focus-visible {');
      expect(content).toContain('outline: 2px solid var(--color-primary-600);');
    });

    it('preserves disabled button non-focusable and non-interactive behavior', () => {
      const content = fs.readFileSync(buttonsCssPath, 'utf8');

      expect(content).toContain('.btn:disabled {');
      expect(content).toContain('opacity: 0.6;');
      expect(content).toContain('cursor: not-allowed;');
      expect(content).toContain('pointer-events: none;');
    });
  });

  describe('5. Form Select & Input Focus-Visible Accessibility (forms.css)', () => {
    it('defines :focus-visible outlines for form inputs and selects', () => {
      const content = fs.readFileSync(formsCssPath, 'utf8');

      expect(content).toContain('.form-select:focus-visible');
      expect(content).toContain('.form-control:focus-visible');
      expect(content).toContain('outline: 2px solid var(--color-primary-600);');
      expect(content).toContain('outline-offset: 1px;');
    });

    it('preserves custom SVG chevron for select controls', () => {
      const content = fs.readFileSync(formsCssPath, 'utf8');

      expect(content).toContain('appearance: none;');
      expect(content).toContain("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'");
    });
  });
});
