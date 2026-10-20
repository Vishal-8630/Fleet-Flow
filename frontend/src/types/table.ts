/**
 * ============================================================================
 * FLEET FLOW — TABLE COLUMN VISIBILITY TYPES (types/table.ts)
 * ============================================================================
 * Defines configuration contracts for generic table column visibility,
 * supporting column toggling, user persistence, and locked required columns.
 * ============================================================================
 */

export interface ITableColumnConfig {
  /** Stable unique identifier for the column (e.g. 'cargo_weight', 'status') */
  id: string;

  /** Human-readable header label displayed in table headers and visibility menus */
  label: string;

  /** Default visibility when no saved preference exists for user and table */
  isDefaultVisible: boolean;

  /** If true, column cannot be hidden and remains locked in the visibility menu */
  isRequired?: boolean;

  /** Optional contextual description or tooltip */
  description?: string;
}

export interface ITableColumnVisibilityHook {
  visibleColumns: Set<string>;
  isVisible: (columnId: string) => boolean;
  toggleColumn: (columnId: string) => void;
  resetToDefaults: () => void;
  showAllColumns: () => void;
  totalColumnsCount: number;
  visibleCount: number;
}
