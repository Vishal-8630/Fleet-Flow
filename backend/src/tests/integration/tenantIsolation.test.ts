import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { createTestTenant, createSuperAdmin } from '../helpers.js';
import { Branch } from '../../models/Branch.js';
import { VehicleEntry } from '../../models/VehicleEntry.js';
import { AuditLog } from '../../models/AuditLog.js';
import { tenantStorage, tenantPlugin } from '../../plugins/tenantPlugin.js';

describe('ISS-002 & TEST-002: Multi-Tenant Logical Isolation & Mutation Boundaries', () => {
  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics' });
    tenantB = await createTestTenant({ name: 'Beta Transporters' });
  });

  describe('1. Read Isolation Boundaries', () => {
    it('Tenant A cannot view branches belonging to Tenant B via HTTP', async () => {
      // Seed a branch for Tenant B
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Beta Kolkata Hub',
        branch_code: 'BETA-KOL',
        state: 'West Bengal',
        state_code: '19',
        address: 'Strand Road',
        city: 'Kolkata',
      });

      // Tenant A calls list branches
      const resA = await request(app)
        .get('/api/company/branches')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      const foundBranchB = resA.body.branches.some(
        (b: any) => b._id === branchB._id.toString() || b.branch_code === 'BETA-KOL'
      );
      expect(foundBranchB).toBe(false);
    });

    it('Mongoose find query under Tenant A context never returns Tenant B records', async () => {
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Branch A',
        branch_code: 'BR-A',
      });
      await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Branch B',
        branch_code: 'BR-B',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branches = await Branch.find();
        expect(branches.length).toBe(1);
        expect(branches[0].branch_code).toBe('BR-A');
      });
    });
  });

  describe('2. Mutation Isolation Boundaries (updateOne, updateMany)', () => {
    it('Tenant A cannot update Tenant B branch via HTTP endpoint', async () => {
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Beta Original Name',
        branch_code: 'BETA-ORIG',
      });

      const res = await request(app)
        .put(`/api/company/branches/${branchB._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({ branch_name: 'Compromised Name' });

      // Should return 404 because branchB does not exist within Tenant A scope
      expect(res.status).toBe(404);

      // Verify in DB that branchB remains completely unmodified
      const freshBranchB = await Branch.findOne({ _id: branchB._id, company_id: tenantB.company._id });
      expect(freshBranchB?.branch_name).toBe('Beta Original Name');
    });

    it('Direct Mongoose updateOne under Tenant A context cannot modify Tenant B record', async () => {
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Untouched Beta Branch',
        branch_code: 'BETA-SAFE',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const result = await Branch.updateOne(
          { _id: branchB._id },
          { $set: { branch_name: 'Tampered By Alpha' } }
        );
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
      });

      const check = await Branch.findOne({ _id: branchB._id, company_id: tenantB.company._id });
      expect(check?.branch_name).toBe('Untouched Beta Branch');
    });
  });

  describe('3. Deletion Isolation Boundaries (deleteOne, deleteMany)', () => {
    it('Tenant A cannot delete Tenant B branch via HTTP endpoint', async () => {
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Beta Permanent Hub',
        branch_code: 'BETA-PERM',
      });

      const res = await request(app)
        .delete(`/api/company/branches/${branchB._id}`)
        .set('Authorization', `Bearer ${tenantA.token}`);

      // Must not be able to delete Tenant B record
      const stillExists = await Branch.findOne({ _id: branchB._id, company_id: tenantB.company._id });
      expect(stillExists).not.toBeNull();
    });

    it('Direct Mongoose deleteOne under Tenant A context cannot delete Tenant B record', async () => {
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Beta Delete Target',
        branch_code: 'BETA-DEL',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const result = await Branch.deleteOne({ _id: branchB._id });
        expect(result.deletedCount).toBe(0);
      });

      const stillExists = await Branch.findOne({ _id: branchB._id, company_id: tenantB.company._id });
      expect(stillExists).not.toBeNull();
    });

    it('Direct Mongoose deleteMany under Tenant A context only deletes Tenant A records', async () => {
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Alpha To Delete 1',
        branch_code: 'ALPH-D1',
      });
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Alpha To Delete 2',
        branch_code: 'ALPH-D2',
      });
      const branchB = await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Beta Must Survive',
        branch_code: 'BETA-SURV',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const result = await Branch.deleteMany({});
        expect(result.deletedCount).toBe(2);
      });

      // Tenant B's branch must survive
      const checkB = await Branch.findOne({ _id: branchB._id, company_id: tenantB.company._id });
      expect(checkB).not.toBeNull();
    });
  });

  describe('4. Aggregation Pipeline Isolation', () => {
    it('Aggregation pipeline under Tenant A automatically injects company_id match', async () => {
      // Seed branches for Tenant A
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Branch A1',
        branch_code: 'AGG-A1',
      });
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Branch A2',
        branch_code: 'AGG-A2',
      });

      // Seed branch for Tenant B
      await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Branch B1',
        branch_code: 'AGG-B1',
      });

      // Run aggregation without explicit company_id under Tenant A context
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const result = await Branch.aggregate([
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ]);

        expect(result.length).toBe(1);
        expect(result[0].count).toBe(2); // Only Tenant A's 2 branches, never Tenant B's!
      });
    });

    it('preserves $geoNear at stage zero and inserts company_id match at stage one', async () => {
      const GeoSchema = new mongoose.Schema({
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], required: true },
        },
        name: String,
      });
      GeoSchema.index({ location: '2dsphere' });
      GeoSchema.plugin(tenantPlugin);

      const GeoModel = mongoose.models['GeoTestLocation'] || mongoose.model('GeoTestLocation', GeoSchema);
      await GeoModel.syncIndexes();

      // Seed locations for Tenant A and Tenant B
      await GeoModel.create({
        company_id: tenantA.company._id,
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
        name: 'Tenant A Delhi Hub',
      });
      await GeoModel.create({
        company_id: tenantB.company._id,
        location: { type: 'Point', coordinates: [77.2095, 28.6140] },
        name: 'Tenant B Delhi Hub',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const agg = GeoModel.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [77.2090, 28.6139] },
              distanceField: 'distance',
              spherical: true,
            },
          },
        ]);

        const results = await agg.exec();
        const pipeline = agg.pipeline();
        // Stage 0 must remain $geoNear
        expect(pipeline[0]).toHaveProperty('$geoNear');
        // Stage 1 must be injected company_id match
        expect(pipeline[1]).toHaveProperty('$match');
        expect((pipeline[1] as any).$match.company_id.toString()).toBe(tenantA.company._id.toString());

        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Tenant A Delhi Hub');
        expect(results[0].company_id.toString()).toBe(tenantA.company._id.toString());
      });
    });
  });

  describe('5. Safe-Fail on Missing Tenant Context & Privileged Bypass (M-02)', () => {
    it('rejects query without tenant context and without skipTenantCheck', async () => {
      await expect(Branch.find().exec()).rejects.toThrow(
        /tenant context is missing/i
      );
    });

    it('rejects mutation without tenant context and without skipTenantCheck', async () => {
      await expect(
        Branch.updateOne({ branch_code: 'TEST' }, { $set: { branch_name: 'X' } }).exec()
      ).rejects.toThrow(/tenant context is missing/i);
    });

    it('rejects aggregation without tenant context and without skipTenantCheck', async () => {
      await expect(
        Branch.aggregate([{ $group: { _id: null, count: { $sum: 1 } } }]).exec()
      ).rejects.toThrow(/tenant context is missing/i);
    });

    it('allows privileged queries when explicit { skipTenantCheck: true } is provided via query options', async () => {
      const superAdmin = await createSuperAdmin();
      expect(superAdmin.user.is_platform_super_admin).toBe(true);

      const count = await Branch.countDocuments().setOptions({ skipTenantCheck: true });
      expect(typeof count).toBe('number');
    });

    it('regression test: filter { skipTenantCheck: true } cannot bypass tenant isolation without tenant context', async () => {
      await expect(
        Branch.find({ skipTenantCheck: true } as any).exec()
      ).rejects.toThrow(/tenant context is missing/i);
    });

    it('regression test: filter { skipTenantCheck: true } passed under Tenant A does not return Tenant B records', async () => {
      await Branch.create({
        company_id: tenantA.company._id,
        branch_name: 'Branch A Filter Test',
        branch_code: 'FLT-A',
      });
      await Branch.create({
        company_id: tenantB.company._id,
        branch_name: 'Branch B Filter Test',
        branch_code: 'FLT-B',
      });

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        // Attacker attempts to inject { skipTenantCheck: true } into query filter
        const results = await Branch.find({ skipTenantCheck: true } as any).lean();
        expect(results.length).toBe(1);
        expect(results[0].branch_code).toBe('FLT-A');
        const hasTenantB = results.some((r: any) => r.branch_code === 'FLT-B');
        expect(hasTenantB).toBe(false);
      });
    });
  });

  describe('6. Bulk Insert Protection (insertMany - M-04)', () => {
    it('attaches active company_id to documents inserted via insertMany', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const docs = await Branch.insertMany([
          { branch_name: 'Bulk Branch 1', branch_code: 'BLK-1' },
          { branch_name: 'Bulk Branch 2', branch_code: 'BLK-2' },
        ]);
        expect(docs.length).toBe(2);
        expect(docs[0].company_id.toString()).toBe(tenantA.company._id.toString());
        expect(docs[1].company_id.toString()).toBe(tenantA.company._id.toString());
      });
    });

    it('allows insertMany when document company_id explicitly matches active tenant context', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const docs = await Branch.insertMany([
          {
            branch_name: 'Bulk Matching',
            branch_code: 'BLK-MATCH',
            company_id: tenantA.company._id,
          },
        ]);
        expect(docs.length).toBe(1);
        expect(docs[0].company_id.toString()).toBe(tenantA.company._id.toString());
      });
    });

    it('rejects insertMany when document company_id conflicts with active tenant context (M-04)', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await expect(
          Branch.insertMany([
            {
              branch_name: 'Bulk Mismatched',
              branch_code: 'BLK-MIS',
              company_id: tenantB.company._id, // Attempting cross-tenant insert!
            },
          ])
        ).rejects.toThrow(/does not match active tenant context/i);
      });

      // Verify nothing was inserted for Tenant B
      const checkB = await Branch.findOne({ branch_code: 'BLK-MIS' }).setOptions({ skipTenantCheck: true });
      expect(checkB).toBeNull();
    });

    it('rejects insertMany when tenant context is missing and skipTenantCheck is not provided', async () => {
      await expect(
        Branch.insertMany([
          { branch_name: 'Bulk No Context', branch_code: 'BLK-NOCONTEXT' },
        ])
      ).rejects.toThrow(/tenant context is missing/i);
    });

    it('allows privileged insertMany when explicit { skipTenantCheck: true } is provided in options', async () => {
      const docs: any = await Branch.insertMany(
        [
          {
            branch_name: 'Bulk System',
            branch_code: 'BLK-SYS',
            company_id: tenantA.company._id,
          },
        ],
        { skipTenantCheck: true } as any
      );
      expect(docs.length).toBe(1);
      expect(docs[0].branch_code).toBe('BLK-SYS');
    });
  });

  describe('7. AuditLog Tenant Isolation (H-01)', () => {
    it('Tenant A cannot retrieve Tenant B audit records via AuditLog query', async () => {
      // Seed audit records for both tenants
      await AuditLog.create({
        company_id: tenantA.company._id,
        entity_type: 'entry',
        entity_id: new mongoose.Types.ObjectId(),
        action: 'CREATE',
        actor_name: 'Tenant A Operator',
        description: 'Created consignment under Tenant A',
      });

      await AuditLog.create({
        company_id: tenantB.company._id,
        entity_type: 'entry',
        entity_id: new mongoose.Types.ObjectId(),
        action: 'CREATE',
        actor_name: 'Tenant B Operator',
        description: 'Created consignment under Tenant B',
      });

      // Tenant A queries AuditLog
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const logs = await AuditLog.find().lean();
        expect(logs.length).toBe(1);
        expect(logs[0].actor_name).toBe('Tenant A Operator');
        expect(logs[0].company_id.toString()).toBe(tenantA.company._id.toString());

        // Explicitly assert Tenant B's record is not present
        const hasTenantB = logs.some((l: any) => l.company_id.toString() === tenantB.company._id.toString());
        expect(hasTenantB).toBe(false);
      });
    });

    it('rejects cross-tenant AuditLog creation when doc company_id conflicts with active tenant', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        await expect(
          AuditLog.create({
            company_id: tenantB.company._id, // Conflict!
            entity_type: 'entry',
            entity_id: new mongoose.Types.ObjectId(),
            action: 'CREATE',
            actor_name: 'Malicious Attempt',
            description: 'Attempt to forge audit record into Tenant B',
          })
        ).rejects.toThrow(/does not match active tenant context/i);
      });
    });
  });
});
