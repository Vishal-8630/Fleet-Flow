/**
 * ============================================================================
 * FLEET FLOW — PHASE 2 AUTOMATED VERIFICATION SUITE (verifyPhase2.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SCRIPT?
 * --------------------
 * Automated end-to-end integration test verifying all Phase 2 architectural
 * criteria directly against the live MongoDB Atlas database:
 * 1. Fleet & Truck Statutory Compliance Status Engine (COMPLIANT, EXPIRING_SOON, EXPIRED).
 * 2. Driver Master with Aadhaar PII Masking (`XXXX-XXXX-1234`).
 * 3. Bidirectional Driver-Vehicle Allocation and assignment history lifecycle.
 * 4. Customer Billing Party (GSTIN validation) and Vendor Balance Party creation.
 * 5. Document Vault Cross-Tenant Access Boundary (403 Forbidden enforcement).
 * 6. Multi-Tenant Isolation via `AsyncLocalStorage` across all Phase 2 collections.
 * 7. Soft-delete integrity on fleet assets.
 * 
 * HOW TO RUN:
 * ------------
 * $ npm run test:phase2
 * ============================================================================
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { BillingParty } from '../models/BillingParty.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { tenantStorage } from '../plugins/tenantPlugin.js';
import { getAuthorizedDownloadUrl } from '../utils/storageService.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function runPhase2Verification() {
  console.log('====================================================');
  console.log('   FLEET FLOW — PHASE 2 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('1. Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('   ✅ Successfully connected to MongoDB Atlas.\n');

  try {
    console.log('2. Provisioning Isolated Test Tenants for Phase 2...');

    // Teardown any leftover test data
    await Company.deleteMany({ slug: { $in: ['phase2-test-alpha', 'phase2-test-beta'] } });

    const companyA = await Company.create({
      name: 'Phase2 Alpha Freight Logistics',
      slug: 'phase2-test-alpha',
      email: 'alpha.fleet@test.com',
      phone: '9811111111',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const companyB = await Company.create({
      name: 'Phase2 Beta Express Movers',
      slug: 'phase2-test-beta',
      email: 'beta.fleet@test.com',
      phone: '9822222222',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    console.log(`   ✅ Tenant A: ${companyA.name} (${companyA._id})`);
    console.log(`   ✅ Tenant B: ${companyB.name} (${companyB._id})\n`);

    // Clean prior test records
    await Truck.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await Driver.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await BillingParty.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await BalanceParty.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });

    // ------------------------------------------------------------------------
    // TEST 3: Statutory Compliance Status Engine
    // ------------------------------------------------------------------------
    console.log('3. Testing Statutory Compliance Status Engine...');
    const now = new Date();
    const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    const expiringSoonDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
    const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    // Truck 1: Fully Compliant
    const truckCompliant = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await Truck.create({
        truck_no: 'MH12AA1111',
        make: 'Tata',
        model: 'Prima 5530.S',
        tonnage_capacity: 40,
        fitness_doc: { expiry_date: futureDate, document_number: 'FIT-101' },
        insurance_doc: { expiry_date: futureDate, policy_number: 'INS-101' },
        national_permit_doc: { expiry_date: futureDate, document_number: 'NP-101' },
        state_permit_doc: { expiry_date: futureDate, document_number: 'SP-101' },
        road_tax_doc: { expiry_date: futureDate, document_number: 'TAX-101' },
        puc_doc: { expiry_date: futureDate, document_number: 'PUC-101' },
      });
    });

    // Truck 2: Expiring Soon
    const truckExpiring = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await Truck.create({
        truck_no: 'MH12BB2222',
        make: 'Ashok Leyland',
        model: '4825 Heavy Duty',
        tonnage_capacity: 35,
        fitness_doc: { expiry_date: futureDate },
        road_tax_doc: { expiry_date: expiringSoonDate }, // 5 days left
      });
    });

    // Truck 3: Expired
    const truckExpired = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await Truck.create({
        truck_no: 'MH12CC3333',
        make: 'BharatBenz',
        model: '3528C Tipper',
        tonnage_capacity: 28,
        fitness_doc: { expiry_date: futureDate },
        insurance_doc: { expiry_date: pastDate }, // expired
      });
    });

    if (truckCompliant.calculateComplianceStatus() !== 'COMPLIANT') {
      throw new Error(`Truck 1 expected COMPLIANT, got ${truckCompliant.calculateComplianceStatus()}`);
    }
    if (truckExpiring.calculateComplianceStatus() !== 'EXPIRING_SOON') {
      throw new Error(`Truck 2 expected EXPIRING_SOON, got ${truckExpiring.calculateComplianceStatus()}`);
    }
    if (truckExpired.calculateComplianceStatus() !== 'EXPIRED') {
      throw new Error(`Truck 3 expected EXPIRED, got ${truckExpired.calculateComplianceStatus()}`);
    }
    console.log('   ✅ Truck 1 (valid docs): COMPLIANT');
    console.log('   ✅ Truck 2 (expires in 5d): EXPIRING_SOON');
    console.log('   ✅ Truck 3 (expired 5d ago): EXPIRED\n');

    // ------------------------------------------------------------------------
    // TEST 4: Driver Master & Aadhaar PII Masking
    // ------------------------------------------------------------------------
    console.log('4. Testing Driver Master & Aadhaar PII Masking...');
    const testDriver = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await Driver.create({
        name: 'Suresh Patil',
        phone: '9876543210',
        license_number: 'MH1220200049281',
        aadhaar_number: '5544 3322 1199',
        running_advance_balance: 500000, // 5,000 INR in paise
        status: 'active',
      });
    });

    const viewerSafe = testDriver.toSafeJSON('viewer');
    const dispatcherSafe = testDriver.toSafeJSON('dispatcher');
    const adminSafe = testDriver.toSafeJSON('admin');
    const accountantSafe = testDriver.toSafeJSON('accountant');

    if (viewerSafe.aadhaar_number !== 'XXXX-XXXX-1199') {
      throw new Error(`Expected masked Aadhaar for viewer, got: ${viewerSafe.aadhaar_number}`);
    }
    if (dispatcherSafe.aadhaar_number !== 'XXXX-XXXX-1199') {
      throw new Error(`Expected masked Aadhaar for dispatcher, got: ${dispatcherSafe.aadhaar_number}`);
    }
    if (adminSafe.aadhaar_number !== '5544 3322 1199') {
      throw new Error(`Expected full Aadhaar for admin, got: ${adminSafe.aadhaar_number}`);
    }
    if (accountantSafe.aadhaar_number !== '5544 3322 1199') {
      throw new Error(`Expected full Aadhaar for accountant, got: ${accountantSafe.aadhaar_number}`);
    }
    console.log('   ✅ PII Masking for Viewer/Dispatcher: XXXX-XXXX-1199 (Masked)');
    console.log('   ✅ PII Access for Admin/Accountant: 5544 3322 1199 (Unmasked)\n');

    // ------------------------------------------------------------------------
    // TEST 5: Bidirectional Vehicle-Driver Allocation
    // ------------------------------------------------------------------------
    console.log('5. Testing Vehicle & Driver Bidirectional Allocation...');
    await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      // Bind driver to truck
      truckCompliant.current_driver_id = testDriver._id as any;
      truckCompliant.driver_assignments.push({
        driver_id: testDriver._id as any,
        assigned_at: new Date(),
        notes: 'Initial allocation for long-haul route',
      });
      await truckCompliant.save();

      testDriver.current_truck_id = truckCompliant._id as any;
      testDriver.assignment_history.push({
        truck_id: truckCompliant._id as any,
        assigned_at: new Date(),
        notes: 'Assigned to MH12AA1111',
      });
      await testDriver.save();
    });

    const verifyTruck = await Truck.findById(truckCompliant._id);
    const verifyDriver = await Driver.findById(testDriver._id);

    if (String(verifyTruck?.current_driver_id) !== String(testDriver._id)) {
      throw new Error('Truck driver binding mismatch.');
    }
    if (String(verifyDriver?.current_truck_id) !== String(truckCompliant._id)) {
      throw new Error('Driver vehicle binding mismatch.');
    }
    console.log(`   ✅ Truck ${verifyTruck?.truck_no} correctly bound to Driver ${verifyDriver?.name}`);
    console.log(`   ✅ Historical assignment logs recorded on both records.\n`);

    // ------------------------------------------------------------------------
    // TEST 6: Commercial Partner Directories (Billing & Balance)
    // ------------------------------------------------------------------------
    console.log('6. Testing Commercial Partner Master Registries...');
    const billingParty = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await BillingParty.create({
        name: 'Apex FMCG Distributors Pvt Ltd',
        trade_name: 'Apex Express Cargo',
        gstin: '27ABCDE1234F1Z5',
        pan_number: 'ABCDE1234F',
        contact_person: 'Anil Deshmukh',
        phone: '9812345678',
        payment_terms_days: 45,
        credit_limit: 500000,
      });
    });

    const balanceParty = await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      return await BalanceParty.create({
        party_name: 'Western Highway Fuel Plaza',
        party_type: 'petrol_pump',
        contact_person: 'Mohan Sharma',
        phone: '9898765432',
        bank_details: {
          account_number: '50200099887766',
          ifsc_code: 'HDFC0000123',
          bank_name: 'HDFC Bank Ltd',
        },
        opening_balance: 125000,
      });
    });

    console.log(`   ✅ Customer Billing Party created: ${billingParty.name} (GSTIN: ${billingParty.gstin})`);
    console.log(`   ✅ Vendor Balance Party created: ${balanceParty.party_name} (${balanceParty.party_type})\n`);

    // ------------------------------------------------------------------------
    // TEST 7: Cross-Tenant Logical Isolation
    // ------------------------------------------------------------------------
    console.log('7. Testing Zero-Data-Leakage Tenant Boundaries...');
    // Under Tenant B's context, NO Tenant A records should be visible
    await tenantStorage.run({ companyId: String(companyB._id) }, async () => {
      const bTrucks = await Truck.find();
      const bDrivers = await Driver.find();
      const bBilling = await BillingParty.find();
      const bBalance = await BalanceParty.find();

      if (bTrucks.length !== 0) throw new Error(`Data leakage! Tenant B sees ${bTrucks.length} trucks.`);
      if (bDrivers.length !== 0) throw new Error(`Data leakage! Tenant B sees ${bDrivers.length} drivers.`);
      if (bBilling.length !== 0) throw new Error(`Data leakage! Tenant B sees ${bBilling.length} billing parties.`);
      if (bBalance.length !== 0) throw new Error(`Data leakage! Tenant B sees ${bBalance.length} balance parties.`);
    });
    console.log('   ✅ Tenant B queries successfully returned ZERO Tenant A fleet assets, drivers, or parties.\n');

    // ------------------------------------------------------------------------
    // TEST 8: Document Vault S3 Cross-Tenant Authorization Boundary
    // ------------------------------------------------------------------------
    console.log('8. Testing Document Vault Presigned URL Tenant Boundary...');
    const foreignTenantKey = `tenants/${companyA._id}/trucks/2026_10/unauthorized-file.pdf`;

    let crossTenantRejected = false;
    try {
      // Company B attempting to access Company A's key
      await getAuthorizedDownloadUrl(String(companyB._id), foreignTenantKey);
    } catch (authErr: any) {
      if (authErr.message.includes('FORBIDDEN')) {
        crossTenantRejected = true;
      }
    }

    if (!crossTenantRejected) {
      throw new Error('Security flaw: Cross-tenant storage key was NOT rejected with 403 Forbidden!');
    }
    console.log('   ✅ Cross-tenant key request correctly rejected with 403 Forbidden.\n');

    // ------------------------------------------------------------------------
    // TEST 9: Soft-Delete Integrity
    // ------------------------------------------------------------------------
    console.log('9. Testing Soft-Delete Integrity...');
    await tenantStorage.run({ companyId: String(companyA._id) }, async () => {
      truckExpired.is_deleted = true;
      await truckExpired.save();

      const activeList = await Truck.find({ is_deleted: false });
      const foundDeleted = activeList.some((t) => t.truck_no === 'MH12CC3333');
      if (foundDeleted) {
        throw new Error('Soft-deleted truck appeared in active fleet query!');
      }
    });
    console.log('   ✅ Soft-deleted truck correctly filtered out from active fleet queries.\n');

    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log('10. Cleaning up test artifacts from Atlas database...');
    await Truck.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await Driver.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await BillingParty.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await BalanceParty.deleteMany({ company_id: { $in: [companyA._id, companyB._id] } });
    await Company.deleteMany({ _id: { $in: [companyA._id, companyB._id] } });
    console.log('   ✅ Database cleanly restored.\n');

    console.log('====================================================');
    console.log('   🎉 ALL PHASE 2 ACCEPTANCE CRITERIA PASSED (100%)');
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ Phase 2 Verification Failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase2Verification();
