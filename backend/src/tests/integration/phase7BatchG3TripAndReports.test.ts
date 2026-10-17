import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { Branch } from '../../models/Branch.js';
import { Company } from '../../models/Company.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { BillingParty } from '../../models/BillingParty.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Entry } from '../../models/Entry.js';
import { Invoice } from '../../models/Invoice.js';
import { createTestTenant } from '../helpers.js';
import { tenantStorage } from '../../plugins/tenantPlugin.js';

describe('Phase G3: Operational Trip Dispatch & Commercial Report Integration (FF-ISSUE-051..053, DEC-010, QST-012)', () => {
  let tenantAdminA: any;
  let tenantAdminB: any;
  let customerA: any;
  let truckA: any;
  let truckB: any;
  let driverA: any;
  let driverB: any;

  function makeTripPayload(overrides: Record<string, any> = {}) {
    return {
      truck_id: truckA._id.toString(),
      driver_id: driverA._id.toString(),
      billing_party_id: customerA._id.toString(),
      from_location: { city: 'Mumbai', state: 'Maharashtra' },
      to_location: { city: 'Pune', state: 'Maharashtra' },
      start_odometer_kms: 12000,
      freight_rate: 35000,
      status: 'draft',
      ...overrides,
    };
  }

  function makeEntryPayload(overrides: Record<string, any> = {}) {
    return {
      billing_party_id: customerA._id.toString(),
      vehicle_number: truckA.truck_no,
      driver_name: driverA.name,
      from_location: 'Mumbai',
      to_location: 'Pune',
      goods_description: 'Industrial Equipment',
      package_count: 40,
      packaging_type: 'Crates',
      actual_weight_tonnes: 10,
      chargeable_weight_tonnes: 10,
      freight_amount: 35000,
      consignor: { name: 'Tata Steel Ltd', phone: '+919876543210' },
      consignee: { name: 'Bharat Forge Ltd', phone: '+919876543211' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    tenantAdminA = await createTestTenant({ name: 'Alpha Logistics Dispatch', role: 'admin' });
    tenantAdminB = await createTestTenant({ name: 'Beta Freight Competitor', role: 'admin' });

    await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
      customerA = await BillingParty.create({
        company_id: tenantAdminA.company._id,
        name: 'JSW Steel Ltd',
        gstin: '27AAACJ1234A1Z1',
        credit_limit: 10000000,
        enforce_credit_limit: false,
        outstanding_receivables: 0,
        status: 'active',
      });

      truckA = await Truck.create({
        company_id: tenantAdminA.company._id,
        truck_no: `MH04AB${Math.floor(1000 + Math.random() * 9000)}`,
        make: 'BharatBenz',
        model: '2823R',
        body_type: 'Container',
        tonnage_capacity: 25,
        status: 'available',
      });

      truckB = await Truck.create({
        company_id: tenantAdminA.company._id,
        truck_no: `MH04CD${Math.floor(1000 + Math.random() * 9000)}`,
        make: 'Tata',
        model: 'Signa 3523',
        body_type: 'Trailer',
        tonnage_capacity: 35,
        status: 'available',
      });

      driverA = await Driver.create({
        company_id: tenantAdminA.company._id,
        name: 'Suresh Patil',
        phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        license_number: `MH${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: 'active',
      });

      driverB = await Driver.create({
        company_id: tenantAdminA.company._id,
        name: 'Anil Yadav',
        phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        license_number: `MH${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: 'active',
      });
    });
  });

  describe('1. Single-Branch Workspaces: Frictionless Automatic Attribution', () => {
    let singleBranch: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        singleBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Bhiwandi Central Hub',
          branch_code: 'BHW',
          lr_prefix: 'BHW-LR-',
          invoice_prefix: 'INV-BHW-',
          is_head_office: true,
          is_active: true,
        });
      });
    });

    it('automatically assigns the only active branch when branch_id is omitted from trip dispatch', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(makeTripPayload());

      expect(res.status).toBe(201);
      expect(res.body.journey).toBeDefined();
      expect(res.body.journey.branch_id).toBe(singleBranch._id.toString());

      const savedTrip = await TruckJourney.findOne({
        _id: res.body.journey._id,
        company_id: tenantAdminA.company._id,
      });
      expect(savedTrip?.branch_id?.toString()).toBe(singleBranch._id.toString());
    });
  });

  describe('2. Multi-Branch Workspaces: Validation & Defaulting Hierarchy', () => {
    let headOfficeBranch: any;
    let regionalBranchPune: any;
    let inactiveBranchNagpur: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        headOfficeBranch = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Mumbai Head Office',
          branch_code: 'HQ-MUM',
          lr_prefix: 'MUM-LR-',
          invoice_prefix: 'INV-MUM-',
          is_head_office: true,
          is_active: true,
        });

        regionalBranchPune = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Pune Regional Depot',
          branch_code: 'PUN',
          lr_prefix: 'PUN-LR-',
          invoice_prefix: 'INV-PUN-',
          is_head_office: false,
          is_active: true,
        });

        inactiveBranchNagpur = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Nagpur Outpost (Closed)',
          branch_code: 'NGP',
          lr_prefix: 'NGP-LR-',
          invoice_prefix: 'INV-NGP-',
          is_head_office: false,
          is_active: false,
        });
      });
    });

    it('accepts explicit valid branch_id and assigns the requested regional branch', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(makeTripPayload({ branch_id: regionalBranchPune._id.toString() }));

      expect(res.status).toBe(201);
      expect(res.body.journey.branch_id).toBe(regionalBranchPune._id.toString());
    });

    it('rejects dispatch referencing an inactive branch with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(makeTripPayload({ branch_id: inactiveBranchNagpur._id.toString() }));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot dispatch trip for an inactive regional branch/i);
    });

    it('rejects cross-tenant branch_id with HTTP 404', async () => {
      let foreignBranch: any;
      await tenantStorage.run({ companyId: tenantAdminB.company._id.toString() }, async () => {
        foreignBranch = await Branch.create({
          company_id: tenantAdminB.company._id,
          branch_name: 'Beta Delhi Depot',
          branch_code: 'DEL',
          is_active: true,
        });
      });

      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(makeTripPayload({ branch_id: foreignBranch._id.toString() }));

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/regional branch not found in your workspace/i);
    });

    it('defaults to Head Office in multi-branch workspace when branch_id is omitted', async () => {
      const res = await request(app)
        .post('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(makeTripPayload());

      expect(res.status).toBe(201);
      expect(res.body.journey.branch_id).toBe(headOfficeBranch._id.toString());
    });
  });

  describe('3. Trip/LR Workflow: Branch Inheritance & Numbering Consistency', () => {
    let branchSurat: any;
    let tripSurat: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        branchSurat = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Surat Textile Terminal',
          branch_code: 'SRT',
          lr_prefix: 'SRT-LR-',
          invoice_prefix: 'INV-SRT-',
          is_head_office: false,
          is_active: true,
        });

        tripSurat = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchSurat._id,
          journey_number: 'JRN-7001',
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: { city: 'Surat' },
          to_location: { city: 'Mumbai' },
          start_odometer_kms: 20000,
          status: 'active',
        });
      });
    });

    it('automatically inherits branch_id from associated journey and allocates branch-level sequential LR number', async () => {
      // LR created for tripSurat without passing explicit branch_id
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            journey_id: tripSurat._id.toString(),
            from_location: 'Surat',
            to_location: 'Mumbai',
          })
        );

      expect(res.status).toBe(201);
      expect(res.body.entry.branch_id).toBe(branchSurat._id.toString());
      expect(res.body.entry.lr_no).toBe('SRT-LR-0001');

      const updatedBranch = await Branch.findOne({
        _id: branchSurat._id,
        company_id: tenantAdminA.company._id,
      });
      expect(updatedBranch?.counters?.lr_seq).toBe(1);
    });

    it('allows explicit branch_id on LR to override journey branch if deliberately redirected', async () => {
      let branchBaroda: any;
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        branchBaroda = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Vadodara Hub',
          branch_code: 'BRD',
          lr_prefix: 'BRD-LR-',
          invoice_prefix: 'INV-BRD-',
          is_active: true,
        });
      });

      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            journey_id: tripSurat._id.toString(),
            branch_id: branchBaroda._id.toString(),
            from_location: 'Vadodara',
            to_location: 'Mumbai',
          })
        );

      expect(res.status).toBe(201);
      expect(res.body.entry.branch_id).toBe(branchBaroda._id.toString());
      expect(res.body.entry.lr_no).toBe('BRD-LR-0001');
    });

    it('preserves company-level numbering for independent unbranched LR creation', async () => {
      const res = await request(app)
        .post('/api/commercial/entries')
        .set('Authorization', `Bearer ${tenantAdminA.token}`)
        .send(
          makeEntryPayload({
            from_location: 'Global Factory',
            to_location: 'Port JNPT',
          })
        );

      expect(res.status).toBe(201);
      expect(res.body.entry.lr_no).toBe('LR-0001');

      const updatedCompany = await Company.findById(tenantAdminA.company._id, null, { skipTenantCheck: true });
      expect(updatedCompany?.counters?.lr_seq).toBe(1);
    });
  });

  describe('4. Operational Journey Filtering & Detail Retrieval', () => {
    let branchMum: any;
    let branchPune: any;
    let tripMum: any;
    let tripPune: any;
    let unbranchedHistoricalTrip: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        branchMum = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Mumbai HQ',
          branch_code: 'MUM',
          is_head_office: true,
          is_active: true,
        });

        branchPune = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Pune Hub',
          branch_code: 'PUN',
          is_head_office: false,
          is_active: true,
        });

        tripMum = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchMum._id,
          journey_number: 'JRN-MUM-100',
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: { city: 'Mumbai' },
          to_location: { city: 'Goa' },
          start_odometer_kms: 30000,
          status: 'completed',
        });

        tripPune = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchPune._id,
          journey_number: 'JRN-PUN-200',
          truck_id: truckB._id,
          driver_id: driverB._id,
          from_location: { city: 'Pune' },
          to_location: { city: 'Bangalore' },
          start_odometer_kms: 40000,
          status: 'active',
        });

        unbranchedHistoricalTrip = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          journey_number: 'JRN-LEGACY-001',
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: { city: 'Old Origin' },
          to_location: { city: 'Old Destination' },
          start_odometer_kms: 10000,
          status: 'completed',
        });
      });
    });

    it('populates branch details on single journey retrieval (getJourneyById)', async () => {
      const res = await request(app)
        .get(`/api/operations/journeys/${tripMum._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.journey.branch_id).toBeDefined();
      expect(res.body.journey.branch_id.branch_code).toBe('MUM');
      expect(res.body.journey.branch_id.is_head_office).toBe(true);
    });

    it('filters journeys strictly by branch_id when query parameter is provided', async () => {
      const resPune = await request(app)
        .get(`/api/operations/journeys?branch_id=${branchPune._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(resPune.status).toBe(200);
      expect(resPune.body.journeys.length).toBe(1);
      expect(resPune.body.journeys[0].journey_number).toBe('JRN-PUN-200');

      const resMum = await request(app)
        .get(`/api/operations/journeys?branch_id=${branchMum._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(resMum.status).toBe(200);
      expect(resMum.body.journeys.length).toBe(1);
      expect(resMum.body.journeys[0].journey_number).toBe('JRN-MUM-100');
    });

    it('returns all journeys including historical unbranched records when branch_id is omitted', async () => {
      const res = await request(app)
        .get('/api/operations/journeys')
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.journeys.length).toBe(3);

      const legacyTrip = res.body.journeys.find((j: any) => j.journey_number === 'JRN-LEGACY-001');
      expect(legacyTrip).toBeDefined();
      expect(legacyTrip.branch_id).toBeUndefined();
    });

    it('rejects journey list query with cross-tenant branch_id with HTTP 404', async () => {
      let foreignBranch: any;
      await tenantStorage.run({ companyId: tenantAdminB.company._id.toString() }, async () => {
        foreignBranch = await Branch.create({
          company_id: tenantAdminB.company._id,
          branch_name: 'Beta Delhi Depot',
          branch_code: 'DEL',
          is_active: true,
        });
      });

      const res = await request(app)
        .get(`/api/operations/journeys?branch_id=${foreignBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/regional branch not found in your workspace/i);
    });
  });

  describe('5. Commercial Reports: Branch Filtering & Historical Compatibility', () => {
    let branchKolkata: any;
    let branchChennai: any;
    let tripKolkata: any;
    let tripChennai: any;
    let historicalUnbranchedTrip: any;

    let invoiceKolkata: any;
    let invoiceChennai: any;
    let historicalUnbranchedInvoice: any;

    beforeEach(async () => {
      await tenantStorage.run({ companyId: tenantAdminA.company._id.toString() }, async () => {
        branchKolkata = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Kolkata Port Hub',
          branch_code: 'CCU',
          is_active: true,
        });

        branchChennai = await Branch.create({
          company_id: tenantAdminA.company._id,
          branch_name: 'Chennai Terminal',
          branch_code: 'MAA',
          is_active: true,
        });

        // Seed Trips with financial figures
        tripKolkata = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchKolkata._id,
          journey_number: 'JRN-CCU-01',
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: { city: 'Kolkata' },
          to_location: { city: 'Ranchi' },
          freight_rate: 60000,
          diesel_expenses: [
            {
              filling_date: new Date(),
              petrol_pump_name: 'IOCL Highway Pump',
              fuel_quantity_litres: 200,
              rate_per_litre: 100,
              total_cost: 20000,
              payment_mode: 'fuel_card',
            },
          ],
          driver_expenses: [
            {
              date: new Date(),
              expense_type: 'toll',
              amount: 5000,
            },
          ],
          start_odometer_kms: 10000,
          status: 'completed',
        });

        tripChennai = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchChennai._id,
          journey_number: 'JRN-MAA-02',
          truck_id: truckB._id,
          driver_id: driverB._id,
          from_location: { city: 'Chennai' },
          to_location: { city: 'Coimbatore' },
          freight_rate: 45000,
          diesel_expenses: [
            {
              filling_date: new Date(),
              petrol_pump_name: 'BPCL Depot Pump',
              fuel_quantity_litres: 150,
              rate_per_litre: 100,
              total_cost: 15000,
              payment_mode: 'fuel_card',
            },
          ],
          driver_expenses: [
            {
              date: new Date(),
              expense_type: 'toll',
              amount: 3000,
            },
          ],
          start_odometer_kms: 25000,
          status: 'completed',
        });

        historicalUnbranchedTrip = await TruckJourney.create({
          company_id: tenantAdminA.company._id,
          journey_number: 'JRN-HIST-03',
          truck_id: truckA._id,
          driver_id: driverA._id,
          from_location: { city: 'Delhi' },
          to_location: { city: 'Jaipur' },
          freight_rate: 30000,
          diesel_expenses: [
            {
              filling_date: new Date(),
              petrol_pump_name: 'HPCL Express Pump',
              fuel_quantity_litres: 100,
              rate_per_litre: 100,
              total_cost: 10000,
              payment_mode: 'fuel_card',
            },
          ],
          driver_expenses: [
            {
              date: new Date(),
              expense_type: 'toll',
              amount: 2000,
            },
          ],
          start_odometer_kms: 5000,
          status: 'completed',
        });

        // Seed Invoices for AR Aging
        invoiceKolkata = await Invoice.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchKolkata._id,
          billing_party_id: customerA._id,
          billing_party_snapshot: { name: 'JSW Steel Ltd' },
          place_of_supply: 'West Bengal',
          invoice_number: 'INV-CCU-001',
          invoice_date: new Date(Date.now() - 10 * 86400000), // 10 days ago (current_0_30)
          due_date: new Date(Date.now() + 5 * 86400000),
          subtotal: 60000,
          total_tax: 0,
          total_amount: 60000,
          balance_amount: 60000,
          status: 'issued',
        });

        invoiceChennai = await Invoice.create({
          company_id: tenantAdminA.company._id,
          branch_id: branchChennai._id,
          billing_party_id: customerA._id,
          billing_party_snapshot: { name: 'JSW Steel Ltd' },
          place_of_supply: 'Tamil Nadu',
          invoice_number: 'INV-MAA-002',
          invoice_date: new Date(Date.now() - 45 * 86400000), // 45 days ago (days_31_60)
          due_date: new Date(Date.now() - 30 * 86400000),
          subtotal: 45000,
          total_tax: 0,
          total_amount: 45000,
          balance_amount: 45000,
          status: 'issued',
        });

        historicalUnbranchedInvoice = await Invoice.create({
          company_id: tenantAdminA.company._id,
          billing_party_id: customerA._id,
          billing_party_snapshot: { name: 'JSW Steel Ltd' },
          place_of_supply: 'Delhi',
          invoice_number: 'INV-HIST-003',
          invoice_date: new Date(Date.now() - 75 * 86400000), // 75 days ago (days_61_90)
          due_date: new Date(Date.now() - 60 * 86400000),
          subtotal: 30000,
          total_tax: 0,
          total_amount: 30000,
          balance_amount: 30000,
          status: 'issued',
        });
      });
    });

    it('filters Trip Profitability report strictly by branch_id with populated branch attribution', async () => {
      const res = await request(app)
        .get(`/api/commercial/profitability?branch_id=${branchKolkata._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.trips.length).toBe(1);
      expect(res.body.trips[0].journey_number).toBe('JRN-CCU-01');
      expect(res.body.trips[0].branch_id).toBe(branchKolkata._id.toString());
      expect(res.body.trips[0].branch_name).toBe('Kolkata Port Hub');
      expect(res.body.summary.total_revenue_paise).toBe(6000000);
      expect(res.body.summary.total_expenses_paise).toBe(2500000);
      expect(res.body.summary.net_profit_paise).toBe(3500000);
    });

    it('returns company-wide Trip Profitability report including historical records when branch_id is omitted', async () => {
      const res = await request(app)
        .get('/api/commercial/profitability')
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.trips.length).toBe(3);
      expect(res.body.summary.total_trips).toBe(3);

      const legacyItem = res.body.trips.find((t: any) => t.journey_number === 'JRN-HIST-03');
      expect(legacyItem).toBeDefined();
      expect(legacyItem.branch_id).toBeNull();
      expect(legacyItem.branch_name).toBe('Head Office / Global');
    });

    it('rejects Trip Profitability report with cross-tenant branch_id with HTTP 404', async () => {
      let foreignBranch: any;
      await tenantStorage.run({ companyId: tenantAdminB.company._id.toString() }, async () => {
        foreignBranch = await Branch.create({
          company_id: tenantAdminB.company._id,
          branch_name: 'Beta Delhi Depot',
          branch_code: 'DEL',
          is_active: true,
        });
      });

      const res = await request(app)
        .get(`/api/commercial/profitability?branch_id=${foreignBranch._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/regional branch not found in your workspace/i);
    });

    it('filters AR Aging report strictly by branch_id with accurate bucket attribution', async () => {
      const res = await request(app)
        .get(`/api/commercial/aging?branch_id=${branchChennai._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.total_outstanding_paise).toBe(4500000);
      expect(res.body.aging.days_31_60.count).toBe(1);
      expect(res.body.aging.days_31_60.items[0].invoice_no).toBe('INV-MAA-002');
      expect(res.body.aging.days_31_60.items[0].branch_id).toBe(branchChennai._id.toString());
      expect(res.body.aging.current_0_30.count).toBe(0);
    });

    it('returns company-wide AR Aging report including unbranched records when branch_id is omitted', async () => {
      const res = await request(app)
        .get('/api/commercial/aging')
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      // Total = 60000 (Kolkata) + 45000 (Chennai) + 30000 (Historical) = 135000 rupees = 13,500,000 paise
      expect(res.body.total_outstanding_paise).toBe(13500000);
      expect(res.body.aging.current_0_30.count).toBe(1); // Kolkata
      expect(res.body.aging.days_31_60.count).toBe(1);   // Chennai
      expect(res.body.aging.days_61_90.count).toBe(1);   // Historical Unbranched
    });

    it('filters Tally Prime XML export strictly by branch_id', async () => {
      const res = await request(app)
        .get(`/api/commercial/export/tally?branch_id=${branchKolkata._id}`)
        .set('Authorization', `Bearer ${tenantAdminA.token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/xml');
      expect(res.text).toContain('INV-CCU-001');
      expect(res.text).not.toContain('INV-MAA-002');
    });
  });
});
