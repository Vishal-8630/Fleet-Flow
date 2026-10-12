import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Branch } from '../../models/Branch.js';

describe('ISS-001: Express Route Tenant Context Enforcement', () => {
  let tenantAdmin: any;
  let tenantViewer: any;

  beforeEach(async () => {
    tenantAdmin = await createTestTenant({ name: 'Alpha Logistics', role: 'admin' });
    tenantViewer = await createTestTenant({ name: 'Alpha Viewer', role: 'viewer' });
  });

  describe('1. Branch Routes (/api/company/branches)', () => {
    it('returns 200 with tenant-scoped branches for authenticated tenant admin', async () => {
      // Seed a branch for tenantAdmin
      await Branch.create({
        company_id: tenantAdmin.company._id,
        branch_name: 'Alpha Mumbai Hub',
        branch_code: 'ALPH-MUM',
        state: 'Maharashtra',
        state_code: '27',
        address: 'Plot 10, JNPT Road',
        city: 'Navi Mumbai',
        is_head_office: true,
      });

      const res = await request(app)
        .get('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.branches).toBeDefined();
      expect(res.body.branches.length).toBe(1);
      expect(res.body.branches[0].branch_code).toBe('ALPH-MUM');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/company/branches');
      expect(res.status).toBe(401);
    });

    it('allows admin to create a branch with company_id automatically scoped', async () => {
      const res = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdmin.token}`)
        .send({
          branch_name: 'Alpha Pune Branch',
          branch_code: 'ALPH-PUN',
          state: 'Maharashtra',
          state_code: '27',
          address: 'Wakad Highway',
          city: 'Pune',
        });

      expect(res.status).toBe(201);
      expect(res.body.branch.branch_code).toBe('ALPH-PUN');
      expect(res.body.branch.company_id).toBe(tenantAdmin.company._id.toString());
    });

    it('blocks non-admin users from creating branches with 403', async () => {
      const res = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantViewer.token}`)
        .send({
          branch_name: 'Unauthorized Branch',
          branch_code: 'UNAUTH',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Approval Routes (/api/approvals)', () => {
    it('returns 200 for listApprovalRules when tenant context is resolved', async () => {
      const res = await request(app)
        .get('/api/approvals/rules')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rules).toBeDefined();
    });

    it('allows admin to create an approval rule', async () => {
      const res = await request(app)
        .post('/api/approvals/rules')
        .set('Authorization', `Bearer ${tenantAdmin.token}`)
        .send({
          name: 'Driver Advance Cap',
          entity_type: 'driver_advance',
          threshold_amount_paise: 500000,
          required_approver_roles: ['admin'],
        });

      expect(res.status).toBe(201);
      expect(res.body.rule.company_id).toBe(tenantAdmin.company._id.toString());
    });

    it('returns 200 for listPendingApprovals', async () => {
      const res = await request(app)
        .get('/api/approvals/pending')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.approvals).toBeDefined();
    });
  });

  describe('3. Commercial Report Routes (/api/commercial)', () => {
    it('returns 200 for aging report under valid tenant context', async () => {
      const res = await request(app)
        .get('/api/commercial/aging')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.aging).toBeDefined();
    });

    it('returns 200 for listCreditNotes under valid tenant context', async () => {
      const res = await request(app)
        .get('/api/commercial/credit-notes')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.credit_notes).toBeDefined();
    });
  });

  describe('4. Support Routes (/api/support/tickets)', () => {
    it('returns 200 for listTickets under valid tenant context', async () => {
      const res = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.tickets).toBeDefined();
    });

    it('creates support ticket with automatic tenant scoping', async () => {
      const res = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${tenantAdmin.token}`)
        .send({
          subject: 'Fastag Sync Inquiry',
          category: 'bug',
          priority: 'medium',
          message: 'Need assistance setting up FASTag automated sync.',
        });

      expect(res.status).toBe(201);
      expect(res.body.ticket.company_id).toBe(tenantAdmin.company._id.toString());
    });
  });

  describe('5. Telematics Routes (/api/telematics)', () => {
    it('returns 200 for getFleetLiveMap under valid tenant context', async () => {
      const res = await request(app)
        .get('/api/telematics/live/fleet')
        .set('Authorization', `Bearer ${tenantAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.trucks).toBeDefined();
    });

    it('rejects unauthenticated telematics requests with 401', async () => {
      const res = await request(app).get('/api/telematics/live/fleet');
      expect(res.status).toBe(401);
    });
  });

  describe('6. Cross-Tenant Header Forgery Defense (X-Company-ID)', () => {
    it('rejects valid Tenant A token combined with Tenant B X-Company-ID header with 403 Forbidden', async () => {
      const tenantB = await createTestTenant({ name: 'Beta Transporters' });

      const res = await request(app)
        .get('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdmin.token}`)
        .set('x-company-id', tenantB.company._id.toString());

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not an active member of the requested workspace/i);
    });
  });
});
