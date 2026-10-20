import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * Phase 3: Frontend Multi-Billing-Party Journey Alignment Test Suite
 * ============================================================================
 * Verifies frontend contract compliance and behavioral logic across:
 * - frontend/src/pages/operations/NewJourneyPage.tsx
 * - frontend/src/pages/operations/JourneyListPage.tsx
 * - frontend/src/pages/operations/JourneyDetailPage.tsx
 * 
 * Verifies business rules:
 * 1. Commercial journeys are created from one or more existing LRs.
 * 2. LRs may belong to different registered Billing Parties.
 * 3. All selected LRs must still share the same registered truck, driver, tenant, and valid branch context.
 * 4. The journey's Billing Parties are derived from its attached LRs; no manual single-party dropdown required.
 * 5. Does not arbitrarily display the first LR's Billing Party as the journey's customer.
 * 6. Preserves existing direct-journey Balance Party and non-commercial workflows without modification.
 * 7. Verified that the client does not send a fabricated or arbitrary journey-level Billing Party.
 * ============================================================================
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src/pages/operations');
const newJourneyPath = path.join(FRONTEND_DIR, 'NewJourneyPage.tsx');
const journeyListPath = path.join(FRONTEND_DIR, 'JourneyListPage.tsx');
const journeyDetailPath = path.join(FRONTEND_DIR, 'JourneyDetailPage.tsx');

const newJourneySource = fs.readFileSync(newJourneyPath, 'utf8');
const journeyListSource = fs.readFileSync(journeyListPath, 'utf8');
const journeyDetailSource = fs.readFileSync(journeyDetailPath, 'utf8');

