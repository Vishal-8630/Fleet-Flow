/**
 * ============================================================================
 * FLEET FLOW — DRIVER CONTROLLER (driverController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * Handles driver onboarding, KYC credentials (License, Aadhaar), status transitions,
 * PII masking, vehicle assignments, and advance balance ledgers.
 * 
 * WHY IS IT STRUCTURED THIS WAY?
 * ------------------------------
 * - PII Masking: Automatically masks 12-digit Indian Aadhaar numbers (`XXXX-XXXX-1234`)
 *   when viewed by users without `admin` or `accountant` privileges.
 * - Server-Side Pagination: Queries MongoDB with indexed tenant scoping, search regex,
 *   and status filters.
 * - Unlink Safeguard: Soft-deleting a driver automatically detaches them from their
 *   current vehicle so fleet dispatch records remain clean.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Driver, IDriver, DriverStatus } from '../models/Driver.js';
import { Truck } from '../models/Truck.js';
import { validateCustomFieldsPayload } from '../utils/customFieldValidator.js';

/**
 * 1. listDrivers
 * ----------------------------------------------------------------------------
 * Retrieves a paginated list of company drivers with PII masking and roster KPIs.
 */
export async function listDrivers(req: Request, res: Response): Promise<void> {
  try {
    const userRole = req.tenant?.role || 'viewer';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const q = (req.query.q as string)?.trim();
    const status = req.query.status as DriverStatus;

    const filter: any = { is_deleted: false };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { license_number: { $regex: q, $options: 'i' } },
      ];
    }

    if (status && ['active', 'on_leave', 'terminated'].includes(status)) {
      filter.status = status;
    }

    const [rawDrivers, total, allDrivers] = await Promise.all([
      Driver.find(filter)
        .populate('current_truck_id', 'truck_no make model status')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Driver.countDocuments(filter),
      Driver.find({ is_deleted: false }, 'status current_truck_id'),
    ]);

    // Apply role-based PII masking
    const drivers = rawDrivers.map((d) => d.toSafeJSON(userRole));

    // Calculate Driver KPIs
    let activeCount = 0;
    let onLeaveCount = 0;
    let terminatedCount = 0;
    let assignedCount = 0;

    for (const d of allDrivers) {
      if (d.status === 'active') activeCount++;
      else if (d.status === 'on_leave') onLeaveCount++;
      else if (d.status === 'terminated') terminatedCount++;

      if (d.current_truck_id) assignedCount++;
    }

    res.json({
      drivers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: allDrivers.length,
        active: activeCount,
        on_leave: onLeaveCount,
        terminated: terminatedCount,
        assigned: assignedCount,
        unassigned: allDrivers.length - assignedCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to retrieve drivers.' });
  }
}

/**
 * 2. getDriverById
 * ----------------------------------------------------------------------------
 * Retrieves a single driver's full profile, vehicle history, and advance balances.
 */
export async function getDriverById(req: Request, res: Response): Promise<void> {
  try {
    const userRole = req.tenant?.role || 'viewer';
    const { id } = req.params;

    const driver = await Driver.findOne({ _id: id, is_deleted: false })
      .populate('current_truck_id', 'truck_no make model body_type status')
      .populate('assignment_history.truck_id', 'truck_no make model');

    if (!driver) {
      res.status(404).json({ error: 'Driver profile not found.' });
      return;
    }

    res.json({ driver: driver.toSafeJSON(userRole) });
  } catch (error: any) {
    console.error('Error fetching driver profile:', error);
    res.status(500).json({ error: 'Failed to retrieve driver profile.' });
  }
}

/**
 * 3. createDriver
 * ----------------------------------------------------------------------------
 * Registers a new commercial vehicle driver with identity KYC credentials.
 */
export async function createDriver(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      photo_url,
      phone,
      emergency_phone,
      address,
      date_of_birth,
      license_number,
      license_expiry_date,
      license_front_url,
      license_back_url,
      aadhaar_number,
      aadhaar_front_url,
      aadhaar_back_url,
      running_advance_balance,
      status,
    } = req.body;

    if (!name || !phone || !license_number) {
      res.status(400).json({ error: 'Driver name, phone number, and commercial license number are required.' });
      return;
    }

    const cleanLicense = license_number.toUpperCase().trim();

    // Check unique license number within company
    const existing = await Driver.findOne({ license_number: cleanLicense, is_deleted: false });
    if (existing) {
      res.status(400).json({ error: `Driver with license number ${cleanLicense} already exists in your workspace.` });
      return;
    }

    // Validate dynamic custom fields if configured
    let customFieldsData = req.body.custom_fields || {};
    if (req.company) {
      const customValidation = await validateCustomFieldsPayload(req.company._id, 'Driver', customFieldsData);
      if (!customValidation.success) {
        res.status(400).json({ error: customValidation.errors?.[0] || 'Custom field validation failed.' });
        return;
      }
      customFieldsData = customValidation.data || customFieldsData;
    }

    const driver = await Driver.create({
      name: name.trim(),
      photo_url,
      phone: phone.trim(),
      emergency_phone: emergency_phone?.trim(),
      address: address?.trim(),
      date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
      license_number: cleanLicense,
      license_expiry_date: license_expiry_date ? new Date(license_expiry_date) : undefined,
      license_front_url,
      license_back_url,
      aadhaar_number: aadhaar_number?.trim(),
      aadhaar_front_url,
      aadhaar_back_url,
      running_advance_balance: Number(running_advance_balance) || 0,
      status: status || 'active',
      custom_fields: customFieldsData,
    });

    res.status(201).json({
      message: `Driver ${driver.name} registered successfully.`,
      driver: driver.toSafeJSON(req.tenant?.role),
    });
  } catch (error: any) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: error.message || 'Failed to create driver.' });
  }
}

