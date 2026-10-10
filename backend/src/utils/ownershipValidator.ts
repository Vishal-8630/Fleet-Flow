/**
 * ============================================================================
 * FLEET FLOW — DEEP TENANT OWNERSHIP VALIDATOR (utils/ownershipValidator.ts)
 * ============================================================================
 * 
 * WHAT IS THIS MODULE?
 * --------------------
 * High-performance, anti-IDOR validation engine enforcing that all foreign
 * entity references (truck_id, driver_id, billing_party_id, balance_party_id,
 * journey_id, lr_ids, entry_ids) in a request body strictly belong to the
 * requesting tenant's company_id before records are committed to MongoDB.
 * 
 * WHY IS THIS ESSENTIAL?
 * ----------------------
 * While Mongoose query scoping prevents direct reads, an attacker could attempt
 * an Insecure Direct Object Reference (IDOR via Relations) by submitting Tenant B's
 * truck_id or customer_id in a trip dispatch or invoice payload.
 * 
 * This module eliminates cross-tenant foreign key binding attacks across the API.
 * ============================================================================
 */

import { Types } from 'mongoose';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { BillingParty } from '../models/BillingParty.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { Entry } from '../models/Entry.js';

export interface TenantReferences {
  truck_id?: string | Types.ObjectId;
  driver_id?: string | Types.ObjectId;
  billing_party_id?: string | Types.ObjectId;
  balance_party_id?: string | Types.ObjectId;
  journey_id?: string | Types.ObjectId;
  entry_ids?: Array<string | Types.ObjectId>;
  lr_ids?: Array<string | Types.ObjectId>;
}

export class TenantOwnershipError extends Error {
  statusCode: number;
  entityType: string;

  constructor(message: string, entityType: string) {
    super(message);
    this.name = 'TenantOwnershipError';
    this.statusCode = 403;
    this.entityType = entityType;
  }
}

/**
 * Validates that every provided foreign entity reference strictly exists
 * within the specified tenant's company workspace.
 * 
 * Throws a `TenantOwnershipError` with HTTP 403 if any entity belongs to another
 * tenant or does not exist.
 */
export async function validateTenantOwnership(
  companyId: string | Types.ObjectId,
  references: TenantReferences
): Promise<void> {
  const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;

  // 1. Validate Truck Ownership
  if (references.truck_id) {
    const truck = await Truck.findOne({
      _id: references.truck_id,
      company_id: companyObjId,
      is_deleted: { $ne: true },
    }).select('_id');

    if (!truck) {
      throw new TenantOwnershipError(
        'Invalid vehicle reference: Vehicle does not exist or does not belong to your workspace.',
        'Truck'
      );
    }
  }

  // 2. Validate Driver Ownership
  if (references.driver_id) {
    const driver = await Driver.findOne({
      _id: references.driver_id,
      company_id: companyObjId,
      is_deleted: { $ne: true },
    }).select('_id');

    if (!driver) {
      throw new TenantOwnershipError(
        'Invalid driver reference: Driver does not exist or does not belong to your workspace.',
        'Driver'
      );
    }
  }

  // 3. Validate Billing Party (Customer) Ownership
  if (references.billing_party_id) {
    const party = await BillingParty.findOne({
      _id: references.billing_party_id,
      company_id: companyObjId,
      is_deleted: { $ne: true },
    }).select('_id');

    if (!party) {
      throw new TenantOwnershipError(
        'Invalid billing customer reference: Party does not exist or does not belong to your workspace.',
        'BillingParty'
      );
    }
  }

  // 4. Validate Balance Party (Vendor / Pump / Supplier) Ownership
  if (references.balance_party_id) {
    const vendor = await BalanceParty.findOne({
      _id: references.balance_party_id,
      company_id: companyObjId,
      is_deleted: { $ne: true },
    }).select('_id');

    if (!vendor) {
      throw new TenantOwnershipError(
        'Invalid vendor reference: Balance party does not exist or does not belong to your workspace.',
        'BalanceParty'
      );
    }
  }

  // 5. Validate Truck Journey (Trip) Ownership
  if (references.journey_id) {
    const journey = await TruckJourney.findOne({
      _id: references.journey_id,
      company_id: companyObjId,
      is_deleted: { $ne: true },
    }).select('_id');

    if (!journey) {
      throw new TenantOwnershipError(
        'Invalid journey reference: Trip does not exist or does not belong to your workspace.',
        'TruckJourney'
      );
    }
  }

  // 6. Validate LR Entries Ownership (Array of IDs)
  const entryIds = references.entry_ids || references.lr_ids;
  if (entryIds && entryIds.length > 0) {
    const count = await Entry.countDocuments({
      _id: { $in: entryIds },
      company_id: companyObjId,
      is_deleted: { $ne: true },
    });

    if (count !== entryIds.length) {
      throw new TenantOwnershipError(
        'Invalid consignment reference: One or more LRs do not exist or belong to another workspace.',
        'Entry'
      );
    }
  }
}
