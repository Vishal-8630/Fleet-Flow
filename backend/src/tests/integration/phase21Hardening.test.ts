import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Entry } from '../../models/Entry.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Truck } from '../../models/Truck.js';
import { Driver } from '../../models/Driver.js';
import { CustomFieldDefinition } from '../../models/CustomFieldDefinition.js';
import { Settlement } from '../../models/Settlement.js';
import { Ledger } from '../../models/Ledger.js';
import { Invoice } from '../../models/Invoice.js';
import { VehicleEntry } from '../../models/VehicleEntry.js';
import { BalanceParty } from '../../models/BalanceParty.js';
import { BillingParty } from '../../models/BillingParty.js';

describe('Phase 2.1: Schema & Query Hardening (ISS-021 & ISS-014)', () => {
  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTestTenant({ name: 'Alpha Logistics', role: 'admin' });
    tenantB = await createTestTenant({ name: 'Beta Freight', role: 'admin' });
  });

  describe('ISS-021: Custom Field Key Sanitization & Prototype Pollution Defense', () => {
    it('rejects dangerous prototype pollution keys (__proto__, constructor, prototype) with HTTP 400', async () => {
      const dangerousKeys = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];

      for (const key of dangerousKeys) {
        const res = await request(app)
          .post('/api/settings/custom-fields')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            entity: 'Truck',
            field_key: key,
            field_label: 'Malicious Field',
            field_type: 'text',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }
    });

    it('rejects keys starting with $ or containing . with HTTP 400', async () => {
      const operatorKeys = ['$gt', '$where', 'nested.field', 'prefix.$bad'];

      for (const key of operatorKeys) {
        const res = await request(app)
          .post('/api/settings/custom-fields')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            entity: 'Truck',
            field_key: key,
            field_label: 'Operator Injection',
            field_type: 'text',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cannot contain "\$" or "\."/i);
      }
    });

    it('rejects keys with spaces, uppercase characters, or invalid length (<2, >32) with HTTP 400', async () => {
      const invalidKeys = [
        'has space',
        'UPPERCASE_KEY',
        'CamelCase',
        'a', // length 1 (< 2)
        'a'.repeat(33), // length 33 (> 32)
        '1starts_with_number',
        '_starts_with_underscore',
      ];

      for (const key of invalidKeys) {
        const res = await request(app)
          .post('/api/settings/custom-fields')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            entity: 'Truck',
            field_key: key,
            field_label: 'Invalid Key',
            field_type: 'text',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }
    });

    it('accepts legitimate snake_case keys (chassis_number, gps_imei) with HTTP 201', async () => {
      const validKeys = ['chassis_number', 'gps_imei', 'tyre_serial_code'];

      for (const key of validKeys) {
        const res = await request(app)
          .post('/api/settings/custom-fields')
          .set('Authorization', `Bearer ${tenantA.token}`)
          .send({
            entity: 'Truck',
            field_key: key,
            field_label: key.toUpperCase(),
            field_type: 'text',
          });

        expect(res.status).toBe(201);
        expect(res.body.field).toBeDefined();
        expect(res.body.field.field_key).toBe(key);
      }
    });

    it('guarantees custom field definitions remain strictly isolated per tenant', async () => {
      // Create field under Tenant A
      await request(app)
        .post('/api/settings/custom-fields')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send({
          entity: 'Truck',
          field_key: 'custom_badge_no',
          field_label: 'Badge No',
          field_type: 'text',
        });

      // Tenant B lists fields -> must not see Tenant A's field
      const resB = await request(app)
        .get('/api/settings/custom-fields?entity=Truck')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.fields.some((f: any) => f.field_key === 'custom_badge_no')).toBe(false);
    });
  });

  describe('ISS-014: Aggregation company_id BSON ObjectId Casting', () => {
    it('returns accurate non-zero sums in getEntryMetrics aggregation', async () => {
      // Seed 5 entries for Tenant A
      for (let i = 1; i <= 5; i++) {
        await Entry.create({
          company_id: tenantA.company._id,
          bill_no: `BILL-METRIC-${i}`,
          bill_date: new Date(),
          lr_no: `LR-METRIC-${i}`,
          lr_date: new Date(),
          vehicle_number: 'MH12-AB-1001',
          from_location: 'Mumbai',
          to_location: 'Pune',
          consignor: { name: 'Shipper A' },
          consignee: { name: 'Receiver A' },
          goods_description: 'General Goods',
          package_count: 10,
          packaging_type: 'Boxes',
          declared_value: 50000,
          risk_type: 'owner_risk',
          actual_weight_tonnes: 10,
          chargeable_weight_tonnes: 10,
          cbm_volume: 15,
          freight_amount: 1500,
          status: 'active',
          is_deleted: false,
        });
      }

      // Seed 2 entries for Tenant B (must not contaminate Tenant A)
      for (let i = 1; i <= 2; i++) {
        await Entry.create({
          company_id: tenantB.company._id,
          bill_no: `BILL-BETA-${i}`,
          bill_date: new Date(),
          lr_no: `LR-BETA-${i}`,
          lr_date: new Date(),
          vehicle_number: 'MH14-CD-2002',
          from_location: 'Delhi',
          to_location: 'Jaipur',
          consignor: { name: 'Shipper B' },
          consignee: { name: 'Receiver B' },
          goods_description: 'Heavy Cargo',
          package_count: 5,
          packaging_type: 'Pallets',
          declared_value: 100000,
          risk_type: 'owner_risk',
          actual_weight_tonnes: 20,
          chargeable_weight_tonnes: 20,
          cbm_volume: 25,
          freight_amount: 5000,
          status: 'active',
          is_deleted: false,
        });
      }

      const resA = await request(app)
        .get('/api/commercial/entries/metrics')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.metrics.total_lrs).toBe(5);
      expect(resA.body.metrics.total_freight_value).toBe(5 * 1500); // 7500, NOT 0!

      const resB = await request(app)
        .get('/api/commercial/entries/metrics')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.metrics.total_lrs).toBe(2);
      expect(resB.body.metrics.total_freight_value).toBe(2 * 5000); // 10000
    });

    it('returns accurate non-zero journey metrics in getJourneyMetrics aggregation', async () => {
      const truck = await Truck.create({
        company_id: tenantA.company._id,
        truck_no: 'MH12-JM-1001',
        make: 'Tata Motors',
        model: 'Prima 5530',
        tonnage_capacity: 35,
        body_type: 'Open',
        current_odometer_kms: 50000,
        last_service_kms: 45000,
        service_interval_kms: 10000,
        next_service_due_kms: 55000,
        driver_assignments: [],
        status: 'on_trip',
      });

      const driver = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Ramesh Singh',
        phone: '+919876543210',
        license_number: 'DL-MH12-1001',
      });

      // Seed 2 active journeys for Tenant A
      for (let i = 1; i <= 2; i++) {
        await TruckJourney.create({
          company_id: tenantA.company._id,
          journey_number: `JRN-METRIC-${i}`,
          truck_id: truck._id,
          driver_id: driver._id,
          from_location: { city: 'Mumbai', state: 'Maharashtra' },
          to_location: { city: 'Nagpur', state: 'Maharashtra' },
          start_date: new Date(),
          start_odometer_kms: 50000,
          end_odometer_kms: 50800,
          diesel_expenses: [
            {
              petrol_pump_name: 'Highway IOCL',
              fuel_quantity_litres: 200,
              rate_per_litre: 90,
              total_cost: 18000,
            },
          ],
          status: 'active',
          is_deleted: false,
        });
      }

      const resA = await request(app)
        .get('/api/operations/journeys/metrics')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.activeJourneys).toBe(2);
      expect(resA.body.totalDistanceKms).toBe(1600); // 2 * 800, NOT 0!
      expect(resA.body.totalDieselLitres).toBe(400); // 2 * 200, NOT 0!
      expect(resA.body.totalDieselCost).toBe(36000); // 2 * 18000, NOT 0!
      expect(resA.body.averageMileageKmPerLitre).toBe(4); // 1600 / 400 = 4.0
    });

    it('returns accurate non-zero figures in getSettlementMetrics and isolates by tenant', async () => {
      const driverA = await Driver.create({
        company_id: tenantA.company._id,
        name: 'Agg Driver A',
        phone: '+919900113301',
        license_number: 'DL-AGG-A01',
      });

      const driverB = await Driver.create({
        company_id: tenantB.company._id,
        name: 'Agg Driver B',
        phone: '+919900113302',
        license_number: 'DL-AGG-B01',
      });

      await Settlement.create({
        company_id: tenantA.company._id,
        settlement_number: `SET-AGG-A-${Date.now()}`,
        settlement_date: new Date(),
        driver_id: driverA._id,
        driver_snapshot: { name: driverA.name, phone: driverA.phone },
        total_kms: 500,
        rate_per_km: 5,
        base_earnings: 12500,
        gross_earnings: 12500,
        benchmark_mileage: 4,
        diesel_price_per_litre: 90,
        diesel_deduction_amount: 0,
        cash_advance_deducted: 0,
        other_deductions: 0,
        total_deductions: 0,
        net_amount: 12500,
        settlement_type: 'payable_to_driver',
        payment_status: 'unpaid',
      });

      await Settlement.create({
        company_id: tenantB.company._id,
        settlement_number: `SET-AGG-B-${Date.now()}`,
        settlement_date: new Date(),
        driver_id: driverB._id,
        driver_snapshot: { name: driverB.name, phone: driverB.phone },
        total_kms: 1000,
        rate_per_km: 5,
        base_earnings: 20000,
        gross_earnings: 20000,
        benchmark_mileage: 4,
        diesel_price_per_litre: 90,
        diesel_deduction_amount: 0,
        cash_advance_deducted: 0,
        other_deductions: 0,
        total_deductions: 0,
        net_amount: 20000,
        settlement_type: 'payable_to_driver',
        payment_status: 'unpaid',
      });

      const resA = await request(app)
        .get('/api/commercial/settlements/metrics')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.metrics.total_payable_outstanding).toBe(12500); // Only Tenant A, NOT 32500 or 0!
      expect(resA.body.metrics.unpaid_settlements_count).toBe(1);

      const resB = await request(app)
        .get('/api/commercial/settlements/metrics')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.metrics.total_payable_outstanding).toBe(20000);
      expect(resB.body.metrics.unpaid_settlements_count).toBe(1);
    });

    it('returns accurate non-zero figures in getLedgerSummary and isolates by tenant', async () => {
      await Ledger.create({
        company_id: tenantA.company._id,
        transaction_number: `TXN-A-${Date.now()}-1`,
        transaction_date: new Date(),
        category: 'freight_income',
        transaction_type: 'manual_adjustment',
        balance_type: 'credit',
        amount: 50000,
        payment_mode: 'bank',
        description: 'Freight collection',
      });

      await Ledger.create({
        company_id: tenantA.company._id,
        transaction_number: `TXN-A-${Date.now()}-2`,
        transaction_date: new Date(),
        category: 'diesel_expense',
        transaction_type: 'manual_adjustment',
        balance_type: 'debit',
        amount: 20000,
        payment_mode: 'bank',
        description: 'Diesel pump expense',
      });

      await Ledger.create({
        company_id: tenantB.company._id,
        transaction_number: `TXN-B-${Date.now()}-1`,
        transaction_date: new Date(),
        category: 'freight_income',
        transaction_type: 'manual_adjustment',
        balance_type: 'credit',
        amount: 99000,
        payment_mode: 'bank',
        description: 'Freight income B',
      });

      const resA = await request(app)
        .get('/api/commercial/ledger/summary')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.summary.total_credits).toBe(50000); // NOT 149000!
      expect(resA.body.summary.total_debits).toBe(20000);
      expect(resA.body.summary.net_cash_position).toBe(30000);

      const resB = await request(app)
        .get('/api/commercial/ledger/summary')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.summary.total_credits).toBe(99000);
      expect(resB.body.summary.total_debits).toBe(0);
    });

    it('returns accurate non-zero metrics in getInvoiceMetrics and isolates by tenant', async () => {
      const partyA = await BillingParty.create({
        company_id: tenantA.company._id,
        name: 'Client A',
        gstin: '29ABCDE1234F1Z1',
        phone: '+919876543201',
        address: 'MG Road, Bangalore',
        state: 'Karnataka',
        state_code: '29',
      });

      const partyB = await BillingParty.create({
        company_id: tenantB.company._id,
        name: 'Client B',
        gstin: '29ABCDE1234F1Z2',
        phone: '+919876543202',
        address: 'FC Road, Pune',
        state: 'Maharashtra',
        state_code: '27',
      });

      await Invoice.create({
        company_id: tenantA.company._id,
        invoice_number: `INV-METRIC-A-${Date.now()}`,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        place_of_supply: '29-Karnataka',
        billing_party_id: partyA._id,
        billing_party_snapshot: { name: partyA.name, gstin: partyA.gstin },
        total_amount: 45000,
        paid_amount: 0,
        balance_amount: 45000,
        status: 'issued',
      });

      await Invoice.create({
        company_id: tenantB.company._id,
        invoice_number: `INV-METRIC-B-${Date.now()}`,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 86400000),
        place_of_supply: '27-Maharashtra',
        billing_party_id: partyB._id,
        billing_party_snapshot: { name: partyB.name, gstin: partyB.gstin },
        total_amount: 80000,
        paid_amount: 0,
        balance_amount: 80000,
        status: 'issued',
      });

      const resA = await request(app)
        .get('/api/commercial/invoices/metrics')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.metrics.total_invoiced).toBe(45000); // NOT 125000!
      expect(resA.body.metrics.total_outstanding).toBe(45000);
      expect(resA.body.metrics.total_invoices).toBe(1);

      const resB = await request(app)
        .get('/api/commercial/invoices/metrics')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.metrics.total_invoiced).toBe(80000);
      expect(resB.body.metrics.total_outstanding).toBe(80000);
    });

    it('returns accurate non-zero metrics in getVehicleEntryMetrics and isolates by tenant', async () => {
      const vendorA = await BalanceParty.create({
        company_id: tenantA.company._id,
        party_name: 'Vendor A',
        party_type: 'supplier',
        phone: '+919876543203',
      });

      const vendorB = await BalanceParty.create({
        company_id: tenantB.company._id,
        party_name: 'Vendor B',
        party_type: 'supplier',
        phone: '+919876543204',
      });

      await VehicleEntry.create({
        company_id: tenantA.company._id,
        entry_number: `VE-METRIC-A-${Date.now()}`,
        entry_date: new Date(),
        vehicle_number: 'KA-01-EE-1111',
        from_location: 'Bengaluru',
        to_location: 'Hyderabad',
        balance_party_id: vendorA._id,
        freight_amount: 30000,
        driver_cash_advance: 5000,
        diesel_advance_amount: 0,
        dala_charges: 0,
        kamisan_amount: 0,
        halting_amount: 0,
        net_balance_due: 25000,
        paid_amount: 0,
        status: 'pending',
        pod_received: false,
      });

      await VehicleEntry.create({
        company_id: tenantB.company._id,
        entry_number: `VE-METRIC-B-${Date.now()}`,
        entry_date: new Date(),
        vehicle_number: 'MH-12-FF-2222',
        from_location: 'Pune',
        to_location: 'Surat',
        balance_party_id: vendorB._id,
        freight_amount: 18000,
        driver_cash_advance: 3000,
        diesel_advance_amount: 0,
        dala_charges: 0,
        kamisan_amount: 0,
        halting_amount: 0,
        net_balance_due: 15000,
        paid_amount: 0,
        status: 'pending',
        pod_received: false,
      });

      const resA = await request(app)
        .get('/api/operations/vehicle-entries/metrics')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.totalFreightBooked).toBe(30000); // NOT 48000!
      expect(resA.body.totalAdvancesGiven).toBe(5000);
      expect(resA.body.totalBalanceDue).toBe(25000);

      const resB = await request(app)
        .get('/api/operations/vehicle-entries/metrics')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.totalFreightBooked).toBe(18000);
      expect(resB.body.totalAdvancesGiven).toBe(3000);
      expect(resB.body.totalBalanceDue).toBe(15000);
    });

    it('returns accurate executive overview in getDashboardSummary without cross-tenant bleed', async () => {
      const resA = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.summary).toBeDefined();
      expect(resA.body.summary.unbilled_lrs).toBeGreaterThanOrEqual(0);

      const resB = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.summary).toBeDefined();
    });

  });
});

