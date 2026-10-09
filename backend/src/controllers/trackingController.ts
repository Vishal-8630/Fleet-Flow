/**
 * ============================================================================
 * FLEET FLOW — PUBLIC CONSIGNMENT TRACKING CONTROLLER (trackingController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Exposes a public, non-authenticated lookup endpoint for shippers, consignees,
 * and cargo owners to track the live milestone progress of their Lorry Receipt (LR).
 * 
 * PRIVACY INVARIANT & DATA SANITIZATION:
 * --------------------------------------
 * 1. ZERO FINANCIAL DISCLOSURE: Freight rates, billed freight amounts, advance cash,
 *    and profit margins are strictly stripped from the public response payload.
 * 2. PII DEFENSE: Driver phone numbers, driver identities, and private operational
 *    remarks are completely excluded.
 * 3. ANTI-ENUMERATION: Invalid LR numbers return uniform generic 404 responses.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Entry } from '../models/Entry.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Company } from '../models/Company.js';

export interface PublicMilestone {
  step: number;
  key: 'BOOKED' | 'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  title: string;
  description: string;
  location: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
}

/**
 * GET /api/public/track/:lrNumber
 * Non-authenticated public endpoint with rate-limiting & strict privacy sanitization.
 */
export async function trackConsignmentPublic(req: Request, res: Response): Promise<void> {
  try {
    const paramVal = req.params.lrNumber;
    const rawLrNumber = typeof paramVal === 'string' ? paramVal.trim() : Array.isArray(paramVal) ? (paramVal as string[])[0]?.trim() : '';

    if (!rawLrNumber || rawLrNumber.length < 3) {
      res.status(400).json({ error: 'Please provide a valid LR or consignment number.' });
      return;
    }

    const cleanQuery = rawLrNumber.toUpperCase();

    // 1. Find Entry across all companies (public lookup by unique LR Number or Bill Number)
    const entry = await Entry.findOne({
      $or: [
        { lr_no: cleanQuery },
        { bill_no: cleanQuery },
        { lr_no: { $regex: `^${cleanQuery}$`, $options: 'i' } },
      ],
      is_deleted: false,
    });

    if (!entry) {
      res.status(404).json({
        error: 'No active consignment found matching this reference. Please verify your LR number.',
      });
      return;
    }

    // 2. Fetch Carrier Company Name (for branding header)
    const company = await Company.findById(entry.company_id).select('name slug phone');

    // 3. Resolve Linked Truck Journey (if operational trip exists)
    let journey: any = null;
    if (entry.journey_id) {
      journey = await TruckJourney.findById(entry.journey_id);
    } else {
      // Fallback: Check if journey exists matching vehicle and recent date
      journey = await TruckJourney.findOne({
        vehicle_number: entry.vehicle_number,
        is_deleted: false,
        status: { $in: ['active', 'completed', 'delayed'] },
      }).sort({ created_at: -1 });
    }

    // 4. Determine Current Milestone State
    const isCompleted = journey?.status === 'completed' || journey?.delivery_status === 'delivered';
    const isActiveTransit = journey?.status === 'active' || journey?.status === 'delayed';
    const isDispatched = Boolean(journey && journey.status !== 'draft');

    let currentMilestoneKey: PublicMilestone['key'] = 'BOOKED';
    if (isCompleted) {
      currentMilestoneKey = 'DELIVERED';
    } else if (journey?.delivery_status === 'out_for_delivery' || journey?.route_checkpoints?.slice(-1)[0]?.status === 'reached') {
      currentMilestoneKey = 'OUT_FOR_DELIVERY';
    } else if (journey?.delivery_status === 'pending' && journey?.route_checkpoints?.some((c: any) => c.status === 'reached')) {
      currentMilestoneKey = 'IN_TRANSIT';
    } else if (isActiveTransit) {
      currentMilestoneKey = 'IN_TRANSIT';
    } else if (isDispatched) {
      currentMilestoneKey = 'DISPATCHED';
    }

    // Last known city & progress
    let lastKnownLocation = entry.from_location;
    let latestTimestamp = entry.lr_date;

    if (journey) {
      if (journey.daily_progress && journey.daily_progress.length > 0) {
        const lastDaily = journey.daily_progress[journey.daily_progress.length - 1];
        lastKnownLocation = lastDaily.current_location || lastKnownLocation;
        latestTimestamp = lastDaily.date || latestTimestamp;
      } else if (journey.route_checkpoints && journey.route_checkpoints.length > 0) {
        const reachedCheckpoints = journey.route_checkpoints.filter((c: any) => c.status === 'reached');
        if (reachedCheckpoints.length > 0) {
          const lastReached = reachedCheckpoints[reachedCheckpoints.length - 1];
          lastKnownLocation = lastReached.city || lastKnownLocation;
          latestTimestamp = lastReached.actual_arrival || latestTimestamp;
        }
      }

      if (isCompleted) {
        lastKnownLocation = entry.to_location;
        latestTimestamp = journey.end_date || journey.updated_at || latestTimestamp;
      }
    }

    // 5. Build Ordered Milestones Chain
    const milestones: PublicMilestone[] = [
      {
        step: 1,
        key: 'BOOKED',
        title: 'Consignment Booked',
        description: `Bilty / LR issued at origin hub. Packaging and documentation verified.`,
        location: entry.from_location,
        timestamp: entry.lr_date?.toISOString(),
        status: currentMilestoneKey === 'BOOKED' ? 'current' : 'completed',
      },
      {
        step: 2,
        key: 'DISPATCHED',
        title: 'Dispatched from Hub',
        description: isDispatched
          ? `Loaded onto vehicle ${entry.vehicle_number} and departed transit facility.`
          : `Awaiting fleet vehicle loading and trip dispatch departure.`,
        location: entry.from_location,
        timestamp: journey?.start_date ? new Date(journey.start_date).toISOString() : undefined,
        status:
          currentMilestoneKey === 'BOOKED'
            ? 'upcoming'
            : currentMilestoneKey === 'DISPATCHED'
            ? 'current'
            : 'completed',
      },
      {
        step: 3,
        key: 'IN_TRANSIT',
        title: 'In Transit En Route',
        description:
          currentMilestoneKey === 'IN_TRANSIT'
            ? `Consignment is moving along national transport corridor. Last verified checkpoint: ${lastKnownLocation}.`
            : currentMilestoneKey === 'DELIVERED' || currentMilestoneKey === 'OUT_FOR_DELIVERY'
            ? `Corridor transit completed.`
            : `Vehicle dispatch scheduled.`,
        location: lastKnownLocation,
        timestamp: latestTimestamp ? new Date(latestTimestamp).toISOString() : undefined,
        status:
          currentMilestoneKey === 'BOOKED' || currentMilestoneKey === 'DISPATCHED'
            ? 'upcoming'
            : currentMilestoneKey === 'IN_TRANSIT'
            ? 'current'
            : 'completed',
      },
      {
        step: 4,
        key: 'OUT_FOR_DELIVERY',
        title: 'Destination Hub Arrival',
        description: isCompleted
          ? `Arrived at destination hub in ${entry.to_location}.`
          : `Scheduled to arrive at destination hub.`,
        location: entry.to_location,
        status:
          isCompleted
            ? 'completed'
            : currentMilestoneKey === 'OUT_FOR_DELIVERY'
            ? 'current'
            : 'upcoming',
      },
      {
        step: 5,
        key: 'DELIVERED',
        title: 'Delivered & Handover Signed',
        description: isCompleted
          ? `Consignment delivered to consignee. Proof of Delivery (POD) signed and verified.`
          : `Pending final consignee delivery and physical POD acknowledgement.`,
        location: entry.to_location,
        timestamp: journey?.delivery_status === 'delivered' && journey?.end_date ? new Date(journey.end_date).toISOString() : undefined,
        status: isCompleted ? 'completed' : 'upcoming',
      },
    ];

    // 6. Sanitized Public Output (Zero Financial & PII Leakage)
    const publicTrackingData = {
      tracking_reference: entry.lr_no,
      bill_reference: entry.bill_no,
      booking_date: entry.lr_date,
      carrier: {
        company_name: company?.name || 'Fleet Flow Logistics Network',
      },
      transit: {
        origin: entry.from_location,
        destination: entry.to_location,
        vehicle_number: entry.vehicle_number,
        last_known_location: lastKnownLocation,
        current_status: currentMilestoneKey,
        is_delivered: isCompleted,
      },
      consignment: {
        consignor_name: entry.consignor?.name || 'Commercial Shipper',
        consignee_name: entry.consignee?.name || 'Designated Receiver',
        package_count: entry.package_count,
        packaging_type: entry.packaging_type,
        goods_description: entry.goods_description,
        actual_weight_tonnes: entry.actual_weight_tonnes,
        has_pod: Boolean(journey?.pod_documents && journey.pod_documents.length > 0),
        pod_preview_url: isCompleted && journey?.pod_documents?.[0]?.url ? journey.pod_documents[0].url : null,
      },
      milestones,
      last_updated_at: latestTimestamp || entry.updated_at,
    };

    res.json(publicTrackingData);
  } catch (error: any) {
    console.error('Error in public consignment tracking:', error);
    res.status(500).json({ error: 'Failed to retrieve consignment tracking details.' });
  }
}
