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
import { Types } from 'mongoose';
import { VehicleLocationLog } from '../models/VehicleLocationLog.js';
import { TripIncident } from '../models/TripIncident.js';
import { Entry } from '../models/Entry.js';
import { Truck } from '../models/Truck.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Company } from '../models/Company.js';
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

    // Get all active trucks for this company
    const trucks = await Truck.find({
      company_id: companyId,
      status: { $in: ['active', 'available', 'on_trip'] },
      is_deleted: false,
    })
      .select('_id truck_no body_type make model status')
      .lean();
    
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
          truck_no: truck.truck_no,
          truck_type: truck.body_type,
          body_type: truck.body_type,
          make: truck.make,
          model: truck.model,
          status: truck.status,
          location: latest || null,
        };
      })
    );

    res.json({ trucks: fleetPositions, total: fleetPositions.length });
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
 * GET /api/public/track/:lrNumber (or /api/public/track?token=...)
 * PUBLIC endpoint — returns sanitized consignment tracking data.
 * STRICTLY rejects unverified raw LR lookups (ISS-005).
 * STRICTLY strips: freight amounts, advance, margins, driver PII, Aadhaar, full phone numbers.
 */
export async function publicTrackConsignment(req: Request, res: Response): Promise<void> {
  try {
    const rawParam = req.params.lrNumber || (req.params as any).identifier;
    const tokenQuery = req.query.token as string | undefined;
    const lrQuery = req.query.lr_no as string | undefined;
    const companyCodeQuery = (req.query.company_code as string | undefined) || (req.query.company as string | undefined);
    const phoneQuery = req.query.phone as string | undefined;

    // Detect whether an unguessable tracking_token was supplied
    const token = tokenQuery || (rawParam && rawParam.startsWith('trk_') ? rawParam : undefined);
    const lrParam = lrQuery || (rawParam && !rawParam.startsWith('trk_') ? rawParam : undefined);

    let entry: any = null;
    let resolvedCompany: any = null;

    if (token) {
      // Primary workflow: Unguessable cryptographically secure token lookup
      entry = await Entry.findOne({ tracking_token: token.trim() })
        .setOptions({ skipTenantCheck: true })
        .lean();

      if (!entry) {
        res.status(404).json({ error: 'Consignment tracking reference not found.' });
        return;
      }

      resolvedCompany = await Company.findById(entry.company_id).lean();
    } else if (companyCodeQuery && lrParam && phoneQuery) {
      // Secondary fallback workflow: 3-factor verified lookup (Company Code + LR No + Phone)
      const cleanCompanyCode = companyCodeQuery.trim();
      const cleanPhone = phoneQuery.trim();
      const cleanLr = lrParam.toUpperCase().trim();

      resolvedCompany = await Company.findOne({
        $or: [
          { slug: cleanCompanyCode.toLowerCase() },
          ...(Types.ObjectId.isValid(cleanCompanyCode) ? [{ _id: new Types.ObjectId(cleanCompanyCode) }] : [])
        ]
      }).lean();

      if (!resolvedCompany) {
        res.status(404).json({ error: 'Company tracking reference not found.' });
        return;
      }

      entry = await Entry.findOne({
        company_id: resolvedCompany._id,
        $or: [{ lr_no: cleanLr }, { bill_no: cleanLr }],
        $and: [
          {
            $or: [
              { 'consignor.phone': cleanPhone },
              { 'consignee.phone': cleanPhone }
            ]
          }
        ]
      })
        .setOptions({ skipTenantCheck: true })
        .lean();

      if (!entry) {
        res.status(404).json({ error: 'Consignment not found or phone number verification failed.' });
        return;
      }
    } else {
      // REJECT unverified raw sequential LR lookup to prevent cross-tenant enumeration and IDOR
      res.status(400).json({
        error: 'Valid tracking token or verified query credentials (company_code, lr_no, phone) are required.'
      });
      return;
    }

    // Get the associated journey for milestone and vehicle data
    const journey = entry.journey_id
      ? await TruckJourney.findOne({ _id: entry.journey_id })
          .setOptions({ skipTenantCheck: true })
          .populate('truck_id', 'truck_no body_type')
          .select('status route_checkpoints from_location to_location start_date truck_id')
          .lean()
      : null;

    // Get latest truck location if available (sanitized landmark only)
    let liveLocation: any = null;
    let truckObj = journey ? (journey.truck_id as any) : null;

    if (!truckObj && entry.vehicle_number) {
      truckObj = await Truck.findOne({
        truck_no: entry.vehicle_number.toUpperCase().trim(),
      })
        .setOptions({ skipTenantCheck: true })
        .lean();
    }

    if (truckObj?._id) {
      const latestLog = await VehicleLocationLog.findOne({
        truck_id: truckObj._id,
        recorded_at: { $gte: new Date(Date.now() - 4 * 3600 * 1000) }, // within last 4 hours
      })
        .setOptions({ skipTenantCheck: true })
        .sort({ recorded_at: -1 })
        .select('latitude longitude speed_kmh recorded_at landmark')
        .lean();
      liveLocation = latestLog;
    }

    // =========================================================
    // STRICT PII & FINANCIAL SANITIZATION (ISS-005)
    // =========================================================
    const vehicleReg = truckObj?.truck_no || entry.vehicle_number;
    const maskedReg = vehicleReg
      ? vehicleReg.replace(/(.{4})(.+)(.{2})/, '$1****$3')
      : 'Allocated Vehicle';

    const isDispatched = !!journey && ['active', 'completed', 'delayed'].includes(journey.status);
    const isDelivered = (journey && journey.status === 'completed') || entry.status === 'invoiced';

    // Map status enum to frontend contract
    let currentStatus: 'BOOKED' | 'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' = 'BOOKED';
    if (isDelivered) {
      currentStatus = 'DELIVERED';
    } else if (isDispatched) {
      currentStatus = 'IN_TRANSIT';
    }

    const bookingDateStr = (entry.bill_date || entry.lr_date || (entry as any).created_at || new Date()).toISOString();

    const originCity = typeof entry.from_location === 'object' ? (entry.from_location as any).city : entry.from_location || 'Origin Hub';
    const destCity = typeof entry.to_location === 'object' ? (entry.to_location as any).city : entry.to_location || 'Destination Hub';

    const sanitizedResponse = {
      tracking_reference: entry.tracking_token || entry.lr_no,
      bill_reference: entry.bill_no,
      booking_date: bookingDateStr,
      carrier: {
        company_name: resolvedCompany?.name || 'Authorized Logistics Partner',
      },
      transit: {
        origin: originCity,
        destination: destCity,
        vehicle_number: maskedReg,
        last_known_location: liveLocation?.landmark || (isDispatched ? 'In Transit Corridor' : originCity),
        current_status: currentStatus,
        is_delivered: isDelivered,
      },
      consignment: {
        consignor_name: entry.consignor?.name || 'Authorized Shipper',
        consignee_name: entry.consignee?.name || 'Authorized Receiver',
        package_count: entry.package_count || 0,
        packaging_type: entry.packaging_type || 'Standard Freight',
        goods_description: entry.goods_description || 'Commercial Freight',
        actual_weight_tonnes: entry.actual_weight_tonnes || 0,
        has_pod: isDelivered,
        pod_preview_url: null,
      },
      milestones: [
        {
          step: 1,
          key: 'booked',
          title: 'Consignment Booked',
          description: `Consignment registered at origin hub`,
          location: originCity,
          timestamp: bookingDateStr,
          status: 'completed' as const,
        },
        {
          step: 2,
          key: 'dispatched',
          title: 'Dispatched from Hub',
          description: isDispatched ? 'Vehicle departed origin terminal' : 'Awaiting departure schedule',
          location: originCity,
          status: isDispatched ? ('completed' as const) : ('upcoming' as const),
        },
        {
          step: 3,
          key: 'in_transit',
          title: 'In Transit',
          description: isDispatched && !isDelivered ? 'Moving through freight transit corridor' : (isDelivered ? 'Corridor transit completed' : 'Awaiting dispatch'),
          location: liveLocation?.landmark || 'Transit Corridor',
          status: isDelivered ? ('completed' as const) : (isDispatched ? ('current' as const) : ('upcoming' as const)),
        },
        {
          step: 4,
          key: 'out_for_delivery',
          title: 'Out for Delivery',
          description: isDelivered ? 'Arrived at destination hub for unloading' : 'Scheduled upon arrival',
          location: destCity,
          status: isDelivered ? ('completed' as const) : ('upcoming' as const),
        },
        {
          step: 5,
          key: 'delivered',
          title: 'Consignment Delivered',
          description: isDelivered ? 'Delivered successfully to consignee' : 'Pending final delivery milestone',
          location: destCity,
          status: isDelivered ? ('completed' as const) : ('upcoming' as const),
        },
      ],
      last_updated_at: new Date().toISOString(),

      // Backward-compatibility flat aliases
      lr_number: entry.lr_no,
      from_city: originCity,
      to_city: destCity,
      consignment_description: entry.goods_description,
      package_count: entry.package_count,
      weight_kg: (entry.actual_weight_tonnes || 0) * 1000,
      status: entry.status,
      masked_vehicle_registration: maskedReg,
      // STRICTLY EXCLUDED: freight_amount, advance, balance, driver_phone, aadhaar, license, raw GPS lat/lng
    };

    res.json(sanitizedResponse);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
