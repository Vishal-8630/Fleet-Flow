/**
 * ============================================================================
 * FLEET FLOW — TRUCK CONTROLLER (truckController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Handles fleet vehicle CRUD, statutory compliance vault document management,
 * odometer maintenance schedules, and driver assignments.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - Server-Side Filtering & Search: Supports pagination, regex search on `truck_no`
 *   and `make`, and status filtering directly in MongoDB.
 * - Real-Time Compliance Aggregation: Calculates fleet-wide stats (Compliant, Expiring Soon,
 *   Expired) on the fly so dashboard widgets stay 100% synchronized.
 * - Bidirectional Driver Assignment: Synchronizes `Truck.current_driver_id` and
 *   `Driver.current_truck_id` atomically while recording historical timestamps.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Truck, ITruck, ComplianceStatus } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { validateCustomFieldsPayload } from '../utils/customFieldValidator.js';
import { getTenantEntitlements } from '../utils/entitlementService.js';
import { runInTransaction, ConfigurationError } from '../utils/transactionHelper.js';
import { logAuditEvent } from '../utils/auditService.js';

/**
 * 1. listTrucks
 * ----------------------------------------------------------------------------
 * Retrieves a server-side paginated list of fleet trucks with real-time compliance
 * status indicators and fleet overview KPI counters.
 */
export async function listTrucks(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const q = (req.query.q as string)?.trim();
    const status = req.query.status as string;
    const bodyType = req.query.body_type as string;
    const complianceFilter = req.query.compliance as ComplianceStatus;

    // Build query filter
    const filter: any = { is_deleted: false };

    if (q) {
      filter.$or = [
        { truck_no: { $regex: q, $options: 'i' } },
        { make: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } },
      ];
    }

    if (status && ['available', 'on_trip', 'in_maintenance', 'decommissioned'].includes(status)) {
      filter.status = status;
    }

    if (bodyType) {
      filter.body_type = bodyType;
    }

    // Query matching records
    const [rawTrucks, total] = await Promise.all([
      Truck.find(filter)
        .populate('current_driver_id', 'name phone photo_url status')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Truck.countDocuments(filter),
    ]);

    // Optional compliance status post-filter if requested
    let trucks = rawTrucks;
    if (complianceFilter && ['COMPLIANT', 'EXPIRING_SOON', 'EXPIRED'].includes(complianceFilter)) {
      trucks = trucks.filter((t) => t.compliance_status === complianceFilter);
    }

    // Compute fleet KPI counts
    const allActiveTrucks = await Truck.find({ is_deleted: false });
    let compliantCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let availableCount = 0;
    let onTripCount = 0;
    let inMaintenanceCount = 0;

    for (const t of allActiveTrucks) {
      const cStatus = t.calculateComplianceStatus();
      if (cStatus === 'COMPLIANT') compliantCount++;
      else if (cStatus === 'EXPIRING_SOON') expiringSoonCount++;
      else if (cStatus === 'EXPIRED') expiredCount++;

      if (t.status === 'available') availableCount++;
      else if (t.status === 'on_trip') onTripCount++;
      else if (t.status === 'in_maintenance') inMaintenanceCount++;
    }

    res.json({
      trucks,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: allActiveTrucks.length,
        available: availableCount,
        on_trip: onTripCount,
        in_maintenance: inMaintenanceCount,
        compliant: compliantCount,
        expiring_soon: expiringSoonCount,
        expired: expiredCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching fleet trucks:', error);
    res.status(500).json({ error: 'Failed to retrieve fleet trucks.' });
  }
}

/**
 * 2. getTruckById
 * ----------------------------------------------------------------------------
 * Retrieves a single truck record with populated driver assignments and full
 * compliance vault document details.
 */
export async function getTruckById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const truck = await Truck.findOne({ _id: id, is_deleted: false })
      .populate('current_driver_id', 'name phone photo_url license_number')
      .populate('driver_assignments.driver_id', 'name phone photo_url');

    if (!truck) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    res.json({ truck });
  } catch (error: any) {
    console.error('Error fetching truck details:', error);
    res.status(500).json({ error: 'Failed to retrieve vehicle details.' });
  }
}

