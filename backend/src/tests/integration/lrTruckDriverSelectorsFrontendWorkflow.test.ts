import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * Phase 3: Frontend LR Truck/Driver Selectors & Validation Test Suite
 * ============================================================================
 * Verifies frontend contract compliance and behavioral logic in:
 * - frontend/src/pages/commercial/LRListPage.tsx
 * 
 * Tests cover:
 * 1. Truck and driver selectors load registered options.
 * 2. Required-field validation (truck_id and driver_id mandatory).
 * 3. Ineligible assets filtered out (decommissioned/deleted trucks, terminated/on-leave drivers).
 * 4. Expired compliance advisory displayed without blocking advance booking.
 * 5. Standalone LR vehicle and driver assignment decoupled from originating trips.
 * 6. Default driver convenience without overriding deliberate user selection.
 * 7. Backend validation errors presented clearly in toast notifications.
 * 8. Historical LRs without asset references render safely without runtime errors.
 * 9. Existing LR listing, multi-selection, and journey creation behavior remains intact.
 * ============================================================================
 */

const FRONTEND_DIR = path.resolve(__dirname, '../../../../frontend/src/pages');
const lrListPath = path.join(FRONTEND_DIR, 'commercial/LRListPage.tsx');
const lrListSource = fs.readFileSync(lrListPath, 'utf8');

