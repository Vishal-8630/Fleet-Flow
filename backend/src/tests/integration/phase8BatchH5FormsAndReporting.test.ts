/**
 * ============================================================================
 * PHASE 8 BATCH H5 INTEGRATION TESTS (phase8BatchH5FormsAndReporting.test.ts)
 * ============================================================================
 * 
 * Verifies Phase H5 implementations across:
 * - FF-ISSUE-011: Form Select Dropdowns with Design Tokens
 * - FF-ISSUE-020: Support Ticket Creation Form Layout & View Switching
 * - FF-ISSUE-021: Support Ticket Thread Responsiveness & Preserved Reply Draft
 * - FF-ISSUE-049: Market Movement Table Streamlining & Accessible ConfirmDialog
 * - FF-ISSUE-060: AR Aging Report Presentation & Verified Calculation Baseline
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 8 Batch H5: Forms, Support Tickets & Reporting Viewports Polish', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const supportTicketsPagePath = path.join(rootDir, 'frontend/src/pages/support/SupportTicketsPage.tsx');
  const vehicleEntryListPagePath = path.join(rootDir, 'frontend/src/pages/operations/VehicleEntryListPage.tsx');
  const agingReportPagePath = path.join(rootDir, 'frontend/src/pages/commercial/AgingReportPage.tsx');
  const formsCssPath = path.join(rootDir, 'frontend/src/styles/components/forms.css');
  const reportControllerPath = path.join(rootDir, 'backend/src/controllers/commercialReportController.ts');

  // --------------------------------------------------------------------------
  // FF-ISSUE-011: Form Select Styling
  // --------------------------------------------------------------------------
  describe('FF-ISSUE-011: Form Select Dropdown Styling & Accessibility', () => {
    it('verifies SupportTicketsPage dropdowns use className="form-control"', () => {
      const content = fs.readFileSync(supportTicketsPagePath, 'utf-8');
      
      // Both category and priority selects must use form-control
      expect(content).toMatch(/<select[\s\S]*?className="form-control"[\s\S]*?value=\{form\.category\}/);
      expect(content).toMatch(/<select[\s\S]*?className="form-control"[\s\S]*?value=\{form\.priority\}/);
      
      // No unstyled raw inline selects in creation form
      expect(content).not.toMatch(/<select\s+value=\{form\.category\}\s+onChange=\{[\s\S]*?\}\s+style=\{\{/);
    });

    it('verifies forms.css defines custom SVG chevron and focus-visible indicators for select elements', () => {
      const css = fs.readFileSync(formsCssPath, 'utf-8');
      expect(css).toContain('select.form-control');
      expect(css).toContain('appearance: none');
      expect(css).toContain('background-image: url(');
      expect(css).toContain('.form-control:focus-visible');
    });
  });

  // --------------------------------------------------------------------------
  // FF-ISSUE-020: Support Ticket Creation Form Layout & View Switching
  // --------------------------------------------------------------------------
  describe('FF-ISSUE-020: Support Ticket Creation Form Layout & View Switching', () => {
    it('verifies creation form uses balanced responsive layout with form-control inputs', () => {
      const content = fs.readFileSync(supportTicketsPagePath, 'utf-8');

      // Balanced auto-fit 2-column grid instead of distorted 3-column grid
      expect(content).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'");
      expect(content).not.toContain("gridTemplateColumns: '1fr 1fr 1fr'");

      // Subject and message inputs use form-control
      expect(content).toMatch(/<input[\s\S]*?className="form-control"[\s\S]*?value=\{form\.subject\}/);
      expect(content).toMatch(/<textarea[\s\S]*?className="form-control"[\s\S]*?value=\{form\.message\}/);

      // Card container has maxWidth constraint
      expect(content).toContain("maxWidth: '720px'");
    });

    it('verifies strict view switching hides ticket list and empty state graphic when creating ticket', () => {
      const content = fs.readFileSync(supportTicketsPagePath, 'utf-8');

      // Strict conditional rendering: showCreate ? (CreateForm) : (TicketContainer)
      expect(content).toContain('{showCreate ? (');
      expect(content).toMatch(/showCreate \? \([\s\S]*?Submit a Support Request[\s\S]*?\) : \([\s\S]*?support-tickets-container/);
    });
  });

  // --------------------------------------------------------------------------
  // FF-ISSUE-021: Support Ticket Thread Responsiveness & Draft Preservation
  // --------------------------------------------------------------------------
  describe('FF-ISSUE-021: Support Ticket Message Thread Responsiveness & Draft Preservation', () => {
    it('verifies responsive two-pane layout with flexible thread width and close button', () => {
      const content = fs.readFileSync(supportTicketsPagePath, 'utf-8');

      // Uses minmax column allocation for ticket list allowing message thread to expand comfortably
      expect(content).toContain("gridTemplateColumns: selectedTicket ? 'minmax(300px, 360px) 1fr' : '1fr'");
      expect(content).not.toContain("gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr'");

      // Header includes close button
      expect(content).toContain('onClick={() => setSelectedTicket(null)}');
      expect(content).toContain('title="Close conversation"');

      // Messages have readable maxWidth
      expect(content).toContain("maxWidth: '75%'");
    });

    it('verifies reply composer has form-control input and draft preservation across ticket selection', () => {
      const content = fs.readFileSync(supportTicketsPagePath, 'utf-8');

      // Reply input uses form-control
      expect(content).toMatch(/<input[\s\S]*?className="form-control"[\s\S]*?value=\{replyText\}/);

      // Reply button has primary button styling
      expect(content).toContain('className="btn btn-primary"');
      expect(content).toContain('title="Send Reply"');
    });
  });

  // --------------------------------------------------------------------------
  // FF-ISSUE-049: Market Movement Table Streamlining & Accessible ConfirmDialog
  // --------------------------------------------------------------------------
  describe('FF-ISSUE-049: Market Movement Table Streamlining & ConfirmDialog', () => {
    it('verifies table is streamlined to 10 prioritized columns', () => {
      const content = fs.readFileSync(vehicleEntryListPagePath, 'utf-8');

      // Headers check
      expect(content).toMatch(/<th[^>]*>Entry #<\/th>/);
      expect(content).toMatch(/<th[^>]*>Date<\/th>/);
      expect(content).toMatch(/<th[^>]*>Hired Vehicle & Driver<\/th>/);
      expect(content).toMatch(/<th[^>]*>Supplier \(Balance Party\)<\/th>/);
      expect(content).toMatch(/<th[^>]*>Route<\/th>/);
      expect(content).toMatch(/<th[^>]*>Agreed Freight<\/th>/);
      expect(content).toMatch(/<th[^>]*>Advances<\/th>/);
      expect(content).toMatch(/<th[^>]*>Net Balance Due<\/th>/);
      expect(content).toMatch(/<th[^>]*>Status<\/th>/);
      expect(content).toMatch(/<th[^>]*>Actions<\/th>/);

      // Dala and Kamisan separate table headers removed from main table
      expect(content).not.toContain('Dala (₹)');
      expect(content).not.toContain('Kamisan (₹)');

      // ColSpan updated to 10
      expect(content).toContain('colSpan={10}');
      expect(content).not.toContain('colSpan={13}');
    });

    it('verifies full deduction arithmetic is preserved in View Financial Breakdown modal', () => {
      const content = fs.readFileSync(vehicleEntryListPagePath, 'utf-8');

      // Financial breakdown modal retains all deductions
      expect(content).toContain('Movement Financial Breakdown');
      expect(content).toContain('Agreed Total Freight');
      expect(content).toContain('− Driver Cash Advance');
      expect(content).toContain('− Diesel Fuel Advance');
      expect(content).toContain('− Dala / Loading Charges');
      expect(content).toContain('− Brokerage Commission (Kamisan)');
      expect(content).toContain('= Net Balance Due to Supplier');
    });

    it('verifies deletion uses ConfirmDialog and zero window.confirm()', () => {
      const content = fs.readFileSync(vehicleEntryListPagePath, 'utf-8');

      // Import and render ConfirmDialog
      expect(content).toContain("import { ConfirmDialog } from '../../components/common/ConfirmDialog'");
      expect(content).toContain('<ConfirmDialog');
      expect(content).toContain('title="Delete Market Vehicle Movement"');

      // Zero window.confirm calls
      expect(content).not.toContain('window.confirm');
    });
  });

  // --------------------------------------------------------------------------
  // FF-ISSUE-060: AR Aging Report Presentation & Verified Calculation Baseline
  // --------------------------------------------------------------------------
  describe('FF-ISSUE-060: AR Aging Report Presentation & Calculation Baseline', () => {
    it('verifies toast is used instead of browser native alert()', () => {
      const content = fs.readFileSync(agingReportPagePath, 'utf-8');

      // Uses toast.error on failure
      expect(content).toContain("toast.error('Failed to export Tally XML. Please try again.')");
      expect(content).not.toContain('alert(');
    });

    it('verifies neutral dashboard card styling replaces loud gradient banner', () => {
      const content = fs.readFileSync(agingReportPagePath, 'utf-8');

      // Loud gradient banner removed
      expect(content).not.toContain('linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800))');

      // Neutral card styling with design system tokens
      expect(content).toContain("background: 'var(--bg-card)'");
      expect(content).toContain("border: '1px solid var(--border-default)'");
      expect(content).toContain('Total Outstanding Receivables');
    });

    it('verifies AgingBucketCard uses neutral card tokens with accent borders', () => {
      const content = fs.readFileSync(agingReportPagePath, 'utf-8');

      // Neutral background and borderTop accent
      expect(content).toContain("background: 'var(--bg-card)'");
      expect(content).toContain('borderTop: `3px solid ${color}`');
      expect(content).not.toContain('background: bgColor');
    });

    it('verifies aging policy helper clearly states Invoice Issue Date calculation baseline', () => {
      const content = fs.readFileSync(agingReportPagePath, 'utf-8');

      // Subtitle and notice state Invoice Issue Date
      expect(content).toContain('computed from Invoice Issue Date');
      expect(content).toContain('Aging Policy Baseline:');
      expect(content).toContain('Buckets compute aging from <em>Invoice Issue Date</em>');
    });

    it('verifies backend commercialReportController calculates ageDays from invoice_date / created_at', () => {
      const controller = fs.readFileSync(reportControllerPath, 'utf-8');

      // Issue date is baseline
      expect(controller).toContain('const invoiceDate = new Date(inv.invoice_date || inv.created_at);');
      expect(controller).toContain('const ageDays = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));');

      // Bucket boundaries: 0-30, 31-60, 61-90, 90+
      expect(controller).toContain('if (ageDays <= 30) buckets.current_0_30.push(summary);');
      expect(controller).toContain('else if (ageDays <= 60) buckets.days_31_60.push(summary);');
      expect(controller).toContain('else if (ageDays <= 90) buckets.days_61_90.push(summary);');
      expect(controller).toContain('else buckets.overdue_90_plus.push(summary);');

      // Balances account for partial receipts and credit notes
      expect(controller).toContain('const outstanding = Math.round((inv.balance_amount ?? (inv.total_amount - (inv.paid_amount || 0))) * 100);');
    });
  });
});
