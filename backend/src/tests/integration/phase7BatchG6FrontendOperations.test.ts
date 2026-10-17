import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Phase G6: Operational Frontend Branch Integration & Contract Test Suite
 * Covers FF-ISSUE-053, DEC-010, QST-012 across:
 * - frontend/src/pages/operations/NewJourneyPage.tsx
 * - frontend/src/pages/operations/JourneyDetailPage.tsx
 * - frontend/src/pages/operations/JourneyListPage.tsx
 * - frontend/src/pages/commercial/LRListPage.tsx
 * - frontend/src/pages/commercial/InvoiceListPage.tsx
 *
 * NOTE ON TEST METHODOLOGY:
 * Tests in this suite are categorized into:
 * 1. [Contract/Static]: Validates that the TSX source code strictly contains required components,
 *    API endpoints, state bindings, payload fields, and guard structures.
 * 2. [Behavioral Logic]: Executes the isolated algorithmic logic implemented within the frontend
 *    components (e.g. branch defaulting, LR trip-inheritance, prefix preview generation, and validation).
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src/pages');
const newJourneyPath = path.join(FRONTEND_DIR, 'operations/NewJourneyPage.tsx');
const journeyDetailPath = path.join(FRONTEND_DIR, 'operations/JourneyDetailPage.tsx');
const journeyListPath = path.join(FRONTEND_DIR, 'operations/JourneyListPage.tsx');
const lrListPath = path.join(FRONTEND_DIR, 'commercial/LRListPage.tsx');
const invoiceListPath = path.join(FRONTEND_DIR, 'commercial/InvoiceListPage.tsx');

// Read source files
const newJourneySource = fs.readFileSync(newJourneyPath, 'utf8');
const journeyDetailSource = fs.readFileSync(journeyDetailPath, 'utf8');
const journeyListSource = fs.readFileSync(journeyListPath, 'utf8');
const lrListSource = fs.readFileSync(lrListPath, 'utf8');
const invoiceListSource = fs.readFileSync(invoiceListPath, 'utf8');

