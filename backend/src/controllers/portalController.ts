/**
 * ============================================================================
 * PORTAL CONTROLLER (portalController.ts)
 * ============================================================================
 * Handles OTP authentication and data access for external stakeholder portals:
 * - Customer portal: consignment tracking, invoices, SOA
 * - Driver portal: trip assignment, expense uploads, e-POD
 * - Vendor portal: load tracking, bill submission
 * 
 * Routes (mounted at /api/portal):
 *   POST /send-otp          - Send OTP to customer/driver/vendor phone
 *   POST /verify-otp        - Verify OTP and return portal JWT
 *   GET  /customer/dashboard - Customer consignments (requires portal JWT)
 *   GET  /driver/trip       - Driver current trip (requires portal JWT)
 *   POST /driver/epod       - Submit digital proof of delivery
 *   GET  /vendor/dashboard  - Vendor loads and payables
 * ============================================================================
 */

import { Request, Response } from 'express';
import { PortalSession } from '../models/PortalSession.js';
import { Entry } from '../models/Entry.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Driver } from '../models/Driver.js';
import { BillingParty } from '../models/BillingParty.js';
import { generateOtp, maskAadhaar } from '../utils/cryptoService.js';
import { generatePortalToken } from '../middleware/externalPortalAuth.js';
import bcrypt from 'bcryptjs';

/**
 * POST /api/portal/send-otp
 * Sends (or simulates sending) a 6-digit OTP to the requester's phone.
 */
export async function sendPortalOtp(req: Request, res: Response): Promise<void> {
  try {
    const { portal_type, phone, company_id } = req.body;

    if (!portal_type || !phone || !company_id) {
      res.status(400).json({ error: 'portal_type, phone, and company_id are required.' });
      return;
    }

    let entityId: string | null = null;

    // Look up the entity by phone
    if (portal_type === 'customer') {
      const party = await BillingParty.findOne({ company_id, contact_phone: phone });
      if (!party) {
        res.status(404).json({ error: 'No customer account found for this phone number.' });
        return;
      }
      entityId = String(party._id);
    } else if (portal_type === 'driver') {
      const driver = await Driver.findOne({ company_id, phone });
      if (!driver) {
        res.status(404).json({ error: 'No driver account found for this phone number.' });
        return;
      }
      entityId = String(driver._id);
    } else {
      res.status(400).json({ error: 'Unsupported portal_type. Use: customer, driver, or vendor.' });
      return;
    }

    const otp = generateOtp();
    const otp_hash = await bcrypt.hash(otp, 10);
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const expires_at = new Date(Date.now() + 24 * 3600 * 1000);

    // Upsert session record
    await PortalSession.findOneAndUpdate(
      { entity_id: entityId, portal_type, company_id },
      {
        $set: {
          otp_hash,
          otp_expires_at,
          otp_attempts: 0,
          is_verified: false,
          expires_at,
          phone,
        },
      },
      { upsert: true, new: true }
    );

    // In production, send OTP via SMS/WhatsApp. For development, return in response.
    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`[PORTAL OTP] ${phone} -> ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to ${phone.slice(0, 4)}****${phone.slice(-2)}`,
      ...(isDev ? { dev_otp: otp } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/portal/verify-otp
 * Verifies the OTP and returns a scoped portal JWT.
 */
export async function verifyPortalOtp(req: Request, res: Response): Promise<void> {
  try {
    const { portal_type, phone, company_id, otp } = req.body;

    if (!portal_type || !phone || !company_id || !otp) {
      res.status(400).json({ error: 'portal_type, phone, company_id, and otp are required.' });
      return;
    }

    let entityId: string | null = null;
    if (portal_type === 'customer') {
      const party = await BillingParty.findOne({ company_id, contact_phone: phone });
      entityId = party ? String(party._id) : null;
    } else if (portal_type === 'driver') {
      const driver = await Driver.findOne({ company_id, phone });
      entityId = driver ? String(driver._id) : null;
    }

    if (!entityId) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const session = await PortalSession.findOne({ entity_id: entityId, portal_type, company_id });
    if (!session || !session.otp_hash || !session.otp_expires_at) {
      res.status(400).json({ error: 'No OTP request found. Please request a new OTP.' });
      return;
    }

    if (new Date() > session.otp_expires_at) {
      res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      return;
    }

    if (session.otp_attempts >= 5) {
      res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
      return;
    }

    const isValid = await bcrypt.compare(String(otp), session.otp_hash);
    if (!isValid) {
      session.otp_attempts += 1;
      await session.save();
      res.status(401).json({ error: 'Invalid OTP. Please try again.' });
      return;
    }

    // Generate scoped portal JWT
    const token = generatePortalToken({
      portalType: portal_type,
      entityId,
      companyId: company_id,
    });

    session.is_verified = true;
    session.jwt_token = token;
    await session.save();

    res.json({ success: true, token, portal_type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/portal/customer/dashboard
 * Returns customer's consignments and invoice summary (sanitized - no margins/costs).
 */
export async function getCustomerDashboard(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    const { entityId, companyId } = portalUser;

    const entries = await Entry.find({
      company_id: companyId,
      billing_party_id: entityId,
    })
      .sort({ created_at: -1 })
      .limit(50)
      .select('lr_number from_city to_city status created_at material_description packages actual_weight')
      .lean();

    const party = await BillingParty.findById(entityId).select('party_name contact_email contact_phone').lean();

    res.json({
      party,
      consignments: entries,
      total: entries.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/portal/driver/trip
 * Returns the driver's current active trip assignment.
 */
export async function getDriverCurrentTrip(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    const { entityId, companyId } = portalUser;

    const journey = await TruckJourney.findOne({
      company_id: companyId,
      driver_id: entityId,
      status: { $in: ['planned', 'loading', 'in_transit'] },
    })
      .populate('truck_id', 'registration_number truck_type')
      .sort({ dispatch_date: -1 })
      .lean();

    const driver = await Driver.findById(entityId).select('name phone license_number').lean();

    res.json({
      driver,
      current_trip: journey || null,
      has_active_trip: !!journey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/portal/driver/epod
 * Submit digital e-POD: consignee signature + delivery photo.
 */
export async function submitEpod(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    const { companyId } = portalUser;
    const { journey_id, lr_number, receiver_name, signature_data_url, photo_url, delivery_lat, delivery_lng } = req.body;

    if (!journey_id || !receiver_name) {
      res.status(400).json({ error: 'journey_id and receiver_name are required.' });
      return;
    }

    // Update journey status to delivered
    const journey = await TruckJourney.findOneAndUpdate(
      { _id: journey_id, company_id: companyId },
      {
        $set: {
          status: 'delivered',
          epod_submitted: true,
          epod_receiver_name: receiver_name,
          epod_signature_url: signature_data_url,
          epod_photo_url: photo_url,
          epod_lat: delivery_lat,
          epod_lng: delivery_lng,
          delivered_at: new Date(),
        },
      },
      { new: true }
    );

    if (!journey) {
      res.status(404).json({ error: 'Journey not found.' });
      return;
    }

    // Update associated LR status
    if (lr_number) {
      await Entry.updateOne(
        { lr_number, company_id: companyId },
        { $set: { status: 'delivered', delivered_at: new Date() } }
      );
    }

    res.json({ success: true, message: 'Digital POD submitted successfully. Delivery marked as complete.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
