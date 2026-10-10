/**
 * ============================================================================
 * FLEET FLOW — FLEET MAINTENANCE & WORK ORDER CONTROLLER (maintenanceController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Manages operational maintenance workflows, garage work orders, tyre asset
 * tracking, preventative service intervals, Cost per KM (CPK), and vehicle P&L.
 * ============================================================================
 */

import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { MaintenanceOrder, IMaintenanceOrder } from '../models/MaintenanceOrder.js';
import { TyreRecord, ITyreRecord, AxlePosition } from '../models/TyreRecord.js';
import { Truck } from '../models/Truck.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Ledger } from '../models/Ledger.js';
import { postDoubleEntryJournal } from '../utils/ledgerService.js';
import { roundMoney } from '../utils/settlementCalculator.js';

function getCompanyId(req: Request): any {
  return req.company?._id || (req as any).companyId;
}

/**
 * 1. GET /api/fleet/maintenance/work-orders
 * Lists paginated work orders with filters
 */
export async function getWorkOrders(req: Request, res: Response): Promise<void> {
  try {
    const companyId = req.company?._id || (req as any).companyId;
    const {
      page = '1',
      limit = '20',
      status,
      truck_id,
      order_type,
      priority,
      search,
    } = req.query as Record<string, string>;

    const query: any = { company_id: companyId };

    if (status && status !== 'all') {
      query.status = status;
    }
    if (truck_id) {
      query.truck_id = truck_id;
    }
    if (order_type && order_type !== 'all') {
      query.order_type = order_type;
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { work_order_no: searchRegex },
        { vendor_name: searchRegex },
        { vendor_invoice_no: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      MaintenanceOrder.find(query)
        .populate('truck_id', 'truck_no make model status current_odometer_kms')
        .sort({ start_date: -1, created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      MaintenanceOrder.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 2. GET /api/fleet/maintenance/work-orders/:id
 * Fetches single work order
 */
export async function getWorkOrderById(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const order = await MaintenanceOrder.findOne({ _id: id, company_id: companyId })
      .populate('truck_id', 'truck_no make model status current_odometer_kms last_service_kms next_service_due_kms service_interval_kms')
      .populate('ledger_entry_id')
      .lean();

    if (!order) {
      res.status(404).json({ error: 'Work order not found.' });
      return;
    }

    res.json({ success: true, workOrder: order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 3. POST /api/fleet/maintenance/work-orders
 * Creates new service work order & flags truck as in_maintenance
 */
export async function createWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?._id;
    const {
      truck_id,
      vendor_name,
      vendor_invoice_no,
      order_type = 'preventative_service',
      priority = 'medium',
      status = 'in_progress',
      odometer_kms_at_service,
      start_date = new Date(),
      line_items = [],
      notes,
    } = req.body;

    if (!truck_id || !vendor_name) {
      res.status(400).json({ error: 'Truck and Vendor Name are required.' });
      return;
    }

    // Verify truck ownership
    const truck = await Truck.findOne({ _id: truck_id, company_id: companyId });
    if (!truck) {
      res.status(404).json({ error: 'Specified truck not found in your company registry.' });
      return;
    }

    const currentOdo = odometer_kms_at_service !== undefined ? Number(odometer_kms_at_service) : truck.current_odometer_kms;

    // Calculate line items totals
    let totalPart = 0;
    let totalLabor = 0;
    let totalTax = 0;

    const sanitizedLines = (line_items || []).map((item: any) => {
      const partCost = roundMoney(Number(item.part_cost) || 0);
      const laborCost = roundMoney(Number(item.labor_cost) || 0);
      const taxAmount = roundMoney(Number(item.tax_amount) || 0);
      const total = roundMoney(item.total !== undefined ? Number(item.total) : (partCost + laborCost + taxAmount));

      totalPart = roundMoney(totalPart + partCost);
      totalLabor = roundMoney(totalLabor + laborCost);
      totalTax = roundMoney(totalTax + taxAmount);

      return {
        description: item.description || 'Service Line',
        part_cost: partCost,
        labor_cost: laborCost,
        tax_amount: taxAmount,
        total,
      };
    });

    const totalAmount = roundMoney(totalPart + totalLabor + totalTax);

    // Auto-sequence Work Order Number
    const count = await MaintenanceOrder.countDocuments({ company_id: companyId });
    const workOrderNo = `WO-${Date.now().toString().slice(-4)}-${String(count + 1).padStart(4, '0')}`;

    const workOrder = await MaintenanceOrder.create({
      company_id: companyId,
      work_order_no: workOrderNo,
      truck_id,
      vendor_name,
      vendor_invoice_no,
      order_type,
      priority,
      status,
      odometer_kms_at_service: currentOdo,
      start_date,
      line_items: sanitizedLines,
      total_part_cost: totalPart,
      total_labor_cost: totalLabor,
      total_tax: totalTax,
      total_amount: totalAmount,
      notes,
      created_by: userId,
    });

    // If active / in_progress, update truck operational status
    if (status === 'in_progress') {
      await Truck.findByIdAndUpdate(truck_id, { status: 'in_maintenance' });
    }

    res.status(201).json({
      success: true,
      message: `Work Order ${workOrderNo} created successfully.`,
      workOrder,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 4. PUT /api/fleet/maintenance/work-orders/:id
 * Updates work order details and lines
 */
export async function updateWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const {
      vendor_name,
      vendor_invoice_no,
      order_type,
      priority,
      odometer_kms_at_service,
      line_items,
      notes,
    } = req.body;

    const order = await MaintenanceOrder.findOne({ _id: id, company_id: companyId });
    if (!order) {
      res.status(404).json({ error: 'Work order not found.' });
      return;
    }

    if (order.status === 'completed') {
      res.status(400).json({ error: 'Completed work orders cannot be modified.' });
      return;
    }

    if (vendor_name) order.vendor_name = vendor_name;
    if (vendor_invoice_no !== undefined) order.vendor_invoice_no = vendor_invoice_no;
    if (order_type) order.order_type = order_type;
    if (priority) order.priority = priority;
    if (odometer_kms_at_service !== undefined) order.odometer_kms_at_service = Number(odometer_kms_at_service);
    if (notes !== undefined) order.notes = notes;

    if (line_items) {
      let totalPart = 0;
      let totalLabor = 0;
      let totalTax = 0;

      order.line_items = line_items.map((item: any) => {
        const partCost = roundMoney(Number(item.part_cost) || 0);
        const laborCost = roundMoney(Number(item.labor_cost) || 0);
        const taxAmount = roundMoney(Number(item.tax_amount) || 0);
        const total = roundMoney(item.total !== undefined ? Number(item.total) : (partCost + laborCost + taxAmount));

        totalPart = roundMoney(totalPart + partCost);
        totalLabor = roundMoney(totalLabor + laborCost);
        totalTax = roundMoney(totalTax + taxAmount);

        return {
          description: item.description || 'Service Line',
          part_cost: partCost,
          labor_cost: laborCost,
          tax_amount: taxAmount,
          total,
        };
      });

      order.total_part_cost = totalPart;
      order.total_labor_cost = totalLabor;
      order.total_tax = totalTax;
      order.total_amount = roundMoney(totalPart + totalLabor + totalTax);
    }

    await order.save();
    res.json({ success: true, message: 'Work order updated.', workOrder: order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 5. POST /api/fleet/maintenance/work-orders/:id/complete
 * Completes work order, resets truck status, updates odometer, and posts to Ledger
 */
export async function completeWorkOrder(req: Request, res: Response): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?._id;
    const { id } = req.params;
    const {
      vendor_invoice_no,
      completed_date = new Date(),
      next_service_due_kms,
      post_to_ledger = true,
    } = req.body;

    const order = await MaintenanceOrder.findOne({ _id: id, company_id: companyId }).session(session);
    if (!order) {
      await session.abortTransaction();
      res.status(404).json({ error: 'Work order not found.' });
      return;
    }

    if (order.status === 'completed') {
      await session.abortTransaction();
      res.status(400).json({ error: 'Work order is already completed.' });
      return;
    }

    const truck = await Truck.findOne({ _id: order.truck_id, company_id: companyId }).session(session);
    if (!truck) {
      await session.abortTransaction();
      res.status(404).json({ error: 'Associated truck not found.' });
      return;
    }

    // 1. Calculate Downtime Hours
    const finishDate = new Date(completed_date);
    const startDate = new Date(order.start_date);
    const downtimeHours = Math.max(0, Math.round(((finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)) * 10) / 10);

    // 2. Recalibrate Truck Odometer & Service Due
    const serviceOdo = order.odometer_kms_at_service || truck.current_odometer_kms;
    const newNextServiceDue = next_service_due_kms !== undefined
      ? Number(next_service_due_kms)
      : serviceOdo + (truck.service_interval_kms || 10000);

    truck.status = 'available';
    truck.last_service_kms = serviceOdo;
    truck.next_service_due_kms = newNextServiceDue;
    await truck.save({ session });

    // 3. Mark Order Completed
    order.status = 'completed';
    order.completed_date = finishDate;
    order.downtime_hours = downtimeHours;
    if (vendor_invoice_no) order.vendor_invoice_no = vendor_invoice_no;
    order.next_service_due_kms = newNextServiceDue;

    // 4. Double-Entry General Ledger Posting
    if (post_to_ledger && order.total_amount > 0) {
      const journalVouchers = await postDoubleEntryJournal({
        company_id: companyId!,
        session,
        transaction_type: 'expense',
        description: `Maintenance Work Order ${order.work_order_no} for ${truck.truck_no} (${order.order_type.replace('_', ' ')})`,
        reference_number: order.work_order_no,
        party_name: order.vendor_name,
        created_by: userId,
        truck_id: truck._id,
        legs: [
          {
            category: 'vehicle_maintenance',
            balance_type: 'debit',
            amount: order.total_amount,
            truck_id: truck._id,
            description: `Mechanical repair / parts & labor for ${truck.truck_no}`,
          },
          {
            category: 'bank_transfer',
            balance_type: 'credit',
            amount: order.total_amount,
            party_name: order.vendor_name,
            description: `Payment to ${order.vendor_name} for WO ${order.work_order_no}`,
          },
        ],
      });

      if (journalVouchers?.entries?.length > 0) {
        order.ledger_entry_id = journalVouchers.entries[0]._id;
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    res.json({
      success: true,
      message: `Work Order ${order.work_order_no} completed. Truck ${truck.truck_no} is now Available.`,
      workOrder: order,
    });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
}

/**
 * 6. POST /api/fleet/maintenance/work-orders/:id/cancel
 * Cancels work order and reverts truck status
 */
export async function cancelWorkOrder(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const order = await MaintenanceOrder.findOne({ _id: id, company_id: companyId });
    if (!order) {
      res.status(404).json({ error: 'Work order not found.' });
      return;
    }

    if (order.status === 'completed') {
      res.status(400).json({ error: 'Completed work orders cannot be cancelled.' });
      return;
    }

    order.status = 'cancelled';
    await order.save();

    // Revert truck status if in maintenance
    await Truck.findOneAndUpdate(
      { _id: order.truck_id, company_id: companyId, status: 'in_maintenance' },
      { status: 'available' }
    );

    res.json({ success: true, message: `Work order ${order.work_order_no} cancelled.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 7. GET /api/fleet/maintenance/tyres
 * Lists tyre records with filters
 */
export async function getTyres(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { status, truck_id, brand, search } = req.query as Record<string, string>;

    const query: any = { company_id: companyId };
    if (status && status !== 'all') query.status = status;
    if (truck_id) query.current_truck_id = truck_id;
    if (brand && brand !== 'all') query.brand = brand;
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ serial_number: searchRegex }, { model_name: searchRegex }];
    }

    const tyres = await TyreRecord.find(query)
      .populate('current_truck_id', 'truck_no make model')
      .sort({ created_at: -1 })
      .lean();

    res.json({ success: true, tyres });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 8. POST /api/fleet/maintenance/tyres
 * Registers new tyre
 */
export async function createTyre(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const {
      serial_number,
      brand,
      model_name,
      size = '295/90 R20',
      initial_tread_depth_mm = 15.0,
      purchase_cost = 0,
      purchase_date = new Date(),
      status = 'in_store',
      notes,
    } = req.body;

    if (!serial_number || !brand) {
      res.status(400).json({ error: 'Serial number and Brand are required.' });
      return;
    }

    // Check unique serial within company
    const existing = await TyreRecord.findOne({
      company_id: companyId,
      serial_number: serial_number.trim().toUpperCase(),
    });

    if (existing) {
      res.status(409).json({ error: `Tyre with serial ${serial_number} already exists in your inventory.` });
      return;
    }

    const initialTread = Number(initial_tread_depth_mm) || 15.0;

    const tyre = await TyreRecord.create({
      company_id: companyId,
      serial_number: serial_number.trim().toUpperCase(),
      brand,
      model_name,
      size,
      status,
      initial_tread_depth_mm: initialTread,
      current_tread_depth_mm: initialTread,
      purchase_cost: Number(purchase_cost) || 0,
      purchase_date,
      wear_history: [
        {
          date: new Date(),
          odometer_kms: 0,
          tread_depth_mm: initialTread,
          inspected_by: 'Inventory Receipt',
          notes: 'New tyre received in warehouse',
        },
      ],
      notes,
    });

    res.status(201).json({ success: true, message: 'Tyre registered.', tyre });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 9. POST /api/fleet/maintenance/tyres/mount
 * Mounts tyre to a specific truck axle position
 */
export async function mountTyre(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const {
      tyre_id,
      truck_id,
      axle_position,
      odometer_kms,
    } = req.body;

    if (!tyre_id || !truck_id || !axle_position) {
      res.status(400).json({ error: 'tyre_id, truck_id, and axle_position are required.' });
      return;
    }

    const [tyre, truck] = await Promise.all([
      TyreRecord.findOne({ _id: tyre_id, company_id: companyId }),
      Truck.findOne({ _id: truck_id, company_id: companyId }),
    ]);

    if (!tyre) {
      res.status(404).json({ error: 'Tyre record not found.' });
      return;
    }
    if (!truck) {
      res.status(404).json({ error: 'Truck not found.' });
      return;
    }

    const odo = odometer_kms !== undefined ? Number(odometer_kms) : truck.current_odometer_kms;

    // If another tyre was mounted at this truck's axle position, unmount it back to in_store
    await TyreRecord.updateMany(
      {
        company_id: companyId,
        current_truck_id: truck._id,
        axle_position,
        _id: { $ne: tyre._id },
      },
      {
        $set: {
          current_truck_id: null,
          axle_position: null,
          status: 'in_store',
        },
      }
    );

    // Mount current tyre
    tyre.current_truck_id = truck._id;
    tyre.axle_position = axle_position as AxlePosition;
    tyre.status = 'fitted';
    tyre.fitted_date = new Date();
    tyre.fitted_odometer_kms = odo;

    tyre.wear_history.push({
      date: new Date(),
      odometer_kms: odo,
      tread_depth_mm: tyre.current_tread_depth_mm,
      inspected_by: 'Mounting Operation',
      notes: `Mounted to ${truck.truck_no} at position ${axle_position}`,
    });

    await tyre.save();

    res.json({
      success: true,
      message: `Tyre ${tyre.serial_number} mounted to ${truck.truck_no} (${axle_position}).`,
      tyre,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 10. POST /api/fleet/maintenance/tyres/:id/inspect
 * Logs tread wear measurement
 */
export async function inspectTyre(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const {
      tread_depth_mm,
      odometer_kms,
      inspected_by,
      notes,
    } = req.body;

    if (tread_depth_mm === undefined) {
      res.status(400).json({ error: 'tread_depth_mm is required.' });
      return;
    }

    const tyre = await TyreRecord.findOne({ _id: id, company_id: companyId });
    if (!tyre) {
      res.status(404).json({ error: 'Tyre not found.' });
      return;
    }

    const measuredDepth = roundMoney(Number(tread_depth_mm));
    tyre.current_tread_depth_mm = measuredDepth;

    tyre.wear_history.push({
      date: new Date(),
      odometer_kms: Number(odometer_kms) || (tyre.fitted_odometer_kms || 0),
      tread_depth_mm: measuredDepth,
      inspected_by: inspected_by || 'Fleet Inspector',
      notes: notes || `Tread depth logged: ${measuredDepth}mm`,
    });

    await tyre.save();

    res.json({
      success: true,
      message: `Tread depth recorded: ${measuredDepth}mm.`,
      tyre,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 11. POST /api/fleet/maintenance/tyres/:id/retread
 * Marks tyre as sent for retreading
 */
export async function retreadTyre(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { new_tread_depth_mm = 14.0, notes } = req.body;

    const tyre = await TyreRecord.findOne({ _id: id, company_id: companyId });
    if (!tyre) {
      res.status(404).json({ error: 'Tyre not found.' });
      return;
    }

    tyre.status = 'retread';
    tyre.current_truck_id = undefined;
    tyre.axle_position = undefined;
    tyre.retread_count += 1;
    tyre.current_tread_depth_mm = Number(new_tread_depth_mm);

    tyre.wear_history.push({
      date: new Date(),
      odometer_kms: tyre.fitted_odometer_kms || 0,
      tread_depth_mm: Number(new_tread_depth_mm),
      inspected_by: 'Retread Workshop',
      notes: notes || `Retread #${tyre.retread_count} applied`,
    });

    await tyre.save();
    res.json({ success: true, message: `Tyre ${tyre.serial_number} marked as Retread #${tyre.retread_count}.`, tyre });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 12. POST /api/fleet/maintenance/tyres/:id/scrap
 * Scraps worn-out or damaged tyre
 */
export async function scrapTyre(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { notes } = req.body;

    const tyre = await TyreRecord.findOne({ _id: id, company_id: companyId });
    if (!tyre) {
      res.status(404).json({ error: 'Tyre not found.' });
      return;
    }

    tyre.status = 'scrapped';
    tyre.current_truck_id = undefined;
    tyre.axle_position = undefined;

    tyre.wear_history.push({
      date: new Date(),
      odometer_kms: tyre.fitted_odometer_kms || 0,
      tread_depth_mm: tyre.current_tread_depth_mm,
      inspected_by: 'Disposal Yard',
      notes: notes || 'Tyre decommissioned and scrapped',
    });

    await tyre.save();
    res.json({ success: true, message: `Tyre ${tyre.serial_number} marked as Scrapped.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 13. GET /api/fleet/maintenance/analytics
 * Computes Fleet CPK, downtime hours, service due alerts, and wear thresholds
 */
export async function getMaintenanceAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);

    // 1. Work orders aggregation
    const workOrders = await MaintenanceOrder.find({ company_id: companyId }).lean();
    const activeOrders = workOrders.filter((w) => w.status === 'in_progress' || w.status === 'scheduled');
    const completedOrders = workOrders.filter((w) => w.status === 'completed');

    const totalSpend = completedOrders.reduce((sum, w) => sum + (w.total_amount || 0), 0);
    const totalDowntimeHours = completedOrders.reduce((sum, w) => sum + (w.downtime_hours || 0), 0);

    // 2. Trucks & Odometer Analysis
    const trucks = await Truck.find({ company_id: companyId, is_deleted: false }).lean();
    const downedTrucks = trucks.filter((t) => t.status === 'in_maintenance');

    // Total fleet odometer distance driven
    const totalOdoDelta = trucks.reduce((sum, t) => {
      const delta = (t.current_odometer_kms || 0) - (t.last_service_kms || 0);
      return sum + Math.max(1, delta);
    }, 0);

    // Cost Per Km (CPK) = Total Maintenance Spend / Total Odometer Kms Delta
    const fleetCPK = totalOdoDelta > 0 ? roundMoney(totalSpend / totalOdoDelta) : 0;

    // Service Due Alerts: trucks within 1,000 km of service interval
    const serviceSchedules = trucks.map((t) => {
      const remainingKms = (t.next_service_due_kms || 0) - (t.current_odometer_kms || 0);
      let alertLevel = 'HEALTHY';
      if (remainingKms <= 0) {
        alertLevel = 'DUE_NOW';
      } else if (remainingKms <= 1000) {
        alertLevel = 'DUE_SOON';
      }

      return {
        truck_id: t._id,
        truck_no: t.truck_no,
        make: t.make,
        model: t.model,
        current_odometer_kms: t.current_odometer_kms,
        next_service_due_kms: t.next_service_due_kms,
        remaining_kms: remainingKms,
        status: t.status,
        alert_level: alertLevel,
      };
    });

    const urgentServicesCount = serviceSchedules.filter((s) => s.alert_level === 'DUE_NOW' || s.alert_level === 'DUE_SOON').length;

    // 3. Critical Tyre Wear Alerts (<= 4mm tread depth)
    const tyres = await TyreRecord.find({ company_id: companyId, status: 'fitted' })
      .populate('current_truck_id', 'truck_no')
      .lean();

    const criticalTyres = tyres.filter((tyre) => tyre.current_tread_depth_mm <= 4.0);

    res.json({
      success: true,
      analytics: {
        active_work_orders_count: activeOrders.length,
        downed_trucks_count: downedTrucks.length,
        completed_work_orders_count: completedOrders.length,
        total_maintenance_spend: roundMoney(totalSpend),
        total_downtime_hours: Math.round(totalDowntimeHours),
        fleet_cpk: fleetCPK,
        urgent_services_count: urgentServicesCount,
        critical_tyres_count: criticalTyres.length,
        service_schedules: serviceSchedules,
        critical_tyres: criticalTyres,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * 14. GET /api/fleet/maintenance/profitability
 * Computes individual vehicle P&L and fuel efficiency (km/litre)
 */
export async function getVehicleProfitability(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);

    const [trucks, journeys, workOrders] = await Promise.all([
      Truck.find({ company_id: companyId, is_deleted: false }).lean(),
      TruckJourney.find({ company_id: companyId, status: 'completed' }).lean(),
      MaintenanceOrder.find({ company_id: companyId, status: 'completed' }).lean(),
    ]);

    const vehicleStats = trucks.map((truck) => {
      const truckJourneys = journeys.filter(
        (j) => j.truck_id && j.truck_id.toString() === truck._id.toString()
      );
      const truckOrders = workOrders.filter(
        (w) => w.truck_id && w.truck_id.toString() === truck._id.toString()
      );

      // 1. Freight Income
      const grossRevenue = truckJourneys.reduce((sum, j: any) => sum + (j.freight_rate || j.total_freight_amount || 0), 0);

      // 2. Diesel Expenses & Fuel Volume
      let totalDieselSpend = 0;
      let totalDieselLitres = 0;
      let totalTripKms = 0;
      let totalTollsAndDriverExpenses = 0;

      for (const j of truckJourneys as any[]) {
        totalTripKms += j.total_distance_kms || j.total_kms || 0;
        totalDieselSpend += j.total_diesel_cost || (Array.isArray(j.diesel_expenses) ? j.diesel_expenses.reduce((s: number, d: any) => s + (d.total_cost || 0), 0) : 0);
        totalDieselLitres += j.total_diesel_litres || (Array.isArray(j.diesel_expenses) ? j.diesel_expenses.reduce((s: number, d: any) => s + (d.fuel_quantity_litres || 0), 0) : 0);
        totalTollsAndDriverExpenses += j.total_driver_expenses || (Array.isArray(j.driver_expenses) ? j.driver_expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0) : 0);
      }

      // 3. Maintenance Repairs
      const totalMaintenanceSpend = truckOrders.reduce((sum, w) => sum + (w.total_amount || 0), 0);

      // 4. Net Asset Profit
      const netProfit = roundMoney(
        grossRevenue - (totalDieselSpend + totalTollsAndDriverExpenses + totalMaintenanceSpend)
      );

      // 5. Fuel Efficiency (km / Litre)
      const fuelEconomyKmPerLitre = totalDieselLitres > 0
        ? Math.round((totalTripKms / totalDieselLitres) * 100) / 100
        : 0;

      // 6. Truck Specific CPK
      const truckCPK = totalTripKms > 0 ? roundMoney(totalMaintenanceSpend / totalTripKms) : 0;

      return {
        truck_id: truck._id,
        truck_no: truck.truck_no,
        make: truck.make,
        model: truck.model,
        completed_trips_count: truckJourneys.length,
        total_trip_kms: totalTripKms,
        gross_revenue: roundMoney(grossRevenue),
        diesel_spend: roundMoney(totalDieselSpend),
        tolls_and_driver_costs: roundMoney(totalTollsAndDriverExpenses),
        maintenance_spend: roundMoney(totalMaintenanceSpend),
        net_profit: netProfit,
        profit_margin_pct: grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0,
        fuel_economy_km_per_l: fuelEconomyKmPerLitre,
        maintenance_cpk: truckCPK,
      };
    });

    res.json({ success: true, profitability: vehicleStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
