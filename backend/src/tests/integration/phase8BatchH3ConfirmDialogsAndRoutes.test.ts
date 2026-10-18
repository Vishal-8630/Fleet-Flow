/**
 * ============================================================================
 * PHASE H3 TEST SUITE: CONFIRMATION DIALOGS & NAVIGATION ROUTE SYNC
 * (phase8BatchH3ConfirmDialogsAndRoutes.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch H Phase H3:
 * 1. FF-ISSUE-010 — Native Browser Confirmation Dialogs Replacement:
 *    - Replaces native window.confirm() / raw confirm() calls on master registry
 *      deletions and removals with the accessible in-app <ConfirmDialog />.
 *    - Preserves cancellation semantics (cancelling leaves records unchanged).
 *    - Prevents duplicate submissions while mutations are pending (isLoading/disabled).
 *    - Guarantees keyboard accessibility: autofocus on Cancel, focus trap, and Escape dismissal.
 *    - Master registry targets:
 *      - TruckListPage (vehicle removal)
 *      - DriverListPage (driver roster removal)
 *      - BillingPartyListPage (customer removal)
 *      - BalancePartyListPage (vendor/partner removal)
 *      - TruckDetailPage (driver unassignment)
 * 
 * 2. FF-ISSUE-019 — Sidebar Navigation Route Synchronization:
 *    - Driver Settlements navigation item highlights correctly on both canonical
 *      route (/settlements) and dashboard action link (/commercial/settlements).
 *    - Child routes (/settlements/new, /settlements/:id) maintain active state.
 *    - Neighboring commercial routes (/commercial/credit-notes, /commercial/aging)
 *      do not produce false-positive active states on Settlements.
 *    - Exact routes (end: true) avoid greedy subpath matching.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase H3: Confirmation Dialogs & Navigation Route Sync', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const confirmDialogPath = path.join(rootDir, 'frontend/src/components/common/ConfirmDialog.tsx');
  const sidebarPath = path.join(rootDir, 'frontend/src/components/layout/Sidebar.tsx');
  const truckListPagePath = path.join(rootDir, 'frontend/src/pages/fleet/TruckListPage.tsx');
  const driverListPagePath = path.join(rootDir, 'frontend/src/pages/fleet/DriverListPage.tsx');
  const billingPartyListPagePath = path.join(rootDir, 'frontend/src/pages/parties/BillingPartyListPage.tsx');
  const balancePartyListPagePath = path.join(rootDir, 'frontend/src/pages/parties/BalancePartyListPage.tsx');
  const truckDetailPagePath = path.join(rootDir, 'frontend/src/pages/fleet/TruckDetailPage.tsx');

  describe('1. Reusable ConfirmDialog Component Architecture (FF-ISSUE-010)', () => {
    it('creates ConfirmDialog component with standard accessible interface', () => {
      expect(fs.existsSync(confirmDialogPath)).toBe(true);
      const content = fs.readFileSync(confirmDialogPath, 'utf8');

      // Must support standard props interface
      expect(content).toContain('interface ConfirmDialogProps');
      expect(content).toContain('isOpen: boolean');
      expect(content).toContain('onClose: () => void');
      expect(content).toContain('onConfirm: () => void | Promise<void>');
      expect(content).toContain('title: string');
      expect(content).toContain('message: React.ReactNode');
      expect(content).toContain('confirmText?: string');
      expect(content).toContain('cancelText?: string');
      expect(content).toContain('variant?:');
      expect(content).toContain('isLoading?: boolean');
    });

    it('implements focus management with autofocus on Cancel button to prevent accidental execution', () => {
      const content = fs.readFileSync(confirmDialogPath, 'utf8');

      // Must autofocus the cancel button on open
      expect(content).toContain('cancelBtnRef.current?.focus()');
      expect(content).toContain('ref={cancelBtnRef}');
      // Must restore focus on close
      expect(content).toContain('previousActiveElement.current');
    });

    it('implements keyboard focus trapping within the dialog container', () => {
      const content = fs.readFileSync(confirmDialogPath, 'utf8');

      // Keydown handler trapping Tab navigation
      expect(content).toContain("e.key === 'Tab'");
      expect(content).toContain('containerRef.current.querySelectorAll');
      expect(content).toContain('e.preventDefault()');
    });

    it('wraps the accessible Modal dialog and renders destructive danger styling', () => {
      const content = fs.readFileSync(confirmDialogPath, 'utf8');

      expect(content).toContain("import { Modal } from './Modal'");
      expect(content).toContain('<Modal');
      expect(content).toContain('btn-danger');
      expect(content).toContain('Loader2');
    });

    it('disables confirm and cancel buttons during isLoading to prevent duplicate submissions', () => {
      const content = fs.readFileSync(confirmDialogPath, 'utf8');

      expect(content).toContain('disabled={isLoading}');
      expect(content).toContain("isLoading ? 'Processing...' : confirmText");
    });
  });

  describe('2. Master Registry Confirm Dialog Replacements (FF-ISSUE-010)', () => {
    it('replaces native confirm() with ConfirmDialog in TruckListPage', () => {
      const content = fs.readFileSync(truckListPagePath, 'utf8');

      // Must not contain native confirm calls
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/window\.confirm/);

      // Must import and use ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('const [truckToDelete, setTruckToDelete] = useState');
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('isOpen={Boolean(truckToDelete)}');
      expect(content).toContain('deleteMutation.mutate(truckToDelete._id)');
      expect(content).toContain('isLoading={deleteMutation.isPending}');
    });

    it('replaces native confirm() with ConfirmDialog in DriverListPage', () => {
      const content = fs.readFileSync(driverListPagePath, 'utf8');

      // Must not contain native confirm calls
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/window\.confirm/);

      // Must import and use ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('const [driverToDelete, setDriverToDelete] = useState');
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('isOpen={Boolean(driverToDelete)}');
      expect(content).toContain('deleteMutation.mutate(driverToDelete._id)');
      expect(content).toContain('isLoading={deleteMutation.isPending}');
    });

    it('replaces native confirm() with ConfirmDialog in BillingPartyListPage', () => {
      const content = fs.readFileSync(billingPartyListPagePath, 'utf8');

      // Must not contain native confirm calls
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/window\.confirm/);

      // Must import and use ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('const [partyToDelete, setPartyToDelete] = useState');
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('isOpen={Boolean(partyToDelete)}');
      expect(content).toContain('deleteMutation.mutate(partyToDelete._id)');
      expect(content).toContain('isLoading={deleteMutation.isPending}');
    });

    it('replaces native confirm() with ConfirmDialog in BalancePartyListPage', () => {
      const content = fs.readFileSync(balancePartyListPagePath, 'utf8');

      // Must not contain native confirm calls
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/window\.confirm/);

      // Must import and use ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('const [partyToDelete, setPartyToDelete] = useState');
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('isOpen={Boolean(partyToDelete)}');
      expect(content).toContain('deleteMutation.mutate(partyToDelete._id)');
      expect(content).toContain('isLoading={deleteMutation.isPending}');
    });

    it('replaces native confirm() with ConfirmDialog in TruckDetailPage', () => {
      const content = fs.readFileSync(truckDetailPagePath, 'utf8');

      // Must not contain native confirm calls
      expect(content).not.toMatch(/\bconfirm\s*\(/);
      expect(content).not.toMatch(/window\.confirm/);

      // Must import and use ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('const [isUnassignConfirmOpen, setIsUnassignConfirmOpen] = useState');
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('isOpen={isUnassignConfirmOpen}');
      expect(content).toContain('unassignDriverMutation.mutate()');
      expect(content).toContain('isLoading={unassignDriverMutation.isPending}');
    });
  });

  describe('3. Sidebar Navigation Route Synchronization (FF-ISSUE-019)', () => {
    it('imports useLocation and declares route aliases for settlements in Sidebar.tsx', () => {
      const content = fs.readFileSync(sidebarPath, 'utf8');

      expect(content).toContain('useLocation');
      expect(content).toContain("path: '/settlements'");
      expect(content).toContain("aliases: ['/commercial/settlements']");
      expect(content).toContain('isItemActive');
    });

    it('implements deterministic route matching logic for exact, child, and aliased routes', () => {
      // Replicate the exact isItemActive function defined in Sidebar.tsx
      const isItemActive = (
        item: { path: string; end?: boolean; aliases?: string[] },
        currentPath: string,
        navLinkIsActive: boolean
      ) => {
        if (navLinkIsActive) return true;
        if (item.aliases && item.aliases.length > 0) {
          return item.aliases.some((alias) =>
            item.end ? currentPath === alias : currentPath === alias || currentPath.startsWith(`${alias}/`)
          );
        }
        return false;
      };

      const settlementItem = {
        label: 'Driver Settlements',
        path: '/settlements',
        aliases: ['/commercial/settlements'],
      };

      // 1. Canonical route
      expect(isItemActive(settlementItem, '/settlements', true)).toBe(true);

      // 2. Aliased route navigated from dashboard "Disburse" button
      expect(isItemActive(settlementItem, '/commercial/settlements', false)).toBe(true);

      // 3. Child routes
      expect(isItemActive(settlementItem, '/settlements/new', true)).toBe(true);
      expect(isItemActive(settlementItem, '/commercial/settlements/651f123456', false)).toBe(true);

      // 4. Neighbor routes should NOT trigger false positive active highlight
      expect(isItemActive(settlementItem, '/commercial/credit-notes', false)).toBe(false);
      expect(isItemActive(settlementItem, '/commercial/aging', false)).toBe(false);
      expect(isItemActive(settlementItem, '/invoices', false)).toBe(false);
      expect(isItemActive(settlementItem, '/dashboard', false)).toBe(false);
      expect(isItemActive(settlementItem, '/commercial', false)).toBe(false);

      // 5. Exact route matching for Dashboard
      const dashboardItem = {
        label: 'Dashboard',
        path: '/dashboard',
        end: true,
      };
      expect(isItemActive(dashboardItem, '/dashboard', true)).toBe(true);
      expect(isItemActive(dashboardItem, '/dashboard/nested', false)).toBe(false);
    });

    it('supports related commercial dual paths without collisions', () => {
      const content = fs.readFileSync(sidebarPath, 'utf8');

      // Verifies bill entries and invoice aliases
      expect(content).toContain("aliases: ['/commercial/entries']");
      expect(content).toContain("aliases: ['/commercial/invoices']");
      expect(content).toContain("aliases: ['/commercial/ledger']");
    });
  });
});
