/**
 * ============================================================================
 * FLEET FLOW — EXECUTIVE DASHBOARD & WATCHLISTS CONTROLLER (dashboardController.ts)
 * ============================================================================
 * 
 * Provides server-side MongoDB aggregation pipelines and 5 operational watchlists:
 * 1. Unsettled Journeys Watchlist
 * 2. Pending Driver Settlements Watchlist
 * 3. Party Payments Aging Watchlist (0-30, 31-60, 60+ days)
 * 4. Statutory Compliance Alerts Watchlist (<15 days or expired)
 * 5. Operational Activity Audit Stream
 * ============================================================================
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TruckJourney } from '../models/TruckJourney.js';
import { Truck } from '../models/Truck.js';
import { Entry } from '../models/Entry.js';
import { Invoice } from '../models/Invoice.js';
import { Settlement } from '../models/Settlement.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * GET /api/dashboard/summary
 * Computes executive KPI summary in single server-side aggregation pipelines
 */
export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const companyId = new Types.ObjectId(req.tenant?.id);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      journeyStats,
      truckStats,
      entryStats,
      invoiceStats,
      settlementStats,
    ] = await Promise.all([
      // 1. Journey metrics via aggregation
      TruckJourney.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
        {
          $group: {
            _id: null,
            active_trips: {
              $sum: { $cond: [{ $in: ['$status', ['active', 'delayed']] }, 1, 0] },
            },
            completed_trips: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            unsettled_trips: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'completed'] },
                      { $ne: ['$is_settled', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 2. Fleet capacity stats
      Truck.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
        {
          $group: {
            _id: null,
            total_trucks: { $sum: 1 },
            available_trucks: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] },
            },
            on_trip_trucks: {
              $sum: { $cond: [{ $eq: ['$status', 'on_trip'] }, 1, 0] },
            },
            maintenance_trucks: {
              $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] },
            },
          },
        },
      ]),

      // 3. LR & Revenue metrics
      Entry.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
        {
          $group: {
            _id: null,
            unbilled_lrs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'active'] },
                      { $eq: ['$freight_terms', 'to_be_billed'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            unbilled_freight_value: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'active'] },
                      { $eq: ['$freight_terms', 'to_be_billed'] },
                    ],
                  },
                  '$freight_amount',
                  0,
                ],
              },
            },
            today_revenue: {
              $sum: {
                $cond: [
                  { $gte: ['$lr_date', startOfToday] },
                  '$freight_amount',
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 4. Invoicing and receivables
      Invoice.aggregate([
        { $match: { company_id: companyId, is_deleted: false } },
        {
          $group: {
            _id: null,
            total_receivables: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['issued', 'partially_paid']] },
                  '$balance_amount',
                  0,
                ],
              },
            },
            overdue_count: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$status', ['issued', 'partially_paid']] },
                      { $lt: ['$due_date', new Date()] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 5. Driver settlements pending
      Settlement.aggregate([
        { $match: { company_id: companyId, is_deleted: false, payment_status: 'unpaid' } },
        {
          $group: {
            _id: null,
            pending_count: { $sum: 1 },
            pending_payout_amount: {
              $sum: {
                $cond: [
                  { $eq: ['$settlement_type', 'payable_to_driver'] },
                  '$net_amount',
                  0,
                ],
              },
            },
            pending_recovery_amount: {
              $sum: {
                $cond: [
                  { $eq: ['$settlement_type', 'receivable_from_driver'] },
                  { $abs: '$net_amount' },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const journey = journeyStats[0] || { active_trips: 0, completed_trips: 0, unsettled_trips: 0 };
    const trucks = truckStats[0] || { total_trucks: 0, available_trucks: 0, on_trip_trucks: 0, maintenance_trucks: 0 };
    const entries = entryStats[0] || { unbilled_lrs: 0, unbilled_freight_value: 0, today_revenue: 0 };
    const invoices = invoiceStats[0] || { total_receivables: 0, overdue_count: 0 };
    const settlements = settlementStats[0] || { pending_count: 0, pending_payout_amount: 0, pending_recovery_amount: 0 };

    res.json({
      summary: {
        active_trips: journey.active_trips,
        completed_trips: journey.completed_trips,
        unsettled_trips: journey.unsettled_trips,
        total_trucks: trucks.total_trucks,
        available_trucks: trucks.available_trucks,
        on_trip_trucks: trucks.on_trip_trucks,
        fleet_availability_ratio: trucks.total_trucks > 0 ? Math.round((trucks.available_trucks / trucks.total_trucks) * 100) : 0,
        unbilled_lrs: entries.unbilled_lrs,
        unbilled_freight_value: entries.unbilled_freight_value,
        today_revenue: entries.today_revenue,
        pending_receivables: invoices.total_receivables,
        overdue_invoices_count: invoices.overdue_count,
        pending_settlements_count: settlements.pending_count,
        pending_settlements_amount: settlements.pending_payout_amount,
        pending_recovery_amount: settlements.pending_recovery_amount,
      },
    });
  } catch (err: any) {
    console.error('getDashboardSummary error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute executive summary.' });
  }
};

/**
 * GET /api/dashboard/watchlists
 * Returns the 5 dedicated operational watchlists for real-time situational awareness
 */
export const getDashboardWatchlists = async (req: Request, res: Response) => {
  try {
    const companyId = new Types.ObjectId(req.tenant?.id);
    const now = new Date();
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    // 1. Watchlist 1: Unsettled Journeys (Completed but finances not settled)
    const unsettledJourneys = await TruckJourney.find({
      company_id: companyId,
      status: 'completed',
      is_settled: { $ne: true },
      is_deleted: false,
    })
      .select('journey_number from_location to_location actual_end_date starting_cash_advance total_driver_expenses')
      .populate('truck_id', 'truck_no')
      .populate('driver_id', 'name phone')
      .sort({ actual_end_date: -1 })
      .limit(10)
      .lean();

    // 2. Watchlist 2: Pending Driver Settlements
    const pendingDriverSettlements = await Settlement.find({
      company_id: companyId,
      payment_status: 'unpaid',
      is_deleted: false,
    })
      .select('settlement_number settlement_date driver_snapshot settlement_type net_amount total_kms')
      .sort({ settlement_date: -1 })
      .limit(10)
      .lean();

    // 3. Watchlist 3: Party Payments Aging (0-30, 31-60, 60+ days overdue)
    const overdueInvoices = await Invoice.find({
      company_id: companyId,
      status: { $in: ['issued', 'partially_paid'] },
      balance_amount: { $gt: 0 },
      is_deleted: false,
    })
      .select('invoice_number billing_party_snapshot due_date balance_amount total_amount')
      .sort({ due_date: 1 })
      .limit(20)
      .lean();

    let aging_0_30 = 0;
    let aging_31_60 = 0;
    let aging_60_plus = 0;

    const categorizedInvoices = overdueInvoices.map((inv) => {
      const dueDate = new Date(inv.due_date);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      let bracket: 'current' | '0-30' | '31-60' | '60+' = 'current';

      if (diffDays > 60) {
        bracket = '60+';
        aging_60_plus += inv.balance_amount;
      } else if (diffDays > 30) {
        bracket = '31-60';
        aging_31_60 += inv.balance_amount;
      } else if (diffDays > 0) {
        bracket = '0-30';
        aging_0_30 += inv.balance_amount;
      }

      return {
        ...inv,
        days_overdue: Math.max(0, diffDays),
        aging_bracket: bracket,
      };
    });

    // 4. Watchlist 4: Statutory Compliance Alerts (< 15 days or expired)
    const trucks = await Truck.find({
      company_id: companyId,
      is_deleted: false,
    })
      .select('truck_no model fitness_doc insurance_doc national_permit_doc puc_doc status')
      .lean();

    const complianceAlerts: any[] = [];

    trucks.forEach((truck: any) => {
      const docTypes: Array<{ key: string; name: string; doc?: any }> = [
        { key: 'fitness', name: 'Fitness Certificate', doc: truck.fitness_doc },
        { key: 'insurance', name: 'Insurance Policy', doc: truck.insurance_doc },
        { key: 'permit', name: 'National Permit', doc: truck.national_permit_doc },
        { key: 'puc', name: 'PUC Pollution Certificate', doc: truck.puc_doc },
      ];

      docTypes.forEach(({ name, doc }) => {
        if (!doc?.expiry_date) return;
        const expiry = new Date(doc.expiry_date);
        const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 15) {
          complianceAlerts.push({
            truck_id: truck._id,
            truck_no: truck.truck_no,
            document_type: name,
            expiry_date: doc.expiry_date,
            days_remaining: daysRemaining,
            is_expired: daysRemaining < 0,
            urgency: daysRemaining < 0 ? 'CRITICAL' : daysRemaining <= 5 ? 'HIGH' : 'MEDIUM',
          });
        }
      });
    });

    complianceAlerts.sort((a, b) => a.days_remaining - b.days_remaining);

    // 5. Watchlist 5: Operational Activity Feed (Unified stream of recent operational actions)
    let recentAuditLogs = await AuditLog.find({
      company_id: companyId,
    })
      .sort({ created_at: -1 })
      .limit(15)
      .lean();

    // Fallback if AuditLog is fresh: build unified stream from recent operations
    if (recentAuditLogs.length === 0) {
      const [recentJourneys, recentLrs, recentSettlements] = await Promise.all([
        TruckJourney.find({ company_id: companyId, is_deleted: false })
          .sort({ created_at: -1 })
          .limit(5)
          .select('journey_number status from_location to_location created_at')
          .lean(),
        Entry.find({ company_id: companyId, is_deleted: false })
          .sort({ created_at: -1 })
          .limit(5)
          .select('lr_no from_location to_location created_at')
          .lean(),
        Settlement.find({ company_id: companyId, is_deleted: false })
          .sort({ created_at: -1 })
          .limit(5)
          .select('settlement_number net_amount settlement_type created_at driver_snapshot')
          .lean(),
      ]);

      const synthEvents: any[] = [];
      recentJourneys.forEach((j) => {
        synthEvents.push({
          entity_type: 'journey',
          entity_identifier: j.journey_number,
          action: 'STATUS_CHANGE',
          actor_name: 'Dispatcher',
          description: `Journey ${j.journey_number} (${j.from_location?.city} → ${j.to_location?.city}) updated to ${j.status}.`,
          created_at: (j as any).created_at || (j as any).createdAt || new Date(),
        });
      });
      recentLrs.forEach((e) => {
        synthEvents.push({
          entity_type: 'entry',
          entity_identifier: e.lr_no,
          action: 'CREATE',
          actor_name: 'Operator',
          description: `Lorry Receipt ${e.lr_no} registered (${e.from_location} → ${e.to_location}).`,
          created_at: e.created_at,
        });
      });
      recentSettlements.forEach((s) => {
        synthEvents.push({
          entity_type: 'settlement',
          entity_identifier: s.settlement_number,
          action: 'CREATE',
          actor_name: 'Accounts',
          description: `Settlement ${s.settlement_number} processed for ${s.driver_snapshot?.name || 'Driver'} (₹${Math.abs(s.net_amount)}).`,
          created_at: s.created_at,
        });
      });

      synthEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      recentAuditLogs = synthEvents.slice(0, 15) as any;
    }

    res.json({
      watchlists: {
        unsettled_journeys: unsettledJourneys,
        pending_driver_settlements: pendingDriverSettlements,
        party_payments: {
          aging_brackets: {
            '0_30_days': aging_0_30,
            '31_60_days': aging_31_60,
            '60_plus_days': aging_60_plus,
            total_overdue: aging_0_30 + aging_31_60 + aging_60_plus,
          },
          invoices: categorizedInvoices,
        },
        compliance_alerts: complianceAlerts.slice(0, 10),
        operational_activity_feed: recentAuditLogs,
      },
    });
  } catch (err: any) {
    console.error('getDashboardWatchlists error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch operational watchlists.' });
  }
};

/**
 * GET /api/dashboard/audit/:entityType/:entityId
 * Fetches audit trail for a specific entity to render in <HistoryDrawer>
 */
export const getEntityAuditTrail = async (req: Request, res: Response) => {
  try {
    const companyId = req.tenant?.id;
    const { entityType, entityId } = req.params;

    const logs = await AuditLog.find({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
    })
      .sort({ created_at: -1 })
      .lean();

    res.json({ audit_trail: logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve entity audit trail.' });
  }
};