/**
 * 3. createTruck
 * ----------------------------------------------------------------------------
 * Adds a new vehicle asset to the company workspace.
 * Validates uniqueness of truck registration number.
 */
export async function createTruck(req: Request, res: Response): Promise<void> {
  try {
    const {
      truck_no,
      make,
      model,
      year,
      body_type,
      tonnage_capacity,
      cbm_capacity,
      current_odometer_kms,
      service_interval_kms,
      status,
      fitness_doc,
      insurance_doc,
      national_permit_doc,
      state_permit_doc,
      road_tax_doc,
      puc_doc,
    } = req.body;

    if (!truck_no || !make || !model || tonnage_capacity === undefined) {
      res.status(400).json({ error: 'Truck registration number, make, model, and tonnage capacity are required.' });
      return;
    }

    const cleanTruckNo = truck_no.toUpperCase().trim();

    // Check uniqueness within company
    const existing = await Truck.findOne({ truck_no: cleanTruckNo, is_deleted: false });
    if (existing) {
      res.status(400).json({ error: `A vehicle with registration number ${cleanTruckNo} already exists in your fleet.` });
      return;
    }

    const odo = Number(current_odometer_kms) || 0;
    const interval = Number(service_interval_kms) || 10000;

    // Validate dynamic custom fields if configured for this workspace
    let customFieldsData = req.body.custom_fields || {};
    if (req.company) {
      // In-controller truck quota enforcement against concurrent bypass
      const entitlements = await getTenantEntitlements(req.company);
      const limit = entitlements.limits.max_trucks;
      if (limit !== -1) {
        const currentCount = await Truck.countDocuments({ company_id: req.company._id, is_deleted: false });
        if (currentCount >= limit) {
          res.status(403).json({
            code: 'QUOTA_EXCEEDED',
            resource: 'trucks',
            limit,
            current: currentCount,
            error: `Truck quota exceeded (${currentCount}/${limit}). Upgrade your plan or purchase a fleet booster to register more vehicles.`,
          });
          return;
        }
      }

      const customValidation = await validateCustomFieldsPayload(req.company._id, 'Truck', customFieldsData);
      if (!customValidation.success) {
        res.status(400).json({ error: customValidation.errors?.[0] || 'Custom field validation failed.' });
        return;
      }
      customFieldsData = customValidation.data || customFieldsData;
    }

    const truck = await Truck.create({
      truck_no: cleanTruckNo,
      make: make.trim(),
      model: model.trim(),
      year: year ? Number(year) : undefined,
      body_type: body_type || 'Open',
      tonnage_capacity: Number(tonnage_capacity),
      cbm_capacity: cbm_capacity ? Number(cbm_capacity) : 0,
      current_odometer_kms: odo,
      last_service_kms: odo,
      service_interval_kms: interval,
      next_service_due_kms: odo + interval,
      status: status || 'available',
      fitness_doc,
      insurance_doc,
      national_permit_doc,
      state_permit_doc,
      road_tax_doc,
      puc_doc,
      custom_fields: customFieldsData,
    });

    res.status(201).json({
      message: `Vehicle ${truck.truck_no} registered successfully.`,
      truck,
    });
  } catch (error: any) {
    console.error('Error creating truck:', error);
    res.status(500).json({ error: error.message || 'Failed to create vehicle.' });
  }
}

/**
 * 4. updateTruck
 * ----------------------------------------------------------------------------
 * Updates vehicle mechanical specifications, odometer readings, and statutory
 * compliance documents.
 */
