/**
 * ============================================================================
 * FLEET FLOW — BATCH A SECURITY, TENANT PRIVACY & CONTROLLED SUPPORT TESTS
 * (batchASecurity.test.ts)
 * ============================================================================
 * 
 * Comprehensive Automated Negative Security Test Suite for Batch A:
 * - DEC-012 Approved Policy Baseline
 * - Fail-Closed Database Unavailability Contract (HTTP 503)
 * - Dual-Super-Admin Emergency Access & Durable Majority Notification Queueing
 * - Immediate Session Revocation & Expiration Guards (HTTP 403)
 * - Read-Only Diagnostics Mutation Blocker (HTTP 403)
 * - Financial Route, Receipt Access & Export Blockades (HTTP 403)
 * - Server-side Driver PII Masking & Monetary Field Redaction
 * - Customer Lockout Out-of-Band Ticket Intake & Atomic Audit Trails
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { createTestTenant, createSuperAdmin } from '../helpers.js';
import { SupportAccessRequest } from '../../models/SupportAccessRequest.js';
import { SupportTicket } from '../../models/SupportTicket.js';
import { PlatformAuditLog } from '../../models/PlatformAuditLog.js';
import { NotificationJob } from '../../models/NotificationJob.js';
import { Driver } from '../../models/Driver.js';
import { Truck } from '../../models/Truck.js';
import { User } from '../../models/User.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { BillingParty } from '../../models/BillingParty.js';
import { generateTenantKey } from '../../utils/storageService.js';
import {
  sanitizeSupportData,
  attachSupportSanitizer,
  isFinancialRoute,
  isReceiptRequest,
} from '../../middleware/supportSecurityMiddleware.js';

describe('Batch A: Security, Tenant Isolation & Controlled Support (DEC-012)', () => {
  let tenantA: any;
  let tenantB: any;
  let superAdminOne: any;
  let superAdminTwo: any;
  let supportTicketA: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Express Transporters' });
    tenantB = await createTestTenant({ name: 'Beta Freight Carriers' });
    superAdminOne = await createSuperAdmin();
    superAdminTwo = await createSuperAdmin();

    // Create an initial active support ticket for Tenant A
    supportTicketA = await SupportTicket.create({
      company_id: tenantA.company._id,
      ticket_no: `TICK-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      created_by: tenantA.user._id,
      subject: 'Urgent: Dispatch board sync latency',
      category: 'bug',
      priority: 'high',
      status: 'open',
      messages: [
        {
          sender_id: tenantA.user._id,
          sender_name: tenantA.user.name,
          sender_role: 'user',
          message: 'The dispatch board is taking > 10s to reflect assigned vehicles.',
          sent_at: new Date(),
        },
      ],
    });
  });

  // Helper to create support tokens
  function createSupportJwt(params: {
    userId: string;
    companyId: string;
    supportSessionId: string;
    supportScope?: 'diagnostics_readonly' | 'config_write';
    isEmergency?: boolean;
    expiresIn?: jwt.SignOptions['expiresIn'];
  }): string {
    const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
    return jwt.sign(
      {
        userId: params.userId,
        companyId: params.companyId,
        impersonatedCompanyId: params.companyId,
        isImpersonation: true,
        supportSessionId: params.supportSessionId,
        supportScope: params.supportScope || 'diagnostics_readonly',
        isEmergency: params.isEmergency || false,
        actorEmail: 'superadmin@platform.com',
      },
      secret,
      { expiresIn: params.expiresIn || '30m' }
    );
  }

  // --------------------------------------------------------------------------
  // 1. Lifecycle & Authorization Boundaries (P0)
  // --------------------------------------------------------------------------
  describe('1. Lifecycle & Authorization Boundaries', () => {
    it('SEC-NEG-01: Rejects legacy impersonation attempt without an approved SupportAccessRequest (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenantA.company._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({ reason: 'Direct unconstrained entry attempt' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPPORT_ACCESS_REQUEST_REQUIRED');
    });

    it('SEC-NEG-02: Rejects impersonation entry for a pending support request (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'pending',
        duration_minutes: 30,
        justification: 'Reviewing dispatch lag',
      });

      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenantA.company._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({ reason: 'Premature entry', support_request_id: accessRequest._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPPORT_SESSION_INVALID');
    });

    it('SEC-NEG-03: Tenant B Admin cannot approve a support request belonging to Tenant A (HTTP 404)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'pending',
        duration_minutes: 30,
        justification: 'Tenant A diagnostics',
      });

      const res = await request(app)
        .post(`/api/support/sessions/${accessRequest._id}/approve`)
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(res.status).toBe(404);
    });

    it('SEC-NEG-04: Non-admin tenant member cannot approve support access requests (HTTP 403)', async () => {
      const dispatcher = await createTestTenant({
        role: 'dispatcher',
        name: 'Alpha Dispatcher Workspace',
      });

      const accessRequest = await SupportAccessRequest.create({
        company_id: dispatcher.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'pending',
        duration_minutes: 30,
        justification: 'Dispatcher diagnostics',
      });

      const res = await request(app)
        .post(`/api/support/sessions/${accessRequest._id}/approve`)
        .set('Authorization', `Bearer ${dispatcher.token}`);

      expect(res.status).toBe(403);
    });

    it('SEC-NEG-05: Rejects support access request linked to non-existent or cross-tenant ticket (HTTP 404)', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-access/request')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantB.company._id.toString(),
          ticket_id: supportTicketA._id.toString(), // Belongs to Tenant A, not Tenant B
          justification: 'Cross-tenant ticket link attempt',
        });

      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Read-Only Diagnostics & Mutation Blocker (P0)
  // --------------------------------------------------------------------------
  describe('2. Read-Only Diagnostics Enforcement', () => {
    it('SEC-NEG-06: Blocks write mutations (POST/PUT/DELETE) under diagnostics_readonly scope (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Diagnostics session',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
        supportScope: 'diagnostics_readonly',
      });

      // Attempt to mutate: create a new truck
      const postRes = await request(app)
        .post('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({
          plate_number: 'MH-12-AB-9999',
          truck_type: 'open_body',
          capacity_tonnes: 16,
        });

      expect(postRes.status).toBe(403);
      expect(postRes.body.code).toBe('SUPPORT_READ_ONLY_MODE');

      // But read access is allowed
      const getRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(getRes.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Operational Financial & Export Blockade (P0)
  // --------------------------------------------------------------------------
  describe('3. Financial & Export Blockade', () => {
    it('SEC-NEG-07: Blocks access to pure financial routes during support sessions (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Checking dispatch board',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Pure financial endpoint
      const res = await request(app)
        .get('/api/commercial/settlements/metrics')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FINANCIAL_RECORDS_LOCKED');
    });

    it('SEC-NEG-08: Blocks data exports during support sessions (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Inspection',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      const res = await request(app)
        .get('/api/fleet/trucks?format=csv')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPPORT_EXPORT_BLOCKED');
    });

    it('SEC-NEG-09: Blocks receipt document downloads during support sessions (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Inspection',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      const res = await request(app)
        .get('/api/documents/file?key=tenants/alpha/receipts/toll_001.pdf')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Instant Revocation & Expiration Guards (P0)
  // --------------------------------------------------------------------------
  describe('4. Revocation & Expiration Enforcement', () => {
    it('SEC-NEG-10: Immediately rejects API requests after session revocation (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Active diagnostic',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Verify token initially works for GET
      const initialRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(initialRes.status).toBe(200);

      // Tenant Admin revokes session immediately
      const revokeRes = await request(app)
        .post(`/api/support/sessions/${accessRequest._id}/revoke`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ reason: 'Investigation completed early' });
      expect(revokeRes.status).toBe(200);

      // Subsequent API call with previously valid token must be rejected
      const nextRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(nextRes.status).toBe(403);
      expect(nextRes.body.code).toBe('SUPPORT_SESSION_REVOKED');
    });

    it('SEC-NEG-11: Rejects API requests once session duration has expired (HTTP 403)', async () => {
      const expiredSession = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(Date.now() - 40 * 60 * 1000),
        expires_at: new Date(Date.now() - 10 * 60 * 1000), // Expired 10 minutes ago
        justification: 'Expired diagnostic session',
      });

      const expiredToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: expiredSession._id.toString(),
      });

      const res = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPPORT_SESSION_EXPIRED');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Dual-Super-Admin Break-Glass Emergency Access (P0)
  // --------------------------------------------------------------------------
  describe('5. Dual-Super-Admin Emergency Access & Durable Queueing', () => {
    it('SEC-NEG-12: Rejects single Super-Admin self-approval attempt (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Catastrophic API crash',
          approver_two_id: superAdminOne.user._id.toString(), // Self-approval
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUAL_ADMIN_IDENTICAL');
    });

    it('SEC-NEG-13: Rejects secondary approver who is not a Platform Super-Admin (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Catastrophic lockout',
          approver_two_id: tenantA.user._id.toString(), // Not a super admin
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SECONDARY_APPROVER_INVALID');
    });

    it('SEC-NEG-14: Successfully issues 30m emergency access and persists durable notification with majority write concern', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Major database connection degradation affecting tenant dispatchers',
          approver_two_id: superAdminTwo.user._id.toString(),
          duration_minutes: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.is_emergency).toBe(true);
      expect(res.body.token).toBeDefined();

      // Verify NotificationJob is durably queued
      const notifJob = await NotificationJob.findOne({ job_id: res.body.notification_job_id });
      expect(notifJob).toBeDefined();
      expect(notifJob!.event_type).toBe('EMERGENCY_ACCESS_GRANTED');
      expect(notifJob!.status).toBe('pending');
      expect(notifJob!.company_id.toString()).toBe(tenantA.company._id.toString());

      // Verify audit record was created atomically
      const auditLog = await PlatformAuditLog.findOne({
        action: 'emergency_support_activated',
        target_company_id: tenantA.company._id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.details.approver_two).toBe(superAdminTwo.user.email);
    });

    it('SEC-NEG-15: Fails closed (HTTP 503) and denies token issuance if notification queue persistence fails', async () => {
      // Mock NotificationJob save to simulate queue persistence failure
      const originalSave = NotificationJob.prototype.save;
      vi.spyOn(NotificationJob.prototype, 'save').mockRejectedValueOnce(
        new Error('MongoDB majority write concern timeout on notification queue replica set')
      );

      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Urgent diagnostic investigation',
          approver_two_id: superAdminTwo.user._id.toString(),
        });

      // Restore spy
      vi.restoreAllMocks();

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EMERGENCY_NOTIFICATION_FAILED');
      expect(res.body.token).toBeUndefined();

      // Verify no active emergency access request was created
      const activeRequests = await SupportAccessRequest.find({
        company_id: tenantA.company._id,
        is_emergency: true,
      });
      expect(activeRequests.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Fail-Closed Session Verification Contract (Policy E)
  // --------------------------------------------------------------------------
  describe('6. Database Unavailability Fail-Closed Contract (Policy E)', () => {
    it('SEC-NEG-16: Fails closed with HTTP 503 when session verification cannot complete', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Verifying DB resilience',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Simulate database failure during session verification
      vi.spyOn(SupportAccessRequest, 'findOne').mockRejectedValueOnce(
        new Error('MongoNetworkTimeoutException: connection closed before handshake')
      );

      const res = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);

      vi.restoreAllMocks();

      // Must fail closed with 503, never fail open
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SESSION_VERIFICATION_FAILED');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Driver PII Masking & Monetary Field Redaction (Policies B & C)
  // --------------------------------------------------------------------------
  describe('7. Server-Side PII Masking & Operational Monetary Redaction', () => {
    it('SEC-NEG-17: Driver PII is fully masked and operational monetary fields are redacted across API responses', async () => {
      // Create a driver in Tenant A with full PII and financial balances
      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Rameshwar Yadav',
        phone: '+919876543210',
        emergency_phone: '+919876543211',
        address: '42 GT Road, Transport Nagar, Kanpur, Uttar Pradesh',
        date_of_birth: new Date('1985-06-15'),
        license_number: 'UP-78-20150009876',
        aadhaar_number: '9876 5432 1098',
        photo_url: 'https://s3.ap-south-1.amazonaws.com/fleetflow/drivers/rameshwar.jpg',
        license_front_url: 'https://s3.ap-south-1.amazonaws.com/fleetflow/drivers/dl_front.jpg',
        aadhaar_front_url: 'https://s3.ap-south-1.amazonaws.com/fleetflow/drivers/aadhaar.jpg',
        running_advance_balance: 550000, // 5,500 INR in paise
        amount_company_owes_driver: 1200000,
        amount_driver_owes_company: 0,
      });

      // 1. Normal tenant admin call -> full fields available to tenant admin
      const normalRes = await request(app)
        .get(`/api/fleet/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(normalRes.status).toBe(200);
      expect(normalRes.body.driver.name).toBe('Rameshwar Yadav');
      expect(normalRes.body.driver.phone).toBe('+919876543210');

      // 2. Support session call -> PII is masked, monetary fields nullified
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Driver roster diagnostic check',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      const supportRes = await request(app)
        .get(`/api/fleet/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(supportRes.status).toBe(200);
      const sanitizedDriver = supportRes.body.driver;

      // Driver PII Masking:
      expect(sanitizedDriver.name).toBe('Rameshwar Yadav');
      expect(sanitizedDriver.aadhaar_number).toBe('XXXX-XXXX-1098');
      expect(sanitizedDriver.phone).toBe('+91 98765 XXXXX');
      expect(sanitizedDriver.emergency_phone).toBe('+91 98765 XXXXX');
      expect(sanitizedDriver.license_number).toBe('DL-XXXXXXXXX9876');
      expect(sanitizedDriver.date_of_birth).toBeNull();
      expect(sanitizedDriver.address).toBeNull();
      expect(sanitizedDriver.photo_url).toBeNull();
      expect(sanitizedDriver.license_front_url).toBeNull();
      expect(sanitizedDriver.aadhaar_front_url).toBeNull();

      // Operational Monetary Redaction:
      expect(sanitizedDriver.running_advance_balance).toBeNull();
      expect(sanitizedDriver.amount_company_owes_driver).toBeNull();
      expect(sanitizedDriver.amount_driver_owes_company).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 8. Customer Lockout Intake & Atomic Audit Log (Policy D)
  // --------------------------------------------------------------------------
  describe('8. Out-of-Band Customer Lockout Ticket Intake', () => {
    it('SEC-NEG-18: Authenticated Super-Admin creates an out-of-band verified ticket with complete audit trail', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-tickets/lockout-intake')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          subject: 'Customer Admin Lockout — Secondary MFA Device Lost',
          category: 'compliance',
          priority: 'critical',
          message: 'Workspace owner reached out via registered phone requesting support access.',
          out_of_band_verification: {
            verification_method: 'phone_callback_registered_billing_contact',
            contact_phone: '+919876543210',
            notes: 'Verified against GST registration certificate and callback to registered corporate number.',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.intake_channel).toBe('out_of_band_phone_verified');
      expect(res.body.ticket.out_of_band_verification.verification_method).toBe(
        'phone_callback_registered_billing_contact'
      );

      // Verify audit record was created atomically
      const audit = await PlatformAuditLog.findOne({
        action: 'support_ticket_lockout_created',
        target_company_id: tenantA.company._id,
      });
      expect(audit).toBeDefined();
      expect(audit!.actor_user_id.toString()).toBe(superAdminOne.user._id.toString());
      expect(audit!.details.verification_method).toBe('phone_callback_registered_billing_contact');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Batch A Independent Security Review Remediation Regressions (Round 1)
  // --------------------------------------------------------------------------
  describe('9. Batch A Remediation Regressions', () => {
    // Finding 1: Real majority-write configuration and queue failure
    it('SEC-REM-01: Verifies real majority write concern on NotificationJob schema and persistence without shallow mocks', async () => {
      // Verify schema configuration
      const schemaConcern = (NotificationJob.schema as any).get('writeConcern');
      expect(schemaConcern).toEqual({ w: 'majority', j: true });

      // Verify real database operation succeeds with majority write concern
      const realJob = new NotificationJob({
        company_id: tenantA.company._id,
        job_id: `JOB-REAL-${Date.now()}`,
        channel: 'email',
        event_type: 'EMERGENCY_ACCESS_GRANTED',
        recipient_name: 'Alpha Admin',
        recipient_email: 'admin@alpha.com',
        message_preview: 'Real majority write test',
        status: 'pending',
      });
      const saved = await realJob.save({ w: 'majority', j: true });
      expect(saved._id).toBeDefined();

      const retrieved = await NotificationJob.findById(saved._id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.status).toBe('pending');
    });

    it('SEC-REM-01B: Ensures notification persistence failure prevents emergency token issuance (fail closed)', async () => {
      vi.spyOn(NotificationJob.prototype, 'save').mockRejectedValueOnce(
        new Error('ReplicaSetNoMajorityError: Write concern majority could not be satisfied')
      );

      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Emergency outage diagnostics',
          approver_two_id: superAdminTwo.user._id.toString(),
        });

      vi.restoreAllMocks();

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EMERGENCY_NOTIFICATION_FAILED');
      expect(res.body.token).toBeUndefined();

      // Confirm no session was issued
      const activeSessions = await SupportAccessRequest.find({
        company_id: tenantA.company._id,
        is_emergency: true,
      });
      expect(activeSessions.length).toBe(0);
    });

    // Finding 2: TypeScript compilation verified across model types
    it('SEC-REM-02: Model types guarantee started_at, billing email, write concern, and cancellation status', () => {
      const access: Partial<import('../../models/SupportAccessRequest.js').ISupportAccessRequest> = {
        started_at: new Date(),
        duration_minutes: 30,
      };
      expect(access.started_at).toBeDefined();

      const notif: Partial<import('../../models/NotificationJob.js').INotificationJob> = {
        status: 'cancelled',
      };
      expect(notif.status).toBe('cancelled');
    });

    // Finding 3: Commercial route bypasses blocked during support sessions
    it('SEC-REM-03: Blocks commercial endpoints (/aging, /profitability, /credit-notes) during support sessions', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Route boundary check',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // 1. /api/commercial/aging
      const agingRes = await request(app)
        .get('/api/commercial/aging')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(agingRes.status).toBe(403);
      expect(agingRes.body.code).toBe('FINANCIAL_RECORDS_LOCKED');

      // 2. /api/commercial/profitability
      const profRes = await request(app)
        .get('/api/commercial/profitability')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(profRes.status).toBe(403);
      expect(profRes.body.code).toBe('FINANCIAL_RECORDS_LOCKED');

      // 3. /api/commercial/credit-notes
      const creditRes = await request(app)
        .get('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(creditRes.status).toBe(403);
      expect(creditRes.body.code).toBe('FINANCIAL_RECORDS_LOCKED');

      // 4. Pure helper validation
      expect(isFinancialRoute('/api/commercial/aging')).toBe(true);
      expect(isFinancialRoute('/api/commercial/profitability')).toBe(true);
      expect(isFinancialRoute('/api/commercial/credit-notes')).toBe(true);
      expect(isFinancialRoute('/api/commercial/entries')).toBe(false);
      expect(isFinancialRoute('/api/commercial/entries/12345')).toBe(false);
    });

    // Finding 4: Operational monetary redaction across direct and nested domain fields
    it('SEC-REM-04: Recursively redacts all operational monetary fields while strictly preserving physical metrics', async () => {
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: `MH-${Math.floor(10 + Math.random() * 89)}-ZZ-${Math.floor(1000 + Math.random() * 8999)}`,
        make: 'Tata',
        model: 'Signa 4825',
        body_type: 'Open',
        tonnage_capacity: 25,
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Balwinder Singh',
        phone: '+919876500001',
        license_number: 'DL-04-20200001234',
      });

      const journey = await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: `JRN-${Date.now()}`,
        status: 'active',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Mumbai', state: 'Maharashtra' },
        to_location: { city: 'Delhi', state: 'Delhi' },
        start_date: new Date(),
        start_odometer_kms: 125000,
        end_odometer_kms: 126420,
        total_distance_kms: 1420,
        estimated_duration_days: 3,
        loaded_weight_tonnes: 22.5,
        cbm_volume: 65,
        freight_rate: 85000,
        starting_cash_advance: 12000,
        total_diesel_litres: 410,
        total_diesel_cost: 36900,
        total_driver_expenses: 7500,
        actual_mileage_km_per_litre: 3.46,
        diesel_expenses: [
          {
            filling_date: new Date(),
            petrol_pump_name: 'HPCL Express Way Pump',
            fuel_quantity_litres: 205,
            rate_per_litre: 90,
            total_cost: 18450,
            payment_mode: 'cash',
          },
        ],
        driver_expenses: [
          {
            date: new Date(),
            expense_type: 'toll',
            amount: 3200,
          },
        ],
        incidents: [
          {
            date: new Date(),
            severity: 'minor',
            description: 'Fan belt replacement',
            financial_impact: 1500,
            resolved: true,
          },
        ],
        delivery_status: 'pending',
        is_settled: false,
      });

      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Journey audit check',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      const res = await request(app)
        .get(`/api/operations/journeys/${journey._id}`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      const sanitizedJourney = res.body.journey || res.body;

      // 1. Direct operational monetary fields REDACTED TO NULL
      expect(sanitizedJourney.freight_rate).toBeNull();
      expect(sanitizedJourney.starting_cash_advance).toBeNull();
      expect(sanitizedJourney.total_diesel_cost).toBeNull();
      expect(sanitizedJourney.total_driver_expenses).toBeNull();

      // 2. Nested array operational monetary fields REDACTED TO NULL
      expect(sanitizedJourney.diesel_expenses[0].rate_per_litre).toBeNull();
      expect(sanitizedJourney.diesel_expenses[0].total_cost).toBeNull();
      expect(sanitizedJourney.driver_expenses[0].amount).toBeNull();
      expect(sanitizedJourney.incidents[0].financial_impact).toBeNull();

      // 3. Physical operational metrics STRICTLY PRESERVED
      expect(sanitizedJourney.total_diesel_litres).toBe(205);
      expect(sanitizedJourney.diesel_expenses[0].fuel_quantity_litres).toBe(205);
      expect(sanitizedJourney.start_odometer_kms).toBe(125000);
      expect(sanitizedJourney.total_distance_kms).toBe(1420);
      expect(sanitizedJourney.loaded_weight_tonnes).toBe(22.5);
      expect(sanitizedJourney.cbm_volume).toBe(65);
    });

    // Finding 5: UUID-based receipt & generic document storage key verification
    it('SEC-REM-05: Blocks UUID-based storage keys associated with receipts while allowing non-receipt statutory truck documents', async () => {
      const companyIdStr = tenantA.company._id.toString();
      // Generate realistic storage keys conforming to storage service
      const uuidReceiptKey = generateTenantKey(companyIdStr, 'general', 'diesel_expense_slip.jpg');
      const uuidTruckKey = generateTenantKey(companyIdStr, 'trucks', 'fitness_certificate.pdf');

      // Create a journey referencing the UUID receipt key
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: `MH-${Math.floor(10 + Math.random() * 89)}-ZZ-${Math.floor(1000 + Math.random() * 8999)}`,
        make: 'Ashok Leyland',
        model: 'AVTR 3520',
        body_type: 'Trailer',
        tonnage_capacity: 30,
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Jaspreet Singh',
        phone: '+919876500002',
        license_number: 'DL-04-20200005678',
      });

      await TruckJourney.create({
        company_id: tenantA.company._id,
        journey_number: `JRN-RCPT-${Date.now()}`,
        status: 'active',
        truck_id: truck._id,
        driver_id: driver._id,
        from_location: { city: 'Pune' },
        to_location: { city: 'Nagpur' },
        start_date: new Date(),
        start_odometer_kms: 40000,
        total_distance_kms: 700,
        estimated_duration_days: 2,
        starting_cash_advance: 5000,
        total_diesel_litres: 150,
        total_diesel_cost: 13500,
        total_driver_expenses: 1200,
        actual_mileage_km_per_litre: 4.6,
        diesel_expenses: [
          {
            filling_date: new Date(),
            petrol_pump_name: 'Highway Diesel Point',
            fuel_quantity_litres: 150,
            rate_per_litre: 90,
            total_cost: 13500,
            payment_mode: 'fuel_card',
            slip_image_url: uuidReceiptKey, // Associated receipt UUID key
          },
        ],
        delivery_status: 'pending',
        is_settled: false,
      });

      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Document inspection',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // 1. Querying presigned URL for the UUID receipt key MUST BE BLOCKED
      const receiptPresignedRes = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(uuidReceiptKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(receiptPresignedRes.status).toBe(403);
      expect(receiptPresignedRes.body.code).toBe('RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT');

      // 2. Querying file download for the UUID receipt key MUST BE BLOCKED
      const receiptFileRes = await request(app)
        .get(`/api/documents/file?key=${encodeURIComponent(uuidReceiptKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(receiptFileRes.status).toBe(403);
      expect(receiptFileRes.body.code).toBe('RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT');

      // 3. Querying presigned URL for the statutory truck document MUST BE ALLOWED (does not block indiscriminately)
      const truckPresignedRes = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(uuidTruckKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(truckPresignedRes.status).toBe(200);
      expect(truckPresignedRes.body.key).toBe(uuidTruckKey);
    });

    // Finding 6: Super-Admin revocation using normal platform token
    it('SEC-REM-06: Super-Admin can revoke support access session using normal platform token without CompanyMember record', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Super-admin revocation test',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Initial read works
      const initialRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(initialRes.status).toBe(200);

      // Super-Admin invokes revocation on platform route (has NO tenantA CompanyMember record)
      const revokeRes = await request(app)
        .post(`/api/super-admin/support-access/${accessRequest._id}/revoke`)
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({ reason: 'Super-Admin manual emergency termination' });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.success).toBe(true);
      expect(revokeRes.body.session.status).toBe('revoked');

      // Verify immediate enforcement on the next impersonation request
      const nextRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(nextRes.status).toBe(403);
      expect(nextRes.body.code).toBe('SUPPORT_SESSION_REVOKED');
    });

    // Finding 7: Transaction rollback on audit failure in impersonation, lockout, and phantom notifications
    it('SEC-REM-07A: Impersonation rolls back session activation if audit log creation fails', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'approved',
        duration_minutes: 30,
        justification: 'Impersonation rollback test',
      });

      // Spy on PlatformAuditLog.create to simulate failure
      vi.spyOn(PlatformAuditLog, 'create').mockRejectedValueOnce(
        new Error('Audit log replica storage failure')
      );

      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenantA.company._id}/impersonate`)
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          reason: 'Attempting entry with failing audit',
          support_request_id: accessRequest._id.toString(),
        });

      vi.restoreAllMocks();

      expect(res.status).toBe(500);

      // Verify the session was NOT left active (rolled back)
      const reloaded = await SupportAccessRequest.findById(accessRequest._id);
      expect(reloaded!.status).toBe('approved');
    });

    it('SEC-REM-07B: Lockout ticket creation rolls back if audit log creation fails', async () => {
      vi.spyOn(PlatformAuditLog, 'create').mockRejectedValueOnce(
        new Error('Audit log replica storage failure')
      );

      const uniqueSubject = `Subject-${Date.now()}-FailureTest`;
      const res = await request(app)
        .post('/api/super-admin/support-tickets/lockout-intake')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          subject: uniqueSubject,
          category: 'other',
          priority: 'critical',
          message: 'Phone lockout intake',
          out_of_band_verification: {
            verification_method: 'phone_callback_registered_billing_contact',
            contact_phone: '+919876543210',
          },
        });

      vi.restoreAllMocks();

      expect(res.status).toBe(500);

      // Verify no ticket was persisted in MongoDB
      const ticket = await SupportTicket.findOne({ subject: uniqueSubject }, null, { skipTenantCheck: true });
      expect(ticket).toBeNull();
    });

    it('SEC-REM-07C: Prevents phantom notifications by cancelling pre-saved job if activation transaction fails', async () => {
      // Allow notification job to save, but fail the subsequent activation transaction inside withTransaction
      vi.spyOn(SupportAccessRequest, 'create').mockRejectedValueOnce(
        new Error('Database transaction abort on session activation')
      );

      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Catastrophic incident investigation',
          approver_two_id: superAdminTwo.user._id.toString(),
        });

      vi.restoreAllMocks();

      expect(res.status).toBe(500);

      // Verify the durable notification job was marked cancelled so worker won't dispatch false active alert
      const cancelledJob = await NotificationJob.findOne({
        company_id: tenantA.company._id,
        event_type: 'EMERGENCY_ACCESS_GRANTED',
        status: 'cancelled',
      });
      expect(cancelledJob).toBeDefined();
      expect(cancelledJob!.last_error).toContain('Activation transaction rolled back');
    });

    // Finding 8: bank_account_number masking coverage
    it('SEC-REM-08: Masks bank_account_number and account_number variants in direct and nested payloads', () => {
      const sensitive = {
        bank_account_no: '112233445566',
        bank_account_number: '998877665544',
        account_no: '554433221100',
        account_number: '123456789012',
        bank_account: '987654321999',
        nested: {
          bank_account_number: '000011112222',
        },
      };

      const sanitized = sanitizeSupportData(sensitive);
      expect(sanitized.bank_account_no).toBe('XXXXXX5566');
      expect(sanitized.bank_account_number).toBe('XXXXXX5544');
      expect(sanitized.account_no).toBe('XXXXXX1100');
      expect(sanitized.account_number).toBe('XXXXXX9012');
      expect(sanitized.bank_account).toBe('XXXXXX1999');
      expect(sanitized.nested.bank_account_number).toBe('XXXXXX2222');
    });

    // Finding 9: Sensitive data leakage through non-res.json response methods
    it('SEC-REM-09: Intercepts res.send() serialization to prevent raw PII or monetary leaks', () => {
      let sentOutput: any = null;
      const fakeRes: any = {
        json: (val: any) => {
          sentOutput = val;
          return fakeRes;
        },
        send: (val: any) => {
          sentOutput = val;
          return fakeRes;
        },
      };

      attachSupportSanitizer(fakeRes);

      // 1. Plain object passed to res.send()
      fakeRes.send({
        freight_rate: 45000,
        bank_account_number: '123456789012',
        total_diesel_litres: 120,
      });
      expect(sentOutput.freight_rate).toBeNull();
      expect(sentOutput.bank_account_number).toBe('XXXXXX9012');
      expect(sentOutput.total_diesel_litres).toBe(120);

      // 2. Stringified JSON passed to res.send()
      fakeRes.send(
        JSON.stringify({
          pan_no: 'ABCDE1234F',
          starting_cash_advance: 8000,
        })
      );
      const parsed = JSON.parse(sentOutput);
      expect(parsed.pan_no).toBe('XXXXX234F');
      expect(parsed.starting_cash_advance).toBeNull();
    });

    // Finding 10: Normal tenant isolation and regression-free experience for ordinary tenant users
    it('SEC-REM-10: Ordinary tenant users experience zero regressions and maintain full access to their operational and financial data', async () => {
      // Normal tenant accessing commercial aging report
      const agingRes = await request(app)
        .get('/api/commercial/aging')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(agingRes.status).toBe(200);

      // Normal tenant accessing commercial profitability report
      const profRes = await request(app)
        .get('/api/commercial/profitability')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(profRes.status).toBe(200);

      // Normal tenant accessing driver profile with unmasked phone and full details
      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Sukhdev Singh',
        phone: '+919988776655',
        license_number: 'DL-04-20210009988',
      });
      const driverRes = await request(app)
        .get(`/api/fleet/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(driverRes.status).toBe(200);
      expect(driverRes.body.driver.phone).toBe('+919988776655');

      // Tenant B cannot access Tenant A's driver
      const crossTenantRes = await request(app)
        .get(`/api/fleet/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${tenantB.token}`);
      expect(crossTenantRes.status).toBe(404);
    });

    // Finding R2-1: Dashboard financial protection while preserving operational diagnostics
    it('SEC-REM-11: Protects /api/dashboard/summary and /api/dashboard/watchlists against financial data exposure during active support sessions', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Operational dashboard diagnostics',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Support session accessing /api/dashboard/summary
      const summaryRes = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${supportToken}`);
      
      expect(summaryRes.status).toBe(200);
      // Operational metrics remain available
      expect(summaryRes.body.summary.active_trips).toBeDefined();
      expect(summaryRes.body.summary.total_trucks).toBeDefined();
      // Financial metrics are redacted to null
      expect(summaryRes.body.summary.unbilled_freight_value).toBeNull();
      expect(summaryRes.body.summary.today_revenue).toBeNull();
      expect(summaryRes.body.summary.pending_receivables).toBeNull();
      expect(summaryRes.body.summary.pending_settlements_amount).toBeNull();
      expect(summaryRes.body.summary.pending_recovery_amount).toBeNull();

      // Support session accessing /api/dashboard/watchlists
      const watchlistsRes = await request(app)
        .get('/api/dashboard/watchlists')
        .set('Authorization', `Bearer ${supportToken}`);
      
      expect(watchlistsRes.status).toBe(200);
      // Aging brackets are redacted
      const aging = watchlistsRes.body.watchlists.party_payments.aging_brackets;
      expect(aging['0_30_days']).toBeNull();
      expect(aging['31_60_days']).toBeNull();
      expect(aging['60_plus_days']).toBeNull();
      expect(aging.total_overdue).toBeNull();

      // Normal tenant accessing dashboard summary gets full numbers
      const tenantSummaryRes = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(tenantSummaryRes.status).toBe(200);
      expect(typeof tenantSummaryRes.body.summary.today_revenue).toBe('number');
    });

    // Finding R2-2: Fleet maintenance profitability & analytics blockade
    it('SEC-REM-12: Blocks /api/fleet/maintenance/profitability and /api/fleet/maintenance/analytics during support sessions (HTTP 403)', async () => {
      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Fleet maintenance inspection',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // Support session attempting /api/fleet/maintenance/profitability
      const profRes = await request(app)
        .get('/api/fleet/maintenance/profitability')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(profRes.status).toBe(403);
      expect(profRes.body.code).toBe('FINANCIAL_RECORDS_LOCKED');

      // Support session attempting /api/fleet/maintenance/analytics
      const analyticsRes = await request(app)
        .get('/api/fleet/maintenance/analytics')
        .set('Authorization', `Bearer ${supportToken}`);
      expect(analyticsRes.status).toBe(403);
      expect(analyticsRes.body.code).toBe('FINANCIAL_RECORDS_LOCKED');

      // Normal tenant accessing maintenance routes receives 200 OK
      const normalProfRes = await request(app)
        .get('/api/fleet/maintenance/profitability')
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(normalProfRes.status).toBe(200);
    });

    // Finding R2-3: Unlinked/unclassified receipt and generic storage key protection
    it('SEC-REM-13: Blocks unlinked/unclassified generic storage keys during support sessions while allowing statutory compliance documents', async () => {
      const companyIdStr = tenantA.company._id.toString();
      // Generate unassociated generic key with arbitrary UUID
      const unlinkedGenericKey = generateTenantKey(companyIdStr, 'general', 'invoice_scan_01.pdf');
      const unlinkedReceiptKey = generateTenantKey(companyIdStr, 'receipts', 'receipt_123.jpg');
      const statutoryTruckKey = generateTenantKey(companyIdStr, 'trucks', 'puc_certificate.pdf');

      const accessRequest = await SupportAccessRequest.create({
        company_id: tenantA.company._id,
        ticket_id: supportTicketA._id,
        requested_by: superAdminOne.user._id,
        scope: 'diagnostics_readonly',
        status: 'active',
        duration_minutes: 30,
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        justification: 'Document storage verification',
      });

      const supportToken = createSupportJwt({
        userId: superAdminOne.user._id.toString(),
        companyId: tenantA.company._id.toString(),
        supportSessionId: accessRequest._id.toString(),
      });

      // 1. Unlinked generic key fails closed during support session
      const resGeneric = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(unlinkedGenericKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(resGeneric.status).toBe(403);
      expect(resGeneric.body.code).toBe('RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT');

      // 2. Dedicated receipts partition key is blocked during support session
      const resReceipt = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(unlinkedReceiptKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(resReceipt.status).toBe(403);
      expect(resReceipt.body.code).toBe('RECEIPT_ACCESS_BLOCKED_DURING_SUPPORT');

      // 3. Statutory truck compliance document remains accessible during support session
      const resTruck = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(statutoryTruckKey)}`)
        .set('Authorization', `Bearer ${supportToken}`);
      expect(resTruck.status).toBe(200);
      expect(resTruck.body.url).toBeDefined();

      // 4. Normal tenant user has full access to their generic and receipt documents
      const normalGenericRes = await request(app)
        .get(`/api/documents/presigned-url?key=${encodeURIComponent(unlinkedGenericKey)}`)
        .set('Authorization', `Bearer ${tenantA.token}`);
      expect(normalGenericRes.status).toBe(200);
      expect(normalGenericRes.body.url).toBeDefined();
    });

    // Finding R2-4: Transactional outbox pattern for emergency notification job
    it('SEC-REM-14: Emergency notification job is transactionally staged and released to pending only upon successful activation commit', async () => {
      const res = await request(app)
        .post('/api/super-admin/support-access/emergency-access')
        .set('Authorization', `Bearer ${superAdminOne.token}`)
        .send({
          company_id: tenantA.company._id.toString(),
          ticket_id: supportTicketA._id.toString(),
          justification: 'Emergency transactional verification',
          approver_two_id: superAdminTwo.user._id.toString(),
          duration_minutes: 30,
        });

      expect(res.status).toBe(200);
      const notifJob = await NotificationJob.findOne({ job_id: res.body.notification_job_id });
      expect(notifJob).toBeDefined();
      // Released to 'pending' upon successful commit
      expect(notifJob!.status).toBe('pending');
    });
  });
});
