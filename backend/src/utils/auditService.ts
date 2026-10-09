/**
 * ============================================================================
 * FLEET FLOW — AUDIT LOGGER SERVICE (auditService.ts)
 * ============================================================================
 * 
 * Asynchronously writes audit events without blocking primary API response loops.
 * ============================================================================
 */

import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog, AuditAction, AuditEntityType } from '../models/AuditLog.js';

interface AuditLogParams {
  company_id?: Types.ObjectId | string;
  entity_type: AuditEntityType;
  entity_id: Types.ObjectId | string;
  entity_identifier?: string;
  action: AuditAction;
  description: string;
  req?: Request;
  actor_id?: Types.ObjectId | string;
  actor_name?: string;
  actor_role?: string;
  before_snapshot?: Record<string, any>;
  after_snapshot?: Record<string, any>;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const {
      company_id,
      entity_type,
      entity_id,
      entity_identifier,
      action,
      description,
      req,
      before_snapshot,
      after_snapshot,
    } = params;

    const resolvedCompanyId = company_id || (req as any)?.tenant?.id;
    if (!resolvedCompanyId) {
      return;
    }

    const actor_id = params.actor_id || (req as any)?.user?._id || (req as any)?.user?.id;
    const actor_name = params.actor_name || (req as any)?.user?.name || (req as any)?.user?.email || 'System Dispatcher';
    const actor_role = params.actor_role || (req as any)?.tenantRole || (req as any)?.membership?.role || 'operator';
    const ip_address = (req?.headers['x-forwarded-for'] as string) || req?.socket?.remoteAddress || '127.0.0.1';

    await AuditLog.create({
      company_id: new Types.ObjectId(resolvedCompanyId as any),
      entity_type,
      entity_id: new Types.ObjectId(entity_id as any),
      entity_identifier,
      action,
      actor_id: actor_id ? new Types.ObjectId(actor_id as any) : undefined,
      actor_name,
      actor_role,
      ip_address,
      description,
      before_snapshot,
      after_snapshot,
    });
  } catch (err: any) {
    console.error('[Audit Log Service Error]:', err.message);
  }
}
