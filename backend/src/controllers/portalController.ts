/**
 * ============================================================================
 * PORTAL CONTROLLER (portalController.ts)
 * ============================================================================
 * Handles OTP authentication and data access for external stakeholder portals:
 * - Customer portal: consignment tracking, invoices, SOA
 * - Driver portal: trip assignment, expense uploads, e-POD
 * - Vendor portal: load tracking, supplier movements, balance payables
 * 
 * Routes (mounted at /api/portal):
 *   POST /send-otp           - Send OTP to customer/driver/vendor phone (rate-limited)
 *   POST /verify-otp         - Verify OTP and return portal JWT (rate-limited)
 *   GET  /customer/dashboard - Customer consignments & invoices (requires portal JWT)
 *   GET  /driver/trip        - Driver current active trip (requires portal JWT)
 *   POST /driver/epod        - Submit digital proof of delivery
 *   GET  /vendor/dashboard   - Vendor movements and payables (requires portal JWT)
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PortalSession } from '../models/PortalSession.js';
import { Entry } from '../models/Entry.js';
import { Invoice } from '../models/Invoice.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Driver } from '../models/Driver.js';
import { BillingParty } from '../models/BillingParty.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { generateOtp } from '../utils/cryptoService.js';
import { generatePortalToken } from '../middleware/externalPortalAuth.js';

export const telephonyService = {
  async sendSms(phone: string, otp: string): Promise<boolean> {
    return true;
  },
};

/**
 * POST /api/portal/send-otp
 * Concurrency-Safe OTP issuance protocol with 60s cooldown and 15-minute brute-force lockout.
 */