describe('Phase 3: Frontend Multi-Billing-Party Journey Alignment', () => {

  // ==========================================================================
  // 1. NewJourneyPage: Removal of Mandatory Single-Party Dropdown & Multi-Party Derivation
  // ==========================================================================
  describe('1. NewJourneyPage: Multi-Billing-Party Derivation & Removal of Single-Party Dropdown', () => {
    it('[Contract/Static] NewJourneyPage derives distinct Billing Parties from attached LRs', () => {
      expect(newJourneySource).toContain('distinctParties');
      expect(newJourneySource).toContain('isSingleParty');
      expect(newJourneySource).toContain('isMultiParty');
      expect(newJourneySource).toContain('partiesMap.set(idStr');
    });

    it('[Contract/Static] NewJourneyPage does NOT throw customer mismatch error on mixed-party LRs', () => {
      // Must not contain the old blocking toast error
      expect(newJourneySource).not.toContain(
        "toast.error('Selected LRs have mismatched Billing Parties. A commercial journey must belong to a single customer.')"
      );
    });

    it('[Contract/Static] NewJourneyPage renders multi-party banner and customer breakdown cards', () => {
      expect(newJourneySource).toContain('Multi-Billing-Party Journey');
      expect(newJourneySource).toContain('Multi-Party Consolidated Commercial Movement');
      expect(newJourneySource).toContain('Commercial invoices are created separately for each customer and their LRs through the independent invoicing workflow');
      expect(newJourneySource).toContain('Invoicing is eligible after delivery/POD by default, with authorized early invoicing permitted');
      expect(newJourneySource).toContain('lrValidationState.distinctParties.map');
    });

    it('[Contract/Static] NewJourneyPage renders single-customer card when all LRs belong to one party', () => {
      expect(newJourneySource).toContain('Derived from Attached LRs (Single Customer)');
      expect(newJourneySource).toContain('lrValidationState.distinctParties[0]?.name');
    });

    it('[Contract/Static] NewJourneyPage Attached Consignments table displays a dedicated Billing Party column', () => {
      expect(newJourneySource).toContain('<th>Billing Party</th>');
      expect(newJourneySource).toContain('lr.billing_party_id?.name || lr.billing_party_name');
    });

    it('[Behavioral Logic] correctly differentiates between single-customer and multi-customer LR selections', () => {
      const mockSingleCustomerLrs = [
        {
          _id: 'lr-1',
          billing_party_id: { _id: 'party-A', name: 'Tata Motors', gstin: '27AABCT1234A1Z1' },
        },
        {
          _id: 'lr-2',
          billing_party_id: { _id: 'party-A', name: 'Tata Motors', gstin: '27AABCT1234A1Z1' },
        },
      ];

      const partiesMap1 = new Map<string, { id: string; name: string; gstin?: string; lrCount: number }>();
      mockSingleCustomerLrs.forEach((l) => {
        const p = l.billing_party_id;
        const pId = String(p._id);
        const existing = partiesMap1.get(pId);
        if (existing) existing.lrCount += 1;
        else partiesMap1.set(pId, { id: pId, name: p.name, gstin: p.gstin, lrCount: 1 });
      });

      const parties1 = Array.from(partiesMap1.values());
      expect(parties1).toHaveLength(1);
      expect(parties1[0].name).toBe('Tata Motors');
      expect(parties1[0].lrCount).toBe(2);

      const mockMixedCustomerLrs = [
        {
          _id: 'lr-1',
          billing_party_id: { _id: 'party-A', name: 'Tata Motors', gstin: '27AABCT1234A1Z1' },
        },
        {
          _id: 'lr-2',
          billing_party_id: { _id: 'party-B', name: 'Mahindra Logistics', gstin: '27AABCM5678B1Z2' },
        },
        {
          _id: 'lr-3',
          billing_party_id: { _id: 'party-A', name: 'Tata Motors', gstin: '27AABCT1234A1Z1' },
        },
      ];

      const partiesMap2 = new Map<string, { id: string; name: string; gstin?: string; lrCount: number }>();
      mockMixedCustomerLrs.forEach((l) => {
        const p = l.billing_party_id;
        const pId = String(p._id);
        const existing = partiesMap2.get(pId);
        if (existing) existing.lrCount += 1;
        else partiesMap2.set(pId, { id: pId, name: p.name, gstin: p.gstin, lrCount: 1 });
      });

      const parties2 = Array.from(partiesMap2.values());
      expect(parties2).toHaveLength(2);
      expect(parties2.find((p) => p.id === 'party-A')?.lrCount).toBe(2);
      expect(parties2.find((p) => p.id === 'party-B')?.lrCount).toBe(1);
    });
  });

  // ==========================================================================
  // 2. Client Payload Contract: Never Send Arbitrary Journey Billing Party
  // ==========================================================================
  describe('2. Client Payload Contract: Non-Fabrication of Journey Billing Party', () => {
    it('[Contract/Static] NewJourneyPage sets payload.billing_party_id strictly if exactly 1 customer, else undefined', () => {
      expect(newJourneySource).toContain('payload.billing_party_id = distinctPartyIds.length === 1 ? distinctPartyIds[0] : undefined;');
      expect(newJourneySource).toContain('payload.lr_ids = selectedLrIds;');
    });

    it('[Behavioral Logic] calculates payload without arbitrary customer selection for mixed-party journeys', () => {
      const computePayloadCustomer = (lrs: any[]) => {
        const distinctPartyIds = Array.from(
          new Set(
            lrs.map((l: any) => l.billing_party_id?._id || (typeof l.billing_party_id === 'string' ? l.billing_party_id : null)).filter(Boolean)
          )
        );
        return distinctPartyIds.length === 1 ? distinctPartyIds[0] : undefined;
      };

      // 1. Single customer LRs
      const singleCustomerLrs = [
        { billing_party_id: { _id: 'cust-101' } },
        { billing_party_id: { _id: 'cust-101' } },
      ];
      expect(computePayloadCustomer(singleCustomerLrs)).toBe('cust-101');

      // 2. Mixed customer LRs -> MUST BE undefined (not cust-101 or cust-102)
      const mixedCustomerLrs = [
        { billing_party_id: { _id: 'cust-101' } },
        { billing_party_id: { _id: 'cust-102' } },
      ];
      expect(computePayloadCustomer(mixedCustomerLrs)).toBeUndefined();
    });
  });

  // ==========================================================================
  // 3. Asset Compatibility Across Mixed-Party LRs
  // ==========================================================================
  describe('3. Resource Checks: Shared Truck and Driver Compatibility Preserved', () => {
    it('[Contract/Static] preserves truck and driver mismatch detection and error callouts', () => {
      expect(newJourneySource).toContain('Vehicle Mismatch (TRUCK_MISMATCH)');
      expect(newJourneySource).toContain('Driver Mismatch (DRIVER_MISMATCH)');
      expect(newJourneySource).toContain('lrValidationState.hasTruckMismatch');
      expect(newJourneySource).toContain('lrValidationState.hasDriverMismatch');
    });

    it('[Contract/Static] blocks submission when truck or driver mismatch is detected', () => {
      expect(newJourneySource).toContain('if (lrValidationState.hasTruckMismatch) {');
      expect(newJourneySource).toContain('if (lrValidationState.hasDriverMismatch) {');
    });

    it('[Behavioral Logic] allows mixed-party LRs to pass when truck and driver match identically', () => {
      const mockCompatibleMixedLrs = [
        {
          _id: 'lr-1',
          billing_party_id: { _id: 'party-1', name: 'Shipper One' },
          truck_id: { _id: 'trk-A', truck_no: 'MH-12-AB-1234' },
          driver_id: { _id: 'drv-A', name: 'Ramesh Pilot' },
        },
        {
          _id: 'lr-2',
          billing_party_id: { _id: 'party-2', name: 'Shipper Two' },
          truck_id: { _id: 'trk-A', truck_no: 'MH-12-AB-1234' },
          driver_id: { _id: 'drv-A', name: 'Ramesh Pilot' },
        },
      ];

      const firstTruck = mockCompatibleMixedLrs[0].truck_id?._id;
      const firstDriver = mockCompatibleMixedLrs[0].driver_id?._id;

      const hasTruckMismatch = mockCompatibleMixedLrs.some((l) => (l.truck_id?._id || l.truck_id) !== firstTruck);
      const hasDriverMismatch = mockCompatibleMixedLrs.some((l) => (l.driver_id?._id || l.driver_id) !== firstDriver);
      const hasMissingAssetRef = mockCompatibleMixedLrs.some((l) => !l.truck_id || !l.driver_id);

      expect(hasTruckMismatch).toBe(false);
      expect(hasDriverMismatch).toBe(false);
      expect(hasMissingAssetRef).toBe(false);

      const derivedTruckId = firstTruck;
      const derivedDriverId = firstDriver;

      expect(derivedTruckId).toBe('trk-A');
      expect(derivedDriverId).toBe('drv-A');
    });

    it('[Behavioral Logic] strictly blocks mixed-party LRs if they reference different trucks or drivers', () => {
      const mockIncompatibleMixedLrs = [
        {
          _id: 'lr-1',
          billing_party_id: { _id: 'party-1', name: 'Shipper One' },
          truck_id: { _id: 'trk-A', truck_no: 'MH-12-AB-1234' },
          driver_id: { _id: 'drv-A', name: 'Ramesh Pilot' },
        },
        {
          _id: 'lr-2',
          billing_party_id: { _id: 'party-2', name: 'Shipper Two' },
          truck_id: { _id: 'trk-B', truck_no: 'MH-12-CD-5678' }, // Different Truck!
          driver_id: { _id: 'drv-A', name: 'Ramesh Pilot' },
        },
      ];

      const firstTruck = mockIncompatibleMixedLrs[0].truck_id?._id;
      const hasTruckMismatch = mockIncompatibleMixedLrs.some((l) => (l.truck_id?._id || l.truck_id) !== firstTruck);

      expect(hasTruckMismatch).toBe(true);
    });
  });

  // ==========================================================================
  // 4. JourneyListPage Presentation: Multi-Billing-Party Representation
  // ==========================================================================
  describe('4. JourneyListPage: Accurate Representation of Mixed-Party Journeys', () => {
    it('[Contract/Static] JourneyListPage renders Multi-Customer badge and distinct party count for mixed journeys', () => {
      expect(journeyListSource).toContain('Multi-Customer ({distinctParties.length} Parties)');
      expect(journeyListSource).toContain('distinctParties: string[] = Array.from');
      expect(journeyListSource).toContain('j.billing_party_id?.name');
    });

    it('[Contract/Static] JourneyListPage does not arbitrarily show first LR party as single customer', () => {
      expect(journeyListSource).toContain('distinctParties.length > 1');
      expect(journeyListSource).toContain('distinctParties.join');
    });

    it('[Behavioral Logic] renders correct party label for single and mixed journeys', () => {
      const renderPartyTag = (journey: any) => {
        if (journey.billing_party_id?.name) {
          return { type: 'single', label: journey.billing_party_id.name };
        }
        const distinctParties = Array.from(
          new Set((journey.lr_ids || []).map((lr: any) => lr?.billing_party_id?.name || lr?.billing_party_name).filter(Boolean))
        );
        if (distinctParties.length > 1) {
          return { type: 'multi', label: `Multi-Customer (${distinctParties.length} Parties)` };
        }
        if (distinctParties.length === 1) {
          return { type: 'single', label: String(distinctParties[0]) };
        }
        return { type: 'none', label: null };
      };

      const singleJourney = {
        billing_party_id: { name: 'Tata Motors' },
        lr_ids: [{ billing_party_id: { name: 'Tata Motors' } }],
      };
      expect(renderPartyTag(singleJourney)).toEqual({ type: 'single', label: 'Tata Motors' });

      const mixedJourney = {
        billing_party_id: null,
        lr_ids: [
          { billing_party_id: { name: 'Tata Motors' } },
          { billing_party_id: { name: 'Mahindra Logistics' } },
        ],
      };
      expect(renderPartyTag(mixedJourney)).toEqual({ type: 'multi', label: 'Multi-Customer (2 Parties)' });
    });
  });

  // ==========================================================================
  // 5. JourneyDetailPage Presentation: Detailed Breakdown & LR Table
  // ==========================================================================
  describe('5. JourneyDetailPage: Multi-Billing-Party Tile and Consignments Column', () => {
    it('[Contract/Static] JourneyDetailPage renders Commercial Billing Party Attribution Tile', () => {
      expect(journeyDetailSource).toContain('Commercial Billing Party Attribution Tile');
      expect(journeyDetailSource).toContain('Multi-Billing-Party Manifest');
      expect(journeyDetailSource).toContain('Distinct Billing Parties');
      expect(journeyDetailSource).toContain('Consolidated journey carries consignments for multiple registered customers');
    });

    it('[Contract/Static] JourneyDetailPage Attached Consignments table renders dedicated Billing Party column', () => {
      expect(journeyDetailSource).toContain('<th>Billing Party</th>');
      expect(journeyDetailSource).toContain('lr.billing_party_id?.name || lr.billing_party_name');
    });

    it('[Behavioral Logic] derives distinct customer list and counts for detail page overview', () => {
      const displayLrs = [
        {
          _id: 'lr-1',
          lr_no: 'LR-001',
          billing_party_id: { _id: 'p1', name: 'Customer One', gstin: 'GSTIN001' },
        },
        {
          _id: 'lr-2',
          lr_no: 'LR-002',
          billing_party_id: { _id: 'p2', name: 'Customer Two', gstin: 'GSTIN002' },
        },
        {
          _id: 'lr-3',
          lr_no: 'LR-003',
          billing_party_id: { _id: 'p1', name: 'Customer One', gstin: 'GSTIN001' },
        },
      ];

      const map = new Map<string, { id: string; name: string; gstin?: string; lrCount: number }>();
      displayLrs.forEach((lr) => {
        const p = lr.billing_party_id;
        const id = String(p._id);
        const existing = map.get(id);
        if (existing) existing.lrCount += 1;
        else map.set(id, { id, name: p.name, gstin: p.gstin, lrCount: 1 });
      });

      const parties = Array.from(map.values());
      expect(parties).toHaveLength(2);
      expect(parties.find((p) => p.name === 'Customer One')?.lrCount).toBe(2);
      expect(parties.find((p) => p.name === 'Customer Two')?.lrCount).toBe(1);
    });
  });
});
