/**
 * ============================================================================
 * FF-ISSUE-042 — BALANCE PARTY OPENING BALANCE SYNCHRONIZATION INTEGRATION TESTS
 * ============================================================================
 * Tests:
 * 1. Synchronous adjustment: Editing opening_balance shifts current_balance by exact delta.
 * 2. Immutable audit logging: AuditLog entry created with old/new opening and current balances.
 * 3. Role-based authorization: Only admin/accountant can modify opening balance.
 * 4. Tenant isolation: Tenant B cannot modify BalanceParty of Tenant A.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { AuditLog } from '../../models/AuditLog.js';
import { User } from '../../models/User.js';
import { CompanyMember } from '../../models/CompanyMember.js';
import jwt from 'jsonwebtoken';

describe('FF-ISSUE-042: Balance Party Opening Balance Synchronization', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;
  let dispatcherToken: string;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Freight' });

    // Create a dispatcher user in Tenant A (non-admin, non-accountant)
    const dispatcherUser = await User.create({
      name: 'Dispatcher Joe',
      email: `dispatcher-${Date.now()}-${Math.random()}@alpha.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      is_verified: true,
      token_version: 0,
    });
    await CompanyMember.create({
      company_id: tenantA.company._id,
      user_id: dispatcherUser._id,
      email: dispatcherUser.email,
      role: 'dispatcher',
      status: 'active',
    });
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
    dispatcherToken = jwt.sign(
      {
        userId: dispatcherUser._id.toString(),
        companyId: tenantA.company._id.toString(),
        token_version: 0,
      },
      secret,
      { expiresIn: '1d' }
    );
  });

  it('adjusts current_balance by exact delta when opening_balance increases', async () => {
    // 1. Create a balance party with opening balance = 5000, current = 5000
    const party = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Surat Diesel Depot',
      party_type: 'petrol_pump',
      phone: '+919876543210',
      opening_balance: 5000,
      current_balance: 5000,
      status: 'active',
    });

    // 2. Update opening_balance from 5000 to 12000 (delta = +7000)
    const res = await request(app)
      .put(`/api/parties/balance/${party._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        opening_balance: 12000,
      });

    expect(res.status).toBe(200);
    expect(res.body.party.opening_balance).toBe(12000);
    expect(res.body.party.current_balance).toBe(12000); // 5000 + 7000 = 12000

    // Verify DB state
    const updated = await BalanceParty.findById(party._id, null, { skipTenantCheck: true });
    expect(updated?.opening_balance).toBe(12000);
    expect(updated?.current_balance).toBe(12000);

    // Verify Audit Log
    const auditLogs = await AuditLog.find(
      {
        company_id: tenantA.company._id,
        entity_id: party._id,
        action: 'UPDATE',
      },
      null,
      { skipTenantCheck: true }
    );
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const log = auditLogs[0];
    expect(log.before_snapshot?.opening_balance).toBe(5000);
    expect(log.after_snapshot?.opening_balance).toBe(12000);
    expect(log.after_snapshot?.current_balance).toBe(12000);
  });

  it('adjusts current_balance by exact negative delta when opening_balance decreases with existing transactions', async () => {
    // 1. Party with initial opening 10,000 and accumulated balance 15,000 (due to en-route diesel slips)
    const party = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Vapi Fuel Station',
      party_type: 'petrol_pump',
      phone: '+919876543211',
      opening_balance: 10000,
      current_balance: 15000,
      status: 'active',
    });

    // 2. Correct opening balance from 10,000 down to 8,000 (delta = -2000)
    const res = await request(app)
      .put(`/api/parties/balance/${party._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        opening_balance: 8000,
      });

    expect(res.status).toBe(200);
    expect(res.body.party.opening_balance).toBe(8000);
    expect(res.body.party.current_balance).toBe(13000); // 15000 - 2000 = 13000

    const updated = await BalanceParty.findById(party._id, null, { skipTenantCheck: true });
    expect(updated?.current_balance).toBe(13000);
  });

  it('rejects opening balance modification by non-admin / non-accountant (403)', async () => {
    const party = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Ahmedabad Highway Bunker',
      party_type: 'petrol_pump',
      phone: '+919876543212',
      opening_balance: 10000,
      current_balance: 10000,
      status: 'active',
    });

    const res = await request(app)
      .put(`/api/parties/balance/${party._id}`)
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        opening_balance: 20000,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/authorized to modify party opening balances/i);

    // Ensure balance did not mutate
    const unchanged = await BalanceParty.findById(party._id, null, { skipTenantCheck: true });
    expect(unchanged?.opening_balance).toBe(10000);
    expect(unchanged?.current_balance).toBe(10000);
  });

  it('strictly enforces tenant isolation: Tenant B cannot modify Tenant A balance party', async () => {
    const party = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Private Depot A',
      party_type: 'supplier',
      phone: '+919876543213',
      opening_balance: 5000,
      current_balance: 5000,
      status: 'active',
    });

    const res = await request(app)
      .put(`/api/parties/balance/${party._id}`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({
        opening_balance: 99999,
      });

    expect(res.status).toBe(404);

    const check = await BalanceParty.findById(party._id, null, { skipTenantCheck: true });
    expect(check?.opening_balance).toBe(5000);
  });

  it('guarantees atomicity: no audit log is created when update fails validation', async () => {
    const party = await BalanceParty.create({
      company_id: tenantA.company._id,
      party_name: 'Audit Divergence Guard Depot',
      party_type: 'supplier',
      phone: '+919876543299',
      opening_balance: 5000,
      current_balance: 5000,
      status: 'active',
    });

    const initialAuditCount = await AuditLog.countDocuments({
      company_id: tenantA.company._id,
      entity_id: party._id,
    });

    // Send an update with an invalid PAN number (causing validation failure)
    const res = await request(app)
      .put(`/api/parties/balance/${party._id}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        opening_balance: 15000,
        pan_number: 'INVALID_PAN_123',
      });

    expect(res.status).toBe(400);

    // Verify balance was NOT mutated
    const unmutated = await BalanceParty.findById(party._id, null, { skipTenantCheck: true });
    expect(unmutated?.opening_balance).toBe(5000);
    expect(unmutated?.current_balance).toBe(5000);

    // Verify audit log was NOT created (no divergence)
    const postAuditCount = await AuditLog.countDocuments({
      company_id: tenantA.company._id,
      entity_id: party._id,
    });
    expect(postAuditCount).toBe(initialAuditCount);
  });
});
