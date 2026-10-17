/**
 * ============================================================================
 * FLEET FLOW — TRUCK JOURNEY & TRIP DISPATCH CONTROLLER (journeyController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Manages the complete lifecycle of fleet journeys and vehicle dispatch operations:
 * 1. Journey Planning & Sequential Generation (`JRN-0001` or Company Prefix).
 * 2. Resource Conflict Prevention:
 *    - Rejects dispatch if the assigned Truck or Driver is already in transit
 *      on another active journey (HTTP 409 Conflict).
 *    - Rejects dispatch if Truck compliance documents are EXPIRED unless permitted.
 * 3. Operational State Transitions:
 *    - `draft` -> `active` (Dispatched: Locks Truck to `on_trip`).
 *    - `active` -> `delayed` (Logged via en-route delay incidents).
 *    - `active` -> `completed` (Delivery confirmed, POD uploaded, releases Truck to `available`).
 *    - `active` -> `cancelled` (Releases resources back to pool).
 * 4. Milestone & Location Check-ins.
 * 5. Diesel Fuel Stops & Automatic Fuel Economy (km/L) Computation.
 * 6. Driver Cash Advance & En-Route Expense Audit.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TruckJourney, JourneyStatus } from '../models/TruckJourney.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { Company } from '../models/Company.js';
import { Branch } from '../models/Branch.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { BillingParty } from '../models/BillingParty.js';
import { Settlement } from '../models/Settlement.js';
import { notifyTripDispatched, notifyDeliveryCompleted } from '../utils/notificationService.js';
import { logAuditEvent } from '../utils/auditService.js';
import { validateTenantOwnership, TenantOwnershipError } from '../utils/ownershipValidator.js';
import { postFuelExpenseJournal, postDoubleEntryJournal } from '../utils/ledgerService.js';
import { runInTransaction, ConfigurationError } from '../utils/transactionHelper.js';
import { evaluateCustomerCreditExposure } from '../services/creditExposureService.js';
import { roundMoney } from '../utils/settlementCalculator.js';

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/journeys
 * List journeys with multi-criteria filtering, search, and pagination
 * ----------------------------------------------------------------------------
 */
