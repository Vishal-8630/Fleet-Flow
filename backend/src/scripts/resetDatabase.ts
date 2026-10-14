/**
 * ============================================================================
 * FLEET FLOW — COMPLETE DATABASE RESET & RE-SEED SCRIPT (resetDatabase.ts)
 * ============================================================================
 * 
 * WHAT DOES THIS SCRIPT DO?
 * 1. Connects to the active MongoDB database (Atlas / Local).
 * 2. Iterates over ALL collections and executes deleteMany({}) to purge 100% of documents.
 * 3. Preserves all collection indexes and schema definitions.
 * 4. Re-seeds the canonical Subscription Plans and Add-ons catalog.
 * 5. Re-creates the verified Platform Super Admin account and primary workspace.
 * 6. Validates and displays final document counts across all collections.
 * ============================================================================
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { seedBillingCatalog } from '../utils/billingSeedService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_saas';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is missing.');
  process.exit(1);
}

async function runReset() {
  console.log('================================================================');
  console.log('🧹 FLEET FLOW DATABASE WIPE & SEED INITIALIZATION');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database connection instance is undefined.');
  }

  console.log(`✅ Connected to Database: "${mongoose.connection.name}" on host "${mongoose.connection.host}"\n`);

  // 1. Fetch all collections
  const collections = await db.collections();
  console.log(`Found ${collections.length} collections to purge.\n`);

  // 2. Purge every collection
  console.log('--- Step 1: Purging all collections ---');
  const purgeSummary: { collection: string; deleted: number }[] = [];

  for (const col of collections) {
    const res = await col.deleteMany({});
    purgeSummary.push({ collection: col.collectionName, deleted: res.deletedCount || 0 });
  }

  console.table(purgeSummary);
  const totalDeleted = purgeSummary.reduce((acc, curr) => acc + curr.deleted, 0);
  console.log(`\n💥 Total documents deleted across all collections: ${totalDeleted}\n`);

  // 3. Re-seed Subscription Plans & Add-ons catalog
  console.log('--- Step 2: Re-seeding Billing Catalog (Plans & Add-ons) ---');
  await seedBillingCatalog();
  console.log('✅ Canonical subscription plans and add-ons seeded successfully.\n');

  // 4. Re-seed Super Admin Account & Primary Workspace
  console.log('--- Step 3: Re-creating Super Admin Account & Workspace ---');
  const email = 'vishh8630@gmail.com'.toLowerCase().trim();
  const plainPassword = 'vish@shiv123';
  const name = 'Vishal Super Admin';

  const password_hash = await bcrypt.hash(plainPassword, 12);

  const superAdmin = await User.create({
    name,
    email,
    password_hash,
    is_platform_super_admin: true,
    is_verified: true,
  });

  const adminCompany = await Company.create({
    name: 'Fleet Flow Master Admin',
    slug: 'fleet-flow-admin',
    email,
    phone: '+91 9876543210',
    subscription_status: 'active',
  });

  await CompanyMember.create({
    company_id: adminCompany._id,
    user_id: superAdmin._id,
    email: superAdmin.email,
    role: 'admin',
    status: 'active',
  });

  console.log('✅ Super Admin account & company workspace created successfully:');
  console.log(`   - Email:     ${email}`);
  console.log(`   - Password:  ${plainPassword}`);
  console.log(`   - Role:      Platform Super Admin`);
  console.log(`   - Workspace: ${adminCompany.name} (Slug: ${adminCompany.slug})\n`);

  // 5. Final Verification of Document Counts
  console.log('--- Step 4: Final Database Status Verification ---');
  const finalCollections = await db.collections();
  const finalCounts: { collection: string; count: number }[] = [];

  for (const col of finalCollections) {
    const count = await col.countDocuments();
    finalCounts.push({ collection: col.collectionName, count });
  }

  console.table(finalCounts.filter(c => c.count > 0));

  console.log('================================================================');
  console.log('✨ DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');

  await mongoose.disconnect();
}

runReset().catch((err) => {
  console.error('❌ Database reset failed with error:', err);
  process.exit(1);
});
