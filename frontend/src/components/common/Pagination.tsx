/**
 * ============================================================================
 * FLEET FLOW — REUSABLE PAGINATION CONTROLS (common/Pagination.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Accessible pagination navigation component conforming to Fleet Flow's pure
 * generic CSS design system.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * Provides seamless server-side paginated list navigation across trucks, drivers,
 * customers, and ledger tables.
 * ============================================================================
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
        Showing <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>{startItem}</span> to{' '}
        <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>{endItem}</span> of{' '}
        <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)' }}>{totalItems}</span> entries
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous Page"
          style={{ padding: '0.375rem 0.5rem' }}
        >
          <ChevronLeft size={16} />
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              className={`btn btn-sm ${currentPage === 1 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onPageChange(1)}
              style={{ minWidth: '2rem' }}
            >
              1
            </button>
            {startPage > 2 && <span style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}>...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onPageChange(p)}
            style={{ minWidth: '2rem' }}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}>...</span>}
            <button
              type="button"
              className={`btn btn-sm ${currentPage === totalPages ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onPageChange(totalPages)}
              style={{ minWidth: '2rem' }}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next Page"
          style={{ padding: '0.375rem 0.5rem' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
