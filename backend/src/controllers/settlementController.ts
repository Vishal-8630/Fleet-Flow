/**
 * ============================================================================
 * FLEET FLOW — DRIVER TRIP SETTLEMENT CONTROLLER (settlementController.ts)
 * ============================================================================
 * 
 * Manages driver wage & trip reconciliation calculations, diesel mileage variance
 * penalties, and ACID-transactional multi-entity settlement confirmation.
 * ============================================================================
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Settlement } from '../models/Settlement.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Driver } from '../models/Driver.js';
import { Ledger } from '../models/Ledger.js';
import { Company } from '../models/Company.js';
import { notifyDriverSettlement } from '../utils/notificationService.js';
import { logAuditEvent } from '../utils/auditService.js';
import { validateTenantOwnership, TenantOwnershipError } from '../utils/ownershipValidator.js';
import { calculateDriverSettlement, roundMoney } from '../utils/settlementCalculator.js';
import { postDoubleEntryJournal, postSettlementDisbursementJournal } from '../utils/ledgerService.js';
import { runInTransaction, ConfigurationError } from '../utils/transactionHelper.js';

export const getSettlements = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: any = { company_id: companyId, is_deleted: false };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      query.$or = [
        { settlement_number: searchRegex },
        { 'driver_snapshot.name': searchRegex },
        { 'driver_snapshot.phone': searchRegex },
      ];
    }

    if (req.query.driver_id) {
      query.driver_id = req.query.driver_id;
    }

    if (req.query.payment_status) {
      query.payment_status = req.query.payment_status;
    }

    const [settlements, total] = await Promise.all([
      Settlement.find(query)
        .populate('driver_id', 'name phone license_number')
        .sort({ settlement_date: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Settlement.countDocuments(query),
    ]);

    res.json({
      settlements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve settlements.' });
  }
};

export const getSettlementMetrics = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const companyObjectId = new mongoose.Types.ObjectId(String(companyId));

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [monthAggregate, totalAggregate, unpaidCount] = await Promise.all([
      Settlement.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false, settlement_date: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            settledThisMonth: { $sum: '$net_amount' },
            countThisMonth: { $sum: 1 },
          },
        },
      ]),
      Settlement.aggregate([
        { $match: { company_id: companyObjectId, is_deleted: false } },
        {
          $group: {
            _id: null,
            totalNetPaid: { $sum: { $cond: [{ $eq: ['$payment_status', 'paid'] }, '$net_amount', 0] } },
            totalPayableOutstanding: { $sum: { $cond: [{ $and: [{ $eq: ['$payment_status', 'unpaid'] }, { $eq: ['$settlement_type', 'payable_to_driver'] }] }, '$net_amount', 0] } },
            totalCount: { $sum: 1 },
          },
        },
      ]),
      Settlement.countDocuments({ company_id: companyId, is_deleted: false, payment_status: 'unpaid' }),
    ]);

    res.json({
      metrics: {
        settled_this_month: monthAggregate[0]?.settledThisMonth || 0,
        count_this_month: monthAggregate[0]?.countThisMonth || 0,
        total_paid_out: totalAggregate[0]?.totalNetPaid || 0,
        total_payable_outstanding: totalAggregate[0]?.totalPayableOutstanding || 0,
        unpaid_settlements_count: unpaidCount,
        total_settlements: totalAggregate[0]?.totalCount || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute settlement metrics.' });
  }
};

export const getPendingJourneysForDriver = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { driverId } = req.params;

    const driver = await Driver.findOne({ _id: driverId, company_id: companyId, is_deleted: false });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found.' });
    }

    // Find all completed journeys for this driver that have not been settled yet
    const journeys = await TruckJourney.find({
      company_id: companyId,
      driver_id: driverId,
      status: 'completed',
      is_settled: { $ne: true },
      is_deleted: false,
    }).sort({ start_date: 1 });

    const totalKms = journeys.reduce((sum, j) => sum + (j.total_distance_kms || 0), 0);
    const totalAdvances = journeys.reduce((sum, j) => sum + (j.starting_cash_advance || 0), 0);
    const totalReimbursements = journeys.reduce((sum, j) => sum + (j.total_driver_expenses || 0), 0);
    const totalDieselLitres = journeys.reduce((sum, j) => sum + (j.total_diesel_litres || 0), 0);
    const avgMileage = totalDieselLitres > 0 ? Math.round((totalKms / totalDieselLitres) * 100) / 100 : 0;

    res.json({
      driver: {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        license_number: driver.license_number,
        running_advance_balance: driver.running_advance_balance || 0,
      },
      journeys,
      summary: {
        unsettled_trips_count: journeys.length,
        total_kms: totalKms,
        total_advances: totalAdvances,
        total_reimbursements: totalReimbursements,
        total_diesel_litres: totalDieselLitres,
        actual_fleet_mileage: avgMileage,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve pending trips for driver.' });
  }
};

export const previewSettlement = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      driver_id,
      journey_ids = [],
      rate_per_km = 4.5,
      benchmark_mileage = 4.0,
      diesel_price_per_litre = 92.0,
      other_deductions = 0,
      other_deductions_notes,
    } = req.body;

    // Validate driver ownership
    await validateTenantOwnership(companyId!, { driver_id });

    const journeys = await TruckJourney.find({
      _id: { $in: journey_ids },
      company_id: companyId,
      driver_id,
      is_deleted: false,
    });

    const calculation = calculateDriverSettlement({
      journeys: journeys as any,
      rate_per_km,
      benchmark_mileage,
      diesel_price_per_litre,
      other_deductions,
      other_deductions_notes,
    });

    res.json({
      calculation,
    });
  } catch (err: any) {
    if (err instanceof TenantOwnershipError) {
      return res.status(err.statusCode).json({ error: err.message, entityType: err.entityType });
    }
    res.status(400).json({ error: err.message || 'Failed to preview settlement.' });
  }
};

export const confirmSettlement = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const {
      driver_id,
      journey_ids = [],
      rate_per_km = 4.5,
      benchmark_mileage = 4.0,
      diesel_price_per_litre = 92.0,
      other_deductions = 0,
      other_deductions_notes,
      idempotency_key,
      notes,
    } = req.body;

    // 1. Deep Foreign Key Ownership Validation (Anti-IDOR)
    await validateTenantOwnership(companyId!, { driver_id });

    const result = await runInTransaction(async (session) => {
      // 2. Idempotency Check
      if (idempotency_key) {
        const existingSettlement = await Settlement.findOne({
          company_id: companyId,
          idempotency_key,
        }).session(session);

        if (existingSettlement) {
          return { isReplay: true, settlement: existingSettlement, driver: null };
        }
      }

      // 3. Fetch and Validate Driver
      const driver = await Driver.findOne({ _id: driver_id, company_id: companyId }).session(session);
      if (!driver) {
        const err: any = new Error('Driver not found.');
        err.statusCode = 404;
        throw err;
      }

      // 4. Fetch Journeys and Verify None are Already Settled
      const journeys = await TruckJourney.find({
        _id: { $in: journey_ids },
        company_id: companyId,
        driver_id,
        is_deleted: false,
      }).session(session);

      if (journeys.length !== journey_ids.length) {
        const err: any = new Error('One or more selected journeys do not exist or belong to another driver.');
        err.statusCode = 400;
        throw err;
      }

      const alreadySettled = journeys.filter((j) => j.is_settled);
      if (alreadySettled.length > 0) {
        const err: any = new Error(`Conflict: Journey '${alreadySettled[0].journey_number}' has already been settled in a previous payout.`);
        err.statusCode = 409;
        throw err;
      }

      // 5. Compute Calculations with Decimal-Safe Settlement Calculator
      const calculation = calculateDriverSettlement({
        journeys: journeys as any,
        rate_per_km,
        benchmark_mileage,
        diesel_price_per_litre,
        other_deductions,
        other_deductions_notes,
      });

      const {
        total_kms,
        base_earnings,
        total_reimbursements,
        gross_earnings,
        total_advances,
        actual_diesel_litres,
        actual_mileage,
        fuel_variance_penalty,
        total_deductions,
        net_amount,
        settlement_type,
        amount_company_owes_driver,
        amount_driver_owes_company,
      } = calculation;

      // 6. Concurrency-Safe Atomic Sequential Settlement Number
      const updatedCompany = await Company.findByIdAndUpdate(
        companyId,
        { $inc: { 'counters.settlement_seq': 1 } },
        { new: true, session }
      );
      const seq = updatedCompany?.counters?.settlement_seq || (await Settlement.countDocuments({ company_id: companyId }).session(session)) + 1;
      const settlement_number = `SET-${String(seq).padStart(4, '0')}`;

      // 7. Create Settlement Record
      const newSettlement = new Settlement({
        company_id: companyId,
        settlement_number,
        settlement_date: new Date(),
        driver_id: driver._id,
        driver_snapshot: {
          name: driver.name,
          phone: driver.phone,
          license_number: driver.license_number,
        },
        journey_ids,
        journey_breakdowns: journeys.map((j) => ({
          journey_id: j._id,
          journey_number: j.journey_number,
          from_city: j.from_location.city,
          to_city: j.to_location.city,
          distance_kms: j.total_distance_kms,
          start_date: j.start_date,
          end_date: j.actual_end_date,
          advances_received: j.starting_cash_advance,
          reimbursements_claimed: j.total_driver_expenses,
          actual_diesel_litres: j.total_diesel_litres,
          actual_mileage: j.actual_mileage_km_per_litre,
        })),
        total_kms,
        rate_per_km: Number(rate_per_km),
        base_earnings,
        total_reimbursements,
        gross_earnings,
        total_advances,
        benchmark_mileage: Number(benchmark_mileage),
        fuel_variance_penalty,
        other_deductions: Number(other_deductions),
        other_deductions_notes,
        total_deductions,
        net_amount,
        settlement_type,
        payment_status: 'unpaid',
        idempotency_key,
        notes,
        created_by: req.user?._id,
      });

      await newSettlement.save({ session });

      // 8. Lock all selected Journeys
      await TruckJourney.updateMany(
        { _id: { $in: journey_ids }, company_id: companyId },
        { $set: { is_settled: true, settlement_id: newSettlement._id } },
        { session }
      );

      // 9. Update Driver Ledger Balances
      driver.running_advance_balance = 0;
      driver.amount_company_owes_driver = amount_company_owes_driver;
      driver.amount_driver_owes_company = amount_driver_owes_company;
      driver.last_settlement_date = new Date();
      driver.last_settlement_id = newSettlement._id as any;
      await driver.save({ session });

      // 10. Post Balanced Double-Entry Journal to General Ledger
      if (net_amount !== 0) {
        const validAbsAmount = roundMoney(Math.abs(net_amount));
        const legs: any[] =
          net_amount > 0
            ? [
                {
                  category: 'driver_settlement',
                  balance_type: 'debit',
                  amount: validAbsAmount,
                  payment_mode: 'system',
                  party_name: driver.name,
                  reference_number: newSettlement.settlement_number,
                  description: `Trip settlement ${newSettlement.settlement_number} for driver ${driver.name}`,
                  settlement_id: newSettlement._id,
                  driver_id: driver._id,
                },
                {
                  category: 'driver_advance',
                  balance_type: 'credit',
                  amount: validAbsAmount,
                  payment_mode: 'system',
                  party_name: driver.name,
                  reference_number: newSettlement.settlement_number,
                  description: `Wage liability clearing credit for settlement ${newSettlement.settlement_number}`,
                  settlement_id: newSettlement._id,
                  driver_id: driver._id,
                },
              ]
            : [
                {
                  category: 'driver_advance',
                  balance_type: 'debit',
                  amount: validAbsAmount,
                  payment_mode: 'system',
                  party_name: driver.name,
                  reference_number: newSettlement.settlement_number,
                  description: `Excess advance deficit debit for settlement ${newSettlement.settlement_number}`,
                  settlement_id: newSettlement._id,
                  driver_id: driver._id,
                },
                {
                  category: 'driver_settlement',
                  balance_type: 'credit',
                  amount: validAbsAmount,
                  payment_mode: 'system',
                  party_name: driver.name,
                  reference_number: newSettlement.settlement_number,
                  description: `Settlement balance credit for ${newSettlement.settlement_number}`,
                  settlement_id: newSettlement._id,
                  driver_id: driver._id,
                },
              ];

        await postDoubleEntryJournal({
          company_id: companyId!,
          session,
          transaction_type: 'settlement',
          description: `Settlement ${newSettlement.settlement_number} for driver ${driver.name} across ${journeys.length} trips`,
          reference_number: newSettlement.settlement_number,
          party_name: driver.name,
          legs,
          settlement_id: newSettlement._id,
          driver_id: driver._id,
          created_by: req.user?._id,
          is_auto_generated: true,
        });
      }

      return {
        message: 'Driver trip settlement confirmed and locked.',
        settlement: newSettlement,
        driver,
        isReplay: false,
      };
    }, {
      statusCode: 201,
      responseTransformer: (r) => ({
        message: r.message,
        settlement: r.settlement,
      }),
    });

    if (result.isReplay) {
      return res.status(200).json({
        message: 'Settlement already confirmed (Idempotent replay).',
        settlement: result.settlement,
      });
    }

    const { settlement: newSettlement, driver } = result;

    // Trigger WhatsApp notification for driver settlement
    const company = await Company.findById(companyId);
    if (company && driver) {
      notifyDriverSettlement(newSettlement, driver, company).catch((err) =>
        console.error('[Notification Trigger Error - Settlement]:', err)
      );
    }

    logAuditEvent({
      company_id: companyId,
      entity_type: 'settlement',
      entity_id: newSettlement._id,
      entity_identifier: newSettlement.settlement_number,
      action: 'CREATE',
      description: `Settlement ${newSettlement.settlement_number} confirmed for driver ${driver?.name} (Net: ₹${Math.abs(newSettlement.net_amount)}).`,
      req,
      after_snapshot: { settlement_number: newSettlement.settlement_number, net_amount: newSettlement.net_amount },
    });

    res.status(201).json({
      message: 'Driver trip settlement confirmed and locked.',
      settlement: newSettlement,
    });
  } catch (err: any) {
    if (err instanceof TenantOwnershipError) {
      return res.status(err.statusCode).json({ error: err.message, entityType: err.entityType });
    }
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to confirm settlement.' });
  }
};

export const markSettlementPaid = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { payment_mode = 'bank_transfer', payment_ref } = req.body;

    const settlement = await runInTransaction(async (session) => {
      const existing = await Settlement.findOne({
        _id: req.params.id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!existing) {
        const err: any = new Error('Settlement not found.');
        err.statusCode = 404;
        throw err;
      }

      if (existing.payment_status === 'paid') {
        const err: any = new Error('Settlement is already marked as paid.');
        err.statusCode = 400;
        throw err;
      }

      existing.payment_status = 'paid';
      existing.payment_date = new Date();
      existing.payment_mode = payment_mode;
      existing.payment_ref = payment_ref;

      await existing.save({ session });

      // Also update driver owes balance
      await Driver.updateOne(
        { _id: existing.driver_id, company_id: companyId },
        { $set: { amount_company_owes_driver: 0, amount_driver_owes_company: 0 } },
        { session }
      );

      // Post double-entry disbursement journal if net_amount is non-zero
      if (existing.net_amount !== 0) {
        await postSettlementDisbursementJournal({
          company_id: companyId!,
          session,
          settlement_id: existing._id as any,
          settlement_number: existing.settlement_number,
          driver_id: existing.driver_id as any,
          driver_name: existing.driver_snapshot.name,
          net_amount: existing.net_amount,
          payment_mode,
          payment_ref,
          created_by: req.user?._id,
        });
      }

      return {
        message: 'Settlement marked as paid and disbursed.',
        settlement: existing,
      };
    });

    logAuditEvent({
      company_id: companyId!,
      entity_type: 'settlement',
      entity_id: settlement.settlement._id,
      entity_identifier: settlement.settlement.settlement_number,
      action: 'UPDATE',
      description: `Settlement ${settlement.settlement.settlement_number} marked as paid via ${payment_mode} (Ref: ${payment_ref || 'N/A'}).`,
      req,
    });

    res.json(settlement);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Failed to mark settlement paid.' });
  }
};

/**
 * Cancels a confirmed settlement atomically inside a transaction.
 * Reverts associated journeys (is_settled: false), restores driver balance,
 * marks settlement cancelled/deleted, and records audit log.
 */
