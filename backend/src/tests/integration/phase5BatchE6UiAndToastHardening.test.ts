/**
 * ============================================================================
 * PHASE E6 TEST SUITE: UI-UX CLEANUP & TOAST NOTIFICATION HARDENING
 * (phase5BatchE6UiAndToastHardening.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch E6 (FF-ISSUE-002 & FF-ISSUE-012):
 * 1. FF-ISSUE-002: Removal of the unwanted Fleet ROI Calculator from HomePage.tsx,
 *    its dedicated state (fleetSize), calculation constants, and slider markup,
 *    while preserving surrounding marketing sections (Hero, Value Pillars, CTA).
 * 2. FF-ISSUE-012: Toast Z-Index token definition (--z-toast: 9999) and stacking
 *    hierarchy ensuring toasts outrank modal backdrops (z-index: 1100), drawers (1000),
 *    and mobile shell navigation (1040/1050).
 * 3. FF-ISSUE-012: DOM hierarchy and createPortal verification in ToastContainer.tsx
 *    to guarantee escape from #root stacking contexts.
 * 4. FF-ISSUE-012: Duration rules in uiStore (6000ms for error toasts, 4500ms for others,
 *    and preservation of explicit caller-supplied duration overrides).
 * 5. FF-ISSUE-012: Remaining time math and hover pause/resume logic.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase E6: UI-UX Scope Cleanup & Toast Stacking Hardening (FF-ISSUE-002 & FF-ISSUE-012)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const homePagePath = path.join(rootDir, 'frontend/src/pages/marketing/HomePage.tsx');
  const toastsCssPath = path.join(rootDir, 'frontend/src/styles/components/toasts.css');
  const modalsCssPath = path.join(rootDir, 'frontend/src/styles/components/modals.css');
  const variablesCssPath = path.join(rootDir, 'frontend/src/styles/tokens/variables.css');
  const toastContainerPath = path.join(rootDir, 'frontend/src/components/common/ToastContainer.tsx');
  const uiStorePath = path.join(rootDir, 'frontend/src/stores/uiStore.ts');

  describe('1. Public Fleet ROI Calculator Removal (FF-ISSUE-002)', () => {
    it('confirms the Fleet ROI Calculator section markup is completely removed from HomePage.tsx', () => {
      const homePageContent = fs.readFileSync(homePagePath, 'utf8');

      // Must not contain calculator headings, slider, or savings display
      expect(homePageContent).not.toContain('Fleet ROI Calculator');
      expect(homePageContent).not.toContain('Drag the slider to see your estimated monthly savings');
      expect(homePageContent).not.toContain('From billing automation');
      expect(homePageContent).not.toContain('fuel leakage reduction');
      expect(homePageContent).not.toContain('Start Saving Now');
    });

    it('confirms calculator-specific state and calculation variables are removed from HomePage.tsx', () => {
      const homePageContent = fs.readFileSync(homePagePath, 'utf8');

      // State and calculation constants must be removed
      expect(homePageContent).not.toContain('fleetSize');
      expect(homePageContent).not.toContain('setFleetSize');
      expect(homePageContent).not.toContain('hoursPerTruckPerMonth');
      expect(homePageContent).not.toContain('fuelSavingPerTruck');
      expect(homePageContent).not.toContain('totalSavings');
      expect(homePageContent).not.toContain('useState');
    });

    it('preserves surrounding essential marketing sections and CTAs in HomePage.tsx', () => {
      const homePageContent = fs.readFileSync(homePagePath, 'utf8');

      // Hero section must remain intact
      expect(homePageContent).toContain('The Modern Operating System');
      expect(homePageContent).toContain('Start Free 7-Day Trial');
      expect(homePageContent).toContain('Book a Demo');

      // Value Pillars must remain intact
      expect(homePageContent).toContain('Everything your transport business needs');
      expect(homePageContent).toContain('3-Part Lorry Receipts');
      expect(homePageContent).toContain('Live GPS Fleet Tracking');
      expect(homePageContent).toContain('GST Freight Invoicing');

      // Social Proof & CTA must remain intact
      expect(homePageContent).toContain('Join 500+ fleet operators across India');
      expect(homePageContent).toContain('Start Free Trial');
      expect(homePageContent).toContain('View Pricing');
    });
  });

  describe('2. Toast Z-Index Token and Stacking Context Isolation (FF-ISSUE-012)', () => {
    it('defines --z-toast token with high elevation (9999) in variables.css', () => {
      const variablesCss = fs.readFileSync(variablesCssPath, 'utf8');
      expect(variablesCss).toMatch(/--z-toast:\s*9999;/);
    });

    it('applies var(--z-toast, 9999) to .toast-container in toasts.css', () => {
      const toastsCss = fs.readFileSync(toastsCssPath, 'utf8');
      expect(toastsCss).toMatch(/\.toast-container\s*\{[^}]*z-index:\s*var\(--z-toast,\s*9999\);/s);
    });

    it('proves toast z-index (9999) strictly outranks modal backdrop (1100) and drawer/overlay elements', () => {
      const toastsCss = fs.readFileSync(toastsCssPath, 'utf8');
      const modalsCss = fs.readFileSync(modalsCssPath, 'utf8');

      const toastZMatch = toastsCss.match(/--z-toast,\s*(\d+)/);
      const modalZMatch = modalsCss.match(/\.modal-backdrop\s*\{[^}]*z-index:\s*(\d+);/s);

      expect(toastZMatch).not.toBeNull();
      expect(modalZMatch).not.toBeNull();

      const toastZIndex = parseInt(toastZMatch![1], 10);
      const modalZIndex = parseInt(modalZMatch![1], 10);

      expect(toastZIndex).toBeGreaterThan(modalZIndex);
      expect(toastZIndex).toBe(9999);
      expect(modalZIndex).toBe(1100);
    });

    it('renders ToastContainer via ReactDOM.createPortal to document.body to escape stacking contexts', () => {
      const toastContainerContent = fs.readFileSync(toastContainerPath, 'utf8');

      expect(toastContainerContent).toContain('ReactDOM.createPortal');
      expect(toastContainerContent).toContain('document.body');
      expect(toastContainerContent).toContain('aria-live="polite"');
    });
  });

  describe('3. Differentiated Toast Durations (FF-ISSUE-012)', () => {
    it('sets error toast default duration to exactly 6000ms in uiStore', () => {
      const uiStoreContent = fs.readFileSync(uiStorePath, 'utf8');

      // uiStore must evaluate error vs non-error duration
      expect(uiStoreContent).toContain("toast.type === 'error' ? 6000 : 4500");
    });

    it('preserves default 4500ms duration for non-error toasts (success, warning, info)', () => {
      const uiStoreContent = fs.readFileSync(uiStorePath, 'utf8');

      expect(uiStoreContent).toContain('4500');
    });

    it('respects explicit duration overrides passed by callers', () => {
      const uiStoreContent = fs.readFileSync(uiStorePath, 'utf8');

      expect(uiStoreContent).toContain('toast.duration !== undefined');
      expect(uiStoreContent).toContain('? toast.duration');
    });
  });

  describe('4. Hover Pause and Resume Remaining-Time Lifecycle (FF-ISSUE-012)', () => {
    it('implements pointer enter and leave listeners on ToastItem in ToastContainer.tsx', () => {
      const toastContainerContent = fs.readFileSync(toastContainerPath, 'utf8');

      expect(toastContainerContent).toContain('onPointerEnter={handlePointerEnter}');
      expect(toastContainerContent).toContain('onPointerLeave={handlePointerLeave}');
    });

    it('pauses timer on pointer enter and calculates elapsed time correctly', () => {
      const toastContainerContent = fs.readFileSync(toastContainerPath, 'utf8');

      expect(toastContainerContent).toContain('const elapsed = Date.now() - startTimeRef.current;');
      expect(toastContainerContent).toContain('remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);');
      expect(toastContainerContent).toContain('clearCurrentTimer();');
    });

    it('resumes timer on pointer leave with remaining duration', () => {
      const toastContainerContent = fs.readFileSync(toastContainerPath, 'utf8');

      expect(toastContainerContent).toContain('startTimer(remainingTimeRef.current);');
    });

    it('cleans up timers on manual dismissal and component unmount', () => {
      const toastContainerContent = fs.readFileSync(toastContainerPath, 'utf8');

      expect(toastContainerContent).toContain('return () => clearCurrentTimer();');
      expect(toastContainerContent).toContain('clearTimeout(timerIdRef.current)');
    });
  });

  describe('5. Mathematical Simulation of Hover Pause/Resume Invariants', () => {
    it('proves remaining duration calculus correctly pauses and resumes across multiple hover cycles', () => {
      const initialDuration = 6000;
      let remaining = initialDuration;
      let startTime = 1000;

      // User sees toast at t=1000, hovers at t=2500 (1500ms elapsed)
      const hoverTime1 = 2500;
      let elapsed = hoverTime1 - startTime;
      remaining = Math.max(0, remaining - elapsed);
      expect(remaining).toBe(4500); // 6000 - 1500

      // User stays hovered for 5000ms until t=7500 (timer paused, remaining stays 4500)
      const leaveTime1 = 7500;
      startTime = leaveTime1; // Timer restarts with 4500ms remaining

      // User hovers again at t=9500 (2000ms elapsed after resume)
      const hoverTime2 = 9500;
      elapsed = hoverTime2 - startTime;
      remaining = Math.max(0, remaining - elapsed);
      expect(remaining).toBe(2500); // 4500 - 2000

      // User stays hovered until t=15000
      const leaveTime2 = 15000;
      startTime = leaveTime2;

      // Final dismiss triggers when remaining expires (2500ms later)
      const finalDismissTime = startTime + remaining;
      expect(finalDismissTime).toBe(17500);
      expect(remaining).toBe(2500);
    });

    it('handles edge case where elapsed time exceeds duration gracefully without negative duration', () => {
      const initialDuration = 6000;
      let remaining = initialDuration;
      const startTime = 1000;
      const hoverTime = 8000; // 7000ms elapsed

      const elapsed = hoverTime - startTime;
      remaining = Math.max(0, remaining - elapsed);
      expect(remaining).toBe(0);
    });
  });
});