/**
 * 4. updateDriver
 * ----------------------------------------------------------------------------
 * Updates driver contact info, KYC documents, and active status.
 */
export async function updateDriver(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name,
      photo_url,
      phone,
      emergency_phone,
      address,
      date_of_birth,
      license_number,
      license_expiry_date,
      license_front_url,
      license_back_url,
      aadhaar_number,
      aadhaar_front_url,
      aadhaar_back_url,
      running_advance_balance,
      status,
    } = req.body;

    const driver = await Driver.findOne({ _id: id, is_deleted: false });
    if (!driver) {
      res.status(404).json({ error: 'Driver profile not found.' });
      return;
    }

    // Check unique license if modified
    if (license_number && license_number.toUpperCase().trim() !== driver.license_number) {
      const cleanLicense = license_number.toUpperCase().trim();
      const existing = await Driver.findOne({
        license_number: cleanLicense,
        _id: { $ne: id },
        is_deleted: false,
      });
      if (existing) {
        res.status(400).json({ error: `License number ${cleanLicense} is already registered to another driver.` });
        return;
      }
      driver.license_number = cleanLicense;
    }

    if (name) driver.name = name.trim();
    if (photo_url !== undefined) driver.photo_url = photo_url;
    if (phone) driver.phone = phone.trim();
    if (emergency_phone !== undefined) driver.emergency_phone = emergency_phone?.trim();
    if (address !== undefined) driver.address = address?.trim();
    if (date_of_birth !== undefined) driver.date_of_birth = date_of_birth ? new Date(date_of_birth) : undefined;
    if (license_expiry_date !== undefined) driver.license_expiry_date = license_expiry_date ? new Date(license_expiry_date) : undefined;
    if (license_front_url !== undefined) driver.license_front_url = license_front_url;
    if (license_back_url !== undefined) driver.license_back_url = license_back_url;
    if (aadhaar_number !== undefined) driver.aadhaar_number = aadhaar_number?.trim();
    if (aadhaar_front_url !== undefined) driver.aadhaar_front_url = aadhaar_front_url;
    if (aadhaar_back_url !== undefined) driver.aadhaar_back_url = aadhaar_back_url;
    if (running_advance_balance !== undefined) driver.running_advance_balance = Number(running_advance_balance);
    if (status) driver.status = status;

    if (req.body.custom_fields !== undefined && req.company) {
      const merged = { ...(driver.custom_fields || {}), ...req.body.custom_fields };
      const customValidation = await validateCustomFieldsPayload(req.company._id, 'Driver', merged);
      if (!customValidation.success) {
        res.status(400).json({ error: customValidation.errors?.[0] || 'Custom field validation failed.' });
        return;
      }
      driver.custom_fields = customValidation.data || merged;
    }

    await driver.save();

    res.json({
      message: `Driver profile for ${driver.name} updated successfully.`,
      driver: driver.toSafeJSON(req.tenant?.role),
    });
  } catch (error: any) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: error.message || 'Failed to update driver.' });
  }
}

/**
 * 5. deleteDriver
 * ----------------------------------------------------------------------------
 * Soft-deletes a driver and detaches them from any active truck assignment.
 */
export async function deleteDriver(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const driver = await Driver.findOne({ _id: id, is_deleted: false });
    if (!driver) {
      res.status(404).json({ error: 'Driver profile not found.' });
      return;
    }

    // Detach from truck if currently assigned
    if (driver.current_truck_id) {
      await Truck.updateOne(
        { _id: driver.current_truck_id },
        { current_driver_id: undefined }
      );
    }

    driver.is_deleted = true;
    driver.status = 'terminated';
    await driver.save();

    res.json({ message: `Driver ${driver.name} removed from active roster.` });
  } catch (error: any) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Failed to delete driver.' });
  }
}