export const cancelSettlement = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { cancellation_reason } = req.body;

    const cancelledSettlement = await runInTransaction(async (session) => {
      const settlement = await Settlement.findOne({
        _id: req.params.id,
        company_id: companyId,
        is_deleted: false,
      }).session(session);

      if (!settlement) {
        const err: any = new Error('Settlement not found.');
        err.statusCode = 404;
        throw err;
      }

      if (settlement.payment_status === 'paid') {
        const err: any = new Error('Cannot cancel an already paid and disbursed settlement.');
        err.statusCode = 400;
        throw err;
      }

      // 1. Revert all associated truck journeys back to unsettled
      if (settlement.journey_ids && settlement.journey_ids.length > 0) {
        await TruckJourney.updateMany(
          {
            _id: { $in: settlement.journey_ids },
            company_id: companyId,
          },
          {
            $set: {
              is_settled: false,
              settlement_id: null,
            },
          },
          { session }
        );
      }

      // 2. Restore Driver balance (revert net_amount adjustment)
      if (settlement.settlement_type === 'payable_to_driver') {
        // We originally decremented pending_settlement_balance (or amount_company_owes_driver)
        await Driver.findByIdAndUpdate(
          settlement.driver_id,
          {
            $inc: { amount_company_owes_driver: settlement.net_amount },
          },
          { session }
        );
      } else if (settlement.settlement_type === 'receivable_from_driver') {
        await Driver.findByIdAndUpdate(
          settlement.driver_id,
          {
            $inc: { amount_driver_owes_company: Math.abs(settlement.net_amount) },
          },
          { session }
        );
      }

      // 3. Mark Ledger entries for this settlement as reversed
      await Ledger.updateMany(
        {
          settlement_id: settlement._id,
          company_id: companyId,
          is_deleted: false,
        },
        {
          $set: {
            is_reversal: true,
            reversal_reason: `Settlement ${settlement.settlement_number} cancelled: ${cancellation_reason || 'User cancelled'}`,
          },
        },
        { session }
      );

      // 4. Mark settlement cancelled
      settlement.is_deleted = true;
      settlement.notes = `${settlement.notes || ''} [CANCELLED: ${cancellation_reason || 'User cancelled'}]`.trim();
      await settlement.save({ session });

      return {
        message: 'Settlement cancelled successfully. Trips released and balances restored.',
        settlement,
      };
    });

    logAuditEvent({
      company_id: companyId!,
      entity_type: 'settlement',
      entity_id: cancelledSettlement.settlement._id,
      entity_identifier: cancelledSettlement.settlement.settlement_number,
      action: 'DELETE',
      description: `Settlement ${cancelledSettlement.settlement.settlement_number} cancelled and unlinked.`,
      req,
    });

    res.json(cancelledSettlement);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return res.status(500).json({ error: err.message, code: 'CONFIGURATION_ERROR' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to cancel settlement.' });
  }
};

