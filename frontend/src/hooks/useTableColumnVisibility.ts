import { useState, useEffect, useCallback, useMemo } from 'react';
import { ITableColumnConfig, ITableColumnVisibilityHook } from '../types/table';

/**
 * ============================================================================
 * FLEET FLOW — REUSABLE TABLE COLUMN VISIBILITY HOOK
 * ============================================================================
 * Manages persisted column visibility across Fleet Flow tables with:
 * - Scoped isolation per tableKey and authenticated userId
 * - Automatic discarding of unknown/deprecated column IDs
 * - Safe recovery from malformed or non-array JSON in localStorage
 * - Automatic inclusion of newly introduced default-visible columns
 * - Strict retention of required columns (cannot be toggled off)
 * - Safe handling of storage access failures (private mode / quota exceeded)
 * - Reactive re-hydration upon switching authenticated user accounts
 * ============================================================================
 */

export function useTableColumnVisibility(
  tableKey: string,
  columns: ITableColumnConfig[],
  userId?: string
): ITableColumnVisibilityHook {
  // Ensure safe, non-empty user identifier
  const safeUserId = (userId && typeof userId === 'string' && userId.trim()) ? userId.trim() : 'guest';

  // Persistence key isolated by authenticated user ID and table key
  const storageKey = useMemo(
    () => `fleetflow_tbl_cols_${safeUserId}_${tableKey}`,
    [safeUserId, tableKey]
  );

  // Companion key tracking columns known when user explicitly saved/toggled preferences
  const knownStorageKey = useMemo(
    () => `${storageKey}__known`,
    [storageKey]
  );

  const columnMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const validColumnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  // Compute default visible column set
  const defaultVisibleSet = useMemo(() => {
    return new Set(
      columns
        .filter((col) => col.isDefaultVisible || col.isRequired)
        .map((col) => col.id)
    );
  }, [columns]);

  // Reconcile saved column IDs with current column catalog
  const reconcileSavedColumns = useCallback(
    (savedArray: string[], knownArray?: string[]): Set<string> => {
      const reconciled = new Set<string>();

      // 1. Unknown Column ID Purging: Keep saved columns that still exist in current catalog
      savedArray.forEach((id) => {
        if (typeof id === 'string' && validColumnIds.has(id)) {
          reconciled.add(id);
        }
      });

      // 2. Newly Introduced Columns:
      // If a column exists with isDefaultVisible: true and was never known when the user
      // saved preferences (or no known metadata exists), include it automatically.
      const savedSet = new Set(savedArray);
      const knownSet = knownArray && Array.isArray(knownArray) ? new Set(knownArray) : null;

      columns.forEach((col) => {
        if (col.isDefaultVisible) {
          if (knownSet) {
            // If known catalog exists, column is newly introduced if not in knownSet
            if (!knownSet.has(col.id)) {
              reconciled.add(col.id);
            }
          } else {
            // Fallback for raw legacy saves: if not in savedSet, include default visible
            if (!savedSet.has(col.id)) {
              reconciled.add(col.id);
            }
          }
        }
      });

      // 3. Strict Required Columns Invariant: Required columns can NEVER be omitted
      columns.forEach((col) => {
        if (col.isRequired) {
          reconciled.add(col.id);
        }
      });

      return reconciled;
    },
    [columns, validColumnIds]
  );

  // Load and sanitize initial state safely from localStorage
  const loadState = useCallback((): Set<string> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            let knownParsed: string[] | undefined;
            const rawKnown = window.localStorage.getItem(knownStorageKey);
            if (rawKnown) {
              try {
                const pk = JSON.parse(rawKnown);
                if (Array.isArray(pk)) knownParsed = pk;
              } catch {}
            }
            return reconcileSavedColumns(parsed, knownParsed);
          } else {
            // Corrupt non-array data: discard and purge
            try {
              window.localStorage.removeItem(storageKey);
              window.localStorage.removeItem(knownStorageKey);
            } catch {}
          }
        }
      }
    } catch (e) {
      // Storage access failures or corrupt JSON: fall back safely to defaults
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(storageKey);
          window.localStorage.removeItem(knownStorageKey);
        }
      } catch {}
    }

    return defaultVisibleSet;
  }, [storageKey, knownStorageKey, defaultVisibleSet, reconcileSavedColumns]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadState);

  // Account Switching & Dynamic Key Isolation:
  // Re-hydrate preferences reactively whenever userId or tableKey changes
  useEffect(() => {
    setVisibleColumns(loadState());
  }, [storageKey, loadState]);

  // Safe persistence helper
  const persistState = useCallback(
    (newSet: Set<string>) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
          window.localStorage.setItem(knownStorageKey, JSON.stringify(columns.map((c) => c.id)));
        }
      } catch (e) {
        // Storage access failure (e.g. private mode, quota exceeded) - non-fatal
      }
    },
    [storageKey, knownStorageKey, columns]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      const colDef = columnMap.get(columnId);
      if (!colDef || colDef.isRequired) return; // Invariant: Cannot toggle required columns

      setVisibleColumns((prev) => {
        const next = new Set(prev);
        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }
        // Invariant: Always retain required columns
        columns.forEach((c) => {
          if (c.isRequired) next.add(c.id);
        });
        persistState(next);
        return next;
      });
    },
    [columnMap, columns, persistState]
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumns(defaultVisibleSet);
    persistState(defaultVisibleSet);
  }, [defaultVisibleSet, persistState]);

  const showAllColumns = useCallback(() => {
    const allSet = new Set(columns.map((c) => c.id));
    setVisibleColumns(allSet);
    persistState(allSet);
  }, [columns, persistState]);

  const isVisible = useCallback(
    (columnId: string) => visibleColumns.has(columnId),
    [visibleColumns]
  );

  return {
    visibleColumns,
    isVisible,
    toggleColumn,
    resetToDefaults,
    showAllColumns,
    totalColumnsCount: columns.length,
    visibleCount: visibleColumns.size,
  };
}
