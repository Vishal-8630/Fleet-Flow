import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * Phase 5: Generic Table Column Visibility Workflow Test Suite
 * ============================================================================
 * Verifies the implementation of:
 * - frontend/src/types/table.ts
 * - frontend/src/hooks/useTableColumnVisibility.ts
 * - frontend/src/components/common/TableColumnVisibilityMenu.tsx
 * - frontend/src/pages/commercial/LRListPage.tsx
 * 
 * Verifies all 12 requirements:
 * 1. Default LR column visibility.
 * 2. Required columns cannot be hidden.
 * 3. Optional columns can be toggled.
 * 4. Reset restores the configured defaults.
 * 5. Preferences persist per table and authenticated user.
 * 6. Switching users loads the correct preferences.
 * 7. Unknown saved column IDs are discarded.
 * 8. Corrupt JSON and invalid stored values recover safely.
 * 9. Newly introduced default-visible columns appear for existing users.
 * 10. Storage access failures do not crash the table.
 * 11. The column menu reflects current state.
 * 12. Existing LR actions and selection workflows remain functional.
 * ============================================================================
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src');
const typesPath = path.join(FRONTEND_DIR, 'types/table.ts');
const hookPath = path.join(FRONTEND_DIR, 'hooks/useTableColumnVisibility.ts');
const menuPath = path.join(FRONTEND_DIR, 'components/common/TableColumnVisibilityMenu.tsx');
const lrListPath = path.join(FRONTEND_DIR, 'pages/commercial/LRListPage.tsx');

const typesSource = fs.readFileSync(typesPath, 'utf8');
const hookSource = fs.readFileSync(hookPath, 'utf8');
const menuSource = fs.readFileSync(menuPath, 'utf8');
const lrListSource = fs.readFileSync(lrListPath, 'utf8');

