import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { Branch } from '../../models/Branch.js';
import { Company } from '../../models/Company.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { Invoice } from '../../models/Invoice.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { BillingParty } from '../../models/BillingParty.js';
import { createTestTenant } from '../helpers.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase G2: Branch Controller Hardening & Concurrency-Safe Sequence Generation (FF-ISSUE-051, FF-ISSUE-053, DEC-010)', () => {
  let tenantAdminA: any;
  let tenantViewerA: any;
  let tenantAdminB: any;
  let customerA: any;
  let truckA: any;
  let driverA: any;

  function makeEntryPayload(overrides: Record<string, any> = {}) {
    return {
      billing_party_id: customerA._id.toString(),
      vehicle_number: truckA.truck_no,
      driver_name: driverA.name,
      from_location: 'Mumbai',
      to_location: 'Pune',
      goods_description: 'Industrial Parts',
      package_count: 50,
      packaging_type: 'Pallets',
      actual_weight_tonnes: 12,
      chargeable_weight_tonnes: 12,
      freight_amount: 25000,
      consignor: { name: 'Tata Steel Ltd', phone: '+919876543210' },
      consignee: { name: 'Bharat Forge Ltd', phone: '+919876543211' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    tenantAdminA = await createTestTenant({ name: 'Alpha Logistics Admin', role: 'admin' });
    tenantViewerA = await createTestTenant({ name: 'Alpha Logistics Viewer', role: 'viewer' });
    tenantAdminB = await createTestTenant({ name: 'Beta Freight Admin', role: 'admin' });

    // Ensure customer, truck, and driver belong to tenantAdminA
    await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
      customerA = await BillingParty.create({
        company_id: tenantAdminA.company._id,
        name: 'Reliance Industries Ltd',
        gstin: '27AAACR1234A1Z5',
        credit_limit: 5000000,
        enforce_credit_limit: false,
        outstanding_receivables: 0,
        status: 'active',
      });

      truckA = await Truck.create({
        company_id: tenantAdminA.company._id,
        truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
        make: 'Tata Motors',
        model: 'Prima 4028',
        body_type: 'Container',
        tonnage_capacity: 25,
        status: 'available',
      });

      driverA = await Driver.create({
        company_id: tenantAdminA.company._id,
        name: 'Ramesh Kumar',
        phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        license_number: `MH${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: 'active',
      });
    });
  });

  describe('1. Branch CRUD Authorization & Role Gating', () => {
    it('allows company admin to create a branch with normalized uppercase code and initialized counters', async () => {
      const res = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_name: 'Pune Distribution Center',
          branch_code: 'pun-dc',
          state: 'Maharashtra',
          state_code: '27',
          address: 'Wakad Express Highway',
          city: 'Pune',
          lr_prefix: 'PUN-LR-',
          invoice_prefix: 'INV-PUN-',
        });

      expect(res.status).toBe(201);
      expect(res.body.branch).toBeDefined();
      expect(res.body.branch.branch_code).toBe('PUN-DC');
      expect(res.body.branch.counters).toBeDefined();
      expect(res.body.branch.counters.lr_seq).toBe(0);
      expect(res.body.branch.counters.invoice_seq).toBe(0);
      expect(res.body.branch.is_active).toBe(true);
    });

    it('rejects non-admin roles (viewer) from creating a branch with 403', async () => {
      const res = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantViewerA.token}`)
        .send({
          branch_name: 'Unauthorized Hub',
          branch_code: 'UNAUTH',
          state: 'Maharashtra',
          state_code: '27',
        });

      expect(res.status).toBe(403);
    });

    it('rejects duplicate branch_code within the same tenant with 409', async () => {
      await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_name: 'Thane Yard 1',
          branch_code: 'THN',
          state: 'Maharashtra',
          state_code: '27',
        });

      const duplicateRes = await request(app)
        .post('/api/company/branches')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_name: 'Thane Yard 2',
          branch_code: 'thn',
          state: 'Maharashtra',
          state_code: '27',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toMatch(/already exists/i);
    });
  });

  describe('2. Tenant Isolation & Cross-Tenant Access Prevention', () => {
    let branchB: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminB.company._id.toString() }, async () => {
        branchB = await Branch.create({
          company_id: tenantAdminB.company._id,
          branch_name: 'Beta Delhi Depot',
          branch_code: 'DEL-DEP',
          lr_prefix: 'DEL-LR-',
          invoice_prefix: 'INV-DEL-',
          is_active: true,
        });
      });
    });

    it('prevents Tenant A from updating Tenant B branch (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/company/branches/${branchB._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({ branch_name: 'Malicious Rename' });

      expect(res.status).toBe(404);
    });

    it('prevents Tenant A from deleting Tenant B branch (returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/company/branches/${branchB._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(404);
    });

    it('rejects cross-tenant branch_id when creating LR (returns 404)', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            branch_id: branchB._id.toString(),
            from_location: 'Mumbai',
            to_location: 'Delhi',
            freight_amount: 35000,
          })
        );

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/regional branch not found in your workspace/i);
    });

    it('rejects cross-tenant branch_id when creating invoice (returns 404)', async () => {
      const res = await request(app)
        .post('/api/commercial/invoices')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_id: branchB._id.toString(),
          billing_party_id: customerA._id.toString(),
          tax_type: 'rcm',
          is_rcm: true,
          items: [
            {
              lr_no: 'LR-001',
              from_location: 'Mumbai',
              to_location: 'Delhi',
              amount: 25000,
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/regional branch not found in your workspace/i);
    });
  });

  describe('3. Head Office Protection & Branch Status Invariants', () => {
    let headOfficeBranch: any;
    let regionalBranch: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        headOfficeBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Mumbai HQ',
          branch_code: 'HQ-MUM',
          is_head_office: true,
          is_active: true,
        });

        regionalBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Nagpur Outpost',
          branch_code: 'NGP',
          is_head_office: false,
          is_active: true,
        });
      });
    });

    it('blocks deletion of the Head Office branch with 400', async () => {
      const res = await request(app)
        .delete(`/api/company/branches/${headOfficeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete the head office branch/i);
    });

    it('blocks deactivation of the Head Office branch with 400', async () => {
      const res = await request(app)
        .put(`/api/company/branches/${headOfficeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({ is_active: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot deactivate the head office branch/i);
    });

    it('blocks directly unsetting head office flag without designating a new head office', async () => {
      const res = await request(app)
        .put(`/api/company/branches/${headOfficeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({ is_head_office: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot remove head office status/i);
    });

    it('automatically demotes previous head office when another branch is promoted', async () => {
      const res = await request(app)
        .put(`/api/company/branches/${regionalBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({ is_head_office: true });

      expect(res.status).toBe(200);
      expect(res.body.branch.is_head_office).toBe(true);

      const refreshedHQ = await Branch.findOne({
        _id: headOfficeBranch._id,
        company_id: tenantAdminA.company._id,
      });
      expect(refreshedHQ?.is_head_office).toBe(false);
    });
  });

  describe('4. Referential Integrity: Protection Against Deleting Referenced Branches', () => {
    let activeBranch: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        activeBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Panvel Hub',
          branch_code: 'PNV',
          is_head_office: false,
          is_active: true,
        });
      });
    });

    it('blocks deletion with HTTP 409 CANNOT_DELETE_BRANCH_WITH_RECORDS when referenced by a TruckJourney', async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: activeBranch._id,
          journey_number: 'TRIP-G2-001',
          truck_id: truckA._id,
          driver_id: driverA._id,
          start_date: new Date(),
          from_location: { city: 'Panvel' },
          to_location: { city: 'Pune' },
          start_odometer_kms: 10000,
          status: 'active',
        });
      });

      const res = await request(app)
        .delete(`/api/company/branches/${activeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_DELETE_BRANCH_WITH_RECORDS');
      expect(res.body.details?.journeyCount).toBeGreaterThan(0);
    });

    it('blocks deletion with HTTP 409 CANNOT_DELETE_BRANCH_WITH_RECORDS when referenced by an Entry (LR)', async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        await Entry.create({
          company_id: tenantAdminA.company._id,
          branch_id: activeBranch._id,
          bill_no: 'BILL-G2-001',
          lr_no: 'PNV-LR-9999',
          consignor: { name: 'Shipper Co', phone: '+919876543210' },
          consignee: { name: 'Receiver Co', phone: '+919876543211' },
          vehicle_number: truckA.truck_no,
          driver_name: driverA.name,
          from_location: 'Panvel',
          to_location: 'Nashik',
          freight_amount: 15000,
          status: 'active',
        });
      });

      const res = await request(app)
        .delete(`/api/company/branches/${activeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_DELETE_BRANCH_WITH_RECORDS');
      expect(res.body.details?.entryCount).toBeGreaterThan(0);
    });

    it('blocks deletion with HTTP 409 CANNOT_DELETE_BRANCH_WITH_RECORDS when referenced by an Invoice', async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        await Invoice.create({
          company_id: tenantAdminA.company._id,
          branch_id: activeBranch._id,
          billing_party_id: customerA._id,
          billing_party_snapshot: {
            name: 'Reliance Industries Ltd',
            gstin: '27AAACR1234A1Z5',
          },
          place_of_supply: 'Maharashtra',
          invoice_number: 'INV-PNV-9999',
          invoice_date: new Date(),
          due_date: new Date(Date.now() + 15 * 86400000),
          subtotal: 20000,
          total_tax: 0,
          total_amount: 20000,
          balance_amount: 20000,
          status: 'issued',
        });
      });

      const res = await request(app)
        .delete(`/api/company/branches/${activeBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_DELETE_BRANCH_WITH_RECORDS');
      expect(res.body.details?.invoiceCount).toBeGreaterThan(0);
    });

    it('allows successful deletion with HTTP 200 when branch is completely unreferenced', async () => {
      let unreferencedBranch: any;
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        unreferencedBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Unused Branch',
          branch_code: 'UNUSED',
          is_head_office: false,
          is_active: true,
        });
      });

      const res = await request(app)
        .delete(`/api/company/branches/${unreferencedBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await Branch.findOne(
        { _id: unreferencedBranch._id },
        null,
        { skipTenantCheck: true }
      );
      expect(check).toBeNull();
    });
  });

  describe('5. Inactive Branch Operational Rejection', () => {
    let inactiveBranch: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        inactiveBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Closed Ahmedabad Depot',
          branch_code: 'AMD-CL',
          lr_prefix: 'AMD-LR-',
          invoice_prefix: 'INV-AMD-',
          is_active: false,
        });
      });
    });

    it('rejects LR creation referencing an inactive branch with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            branch_id: inactiveBranch._id.toString(),
            from_location: 'Ahmedabad',
            to_location: 'Mumbai',
            freight_amount: 18000,
          })
        );

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot issue lorry receipt for an inactive regional branch/i);
    });

    it('rejects invoice creation referencing an inactive branch with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/commercial/invoices')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_id: inactiveBranch._id.toString(),
          billing_party_id: customerA._id.toString(),
          tax_type: 'rcm',
          is_rcm: true,
          items: [
            {
              lr_no: 'AMD-01',
              from_location: 'Ahmedabad',
              to_location: 'Mumbai',
              amount: 18000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot issue invoice for an inactive regional branch/i);
    });
  });

  describe('6. Sequence Number Allocation & Company Fallback', () => {
    let branchMUM: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        branchMUM = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Mumbai Central Branch',
          branch_code: 'MUM',
          lr_prefix: 'MUM-LR-',
          invoice_prefix: 'INV-MUM-',
          is_active: true,
        });
      });
    });

    it('allocates sequential LR numbers using branch prefix and increments branch counter', async () => {
      const res1 = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            branch_id: branchMUM._id.toString(),
            from_location: 'Mumbai',
            to_location: 'Pune',
            freight_amount: 12000,
          })
        );

      expect(res1.status).toBe(201);
      expect(res1.body.entry.lr_no).toBe('MUM-LR-0001');
      expect(res1.body.entry.branch_id).toBe(branchMUM._id.toString());

      const res2 = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            branch_id: branchMUM._id.toString(),
            from_location: 'Mumbai',
            to_location: 'Nashik',
            freight_amount: 14000,
          })
        );

      expect(res2.status).toBe(201);
      expect(res2.body.entry.lr_no).toBe('MUM-LR-0002');

      const updatedBranch = await Branch.findOne({
        _id: branchMUM._id,
        company_id: tenantAdminA.company._id,
      });
      expect(updatedBranch?.counters?.lr_seq).toBe(2);
    });

    it('falls back to company-level counter and prefix for unbranched LR creation', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            from_location: 'Global Hub',
            to_location: 'Surat',
            freight_amount: 16000,
          })
        );

      expect(res.status).toBe(201);
      expect(res.body.entry.lr_no).toBe('LR-0001');

      const updatedCompany = await Company.findById(tenantAdminA.company._id, null, { skipTenantCheck: true });
      expect(updatedCompany?.counters?.lr_seq).toBe(1);
    });

    it('allocates sequential Invoice numbers using branch prefix and increments branch counter', async () => {
      const res1 = await request(app)
        .post('/api/commercial/invoices')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_id: branchMUM._id.toString(),
          billing_party_id: customerA._id.toString(),
          tax_type: 'rcm',
          is_rcm: true,
          items: [
            {
              lr_no: 'MUM-LR-0001',
              from_location: 'Mumbai',
              to_location: 'Pune',
              amount: 12000,
            },
          ],
        });

      expect(res1.status).toBe(201);
      expect(res1.body.invoice.invoice_number).toBe('INV-MUM-0001');
      expect(res1.body.invoice.branch_id).toBe(branchMUM._id.toString());

      const res2 = await request(app)
        .post('/api/commercial/invoices')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          branch_id: branchMUM._id.toString(),
          billing_party_id: customerA._id.toString(),
          tax_type: 'rcm',
          is_rcm: true,
          items: [
            {
              lr_no: 'MUM-LR-0002',
              from_location: 'Mumbai',
              to_location: 'Nashik',
              amount: 14000,
            },
          ],
        });

      expect(res2.status).toBe(201);
      expect(res2.body.invoice.invoice_number).toBe('INV-MUM-0002');

      const updatedBranch = await Branch.findOne({
        _id: branchMUM._id,
        company_id: tenantAdminA.company._id,
      });
      expect(updatedBranch?.counters?.invoice_seq).toBe(2);
    });

    it('falls back to company-level counter and prefix for unbranched Invoice creation', async () => {
      const res = await request(app)
        .post('/api/commercial/invoices')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send({
          billing_party_id: customerA._id.toString(),
          tax_type: 'rcm',
          is_rcm: true,
          items: [
            {
              lr_no: 'LR-0001',
              from_location: 'Global Hub',
              to_location: 'Surat',
              amount: 16000,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.invoice.invoice_number).toBe('INV-0001');

      const updatedCompany = await Company.findById(tenantAdminA.company._id, null, { skipTenantCheck: true });
      expect(updatedCompany?.counters?.invoice_seq).toBe(1);
    });
  });

  describe('7. Concurrency-Safe Sequence Generation Under Race Conditions', () => {
    let raceBranch: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        raceBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Surat Fast Track',
          branch_code: 'SRT',
          lr_prefix: 'SRT-LR-',
          invoice_prefix: 'INV-SRT-',
          is_active: true,
        });
      });
    });

    it('guarantees unique, strictly monotonic LR sequence numbers across concurrent requests', async () => {
      const concurrentCount = 5;
      const requests = Array.from({ length: concurrentCount }, (_, i) =>
        request(app)
          .post('/api/commercial/entries')
          .set('Authorization', `Bearer ${tenantAdminA.token}`)
          .send(
            makeEntryPayload({
              branch_id: raceBranch._id.toString(),
              from_location: 'Surat',
              to_location: `Location-${i}`,
              freight_amount: 10000 + i * 1000,
            })
          )
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const generatedLrNos = responses.map((r) => r.body.entry.lr_no);
      const uniqueLrNos = new Set(generatedLrNos);

      // Verify zero duplicates
      expect(uniqueLrNos.size).toBe(concurrentCount);

      // Verify all prefixes match branch configured prefix
      for (const lrNo of generatedLrNos) {
        expect(lrNo.startsWith('SRT-LR-')).toBe(true);
      }

      // Verify final counter value
      const updatedBranch = await Branch.findOne({
        _id: raceBranch._id,
        company_id: tenantAdminA.company._id,
      });
      expect(updatedBranch?.counters?.lr_seq).toBe(concurrentCount);
    });

    it('guarantees unique, strictly monotonic Invoice sequence numbers across concurrent requests', async () => {
      const concurrentCount = 5;
      const requests = Array.from({ length: concurrentCount }, (_, i) =>
        request(app)
          .post('/api/commercial/invoices')
          .set('Authorization', `Bearer ${tenantAdminA.token}`)
          .send({
            branch_id: raceBranch._id.toString(),
            billing_party_id: customerA._id.toString(),
            tax_type: 'rcm',
            is_rcm: true,
            items: [
              {
                lr_no: `SRT-LR-000${i + 1}`,
                from_location: 'Surat',
                to_location: `Location-${i}`,
                amount: 15000 + i * 500,
              },
            ],
          })
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const generatedInvNos = responses.map((r) => r.body.invoice.invoice_number);
      const uniqueInvNos = new Set(generatedInvNos);

      // Verify zero duplicates
      expect(uniqueInvNos.size).toBe(concurrentCount);

      // Verify all prefixes match branch configured prefix
      for (const invNo of generatedInvNos) {
        expect(invNo.startsWith('INV-SRT-')).toBe(true);
      }

      // Verify final counter value
      const updatedBranch = await Branch.findOne({
        _id: raceBranch._id,
        company_id: tenantAdminA.company._id,
      });
      expect(updatedBranch?.counters?.invoice_seq).toBe(concurrentCount);
    });
  });
});
