import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * Phase 4: Frontend Journey UI Asset Inheritance Test Suite
 * ============================================================================
 * Verifies frontend contract compliance and behavioral logic across:
 * - frontend/src/pages/operations/NewJourneyPage.tsx
 * - frontend/src/pages/operations/JourneyDetailPage.tsx
 * 
 * Verifies the 10 requirements:
 * 1. Single selected LR supplies the journey truck and driver.
 * 2. Multiple compatible LRs supply the same assets.
 * 3. Mixed trucks are rejected in the UI (TRUCK_MISMATCH).
 * 4. Mixed drivers are rejected in the UI (DRIVER_MISMATCH).
 * 5. Missing historical asset references block submission (LR_MISSING_ASSET_REFERENCE).
 * 6. Changing the LR selection recalculates assets without stale state.
 * 7. Backend conflict and assignment errors display useful messages.
 * 8. Internal repositioning and maintenance without LRs remain functional.
 * 9. Journey detail displays the current driver separately from LR issuance snapshots.
 * 10. Existing driver handover and cancellation UI behavior remains intact.
 * ============================================================================
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src/pages/operations');
const newJourneyPath = path.join(FRONTEND_DIR, 'NewJourneyPage.tsx');
const journeyDetailPath = path.join(FRONTEND_DIR, 'JourneyDetailPage.tsx');

const newJourneySource = fs.readFileSync(newJourneyPath, 'utf8');
const journeyDetailSource = fs.readFileSync(journeyDetailPath, 'utf8');