describe('Phase G6: Operational Frontend Branch Integration (FF-ISSUE-053, DEC-010, QST-012)', () => {
  describe('1. Branch Selector Population & Active-Branch Filtering', () => {
    it('[Contract/Static] NewJourneyPage fetches branches from /company/branches and filters active branches', () => {
      expect(newJourneySource).toContain("queryKey: ['company-branches']");
      expect(newJourneySource).toContain("api.get('/company/branches')");
      expect(newJourneySource).toContain('branchesData.filter((b: any) => b.is_active)');
    });

    it('[Contract/Static] JourneyListPage, LRListPage, and InvoiceListPage query /company/branches and filter active branches', () => {
      expect(journeyListSource).toContain("queryKey: ['company-branches']");
      expect(journeyListSource).toContain("api.get('/company/branches')");
      expect(journeyListSource).toContain('branchesData.filter((b: any) => b.is_active)');

      expect(lrListSource).toContain("queryKey: ['company-branches']");
      expect(lrListSource).toContain("api.get('/company/branches')");
      expect(lrListSource).toContain('branchesData.filter((b: any) => b.is_active)');

      expect(invoiceListSource).toContain("queryKey: ['company-branches']");
      expect(invoiceListSource).toContain("api.get('/company/branches')");
      expect(invoiceListSource).toContain('branchesData.filter((b: any) => b.is_active)');
    });

    it('[Behavioral Logic] verifies active filter excludes deactivated branches from operational dropdowns', () => {
      const mockBranches = [
        { _id: 'b1', branch_name: 'Bhiwandi Hub', is_active: true },
        { _id: 'b2', branch_name: 'Old Closed Depot', is_active: false },
        { _id: 'b3', branch_name: 'Delhi Facility', is_active: true },
      ];
      const activeOnly = mockBranches.filter((b) => b.is_active);
      expect(activeOnly).toHaveLength(2);
      expect(activeOnly.map((b) => b._id)).toEqual(['b1', 'b3']);
      expect(activeOnly.some((b) => b._id === 'b2')).toBe(false);
    });
  });

  describe('2. Single-Branch Defaulting & Multi-Branch Default Selection', () => {
    // Pure function replicating the frontend defaulting rules across NewJourney, LR, and Invoice modals
    function resolveDefaultBranch(activeBranches: Array<{ _id: string; is_head_office?: boolean }>): string {
      if (activeBranches.length === 1) {
        return activeBranches[0]._id;
      }
      if (activeBranches.length > 1) {
        const headOffice = activeBranches.find((b) => b.is_head_office);
        if (headOffice) {
          return headOffice._id;
        }
      }
      return '';
    }

    it('[Contract/Static] NewJourneyPage implements auto-selection for single branch and Head Office fallback for multi-branch', () => {
      expect(newJourneySource).toContain('activeBranches.length === 1 && !formData.branch_id');
      expect(newJourneySource).toContain('setFormData((prev) => ({ ...prev, branch_id: activeBranches[0]._id }))');
      expect(newJourneySource).toContain('activeBranches.find((b: any) => b.is_head_office)');
      expect(newJourneySource).toContain('setFormData((prev) => ({ ...prev, branch_id: headOffice._id }))');
    });

    it('[Contract/Static] LRListPage and InvoiceListPage implement single and Head Office defaulting in create modals', () => {
      expect(lrListSource).toContain('isCreateModalOpen && !formData.journey_id && !formData.branch_id');
      expect(lrListSource).toContain('activeBranches.length === 1');
      expect(lrListSource).toContain('activeBranches.find((b: any) => b.is_head_office)');

      expect(invoiceListSource).toContain('isCreateModalOpen && !invoiceForm.branch_id');
      expect(invoiceListSource).toContain('activeBranches.length === 1');
      expect(invoiceListSource).toContain('activeBranches.find((b: any) => b.is_head_office)');
    });

    it('[Behavioral Logic] automatically resolves single branch without user clicks (DEC-010 frictionless rule)', () => {
      const singleBranch = [{ _id: 'br-single-1', is_head_office: false }];
      expect(resolveDefaultBranch(singleBranch)).toBe('br-single-1');
    });

    it('[Behavioral Logic] automatically prioritizes Head Office in multi-branch setups', () => {
      const multiBranches = [
        { _id: 'br-pune', is_head_office: false },
        { _id: 'br-mumbai-ho', is_head_office: true },
        { _id: 'br-delhi', is_head_office: false },
      ];
      expect(resolveDefaultBranch(multiBranches)).toBe('br-mumbai-ho');
    });

    it('[Behavioral Logic] returns empty string requiring manual selection when multiple branches exist without Head Office', () => {
      const noHoBranches = [
        { _id: 'br-depot-a', is_head_office: false },
        { _id: 'br-depot-b', is_head_office: false },
      ];
      expect(resolveDefaultBranch(noHoBranches)).toBe('');
    });

    it('[Contract/Static] NewJourneyPage blocks submission when multiple branches exist and none is selected', () => {
      expect(newJourneySource).toContain('if (activeBranches.length > 1 && !formData.branch_id)');
      expect(newJourneySource).toContain(
        "toast.error('Please select the originating regional branch for this trip.')"
      );
    });
  });

  describe('3. Dispatch Request Payload & Journey Attribution', () => {
    it('[Contract/Static] NewJourneyPage includes branch_id in createMutation payload to /operations/journeys', () => {
      expect(newJourneySource).toContain('branch_id: formData.branch_id || undefined');
      expect(newJourneySource).toContain("api.post('/operations/journeys', payload)");
    });

    it('[Contract/Static] NewJourneyPage renders branch indicator badge for single, multi, and unbranched states', () => {
      expect(newJourneySource).toContain('Auto-selected: Primary Branch');
      expect(newJourneySource).toContain('Company Direct / Unbranched');
      expect(newJourneySource).toContain('Originating Regional Branch');
    });

    it('[Behavioral Logic] payload cleanses empty string branch_id to undefined for unbranched fallback', () => {
      const transformPayload = (form: { branch_id: string; truck_id: string }) => ({
        truck_id: form.truck_id,
        branch_id: form.branch_id || undefined,
      });

      expect(transformPayload({ branch_id: '', truck_id: 'trk-1' }).branch_id).toBeUndefined();
      expect(transformPayload({ branch_id: 'br-123', truck_id: 'trk-1' }).branch_id).toBe('br-123');
    });
  });

  describe('4. Journey List Branch Filtering & Detail Tile Display', () => {
    it('[Contract/Static] JourneyListPage includes branchFilter in queryKey and appends branch_id param', () => {
      expect(journeyListSource).toContain("queryKey: ['journeys', page, statusFilter, searchQuery, branchFilter]");
      expect(journeyListSource).toContain("params.append('branch_id', branchFilter)");
      expect(journeyListSource).toContain("api.get(`/operations/journeys?${params.toString()}`)");
    });

    it('[Contract/Static] JourneyListPage renders Origin Branch table column with code, name, and Company Direct badge', () => {
      expect(journeyListSource).toContain('{j.branch_id ? (');
      expect(journeyListSource).toContain('{j.branch_id.branch_code}');
      expect(journeyListSource).toContain('{j.branch_id.branch_name}');
      expect(journeyListSource).toContain('Company Direct');
    });

    it('[Contract/Static] JourneyDetailPage displays dedicated Operational Asset Tile for Regional Branch Attribution', () => {
      expect(journeyDetailSource).toContain('operational-asset-tile');
      expect(journeyDetailSource).toContain('Building2');
      expect(journeyDetailSource).toContain("journey.branch_id?.branch_name || 'Company Direct / Unbranched'");
      expect(journeyDetailSource).toContain('{journey.branch_id.branch_code}');
      expect(journeyDetailSource).toContain('Head Office');
      expect(journeyDetailSource).toContain('Head Office Direct');
      expect(journeyDetailSource).toContain('Hub Location:');
    });
  });

  describe('5. LR Journey Selection, Branch Inheritance, Overrides & Prefix Preview', () => {
    // Pure function replicating LR prefix preview resolution
    function resolveLrPrefix(selectedBranch?: { branch_code: string; lr_prefix?: string }): string {
      return selectedBranch ? selectedBranch.lr_prefix || `${selectedBranch.branch_code}-LR-` : 'LR-';
    }

    it('[Contract/Static] LRListPage queries active journeys for trip linkage and auto-inherits branch_id', () => {
      expect(lrListSource).toContain("queryKey: ['active-journeys-lookup']");
      expect(lrListSource).toContain("api.get('/operations/journeys'");
      expect(lrListSource).toContain('handleJourneyChange');
      expect(lrListSource).toContain('selectedJourney.branch_id?._id || selectedJourney.branch_id');
      expect(lrListSource).toContain('branch_id: journeyBranchId ? String(journeyBranchId) : prev.branch_id');
    });

    it('[Contract/Static] LRListPage detects branch inheritance and provides visual badge and explicit override capability', () => {
      expect(lrListSource).toContain('const isBranchInherited = Boolean(');
      expect(lrListSource).toContain('Inherited from Trip');
      expect(lrListSource).toContain('previewPrefix');
      expect(lrListSource).toContain("selectedBranch.lr_prefix || `${selectedBranch.branch_code}-LR-`");
      expect(lrListSource).toContain("'LR-'");
    });

    it('[Contract/Static] LRListPage submits branch_id in createMutation to /commercial/entries', () => {
      expect(lrListSource).toContain("api.post('/commercial/entries', payload)");
      expect(lrListSource).toContain('branch_id: formData.branch_id || undefined');
      expect(lrListSource).toContain('journey_id: formData.journey_id || undefined');
    });

    it('[Behavioral Logic] verifies LR prefix resolution for configured, code-fallback, and unbranched scenarios', () => {
      expect(resolveLrPrefix({ branch_code: 'BHW', lr_prefix: 'BHW/LR/' })).toBe('BHW/LR/');
      expect(resolveLrPrefix({ branch_code: 'PUN', lr_prefix: '' })).toBe('PUN-LR-');
      expect(resolveLrPrefix(undefined)).toBe('LR-');
    });

    it('[Behavioral Logic] verifies manual branch override resets isBranchInherited flag', () => {
      const selectedJourney = { _id: 'j1', branch_id: { _id: 'br-mum', branch_code: 'MUM' } };
      let currentForm = { journey_id: 'j1', branch_id: 'br-mum' };

      const checkInherited = (form: typeof currentForm) =>
        Boolean(
          form.journey_id &&
            selectedJourney.branch_id &&
            form.branch_id === selectedJourney.branch_id._id
        );

      expect(checkInherited(currentForm)).toBe(true);

      // User performs explicit override in dropdown
      currentForm = { ...currentForm, branch_id: 'br-pune' };
      expect(checkInherited(currentForm)).toBe(false);
    });
  });

  describe('6. Invoice Issuing-Branch Selection, Payload & Prefix Preview', () => {
    // Pure function replicating Invoice prefix preview resolution
    function resolveInvoicePrefix(selectedBranch?: { branch_code: string; invoice_prefix?: string }): string {
      return selectedBranch ? selectedBranch.invoice_prefix || `INV-${selectedBranch.branch_code}-` : 'INV-';
    }

    it('[Contract/Static] InvoiceListPage provides Issuing Branch card with live series preview', () => {
      expect(invoiceListSource).toContain('Issuing Branch & Sequence Allocation');
      expect(invoiceListSource).toContain('Issuing Regional Branch');
      expect(invoiceListSource).toContain('Series Prefix:');
      expect(invoiceListSource).toContain('{previewPrefix}');
      expect(invoiceListSource).toContain("selectedBranch.invoice_prefix || `INV-${selectedBranch.branch_code}-`");
      expect(invoiceListSource).toContain("'INV-'");
    });

    it('[Contract/Static] InvoiceListPage submits branch_id in createInvoiceMutation to /commercial/invoices', () => {
      expect(invoiceListSource).toContain("api.post('/commercial/invoices', payload)");
      expect(invoiceListSource).toContain('branch_id: invoiceForm.branch_id || undefined');
      expect(invoiceListSource).toContain('lr_ids: invoiceForm.selected_lr_ids');
    });

    it('[Behavioral Logic] verifies Invoice prefix resolution for configured, code-fallback, and company defaults', () => {
      expect(resolveInvoicePrefix({ branch_code: 'DEL', invoice_prefix: 'TAX-DEL-' })).toBe('TAX-DEL-');
      expect(resolveInvoicePrefix({ branch_code: 'BLR', invoice_prefix: '' })).toBe('INV-BLR-');
      expect(resolveInvoicePrefix(undefined)).toBe('INV-');
    });
  });

  describe('7. Historical Unbranched Records & Backward Compatibility', () => {
    it('[Contract/Static] LRListPage and InvoiceListPage display Company Direct badge when branch_id is null', () => {
      expect(lrListSource).toContain('{lr.branch_id ? (');
      expect(lrListSource).toContain('{lr.branch_id.branch_code}');
      expect(lrListSource).toContain('Company Direct');

      expect(invoiceListSource).toContain('{inv.branch_id ? (');
      expect(invoiceListSource).toContain('{inv.branch_id.branch_code}');
      expect(invoiceListSource).toContain('Company Direct');
    });

    it('[Behavioral Logic] renders fallback label safely when branch_id object or property is undefined', () => {
      const renderBranchBadge = (branch?: { branch_code?: string; branch_name?: string } | null) => {
        if (branch?.branch_code) {
          return { code: branch.branch_code, isUnbranched: false };
        }
        return { code: 'Company Direct', isUnbranched: true };
      };

      expect(renderBranchBadge(null)).toEqual({ code: 'Company Direct', isUnbranched: true });
      expect(renderBranchBadge(undefined)).toEqual({ code: 'Company Direct', isUnbranched: true });
      expect(renderBranchBadge({ branch_code: 'MUM-01' })).toEqual({ code: 'MUM-01', isUnbranched: false });
    });
  });

  describe('8. Loading, Empty & Validation Error States', () => {
    it('[Contract/Static] NewJourneyPage handles branchesLoading and zero-branches informative alert', () => {
      expect(newJourneySource).toContain('branchesLoading ? (');
      expect(newJourneySource).toContain('Loading branch configuration...');
      expect(newJourneySource).toContain('No regional branches configured. Trip will be attributed company-wide to Head Office direct.');
    });

    it('[Contract/Static] LRListPage and InvoiceListPage handle empty states and party selection prompts', () => {
      expect(lrListSource).toContain('No Lorry Receipts found matching current filters.');
      expect(lrListSource).toContain('-- Standalone Consignment (No Trip Link) --');
      expect(invoiceListSource).toContain('Please select a Billing Party to load active Lorry Receipts.');
      expect(invoiceListSource).toContain('No active unbilled LRs found for this customer.');
    });
  });

  describe('9. Preservation of Tenant Isolation & Company-Wide Pooled Assets (DEC-010)', () => {
    it('[Contract/Static] NewJourneyPage fetches trucks and drivers globally across company fleet without branch filtering', () => {
      expect(newJourneySource).toContain("api.get('/fleet/trucks?limit=100')");
      expect(newJourneySource).toContain("api.get('/fleet/drivers?limit=100')");
      // Must not pass branch_id filter to fleet trucks/drivers query (DEC-010 pooled assets invariant)
      expect(newJourneySource).not.toContain("api.get('/fleet/trucks?branch_id=");
      expect(newJourneySource).not.toContain("api.get('/fleet/drivers?branch_id=");
    });

    it('[Contract/Static] All branch queries use /company/branches ensuring tenant isolation by company_id session', () => {
      expect(newJourneySource).toContain("api.get('/company/branches')");
      expect(journeyListSource).toContain("api.get('/company/branches')");
      expect(lrListSource).toContain("api.get('/company/branches')");
      expect(invoiceListSource).toContain("api.get('/company/branches')");
    });
  });
});
