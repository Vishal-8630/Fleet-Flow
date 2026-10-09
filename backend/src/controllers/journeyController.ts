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
import { TruckJourney, JourneyStatus } from '../models/TruckJourney.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { Company } from '../models/Company.js';

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

    const { status, truck_id, driver_id, search, from_date, to_date } = req.query;

    const filter: any = { is_deleted: { $ne: true } };

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

    // Aggregate total diesel and average mileage across journeys this month
    const mileageAgg = await TruckJourney.aggregate([
      {
        $match: {
          company_id: companyId,
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

    // 1. Fetch Truck & Driver
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

    // 2. RESOURCE CONFLICT CHECK: Verify Truck is not on an active journey
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

    // 3. RESOURCE CONFLICT CHECK: Verify Driver is not on an active journey
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

    // 4. Check compliance if immediately dispatching
    if (status === 'active') {
      const compliance = truck.calculateComplianceStatus();
      if (compliance === 'EXPIRED') {
        return res.status(422).json({
          error: `Compliance Alert: Vehicle ${truck.truck_no} has expired statutory documents. Renew certificates before dispatching.`,
        });
      }
    }

    // 5. Generate sequential journey number
    const count = await TruckJourney.countDocuments({ company_id: companyId });
    const prefix = company?.settings?.lr_prefix || 'JRN-';
    const journey_number = `${prefix}${String(count + 1).padStart(4, '0')}`;

    // 6. Use current truck odometer if start_odometer_kms not supplied
    const initialOdometer =
      typeof start_odometer_kms === 'number' ? start_odometer_kms : truck.current_odometer_kms || 0;

    const journey = new TruckJourney({
      company_id: companyId,
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

    // 7. If dispatched as active, update vehicle and driver status
    if (status === 'active') {
      truck.status = 'on_trip';
      truck.current_driver_id = driver._id;
      await truck.save();
    }

    return res.status(201).json({
      message: 'Journey successfully scheduled.',
      journey,
    });
  } catch (error: any) {
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

    // Execute dispatch
    journey.status = 'active';
    journey.start_date = new Date();
    journey.status_history.push({
      status: 'active',
      timestamp: new Date(),
      note: req.body.note || 'Vehicle flagged active and departed origin facility.',
      actor_id: req.user?.id,
    });

    await journey.save();

    // Lock truck
    truck.status = 'on_trip';
    truck.current_driver_id = driver._id;
    await truck.save();

    return res.json({
      message: `Journey ${journey.journey_number} successfully dispatched.`,
      journey,
    });
  } catch (error: any) {
    console.error('dispatchJourney error:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch journey.' });
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

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
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

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
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
    const {
      petrol_pump_name,
      slip_number,
      fuel_quantity_litres,
      rate_per_litre,
      payment_mode = 'credit',
      slip_image_url,
      filling_date,
    } = req.body;

    if (!petrol_pump_name || !fuel_quantity_litres || !rate_per_litre) {
      return res.status(400).json({
        error: 'Petrol pump name, fuel litres, and rate per litre are required.',
      });
    }

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    const total_cost = Math.round(Number(fuel_quantity_litres) * Number(rate_per_litre) * 100) / 100;

    journey.diesel_expenses.push({
      filling_date: filling_date ? new Date(filling_date) : new Date(),
      petrol_pump_name,
      slip_number,
      fuel_quantity_litres: Number(fuel_quantity_litres),
      rate_per_litre: Number(rate_per_litre),
      total_cost,
      payment_mode,
      slip_image_url,
    });

    await journey.save();

    return res.json({
      message: 'Diesel fuel stop logged successfully.',
      journey,
    });
  } catch (error: any) {
    console.error('addDieselStop error:', error);
    return res.status(500).json({ error: error.message || 'Failed to log diesel stop.' });
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

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
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
 * POST /api/operations/journeys/:id/pod
 * Confirm delivery, upload POD slip, record final odometer, and complete journey
 * ----------------------------------------------------------------------------
 */
export const completeDeliveryAndPOD = async (req: Request, res: Response) => {
  try {
    const { contact_name, end_odometer_kms, pod_slip_url, notes } = req.body;

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.status === 'completed') {
      return res.status(400).json({ error: 'Journey is already completed.' });
    }

    // Validate odometer
    if (typeof end_odometer_kms === 'number') {
      if (end_odometer_kms < journey.start_odometer_kms) {
        return res.status(400).json({
          error: `End odometer (${end_odometer_kms} km) cannot be less than start odometer (${journey.start_odometer_kms} km).`,
        });
      }
      journey.end_odometer_kms = end_odometer_kms;
    }

    journey.delivery_status = 'delivered';
    journey.delivered_to = {
      contact_name: contact_name || 'Consignee Receiver',
      delivery_timestamp: new Date(),
      notes,
    };
    if (pod_slip_url) {
      journey.pod_slip_url = pod_slip_url;
    }

    journey.status = 'completed';
    journey.actual_end_date = new Date();
    journey.status_history.push({
      status: 'completed',
      timestamp: new Date(),
      note: `Delivery confirmed at destination. POD documented. Completed by ${req.user?.name || 'Dispatcher'}.`,
      actor_id: req.user?.id,
    });

    await journey.save();

    // Release vehicle back to 'available' pool and sync odometer
    const truck = await Truck.findById(journey.truck_id);
    if (truck) {
      truck.status = 'available';
      if (journey.end_odometer_kms && journey.end_odometer_kms > truck.current_odometer_kms) {
        truck.current_odometer_kms = journey.end_odometer_kms;
      }
      await truck.save();
    }

    return res.json({
      message: `Journey ${journey.journey_number} marked completed and delivery acknowledged.`,
      journey,
    });
  } catch (error: any) {
    console.error('completeDeliveryAndPOD error:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete delivery.' });
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

    const journey = await TruckJourney.findById(req.params.id);
    if (!journey || journey.is_deleted) {
      return res.status(404).json({ error: 'Journey not found.' });
    }

    if (journey.status === 'completed') {
      return res.status(400).json({ error: 'Completed journeys cannot be cancelled.' });
    }

    journey.status = 'cancelled';
    journey.status_history.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: reason || 'Journey aborted by dispatcher.',
      actor_id: req.user?.id,
    });

    await journey.save();

    // Release vehicle
    const truck = await Truck.findById(journey.truck_id);
    if (truck && truck.status === 'on_trip') {
      truck.status = 'available';
      await truck.save();
    }

    return res.json({
      message: `Journey ${journey.journey_number} has been cancelled.`,
      journey,
    });
  } catch (error: any) {
    console.error('cancelJourney error:', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel journey.' });
  }
};