export async function updateTruck(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      truck_no,
      make,
      model,
      year,
      body_type,
      tonnage_capacity,
      cbm_capacity,
      current_odometer_kms,
      last_service_kms,
      service_interval_kms,
      status,
      fitness_doc,
      insurance_doc,
      national_permit_doc,
      state_permit_doc,
      road_tax_doc,
      puc_doc,
    } = req.body;

    const truck = await Truck.findOne({ _id: id, is_deleted: false });
    if (!truck) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    // Check unique truck_no if modified
    if (truck_no && truck_no.toUpperCase().trim() !== truck.truck_no) {
      const cleanNo = truck_no.toUpperCase().trim();
      const existing = await Truck.findOne({ truck_no: cleanNo, _id: { $ne: id }, is_deleted: false });
      if (existing) {
        res.status(400).json({ error: `Registration number ${cleanNo} is already registered to another vehicle.` });
        return;
      }
      truck.truck_no = cleanNo;
    }

    if (make) truck.make = make.trim();
    if (model) truck.model = model.trim();
    if (year !== undefined) truck.year = Number(year);
    if (body_type) truck.body_type = body_type;
    if (tonnage_capacity !== undefined) truck.tonnage_capacity = Number(tonnage_capacity);
    if (cbm_capacity !== undefined) truck.cbm_capacity = Number(cbm_capacity);
    if (status) truck.status = status;

    if (current_odometer_kms !== undefined) {
      truck.current_odometer_kms = Number(current_odometer_kms);
    }
    if (last_service_kms !== undefined) {
      truck.last_service_kms = Number(last_service_kms);
    }
    if (service_interval_kms !== undefined) {
      truck.service_interval_kms = Number(service_interval_kms);
      truck.next_service_due_kms = truck.last_service_kms + truck.service_interval_kms;
    }

    // Update compliance document vault records
    if (fitness_doc !== undefined) truck.fitness_doc = fitness_doc;
    if (insurance_doc !== undefined) truck.insurance_doc = insurance_doc;
    if (national_permit_doc !== undefined) truck.national_permit_doc = national_permit_doc;
    if (state_permit_doc !== undefined) truck.state_permit_doc = state_permit_doc;
    if (road_tax_doc !== undefined) truck.road_tax_doc = road_tax_doc;
    if (puc_doc !== undefined) truck.puc_doc = puc_doc;

    // Validate and update custom fields
    if (req.body.custom_fields !== undefined && req.company) {
      const mergedFields = { ...(truck.custom_fields || {}), ...req.body.custom_fields };
      const customValidation = await validateCustomFieldsPayload(req.company._id, 'Truck', mergedFields);
      if (!customValidation.success) {
        res.status(400).json({ error: customValidation.errors?.[0] || 'Custom field validation failed.' });
        return;
      }
      truck.custom_fields = customValidation.data || mergedFields;
    }

    await truck.save();

    res.json({
      message: `Vehicle ${truck.truck_no} updated successfully.`,
      truck,
    });
  } catch (error: any) {
    console.error('Error updating truck:', error);
    res.status(500).json({ error: error.message || 'Failed to update vehicle.' });
  }
}

/**
 * 5. deleteTruck
 * ----------------------------------------------------------------------------
 * Soft-deletes a vehicle from the active fleet and atomically detaches any
 * currently assigned driver while closing active assignment history records.
 */