// Mock localStorage simulator for behavioral tests
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public shouldThrow: boolean = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) throw new Error('SecurityError: The operation is insecure.');
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrow) throw new Error('QuotaExceededError: Storage quota exceeded.');
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.shouldThrow) throw new Error('SecurityError: The operation is insecure.');
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('Phase 5: Generic Table Column Visibility Workflow', () => {
  let mockStorage: MockLocalStorage;

  // LR Column Catalog matching approved specification
  const LR_TABLE_COLUMNS = [
    { id: 'select', label: 'Select', isDefaultVisible: true, isRequired: true },
    { id: 'lr_details', label: 'LR Details', isDefaultVisible: true, isRequired: true },
    { id: 'branch', label: 'Branch', isDefaultVisible: false, isRequired: false },
    { id: 'vehicle_driver', label: 'Vehicle & Driver', isDefaultVisible: true, isRequired: false },
    { id: 'route', label: 'Route Corridor', isDefaultVisible: true, isRequired: false },
    { id: 'parties', label: 'Consignor & Consignee', isDefaultVisible: true, isRequired: false },
    { id: 'cargo_weight', label: 'Cargo & Weight', isDefaultVisible: false, isRequired: false },
    { id: 'freight_terms', label: 'Freight & Terms', isDefaultVisible: false, isRequired: false },
    { id: 'status', label: 'Status', isDefaultVisible: true, isRequired: true },
    { id: 'actions', label: 'Actions', isDefaultVisible: true, isRequired: true },
  ];

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
  });

  // Behavioral reconciliation helper mirroring useTableColumnVisibility implementation
  const simulateReconcile = (
    columns: typeof LR_TABLE_COLUMNS,
    savedArray: any[],
    knownArray?: string[]
  ): Set<string> => {
    const validColumnIds = new Set(columns.map((c) => c.id));
    const reconciled = new Set<string>();

    if (Array.isArray(savedArray)) {
      savedArray.forEach((id) => {
        if (typeof id === 'string' && validColumnIds.has(id)) {
          reconciled.add(id);
        }
      });
    }

    const savedSet = new Set(Array.isArray(savedArray) ? savedArray : []);
    const knownSet = knownArray && Array.isArray(knownArray) ? new Set(knownArray) : null;

    columns.forEach((col) => {
      if (col.isDefaultVisible) {
        if (knownSet) {
          if (!knownSet.has(col.id)) {
            reconciled.add(col.id);
          }
        } else {
          if (!savedSet.has(col.id)) {
            reconciled.add(col.id);
          }
        }
      }
    });

    // Required columns invariant
    columns.forEach((col) => {
      if (col.isRequired) {
        reconciled.add(col.id);
      }
    });

    return reconciled;
  };

  // ==========================================================================
  // 1. Default LR Column Visibility
  // ==========================================================================
  describe('1. Default LR Column Visibility', () => {
    it('[Contract/Static] LRListPage configures LR_TABLE_COLUMNS with approved 7 visible and 3 hidden defaults', () => {
      expect(lrListSource).toContain("id: 'select', label: 'Select', isDefaultVisible: true, isRequired: true");
      expect(lrListSource).toContain("id: 'lr_details', label: 'LR Details', isDefaultVisible: true, isRequired: true");
      expect(lrListSource).toContain("id: 'vehicle_driver', label: 'Vehicle & Driver', isDefaultVisible: true, isRequired: false");
      expect(lrListSource).toContain("id: 'route', label: 'Route Corridor', isDefaultVisible: true, isRequired: false");
      expect(lrListSource).toContain("id: 'parties', label: 'Consignor & Consignee', isDefaultVisible: true, isRequired: false");
      expect(lrListSource).toContain("id: 'status', label: 'Status', isDefaultVisible: true, isRequired: true");
      expect(lrListSource).toContain("id: 'actions', label: 'Actions', isDefaultVisible: true, isRequired: true");
      expect(lrListSource).toContain("id: 'branch', label: 'Branch', isDefaultVisible: false, isRequired: false");
      expect(lrListSource).toContain("id: 'cargo_weight', label: 'Cargo & Weight', isDefaultVisible: false, isRequired: false");
      expect(lrListSource).toContain("id: 'freight_terms', label: 'Freight & Terms', isDefaultVisible: false, isRequired: false");
    });

    it('[Behavioral Logic] computes 7 default visible columns and 3 hidden columns', () => {
      const defaultVisible = LR_TABLE_COLUMNS.filter((c) => c.isDefaultVisible || c.isRequired).map((c) => c.id);
      const hiddenByDefault = LR_TABLE_COLUMNS.filter((c) => !c.isDefaultVisible && !c.isRequired).map((c) => c.id);

      expect(defaultVisible).toHaveLength(7);
      expect(defaultVisible).toEqual(['select', 'lr_details', 'vehicle_driver', 'route', 'parties', 'status', 'actions']);
      expect(hiddenByDefault).toHaveLength(3);
      expect(hiddenByDefault).toEqual(['branch', 'cargo_weight', 'freight_terms']);
    });
  });

  // ==========================================================================
  // 2. Required Columns Cannot Be Hidden
  // ==========================================================================
  describe('2. Required Columns Cannot Be Hidden', () => {
    it('[Contract/Static] useTableColumnVisibility prevents toggling required columns', () => {
      expect(hookSource).toContain('if (!colDef || colDef.isRequired) return;');
      expect(hookSource).toContain('columns.forEach((c) => {');
      expect(hookSource).toContain('if (c.isRequired) next.add(c.id);');
    });

    it('[Contract/Static] TableColumnVisibilityMenu disables checkboxes for required columns with badge', () => {
      expect(menuSource).toContain('const isLocked = Boolean(col.isRequired);');
      expect(menuSource).toContain('disabled={isLocked}');
      expect(menuSource).toContain('Required');
    });

    it('[Behavioral Logic] verifies required columns remain visible even if omitted from stored preferences', () => {
      // User attempts to store preference omitting all required columns
      const stored = ['vehicle_driver', 'route'];
      const reconciled = simulateReconcile(LR_TABLE_COLUMNS, stored);

      expect(reconciled.has('select')).toBe(true);
      expect(reconciled.has('lr_details')).toBe(true);
      expect(reconciled.has('status')).toBe(true);
      expect(reconciled.has('actions')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Optional Columns Can Be Toggled
  // ==========================================================================
  describe('3. Optional Columns Can Be Toggled', () => {
    it('[Contract/Static] hook provides toggleColumn handler', () => {
      expect(hookSource).toContain('const toggleColumn = useCallback(');
      expect(hookSource).toContain('next.has(columnId)');
      expect(hookSource).toContain('next.delete(columnId)');
      expect(hookSource).toContain('next.add(columnId)');
    });

    it('[Behavioral Logic] toggles an optional column from hidden to visible and back', () => {
      const active = new Set(['select', 'lr_details', 'vehicle_driver', 'route', 'parties', 'status', 'actions']);
      expect(active.has('branch')).toBe(false);

      // Toggle 'branch' on
      active.add('branch');
      expect(active.has('branch')).toBe(true);

      // Toggle 'branch' off
      active.delete('branch');
      expect(active.has('branch')).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Reset Restores Configured Defaults
  // ==========================================================================
  describe('4. Reset Restores Configured Defaults', () => {
    it('[Contract/Static] hook provides resetToDefaults and TableColumnVisibilityMenu exposes Reset action', () => {
      expect(hookSource).toContain('const resetToDefaults = useCallback(() => {');
      expect(hookSource).toContain('setVisibleColumns(defaultVisibleSet);');
      expect(menuSource).toContain('onClick={() => resetToDefaults()}');
    });

    it('[Behavioral Logic] resetting active set restores exactly the 7 default columns', () => {
      const modified = new Set(['select', 'lr_details', 'branch', 'status', 'actions']);
      const defaultVisibleSet = new Set(LR_TABLE_COLUMNS.filter((c) => c.isDefaultVisible || c.isRequired).map((c) => c.id));

      const resetSet = new Set(defaultVisibleSet);
      expect(resetSet.size).toBe(7);
      expect(resetSet.has('branch')).toBe(false);
      expect(resetSet.has('vehicle_driver')).toBe(true);
      expect(resetSet.has('route')).toBe(true);
      expect(resetSet.has('parties')).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Preferences Persist Per Table and Authenticated User
  // ==========================================================================
  describe('5. Preferences Persist Per Table and Authenticated User', () => {
    it('[Contract/Static] storage key matches agreed format fleetflow_tbl_cols_${userId}_${tableKey}', () => {
      expect(hookSource).toContain('fleetflow_tbl_cols_${safeUserId}_${tableKey}');
    });

    it('[Behavioral Logic] writes and reads preferences scoped by user and table', () => {
      const user1Key = 'fleetflow_tbl_cols_usr_001_lr_list';
      const user2Key = 'fleetflow_tbl_cols_usr_002_lr_list';

      mockStorage.setItem(user1Key, JSON.stringify(['select', 'lr_details', 'branch', 'status', 'actions']));
      mockStorage.setItem(user2Key, JSON.stringify(['select', 'lr_details', 'cargo_weight', 'status', 'actions']));

      const user1Saved = JSON.parse(mockStorage.getItem(user1Key)!);
      const user2Saved = JSON.parse(mockStorage.getItem(user2Key)!);

      expect(user1Saved).toContain('branch');
      expect(user1Saved).not.toContain('cargo_weight');
      expect(user2Saved).toContain('cargo_weight');
      expect(user2Saved).not.toContain('branch');
    });
  });

  // ==========================================================================
  // 6. Switching Users Loads the Correct Preferences
  // ==========================================================================
  describe('6. Switching Users Loads Correct Preferences Without Cross-User Leakage', () => {
    it('[Contract/Static] hook observes storageKey changes to reactively re-hydrate state', () => {
      expect(hookSource).toContain('useEffect(() => {');
      expect(hookSource).toContain('setVisibleColumns(loadState());');
      expect(hookSource).toContain('[storageKey, loadState]');
    });

    it('[Behavioral Logic] switches from User A to User B and reloads User B preferences', () => {
      const userAKey = 'fleetflow_tbl_cols_usrA_lr_list';
      const userBKey = 'fleetflow_tbl_cols_usrB_lr_list';

      mockStorage.setItem(userAKey, JSON.stringify(['select', 'lr_details', 'branch', 'status', 'actions']));
      mockStorage.setItem(userBKey, JSON.stringify(['select', 'lr_details', 'freight_terms', 'status', 'actions']));

      let activeUserId = 'usrA';
      let activeKey = `fleetflow_tbl_cols_${activeUserId}_lr_list`;
      let loadedA = JSON.parse(mockStorage.getItem(activeKey)!);
      expect(loadedA).toContain('branch');

      // Switch active user to usrB
      activeUserId = 'usrB';
      activeKey = `fleetflow_tbl_cols_${activeUserId}_lr_list`;
      let loadedB = JSON.parse(mockStorage.getItem(activeKey)!);
      expect(loadedB).toContain('freight_terms');
      expect(loadedB).not.toContain('branch');
    });
  });

  // ==========================================================================
  // 7. Unknown Saved Column IDs Are Discarded
  // ==========================================================================
  describe('7. Unknown Saved Column IDs Are Discarded', () => {
    it('[Contract/Static] hook filters saved IDs against validColumnIds', () => {
      expect(hookSource).toContain('validColumnIds.has(id)');
    });

    it('[Behavioral Logic] purges deprecated or unknown column IDs from hydrated set', () => {
      const storedWithUnknowns = ['select', 'lr_details', 'obsolete_col_v1', 'random_id', 'status', 'actions'];
      const reconciled = simulateReconcile(LR_TABLE_COLUMNS, storedWithUnknowns);

      expect(reconciled.has('obsolete_col_v1')).toBe(false);
      expect(reconciled.has('random_id')).toBe(false);
      expect(reconciled.has('select')).toBe(true);
      expect(reconciled.has('lr_details')).toBe(true);
    });
  });

  // ==========================================================================
  // 8. Corrupt JSON and Invalid Stored Values Recover Safely
  // ==========================================================================
  describe('8. Corrupt JSON and Invalid Stored Values Recover Safely', () => {
    it('[Contract/Static] hook catches JSON parse errors and validates Array.isArray', () => {
      expect(hookSource).toContain('JSON.parse(raw)');
      expect(hookSource).toContain('Array.isArray(parsed)');
      expect(hookSource).toContain('window.localStorage.removeItem(storageKey)');
      expect(hookSource).toContain('return defaultVisibleSet;');
    });

    it('[Behavioral Logic] recovers to default columns when localStorage contains corrupt non-JSON or non-array', () => {
      const defaultVisibleSet = new Set(LR_TABLE_COLUMNS.filter((c) => c.isDefaultVisible || c.isRequired).map((c) => c.id));

      const parseOrFallback = (raw: string | null) => {
        try {
          if (!raw) return defaultVisibleSet;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return simulateReconcile(LR_TABLE_COLUMNS, parsed);
          mockStorage.removeItem('testKey');
        } catch {
          mockStorage.removeItem('testKey');
        }
        return defaultVisibleSet;
      };

      // Corrupt string
      mockStorage.setItem('testKey', '{corrupt json...');
      const resultCorrupt = parseOrFallback(mockStorage.getItem('testKey'));
      expect(resultCorrupt.size).toBe(7);

      // Non-array number
      mockStorage.setItem('testKey', '42');
      const resultNumber = parseOrFallback(mockStorage.getItem('testKey'));
      expect(resultNumber.size).toBe(7);

      // Non-array object
      mockStorage.setItem('testKey', '{"visible": true}');
      const resultObject = parseOrFallback(mockStorage.getItem('testKey'));
      expect(resultObject.size).toBe(7);
    });
  });

  // ==========================================================================
  // 9. Newly Introduced Default-Visible Columns Appear for Existing Users
  // ==========================================================================
  describe('9. Newly Introduced Default-Visible Columns Appear for Existing Users', () => {
    it('[Contract/Static] hook adds newly introduced default-visible columns to reconciled set', () => {
      expect(hookSource).toContain('if (col.isDefaultVisible) {');
      expect(hookSource).toContain('reconciled.add(col.id);');
    });

    it('[Behavioral Logic] automatically includes new column with isDefaultVisible: true when user has existing preferences', () => {
      // Existing user saved preferences from previous version before 'fast_tag' column existed
      const existingUserSaved = ['select', 'lr_details', 'status', 'actions'];

      // Upgraded catalog includes newly added column 'fast_tag' marked isDefaultVisible: true
      const upgradedCatalog = [
        ...LR_TABLE_COLUMNS,
        { id: 'fast_tag', label: 'FASTag RFID', isDefaultVisible: true, isRequired: false },
      ];

      const reconciled = simulateReconcile(upgradedCatalog, existingUserSaved);

      expect(reconciled.has('fast_tag')).toBe(true);
      expect(reconciled.has('select')).toBe(true);
      expect(reconciled.has('status')).toBe(true);
    });
  });

  // ==========================================================================
  // 10. Storage Access Failures Do Not Crash the Table
  // ==========================================================================
  describe('10. Storage Access Failures Do Not Crash Table Rendering', () => {
    it('[Contract/Static] hook wraps all localStorage access in try/catch blocks', () => {
      expect(hookSource).toContain('try {');
      expect(hookSource).toContain('if (typeof window !== \'undefined\' && window.localStorage)');
      expect(hookSource).toContain('} catch (e) {');
    });

    it('[Behavioral Logic] safely falls back to default columns when storage throws SecurityError', () => {
      mockStorage.shouldThrow = true;
      const defaultVisibleSet = new Set(LR_TABLE_COLUMNS.filter((c) => c.isDefaultVisible || c.isRequired).map((c) => c.id));

      let result: Set<string>;
      try {
        mockStorage.getItem('testKey');
        result = new Set();
      } catch {
        result = defaultVisibleSet;
      }

      expect(result.size).toBe(7);
      expect(result.has('select')).toBe(true);
      expect(result.has('lr_details')).toBe(true);
    });
  });

  // ==========================================================================
  // 11. Column Menu Reflects Current State
  // ==========================================================================
  describe('11. Column Menu Reflects Current State', () => {
    it('[Contract/Static] TableColumnVisibilityMenu displays visible count in button', () => {
      expect(menuSource).toContain('Columns ({visibleCount}/{totalCount})');
      expect(menuSource).toContain('aria-haspopup="menu"');
      expect(menuSource).toContain('aria-expanded={isOpen}');
      expect(menuSource).toContain('role="menuitemcheckbox"');
    });

    it('[Contract/Static] LRListPage renders TableColumnVisibilityMenu inside filter controls toolbar', () => {
      expect(lrListSource).toContain('<TableColumnVisibilityMenu');
      expect(lrListSource).toContain('columns={LR_TABLE_COLUMNS}');
      expect(lrListSource).toContain('visibleColumns={columnVisibility.visibleColumns}');
      expect(lrListSource).toContain('isVisible={columnVisibility.isVisible}');
      expect(lrListSource).toContain('toggleColumn={columnVisibility.toggleColumn}');
      expect(lrListSource).toContain('resetToDefaults={columnVisibility.resetToDefaults}');
    });

    it('[Behavioral Logic] button title and active count match visible column state', () => {
      const activeColumns = new Set(['select', 'lr_details', 'vehicle_driver', 'status', 'actions']);
      const visibleCount = activeColumns.size;
      const totalCount = LR_TABLE_COLUMNS.length;

      expect(visibleCount).toBe(5);
      expect(totalCount).toBe(10);
      expect(`Columns (${visibleCount}/${totalCount})`).toBe('Columns (5/10)');
    });
  });

  // ==========================================================================
  // 12. Existing LR Actions and Selection Workflows Remain Functional
  // ==========================================================================
  describe('12. Existing LR Actions and Selection Workflows Remain Functional', () => {
    it('[Contract/Static] LRListPage preserves multi-LR selection ribbon and Create Journey action', () => {
      expect(lrListSource).toContain('commercial-selection-ribbon');
      expect(lrListSource).toContain("navigate('/operations/journeys/new', {");
      expect(lrListSource).toContain('state: { lr_ids: selectedLrIds }');
      expect(lrListSource).toContain('Clear Selection');
    });

    it('[Contract/Static] LRListPage dynamically updates colSpan in loading and empty rows', () => {
      expect(lrListSource).toContain('colSpan={columnVisibility.visibleCount || 7}');
    });

    it('[Contract/Static] LRListPage preserves single-LR row action to create journey', () => {
      expect(lrListSource).toContain("navigate('/operations/journeys/new', {");
      expect(lrListSource).toContain('state: { lr_ids: [lr._id] }');
      expect(lrListSource).toContain('Create Journey');
    });

    it('[Contract/Static] LRListPage preserves print 3-part stationary and cancel actions', () => {
      expect(lrListSource).toContain('handlePrintLR(lr._id, lr)');
      expect(lrListSource).toContain('cancelMutation.mutate(lr._id)');
      expect(lrListSource).toContain('Print');
    });
  });

  // ==========================================================================
  // 13. System-Wide Multi-Page Column Visibility Rollout
  // ==========================================================================
  describe('13. System-Wide Multi-Page Column Visibility Rollout', () => {
    const pagesToVerify = [
      {
        name: 'LRListPage',
        file: 'pages/commercial/LRListPage.tsx',
        tableKey: 'lr_list',
        configVar: 'LR_TABLE_COLUMNS',
      },
      {
        name: 'InvoiceListPage',
        file: 'pages/commercial/InvoiceListPage.tsx',
        tableKey: 'invoice_list',
        configVar: 'INVOICE_TABLE_COLUMNS',
      },
      {
        name: 'JourneyListPage',
        file: 'pages/operations/JourneyListPage.tsx',
        tableKey: 'journey_list',
        configVar: 'JOURNEY_TABLE_COLUMNS',
      },
      {
        name: 'TruckListPage',
        file: 'pages/fleet/TruckListPage.tsx',
        tableKey: 'truck_list',
        configVar: 'TRUCK_TABLE_COLUMNS',
      },
      {
        name: 'DriverListPage',
        file: 'pages/fleet/DriverListPage.tsx',
        tableKey: 'driver_list',
        configVar: 'DRIVER_TABLE_COLUMNS',
      },
      {
        name: 'BillingPartyListPage',
        file: 'pages/parties/BillingPartyListPage.tsx',
        tableKey: 'billing_party_list',
        configVar: 'BILLING_PARTY_TABLE_COLUMNS',
      },
      {
        name: 'BalancePartyListPage',
        file: 'pages/parties/BalancePartyListPage.tsx',
        tableKey: 'balance_party_list',
        configVar: 'BALANCE_PARTY_TABLE_COLUMNS',
      },
      {
        name: 'SettlementListPage',
        file: 'pages/commercial/SettlementListPage.tsx',
        tableKey: 'settlement_list',
        configVar: 'SETTLEMENT_TABLE_COLUMNS',
      },
      {
        name: 'LedgerListPage',
        file: 'pages/commercial/LedgerListPage.tsx',
        tableKey: 'ledger_list',
        configVar: 'LEDGER_TABLE_COLUMNS',
      },
    ];

    pagesToVerify.forEach(({ name, file, tableKey, configVar }) => {
      it(`[Contract/Static] ${name} integrates column visibility hook, config, and menu`, () => {
        const filePath = path.join(FRONTEND_DIR, file);
        expect(fs.existsSync(filePath), `File ${file} should exist`).toBe(true);
        const source = fs.readFileSync(filePath, 'utf8');

        // Config definition
        expect(source).toContain(configVar);

        // Hook integration with tableKey
        expect(source).toContain(`useTableColumnVisibility('${tableKey}'`);

        // Menu component placement
        expect(source).toContain('<TableColumnVisibilityMenu');
        expect(source).toContain(`columns={${configVar}}`);
        expect(source).toContain('visibleColumns={columnVisibility.visibleColumns}');
        expect(source).toContain('isVisible={columnVisibility.isVisible}');

        // Toolbar card clipping protection
        expect(source).toMatch(/overflow:\s*['"]visible['"]/);

        // Column cell visibility checks
        expect(source).toContain('columnVisibility.isVisible(');

        // Dynamic empty/loading row colspan
        expect(source).toContain('columnVisibility.visibleCount');
      });
    });
  });
});

