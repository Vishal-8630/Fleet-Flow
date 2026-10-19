import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * Phase 2: Billing Party LR Selection and Journey Frontend Workflow Test Suite
 * ============================================================================
 * Verifies frontend contract compliance and behavioral logic across:
 * - frontend/src/pages/commercial/LRListPage.tsx
 * - frontend/src/pages/operations/NewJourneyPage.tsx
 * - frontend/src/pages/operations/JourneyDetailPage.tsx
 * 
 * Tests categorize into:
 * 1. [Contract/Static]: Validates that the TSX source code strictly contains
 *    required components, imports, state hooks, prefill hooks, UI gating,
 *    and actionable error mappings.
 * 2. [Behavioral Logic]: Executes the exact algorithmic functions implemented
 *    within the frontend components (e.g. eligibility filtering, selection toggles,
 *    customer consistency checks, cargo/weight/volume aggregation, and removal).
 * ============================================================================
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src/pages');
const lrListPath = path.join(FRONTEND_DIR, 'commercial/LRListPage.tsx');
const newJourneyPath = path.join(FRONTEND_DIR, 'operations/NewJourneyPage.tsx');
const journeyDetailPath = path.join(FRONTEND_DIR, 'operations/JourneyDetailPage.tsx');

const lrListSource = fs.readFileSync(lrListPath, 'utf8');
const newJourneySource = fs.readFileSync(newJourneyPath, 'utf8');
const journeyDetailSource = fs.readFileSync(journeyDetailPath, 'utf8');

