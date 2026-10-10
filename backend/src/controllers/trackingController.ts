/**
 * ============================================================================
 * TRACKING CONTROLLER (trackingController.ts)
 * ============================================================================
 * Handles GPS telemetry ingestion, live vehicle tracking, trip incident
 * reporting, and PUBLIC consignment tracking with strict PII sanitization.
 * 
 * Routes:
 *   POST /api/telematics/ping        - Ingest GPS ping from tracker/driver app
 *   GET  /api/telematics/live/:truckId - Latest location for a truck
 *   GET  /api/telematics/fleet-live  - All active trucks with latest positions
 *   POST /api/telematics/incident    - Report trip incident
 *   GET  /api/public/track/:lrNumber - Public consignment tracking (sanitized)
 * ============================================================================
 */

import { Request, Response } from 'express';
import { VehicleLocationLog } from '../models/VehicleLocationLog.js';
import { TripIncident } from '../models/TripIncident.js';
import { Entry } from '../models/Entry.js';
import { Truck } from '../models/Truck.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { getTenantId } from '../plugins/tenantPlugin.js';
import { isCorridorDeviation, haversineDistance } from '../utils/geofenceService.js';

/**
 * POST /api/telematics/ping
 * Ingest a GPS location ping from AIS-140 device, OBD, or driver smartphone app.
 */