export const getJourneys = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;

    const { status, truck_id, driver_id, search, from_date, to_date, branch_id } = req.query;

    const filter: any = { is_deleted: { $ne: true } };

    if (branch_id) {
      const branch = await Branch.findOne({ _id: branch_id, company_id: req.tenant?.id });
      if (!branch) {
        return res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
      }
      filter.branch_id = branch._id;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (truck_id) {
      filter.truck_id = truck_id;
    }

    if (driver_id) {
      filter.driver_id = driver_id;
    }

    if (from_date || to_date) {
      filter.start_date = {};
      if (from_date) filter.start_date.$gte = new Date(from_date as string);
      if (to_date) filter.start_date.$lte = new Date(to_date as string);
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$or = [
        { journey_number: searchRegex },
        { 'from_location.city': searchRegex },
        { 'to_location.city': searchRegex },
        { last_known_location: searchRegex },
        { cargo_description: searchRegex },
      ];
    }

    const [journeys, total] = await Promise.all([
      TruckJourney.find(filter)
        .populate('truck_id', 'truck_no make model body_type status')
        .populate('driver_id', 'name phone license_number status')
        .populate('billing_party_id', 'name trade_name gstin billing_address')
        .populate('branch_id', 'branch_name branch_code is_head_office')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TruckJourney.countDocuments(filter),
    ]);

    return res.json({
      journeys,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('getJourneys error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch journeys.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/journeys/metrics
 * Returns real-time KPI metrics for operational fleet dispatch
 * ----------------------------------------------------------------------------
 */
export const getJourneyMetrics = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;

    const [activeCount, delayedCount, draftCount, completedMonthCount] = await Promise.all([
      TruckJourney.countDocuments({ company_id: companyId, status: 'active', is_deleted: false }),
      TruckJourney.countDocuments({ company_id: companyId, status: 'delayed', is_deleted: false }),
      TruckJourney.countDocuments({ company_id: companyId, status: 'draft', is_deleted: false }),
      TruckJourney.countDocuments({
        company_id: companyId,
        status: 'completed',
        is_deleted: false,
        actual_end_date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    ]);

    const companyObjectId = new Types.ObjectId(String(companyId));

    // Aggregate total diesel and average mileage across journeys this month
    const mileageAgg = await TruckJourney.aggregate([
      {
        $match: {
          company_id: companyObjectId,
          status: { $in: ['active', 'completed', 'delayed'] },
          is_deleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalDistance: { $sum: '$total_distance_kms' },
          totalDiesel: { $sum: '$total_diesel_litres' },
          totalDieselCost: { $sum: '$total_diesel_cost' },
        },
      },
    ]);

    const totalDistance = mileageAgg[0]?.totalDistance || 0;
    const totalDiesel = mileageAgg[0]?.totalDiesel || 0;
    const totalDieselCost = mileageAgg[0]?.totalDieselCost || 0;
    const avgMileage = totalDiesel > 0 ? Math.round((totalDistance / totalDiesel) * 100) / 100 : 0;

    return res.json({
      activeJourneys: activeCount,
      delayedJourneys: delayedCount,
      draftJourneys: draftCount,
      completedThisMonth: completedMonthCount,
      totalDistanceKms: totalDistance,
      totalDieselLitres: totalDiesel,
      totalDieselCost: totalDieselCost,
      averageMileageKmPerLitre: avgMileage,
    });
  } catch (error: any) {
    console.error('getJourneyMetrics error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch journey metrics.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/journeys/:id
 * Retrieve comprehensive details for a single journey
 * ----------------------------------------------------------------------------
 */
export const getJourneyById = async (req: Request, res: Response) => {
  try {
    const journey = await TruckJourney.findById(req.params.id)
      .populate('truck_id')
      .populate('driver_id')
      .populate('billing_party_id')
      .populate('branch_id', 'branch_name branch_code is_head_office')
      .populate('status_history.actor_id', 'name email role');

    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    return res.json({ journey });
  } catch (error: any) {
    console.error('getJourneyById error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch journey details.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys
 * Create a new planned journey in 'draft' or 'active' state with conflict checks
 * ----------------------------------------------------------------------------
 */
export const createJourney = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      truck_id,
      driver_id,
      billing_party_id,
      from_location,
      to_location,
      route_checkpoints,
      start_date,
      estimated_duration_days,
      start_odometer_kms,
      loaded_weight_tonnes,
      cbm_volume,
      cargo_description,
      freight_rate,
      starting_cash_advance,
      status = 'draft',
    } = req.body;

    if (!truck_id || !driver_id || !from_location?.city || !to_location?.city) {
      return res.status(400).json({
        error: 'Truck, Driver, Origin City, and Destination City are mandatory fields.',
      });
    }

    // 1. Validate Deep Tenant Foreign Key Ownership (Anti-IDOR)
    await validateTenantOwnership(companyId!, {
      truck_id,
      driver_id,
      billing_party_id: req.body.billing_party_id,
    });

    // 2. Fetch Truck & Driver
    const [truck, driver, company] = await Promise.all([
      Truck.findById(truck_id),
      Driver.findById(driver_id),
      Company.findById(companyId),
    ]);

    if (!truck || truck.is_deleted) {
      return res.status(404).json({ error: 'Selected vehicle not found or decommissioned.' });
    }
    if (!driver || driver.is_deleted) {
      return res.status(404).json({ error: 'Selected driver not found or inactive.' });
    }

    // 3. RESOURCE CONFLICT CHECK: Verify Truck is not on an active journey
    const activeTruckJourney = await TruckJourney.findOne({
      truck_id,
      status: { $in: ['active', 'delayed'] },
      is_deleted: false,
    });
    if (activeTruckJourney) {
      return res.status(409).json({
        error: `Conflict: Vehicle ${truck.truck_no} is already dispatched on active journey ${activeTruckJourney.journey_number}.`,
      });
    }

    // 4. RESOURCE CONFLICT CHECK: Verify Driver is not on an active journey
    const activeDriverJourney = await TruckJourney.findOne({
      driver_id,
      status: { $in: ['active', 'delayed'] },
      is_deleted: false,
    });
    if (activeDriverJourney) {
      return res.status(409).json({
        error: `Conflict: Driver ${driver.name} is already operating active journey ${activeDriverJourney.journey_number}.`,
      });
    }

    let overrideAuditParams: any = null;

    // 5. Check compliance if immediately dispatching
    if (status === 'active') {
      const compliance = truck.calculateComplianceStatus();
      if (compliance === 'EXPIRED') {
        return res.status(422).json({
          error: `Compliance Alert: Vehicle ${truck.truck_no} has expired statutory documents. Renew certificates before dispatching.`,
        });
      }

      // Check Customer Credit Exposure (DEC-007 Option B)
      if (billing_party_id) {
        const exposureResult = await evaluateCustomerCreditExposure({
          company_id: companyId!,
          customer_id: billing_party_id,
          new_order_amount: freight_rate || 0,
        });

        if (exposureResult.is_breached) {
          if (!req.body.credit_override) {
            return res.status(409).json({
              code: 'CREDIT_LIMIT_EXCEEDED',
              error: `Credit limit exceeded for customer ${exposureResult.customer_name}. Company Admin authorization required to dispatch.`,
              details: exposureResult,
            });
          }

          const userRole = req.tenant?.role || req.member?.role || (req as any).membership?.role || (req as any).user?.role;
          const isCompanyAdmin =
            userRole === 'admin' || (req as any).user?.is_superadmin || (req as any).user?.role === 'superadmin';

          if (!isCompanyAdmin) {
            return res.status(403).json({
              code: 'CREDIT_OVERRIDE_UNAUTHORIZED',
              error: 'Credit limit exceeded. Company Admin authorization required to dispatch.',
              details: exposureResult,
            });
          }

          const overrideReason = (req.body.override_reason || '').trim();
          if (overrideReason.length < 10) {
            return res.status(400).json({
              code: 'JUSTIFICATION_REQUIRED',
              error: 'A valid business justification (minimum 10 characters) is required to override credit limit.',
            });
          }

          overrideAuditParams = {
            company_id: companyId!,
            entity_type: 'party',
            entity_id: billing_party_id,
            entity_identifier: exposureResult.customer_name,
            action: 'OVERRIDE',
            description: `Credit limit override authorized for ${exposureResult.customer_name} on new journey: ${overrideReason}`,
            req,
            before_snapshot: {
              credit_limit: exposureResult.credit_limit,
              current_exposure: exposureResult.current_exposure,
            },
            after_snapshot: {
              projected_exposure: exposureResult.projected_exposure,
              overage_amount: exposureResult.overage_amount,
              override_reason: overrideReason,
            },
          };
        }
      }
    }

    // 6. Validate or Auto-Resolve Operational Regional Branch (DEC-010)
    let branch: any = null;
    if (req.body.branch_id) {
      branch = await Branch.findOne({ _id: req.body.branch_id, company_id: companyId });
      if (!branch) {
        return res.status(404).json({ error: 'Selected regional branch not found in your workspace.' });
      }
      if (!branch.is_active) {
        return res.status(400).json({ error: 'Cannot dispatch trip for an inactive regional branch.' });
      }
    } else {
      const activeBranches = await Branch.find({ company_id: companyId, is_active: true });
      if (activeBranches.length === 1) {
        // Frictionless auto-assignment for single-branch workspaces
        branch = activeBranches[0];
      } else if (activeBranches.length > 1) {
        // Multi-branch workspaces: default to user's assigned branch or Head Office
        const memberId = req.member?._id || (req as any).membership?._id || (req as any).user?._id;
        let defaultBranch: any = null;
        if (memberId) {
          defaultBranch = activeBranches.find((b) =>
            b.member_ids?.some((m) => m.toString() === memberId.toString())
          );
        }
        if (!defaultBranch) {
          defaultBranch = activeBranches.find((b) => b.is_head_office);
        }
        if (defaultBranch) {
          branch = defaultBranch;
        } else {
          return res.status(400).json({
            error: 'Active regional branch is required for trip dispatch in multi-branch workspaces.',
          });
        }
      }
    }

    // 7. Concurrency-Safe Atomic Sequential Journey Number
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $inc: { 'counters.journey_seq': 1 } },
      { new: true, upsert: false }
    );
    const seq = updatedCompany?.counters?.journey_seq || (await TruckJourney.countDocuments({ company_id: companyId })) + 1;
    const journey_number = `JRN-${String(seq).padStart(4, '0')}`;

    // 8. Use current truck odometer if start_odometer_kms not supplied
    const initialOdometer =
      typeof start_odometer_kms === 'number' ? start_odometer_kms : truck.current_odometer_kms || 0;

    const journey = new TruckJourney({
      company_id: companyId,
      branch_id: branch?._id || undefined,
      journey_number,
      status,
      status_history: [
        {
          status,
          timestamp: new Date(),
          note: `Journey initialized in ${status.toUpperCase()} state.`,
          actor_id: req.user?.id,
        },
      ],
      truck_id,
      driver_id,
      billing_party_id: billing_party_id || undefined,
      from_location,
      to_location,
      route_checkpoints: route_checkpoints || [],
      start_date: start_date ? new Date(start_date) : new Date(),
      estimated_duration_days: estimated_duration_days || 2,
      start_odometer_kms: initialOdometer,
      loaded_weight_tonnes: loaded_weight_tonnes || 0,
      cbm_volume: cbm_volume || 0,
      cargo_description: cargo_description || '',
      freight_rate: freight_rate || 0,
      starting_cash_advance: starting_cash_advance || 0,
      last_known_location: `${from_location.city} (Origin)`,
      last_location_updated_at: new Date(),
    });

    await journey.save();

    if (overrideAuditParams) {
      await logAuditEvent(overrideAuditParams);
    }

    // 7. If dispatched as active, update vehicle and driver status
    if (status === 'active') {
      truck.status = 'on_trip';
      truck.current_driver_id = driver._id;
      await truck.save();

      if (company) {
        notifyTripDispatched(journey, driver, company).catch((err) =>
          console.error('[Notification Trigger Error - Dispatch]:', err)
        );
      }
    }

    logAuditEvent({
      company_id: companyId,
      entity_type: 'journey',
      entity_id: journey._id,
      entity_identifier: journey.journey_number,
      action: 'CREATE',
      description: `Journey ${journey.journey_number} created in ${status.toUpperCase()} state (${from_location.city} → ${to_location.city}).`,
      req,
      after_snapshot: { journey_number: journey.journey_number, status: journey.status },
    });

    return res.status(201).json({
      message: 'Journey successfully scheduled.',
      journey,
    });
  } catch (error: any) {
    if (error instanceof TenantOwnershipError) {
      return res.status(error.statusCode).json({ error: error.message, entityType: error.entityType });
    }
    console.error('createJourney error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create journey.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/journeys/:id/dispatch
 * Transition a draft journey to 'active' dispatch status
 * ----------------------------------------------------------------------------
 */
export const dispatchJourney = async (req: Request, res: Response) => {
  try {
    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    let overrideAuditParams: any = null;

    if (journey.status !== 'draft') {
      return res.status(400).json({
        error: `Only draft journeys can be dispatched. Current status is ${journey.status}.`,
      });
    }

    // Verify Truck & Driver
    const [truck, driver] = await Promise.all([
      Truck.findById(journey.truck_id),
      Driver.findById(journey.driver_id),
    ]);

    if (!truck || truck.is_deleted) {
      return res.status(400).json({ error: 'Assigned vehicle is unavailable.' });
    }
    if (!driver || driver.is_deleted) {
      return res.status(400).json({ error: 'Assigned driver is unavailable.' });
    }
    if (driver.status !== 'active') {
      return res.status(400).json({
        error: `Assigned driver ${driver.name} is ${driver.status} and cannot be dispatched.`,
      });
    }

    // Re-verify no active conflicts
    const [activeTruckJourney, activeDriverJourney] = await Promise.all([
      TruckJourney.findOne({
        _id: { $ne: journey._id },
        truck_id: journey.truck_id,
        status: { $in: ['active', 'delayed'] },
        is_deleted: false,
      }),
      TruckJourney.findOne({
        _id: { $ne: journey._id },
        driver_id: journey.driver_id,
        status: { $in: ['active', 'delayed'] },
        is_deleted: false,
      }),
    ]);

    if (activeTruckJourney) {
      return res.status(409).json({
        error: `Vehicle ${truck.truck_no} is currently assigned to active journey ${activeTruckJourney.journey_number}.`,
      });
    }
    if (activeDriverJourney) {
      return res.status(409).json({
        error: `Driver ${driver.name} is currently assigned to active journey ${activeDriverJourney.journey_number}.`,
      });
    }

    // Verify Truck compliance
    const compliance = truck.calculateComplianceStatus();
    if (compliance === 'EXPIRED') {
      return res.status(422).json({
        error: `Vehicle ${truck.truck_no} has expired statutory certificates. Renew documents before dispatching.`,
      });
    }

    // Verify Customer Credit Exposure (DEC-007 Option B)
    if (journey.billing_party_id) {
      const exposureResult = await evaluateCustomerCreditExposure({
        company_id: journey.company_id,
        customer_id: journey.billing_party_id,
        new_order_amount: journey.freight_rate || 0,
      });

      if (exposureResult.is_breached) {
        if (!req.body.credit_override) {
          return res.status(409).json({
            code: 'CREDIT_LIMIT_EXCEEDED',
            error: `Credit limit exceeded for customer ${exposureResult.customer_name}. Company Admin authorization required to dispatch.`,
            details: exposureResult,
          });
        }

        const userRole = req.tenant?.role || req.member?.role || (req as any).membership?.role || (req as any).user?.role;
        const isCompanyAdmin =
          userRole === 'admin' || (req as any).user?.is_superadmin || (req as any).user?.role === 'superadmin';

        if (!isCompanyAdmin) {
          return res.status(403).json({
            code: 'CREDIT_OVERRIDE_UNAUTHORIZED',
            error: 'Credit limit exceeded. Company Admin authorization required to dispatch.',
            details: exposureResult,
          });
        }

        const overrideReason = (req.body.override_reason || '').trim();
        if (overrideReason.length < 10) {
          return res.status(400).json({
            code: 'JUSTIFICATION_REQUIRED',
            error: 'A valid business justification (minimum 10 characters) is required to override credit limit.',
          });
        }

        overrideAuditParams = {
          company_id: journey.company_id,
          entity_type: 'party',
          entity_id: journey.billing_party_id,
          entity_identifier: exposureResult.customer_name,
          action: 'OVERRIDE',
          description: `Credit limit override authorized for ${exposureResult.customer_name} on journey ${journey.journey_number}: ${overrideReason}`,
          req,
          before_snapshot: {
            credit_limit: exposureResult.credit_limit,
            current_exposure: exposureResult.current_exposure,
          },
          after_snapshot: {
            projected_exposure: exposureResult.projected_exposure,
            overage_amount: exposureResult.overage_amount,
            override_reason: overrideReason,
          },
        };
      }
    }

    // Execute dispatch atomically inside transaction
    const dispatchResult = await runInTransaction(async (session) => {
      const sessJourney = await TruckJourney.findById(journey._id).session(session);
      if (!sessJourney || sessJourney.is_deleted || sessJourney.status !== 'draft') {
        const err: any = new Error(`Only draft journeys can be dispatched. Current status is ${sessJourney?.status}.`);
        err.statusCode = 400;
        throw err;
      }

      const sessTruck = await Truck.findById(journey.truck_id).session(session);
      const sessDriver = await Driver.findById(journey.driver_id).session(session);

      if (!sessTruck || sessTruck.is_deleted) {
        const err: any = new Error('Assigned vehicle is unavailable.');
        err.statusCode = 400;
        throw err;
      }
      if (!sessDriver || sessDriver.is_deleted || sessDriver.status !== 'active') {
        const err: any = new Error(`Assigned driver is ${sessDriver?.status || 'unavailable'} and cannot be dispatched.`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();

      // Step 1: Update Journey state
      sessJourney.status = 'active';
      sessJourney.start_date = now;
      sessJourney.status_history.push({
        status: 'active',
        timestamp: now,
        note: req.body.note || 'Vehicle flagged active and departed origin facility.',
        actor_id: req.user?.id,
      });
      await sessJourney.save({ session });

      // Step 2: Detach any previous driver from truck if different
      if (sessTruck.current_driver_id && String(sessTruck.current_driver_id) !== String(sessDriver._id)) {
        const oldDriverId = sessTruck.current_driver_id;
        const oldDriver = await Driver.findOne({ _id: oldDriverId, company_id: sessJourney.company_id, is_deleted: false }).session(session);
        if (oldDriver) {
          for (let i = oldDriver.assignment_history.length - 1; i >= 0; i--) {
            const entry = oldDriver.assignment_history[i];
            if (String(entry.truck_id) === String(sessTruck._id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          oldDriver.current_truck_id = undefined;
          await oldDriver.save({ session });
          await Driver.updateOne(
            { _id: oldDriverId, company_id: sessJourney.company_id },
            { $unset: { current_truck_id: 1 } },
            { session }
          );
        }

        for (let i = sessTruck.driver_assignments.length - 1; i >= 0; i--) {
          const entry = sessTruck.driver_assignments[i];
          if (String(entry.driver_id) === String(oldDriverId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
      }

      // Step 3: Detach any previous truck from driver if different
      if (sessDriver.current_truck_id && String(sessDriver.current_truck_id) !== String(sessTruck._id)) {
        const oldTruckId = sessDriver.current_truck_id;
        const oldTruck = await Truck.findOne({ _id: oldTruckId, company_id: sessJourney.company_id, is_deleted: false }).session(session);
        if (oldTruck) {
          for (let i = oldTruck.driver_assignments.length - 1; i >= 0; i--) {
            const entry = oldTruck.driver_assignments[i];
            if (String(entry.driver_id) === String(sessDriver._id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          oldTruck.current_driver_id = undefined;
          await oldTruck.save({ session });
          await Truck.updateOne(
            { _id: oldTruckId, company_id: sessJourney.company_id },
            { $unset: { current_driver_id: 1 } },
            { session }
          );
        }

        for (let i = sessDriver.assignment_history.length - 1; i >= 0; i--) {
          const entry = sessDriver.assignment_history[i];
          if (String(entry.truck_id) === String(oldTruckId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
      }

      // Step 4: Lock truck & sync driver assignment (avoiding duplicate open entry)
      sessTruck.status = 'on_trip';
      sessTruck.current_driver_id = sessDriver._id as any;
      const hasOpenTruckAssignment = sessTruck.driver_assignments.some(
        (entry) => String(entry.driver_id) === String(sessDriver._id) && !entry.unassigned_at
      );
      if (!hasOpenTruckAssignment) {
        sessTruck.driver_assignments.push({
          driver_id: sessDriver._id as any,
          assigned_at: now,
          notes: `Dispatched on Journey ${sessJourney.journey_number}`,
        });
      }
      await sessTruck.save({ session });

      // Step 5: Sync driver vehicle pointer & assignment history (avoiding duplicate open entry)
      sessDriver.current_truck_id = sessTruck._id as any;
      const hasOpenDriverAssignment = sessDriver.assignment_history.some(
        (entry) => String(entry.truck_id) === String(sessTruck._id) && !entry.unassigned_at
      );
      if (!hasOpenDriverAssignment) {
        sessDriver.assignment_history.push({
          truck_id: sessTruck._id as any,
          assigned_at: now,
          notes: `Dispatched on Journey ${sessJourney.journey_number}`,
        });
      }
      await sessDriver.save({ session });

      // Step 6: Audit log credit override if present
      if (overrideAuditParams) {
        await logAuditEvent({
          ...overrideAuditParams,
          session,
        });
      }

      // Step 7: Audit log dispatch transition
      await logAuditEvent({
        company_id: sessJourney.company_id,
        entity_type: 'journey' as any,
        entity_id: sessJourney._id,
        entity_identifier: sessJourney.journey_number,
        action: 'STATUS_CHANGE',
        description: `Journey ${sessJourney.journey_number} departed origin facility (Status: ACTIVE).`,
        req,
        session,
        after_snapshot: { status: 'active', start_date: sessJourney.start_date },
      });

      return { journey: sessJourney, truck: sessTruck, driver: sessDriver };
    });

    // Trigger driver WhatsApp dispatch alert outside transaction
    const company = await Company.findById(journey.company_id);
    if (company) {
      notifyTripDispatched(dispatchResult.journey, dispatchResult.driver, company).catch((err) =>
        console.error('[Notification Trigger Error - Dispatch]:', err)
      );
    }

    return res.json({
      message: `Journey ${dispatchResult.journey.journey_number} successfully dispatched.`,
      journey: dispatchResult.journey,
    });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('dispatchJourney error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to dispatch journey.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/milestones
 * Record a daily transit milestone update (current checkpoint / location)
 * ----------------------------------------------------------------------------
 */
export const addMilestone = async (req: Request, res: Response) => {
  try {
    const { current_location, transit_notes } = req.body;
    if (!current_location) {
      return res.status(400).json({ error: 'Current location is required.' });
    }

    const companyId = req.tenant?.id;
    const query: any = { _id: req.params.id, is_deleted: false };
    if (companyId) query.company_id = companyId;

    const journey = await TruckJourney.findOne(query);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.is_settled) {
      return res.status(409).json({
        error: `Conflict: Cannot log transit milestone for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`,
      });
    }

    if (journey.status === 'draft') {
      return res.status(400).json({
        error: `Cannot log transit milestone for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before logging transit updates.`,
      });
    }

    if (journey.status === 'completed' || journey.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot log transit milestone for journey '${journey.journey_number}' as it is already ${journey.status}.`,
      });
    }

    if (journey.status !== 'active' && journey.status !== 'delayed') {
      return res.status(400).json({
        error: `Cannot log transit milestone for journey '${journey.journey_number}' with status '${journey.status}'.`,
      });
    }

    const dayNumber = (journey.daily_progress?.length || 0) + 1;

    journey.daily_progress.push({
      day_number: dayNumber,
      date: new Date(),
      current_location,
      transit_notes,
      updated_by: req.user?.id,
    });

    journey.last_known_location = current_location;
    journey.last_location_updated_at = new Date();

    await journey.save();

    return res.json({
      message: 'Transit milestone logged successfully.',
      journey,
    });
  } catch (error: any) {
    console.error('addMilestone error:', error);
    return res.status(500).json({ error: error.message || 'Failed to log milestone.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/delays
 * Record an en-route transit delay and optionally flag journey as 'delayed'
 * ----------------------------------------------------------------------------
 */
export const recordDelay = async (req: Request, res: Response) => {
  try {
    const { location, delay_hours, reason, notes } = req.body;
    if (!location || typeof delay_hours !== 'number' || !reason) {
      return res.status(400).json({
        error: 'Location, delay hours, and delay reason are required.',
      });
    }

    const companyId = req.tenant?.id;
    const query: any = { _id: req.params.id, is_deleted: false };
    if (companyId) query.company_id = companyId;

    const journey = await TruckJourney.findOne(query);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.is_settled) {
      return res.status(409).json({
        error: `Conflict: Cannot record transit delay for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`,
      });
    }

    if (journey.status === 'draft') {
      return res.status(400).json({
        error: `Cannot record transit delay for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before logging transit updates.`,
      });
    }

    if (journey.status === 'completed' || journey.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot record transit delay for journey '${journey.journey_number}' as it is already ${journey.status}.`,
      });
    }

    if (journey.status !== 'active' && journey.status !== 'delayed') {
      return res.status(400).json({
        error: `Cannot record transit delay for journey '${journey.journey_number}' with status '${journey.status}'.`,
      });
    }

    journey.delays.push({
      location,
      date: new Date(),
      delay_hours,
      reason,
      notes,
    });

    if (journey.status === 'active') {
      journey.status = 'delayed';
      journey.status_history.push({
        status: 'delayed',
        timestamp: new Date(),
        note: `Transit delay: ${delay_hours}h due to ${reason} at ${location}.`,
        actor_id: req.user?.id,
      });
    }

    await journey.save();

    return res.json({
      message: 'Transit delay logged.',
      journey,
    });
  } catch (error: any) {
    console.error('recordDelay error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record delay.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/diesel
 * Record a diesel fuel stop, fuel quantity, and receipt slip
 * ----------------------------------------------------------------------------
 */
export const addDieselStop = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      petrol_pump_name,
      slip_number,
      fuel_quantity_litres,
      rate_per_litre,
      payment_mode = 'credit',
      balance_party_id,
      slip_image_url,
      filling_date,
    } = req.body;

    if (!petrol_pump_name || !fuel_quantity_litres || !rate_per_litre) {
      return res.status(400).json({
        error: 'Petrol pump name, fuel litres, and rate per litre are required.',
      });
    }

    const journey = await TruckJourney.findOne({
      _id: req.params.id,
      company_id: companyId,
      is_deleted: false,
    });
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.is_settled) {
      return res.status(409).json({
        error: `Conflict: Cannot record diesel fuel stop for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`,
      });
    }

    if (journey.status === 'draft') {
      return res.status(400).json({
        error: `Cannot record diesel fuel stop for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before recording fuel stops.`,
      });
    }

    if (journey.status === 'completed' || journey.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot record diesel fuel stop for journey '${journey.journey_number}' as it is already ${journey.status}.`,
      });
    }

    if (journey.status !== 'active' && journey.status !== 'delayed') {
      return res.status(400).json({
        error: `Cannot record diesel fuel stop for journey '${journey.journey_number}' with status '${journey.status}'.`,
      });
    }

    if (balance_party_id) {
      await validateTenantOwnership(companyId!, { balance_party_id });
    }

    const total_cost = roundMoney(Number(fuel_quantity_litres) * Number(rate_per_litre));
    if (total_cost <= 0) {
      return res.status(400).json({ error: 'Calculated fuel cost must be greater than zero.' });
    }

    const result = await runInTransaction(async (session) => {
      const sessJourney = await TruckJourney.findOne({
        _id: journey._id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!sessJourney) {
        throw new Error('Journey not found within transaction session.');
      }

      if (sessJourney.is_settled) {
        const err: any = new Error(
          `Conflict: Cannot record diesel fuel stop for journey '${sessJourney.journey_number}' as it has already been settled in a completed driver payout.`
        );
        err.statusCode = 409;
        throw err;
      }

      if (sessJourney.status === 'draft') {
        const err: any = new Error(
          `Cannot record diesel fuel stop for journey '${sessJourney.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before recording fuel stops.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (sessJourney.status === 'completed' || sessJourney.status === 'cancelled') {
        const err: any = new Error(
          `Cannot record diesel fuel stop for journey '${sessJourney.journey_number}' as it is already ${sessJourney.status}.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (sessJourney.status !== 'active' && sessJourney.status !== 'delayed') {
        const err: any = new Error(
          `Cannot record diesel fuel stop for journey '${sessJourney.journey_number}' with status '${sessJourney.status}'.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (slip_number && slip_number.trim()) {
        const cleanSlip = slip_number.trim().toLowerCase();
        const existingSlip = sessJourney.diesel_expenses?.find(
          (d) => d.slip_number && d.slip_number.trim().toLowerCase() === cleanSlip
        );
        if (existingSlip) {
          const err: any = new Error(
            `Conflict: Fuel slip number '${slip_number.trim()}' has already been recorded for journey '${sessJourney.journey_number}'.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      sessJourney.diesel_expenses.push({
        filling_date: filling_date ? new Date(filling_date) : new Date(),
        petrol_pump_name: petrol_pump_name.trim(),
        slip_number: slip_number?.trim(),
        fuel_quantity_litres: Number(fuel_quantity_litres),
        rate_per_litre: Number(rate_per_litre),
        total_cost,
        payment_mode,
        balance_party_id: balance_party_id ? new Types.ObjectId(String(balance_party_id)) : undefined,
        slip_image_url,
      });

      await sessJourney.save({ session });

      if (balance_party_id && payment_mode === 'credit') {
        const vendorParty = await BalanceParty.findOne({
          _id: balance_party_id,
          company_id: companyId,
          is_deleted: false,
        }).session(session);

        if (vendorParty) {
          vendorParty.current_balance = roundMoney(vendorParty.current_balance + total_cost);
          await vendorParty.save({ session });
        }
      }

      // Post balanced double-entry ledger vouchers
      const journalResult = await postFuelExpenseJournal({
        company_id: companyId!,
        session,
        journey_id: sessJourney._id,
        journey_number: sessJourney.journey_number,
        truck_id: sessJourney.truck_id,
        driver_id: sessJourney.driver_id,
        petrol_pump_name: petrol_pump_name.trim(),
        fuel_quantity_litres: Number(fuel_quantity_litres),
        rate_per_litre: Number(rate_per_litre),
        total_cost,
        payment_mode,
        slip_number: slip_number?.trim(),
        balance_party_id: balance_party_id ? new Types.ObjectId(String(balance_party_id)) : undefined,
        created_by: req.user?._id,
      });

      return {
        journey: sessJourney,
        journal_id: journalResult.journal_id,
        entries: journalResult.entries,
      };
    });

    logAuditEvent({
      company_id: companyId,
      entity_type: 'journey',
      entity_id: journey._id,
      entity_identifier: journey.journey_number,
      action: 'UPDATE',
      description: `Fuel stop logged at ${petrol_pump_name} (${fuel_quantity_litres}L @ ₹${rate_per_litre}, total: ₹${total_cost}, mode: ${payment_mode})`,
      req,
      after_snapshot: {
        total_diesel_cost: result.journey.total_diesel_cost,
        advance_funded_diesel_cost: result.journey.advance_funded_diesel_cost,
      },
    });

    return res.json({
      message: 'Diesel fuel stop logged successfully.',
      journey: result.journey,
      journal_id: result.journal_id,
      entries: result.entries,
    });
  } catch (error: any) {
    if (error instanceof TenantOwnershipError) {
      return res.status(error.statusCode).json({ error: error.message, entityType: error.entityType });
    }
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('addDieselStop error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to log diesel stop.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/journeys/:id/diesel/:dieselId
 * Correct an active trip en-route fuel stop (FF-ISSUE-038)
 * ----------------------------------------------------------------------------
 */
export const updateDieselStop = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const dieselId = req.params.dieselId as string;
    const {
      petrol_pump_name,
      slip_number,
      fuel_quantity_litres,
      rate_per_litre,
      payment_mode,
      balance_party_id,
      slip_image_url,
      filling_date,
      reason,
    } = req.body;
    const companyId = req.tenant?.id;

    if (!companyId) {
      return res.status(403).json({ error: 'Tenant context required.' });
    }

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(dieselId)) {
      return res.status(400).json({ error: 'Invalid journey or diesel ID.' });
    }

    if (fuel_quantity_litres !== undefined) {
      const numLitres = Number(fuel_quantity_litres);
      if (isNaN(numLitres) || numLitres <= 0) {
        return res.status(400).json({ error: 'Fuel litres must be a positive number greater than zero.' });
      }
    }

    if (rate_per_litre !== undefined) {
      const numRate = Number(rate_per_litre);
      if (isNaN(numRate) || numRate <= 0) {
        return res.status(400).json({ error: 'Rate per litre must be a positive number greater than zero.' });
      }
    }

    if (payment_mode !== undefined) {
      const validModes = ['cash', 'fuel_card', 'credit'];
      if (!validModes.includes(payment_mode)) {
        return res.status(400).json({
          error: `Invalid payment mode '${payment_mode}'. Must be one of: cash, fuel_card, credit.`,
        });
      }
    }

    if (balance_party_id) {
      await validateTenantOwnership(companyId, { balance_party_id });
    }

    const result = await runInTransaction(async (session) => {
      const journey = await TruckJourney.findOne({
        _id: id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      if (journey.is_settled) {
        const err: any = new Error(
          `Conflict: Cannot correct fuel stop for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`
        );
        err.statusCode = 409;
        throw err;
      }

      if (journey.status === 'draft') {
        const err: any = new Error(
          `Cannot correct fuel stop for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before managing fuel stops.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'completed' || journey.status === 'cancelled') {
        const err: any = new Error(
          `Cannot correct fuel stop for journey '${journey.journey_number}' as it is already ${journey.status}.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (journey.status !== 'active' && journey.status !== 'delayed') {
        const err: any = new Error(
          `Cannot correct fuel stop for journey '${journey.journey_number}' with status '${journey.status}'. Only active or delayed journeys can be corrected.`
        );
        err.statusCode = 400;
        throw err;
      }

      const dieselStop = (journey.diesel_expenses as any).id
        ? (journey.diesel_expenses as any).id(dieselId)
        : journey.diesel_expenses.find((d: any) => String(d._id) === String(dieselId));
      if (!dieselStop) {
        const err: any = new Error('Diesel fuel stop record not found.');
        err.statusCode = 404;
        throw err;
      }

      // Check slip number conflict if changed
      const newSlipNumber = slip_number !== undefined ? slip_number?.trim() : dieselStop.slip_number;
      if (newSlipNumber) {
        const cleanSlip = newSlipNumber.toLowerCase();
        const existingSlip = journey.diesel_expenses.find(
          (d) => String(d._id) !== String(dieselStop._id) && d.slip_number && d.slip_number.trim().toLowerCase() === cleanSlip
        );
        if (existingSlip) {
          const err: any = new Error(
            `Conflict: Fuel slip number '${newSlipNumber}' has already been recorded for journey '${journey.journey_number}'.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      const newLitres = fuel_quantity_litres !== undefined ? Number(fuel_quantity_litres) : dieselStop.fuel_quantity_litres;
      const newRate = rate_per_litre !== undefined ? Number(rate_per_litre) : dieselStop.rate_per_litre;
      const newTotalCost = roundMoney(newLitres * newRate);
      if (newTotalCost <= 0) {
        const err: any = new Error('Calculated fuel cost must be greater than zero.');
        err.statusCode = 400;
        throw err;
      }

      const oldTotalCost = roundMoney(dieselStop.total_cost);
      const oldPaymentMode = dieselStop.payment_mode;
      const newPaymentMode = payment_mode !== undefined ? payment_mode : oldPaymentMode;
      const oldBalancePartyId = dieselStop.balance_party_id;
      const newBalancePartyId =
        balance_party_id !== undefined
          ? (balance_party_id ? new Types.ObjectId(String(balance_party_id)) : undefined)
          : oldBalancePartyId;

      const beforeSnapshot = {
        diesel_id: dieselStop._id,
        petrol_pump_name: dieselStop.petrol_pump_name,
        slip_number: dieselStop.slip_number,
        fuel_quantity_litres: dieselStop.fuel_quantity_litres,
        rate_per_litre: dieselStop.rate_per_litre,
        total_cost: oldTotalCost,
        payment_mode: oldPaymentMode,
        balance_party_id: oldBalancePartyId,
        slip_image_url: dieselStop.slip_image_url,
        filling_date: dieselStop.filling_date,
      };

      // General Ledger & Vendor Balance Reconciliation
      const effectivePumpName = petrol_pump_name ? petrol_pump_name.trim() : dieselStop.petrol_pump_name;
      const effectiveSlip = newSlipNumber || dieselStop.slip_number || journey.journey_number;

      if (oldPaymentMode === newPaymentMode && String(oldBalancePartyId || '') === String(newBalancePartyId || '')) {
        const delta = roundMoney(newTotalCost - oldTotalCost);
        if (delta !== 0) {
          // Reconcile vendor balance if credit mode
          if (newPaymentMode === 'credit' && newBalancePartyId) {
            const vendor = await BalanceParty.findOne({
              _id: newBalancePartyId,
              company_id: companyId,
              is_deleted: false,
            }).session(session);

            if (vendor) {
              vendor.current_balance = roundMoney(vendor.current_balance + delta);
              await vendor.save({ session });
            }
          }

          // Determine funding source leg
          const fundingCategory =
            newPaymentMode === 'credit'
              ? 'payment_made'
              : newPaymentMode === 'cash'
              ? 'driver_advance'
              : 'bank_transfer';

          const ledgerMode =
            newPaymentMode === 'credit'
              ? 'credit'
              : newPaymentMode === 'cash'
              ? 'cash'
              : 'fuel_card';

          if (delta > 0) {
            // Upward correction: Debit Operating Diesel Expense, Credit Funding Source
            await postDoubleEntryJournal({
              company_id: companyId,
              session,
              transaction_type: 'journey',
              description: `Fuel stop upward correction adjustment (+₹${delta}) for ${journey.journey_number} (${effectivePumpName})`,
              reference_number: effectiveSlip,
              party_name: effectivePumpName,
              legs: [
                {
                  category: 'diesel_expense',
                  balance_type: 'debit',
                  amount: delta,
                  payment_mode: ledgerMode,
                  party_name: effectivePumpName,
                  reference_number: effectiveSlip,
                  description: `Upward diesel cost correction for ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                },
                {
                  category: fundingCategory,
                  balance_type: 'credit',
                  amount: delta,
                  payment_mode: ledgerMode,
                  party_name: effectivePumpName,
                  reference_number: effectiveSlip,
                  description: `Upward credit/advance adjustment for fuel on ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                },
              ],
              journey_id: journey._id,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              balance_party_id: newBalancePartyId,
              created_by: req.user?._id,
              is_auto_generated: true,
            });
          } else {
            // Downward correction: Debit Funding Source, Credit Diesel Expense
            const absDelta = Math.abs(delta);
            await postDoubleEntryJournal({
              company_id: companyId,
              session,
              transaction_type: 'journey',
              description: `Fuel stop downward correction adjustment (-₹${absDelta}) for ${journey.journey_number} (${effectivePumpName})`,
              reference_number: effectiveSlip,
              party_name: effectivePumpName,
              legs: [
                {
                  category: fundingCategory,
                  balance_type: 'debit',
                  amount: absDelta,
                  payment_mode: ledgerMode,
                  party_name: effectivePumpName,
                  reference_number: effectiveSlip,
                  description: `Downward liability/advance adjustment for fuel on ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                },
                {
                  category: 'diesel_expense',
                  balance_type: 'credit',
                  amount: absDelta,
                  payment_mode: ledgerMode,
                  party_name: effectivePumpName,
                  reference_number: effectiveSlip,
                  description: `Downward diesel cost correction for ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                },
              ],
              journey_id: journey._id,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              balance_party_id: newBalancePartyId,
              created_by: req.user?._id,
              is_auto_generated: true,
            });
          }
        }
      } else {
        // Payment mode or balance party changed
        if (oldPaymentMode === 'credit' && oldBalancePartyId) {
          const oldVendor = await BalanceParty.findOne({
            _id: oldBalancePartyId,
            company_id: companyId,
            is_deleted: false,
          }).session(session);
          if (oldVendor) {
            oldVendor.current_balance = roundMoney(oldVendor.current_balance - oldTotalCost);
            await oldVendor.save({ session });
          }
        }

        const oldFundingCategory =
          oldPaymentMode === 'credit'
            ? 'payment_made'
            : oldPaymentMode === 'cash'
            ? 'driver_advance'
            : 'bank_transfer';

        const oldLedgerMode =
          oldPaymentMode === 'credit'
            ? 'credit'
            : oldPaymentMode === 'cash'
            ? 'cash'
            : 'fuel_card';

        // Reversal entry for old entry
        await postDoubleEntryJournal({
          company_id: companyId,
          session,
          transaction_type: 'journey',
          description: `Reversal of original fuel stop entry (₹${oldTotalCost}) on ${journey.journey_number}`,
          reference_number: `REV:${effectiveSlip}`,
          party_name: dieselStop.petrol_pump_name,
          legs: [
            {
              category: oldFundingCategory,
              balance_type: 'debit',
              amount: oldTotalCost,
              payment_mode: oldLedgerMode,
              party_name: dieselStop.petrol_pump_name,
              reference_number: `REV:${effectiveSlip}`,
              description: `Reversal of original fuel funding for ${journey.journey_number}`,
              journey_id: journey._id,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              balance_party_id: oldBalancePartyId,
            },
            {
              category: 'diesel_expense',
              balance_type: 'credit',
              amount: oldTotalCost,
              payment_mode: oldLedgerMode,
              party_name: dieselStop.petrol_pump_name,
              reference_number: `REV:${effectiveSlip}`,
              description: `Reversal of original fuel expense for ${journey.journey_number}`,
              journey_id: journey._id,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              balance_party_id: oldBalancePartyId,
            },
          ],
          journey_id: journey._id,
          truck_id: journey.truck_id,
          driver_id: journey.driver_id,
          balance_party_id: oldBalancePartyId,
          created_by: req.user?._id,
          is_auto_generated: true,
        });

        // Apply new vendor balance
        if (newPaymentMode === 'credit' && newBalancePartyId) {
          const newVendor = await BalanceParty.findOne({
            _id: newBalancePartyId,
            company_id: companyId,
            is_deleted: false,
          }).session(session);
          if (newVendor) {
            newVendor.current_balance = roundMoney(newVendor.current_balance + newTotalCost);
            await newVendor.save({ session });
          }
        }

        // Post new entry
        await postFuelExpenseJournal({
          company_id: companyId,
          session,
          journey_id: journey._id,
          journey_number: journey.journey_number,
          truck_id: journey.truck_id,
          driver_id: journey.driver_id,
          petrol_pump_name: effectivePumpName,
          fuel_quantity_litres: newLitres,
          rate_per_litre: newRate,
          total_cost: newTotalCost,
          payment_mode: newPaymentMode,
          slip_number: newSlipNumber,
          balance_party_id: newBalancePartyId,
          created_by: req.user?._id,
        });
      }

      // Update diesel stop subdocument
      if (petrol_pump_name !== undefined) dieselStop.petrol_pump_name = petrol_pump_name.trim();
      if (slip_number !== undefined) dieselStop.slip_number = slip_number ? slip_number.trim() : undefined;
      dieselStop.fuel_quantity_litres = newLitres;
      dieselStop.rate_per_litre = newRate;
      dieselStop.total_cost = newTotalCost;
      dieselStop.payment_mode = newPaymentMode;
      dieselStop.balance_party_id = newBalancePartyId;
      if (slip_image_url !== undefined) dieselStop.slip_image_url = slip_image_url;
      if (filling_date !== undefined) dieselStop.filling_date = new Date(filling_date);

      await journey.save({ session });

      const afterSnapshot = {
        diesel_id: dieselStop._id,
        petrol_pump_name: dieselStop.petrol_pump_name,
        slip_number: dieselStop.slip_number,
        fuel_quantity_litres: dieselStop.fuel_quantity_litres,
        rate_per_litre: dieselStop.rate_per_litre,
        total_cost: newTotalCost,
        payment_mode: dieselStop.payment_mode,
        balance_party_id: dieselStop.balance_party_id,
        slip_image_url: dieselStop.slip_image_url,
        filling_date: dieselStop.filling_date,
        correction_reason: reason || 'Fuel stop correction',
      };

      await logAuditEvent({
        company_id: companyId,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'UPDATE',
        description: `Corrected diesel fuel stop at ${dieselStop.petrol_pump_name} (${dieselStop.fuel_quantity_litres}L @ ₹${dieselStop.rate_per_litre}, total: ₹${newTotalCost}, mode: ${dieselStop.payment_mode}) on journey ${journey.journey_number}. Reason: ${reason || 'Operational adjustment'}`,
        req,
        session,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
      });

      return { journey, diesel_stop: dieselStop };
    });

    return res.json({
      message: 'Diesel fuel stop successfully corrected.',
      journey: result.journey,
      diesel_stop: result.diesel_stop,
    });
  } catch (error: any) {
    if (error instanceof TenantOwnershipError) {
      return res.status(error.statusCode).json({ error: error.message, entityType: error.entityType });
    }
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('updateDieselStop error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to correct diesel stop.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/expenses
 * Log a driver en-route cash expenditure (toll, weighbridge, repairs, food)
 * ----------------------------------------------------------------------------
 */
export const addDriverExpense = async (req: Request, res: Response) => {
  try {
    const { expense_type, amount, notes, receipt_url, date } = req.body;
    if (!expense_type || !amount) {
      return res.status(400).json({ error: 'Expense type and amount are required.' });
    }

    const companyId = req.tenant?.id;
    const query: any = { _id: req.params.id, is_deleted: false };
    if (companyId) query.company_id = companyId;

    const journey = await TruckJourney.findOne(query);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.is_settled) {
      return res.status(409).json({
        error: `Conflict: Cannot log cash expense for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`,
      });
    }

    if (journey.status === 'draft') {
      return res.status(400).json({
        error: `Cannot log cash expense for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before logging en-route expenses.`,
      });
    }

    if (journey.status === 'completed' || journey.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot log cash expense for journey '${journey.journey_number}' as it is already ${journey.status}.`,
      });
    }

    if (journey.status !== 'active' && journey.status !== 'delayed') {
      return res.status(400).json({
        error: `Cannot log cash expense for journey '${journey.journey_number}' with status '${journey.status}'.`,
      });
    }

    journey.driver_expenses.push({
      date: date ? new Date(date) : new Date(),
      expense_type,
      amount: Number(amount),
      notes,
      receipt_url,
    });

    await journey.save();

    return res.json({
      message: 'En-route cash expense logged.',
      journey,
    });
  } catch (error: any) {
    console.error('addDriverExpense error:', error);
    return res.status(500).json({ error: error.message || 'Failed to log driver expense.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/journeys/:id/expenses/:expenseId
 * Correct an active trip en-route driver cash expenditure (FF-ISSUE-039)
 * ----------------------------------------------------------------------------
 */
export const updateDriverExpense = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const expenseId = req.params.expenseId as string;
    const { expense_type, amount, notes, receipt_url, date, reason } = req.body;
    const companyId = req.tenant?.id;

    if (!companyId) {
      return res.status(403).json({ error: 'Tenant context required.' });
    }

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ error: 'Invalid journey or expense ID.' });
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Expense amount must be a positive number greater than zero.' });
      }
    }

    if (expense_type !== undefined) {
      const validTypes = [
        'toll',
        'loading',
        'unloading',
        'weighbridge',
        'rto_border',
        'minor_repair',
        'food_allowance',
        'other',
      ];
      if (!validTypes.includes(expense_type)) {
        return res.status(400).json({
          error: `Invalid expense type '${expense_type}'. Must be one of: ${validTypes.join(', ')}.`,
        });
      }
    }

    const result = await runInTransaction(async (session) => {
      const journey = await TruckJourney.findOne({
        _id: id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      if (journey.is_settled) {
        const err: any = new Error(
          `Conflict: Cannot correct expense for journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`
        );
        err.statusCode = 409;
        throw err;
      }

      if (journey.status === 'draft') {
        const err: any = new Error(
          `Cannot correct expense for journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before managing en-route expenses.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'completed' || journey.status === 'cancelled') {
        const err: any = new Error(
          `Cannot correct expense for journey '${journey.journey_number}' as it is already ${journey.status}.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (journey.status !== 'active' && journey.status !== 'delayed') {
        const err: any = new Error(
          `Cannot correct expense for journey '${journey.journey_number}' with status '${journey.status}'. Only active or delayed journeys can be corrected.`
        );
        err.statusCode = 400;
        throw err;
      }

      const expense = (journey.driver_expenses as any).id
        ? (journey.driver_expenses as any).id(expenseId)
        : journey.driver_expenses.find((e: any) => String(e._id) === String(expenseId));
      if (!expense) {
        const err: any = new Error('Driver expense record not found.');
        err.statusCode = 404;
        throw err;
      }

      const beforeSnapshot = {
        expense_id: expense._id,
        expense_type: expense.expense_type,
        amount: expense.amount,
        notes: expense.notes,
        receipt_url: expense.receipt_url,
        date: expense.date,
      };

      if (expense_type !== undefined) expense.expense_type = expense_type;
      if (amount !== undefined) expense.amount = Number(amount);
      if (notes !== undefined) expense.notes = notes;
      if (receipt_url !== undefined) expense.receipt_url = receipt_url;
      if (date !== undefined) expense.date = new Date(date);

      await journey.save({ session });

      const afterSnapshot = {
        expense_id: expense._id,
        expense_type: expense.expense_type,
        amount: expense.amount,
        notes: expense.notes,
        receipt_url: expense.receipt_url,
        date: expense.date,
        correction_reason: reason || 'Driver expense correction',
      };

      await logAuditEvent({
        company_id: companyId,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'UPDATE',
        description: `Corrected driver expense (${expense.expense_type}: ₹${expense.amount}) on journey ${journey.journey_number}. Reason: ${reason || 'Operational adjustment'}`,
        req,
        session,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
      });

      return { journey, expense };
    });

    return res.json({
      message: 'Driver expense successfully corrected.',
      journey: result.journey,
      expense: result.expense,
    });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('updateDriverExpense error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to correct driver expense.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/pod
 * Confirm delivery, upload POD slip, record final odometer, and complete journey
 * ----------------------------------------------------------------------------
 */
export const completeDeliveryAndPOD = async (req: Request, res: Response) => {
  try {
    const { contact_name, end_odometer_kms, pod_slip_url, notes } = req.body;
    const companyId = req.tenant?.id;

    const result = await runInTransaction(async (session) => {
      const journeyQuery: any = { _id: req.params.id, is_deleted: false };
      if (companyId) journeyQuery.company_id = companyId;

      const journey = await TruckJourney.findOne(journeyQuery).session(session);
      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      if (journey.is_settled) {
        const err: any = new Error(
          `Conflict: Cannot complete journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`
        );
        err.statusCode = 409;
        throw err;
      }

      if (journey.status === 'draft') {
        const err: any = new Error(
          `Cannot complete journey '${journey.journey_number}' as it is currently in 'draft' status. Trips must be dispatched before completing delivery.`
        );
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'completed') {
        const err: any = new Error('Journey is already completed.');
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'cancelled') {
        const err: any = new Error('Cannot complete a cancelled journey.');
        err.statusCode = 400;
        throw err;
      }

      if (journey.status !== 'active' && journey.status !== 'delayed') {
        const err: any = new Error(`Cannot complete journey with status '${journey.status}'. Only active or delayed journeys can be completed.`);
        err.statusCode = 400;
        throw err;
      }

      // Validate odometer
      if (typeof end_odometer_kms === 'number') {
        if (end_odometer_kms < journey.start_odometer_kms) {
          const err: any = new Error(`End odometer (${end_odometer_kms} km) cannot be less than start odometer (${journey.start_odometer_kms} km).`);
          err.statusCode = 400;
          throw err;
        }
        journey.end_odometer_kms = end_odometer_kms;
        journey.total_distance_kms = Math.max(0, end_odometer_kms - journey.start_odometer_kms);
      }

      const now = new Date();
      journey.delivery_status = 'delivered';
      journey.delivered_to = {
        contact_name: contact_name || 'Consignee Receiver',
        delivery_timestamp: now,
        notes,
      };
      if (pod_slip_url) {
        journey.pod_slip_url = pod_slip_url;
      }

      journey.status = 'completed';
      journey.actual_end_date = now;
      journey.status_history.push({
        status: 'completed',
        timestamp: now,
        note: `Delivery confirmed at destination. POD documented. Completed by ${req.user?.name || 'Dispatcher'}.`,
        actor_id: req.user?.id,
      });

      await journey.save({ session });

      // Release vehicle back to 'available' pool and sync odometer
      const truck = await Truck.findById(journey.truck_id).session(session);
      if (truck) {
        if (truck.status === 'on_trip') {
          truck.status = 'available';
        }
        if (journey.end_odometer_kms && journey.end_odometer_kms > (truck.current_odometer_kms || 0)) {
          truck.current_odometer_kms = journey.end_odometer_kms;
        }
        // Only close assignment and detach if currently pointing to this journey's driver
        if (truck.current_driver_id && String(truck.current_driver_id) === String(journey.driver_id)) {
          for (let i = truck.driver_assignments.length - 1; i >= 0; i--) {
            const entry = truck.driver_assignments[i];
            if (String(entry.driver_id) === String(journey.driver_id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          truck.current_driver_id = undefined;
          await truck.save({ session });
          await Truck.updateOne(
            { _id: truck._id, current_driver_id: journey.driver_id },
            { $unset: { current_driver_id: 1 } },
            { session }
          );
        } else {
          await truck.save({ session });
        }
      }

      // Release driver allocation references
      const driver = await Driver.findById(journey.driver_id).session(session);
      if (driver) {
        // Only close assignment and detach if driver's current truck is this journey's truck
        if (driver.current_truck_id && String(driver.current_truck_id) === String(journey.truck_id)) {
          for (let i = driver.assignment_history.length - 1; i >= 0; i--) {
            const entry = driver.assignment_history[i];
            if (String(entry.truck_id) === String(journey.truck_id) && !entry.unassigned_at) {
              entry.unassigned_at = now;
              break;
            }
          }
          driver.current_truck_id = undefined;
          await driver.save({ session });
          await Driver.updateOne(
            { _id: driver._id, current_truck_id: journey.truck_id },
            { $unset: { current_truck_id: 1 } },
            { session }
          );
        }
      }

      await logAuditEvent({
        company_id: journey.company_id,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'STATUS_CHANGE',
        description: `Journey ${journey.journey_number} marked completed at destination. Contact: ${journey.delivered_to?.contact_name}.`,
        req,
        session,
        after_snapshot: { status: 'completed', delivered_to: journey.delivered_to, end_odometer_kms: journey.end_odometer_kms },
      });

      return { journey, truck, driver };
    });

    // Notify delivery completion outside transaction
    const company = await Company.findById(result.journey.company_id);
    if (company && result.journey.delivered_to?.contact_name) {
      notifyDeliveryCompleted(result.journey, '', result.journey.delivered_to.contact_name, company).catch((err) =>
        console.error('[Notification Trigger Error - Delivery]:', err)
      );
    }

    return res.json({
      message: `Journey ${result.journey.journey_number} marked completed and delivery acknowledged.`,
      journey: result.journey,
    });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('completeDeliveryAndPOD error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to complete delivery.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/journeys/:id/cancel
 * Cancel a planned or active journey and release assigned resources
 * ----------------------------------------------------------------------------
 */
export const cancelJourney = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const companyId = req.tenant?.id;

    const result = await runInTransaction(async (session) => {
      const journeyQuery: any = { _id: req.params.id, is_deleted: false };
      if (companyId) journeyQuery.company_id = companyId;

      const journey = await TruckJourney.findOne(journeyQuery).session(session);
      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      if (journey.is_settled) {
        const err: any = new Error('Settled journeys cannot be cancelled.');
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'completed') {
        const err: any = new Error('Completed journeys cannot be cancelled.');
        err.statusCode = 400;
        throw err;
      }

      if (journey.status === 'cancelled') {
        const err: any = new Error('Journey is already cancelled.');
        err.statusCode = 400;
        throw err;
      }

      if (journey.status !== 'draft' && journey.status !== 'active' && journey.status !== 'delayed') {
        const err: any = new Error(`Cannot cancel journey with status '${journey.status}'.`);
        err.statusCode = 400;
        throw err;
      }

      const preCancelStatus = journey.status;
      const now = new Date();
      journey.status = 'cancelled';
      journey.status_history.push({
        status: 'cancelled',
        timestamp: now,
        note: reason || 'Journey aborted by dispatcher.',
        actor_id: req.user?.id,
      });

      await journey.save({ session });

      let truck: any = null;
      let driver: any = null;

      // Only release vehicle and driver if the journey was active or delayed
      if (preCancelStatus === 'active' || preCancelStatus === 'delayed') {
        // Release vehicle
        truck = await Truck.findById(journey.truck_id).session(session);
        if (truck) {
          if (truck.status === 'on_trip') {
            truck.status = 'available';
          }
          if (truck.current_driver_id && String(truck.current_driver_id) === String(journey.driver_id)) {
            for (let i = truck.driver_assignments.length - 1; i >= 0; i--) {
              const entry = truck.driver_assignments[i];
              if (String(entry.driver_id) === String(journey.driver_id) && !entry.unassigned_at) {
                entry.unassigned_at = now;
                entry.notes = (entry.notes ? entry.notes + ' | ' : '') + `Cancelled: ${reason || 'Journey cancelled'}`;
                break;
              }
            }
            truck.current_driver_id = undefined;
            await truck.save({ session });
            await Truck.updateOne(
              { _id: truck._id, current_driver_id: journey.driver_id },
              { $unset: { current_driver_id: 1 } },
              { session }
            );
          } else {
            await truck.save({ session });
          }
        }

        // Release driver
        driver = await Driver.findById(journey.driver_id).session(session);
        if (driver) {
          if (driver.current_truck_id && String(driver.current_truck_id) === String(journey.truck_id)) {
            for (let i = driver.assignment_history.length - 1; i >= 0; i--) {
              const entry = driver.assignment_history[i];
              if (String(entry.truck_id) === String(journey.truck_id) && !entry.unassigned_at) {
                entry.unassigned_at = now;
                entry.notes = (entry.notes ? entry.notes + ' | ' : '') + `Cancelled: ${reason || 'Journey cancelled'}`;
                break;
              }
            }
            driver.current_truck_id = undefined;
            await driver.save({ session });
            await Driver.updateOne(
              { _id: driver._id, current_truck_id: journey.truck_id },
              { $unset: { current_truck_id: 1 } },
              { session }
            );
          }
        }
      }

      await logAuditEvent({
        company_id: journey.company_id,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'STATUS_CHANGE',
        description: `Journey ${journey.journey_number} has been cancelled. Reason: ${reason || 'Aborted by dispatcher'}.`,
        req,
        session,
        after_snapshot: { status: 'cancelled', cancellation_reason: reason },
      });

      return journey;
    });

    return res.json({
      message: `Journey ${result.journey_number} has been cancelled.`,
      journey: result,
    });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('cancelJourney error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to cancel journey.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/journeys/:id/swap-driver
 * Controlled mid-trip driver handover (OPN-003 / FF-ISSUE-030)
 * Reassigns the active journey driver, records handover odometer readings,
 * synchronizes truck and driver allocation pointers and histories, and writes
 * an immutable audit log.
 * ----------------------------------------------------------------------------
 */
export const swapDriver = async (req: Request, res: Response) => {
  try {
    const journeyId = req.params.id as string;
    if (!Types.ObjectId.isValid(journeyId)) {
      return res.status(400).json({ error: 'Invalid journey ID.' });
    }

    const { incoming_driver_id, handover_odometer, reason, notes } = req.body;

    if (!incoming_driver_id || !Types.ObjectId.isValid(incoming_driver_id)) {
      return res.status(400).json({ error: 'A valid incoming_driver_id is required.' });
    }

    if (typeof handover_odometer !== 'number' || isNaN(handover_odometer) || handover_odometer < 0) {
      return res.status(400).json({ error: 'A valid numeric handover_odometer is required.' });
    }

    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 15) {
      return res.status(400).json({
        error: 'A valid business justification (minimum 15 characters) is required for driver swap.',
      });
    }

    // Role verification (Company Admin required)
    const userRole = req.tenant?.role || req.member?.role || (req as any).membership?.role || (req as any).user?.role;
    const isCompanyAdmin =
      userRole === 'admin' || (req as any).user?.is_superadmin || (req as any).user?.role === 'superadmin';
    if (!isCompanyAdmin) {
      return res.status(403).json({ error: 'Company Admin authorization required to perform driver swap.' });
    }

    const companyId = req.tenant?.id;
    if (!companyId) {
      return res.status(401).json({ error: 'Tenant context required.' });
    }

    // Cross-tenant and existence check for Journey
    const journeyAnywhere = await TruckJourney.findOne(
      { _id: journeyId, is_deleted: false },
      '_id company_id status is_settled start_odometer_kms',
      { skipTenantCheck: true }
    );
    if (!journeyAnywhere) {
      return res.status(404).json({ error: 'Journey not found.' });
    }
    if (String(journeyAnywhere.company_id) !== String(companyId)) {
      return res.status(403).json({ error: 'Access denied: Journey belongs to a different company.' });
    }

    // Status pre-validation
    if (journeyAnywhere.status === 'draft') {
      return res.status(400).json({
        error: 'Cannot swap driver on a draft journey. Dispatch the journey or update driver directly.',
      });
    }
    if (journeyAnywhere.status === 'completed' || journeyAnywhere.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot swap driver on a ${journeyAnywhere.status} journey.`,
      });
    }
    if (journeyAnywhere.is_settled) {
      return res.status(400).json({ error: 'Cannot swap driver on a settled journey.' });
    }
    if (journeyAnywhere.status !== 'active' && journeyAnywhere.status !== 'delayed') {
      return res.status(400).json({
        error: `Driver swap is only permitted on active or delayed journeys. Current status is ${journeyAnywhere.status}.`,
      });
    }

    if (handover_odometer < journeyAnywhere.start_odometer_kms) {
      return res.status(400).json({
        error: `Handover odometer (${handover_odometer} km) cannot be less than start odometer (${journeyAnywhere.start_odometer_kms} km).`,
      });
    }

    // Cross-tenant and existence check for Incoming Driver
    const incomingDriverAnywhere = await Driver.findOne(
      { _id: incoming_driver_id, is_deleted: false },
      '_id company_id name status',
      { skipTenantCheck: true }
    );
    if (!incomingDriverAnywhere) {
      return res.status(404).json({ error: 'Incoming driver not found.' });
    }
    if (String(incomingDriverAnywhere.company_id) !== String(companyId)) {
      return res.status(403).json({ error: 'Access denied: Incoming driver belongs to a different company.' });
    }
    if (incomingDriverAnywhere.status !== 'active') {
      return res.status(400).json({
        error: `Incoming driver is ${incomingDriverAnywhere.status} and cannot be assigned.`,
      });
    }

    // Active trip conflict check for Incoming Driver
    const activeDriverJourney = await TruckJourney.findOne({
      _id: { $ne: journeyId },
      driver_id: incoming_driver_id,
      status: { $in: ['active', 'delayed'] },
      is_deleted: false,
    });
    if (activeDriverJourney) {
      return res.status(409).json({
        error: `Incoming driver ${incomingDriverAnywhere.name} is currently assigned to active journey ${activeDriverJourney.journey_number}.`,
      });
    }

    // Execute atomic driver swap inside transaction
    const result = await runInTransaction(async (session) => {
      const journey = await TruckJourney.findOne({
        _id: journeyId,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      if (journey.status !== 'active' && journey.status !== 'delayed') {
        const err: any = new Error(`Driver swap is only permitted on active or delayed journeys. Current status is ${journey.status}.`);
        err.statusCode = 400;
        throw err;
      }

      if (journey.is_settled) {
        const err: any = new Error('Cannot swap driver on a settled journey.');
        err.statusCode = 400;
        throw err;
      }

      const outgoingDriverId = journey.driver_id;
      if (String(outgoingDriverId) === String(incoming_driver_id)) {
        const err: any = new Error('Incoming driver must be different from current driver.');
        err.statusCode = 400;
        throw err;
      }

      if (handover_odometer < journey.start_odometer_kms) {
        const err: any = new Error(`Handover odometer (${handover_odometer} km) cannot be less than start odometer (${journey.start_odometer_kms} km).`);
        err.statusCode = 400;
        throw err;
      }

      const [outgoingDriver, incomingDriver, truck] = await Promise.all([
        Driver.findOne({ _id: outgoingDriverId, company_id: companyId, is_deleted: false }).session(session),
        Driver.findOne({ _id: incoming_driver_id, company_id: companyId, is_deleted: false }).session(session),
        Truck.findOne({ _id: journey.truck_id, company_id: companyId, is_deleted: false }).session(session),
      ]);

      if (!truck || truck.is_deleted) {
        const err: any = new Error('Assigned vehicle is unavailable.');
        err.statusCode = 400;
        throw err;
      }

      if (!incomingDriver || incomingDriver.is_deleted || incomingDriver.status !== 'active') {
        const err: any = new Error('Incoming driver is unavailable or inactive.');
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();

      // Step 1: Relieve outgoing driver
      if (outgoingDriver) {
        for (let i = outgoingDriver.assignment_history.length - 1; i >= 0; i--) {
          const entry = outgoingDriver.assignment_history[i];
          if (String(entry.truck_id) === String(truck._id) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            entry.notes = (entry.notes ? entry.notes + ' | ' : '') + `Handover at ${handover_odometer} km to ${incomingDriver.name}: ${trimmedReason}`;
            break;
          }
        }
        if (String(outgoingDriver.current_truck_id) === String(truck._id)) {
          outgoingDriver.current_truck_id = undefined;
          await outgoingDriver.save({ session });
          await Driver.updateOne(
            { _id: outgoingDriver._id, company_id: companyId },
            { $unset: { current_truck_id: 1 } },
            { session }
          );
        } else {
          await outgoingDriver.save({ session });
        }
      }

      // Step 2: Relieve incoming driver's previous idle truck assignment if any
      if (incomingDriver.current_truck_id && String(incomingDriver.current_truck_id) !== String(truck._id)) {
        const oldTruckId = incomingDriver.current_truck_id;
        const oldTruck = await Truck.findOne({ _id: oldTruckId, company_id: companyId, is_deleted: false }).session(session);
        if (oldTruck) {
          if (String(oldTruck.current_driver_id) === String(incomingDriver._id)) {
            for (let i = oldTruck.driver_assignments.length - 1; i >= 0; i--) {
              const entry = oldTruck.driver_assignments[i];
              if (String(entry.driver_id) === String(incomingDriver._id) && !entry.unassigned_at) {
                entry.unassigned_at = now;
                break;
              }
            }
            oldTruck.current_driver_id = undefined;
            await oldTruck.save({ session });
            await Truck.updateOne(
              { _id: oldTruckId, company_id: companyId },
              { $unset: { current_driver_id: 1 } },
              { session }
            );
          }
        }
        for (let i = incomingDriver.assignment_history.length - 1; i >= 0; i--) {
          const entry = incomingDriver.assignment_history[i];
          if (String(entry.truck_id) === String(oldTruckId) && !entry.unassigned_at) {
            entry.unassigned_at = now;
            break;
          }
        }
      }

      // Step 3: Attach incoming driver to truck
      incomingDriver.current_truck_id = truck._id as any;
      incomingDriver.assignment_history.push({
        truck_id: truck._id as any,
        assigned_at: now,
        notes: `Swapped in for Journey ${journey.journey_number} at ${handover_odometer} km. Reason: ${trimmedReason}`,
      });
      await incomingDriver.save({ session });

      // Step 4: Update truck assignments & odometer
      for (let i = truck.driver_assignments.length - 1; i >= 0; i--) {
        const entry = truck.driver_assignments[i];
        if (String(entry.driver_id) === String(outgoingDriverId) && !entry.unassigned_at) {
          entry.unassigned_at = now;
          entry.notes = (entry.notes ? entry.notes + ' | ' : '') + `Handover at ${handover_odometer} km to ${incomingDriver.name}: ${trimmedReason}`;
          break;
        }
      }

      truck.current_driver_id = incomingDriver._id as any;
      truck.driver_assignments.push({
        driver_id: incomingDriver._id as any,
        assigned_at: now,
        notes: `Swapped in during Journey ${journey.journey_number} at ${handover_odometer} km. Reason: ${trimmedReason}`,
      });
      if (handover_odometer > (truck.current_odometer_kms || 0)) {
        truck.current_odometer_kms = handover_odometer;
      }
      await truck.save({ session });

      // Step 5: Update Journey record
      journey.driver_id = incomingDriver._id as any;
      if (!journey.driver_handover_history) {
        journey.driver_handover_history = [];
      }
      journey.driver_handover_history.push({
        outgoing_driver_id: outgoingDriverId as any,
        incoming_driver_id: incomingDriver._id as any,
        handover_odometer,
        reason: trimmedReason,
        notes: notes ? notes.trim() : undefined,
        timestamp: now,
        authorized_by: req.user?.id,
      });

      journey.status_history.push({
        status: journey.status,
        timestamp: now,
        note: `Driver swap: ${outgoingDriver?.name || 'Driver'} replaced by ${incomingDriver.name} at ${handover_odometer} km. Reason: ${trimmedReason}`,
        actor_id: req.user?.id,
      });
      await journey.save({ session });

      // Step 6: Immutable Audit Log with Session
      await logAuditEvent({
        company_id: journey.company_id,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'UPDATE',
        description: `Driver swap executed for Journey ${journey.journey_number}: ${outgoingDriver?.name || 'Driver'} -> ${incomingDriver.name} at ${handover_odometer} km. Reason: ${trimmedReason}`,
        req,
        session,
        before_snapshot: {
          driver_id: outgoingDriverId,
          truck_id: journey.truck_id,
          status: journey.status,
        },
        after_snapshot: {
          driver_id: incomingDriver._id,
          truck_id: journey.truck_id,
          handover_odometer,
          reason: trimmedReason,
          notes,
          timestamp: now,
        },
      });

      return { journey, truck, outgoingDriver, incomingDriver };
    });

    return res.json({
      message: `Driver swap executed successfully for Journey ${result.journey.journey_number}.`,
      journey: result.journey,
    });
  } catch (error: any) {
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('swapDriver error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to execute driver swap.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/journeys/:id/adjustments
 * DEC-008 & QST-013: Audited Corrections & Late Adjustments to Completed Trips
 *
 * Rules & Invariants:
 * 1. Company Admin authorization strictly required (role: 'admin').
 * 2. Mandatory justification text >= 15 characters.
 * 3. Permitted ONLY on completed journeys (status === 'completed').
 *    Rejects draft, active, delayed, and cancelled journeys (HTTP 400).
 * 4. Rejects settled journeys (is_settled: true or active DriverSettlement) (HTTP 409).
 * 5. Strict tenant isolation on journey and all linked resources (BalanceParty, etc.).
 * 6. Financial adjustments:
 *    - Reconciles BalanceParty (credit vendor balance) with delta.
 *    - Posts adjusting General Ledger entries using postDoubleEntryJournal.
 *    - Never silently overwrites posted journal entries.
 * 7. Non-financial adjustments:
 *    - Preserves audit snapshots without creating redundant ledger entries.
 * 8. All reads, mutations, ledger entries, and audit logs execute atomically in runInTransaction.
 * 9. Completed journey status is preserved (never reopened to draft or active).
 * ----------------------------------------------------------------------------
 */
export const createCompletedTripAdjustment = async (req: Request, res: Response) => {
  try {
    // 1. Role Authorization: Company Admin only
    const userRole = (req as any).member?.role || (req as any).tenant?.role || (req.user as any)?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Only Company Admin can authorize completed-trip adjustments under DEC-008.',
      });
    }

    const id = req.params.id as string;
    const companyId =
      (req as any).company?._id ||
      (req as any).tenant?.id ||
      (req.user as any)?.company_id ||
      (req.headers['x-company-id'] as string);

    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Valid journey ID is required.' });
    }

    const { justification, adjustment_type, action, target_id, data } = req.body;

    // 2. Mandatory Justification Validation (>= 15 characters)
    if (!justification || typeof justification !== 'string' || justification.trim().length < 15) {
      return res.status(400).json({
        error: 'Justification reason is mandatory and must be at least 15 characters long.',
      });
    }

    const trimmedJustification = justification.trim();

    // 3. Adjustment Type Validation
    const validAdjustmentTypes = ['driver_expense', 'fuel_stop', 'non_financial'];
    if (!adjustment_type || !validAdjustmentTypes.includes(adjustment_type)) {
      return res.status(400).json({
        error: `Invalid adjustment type '${adjustment_type}'. Supported types: ${validAdjustmentTypes.join(', ')}.`,
      });
    }

    const payload = data || req.body;
    const effectiveAction = action || (target_id ? 'update' : 'create');

    const result = await runInTransaction(async (session) => {
      // 4. Load Journey with Tenant Isolation
      const journey = await TruckJourney.findOne({
        _id: id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!journey) {
        const err: any = new Error('Journey not found.');
        err.statusCode = 404;
        throw err;
      }

      // 5. State Machine Restriction: Must be 'completed'
      if (journey.status !== 'completed') {
        const err: any = new Error(
          `Completed-trip adjustments can only be applied to journeys in 'completed' status. Journey '${journey.journey_number}' is currently '${journey.status}'.`
        );
        err.statusCode = 400;
        throw err;
      }

      // 6. Settlement Invariant: Settled trips are locked from routine and adjustment changes
      if (journey.is_settled || journey.settlement_id) {
        const err: any = new Error(
          `Conflict: Cannot adjust completed journey '${journey.journey_number}' as it has already been settled in a completed driver payout.`
        );
        err.statusCode = 409;
        throw err;
      }

      const activeSettlement = await Settlement.findOne({
        company_id: companyId,
        journey_ids: journey._id,
        is_deleted: { $ne: true },
      }).session(session);

      if (activeSettlement) {
        const err: any = new Error(
          `Conflict: Cannot adjust completed journey '${journey.journey_number}' as it has already been settled in driver settlement '${activeSettlement.settlement_number}'.`
        );
        err.statusCode = 409;
        throw err;
      }

      // 7. Generate unique Adjustment Identifier
      const adjustmentId =
        req.body.adjustment_id ||
        `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Check for duplicate adjustment idempotency
      if (journey.adjustments && journey.adjustments.some((a: any) => a.adjustment_id === adjustmentId)) {
        const err: any = new Error(`Conflict: Duplicate adjustment identifier '${adjustmentId}'.`);
        err.statusCode = 409;
        throw err;
      }

      let beforeSnapshot: Record<string, any> | undefined;
      let afterSnapshot: Record<string, any> | undefined;
      let journalId: string | undefined;
      let financialImpact = 0;
      let affectedResource: any = null;

      // =======================================================================
      // CASE 1: DRIVER EXPENSE ADJUSTMENT
      // =======================================================================
      if (adjustment_type === 'driver_expense') {
        const targetExpenseId = target_id || payload.target_id || payload.expense_id;

        if (effectiveAction === 'update') {
          if (!targetExpenseId) {
            const err: any = new Error('target_id is required to update an existing driver expense.');
            err.statusCode = 400;
            throw err;
          }

          const expense = journey.driver_expenses.find(
            (e: any) => String(e._id) === String(targetExpenseId)
          );
          if (!expense) {
            const err: any = new Error('Driver expense record not found.');
            err.statusCode = 404;
            throw err;
          }

          beforeSnapshot = {
            expense_id: expense._id,
            expense_type: expense.expense_type,
            amount: expense.amount,
            notes: expense.notes,
            receipt_url: expense.receipt_url,
            date: expense.date,
          };

          if (payload.amount !== undefined) {
            const numAmount = Number(payload.amount);
            if (isNaN(numAmount) || numAmount <= 0) {
              const err: any = new Error('Expense amount must be a positive number.');
              err.statusCode = 400;
              throw err;
            }
            financialImpact = numAmount - expense.amount;
            expense.amount = numAmount;
          }

          if (payload.expense_type !== undefined) {
            const validTypes = [
              'toll',
              'loading',
              'unloading',
              'weighbridge',
              'rto_border',
              'minor_repair',
              'food_allowance',
              'other',
            ];
            if (!validTypes.includes(payload.expense_type)) {
              const err: any = new Error(
                `Invalid expense type '${payload.expense_type}'. Must be one of: ${validTypes.join(', ')}.`
              );
              err.statusCode = 400;
              throw err;
            }
            expense.expense_type = payload.expense_type;
          }

          if (payload.notes !== undefined) expense.notes = payload.notes;
          if (payload.receipt_url !== undefined) expense.receipt_url = payload.receipt_url;
          if (payload.date !== undefined) expense.date = new Date(payload.date);

          afterSnapshot = {
            expense_id: expense._id,
            expense_type: expense.expense_type,
            amount: expense.amount,
            notes: expense.notes,
            receipt_url: expense.receipt_url,
            date: expense.date,
          };
          affectedResource = expense;
        } else {
          // Create late expense
          const numAmount = Number(payload.amount);
          if (isNaN(numAmount) || numAmount <= 0) {
            const err: any = new Error('Expense amount must be a positive number.');
            err.statusCode = 400;
            throw err;
          }

          const validTypes = [
            'toll',
            'loading',
            'unloading',
            'weighbridge',
            'rto_border',
            'minor_repair',
            'food_allowance',
            'other',
          ];
          const expType = payload.expense_type || 'other';
          if (!validTypes.includes(expType)) {
            const err: any = new Error(
              `Invalid expense type '${expType}'. Must be one of: ${validTypes.join(', ')}.`
            );
            err.statusCode = 400;
            throw err;
          }

          const newExpense: any = {
            _id: new Types.ObjectId(),
            date: payload.date ? new Date(payload.date) : new Date(),
            expense_type: expType,
            amount: numAmount,
            notes: payload.notes || '',
            receipt_url: payload.receipt_url || '',
          };

          journey.driver_expenses.push(newExpense);
          financialImpact = numAmount;
          beforeSnapshot = undefined;
          afterSnapshot = { ...newExpense };
          affectedResource = newExpense;
        }
      }

      // =======================================================================
      // CASE 2: FUEL STOP ADJUSTMENT
      // =======================================================================
      else if (adjustment_type === 'fuel_stop') {
        const targetDieselId = target_id || payload.target_id || payload.diesel_id;

        if (effectiveAction === 'update') {
          if (!targetDieselId) {
            const err: any = new Error('target_id is required to update an existing diesel fuel stop.');
            err.statusCode = 400;
            throw err;
          }

          const dieselStop = journey.diesel_expenses.find(
            (d: any) => String(d._id) === String(targetDieselId)
          );
          if (!dieselStop) {
            const err: any = new Error('Diesel fuel stop record not found.');
            err.statusCode = 404;
            throw err;
          }

          const oldTotalCost = dieselStop.total_cost;
          const oldPaymentMode = dieselStop.payment_mode;
          const oldBalancePartyId = dieselStop.balance_party_id;

          beforeSnapshot = {
            diesel_id: dieselStop._id,
            petrol_pump_name: dieselStop.petrol_pump_name,
            slip_number: dieselStop.slip_number,
            fuel_quantity_litres: dieselStop.fuel_quantity_litres,
            rate_per_litre: dieselStop.rate_per_litre,
            total_cost: dieselStop.total_cost,
            payment_mode: dieselStop.payment_mode,
            balance_party_id: dieselStop.balance_party_id,
            slip_image_url: dieselStop.slip_image_url,
            filling_date: dieselStop.filling_date,
          };

          const newLitres =
            payload.fuel_quantity_litres !== undefined
              ? Number(payload.fuel_quantity_litres)
              : dieselStop.fuel_quantity_litres;
          const newRate =
            payload.rate_per_litre !== undefined
              ? Number(payload.rate_per_litre)
              : dieselStop.rate_per_litre;
          const newTotalCost =
            payload.total_cost !== undefined
              ? Number(payload.total_cost)
              : Math.round(newLitres * newRate * 100) / 100;

          if (isNaN(newLitres) || newLitres <= 0) {
            const err: any = new Error('Fuel quantity litres must be greater than zero.');
            err.statusCode = 400;
            throw err;
          }
          if (isNaN(newRate) || newRate < 0) {
            const err: any = new Error('Rate per litre cannot be negative.');
            err.statusCode = 400;
            throw err;
          }
          if (isNaN(newTotalCost) || newTotalCost < 0) {
            const err: any = new Error('Total cost cannot be negative.');
            err.statusCode = 400;
            throw err;
          }

          const newPaymentMode = payload.payment_mode || dieselStop.payment_mode;
          const newBalancePartyId =
            payload.balance_party_id !== undefined ? payload.balance_party_id : dieselStop.balance_party_id;

          const effectiveSlip = (payload.slip_number || dieselStop.slip_number || `ADJ-${dieselStop._id}`).trim();
          const effectivePumpName = (payload.petrol_pump_name || dieselStop.petrol_pump_name).trim();

          // Check slip uniqueness
          if (payload.slip_number) {
            const duplicate = journey.diesel_expenses.find(
              (d: any) =>
                String(d._id) !== String(dieselStop._id) &&
                d.slip_number &&
                d.slip_number.toLowerCase() === payload.slip_number.trim().toLowerCase()
            );
            if (duplicate) {
              const err: any = new Error(
                `Conflict: Slip number '${payload.slip_number}' already exists on this journey.`
              );
              err.statusCode = 409;
              throw err;
            }
          }

          // Validate vendor if credit mode
          if (newPaymentMode === 'credit' && newBalancePartyId) {
            const vendor = await BalanceParty.findOne({
              _id: newBalancePartyId,
              company_id: companyId,
            }).session(session);
            if (!vendor) {
              const err: any = new Error('Diesel vendor balance party not found for this tenant.');
              err.statusCode = 404;
              throw err;
            }
          }

          const delta = Math.round((newTotalCost - oldTotalCost) * 100) / 100;
          financialImpact = delta;

          // Double-Entry Adjustment
          if (newPaymentMode === oldPaymentMode && String(newBalancePartyId) === String(oldBalancePartyId)) {
            if (delta !== 0) {
              const fundingCategory =
                newPaymentMode === 'credit'
                  ? 'payment_made'
                  : newPaymentMode === 'cash'
                  ? 'driver_advance'
                  : 'bank_transfer';

              const ledgerMode =
                newPaymentMode === 'credit'
                  ? 'credit'
                  : newPaymentMode === 'cash'
                  ? 'cash'
                  : 'fuel_card';

              if (newPaymentMode === 'credit' && newBalancePartyId) {
                const vendor = await BalanceParty.findOne({
                  _id: newBalancePartyId,
                  company_id: companyId,
                }).session(session);
                if (vendor) {
                  vendor.current_balance = Math.round((vendor.current_balance + delta) * 100) / 100;
                  await vendor.save({ session });
                }
              }

              if (delta > 0) {
                const journal = await postDoubleEntryJournal({
                  company_id: companyId,
                  session,
                  transaction_type: 'journey',
                  description: `[DEC-008] Completed-trip fuel adjustment (+₹${delta}) for ${journey.journey_number}`,
                  reference_number: effectiveSlip,
                  party_name: effectivePumpName,
                  legs: [
                    {
                      category: 'diesel_expense',
                      balance_type: 'debit',
                      amount: delta,
                      payment_mode: ledgerMode,
                      party_name: effectivePumpName,
                      reference_number: effectiveSlip,
                      description: `Upward completed-trip fuel adjustment for ${journey.journey_number}`,
                      journey_id: journey._id,
                      truck_id: journey.truck_id,
                      driver_id: journey.driver_id,
                      balance_party_id: newBalancePartyId,
                    },
                    {
                      category: fundingCategory,
                      balance_type: 'credit',
                      amount: delta,
                      payment_mode: ledgerMode,
                      party_name: effectivePumpName,
                      reference_number: effectiveSlip,
                      description: `Upward credit/advance completed-trip adjustment for ${journey.journey_number}`,
                      journey_id: journey._id,
                      truck_id: journey.truck_id,
                      driver_id: journey.driver_id,
                      balance_party_id: newBalancePartyId,
                    },
                  ],
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                  created_by: req.user?._id,
                  is_auto_generated: true,
                });
                journalId = journal.journal_id;
              } else {
                const absDelta = Math.abs(delta);
                const journal = await postDoubleEntryJournal({
                  company_id: companyId,
                  session,
                  transaction_type: 'journey',
                  description: `[DEC-008] Completed-trip fuel downward adjustment (-₹${absDelta}) for ${journey.journey_number}`,
                  reference_number: effectiveSlip,
                  party_name: effectivePumpName,
                  legs: [
                    {
                      category: fundingCategory,
                      balance_type: 'debit',
                      amount: absDelta,
                      payment_mode: ledgerMode,
                      party_name: effectivePumpName,
                      reference_number: effectiveSlip,
                      description: `Downward adjustment reversal debit for ${journey.journey_number}`,
                      journey_id: journey._id,
                      truck_id: journey.truck_id,
                      driver_id: journey.driver_id,
                      balance_party_id: newBalancePartyId,
                    },
                    {
                      category: 'diesel_expense',
                      balance_type: 'credit',
                      amount: absDelta,
                      payment_mode: ledgerMode,
                      party_name: effectivePumpName,
                      reference_number: effectiveSlip,
                      description: `Downward adjustment diesel cost credit for ${journey.journey_number}`,
                      journey_id: journey._id,
                      truck_id: journey.truck_id,
                      driver_id: journey.driver_id,
                      balance_party_id: newBalancePartyId,
                    },
                  ],
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: newBalancePartyId,
                  created_by: req.user?._id,
                  is_auto_generated: true,
                });
                journalId = journal.journal_id;
              }
            }
          } else {
            // Mode or vendor reclassification
            if (oldPaymentMode === 'credit' && oldBalancePartyId) {
              const oldVendor = await BalanceParty.findOne({
                _id: oldBalancePartyId,
                company_id: companyId,
              }).session(session);
              if (oldVendor) {
                oldVendor.current_balance = Math.round((oldVendor.current_balance - oldTotalCost) * 100) / 100;
                await oldVendor.save({ session });
              }
            }

            const oldFundingCategory =
              oldPaymentMode === 'credit'
                ? 'payment_made'
                : oldPaymentMode === 'cash'
                ? 'driver_advance'
                : 'bank_transfer';
            const oldLedgerMode =
              oldPaymentMode === 'credit'
                ? 'credit'
                : oldPaymentMode === 'cash'
                ? 'cash'
                : 'fuel_card';

            await postDoubleEntryJournal({
              company_id: companyId,
              session,
              transaction_type: 'journey',
              description: `[DEC-008] Reversal of previous completed-trip fuel entry (₹${oldTotalCost}) on ${journey.journey_number}`,
              reference_number: `REV:${effectiveSlip}`,
              party_name: dieselStop.petrol_pump_name,
              legs: [
                {
                  category: oldFundingCategory,
                  balance_type: 'debit',
                  amount: oldTotalCost,
                  payment_mode: oldLedgerMode,
                  party_name: dieselStop.petrol_pump_name,
                  reference_number: `REV:${effectiveSlip}`,
                  description: `Reversal of original fuel funding for ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: oldBalancePartyId,
                },
                {
                  category: 'diesel_expense',
                  balance_type: 'credit',
                  amount: oldTotalCost,
                  payment_mode: oldLedgerMode,
                  party_name: dieselStop.petrol_pump_name,
                  reference_number: `REV:${effectiveSlip}`,
                  description: `Reversal of original diesel expense on ${journey.journey_number}`,
                  journey_id: journey._id,
                  truck_id: journey.truck_id,
                  driver_id: journey.driver_id,
                  balance_party_id: oldBalancePartyId,
                },
              ],
              journey_id: journey._id,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              balance_party_id: oldBalancePartyId,
              created_by: req.user?._id,
              is_auto_generated: true,
            });

            const newJournal = await postFuelExpenseJournal({
              company_id: companyId,
              session,
              journey_id: journey._id,
              journey_number: journey.journey_number,
              truck_id: journey.truck_id,
              driver_id: journey.driver_id,
              petrol_pump_name: effectivePumpName,
              fuel_quantity_litres: newLitres,
              rate_per_litre: newRate,
              total_cost: newTotalCost,
              payment_mode: newPaymentMode,
              slip_number: effectiveSlip,
              balance_party_id: newBalancePartyId,
              created_by: req.user?._id,
            });
            journalId = newJournal?.journal_id;
          }

          if (payload.petrol_pump_name !== undefined) dieselStop.petrol_pump_name = effectivePumpName;
          if (payload.slip_number !== undefined) dieselStop.slip_number = payload.slip_number.trim();
          dieselStop.fuel_quantity_litres = newLitres;
          dieselStop.rate_per_litre = newRate;
          dieselStop.total_cost = newTotalCost;
          dieselStop.payment_mode = newPaymentMode;
          dieselStop.balance_party_id = newBalancePartyId;
          if (payload.slip_image_url !== undefined) dieselStop.slip_image_url = payload.slip_image_url;
          if (payload.filling_date !== undefined) dieselStop.filling_date = new Date(payload.filling_date);

          afterSnapshot = {
            diesel_id: dieselStop._id,
            petrol_pump_name: dieselStop.petrol_pump_name,
            slip_number: dieselStop.slip_number,
            fuel_quantity_litres: dieselStop.fuel_quantity_litres,
            rate_per_litre: dieselStop.rate_per_litre,
            total_cost: newTotalCost,
            payment_mode: dieselStop.payment_mode,
            balance_party_id: dieselStop.balance_party_id,
            slip_image_url: dieselStop.slip_image_url,
            filling_date: dieselStop.filling_date,
          };
          affectedResource = dieselStop;
        } else {
          // Create late fuel stop
          const litres = Number(payload.fuel_quantity_litres);
          const rate = Number(payload.rate_per_litre);
          const cost =
            payload.total_cost !== undefined
              ? Number(payload.total_cost)
              : Math.round(litres * rate * 100) / 100;

          if (isNaN(litres) || litres <= 0) {
            const err: any = new Error('Fuel quantity litres must be greater than zero.');
            err.statusCode = 400;
            throw err;
          }
          if (isNaN(rate) || rate < 0) {
            const err: any = new Error('Rate per litre cannot be negative.');
            err.statusCode = 400;
            throw err;
          }
          if (isNaN(cost) || cost < 0) {
            const err: any = new Error('Total cost cannot be negative.');
            err.statusCode = 400;
            throw err;
          }

          const pumpName = (payload.petrol_pump_name || 'Late Fuel Station').trim();
          const slipNo = payload.slip_number ? payload.slip_number.trim() : undefined;
          const mode = payload.payment_mode || 'credit';
          const balancePartyId = payload.balance_party_id;

          if (slipNo) {
            const duplicate = journey.diesel_expenses.find(
              (d: any) => d.slip_number && d.slip_number.toLowerCase() === slipNo.toLowerCase()
            );
            if (duplicate) {
              const err: any = new Error(`Conflict: Slip number '${slipNo}' already exists on this journey.`);
              err.statusCode = 409;
              throw err;
            }
          }

          if (mode === 'credit' && balancePartyId) {
            const vendor = await BalanceParty.findOne({
              _id: balancePartyId,
              company_id: companyId,
            }).session(session);
            if (!vendor) {
              const err: any = new Error('Diesel vendor balance party not found for this tenant.');
              err.statusCode = 404;
              throw err;
            }
          }

          const newStop: any = {
            _id: new Types.ObjectId(),
            filling_date: payload.filling_date ? new Date(payload.filling_date) : new Date(),
            petrol_pump_name: pumpName,
            slip_number: slipNo,
            fuel_quantity_litres: litres,
            rate_per_litre: rate,
            total_cost: cost,
            payment_mode: mode,
            balance_party_id: balancePartyId,
            slip_image_url: payload.slip_image_url,
          };

          const journal = await postFuelExpenseJournal({
            company_id: companyId,
            session,
            journey_id: journey._id,
            journey_number: journey.journey_number,
            truck_id: journey.truck_id,
            driver_id: journey.driver_id,
            petrol_pump_name: pumpName,
            fuel_quantity_litres: litres,
            rate_per_litre: rate,
            total_cost: cost,
            payment_mode: mode,
            slip_number: slipNo || `LATE-${newStop._id}`,
            balance_party_id: balancePartyId,
            created_by: req.user?._id,
          });

          journalId = journal?.journal_id;
          journey.diesel_expenses.push(newStop);
          financialImpact = cost;
          beforeSnapshot = undefined;
          afterSnapshot = { ...newStop };
          affectedResource = newStop;
        }
      }

      // =======================================================================
      // CASE 3: NON-FINANCIAL ADJUSTMENT
      // =======================================================================
      else if (adjustment_type === 'non_financial') {
        const { target_field, new_value, fields, ...restPayload } = payload;
        let updates: Record<string, any> = {};

        if (fields && typeof fields === 'object') {
          updates = { ...fields };
        } else if (target_field && new_value !== undefined) {
          updates = { [target_field]: new_value };
        } else {
          updates = { ...restPayload };
        }

        // Strip non-field envelope properties
        delete updates.justification;
        delete updates.adjustment_type;
        delete updates.adjustment_id;
        delete updates.action;
        delete updates.target_id;
        delete updates.data;

        if (!updates || Object.keys(updates).length === 0) {
          const err: any = new Error('No non-financial fields provided to update.');
          err.statusCode = 400;
          throw err;
        }

        beforeSnapshot = {};
        afterSnapshot = {};

        // Allowed non-financial fields on journey
        const allowedNonFinancial = [
          'pod_slip_url',
          'delivered_to',
          'cargo_description',
          'end_odometer_kms',
          'empty_container_yard_return_date',
        ];

        for (const [k, v] of Object.entries(updates)) {
          if (allowedNonFinancial.includes(k)) {
            beforeSnapshot[k] = (journey as any)[k];
            (journey as any)[k] = v;
            afterSnapshot[k] = v;
          } else if (k === 'notes') {
            if (!journey.delivered_to) journey.delivered_to = {};
            beforeSnapshot.notes = journey.delivered_to.notes;
            journey.delivered_to.notes = v as string;
            afterSnapshot.notes = v;
          } else if ((k === 'expense_receipt_url' || k === 'receipt_url') && (payload.target_id || target_id)) {
            // Update receipt voucher on a sub-resource without changing amounts
            const tId = payload.target_id || target_id;
            const expense = journey.driver_expenses.find(
              (e: any) => String(e._id) === String(tId)
            );
            if (expense) {
              beforeSnapshot.receipt_url = expense.receipt_url;
              expense.receipt_url = v as string;
              afterSnapshot.receipt_url = v;
            }
          }
        }

        financialImpact = 0;
        // Zero financial journal entries posted for non-financial adjustments
      }

      // 8. Record the Adjustment in journey.adjustments
      const adjustmentEntry: any = {
        adjustment_id: adjustmentId,
        adjustment_type,
        action: effectiveAction,
        target_id: target_id ? new Types.ObjectId(target_id as string) : undefined,
        target_field: payload.target_field,
        previous_snapshot: beforeSnapshot,
        new_snapshot: afterSnapshot,
        justification: trimmedJustification,
        actor_id: (req.user as any)?._id || (req.user as any)?.id,
        actor_name: (req.user as any)?.name || (req.user as any)?.email || 'Company Admin',
        actor_role: (req.user as any)?.role || 'admin',
        applied_at: new Date(),
        journal_id: journalId,
        financial_impact: financialImpact,
      };

      if (!journey.adjustments) {
        journey.adjustments = [];
      }
      journey.adjustments.push(adjustmentEntry);

      // Save journey: recalculates computed totals in pre-save hook
      await journey.save({ session });

      // 9. Centralized Regulatory Audit Log
      await logAuditEvent({
        company_id: companyId,
        entity_type: 'journey' as any,
        entity_id: journey._id,
        entity_identifier: journey.journey_number,
        action: 'UPDATE',
        description: `[DEC-008] Completed-trip adjustment (${adjustment_type}, ${effectiveAction}) approved by Admin: ${trimmedJustification}`,
        req,
        session,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
      });

      return { journey, adjustment: adjustmentEntry, affectedResource };
    });

    return res.status(201).json({
      message: 'Completed trip adjustment successfully applied.',
      adjustment: result.adjustment,
      journey: result.journey,
    });
  } catch (error: any) {
    if (error instanceof TenantOwnershipError) {
      return res.status(error.statusCode).json({ error: error.message, entityType: error.entityType });
    }
    if (error instanceof ConfigurationError) {
      return res.status(500).json({ error: error.message, code: 'CONFIGURATION_ERROR' });
    }
    console.error('createCompletedTripAdjustment error:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to apply completed trip adjustment.',
    });
  }
};