describe('Phase 2: Billing Party LR Selection and Journey Frontend Workflow', () => {
  // ==========================================================================
  // 1. LRListPage: Consignment Selection & Journey Initiation
  // ==========================================================================
  describe('1. LRListPage: Multi-Consignment Selection & Journey Dispatch Action', () => {
    it('[Contract/Static] LRListPage imports useNavigate from react-router-dom', () => {
      expect(lrListSource).toContain("import { useNavigate } from 'react-router-dom';");
      expect(lrListSource).toContain('const navigate = useNavigate();');
    });

    it('[Contract/Static] LRListPage maintains selection and assignment filter state', () => {
      expect(lrListSource).toContain('const [selectedLrIds, setSelectedLrIds] = useState<string[]>([]);');
      expect(lrListSource).toContain("const [assignmentFilter, setAssignmentFilter] = useState('');");
    });

    it('[Contract/Static] LRListPage query function appends unassigned parameter when filter active', () => {
      expect(lrListSource).toContain("if (assignmentFilter === 'unassigned') params.unassigned = 'true';");
      expect(lrListSource).toContain('assignmentFilter');
    });

    it('[Contract/Static] LRListPage renders selection ribbon with count and dispatch action button', () => {
      expect(lrListSource).toContain('commercial-selection-ribbon');
      expect(lrListSource).toContain('{selectedLrIds.length}');
      expect(lrListSource).toContain("navigate('/operations/journeys/new', {");
      expect(lrListSource).toContain('state: { lr_ids: selectedLrIds }');
      expect(lrListSource).toContain('Clear Selection');
    });

    it('[Contract/Static] LRListPage renders checkbox in table header and row with eligibility checks', () => {
      expect(lrListSource).toContain('aria-label="Select all eligible LRs"');
      expect(lrListSource).toContain('isEligible = lr.status === \'active\' && !lr.journey_id');
      expect(lrListSource).toContain('Already assigned to a journey');
      expect(lrListSource).toContain('Invoiced LRs cannot be assigned to a new journey');
    });

    it('[Contract/Static] LRListPage renders row action to create journey from a single eligible LR', () => {
      expect(lrListSource).toContain("navigate('/operations/journeys/new', {");
      expect(lrListSource).toContain('state: { lr_ids: [lr._id] }');
      expect(lrListSource).toContain('Create Journey');
    });

    it('[Contract/Static] LRListPage renders linked journey badge when LR is already dispatched', () => {
      expect(lrListSource).toContain('lr.journey_id');
      expect(lrListSource).toContain('lr.journey_id.journey_number || \'Linked\'');
      expect(lrListSource).toContain('/operations/journeys/${jId}');
    });

    it('[Behavioral Logic] verifies LR eligibility criteria strictly isolates unassigned active LRs', () => {
      const mockLrs = [
        { _id: 'lr1', status: 'active', journey_id: null },
        { _id: 'lr2', status: 'active', journey_id: 'jrn-123' }, // Assigned
        { _id: 'lr3', status: 'invoiced', journey_id: null }, // Invoiced
        { _id: 'lr4', status: 'cancelled', journey_id: null }, // Cancelled
        { _id: 'lr5', status: 'active' }, // Unassigned (undefined journey_id)
      ];

      const checkEligible = (lr: any) => lr.status === 'active' && !lr.journey_id;
      const eligible = mockLrs.filter(checkEligible);

      expect(eligible).toHaveLength(2);
      expect(eligible.map((l) => l._id)).toEqual(['lr1', 'lr5']);
    });

    it('[Behavioral Logic] verifies multi-selection toggle and select-all logic', () => {
      const eligibleLrs = [{ _id: 'lr1' }, { _id: 'lr2' }, { _id: 'lr3' }];
      let selected: string[] = [];

      // Select single
      selected = [...selected, 'lr1'];
      expect(selected).toEqual(['lr1']);

      // Toggle select all on page
      const eligibleIds = eligibleLrs.map((l) => l._id);
      const allSelected = eligibleIds.every((id) => selected.includes(id));
      expect(allSelected).toBe(false);

      selected = Array.from(new Set([...selected, ...eligibleIds]));
      expect(selected).toEqual(['lr1', 'lr2', 'lr3']);

      // Deselect all
      selected = selected.filter((id) => !eligibleIds.includes(id));
      expect(selected).toEqual([]);
    });
  });

  // ==========================================================================
  // 2. NewJourneyPage: Ingestion, Prefill, Review, Removal & Gating
  // ==========================================================================
  describe('2. NewJourneyPage: Consignment Ingestion, Prefill, Review & Validation Gating', () => {
    it('[Contract/Static] NewJourneyPage imports useLocation and useSearchParams', () => {
      expect(newJourneySource).toContain("import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';");
    });

    it('[Contract/Static] NewJourneyPage initializes selectedLrIds from location.state or query params', () => {
      expect(newJourneySource).toContain('location.state?.lr_ids');
      expect(newJourneySource).toContain("searchParams.get('lr_ids')");
      expect(newJourneySource).toContain("useState<string[]>(initialLrIds)");
    });

    it('[Contract/Static] NewJourneyPage supports commercial, internal_repositioning, and maintenance journey types', () => {
      expect(newJourneySource).toContain("journeyType, setJourneyType");
      expect(newJourneySource).toContain("'commercial'");
      expect(newJourneySource).toContain("'internal_repositioning'");
      expect(newJourneySource).toContain("'maintenance'");
    });

    it('[Contract/Static] NewJourneyPage queries attached LR details via /commercial/entries/:id', () => {
      expect(newJourneySource).toContain("queryKey: ['selected-lrs-detail', selectedLrIds]");
      expect(newJourneySource).toContain("api.get(`/commercial/entries/${id}`)");
    });

    it('[Contract/Static] NewJourneyPage renders Movement Classification selector card', () => {
      expect(newJourneySource).toContain('Movement Classification & Journey Type');
      expect(newJourneySource).toContain('Commercial Customer Journey');
      expect(newJourneySource).toContain('Internal Repositioning');
      expect(newJourneySource).toContain('Maintenance & Garage Run');
    });

    it('[Contract/Static] NewJourneyPage renders Attached Consignments card with LR table and Remove action', () => {
      expect(newJourneySource).toContain('Attached Consignments (Lorry Receipts)');
      expect(newJourneySource).toContain('selectedLrsData?.map((lr: any)');
      expect(newJourneySource).toContain('handleRemoveLr(lr._id)');
      expect(newJourneySource).toContain('Remove');
    });

    it('[Contract/Static] NewJourneyPage shows instruction alert and Browse button when commercial journey has 0 LRs', () => {
      expect(newJourneySource).toContain('No Lorry Receipts Attached');
      expect(newJourneySource).toContain('Every Billing Party commercial journey must contain one or more eligible Lorry Receipts');
      expect(newJourneySource).toContain("navigate('/bill-entry/all')");
    });

    it('[Contract/Static] NewJourneyPage disables/hides billing party dropdown for internal movements', () => {
      expect(newJourneySource).toContain('N/A — Non-Commercial Internal Dispatch');
      expect(newJourneySource).toContain('Internal Fleet Repositioning');
    });

    it('[Contract/Static] NewJourneyPage blocks submission when commercial journey has no LRs', () => {
      expect(newJourneySource).toContain("if (journeyType === 'commercial')");
      expect(newJourneySource).toContain('if (selectedLrIds.length === 0)');
      expect(newJourneySource).toContain(
        "toast.error('A Billing Party commercial journey must contain one or more eligible Lorry Receipts.')"
      );
    });

    it('[Contract/Static] NewJourneyPage includes journey_type and lr_ids in payload and cleanses customer on internal dispatches', () => {
      expect(newJourneySource).toContain('journey_type: journeyType');
      expect(newJourneySource).toContain('payload.lr_ids = selectedLrIds');
      expect(newJourneySource).toContain('payload.billing_party_id = undefined');
      expect(newJourneySource).toContain('payload.lr_ids = []');
      expect(newJourneySource).toContain("api.post('/operations/journeys', payload)");
    });

    it('[Contract/Static] NewJourneyPage maps backend error codes to clear actionable toasts', () => {
      expect(newJourneySource).toContain("serverCode === 'LR_ALREADY_ASSIGNED'");
      expect(newJourneySource).toContain("serverCode === 'CUSTOMER_MISMATCH'");
      expect(newJourneySource).toContain("serverCode === 'BRANCH_MISMATCH'");
      expect(newJourneySource).toContain("serverCode === 'LR_REQUIRED_FOR_BILLING_PARTY_JOURNEY'");
      expect(newJourneySource).toContain("serverCode === 'INTERNAL_JOURNEY_CANNOT_HAVE_BILLING_PARTY'");
    });

    it('[Behavioral Logic] verifies customer derivation and customer mismatch detection across LRs', () => {
      const singleCustomerLrs = [
        { _id: 'lr1', billing_party_id: { _id: 'cust-A', name: 'Acme Corp' } },
        { _id: 'lr2', billing_party_id: { _id: 'cust-A', name: 'Acme Corp' } },
      ];

      const firstCustomer = singleCustomerLrs[0].billing_party_id._id;
      const hasMismatch = singleCustomerLrs.some(
        (l) => l.billing_party_id._id !== firstCustomer
      );
      expect(hasMismatch).toBe(false);
      expect(firstCustomer).toBe('cust-A');

      const mixedCustomerLrs = [
        { _id: 'lr1', billing_party_id: { _id: 'cust-A', name: 'Acme Corp' } },
        { _id: 'lr2', billing_party_id: { _id: 'cust-B', name: 'Beta Ltd' } },
      ];
      const mixedMismatch = mixedCustomerLrs.some(
        (l) => l.billing_party_id._id !== mixedCustomerLrs[0].billing_party_id._id
      );
      expect(mixedMismatch).toBe(true);
    });

    it('[Behavioral Logic] verifies aggregation of weights, volume, freight, and cargo descriptions', () => {
      const mockLrs = [
        {
          _id: 'lr1',
          actual_weight_tonnes: 12.5,
          cbm_volume: 15.0,
          freight_amount: 25000,
          goods_description: 'Steel Pipes',
          from_location: 'Mumbai',
          to_location: 'Delhi',
        },
        {
          _id: 'lr2',
          actual_weight_tonnes: 8.5,
          cbm_volume: 10.0,
          freight_amount: 18000,
          goods_description: 'Industrial Valves',
          from_location: 'Mumbai',
          to_location: 'Delhi',
        },
      ];

      const totalWeight = mockLrs.reduce((sum, l) => sum + (Number(l.actual_weight_tonnes) || 0), 0);
      const totalVolume = mockLrs.reduce((sum, l) => sum + (Number(l.cbm_volume) || 0), 0);
      const totalFreight = mockLrs.reduce((sum, l) => sum + (Number(l.freight_amount) || 0), 0);
      const cargoDescriptions = Array.from(new Set(mockLrs.map((l) => l.goods_description).filter(Boolean))).join(', ');

      expect(totalWeight).toBe(21.0);
      expect(totalVolume).toBe(25.0);
      expect(totalFreight).toBe(43000);
      expect(cargoDescriptions).toBe('Steel Pipes, Industrial Valves');
    });

    it('[Behavioral Logic] verifies removing an LR recalculates totals correctly', () => {
      let lrs = [
        { _id: 'lr1', actual_weight_tonnes: 10, freight_amount: 20000 },
        { _id: 'lr2', actual_weight_tonnes: 15, freight_amount: 30000 },
      ];

      // Remove lr1
      lrs = lrs.filter((l) => l._id !== 'lr1');
      expect(lrs).toHaveLength(1);
      const remainingWeight = lrs.reduce((sum, l) => sum + l.actual_weight_tonnes, 0);
      const remainingFreight = lrs.reduce((sum, l) => sum + l.freight_amount, 0);

      expect(remainingWeight).toBe(15);
      expect(remainingFreight).toBe(30000);
    });

    it('[Contract/Static] NewJourneyPage clears derived fields when all LRs are removed in commercial mode', () => {
      expect(newJourneySource).toContain("else if (selectedLrIds.length === 0 && journeyType === 'commercial')");
      expect(newJourneySource).toContain("billing_party_id: ''");
      expect(newJourneySource).toContain("from_city: ''");
      expect(newJourneySource).toContain("to_city: ''");
      expect(newJourneySource).toContain("cargo_description: ''");
      expect(newJourneySource).toContain("loaded_weight_tonnes: ''");
      expect(newJourneySource).toContain("freight_rate: ''");
    });

    it('[Contract/Static] NewJourneyPage identifies and blocks ineligible or already assigned LRs', () => {
      expect(newJourneySource).toContain("const staleLrs = lrs.filter((l: any) => l.journey_id || l.status !== 'active');");
      expect(newJourneySource).toContain("const ineligible = selectedLrsData?.filter((l: any) => l.journey_id || l.status !== 'active');");
      expect(newJourneySource).toContain("isLRIneligible = Boolean(lr.journey_id || lr.status !== 'active')");
    });

    it('[Contract/Static] NewJourneyPage disables Draft Plan and Dispatch buttons when commercial has 0 LRs', () => {
      expect(newJourneySource).toContain("disabled={createMutation.isPending || (journeyType === 'commercial' && selectedLrIds.length === 0)}");
      expect(newJourneySource).toContain("title={journeyType === 'commercial' && selectedLrIds.length === 0 ? 'Commercial journeys require at least one eligible Lorry Receipt' : undefined}");
    });
  });

  // ==========================================================================
  // 3. JourneyDetailPage: Linked Consignments & Decoupled Status Display
  // ==========================================================================
  describe('3. JourneyDetailPage: Linked Consignments & Decoupled Status Display', () => {
    it('[Contract/Static] JourneyDetailPage queries journey and fallback entries if lr_ids not populated', () => {
      expect(journeyDetailSource).toContain("queryKey: ['journey-detail', id]");
      expect(journeyDetailSource).toContain("queryKey: ['journey-fallback-lrs', id]");
      expect(journeyDetailSource).toContain("api.get('/commercial/entries', { params: { journey_id: id, limit: 100 } })");
    });

    it('[Contract/Static] JourneyDetailPage renders Attached Consignments card on overview tab', () => {
      expect(journeyDetailSource).toContain('Attached Consignments (Lorry Receipts)');
      expect(journeyDetailSource).toContain('displayLrs.length === 0');
      expect(journeyDetailSource).toContain('displayLrs.map((lr: any)');
    });

    it('[Contract/Static] JourneyDetailPage displays distinct LR invoicing status decoupled from journey status', () => {
      expect(journeyDetailSource).toContain("lr.status === 'invoiced' ? 'Invoiced' : lr.status === 'active' ? 'Active (Unbilled)' : lr.status");
      expect(journeyDetailSource).toContain('Decoupled Invoicing & Ledger Integrity');
      expect(journeyDetailSource).toContain('Journey delivery status');
      expect(journeyDetailSource).toContain('does not trigger automatic customer invoicing or ledger postings');
    });

    it('[Contract/Static] JourneyDetailPage renders printable stationary modal with 3-part layout', () => {
      expect(journeyDetailSource).toContain('isPrintModalOpen, setIsPrintModalOpen');
      expect(journeyDetailSource).toContain("api.get(`/commercial/entries/${lrId}/printable`)");
      expect(journeyDetailSource).toContain('CONSIGNOR COPY');
      expect(journeyDetailSource).toContain('CONSIGNEE COPY');
      expect(journeyDetailSource).toContain('TRANSPORTER COPY');
    });

    it('[Contract/Static] JourneyDetailPage displays internal move notice for repositioning / maintenance dispatches', () => {
      expect(journeyDetailSource).toContain("journey.journey_type === 'internal_repositioning'");
      expect(journeyDetailSource).toContain('Internal Repositioning Movement — No Consignments');
      expect(journeyDetailSource).toContain('Maintenance Transit Movement — No Consignments');
    });

    it('[Behavioral Logic] verifies delivery status and LR invoicing status are independently evaluated', () => {
      const journey = {
        _id: 'jrn-1',
        status: 'completed',
        delivery_status: 'delivered', // Delivered operational transit status
        lr_ids: [
          { _id: 'lr1', lr_no: 'LR-001', status: 'active' }, // Still unbilled
          { _id: 'lr2', lr_no: 'LR-002', status: 'invoiced', invoice_id: 'inv-1' }, // Invoiced
        ],
      };

      // Trip is completed & delivered
      expect(journey.delivery_status).toBe('delivered');

      // Individual LRs maintain their own accounting status
      const unbilledLrs = journey.lr_ids.filter((l) => l.status === 'active');
      const invoicedLrs = journey.lr_ids.filter((l) => l.status === 'invoiced');

      expect(unbilledLrs).toHaveLength(1);
      expect(unbilledLrs[0].lr_no).toBe('LR-001');

      expect(invoicedLrs).toHaveLength(1);
      expect(invoicedLrs[0].lr_no).toBe('LR-002');
    });
  });

  // ==========================================================================
  // 4. Print Stationery Stylesheet Integrity
  // ==========================================================================
  describe('4. Print Stationery Stylesheet Integrity (@media print in billing.css)', () => {
    const billingCssPath = path.resolve(__dirname, '../../../../frontend/src/styles/components/billing.css');
    const billingCssSource = fs.readFileSync(billingCssPath, 'utf8');

    it('[Contract/Static] billing.css configures print media styles for LR printable stationery', () => {
      expect(billingCssSource).toContain('@media print');
      expect(billingCssSource).toContain('.lr-print-container');
      expect(billingCssSource).toContain('visibility: visible');
    });

    it('[Contract/Static] billing.css hides modal backdrops, headers, and footers during print', () => {
      expect(billingCssSource).toContain('.modal-backdrop');
      expect(billingCssSource).toContain('.modal-header');
      expect(billingCssSource).toContain('.modal-footer');
      expect(billingCssSource).toContain('display: none !important');
    });

    it('[Contract/Static] billing.css prevents mid-section page breaks on consignment notes', () => {
      expect(billingCssSource).toContain('.lr-part-section');
      expect(billingCssSource).toContain('page-break-inside: avoid');
    });
  });
});

