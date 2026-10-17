/**
 * ============================================================================
 * PHASE G5 TEST SUITE: BRANCH LISTING UI CONTAINMENT & ACTIONS
 * (phase7BatchG5ListingAndActions.test.ts)
 * ============================================================================
 * 
 * Verifies the requirements of Batch G Phase G5 (FF-ISSUE-052):
 * 1. Card Containment & Design System Tokens: Confirms BranchManagementPage.tsx
 *    wraps branch listings in structured .card, .card-header, .card-body,
 *    and .card-footer containers with standard badge tokens.
 * 2. Search & Status Filtering: Verifies multi-attribute search (name, code, city,
 *    state) and status segmentation (all, active, inactive).
 * 3. Edit Modal Integration: Confirms Modal.tsx component reuse, form pre-population,
 *    whitelisted update payloads, and PUT /api/company/branches/:id wiring.
 * 4. Head Office Action Guards: Confirms Head Office cannot be deactivated or deleted
 *    via UI action buttons, aligning with backend guards.
 * 5. Referential Integrity Deletion Handling: Confirms HTTP 409 CANNOT_DELETE_BRANCH_WITH_RECORDS
 *    is captured, clearly explained to the user, and offers "Deactivate Branch Instead".
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase G5: Branch Listing UI Containment and Actions (FF-ISSUE-052)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const branchManagementPagePath = path.join(rootDir, 'frontend/src/pages/settings/BranchManagementPage.tsx');
  const branchControllerPath = path.join(rootDir, 'backend/src/controllers/branchController.ts');
  const modalComponentPath = path.join(rootDir, 'frontend/src/components/common/Modal.tsx');

  const pageContent = fs.readFileSync(branchManagementPagePath, 'utf8');
  const controllerContent = fs.readFileSync(branchControllerPath, 'utf8');

  describe('1. Card Containment & Design System Tokens', () => {
    it('verifies Modal.tsx component is imported and used', () => {
      expect(pageContent).toContain("import { Modal } from '../../components/common/Modal'");
      expect(fs.existsSync(modalComponentPath)).toBe(true);
    });

    it('verifies structured .card, .card-header, .card-body, and .card-footer classes wrap branch listings', () => {
      expect(pageContent).toContain('className="card"');
      expect(pageContent).toContain('className="card-header"');
      expect(pageContent).toContain('className="card-body"');
      expect(pageContent).toContain('className="card-footer"');
    });

    it('verifies standard badge tokens are used for branch status and Head Office designation', () => {
      expect(pageContent).toContain('badge badge-success');
      expect(pageContent).toContain('badge badge-neutral');
      expect(pageContent).toContain('badge badge-info');
      expect(pageContent).toContain('HEAD OFFICE');
    });

    it('displays essential branch metadata (city, state, phone, gstin, prefixes) inside card body', () => {
      expect(pageContent).toContain('branch.city');
      expect(pageContent).toContain('branch.state');
      expect(pageContent).toContain('branch.phone');
      expect(pageContent).toContain('branch.gstin');
      expect(pageContent).toContain('branch.lr_prefix');
      expect(pageContent).toContain('branch.invoice_prefix');
    });
  });

  describe('2. Search & Status Filtering Logic', () => {
    it('verifies search input wrapper and state definition', () => {
      expect(pageContent).toContain('const [searchQuery, setSearchQuery] = useState');
      expect(pageContent).toContain('className="search-input-wrapper"');
      expect(pageContent).toContain('placeholder="Search by name, code, city, state..."');
    });

    it('verifies search logic inspects branch_name, branch_code, city, and state', () => {
      expect(pageContent).toContain('branch.branch_name?.toLowerCase().includes(q)');
      expect(pageContent).toContain('branch.branch_code?.toLowerCase().includes(q)');
      expect(pageContent).toContain('branch.city?.toLowerCase().includes(q)');
      expect(pageContent).toContain('branch.state?.toLowerCase().includes(q)');
    });

    it('verifies status filter tabs for All, Active, and Inactive with live counters', () => {
      expect(pageContent).toContain("const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')");
      expect(pageContent).toContain("statusFilter === 'active' && !branch.is_active");
      expect(pageContent).toContain("statusFilter === 'inactive' && branch.is_active");
      expect(pageContent).toContain('branches.filter((b) => b.is_active).length');
      expect(pageContent).toContain('branches.filter((b) => !b.is_active).length');
    });

    it('provides clear empty states for both zero branches and zero search matches', () => {
      expect(pageContent).toContain('No regional branches configured');
      expect(pageContent).toContain('No branches match your filters');
    });
  });

  describe('3. Action Triggers: Edit Modal Integration', () => {
    it('verifies explicit Edit button triggers handleOpenEdit on branch cards', () => {
      expect(pageContent).toContain('handleOpenEdit(branch)');
      expect(pageContent).toContain('Edit');
    });

    it('verifies Edit Modal opens with pre-populated branch attributes', () => {
      expect(pageContent).toContain('setEditingBranch(branch)');
      expect(pageContent).toContain('branch_name: branch.branch_name');
      expect(pageContent).toContain('branch_code: branch.branch_code');
      expect(pageContent).toContain('lr_prefix: branch.lr_prefix');
      expect(pageContent).toContain('invoice_prefix: branch.invoice_prefix');
      expect(pageContent).toContain('is_head_office: branch.is_head_office');
    });

    it('verifies Edit submission sends PUT request to /company/branches/:id with whitelisted fields', () => {
      expect(pageContent).toContain('api.put(`/company/branches/${editingBranch._id}`');
      expect(pageContent).toContain('handleSaveEdit');
      expect(pageContent).toContain('Branch updated successfully');
    });

    it('aligns with backend whitelisted fields in branchController.ts', () => {
      const allowedInBackend = [
        'branch_name',
        'branch_code',
        'gstin',
        'state',
        'city',
        'phone',
        'lr_prefix',
        'invoice_prefix',
        'is_head_office',
      ];
      for (const field of allowedInBackend) {
        expect(controllerContent).toContain(`'${field}'`);
      }
    });
  });

  describe('4. Head Office Protection & Activation Toggle', () => {
    it('disables deactivation in UI for Head Office branches', () => {
      expect(pageContent).toContain('disabled={branch.is_head_office && branch.is_active}');
      expect(pageContent).toContain('Head Office cannot be deactivated');
    });

    it('prevents unsetting Head Office checkbox directly without promoting another', () => {
      expect(pageContent).toContain('disabled={editingBranch.is_head_office}');
    });

    it('disables delete button in UI for Head Office branches', () => {
      expect(pageContent).toContain('disabled={branch.is_head_office}');
      expect(pageContent).toContain('Head Office cannot be deleted');
    });

    it('confirms backend branchController strictly blocks Head Office deactivation and deletion', () => {
      expect(controllerContent).toContain('Cannot deactivate the head office branch');
      expect(controllerContent).toContain('Cannot delete the head office branch');
      expect(controllerContent).toContain('Cannot remove head office status. Designate another branch as head office instead');
    });
  });

  describe('5. Referential Integrity Deletion & HTTP 409 Handling', () => {
    it('verifies guarded delete confirmation dialog with explanation of permanence', () => {
      expect(pageContent).toContain('setDeletingBranch(branch)');
      expect(pageContent).toContain('Are you sure you want to permanently delete branch');
      expect(pageContent).toContain('This action is permanent and cannot be undone');
    });

    it('verifies HTTP 409 CANNOT_DELETE_BRANCH_WITH_RECORDS error handling', () => {
      expect(pageContent).toContain('e?.response?.status === 409');
      expect(pageContent).toContain('Cannot Delete Branch With Records');
      expect(pageContent).toContain('To preserve historical and financial audit integrity');
    });

    it('offers "Deactivate Branch Instead" CTA when operational records prevent deletion', () => {
      expect(pageContent).toContain('Deactivate Branch Instead');
      expect(pageContent).toContain('handleToggleStatus(target)');
    });

    it('matches backend CANNOT_DELETE_BRANCH_WITH_RECORDS error code', () => {
      expect(controllerContent).toContain('CANNOT_DELETE_BRANCH_WITH_RECORDS');
      expect(controllerContent).toContain('Deactivate the branch instead to preserve historical integrity');
    });
  });
});