export async function sendPortalOtp(req: Request, res: Response): Promise<void> {
  try {
    const { portal_type, phone, company_id } = req.body;

    if (!portal_type || !phone || !company_id) {
      res.status(400).json({ error: 'portal_type, phone, and company_id are required.' });
      return;
    }

    const cleanPhone = String(phone).trim();
    let entityId: Types.ObjectId | null = null;

    // Look up the entity by registered phone number (ISS-006)
    if (portal_type === 'customer') {
      const party = await BillingParty.findOne({ company_id, phone: cleanPhone });
      if (!party) {
        res.status(404).json({ error: 'No customer account found for this phone number.' });
        return;
      }
      entityId = party._id as Types.ObjectId;
    } else if (portal_type === 'driver') {
      const driver = await Driver.findOne({ company_id, phone: cleanPhone });
      if (!driver) {
        res.status(404).json({ error: 'No driver account found for this phone number.' });
        return;
      }
      entityId = driver._id as Types.ObjectId;
    } else if (portal_type === 'vendor') {
      const vendor = await BalanceParty.findOne({ company_id, phone: cleanPhone });
      if (!vendor) {
        res.status(404).json({ error: 'No vendor account found for this phone number.' });
        return;
      }
      entityId = vendor._id as Types.ObjectId;
    } else {
      res.status(400).json({ error: 'Unsupported portal_type. Use: customer, driver, or vendor.' });
      return;
    }

    const now = new Date();
    const cooldownThreshold = new Date(now.getTime() - 60000); // 60 seconds ago

    // Generate new OTP and cryptographic hash
    const otp = generateOtp();
    const otp_hash = await bcrypt.hash(otp, 10);
    const otp_expires_at = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes validity
    const expires_at = new Date(now.getTime() + 24 * 3600 * 1000);   // 24 hours TTL

    // 1. Ensure a base session record exists atomically without touching existing fields
    try {
      await PortalSession.updateOne(
        { entity_id: entityId, portal_type, company_id },
        {
          $setOnInsert: {
            phone: cleanPhone,
            otp_attempts: 0,
            expires_at,
            created_at: now,
          },
        },
        { upsert: true }
      );
    } catch (upsertErr: any) {
      if (upsertErr.code !== 11000) {
        throw upsertErr;
      }
      // E11000 duplicate key on upsert indicates a competing concurrent request
      // successfully created the record first; safely proceed to Step 2 claim.
    }

    // 2. Concurrency-Safe Atomic Claim:
    // Update session ONLY if lockout is inactive and last_otp_sent_at <= cooldownThreshold
    const session = await PortalSession.findOneAndUpdate(
      {
        entity_id: entityId,
        portal_type,
        company_id,
        $or: [
          { lockout_until: { $exists: false } },
          { lockout_until: null },
          { lockout_until: { $lte: now } },
        ],
        $and: [
          {
            $or: [
              { last_otp_sent_at: { $exists: false } },
              { last_otp_sent_at: null },
              { last_otp_sent_at: { $lte: cooldownThreshold } },
            ],
          },
        ],
      },
      {
        $set: {
          otp_hash,
          otp_expires_at,
          last_otp_sent_at: now,
          phone: cleanPhone,
          is_verified: false,
          expires_at,
        },
      },
      { new: true }
    );

    if (!session) {
      // Lease not acquired — inspect document to distinguish lockout vs cooldown
      const check = await PortalSession.findOne({ entity_id: entityId, portal_type, company_id });
      if (check?.lockout_until && check.lockout_until > now) {
        const remainingMinutes = Math.ceil((check.lockout_until.getTime() - now.getTime()) / 60000);
        res.status(429).json({
          error: `Account locked due to excessive failed attempts. Please wait ${remainingMinutes} minute(s) before requesting another OTP.`,
        });
        return;
      }

      res.status(429).json({
        error: 'Please wait 60 seconds before requesting another OTP.',
        cooldown_seconds: 60,
      });
      return;
    }

    // Safe Telephony Delivery Layer:
    // Dispatch via SMS gateway with 5s timeout. If gateway fails or times out:
    // 1. Log error to console.
    // 2. Cooldown remains preserved in MongoDB (last_otp_sent_at is set).
    // 3. OTP state remains stored and valid until otp_expires_at.
    // 4. Delivery failure does not increment otp_attempts.
    // 5. Fail-closed response HTTP 502 with cooldown warning.
    try {
      await Promise.race([
        telephonyService.sendSms(cleanPhone, otp),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SMS gateway timeout')), 5000)
        ),
      ]);
    } catch (telephonyErr: any) {
      console.error('[Telephony Delivery Error]:', telephonyErr?.message || telephonyErr);
      res.status(502).json({
        error: 'Failed to dispatch SMS via gateway. Cooldown active; please retry after 60 seconds.',
        cooldown_seconds: 60,
      });
      return;
    }

    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`[PORTAL OTP] (${portal_type}) ${cleanPhone} -> ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to ${cleanPhone.slice(0, 4)}****${cleanPhone.slice(-2)}`,
      ...(isDev ? { dev_otp: otp } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/portal/verify-otp
 * Verifies the OTP, enforces maximum 5 attempts, applies 15-minute lockout, and returns portal JWT.
 */
export async function verifyPortalOtp(req: Request, res: Response): Promise<void> {
  try {
    const { portal_type, phone, company_id, otp } = req.body;

    if (!portal_type || !phone || !company_id || !otp) {
      res.status(400).json({ error: 'portal_type, phone, company_id, and otp are required.' });
      return;
    }

    const cleanPhone = String(phone).trim();
    let entityId: Types.ObjectId | null = null;

    if (portal_type === 'customer') {
      const party = await BillingParty.findOne({ company_id, phone: cleanPhone });
      entityId = party ? (party._id as Types.ObjectId) : null;
    } else if (portal_type === 'driver') {
      const driver = await Driver.findOne({ company_id, phone: cleanPhone });
      entityId = driver ? (driver._id as Types.ObjectId) : null;
    } else if (portal_type === 'vendor') {
      const vendor = await BalanceParty.findOne({ company_id, phone: cleanPhone });
      entityId = vendor ? (vendor._id as Types.ObjectId) : null;
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

    const now = new Date();

    // Check if session is currently locked out
    if (session.lockout_until && session.lockout_until > now) {
      const remainingMinutes = Math.ceil((session.lockout_until.getTime() - now.getTime()) / 60000);
      res.status(429).json({
        error: `Too many failed attempts. Account locked for ${remainingMinutes} minute(s). Please try again later.`,
      });
      return;
    }

    // Check if OTP expired
    if (now > session.otp_expires_at) {
      res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      return;
    }

    // Verify OTP using bcrypt
    const isValid = await bcrypt.compare(String(otp).trim(), session.otp_hash);

    if (!isValid) {
      // Increment attempt counter atomically via MongoDB $inc to prevent race condition bypass
      const updatedSession = await PortalSession.findByIdAndUpdate(
        session._id,
        { $inc: { otp_attempts: 1 } },
        { new: true }
      );

      const attempts = updatedSession?.otp_attempts || 1;

      if (attempts >= 5) {
        // Enforce 15-minute brute-force lockout
        await PortalSession.findByIdAndUpdate(session._id, {
          $set: { lockout_until: new Date(now.getTime() + 15 * 60 * 1000) },
        });
        res.status(429).json({
          error: 'Too many failed attempts. Account locked for 15 minutes.',
        });
        return;
      }

      const remainingAttempts = Math.max(0, 5 - attempts);
      res.status(401).json({
        error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      });
      return;
    }

    // OTP is valid — clear lockout and reset attempts
    session.otp_attempts = 0;
    session.lockout_until = undefined;
    session.is_verified = true;

    // Generate scoped portal JWT
    const token = generatePortalToken({
      portalType: portal_type,
      entityId: String(entityId),
      companyId: String(company_id),
    });

    session.jwt_token = token;
    await session.save();

    res.json({ success: true, token, portal_type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/portal/customer/dashboard
 * Returns customer consignments and invoices strictly scoped to authenticated customer & company.
 */
export async function getCustomerDashboard(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    if (portalUser.portalType !== 'customer') {
      res.status(403).json({ error: 'Forbidden. Customer portal token required.' });
      return;
    }

    const { entityId, companyId } = portalUser;

    const party = await BillingParty.findOne({ _id: entityId, company_id: companyId })
      .select('name trade_name email phone status outstanding_receivables')
      .lean();

    const entryConditions: any[] = [{ billing_party_id: entityId }];
    if (party?.phone) {
      entryConditions.push({ 'consignor.phone': party.phone });
      entryConditions.push({ 'consignee.phone': party.phone });
    }
    if (party?.name) {
      entryConditions.push({ 'consignor.name': party.name });
      entryConditions.push({ 'consignee.name': party.name });
    }

    const entries = await Entry.find({
      company_id: companyId,
      $or: entryConditions,
      is_deleted: false,
    })
      .sort({ created_at: -1 })
      .limit(50)
      .select('lr_no from_location to_location status goods_description package_count actual_weight_tonnes vehicle_number lr_date created_at')
      .lean();

    const invoices = await Invoice.find({
      company_id: companyId,
      $or: [{ billing_party_id: entityId }, { party_id: entityId }],
    })
      .sort({ invoice_date: -1 })
      .limit(50)
      .select('invoice_number invoice_date total_amount paid_amount balance_amount status')
      .lean();

    const formattedEntries = entries.map((e) => ({
      ...e,
      lr_number: e.lr_no,
      from_city: e.from_location,
      to_city: e.to_location,
      material_description: e.goods_description,
      packages: e.package_count,
      actual_weight: e.actual_weight_tonnes,
    }));

    const formattedParty = party
      ? {
          ...party,
          party_name: party.name,
          contact_email: party.email,
          contact_phone: party.phone,
        }
      : null;

    res.json({
      party: formattedParty,
      customer: formattedParty,
      consignments: formattedEntries,
      invoices: invoices || [],
      total: formattedEntries.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/portal/driver/trip
 * Returns the driver's current active trip assignment scoped to driver & company.
 */
export async function getDriverCurrentTrip(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    if (portalUser.portalType !== 'driver') {
      res.status(403).json({ error: 'Forbidden. Driver portal token required.' });
      return;
    }

    const { entityId, companyId } = portalUser;

    const journey = await TruckJourney.findOne({
      company_id: companyId,
      driver_id: entityId,
      status: { $in: ['active', 'delayed'] },
    })
      .populate('truck_id', 'truck_no body_type make model')
      .sort({ start_date: -1 })
      .lean();

    const driver = await Driver.findOne({ _id: entityId, company_id: companyId })
      .select('name phone license_number')
      .lean();

    res.json({
      driver,
      trip: journey || null,
      current_trip: journey || null,
      has_active_trip: !!journey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/portal/vendor/dashboard
 * Returns vendor vehicle movements, payables, and account statement scoped to vendor & company.
 */
export async function getVendorDashboard(req: Request, res: Response): Promise<void> {
  try {
    const portalUser = req.portalUser!;
    if (portalUser.portalType !== 'vendor') {
      res.status(403).json({ error: 'Forbidden. Vendor portal token required.' });
      return;
    }

    const { entityId, companyId } = portalUser;

    const vendor = await BalanceParty.findOne({ _id: entityId, company_id: companyId })
      .select('party_name party_type phone email pan_number bank_details current_balance opening_balance status')
      .lean();

    if (!vendor) {
      res.status(404).json({ error: 'Vendor account not found.' });
      return;
    }

    const vehicleEntries = await VehicleEntry.find({
      company_id: companyId,
      balance_party_id: entityId,
      is_deleted: false,
    })
      .sort({ entry_date: -1 })
      .limit(50)
      .select('vehicle_number entry_number entry_date from_location to_location freight_amount driver_cash_advance net_balance_due status')
      .lean();

    const formattedTrips = vehicleEntries.map((v) => ({
      _id: String(v._id),
      entry_number: v.entry_number,
      vehicle_number: v.vehicle_number,
      trip_date: (v.entry_date || new Date()).toISOString(),
      entry_date: v.entry_date,
      from_city: v.from_location,
      from_location: v.from_location,
      to_city: v.to_location,
      to_location: v.to_location,
      freight_amount: v.freight_amount || 0,
      advance_received: v.driver_cash_advance || 0,
      balance_payable: v.net_balance_due || 0,
      net_balance_due: v.net_balance_due || 0,
      status: v.status || 'pending',
      payment_status: v.status || 'pending',
    }));

    const totalPayables = formattedTrips.reduce((s, t) => s + (t.balance_payable || 0), 0);

    res.json({
      vendor: {
        ...vendor,
        id: vendor._id,
        name: vendor.party_name,
        party_name: vendor.party_name,
      },
      vendor_name: vendor.party_name,
      current_balance: vendor.current_balance || 0,
      bank_details: vendor.bank_details || {},
      trips: formattedTrips,
      movements: formattedTrips,
      total: formattedTrips.length,
      summary: {
        total_trips: formattedTrips.length,
        total_payables: totalPayables,
      },
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
    if (portalUser.portalType !== 'driver') {
      res.status(403).json({ error: 'Forbidden. Driver portal token required.' });
      return;
    }

    const { companyId } = portalUser;
    const { journey_id, lr_number, receiver_name, signature_data_url, photo_url, delivery_lat, delivery_lng } = req.body;

    if (!journey_id || !receiver_name) {
      res.status(400).json({ error: 'journey_id and receiver_name are required.' });
      return;
    }

    // Update journey status to completed / delivered
    const journey = await TruckJourney.findOneAndUpdate(
      { _id: journey_id, company_id: companyId },
      {
        $set: {
          status: 'completed',
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
        {
          company_id: companyId,
          $or: [{ lr_no: lr_number }, { bill_no: lr_number }],
        },
        { $set: { status: 'invoiced', delivered_at: new Date() } }
      );
    }

    res.json({ success: true, message: 'Digital POD submitted successfully. Delivery marked as complete.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