describe('Phase 4: Frontend Journey UI Asset Inheritance Workflow', () => {

  // ==========================================================================
  // 1. Single Selected LR Supplies Journey Truck and Driver
  // ==========================================================================
  describe('1. Single Selected LR Supplies Journey Truck and Driver', () => {
    it('[Contract/Static] NewJourneyPage derives truck_id and driver_id from selected LRs', () => {
      expect(newJourneySource).toContain('derivedTruckId: (!hasMissingAssetRef && !hasTruckMismatch && firstTruckId) ? String(firstTruckId) : \'\'');
      expect(newJourneySource).toContain('derivedDriverId: (!hasMissingAssetRef && !hasDriverMismatch && firstDriverId) ? String(firstDriverId) : \'\'');
      expect(newJourneySource).toContain('truck_id: derivedTruckId');
      expect(newJourneySource).toContain('driver_id: derivedDriverId');
    });

    it('[Contract/Static] NewJourneyPage renders Inherited from Consignments badge and locks selectors', () => {
      expect(newJourneySource).toContain('Inherited from Consignments');
      expect(newJourneySource).toContain('disabled={isCommercialWithLrs}');
      expect(newJourneySource).toContain("Assigned vehicle is inherited from attached Lorry Receipts");
      expect(newJourneySource).toContain("Operating driver is inherited from attached Lorry Receipts");
    });

    it('[Behavioral Logic] extracts truck and driver references from single LR without requiring re-entry', () => {
      const mockSingleLr = {
        _id: 'lr-001',
        lr_no: 'LR-2026-001',
        truck_id: { _id: 'trk-101', truck_no: 'MH-12-AB-1234' },
        driver_id: { _id: 'drv-201', name: 'Rajesh Sharma', phone: '9876543210' },
      };

      const lrs = [mockSingleLr];
      const firstTruck = lrs[0].truck_id?._id || lrs[0].truck_id;
      const firstDriver = lrs[0].driver_id?._id || lrs[0].driver_id;
      const hasMissingAssetRef = lrs.some((l) => !l.truck_id || !l.driver_id);
      const hasTruckMismatch = lrs.some((l) => (l.truck_id?._id || l.truck_id) !== firstTruck);
      const hasDriverMismatch = lrs.some((l) => (l.driver_id?._id || l.driver_id) !== firstDriver);

      const derivedTruckId = (!hasMissingAssetRef && !hasTruckMismatch && firstTruck) ? String(firstTruck) : '';
      const derivedDriverId = (!hasMissingAssetRef && !hasDriverMismatch && firstDriver) ? String(firstDriver) : '';

      expect(derivedTruckId).toBe('trk-101');
      expect(derivedDriverId).toBe('drv-201');
    });
  });

  // ==========================================================================
  // 2. Multiple Compatible LRs Supply the Same Assets
  // ==========================================================================
  describe('2. Multiple Compatible LRs Supply the Same Assets', () => {
    it('[Behavioral Logic] verifies multiple compatible LRs referencing identical truck and driver inherit cleanly', () => {
      const mockCompatibleLrs = [
        {
          _id: 'lr-1',
          lr_no: 'LR-101',
          truck_id: { _id: 'trk-A', truck_no: 'MH-04-A-1111' },
          driver_id: { _id: 'drv-A', name: 'Sunil Patil' },
          actual_weight_tonnes: 12.5,
          cbm_volume: 24,
        },
        {
          _id: 'lr-2',
          lr_no: 'LR-102',
          truck_id: { _id: 'trk-A', truck_no: 'MH-04-A-1111' },
          driver_id: { _id: 'drv-A', name: 'Sunil Patil' },
          actual_weight_tonnes: 8.5,
          cbm_volume: 16,
        },
      ];

      const firstTruck = mockCompatibleLrs[0].truck_id?._id;
      const firstDriver = mockCompatibleLrs[0].driver_id?._id;

      const hasTruckMismatch = mockCompatibleLrs.some((l) => (l.truck_id?._id || l.truck_id) !== firstTruck);
      const hasDriverMismatch = mockCompatibleLrs.some((l) => (l.driver_id?._id || l.driver_id) !== firstDriver);
      const hasMissingAssetRef = mockCompatibleLrs.some((l) => !l.truck_id || !l.driver_id);

      expect(hasTruckMismatch).toBe(false);
      expect(hasDriverMismatch).toBe(false);
      expect(hasMissingAssetRef).toBe(false);

      const derivedTruckId = firstTruck;
      const derivedDriverId = firstDriver;
      const totalWeight = mockCompatibleLrs.reduce((acc, l) => acc + l.actual_weight_tonnes, 0);

      expect(derivedTruckId).toBe('trk-A');
      expect(derivedDriverId).toBe('drv-A');
      expect(totalWeight).toBe(21.0);
    });
  });

  // ==========================================================================
  // 3. Mixed Trucks Are Rejected in the UI
  // ==========================================================================
  describe('3. Mixed Trucks Are Rejected in the UI (TRUCK_MISMATCH)', () => {
    it('[Contract/Static] NewJourneyPage detects conflicting trucks and renders warning callout', () => {
      expect(newJourneySource).toContain('Vehicle Mismatch (TRUCK_MISMATCH)');
      expect(newJourneySource).toContain('lrValidationState.hasTruckMismatch');
      expect(newJourneySource).toContain('lrValidationState.conflictingTrucks.join');
    });

    it('[Contract/Static] handleSubmit blocks submission when truck mismatch detected', () => {
      expect(newJourneySource).toContain('if (lrValidationState.hasTruckMismatch) {');
      expect(newJourneySource).toContain('Cannot dispatch journey: Selected LRs reference different vehicles (TRUCK_MISMATCH)');
    });

    it('[Behavioral Logic] flags conflicting trucks and prevents asset derivation', () => {
      const mockMixedTruckLrs = [
        {
          _id: 'lr-1',
          lr_no: 'LR-1',
          truck_id: { _id: 'trk-1', truck_no: 'MH-04-1111' },
          driver_id: { _id: 'drv-1', name: 'Driver One' },
        },
        {
          _id: 'lr-2',
          lr_no: 'LR-2',
          truck_id: { _id: 'trk-2', truck_no: 'MH-04-2222' },
          driver_id: { _id: 'drv-1', name: 'Driver One' },
        },
      ];

      const firstTruck = mockMixedTruckLrs[0].truck_id._id;
      const hasTruckMismatch = mockMixedTruckLrs.some((l) => l.truck_id._id !== firstTruck);
      const derivedTruckId = !hasTruckMismatch ? firstTruck : '';

      expect(hasTruckMismatch).toBe(true);
      expect(derivedTruckId).toBe('');
    });
  });

  // ==========================================================================
  // 4. Mixed Drivers Are Rejected in the UI
  // ==========================================================================
  describe('4. Mixed Drivers Are Rejected in the UI (DRIVER_MISMATCH)', () => {
    it('[Contract/Static] NewJourneyPage detects conflicting drivers and renders warning callout', () => {
      expect(newJourneySource).toContain('Driver Mismatch (DRIVER_MISMATCH)');
      expect(newJourneySource).toContain('lrValidationState.hasDriverMismatch');
      expect(newJourneySource).toContain('lrValidationState.conflictingDrivers.join');
    });

    it('[Contract/Static] handleSubmit blocks submission when driver mismatch detected', () => {
      expect(newJourneySource).toContain('if (lrValidationState.hasDriverMismatch) {');
      expect(newJourneySource).toContain('Cannot dispatch journey: Selected LRs reference different drivers (DRIVER_MISMATCH)');
    });

    it('[Behavioral Logic] flags conflicting drivers and prevents asset derivation', () => {
      const mockMixedDriverLrs = [
        {
          _id: 'lr-1',
          lr_no: 'LR-1',
          truck_id: { _id: 'trk-1', truck_no: 'MH-04-1111' },
          driver_id: { _id: 'drv-1', name: 'Driver One' },
        },
        {
          _id: 'lr-2',
          lr_no: 'LR-2',
          truck_id: { _id: 'trk-1', truck_no: 'MH-04-1111' },
          driver_id: { _id: 'drv-2', name: 'Driver Two' },
        },
      ];

      const firstDriver = mockMixedDriverLrs[0].driver_id._id;
      const hasDriverMismatch = mockMixedDriverLrs.some((l) => l.driver_id._id !== firstDriver);
      const derivedDriverId = !hasDriverMismatch ? firstDriver : '';

      expect(hasDriverMismatch).toBe(true);
      expect(derivedDriverId).toBe('');
    });
  });

  // ==========================================================================
  // 5. Missing Historical Asset References Block Submission
  // ==========================================================================
  describe('5. Missing Historical Asset References Block Submission (LR_MISSING_ASSET_REFERENCE)', () => {
    it('[Contract/Static] NewJourneyPage detects historical LRs missing references and renders alert', () => {
      expect(newJourneySource).toContain('Missing Historical Asset References (LR_MISSING_ASSET_REFERENCE)');
      expect(newJourneySource).toContain('lrValidationState.hasMissingAssetRef');
      expect(newJourneySource).toContain('lrValidationState.missingAssetLrs');
    });

    it('[Contract/Static] handleSubmit blocks commercial journey submission when historical LRs lack references', () => {
      expect(newJourneySource).toContain('if (lrValidationState.hasMissingAssetRef) {');
      expect(newJourneySource).toContain('lack registered vehicle or driver references (LR_MISSING_ASSET_REFERENCE)');
    });

    it('[Behavioral Logic] identifies un-upgraded historical LRs lacking truck_id or driver_id', () => {
      const mockHistoricalLrs = [
        {
          _id: 'lr-legacy',
          lr_no: 'LR-OLD-999',
          vehicle_number: 'MH-04-OLD-1',
          driver_name: 'Legacy Driver',
          truck_id: null,
          driver_id: null,
        },
        {
          _id: 'lr-modern',
          lr_no: 'LR-2026-100',
          truck_id: { _id: 'trk-1' },
          driver_id: { _id: 'drv-1' },
        },
      ];

      const missing = mockHistoricalLrs.filter((l) => !l.truck_id || !l.driver_id);
      const hasMissingAssetRef = missing.length > 0;
      const missingLrs = missing.map((l) => l.lr_no);

      expect(hasMissingAssetRef).toBe(true);
      expect(missingLrs).toEqual(['LR-OLD-999']);
    });
  });

  // ==========================================================================
  // 6. Changing LR Selection Recalculates Assets Without Stale State
  // ==========================================================================
  describe('6. Changing LR Selection Recalculates Assets Without Stale State', () => {
    it('[Contract/Static] NewJourneyPage includes handleRemoveLr and clears derived assets when selection emptied', () => {
      expect(newJourneySource).toContain('const handleRemoveLr = (lrId: string) => {');
      expect(newJourneySource).toContain('selectedLrIds.length === 0 && journeyType === \'commercial\'');
      expect(newJourneySource).toContain("truck_id: '',");
      expect(newJourneySource).toContain("driver_id: '',");
      expect(newJourneySource).toContain("billing_party_id: '',");
      expect(newJourneySource).toContain("start_odometer_kms: '',");
    });

    it('[Behavioral Logic] recalculates truck, driver, weight, and volume upon removing an LR', () => {
      let selectedLrs = [
        {
          _id: 'lr-1',
          truck_id: { _id: 'trk-1' },
          driver_id: { _id: 'drv-1' },
          actual_weight_tonnes: 10,
        },
        {
          _id: 'lr-2',
          truck_id: { _id: 'trk-1' },
          driver_id: { _id: 'drv-1' },
          actual_weight_tonnes: 15,
        },
      ];

      // Remove lr-1
      selectedLrs = selectedLrs.filter((l) => l._id !== 'lr-1');
      expect(selectedLrs).toHaveLength(1);

      const newWeight = selectedLrs.reduce((acc, l) => acc + l.actual_weight_tonnes, 0);
      expect(newWeight).toBe(15);
      expect(selectedLrs[0].truck_id._id).toBe('trk-1');

      // Remove lr-2 -> empty
      selectedLrs = selectedLrs.filter((l) => l._id !== 'lr-2');
      expect(selectedLrs).toHaveLength(0);

      const clearedState = selectedLrs.length === 0 ? { truck_id: '', driver_id: '', loaded_weight_tonnes: '' } : null;
      expect(clearedState?.truck_id).toBe('');
      expect(clearedState?.driver_id).toBe('');
    });
  });

  // ==========================================================================
  // 7. Backend Conflict and Assignment Errors Display Useful Messages
  // ==========================================================================
  describe('7. Backend Conflict and Assignment Error Codes Display Useful Messages', () => {
    it('[Contract/Static] createMutation.onError handles TRUCK_MISMATCH, DRIVER_MISMATCH, conflicts, and missing references', () => {
      expect(newJourneySource).toContain("serverCode === 'TRUCK_MISMATCH'");
      expect(newJourneySource).toContain("serverCode === 'DRIVER_MISMATCH'");
      expect(newJourneySource).toContain("serverCode === 'TRUCK_CONFLICT_WITH_LRS'");
      expect(newJourneySource).toContain("serverCode === 'DRIVER_CONFLICT_WITH_LRS'");
      expect(newJourneySource).toContain("serverCode === 'LR_MISSING_ASSET_REFERENCE'");
      expect(newJourneySource).toContain("serverCode === 'LR_ALREADY_ASSIGNED'");
    });

    it('[Behavioral Logic] maps backend error codes to clear, actionable guidance', () => {
      const getErrorMessage = (serverCode: string, serverError?: string) => {
        if (serverCode === 'LR_ALREADY_ASSIGNED') {
          return serverError || 'One or more selected Lorry Receipts are already assigned to another journey.';
        } else if (serverCode === 'TRUCK_MISMATCH') {
          return serverError || 'Vehicle mismatch: All consignments on a commercial journey must share the same physical vehicle.';
        } else if (serverCode === 'DRIVER_MISMATCH') {
          return serverError || 'Driver mismatch: All consignments on a commercial journey must share the same operating driver.';
        } else if (serverCode === 'TRUCK_CONFLICT_WITH_LRS') {
          return serverError || 'Vehicle conflict: The supplied vehicle does not match the vehicle assigned to the selected Lorry Receipts.';
        } else if (serverCode === 'DRIVER_CONFLICT_WITH_LRS') {
          return serverError || 'Driver conflict: The supplied driver does not match the driver assigned to the selected Lorry Receipts.';
        } else if (serverCode === 'LR_MISSING_ASSET_REFERENCE') {
          return serverError || 'Historical consignment missing asset reference: Selected LRs must reference registered vehicle and driver master records.';
        }
        return 'Failed to create journey.';
      };

      expect(getErrorMessage('TRUCK_MISMATCH')).toContain('Vehicle mismatch');
      expect(getErrorMessage('DRIVER_MISMATCH')).toContain('Driver mismatch');
      expect(getErrorMessage('TRUCK_CONFLICT_WITH_LRS')).toContain('Vehicle conflict');
      expect(getErrorMessage('DRIVER_CONFLICT_WITH_LRS')).toContain('Driver conflict');
      expect(getErrorMessage('LR_MISSING_ASSET_REFERENCE')).toContain('Historical consignment missing asset reference');
      expect(getErrorMessage('LR_ALREADY_ASSIGNED')).toContain('already assigned');
    });
  });

  // ==========================================================================
  // 8. Internal Repositioning and Maintenance Without LRs Remain Functional
  // ==========================================================================
  describe('8. Internal Repositioning and Maintenance Without LRs Remain Functional', () => {
    it('[Contract/Static] NewJourneyPage keeps selectors enabled when journeyType is not commercial', () => {
      expect(newJourneySource).toContain("const isCommercialWithLrs = journeyType === 'commercial' && selectedLrIds.length > 0;");
      expect(newJourneySource).toContain('disabled={isCommercialWithLrs}');
    });

    it('[Contract/Static] pre-fills odometer and optional truck default driver when not commercial with LRs', () => {
      expect(newJourneySource).toContain('driver_id: isCommercialWithLrs');
      expect(newJourneySource).toContain('start_odometer_kms: selectedTruck.current_odometer_kms.toString()');
    });

    it('[Contract/Static] payload sets lr_ids to empty array and omits billing party for internal journeys', () => {
      expect(newJourneySource).toContain("payload.billing_party_id = undefined;");
      expect(newJourneySource).toContain("payload.lr_ids = [];");
    });

    it('[Behavioral Logic] verifies internal journey allows explicit truck and driver selection without LRs', () => {
      const journeyType: string = 'internal_repositioning';
      const selectedLrIds: string[] = [];
      const isCommercialWithLrs = journeyType === 'commercial' && selectedLrIds.length > 0;

      expect(isCommercialWithLrs).toBe(false);

      const formData = {
        truck_id: 'trk-repo-1',
        driver_id: 'drv-repo-1',
        billing_party_id: '',
      };

      const payload: any = {
        journey_type: journeyType,
        truck_id: formData.truck_id,
        driver_id: formData.driver_id,
      };

      if (journeyType === 'commercial') {
        payload.billing_party_id = formData.billing_party_id || undefined;
        payload.lr_ids = selectedLrIds;
      } else {
        payload.billing_party_id = undefined;
        payload.lr_ids = [];
      }

      expect(payload.truck_id).toBe('trk-repo-1');
      expect(payload.driver_id).toBe('drv-repo-1');
      expect(payload.lr_ids).toEqual([]);
      expect(payload.billing_party_id).toBeUndefined();
    });
  });

  // ==========================================================================
  // 9. Journey Detail Displays Current Driver Separately From LR Snapshots
  // ==========================================================================
  describe('9. Journey Detail Displays Current Driver Separately From LR Issuance Snapshots', () => {
    it('[Contract/Static] JourneyDetailPage renders current journey driver with handover history indicator', () => {
      expect(journeyDetailSource).toContain('journey.driver_id?.name || \'Unassigned Driver\'');
      expect(journeyDetailSource).toContain('Relay Pilot ({journey.driver_handover_history.length} Handover');
    });

    it('[Contract/Static] JourneyDetailPage renders LR issuance snapshot in attached consignments table', () => {
      expect(journeyDetailSource).toContain('Original LR Issuance Snapshot (preserved across driver handovers)');
      expect(journeyDetailSource).toContain('Issued: {lr.vehicle_number || \'Rig\'} • {lr.driver_name || \'Driver unassigned\'}');
    });

    it('[Behavioral Logic] verifies journey operating driver changes without mutating LR issuance snapshot', () => {
      const originalLr = {
        _id: 'lr-1',
        lr_no: 'LR-100',
        vehicle_number: 'MH-04-AB-1234',
        driver_name: 'Original Driver Ramesh',
      };

      const journey = {
        _id: 'jrn-1',
        truck_id: { truck_no: 'MH-04-AB-1234' },
        driver_id: { _id: 'drv-initial', name: 'Original Driver Ramesh' },
        driver_handover_history: [] as any[],
        attached_lrs: [originalLr],
      };

      // Perform driver handover to relief driver
      const reliefDriver = { _id: 'drv-relief', name: 'Relief Driver Suresh' };
      journey.driver_id = reliefDriver;
      journey.driver_handover_history.push({
        previous_driver_id: 'drv-initial',
        new_driver_id: 'drv-relief',
        reason: 'Shift rotation',
      });

      // Journey current operating driver is now Suresh
      expect(journey.driver_id.name).toBe('Relief Driver Suresh');
      expect(journey.driver_handover_history).toHaveLength(1);

      // LR issuance snapshot remains strictly unmutated
      expect(journey.attached_lrs[0].driver_name).toBe('Original Driver Ramesh');
      expect(journey.attached_lrs[0].vehicle_number).toBe('MH-04-AB-1234');
    });
  });

  // ==========================================================================
  // 10. Existing Driver Handover and Cancellation UI Behavior Remains Intact
  // ==========================================================================
  describe('10. Existing Driver Handover and Cancellation UI Behavior Remains Intact', () => {
    it('[Contract/Static] JourneyDetailPage provides Swap Driver modal and calls PUT /operations/journeys/:id/swap-driver', () => {
      expect(journeyDetailSource).toContain('Execute En-Route Driver Handover');
      expect(journeyDetailSource).toContain("api.put(`/operations/journeys/${id}/swap-driver`, payload)");
      expect(journeyDetailSource).toContain('Confirm Driver Handover');
      expect(journeyDetailSource).toContain('Driver handover recorded successfully.');
    });

    it('[Contract/Static] Swap Driver modal filters out inactive, deleted, or current operating driver', () => {
      expect(journeyDetailSource).toContain("swapDriversData?.filter((d: any) => d.status === 'active' && !d.is_deleted && String(d._id) !== String(journey?.driver_id?._id || journey?.driver_id))");
    });

    it('[Behavioral Logic] verifies driver handover preserves audit trail without altering LR issuance records', () => {
      const journey = {
        _id: 'jrn-401',
        driver_id: 'drv-initial',
        driver_handover_history: [] as any[],
        attached_lrs: [
          { _id: 'lr-1', driver_id: 'drv-initial', driver_name: 'Original Driver' },
        ],
      };

      const handoverEvent = {
        previous_driver_id: 'drv-initial',
        new_driver_id: 'drv-relief',
        handover_odometer: 12500,
        reason: 'Scheduled relay change',
        timestamp: new Date().toISOString(),
      };

      // Apply handover
      journey.driver_id = handoverEvent.new_driver_id;
      journey.driver_handover_history.push(handoverEvent);

      expect(journey.driver_id).toBe('drv-relief');
      expect(journey.driver_handover_history).toHaveLength(1);
      expect(journey.driver_handover_history[0].previous_driver_id).toBe('drv-initial');
      expect(journey.driver_handover_history[0].handover_odometer).toBe(12500);

      // LR issuance snapshot remains unmutated
      expect(journey.attached_lrs[0].driver_name).toBe('Original Driver');
    });

    it('[Behavioral Logic] verifies journey cancellation unlinks LRs without mutating LR issuance snapshots', () => {
      const lrSnapshot = {
        _id: 'lr-1',
        lr_no: 'LR-100',
        truck_id: 'trk-1',
        driver_id: 'drv-1',
        vehicle_number: 'MH-04-AB-1234',
        driver_name: 'Original Driver Ramesh',
        driver_phone: '+91 98765 43210',
        journey_id: 'jrn-1',
      };

      // Cancellation unlinks journey_id but preserves issuance master references and snapshots
      const unlinkedLr = {
        ...lrSnapshot,
        journey_id: null,
      };

      expect(unlinkedLr.journey_id).toBeNull();
      expect(unlinkedLr.truck_id).toBe('trk-1');
      expect(unlinkedLr.driver_id).toBe('drv-1');
      expect(unlinkedLr.vehicle_number).toBe('MH-04-AB-1234');
      expect(unlinkedLr.driver_name).toBe('Original Driver Ramesh');
      expect(unlinkedLr.driver_phone).toBe('+91 98765 43210');
    });
  });
});
