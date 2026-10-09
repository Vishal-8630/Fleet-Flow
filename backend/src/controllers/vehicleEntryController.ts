/**
 * ============================================================================
 * FLEET FLOW — MARKET VEHICLE ENTRY CONTROLLER (vehicleEntryController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Manages movements performed by third-party hired/brokerage vehicles ("Market Trucks"):
 * 1. Entry Creation & Sequential Numbering (`MKT-0001`).
 * 2. Financial Ledger Settlement Equation:
 *    Net Due = Freight - Cash Advance - Diesel Advance - Dala - Commission + Halting
 * 3. Payment Status State Transitions (`pending` -> `partially_paid` -> `paid`).
 * 4. Proof of Delivery (POD) Receipt Tracking:
 *    - Records signed paper slips or digital URLs before releasing final freight balance.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { BalanceParty } from '../models/BalanceParty.js';

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/vehicle-entries
 * List market vehicle movements with filters, search, and pagination
 * ----------------------------------------------------------------------------
 */
export const getVehicleEntries = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;

    const { status, balance_party_id, pod_received, search, from_date, to_date } = req.query;

    const filter: any = { is_deleted: { $ne: true } };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (balance_party_id) {
      filter.balance_party_id = balance_party_id;
    }

    if (pod_received !== undefined && pod_received !== 'all') {
      filter.pod_received = pod_received === 'true';
    }

    if (from_date || to_date) {
      filter.entry_date = {};
      if (from_date) filter.entry_date.$gte = new Date(from_date as string);
      if (to_date) filter.entry_date.$lte = new Date(to_date as string);
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$or = [
        { entry_number: searchRegex },
        { vehicle_number: searchRegex },
        { driver_name: searchRegex },
        { from_location: searchRegex },
        { to_location: searchRegex },
        { material_description: searchRegex },
      ];
    }

    const [entries, total] = await Promise.all([
      VehicleEntry.find(filter)
        .populate('balance_party_id', 'party_name party_type phone pan_number')
        .populate('billing_party_id', 'name trade_name gstin')
        .sort({ entry_date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VehicleEntry.countDocuments(filter),
    ]);

    return res.json({
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('getVehicleEntries error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch vehicle entries.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/vehicle-entries/metrics
 * Summary KPI numbers for third-party brokerage movements
 * ----------------------------------------------------------------------------
 */
export const getVehicleEntryMetrics = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;

    const [totalEntries, pendingPodCount, financialAgg] = await Promise.all([
      VehicleEntry.countDocuments({ company_id: companyId, is_deleted: false }),
      VehicleEntry.countDocuments({
        company_id: companyId,
        pod_received: false,
        is_deleted: false,
      }),
      VehicleEntry.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
        {
          $group: {
            _id: null,
            totalFreight: { $sum: '$freight_amount' },
            totalAdvances: {
              $sum: { $add: ['$driver_cash_advance', '$diesel_advance_amount'] },
            },
            totalNetDue: { $sum: '$net_balance_due' },
            totalPaid: { $sum: '$paid_amount' },
          },
        },
      ]),
    ]);

    const stats = financialAgg[0] || {
      totalFreight: 0,
      totalAdvances: 0,
      totalNetDue: 0,
      totalPaid: 0,
    };

    return res.json({
      totalEntries,
      pendingPodCount,
      totalFreightBooked: stats.totalFreight,
      totalAdvancesGiven: stats.totalAdvances,
      totalBalanceDue: stats.totalNetDue,
      totalPaidToVendors: stats.totalPaid,
    });
  } catch (error: any) {
    console.error('getVehicleEntryMetrics error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch metrics.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * GET /api/operations/vehicle-entries/:id
 * Retrieve single vehicle movement entry
 * ----------------------------------------------------------------------------
 */
export const getVehicleEntryById = async (req: Request, res: Response) => {
  try {
    const entry = await VehicleEntry.findById(req.params.id)
      .populate('balance_party_id')
      .populate('billing_party_id');

    if (!entry || entry.is_deleted) {
      return res.status(404).json({ error: 'Market vehicle entry not found.' });
    }

    return res.json({ entry });
  } catch (error: any) {
    console.error('getVehicleEntryById error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch entry.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * POST /api/operations/vehicle-entries
 * Record a new hired market vehicle movement
 * ----------------------------------------------------------------------------
 */
export const createVehicleEntry = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      entry_date,
      vehicle_number,
      driver_name,
      driver_phone,
      from_location,
      to_location,
      balance_party_id,
      billing_party_id,
      material_description,
      weight_tonnes,
      freight_amount,
      driver_cash_advance,
      diesel_advance_amount,
      dala_charges,
      kamisan_amount,
      halting_amount,
      notes,
    } = req.body;

    if (!vehicle_number || !from_location || !to_location || !balance_party_id) {
      return res.status(400).json({
        error: 'Vehicle Number, Origin, Destination, and Vendor (Balance Party) are required.',
      });
    }

    // Verify Balance Party exists
    const balanceParty = await BalanceParty.findById(balance_party_id);
    if (!balanceParty || balanceParty.is_deleted) {
      return res.status(404).json({ error: 'Selected Vendor / Balance Party not found.' });
    }

    // Generate sequential entry number
    const count = await VehicleEntry.countDocuments({ company_id: companyId });
    const entry_number = `MKT-${String(count + 1).padStart(4, '0')}`;

    const entry = new VehicleEntry({
      company_id: companyId,
      entry_number,
      entry_date: entry_date ? new Date(entry_date) : new Date(),
      vehicle_number: vehicle_number.toUpperCase().trim(),
      driver_name,
      driver_phone,
      from_location,
      to_location,
      balance_party_id,
      billing_party_id: billing_party_id || undefined,
      material_description,
      weight_tonnes: weight_tonnes || 0,
      freight_amount: freight_amount || 0,
      driver_cash_advance: driver_cash_advance || 0,
      diesel_advance_amount: diesel_advance_amount || 0,
      dala_charges: dala_charges || 0,
      kamisan_amount: kamisan_amount || 0,
      halting_amount: halting_amount || 0,
      notes,
    });

    await entry.save();

    return res.status(201).json({
      message: 'Market vehicle entry created successfully.',
      entry,
    });
  } catch (error: any) {
    console.error('createVehicleEntry error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create entry.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/vehicle-entries/:id
 * Update market vehicle financial figures or route details
 * ----------------------------------------------------------------------------
 */
export const updateVehicleEntry = async (req: Request, res: Response) => {
  try {
    const entry = await VehicleEntry.findById(req.params.id);
    if (!entry || entry.is_deleted) {
      return res.status(404).json({ error: 'Market vehicle entry not found.' });
    }

    const fields = [
      'entry_date',
      'vehicle_number',
      'driver_name',
      'driver_phone',
      'from_location',
      'to_location',
      'balance_party_id',
      'billing_party_id',
      'material_description',
      'weight_tonnes',
      'freight_amount',
      'driver_cash_advance',
      'diesel_advance_amount',
      'dala_charges',
      'kamisan_amount',
      'halting_amount',
      'paid_amount',
      'notes',
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        (entry as any)[f] = req.body[f];
      }
    }

    await entry.save();

    return res.json({
      message: 'Market vehicle entry updated.',
      entry,
    });
  } catch (error: any) {
    console.error('updateVehicleEntry error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update entry.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * PUT /api/operations/vehicle-entries/:id/pod
 * Record Proof of Delivery acknowledgment for third-party vehicle
 * ----------------------------------------------------------------------------
 */
export const updateVehicleEntryPOD = async (req: Request, res: Response) => {
  try {
    const { pod_received, pod_stock_date, pod_document_url } = req.body;

    const entry = await VehicleEntry.findById(req.params.id);
    if (!entry || entry.is_deleted) {
      return res.status(404).json({ error: 'Market vehicle entry not found.' });
    }

    entry.pod_received = pod_received !== undefined ? pod_received : true;
    if (pod_stock_date) {
      entry.pod_stock_date = new Date(pod_stock_date);
    } else if (entry.pod_received && !entry.pod_stock_date) {
      entry.pod_stock_date = new Date();
    }
    if (pod_document_url) {
      entry.pod_document_url = pod_document_url;
    }

    await entry.save();

    return res.json({
      message: 'Proof of Delivery (POD) updated.',
      entry,
    });
  } catch (error: any) {
    console.error('updateVehicleEntryPOD error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update POD.' });
  }
};

/**
 * ----------------------------------------------------------------------------
 * DELETE /api/operations/vehicle-entries/:id
 * Soft delete vehicle entry
 * ----------------------------------------------------------------------------
 */
export const deleteVehicleEntry = async (req: Request, res: Response) => {
  try {
    const entry = await VehicleEntry.findById(req.params.id);
    if (!entry || entry.is_deleted) {
      return res.status(404).json({ error: 'Market vehicle entry not found.' });
    }

    entry.is_deleted = true;
    await entry.save();

    return res.json({ message: 'Market vehicle movement deleted successfully.' });
  } catch (error: any) {
    console.error('deleteVehicleEntry error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete entry.' });
  }
};
