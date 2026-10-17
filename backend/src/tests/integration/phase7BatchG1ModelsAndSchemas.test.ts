import { describe, it, expect, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { Branch } from '../../models/Branch.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { Invoice } from '../../models/Invoice.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { BillingParty } from '../../models/BillingParty.js';
import { createTestTenant } from '../helpers.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase G1: Regional Branches Models, Schemas & Indexes (FF-ISSUE-053, DEC-010, QST-012)', () => {
  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics Mumbai' });
    tenantB = await createTestTenant({ name: 'Beta Freight Delhi' });
  });

  function hasIndex(indexes: any[], targetFields: Record<string, number>): boolean {
    return indexes.some(([fields]) => {
      const keys = Object.keys(fields);
      const targetKeys = Object.keys(targetFields);
      if (keys.length !== targetKeys.length) return false;
      return targetKeys.every((k) => fields[k] === targetFields[k]);
    });
  }

  describe('1. Branch Model Schema & Atomic Sequence Counters', () => {
    it('declares compound unique index and active status index on Branch', () => {
      const indexes = Branch.schema.indexes();
      expect(hasIndex(indexes, { company_id: 1, branch_code: 1 })).toBe(true);
      expect(hasIndex(indexes, { company_id: 1, is_active: 1 })).toBe(true);
    });

    it('initializes counters with lr_seq=0 and invoice_seq=0 by default', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branch = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Bhiwandi Hub',
          branch_code: 'BHW',
          lr_prefix: 'BHW-LR-',
          invoice_prefix: 'INV-BHW-',
          is_head_office: true,
        });

        expect(branch.counters).toBeDefined();
        expect(branch.counters?.lr_seq).toBe(0);
        expect(branch.counters?.invoice_seq).toBe(0);
        expect(branch.lr_prefix).toBe('BHW-LR-');
        expect(branch.invoice_prefix).toBe('INV-BHW-');
        expect(branch.is_active).toBe(true);
      });
    });

    it('supports atomic increments on branch sequence counters without race conditions', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branch = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Pune Depot',
          branch_code: 'PUN',
          lr_prefix: 'PUN-LR-',
          invoice_prefix: 'INV-PUN-',
        });

        const updated = await Branch.findByIdAndUpdate(
          branch._id,
          { $inc: { 'counters.lr_seq': 1, 'counters.invoice_seq': 2 } },
          { new: true }
        );

        expect(updated?.counters?.lr_seq).toBe(1);
        expect(updated?.counters?.invoice_seq).toBe(2);
      });
    });
  });

  describe('2. TruckJourney branch_id Reference & Indexes', () => {
    it('declares compound branch dispatch index on TruckJourney', () => {
      const indexes = TruckJourney.schema.indexes();
      expect(hasIndex(indexes, { company_id: 1, branch_id: 1, start_date: -1 })).toBe(true);
    });

    it('allows creating historical journeys without branch_id (backward compatibility)', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const truck = await Truck.create({
          company_id: tenantA.company._id,
          truck_no: 'MH04AB1234',
          make: 'Tata',
          model: 'Prima 4028',
          body_type: 'Container',
          tonnage_capacity: 15,
          current_odometer_kms: 50000,
          last_service_kms: 45000,
          service_interval_kms: 10000,
          next_service_due_kms: 55000,
          status: 'available',
        });
        const driver = await Driver.create({
          company_id: tenantA.company._id,
          name: 'Sunil Kumar',
          phone: '+919876500001',
          license_number: 'DL-MH-123456',
          status: 'active',
        });

        const journey = await TruckJourney.create({
          company_id: tenantA.company._id,
          journey_number: 'JRN-0001',
          status: 'active',
          truck_id: truck._id,
          driver_id: driver._id,
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Pune', state: 'Maharashtra' },
          start_date: new Date(),
          start_odometer_kms: 50000,
          // branch_id omitted deliberately
        });

        expect(journey.branch_id).toBeUndefined();
        const fetched = await TruckJourney.findById(journey._id);
        expect(fetched?.branch_id).toBeUndefined();
      });
    });

    it('persists and populates branch_id when specified on TruckJourney', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branch = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Navi Mumbai Depot',
          branch_code: 'NMB',
          lr_prefix: 'NMB-LR-',
          invoice_prefix: 'INV-NMB-',
        });

        const truck = await Truck.create({
          company_id: tenantA.company._id,
          truck_no: 'MH04CD5678',
          make: 'BharatBenz',
          model: '2823R',
          body_type: 'Open',
          tonnage_capacity: 25,
          current_odometer_kms: 80000,
          last_service_kms: 75000,
          service_interval_kms: 10000,
          next_service_due_kms: 85000,
          status: 'available',
        });
        const driver = await Driver.create({
          company_id: tenantA.company._id,
          name: 'Ramesh Patel',
          phone: '+919876500002',
          license_number: 'DL-MH-654321',
          status: 'active',
        });

        const journey = await TruckJourney.create({
          company_id: tenantA.company._id,
          journey_number: 'JRN-0002',
          status: 'active',
          truck_id: truck._id,
          driver_id: driver._id,
          branch_id: branch._id,
          from_location: { city: 'Navi Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Bengaluru', state: 'Karnataka' },
          start_date: new Date(),
          start_odometer_kms: 80000,
        });

        expect(journey.branch_id?.toString()).toBe(branch._id.toString());

        const populated = await TruckJourney.findById(journey._id).populate('branch_id');
        expect((populated?.branch_id as any).branch_code).toBe('NMB');
      });
    });
  });

  describe('3. Entry (Lorry Receipt) branch_id Reference & Indexes', () => {
    it('declares compound branch LR date index on Entry', () => {
      const indexes = Entry.schema.indexes();
      expect(hasIndex(indexes, { company_id: 1, branch_id: 1, lr_date: -1 })).toBe(true);
    });

    it('allows creating historical LRs without branch_id (backward compatibility)', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const entry = await Entry.create({
          company_id: tenantA.company._id,
          bill_no: 'BILL-0001',
          bill_date: new Date(),
          lr_no: 'LR-0001',
          lr_date: new Date(),
          consignor: { name: 'Tata Steel Ltd' },
          consignee: { name: 'L&T Construction' },
          vehicle_number: 'MH04AB1234',
          from_location: 'Mumbai',
          to_location: 'Pune',
          package_count: 50,
          packaging_type: 'Steel Coils',
          goods_description: 'Industrial Steel Roll',
          declared_value: 500000,
          risk_type: 'carrier_risk',
          actual_weight_tonnes: 12.5,
          chargeable_weight_tonnes: 13,
          cbm_volume: 15,
          freight_terms: 'to_be_billed',
          freight_amount: 35000,
          status: 'active',
          // branch_id omitted deliberately
        });

        expect(entry.branch_id).toBeUndefined();
        const fetched = await Entry.findById(entry._id);
        expect(fetched?.branch_id).toBeUndefined();
      });
    });

    it('persists and populates branch_id when specified on Entry', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branch = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Ahmedabad Branch',
          branch_code: 'AMD',
          lr_prefix: 'AMD-LR-',
          invoice_prefix: 'INV-AMD-',
        });

        const entry = await Entry.create({
          company_id: tenantA.company._id,
          branch_id: branch._id,
          bill_no: 'BILL-0002',
          bill_date: new Date(),
          lr_no: 'AMD-LR-0001',
          lr_date: new Date(),
          consignor: { name: 'Adani Logistics' },
          consignee: { name: 'Reliance Industries' },
          vehicle_number: 'GJ01CD9999',
          from_location: 'Ahmedabad',
          to_location: 'Mundra',
          package_count: 100,
          packaging_type: 'Cartons',
          goods_description: 'Export Goods',
          declared_value: 1200000,
          risk_type: 'owner_risk',
          actual_weight_tonnes: 18,
          chargeable_weight_tonnes: 18,
          cbm_volume: 24,
          freight_terms: 'to_be_billed',
          freight_amount: 45000,
          status: 'active',
        });

        expect(entry.branch_id?.toString()).toBe(branch._id.toString());
        const populated = await Entry.findById(entry._id).populate('branch_id');
        expect((populated?.branch_id as any).branch_code).toBe('AMD');
      });
    });
  });

  describe('4. Invoice branch_id Reference & Indexes', () => {
    it('declares compound branch invoice date index on Invoice', () => {
      const indexes = Invoice.schema.indexes();
      expect(hasIndex(indexes, { company_id: 1, branch_id: 1, invoice_date: -1 })).toBe(true);
    });

    it('allows creating historical invoices without branch_id (backward compatibility)', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const party = await BillingParty.create({
          company_id: tenantA.company._id,
          name: 'JSW Steel Ltd',
          gstin: '27AABCJ1234D1Z5',
          billing_address: {
            city: 'Mumbai',
            state: 'Maharashtra',
          },
        });

        const invoice = await Invoice.create({
          company_id: tenantA.company._id,
          invoice_number: 'INV-0001',
          invoice_date: new Date(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          billing_party_id: party._id,
          billing_party_snapshot: {
            name: 'JSW Steel Ltd',
            gstin: '27AABCJ1234D1Z5',
            state: 'Maharashtra',
          },
          subtotal: 50000,
          tax_type: 'rcm',
          is_rcm: true,
          place_of_supply: 'Maharashtra',
          total_tax: 0,
          total_amount: 50000,
          balance_amount: 50000,
          status: 'issued',
          // branch_id omitted deliberately
        });

        expect(invoice.branch_id).toBeUndefined();
        const fetched = await Invoice.findById(invoice._id);
        expect(fetched?.branch_id).toBeUndefined();
      });
    });

    it('persists and populates branch_id when specified on Invoice', async () => {
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branch = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Delhi NCR Hub',
          branch_code: 'DEL',
          lr_prefix: 'DEL-LR-',
          invoice_prefix: 'INV-DEL-',
        });

        const party = await BillingParty.create({
          company_id: tenantA.company._id,
          name: 'Maruti Suzuki India',
          gstin: '07AABCM5678E1Z9',
          billing_address: {
            city: 'New Delhi',
            state: 'Delhi',
          },
        });

        const invoice = await Invoice.create({
          company_id: tenantA.company._id,
          branch_id: branch._id,
          invoice_number: 'INV-DEL-0001',
          invoice_date: new Date(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          billing_party_id: party._id,
          billing_party_snapshot: {
            name: 'Maruti Suzuki India',
            gstin: '07AABCM5678E1Z9',
            state: 'Delhi',
          },
          subtotal: 75000,
          tax_type: 'forward_charge',
          is_rcm: false,
          place_of_supply: 'Delhi',
          total_tax: 3750,
          total_amount: 78750,
          balance_amount: 78750,
          status: 'issued',
        });

        expect(invoice.branch_id?.toString()).toBe(branch._id.toString());
        const populated = await Invoice.findById(invoice._id).populate('branch_id');
        expect((populated?.branch_id as any).branch_code).toBe('DEL');
      });
    });
  });

  describe('5. Tenant Isolation with Branch Association', () => {
    it('isolates branches between separate tenant workspaces', async () => {
      let branchAId: Types.ObjectId;
      let branchBId: Types.ObjectId;

      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branchA = await Branch.create({
          company_id: tenantA.company._id,
          branch_name: 'Alpha Mumbai Hub',
          branch_code: 'AMUM',
          lr_prefix: 'AMUM-LR-',
          invoice_prefix: 'INV-AMUM-',
        });
        branchAId = branchA._id as Types.ObjectId;
      });

      await tenantStorage.run({ companyId: tenantB.company._id.toString() }, async () => {
        const branchB = await Branch.create({
          company_id: tenantB.company._id,
          branch_name: 'Beta Delhi Hub',
          branch_code: 'BDEL',
          lr_prefix: 'BDEL-LR-',
          invoice_prefix: 'INV-BDEL-',
        });
        branchBId = branchB._id as Types.ObjectId;
      });

      // Tenant A query context
      await tenantStorage.run({ companyId: tenantA.company._id.toString() }, async () => {
        const branches = await Branch.find();
        expect(branches.length).toBe(1);
        expect(branches[0].branch_code).toBe('AMUM');
        expect(branches.some((b) => b._id.toString() === branchBId.toString())).toBe(false);
      });

      // Tenant B query context
      await tenantStorage.run({ companyId: tenantB.company._id.toString() }, async () => {
        const branches = await Branch.find();
        expect(branches.length).toBe(1);
        expect(branches[0].branch_code).toBe('BDEL');
        expect(branches.some((b) => b._id.toString() === branchAId.toString())).toBe(false);
      });
    });
  });

  describe('6. Schema Index Synchronization', () => {
    it('synchronizes all branch-related indexes to MongoDB without conflicts', async () => {
      await expect(
        Promise.all([
          Branch.syncIndexes(),
          TruckJourney.syncIndexes(),
          Entry.syncIndexes(),
          Invoice.syncIndexes(),
        ])
      ).resolves.toBeDefined();
    });
  });
});