export async function ingestGpsPing(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const {
      truck_id,
      journey_id,
      latitude,
      longitude,
      speed_kmh = 0,
      heading_degrees = 0,
      ignition_on = true,
      odometer_kms,
      altitude_m,
      accuracy_m,
      source = 'driver_app',
      recorded_at,
    } = req.body;

    if (!truck_id || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'truck_id, latitude, and longitude are required.' });
      return;
    }

    const log = await VehicleLocationLog.create({
      company_id: companyId,
      truck_id,
      journey_id,
      latitude,
      longitude,
      speed_kmh,
      heading_degrees,
      ignition_on,
      odometer_kms,
      altitude_m,
      accuracy_m,
      source,
      recorded_at: recorded_at ? new Date(recorded_at) : new Date(),
    });

    res.status(201).json({ success: true, log_id: log._id, message: 'GPS ping recorded.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/telematics/live/:truckId
 * Returns the latest GPS position for a specific truck.
 */
export async function getLiveTruckLocation(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const { truckId } = req.params;

    const latest = await VehicleLocationLog.findOne({
      company_id: companyId,
      truck_id: truckId,
    }).sort({ recorded_at: -1 }).lean();

    if (!latest) {
      res.status(404).json({ error: 'No GPS data found for this truck.' });
      return;
    }

    res.json({ location: latest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/telematics/fleet-live
 * Returns the latest positions of all active trucks for the dispatcher birds-eye map.
 */
export async function getFleetLiveMap(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);

    // Get all trucks for this company
    const trucks = await Truck.find({ company_id: companyId, is_active: true }).select('_id registration_number truck_type').lean();
    
    // For each truck get its latest location
    const fleetPositions = await Promise.all(
      trucks.map(async (truck) => {
        const latest = await VehicleLocationLog.findOne({
          company_id: companyId,
          truck_id: truck._id,
        }).sort({ recorded_at: -1 }).lean();
        
        return {
          truck_id: truck._id,
          registration_number: truck.truck_no,
          truck_type: truck.body_type,
          location: latest || null,
        };
      })
    );

    // Filter to only trucks with recent location data (within last 24h)
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    const activeTrucks = fleetPositions.filter(
      (t) => t.location && new Date(t.location.recorded_at) > cutoff
    );

    res.json({ trucks: activeTrucks, total: activeTrucks.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/telematics/incident
 * Driver reports a trip incident (breakdown, puncture, accident, etc.)
 */
export async function reportTripIncident(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getTenantId(req);
    const {
      journey_id,
      truck_id,
      driver_id,
      category,
      description,
      latitude,
      longitude,
      landmark,
      is_emergency = false,
    } = req.body;

    if (!journey_id || !truck_id || !category || !description) {
      res.status(400).json({ error: 'journey_id, truck_id, category, and description are required.' });
      return;
    }

    const incident = await TripIncident.create({
      company_id: companyId,
      journey_id,
      truck_id,
      driver_id,
      category,
      description,
      latitude,
      longitude,
      landmark,
      is_emergency,
      reported_at: new Date(),
      status: 'open',
    });

    res.status(201).json({ success: true, incident_id: incident._id, message: 'Incident reported successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/public/track/:lrNumber
 * PUBLIC endpoint — returns sanitized consignment tracking data.
 * STRICTLY strips: freight amounts, advance, margins, driver PII, Aadhaar, full phone numbers.
 */
export async function publicTrackConsignment(req: Request, res: Response): Promise<void> {
  try {
    const lrParam = req.params.lrNumber;

    if (!lrParam) {
      res.status(400).json({ error: 'LR Number is required.' });
      return;
    }

    const cleanLr = (Array.isArray(lrParam) ? lrParam[0] : lrParam).toUpperCase().trim();

    // Find the entry — no company_id scoping needed for public tracking
    const entry = await Entry.findOne({
      $or: [{ lr_no: cleanLr }, { bill_no: cleanLr }],
    }).lean();

    if (!entry) {
      res.status(404).json({ error: 'Consignment not found. Please verify the LR number.' });
      return;
    }

    // Get the associated journey for milestone and vehicle data
    const journey = entry.journey_id
      ? await TruckJourney.findById(entry.journey_id)
          .populate('truck_id', 'truck_no body_type')
          .select('status route_checkpoints from_location to_location start_date truck_id')
          .lean()
      : null;

    // Get latest truck location if available
    let liveLocation = null;
    let truckObj = journey ? (journey.truck_id as any) : null;

    if (!truckObj && entry.vehicle_number) {
      truckObj = await Truck.findOne({ truck_no: entry.vehicle_number.toUpperCase().trim() }).lean();
    }

    if (truckObj?._id) {
      const latestLog = await VehicleLocationLog.findOne({
        truck_id: truckObj._id,
        recorded_at: { $gte: new Date(Date.now() - 4 * 3600 * 1000) }, // within last 4 hours
      })
        .sort({ recorded_at: -1 })
        .select('latitude longitude speed_kmh recorded_at landmark')
        .lean();
      liveLocation = latestLog;
    }

    // =========================================================
    // STRICT PII SANITIZATION — ONLY THESE FIELDS ARE RETURNED
    // =========================================================
    const vehicleReg = truckObj?.truck_no || entry.vehicle_number;
    const maskedReg = vehicleReg
      ? vehicleReg.replace(/(.{4})(.+)(.{2})/, '$1****$3')
      : undefined;

    const isDispatched = !!journey && ['active', 'completed', 'delayed'].includes(journey.status);
    const isDelivered = (journey && journey.status === 'completed') || entry.status === 'invoiced';

    const sanitizedResponse = {
      lr_number: entry.lr_no,
      booking_date: entry.bill_date || entry.lr_date || entry.created_at,
      from_city: entry.from_location,
      to_city: entry.to_location,
      consignment_description: entry.goods_description,
      package_count: entry.package_count,
      weight_kg: (entry.actual_weight_tonnes || 0) * 1000,
      status: entry.status,
      vehicle_type: truckObj?.body_type,
      masked_vehicle_registration: maskedReg,
      milestones: [
        { label: 'Booked', completed: true },
        { label: 'Dispatched', completed: isDispatched },
        { label: 'In Transit', completed: isDispatched && !isDelivered },
        { label: 'Delivered', completed: isDelivered },
      ],
      live_location: liveLocation
        ? {
            latitude: liveLocation.latitude,
            longitude: liveLocation.longitude,
            speed_kmh: liveLocation.speed_kmh,
            landmark: liveLocation.landmark,
            last_updated: liveLocation.recorded_at,
          }
        : null,
      journey_route: journey
        ? {
            from: typeof journey.from_location === 'object' ? journey.from_location.city : journey.from_location,
            to: typeof journey.to_location === 'object' ? journey.to_location.city : journey.to_location,
          }
        : null,
      // FORBIDDEN: freight_amount, advance, balance, billing_party, driver_phone, aadhaar, margins
    };

    res.json(sanitizedResponse);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