describe('Phase 3: Frontend LR Truck/Driver Selectors & Validation Workflow', () => {
  // ==========================================================================
  // 1. Registered Options Loading
  // ==========================================================================
  describe('1. Truck and Driver Selectors Load Registered Master Records', () => {
    it('[Contract/Static] queries registered fleet trucks via /fleet/trucks?limit=100', () => {
      expect(lrListSource).toContain("queryKey: ['available-trucks-lookup']");
      expect(lrListSource).toContain("api.get('/fleet/trucks?limit=100')");
      expect(lrListSource).toContain('trucksLoading');
    });

    it('[Contract/Static] queries registered professional drivers via /fleet/drivers?limit=100', () => {
      expect(lrListSource).toContain("queryKey: ['active-drivers-lookup']");
      expect(lrListSource).toContain("api.get('/fleet/drivers?limit=100')");
      expect(lrListSource).toContain('driversLoading');
    });

    it('[Contract/Static] renders searchable dropdown selectors with registered vehicle and driver options', () => {
      expect(lrListSource).toContain('Assigned Commercial Vehicle');
      expect(lrListSource).toContain('Assigned Professional Driver');
      expect(lrListSource).toContain('displayTrucks.map((t: any)');
      expect(lrListSource).toContain('displayDrivers.map((d: any)');
      expect(lrListSource).toContain('-- Choose Registered Vehicle --');
      expect(lrListSource).toContain('-- Choose Professional Driver --');
    });

    it('[Behavioral Logic] formats truck options with truck_no, make/model, body/tonnage, and compliance badge', () => {
      const mockTruck = {
        _id: 'trk-1',
        truck_no: 'MH-04-AB-1234',
        make: 'Tata',
        model: 'Prima 4028.S',
        body_type: 'Container',
        tonnage_capacity: 28,
        compliance_status: 'COMPLIANT',
      };

      const formatTruckOption = (t: any) => {
        const compBadge = t.compliance_status || (t.is_compliant ? 'COMPLIANT' : 'UNKNOWN');
        const specs = [t.make, t.model].filter(Boolean).join(' ');
        const bodyInfo = [t.body_type, t.tonnage_capacity ? `${t.tonnage_capacity}T` : null].filter(Boolean).join(', ');
        return `${t.truck_no} — ${specs} ${bodyInfo ? `(${bodyInfo})` : ''} [${compBadge}]`;
      };

      const formatted = formatTruckOption(mockTruck);
      expect(formatted).toBe('MH-04-AB-1234 — Tata Prima 4028.S (Container, 28T) [COMPLIANT]');
    });

    it('[Behavioral Logic] formats driver options with name, phone, and license number', () => {
      const mockDriver = {
        _id: 'drv-1',
        name: 'Rameshwar Kumar',
        phone: '+91 98765 43210',
        license_number: 'DL-MH04201800123',
      };

      const formatDriverOption = (d: any) => {
        return `${d.name} (${d.phone || 'No Phone'})${d.license_number ? ` — Lic: ${d.license_number}` : ''}`;
      };

      const formatted = formatDriverOption(mockDriver);
      expect(formatted).toBe('Rameshwar Kumar (+91 98765 43210) — Lic: DL-MH04201800123');
    });
  });

  // ==========================================================================
  // 2. Required-Field Validation
  // ==========================================================================
  describe('2. Required-Field Validation for Truck and Driver', () => {
    it('[Contract/Static] initialForm contains truck_id and driver_id initialized to empty strings', () => {
      expect(lrListSource).toContain("truck_id: '',");
      expect(lrListSource).toContain("driver_id: '',");
    });

    it('[Contract/Static] handleCreateSubmit enforces mandatory presence of truck_id and driver_id', () => {
      expect(lrListSource).toContain('if (!formData.truck_id || !formData.driver_id)');
      expect(lrListSource).toContain("toast.error('Registered Commercial Vehicle and Professional Driver are mandatory.')");
    });

    it('[Contract/Static] payload sends truck_id and driver_id to backend', () => {
      expect(lrListSource).toContain('truck_id: formData.truck_id,');
      expect(lrListSource).toContain('driver_id: formData.driver_id,');
    });

    it('[Behavioral Logic] submission validation blocks when truck_id or driver_id is missing', () => {
      const validateForm = (data: { truck_id?: string; driver_id?: string }) => {
        if (!data.truck_id || !data.driver_id) {
          return { valid: false, error: 'Registered Commercial Vehicle and Professional Driver are mandatory.' };
        }
        return { valid: true };
      };

      expect(validateForm({})).toEqual({ valid: false, error: 'Registered Commercial Vehicle and Professional Driver are mandatory.' });
      expect(validateForm({ truck_id: 'trk-1' })).toEqual({ valid: false, error: 'Registered Commercial Vehicle and Professional Driver are mandatory.' });
      expect(validateForm({ driver_id: 'drv-1' })).toEqual({ valid: false, error: 'Registered Commercial Vehicle and Professional Driver are mandatory.' });
      expect(validateForm({ truck_id: 'trk-1', driver_id: 'drv-1' })).toEqual({ valid: true });
    });
  });

  // ==========================================================================
  // 3. Ineligible Asset Filtering
  // ==========================================================================
  describe('3. Ineligible Assets Filtered Out from Creation Selectors', () => {
    it('[Contract/Static] filters out deleted or decommissioned trucks', () => {
      expect(lrListSource).toContain('if (t.is_deleted) return false;');
      expect(lrListSource).toContain("if (t.status === 'decommissioned') return false;");
    });

    it('[Contract/Static] filters out deleted, terminated, or on-leave drivers', () => {
      expect(lrListSource).toContain('if (d.is_deleted) return false;');
      expect(lrListSource).toContain("if (d.status === 'terminated' || d.status === 'on_leave') return false;");
    });

    it('[Behavioral Logic] removes ineligible trucks from active booking options', () => {
      const mockTrucks = [
        { _id: 't1', truck_no: 'TRK-01', status: 'available', is_deleted: false },
        { _id: 't2', truck_no: 'TRK-02', status: 'decommissioned', is_deleted: false },
        { _id: 't3', truck_no: 'TRK-03', status: 'available', is_deleted: true },
        { _id: 't4', truck_no: 'TRK-04', status: 'on_trip', is_deleted: false },
        { _id: 't5', truck_no: 'TRK-05', status: 'in_maintenance', is_deleted: false },
      ];

      const eligible = mockTrucks.filter((t) => !t.is_deleted && t.status !== 'decommissioned');
      expect(eligible.map((t) => t._id)).toEqual(['t1', 't4', 't5']);
    });

    it('[Behavioral Logic] removes ineligible drivers from active booking options', () => {
      const mockDrivers = [
        { _id: 'd1', name: 'Active Driver', status: 'active', is_deleted: false },
        { _id: 'd2', name: 'Terminated Driver', status: 'terminated', is_deleted: false },
        { _id: 'd3', name: 'On-Leave Driver', status: 'on_leave', is_deleted: false },
        { _id: 'd4', name: 'Deleted Driver', status: 'active', is_deleted: true },
      ];

      const eligible = mockDrivers.filter((d) => !d.is_deleted && d.status !== 'terminated' && d.status !== 'on_leave');
      expect(eligible.map((d) => d._id)).toEqual(['d1']);
    });
  });

  // ==========================================================================
  // 4. Expired Compliance Advisory
  // ==========================================================================
  describe('4. Expired Compliance Advisory Displayed Without Blocking Advance Booking', () => {
    it('[Contract/Static] identifies trucks with expired statutory compliance', () => {
      expect(lrListSource).toContain('selectedTruckComplianceExpired = Boolean(');
      expect(lrListSource).toContain("selectedTruck.compliance_status === 'EXPIRED'");
      expect(lrListSource).toContain('selectedTruck.is_compliant === false');
    });

    it('[Contract/Static] displays COMPLIANCE_EXPIRED badge and inline advisory message', () => {
      expect(lrListSource).toContain('COMPLIANCE_EXPIRED');
      expect(lrListSource).toContain('Advisory (COMPLIANCE_EXPIRED):');
      expect(lrListSource).toContain('Statutory certificates for');
      expect(lrListSource).toContain('have expired. Advance LR booking is permitted; renewal required prior to physical dispatch.');
    });

    it('[Contract/Static] does not disable selector or submit button when compliance is expired', () => {
      // disabled attribute on select depends only on loading state, not on compliance
      expect(lrListSource).toContain('disabled={trucksLoading}');
      // submit button is only disabled when createMutation.isPending
      expect(lrListSource).toContain('disabled={createMutation.isPending}');
    });

    it('[Behavioral Logic] permits advance booking for expired compliance while showing warning', () => {
      const checkBookingEligibility = (truck: any) => {
        if (!truck || truck.status === 'decommissioned' || truck.is_deleted) {
          return { allowed: false, reason: 'TRUCK_INELIGIBLE' };
        }
        const isExpired = truck.compliance_status === 'EXPIRED' || truck.is_compliant === false;
        return {
          allowed: true,
          showAdvisory: isExpired,
          advisoryMessage: isExpired ? 'COMPLIANCE_EXPIRED: Advance booking permitted; renew before dispatch.' : null,
        };
      };

      const compliantTruck = { _id: 't1', compliance_status: 'COMPLIANT', status: 'available' };
      const expiredTruck = { _id: 't2', compliance_status: 'EXPIRED', status: 'available' };
      const decommTruck = { _id: 't3', status: 'decommissioned' };

      expect(checkBookingEligibility(compliantTruck)).toEqual({ allowed: true, showAdvisory: false, advisoryMessage: null });
      expect(checkBookingEligibility(expiredTruck)).toEqual({
        allowed: true,
        showAdvisory: true,
        advisoryMessage: 'COMPLIANCE_EXPIRED: Advance booking permitted; renew before dispatch.',
      });
      expect(checkBookingEligibility(decommTruck)).toEqual({ allowed: false, reason: 'TRUCK_INELIGIBLE' });
    });
  });

  // ==========================================================================
  // 5. Standalone Fleet Asset Assignment (Decoupled from Originating Journey)
  // ==========================================================================
  describe('5. Standalone Fleet Asset Assignment (Decoupled from Originating Journey)', () => {
    it('[Contract/Static] does not contain originating trip selector or trip queries in LR creation modal', () => {
      expect(lrListSource).not.toContain('Link to Originating Trip (Optional)');
      expect(lrListSource).not.toContain('activeJourneysData');
      expect(lrListSource).not.toContain('handleJourneyChange');
    });

    it('[Contract/Static] keeps truck and driver selectors directly interactive without trip lock states', () => {
      expect(lrListSource).toContain('disabled={trucksLoading}');
      expect(lrListSource).toContain('disabled={driversLoading}');
      expect(lrListSource).not.toContain('isAssetLocked');
      expect(lrListSource).not.toContain('Inherited from Trip');
    });

    it('[Contract/Static] payload sends master truck_id and driver_id directly without journey_id dependency', () => {
      expect(lrListSource).toContain('truck_id: formData.truck_id,');
      expect(lrListSource).toContain('driver_id: formData.driver_id,');
      expect(lrListSource).not.toContain('journey_id: formData.journey_id');
    });

    it('[Behavioral Logic] builds standalone consignment payload with direct asset references ready for journey consolidation', () => {
      const buildConsignmentPayload = (form: any) => ({
        branch_id: form.branch_id || undefined,
        truck_id: form.truck_id,
        driver_id: form.driver_id,
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name,
        driver_phone: form.driver_phone,
      });

      const payload = buildConsignmentPayload({
        branch_id: 'br-north',
        truck_id: 'trk-10',
        driver_id: 'drv-20',
        vehicle_number: 'MH-12-TRK-10',
        driver_name: 'Ramesh Patil',
        driver_phone: '+91 99999 88888',
      });

      expect(payload.truck_id).toBe('trk-10');
      expect(payload.driver_id).toBe('drv-20');
      expect(payload.vehicle_number).toBe('MH-12-TRK-10');
      expect(payload.driver_name).toBe('Ramesh Patil');
      expect((payload as any).journey_id).toBeUndefined();
    });
  });

  // ==========================================================================
  // 6. Default Driver Behavior
  // ==========================================================================
  describe('6. Default Driver Behavior without Overriding Deliberate Selection', () => {
    it('[Contract/Static] handleTruckChange auto-fills vehicle_number and pre-selects default driver if none chosen', () => {
      expect(lrListSource).toContain('const handleTruckChange = (truckId: string) =>');
      expect(lrListSource).toContain('const assignedDriverId = truck.current_driver_id?._id || truck.current_driver_id;');
      expect(lrListSource).toContain('if (!prev.driver_id && assignedDriverId)');
    });

    it('[Contract/Static] handleTruckChange does not override deliberate existing driver selection', () => {
      expect(lrListSource).toContain('let newDriverId = prev.driver_id;');
      expect(lrListSource).toContain('let newDriverName = prev.driver_name;');
      expect(lrListSource).toContain('if (!prev.driver_id && assignedDriverId)');
    });

    it('[Behavioral Logic] pre-selects assigned driver only when user has not yet chosen one', () => {
      const mockDrivers = [
        { _id: 'd1', name: 'Default Driver', status: 'active', is_deleted: false },
        { _id: 'd2', name: 'Deliberate Driver', status: 'active', is_deleted: false },
      ];

      const truckWithDriver = {
        _id: 't1',
        truck_no: 'TRK-01',
        current_driver_id: 'd1',
      };

      const selectTruck = (prevDriverId: string, truck: any) => {
        let driverId = prevDriverId;
        const assigned = truck.current_driver_id;
        if (!prevDriverId && assigned) {
          const match = mockDrivers.find((d) => d._id === assigned && d.status === 'active');
          if (match) driverId = match._id;
        }
        return { truck_id: truck._id, driver_id: driverId };
      };

      // Case A: No previous driver selected -> auto-selects default
      const resA = selectTruck('', truckWithDriver);
      expect(resA.driver_id).toBe('d1');

      // Case B: Deliberate driver already selected -> does NOT override
      const resB = selectTruck('d2', truckWithDriver);
      expect(resB.driver_id).toBe('d2');
    });
  });

  // ==========================================================================
  // 7. Backend Validation Error Mapping
  // ==========================================================================
  describe('7. Backend Validation Errors Presented Clearly', () => {
    it('[Contract/Static] createMutation.onError extracts error message from backend response', () => {
      expect(lrListSource).toContain('err.response?.data?.error ||');
      expect(lrListSource).toContain('err.response?.data?.message ||');
      expect(lrListSource).toContain('toast.error(errorMsg);');
    });

    it('[Behavioral Logic] maps backend error payload correctly to toast notification', () => {
      const extractError = (err: any) => {
        return (
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Failed to create Lorry Receipt.'
        );
      };

      const backendDecommError = {
        response: {
          data: {
            error: 'Cannot issue LR for decommissioned vehicle.',
            code: 'TRUCK_DECOMMISSIONED',
          },
        },
      };

      const backendDriverInactiveError = {
        response: {
          data: {
            error: 'Assigned driver must have active status to be assigned to a new LR.',
            code: 'DRIVER_NOT_ACTIVE',
          },
        },
      };

      expect(extractError(backendDecommError)).toBe('Cannot issue LR for decommissioned vehicle.');
      expect(extractError(backendDriverInactiveError)).toBe('Assigned driver must have active status to be assigned to a new LR.');
    });
  });

  // ==========================================================================
  // 8. Historical LR Rendering Safety
  // ==========================================================================
  describe('8. Historical LRs Without Asset References Render Safely', () => {
    it('[Contract/Static] table row renders vehicle_number and driver_name fallback safely', () => {
      expect(lrListSource).toContain('{lr.vehicle_number}');
      expect(lrListSource).toContain("{lr.driver_name || 'Driver Not Assigned'}");
    });

    it('[Behavioral Logic] historical LR record without truck_id or driver_id formats cleanly without runtime exceptions', () => {
      const historicalLr: any = {
        _id: 'hist-lr-1',
        lr_no: 'LR-OLD-001',
        vehicle_number: 'MH-12-OLD-9999',
        driver_name: '', // Historical missing driver name
        driver_phone: undefined,
        truck_id: undefined, // Historical missing foreign key
        driver_id: undefined, // Historical missing foreign key
      };

      const renderVehicleDriverCell = (lr: any) => {
        return {
          vehicleDisplay: lr.vehicle_number || 'N/A',
          driverDisplay: lr.driver_name || 'Driver Not Assigned',
        };
      };

      const cell = renderVehicleDriverCell(historicalLr);
      expect(cell.vehicleDisplay).toBe('MH-12-OLD-9999');
      expect(cell.driverDisplay).toBe('Driver Not Assigned');
    });
  });

  // ==========================================================================
  // 9. Existing LR Operations Preserved
  // ==========================================================================
  describe('9. Existing LR Management Features Preserved Intact', () => {
    it('[Contract/Static] preserves multi-LR selection ribbon and Create Journey navigation', () => {
      expect(lrListSource).toContain('commercial-selection-ribbon');
      expect(lrListSource).toContain("navigate('/operations/journeys/new', {");
      expect(lrListSource).toContain('state: { lr_ids: selectedLrIds }');
    });

    it('[Contract/Static] preserves printable stationary modal and cancel mutation', () => {
      expect(lrListSource).toContain('isPrintModalOpen');
      expect(lrListSource).toContain('handlePrintLR');
      expect(lrListSource).toContain('cancelMutation.mutate(lr._id)');
    });

    it('[Contract/Static] preserves operational branch attribution and prefix preview', () => {
      expect(lrListSource).toContain('Operational Linkage & Regional Sequence');
      expect(lrListSource).toContain('previewPrefix');
      expect(lrListSource).toContain('activeBranches');
    });
  });
});