export async function deleteTruck(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const companyId = req.tenant?.id;

    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid vehicle ID format.' });
      return;
    }

    const truck = await Truck.findOne({ _id: id, company_id: companyId, is_deleted: false });
    if (!truck) {
      const foreignTruck = await Truck.findOne({ _id: id, is_deleted: false }, '_id', { skipTenantCheck: true });
      if (foreignTruck) {
        res.status(403).json({ error: 'Invalid vehicle reference: Vehicle does not belong to your workspace.' });
        return;
      }
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    await runInTransaction(async (session) => {
      const sessTruck = await Truck.findOne({ _id: id, company_id: companyId, is_deleted: false }).session(session);
      if (!sessTruck) {
        const err: any = new Error('Vehicle not found.');
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();

      // Unassign driver if currently attached
      if (sessTruck.current_driver_id) {
        const driverId = sessTruck.current_driver_id;

        // Close open assignment in truck.driver_assignments
        for (let i = sessTruck.driver_assignments.length - 1; i >= 0; i--) {
          const entry = sessTruck.driver_assignments[i];
          if (String(entry.driver_id) === String(driverId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
        sessTruck.current_driver_id = undefined;

        // Close open assignment in driver.assignment_history & unset current_truck_id
        const sessDriver = await Driver.findOne({ _id: driverId, company_id: companyId, is_deleted: false }).session(session);
        if (sessDriver) {
          for (let i = sessDriver.assignment_history.length - 1; i >= 0; i--) {
            const entry = sessDriver.assignment_history[i];
            if (String(entry.truck_id) === String(sessTruck._id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          sessDriver.current_truck_id = undefined;
          await sessDriver.save({ session });
          await Driver.updateOne(
            { _id: driverId, company_id: companyId },
            { $unset: { current_truck_id: 1 } },
            { session }
          );
        }
      }

      sessTruck.is_deleted = true;
      sessTruck.status = 'decommissioned';
      await sessTruck.save({ session });

      await Truck.updateOne(
        { _id: sessTruck._id, company_id: companyId },
        { $unset: { current_driver_id: 1 } },
        { session }
      );

      await logAuditEvent({
        company_id: companyId,
        entity_type: 'truck' as any,
        entity_id: sessTruck._id,
        entity_identifier: sessTruck.truck_no,
        action: 'DELETE',
        description: `Vehicle ${sessTruck.truck_no} decommissioned and removed from active fleet.`,
        req,
        session,
        after_snapshot: {
          is_deleted: true,
          status: 'decommissioned',
          current_driver_id: null,
        },
      });
    });

    res.json({ message: `Vehicle ${truck.truck_no} removed from fleet.` });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
      return;
    }
    console.error('Error deleting truck:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete vehicle.' });
  }
}

/**
 * 6. assignDriver
 * ----------------------------------------------------------------------------
 * Atomically binds a driver to a vehicle asset while maintaining historical
 * assignment logs on both Driver and Truck records.
 * Uses MongoDB ACID transactions and explicit $unset operations to guarantee
 * dual-pointer consistency and prevent orphaned pointers.
 */
export async function assignDriver(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { driverId, notes } = req.body;

    if (!driverId) {
      res.status(400).json({ error: 'Driver ID is required for assignment.' });
      return;
    }

    const companyId = req.tenant?.id;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized: Tenant context required.' });
      return;
    }

    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(driverId)) {
      res.status(400).json({ error: 'Invalid ID format.' });
      return;
    }

    // Tenant Scoping & Ownership Validation
    const [truck, driver] = await Promise.all([
      Truck.findOne({ _id: id, company_id: companyId, is_deleted: false }),
      Driver.findOne({ _id: driverId, company_id: companyId, is_deleted: false }),
    ]);

    if (!truck) {
      const foreignTruck = await Truck.findOne({ _id: id, is_deleted: false }, '_id', { skipTenantCheck: true });
      if (foreignTruck) {
        res.status(403).json({ error: 'Invalid vehicle reference: Vehicle does not belong to your workspace.' });
        return;
      }
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    if (!driver) {
      const foreignDriver = await Driver.findOne({ _id: driverId, is_deleted: false }, '_id', { skipTenantCheck: true });
      if (foreignDriver) {
        res.status(403).json({ error: 'Invalid driver reference: Driver does not belong to your workspace.' });
        return;
      }
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }

    // Execute atomic reconciliation in a MongoDB ACID transaction
    const result = await runInTransaction(async (session) => {
      const sessTruck = await Truck.findOne({ _id: id, company_id: companyId, is_deleted: false }).session(session);
      const sessDriver = await Driver.findOne({ _id: driverId, company_id: companyId, is_deleted: false }).session(session);

      if (!sessTruck) {
        const err: any = new Error('Vehicle not found.');
        err.statusCode = 404;
        throw err;
      }
      if (!sessDriver) {
        const err: any = new Error('Driver not found.');
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();

      // Case: Already assigned to each other
      if (
        String(sessTruck.current_driver_id || '') === String(sessDriver._id) &&
        String(sessDriver.current_truck_id || '') === String(sessTruck._id)
      ) {
        return {
          truck: sessTruck,
          driver: sessDriver,
          message: `Driver ${sessDriver.name} is already assigned to ${sessTruck.truck_no}.`,
        };
      }

      // Step 1: If truck already has a different driver assigned, detach that old driver
      if (sessTruck.current_driver_id && String(sessTruck.current_driver_id) !== String(sessDriver._id)) {
        const oldDriverId = sessTruck.current_driver_id;
        const oldDriver = await Driver.findOne({ _id: oldDriverId, company_id: companyId, is_deleted: false }).session(session);

        if (oldDriver) {
          // Close open assignment in old driver's assignment_history
          for (let i = oldDriver.assignment_history.length - 1; i >= 0; i--) {
            const entry = oldDriver.assignment_history[i];
            if (String(entry.truck_id) === String(sessTruck._id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          oldDriver.current_truck_id = undefined;
          await oldDriver.save({ session });
          // Guarantee explicit MongoDB $unset
          await Driver.updateOne(
            { _id: oldDriverId, company_id: companyId },
            { $unset: { current_truck_id: 1 } },
            { session }
          );
        }

        // Close open assignment in sessTruck.driver_assignments for oldDriverId
        for (let i = sessTruck.driver_assignments.length - 1; i >= 0; i--) {
          const entry = sessTruck.driver_assignments[i];
          if (String(entry.driver_id) === String(oldDriverId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
      }

      // Step 2: If driver is currently assigned to a different truck, detach that old truck
      if (sessDriver.current_truck_id && String(sessDriver.current_truck_id) !== String(sessTruck._id)) {
        const oldTruckId = sessDriver.current_truck_id;
        const oldTruck = await Truck.findOne({ _id: oldTruckId, company_id: companyId, is_deleted: false }).session(session);

        if (oldTruck) {
          // Close open assignment in old truck's driver_assignments
          for (let i = oldTruck.driver_assignments.length - 1; i >= 0; i--) {
            const entry = oldTruck.driver_assignments[i];
            if (String(entry.driver_id) === String(sessDriver._id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          oldTruck.current_driver_id = undefined;
          await oldTruck.save({ session });
          // Guarantee explicit MongoDB $unset
          await Truck.updateOne(
            { _id: oldTruckId, company_id: companyId },
            { $unset: { current_driver_id: 1 } },
            { session }
          );
        }

        // Close open assignment in sessDriver.assignment_history for oldTruckId
        for (let i = sessDriver.assignment_history.length - 1; i >= 0; i--) {
          const entry = sessDriver.assignment_history[i];
          if (String(entry.truck_id) === String(oldTruckId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
      }

      // Step 3: Attach driver to truck
      sessTruck.current_driver_id = sessDriver._id as any;
      sessTruck.driver_assignments.push({
        driver_id: sessDriver._id as any,
        assigned_at: now,
        notes: notes || `Assigned to ${sessDriver.name}`,
      });
      await sessTruck.save({ session });

      // Step 4: Attach truck to driver
      sessDriver.current_truck_id = sessTruck._id as any;
      sessDriver.assignment_history.push({
        truck_id: sessTruck._id as any,
        assigned_at: now,
        notes: notes || `Assigned to ${sessTruck.truck_no}`,
      });
      await sessDriver.save({ session });

      // Step 5: Audit Log
      await logAuditEvent({
        company_id: companyId,
        entity_type: 'truck' as any,
        entity_id: sessTruck._id,
        entity_identifier: sessTruck.truck_no,
        action: 'UPDATE',
        description: `Driver ${sessDriver.name} assigned to vehicle ${sessTruck.truck_no}.`,
        req,
        session,
        after_snapshot: {
          current_driver_id: sessDriver._id,
          assigned_at: now,
          notes,
        },
      });

      return {
        truck: sessTruck,
        driver: sessDriver,
        message: `Driver ${sessDriver.name} assigned to ${sessTruck.truck_no}.`,
      };
    });

    res.json(result);
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
      return;
    }
    console.error('Error assigning driver to truck:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to assign driver.' });
  }
}

/**
 * 7. unassignDriver
 * ----------------------------------------------------------------------------
 * Detaches the current driver from a vehicle.
 * Uses MongoDB ACID transactions and explicit $unset operations to guarantee
 * dual-pointer consistency and close open historical assignment records.
 */
export async function unassignDriver(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const companyId = req.tenant?.id;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized: Tenant context required.' });
      return;
    }

    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid vehicle ID format.' });
      return;
    }

    const truck = await Truck.findOne({ _id: id, company_id: companyId, is_deleted: false });
    if (!truck) {
      const foreignTruck = await Truck.findOne({ _id: id, is_deleted: false }, '_id', { skipTenantCheck: true });
      if (foreignTruck) {
        res.status(403).json({ error: 'Invalid vehicle reference: Vehicle does not belong to your workspace.' });
        return;
      }
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    if (!truck.current_driver_id) {
      res.status(400).json({ error: 'No driver is currently assigned to this vehicle.' });
      return;
    }

    const result = await runInTransaction(async (session) => {
      const sessTruck = await Truck.findOne({ _id: id, company_id: companyId, is_deleted: false }).session(session);
      if (!sessTruck) {
        const err: any = new Error('Vehicle not found.');
        err.statusCode = 404;
        throw err;
      }

      if (!sessTruck.current_driver_id) {
        const err: any = new Error('No driver is currently assigned to this vehicle.');
        err.statusCode = 400;
        throw err;
      }

      const driverId = sessTruck.current_driver_id;
      const now = new Date();

      // Step 1: Update truck - close open assignment & unset current_driver_id
      for (let i = sessTruck.driver_assignments.length - 1; i >= 0; i--) {
        const entry = sessTruck.driver_assignments[i];
        if (String(entry.driver_id) === String(driverId) && !entry.unassigned_at) {
          entry.unassigned_at = now;
          break;
        }
      }
      sessTruck.current_driver_id = undefined;
      await sessTruck.save({ session });
      await Truck.updateOne(
        { _id: sessTruck._id, company_id: companyId },
        { $unset: { current_driver_id: 1 } },
        { session }
      );

      // Step 2: Update driver - close open assignment history & unset current_truck_id
      const sessDriver = await Driver.findOne({ _id: driverId, company_id: companyId, is_deleted: false }).session(session);
      if (sessDriver) {
        for (let i = sessDriver.assignment_history.length - 1; i >= 0; i--) {
          const entry = sessDriver.assignment_history[i];
          if (String(entry.truck_id) === String(sessTruck._id) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
        sessDriver.current_truck_id = undefined;
        await sessDriver.save({ session });
        await Driver.updateOne(
          { _id: driverId, company_id: companyId },
          { $unset: { current_truck_id: 1 } },
          { session }
        );
      }

      // Step 3: Audit Log
      await logAuditEvent({
        company_id: companyId,
        entity_type: 'truck' as any,
        entity_id: sessTruck._id,
        entity_identifier: sessTruck.truck_no,
        action: 'UPDATE',
        description: `Driver ${sessDriver ? sessDriver.name : driverId} detached from vehicle ${sessTruck.truck_no}.`,
        req,
        session,
        after_snapshot: {
          current_driver_id: null,
          unassigned_at: now,
        },
      });

      return {
        truck: sessTruck,
        message: `Driver detached from vehicle ${sessTruck.truck_no}.`,
      };
    });

    res.json(result);
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
      return;
    }
    console.error('Error unassigning driver:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to unassign driver.' });
  }
}
