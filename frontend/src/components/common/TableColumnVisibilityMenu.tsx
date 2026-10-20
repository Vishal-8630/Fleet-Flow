import React, { useState, useRef, useEffect } from 'react';
import { Columns3, RotateCcw, CheckSquare } from 'lucide-react';
import { ITableColumnConfig } from '../../types/table';

interface TableColumnVisibilityMenuProps {
  columns: ITableColumnConfig[];
  visibleColumns: Set<string>;
  isVisible: (columnId: string) => boolean;
  toggleColumn: (columnId: string) => void;
  resetToDefaults: () => void;
  showAllColumns?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const TableColumnVisibilityMenu: React.FC<TableColumnVisibilityMenuProps> = ({
  columns,
  visibleColumns,
  isVisible,
  toggleColumn,
  resetToDefaults,
  showAllColumns,
  className = '',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const totalCount = columns.length;
  const visibleCount = visibleColumns.size;

  return (
    <div
      ref={containerRef}
      className={`table-column-visibility-menu ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Customize visible columns"
        title="Show or hide table columns"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontWeight: 500,
        }}
      >
        <Columns3 size={14} />
        <span>Columns ({visibleCount}/{totalCount})</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Table columns visibility options"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 1050,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05))',
            minWidth: '240px',
            maxWidth: '320px',
            padding: '0.5rem 0',
            fontSize: 'var(--font-size-xs, 0.75rem)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.5rem 0.875rem',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
              Customize Columns
            </span>
            <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.6875rem' }}>
              {visibleCount} of {totalCount} active
            </span>
          </div>

          {/* Column Checkboxes List */}
          <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '0.25rem 0' }}>
            {columns.map((col) => {
              const checked = isVisible(col.id);
              const isLocked = Boolean(col.isRequired);

              return (
                <label
                  key={col.id}
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.375rem 0.875rem',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLocked) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f8fafc)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLocked}
                      onChange={() => toggleColumn(col.id)}
                      style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
                    />
                    <span
                      style={{
                        color: isLocked ? 'var(--text-main, #0f172a)' : 'var(--text-secondary, #334155)',
                        fontWeight: isLocked ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={col.description || col.label}
                    >
                      {col.label}
                    </span>
                  </div>
                  {isLocked && (
                    <span
                      className="badge badge-neutral"
                      style={{
                        fontSize: '0.625rem',
                        padding: '0.125rem 0.375rem',
                        marginLeft: '0.5rem',
                        flexShrink: 0,
                      }}
                    >
                      Required
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '0.5rem 0.875rem',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => resetToDefaults()}
              style={{
                fontSize: '0.6875rem',
                padding: '0.25rem 0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
            {showAllColumns && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => showAllColumns()}
                style={{
                  fontSize: '0.6875rem',
                  padding: '0.25rem 0.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckSquare size={11} /> Show All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
